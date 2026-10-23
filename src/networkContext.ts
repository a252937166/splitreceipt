import { isAddress, keccak256, type Address, type Hex } from 'viem'
import { REVIEWED_MAINNET_DEPLOYMENT, matchesReviewedMainnetDeployment } from './mainnetDeployment'

export const ARC_TESTNET_CHAIN_ID = 5042002 as const
export const ARC_MAINNET_CHAIN_ID = 5042 as const
/** Only a reviewed source-pinned deployment can enable mainnet writes. */
export const MAINNET_WRITES_ENABLED = REVIEWED_MAINNET_DEPLOYMENT !== null
export const TESTNET_CONTRACT: Address = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
export const TESTNET_DEPLOY_BLOCK = 67660831n
/** Historical runtime from deployments/arc-testnet.json, independently checked by tools/testnet/check.mjs. */
export const TESTNET_RUNTIME_HASH: Hex = '0xbbd2f2b7c23a525b0cbb77c31d8b4a82b99797158bcfd7da6cd94c12b74b8074'

export const NETWORK_FACTS = Object.freeze({
  testnet: Object.freeze({ key: 'testnet', chainId: ARC_TESTNET_CHAIN_ID, name: 'Arc Testnet', isTestnet: true,
    rpcUrl: 'https://rpc.testnet.arc.io', explorerBase: 'https://explorer.testnet.arc.io' }),
  mainnet: Object.freeze({ key: 'mainnet', chainId: ARC_MAINNET_CHAIN_ID, name: 'Arc Mainnet', isTestnet: false,
    rpcUrl: 'https://rpc.mainnet.arc.io', explorerBase: 'https://explorer.arc.io' }),
})
export type NetworkKey = keyof typeof NETWORK_FACTS
export type PublicNetworkEnv = Readonly<Record<string, unknown>>

export interface NetworkDeploymentContext {
  readonly key: NetworkKey
  readonly chainId: number
  readonly name: string
  readonly isTestnet: boolean
  readonly rpcUrl: string
  readonly explorerBase: string
  readonly nativeDecimals: 18
  readonly contract: Address | null
  readonly deploymentBlock: bigint | null
  /** Compatibility alias for presentation components; identical to deploymentBlock. */
  readonly deployBlock: bigint | null
  readonly expectedRuntimeHash: Hex | null
  readonly contextKey: string
  readonly configError: string | null
  readonly mainnetWritesEnabled: boolean
}

function address(raw: string): Address | null {
  return isAddress(raw) && !/^0x0{40}$/i.test(raw) ? raw.toLowerCase() as Address : null
}
function hash(raw: string): Hex | null {
  return /^0x[0-9a-f]{64}$/i.test(raw) ? raw.toLowerCase() as Hex : null
}
function envString(env: PublicNetworkEnv, key: string): string | undefined {
  const value = env[key]
  return value === undefined || value === null ? undefined : String(value).trim()
}
function selection(href: string): { key: NetworkKey; params: URLSearchParams; error: string | null } {
  try {
    const params = new URL(href || '/', 'https://splitreceipt.invalid/').searchParams
    for (const name of ['network', 'chainId', 'contract']) {
      if (params.getAll(name).length > 1) return { key: 'testnet', params, error: `Duplicate ${name} parameter.` }
    }
    const raw = params.get('network')
    // Legacy links and an empty URL always select testnet, independently of wallet/storage/env state.
    const key: NetworkKey = raw === 'mainnet' ? 'mainnet' : 'testnet'
    if (raw !== null && raw !== 'testnet' && raw !== 'mainnet') {
      return { key, params, error: 'Unknown network. Select Arc Testnet or Arc Mainnet explicitly.' }
    }
    const rawChain = params.get('chainId')
    if (rawChain !== null && rawChain !== String(NETWORK_FACTS[key].chainId)) {
      return { key, params, error: 'The URL network and chain ID do not match.' }
    }
    return { key, params, error: null }
  } catch {
    return { key: 'testnet', params: new URLSearchParams(), error: 'Invalid application URL.' }
  }
}

