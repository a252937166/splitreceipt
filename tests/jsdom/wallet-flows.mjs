// Optional DOM-level checks (jsdom, real RPC reads, fake EIP-1193 wallet). jsdom is NOT a project
// dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the project root:
//   node tests/jsdom/<file>.mjs
// This is not a real browser. It runs React effects, events and focus in a simulated DOM only.
import { boot, sleep } from './harness.mjs'

const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const OTHER = '0x3333333333333333333333333333333333333333'

function makeWallet({ chainHex }) {
  const listeners = {}
  const state = { account: A, chainHex, sends: [], armed: false, onAccounts: null, requests: [] }
  const provider = {
    on(e, h) { (listeners[e] ??= new Set()).add(h) },
    removeListener(e, h) { listeners[e]?.delete(h) },
    async request({ method, params }) {
      state.requests.push(method)
      switch (method) {
        case 'eth_requestAccounts': return [state.account]
        case 'eth_accounts': if (state.armed && state.onAccounts) await state.onAccounts(); return [state.account]
        case 'eth_chainId': return state.chainHex
        case 'eth_sendTransaction': state.sends.push(params[0]); return '0x' + 'ab'.repeat(32)
        case 'wallet_switchEthereumChain': state.chainHex = params[0].chainId; emit('chainChanged', state.chainHex); return null
        default: { const e = new Error('unsupported ' + method); e.code = -32601; throw e }
      }
    },
  }
  const emit = (e, ...a) => { for (const h of [...(listeners[e] ?? [])]) h(...a) }
  return { provider, state, emit }
}

const click = (w, text) => {
  const b = [...w.document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(text) && !x.disabled)
  if (!b) throw new Error('no button: ' + text)
  b.click()
}
const setValue = (w, el, value) => {
  const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set
  setter.call(el, value)
  el.dispatchEvent(new w.Event('input', { bubbles: true }))
}
const fillForm = (w) => {
  const d = w.document
  setValue(w, d.getElementById('title'), 'Browser-like test')
  setValue(w, d.getElementById('recipient'), OTHER)
  setValue(w, d.getElementById('share'), '0.001')
  setValue(w, d.querySelector('input[aria-label="Payer 1 address"]'), A)
  setValue(w, d.querySelector('input[aria-label="Payer 2 address"]'), B)
}
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra) }

async function connect(app, wallet) {
  const { w } = app
  click(w, 'Connect wallet')
  await sleep(300)
  const dialog = w.document.querySelector('[role="dialog"]')
  check('dialog opens and takes focus', !!dialog && dialog.contains(w.document.activeElement))
  click(w, 'Test Wallet')
  await sleep(1500)
  check('wallet connected and shown', app.text().includes('0x1111…1111'))
  check('dialog closed after connect', !w.document.querySelector('[role="dialog"]'))
}

