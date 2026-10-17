import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  confirmedPaymentHash,
  historyRangeComplete,
  newReceiptHistory,
  receiptScopeKey,
  scanReceiptHistoryBatch,
  type PaymentSnapshot,
  type ReceiptHash,
  type SharePaidLog,
} from '../src/receiptHistory.ts'

const contract = '0x1111111111111111111111111111111111111111'
const payerA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const payerB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const payerC = '0xcccccccccccccccccccccccccccccccccccccccc'
const scope = { chainId: 5042002, contract, billId: 7n }
const hash = (id: number) => `0x${id.toString(16).padStart(64, '0')}` as ReceiptHash
const event = (payer: string, blockNumber: bigint, id: number): SharePaidLog => ({
  address: contract,
  args: { billId: scope.billId, payer, amount: 1_000_000n },
  transactionHash: hash(id), blockNumber,
})
const pick = (logs: SharePaidLog[], range: { fromBlock: bigint; toBlock: bigint }) =>
  logs.filter(log => log.blockNumber !== null && log.blockNumber >= range.fromBlock && log.blockNumber <= range.toBlock)

test('history beyond 50,000 blocks continues without repeating or losing any successful page', async () => {
  const requests: { fromBlock: bigint; toBlock: bigint }[] = []
  const logs = [event(payerA, 125_000n, 1), event(payerB, 10n, 2)]
  const options = {
    head: 150_000n, payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async (range: { fromBlock: bigint; toBlock: bigint }) => {
      requests.push(range)
      return pick(logs, range)
    },
  }
  const first = await scanReceiptHistoryBatch({ ...options, history: newReceiptHistory(scope, 10n) })
  assert.equal(first.reason, 'page-limit')
  assert.equal(first.history.scannedFrom, 100_001n)
  assert.deepEqual(first.history.receipts, { [payerA]: hash(1) })
  const second = await scanReceiptHistoryBatch({ ...options, history: first.history })
  assert.equal(second.reason, 'page-limit')
  assert.equal(second.history.scannedFrom, 50_001n)
  const third = await scanReceiptHistoryBatch({ ...options, history: second.history })
  assert.equal(third.reason, 'receipts-found')
  assert.deepEqual(third.history.receipts, { [payerA]: hash(1), [payerB]: hash(2) })
  assert.equal(historyRangeComplete(third.history), true)
  assert.equal(requests.length, 75)
  for (let index = 1; index < requests.length; index++) {
    assert.equal(requests[index].toBlock + 1n, requests[index - 1].fromBlock)
  }
  assert.equal(requests.at(-1)?.fromBlock, 10n)
})

test('refresh first searches new blocks, then resumes older history; known paid receipts avoid rescanning', async () => {
  const initial = await scanReceiptHistoryBatch({
    history: newReceiptHistory(scope, 0n), head: 150_000n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    maxPages: 1, fetchLogs: async () => [event(payerA, 149_999n, 1)],
  })
  const requests: { fromBlock: bigint; toBlock: bigint }[] = []
  const refreshed = await scanReceiptHistoryBatch({
    history: initial.history, head: 150_010n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async range => { requests.push(range); return [event(payerB, 150_005n, 2)] },
  })
  assert.deepEqual(requests, [{ fromBlock: 150_001n, toBlock: 150_010n }])
  assert.equal(refreshed.history.scannedFrom, 148_001n)
  assert.equal(refreshed.history.scannedTo, 150_010n)
  assert.equal(refreshed.reason, 'receipts-found')
  assert.equal(historyRangeComplete(refreshed.history), false)
  await scanReceiptHistoryBatch({
    history: refreshed.history, head: 150_100n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async () => { assert.fail('verified immutable payment receipts must not be rescanned') },
  })
})

test('a failed page retains earlier receipts and retries the exact uncommitted range', async () => {
  const attempts: { fromBlock: bigint; toBlock: bigint }[] = []
  const first = await scanReceiptHistoryBatch({
    history: newReceiptHistory(scope, 0n), head: 8_000n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async range => {
      attempts.push(range)
      if (attempts.length === 2) throw new Error('temporary RPC failure')
      return [event(payerA, 7_000n, 1)]
    },
  })
  assert.equal(first.reason, 'error')
  assert.match(first.error!.message, /temporary RPC failure/)
  assert.equal(first.history.scannedFrom, 6_001n)
  assert.equal(first.history.receipts[payerA], hash(1))
  const retry = await scanReceiptHistoryBatch({
    history: first.history, head: 8_000n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async range => { attempts.push(range); return [event(payerB, 5_000n, 2)] },
  })
  assert.deepEqual(attempts[1], attempts[2])
  assert.equal(retry.reason, 'receipts-found')
  assert.deepEqual(retry.history.receipts, { [payerA]: hash(1), [payerB]: hash(2) })
})

