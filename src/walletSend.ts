/**
 * The final wallet boundary.
 *
 * Asking a library (wagmi, viem) to "write a contract" involves more awaits after
 * any pre-check: reading accounts, the chain, the provider, estimating. A check made
 * before those awaits can be stale by the time the wallet is asked. So the check that
 * matters is made on the one call that can spend money: the EIP-1193 request itself.
 *
 * `createGuardedProvider` wraps the exact provider object the user acknowledged. It does
 * not patch any global. For `eth_sendTransaction` it runs, synchronously and with no await
 * before delegating:
 *   1. the request token is still live (wallet, page and action epochs unchanged);
 *   2. the wallet snapshot still equals the one the user was looking at;
 *   3. the transaction is exactly the frozen one: from, to, data, value, fee caps, chain.
 * Any other signing or sending method is refused outright. Everything else (for example the
 * `eth_chainId` read viem makes first) passes through untouched.
 *
 * The send itself goes through viem's real `writeContract` on a wallet client whose
 * transport is that guarded provider, with retries disabled so a failed send is never repeated.
 */
import { createWalletClient, custom, encodeFunctionData, toHex, type Chain } from 'viem'
import type { LiveCheck } from './epoch.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from './splitReceiptAbi.ts'
import type { Address, Hash32, NetworkContext, ReviewedDeployment } from './networks.ts'
import type { IntendedBill } from './createBillReceipt.ts'
import { sameWalletSession, type Eip1193Provider, type WalletSnapshot } from './writeGuard.ts'

type Hex = `0x${string}`

export interface FrozenTx {
  from: Address
  to: Address
  chainId: number
  data: Hex
  value: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

export interface FrozenCall {
  tx: FrozenTx
  functionName: 'createBill' | 'payShare'
  args: readonly unknown[]
}

function feeFields(network: NetworkContext): Pick<FrozenTx, 'maxFeePerGas' | 'maxPriorityFeePerGas'> {
  return network.fees
    ? { maxFeePerGas: network.fees.maxFeePerGas, maxPriorityFeePerGas: network.fees.maxPriorityFeePerGas }
    : {}
}

export function freezeCreateBill(
  network: NetworkContext,
  deployment: ReviewedDeployment,
  from: Address,
  intended: IntendedBill,
): FrozenCall {
  const args = [intended.title, intended.recipient, [...intended.payers], intended.share] as const
  return {
    functionName: 'createBill',
    args,
    tx: {
      from,
      to: deployment.address,
      chainId: network.chainId,
      data: encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'createBill', args }),
      value: 0n,
      ...feeFields(network),
    },
  }
}

export function freezePayShare(
  network: NetworkContext,
  deployment: ReviewedDeployment,
  from: Address,
  billId: bigint,
  share: bigint,
): FrozenCall {
  const args = [billId] as const
  return {
    functionName: 'payShare',
    args,
    tx: {
      from,
      to: deployment.address,
      chainId: network.chainId,
      data: encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'payShare', args }),
      value: share,
      ...feeFields(network),
    },
  }
}

export class WalletGuardRefusal extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'WalletGuardRefusal'
  }
}

export const REFUSAL_STALE = 'Your wallet or this page changed before the request. Nothing was sent.'

/** Methods that can move funds or sign. Only eth_sendTransaction for the frozen call is ever allowed. */
const SIGNING_METHODS = new Set([
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sendRawTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'wallet_sendCalls',
  'wallet_sendTransaction',
])

const ALLOWED_TX_KEYS = new Set(['from', 'to', 'data', 'value', 'chainId', 'maxFeePerGas', 'maxPriorityFeePerGas', 'type'])

const quantity = (v: unknown): bigint | null => {
  if (v === undefined || v === null) return null
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return BigInt(v)
  if (typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v)) return v === '0x' ? 0n : BigInt(v)
  return null
}

