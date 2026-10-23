import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App.tsx'
import { config } from './config.ts'
import './index.css'

const queryClient = new QueryClient()

async function boot() {
  // Development only, and only inside the Arc Studio preview frame: forwards console
  // output and traces to the Studio panel. `import.meta.env.DEV` is statically false in
  // a production build, so this block and the modules it names are not in `dist/`.
  if (import.meta.env.DEV) {
    try {
      const { startStudioPreviewBridge } = await import('./studio-preview.ts')
      await startStudioPreviewBridge()
    } catch {
      // The preview bridge is optional; the app must start without it.
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <WagmiProvider config={config} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster position="bottom-center" />
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>,
  )
}

void boot()
