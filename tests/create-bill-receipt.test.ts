import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { verifyCreateBillTransaction } from '../src/createBillReceipt.ts'
import {
  BLOCK, BLOCK_HASH, CHAIN, CONTRACT, CREATOR, INTENDED, PAYER_A, PAYER_B, RECIPIENT, SHARE, TX_HASH,
  addr, billCreatedLog, createCalldata, createClient, hash, type CreateScenario,
} from './fixtures.ts'

const run = (s: CreateScenario = {}, over: { expectedCreator?: `0x${string}` | null; intended?: typeof INTENDED } = {}) => {
  const { client, calls } = createClient(s)
  return verifyCreateBillTransaction(client, {
    chainId: CHAIN,
    contract: CONTRACT,
    hash: TX_HASH,
    intended: over.intended ?? INTENDED,
    expectedCreator: over.expectedCreator,
  }).then((r) => ({ r, calls }))
}

describe('verifyCreateBillTransaction', () => {
  it('accepts a canonical create and reports tx.from as creator', async () => {
    const { r, calls } = await run()
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.billId, 7n)
    assert.equal(r.creator, CREATOR.toLowerCase())
    assert.notEqual(r.creator, RECIPIENT.toLowerCase())
    assert.equal(r.blockNumber, BLOCK)
    assert.equal(r.blockHash, BLOCK_HASH)
    assert.equal(calls.readBlock, BLOCK, 'bill state is read at the creating block')
  })

  it('creator comes from tx.from, never from an event field', async () => {
    const a = await run({ from: addr(0x99) })
    assert.equal(a.r.ok && a.r.creator, addr(0x99))
  })

  it('rejects a different connected account', async () => {
    const { r } = await run({}, { expectedCreator: PAYER_A })
    assert.equal(r.ok, false)
  })

  it('accepts the matching connected account case-insensitively', async () => {
    const { r } = await run({}, { expectedCreator: CREATOR.toUpperCase().replace('0X', '0x') as `0x${string}` })
    assert.equal(r.ok, true)
  })

  it('rejects calldata that differs from the intended bill', async () => {
    const other = { ...INTENDED, title: 'Different title' }
    const { r } = await run({ input: createCalldata(other), logs: [billCreatedLog(7n, other)], stored: { ...other, paid: [false, false] } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.reason, /does not match/)
  })

  it('rejects payers in a different order', async () => {
    const swapped = { ...INTENDED, payers: [PAYER_B, PAYER_A] }
    const { r } = await run({ input: createCalldata(swapped), logs: [billCreatedLog(7n, swapped)], stored: { ...swapped, paid: [false, false] } })
    assert.equal(r.ok, false)
  })

  it('rejects a different share', async () => {
    const other = { ...INTENDED, share: SHARE + 1n }
    const { r } = await run({ input: createCalldata(other), logs: [billCreatedLog(7n, other)], stored: { ...other, paid: [false, false] } })
    assert.equal(r.ok, false)
  })

  it('rejects a BillCreated event that disagrees with the intent', async () => {
    const other = { ...INTENDED, recipient: addr(0xdead) }
    const { r } = await run({ logs: [billCreatedLog(7n, other)] })
    assert.equal(r.ok, false)
  })

  it('rejects when no BillCreated event exists', async () => {
    const { r } = await run({ logs: [] })
    assert.equal(r.ok, false)
  })

  it('rejects two BillCreated events', async () => {
    const { r } = await run({ logs: [billCreatedLog(7n), billCreatedLog(8n)] })
    assert.equal(r.ok, false)
  })

  it('ignores events from another contract', async () => {
    const { r } = await run({ logs: [billCreatedLog(7n, INTENDED, { address: addr(0xbad) })] })
    assert.equal(r.ok, false)
  })

  it('rejects an event whose block hash is not canonical', async () => {
    const { r } = await run({ logs: [billCreatedLog(7n, INTENDED, { blockHash: hash(0xbad) })] })
    assert.equal(r.ok, false)
  })

  it('rejects a call to a different contract', async () => {
    const { r } = await run({ to: addr(0xbad) })
    assert.equal(r.ok, false)
  })

  it('rejects value attached to createBill', async () => {
    const { r } = await run({ value: 1n })
    assert.equal(r.ok, false)
  })

  it('rejects a reverted transaction', async () => {
    const { r } = await run({ status: 'reverted' })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.transient, false)
  })

  it('rejects a receipt whose block is not canonical', async () => {
    const { r } = await run({ canonicalBlockHash: hash(0xfeed) })
    assert.equal(r.ok, false)
  })

  it('rejects a transaction whose block hash differs from the receipt', async () => {
    const { r } = await run({ txBlockHash: hash(0xfeed) })
    assert.equal(r.ok, false)
  })

  it('rejects a receipt beyond the chain head', async () => {
    const { r } = await run({ head: BLOCK - 1n })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.transient, true)
  })

  it('rejects the wrong live chain id', async () => {
    const { r } = await run({ chainId: 1 })
    assert.equal(r.ok, false)
  })

  it('treats a missing receipt as transient (not mined yet)', async () => {
    const { r } = await run({ receiptMissing: true })
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.transient, true)
  })

  for (const failure of ['receipt', 'tx', 'block', 'read', 'chain'] as const) {
    it(`reports an RPC ${failure} failure as transient, not as an invalid bill`, async () => {
      const { r } = await run({ rpcFailure: failure })
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.transient, true)
    })
  }

  it('rejects stored state that differs from the intent', async () => {
    const { r } = await run({ stored: { ...INTENDED, recipient: addr(0x77), paid: [false, false] } })
    assert.equal(r.ok, false)
  })

  it('rejects a new bill that already shows a paid share (getBill()[4])', async () => {
    const { r } = await run({ stored: { ...INTENDED, paid: [true, false] } })
    assert.equal(r.ok, false)
  })

  it('rejects a malformed hash before any RPC', async () => {
    const { client } = createClient()
    const r = await verifyCreateBillTransaction(client, {
      chainId: CHAIN, contract: CONTRACT, hash: '0x12' as never, intended: INTENDED,
    })
    assert.equal(r.ok, false)
  })

  it('rejects calldata for a different function', async () => {
    const { r } = await run({ input: '0xdeadbeef' })
    assert.equal(r.ok, false)
  })
})
