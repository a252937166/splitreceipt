import { resolveNetworkContext, type PublicNetworkEnv } from './networkContext'

/** Network identity is fixed for this page lifetime; switching networks requires a full navigation. */
const publicEnv = (import.meta as ImportMeta & { env?: PublicNetworkEnv }).env ?? {}
const href = typeof window === 'undefined' ? '' : window.location.href
export const activeNetwork = resolveNetworkContext(href, publicEnv)
