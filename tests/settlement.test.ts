import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { encodeFunctionData } from 'viem'
import { settleCreate, settlePay, type Replacement, type WaitFn } from '../src/settlement.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../src/splitReceiptAbi.ts'
import {
  BLOCK, BLOCK_HASH, CHAIN, CONTRACT, CREATOR, INTENDED, PAYER_A, PAYER_B, SHARE, TITLE,
  billCreatedLog, createCalldata, hash, sharePaidLog, type Hex,
} from './fixtures.ts'

const SUBMITTED = hash(0x5b)
const REPLACEMENT = hash(0x7e)
const noSleep = async () => {}

interface FakeTx {
  from: Hex; to: Hex; value: bigint; input: Hex; status?: 'success' | 'reverted'
  logs: (hash: Hex) => unknown[]
}

/** A chain with a few transactions by hash, a controllable bill, and controllable RPC failures. */
function fakeChain(txs: Record<string, FakeTx>, o: { paid?: () => boolean[]; fail?: () => boolean; stored?: typeof INTENDED } = {}) {
  const stored = o.stored ?? INTENDED
  return {
    getChainId: async () => CHAIN,
    getBlockNumber: async () => 10_000n,
    getBlock: async () => ({ hash: BLOCK_HASH }),
    getTransactionReceipt: async ({ hash: h }: { hash: Hex }) => {
      if (o.fail?.()) throw new Error('rpc down')
      const t = txs[h.toLowerCase()]
      if (!t) throw new Error('missing')
      return { transactionHash: h, blockNumber: BLOCK, blockHash: BLOCK_HASH, status: t.status ?? 'success', from: t.from, to: t.to, logs: t.logs(h) }
    },
    getTransaction: async ({ hash: h }: { hash: Hex }) => {
      if (o.fail?.()) throw new Error('rpc down')
      const t = txs[h.toLowerCase()]
      if (!t) throw new Error('missing')
      return { hash: h, from: t.from, to: t.to, value: t.value, input: t.input, blockHash: BLOCK_HASH, blockNumber: BLOCK }
    },
    readContract: async () => {
      if (o.fail?.()) throw new Error('rpc down')
      return [stored.title, stored.recipient, stored.payers, stored.share, o.paid ? o.paid() : [false, false]]
    },
  } as never
}

const payInput = (billId = 7n) => encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'payShare', args: [billId] })
const goodPay = (): FakeTx => ({ from: PAYER_A, to: CONTRACT, value: SHARE, input: payInput(), logs: (h) => [sharePaidLog(7n, PAYER_A, SHARE, h)] })
const selfCancel = (): FakeTx => ({ from: PAYER_A, to: PAYER_A, value: 0n, input: '0x', logs: () => [] })

const waitFor = (finalHash: Hex, replaced: Replacement | null = null): WaitFn => async () => ({ receipt: { transactionHash: finalHash, status: 'success' }, replaced })
const waitRejects: WaitFn = async () => { throw new Error('timeout') }

const payArgs = (client: never, wait: WaitFn, o: { alive?: () => boolean; paid?: () => boolean[]; retries?: number } = {}) => ({
  client, wait, token: { isLive: o.alive ?? (() => true) }, submittedHash: SUBMITTED, chainId: CHAIN, contract: CONTRACT,
  billId: 7n, payer: PAYER_A, share: SHARE, retries: o.retries ?? 2, retryDelayMs: 0, sleep: noSleep,
  readBill: async () => ({ payers: INTENDED.payers, paid: o.paid ? o.paid() : [false, false] }),
})

