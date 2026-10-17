import { createConfig, http } from 'wagmi'
import { injected } from '@wagmi/core'
import { defineChain } from 'viem'

/** The public app and every write hook are restricted to this test network. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Test USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Testnet Explorer', url: 'https://explorer.testnet.arc.io' } },
  testnet: true,
})

export const config = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  multiInjectedProviderDiscovery: true,
  transports: { [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]) },
})
