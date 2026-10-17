import { useEffect, useState } from 'react'
import { WalletButton } from './wallet-ui'
import CreateBill from './components/CreateBill'
import BillDetails from './components/BillDetails'

type View =
  | { kind: 'create' }
  | { kind: 'details'; billId: bigint }

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

function setUrlBillId(billId: bigint) {
  const url = new URL(window.location.href)
  url.searchParams.set('bill', billId.toString())
  window.history.pushState({}, '', url.toString())
}

function clearUrlBillId() {
  const url = new URL(window.location.href)
  url.searchParams.delete('bill')
  window.history.pushState({}, '', url.toString())
}

export default function App() {
  const [view, setView] = useState<View>(() => {
    const id = getBillIdFromUrl()
    return id ? { kind: 'details', billId: id } : { kind: 'create' }
  })

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const id = getBillIdFromUrl()
      setView(id ? { kind: 'details', billId: id } : { kind: 'create' })
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const handleBillCreated = (billId: bigint) => {
    setUrlBillId(billId)
    setView({ kind: 'details', billId })
  }

  const handleBack = () => {
    clearUrlBillId()
    setView({ kind: 'create' })
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Top header ────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Testnet notice */}
        <div
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium border-b"
          style={{ background: 'var(--surface-info)', borderColor: 'rgba(16,97,166,0.15)', color: 'var(--accent-hover)' }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
            <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
          </svg>
          <span>Arc Testnet · Test USDC only · No real funds.</span>
        </div>

        {/* Brand + wallet */}
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => { clearUrlBillId(); setView({ kind: 'create' }) }}
            className="flex shrink-0 items-center gap-2.5 font-bold text-base"
            style={{ color: 'var(--ink)' }}
            aria-label="SplitReceipt home"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="var(--accent)"/>
              <path d="M8 8h12M8 12h12M8 16h8" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M18 16l3 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            SplitReceipt
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">
            <span className="badge-network">Arc Testnet</span>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-[1120px] px-4 sm:px-6 py-8">
        {view.kind === 'create' && (
          <>
            <CreateBill onBillCreated={handleBillCreated} />
            <p className="mt-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
              Want to see a real settled bill?{' '}
              <button
                className="font-medium underline underline-offset-4"
                style={{ color: 'var(--accent-hover)' }}
                onClick={() => handleBillCreated(1n)}
              >
                View the completed demo bill →
              </button>
            </p>
          </>
        )}
        {view.kind === 'details' && (
          <BillDetails billId={view.billId} onBack={handleBack} />
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
