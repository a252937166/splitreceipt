export type ReceiptHash = `0x${string}`

export interface ReceiptScope {
  chainId: number
  contract: string
  billId: bigint
}

export interface SharePaidLog {
  address: string
  args: { billId?: bigint; payer?: string; amount?: bigint }
  transactionHash: ReceiptHash | null
  blockNumber: bigint | null
  removed?: boolean
}

export interface ReceiptHistory {
  scope: ReceiptScope
  key: string
  floor: bigint
  /** One contiguous range, extended at either end only after a successful page. */
  scannedFrom: bigint | null
  scannedTo: bigint | null
  lastHead: bigint | null
  receipts: Record<string, ReceiptHash>
}

export interface PaymentSnapshot extends ReceiptScope {
  payer: string
  amount: bigint
  submittedHash?: ReceiptHash
}

export const RECEIPT_LOG_PAGE_SIZE = 2_000n
export const RECEIPT_HISTORY_BATCH_PAGES = 25

export function receiptScopeKey(scope: ReceiptScope): string {
  return `${scope.chainId}:${scope.contract.toLowerCase()}:${scope.billId}`
}

export function newReceiptHistory(scope: ReceiptScope, deploymentBlock: bigint | null): ReceiptHistory {
  return {
    scope: { ...scope, contract: scope.contract.toLowerCase() },
    key: receiptScopeKey(scope),
    floor: deploymentBlock ?? 0n,
    scannedFrom: null,
    scannedTo: null,
    lastHead: null,
    receipts: {},
  }
}

/** A receipt link is accepted only for the requested contract, bill, payer and exact share. */
export function isMatchingSharePaid(
  scope: ReceiptScope,
  log: Pick<SharePaidLog, 'address' | 'args' | 'removed'>,
  payer: string,
  amount: bigint,
): boolean {
  return !log.removed &&
    log.address.toLowerCase() === scope.contract.toLowerCase() &&
    log.args.billId === scope.billId &&
    log.args.payer?.toLowerCase() === payer.toLowerCase() &&
    log.args.amount === amount
}

/** Uses the mined hash, including replacements; a successful wallet cancel has no matching event. */
export function confirmedPaymentHash(
  pending: PaymentSnapshot | null,
  submittedHash: ReceiptHash | undefined,
  receipt: {
    status: 'success' | 'reverted'
    transactionHash: ReceiptHash
    logs: readonly Pick<SharePaidLog, 'address' | 'args' | 'removed'>[]
  } | null,
): ReceiptHash | null {
  if (!pending?.submittedHash || pending.submittedHash !== submittedHash || receipt?.status !== 'success') {
    return null
  }
  return receipt.logs.some(log => isMatchingSharePaid(pending, log, pending.payer, pending.amount))
    ? receipt.transactionHash
    : null
}

export function hasPaidReceipts(history: ReceiptHistory, paidPayers: readonly string[]): boolean {
  return paidPayers.every(payer => Boolean(history.receipts[payer.toLowerCase()]))
}

export function historyRangeComplete(history: ReceiptHistory): boolean {
  return history.scannedFrom === history.floor &&
    history.scannedTo !== null && history.lastHead !== null && history.scannedTo >= history.lastHead
}

/**
 * Look up a bounded batch, newest blocks first. Refreshes extend the known range
 * to the new head, then continue toward the deployment block (or genesis).
 * Successful pages are committed individually; a failed page is retried as-is.
 * State lives per chain + contract + bill, independent of the connected wallet.
 */
export async function scanReceiptHistoryBatch(options: {
  history: ReceiptHistory
  head: bigint
  payers: readonly string[]
  paidPayers: readonly string[]
  amount: bigint
  fetchLogs: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<readonly SharePaidLog[]>
  onPage?: (history: ReceiptHistory) => void
  isCancelled?: () => boolean
  maxPages?: number
  pageSize?: bigint
}): Promise<{
  history: ReceiptHistory
  reason: 'receipts-found' | 'range-complete' | 'page-limit' | 'error' | 'cancelled'
  error?: Error
}> {
  const { head, amount, fetchLogs, onPage, isCancelled } = options
  const pageSize = options.pageSize ?? RECEIPT_LOG_PAGE_SIZE
  const maxPages = options.maxPages ?? RECEIPT_HISTORY_BATCH_PAGES
  let history: ReceiptHistory = { ...options.history, lastHead: head }
  const payers = new Set(options.payers.map(payer => payer.toLowerCase()))

  if (pageSize < 1n || !Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error('Invalid history page limits.')
  }
  if (head < history.floor || (history.scannedTo !== null && head < history.scannedTo)) {
    return { history: options.history, reason: 'error', error: new Error('RPC head is behind the receipt history. Try again when the RPC catches up.') }
  }

  for (let page = 0; page < maxPages; page++) {
    if (isCancelled?.()) return { history, reason: 'cancelled' }
    // Contract state lists each paid payer once. Count matching payers, never log count.
    if (hasPaidReceipts(history, options.paidPayers)) return { history, reason: 'receipts-found' }
    if (historyRangeComplete(history)) return { history, reason: 'range-complete' }

    let fromBlock: bigint
    let toBlock: bigint
    if (history.scannedTo === null || history.scannedFrom === null) {
      toBlock = head
      fromBlock = head - pageSize + 1n > history.floor ? head - pageSize + 1n : history.floor
    } else if (history.scannedTo < head) {
      // New payments since the previous lookup are searched before older gaps.
      fromBlock = history.scannedTo + 1n
      toBlock = fromBlock + pageSize - 1n < head ? fromBlock + pageSize - 1n : head
    } else {
      toBlock = history.scannedFrom - 1n
      fromBlock = toBlock - pageSize + 1n > history.floor ? toBlock - pageSize + 1n : history.floor
    }

    try {
      const logs = await fetchLogs({ fromBlock, toBlock })
      if (isCancelled?.()) return { history, reason: 'cancelled' }
      const receipts = { ...history.receipts }
      for (const log of logs) {
        const payer = log.args.payer?.toLowerCase()
        if (!payer || !payers.has(payer) || !log.transactionHash ||
          log.blockNumber === null || log.blockNumber < fromBlock || log.blockNumber > toBlock ||
          !isMatchingSharePaid(history.scope, log, payer, amount)) continue

        // This contract disallows duplicate payments. Repeated copies of the
        // same log are harmless; different hashes require retry, never guessing.
        if (receipts[payer] && receipts[payer] !== log.transactionHash) {
          throw new Error('RPC returned conflicting payment receipts for one payer. Previously verified links are kept; retry or check the explorer.')
        }
        receipts[payer] = log.transactionHash
      }
      history = {
        ...history,
        scannedFrom: history.scannedFrom === null || fromBlock < history.scannedFrom ? fromBlock : history.scannedFrom,
        scannedTo: history.scannedTo === null || toBlock > history.scannedTo ? toBlock : history.scannedTo,
        receipts,
      }
      onPage?.(history)
    } catch (error) {
      return { history, reason: 'error', error: error instanceof Error ? error : new Error('Receipt lookup failed.') }
    }
  }

  return {
    history,
    reason: hasPaidReceipts(history, options.paidPayers)
      ? 'receipts-found'
      : historyRangeComplete(history) ? 'range-complete' : 'page-limit',
  }
}
