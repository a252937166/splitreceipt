/**
 * Receipt verification and bounded history recovery.
 *
 * Verification is the only thing that turns a candidate hash into a receipt:
 * canonical block and SharePaid event (`discoverReceiptsFromHints`, unchanged) plus the
 * transaction-level check (`verifyPaymentTransaction`). Recovery pages through history for
 * the payers that are STILL MISSING a verified receipt, by identity. It stops because those
 * exact payers were verified, never because some number of candidates was seen. A known payer,
 * an invalid candidate or a transient failure never ends the search early.
 */
import type { PublicClient } from 'viem'
import { discoverReceiptsFromHints } from './receiptDiscovery.ts'
import type { HintHash } from './receiptHints.ts'
import {
  scanSharePaidPage,
  startHistoryCursor,
  type HistoryCursor,
  type ReceiptScope,
} from './receiptHistory.ts'
import { verifyPaymentTransaction, type PaymentClient } from './paymentVerification.ts'
import type { Address } from './networks.ts'

export interface VerifyOutcome {
  /** payer -> hash, proved by canonical block/event AND the transaction check */
  verified: Record<string, HintHash>
  /** Checked and definitively not a valid receipt for any missing payer. */
  invalid: HintHash[]
  /** Not decided because of an RPC problem; worth retrying. */
  unresolved: HintHash[]
  message: string | null
}

type VerifyClient = PaymentClient & Parameters<typeof discoverReceiptsFromHints>[0]['client']

export async function verifyCandidateSet(args: {
  client: VerifyClient
  scope: ReceiptScope
  /** The paid payers to look for (lowercase). */
  payers: readonly string[]
  share: bigint
  candidates: readonly HintHash[]
  isCancelled: () => boolean
}): Promise<VerifyOutcome> {
  const { client, scope, share, isCancelled } = args
  const out: VerifyOutcome = { verified: {}, invalid: [], unresolved: [], message: null }
  if (args.candidates.length === 0 || args.payers.length === 0) return out

  const found = await discoverReceiptsFromHints({
    client,
    scope,
    candidates: args.candidates,
    paidPayers: args.payers,
    amount: share,
    isCancelled,
  })
  if (isCancelled()) return out

  let transient = found.rpcError
  const accepted = new Set<string>()
  const rejected = new Set<string>(found.invalidatedHashes.map((h) => h.toLowerCase()))
  for (const [payer, hash] of Object.entries(found.receipts)) {
    const tx = await verifyPaymentTransaction(client, {
      contract: scope.contract as Address,
      billId: scope.billId,
      payer,
      amount: share,
      hash,
    })
    if (isCancelled()) return out
    if (tx.ok) {
      out.verified[payer] = hash
      accepted.add(hash.toLowerCase())
    } else if (tx.transient) {
      transient = 'Payment lookup paused. Check your connection and retry.'
    } else {
      rejected.add(hash.toLowerCase())
    }
  }
  out.invalid = args.candidates.filter((h) => rejected.has(h.toLowerCase()) && !accepted.has(h.toLowerCase()))
  if (transient) {
    out.message = transient
    out.unresolved = args.candidates.filter((h) => !accepted.has(h.toLowerCase()) && !rejected.has(h.toLowerCase()))
  }
  return out
}

export interface RecoveryInput {
  client: VerifyClient & Pick<PublicClient, 'getLogs' | 'getBlockNumber'>
  scope: ReceiptScope
  /** Lowercase paid payers. */
  paidPayers: readonly string[]
  share: bigint
  /** Live view of payers already proved in the current generation. */
  verified: () => ReadonlySet<string>
  /** Called the moment a proof is verified, so state can update incrementally. */
  onVerified: (payer: string, hash: HintHash) => void
  cursor: HistoryCursor | null
  deployBlock: bigint | null
  /** Candidates from an interrupted run (RPC outage) to verify before scanning on. */
  carry: readonly HintHash[]
  isStale: () => boolean
  maxPages?: number
  pageBlocks?: bigint
}

export interface RecoveryResult {
  cursor: HistoryCursor | null
  carry: HintHash[]
  /** Every paid payer has a freshly verified receipt. */
  complete: boolean
  /** The reviewed floor was reached: no earlier history exists to search. */
  exhausted: boolean
  message: string | null
  stale: boolean
  pagesScanned: number
}

export async function recoverMissingReceipts(input: RecoveryInput): Promise<RecoveryResult> {
  const { scope, share, isStale } = input
  const missingNow = () => input.paidPayers.filter((p) => !input.verified().has(p))
  const rejected = new Set<string>()
  let carry: HintHash[] = [...input.carry]
  let cursor = input.cursor
  let message: string | null = null
  let pages = 0

  const result = (extra: Partial<RecoveryResult> = {}): RecoveryResult => ({
    cursor,
    carry,
    complete: missingNow().length === 0,
    exhausted: cursor?.done ?? false,
    message,
    stale: false,
    pagesScanned: pages,
    ...extra,
  })
  const staleResult = () => result({ stale: true })

  const apply = (out: VerifyOutcome) => {
    for (const [payer, hash] of Object.entries(out.verified)) input.onVerified(payer, hash)
    for (const h of out.invalid) rejected.add(h.toLowerCase())
    carry = out.unresolved
    message = out.message
  }
  const verify = (hashes: readonly HintHash[]) =>
    verifyCandidateSet({ client: input.client, scope, payers: missingNow(), share, candidates: hashes, isCancelled: isStale })

  if (carry.length > 0 && missingNow().length > 0) {
    const out = await verify(carry)
    if (isStale()) return staleResult()
    apply(out)
  }

  try {
    cursor ??= await startHistoryCursor(input.client, input.deployBlock)
  } catch {
    message = 'Receipt history lookup paused. Check your connection and continue.'
    return result()
  }
  if (isStale()) return staleResult()

  let pagesLeft = input.maxPages ?? 12
  while (!isStale()) {
    const missing = missingNow()
    if (missing.length === 0) break
    if (carry.length > 0) break // an outage left candidates undecided; do not scan past them
    if (cursor.done || pagesLeft <= 0) break

    const scan = await scanSharePaidPage(input.client, scope, cursor, {
      missingPayers: missing,
      maxPages: pagesLeft,
      pageBlocks: input.pageBlocks,
      shouldStop: isStale,
    })
    pagesLeft -= scan.pagesScanned
    pages += scan.pagesScanned
    cursor = scan.cursor
    if (scan.stopped || isStale()) return staleResult()
    // Candidates from pages that DID succeed are processed even when a later page failed: the cursor already
    // moved past those blocks, so they must be verified now or retained in `carry`, never dropped.
    const fresh = scan.candidates.map((c) => c.hash as HintHash).filter((h) => !rejected.has(h.toLowerCase()))
    if (fresh.length > 0) {
      const out = await verify(fresh)
      if (isStale()) return staleResult()
      apply(out)
    }
    if (scan.error) {
      message = scan.error // the failed page is still ahead of the preserved cursor
      break
    }
    if (carry.length > 0) break
  }
  if (isStale()) return staleResult()
  return result()
}
