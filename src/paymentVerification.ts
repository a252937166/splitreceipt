/**
 * Transaction-level checks for a payment receipt.
 *
 * `discoverReceiptsFromHints` proves a canonical block holds a matching
 * SharePaid log. This adds what a log alone cannot: the canonical sender is the
 * payer, the call targeted the pinned contract, it was `payShare(billId)`, and
 * the attached value equals the bill share.
 *
 * SharePaid has no recipient field. The recipient is the fixed recipient in
 * `getBill(billId)` on the runtime-pinned contract, never an event field.
 */
import {
  decodeFunctionData,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type PublicClient,
} from 'viem'
import { SPLIT_RECEIPT_HUMAN_ABI } from './splitReceiptAbi.ts'
import { type Address, type Hash32 } from './networks.ts'

export type PaymentClient = Pick<PublicClient, 'getTransaction' | 'getTransactionReceipt'>

export type PaymentVerification =
  | { ok: true }
  | { ok: false; reason: string; transient: boolean }

const lc = (s: string) => s.toLowerCase()

export async function verifyPaymentTransaction(
  client: PaymentClient,
  input: { contract: Address; billId: bigint; payer: string; amount: bigint; hash: Hash32 },
): Promise<PaymentVerification> {
  const { contract, billId, payer, amount, hash } = input

  let tx: Awaited<ReturnType<PaymentClient['getTransaction']>>
  let receipt: Awaited<ReturnType<PaymentClient['getTransactionReceipt']>>
  try {
    ;[tx, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ])
  } catch (err) {
    if (err instanceof TransactionNotFoundError || err instanceof TransactionReceiptNotFoundError) {
      return { ok: false, reason: 'Transaction not found.', transient: false }
    }
    return { ok: false, reason: 'Could not read the payment transaction.', transient: true }
  }

  if (receipt.status !== 'success') return { ok: false, reason: 'Payment did not succeed.', transient: false }
  if (lc(tx.hash) !== lc(hash) || lc(receipt.transactionHash) !== lc(hash)) {
    return { ok: false, reason: 'Transaction hash mismatch.', transient: false }
  }
  if (!tx.blockHash || lc(tx.blockHash) !== lc(receipt.blockHash)) {
    return { ok: false, reason: 'Transaction and receipt are in different blocks.', transient: false }
  }
  if (!tx.to || lc(tx.to) !== lc(contract)) {
    return { ok: false, reason: 'Payment did not call the pinned contract.', transient: false }
  }
  if (lc(tx.from) !== lc(payer) || lc(receipt.from) !== lc(payer)) {
    return { ok: false, reason: 'Payment was not sent by the listed payer.', transient: false }
  }
  if (tx.value !== amount) return { ok: false, reason: 'Payment value is not the bill share.', transient: false }

  try {
    const decoded = decodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, data: tx.input })
    if (decoded.functionName !== 'payShare' || !decoded.args || (decoded.args[0] as bigint) !== billId) {
      return { ok: false, reason: 'Payment call is for a different bill.', transient: false }
    }
  } catch {
    return { ok: false, reason: 'Payment data is not a SplitReceipt call.', transient: false }
  }
  return { ok: true }
}
