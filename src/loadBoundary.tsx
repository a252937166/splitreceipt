import { Component, useEffect, type MutableRefObject, type ReactNode } from 'react'

/**
 * Failure handling for the lazy app chunk.
 *
 * A page that was open while a newer version was published can request an app chunk that no longer exists. If the
 * app has NEVER committed in this page, nothing was ever shown, nothing could have been sent, and a reload is the
 * right way out, so we offer an explicit "Reload latest version" button. We never reload by ourselves and we keep
 * the exact current address (path, query and hash) because `location.reload()` does.
 *
 * Once the app has committed, a later failure is a different thing. We do NOT offer that reload (it would not be a
 * fix for a runtime error, and it would drop in-memory state such as a submitted-transaction lock), we do not remount
 * or reset anything, and we do not claim that any in-progress check survives a reload.
 */
export type CommitFlag = MutableRefObject<boolean>

/** Rendered INSIDE the resolved Suspense content, so the fallback can never mark the app as committed. Monotonic. */
export function CommitMarker({ committed }: { committed: CommitFlag }) {
  useEffect(() => {
    committed.current = true
  }, [committed])
  return null
}

export type LoadFailureKind = 'first-load' | 'after-commit'

export function classifyFailure(committed: boolean): LoadFailureKind {
  return committed ? 'after-commit' : 'first-load'
}

export class LoadBoundary extends Component<
  { children: ReactNode; committed: CommitFlag; reload?: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  /** Only ever runs from the button's click handler. */
  private readonly onReload = () => {
    ;(this.props.reload ?? (() => window.location.reload()))()
  }
  render() {
    if (!this.state.failed) return this.props.children
    if (classifyFailure(this.props.committed.current) === 'first-load') {
      return (
        <div className="mx-auto max-w-md p-6" role="alert">
          <p className="sr-body" style={{ marginTop: 0 }}>
            SplitReceipt could not load this part of the app. A newer version may have been published while this page
            was open. Nothing was sent from your wallet.
          </p>
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={this.onReload}>
            Reload latest version
          </button>
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-md p-6" role="alert">
        <p className="sr-body" style={{ marginTop: 0 }}>
          Something went wrong in the app, so it stopped. If you already sent a transaction, you can look it up on
          the explorer. This page cannot promise that an unfinished check carries over if you reload it.
        </p>
      </div>
    )
  }
}
