/**
 * Fast-path receipt discovery via hint candidates.
 *
 * Verification chain per candidate:
 *   1. await client.getChainId() === 5042002           (live, not client.chain.id)
 *   2. await client.getBlockNumber()                   (fresh head; reject future blocks)
 *   3. getTransactionReceipt(hash)                     — mined, status=success
 *   4. receipt.blockNumber <= head                     — reject future/orphaned
 *   5. receipt.blockHash: required valid 32-byte hex   — NOT optional
 *   6. getBlock(blockNumber)                           — canonical block hash equality
 *   7. receipt.blockHash === canonical block hash      — required
 *   8. Every matching log MUST have:
 *        log.blockNumber   non-null bigint === receipt.blockNumber
 *        log.blockHash     valid 32-byte hex === receipt.blockHash === canonical
 *        log.transactionHash valid 32-byte hex === requested hash
 *      Missing or malformed identity fields → reject log as invalid
 *   9. Decode SharePaid from exact contract address, match billId/payer/amount/non-removed
 *  10. A conflicting distinct confirmed hash for the same payer:
 *        — delete that payer from the receipts map immediately
 *        — mark result incomplete; stop processing further candidates
 *        — clear freshVerifiedRef (caller responsibility)
 *
 * Hashes not found or reverted: only viem's TransactionReceiptNotFoundError (or
 * equivalent structured error) classifies a receipt as definitively invalid.
 * All other errors (HTTP failures, method-not-found, getBlock failures, etc.)
 * pause safely; the candidate is NOT added to invalidatedHashes.
 *
 * invalidatedHashes: hashes explicitly checked and found invalid (not-found via
 * structured error, reverted, block-hash mismatch, orphaned). Does NOT include
 * hashes that got a transient RPC error.
 */

import { parseAbiItem, decodeEventLog, TransactionReceiptNotFoundError, type PublicClient } from 'viem'
import type { ReceiptScope } from './receiptHistory.ts'
import { receiptScopeKey } from './receiptHistory.ts'
import type { HintHash } from './receiptHints.ts'
import { MAX_TOTAL_CANDIDATES, isValidHintHash } from './receiptHints.ts'

// SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)
const SHARE_PAID_ABI_ITEM = parseAbiItem(
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)'
)

/** Valid non-empty 32-byte 0x-prefixed hex hash. */
function isValidBlockHash(h: unknown): h is string {
  return typeof h === 'string' && /^0x[0-9a-f]{64}$/i.test(h)
}

export interface DiscoveryResult {
  /** Verified payer (lowercase) → confirmed mined tx hash. */
  receipts: Record<string, HintHash>
  /** True only when every paidPayer has a verified receipt AND no conflict/error. */
  complete: boolean
  /** Non-null when a transient RPC error or conflict interrupted verification. */
  rpcError: string | null
  /**
   * Hashes explicitly checked and found invalid (not-found via structured error,
   * reverted, wrong block, orphaned, block-hash mismatch, no matching log).
   * Does NOT include hashes that got transient RPC errors (unresolved ≠ invalid).
   */
  invalidatedHashes: HintHash[]
}

/** Internal per-candidate verification result. */
type CandidateOutcome =
  | { kind: 'match'; payer: string; hash: HintHash; blockNumber: bigint; blockHash: string }
  | { kind: 'invalid' }
  | { kind: 'conflict'; payer: string; existingHash: HintHash; newHash: HintHash }
  | { kind: 'rpc-error'; message: string }

/**
 * Verify one candidate hash against the live client.
 * @param head Fresh chain head from the single getBlockNumber call per run.
 */
