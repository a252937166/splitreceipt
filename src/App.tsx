import { useEffect, useState } from 'react'
import { FileText, ReceiptText, ShieldCheck } from 'lucide-react'
import { WalletButton } from './wallet-ui'
import CreateBill from './components/CreateBill'
import BillDetails from './components/BillDetails'
import WalletChecks from './components/WalletChecks'
import { activeNetwork } from './activeNetwork'
import { isCurrentLocationContext, MAINNET_WRITES_ENABLED } from './networkContext'
import { buildNetworkNavigationUrl } from './networkNavigation'

type View =
  | { kind: 'create' }
  | { kind: 'details'; billId: bigint }
  | { kind: 'checks' }

const DEMO_BILL_ID = 3n

function getBillIdFromUrl(): bigint | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('bill')
    if (!raw) return null
    const n = BigInt(raw)
    return n > 0n ? n : null
  } catch {
    return null
  }
}

function getViewFromUrl(): View {
  const id = getBillIdFromUrl()
  if (id) return { kind: 'details', billId: id }
  const hash = window.location.hash
  if (hash === '#checks') return { kind: 'checks' }
  return { kind: 'create' }
}

function setUrlBillId(billId: bigint) {
  const url = new URL(window.location.href)
  url.searchParams.set('network', activeNetwork.key)
  url.searchParams.set('chainId', String(activeNetwork.chainId))
  if (activeNetwork.contract) url.searchParams.set('contract', activeNetwork.contract.toLowerCase())
  else url.searchParams.delete('contract')
  url.searchParams.set('bill', billId.toString())
  url.searchParams.delete('receipts')
  url.hash = ''
  window.history.pushState({}, '', url.toString())
}

function clearUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('bill')
  url.searchParams.delete('receipts')
  url.hash = ''
  window.history.pushState({}, '', url.toString())
}

function setUrlChecks() {
  const url = new URL(window.location.href)
  url.searchParams.delete('bill')
  url.searchParams.delete('receipts')
  url.hash = 'checks'
  window.history.pushState({}, '', url.toString())
}

const NAV_ITEMS = [
  { kind: 'create' as const, label: 'Create bill',    Icon: FileText },
  { kind: 'demo'   as const, label: 'Demo receipt',   Icon: ReceiptText },
  { kind: 'checks' as const, label: 'Wallet checks',  Icon: ShieldCheck },
]

