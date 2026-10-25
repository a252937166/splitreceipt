/**
 * Reads one bill, without React.
 *
 * `useBillData` is a thin shell around this class. One reader belongs to ONE live context (client, chain, reviewed
 * deployment, bill). It owns, as instance fields:
 *   - the verified-runtime flag, so a runtime verified for one context is never trusted for another;
 *   - a single in-flight read pipeline (runtime check, then getBill), never two at once;
 *   - at most one coalesced follow-up read, with its waiters;
 *   - the poll timer.
 *
 * Why one pipeline: a poll tick used to start a new read every 10 seconds and invalidate the unfinished one. When a
 * read needs more than 10 seconds (the runtime check alone is two sequential RPC calls) it could never finish and
 * the bill stayed on "Loading" for ever. Now a busy poll tick is simply skipped, and an explicit refresh asked for
 * while busy is coalesced into one follow-up read (foreground wins over silent) whose promise settles only after
 * that LATER read, not after the read that was already running.
 *
 * A context change or unmount disposes the reader and a replacement is a new instance, so an old pipeline's
 * `finally`, queued work or timer can only ever touch its own fields, even for a context that goes A -> B -> A.
 * Staleness is never bypassed: a disposed reader publishes nothing.
 */
import type { PublicClient } from 'viem'
import { SPLIT_RECEIPT_HUMAN_ABI } from './splitReceiptAbi.ts'
import type { Address, NetworkContext, ReviewedDeployment } from './networks.ts'
import { verifyRuntime, type RuntimeCheck } from './writeGuard.ts'

export interface BillData {
  title: string
  recipient: Address
  payers: readonly Address[]
  share: bigint
  /** getBill()[4]: index-aligned with payers. */
  paid: readonly boolean[]
}

export type BillState =
  | { status: 'loading' }
  | { status: 'ready'; bill: BillData }
  | { status: 'missing' }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; message: string }

export const POLL_MS = 10_000

export type BillReadClient = Pick<PublicClient, 'getChainId' | 'getCode' | 'readContract'>

export interface Timers {
  setInterval(fn: () => void, ms: number): unknown
  clearInterval(id: unknown): void
}

export interface BillReaderDeps {
  client: BillReadClient
  network: NetworkContext
  deployment: ReviewedDeployment
  billId: bigint
  onState: (state: BillState) => void
  pollMs?: number
  /** Injectable for tests; defaults to the platform timers. */
  timers?: Timers
  /** Injectable for tests; defaults to the real, fail-closed runtime verification. */
  verify?: (client: BillReadClient, network: NetworkContext, deployment: ReviewedDeployment) => Promise<RuntimeCheck>
}

interface Slot {
  foreground: boolean
  waiters: Array<() => void>
}

const PLATFORM_TIMERS: Timers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as never),
}

export class BillReader {
  private readonly deps: BillReaderDeps
  private readonly timers: Timers
  private readonly verify: NonNullable<BillReaderDeps['verify']>
  private disposed = false
  private started = false
  private runtimeOk = false
  private lastGood: BillData | null = null
  private running = false
  private pending: Slot | null = null
  private readonly waiters = new Set<() => void>()
  private timer: unknown

  constructor(deps: BillReaderDeps) {
    this.deps = deps
    this.timers = deps.timers ?? PLATFORM_TIMERS
    this.verify = deps.verify ?? verifyRuntime
  }

  /** True while a read is running. Poll ticks are skipped while this is true. */
  get busy(): boolean {
    return this.running
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  /** First (foreground) read, then the poll timer. */
  start(): void {
    if (this.started || this.disposed) return
    this.started = true
    void this.request(true)
    this.timer = this.timers.setInterval(() => this.poll(), this.deps.pollMs ?? POLL_MS)
  }

  /** Foreground read (shows "Loading" and surfaces errors). Settles after the read it asked for. */
  refresh(): Promise<void> {
    return this.request(true)
  }

  /** Silent read. Settles after the read it asked for, which is the follow-up one when a read was already running. */
  refreshSilently(): Promise<void> {
    return this.request(false)
  }

  /** Invalidates this reader for ever, stops its timer and settles every waiter. Publishes nothing afterwards. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== undefined) this.timers.clearInterval(this.timer)
    this.pending = null
    for (const release of [...this.waiters]) this.release(release)
  }

  private poll(): void {
    // A poll tick never supersedes a read, and is not queued: the next tick will do.
    if (this.disposed || this.running) return
    void this.request(false)
  }

  private request(foreground: boolean): Promise<void> {
    if (this.disposed) return Promise.resolve()
    return new Promise<void>((resolve) => {
      this.waiters.add(resolve)
      if (this.running) {
        const slot = (this.pending ??= { foreground: false, waiters: [] })
        slot.foreground ||= foreground // foreground semantics win
        slot.waiters.push(resolve)
        return
      }
      this.running = true
      void this.loop({ foreground, waiters: [resolve] })
    })
  }

  private release(waiter: () => void): void {
    if (this.waiters.delete(waiter)) waiter()
  }

  private async loop(first: Slot): Promise<void> {
    let slot: Slot | null = first
    while (slot) {
      const current = slot
      await this.pipeline(!current.foreground)
      for (const waiter of current.waiters) this.release(waiter)
      if (this.disposed) break
      slot = this.pending
      this.pending = null
    }
    this.running = false
  }

  private emit(state: BillState): void {
    if (!this.disposed) this.deps.onState(state)
  }

  private fail(silent: boolean, message: string): void {
    // A background failure keeps THIS context's last good snapshot. Anything else must leave "Loading" and offer Retry.
    if (silent && this.lastGood) return
    this.emit({ status: 'error', message })
  }

  /** One read: verify the runtime once, then getBill. Never throws. */
  private async pipeline(silent: boolean): Promise<void> {
    const { client, network, deployment, billId } = this.deps
    if (!silent) this.emit({ status: 'loading' })
    try {
      if (!this.runtimeOk) {
        const rt = await this.verify(client, network, deployment)
        if (this.disposed) return
        if (!rt.ok) {
          if (rt.transient) this.fail(silent, rt.reason)
          else this.emit({ status: 'blocked', reason: rt.reason })
          return
        }
        this.runtimeOk = true
      }
      const res = (await client.readContract({
        address: deployment.address,
        abi: SPLIT_RECEIPT_HUMAN_ABI,
        functionName: 'getBill',
        args: [billId],
      })) as readonly [string, Address, readonly Address[], bigint, readonly boolean[]]
      if (this.disposed) return
      const [title, recipient, payers, share, paid] = res
      this.lastGood = { title, recipient, payers, share, paid }
      this.emit({ status: 'ready', bill: this.lastGood })
    } catch (err) {
      if (this.disposed) return
      const text = `${(err as Error)?.message ?? ''} ${(err as { shortMessage?: string })?.shortMessage ?? ''}`
      if (text.includes('InvalidBillId')) this.emit({ status: 'missing' })
      else this.fail(silent, 'Could not load this bill. Check your connection and retry.')
    }
  }
}
