// Optional DOM-level checks (jsdom, real RPC reads, fake EIP-1193 wallet). jsdom is NOT a project
// dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the project root:
//   node tests/jsdom/<file>.mjs
// This is not a real browser. It runs React effects, events and focus in a simulated DOM only.
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname

export async function boot({ search = '', provider = null, pretty = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/' + search, pretendToBeVisual: true,
  })
  const w = dom.window
  const g = globalThis
  const def = (k, v) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true })
  def('window', w); def('document', w.document); def('navigator', w.navigator)
  for (const k of ['HTMLElement','Node','Event','CustomEvent','KeyboardEvent','MouseEvent','PointerEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','Element','HTMLInputElement','SVGElement']) {
    if (w[k] !== undefined) def(k, w[k])
  }
  w.matchMedia = w.matchMedia ?? (() => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }))
  w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
  w.scrollTo = () => {}
  w.IS_REACT_ACT_ENVIRONMENT = false
  g.IS_REACT_ACT_ENVIRONMENT = false
  w.fetch = g.fetch
  // fake EIP-6963 wallet
  if (provider) {
    w.addEventListener('eip6963:requestProvider', () => {
      w.dispatchEvent(new w.CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({ info: { uuid: '11111111-1111-4111-8111-111111111111', name: 'Test Wallet', icon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', rdns: 'test.wallet' }, provider }),
      }))
    })
  }
  const errors = []
  const origErr = console.error
  console.error = (...a) => { errors.push(a.map(String).join(' ').slice(0, 400)); }
  const server = await createServer({ root: PROJECT_ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { WagmiProvider } = await import('wagmi')
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
  const { config } = await server.ssrLoadModule('/src/config.ts')
  const App = (await server.ssrLoadModule('/src/App.tsx')).default
  const epochMod = await server.ssrLoadModule('/src/epoch.ts')
  const h = React.createElement
  const root = createRoot(document.getElementById('root'))
  root.render(h(React.StrictMode, null, h(WagmiProvider, { config, reconnectOnMount: false }, h(QueryClientProvider, { client: new QueryClient() }, h(App)))))
  const text = () => document.body.textContent.replace(/\s+/g, ' ').trim()
  const stop = async () => { root.unmount(); await server.close(); console.error = origErr }
  return { w, text, errors, stop, config, epochs: epochMod.appEpochs, server }
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
