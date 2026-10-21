import { useState } from 'react'
import { ArrowLeft, ExternalLink, ChevronRight, Shield, AlertTriangle } from 'lucide-react'
import { activeNetwork } from '../activeNetwork'
import { useDeploymentReadiness } from '../useDeploymentReadiness'

const EXPLORER_CONTRACT = activeNetwork.contract ? `${activeNetwork.explorerBase}/address/${activeNetwork.contract}` : null

interface WalletChecksProps {
  onBack: () => void
}

function CheckRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-6 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <span className="sr-small shrink-0" style={{ color: 'var(--subdued)', minWidth: '160px' }}>{label}</span>
      <span
        className={`sr-small font-medium break-all${mono ? ' sr-mono' : ''}`}
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="doc-surface overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-2.5 w-full px-5 py-4 text-left"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <ChevronRight
          size={14}
          className={`collapsible-chevron${open ? ' collapsible-chevron--open' : ''}`}
          aria-hidden="true"
          style={{ color: 'var(--subdued)', flexShrink: 0 }}
        />
        <span className="sr-heading-sm" style={{ color: 'var(--ink)' }}>{title}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1">
          {children}
        </div>
      )}
    </div>
  )
}

export default function WalletChecks({ onBack }: WalletChecksProps) {
  const readiness = useDeploymentReadiness()
  const gasLabel = activeNetwork.isTestnet ? 'Testnet USDC (no real value)' : 'Real USDC; no mainnet transactions enabled in this preparation build'
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Back */}
      <button type="button" onClick={onBack} className="btn-ghost" style={{ gap: '6px' }}>
        <ArrowLeft size={14} aria-hidden="true" />
        Create bill
      </button>

      {/* Page heading */}
      <div>
        <h1 className="sr-heading-xl mb-2" style={{ color: 'var(--ink)' }}>Wallet checks</h1>
        <p className="sr-body" style={{ color: 'var(--subdued)' }}>
          Before paying, verify you are on the right network and interacting with the right contract.
        </p>
      </div>

      {/* Security notice */}
      <div className="alert-warn">
        <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div className="sr-small space-y-1">
          <p className="font-semibold">If your wallet shows a security alert, stop immediately.</p>
          <p>Do not approve, bypass, or dismiss unknown warnings. Check the URL, network, and contract address below match exactly, then contact official support before continuing.</p>
        </div>
      </div>

      {/* Contract identity */}
      <Section title="Contract identity">
        <CheckRow label="Network" value={activeNetwork.name} />
        <CheckRow label="Chain ID" value={activeNetwork.chainId.toString()} />
        <CheckRow label="Contract address" value={activeNetwork.contract ?? 'Not deployed / not configured'} mono />
        <CheckRow label="Deployment verification" value={readiness.check.reason ?? readiness.check.status} />
        {EXPLORER_CONTRACT && <div className="flex flex-wrap gap-3 pt-4">
          <a
            href={EXPLORER_CONTRACT}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            View contract on explorer <ExternalLink size={12} aria-hidden="true" />
          </a>
          <a
            href={`${EXPLORER_CONTRACT}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            Verify source code <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>}
      </Section>

      {/* What creating a bill sends */}
      <Section title="What creating a bill sends">
        <div
          className="rounded-lg p-4 mb-1 sr-small"
          style={{ background: 'var(--surface-subtle)', color: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <p><span style={{ color: 'var(--ink)', fontWeight: 600 }}>Creates a bill</span> — stores title, recipient, payer addresses and share amount permanently on {activeNetwork.name}.</p>
        </div>
        <CheckRow label="USDC transferred" value="0 USDC (zero value)" />
        <CheckRow label="Gas cost" value={gasLabel} />
        <CheckRow label="Token approval required" value="No — no ERC-20 approve call" />
        <CheckRow label="Permit or message signature" value="No — wallet transaction confirmation is required; no permit or message signature" />
        <CheckRow label="Message signing (eth_sign, etc.)" value="No" />
        <div
          className="rounded-lg p-4 mt-4 sr-small"
          style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-ink)' }}
        >
          <div className="flex items-start gap-2">
            <Shield size={14} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <p>Your wallet will show a contract interaction. You should see function name <span className="sr-mono">createBill</span> and value 0.</p>
          </div>
        </div>
      </Section>

      {/* What paying a share sends */}
      <Section title="What paying a share sends">
        <div
          className="rounded-lg p-4 mb-1 sr-small"
          style={{ background: 'var(--surface-subtle)', color: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <p><span style={{ color: 'var(--ink)', fontWeight: 600 }}>Pays your share</span> — sends exactly the displayed {activeNetwork.isTestnet ? 'test-USDC' : 'real-USDC'} share directly to the bill recipient. No custody pool.</p>
        </div>
        <CheckRow label="USDC transferred" value="Exactly the displayed share (e.g. 0.001 USDC)" />
        <CheckRow label="Who receives it" value="The bill recipient address — immediately on confirmation" />
        <CheckRow label="Gas cost" value={gasLabel} />
        <CheckRow label="Token approval required" value="No — Arc uses native USDC" />
        <CheckRow label="Permit or message signature" value="No — wallet transaction confirmation is required; no permit or message signature" />
        <CheckRow label="Message signing (eth_sign, etc.)" value="No" />
        <div
          className="rounded-lg p-4 mt-4 sr-small"
          style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success-ink)' }}
        >
          <div className="flex items-start gap-2">
            <Shield size={14} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
            <p>Your wallet will show function name <span className="sr-mono">payShare</span> and a value equal to your share. If the value differs from what the app shows, do not confirm.</p>
          </div>
        </div>
      </Section>

      {/* What this app never does */}
      <Section title="What this app never does">
        <div className="space-y-2 pt-2">
          {[
            'Request token approvals or permits',
            'Ask you to sign arbitrary messages (eth_sign / signTypedData)',
            'Custody your USDC — payments go directly to the bill recipient',
            'Ask you to "verify" your wallet or send a test transaction first',
            'Contact you on social media or direct message',
            'Automatically switch your wallet or transfer funds when changing the app network',
            'Send mainnet transactions in this preparation build',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-1">
              <span
                className="shrink-0 mt-0.5 font-bold"
                style={{ color: 'var(--danger)', fontSize: '13px', lineHeight: 1.4 }}
                aria-hidden="true"
              >
                ✕
              </span>
              <span className="sr-small" style={{ color: 'var(--secondary)' }}>{item}</span>
            </div>
          ))}
        </div>
      </Section>

    </div>
  )
}
