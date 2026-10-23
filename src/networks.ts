/**
 * Network and deployment contexts.
 *
 * The page context (network + chain id + reviewed contract + optional bill) is
 * derived from the URL and is FAIL-CLOSED: anything that does not name a
 * supported network, matching chain id and reviewed deployment is rejected with
 * a recovery link instead of silently falling back to something else.
 *
 * Two networks are configured: Arc Testnet (5042002, the default) and Arc
 * Mainnet (5042). They are separate page contexts: a link names exactly one of
 * them, a receipt or bill from one is never shown under the other, and
 * switching network is a full navigation that drops the old bill, receipt hints
 * and contract from the URL. Testnet evidence must never be presented as
 * mainnet evidence, or the other way round.
 */
import { requireChain } from './onchain-facts.ts'

export type Address = `0x${string}`
export type Hash32 = `0x${string}`

export const ARC_TESTNET_ID = 5042002
export const ARC_MAINNET_ID = 5042

export interface ReviewedDeployment {
  /** Lowercase contract address. */
  address: Address
  label: string
  /** keccak256 of the runtime bytecode that was reviewed. */
  runtimeCodeHash: Hash32
  /** First block to scan for history, or null when unknown. */
  deployBlock: bigint | null
}

export type NetworkKey = 'testnet' | 'mainnet'

export interface NetworkContext {
  key: NetworkKey
  chainId: number
  label: string
  /** True when USDC (for payments and gas) has real monetary value. */
  realFunds: boolean
  /**
   * Per-gas fee caps attached to every write on this network. A cap on the price
   * per unit of gas is NOT a limit on the total fee: total = gas used x price.
   * Absent means the wallet chooses (Testnet).
   */
  fees?: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }
  rpcUrl: string
  explorerBase: string
  deployments: readonly ReviewedDeployment[]
  defaultAddress: Address
}

const arcTestnetFacts = requireChain(ARC_TESTNET_ID)
const arcMainnetFacts = requireChain(ARC_MAINNET_ID)

export const TESTNET: NetworkContext = {
  key: 'testnet',
  chainId: ARC_TESTNET_ID,
  label: 'Arc Testnet',
  realFunds: false,
  rpcUrl: arcTestnetFacts.rpcUrls[0],
  explorerBase: arcTestnetFacts.explorerBase,
  deployments: [
    {
      address: '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26',
      label: 'Original testnet deployment',
      runtimeCodeHash: '0xbbd2f2b7c23a525b0cbb77c31d8b4a82b99797158bcfd7da6cd94c12b74b8074',
      deployBlock: 67660831n,
    },
    {
      address: '0xb168fcf0698c65fb0d516a35d97c44dcc06cb440',
      label: 'Arc Studio deployment',
      runtimeCodeHash: '0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b',
      deployBlock: null,
    },
  ],
  defaultAddress: '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26',
}

/**
 * Arc Mainnet. The deployment below is the independently reviewed public
 * contract (runtime hash pinned). This app only ever reads from it and asks the
 * connected wallet to sign; the wallet owner reviews and signs every write.
 */
export const MAINNET: NetworkContext = {
  key: 'mainnet',
  chainId: ARC_MAINNET_ID,
  label: 'Arc Mainnet',
  realFunds: true,
  fees: { maxFeePerGas: 40_000_000_000n, maxPriorityFeePerGas: 0n },
  rpcUrl: arcMainnetFacts.rpcUrls[0],
  explorerBase: arcMainnetFacts.explorerBase,
  deployments: [
    {
      address: '0x8522ea5a413c8402182ff6998bd7471bac886142',
      label: 'Reviewed mainnet deployment',
      runtimeCodeHash: '0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b',
      deployBlock: 27419618n,
    },
  ],
  defaultAddress: '0x8522ea5a413c8402182ff6998bd7471bac886142',
}

export const NETWORKS: readonly NetworkContext[] = [TESTNET, MAINNET]

export function networkByKey(key: string): NetworkContext | undefined {
  return NETWORKS.find((n) => n.key === key.toLowerCase())
}

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
export const HASH_RE = /^0x[0-9a-fA-F]{64}$/
const MAX_UINT256 = (1n << 256n) - 1n

export function findDeployment(
  network: NetworkContext,
  address: string,
): ReviewedDeployment | undefined {
  const lc = address.toLowerCase()
  return network.deployments.find((d) => d.address === lc)
}

/**
 * The deployment new bills are created on. A configured address is honoured
 * only when it is one of the reviewed deployments; anything else is ignored so
 * a stray environment value cannot point writes at unreviewed code.
 */
