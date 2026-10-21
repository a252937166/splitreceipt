import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WalletProvider } from './wallet-ui'
import { Toaster } from 'sonner'
import App from './App.tsx'
import { config } from './config.ts'
import { WALLET_RECONNECT_ON_MOUNT } from './walletPolicy'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config} reconnectOnMount={WALLET_RECONNECT_ON_MOUNT}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <App />
          <Toaster position="bottom-center" />
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
