// Optional DOM-level check (jsdom; install it temporarily and run from the project root:
//   node tests/jsdom/load-recovery.mjs). Mounts the REAL LoadBoundary / CommitMarker with React effects and a lazy
// chunk that fails. Covers: a first-load failure offers an explicit "Reload latest version" button and never reloads
// by itself; a failure after the app has committed offers no reload and does not remount. Not a real browser; the
// real reload is replaced by a spy (jsdom cannot navigate).
const { boot, sleep } = await import('./harness.mjs')
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra) }

const app = await boot({ search: '' })
const { w, server } = app
const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { LoadBoundary, CommitMarker } = await server.ssrLoadModule('/src/loadBoundary.tsx')
const h = React.createElement
const { Suspense, lazy, useState } = React

async function mount(make) {
  const host = w.document.createElement('div')
  w.document.body.appendChild(host)
  const root = createRoot(host)
  const committed = { current: false }
  let reloads = 0
  const reload = () => { reloads += 1 }
  root.render(h(LoadBoundary, { committed, reload }, h(Suspense, { fallback: h('p', null, 'Loading…') }, make(committed))))
  await sleep(400)
  return { host, committed, reloads: () => reloads, text: () => host.textContent.replace(/\s+/g, ' ').trim(), unmount: () => root.unmount() }
}
const buttonByText = (host, t) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(t))

// 1. The lazy chunk itself fails (a newer version replaced it): first-load failure.
{
  const Bad = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
  const m = await mount((committed) => [h(Bad, { key: 'a' }), h(CommitMarker, { key: 'm', committed })])
  const btn = buttonByText(m.host, 'Reload latest version')
  check('[first load] the failure is announced (role=alert) with an explicit "Reload latest version" button', !!btn && !!m.host.querySelector('[role="alert"]'))
  await sleep(600)
  check('[first load] nothing reloaded by itself', m.reloads() === 0)
  check('[first load] the app never committed (marker not run)', m.committed.current === false)
  btn.click(); await sleep(100)
  check('[first load] a user click reloads exactly once', m.reloads() === 1)
  m.unmount()
}

// 2. The chunk loads but the app throws on its first render, before anything committed: still a first-load failure.
{
  const Boom = lazy(() => Promise.resolve({ default: () => { throw new Error('render failed') } }))
  const m = await mount((committed) => [h(Boom, { key: 'a' }), h(CommitMarker, { key: 'm', committed })])
  check('[first render throws] reload is offered, nothing committed', !!buttonByText(m.host, 'Reload latest version') && m.committed.current === false && m.reloads() === 0)
  m.unmount()
}

// 3. The app commits (marker runs), then fails later: no reload action, no remount, no reload.
{
  let mounts = 0
  function App() {
    const [boom, setBoom] = useState(false)
    React.useEffect(() => { mounts += 1 }, [])
    if (boom) throw new Error('later runtime failure')
    return h('button', { onClick: () => setBoom(true) }, 'break it')
  }
  const Good = lazy(() => Promise.resolve({ default: App }))
  const m = await mount((committed) => [h(Good, { key: 'a' }), h(CommitMarker, { key: 'm', committed })])
  check('[after commit] the app rendered and the monotonic marker ran', m.text().includes('break it') && m.committed.current === true)
  buttonByText(m.host, 'break it').click(); await sleep(400)
  check('[after commit] a later failure shows an alert', !!m.host.querySelector('[role="alert"]'))
  check('[after commit] NO "Reload latest version" action is offered', !buttonByText(m.host, 'Reload latest version') && m.host.querySelectorAll('button').length === 0)
  check('[after commit] no reload happened and nothing was remounted', m.reloads() === 0 && mounts === 1)
  check('[after commit] it does not claim a submitted lock survives a reload', !/lock|survive|will be kept/i.test(m.text()) && /cannot promise/.test(m.text()))
  m.unmount()
}

// 4. While the lazy chunk is still pending, the fallback must not mark the app as committed.
{
  let resolve
  const Slow = lazy(() => new Promise((r) => { resolve = () => r({ default: () => h('span', null, 'app ready') }) }))
  const m = await mount((committed) => [h(Slow, { key: 'a' }), h(CommitMarker, { key: 'm', committed })])
  check('[fallback] while pending the fallback shows and the marker has NOT run', m.text() === 'Loading…' && m.committed.current === false)
  resolve(); await sleep(400)
  check('[fallback] once the content commits the marker runs', m.text().includes('app ready') && m.committed.current === true)
  m.unmount()
}

await app.stop()
const failed = results.filter((x) => !x).length
console.log(failed ? `SOME FAILED ${failed}/${results.length}` : `ALL PASS ${results.length}/${results.length}`)
process.exit(failed ? 1 : 0)
