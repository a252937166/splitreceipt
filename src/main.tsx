import React from 'react'
import ReactDOM from 'react-dom/client'
import Entry from './Entry.tsx'
import './index.css'

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
      {/* No wallet provider here: the wagmi provider and its config load lazily with the app side (Entry.tsx). */}
      <Entry />
    </React.StrictMode>,
  )
}

void boot()