/** Resolve immutable public configuration. URL contracts are identities to match, never overrides. */
export function resolveNetworkContext(href: string, env: PublicNetworkEnv = {}): NetworkDeploymentContext {
  const selected = selection(href)
  const facts = NETWORK_FACTS[selected.key]
  const errors: string[] = selected.error ? [selected.error] : []
  const prefix = selected.key === 'mainnet' ? 'VITE_SPLIT_RECEIPT_MAINNET' : 'VITE_SPLIT_RECEIPT_TESTNET'
  const specificAddress = envString(env, `${prefix}_ADDRESS`)
  const legacyAddress = selected.key === 'testnet' ? envString(env, 'VITE_SPLIT_RECEIPT_ADDRESS') : undefined
  if (specificAddress !== undefined && legacyAddress !== undefined && specificAddress.toLowerCase() !== legacyAddress.toLowerCase()) {
    errors.push('Conflicting testnet contract configuration.')
  }
  const reviewed = selected.key === 'mainnet' ? REVIEWED_MAINNET_DEPLOYMENT : null
  const rawAddress = specificAddress ?? legacyAddress ?? (selected.key === 'testnet' ? TESTNET_CONTRACT : reviewed?.contract ?? '')
  const contract = rawAddress ? address(rawAddress) : null
  if (rawAddress && !contract) errors.push('Configured contract address is invalid or zero.')
  if (selected.key === 'mainnet' && contract?.toLowerCase() === TESTNET_CONTRACT.toLowerCase()) {
    errors.push('The historical testnet contract address cannot be configured as a mainnet deployment.')
  }
  const historical = selected.key === 'testnet' && contract === TESTNET_CONTRACT
  const rawBlock = envString(env, `${prefix}_DEPLOY_BLOCK`) ??
    (selected.key === 'testnet' ? envString(env, 'VITE_SPLIT_RECEIPT_DEPLOY_BLOCK') : undefined) ??
    (historical ? String(TESTNET_DEPLOY_BLOCK) : reviewed ? String(reviewed.deploymentBlock) : '')
  let deploymentBlock: bigint | null = null
  if (rawBlock) {
    if (/^\d+$/.test(rawBlock)) deploymentBlock = BigInt(rawBlock)
    else errors.push('Deployment block must be a non-negative integer.')
  }
  const rawHash = envString(env, `${prefix}_RUNTIME_HASH`) ?? (historical ? TESTNET_RUNTIME_HASH : reviewed?.runtimeHash ?? '')
  const expectedRuntimeHash = rawHash ? hash(rawHash) : null
  if (rawHash && !expectedRuntimeHash) errors.push('Expected runtime hash must be a 32-byte hex value.')
  const urlContract = selected.params.get('contract')
  if (urlContract !== null && (!address(urlContract) || !contract || urlContract.toLowerCase() !== contract.toLowerCase())) {
    errors.push('The bill link contract does not match this network deployment.')
  }
  return Object.freeze({ ...facts, nativeDecimals: 18, contract, deploymentBlock, deployBlock: deploymentBlock,
    expectedRuntimeHash, mainnetWritesEnabled: selected.key === 'mainnet' && matchesReviewedMainnetDeployment({
      chainId: facts.chainId, contract, deploymentBlock, expectedRuntimeHash,
    }),
    contextKey: `${facts.chainId}:${contract ?? 'unconfigured'}:${expectedRuntimeHash ?? 'unverified'}:${deploymentBlock ?? 'unknown'}`,
    configError: errors.length ? errors.join(' ') : null })
}

/** Synchronous navigation check for late wallet/receipt callbacks; no wallet or RPC side effect. */
export function isCurrentLocationContext(context: NetworkDeploymentContext, href: string): boolean {
  if (context.configError) return false
  const selected = selection(href)
  if (selected.error || selected.key !== context.key) return false
  const raw = selected.params.get('contract')
  return raw === null || Boolean(address(raw) && context.contract && raw.toLowerCase() === context.contract.toLowerCase())
}