/** Returns a reason when `raw` is not exactly the frozen transaction, otherwise null. */
export function describeTxMismatch(raw: unknown, frozen: FrozenTx): string | null {
  if (!raw || typeof raw !== 'object') return 'The request has no transaction.'
  const tx = raw as Record<string, unknown>
  for (const k of Object.keys(tx)) {
    if (tx[k] !== undefined && !ALLOWED_TX_KEYS.has(k)) return `Unexpected transaction field "${k}".`
  }
  if (typeof tx.from !== 'string' || tx.from.toLowerCase() !== frozen.from.toLowerCase()) return 'The sender is not the chosen account.'
  if (typeof tx.to !== 'string' || tx.to.toLowerCase() !== frozen.to.toLowerCase()) return 'The target is not the pinned contract.'
  if (typeof tx.data !== 'string' || tx.data.toLowerCase() !== frozen.data.toLowerCase()) return 'The call data is not the frozen call.'
  if ((quantity(tx.value) ?? 0n) !== frozen.value) return 'The value is not the frozen value.'
  if (tx.chainId !== undefined && quantity(tx.chainId) !== BigInt(frozen.chainId)) return 'The chain is not the page network.'
  if (tx.type !== undefined && quantity(tx.type) !== 2n) return 'Only EIP-1559 transactions are allowed.'
  if (quantity(tx.maxFeePerGas) !== (frozen.maxFeePerGas ?? null)) return 'The max fee per gas is not the network policy.'
  if (quantity(tx.maxPriorityFeePerGas) !== (frozen.maxPriorityFeePerGas ?? null)) return 'The priority fee is not the network policy.'
  return null
}

export interface SendGuard {
  token: LiveCheck
  /** Wallet snapshot the user was looking at when they pressed the button. */
  wallet: WalletSnapshot
  /** Live accessor for the wallet snapshot. */
  getWallet: () => WalletSnapshot
}

export interface GuardedProvider extends Eip1193Provider {
  /** Set when the guard refused a request; the reason is safe to show. */
  refusal(): string | null
}

export function createGuardedProvider(provider: Eip1193Provider, frozen: FrozenTx, guard: SendGuard): GuardedProvider {
  let refused: string | null = null
  const refuse = (reason: string): Promise<never> => {
    refused = reason
    return Promise.reject(new WalletGuardRefusal(reason))
  }
  return {
    refusal: () => refused,
    // Deliberately not `async`: nothing may be awaited between the checks and the delegate call.
    request(args) {
      if (!SIGNING_METHODS.has(args.method)) return provider.request(args)
      if (args.method !== 'eth_sendTransaction') return refuse(`Blocked: ${args.method} is not part of this action.`)
      if (!guard.token.isLive() || !sameWalletSession(guard.getWallet(), guard.wallet)) return refuse(REFUSAL_STALE)
      const params = args.params
      if (!Array.isArray(params) || params.length !== 1) return refuse('Blocked: unexpected request shape.')
      const mismatch = describeTxMismatch(params[0], frozen)
      if (mismatch) return refuse(`Blocked: ${mismatch}`)
      const tx: Record<string, unknown> = { ...(params[0] as Record<string, unknown>), chainId: toHex(frozen.chainId) }
      return provider.request({ method: 'eth_sendTransaction', params: [tx] })
    },
  }
}

export type SendResult = { ok: true; hash: Hash32 } | { ok: false; reason: string }

/**
 * Sends the frozen call through viem's real `writeContract`. Wallet rejections and
 * other wallet errors are rethrown unchanged; only a guard refusal becomes `{ ok: false }`.
 */
export async function sendFrozenCall(args: {
  call: FrozenCall
  /** The exact provider object that was acknowledged. */
  provider: Eip1193Provider
  chain: Chain
  guard: SendGuard
}): Promise<SendResult> {
  const { call, provider, chain, guard } = args
  const guarded = createGuardedProvider(provider, call.tx, guard)
  const client = createWalletClient({
    account: call.tx.from,
    chain,
    // retryCount 0: a failed send must never be sent a second time by the transport.
    transport: custom(guarded, { retryCount: 0 }),
  })
  try {
    const hash = await client.writeContract({
      address: call.tx.to,
      abi: SPLIT_RECEIPT_HUMAN_ABI,
      functionName: call.functionName,
      args: call.args,
      value: call.tx.value,
      account: call.tx.from,
      chain,
      ...(call.tx.maxFeePerGas !== undefined ? { maxFeePerGas: call.tx.maxFeePerGas } : {}),
      ...(call.tx.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: call.tx.maxPriorityFeePerGas } : {}),
    } as never)
    return { ok: true, hash: hash as Hash32 }
  } catch (err) {
    const reason = guarded.refusal()
    if (reason) return { ok: false, reason }
    throw err
  }
}
