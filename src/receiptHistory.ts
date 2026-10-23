/**
 * Receipt scope identity and bounded SharePaid history scanning.
 *
 * A scope pins a bill to one chain and one contract. Everything that caches,
 * stores or displays receipts is keyed by it, so a receipt found for one
 * deployment can never populate another.
 *
 * History scanning only produces UNTRUSTED candidate hashes. Every candidate
 * still has to pass `discoverReceiptsFromHints` (canonical block and log
 * identity) and `verifyPaymentTransaction` (sender, target, value, calldata)
 * before it is shown as a verified receipt.
 */
import { parseAbiItem, type PublicClient } from 'viem'

export interface ReceiptScope {
  chainId: number
  contract: string
  billId: bigint
}

export function receiptScopeKey(scope: ReceiptScope): string {
  return `${scope.chainId}:${scope.contract.toLowerCase()}:${scope.billId.toString()}`
}

export function sameScope(a: ReceiptScope, b: ReceiptScope): boolean {
  return receiptScopeKey(a) === receiptScopeKey(b)
}

const SHARE_PAID = parseAbiItem(
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
)

/** Blocks per eth_getLogs request. Kept modest; the real limit is unmeasured. */
export const HISTORY_PAGE_BLOCKS = 5_000n
/** Pages scanned per user action. */
export const HISTORY_PAGES_PER_RUN = 12

export interface HistoryCursor {
  /** Highest block not yet scanned; scanning proceeds downward from here. */
  nextTo: bigint
  /** Lowest block that needs scanning (deployment block, or a bounded lookback). */
  floor: bigint
  /** True when the floor was reached. */
  done: boolean
}

export interface HistoryCandidate {
  payer: string
  hash: `0x${string}`
}

export interface HistoryScanResult {
  candidates: HistoryCandidate[]
  cursor: HistoryCursor
  pagesScanned: number
  error: string | null
  /** True when scanning stopped early because the caller's context went stale. */
  stopped: boolean
}

type LogClient = Pick<PublicClient, 'getLogs' | 'getBlockNumber'>

/**
 * Where scanning starts. With a known deployment block the floor is that block
 * (full history). Without one the floor is a bounded lookback from head and the
 * caller must present the history as incomplete.
 */
export async function startHistoryCursor(
  client: Pick<PublicClient, 'getBlockNumber'>,
  deployBlock: bigint | null,
  lookback: bigint = 50_000n,
): Promise<HistoryCursor> {
  const head = await client.getBlockNumber()
  const floor = deployBlock !== null ? deployBlock : head > lookback ? head - lookback : 0n
  return { nextTo: head, floor, done: head < floor }
}

export interface ScanOptions {
  /**
   * Lowercase payer identities that still have NO verified receipt. A run may pause
   * early once every one of them has at least one candidate. Candidates for payers who
   * are already verified do not count: they prove nothing about the missing ones.
   * The cursor is never marked done by this; `done` means the floor was reached.
   */
  missingPayers?: readonly string[]
  pageBlocks?: bigint
  maxPages?: number
  /** Polled before every network page; scanning ends as soon as it returns true. */
  shouldStop?: () => boolean
}

/**
 * Scan downward from the cursor for SharePaid logs of one bill. Stops after
 * `maxPages` pages, when the floor is reached, when every missing payer has a
 * candidate, or when `shouldStop` says the context is stale. RPC failures stop the
 * run and are reported without advancing past the failed page, so a retry resumes
 * where it stopped.
 */
export async function scanSharePaidPage(
  client: LogClient,
  scope: ReceiptScope,
  cursor: HistoryCursor,
  options: ScanOptions = {},
): Promise<HistoryScanResult> {
  const pageBlocks = options.pageBlocks ?? HISTORY_PAGE_BLOCKS
  const maxPages = options.maxPages ?? HISTORY_PAGES_PER_RUN
  const missing = options.missingPayers ? new Set(options.missingPayers.map((p) => p.toLowerCase())) : null

  const candidates: HistoryCandidate[] = []
  const seenHashes = new Set<string>()
  const coveredMissing = new Set<string>()
  let next = cursor.nextTo
  let pages = 0
  let done = cursor.done
  let error: string | null = null
  let stopped = false

  while (!done && pages < maxPages) {
    if (options.shouldStop?.()) {
      stopped = true
      break
    }
    if (missing && missing.size === 0) break
    const from = next - pageBlocks + 1n > cursor.floor ? next - pageBlocks + 1n : cursor.floor
    try {
      const logs = await client.getLogs({
        address: scope.contract as `0x${string}`,
        event: SHARE_PAID,
        args: { billId: scope.billId },
        fromBlock: from,
        toBlock: next,
      })
      if (options.shouldStop?.()) {
        stopped = true
        break
      }
      for (const log of logs) {
        const hash = log.transactionHash
        const payer = log.args.payer
        if (!hash || !payer || log.removed) continue
        const lc = hash.toLowerCase()
        if (seenHashes.has(lc)) continue
        seenHashes.add(lc)
        const p = payer.toLowerCase()
        if (missing?.has(p)) coveredMissing.add(p)
        candidates.push({ payer: p, hash: lc as `0x${string}` })
      }
    } catch {
      error = 'Receipt history lookup paused. Check your connection and continue.'
      break
    }
    pages++
    if (from <= cursor.floor) {
      done = true
      next = cursor.floor
    } else {
      next = from - 1n
    }
    if (missing && [...missing].every((p) => coveredMissing.has(p))) break
  }

  return {
    candidates,
    cursor: { nextTo: next, floor: cursor.floor, done },
    pagesScanned: pages,
    error,
    stopped,
  }
}
