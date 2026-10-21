import type { CreateConnectorFn } from '@wagmi/core'

/** Use only individually announced wallets; never the shared legacy injection slot. */
export const EXPLICIT_WALLET_CONFIG = {
  connectors: [] as CreateConnectorFn[],
  multiInjectedProviderDiscovery: true,
  syncConnectedChain: false,
} as const

/** Do not restore persisted connections during hydration. Wallet-originated events remain separate. */
export const WALLET_RECONNECT_ON_MOUNT = false as const

/** Walk wrapped RPC causes without exposing provider internals or suggesting another wallet. */
export function walletRequestErrorMessage(error: unknown, walletName = 'Your wallet'): string {
  let current = error
  let message = ''
  const codes = new Set<number>()
  const seen = new Set<unknown>()
  for (let depth = 0; depth < 8 && current && !seen.has(current); depth++) {
    seen.add(current)
    if (typeof current === 'object') {
      const wrapped = current as { code?: unknown; message?: unknown; cause?: unknown }
      if (typeof wrapped.code === 'number') codes.add(wrapped.code)
      if (typeof wrapped.message === 'string') message += ` ${wrapped.message}`
      current = wrapped.cause
    } else { message += ` ${String(current)}`; break }
  }
  if (codes.has(-32002) || /already.*pending|request.*pending|resource.*unavailable/i.test(message)) {
    return `${walletName} already has a pending request. Open ${walletName} to finish or cancel it, then try again.`
  }
  if (codes.has(4001) || /rejected|denied|4001/i.test(message)) return `${walletName} request cancelled. You can try again.`
  if (/provider.*not.*found|not.*installed/i.test(message)) {
    return `${walletName} is unavailable. Open or enable that wallet, then reload this page.`
  }
  return `Could not complete the request in ${walletName}. Check that wallet and try again.`
}
