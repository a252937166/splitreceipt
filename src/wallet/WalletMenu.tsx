import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, LogOut, Wallet, X } from 'lucide-react'
import { FOCUSABLE_SELECTOR, cycleFocusIndex } from '../a11y.ts'
import { shortAddr } from '../components/ui.tsx'
import { useWalletSession } from './WalletSession.tsx'

/**
 * Wallet chooser / account dialog.
 *  - Opens with focus on its first control; Escape closes it and returns focus
 *    to the button that opened it.
 *  - Tab and Shift+Tab cycle inside the dialog; Arrow keys move between controls.
 *  - A pointer press outside (mouse, pen or touch) closes it without moving focus.
 *  - Every control is at least 44px high and wide (`touch-target`).
 */
export default function WalletMenu() {
  const w = useWalletSession()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const dialogId = useId()

  const focusables = useCallback((): HTMLElement[] => {
    return dialog.current ? Array.from(dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
  }, [])

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) window.setTimeout(() => trigger.current?.focus(), 0)
  }, [])

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => focusables()[0]?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open, focusables])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close(true)
      return
    }
    const items = focusables()
    const current = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Tab') {
      e.preventDefault()
      items[cycleFocusIndex(items.length, current, e.shiftKey)]?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      items[cycleFocusIndex(items.length, current, e.key === 'ArrowUp')]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  const { snapshot, readiness } = w
  const wrongChain = snapshot.connected && snapshot.chainId !== w.network.chainId

  // De-duplicate by id: discovery can report the same wallet more than once.
  const seen = new Set<string>()
  const wallets = w.connectors.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        className="btn-wallet touch-target max-w-full"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Wallet size={15} aria-hidden="true" />
        {snapshot.connected && snapshot.address ? (
          <span className="sr-mono">{shortAddr(snapshot.address)}</span>
        ) : (
          'Connect wallet'
        )}
        {wrongChain && (
          // The wrapper carries the responsive display; a component class like .badge-draft would override `hidden`.
          <span className="hidden sm:inline-flex">
            <span className="badge-draft">Wrong network</span>
          </span>
        )}
        {wrongChain && (
          <span
            className="sm:hidden"
            role="img"
            aria-label="Wrong network"
            style={{ width: 8, height: 8, borderRadius: 9999, background: 'var(--danger)', flexShrink: 0 }}
          />
        )}
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={dialog}
          id={dialogId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={onKeyDown}
          className="doc-surface absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] p-4"
          style={{ boxShadow: '0 12px 32px rgba(21,42,36,0.14)', maxHeight: 'calc(100dvh - 5rem)', overflowY: 'auto' }}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 id={titleId} className="sr-heading-sm" style={{ margin: 0 }}>
              {snapshot.connected ? 'Wallet' : 'Choose a wallet'}
            </h2>
            <button type="button" className="btn-ghost touch-target" aria-label="Close wallet dialog" onClick={() => close(true)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {!snapshot.connected && (
            <>
              <p className="sr-small" style={{ color: 'var(--secondary)', margin: '4px 0 12px' }}>
                Connecting only shares your address. You approve every payment in your wallet.
              </p>
              {wallets.length === 0 ? (
                <div className="alert-info">
                  No browser wallet was detected. Install an EVM wallet extension, then reload this page.
                </div>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {wallets.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="btn-wallet touch-target w-full justify-start"
                        style={{ borderRadius: 8 }}
                        disabled={w.busy}
                        onClick={() => {
                          void w.connectWith(c).then(() => close(true))
                        }}
                      >
                        {c.icon ? <img src={c.icon} alt="" width={20} height={20} /> : <Wallet size={16} aria-hidden="true" />}
                        {c.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {snapshot.connected && snapshot.address && (
            <>
              <p className="sr-meta" style={{ color: 'var(--subdued)', marginTop: 8 }}>{w.connectorName ?? 'Wallet'}</p>
              <p className="sr-mono sr-small" style={{ wordBreak: 'break-all', marginBottom: 12 }}>{snapshot.address}</p>

              {!readiness.ready && readiness.need === 'acknowledge' && (
                <>
                  <div className="alert-warn" style={{ marginBottom: 12 }}>
                    <span>
                      This wallet account differs from the one you chose. Confirm you want to use it. This is not a
                      signature.
                    </span>
                  </div>
                  <button type="button" className="btn-primary" style={{ marginBottom: 8 }} onClick={w.acknowledge}>
                    Use this wallet
                  </button>
                </>
              )}
              {wrongChain && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginBottom: 8 }}
                  disabled={w.busy}
                  onClick={() => void w.switchToNetwork()}
                >
                  Switch to {w.network.label}
                </button>
              )}
              <button
                type="button"
                className="btn-ghost touch-target w-full"
                onClick={() => {
                  w.disconnect()
                  close(true)
                }}
              >
                <LogOut size={14} aria-hidden="true" />
                Disconnect
              </button>
            </>
          )}

          {w.error && (
            <div className="alert-danger" style={{ marginTop: 12 }} role="alert">
              {w.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
