import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TransactionReceiptNotFoundError, encodeFunctionData } from 'viem'
import { ReceiptsController } from '../src/receiptController.ts'
import { ReceiptProofs } from '../src/receiptProofs.ts'
import { recoverMissingReceipts } from '../src/receiptRecovery.ts'
import { scanSharePaidPage } from '../src/receiptHistory.ts'
import type { HintHash } from '../src/receiptHints.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../src/splitReceiptAbi.ts'
import { CONTRACT, addr, hash, sharePaidLog, type Hex } from './fixtures.ts'

const CHAIN = 5042002
const SCOPE = { chainId: CHAIN, contract: CONTRACT.toLowerCase(), billId: 7n }
const A = addr(0xa1).toLowerCase() as Hex
const B = addr(0xa2).toLowerCase() as Hex
const SHARE = 1_000_000_000_000_000n
const HEAD = 10_000n

interface Tx { payer: Hex; block: bigint; value?: bigint; billId?: bigint; from?: Hex }

/** A chain with SharePaid transactions at given blocks; getLogs honours block ranges. */
function chain(txs: Record<string, Tx>, o: { down?: () => boolean; logsDown?: () => boolean; onLogs?: (from: bigint, to: bigint) => void } = {}) {
  const bh = (b: bigint) => hash(0x1000 + Number(b))
  return {
    getChainId: async () => CHAIN,
    getBlockNumber: async () => HEAD,
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => ({ hash: bh(blockNumber) }),
    getLogs: async (a: { fromBlock: bigint; toBlock: bigint }) => {
      o.onLogs?.(a.fromBlock, a.toBlock)
      if (o.logsDown?.()) throw new Error('rpc down')
      return Object.entries(txs)
        .filter(([, t]) => t.block >= a.fromBlock && t.block <= a.toBlock)
        .map(([h, t]) => ({ transactionHash: h, args: { payer: t.payer }, removed: false }))
    },
    getTransactionReceipt: async ({ hash: h }: { hash: Hex }) => {
      if (o.down?.()) throw new Error('rpc down')
      const t = txs[h.toLowerCase()]
      if (!t) throw new TransactionReceiptNotFoundError({ hash: h })
      return {
        transactionHash: h, blockNumber: t.block, blockHash: bh(t.block), status: 'success', from: t.from ?? t.payer, to: CONTRACT,
        logs: [{ ...sharePaidLog(t.billId ?? 7n, t.payer, SHARE, h), blockNumber: t.block, blockHash: bh(t.block) }],
      }
    },
    getTransaction: async ({ hash: h }: { hash: Hex }) => {
      if (o.down?.()) throw new Error('rpc down')
      const t = txs[h.toLowerCase()]
      if (!t) throw new Error('missing')
      return {
        hash: h, from: t.from ?? t.payer, to: CONTRACT, value: t.value ?? SHARE, blockHash: bh(t.block), blockNumber: t.block,
        input: encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'payShare', args: [t.billId ?? 7n] }),
      }
    },
  } as never
}

const H = {
  B_NEW: hash(0xb1).toLowerCase() as HintHash,       // B, newest page
  A_OLD: hash(0xa1).toLowerCase() as HintHash,       // A, older page
  A_BOGUS: hash(0xa9).toLowerCase() as HintHash,     // A, newest page, wrong value (invalid)
}
const TXS: Record<string, Tx> = {
  [H.B_NEW]: { payer: B, block: 9000n },
  [H.A_OLD]: { payer: A, block: 2000n },
}
const base = (client: never, verified: Set<string>, over: Partial<Parameters<typeof recoverMissingReceipts>[0]> = {}) => ({
  client, scope: SCOPE, paidPayers: [A, B], share: SHARE, verified: () => verified,
  onVerified: (p: string) => { verified.add(p) }, cursor: null, deployBlock: 0n, carry: [] as HintHash[], isStale: () => false,
  pageBlocks: 5000n, ...over,
})