export function defaultDeployment(
  network: NetworkContext,
  configuredAddress?: string,
): ReviewedDeployment {
  if (configuredAddress) {
    const hit = findDeployment(network, configuredAddress.trim())
    if (hit) return hit
  }
  const fallback = findDeployment(network, network.defaultAddress)
  if (!fallback) throw new Error('Network default deployment is not in its reviewed list')
  return fallback
}

export type ContextProblemCode =
  | 'unsupported-network'
  | 'chain-mismatch'
  | 'contract-not-reviewed'
  | 'bad-bill'

export interface ContextProblem {
  code: ContextProblemCode
  message: string
}

export interface PageContext {
  network: NetworkContext
  deployment: ReviewedDeployment
  /** True when the URL named the contract explicitly. */
  explicitContract: boolean
  billId: bigint | null
  /** Hash of the creating transaction, when the link carries one. */
  createdHash: Hash32 | null
}

export type ParsedContext =
  | { ok: true; context: PageContext }
  | { ok: false; problem: ContextProblem }

export function parseBillId(raw: string | null): bigint | null | 'invalid' {
  if (raw === null || raw === '') return null
  if (!/^[1-9]\d{0,77}$/.test(raw)) return 'invalid'
  const n = BigInt(raw)
  return n > MAX_UINT256 ? 'invalid' : n
}

export function parsePageContext(
  search: string,
  configuredAddress?: string,
): ParsedContext {
  const params = new URLSearchParams(search)
  const networkParam = params.get('network')
  // A link with no network stays on Testnet (legacy and blank links).
  const network = networkParam === null ? TESTNET : networkByKey(networkParam)

  if (!network) {
    return {
      ok: false,
      problem: {
        code: 'unsupported-network',
        message: `This app supports Arc Testnet and Arc Mainnet. The link names the network "${networkParam?.slice(0, 24)}".`,
      },
    }
  }

  const chainParam = params.get('chainId')
  if (chainParam !== null && chainParam !== String(network.chainId)) {
    return {
      ok: false,
      problem: {
        code: 'chain-mismatch',
        message: `The link names chain ${chainParam.slice(0, 24)}, but ${network.label} is chain ${network.chainId}.`,
      },
    }
  }

  // The environment address only configures Testnet; Mainnet is always the pinned reviewed contract.
  let deployment = defaultDeployment(network, network.key === 'testnet' ? configuredAddress : undefined)
  const contractParam = params.get('contract')
  if (contractParam !== null) {
    const hit = ADDRESS_RE.test(contractParam) ? findDeployment(network, contractParam) : undefined
    if (!hit) {
      return {
        ok: false,
        problem: {
          code: 'contract-not-reviewed',
          message: `The link names a contract that is not a reviewed SplitReceipt deployment on ${network.label}.`,
        },
      }
    }
    deployment = hit
  }

  const bill = parseBillId(params.get('bill'))
  if (bill === 'invalid') {
    return { ok: false, problem: { code: 'bad-bill', message: 'The bill number in the link is not valid.' } }
  }

  const created = params.get('created')
  const createdHash =
    created !== null && HASH_RE.test(created) ? (created.toLowerCase() as Hash32) : null

  return {
    ok: true,
    context: {
      network,
      deployment,
      explicitContract: contractParam !== null,
      billId: bill,
      createdHash,
    },
  }
}

/** Query string that identifies a bill (or the blank page) in a context. */
export function buildContextSearch(
  context: Pick<PageContext, 'network' | 'deployment'>,
  billId: bigint | null,
  extra?: { created?: Hash32 | null; receipts?: readonly string[] },
): string {
  const p = new URLSearchParams()
  p.set('network', context.network.key)
  p.set('chainId', String(context.network.chainId))
  p.set('contract', context.deployment.address)
  if (billId !== null) p.set('bill', billId.toString())
  if (extra?.created) p.set('created', extra.created)
  if (extra?.receipts && extra.receipts.length > 0) p.set('receipts', extra.receipts.join(','))
  return `?${p.toString()}`
}

/** Stable key used to discard results that belong to a previous page context. */
export function contextKey(context: Pick<PageContext, 'network' | 'deployment' | 'billId'>): string {
  return `${context.network.chainId}:${context.deployment.address}:${context.billId ?? '-'}`
}

export function explorerTxUrl(network: NetworkContext, hash: string): string {
  return `${network.explorerBase}/tx/${hash}`
}

export function explorerAddressUrl(network: NetworkContext, address: string): string {
  return `${network.explorerBase}/address/${address}`
}
