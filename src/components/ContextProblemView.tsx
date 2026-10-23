import { AlertTriangle } from 'lucide-react'
import type { ContextProblem } from '../networks'

/**
 * Shown when the link names a network, chain or contract this build does not
 * support. Nothing is silently substituted; recovery is a full navigation to
 * the clean Arc Testnet page, which clears the old bill, receipts and contract.
 */
export default function ContextProblemView({ problem }: { problem: ContextProblem }) {
  return (
    <section className="doc-surface mx-auto max-w-xl p-6" aria-labelledby="ctx-problem">
      <div className="alert-warn" role="alert">
        <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
        <div>
          <h1 id="ctx-problem" className="sr-heading-sm" style={{ marginBottom: 4 }}>
            This link can&apos;t be opened here
          </h1>
          <p style={{ margin: 0 }}>{problem.message}</p>
        </div>
      </div>
      <p className="sr-small" style={{ color: 'var(--secondary)', margin: '16px 0' }}>
        Nothing was loaded and no wallet request was made. Bills are only shown for a reviewed contract on the
        network named in the link, so a link for a different network or contract is never reinterpreted.
      </p>
      <a className="btn-primary" style={{ textDecoration: 'none' }} href={window.location.pathname}>
        Open SplitReceipt on Arc Testnet
      </a>
    </section>
  )
}