describe('settlePay: success needs more than receipt.status === success', () => {
  it('direct payment: verified, and only when getBill shows the payer paid', async () => {
    const chain = fakeChain({ [SUBMITTED]: goodPay() })
    const r = await settlePay(payArgs(chain, waitFor(SUBMITTED), { paid: () => [true, false] }))
    assert.equal(r.kind, 'verified')
    assert.equal(r.kind === 'verified' && r.finalHash, SUBMITTED)
  })

  it('a status-success self-send replacement without SharePaid and an unchanged unpaid bill is NOT a payment', async () => {
    let billReads = 0
    const chain = fakeChain({ [REPLACEMENT]: selfCancel() })
    const args = payArgs(chain, waitFor(REPLACEMENT, { reason: 'cancelled', hash: REPLACEMENT }), { paid: () => [false, false] })
    const original = args.readBill
    args.readBill = async () => { billReads++; return original() }
    const r = await settlePay(args)
    assert.equal(r.kind, 'not-completed')
    assert.match(r.kind === 'not-completed' ? r.reason : '', /still unpaid/)
    assert.match(r.kind === 'not-completed' ? r.reason : '', /cancelled/)
    assert.equal(r.kind === 'not-completed' && r.finalHash, REPLACEMENT)
    assert.equal(billReads, 0, 'never reaches success reconciliation')
  })

  it('repricing keeps the same call: verified under the FINAL hash, not the submitted one', async () => {
    const chain = fakeChain({ [REPLACEMENT]: goodPay() })
    const r = await settlePay(payArgs(chain, waitFor(REPLACEMENT, { reason: 'repriced', hash: REPLACEMENT }), { paid: () => [true, false] }))
    assert.equal(r.kind, 'verified')
    assert.equal(r.kind === 'verified' && r.finalHash, REPLACEMENT)
    assert.equal(r.kind === 'verified' && r.submittedHash, SUBMITTED)
    assert.equal(r.kind === 'verified' && r.replaced?.reason, 'repriced')
  })

  it('a replacement with altered calldata (another bill) is not this payment', async () => {
    const chain = fakeChain({ [REPLACEMENT]: { ...goodPay(), input: payInput(8n) } })
    const r = await settlePay(payArgs(chain, waitFor(REPLACEMENT, { reason: 'replaced', hash: REPLACEMENT }), { paid: () => [true, false] }))
    assert.equal(r.kind, 'not-completed')
  })

  it('a replacement with the wrong value is not this payment', async () => {
    const chain = fakeChain({ [REPLACEMENT]: { ...goodPay(), value: SHARE - 1n } })
    assert.equal((await settlePay(payArgs(chain, waitFor(REPLACEMENT)))).kind, 'not-completed')
  })

  it('a matching call whose event is for another payer is not this payment', async () => {
    const chain = fakeChain({ [SUBMITTED]: { ...goodPay(), logs: (h) => [sharePaidLog(7n, PAYER_B, SHARE, h)] } })
    assert.equal((await settlePay(payArgs(chain, waitFor(SUBMITTED), { paid: () => [true, true] }))).kind, 'not-completed')
  })

  it('a reverted transaction stays unpaid', async () => {
    const chain = fakeChain({ [SUBMITTED]: { ...goodPay(), status: 'reverted' } })
    const wait: WaitFn = async () => ({ receipt: { transactionHash: SUBMITTED, status: 'reverted' }, replaced: null })
    assert.equal((await settlePay(payArgs(chain, wait))).kind, 'not-completed')
  })

  it('event and call match but getBill still says unpaid: sent-unverified, never verified', async () => {
    const chain = fakeChain({ [SUBMITTED]: goodPay() })
    const r = await settlePay(payArgs(chain, waitFor(SUBMITTED), { paid: () => [false, false] }))
    assert.equal(r.kind, 'sent-unverified')
  })

  it('a timeout is sent-unverified and keeps the submitted hash; a later check recovers it', async () => {
    const chain = fakeChain({ [SUBMITTED]: goodPay() })
    const first = await settlePay(payArgs(chain, waitRejects))
    assert.equal(first.kind, 'sent-unverified')
    assert.equal(first.submittedHash, SUBMITTED)
    assert.doesNotMatch(first.kind === 'sent-unverified' ? first.reason : '', /nothing was paid/i)
    const later = await settlePay(payArgs(chain, waitFor(SUBMITTED), { paid: () => [true, false] }))
    assert.equal(later.kind, 'verified')
  })

  it('persistent RPC trouble after the receipt is sent-unverified, not "not paid"', async () => {
    const chain = fakeChain({ [SUBMITTED]: goodPay() }, { fail: () => true })
    assert.equal((await settlePay(payArgs(chain, waitFor(SUBMITTED)))).kind, 'sent-unverified')
  })

  it('RPC trouble that clears is retried and then verified', async () => {
    let calls = 0
    const chain = fakeChain({ [SUBMITTED]: goodPay() }, { fail: () => ++calls <= 2 })
    const r = await settlePay(payArgs(chain, waitFor(SUBMITTED), { paid: () => [true, false], retries: 4 }))
    assert.equal(r.kind, 'verified')
  })

  it('context change during the wait or during verification is stale: nothing to commit', async () => {
    let alive = true
    const chain = fakeChain({ [SUBMITTED]: goodPay() })
    const during: WaitFn = async () => { alive = false; return { receipt: { transactionHash: SUBMITTED, status: 'success' }, replaced: null } }
    assert.equal((await settlePay(payArgs(chain, during, { alive: () => alive, paid: () => [true, false] }))).kind, 'stale')
    alive = true
    let reads = 0
    const args = payArgs(chain, waitFor(SUBMITTED), { alive: () => alive })
    args.readBill = async () => { reads++; alive = false; return { payers: INTENDED.payers, paid: [true, false] } }
    assert.equal((await settlePay(args)).kind, 'stale')
    assert.equal(reads, 1)
  })

  it('a dead token during a timeout is stale, not "sent-unverified"', async () => {
    let alive = true
    const wait: WaitFn = async () => { alive = false; throw new Error('timeout') }
    assert.equal((await settlePay(payArgs(fakeChain({}), wait, { alive: () => alive }))).kind, 'stale')
  })
})