async function verifyCandidate(
  client: PublicClient,
  scope: ReceiptScope,
  hash: HintHash,
  paidPayers: readonly string[],
  amount: bigint,
  contractAddress: string,
  head: bigint,
  isCancelled: () => boolean,
  blockHashCache: Map<bigint, string>,
): Promise<CandidateOutcome[]> {
  let receipt: Awaited<ReturnType<PublicClient['getTransactionReceipt']>>

  try {
    receipt = await client.getTransactionReceipt({ hash })
    if (isCancelled()) return [{ kind: 'invalid' }]
  } catch (err) {
    // Only TransactionReceiptNotFoundError is definitively invalid.
    // All other errors (HTTP, method-not-found, network) pause safely.
    if (err instanceof TransactionReceiptNotFoundError) {
      return [{ kind: 'invalid' }]
    }
    return [{ kind: 'rpc-error', message: 'Receipt lookup paused. Check your connection and retry.' }]
  }

  // Not found, reverted, or hash identity mismatch → explicitly invalid.
  if (!receipt) return [{ kind: 'invalid' }]
  if (receipt.status !== 'success') return [{ kind: 'invalid' }]
  if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase()) return [{ kind: 'invalid' }]

  const blockNum = receipt.blockNumber
  if (blockNum === null || blockNum === undefined) return [{ kind: 'invalid' }]

  // Reject receipts with block numbers beyond the fresh head (orphaned/future).
  if (blockNum > head) return [{ kind: 'invalid' }]

  // receipt.blockHash is REQUIRED: valid non-empty 32-byte hex.
  if (!isValidBlockHash(receipt.blockHash)) return [{ kind: 'invalid' }]
  const receiptBlockHash = receipt.blockHash.toLowerCase()

  // Canonical block hash — deduplicate block reads via cache.
  let canonicalBlockHash = blockHashCache.get(blockNum)
  if (!canonicalBlockHash) {
    let block: Awaited<ReturnType<PublicClient['getBlock']>>
    try {
      block = await client.getBlock({ blockNumber: blockNum })
      if (isCancelled()) return [{ kind: 'invalid' }]
    } catch {
      // getBlock failure is a transient RPC error — pause safely, do NOT invalidate.
      return [{ kind: 'rpc-error', message: 'Block lookup paused. Check your connection and retry.' }]
    }
    const rawBlockHash = block?.hash
    if (!isValidBlockHash(rawBlockHash)) return [{ kind: 'invalid' }]
    canonicalBlockHash = rawBlockHash.toLowerCase()
    blockHashCache.set(blockNum, canonicalBlockHash)
  }

  // receipt.blockHash must equal the canonical block hash — required.
  if (receiptBlockHash !== canonicalBlockHash) return [{ kind: 'invalid' }]

  // Decode SharePaid logs. ALL identity fields on each log are REQUIRED.
  const outcomes: CandidateOutcome[] = []
  const paidSet = new Set(paidPayers.map(p => p.toLowerCase()))

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue
    if (log.removed) continue

    // Log identity fields are REQUIRED — missing or malformed → reject this log.
    // log.blockNumber must be a non-null bigint equal to receipt.blockNumber.
    if (typeof log.blockNumber !== 'bigint' || log.blockNumber !== blockNum) continue
    // log.blockHash must be a valid 32-byte hex equal to the canonical block hash.
    if (!isValidBlockHash(log.blockHash) || log.blockHash.toLowerCase() !== canonicalBlockHash) continue
    // log.transactionHash must be a valid 32-byte hex equal to the requested hash.
    if (!isValidHintHash(log.transactionHash) || log.transactionHash.toLowerCase() !== hash.toLowerCase()) continue

    let decoded: { args: { billId?: bigint; payer?: string; amount?: bigint } }
    try {
      decoded = decodeEventLog({
        abi: [SHARE_PAID_ABI_ITEM],
        data: log.data,
        topics: log.topics,
        eventName: 'SharePaid',
        strict: true,
      }) as typeof decoded
    } catch {
      continue
    }

    const { billId: decodedBillId, payer: decodedPayer, amount: decodedAmount } = decoded.args
    if (decodedBillId !== scope.billId) continue
    if (decodedAmount !== amount) continue
    if (!decodedPayer) continue
    const payerLc = decodedPayer.toLowerCase()
    if (!paidSet.has(payerLc)) continue

    outcomes.push({ kind: 'match', payer: payerLc, hash, blockNumber: blockNum, blockHash: canonicalBlockHash })
  }

  // A receipt that passed all checks but had no matching logs is explicitly invalid.
  return outcomes.length > 0 ? outcomes : [{ kind: 'invalid' }]
}

/**
 * Verify all candidates and return confirmed receipts.
 *
 * Chain identity: await client.getChainId() — not client.chain.id.
 * Fresh head: single getBlockNumber() per run; future blocks rejected.
 * Conflict: first conflicting distinct hash → delete payer from receipts,
 *   mark complete:false, stop all further candidate processing.
 */
