import { useCallback, useEffect, useId, useRef, useState, type PropsWithChildren } from 'react'
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { arcTestnet } from './config'

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/rejected|denied|4001/i.test(message)) return 'Wallet request cancelled. You can try again.'
  if (/provider.*not.*found|not.*installed/i.test(message)) {
    return 'No browser wallet was found. Install an Ethereum-compatible wallet, then reload this page.'
  }
  return message.split('\n')[0] || 'The wallet could not connect. Please try again.'
}

export function networkSwitchErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: unknown } | null)?.code
  if (code === 4001 || /rejected|denied|4001/i.test(message)) {
    return 'Network switch cancelled. You can try again.'
  }
  if (code === 4902 || /unsupported chain|not supported|unrecognized chain|4902/i.test(message)) {
    return 'Your wallet could not switch to Arc Testnet. Add Arc Testnet in your wallet, then try again.'
  }
  return 'Could not switch to Arc Testnet. Check your wallet and try again.'
}

/** Wallet state is provided by WagmiProvider; no account service or API key is used. */
export function WalletProvider({ children }: PropsWithChildren) {
  return <>{children}</>
}

export function WalletButton() {
  const { address, isConnected, chainId } = useConnection()
  const connectors = useConnectors()
  const { connectAsync, isPending: connecting } = useConnect()
  const { disconnectAsync, isPending: disconnecting } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const dialogId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const pending = connecting || disconnecting || switching
  const close = useCallback(() => { setOpen(false); setError('') }, [])

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
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      }
      if (event.key !== 'Tab') return
      const controls = getControls()
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const active = document.activeElement
      const outsideControls = active === dialog || !dialog.contains(active)
      if (event.shiftKey && (active === first || outsideControls)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outsideControls)) {
        event.preventDefault()
        first.focus()
      }
    }
    const handleFocusIn = (event: FocusEvent) => {
      if (!dialog.contains(event.target as Node)) focusFirst()
    }
    focusFirst()
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [open, close])

  return <>
    <button type="button" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
      ref={triggerRef} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
      onClick={() => { setError(''); setOpen(true) }}>
      {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect wallet'}
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      onClick={event => { if (event.target === event.currentTarget) close() }}>
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
        id={dialogId} ref={dialogRef} tabIndex={-1}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-bold">{isConnected ? 'Your wallet' : 'Connect a browser wallet'}</h2>
          <button type="button" onClick={close} aria-label="Close wallet dialog"
            className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <p id={descriptionId} className="mb-4 text-sm text-slate-500">Arc Testnet · Test USDC only</p>
        {pending && <p role="status" className="mb-4 text-sm text-slate-600">
          Check your wallet to finish or cancel the pending request.
        </p>}
        {isConnected ? <div className="space-y-3">
          <p className="break-all rounded-lg bg-slate-50 p-3 font-mono text-xs">{address}</p>
          {chainId !== arcTestnet.id && <button type="button" disabled={pending}
            className="w-full rounded-xl bg-indigo-600 p-3 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => { setError(''); void switchChainAsync({ chainId: arcTestnet.id }).catch(e => setError(errorMessage(e))) }}>
            {switching ? 'Check your wallet…' : 'Switch to Arc Testnet'}
          </button>}
          <button type="button" disabled={pending}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold disabled:opacity-50"
            onClick={() => { setError(''); void disconnectAsync().then(close).catch(e => setError(errorMessage(e))) }}>
            Disconnect
          </button>
        </div> : <div className="space-y-2">
          {connectors.map(connector => <button key={connector.uid} type="button" disabled={pending}
            className="w-full rounded-xl border border-slate-200 p-3 text-left text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            onClick={() => {
              setError('')
              void connectAsync({ connector, chainId: arcTestnet.id }).then(() => setOpen(false)).catch(e => setError(errorMessage(e)))
            }}>
            {connecting ? 'Check your wallet…' : connector.name === 'Injected' ? 'Browser wallet' : connector.name}
          </button>)}
          {connectors.length === 0 && <p className="text-sm text-slate-600">Install an Ethereum-compatible browser wallet, then reload this page.</p>}
        </div>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </section>
    </div>}
  </>
}
