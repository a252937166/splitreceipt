import type { ReceiptHash } from './receiptHistory'

export interface CreateBillSubmission {
  chainId: number
  contract: string
  creator: string
  title: string
  recipient: string
  payers: readonly string[]
  share: bigint
  /** Wallet-returned hash remains stable so an old replacement callback cannot capture a new request. */
  hash?: ReceiptHash
  minedHash?: ReceiptHash
  invalidated?: 'cancelled' | 'replaced'
}

export interface BillCreatedLog {
  address: string
  removed?: boolean
  args: {
    billId?: bigint
    recipient?: string
    share?: bigint
    payers?: readonly string[]
    title?: string
  }
}

const sameAddress = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase()

/** Only an observed replacement of this request may update its final hash. */
export function applyCreationReplacement(
  request: CreateBillSubmission,
  replacement: { reason: 'repriced' | 'replaced' | 'cancelled'; replacedHash: ReceiptHash; minedHash: ReceiptHash },
): CreateBillSubmission {
  if (!request.hash || ![request.hash, request.minedHash].some(hash => hash?.toLowerCase() === replacement.replacedHash.toLowerCase())) {
    return request
  }
  return {
    ...request,
    minedHash: replacement.minedHash,
    invalidated: replacement.reason === 'repriced' ? request.invalidated : replacement.reason,
  }
}

export type CreationConfirmation =
  | { kind: 'confirmed'; billId: bigint; transactionHash: ReceiptHash }
  | { kind: 'stale' | 'reverted' | 'cancelled' | 'replaced' | 'wrong-wallet' | 'wrong-chain' | 'missing-event' | 'ambiguous-event' }

/** Match the complete immutable request against its successful mined receipt. */
export function confirmBillCreation(
  request: CreateBillSubmission,
  receipt: { status: 'success' | 'reverted'; transactionHash: ReceiptHash; logs: readonly BillCreatedLog[] },
  context: { receiptChainId: number; connectedChainId: number | undefined; connectedAddress: string | undefined },
): CreationConfirmation {
  if (!request.hash || (request.minedHash ?? request.hash).toLowerCase() !== receipt.transactionHash.toLowerCase()) return { kind: 'stale' }
  if (request.invalidated) return { kind: request.invalidated }
  if (receipt.status !== 'success') return { kind: 'reverted' }
  if (context.receiptChainId !== request.chainId || context.connectedChainId !== request.chainId) return { kind: 'wrong-chain' }
  if (!sameAddress(context.connectedAddress, request.creator)) return { kind: 'wrong-wallet' }

  const matches = new Set<bigint>()
  for (const log of receipt.logs) {
    const args = log.args
    if (!log.removed && sameAddress(log.address, request.contract) &&
      args.billId !== undefined && args.billId > 0n &&
      sameAddress(args.recipient, request.recipient) &&
      args.share === request.share && args.title === request.title &&
      args.payers?.length === request.payers.length &&
      args.payers.every((payer, index) => sameAddress(payer, request.payers[index]))) {
      matches.add(args.billId)
    }
  }
  if (matches.size === 0) return { kind: 'missing-event' }
  if (matches.size !== 1) return { kind: 'ambiguous-event' }
  return { kind: 'confirmed', billId: [...matches][0], transactionHash: receipt.transactionHash }
}
