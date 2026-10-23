import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scanSharePaidPage, startHistoryCursor, type HistoryCursor } from '../src/receiptHistory.ts'
import { CONTRACT, PAYER_A, PAYER_B, addr, hash } from './fixtures.ts'

const scope = { chainId: 5042002, contract: CONTRACT, billId: 7n }

interface Range { fromBlock: bigint; toBlock: bigint }
function logClient(entries: { block: bigint; payer: string; hash: string }[], failOnCall?: number) {
  const ranges: Range[] = []
  let n = 0
  return {
    ranges,
    client: {
      getBlockNumber: async () => 1_000n,
      getLogs: async (a: Range & { args: { billId: bigint } }) => {
        n++
        if (failOnCall === n) throw new Error('range too large')
        ranges.push({ fromBlock: a.fromBlock, toBlock: a.toBlock })
        assert.equal(a.args.billId, 7n)
        return entries
          .filter((e) => e.block >= a.fromBlock && e.block <= a.toBlock)
          .map((e) => ({ transactionHash: e.hash, args: { payer: e.payer }, removed: false }))
      },
    } as never,
  }
}

describe('startHistoryCursor', () => {
  it('uses the deployment block as floor when known', async () => {
    const c = await startHistoryCursor({ getBlockNumber: async () => 1_000n } as never, 100n)
    assert.deepEqual(c, { nextTo: 1_000n, floor: 100n, done: false })
  })
  it('falls back to a bounded lookback, never block 0 of a deep chain', async () => {
    const c = await startHistoryCursor({ getBlockNumber: async () => 100_000_000n } as never, null, 50_000n)
    assert.equal(c.floor, 100_000_000n - 50_000n)
  })
})

describe('scanSharePaidPage', () => {
  const cursor: HistoryCursor = { nextTo: 1_000n, floor: 100n, done: false }

  it('pages downward in bounded ranges and stops at the floor', async () => {
    const { client, ranges } = logClient([])
    const r = await scanSharePaidPage(client, scope, cursor, { pageBlocks: 400n, maxPages: 10 })
    assert.equal(r.cursor.done, true)
    assert.deepEqual(ranges, [
      { fromBlock: 601n, toBlock: 1_000n },
      { fromBlock: 201n, toBlock: 600n },
      { fromBlock: 100n, toBlock: 200n },
    ])
  })

  it('collects deduplicated lowercase candidates', async () => {
    const dup = hash(1)
    const { client } = logClient([
      { block: 900n, payer: PAYER_A.toUpperCase().replace('0X', '0x'), hash: dup },
      { block: 900n, payer: PAYER_A, hash: dup },
      { block: 300n, payer: PAYER_B, hash: hash(2) },
    ])
    const r = await scanSharePaidPage(client, scope, cursor, { pageBlocks: 400n })
    assert.equal(r.candidates.length, 2)
    assert.equal(r.candidates[0].payer, PAYER_A.toLowerCase())
  })

  it('pauses early (not done) once every MISSING payer has a candidate', async () => {
    const { client, ranges } = logClient([
      { block: 950n, payer: PAYER_A, hash: hash(1) },
      { block: 940n, payer: PAYER_B, hash: hash(2) },
    ])
    const r = await scanSharePaidPage(client, scope, cursor, { pageBlocks: 100n, missingPayers: [PAYER_A, PAYER_B] })
    assert.equal(ranges.length, 1)
    assert.equal(r.candidates.length, 2)
  })

  it('respects maxPages and leaves a resumable cursor', async () => {
    const { client } = logClient([])
    const r = await scanSharePaidPage(client, scope, cursor, { pageBlocks: 100n, maxPages: 2 })
    assert.equal(r.pagesScanned, 2)
    assert.equal(r.cursor.done, false)
    assert.equal(r.cursor.nextTo, 800n)
  })

  it('an RPC failure does not advance past the failed page and reports an error', async () => {
    const { client } = logClient([], 2)
    const r = await scanSharePaidPage(client, scope, cursor, { pageBlocks: 100n, maxPages: 5 })
    assert.ok(r.error)
    assert.equal(r.pagesScanned, 1)
    assert.equal(r.cursor.nextTo, 900n)
    assert.equal(r.cursor.done, false)
  })

  it('does nothing when already done', async () => {
    const { client, ranges } = logClient([])
    const r = await scanSharePaidPage(client, scope, { ...cursor, done: true })
    assert.equal(ranges.length, 0)
    assert.equal(r.pagesScanned, 0)
  })

  it('ignores removed logs and logs without identity', async () => {
    const client = {
      getBlockNumber: async () => 1_000n,
      getLogs: async () => [
        { transactionHash: hash(5), args: { payer: addr(9) }, removed: true },
        { transactionHash: null, args: { payer: addr(9) }, removed: false },
        { transactionHash: hash(6), args: {}, removed: false },
      ],
    } as never
    const r = await scanSharePaidPage(client, scope, { nextTo: 200n, floor: 100n, done: false }, { pageBlocks: 1_000n })
    assert.equal(r.candidates.length, 0)
  })
})
