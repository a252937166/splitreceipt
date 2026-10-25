import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { keccak256 } from 'viem'
import { BillReader, type BillReadClient, type BillState, type Timers } from '../src/billReader.ts'
import { TESTNET, type ReviewedDeployment } from '../src/networks.ts'
import { addr, type Hex } from './fixtures.ts'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CODE = '0x6001600055' as Hex
const DEPLOYMENT: ReviewedDeployment = {
  address: addr(0xbeef).toLowerCase() as Hex,
  label: 'Test deployment',
  runtimeCodeHash: keccak256(CODE),
  deployBlock: null,
}
const PAYER = addr(0xa1)
const RECIPIENT = addr(0xe1)
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)) }

/** A virtual clock: RPC "latency" and the poll interval share one timeline, so 6-second reads run in microseconds. */
class Clock implements Timers {
  now = 0
  private nextId = 1
  private intervals = new Map<number, { at: number; every: number; fn: () => void }>()
  private sleepers: Array<{ at: number; resolve: () => void }> = []
  cleared = 0
  setInterval(fn: () => void, ms: number): number {
    const id = this.nextId++
    this.intervals.set(id, { at: this.now + ms, every: ms, fn })
    return id
  }
  clearInterval(id: unknown): void {
    this.cleared++
    this.intervals.delete(id as number)
  }
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => { this.sleepers.push({ at: this.now + ms, resolve }) })
  }
  /** Runs everything due up to `ms` from now, flushing promise continuations after each step. */
  async advance(ms: number): Promise<void> {
    // Let continuations that are already runnable register their RPC "latency" at the CURRENT time first.
    await flush()
    const end = this.now + ms
    for (;;) {
      const times = [...this.intervals.values()].map((t) => t.at).concat(this.sleepers.map((s) => s.at)).filter((t) => t <= end)
      if (times.length === 0) break
      const t = Math.min(...times)
      this.now = t
      for (const iv of [...this.intervals.values()]) {
        while (iv.at <= t) { iv.at += iv.every; iv.fn() }
      }
      const due = this.sleepers.filter((s) => s.at <= t)
      this.sleepers = this.sleepers.filter((s) => s.at > t)
      for (const s of due) s.resolve()
      await flush()
    }
    this.now = end
    await flush()
  }
}

interface Rig {
  clock: Clock
  calls: { chain: number; code: number; bill: number; maxActive: number }
  states: BillState[]
  failBill: { value: boolean }
  rpcMs: { chain: number; code: number; bill: number }
  gate: { bill: Promise<void> | null }
  client: BillReadClient
}

function rig(ms: { chain?: number; code?: number; bill?: number } = {}): Rig {
  const clock = new Clock()
  const calls = { chain: 0, code: 0, bill: 0, maxActive: 0 }
  let active = 0
  const rpcMs = { chain: ms.chain ?? 0, code: ms.code ?? 0, bill: ms.bill ?? 0 }
  const failBill = { value: false }
  const gate: Rig['gate'] = { bill: null }
  const track = async <T,>(wait: number, f: () => T | Promise<T>): Promise<T> => {
    active++
    calls.maxActive = Math.max(calls.maxActive, active)
    try {
      if (wait > 0) await clock.sleep(wait)
      return await f()
    } finally {
      active--
    }
  }
  const client = {
    getChainId: () => { calls.chain++; return track(rpcMs.chain, () => TESTNET.chainId) },
    getCode: () => { calls.code++; return track(rpcMs.code, () => CODE) },
    readContract: () => {
      const n = ++calls.bill
      return track(rpcMs.bill, async () => {
        if (gate.bill) await gate.bill
        if (failBill.value) throw new Error('rpc exploded')
        return [`read #${n}`, RECIPIENT, [PAYER], 1_000n, [false]]
      })
    },
  } as unknown as BillReadClient
  return { clock, calls, states: [], failBill, rpcMs, gate, client }
}

const make = (r: Rig, over: Partial<ConstructorParameters<typeof BillReader>[0]> = {}) =>
  new BillReader({
    client: r.client, network: TESTNET, deployment: DEPLOYMENT, billId: 1n,
    onState: (s) => r.states.push(s), timers: r.clock, ...over,
  })
const last = (r: Rig) => r.states.at(-1)
const titleOf = (s: BillState | undefined) => (s?.status === 'ready' ? s.bill.title : null)
const deferred = () => { let release!: () => void; const promise = new Promise<void>((x) => { release = x }); return { promise, release } }

