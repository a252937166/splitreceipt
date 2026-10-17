import { useEffect, useState } from 'react'
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
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      <div className="mx-auto max-w-md px-4 pt-5 text-sm" style={{ color: 'var(--ink-2)' }}>
        <p className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-strong)' }}>
          Arc Testnet demo · Test USDC only. No real funds.
        </p>
        {view.kind === 'create' && <button
          className="mt-3 text-sm underline underline-offset-4"
          onClick={() => handleBillCreated(1n)}>
          View the completed demo bill and its receipts
        </button>}
      </div>
      {view.kind === 'create' && (
        <CreateBill onBillCreated={handleBillCreated} />
      )}
      {view.kind === 'details' && (
        <BillDetails billId={view.billId} onBack={handleBack} />
      )}
    </div>
  )
}