describe('scanner stops by missing identity, not by count', () => {
  it('REPRO: B verified, A missing, newest page returns only B: scanning does not finish', async () => {
    const client = chain(TXS)
    const res = await scanSharePaidPage(client as never, SCOPE, { nextTo: HEAD, floor: 0n, done: false }, { missingPayers: [A], pageBlocks: 5000n, maxPages: 1 })
    assert.deepEqual(res.candidates.map((c) => c.payer), [B])
    assert.equal(res.cursor.done, false, 'must not be marked done')
    assert.equal(res.cursor.nextTo, 5000n, 'remaining cursor preserved')
    assert.equal(res.pagesScanned, 1)
  })

  it('continues to the older page until the missing payer appears, then pauses (not done)', async () => {
    const res = await scanSharePaidPage(chain(TXS) as never, SCOPE, { nextTo: HEAD, floor: 0n, done: false }, { missingPayers: [A], pageBlocks: 5000n })
    assert.deepEqual(res.candidates.map((c) => c.payer).sort(), [A, B].sort())
    assert.equal(res.pagesScanned, 2)
    assert.equal(res.cursor.done, false)
  })

  it('stops page requests once the context is stale', async () => {
    let pages = 0
    let stale = false
    const client = chain(TXS, { onLogs: () => { pages++; stale = true } })
    const res = await scanSharePaidPage(client as never, SCOPE, { nextTo: HEAD, floor: 0n, done: false }, { missingPayers: [A], pageBlocks: 1000n, shouldStop: () => stale })
    assert.equal(pages, 1)
    assert.equal(res.stopped, true)
  })
})

describe('recoverMissingReceipts', () => {
  it('B already verified, A only on an older page: finds and verifies A', async () => {
    const verified = new Set<string>([B])
    const res = await recoverMissingReceipts(base(chain(TXS), verified))
    assert.equal(res.complete, true)
    assert.ok(verified.has(A))
    assert.equal(res.pagesScanned, 2)
    assert.equal(res.exhausted, false)
  })

  it('an INVALID candidate for A in the newest page does not end the search: the real one on an older page is found', async () => {
    const txs = { ...TXS, [H.A_BOGUS]: { payer: A, block: 9500n, value: SHARE - 1n } }
    const verified = new Set<string>([B])
    const res = await recoverMissingReceipts(base(chain(txs), verified))
    assert.equal(res.complete, true)
    assert.ok(verified.has(A))
    assert.equal(res.pagesScanned, 2, 'continued past the invalid candidate')
  })

  it('transient receipt outage keeps the candidate and the cursor; a retry finishes', async () => {
    let down = true
    const client = chain(TXS, { down: () => down })
    const verified = new Set<string>([B])
    const first = await recoverMissingReceipts(base(client, verified))
    assert.equal(first.complete, false)
    assert.equal(first.exhausted, false)
    assert.ok(first.message)
    assert.ok(first.carry.includes(H.A_OLD), 'the undecided candidate is carried, not dropped')
    assert.ok(first.cursor && first.cursor.nextTo < HEAD, 'cursor advanced only past pages already read')
    down = false
    const second = await recoverMissingReceipts(base(client, verified, { cursor: first.cursor, carry: first.carry }))
    assert.equal(second.complete, true)
    assert.ok(verified.has(A))
  })

  it('a history RPC outage does not advance past the failed page and can resume', async () => {
    let logsDown = false
    let calls = 0
    const client = chain(TXS, { logsDown: () => logsDown, onLogs: () => { calls++; if (calls === 2) logsDown = true } })
    const verified = new Set<string>([B])
    const first = await recoverMissingReceipts(base(client, verified))
    assert.equal(first.complete, false)
    assert.ok(first.message)
    assert.equal(first.cursor?.done, false)
    logsDown = false
    const second = await recoverMissingReceipts(base(client, verified, { cursor: first.cursor }))
    assert.equal(second.complete, true)
  })

  it('reports exhausted only when the floor was reached with a payer still missing', async () => {
    const verified = new Set<string>()
    const res = await recoverMissingReceipts(base(chain({}), verified))
    assert.equal(res.complete, false)
    assert.equal(res.exhausted, true)
  })

  it('stale context: no further page requests and a stale result', async () => {
    let pages = 0
    let stale = false
    const client = chain(TXS, { onLogs: () => { pages++; stale = true } })
    const res = await recoverMissingReceipts(base(client, new Set(), { isStale: () => stale }))
    assert.equal(res.stale, true)
    assert.equal(pages, 1)
  })
})

