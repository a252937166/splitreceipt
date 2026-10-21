import { getConnection, watchConnection, type Config, type Connector } from '@wagmi/core'
import type { Address } from 'viem'

export interface ExplicitWalletSnapshot {
  readonly connector: Connector
  readonly connectorUid: string
  readonly account: Address
  readonly chainId: number
  readonly generation: number
}

/** A page-local choice, separate from whatever connection a wallet announces. */
export function createExplicitWalletSession(config: Config) {
  let selectedUid: string | null = null
  let generation = 0
  const identity = () => {
    const value = getConnection(config)
    return `${value.status}:${value.connector?.uid ?? ''}:${value.address?.toLowerCase() ?? ''}:${value.chainId ?? ''}`
  }
  let observedIdentity = identity()
  const observe = () => {
    const next = identity()
    if (next !== observedIdentity) {
      observedIdentity = next; generation++
      selectedUid = null
    }
  }
  const isSelected = () => {
    observe()
    const current = getConnection(config)
    return current.isConnected && Boolean(selectedUid && current.connector?.uid === selectedUid)
  }
  const select = (uid: string, expected?: { account: Address; chainId: number }) => {
    observe()
    const current = getConnection(config)
    if (!current.isConnected || current.connector?.uid !== uid) return false
    if (expected && (current.address?.toLowerCase() !== expected.account.toLowerCase() || current.chainId !== expected.chainId)) return false
    selectedUid = uid
    generation++
    return true
  }
  const clear = () => { selectedUid = null; generation++; observe() }
  const capture = (): ExplicitWalletSnapshot | null => {
    if (!isSelected()) return null
    const current = getConnection(config)
    if (!current.connector || !current.address || current.chainId === undefined) return null
    return { connector: current.connector, connectorUid: current.connector.uid,
      account: current.address, chainId: current.chainId, generation }
  }
  const isCurrent = (snapshot: ExplicitWalletSnapshot | null) => {
    if (!snapshot || !isSelected()) return false
    const current = getConnection(config)
    return generation === snapshot.generation && current.connector?.uid === snapshot.connectorUid &&
      current.address?.toLowerCase() === snapshot.account.toLowerCase() && current.chainId === snapshot.chainId
  }
  return { observe, select, clear, capture, isCurrent, isSelected }
}

export type ExplicitWalletSession = ReturnType<typeof createExplicitWalletSession>

/** Observe every synchronous store transition, including A → B → A between renders. */
export function watchExplicitWalletSession(config: Config, session: ExplicitWalletSession) {
  return watchConnection(config, { onChange: () => session.observe() })
}

/** Both write handlers use this gate around their existing readonly deployment/scope check. */
export async function checkExplicitWalletWrite<T extends { blocked: string | null }>(
  session: ExplicitWalletSession,
  snapshot: ExplicitWalletSnapshot,
  verify: () => Promise<T>,
): Promise<{ blocked: string | null; verification: T | null }> {
  const changed = 'The connected wallet changed. Select and confirm your wallet again before continuing.'
  if (!session.isCurrent(snapshot)) return { blocked: changed, verification: null }
  const verification = await verify()
  if (!session.isCurrent(snapshot)) return { blocked: changed, verification }
  return { blocked: verification.blocked, verification }
}

/** A click may use a stale React render; never authorize a wallet the user was not shown. */
export function walletSnapshotMatchesDisplay(
  snapshot: ExplicitWalletSnapshot,
  displayed: { account: string | undefined; chainId: number | undefined; connectorUid: string | undefined },
) {
  return snapshot.account.toLowerCase() === displayed.account?.toLowerCase() &&
    snapshot.chainId === displayed.chainId && snapshot.connectorUid === displayed.connectorUid
}
