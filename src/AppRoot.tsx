/**
 * The wallet-and-chain side of the app: the wagmi provider, its config, the query client, the toaster and the
 * app views. It is loaded lazily by `Entry.tsx`, so nothing here (and therefore no wallet discovery) runs for
 * the bare homepage. Wallets are still discovered per EIP-6963 only, never reconnected automatically, and
 * connected only by an explicit choice in the wallet menu.
 */
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import AppView from './App'
import { config } from './config'

const queryClient = new QueryClient()

export default function AppRoot({
  appSearch,
  go,
  goHome,
}: {
  appSearch: string
  go: (next: string) => void
  goHome: () => void
}) {
  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <AppView appSearch={appSearch} go={go} goHome={goHome} />
        <Toaster position="bottom-center" />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
