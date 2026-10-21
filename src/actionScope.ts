import { getWriteBlockReason, isCurrentLocationContext, type NetworkDeploymentContext } from './networkContext'

export interface ActionScopeState {
  active: boolean
  generation: number
  walletChainId: number | undefined
  walletAddress: string | undefined
  walletConnectorUid: string | undefined
  href: string
}
export interface ActionSnapshot {
  contextKey: string
  generation: number
  walletChainId: number | undefined
  walletAddress: string | undefined
  walletConnectorUid: string | undefined
}

/** Shared by create/pay handlers and their replacement/receipt callbacks. */
export function createActionScopeGuard(
  context: NetworkDeploymentContext,
  current: () => ActionScopeState,
) {
  const capture = (): ActionSnapshot => {
    const state = current()
    return {
      contextKey: context.contextKey, generation: state.generation,
      walletChainId: state.walletChainId,
      walletAddress: state.walletAddress?.toLowerCase(), walletConnectorUid: state.walletConnectorUid,
    }
  }
  const isCurrent = (snapshot: ActionSnapshot): boolean => {
    const state = current()
    return state.active && snapshot.contextKey === context.contextKey &&
      snapshot.generation === state.generation &&
      snapshot.walletChainId === state.walletChainId &&
      snapshot.walletAddress === state.walletAddress?.toLowerCase() &&
      snapshot.walletConnectorUid === state.walletConnectorUid &&
      isCurrentLocationContext(context, state.href)
  }
  return { capture, isCurrent }
}

export interface ScopeGuard {
  capture: () => ActionSnapshot
  isCurrent: (snapshot: ActionSnapshot) => boolean
}

/** Used immediately before both real write hooks; verification itself is readonly. */
export async function checkScopedWrite(
  context: NetworkDeploymentContext,
  guard: ScopeGuard,
  verify: () => Promise<import('./networkContext').DeploymentCheck>,
  walletChainId: number | undefined,
  walletAddress: string | undefined,
): Promise<{ snapshot: ActionSnapshot; blocked: string | null }> {
  const snapshot = guard.capture()
  if (!guard.isCurrent(snapshot)) return { snapshot, blocked: 'This page context has changed. Reload before continuing.' }
  const check = await verify()
  if (!guard.isCurrent(snapshot)) return { snapshot, blocked: 'Wallet or page context changed. No transaction was requested.' }
  return { snapshot, blocked: getWriteBlockReason(context, check, walletChainId, walletAddress) }
}

/** BFCache restores old React refs, so reload instead of reviving pending requests. */
export function createActionScopeLifecycle(current: () => ActionScopeState, reload: () => void) {
  const invalidate = () => { current().generation++ }
  const leave = () => { current().active = false; invalidate() }
  const restoreFromCache = () => {
    leave()
    reload()
  }
  return { invalidate, leave, restoreFromCache }
}


/** Keep all wallet changes irreversible for an already captured asynchronous action. */
export function updateActionWalletIdentity(
  state: ActionScopeState,
  next: Pick<ActionScopeState, 'walletChainId' | 'walletAddress' | 'walletConnectorUid'>,
) {
  if (state.walletChainId !== next.walletChainId ||
    state.walletAddress?.toLowerCase() !== next.walletAddress?.toLowerCase() ||
    state.walletConnectorUid !== next.walletConnectorUid) state.generation++
  state.walletChainId = next.walletChainId
  state.walletAddress = next.walletAddress
  state.walletConnectorUid = next.walletConnectorUid
}
