/** Public network facts for this standalone testnet app.
 * Source: https://docs.arc.io/arc/references/connect-to-arc
 * Native gas/payment USDC uses 18 decimals; the ERC-20 view uses 6.
 */
export interface OnchainChain {
  chainId: number
  name: string
  isTestnet: true
  explorerBase: string
  rpcUrls: string[]
  nativeCurrency: { symbol: string; decimals: number; isUsdc: true }
  usdc: { symbol: string; address: string; decimals: number }
}

const ARC_TESTNET: OnchainChain = {
  chainId: 5042002,
  name: 'Arc Testnet',
  isTestnet: true,
  explorerBase: 'https://explorer.testnet.arc.io',
  rpcUrls: ['https://rpc.testnet.arc.io'],
  nativeCurrency: { symbol: 'USDC', decimals: 18, isUsdc: true },
  usdc: { symbol: 'USDC', address: '0x3600000000000000000000000000000000000000', decimals: 6 },
}

/** Reject other chains instead of providing an implicit mainnet fallback. */
export function requireChain(chainId: number): OnchainChain {
  if (chainId !== ARC_TESTNET.chainId) throw new Error('SplitReceipt supports Arc Testnet (5042002) only.')
  return ARC_TESTNET
}