const ctlInput = (client: never, over: Record<string, unknown> = {}) => ({
  client, scope: SCOPE, share: SHARE, paidPayers: [A, B], candidates: [H.A_OLD, H.B_NEW], deployBlock: 0n,
  isStale: () => false, ...over,
})

describe('ReceiptsController (the hook shell): generations, held refreshes, stale proofs', () => {
  it('verifies, then a REFRESH holds: old links are only "awaiting", never fresh', async () => {
    const ctl = new ReceiptsController()
    await ctl.refresh(ctlInput(chain(TXS)))
    assert.equal(ctl.view().status, 'complete')
    assert.deepEqual(Object.keys(ctl.view().fresh).sort(), [A, B].sort())

    // Second generation is held in the middle of verification.
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const slow = chain(TXS)
    ;(slow as unknown as { getChainId: () => Promise<number> }).getChainId = async () => { await gate; return CHAIN }
    const held = ctl.refresh(ctlInput(slow))
    const mid = ctl.view()
    assert.equal(mid.status, 'verifying')
    assert.deepEqual(mid.fresh, {}, 'nothing is fresh while the refresh is in flight')
    assert.deepEqual(Object.keys(mid.awaiting).sort(), [A, B].sort(), 'old proofs are retained only as awaiting')
    release()
    await held
    assert.equal(ctl.view().status, 'complete')
    assert.deepEqual(ctl.view().awaiting, {})
  })

  it('a refresh that finishes after a newer snapshot began commits nothing', async () => {
    const ctl = new ReceiptsController()
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const slow = chain(TXS)
    ;(slow as unknown as { getChainId: () => Promise<number> }).getChainId = async () => { await gate; return CHAIN }
    const first = ctl.refresh(ctlInput(slow, { paidPayers: [A] }))
    await ctl.refresh(ctlInput(chain(TXS), { paidPayers: [A, B] })) // newer snapshot (B just paid)
    assert.deepEqual(Object.keys(ctl.view().fresh).sort(), [A, B].sort())
    release()
    await first
    assert.deepEqual(Object.keys(ctl.view().fresh).sort(), [A, B].sort(), 'late older result did not overwrite')
    assert.equal(ctl.view().paidCount, 2)
  })

  it('paid true -> false clears that payer, and no paid payers clears everything', async () => {
    const ctl = new ReceiptsController()
    await ctl.refresh(ctlInput(chain(TXS)))
    await ctl.refresh(ctlInput(chain(TXS), { paidPayers: [B] }))
    assert.deepEqual(Object.keys(ctl.view().fresh), [B])
    assert.deepEqual(ctl.view().awaiting, {})
    await ctl.refresh(ctlInput(chain(TXS), { paidPayers: [] }))
    assert.deepEqual(ctl.view().fresh, {})
    assert.deepEqual(ctl.view().awaiting, {})
    assert.equal(ctl.view().status, 'none')
  })

  it('definitive invalid clears the retained proof; a transient failure keeps it as awaiting only', async () => {
    const ctl = new ReceiptsController()
    await ctl.refresh(ctlInput(chain(TXS)))
    // Transient failure: nothing can be re-proved, proofs stay awaiting, none become fresh.
    await ctl.refresh(ctlInput(chain(TXS, { down: () => true })))
    assert.deepEqual(ctl.view().fresh, {})
    assert.deepEqual(Object.keys(ctl.view().awaiting).sort(), [A, B].sort())
    assert.equal(ctl.view().status, 'paused')
    // Definitive: the chain no longer has A's transaction (reorg). A's retained proof is cleared.
    await ctl.refresh(ctlInput(chain({ [H.B_NEW]: TXS[H.B_NEW] })))
    assert.deepEqual(Object.keys(ctl.view().fresh), [B])
    assert.equal(ctl.view().awaiting[A], undefined, 'orphan proof cleared')
  })

  it('navigating to another bill and back never revives the first bill\'s proofs', async () => {
    const ctl = new ReceiptsController()
    await ctl.refresh(ctlInput(chain(TXS)))
    await ctl.refresh(ctlInput(chain({}), { scope: { ...SCOPE, billId: 8n }, paidPayers: [A], candidates: [] }))
    assert.deepEqual(ctl.view().awaiting, {}, 'other bill: nothing carries over')
    await ctl.refresh(ctlInput(chain(TXS, { down: () => true })))
    assert.deepEqual(ctl.view().fresh, {})
    assert.deepEqual(ctl.view().awaiting, {}, 'back on the first bill, old proofs are gone, not retained')
  })

  it('a stale view (unmounted) commits and persists nothing', async () => {
    const ctl = new ReceiptsController()
    const saved: string[] = []
    let stale = false
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const slow = chain(TXS)
    ;(slow as unknown as { getChainId: () => Promise<number> }).getChainId = async () => { await gate; return CHAIN }
    const p = ctl.refresh(ctlInput(slow, { isStale: () => stale, persist: (_s: unknown, h: string[]) => saved.push(...h) }))
    stale = true
    release()
    await p
    assert.deepEqual(ctl.view().fresh, {})
    assert.deepEqual(saved, [])
  })

  it('persists only freshly proved hashes of the current generation', async () => {
    const ctl = new ReceiptsController()
    const saved: string[][] = []
    await ctl.refresh(ctlInput(chain(TXS), { persist: (_s: unknown, h: string[]) => saved.push([...h]) }))
    assert.equal(saved.length, 1)
    assert.deepEqual(saved[0].sort(), [H.A_OLD, H.B_NEW].sort())
  })

  it('history search recovers the older payer, keeps the cursor, and supersession cancels it', async () => {
    const ctl = new ReceiptsController()
    const only = chain(TXS)
    await ctl.refresh(ctlInput(only, { candidates: [H.B_NEW] }))
    assert.equal(ctl.view().status, 'partial')
    await ctl.searchHistory()
    assert.equal(ctl.view().status, 'complete')
    assert.equal(ctl.view().scanning, false)

    const ctl2 = new ReceiptsController()
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const slow = chain(TXS)
    const orig = (slow as unknown as { getLogs: (a: unknown) => Promise<unknown> }).getLogs
    ;(slow as unknown as { getLogs: (a: unknown) => Promise<unknown> }).getLogs = async (a) => { await gate; return orig(a) }
    await ctl2.refresh(ctlInput(slow, { candidates: [H.B_NEW] }))
    const search = ctl2.searchHistory()
    await ctl2.refresh(ctlInput(slow, { candidates: [H.B_NEW], paidPayers: [B] })) // snapshot changes mid-search
    release()
    await search
    assert.deepEqual(Object.keys(ctl2.view().fresh), [B], 'the superseded search added nothing')
    assert.equal(ctl2.view().scanning, false)
  })
})

