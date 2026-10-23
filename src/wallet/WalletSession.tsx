import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useConfig, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import type { NetworkContext } from '../networks.ts'
import { appEpochs, type EpochSources } from '../epoch.ts'
import {
  DISCONNECTED,
  sessionKey,
  walletReadiness,
  type Eip1193Provider,
  type Readiness,
  type WalletSnapshot,
} from '../writeGuard.ts'

type Connector = ReturnType<typeof useConnectors>[number]

/** What a write needs from the wallet layer, read at the moment of the click. */
export interface WriteSession {
  connector: Connector | null
  /** Provider object captured when the user acknowledged this session. */
  acknowledgedProvider: Eip1193Provider | null
}

interface WalletSessionValue {
  /** The network of the current page; the wallet must match it before any write. */
  network: NetworkContext
  epochs: EpochSources
  snapshot: WalletSnapshot
  /** Live accessor for async code; always the latest snapshot. */
  getSnapshot: () => WalletSnapshot
  getWriteSession: () => WriteSession
  connectorName: string | null
  acknowledgedKey: string | null
  readiness: Readiness
  connectors: readonly Connector[]
  connectWith: (connector: Connector) => Promise<void>
  acknowledge: () => void
  disconnect: () => void
  switchToNetwork: () => Promise<void>
  busy: boolean
  error: string | null
  clearError: () => void
}

const Ctx = createContext<WalletSessionValue | null>(null)

function friendlyError(err: unknown): string {
  const msg = (err as { shortMessage?: string; message?: string })?.shortMessage ?? (err as Error)?.message ?? ''
  const lower = msg.toLowerCase()
  if (lower.includes('rejected') || lower.includes('denied') || lower.includes('cancel')) {
    return 'The request was cancelled in your wallet.'
  }
  if (lower.includes('already pending') || lower.includes('-32002')) {
    return 'Your wallet already has a pending request. Open it to continue.'
  }
  return 'Your wallet could not complete that request. Try again.'
}

interface EventedProvider {
  on?: (event: string, handler: () => void) => void
  removeListener?: (event: string, handler: () => void) => void
}
const PROVIDER_EVENTS = ['accountsChanged', 'chainChanged', 'disconnect', 'connect'] as const

export function WalletSessionProvider({
  network,
  children,
  epochs = appEpochs,
}: {
  network: NetworkContext
  children: ReactNode
  epochs?: EpochSources
}) {
  const config = useConfig()
  const connection = useConnection()
  const connectorList = useConnectors()
  const { connectAsync } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()

  const [acknowledgedKey, setAcknowledgedKey] = useState<string | null>(null)
  const [pendingAck, setPendingAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ackedProvider = useRef<Eip1193Provider | null>(null)

  const snapshot = useMemo<WalletSnapshot>(() => {
    if (connection.status !== 'connected' || !connection.address) return DISCONNECTED
    return {
      connected: true,
      address: connection.address.toLowerCase(),
      chainId: connection.chainId ?? null,
      connectorId: connection.connector?.id ?? null,
    }
  }, [connection.status, connection.address, connection.chainId, connection.connector?.id])

  const live = useRef(snapshot)
  const liveConnector = useRef<Connector | null>(connection.connector ?? null)
  useEffect(() => {
    live.current = snapshot
    liveConnector.current = (connection.connector as Connector | undefined) ?? null
  }, [snapshot, connection.connector])
  const getSnapshot = useCallback(() => live.current, [])
  const getWriteSession = useCallback(
    (): WriteSession => ({ connector: liveConnector.current, acknowledgedProvider: ackedProvider.current }),
    [],
  )

  const key = sessionKey(snapshot.connectorId, snapshot.address)
  const keyRef = useRef(key)
  useEffect(() => {
    keyRef.current = key
  }, [key])

  // Every wagmi connection change bumps the wallet epoch synchronously, so a change
  // that goes A -> B -> A between two awaits is still seen by pending requests.
  useEffect(() => {
    return config.subscribe(
      (s) => {
        const c = s.current ? s.connections.get(s.current) : undefined
        return `${s.status}|${s.current ?? ''}|${c?.accounts.join(',') ?? ''}|${c?.chainId ?? ''}|${s.chainId}`
      },
      () => {
        epochs.wallet.bump()
      },
    )
  }, [config, epochs])

  // The chosen provider talks to us directly too: account/chain/disconnect events bump the epoch.
  useEffect(() => {
    const connector = connection.connector
    if (connection.status !== 'connected' || !connector) return
    let alive = true
    let detach: () => void = () => {}
    void connector.getProvider().then((p) => {
      if (!alive) return
      const prov = p as EventedProvider
      const bump = () => {
        epochs.wallet.bump()
      }
      for (const ev of PROVIDER_EVENTS) prov.on?.(ev, bump)
      detach = () => {
        for (const ev of PROVIDER_EVENTS) prov.removeListener?.(ev, bump)
      }
    })
    return () => {
      alive = false
      detach()
    }
  }, [connection.connector, connection.status, epochs])

  /** Remember which account AND which provider object the user confirmed. */
  const acknowledgeCurrent = useCallback(async () => {
    const connector = liveConnector.current
    const k = keyRef.current
    if (!connector || !k) return
    try {
      const p = (await connector.getProvider()) as Eip1193Provider
      if (keyRef.current !== k) return // the account changed while we asked: do not acknowledge it
      ackedProvider.current = p
      setAcknowledgedKey(k)
    } catch {
      setError('Could not reach your wallet. Try choosing it again.')
    }
  }, [])

  // A wallet chosen in the menu is acknowledged as chosen. Any later account or
  // provider change makes the key differ and needs an explicit confirm.
  useEffect(() => {
    if (pendingAck && key) {
      setPendingAck(false)
      void acknowledgeCurrent()
    }
  }, [pendingAck, key, acknowledgeCurrent])

  useEffect(() => {
    if (!snapshot.connected) {
      setAcknowledgedKey(null)
      ackedProvider.current = null
    }
  }, [snapshot.connected])

  const connectWith = useCallback(
    async (connector: Connector) => {
      setError(null)
      setBusy(true)
      setPendingAck(true)
      try {
        await connectAsync({ connector })
      } catch (err) {
        setPendingAck(false)
        setError(friendlyError(err))
      } finally {
        setBusy(false)
      }
    },
    [connectAsync],
  )

  const acknowledge = useCallback(() => {
    void acknowledgeCurrent()
  }, [acknowledgeCurrent])

  const disconnect = useCallback(() => {
    epochs.wallet.bump()
    wagmiDisconnect()
    setAcknowledgedKey(null)
    ackedProvider.current = null
    setPendingAck(false)
  }, [wagmiDisconnect, epochs])

  const switchToNetwork = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      await switchChainAsync({ chainId: network.chainId as never })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }, [switchChainAsync, network.chainId])

  const value: WalletSessionValue = {
    network,
    epochs,
    snapshot,
    getSnapshot,
    getWriteSession,
    connectorName: connection.connector?.name ?? null,
    acknowledgedKey,
    readiness: walletReadiness(snapshot, network.chainId, acknowledgedKey, network.label),
    connectors: connectorList,
    connectWith,
    acknowledge,
    disconnect,
    switchToNetwork,
    busy,
    error,
    clearError: () => setError(null),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWalletSession(): WalletSessionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWalletSession must be used inside WalletSessionProvider')
  return v
}
