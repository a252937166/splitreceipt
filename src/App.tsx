import { useEffect, useState } from 'react'
import { WalletButton } from './wallet-ui'
import CreateBill from './components/CreateBill'
import BillDetails from './components/BillDetails'
import WalletChecks from './components/WalletChecks'

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
  url.searchParams.set('bill', billId.toString())
  url.hash = ''
  window.history.pushState({}, '', url.toString())
}

function clearUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('bill')
  url.hash = ''
  window.history.pushState({}, '', url.toString())
}

function setUrlChecks() {
  const url = new URL(window.location.href)
  url.searchParams.delete('bill')
  url.hash = 'checks'
  window.history.pushState({}, '', url.toString())
}

export default function App() {
  const [view, setView] = useState<View>(getViewFromUrl)

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => setView(getViewFromUrl())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const handleBillCreated = (billId: bigint) => {
    setUrlBillId(billId)
    setView({ kind: 'details', billId })
  }

  const goCreate = () => { clearUrl(); setView({ kind: 'create' }) }
  const goDemo = () => { setUrlBillId(DEMO_BILL_ID); setView({ kind: 'details', billId: DEMO_BILL_ID }) }
  const goChecks = () => { setUrlChecks(); setView({ kind: 'checks' }) }
  const goBack = () => { clearUrl(); setView({ kind: 'create' }) }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Testnet notice strip ───────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium"
        style={{ background: 'var(--info-bg)', borderBottom: '1px solid var(--info-border)', color: 'var(--info-ink)' }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
          <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
        </svg>
        Arc Testnet · Test USDC only. No real funds.
      </div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6 h-14 flex items-center gap-6">
          {/* Brand */}
          <button
            onClick={goCreate}
            className="flex shrink-0 items-center gap-2.5 font-bold text-[15px]"
            style={{ color: 'var(--ink)', fontFamily: "'Iowan Old Style', Georgia, serif" }}
            aria-label="SplitReceipt home"
          >
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="var(--accent-solid)"/>
              <path d="M8 8h12M8 12h12M8 16h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M18 16l3 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            SplitReceipt
          </button>

          {/* Nav — desktop */}
          <nav className="hidden sm:flex items-center gap-5" aria-label="Main navigation">
            <button
              className={`nav-link${view.kind === 'create' ? ' nav-link--active' : ''}`}
              onClick={goCreate}
            >
              Create bill
            </button>
            <button
              className={`nav-link${view.kind === 'details' && view.billId === DEMO_BILL_ID ? ' nav-link--active' : ''}`}
              onClick={goDemo}
            >
              Demo receipt
            </button>
            <button
              className={`nav-link${view.kind === 'checks' ? ' nav-link--active' : ''}`}
              onClick={goChecks}
            >
              Wallet checks
            </button>
          </nav>

          {/* Right: network badge + wallet */}
          <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">
            <span className="badge-network">Arc Testnet</span>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* ── Mobile nav row (visible only below sm) ────────────────────── */}
      <nav
        className="sm:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        aria-label="Main navigation"
      >
        <button
          className={`nav-link shrink-0${view.kind === 'create' ? ' nav-link--active' : ''}`}
          onClick={goCreate}
        >
          Create bill
        </button>
        <button
          className={`nav-link shrink-0${view.kind === 'details' && view.billId === DEMO_BILL_ID ? ' nav-link--active' : ''}`}
          onClick={goDemo}
        >
          Demo receipt
        </button>
        <button
          className={`nav-link shrink-0${view.kind === 'checks' ? ' nav-link--active' : ''}`}
          onClick={goChecks}
        >
          Wallet checks
        </button>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-[1120px] px-4 sm:px-6 py-8">
        {view.kind === 'create' && (
          <>
            <CreateBill onBillCreated={handleBillCreated} onViewDemo={goDemo} />
          </>
        )}
        {view.kind === 'details' && (
          <BillDetails billId={view.billId} onBack={goBack} />
        )}
        {view.kind === 'checks' && (
          <WalletChecks onBack={goCreate} />
        )}
      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer
        className="border-t text-center text-xs py-4 px-4"
        style={{ borderColor: 'var(--border)', color: 'var(--subtle)' }}
      >
        Arc Testnet · Test USDC only · No real funds
      </footer>
    </div>
  )
}