test('inclusive page boundaries and missing deployment block can reach genesis exactly once', async () => {
  const requests: { fromBlock: bigint; toBlock: bigint }[] = []
  const logs = [event(payerA, 2_001n, 1), event(payerB, 2_000n, 2), event(payerC, 0n, 3)]
  const result = await scanReceiptHistoryBatch({
    history: newReceiptHistory(scope, null), head: 4_000n,
    payers: [payerA, payerB, payerC], paidPayers: [payerA, payerB, payerC], amount: 1_000_000n,
    fetchLogs: async range => { requests.push(range); return pick(logs, range) },
  })
  assert.deepEqual(requests, [
    { fromBlock: 2_001n, toBlock: 4_000n },
    { fromBlock: 1n, toBlock: 2_000n },
    { fromBlock: 0n, toBlock: 0n },
  ])
  assert.equal(result.history.floor, 0n)
  assert.equal(historyRangeComplete(result.history), true)
  assert.equal(Object.keys(result.history.receipts).length, 3)
})

test('only exact contract/bill/payer/amount/nonremoved logs in the requested range count as receipts', async () => {
  const valid = event(payerA, 2n, 1)
  const invalid: SharePaidLog[] = [
    { ...event(payerB, 2n, 2), address: payerC },
    { ...event(payerB, 2n, 2), args: { billId: 8n, payer: payerB, amount: 1_000_000n } },
    { ...event(payerB, 2n, 2), args: { billId: 7n, payer: payerB, amount: 999n } },
    { ...event(payerB, 2n, 2), removed: true },
    event(payerC, 2n, 3),
    event(payerB, 10n, 2),
    { ...event(payerB, 2n, 2), transactionHash: null },
  ]
  const result = await scanReceiptHistoryBatch({
    history: newReceiptHistory(scope, 1n), head: 3n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async () => [valid, valid, ...invalid],
  })
  assert.deepEqual(result.history.receipts, { [payerA]: hash(1) })
  assert.equal(result.reason, 'range-complete')
})

test('different transaction hashes for one payer produce an error instead of choosing a receipt', async () => {
  const result = await scanReceiptHistoryBatch({
    history: newReceiptHistory(scope, 1n), head: 3n,
    payers: [payerA, payerB], paidPayers: [payerA, payerB], amount: 1_000_000n,
    fetchLogs: async () => [event(payerA, 2n, 1), event(payerA, 3n, 2)],
  })
  assert.equal(result.reason, 'error')
  assert.match(result.error!.message, /conflicting/)
  assert.deepEqual(result.history.receipts, {})
  assert.equal(result.history.scannedFrom, null)
})

test('navigation cancels an in-flight page before it can publish into another bill', async () => {
  let cancelled = false
  let published = 0
  const result = await scanReceiptHistoryBatch({
    history: newReceiptHistory(scope, 1n), head: 3n,
    payers: [payerA], paidPayers: [payerA], amount: 1_000_000n,
    isCancelled: () => cancelled,
    onPage: () => { published++ },
    fetchLogs: async () => { cancelled = true; return [event(payerA, 2n, 1)] },
  })
  assert.equal(result.reason, 'cancelled')
  assert.equal(published, 0)
  assert.deepEqual(result.history.receipts, {})
  assert.notEqual(receiptScopeKey(scope), receiptScopeKey({ ...scope, billId: 8n }))
  assert.notEqual(receiptScopeKey(scope), receiptScopeKey({ ...scope, chainId: 5042 }))
  assert.notEqual(receiptScopeKey(scope), receiptScopeKey({ ...scope, contract: payerA }))
  assert.equal(receiptScopeKey(scope), receiptScopeKey({ ...scope, contract: contract.toUpperCase() }))
})

test('wallet replacements use the final mined hash; cancellation, revert and cross-wallet/bill events cannot confirm', () => {
  const pending: PaymentSnapshot = { ...scope, payer: payerA, amount: 1_000_000n, submittedHash: hash(1) }
  const receipt = { status: 'success' as const, transactionHash: hash(99), logs: [event(payerA, 2n, 99)] }
  assert.equal(confirmedPaymentHash(pending, hash(1), receipt), hash(99))
  assert.equal(confirmedPaymentHash(pending, hash(1), { ...receipt, status: 'reverted' }), null)
  assert.equal(confirmedPaymentHash(pending, hash(1), { ...receipt, logs: [] }), null)
  assert.equal(confirmedPaymentHash(pending, hash(1), { ...receipt, logs: [event(payerB, 2n, 99)] }), null)
  assert.equal(confirmedPaymentHash({ ...pending, billId: 8n }, hash(1), receipt), null)
  assert.equal(confirmedPaymentHash({ ...pending, contract: payerC }, hash(1), receipt), null)
  assert.equal(confirmedPaymentHash({ ...pending, amount: 1n }, hash(1), receipt), null)
  assert.equal(confirmedPaymentHash(pending, hash(2), receipt), null)
  assert.equal(confirmedPaymentHash({ ...pending, submittedHash: undefined }, hash(1), receipt), null)
})