describe('ReceiptProofs', () => {
  const snap = (paid: string[], scopeKey = 'k1', share = 1n) => ({ scopeKey, share, paidPayers: paid })
  it('ignores addVerified and commit from an older generation', () => {
    const p = new ReceiptProofs()
    const g1 = p.begin(snap([A]))
    const g2 = p.begin(snap([A, B]))
    assert.equal(p.addVerified(g1, A, H.A_OLD), false)
    assert.equal(p.commit(g1, { verified: { [A]: H.A_OLD }, invalid: [] }), false)
    assert.deepEqual(p.fresh(), {})
    assert.equal(p.addVerified(g2, A, H.A_OLD), true)
  })
  it('does not accept a proof for a payer that is not paid in the snapshot', () => {
    const p = new ReceiptProofs()
    const g = p.begin(snap([A]))
    assert.equal(p.addVerified(g, B, H.B_NEW), false)
  })
  it('a different share is a different snapshot but the same bill keeps awaiting proofs', () => {
    const p = new ReceiptProofs()
    const g = p.begin(snap([A], 'k1', 1n))
    p.addVerified(g, A, H.A_OLD)
    p.begin(snap([A], 'k1', 2n))
    assert.deepEqual(p.fresh(), {})
    assert.deepEqual(p.awaiting(), { [A]: H.A_OLD })
  })
})

// ---------- Round-2 regressions ----------

