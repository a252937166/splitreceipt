import { useEffect, useRef } from 'react'
import { getConnection, watchConnection } from '@wagmi/core'
import { useConfig } from 'wagmi'
import { activeNetwork } from './activeNetwork'
import { createActionScopeGuard, createActionScopeLifecycle, updateActionWalletIdentity, type ActionScopeState } from './actionScope'

/** URL navigation never switches a wallet; it invalidates old asynchronous work. */
export function useActionScope(walletChainId: number | undefined, walletAddress: string | undefined, walletConnectorUid: string | undefined) {
  const config = useConfig()
  const state = useRef<ActionScopeState>({
    active: true, generation: 0, walletChainId, walletAddress, walletConnectorUid,
    href: window.location.href,
  })
  updateActionWalletIdentity(state.current, { walletChainId, walletAddress, walletConnectorUid })
  const guard = useRef(createActionScopeGuard(activeNetwork, () => {
    const current = getConnection(config)
    return { ...state.current, href: window.location.href, walletChainId: current.chainId,
      walletAddress: current.address, walletConnectorUid: current.connector?.uid }
  }))
  useEffect(() => {
    state.current.active = true
    const syncWallet = () => {
      const current = getConnection(config)
      updateActionWalletIdentity(state.current, { walletChainId: current.chainId, walletAddress: current.address, walletConnectorUid: current.connector?.uid })
    }
    syncWallet()
    const unwatchWallet = watchConnection(config, { onChange: syncWallet })
    const lifecycle = createActionScopeLifecycle(() => state.current, () => window.location.reload())
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) lifecycle.restoreFromCache() }
    window.addEventListener('popstate', lifecycle.invalidate)
    window.addEventListener('pagehide', lifecycle.leave)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      lifecycle.leave()
      unwatchWallet()
      window.removeEventListener('popstate', lifecycle.invalidate)
      window.removeEventListener('pagehide', lifecycle.leave)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [config])
  return guard.current
}
