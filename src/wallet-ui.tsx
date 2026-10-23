import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type PropsWithChildren } from 'react'
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain, useConfig } from 'wagmi'
import { activeNetwork } from './activeNetwork'
import { walletRequestErrorMessage } from './walletPolicy'
import { createExplicitWalletSession, watchExplicitWalletSession, type ExplicitWalletSession } from './walletSelection'

export function networkSwitchErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: unknown } | null)?.code
  if (code === 4001 || /rejected|denied|4001/i.test(message)) {
    return 'Network switch cancelled. You can try again.'
  }
  if (code === 4902 || /unsupported chain|not supported|unrecognized chain|4902/i.test(message)) {
    return `Your wallet could not switch to ${activeNetwork.name}. Add ${activeNetwork.name} in your wallet, then try again.`
  }
  return `Could not switch to ${activeNetwork.name}. Check your wallet and try again.`
}

const ExplicitWalletContext = createContext<{ session: ExplicitWalletSession; refresh: () => void } | null>(null)

/** Wallet choice lasts only for this page; external connection events cannot authorize writes. */
export function WalletProvider({ children }: PropsWithChildren) {
  const config = useConfig()
  useConnection()
  const [session] = useState(() => createExplicitWalletSession(config))
  const [, setRevision] = useState(0)
  useEffect(() => watchExplicitWalletSession(config, session), [config, session])
  // Recreate context on actual wallet changes so disabled buttons update as well.
  return <ExplicitWalletContext.Provider value={{ session, refresh: () => setRevision(n => n + 1) }}>{children}</ExplicitWalletContext.Provider>
}

export function useExplicitWalletSelection() {
  const context = useContext(ExplicitWalletContext)
  if (!context) throw new Error('WalletProvider is required.')
  return {
    ...context.session,
    select: (...args: Parameters<ExplicitWalletSession['select']>) => { const selected = context.session.select(...args); context.refresh(); return selected },
    clear: () => { context.session.clear(); context.refresh() },
  }
}

