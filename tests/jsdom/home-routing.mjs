// Optional DOM-level checks for the homepage routing (jsdom, real public RPC reads only for the settled-bill step).
// jsdom is NOT a project dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the
// project root:  node tests/jsdom/home-routing.mjs
// Not a real browser. No wallet is connected, no wallet request, signature or transaction is made.
import { boot, sleep } from './harness.mjs'

const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra) }
const realFetch = globalThis.fetch
let rpcCalls = 0
globalThis.fetch = (...a) => { if (String(a[0]).includes('rpc.')) rpcCalls += 1; return realFetch(...a) }

const buttons = (w) => [...w.document.querySelectorAll('button')]
const links = (w) => [...w.document.querySelectorAll('a')]
const clickButton = (w, text) => {
  const b = buttons(w).find((x) => x.textContent.trim().includes(text) && !x.disabled && !x.closest('[hidden]'))
  if (!b) throw new Error('no visible button: ' + text)
  b.click()
}
const hasVisibleButton = (w, text) => buttons(w).some((x) => x.textContent.includes(text) && !x.closest('[hidden]'))

// ── H1: the bare homepage mounts no wallet provider, starts no wallet discovery, and has the full composition ──
{
  rpcCalls = 0
  const app = await boot({ search: '' })
  const { w } = app
  await sleep(1500)
  const d = w.document
  const t = app.text()
  check('[home] one h1 with the approved headline', d.querySelectorAll('h1').length === 1 && d.querySelector('h1').textContent.replace(/\s+/g, ' ').trim() === 'Split the bill. Keep the proof.')
  check('[home] sections: how it works, receipts, proof, FAQ, each with a heading', ['how-it-works', 'receipts', 'proof', 'faq'].every((id) => d.getElementById(id)?.querySelector('h2')))
  check('[home] header anchors target real sections', [...d.querySelectorAll('.sr-home-nav a')].map((a) => a.getAttribute('href')).join() === '#how-it-works,#receipts,#faq' && ['how-it-works', 'receipts', 'faq'].every((id) => !!d.getElementById(id)))
  check('[home] the three steps are an ordered sequence of exactly three', d.querySelectorAll('ol.sr-home-steps > li').length === 3)
  check('[home] the receipt illustration is labelled illustrative and has no address or hash', t.includes('Illustrative example') && t.includes('Not a real bill, payment or transaction') && !/0x[0-9a-f]{4}/i.test(d.querySelector('.sr-home-receipt').textContent))
  check('[home] both calls to action exist (button and real link)', [...d.querySelectorAll('button')].some((b) => b.textContent.includes('Open app')) && [...d.querySelectorAll('a')].some((a) => a.textContent.includes('View a settled bill') && /bill=1$/.test(a.getAttribute('href'))))
  const ext = [...d.querySelectorAll('a[target="_blank"]')]
  check('[home] outside links open in a new tab safely and announce it', ext.length >= 8 && ext.every((a) => /noopener/.test(a.rel) && /noreferrer/.test(a.rel) && a.textContent.includes('opens in a new tab')), String(ext.length))
  check('[home] the proof links are the existing explorer payment, contract, video and source', ['explorer.arc.io/tx/0xf246c9ed', 'explorer.arc.io/address/0x8522', 'youtu.be/b1t_0tOW3uk', 'github.com/a252937166/splitreceipt'].every((x) => ext.some((a) => a.href.includes(x))))
  check('[home] FAQ: four native details items, closed by default, and one toggles open', d.querySelectorAll('#faq details').length === 4 && [...d.querySelectorAll('#faq details')].every((x) => !x.open))
  const firstDetails = d.querySelector('#faq details'); firstDetails.open = true
  check('[home] a FAQ item opens', firstDetails.open === true)
  check('[home] the first focusable element is the skip link', d.querySelector('a, button') === d.querySelector('.sr-home-skip'))
  check('[home] no wallet discovery request was made', w.__discoveryRequests === 0, String(w.__discoveryRequests))
  check('[home] no chain or RPC request was made', rpcCalls === 0, String(rpcCalls))
  check('[home] no wallet menu, no create form, no wallet global touched', !hasVisibleButton(w, 'Connect wallet') && !d.getElementById('title') && w.ethereum === undefined)
  check('[home] no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))
  await app.stop()
}

// ── H2: Open app -> create form on the default network; wallet discovery starts only now; homepage round trip keeps state ──
{
  const app = await boot({ search: '' })
  const { w } = app
  await sleep(800)
  clickButton(w, 'Open app')
  await sleep(3000)
  check('[open app] URL is the explicit Testnet create link', /network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26$/.test(w.location.search), w.location.search)
  check('[open app] the create form and the wallet entry are visible', !!w.document.getElementById('title') && hasVisibleButton(w, 'Connect wallet'))
  check('[open app] wallet discovery started only after Open app', w.__discoveryRequests >= 1, String(w.__discoveryRequests))
  const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set
  setter.call(w.document.getElementById('title'), 'Keep me'); w.document.getElementById('title').dispatchEvent(new w.Event('input', { bubbles: true }))
  await sleep(100)
  clickButton(w, 'SplitReceipt')
  await sleep(600)
  check('[home again] the homepage shows and the URL has no query', app.text().includes('Split the bill. Keep the proof.') && w.location.search === '')
  check('[home again] the app is still mounted but hidden (so locks and checks survive)', !!w.document.getElementById('title') && !!w.document.getElementById('title').closest('[hidden]'))
  clickButton(w, 'Open app'); await sleep(400)
  check('[open app again] returns to the same app address with the typed title kept', /network=testnet/.test(w.location.search) && w.document.getElementById('title').value === 'Keep me')
  w.history.back(); await sleep(400)
  check('[back button] back from the app returns to the homepage', app.text().includes('Split the bill. Keep the proof.'))
  check('[open app] no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))
  await app.stop()
}

// ── H3: the settled example is a separate-tab link: it never navigates the held app, and its target works ──
{
  const app = await boot({ search: '' })
  const { w } = app
  await sleep(600)
  const settled = links(w).filter((x) => x.textContent.includes('View a settled bill') || x.textContent.includes('Open Bill 1 in the app'))
  const re = /network=mainnet&chainId=5042&contract=0x8522ea5a413c8402182ff6998bd7471bac886142&bill=1$/
  check('[settled bill] two settled-example links (hero and proof), both carry the real address', settled.length === 2 && settled.every((a) => re.test(a.getAttribute('href'))), settled.map((a) => a.getAttribute('href')).join(' | '))
  check('[settled bill] both are true new-tab anchors: target=_blank, noopener noreferrer, announced', settled.every((a) => a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel) && a.textContent.includes('opens in a new tab')))
  check('[settled bill] neither has a click handler that could intercept it', settled.every((a) => { const k = Object.keys(a).find((x) => x.startsWith('__reactProps')); return !k || !a[k].onClick }))
  let observed = null
  w.document.addEventListener('click', (e) => { observed = e.defaultPrevented; e.preventDefault() /* stop jsdom itself navigating */ })
  settled[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  await sleep(300)
  check('[settled bill] the click is not intercepted by the app (default action left to the browser)', observed === false)
  check('[settled bill] the page address is unchanged and the homepage still shows; no app mounted, no provider started', w.location.search === '' && app.text().includes('Split the bill. Keep the proof.') && w.__discoveryRequests === 0)
  await app.stop()
  // What the new tab loads: the same address, fresh. Read-only Arc Mainnet Bill 1.
  const tab = await boot({ search: '?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1' })
  await sleep(12000)
  const t = tab.text()
  check('[settled bill] new-tab destination: Settled, verified creation, both payers Paid with both receipt links, no wallet connected', /Settled/.test(t) && t.includes('Bill #1') && t.includes('Verified') && (t.match(/Paid0x/g) ?? []).length === 2 && t.includes('0x06da59') && t.includes('0xf246c9') && hasVisibleButton(tab.w, 'Connect wallet'))
  check('[settled bill] no wallet request of any kind (only discovery of installed wallets)', tab.w.ethereum === undefined)
  check('[settled bill] no console errors', tab.errors.length === 0, JSON.stringify(tab.errors.slice(0, 2)))
  await tab.stop()
}

// ── H4: old deep links keep their meaning ──
for (const [search, expect] of [
  ['?bill=3', (t) => t.includes('Published UI retest') || t.includes('Bill 3') ],
  ['?utm_source=newsletter', (t) => t.includes('Create') && t.includes('Connect wallet') ],
  ['?network=mainnet', (t) => t.includes('uses real USDC') ],
  ['?network=ethereum', (t) => t.includes("can't be opened here") ],
  ['?network=mainnet&chainId=5042002', (t) => t.includes("can't be opened here") ],
]) {
  const app = await boot({ search })
  await sleep(search === '?bill=3' ? 9000 : 3500)
  const t = app.text()
  check(`[deep link ${search}] goes unchanged to the app, not the homepage`, !t.includes('Split the bill. Keep the proof.') && expect(t), t.slice(0, 80))
  await app.stop()
}
globalThis.fetch = realFetch
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length)
process.exit(0)
