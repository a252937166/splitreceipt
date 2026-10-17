/**
 * Formatting helpers for Arc native USDC amounts.
 *
 * Arc stores shares as 18-decimal native units (1 USDC = 1e18).
 * The ERC-20 view is 6 decimals (1 USDC = 1e6).
 * The scale factor between them is 1e12.
 *
 * All maths here is pure bigint — no floating point anywhere.
 */

const SCALE = 10n ** 12n        // native-18 → erc20-6
const ONE_USDC_NATIVE = 10n ** 18n
const MAX_6DP = 10n ** 6n

/**
 * Convert a 18-decimal native bigint to a human-readable USDC string.
 *  - Up to 6 decimal places, trailing zeros trimmed.
 *  - A positive raw value NEVER rounds to "0" — if it rounds to zero
 *    at 6 dp we show the minimum representable value instead ("0.000001").
 */
export function fmtNativeUsdc(raw: bigint): string {
  if (raw === 0n) return '0'

  // Convert to 6-dp integer units (truncate, not round — safer for display)
  const sixDp = raw / SCALE           // 1 USDC = 1_000_000 sixDp units

  // Guard: positive raw that truncates to 0 at 6dp → show minimum
  if (sixDp === 0n) {
    return raw > 0n ? '< 0.000001' : '0'
  }

  const whole = sixDp / MAX_6DP       // integer dollars
  const frac  = sixDp % MAX_6DP       // fractional part as 6-digit integer

  if (frac === 0n) return whole.toString()

  // Pad fraction to 6 digits then trim trailing zeros
  const fracStr = frac.toString().padStart(6, '0')
  const trimmed = fracStr.replace(/0+$/, '')
  return `${whole}.${trimmed}`
}

/**
 * Parse a human USDC decimal string (e.g. "10.50") into a native 18-decimal bigint.
 * Accepts up to 6 decimal places. Throws a plain string on bad input.
 *
 * This is the single place where user text becomes a transaction value.
 */
export function parseUsdcToNative(text: string): bigint {
  const trimmed = text.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Not a valid decimal number')

  const [wholePart, fracPart = ''] = trimmed.split('.')

  if (fracPart.length > 6) throw new Error('Too many decimal places (max 6)')

  // Pad fraction to exactly 6 digits to get the 6-dp integer
  const fracPadded = fracPart.padEnd(6, '0')
  const sixDp = BigInt(wholePart) * MAX_6DP + BigInt(fracPadded)

  if (sixDp === 0n) throw new Error('Amount must be greater than zero')

  // Scale up to 18-decimal native
  return sixDp * SCALE
}

/**
 * Validate a USDC input string for use in CreateBill:
 *  - Non-empty, positive number
 *  - At most 6 decimal places
 * Returns null on valid, an error string on invalid.
 */
export function validateUsdcInput(text: string): string | null {
  if (!text.trim()) return 'Amount is required'
  if (!/^\d+(\.\d+)?$/.test(text.trim())) return 'Enter a plain decimal number (e.g. 10.50)'
  const [, frac = ''] = text.trim().split('.')
  if (frac.length > 6) return 'Maximum 6 decimal places'
  try {
    parseUsdcToNative(text)
    return null
  } catch (e) {
    return (e as Error).message
  }
}

export { ONE_USDC_NATIVE }
