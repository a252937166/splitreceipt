/** Public Arc facts; native gas/payment USDC uses 18 decimals, independently of ERC-20 views. */
import { ARC_MAINNET_CHAIN_ID, ARC_TESTNET_CHAIN_ID, NETWORK_FACTS } from './networkContext'

export interface OnchainChain {
  chainId: number
  name: string
  isTestnet: boolean
  explorerBase: string
  rpcUrls: string[]
  nativeCurrency: { symbol: string; decimals: number; isUsdc: true }
  /** ERC-20 transfers are not used by SplitReceipt; a mainnet view address is not assumed. */
  usdc: { symbol: string; address: string | null; decimals: number }
}
export function requireChain(chainId: number): OnchainChain {
  const network = chainId === ARC_TESTNET_CHAIN_ID ? NETWORK_FACTS.testnet :
    chainId === ARC_MAINNET_CHAIN_ID ? NETWORK_FACTS.mainnet : null
  if (!network) throw new Error('Unsupported network. SplitReceipt recognizes Arc Testnet (5042002) and Arc Mainnet (5042).')
  return { chainId: network.chainId, name: network.name, isTestnet: network.isTestnet,
    explorerBase: network.explorerBase, rpcUrls: [network.rpcUrl],
    nativeCurrency: { symbol: 'USDC', decimals: 18, isUsdc: true },
    usdc: { symbol: 'USDC', address: network.isTestnet ? '0x3600000000000000000000000000000000000000' : null, decimals: 6 } }
}