const createArgs = (client: never, wait: WaitFn, o: { alive?: () => boolean; retries?: number } = {}) => ({
  client, wait, token: { isLive: o.alive ?? (() => true) }, submittedHash: SUBMITTED, chainId: CHAIN, contract: CONTRACT,
  intended: INTENDED, creator: CREATOR, retries: o.retries ?? 2, retryDelayMs: 0, sleep: noSleep,
})
const goodCreate = (): FakeTx => ({ from: CREATOR, to: CONTRACT, value: 0n, input: createCalldata(), logs: (h) => [billCreatedLog(7n, INTENDED, { transactionHash: h })] })

describe('settleCreate', () => {
  it('direct create: verified with the creator from tx.from', async () => {
    const r = await settleCreate(createArgs(fakeChain({ [SUBMITTED]: goodCreate() }), waitFor(SUBMITTED)))
    assert.equal(r.kind, 'verified')
    assert.equal(r.kind === 'verified' && r.data.billId, 7n)
    assert.equal(r.kind === 'verified' && r.data.creator, CREATOR.toLowerCase())
  })

  it('repriced create: verified under the final canonical hash', async () => {
    const r = await settleCreate(createArgs(fakeChain({ [REPLACEMENT]: goodCreate() }), waitFor(REPLACEMENT, { reason: 'repriced', hash: REPLACEMENT })))
    assert.equal(r.kind, 'verified')
    assert.equal(r.kind === 'verified' && r.finalHash, REPLACEMENT)
    assert.equal(r.kind === 'verified' && r.submittedHash, SUBMITTED)
  })

  it('a successful cancellation (self-send) creates nothing', async () => {
    const cancel: FakeTx = { from: CREATOR, to: CREATOR, value: 0n, input: '0x', logs: () => [] }
    const r = await settleCreate(createArgs(fakeChain({ [REPLACEMENT]: cancel }), waitFor(REPLACEMENT, { reason: 'cancelled', hash: REPLACEMENT })))
    assert.equal(r.kind, 'not-completed')
    assert.match(r.kind === 'not-completed' ? r.reason : '', /cancelled/)
  })

  it('a replacement with altered calldata is not the intended bill', async () => {
    const other = { ...INTENDED, title: TITLE + ' (changed)' }
    const altered: FakeTx = { ...goodCreate(), input: createCalldata(other), logs: (h) => [billCreatedLog(7n, other, { transactionHash: h })] }
    const r = await settleCreate(createArgs(fakeChain({ [REPLACEMENT]: altered }, { stored: other }), waitFor(REPLACEMENT, { reason: 'replaced', hash: REPLACEMENT })))
    assert.equal(r.kind, 'not-completed')
  })

  it('a timeout says sent / not yet verified and recovers on a later read-only check', async () => {
    const chain = fakeChain({ [SUBMITTED]: goodCreate() })
    const first = await settleCreate(createArgs(chain, waitRejects))
    assert.equal(first.kind, 'sent-unverified')
    assert.equal((await settleCreate(createArgs(chain, waitFor(SUBMITTED)))).kind, 'verified')
  })

  it('RPC trouble while verifying is sent-unverified, then retried to success', async () => {
    const down = fakeChain({ [SUBMITTED]: goodCreate() }, { fail: () => true })
    assert.equal((await settleCreate(createArgs(down, waitFor(SUBMITTED)))).kind, 'sent-unverified')
    let n = 0
    const flaky = fakeChain({ [SUBMITTED]: goodCreate() }, { fail: () => ++n <= 3 })
    assert.equal((await settleCreate(createArgs(flaky, waitFor(SUBMITTED), { retries: 5 }))).kind, 'verified')
  })

  it('stale context returns stale and never verified', async () => {
    let alive = true
    const wait: WaitFn = async () => { alive = false; return { receipt: { transactionHash: SUBMITTED, status: 'success' }, replaced: null } }
    assert.equal((await settleCreate(createArgs(fakeChain({ [SUBMITTED]: goodCreate() }), wait, { alive: () => alive }))).kind, 'stale')
  })

  it('a different sender than the connected creator is not completed', async () => {
    const other: FakeTx = { ...goodCreate(), from: PAYER_B }
    assert.equal((await settleCreate(createArgs(fakeChain({ [SUBMITTED]: other }), waitFor(SUBMITTED)))).kind, 'not-completed')
  })
})
