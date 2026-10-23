/**
 * Verification of a bill-creation transaction against canonical chain data.
 *
 * Facts used, and where they come from:
 *  - creator   = canonical `tx.from` of the creating transaction. BillCreated
 *                has NO creator field, so the creator is never read from an event.
 *  - intent    = decoded `createBill` calldata, which must equal the bill the
 *                caller intended to create (title, recipient, ordered payers, share).
 *  - bill id   = `billId` from the BillCreated log emitted by the pinned contract.
 *  - post-state = `getBill(billId)` at the creating block must match the intent
 *                and show every payer unpaid (`paidStates` is getBill()[4]).
 */
import {
  decodeEventLog,
  decodeFunctionData,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type PublicClient,
} from 'viem'
import { SPLIT_RECEIPT_HUMAN_ABI } from './splitReceiptAbi.ts'
import { HASH_RE, type Address, type Hash32 } from './networks.ts'

export interface IntendedBill {
  title: string
  recipient: Address
  payers: readonly Address[]
  share: bigint
}

export interface CreateVerificationInput {
  chainId: number
  contract: Address
  hash: Hash32
  intended: IntendedBill
  /** When set, the canonical sender must be this account. */
  expectedCreator?: Address | null
}

export type CreateVerification =
  | {
      ok: true
      billId: bigint
      creator: Address
      blockNumber: bigint
      blockHash: Hash32
    }
  | { ok: false; reason: string; /** True when a retry could succeed (RPC trouble, not yet mined). */ transient: boolean }

export type CreateVerificationClient = Pick<
  PublicClient,
  'getChainId' | 'getBlockNumber' | 'getTransaction' | 'getTransactionReceipt' | 'getBlock' | 'readContract'
>

const fail = (reason: string, transient = false): CreateVerification => ({ ok: false, reason, transient })
const lc = (s: string) => s.toLowerCase()

function sameAddresses(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => lc(x) === lc(b[i]))
}

function matchesIntent(
  actual: { title: string; recipient: string; payers: readonly string[]; share: bigint },
  intended: IntendedBill,
): boolean {
  return (
    actual.title === intended.title &&
    lc(actual.recipient) === lc(intended.recipient) &&
    sameAddresses(actual.payers, intended.payers) &&
    actual.share === intended.share
  )
}

export async function verifyCreateBillTransaction(
  client: CreateVerificationClient,
  input: CreateVerificationInput,
): Promise<CreateVerification> {
  const { chainId, contract, hash, intended } = input
  if (!HASH_RE.test(hash)) return fail('Not a valid transaction hash.')

  let liveChain: number
  let head: bigint
  try {
    liveChain = await client.getChainId()
    head = await client.getBlockNumber()
  } catch {
    return fail('Could not reach the network to verify the bill.', true)
  }
  if (liveChain !== chainId) return fail(`The network answered with chain ${liveChain}, not ${chainId}.`)

  let receipt: Awaited<ReturnType<CreateVerificationClient['getTransactionReceipt']>>
  try {
    receipt = await client.getTransactionReceipt({ hash })
  } catch (err) {
    if (err instanceof TransactionReceiptNotFoundError) return fail('The creation transaction is not mined yet.', true)
    return fail('Could not read the creation receipt.', true)
  }
  if (receipt.status !== 'success') return fail('The creation transaction did not succeed.')
  if (lc(receipt.transactionHash) !== lc(hash)) return fail('Receipt belongs to a different transaction.')
  if (receipt.blockNumber > head) return fail('Receipt is beyond the current chain head.', true)
  if (!HASH_RE.test(receipt.blockHash)) return fail('Receipt has no valid block hash.')

  let canonical: Awaited<ReturnType<CreateVerificationClient['getBlock']>>
  try {
    canonical = await client.getBlock({ blockNumber: receipt.blockNumber })
  } catch {
    return fail('Could not read the canonical block.', true)
  }
  if (!canonical.hash || lc(canonical.hash) !== lc(receipt.blockHash)) {
    return fail('Receipt block is not the canonical block.')
  }
  const blockHash = lc(canonical.hash) as Hash32

  let tx: Awaited<ReturnType<CreateVerificationClient['getTransaction']>>
  try {
    tx = await client.getTransaction({ hash })
  } catch (err) {
    if (err instanceof TransactionNotFoundError) return fail('The creation transaction was not found.', true)
    return fail('Could not read the creation transaction.', true)
  }
  if (lc(tx.hash) !== lc(hash)) return fail('Transaction hash mismatch.')
  if (!tx.blockHash || lc(tx.blockHash) !== blockHash) return fail('Transaction is not in the canonical block.')
  if (!tx.to || lc(tx.to) !== lc(contract)) return fail('The transaction did not call the expected contract.')
  if (lc(receipt.from) !== lc(tx.from)) return fail('Receipt sender does not match the transaction sender.')
  if (input.expectedCreator && lc(tx.from) !== lc(input.expectedCreator)) {
    return fail('The transaction was sent by a different account than the connected wallet.')
  }
  if (tx.value !== 0n) return fail('Bill creation must not carry payment value.')

  let decoded: ReturnType<typeof decodeFunctionData>
  try {
    decoded = decodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, data: tx.input })
  } catch {
    return fail('The transaction data is not a SplitReceipt call.')
  }
  if (decoded.functionName !== 'createBill' || !decoded.args) return fail('The transaction did not call createBill.')
  const [cTitle, cRecipient, cPayers, cShare] = decoded.args as readonly [string, string, readonly string[], bigint]
  if (!matchesIntent({ title: cTitle, recipient: cRecipient, payers: cPayers, share: cShare }, intended)) {
    return fail('The transaction data does not match the bill that was entered.')
  }

  const created: bigint[] = []
  for (const log of receipt.logs) {
    if (lc(log.address) !== lc(contract) || log.removed) continue
    if (log.blockNumber !== receipt.blockNumber) continue
    if (!log.blockHash || lc(log.blockHash) !== blockHash) continue
    if (!log.transactionHash || lc(log.transactionHash) !== lc(hash)) continue
    let ev: ReturnType<typeof decodeEventLog>
    try {
      ev = decodeEventLog({ abi: SPLIT_RECEIPT_HUMAN_ABI, data: log.data, topics: log.topics, strict: true })
    } catch {
      continue
    }
    if (ev.eventName !== 'BillCreated') continue
    const a = ev.args as unknown as { billId: bigint; recipient: string; share: bigint; payers: readonly string[]; title: string }
    if (!matchesIntent(a, intended)) return fail('The BillCreated event does not match the bill that was entered.')
    created.push(a.billId)
  }
  if (created.length !== 1) return fail('Expected exactly one BillCreated event from this contract.')
  const billId = created[0]

  try {
    const state = (await client.readContract({
      address: contract,
      abi: SPLIT_RECEIPT_HUMAN_ABI,
      functionName: 'getBill',
      args: [billId],
      blockNumber: receipt.blockNumber,
    })) as readonly [string, string, readonly string[], bigint, readonly boolean[]]
    const [sTitle, sRecipient, sPayers, sShare, sPaid] = state
    if (!matchesIntent({ title: sTitle, recipient: sRecipient, payers: sPayers, share: sShare }, intended)) {
      return fail('Stored bill does not match the bill that was entered.')
    }
    if (sPaid.length !== intended.payers.length || sPaid.some(Boolean)) {
      return fail('A new bill must start with every share unpaid.')
    }
  } catch {
    return fail('Could not read the stored bill.', true)
  }

  return { ok: true, billId, creator: lc(tx.from) as Address, blockNumber: receipt.blockNumber, blockHash }
}
