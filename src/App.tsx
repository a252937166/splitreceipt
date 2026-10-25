import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, FilePlus2, Receipt, Search } from 'lucide-react'
import CreateBill from './components/CreateBill'
import BillDetails from './components/BillDetails'
import OpenBill from './components/OpenBill'
import ContextProblemView from './components/ContextProblemView'
import { defaultCreateSearch } from './homeRoute'
import { readEnvAddress } from './envAddress'
import WalletMenu from './wallet/WalletMenu'
import { WalletSessionProvider } from './wallet/WalletSession'
import { NETWORKS, TESTNET, buildContextSearch, parsePageContext, type Hash32, type PageContext } from './networks'

type Tab = 'create' | 'open'

/**
 * The app side: the wallet session for the page's network and the app views. Rendered inside the wagmi provider by
 * `AppRoot` (a lazy chunk), never by the homepage.
 */
export default function AppView({
  appSearch,
  go,
  goHome,
}: {
  appSearch: string
  go: (next: string) => void
  goHome: () => void
}) {
  const parsed = useMemo(() => parsePageContext(appSearch, readEnvAddress()), [appSearch])
  // The wallet session follows the page network; an invalid link falls back to Testnet.
  return (
    <WalletSessionProvider network={parsed.ok ? parsed.context.network : TESTNET}>
      <Shell parsed={parsed} go={go} goHome={goHome} />
    </WalletSessionProvider>
  )
}

type Parsed = ReturnType<typeof parsePageContext>

function Shell({ parsed, go, goHome }: { parsed: Parsed; go: (next: string) => void; goHome: () => void }) {
  const [tab, setTab] = useState<Tab>('create')

  const openBill = useCallback(
    (context: PageContext, billId: bigint, created?: Hash32 | null) => {
      go(buildContextSearch(context, billId, { created }))
    },
    [go],
  )

  const goCreate = useCallback(() => {
    setTab('create')
    if (parsed.ok) go(buildContextSearch(parsed.context, null))
    else go(defaultCreateSearch(readEnvAddress()))
  }, [go, parsed])

  const goDemo = useCallback(() => {
    if (parsed.ok) openBill(parsed.context, parsed.context.network.key === 'mainnet' ? 1n : 3n)
  }, [openBill, parsed])

  const context = parsed.ok ? parsed.context : null
  const viewingBill = context?.billId !== null && context?.billId !== undefined

  return (
    <div className="min-h-dvh" style={{ background: 'var(--canvas)' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {/* Two rows below 640px (brand + wallet, then the network choice); one row from 640px. */}
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <button
            type="button"
            onClick={goHome}
            className="order-1 flex min-w-0 items-center gap-2 border-0 bg-transparent p-0 touch-target"
            aria-label="SplitReceipt home"
          >
            <Receipt size={22} aria-hidden="true" style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span className="sr-heading-md" style={{ color: 'var(--ink)' }}>SplitReceipt</span>
          </button>
          <div className="order-2 ml-auto min-w-0 sm:order-3 sm:ml-0">
            <WalletMenu />
          </div>
          <div
            className="order-3 flex w-full min-w-0 items-center gap-2 sm:order-2 sm:ml-auto sm:w-auto"
            role="group"
            aria-label="Network"
          >
            {NETWORKS.map((n) => {
              const active = context?.network.key === n.key
              return (
                <a
                  key={n.key}
                  href={`${window.location.pathname}?network=${n.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={`${active ? 'badge-network' : 'btn-ghost'} touch-target min-w-0 flex-1 justify-center sm:flex-none`}
                  style={{ textDecoration: 'none' }}
                  title={`Open ${n.label} (clears the current bill and contract)`}
                >
                  {n.label}
                </a>
              )
            })}
          </div>
        </div>
        <nav aria-label="Primary" className="mx-auto flex w-full max-w-5xl items-center gap-1 px-4 pb-2">
          <button
            type="button"
            className={`mobile-nav-link ${!viewingBill && tab === 'create' ? 'mobile-nav-link--active' : ''}`}
            onClick={goCreate}
          >
            <FilePlus2 size={15} aria-hidden="true" /> Create
          </button>
          <button
            type="button"
            className={`mobile-nav-link ${!viewingBill && tab === 'open' ? 'mobile-nav-link--active' : ''}`}
            onClick={() => {
              setTab('open')
              if (parsed.ok && viewingBill) go(buildContextSearch(parsed.context, null))
            }}
            disabled={!parsed.ok}
          >
            <Search size={15} aria-hidden="true" /> Open bill
          </button>
          <button type="button" className="mobile-nav-link" onClick={goDemo} disabled={!parsed.ok}>
            <Receipt size={15} aria-hidden="true" /> Demo receipt
          </button>
        </nav>
      </header>

      {context?.network.realFunds && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4">
          <div className="alert-warn" role="note">
            <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>{context.network.label} uses real USDC</strong> for both payments and network fees, and
              transactions cannot be undone. Check the network, contract and amount in your wallet before you sign.
              Each request carries a cap on the price per unit of gas; that is not a limit on the total fee.
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {!parsed.ok && <ContextProblemView problem={parsed.problem} />}
        {context && context.billId !== null && (
          <BillDetails
            key={`${context.deployment.address}:${context.billId}`}
            context={context}
            billId={context.billId}
            onCreateAnother={goCreate}
          />
        )}
        {context && context.billId === null && tab === 'create' && (
          <CreateBill context={context} onOpenBill={openBill} />
        )}
        {context && context.billId === null && tab === 'open' && (
          <OpenBill context={context} onOpenBill={openBill} />
        )}
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 sr-meta" style={{ color: 'var(--subdued)' }}>
        {context
          ? `${context.network.realFunds ? 'Arc Mainnet uses real USDC.' : 'Arc Testnet uses free test USDC.'} `
          : 'No network or contract was validated for this link, so no network-specific information is shown. '}
        Bill titles, addresses, amounts and payments are public onchain, so keep personal details out of titles.
        This app never asks for a private key or recovery phrase.
      </footer>
    </div>
  )
}
