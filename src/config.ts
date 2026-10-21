import { createConfig, http } from 'wagmi'
import { EXPLICIT_WALLET_CONFIG } from './walletPolicy'
import { defineChain } from 'viem'
import { NETWORK_FACTS } from './networkContext'
import { activeNetwork } from './activeNetwork'

const testnet = NETWORK_FACTS.testnet
const mainnet = NETWORK_FACTS.mainnet
export const arcTestnet = defineChain({
  id: testnet.chainId, name: testnet.name,
  nativeCurrency: { name: 'Test USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [testnet.rpcUrl] } },
  blockExplorers: { default: { name: 'Arc Testnet Explorer', url: testnet.explorerBase } },
  testnet: true,
})
export const arcMainnet = defineChain({
  id: mainnet.chainId, name: mainnet.name,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [mainnet.rpcUrl] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: mainnet.explorerBase } },
  testnet: false,
})
export const activeChain = activeNetwork.key === 'mainnet' ? arcMainnet : arcTestnet
export const config = createConfig({
  // Testnet remains first; every app action also supplies its explicit immutable chainId.
  chains: [arcTestnet, arcMainnet],
  ...EXPLICIT_WALLET_CONFIG,
  transports: { [arcTestnet.id]: http(testnet.rpcUrl), [arcMainnet.id]: http(mainnet.rpcUrl) },
})
