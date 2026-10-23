import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { verifyPaymentTransaction } from '../src/paymentVerification.ts'
import { CONTRACT, PAYER_A, PAYER_B, SHARE, TX_HASH, addr, hash, payClient } from './fixtures.ts'

const base: { contract: typeof CONTRACT; billId: bigint; payer: string; amount: bigint; hash: typeof TX_HASH } = {
  contract: CONTRACT, billId: 7n, payer: PAYER_A, amount: SHARE, hash: TX_HASH,
}
const check = (o: Parameters<typeof payClient>[0], over: Partial<typeof base> = {}) =>
  verifyPaymentTransaction(payClient(o), { ...base, ...over })

describe('verifyPaymentTransaction', () => {
  it('accepts payShare(billId) from the payer with the exact share', async () => {
    assert.deepEqual(await check({}), { ok: true })
  })
  it('rejects when the canonical sender is not the listed payer', async () => {
    const r = await check({ from: PAYER_B })
    assert.equal(r.ok, false)
  })
  it('compares the sender case-insensitively', async () => {
    const r = await check({}, { payer: PAYER_A.toUpperCase().replace('0X', '0x') })
    assert.equal(r.ok, true)
  })
  it('rejects a wrong value', async () => {
    assert.equal((await check({ value: SHARE - 1n })).ok, false)
  })
  it('rejects a call to another contract', async () => {
    assert.equal((await check({ to: addr(0xbad) })).ok, false)
  })
  it('rejects payShare for another bill', async () => {
    assert.equal((await check({ billId: 8n })).ok, false)
  })
  it('rejects non-SplitReceipt calldata', async () => {
    assert.equal((await check({ input: '0x' })).ok, false)
  })
  it('rejects a reverted receipt', async () => {
    assert.equal((await check({ status: 'reverted' })).ok, false)
  })
  it('rejects mismatched tx and receipt blocks', async () => {
    assert.equal((await check({ txBlockHash: hash(0xfeed) })).ok, false)
  })
  it('treats not-found as definitive and RPC errors as transient', async () => {
    const missing = await check({ missing: true })
    assert.equal(missing.ok === false && missing.transient, false)
    const down = await check({ fail: true })
    assert.equal(down.ok === false && down.transient, true)
  })
})
