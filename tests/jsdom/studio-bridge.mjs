// Optional DOM-level checks (jsdom, real RPC reads, fake EIP-1193 wallet). jsdom is NOT a project
// dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the project root:
//   node tests/jsdom/<file>.mjs
// This is not a real browser. It runs React effects, events and focus in a simulated DOM only.
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname

async function trial({ url, framed }) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url, pretendToBeVisual: true })
  const w = dom.window
  const g = globalThis
  const def = (k, v) => Object.defineProperty(g, k, { value: v, configurable: true, writable: true })
  def('window', w); def('document', w.document); def('navigator', w.navigator)
  for (const k of ['HTMLElement','Node','Event','CustomEvent','KeyboardEvent','MouseEvent','MutationObserver','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','Element']) if (w[k] !== undefined) def(k, w[k])
  w.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} })
  w.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
  w.scrollTo = () => {}
  g.IS_REACT_ACT_ENVIRONMENT = false
  const messages = []
  w.addEventListener('message', (e) => { if (e.data && typeof e.data.type === 'string') messages.push(e.data) })
  const originalFetch = w.fetch = g.fetch
  const originalConsoleLog = console.log
  const server = await createServer({ root: PROJECT_ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  if (framed) { await server.ssrLoadModule('/src/console-capture.ts'); await server.ssrLoadModule('/src/tracing.ts') }
  await server.ssrLoadModule('/src/main.tsx')
  await new Promise((r) => setTimeout(r, 3000))
  console.log('hello from app')
  await new Promise((r) => setTimeout(r, 300))
  const types = [...new Set(messages.map((m) => m.type))]
  const rootHasApp = document.getElementById('root').textContent.includes('Split a bill')
  const fetchPatched = w.fetch !== originalFetch || g.fetch !== originalFetch
  await server.close()
  return { types, rootHasApp, fetchPatched, count: messages.length }
}
console.log('instrumentation loaded manually + app:', JSON.stringify(await trial({ url: 'https://i06ajohx9kwdf8gtsrbh4.preview.studio.arc.io/', framed: true })))
console.log('app alone (not framed, no bridge)    :', JSON.stringify(await trial({ url: 'https://i06ajohx9kwdf8gtsrbh4.preview.studio.arc.io/', framed: false })))
process.exit(0)
