/**
 * Receipt state for one bill view, without any React.
 *
 * The `useReceipts` hook is a thin shell around this class so the behavior that matters
 * (generations, held refreshes, stale results, history recovery) can be exercised directly.
 * Every state change after an await is guarded by the proof generation: a refresh that
 * finishes after a newer one began, or after the page changed, commits nothing.
 */
import type { PublicClient } from 'viem'
import { ReceiptProofs } from './receiptProofs.ts'
import { recoverMissingReceipts, verifyCandidateSet } from './receiptRecovery.ts'
import { receiptScopeKey, type HistoryCursor, type ReceiptScope } from './receiptHistory.ts'
import type { HintHash } from './receiptHints.ts'

type Client = Parameters<typeof verifyCandidateSet>[0]['client'] & Pick<PublicClient, 'getLogs' | 'getBlockNumber'>

export interface RefreshInput {
  client: Client
  scope: ReceiptScope
  share: bigint
  /** Lowercase paid payers from the current bill snapshot. */
  paidPayers: readonly string[]
  candidates: readonly HintHash[]
  deployBlock: bigint | null
  /** Page epoch / unmount check supplied by the view. */
  isStale: () => boolean
  /** Called with fresh proof hashes of the CURRENT generation only (for example, to save hints). */
  persist?: (scope: ReceiptScope, hashes: readonly HintHash[]) => void
}

export type ReceiptStatus = 'none' | 'verifying' | 'complete' | 'partial' | 'paused'

export interface ReceiptsView {
  /** Proved in the current snapshot and generation. Only these may be shown as verified. */
  fresh: Record<string, HintHash>
  /** Retained from an earlier snapshot of this bill; awaiting re-verification. Not verified. */
  awaiting: Record<string, HintHash>
  status: ReceiptStatus
  message: string | null
  scanning: boolean
  /** Terminal: the reviewed history floor was reached, nothing is waiting to be verified, payers are still missing. */
  exhausted: boolean
  /** Candidates found but not yet decided (for example a receipt RPC outage). A read-only retry stays available. */
  unresolved: number
  paidCount: number
}

export class ReceiptsController {
  readonly proofs = new ReceiptProofs()
  private scopeKey = ''
  private cursor: HistoryCursor | null = null
  private carry: HintHash[] = []
  private message: string | null = null
  private verifying = false
  private scanning = false
  private searchRun = 0
  private exhausted = false
  private paidCount = 0
  private last: RefreshInput | null = null
  private readonly listeners = new Set<() => void>()

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify() {
    for (const fn of [...this.listeners]) fn()
  }

  private persist(input: RefreshInput) {
    const hashes = Object.values(this.proofs.fresh())
    if (hashes.length > 0) input.persist?.(input.scope, hashes)
  }

  view(): ReceiptsView {
    const fresh = this.proofs.fresh()
    const freshCount = Object.keys(fresh).length
    let status: ReceiptStatus
    if (this.paidCount === 0) status = 'none'
    else if (this.verifying) status = 'verifying'
    else if (freshCount >= this.paidCount) status = 'complete'
    else status = this.message ? 'paused' : 'partial'
    return {
      fresh,
      awaiting: this.proofs.awaiting(),
      status,
      message: status === 'complete' ? null : this.message,
      scanning: this.scanning,
      exhausted: this.exhausted && this.carry.length === 0,
      unresolved: this.carry.length,
      paidCount: this.paidCount,
    }
  }

  /** Starts a new verification generation for the given snapshot. */
  async refresh(input: RefreshInput): Promise<void> {
    const scopeKey = receiptScopeKey(input.scope)
    if (scopeKey !== this.scopeKey) {
      this.scopeKey = scopeKey
      this.cursor = null
      this.carry = []
      this.exhausted = false
    }
    this.last = input
    this.searchRun++ // a running history search belongs to the previous generation
    this.scanning = false
    const gen = this.proofs.begin({ scopeKey, share: input.share, paidPayers: input.paidPayers })
    this.paidCount = input.paidPayers.length
    this.message = null
    this.verifying = input.paidPayers.length > 0
    this.notify()
    if (!this.verifying) return

    const stale = () => !this.proofs.isCurrent(gen) || input.isStale()
    const out = await verifyCandidateSet({
      client: input.client,
      scope: input.scope,
      payers: input.paidPayers,
      share: input.share,
      candidates: input.candidates,
      isCancelled: stale,
    })
    if (stale()) return
    this.proofs.commit(gen, { verified: out.verified, invalid: out.invalid })
    this.carry = out.unresolved
    this.message = out.message
    this.exhausted = this.exhausted && out.unresolved.length === 0
    this.verifying = false
    this.persist(input)
    this.notify()
  }

  /** Adds a candidate (for example a just-verified payment) and re-verifies. */
  async refreshWith(extra: readonly HintHash[]): Promise<void> {
    if (!this.last) return
    const merged = [...new Set([...extra, ...this.last.candidates])]
    await this.refresh({ ...this.last, candidates: merged })
  }

  /** Bounded history search for the payers that are still missing a fresh proof. */
  async searchHistory(): Promise<void> {
    const input = this.last
    if (!input || this.scanning || this.verifying) return
    const gen = this.proofs.currentGeneration()
    const scopeKey = this.scopeKey
    const stale = () => !this.proofs.isCurrent(gen) || input.isStale() || this.scopeKey !== scopeKey
    const run = ++this.searchRun
    this.scanning = true
    this.message = null
    this.notify()
    try {
      const res = await recoverMissingReceipts({
        client: input.client,
        scope: input.scope,
        paidPayers: input.paidPayers,
        share: input.share,
        verified: () => this.proofs.freshPayers(),
        onVerified: (payer, hash) => {
          if (this.proofs.addVerified(gen, payer, hash)) {
            this.persist(input)
            this.notify()
          }
        },
        cursor: this.cursor,
        deployBlock: input.deployBlock,
        carry: this.carry,
        isStale: stale,
      })
      if (!res.stale && !stale()) {
        this.cursor = res.cursor
        this.carry = res.carry
        this.message = res.message
        this.exhausted = res.exhausted && !res.complete && res.carry.length === 0
      }
    } finally {
      if (this.searchRun === run) this.scanning = false
      this.notify()
    }
  }
}
