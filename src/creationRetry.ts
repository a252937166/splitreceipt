/** A mined failure/cancellation permits retry; an unexplained successful receipt needs review. */
export function creationMayRetry(kind: string): boolean {
  return kind === 'reverted' || kind === 'cancelled' || kind === 'replaced'
}