describe('one in-flight read pipeline (the confirmed availability defect)', { timeout: 20_000 }, () => {
  it('REPRO control: 6 seconds per RPC (chain, code, bill) with a 10-second poll reaches ready at 18 seconds', async () => {
    const r = rig({ chain: 6000, code: 6000, bill: 6000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(17_900)
    assert.equal(last(r)?.status, 'loading', 'still loading just before 18s, and not restarted by the 10s tick')
    await r.clock.advance(200)
    assert.equal(last(r)?.status, 'ready')
    assert.equal(titleOf(last(r)), 'read #1')
    assert.deepEqual([r.calls.chain, r.calls.code, r.calls.bill], [1, 1, 1], 'the poll tick at 10s started nothing')
    assert.equal(r.calls.maxActive, 1, 'never two RPC calls (so never two pipelines) at once')
    reader.dispose()
  })

  it('a cached runtime plus a getBill that takes 12 seconds still completes under the 10-second poll', async () => {
    const r = rig({ bill: 12_000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(9_900)
    await r.clock.advance(200) // the 10s tick fires while the read is running
    assert.equal(last(r)?.status, 'loading')
    await r.clock.advance(2_000)
    assert.equal(last(r)?.status, 'ready')
    assert.equal(r.calls.bill, 1)
    // later polls re-read the bill but never re-verify the runtime in this context
    await r.clock.advance(60_000)
    assert.ok(r.calls.bill >= 3)
    assert.deepEqual([r.calls.chain, r.calls.code], [1, 1])
    assert.equal(r.calls.maxActive, 1)
    reader.dispose()
  })

  it('busy poll ticks are skipped, not queued: a 35-second read sees three ticks and starts nothing', async () => {
    const r = rig({ bill: 35_000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(34_900)
    assert.equal(r.calls.bill, 1)
    assert.equal(reader.busy, true)
    await r.clock.advance(200)
    assert.equal(titleOf(last(r)), 'read #1')
    assert.equal(r.calls.bill, 1, 'no queued follow-up from the skipped ticks')
    await r.clock.advance(10_000)
    assert.equal(r.calls.bill, 2, 'the next tick after settlement polls again')
    reader.dispose()
  })
})

describe('explicit refreshes while busy coalesce into one follow-up that they wait for', { timeout: 20_000 }, () => {
  it('refreshSilently() asked while a read runs settles only AFTER the later read, and there is exactly one follow-up', async () => {
    const r = rig({ bill: 6000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(1_000)
    const settled: string[] = []
    const p1 = reader.refreshSilently().then(() => settled.push(`p1@${titleOf(last(r))}`))
    const p2 = reader.refreshSilently().then(() => settled.push(`p2@${titleOf(last(r))}`))
    await r.clock.advance(5_100) // the first read finished at 6s
    assert.equal(titleOf(last(r)), 'read #1')
    assert.deepEqual(settled, [], 'not settled by the read that was already running')
    await r.clock.advance(6_000) // the single follow-up
    await Promise.all([p1, p2])
    assert.equal(r.calls.bill, 2, 'one initial read plus exactly one coalesced follow-up')
    assert.deepEqual(settled.sort(), ['p1@read #2', 'p2@read #2'], 'both observed the LATER snapshot when they settled')
    reader.dispose()
  })

  it('with nothing running, an explicit refresh starts at once and settles after its own read', async () => {
    const r = rig({ bill: 3000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(3_100)
    let done = false
    const p = reader.refreshSilently().then(() => { done = true })
    await r.clock.advance(2_900)
    assert.equal(done, false)
    await r.clock.advance(200)
    await p
    assert.equal(r.calls.bill, 2)
    reader.dispose()
  })

  it('foreground wins over silent, in either order, and it is still one follow-up read', async () => {
    for (const order of ['silent-then-foreground', 'foreground-then-silent'] as const) {
      const r = rig({ bill: 6000 })
      const reader = make(r)
      reader.start()
      await r.clock.advance(500)
      const ps = order === 'silent-then-foreground' ? [reader.refreshSilently(), reader.refresh()] : [reader.refresh(), reader.refreshSilently()]
      const before = r.states.length
      await r.clock.advance(5_600)
      assert.deepEqual(r.states.slice(before).map((x) => x.status), ['ready', 'loading'], `${order}: the first read's result, then the foreground follow-up begins`)
      await r.clock.advance(6_000)
      await Promise.all(ps)
      assert.equal(r.calls.bill, 2, order)
      const tail = r.states.slice(before).map((s) => s.status)
      assert.deepEqual(tail, ['ready', 'loading', 'ready'], `${order}: the follow-up showed "loading" (foreground semantics)`)
      reader.dispose()
    }
  })

  it('a silent-only follow-up stays silent (no "loading" flash)', async () => {
    const r = rig({ bill: 6000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(500)
    const p = reader.refreshSilently()
    await r.clock.advance(12_000)
    await p
    assert.equal(r.states.filter((s) => s.status === 'loading').length, 1, 'only the initial foreground read showed loading')
    reader.dispose()
  })
})

describe('failures leave Loading and offer Retry; a background failure keeps only its own context\'s last good data', { timeout: 20_000 }, () => {
  it('an initial failure shows an error (with Retry); a successful Retry shows the bill', async () => {
    const r = rig({ bill: 1000 })
    r.failBill.value = true
    const reader = make(r)
    reader.start()
    await r.clock.advance(1_100)
    assert.equal(last(r)?.status, 'error')
    r.failBill.value = false
    const p = reader.refresh()
    await r.clock.advance(1_100)
    await p
    assert.equal(titleOf(last(r)), 'read #2')
    assert.deepEqual(r.states.map((s) => s.status), ['loading', 'error', 'loading', 'ready'])
    reader.dispose()
  })

  it('a silent read that fails without any ready data leaves Loading for an error instead of waiting for ever', async () => {
    const r = rig({ bill: 1000 })
    r.failBill.value = true
    const reader = make(r)
    reader.start()
    await r.clock.advance(1_100)
    r.states.length = 0
    const p = reader.refreshSilently()
    await r.clock.advance(1_100)
    await p
    assert.equal(last(r)?.status, 'error')
    reader.dispose()
  })

  it('a background failure after a good read keeps the last good snapshot (same context)', async () => {
    const r = rig({ bill: 1000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(1_100)
    assert.equal(titleOf(last(r)), 'read #1')
    r.failBill.value = true
    await r.clock.advance(10_000) // a poll tick reads and fails
    assert.equal(titleOf(last(r)), 'read #1', 'still the last good snapshot, no error flash')
    assert.equal(r.states.some((s) => s.status === 'error'), false)
    // but a FOREGROUND failure is shown
    const p = reader.refresh()
    await r.clock.advance(1_100)
    await p
    assert.equal(last(r)?.status, 'error')
    reader.dispose()
  })

  it('last good data never crosses contexts: a new reader (another context) that fails shows an error, not the old bill', async () => {
    const r = rig({ bill: 1000 })
    const a = make(r)
    a.start()
    await r.clock.advance(1_100)
    assert.equal(titleOf(last(r)), 'read #1')
    a.dispose()
    r.failBill.value = true
    const b = make(r, { billId: 2n })
    b.start()
    await r.clock.advance(1_100)
    assert.equal(last(r)?.status, 'error')
    b.dispose()
  })

  it('a transient runtime-check failure shows an error and the next read verifies again; a mismatch is blocked even when silent', async () => {
    const r = rig({ bill: 500 })
    let verifyCalls = 0
    const verify = async () =>
      ++verifyCalls === 1
        ? ({ ok: false, reason: 'Could not reach the network to verify the contract.', transient: true } as const)
        : verifyCalls === 2
          ? ({ ok: true, codeHash: DEPLOYMENT.runtimeCodeHash } as const)
          : ({ ok: false, reason: 'The deployed code is not the reviewed SplitReceipt runtime.', transient: false } as const)
    const reader = make(r, { verify: verify as never })
    reader.start()
    await r.clock.advance(100)
    assert.equal(last(r)?.status, 'error')
    const p = reader.refresh()
    await r.clock.advance(600)
    await p
    assert.equal(last(r)?.status, 'ready')
    assert.equal(verifyCalls, 2)
    reader.dispose()
    const r2 = rig({ bill: 500 })
    const blocked = make(r2, { verify: (async () => ({ ok: false, reason: 'mismatch', transient: false })) as never })
    blocked.start()
    await r2.clock.advance(100)
    assert.equal(last(r2)?.status, 'blocked')
    blocked.dispose()
  })

  it('InvalidBillId is "missing", not an error', async () => {
    const r = rig({ bill: 100 })
    ;(r.client as unknown as { readContract: () => Promise<never> }).readContract = async () => { throw new Error('reverted: InvalidBillId()') }
    const reader = make(r)
    reader.start()
    await r.clock.advance(200)
    assert.equal(last(r)?.status, 'missing')
    reader.dispose()
  })
})

describe('ownership: cleanup, context changes and A -> B -> A', { timeout: 20_000 }, () => {
  it('dispose stops the timer, publishes nothing, discards the in-flight result and settles every waiter', async () => {
    const r = rig({ bill: 6000 })
    const reader = make(r)
    reader.start()
    await r.clock.advance(1_000)
    const waiting = reader.refreshSilently()
    const waiting2 = reader.refresh()
    const states = r.states.length
    reader.dispose()
    await Promise.all([waiting, waiting2]) // settled at once, not after the 6s RPC
    assert.equal(r.clock.cleared, 1)
    await r.clock.advance(60_000)
    assert.equal(r.states.length, states, 'nothing published after dispose, not even the in-flight result')
    assert.equal(r.calls.bill, 1, 'no poll tick after dispose, no follow-up')
    assert.equal(reader.isDisposed, true)
    await reader.refreshSilently() // a disposed reader resolves immediately and does nothing
    assert.equal(r.calls.bill, 1)
  })

  it('A -> B -> A: an old reader\'s finally cannot clear or drain the replacement\'s slots, and the runtime is not inherited', async () => {
    const r = rig({ bill: 1000 })
    const verifies: string[] = []
    const verify = async (_c: unknown, _n: unknown, d: ReviewedDeployment) => { verifies.push(d.label); return { ok: true, codeHash: d.runtimeCodeHash } as const }
    const hold = deferred()
    r.gate.bill = hold.promise // every bill read waits until released

    const a1 = make(r, { verify: verify as never })
    a1.start()
    await r.clock.advance(100) // a1's read is in flight, gated
    assert.equal(a1.busy, true)
    a1.dispose()

    const b = make(r, { billId: 2n, verify: verify as never })
    b.start()
    await r.clock.advance(100)
    const bWaiter = b.refreshSilently() // coalesced behind b's own running read
    let bSettled = false
    void bWaiter.then(() => { bSettled = true })

    const a2 = make(r, { verify: verify as never }) // back to context A, a NEW instance
    a2.start()
    await r.clock.advance(100)
    assert.deepEqual(verifies, ['Test deployment', 'Test deployment', 'Test deployment'], 'each live context verifies for itself')

    b.dispose()
    await bWaiter // b's own waiter settled by b's own dispose, not by a1's finally
    assert.equal(bSettled, true)

    const before = r.calls.bill
    hold.release() // the OLD (a1, b) reads and a2's read now finish; none of them may touch another instance
    r.gate.bill = null
    await r.clock.advance(1_200)
    assert.equal(a1.busy, false, 'a1 finished its own loop')
    assert.equal(titleOf(last(r)) !== null, true, 'a2 published its own result')
    const a2States = r.states.filter((s) => s.status === 'ready')
    assert.equal(a2States.length, 1, 'only the live reader (a2) published a ready state')
    assert.ok(r.calls.bill >= before)
    a2.dispose()
  })

  it('a replacement keeps its own pending follow-up when an older reader\'s read ends', async () => {
    const r = rig({ bill: 1000 })
    const oldGate = deferred()
    r.gate.bill = oldGate.promise
    const old = make(r)
    old.start()
    await r.clock.advance(100)
    old.dispose()
    r.gate.bill = null
    const fresh = make(r, { billId: 3n })
    fresh.start()
    await r.clock.advance(50)
    const follow = fresh.refreshSilently() // pending on fresh
    oldGate.release() // old read ends now
    await r.clock.advance(100)
    let settled = false
    void follow.then(() => { settled = true })
    await flush()
    assert.equal(settled, false, 'fresh\'s follow-up is still waiting for fresh\'s own read')
    await r.clock.advance(3_000)
    await follow
    assert.equal(settled, true)
    fresh.dispose()
  })
})

describe('the hook is a thin shell: one reader per live context, same public API, nothing remounted by the homepage', { timeout: 20_000 }, () => {
  const hook = read('src/hooks/useBillData.ts')

  it('keeps the public API and creates and disposes one reader per client/network/deployment/bill', () => {
    assert.match(hook, /return \{ state, refresh, refreshSilently, client \}/)
    assert.match(hook, /export function useReadClient/)
    assert.match(hook, /export type \{ BillData, BillState \} from '\.\.\/billReader'/)
    assert.match(hook, /\[client, context\.network, context\.deployment, billId\]/)
    assert.match(hook, /mine\.dispose\(\)/)
    assert.doesNotMatch(hook, /setInterval|run\.current|runtimeOk/, 'no scheduling or ownership state left in the hook')
  })

  it('does not depend on the page-activation signal, so a visit to the homepage never restarts or remounts it', () => {
    assert.doesNotMatch(hook, /useReadActivation|ReadActivationContext/)
    assert.doesNotMatch(read('src/Entry.tsx'), /\bkey=\{/)
  })

  it('the pay flow still awaits the silent refresh, which now waits for the later read', () => {
    assert.match(read('src/components/BillDetails.tsx'), /await refreshSilently\(\)/)
  })
})
