import { createConfig, http } from 'wagmi'
import { defineChain } from 'viem'
import { requireChain } from '@/onchain-facts'

function arcChain(chainId: number) {
  const fact = requireChain(chainId)
  return defineChain({
    id: fact.chainId,
    name: fact.name,
    nativeCurrency: {
      name: fact.nativeCurrency.symbol,
      symbol: fact.nativeCurrency.symbol,
      decimals: fact.nativeCurrency.decimals,
    },
    rpcUrls: { default: { http: fact.rpcUrls } },
    blockExplorers: { default: { name: 'Arc Explorer', url: fact.explorerBase } },
    testnet: fact.isTestnet,
  })
}

export const arcTestnetChain = arcChain(5042002)
export const arcMainnetChain = arcChain(5042)

/**
 * Wallets are discovered through EIP-6963, so each installed browser wallet
 * appears under its own name. No generic legacy-global injected connector is added,
 * and connection state is not persisted: the user picks a wallet explicitly
 * every visit. Both Arc networks are configured; which one a page uses comes
 * from its URL context, never from the wallet.
 */
export const config = createConfig({
  chains: [arcTestnetChain, arcMainnetChain],
  transports: {
    [arcTestnetChain.id]: http(arcTestnetChain.rpcUrls.default.http[0]),
    [arcMainnetChain.id]: http(arcMainnetChain.rpcUrls.default.http[0]),
  },
  multiInjectedProviderDiscovery: true,
  storage: null,
})