export interface ReadonlyDeploymentClient {
  getChainId(): Promise<number>
  getCode(args: { address: Address; blockTag?: 'latest' }): Promise<Hex | undefined>
}
export type DeploymentStatus = 'ready' | 'unconfigured' | 'invalid' | 'wrong-chain' | 'missing-code' | 'code-mismatch' | 'rpc-error'
export interface DeploymentCheck {
  readonly status: DeploymentStatus
  readonly contextKey: string
  readonly reason: string | null
  readonly runtimeHash?: Hex
}

/** Read-only identity verification. Missing/invalid deployments do not make any RPC request. */
export async function checkDeployment(client: ReadonlyDeploymentClient, context: NetworkDeploymentContext): Promise<DeploymentCheck> {
  const result = (status: DeploymentStatus, reason: string | null, runtimeHash?: Hex): DeploymentCheck =>
    ({ status, contextKey: context.contextKey, reason, ...(runtimeHash ? { runtimeHash } : {}) })
  if (context.configError) return result('invalid', context.configError)
  if (!context.contract || context.deploymentBlock === null || !context.expectedRuntimeHash) {
    return result('unconfigured', `${context.name} deployment is not configured with an address, deployment block and reviewed runtime hash.`)
  }
  try {
    if (await client.getChainId() !== context.chainId) return result('wrong-chain', 'RPC returned the wrong network. Transactions remain disabled.')
    const code = await client.getCode({ address: context.contract, blockTag: 'latest' })
    if (!code || code === '0x') return result('missing-code', 'No contract bytecode exists at the configured address.')
    const runtimeHash = keccak256(code)
    if (runtimeHash.toLowerCase() !== context.expectedRuntimeHash.toLowerCase()) {
      return result('code-mismatch', 'Contract bytecode does not match the reviewed deployment.', runtimeHash)
    }
    return result('ready', null, runtimeHash)
  } catch {
    return result('rpc-error', 'Contract verification could not complete. Retry before sending any transaction.')
  }
}

/** Used in both button state and the imperative write handler, after fresh deployment verification. */
export function getWriteBlockReason(
  context: NetworkDeploymentContext, verification: DeploymentCheck | null | undefined,
  walletChainId: number | undefined, walletAddress: string | undefined,
): string | null {
  if (context.configError) return context.configError
  if (!context.contract || context.deploymentBlock === null || !context.expectedRuntimeHash) return `${context.name} deployment is not configured.`
  if (context.key === 'mainnet') {
    // Check the actual source-pinned record again; a caller-supplied boolean is insufficient.
    if (context.isTestnet || !context.mainnetWritesEnabled || !matchesReviewedMainnetDeployment(context)) {
      return 'Mainnet transactions are disabled until this deployment is reviewed and enabled in the app release.'
    }
  } else if (!context.isTestnet || context.chainId !== ARC_TESTNET_CHAIN_ID) {
    return 'The selected network is not supported for transactions.'
  }
  if (!verification || verification.contextKey !== context.contextKey || verification.status !== 'ready') {
    return verification?.contextKey === context.contextKey ? verification.reason ?? 'Contract verification is not ready.' : 'Verify the current network deployment before sending a transaction.'
  }
  if (!walletAddress || !address(walletAddress)) return 'Connect a valid wallet before sending a transaction.'
  if (walletChainId !== context.chainId) return `Switch your wallet to ${context.name} before sending a transaction.`
  return null
}

export function assertCanWrite(
  context: NetworkDeploymentContext, verification: DeploymentCheck | null | undefined,
  walletChainId: number | undefined, walletAddress: string | undefined,
): void {
  const reason = getWriteBlockReason(context, verification, walletChainId, walletAddress)
  if (reason) throw new Error(reason)
}
