/** The optional configured Testnet address (VITE_SPLIT_RECEIPT_ADDRESS). Only honoured when it names a reviewed deployment. */
export function readEnvAddress(): string | undefined {
  const raw = import.meta.env.VITE_SPLIT_RECEIPT_ADDRESS as string | undefined
  return raw && raw.length > 0 ? raw : undefined
}