export async function discoverReceiptsFromHints(options: {
  client: PublicClient
  scope: ReceiptScope
  candidates: readonly HintHash[]
  paidPayers: readonly string[]
  amount: bigint
  isCancelled: () => boolean
  onProgress?: (partial: DiscoveryResult) => void
}): Promise<DiscoveryResult> {
  const { client, scope, paidPayers, amount, isCancelled, onProgress } = options
  const contractAddress = scope.contract.toLowerCase()
  const scopeKey = receiptScopeKey(scope)
  const paidSet = new Set(paidPayers.map(p => p.toLowerCase()))

  const empty: DiscoveryResult = { receipts: {}, complete: false, rpcError: null, invalidatedHashes: [] }

  // ── Step 1: verify chain identity via live RPC ────────────────────────────
  let liveChainId: number
  try {
    liveChainId = await client.getChainId()
  } catch {
    return { ...empty, rpcError: 'Could not confirm chain. Check your connection.' }
  }
  if (isCancelled() || receiptScopeKey(scope) !== scopeKey) return empty
  if (liveChainId !== scope.chainId) {
    return { ...empty, rpcError: 'Receipt lookup requires Arc Testnet.' }
  }

  // ── Step 2: fresh chain head ──────────────────────────────────────────────
  let head: bigint
  try {
    head = await client.getBlockNumber()
  } catch {
    return { ...empty, rpcError: 'Could not fetch chain head. Check your connection.' }
  }
  if (isCancelled() || receiptScopeKey(scope) !== scopeKey) return empty

  // ── Step 3: verify each candidate ────────────────────────────────────────
  const receipts: Record<string, HintHash> = {}
  const invalidatedHashes: HintHash[] = []
  const blockHashCache = new Map<bigint, string>()
  const processedHashes = new Set<string>()
  let rpcError: string | null = null
  let hasConflict = false

  const candidates = options.candidates.slice(0, MAX_TOTAL_CANDIDATES)

  for (const candidate of candidates) {
    if (isCancelled() || receiptScopeKey(scope) !== scopeKey) break
    // Hard stop after any conflict — do not process further candidates.
    if (hasConflict) break

    const normHash = candidate.toLowerCase() as HintHash
    if (processedHashes.has(normHash)) continue
    processedHashes.add(normHash)

    // Early exit: all paid payers already have receipts.
    if (paidSet.size > 0 && paidSet.size === Object.keys(receipts).length) break

    const outcomes = await verifyCandidate(
      client, scope, normHash, paidPayers, amount, contractAddress, head, isCancelled, blockHashCache
    )
    if (isCancelled() || receiptScopeKey(scope) !== scopeKey) break

    let hadRpcError = false
    let wasInvalid = false

    for (const outcome of outcomes) {
      if (outcome.kind === 'match') {
        const { payer, hash } = outcome
        if (receipts[payer] && receipts[payer].toLowerCase() !== hash.toLowerCase()) {
          // Conflict: delete the ambiguous payer from results immediately.
          delete receipts[payer]
          hasConflict = true
          rpcError = `Conflicting receipts for payer ${payer.slice(0, 8)}… Retry or check the explorer.`
          // Hard stop — break out of inner loop; outer loop checks hasConflict.
          break
        } else if (!receipts[payer]) {
          receipts[payer] = hash
        }
      } else if (outcome.kind === 'invalid') {
        wasInvalid = true
      } else if (outcome.kind === 'rpc-error') {
        hadRpcError = true
        rpcError = outcome.message
      }
    }

    // Explicitly invalid candidates tracked for BillDetails purge sweep.
    // RPC-error candidates are NOT added (unresolved ≠ invalid).
    if (wasInvalid && !hadRpcError && !hasConflict) {
      invalidatedHashes.push(normHash)
    }

    // Stop on RPC error or conflict — no further candidates.
    if (hadRpcError || hasConflict) break

    const partial: DiscoveryResult = {
      receipts: { ...receipts },
      complete: !hasConflict && paidSet.size > 0 && Object.keys(receipts).length === paidSet.size,
      rpcError,
      invalidatedHashes: [...invalidatedHashes],
    }
    onProgress?.(partial)
    if (partial.complete) break
  }

  return {
    receipts: { ...receipts },
    // complete: false on any conflict, RPC error, or incomplete payer coverage.
    complete: !hasConflict && rpcError === null && paidSet.size > 0 &&
              Object.keys(receipts).length === paidSet.size,
    rpcError,
    invalidatedHashes,
  }
}
