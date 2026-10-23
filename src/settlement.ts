/**
 * Settlement: deciding what happened to a transaction the user already sent.
 *
 * A transaction hash existing, or even `status: success`, is not proof that the
 * bill was created or the share was paid. The wallet may have replaced the
 * transaction (repriced, cancelled, swapped), the RPC may be slow, or the context
 * the user was in may have changed. Four outcomes are kept distinct:
 *
 *  - verified        the FINAL canonical transaction matches the frozen intent and the
 *                    chain state agrees (BillCreated + getBill, or SharePaid + paid state);
 *  - not-completed   definitive: reverted, cancelled, replaced by something else, or no
 *                    matching event. The bill stays unpaid or uncreated. Retry is allowed,
 *                    but only when the user chooses it. Nothing is resubmitted automatically;
 *  - sent-unverified the transaction was sent but the result could not be read or reconciled
 *                    yet (timeout, RPC trouble). It may still confirm. Read-only recovery;
 *  - stale           the wallet, page or action changed; the caller must not commit anything.
 *
 * The submitted hash and the final hash are tracked separately. Receipts, links and cached
 * candidates always use the final canonical hash.
 */
import type { PublicClient } from 'viem'
import type { LiveCheck } from './epoch.ts'
import { verifyCreateBillTransaction, type CreateVerificationClient, type IntendedBill } from './createBillReceipt.ts'
import { verifyPaymentTransaction, type PaymentClient } from './paymentVerification.ts'
import { discoverReceiptsFromHints } from './receiptDiscovery.ts'
import type { HintHash } from './receiptHints.ts'
import type { Address, Hash32 } from './networks.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from './splitReceiptAbi.ts'

export interface Replacement {
  reason: 'repriced' | 'cancelled' | 'replaced'
  hash: Hash32
}

export interface WaitResult {
  receipt: { transactionHash: Hash32; status: 'success' | 'reverted' }
  replaced: Replacement | null
}

/** Resolves with the receipt of the transaction that finally mined (the replacement, if any). */
export type WaitFn = (hash: Hash32) => Promise<WaitResult>

/** How long to wait for a receipt before reporting "sent, not yet verified". Optional override: VITE_RECEIPT_WAIT_MS (1 to 600 seconds). */
export function receiptWaitMs(): number {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const n = Number(env?.VITE_RECEIPT_WAIT_MS)
  return Number.isFinite(n) && n >= 1_000 && n <= 600_000 ? n : 120_000
}

export function viemWait(client: Pick<PublicClient, 'waitForTransactionReceipt'>, timeout = receiptWaitMs()): WaitFn {
  return async (hash) => {
    let replaced: Replacement | null = null
    const receipt = await client.waitForTransactionReceipt({
      hash,
      timeout,
      onReplaced: (r) => {
        replaced = { reason: r.reason, hash: r.transaction.hash as Hash32 }
      },
    })
    return {
      receipt: { transactionHash: receipt.transactionHash as Hash32, status: receipt.status },
      replaced,
    }
  }
}

export type Settlement<T> =
  | { kind: 'verified'; submittedHash: Hash32; finalHash: Hash32; replaced: Replacement | null; data: T }
  | { kind: 'not-completed'; submittedHash: Hash32; finalHash: Hash32 | null; reason: string }
  | { kind: 'sent-unverified'; submittedHash: Hash32; reason: string }
  | { kind: 'stale'; submittedHash: Hash32 }