describe('REGRESSION A: candidates from successful pages survive a later page failure', () => {
  const A_NEW = hash(0xa5).toLowerCase() as HintHash
  const B_OLD = hash(0xb5).toLowerCase() as HintHash
  const T: Record<string, Tx> = { [A_NEW]: { payer: A, block: 9000n }, [B_OLD]: { payer: B, block: 2000n } }

  it('A+B missing; page 10000..5001 yields A at 9000; page 5000..1 fails: A is verified, cursor stays on the failed page; retry recovers B and A', async () => {
    let logsDown = false
    let calls = 0
    const client = chain(T, { logsDown: () => logsDown, onLogs: () => { calls++; if (calls === 2) logsDown = true } })
    const verified = new Set<string>()
    const first = await recoverMissingReceipts(base(client, verified))
    assert.ok(verified.has(A), 'A, found on the successful page, was verified before the error returned')
    assert.equal(first.complete, false)
    assert.ok(first.message)
    assert.equal(first.cursor?.nextTo, 5000n, 'cursor preserved at the failed page, not skipped')
    assert.equal(first.cursor?.done, false)

    logsDown = false
    const second = await recoverMissingReceipts(base(client, verified, { cursor: first.cursor, carry: first.carry }))
    assert.ok(verified.has(A) && verified.has(B), 'retry recovers B and A')
    assert.equal(second.complete, true)
  })

  it('same failure while receipts are also down: A is RETAINED in carry, never dropped, and the retry verifies it', async () => {
    let logsDown = false
    let receiptsDown = true
    let calls = 0
    const client = chain(T, { logsDown: () => logsDown, down: () => receiptsDown, onLogs: () => { calls++; if (calls === 2) logsDown = true } })
    const verified = new Set<string>()
    const first = await recoverMissingReceipts(base(client, verified))
    assert.equal(verified.size, 0)
    assert.ok(first.carry.includes(A_NEW), 'successful-page candidate retained')
    assert.equal(first.cursor?.nextTo, 5000n)

    logsDown = false
    receiptsDown = false
    const second = await recoverMissingReceipts(base(client, verified, { cursor: first.cursor, carry: first.carry }))
    assert.ok(verified.has(A) && verified.has(B))
    assert.equal(second.complete, true)
  })

  it('controller level: the same sequence ends complete after a retry', async () => {
    let logsDown = false
    let calls = 0
    const client = chain(T, { logsDown: () => logsDown, onLogs: () => { calls++; if (calls === 2) logsDown = true } })
    const ctl = new ReceiptsController()
    await ctl.refresh(ctlInput(client, { candidates: [] }))
    await ctl.searchHistory()
    assert.deepEqual(Object.keys(ctl.view().fresh), [A])
    assert.equal(ctl.view().status, 'paused')
    logsDown = false
    await ctl.searchHistory()
    assert.equal(ctl.view().status, 'complete')
    assert.deepEqual(Object.keys(ctl.view().fresh).sort(), [A, B].sort())
  })
})

describe('REGRESSION B: unresolved verification is not terminal history exhaustion', () => {
  const B_LAST = hash(0xb6).toLowerCase() as HintHash
  const T: Record<string, Tx> = { [B_LAST]: { payer: B, block: 1n } }
  const input = (client: never) => ({
    client, scope: SCOPE, share: SHARE, paidPayers: [B], candidates: [] as HintHash[], deployBlock: 1n, isStale: () => false,
  })

  it('candidate on the last logs page, receipt RPC fails: retry stays enabled, then recovers a verified proof', async () => {
    let down = true
    const ctl = new ReceiptsController()
    await ctl.refresh(input(chain(T, { down: () => down })))
    await ctl.searchHistory()
    const stuck = ctl.view()
    assert.equal(stuck.exhausted, false, 'the logs reached the floor, but this is not terminal exhaustion')
    assert.equal(stuck.unresolved, 1, 'the undecided candidate is visible to the UI')
    assert.equal(stuck.status, 'paused')
    assert.equal(stuck.scanning, false)
    assert.deepEqual(stuck.fresh, {})

    down = false
    await ctl.searchHistory() // the read-only retry
    const done = ctl.view()
    assert.equal(done.status, 'complete')
    assert.deepEqual(Object.keys(done.fresh), [B])
    assert.equal(done.unresolved, 0)
  })

  it('terminal exhaustion is still reported when nothing is unresolved', async () => {
    const ctl = new ReceiptsController()
    await ctl.refresh(input(chain({})))
    await ctl.searchHistory()
    const v = ctl.view()
    assert.equal(v.exhausted, true)
    assert.equal(v.unresolved, 0)
  })
})
