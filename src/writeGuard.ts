/**
 * Fail-closed checks that run before any wallet write.
 *
 * A wallet request is made only when ALL hold:
 *  1. a wallet is connected, its displayed session was acknowledged, and its
 *     cached chain is the page's network;
 *  2. the read-only RPC reports the same chain and the contract runtime hash
 *     equals the reviewed hash for that deployment;
 *  3. the chosen provider is the very object that was acknowledged, and a FRESH
 *     `eth_chainId` and `eth_accounts` request to it returns the page's chain
 *     and the selected account (wagmi's cached state alone is not trusted);
 *  4. after EVERY await, and once more synchronously before the wallet request,
 *     the request token is still live. The token is epoch based, so a change
 *     that goes A -> B -> A while a call was pending is still detected.
 */
import { keccak256, type PublicClient } from 'viem'
import type { NetworkContext, ReviewedDeployment } from './networks.ts'
import type { LiveCheck } from './epoch.ts'

export interface WalletSnapshot {
  connected: boolean
  address: string | null
  chainId: number | null
  connectorId: string | null
}

export const DISCONNECTED: WalletSnapshot = { connected: false, address: null, chainId: null, connectorId: null }

/** Identity of a wallet session: which provider, which account. */
export function sessionKey(connectorId: string | null, address: string | null): string | null {
  if (!connectorId || !address) return null
  return `${connectorId}:${address.toLowerCase()}`
}

export type Readiness =
  | { ready: true }
  | { ready: false; need: 'connect' | 'acknowledge' | 'switch-network'; message: string }

export function walletReadiness(
  wallet: WalletSnapshot,
  networkChainId: number,
  acknowledgedKey: string | null,
  networkLabel = 'the page network',
): Readiness {
  if (!wallet.connected || !wallet.address) {
    return { ready: false, need: 'connect', message: 'Connect a wallet to continue.' }
  }
  const key = sessionKey(wallet.connectorId, wallet.address)
  if (!key || key !== acknowledgedKey) {
    return { ready: false, need: 'acknowledge', message: 'Confirm that this is the wallet you want to use.' }
  }
  if (wallet.chainId !== networkChainId) {
    return { ready: false, need: 'switch-network', message: `Switch your wallet to ${networkLabel}.` }
  }
  return { ready: true }
}

export function sameWalletSession(a: WalletSnapshot, b: WalletSnapshot): boolean {
  return (
    a.connected === b.connected &&
    (a.address ?? '').toLowerCase() === (b.address ?? '').toLowerCase() &&
    a.chainId === b.chainId &&
    a.connectorId === b.connectorId
  )
}

export type RuntimeCheck =
  | { ok: true; codeHash: `0x${string}` }
  | { ok: false; reason: string; transient: boolean }

export async function verifyRuntime(
  client: Pick<PublicClient, 'getChainId' | 'getCode'>,
  network: NetworkContext,
  deployment: ReviewedDeployment,
): Promise<RuntimeCheck> {
  let chain: number
  let code: `0x${string}` | undefined
  try {
    chain = await client.getChainId()
    code = await client.getCode({ address: deployment.address })
  } catch {
    return { ok: false, reason: 'Could not reach the network to verify the contract.', transient: true }
  }
  if (chain !== network.chainId) {
    return { ok: false, reason: `The network answered with chain ${chain}, not ${network.chainId}.`, transient: false }
  }
  if (!code || code === '0x') {
    return { ok: false, reason: 'No contract code was found at the reviewed address.', transient: false }
  }
  const codeHash = keccak256(code)
  if (codeHash.toLowerCase() !== deployment.runtimeCodeHash.toLowerCase()) {
    return { ok: false, reason: 'The deployed code is not the reviewed SplitReceipt runtime.', transient: false }
  }
  return { ok: true, codeHash }
}

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

/** `eth_chainId` answers a 0x-prefixed hex quantity. Anything else is rejected. */
export function parseChainId(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^0x[0-9a-fA-F]{1,15}$/.test(raw)) return null
  return Number.parseInt(raw, 16)
}

export const STALE_REASON = 'Your wallet or this page changed while checking. Nothing was sent.'

export type GuardedWrite<T> = { ok: true; value: T } | { ok: false; reason: string }

/**
 * Runs the checks above and, only if they all pass, calls `send` synchronously
 * (no await between the final liveness check and the wallet request).
 */
export async function guardedWrite<T>(args: {
  client: Pick<PublicClient, 'getChainId' | 'getCode'>
  network: NetworkContext
  deployment: ReviewedDeployment
  /** Snapshot the user was looking at when they pressed the button. */
  wallet: WalletSnapshot
  acknowledgedKey: string | null
  /** Provider object captured when this wallet session was acknowledged. */
  acknowledgedProvider: Eip1193Provider | null
  /** Asks the chosen connector for its provider again. */
  getProvider: () => Promise<unknown>
  token: LiveCheck
  /** Live accessor for the wallet snapshot. */
  getWallet: () => WalletSnapshot
  /** Receives the verified provider object. It must send through a boundary guard (see walletSend.ts). */
  send: (provider: Eip1193Provider) => Promise<T>
}): Promise<GuardedWrite<T>> {
  const stale: GuardedWrite<T> = { ok: false, reason: STALE_REASON }
  const live = () => args.token.isLive() && sameWalletSession(args.getWallet(), args.wallet)

  if (!live()) return stale
  const readiness = walletReadiness(args.wallet, args.network.chainId, args.acknowledgedKey, args.network.label)
  if (!readiness.ready) return { ok: false, reason: readiness.message }
  if (!args.acknowledgedProvider) {
    return { ok: false, reason: 'Confirm this wallet again with "Use this wallet" before continuing.' }
  }

  const runtime = await verifyRuntime(args.client, args.network, args.deployment)
  if (!live()) return stale
  if (!runtime.ok) return { ok: false, reason: runtime.reason }

  let provider: unknown
  try {
    provider = await args.getProvider()
  } catch {
    return live() ? { ok: false, reason: 'Could not reach your wallet. Nothing was sent.' } : stale
  }
  if (!live()) return stale
  if (provider !== args.acknowledgedProvider) {
    return { ok: false, reason: 'The wallet provider changed. Choose your wallet again. Nothing was sent.' }
  }
  const eip = provider as Eip1193Provider
  if (typeof eip.request !== 'function') {
    return { ok: false, reason: 'The selected wallet does not support requests. Nothing was sent.' }
  }

  let chainRaw: unknown
  try {
    chainRaw = await eip.request({ method: 'eth_chainId' })
  } catch {
    return live() ? { ok: false, reason: 'Could not read the network from your wallet. Nothing was sent.' } : stale
  }
  if (!live()) return stale
  if (parseChainId(chainRaw) !== args.network.chainId) {
    return { ok: false, reason: `Your wallet is not on ${args.network.label}. Nothing was sent.` }
  }

  let accounts: unknown
  try {
    accounts = await eip.request({ method: 'eth_accounts' })
  } catch {
    return live() ? { ok: false, reason: 'Could not read the account from your wallet. Nothing was sent.' } : stale
  }
  if (!live()) return stale
  const selected = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() : null
  if (!selected || selected !== (args.wallet.address ?? '').toLowerCase()) {
    return { ok: false, reason: 'Your wallet is on a different account than the one you chose. Nothing was sent.' }
  }

  // Last pre-check, then hand the verified provider to the sender with no await in between.
  // The sender's own boundary guard re-checks at the real eth_sendTransaction request.
  if (!live()) return stale
  return { ok: true, value: await args.send(eip) }
}