interface Common {
  token: LiveCheck
  wait: WaitFn
  submittedHash: Hash32
  retries?: number
  retryDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const describeReplacement = (r: Replacement | null) =>
  r ? ` The transaction was replaced (${r.reason}) by ${r.hash}.` : ''

export interface CreateSettlementData {
  billId: bigint
  creator: Address
}

export async function settleCreate(
  args: Common & {
    client: CreateVerificationClient
    chainId: number
    contract: Address
    intended: IntendedBill
    creator: Address
  },
): Promise<Settlement<CreateSettlementData>> {
  const { token, submittedHash } = args
  const sleep = args.sleep ?? defaultSleep
  const stale: Settlement<CreateSettlementData> = { kind: 'stale', submittedHash }

  let waited: WaitResult
  try {
    waited = await args.wait(submittedHash)
  } catch {
    return token.isLive()
      ? { kind: 'sent-unverified', submittedHash, reason: 'The network did not confirm the transaction in time, or could not be read.' }
      : stale
  }
  if (!token.isLive()) return stale

  const finalHash = waited.receipt.transactionHash
  if (waited.receipt.status !== 'success') {
    return { kind: 'not-completed', submittedHash, finalHash, reason: `The transaction failed on the network.${describeReplacement(waited.replaced)}` }
  }

  const once = () =>
    verifyCreateBillTransaction(args.client, {
      chainId: args.chainId,
      contract: args.contract,
      hash: finalHash,
      intended: args.intended,
      expectedCreator: args.creator,
    })
  let v = await once()
  for (let i = 0; i < (args.retries ?? 5) && !v.ok && v.transient; i++) {
    if (!token.isLive()) return stale
    await sleep(args.retryDelayMs ?? 1500)
    if (!token.isLive()) return stale
    v = await once()
  }
  if (!token.isLive()) return stale

  if (v.ok) {
    return { kind: 'verified', submittedHash, finalHash, replaced: waited.replaced, data: { billId: v.billId, creator: v.creator } }
  }
  if (v.transient) return { kind: 'sent-unverified', submittedHash, reason: v.reason }
  return { kind: 'not-completed', submittedHash, finalHash, reason: `${v.reason}${describeReplacement(waited.replaced)}` }
}

export interface BillReader {
  (): Promise<{ payers: readonly string[]; paid: readonly boolean[] }>
}

export async function settlePay(
  args: Common & {
    client: PaymentClient & Parameters<typeof discoverReceiptsFromHints>[0]['client']
    chainId: number
    contract: Address
    billId: bigint
    payer: Address
    share: bigint
    readBill: BillReader
  },
): Promise<Settlement<{ payer: Address }>> {
  const { token, submittedHash, payer, share, billId } = args
  const sleep = args.sleep ?? defaultSleep
  const retries = args.retries ?? 5
  const delay = args.retryDelayMs ?? 1500
  const stale: Settlement<{ payer: Address }> = { kind: 'stale', submittedHash }

  let waited: WaitResult
  try {
    waited = await args.wait(submittedHash)
  } catch {
    return token.isLive()
      ? { kind: 'sent-unverified', submittedHash, reason: 'The network did not confirm the payment in time, or could not be read.' }
      : stale
  }
  if (!token.isLive()) return stale

  const finalHash = waited.receipt.transactionHash
  const note = describeReplacement(waited.replaced)
  const notDone = (reason: string): Settlement<{ payer: Address }> => ({ kind: 'not-completed', submittedHash, finalHash, reason: `${reason}${note}` })
  if (waited.receipt.status !== 'success') return notDone('The payment transaction failed on the network, so your share is still unpaid.')

  // 1. The final transaction must be the frozen payment: payer -> pinned contract, payShare(billId), exact share.
  const txCheck = () => verifyPaymentTransaction(args.client, { contract: args.contract, billId, payer, amount: share, hash: finalHash })
  let tx = await txCheck()
  for (let i = 0; i < retries && !tx.ok && tx.transient; i++) {
    if (!token.isLive()) return stale
    await sleep(delay)
    if (!token.isLive()) return stale
    tx = await txCheck()
  }
  if (!token.isLive()) return stale
  if (!tx.ok) {
    return tx.transient
      ? { kind: 'sent-unverified', submittedHash, reason: tx.reason }
      : notDone(`That transaction is not this payment (${tx.reason}). Your share is still unpaid.`)
  }

  // 2. Canonical block and a SharePaid event for this contract, bill, payer and share.
  const scope = { chainId: args.chainId, contract: args.contract, billId }
  const found = await discoverReceiptsFromHints({
    client: args.client,
    scope,
    candidates: [finalHash as HintHash],
    paidPayers: [payer],
    amount: share,
    isCancelled: () => !token.isLive(),
  })
  if (!token.isLive()) return stale
  if (found.rpcError) return { kind: 'sent-unverified', submittedHash, reason: found.rpcError }
  if (found.receipts[payer.toLowerCase()]?.toLowerCase() !== finalHash.toLowerCase()) {
    return notDone('No matching payment event was found for this bill. Your share is still unpaid.')
  }

  // 3. The bill itself must now show this payer as paid.
  for (let i = 0; i <= retries; i++) {
    try {
      const bill = await args.readBill()
      if (!token.isLive()) return stale
      const idx = bill.payers.findIndex((p) => p.toLowerCase() === payer.toLowerCase())
      if (idx >= 0 && bill.paid[idx]) {
        return { kind: 'verified', submittedHash, finalHash, replaced: waited.replaced, data: { payer } }
      }
    } catch {
      if (!token.isLive()) return stale
    }
    if (i < retries) {
      await sleep(delay)
      if (!token.isLive()) return stale
    }
  }
  return {
    kind: 'sent-unverified',
    submittedHash,
    reason: 'The payment looks confirmed, but the bill does not show your share as paid yet.',
  }
}

/** Read helper shared by the UI: getBill as { payers, paid }. */
export function billReader(
  client: Pick<PublicClient, 'readContract'>,
  contract: Address,
  billId: bigint,
): BillReader {
  return async () => {
    const res = (await client.readContract({
      address: contract,
      abi: SPLIT_RECEIPT_HUMAN_ABI,
      functionName: 'getBill',
      args: [billId],
    })) as readonly [string, string, readonly string[], bigint, readonly boolean[]]
    return { payers: res[2], paid: res[4] }
  }
}
