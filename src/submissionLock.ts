/**
 * Submitted-intent lock.
 *
 * Once a transaction hash exists, that intent can still confirm. Nothing in the UI may unlock another write
 * until a read-only reconciliation reaches a definitive result: verified, or definitively not completed.
 * Hiding or collapsing a notice never touches this lock, and a timeout or a stale context keeps it held.
 * The lock lives in memory for the current page view only.
 */
export type SettlementKind = 'verified' | 'not-completed' | 'sent-unverified' | 'stale'

export function releasesLock(kind: SettlementKind): boolean {
  return kind === 'verified' || kind === 'not-completed'
}

export class SubmissionLock<I extends { submittedHash: string }> {
  private current: I | null = null

  get held(): boolean {
    return this.current !== null
  }

  get intent(): I | null {
    return this.current
  }

  /** Called synchronously when the wallet returns a hash, before any await. */
  hold(intent: I): void {
    this.current = intent
  }

  /** Applies a read-only reconciliation result. Returns true when the lock was released. */
  reconcile(kind: SettlementKind): boolean {
    if (!releasesLock(kind)) return false
    this.current = null
    return true
  }
}