export function WalletButton() {
  const { address, isConnected, chainId, chain: walletChain, connector: connectedConnector } = useConnection()
  const connectors = useConnectors()
  const selection = useExplicitWalletSelection()
  const explicitlySelected = selection.isSelected()
  const { connectAsync, isPending: connecting } = useConnect()
  const { disconnectAsync, isPending: disconnecting } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [requestedWallet, setRequestedWallet] = useState('')
  const connectionLock = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const dialogId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const pending = connecting || disconnecting || switching
  const pendingWallet = requestedWallet || connectedConnector?.name || 'your selected wallet'
  const close = useCallback(() => { setOpen(false); setError('') }, [])

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const dialog = dialogRef.current
    if (!dialog) return
    const document = dialog.ownerDocument
    const getControls = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.getClientRects().length > 0)
    const focusFirst = () => (getControls()[0] ?? dialog).focus({ preventScroll: true })
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
      if (event.key !== 'Tab') return
      const controls = getControls()
      const first = controls[0]; const last = controls[controls.length - 1]
      if (!first || !last) { event.preventDefault(); dialog.focus(); return }
      const active = document.activeElement
      const outsideControls = active === dialog || !dialog.contains(active)
      if (event.shiftKey && (active === first || outsideControls)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (active === last || outsideControls)) { event.preventDefault(); first.focus() }
    }
    const handleFocusIn = (event: FocusEvent) => { if (!dialog.contains(event.target as Node)) focusFirst() }
    focusFirst()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [open, close])

  const label = isConnected && address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : connecting && requestedWallet ? `Open ${requestedWallet}` : 'Connect wallet'

  return <>
    <button
      type="button"
      ref={triggerRef}
      className="btn-wallet"
      aria-label={isConnected && connectedConnector ? `Wallet: ${connectedConnector.name}, ${label}` : label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? dialogId : undefined}
      onClick={() => { setError(''); setOpen(true) }}
    >
      {isConnected && (
        <span
          style={{
            width: '8px', height: '8px', borderRadius: '9999px',
            background: chainId === activeNetwork.chainId ? 'var(--success)' : 'var(--warn-ink)',
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      <span className="flex flex-col items-start leading-tight min-w-0">
        {isConnected && connectedConnector && <span className="text-[10px] max-w-[110px] truncate">{connectedConnector.name}</span>}
        <span className={isConnected ? 'sr-mono' : ''}>{label}</span>
      </span>
    </button>

    {open && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.65)', whiteSpace: 'normal' }}
        onClick={event => { if (event.target === event.currentTarget) close() }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          id={dialogId}
          ref={dialogRef}
          tabIndex={-1}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '380px',
            minWidth: 0,
            whiteSpace: 'normal',
            maxHeight: 'calc(100dvh - 2rem)',
            overflowY: 'auto',
            color: 'var(--ink)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          }}
        >
          {/* Dialog header */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 id={titleId} className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: "'Iowan Old Style', Georgia, serif" }}>
              {isConnected ? 'Your wallet' : 'Connect a browser wallet'}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close wallet dialog"
              style={{
                minHeight: '44px', minWidth: '44px', borderRadius: '8px',
                background: 'none', border: 'none', color: 'var(--muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px',
              }}
            >
              ✕
            </button>
          </div>

          <p id={descriptionId} className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            {activeNetwork.isTestnet ? 'Arc Testnet · Test USDC only' : activeNetwork.mainnetWritesEnabled ? 'Arc Mainnet · Real USDC · Wallet confirmation required' : 'Arc Mainnet · Real USDC · Transactions disabled'}
          </p>
          {!isConnected && <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Select your wallet explicitly after reloading.</p>}

          {pending && (
            <p role="status" className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
              Open {pendingWallet} to finish or cancel the pending request.
            </p>
          )}

          {isConnected ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Connected with {connectedConnector?.name ?? 'your selected wallet'}</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Wallet network: {walletChain?.name ?? 'Unknown network'} (chain {chainId ?? 'unknown'})</p>
              {!explicitlySelected && (
                <div className="alert-warn" role="alert">
                  <span>The connected wallet changed or has not been confirmed for this page. Confirm the wallet below before creating a bill or paying.</span>
                </div>
              )}
              <button type="button" disabled={pending || !connectedConnector || explicitlySelected} className="btn-primary"
                onClick={() => {
                  if (connectedConnector && address && chainId !== undefined && selection.select(connectedConnector.uid, { account: address, chainId })) setError('')
                  else setError('The wallet or account changed. Review the current wallet details and try again.')
                }}>
                {explicitlySelected ? 'Wallet selected for this page' : 'Use this wallet'}
              </button>
              {/* Full address */}
              <p
                className="break-all rounded-xl p-3 sr-mono text-xs"
                style={{ background: 'var(--surface-raised)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
              >
                {address}
              </p>

              {/* Wrong chain prompt */}
              {chainId !== activeNetwork.chainId && (
                <button
                  type="button"
                  disabled={pending}
                  className="btn-primary"
                  style={{ fontSize: '14px', minHeight: '48px' }}
                  onClick={() => {
                    setError('')
                    void switchChainAsync({ chainId: activeNetwork.chainId }).catch(e => setError(networkSwitchErrorMessage(e)))
                  }}
                >
                  {switching ? 'Check your wallet…' : `Switch to ${activeNetwork.name}`}
                </button>
              )}

              <button
                type="button"
                disabled={pending}
                className="btn-ghost"
                style={{ width: '100%', minHeight: '44px' }}
                onClick={() => { selection.clear(); setError(''); void disconnectAsync().then(close).catch(e => setError(walletRequestErrorMessage(e, connectedConnector?.name))) }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {connectors.map(connector => (
                <button
                  key={connector.uid}
                  type="button"
                  disabled={pending}
                  className="btn-ghost"
                  style={{ display: 'flex', width: '100%', minHeight: '48px', justifyContent: 'flex-start', padding: '12px 16px' }}
                  onClick={() => {
                    if (connectionLock.current || pending) return
                    connectionLock.current = true
                    setError('')
                    setRequestedWallet(connector.name)
                    void connectAsync({ connector })
                      .then(result => {
                        const account = result.accounts[0]
                        if (selection.select(connector.uid, { account, chainId: result.chainId })) setOpen(false)
                        else setError('The connected wallet changed. Check the wallet shown here and select it again.')
                      })
                      .catch(e => setError(walletRequestErrorMessage(e, connector.name)))
                      .finally(() => { connectionLock.current = false; setRequestedWallet('') })
                  }}
                >
                  {connecting && requestedWallet === connector.name ? `Open ${connector.name}…` : connector.name}
                </button>
              ))}
              {connectors.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  No compatible wallet was found. Open or enable your wallet, then reload this page.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl p-3 text-sm"
              style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}>
              {error}
            </p>
          )}
        </section>
      </div>
    )}
  </>
}
