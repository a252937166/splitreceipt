/** Shared builders for verification tests. Real viem encoding, no guessed signatures. */
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
} from 'viem'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../src/splitReceiptAbi.ts'

export type Hex = `0x${string}`
export const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`
export const addr = (n: number): Hex => `0x${n.toString(16).padStart(40, '0')}`

export const CHAIN = 5042002
export const CONTRACT = addr(0xc0ffee)
export const CREATOR = addr(0xc1)
export const RECIPIENT = addr(0xe1)
export const PAYER_A = addr(0xa1)
export const PAYER_B = addr(0xa2)
export const SHARE = 1_000_000_000_000_000n
export const TITLE = 'Team dinner'
export const BLOCK = 500n
export const BLOCK_HASH = hash(0xb10c)
export const TX_HASH = hash(0x7e57)

export const INTENDED = {
  title: TITLE,
  recipient: RECIPIENT,
  payers: [PAYER_A, PAYER_B] as Hex[],
  share: SHARE,
}

export function createCalldata(i = INTENDED): Hex {
  return encodeFunctionData({
    abi: SPLIT_RECEIPT_HUMAN_ABI,
    functionName: 'createBill',
    args: [i.title, i.recipient, i.payers, i.share],
  })
}

export function billCreatedLog(
  billId: bigint,
  i = INTENDED,
  over: Partial<{ address: Hex; blockHash: Hex; transactionHash: Hex; blockNumber: bigint }> = {},
) {
  const topics = encodeEventTopics({
    abi: SPLIT_RECEIPT_HUMAN_ABI,
    eventName: 'BillCreated',
    args: { billId, recipient: i.recipient },
  })
  const data = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'address[]' }, { type: 'string' }],
    [i.share, i.payers, i.title],
  )
  return {
    address: over.address ?? CONTRACT,
    topics,
    data,
    blockNumber: over.blockNumber ?? BLOCK,
    blockHash: over.blockHash ?? BLOCK_HASH,
    transactionHash: over.transactionHash ?? TX_HASH,
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
  }
}

export function sharePaidLog(billId: bigint, payer: Hex, amount: bigint, txHash: Hex = TX_HASH) {
  const topics = encodeEventTopics({
    abi: SPLIT_RECEIPT_HUMAN_ABI,
    eventName: 'SharePaid',
    args: { billId, payer },
  })
  return {
    address: CONTRACT,
    topics,
    data: encodeAbiParameters([{ type: 'uint256' }], [amount]),
    blockNumber: BLOCK,
    blockHash: BLOCK_HASH,
    transactionHash: txHash,
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
  }
}

export interface CreateScenario {
  chainId?: number
  head?: bigint
  status?: 'success' | 'reverted'
  from?: Hex
  to?: Hex
  value?: bigint
  input?: Hex
  txBlockHash?: Hex
  canonicalBlockHash?: Hex
  logs?: ReturnType<typeof billCreatedLog>[]
  billId?: bigint
  stored?: { title: string; recipient: Hex; payers: Hex[]; share: bigint; paid: boolean[] }
  receiptMissing?: boolean
  rpcFailure?: 'receipt' | 'tx' | 'block' | 'read' | 'chain'
}

export function createClient(s: CreateScenario = {}) {
  const billId = s.billId ?? 7n
  const from = s.from ?? CREATOR
  const calls = { readBlock: undefined as bigint | undefined }
  const client = {
    getChainId: async () => {
      if (s.rpcFailure === 'chain') throw new Error('down')
      return s.chainId ?? CHAIN
    },
    getBlockNumber: async () => s.head ?? 10_000n,
    getTransactionReceipt: async ({ hash: h }: { hash: Hex }) => {
      if (s.rpcFailure === 'receipt') throw new Error('timeout')
      if (s.receiptMissing) throw new TransactionReceiptNotFoundError({ hash: h })
      return {
        transactionHash: h,
        blockNumber: BLOCK,
        blockHash: BLOCK_HASH,
        status: s.status ?? 'success',
        from,
        to: s.to ?? CONTRACT,
        logs: s.logs ?? [billCreatedLog(billId)],
      }
    },
    getTransaction: async ({ hash: h }: { hash: Hex }) => {
      if (s.rpcFailure === 'tx') throw new Error('timeout')
      if (s.receiptMissing) throw new TransactionNotFoundError({ hash: h })
      return {
        hash: h,
        from,
        to: s.to ?? CONTRACT,
        value: s.value ?? 0n,
        input: s.input ?? createCalldata(),
        blockHash: s.txBlockHash ?? BLOCK_HASH,
        blockNumber: BLOCK,
      }
    },
    getBlock: async () => {
      if (s.rpcFailure === 'block') throw new Error('timeout')
      return { hash: s.canonicalBlockHash ?? BLOCK_HASH }
    },
    readContract: async (args: { blockNumber?: bigint }) => {
      if (s.rpcFailure === 'read') throw new Error('timeout')
      calls.readBlock = args.blockNumber
      const st = s.stored ?? { ...INTENDED, paid: [false, false] }
      return [st.title, st.recipient, st.payers, st.share, st.paid]
    },
  }
  return { client: client as never, calls }
}

export function payClient(o: {
  from?: Hex
  to?: Hex
  value?: bigint
  billId?: bigint
  status?: 'success' | 'reverted'
  txBlockHash?: Hex
  input?: Hex
  fail?: boolean
  missing?: boolean
}) {
  const payer = o.from ?? PAYER_A
  const input =
    o.input ??
    encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'payShare', args: [o.billId ?? 7n] })
  return {
    getTransaction: async ({ hash: h }: { hash: Hex }) => {
      if (o.fail) throw new Error('timeout')
      if (o.missing) throw new TransactionNotFoundError({ hash: h })
      return {
        hash: h,
        from: payer,
        to: o.to ?? CONTRACT,
        value: o.value ?? SHARE,
        input,
        blockHash: o.txBlockHash ?? BLOCK_HASH,
      }
    },
    getTransactionReceipt: async ({ hash: h }: { hash: Hex }) => {
      if (o.fail) throw new Error('timeout')
      if (o.missing) throw new TransactionReceiptNotFoundError({ hash: h })
      return {
        transactionHash: h,
        from: payer,
        status: o.status ?? 'success',
        blockHash: BLOCK_HASH,
      }
    },
  } as never
}
