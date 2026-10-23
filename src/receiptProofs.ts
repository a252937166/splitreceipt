/**
 * Receipt proofs bound to the snapshot they were verified against.
 *
 * A verified receipt is only evidence for the exact situation it was checked in:
 * one chain, one contract, one bill, one share amount, one set of paid payers,
 * and one verification generation. When any of that changes, an earlier proof is
 * no longer "fresh". It may be kept as a candidate that is clearly awaiting
 * re-verification, but it is never counted, linked as verified, or copied into a
 * shared link until the new generation re-proves it.
 *
 *  - `fresh`     proved in the CURRENT snapshot and generation;
 *  - `awaiting`  retained from an earlier snapshot of the SAME bill, not yet re-proven.
 *
 * Results from an older generation are ignored (a held refresh finishing late,
 * or the same bill revisited A -> B -> A, can never overwrite newer state).
 */
import type { HintHash } from './receiptHints.ts'

export interface ProofSnapshot {
  /** chainId:contract:billId */
  scopeKey: string
  share: bigint
  /** Lowercase paid payers, in a stable order. */
  paidPayers: readonly string[]
}

const snapshotKey = (s: ProofSnapshot) => `${s.scopeKey}|${s.share}|${[...s.paidPayers].sort().join(',')}`

export interface ProofOutcome {
  /** payer -> hash proved in this generation */
  verified: Readonly<Record<string, HintHash>>
  /** Hashes that were checked and are definitively not valid receipts. */
  invalid: readonly HintHash[]
}

export class ReceiptProofs {
  private scopeKey = ''
  private snapKey = ''
  private generation = 0
  private readonly freshMap = new Map<string, HintHash>()
  private readonly awaitingMap = new Map<string, HintHash>()
  private paid = new Set<string>()

  /** Starts a new generation for `snapshot`. Returns its number. */
  begin(snapshot: ProofSnapshot): number {
    this.generation += 1
    if (snapshot.scopeKey !== this.scopeKey) {
      // A different chain, contract or bill: nothing carries over, not even as a candidate.
      this.freshMap.clear()
      this.awaitingMap.clear()
      this.scopeKey = snapshot.scopeKey
    }
    this.paid = new Set(snapshot.paidPayers.map((p) => p.toLowerCase()))
    // Last generation's proofs are no longer fresh: they await re-verification.
    for (const [payer, hash] of this.freshMap) this.awaitingMap.set(payer, hash)
    this.freshMap.clear()
    // A payer that is not paid in this snapshot cannot have a receipt (paid true -> false).
    for (const payer of [...this.awaitingMap.keys()]) if (!this.paid.has(payer)) this.awaitingMap.delete(payer)
    this.snapKey = snapshotKey(snapshot)
    return this.generation
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation
  }

  currentGeneration(): number {
    return this.generation
  }

  currentSnapshotKey(): string {
    return this.snapKey
  }

  /** Records one proof as soon as it is verified. Ignored if the generation is stale. */
  addVerified(generation: number, payer: string, hash: HintHash): boolean {
    if (generation !== this.generation) return false
    const p = payer.toLowerCase()
    if (!this.paid.has(p)) return false
    this.freshMap.set(p, hash)
    this.awaitingMap.delete(p)
    return true
  }

  /** Applies a verification outcome. Ignored if the generation is stale. */
  commit(generation: number, outcome: ProofOutcome): boolean {
    if (generation !== this.generation) return false
    for (const [payer, hash] of Object.entries(outcome.verified)) this.addVerified(generation, payer, hash)
    // Definitive invalid proofs are cleared; transient failures leave `awaiting` untouched.
    const bad = new Set(outcome.invalid.map((h) => h.toLowerCase()))
    for (const [payer, hash] of [...this.awaitingMap]) if (bad.has(hash.toLowerCase())) this.awaitingMap.delete(payer)
    return true
  }

  clear(): void {
    this.generation += 1
    this.freshMap.clear()
    this.awaitingMap.clear()
    this.paid = new Set()
    this.scopeKey = ''
    this.snapKey = ''
  }

  fresh(): Record<string, HintHash> {
    return Object.fromEntries(this.freshMap)
  }

  awaiting(): Record<string, HintHash> {
    return Object.fromEntries(this.awaitingMap)
  }

  freshPayers(): ReadonlySet<string> {
    return new Set(this.freshMap.keys())
  }
}