export default function App() {
  const [view, setView] = useState<View>(getViewFromUrl)

  useEffect(() => {
    const handler = () => {
      if (!isCurrentLocationContext(activeNetwork, window.location.href)) { window.location.reload(); return }
      setView(getViewFromUrl())
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const handleBillCreated = (billId: bigint) => {
    if (!isCurrentLocationContext(activeNetwork, window.location.href)) return
    setUrlBillId(billId)
    setView({ kind: 'details', billId })
  }

  const goCreate = () => { clearUrl(); setView({ kind: 'create' }) }
  const goDemo = () => {
    if (!activeNetwork.isTestnet || activeNetwork.configError) {
      const url = new URL(buildNetworkNavigationUrl(window.location.href, 'testnet'))
      url.searchParams.set('bill', DEMO_BILL_ID.toString())
      window.location.assign(url.toString())
      return
    }
    setUrlBillId(DEMO_BILL_ID); setView({ kind: 'details', billId: DEMO_BILL_ID })
  }
  const goChecks = () => { setUrlChecks(); setView({ kind: 'checks' }) }
  const goBack   = () => { clearUrl(); setView({ kind: 'create' }) }

  function isActive(kind: 'create' | 'demo' | 'checks') {
    if (kind === 'create') return view.kind === 'create'
    if (kind === 'demo')   return activeNetwork.isTestnet && view.kind === 'details' && (view as { kind: 'details'; billId: bigint }).billId === DEMO_BILL_ID
    return view.kind === 'checks'
  }

  const navAction = { create: goCreate, demo: goDemo, checks: goChecks }

  return (
    /* Root: full-height flex row on desktop */
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--canvas)' }}>

      {/* ── Testnet notice strip ───────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium z-50"
        style={{ background: 'var(--warn-bg)', borderBottom: '1px solid var(--warn-border)', color: 'var(--warn-ink)' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
          <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
        </svg>
        <span>{activeNetwork.isTestnet ? 'Arc Testnet · Test USDC only · No real funds' : activeNetwork.mainnetWritesEnabled ? 'Arc Mainnet · Real USDC · Wallet confirmation required' : 'Arc Mainnet · Real USDC · Transactions disabled'}</span>
        <label className="sr-only" htmlFor="app-network">App network</label>
        <select
          id="app-network"
          value={activeNetwork.key}
          onChange={event => window.location.assign(buildNetworkNavigationUrl(window.location.href, event.target.value as 'testnet' | 'mainnet'))}
          className="rounded px-2 py-1 text-xs"
          style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)', minHeight: '36px', maxWidth: '160px' }}
          aria-label="App network"
        >
          <option value="testnet">Arc Testnet</option>
          <option value="mainnet">{MAINNET_WRITES_ENABLED ? 'Arc Mainnet' : 'Arc Mainnet · preview'}</option>
        </select>
      </div>

      {/* ── Outer shell: rail + content ────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left navigation rail (desktop only ≥768px) ────────────── */}
        <aside
          className="hidden md:flex flex-col shrink-0"
          style={{
            width: '208px',
            background: 'var(--rail-bg)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
          aria-label="Application navigation"
        >
          {/* Brand */}
          <button
            onClick={goCreate}
            className="flex items-center gap-2.5 px-5 pt-6 pb-5"
            style={{ color: '#FFFFFF', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            aria-label="SplitReceipt home"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="#176B57"/>
              <path d="M8 8h12M8 12h12M8 16h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M18 16l3 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em' }}>SplitReceipt</span>
          </button>

          {/* Nav items */}
          <nav className="flex-1 px-3 space-y-1" aria-label="Main navigation">
            {NAV_ITEMS.map(({ kind, label, Icon }) => (
              <button
                key={kind}
                type="button"
                className={`rail-nav-link${isActive(kind) ? ' rail-nav-link--active' : ''}`}
                onClick={navAction[kind]}
                aria-current={isActive(kind) ? 'page' : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          {/* Bottom: wallet */}
          <div className="px-3 pb-6 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="badge-network"
                style={{ background: 'rgba(20,92,68,0.4)', border: '1px solid rgba(168,213,187,0.3)', color: '#A8D5BB', fontSize: '11px' }}
              >
                {activeNetwork.name}
              </span>
            </div>
            <WalletButton />
          </div>
        </aside>

        {/* ── Right: mobile header + content ─────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Mobile header (hidden ≥768px) */}
          <header
            className="md:hidden sticky top-0 z-40"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 px-4 h-14">
              {/* Brand */}
              <button
                onClick={goCreate}
                className="flex shrink-0 items-center gap-2"
                style={{ color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '15px' }}
                aria-label="SplitReceipt home"
              >
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  <rect width="28" height="28" rx="7" fill="#176B57"/>
                  <path d="M8 8h12M8 12h12M8 16h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                  <path d="M18 16l3 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                SplitReceipt
              </button>
              {/* Wallet pill */}
              <div className="ml-auto shrink-0">
                <WalletButton />
              </div>
            </div>

            {/* Mobile nav tabs */}
            <nav
              className="flex items-center gap-1 px-3 pb-2 overflow-x-auto"
              style={{ scrollbarWidth: 'none' }}
              aria-label="Main navigation"
            >
              {NAV_ITEMS.map(({ kind, label, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  className={`mobile-nav-link${isActive(kind) ? ' mobile-nav-link--active' : ''}`}
                  onClick={navAction[kind]}
                  aria-current={isActive(kind) ? 'page' : undefined}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </nav>
          </header>

          {activeNetwork.configError && (
            <div className="alert-warn mx-4 mt-6" role="alert">
              <span className="flex-1">This link does not match the configured network deployment. Transactions and receipt queries are disabled.</span>
              <a className="btn-ghost" href={buildNetworkNavigationUrl(window.location.href, 'testnet')}>Return to Arc Testnet</a>
            </div>
          )}

          {/* Content */}
          <main className="flex-1 px-4 md:px-8 py-8 md:py-10 max-w-[1120px] w-full mx-auto">
            {view.kind === 'create' && (
              <CreateBill key={`${activeNetwork.contextKey}:create`} onBillCreated={handleBillCreated} onViewDemo={goDemo} />
            )}
            {view.kind === 'details' && (
              <BillDetails key={`${activeNetwork.contextKey}:${view.billId}`} billId={view.billId} onBack={goBack} />
            )}
            {view.kind === 'checks' && (
              <WalletChecks key={`${activeNetwork.contextKey}:checks`} onBack={goCreate} />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
