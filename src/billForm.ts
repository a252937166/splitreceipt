/**
 * Validation of the create-bill form. Produces the exact `IntendedBill` that is
 * both sent to the wallet and later compared with the mined transaction.
 */
import { parseUsdcToNative } from './usdcFormat.ts'
import { ADDRESS_RE, type Address } from './networks.ts'
import type { IntendedBill } from './createBillReceipt.ts'

export const MAX_TITLE_BYTES = 80
export const MIN_PAYERS = 2
export const MAX_PAYERS = 5
const ZERO = '0x0000000000000000000000000000000000000000'

export interface BillFormValues {
  title: string
  recipient: string
  payers: readonly string[]
  share: string
}

export interface BillFormErrors {
  title?: string
  recipient?: string
  share?: string
  payers?: (string | undefined)[]
  form?: string
}

/** The contract limits the title by UTF-8 bytes, not characters. */
export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length
}

export function validateBillForm(
  values: BillFormValues,
): { ok: true; intended: IntendedBill } | { ok: false; errors: BillFormErrors } {
  const errors: BillFormErrors = {}
  const title = values.title.trim()

  if (!title) errors.title = 'Give the bill a title.'
  else if (utf8ByteLength(title) > MAX_TITLE_BYTES) {
    errors.title = `Title is over ${MAX_TITLE_BYTES} bytes (${utf8ByteLength(title)}).`
  }

  const recipient = values.recipient.trim()
  if (!ADDRESS_RE.test(recipient)) errors.recipient = 'Enter a full 0x recipient address.'
  else if (recipient.toLowerCase() === ZERO) errors.recipient = 'The recipient cannot be the zero address.'

  const payers = values.payers.map((p) => p.trim())
  if (payers.length < MIN_PAYERS || payers.length > MAX_PAYERS) {
    errors.form = `A bill needs ${MIN_PAYERS} to ${MAX_PAYERS} payers.`
  }
  const payerErrors: (string | undefined)[] = payers.map((p) => {
    if (!ADDRESS_RE.test(p)) return 'Enter a full 0x address.'
    if (p.toLowerCase() === ZERO) return 'The zero address cannot pay.'
    return undefined
  })
  const seen = new Map<string, number>()
  payers.forEach((p, i) => {
    const key = p.toLowerCase()
    if (!ADDRESS_RE.test(p)) return
    if (seen.has(key)) payerErrors[i] = 'Duplicate payer.'
    else seen.set(key, i)
  })
  if (payerErrors.some(Boolean)) errors.payers = payerErrors

  let share = 0n
  try {
    share = parseUsdcToNative(values.share)
  } catch (e) {
    errors.share = (e as Error).message
  }

  if (errors.title || errors.recipient || errors.share || errors.payers || errors.form) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    intended: {
      title,
      recipient: recipient as Address,
      payers: payers as Address[],
      share,
    },
  }
}