// ── Scenario 1: dialog keyboard + happy path reaches the wallet exactly once ──
{
  const wallet = makeWallet({ chainHex: '0x4cef52' })
  const app = await boot({ search: '?network=testnet', provider: wallet.provider })
  const { w } = app
  await sleep(1500)
  const trigger = [...w.document.querySelectorAll('button')].find((b) => b.textContent.includes('Connect wallet'))
  trigger.click(); await sleep(300)
  const dlg = w.document.querySelector('[role="dialog"]')
  const items = dlg.querySelectorAll('button')
  items[items.length - 1].focus()
  dlg.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
  check('Tab from last control wraps inside the dialog', dlg.contains(w.document.activeElement) && w.document.activeElement === items[0])
  dlg.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
  check('Shift+Tab from first wraps to last', w.document.activeElement === items[items.length - 1])
  dlg.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await sleep(100)
  check('Escape closes the dialog', !w.document.querySelector('[role="dialog"]'))
  check('Escape returns focus to the opening button', w.document.activeElement === trigger)
  trigger.click(); await sleep(200)
  w.document.body.dispatchEvent(new w.Event('pointerdown', { bubbles: true }))
  await sleep(100)
  check('outside pointer press closes the dialog', !w.document.querySelector('[role="dialog"]'))
  check('no wallet request before the user chooses a wallet', wallet.state.requests.length === 0, wallet.state.requests.join(','))

  await connect(app, wallet)
  fillForm(w); await sleep(100)
  wallet.state.requests.length = 0
  click(w, 'Create bill'); await sleep(6000)
  check('guard passed: exactly one wallet request', wallet.state.sends.length === 1, JSON.stringify(wallet.state.sends.map((s) => ({ from: s.from, to: s.to, value: s.value }))))
  const asked = wallet.state.requests
  check('fresh eth_chainId and eth_accounts were requested before the send', asked.indexOf('eth_chainId') >= 0 && asked.indexOf('eth_accounts') >= 0 && asked.indexOf('eth_accounts') < asked.indexOf('eth_sendTransaction'), asked.join(','))
  check('sent to the pinned testnet contract from the connected account', wallet.state.sends[0]?.to?.toLowerCase() === '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26' && wallet.state.sends[0]?.from?.toLowerCase() === A)
  check('no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 3)))
  await app.stop()
}

// ── Scenario 2: account goes A -> B -> A while eth_accounts is pending ──
{
  const wallet = makeWallet({ chainHex: '0x4cef52' })
  const app = await boot({ search: '?network=testnet', provider: wallet.provider })
  const { w } = app
  await sleep(1500)
  await connect(app, wallet)
  fillForm(w); await sleep(100)
  wallet.state.onAccounts = async () => {
    wallet.state.account = B; wallet.emit('accountsChanged', [B]); await sleep(150)
    wallet.state.account = A; wallet.emit('accountsChanged', [A]); await sleep(150)
  }
  wallet.state.armed = true
  click(w, 'Create bill'); await sleep(6000)
  check('A -> B -> A during the check: wallet request never made', wallet.state.sends.length === 0, 'sends=' + wallet.state.sends.length)
  check('user told nothing was sent', app.text().includes('Nothing was sent'))
  await app.stop()
}

// ── Scenario 3: provider chain changes and returns while pending ──
{
  const wallet = makeWallet({ chainHex: '0x4cef52' })
  const app = await boot({ search: '?network=testnet', provider: wallet.provider })
  const { w } = app
  await sleep(1500)
  await connect(app, wallet)
  fillForm(w); await sleep(100)
  wallet.state.onAccounts = async () => {
    wallet.emit('chainChanged', '0x1'); await sleep(100)
    wallet.emit('chainChanged', '0x4cef52'); await sleep(100)
  }
  wallet.state.armed = true
  click(w, 'Create bill'); await sleep(6000)
  check('chain away and back during the check: no wallet request', wallet.state.sends.length === 0)
  await app.stop()
}

// ── Scenario 4: navigation A -> B -> A while pending ──
{
  const wallet = makeWallet({ chainHex: '0x4cef52' })
  const app = await boot({ search: '?network=testnet', provider: wallet.provider })
  const { w } = app
  await sleep(1500)
  await connect(app, wallet)
  fillForm(w); await sleep(100)
  wallet.state.onAccounts = async () => {
    app.epochs.page.bump(); app.epochs.page.bump() // page went to another bill and came back
  }
  wallet.state.armed = true
  click(w, 'Create bill'); await sleep(6000)
  check('page A -> B -> A during the check: no wallet request', wallet.state.sends.length === 0)
  await app.stop()
}

// ── Scenario 5: wallet on the wrong network is refused / offered a switch ──
{
  const wallet = makeWallet({ chainHex: '0x1' })
  const app = await boot({ search: '?network=testnet', provider: wallet.provider })
  const { w } = app
  await sleep(1500)
  await connect(app, wallet)
  check('wrong network badge visible', app.text().includes('Wrong network'))
  fillForm(w); await sleep(100)
  check('CTA offers a network switch', [...w.document.querySelectorAll('button')].some((b) => b.textContent.includes('Switch to Arc Testnet')))
  check('no send happened', wallet.state.sends.length === 0)
  await app.stop()
}

console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length)
process.exit(0)
