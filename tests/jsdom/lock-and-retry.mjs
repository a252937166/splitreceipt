// Optional DOM-level checks (jsdom, fake EIP-1193 wallet, emulated JSON-RPC for a fake bill). jsdom is NOT a
// project dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the project root:
//   node tests/jsdom/lock-and-retry.mjs
// Covers: the submitted-intent lock in BillDetails and CreateBill (timeout -> try again -> zero second wallet
// request -> definitive reconciliation -> explicit retry), and the receipt retry after a last-page outage.
// Real RPC is used for the contract's runtime code only. Not a real browser. No real wallet or transaction.
import { encodeEventTopics, encodeAbiParameters, encodeFunctionData, encodeFunctionResult, toHex, parseAbi } from 'viem'
process.env.VITE_RECEIPT_WAIT_MS = '4000' // shorten the receipt wait so a timeout is observable in seconds
const { boot, sleep } = await import('./harness.mjs')

const ABI = parseAbi([
  'function payShare(uint256 billId) payable',
  'function createBill(string title, address recipient, address[] payers, uint256 share) returns (uint256 billId)',
  'function getBill(uint256 billId) view returns (string title, address recipient, address[] payers, uint256 share, bool[] paidStates)',
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
])
const C1 = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
const C2 = '0xb168fcf0698c65fb0d516a35d97c44dcc06cb440'
const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const R = '0x3333333333333333333333333333333333333333'
const SHARE = 1_000_000_000_000_000n
const SUBMITTED = '0x' + 'ab'.repeat(32)
const LOGTX = '0x' + 'ee'.repeat(32)
const BH = '0x' + 'cd'.repeat(32)
const REAL_RPC = 'https://rpc.testnet.arc.io'
const realFetch = globalThis.fetch
const HEAD = 100_000_000n
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra) }
const zero = '0x' + '00'.repeat(32)

function emulator(cfg) {
  const st = { mode: cfg.mode ?? 'timeout', rpc: [], paid: cfg.paid ?? [false, false] }
  const blockObj = (n) => ({ number: toHex(n), hash: BH, parentHash: zero, timestamp: '0x1', transactions: [], gasLimit: '0x1', gasUsed: '0x0', miner: A, nonce: '0x0000000000000000', difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', logsBloom: '0x' + '00'.repeat(256), sha3Uncles: zero, stateRoot: zero, receiptsRoot: zero, transactionsRoot: zero, size: '0x1', uncles: [], baseFeePerGas: '0x1', mixHash: zero })
  const txFor = (hash) => {
    if (hash === LOGTX) return { from: B, to: cfg.contract, value: toHex(SHARE), input: encodeFunctionData({ abi: ABI, functionName: 'payShare', args: [cfg.billId] }), logs: 'pay', payer: B }
    if (st.mode === 'cancelled') return { from: A, to: A, value: '0x0', input: '0x', logs: 'none' }
    if (cfg.kind === 'create') return { from: A, to: cfg.contract, value: '0x0', input: cfg.createInput, logs: 'none' }
    return { from: A, to: cfg.contract, value: toHex(SHARE), input: encodeFunctionData({ abi: ABI, functionName: 'payShare', args: [cfg.billId] }), logs: 'pay', payer: A }
  }
  const payLog = (hash, payer, bn) => ({ address: cfg.contract, removed: false, logIndex: '0x0', transactionHash: hash, transactionIndex: '0x0', blockHash: BH, blockNumber: toHex(bn), topics: encodeEventTopics({ abi: ABI, eventName: 'SharePaid', args: { billId: cfg.billId, payer } }), data: encodeAbiParameters([{ type: 'uint256' }], [SHARE]) })
  const answer = (m, p, id) => {
    const down = () => ({ jsonrpc: '2.0', id, error: { code: -32000, message: 'node unavailable' } })
    switch (m) {
      case 'eth_blockNumber': return cfg.head ? toHex(cfg.head) : undefined
      case 'eth_call':
        if (p[0].to?.toLowerCase() === cfg.contract && p[0].data?.startsWith(encodeFunctionData({ abi: ABI, functionName: 'getBill', args: [cfg.billId] }).slice(0, 10))) {
          return encodeFunctionResult({ abi: ABI, functionName: 'getBill', result: ['Fake bill', R, [A, B], SHARE, st.paid] })
        }
        return undefined
      case 'eth_getLogs': {
        if (!cfg.logBlock) return undefined
        const f = BigInt(p[0].fromBlock), t = BigInt(p[0].toBlock)
        return cfg.logBlock >= f && cfg.logBlock <= t ? [payLog(LOGTX, B, cfg.logBlock)] : []
      }
      case 'eth_getTransactionByHash':
      case 'eth_getTransactionReceipt': {
        if (p[0] !== SUBMITTED && p[0] !== LOGTX) return undefined
        if (st.mode === 'timeout' || st.mode === 'down') return down()
        const t = txFor(p[0]); const bn = p[0] === LOGTX ? cfg.logBlock : 100n
        if (m === 'eth_getTransactionByHash') return { blockHash: BH, blockNumber: toHex(bn), transactionIndex: '0x0', hash: p[0], from: t.from, to: t.to, value: t.value, input: t.input, nonce: '0x1', gas: '0x5208', gasPrice: '0x1', maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x0', type: '0x2', chainId: toHex(5042002), v: '0x0', r: zero, s: zero, yParity: '0x0', accessList: [] }
        if (st.mode === 'good' && p[0] === SUBMITTED) st.paid = [true, false]
        return { blockHash: BH, blockNumber: toHex(bn), transactionIndex: '0x0', transactionHash: p[0], from: t.from, to: t.to, status: '0x1', logs: t.logs === 'pay' ? [payLog(p[0], t.payer, bn)] : [], contractAddress: null, cumulativeGasUsed: '0x5208', gasUsed: '0x5208', effectiveGasPrice: '0x1', logsBloom: '0x' + '00'.repeat(256), type: '0x2' }
      }
      case 'eth_getBlockByNumber': return blockObj(BigInt(p[0]))
      default: return undefined
    }
  }
  globalThis.fetch = async (url, init) => {
    if (typeof url === 'string' && url.startsWith(REAL_RPC) && init?.body) {
      const body = JSON.parse(init.body)
      if (!Array.isArray(body)) {
        st.rpc.push(body.method)
        const r = answer(body.method, body.params ?? [], body.id)
        if (r !== undefined) {
          const payload = r && r.error ? r : { jsonrpc: '2.0', id: body.id, result: r }
          return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
        }
      }
    }
    return realFetch(url, init)
  }
  return st
}

function makeWallet() {
  const sends = []
  const provider = {
    on() {}, removeListener() {},
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [A]
      if (method === 'eth_chainId') return '0x4cef52'
      if (method === 'eth_sendTransaction') { sends.push(params[0]); return SUBMITTED }
      const e = new Error('unsupported ' + method); e.code = -32601; throw e
    },
  }
  return { provider, sends }
}
const buttons = (w) => [...w.document.querySelectorAll('button')]
const click = (w, text, { force = false } = {}) => {
  const b = buttons(w).find((x) => x.textContent.trim().includes(text) && (force || !x.disabled))
  if (!b) throw new Error('no button: ' + text)
  if (force) b.removeAttribute('disabled')
  b.click()
}
const has = (w, text) => buttons(w).some((b) => b.textContent.includes(text))
const setValue = (w, el, value) => {
  Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new w.Event('input', { bubbles: true }))
}
const connect = async (app) => { click(app.w, 'Connect wallet'); await sleep(200); click(app.w, 'Test Wallet'); await sleep(1500) }

// ── C1: BillDetails — sent timeout keeps the lock; no Dismiss; forced attempts send nothing; definitive result unlocks ──
{
  const chain = emulator({ contract: C1, billId: 99n, mode: 'timeout' })
  const wallet = makeWallet()
  const app = await boot({ search: '?bill=99', provider: wallet.provider })
  const { w } = app
  await sleep(2500); await connect(app)
  click(w, 'Pay 0.001 USDC'); await sleep(7000)
  if (process.env.DEBUG_TEXT) console.log('DEBUG', wallet.sends.length, chain.rpc.slice(-12).join(','), app.text().slice(-700), JSON.stringify(app.errors.slice(0,2)))
  check('[pay] one wallet request, then sent-unverified', wallet.sends.length === 1 && app.text().includes('Sent, but the result is not verified yet'))
  check('[pay] no Dismiss / Start over control exists', !has(w, 'Dismiss') && !has(w, 'Start over'))
  check('[pay] Check again and the explorer link stay visible', has(w, 'Check again') && !![...w.document.querySelectorAll('a')].find((a) => a.href.includes(SUBMITTED)))
  const payBtn = buttons(w).find((b) => /Waiting for the sent payment/.test(b.textContent))
  check('[pay] Pay is disabled and says it is waiting', !!payBtn && payBtn.disabled)
  // React ignores clicks on a disabled button, so call the button's own onClick prop: the handler itself must refuse.
  const propsKey = Object.keys(payBtn).find((k) => k.startsWith('__reactProps'))
  payBtn[propsKey].onClick(); await sleep(1500)
  check('[pay] forced attempt: still ZERO second wallet request', wallet.sends.length === 1)
  check('[pay] forced attempt shows the refusal notice', app.text().includes('still being verified'))
  chain.mode = 'cancelled'
  click(w, 'Check again'); await sleep(6000)
  check('[pay] definitive reconciliation: not-completed message', app.text().includes('did not pay your share'))
  check('[pay] lock released: Pay is enabled for an explicit retry', buttons(w).some((b) => /Pay 0\.001 USDC/.test(b.textContent) && !b.disabled))
  check('[pay] no automatic resubmission', wallet.sends.length === 1)
  click(w, 'Pay 0.001 USDC'); await sleep(6000)
  check('[pay] explicit retry sends exactly one more request', wallet.sends.length === 2)
  check('[pay] no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))
  await app.stop(); globalThis.fetch = realFetch
}

// ── C2: BillDetails — timeout then the payment confirms: verified releases the lock ──
{
  const chain = emulator({ contract: C1, billId: 99n, mode: 'timeout' })
  const wallet = makeWallet()
  const app = await boot({ search: '?bill=99', provider: wallet.provider })
  const { w } = app
  await sleep(2500); await connect(app)
  click(w, 'Pay 0.001 USDC'); await sleep(7000)
  chain.mode = 'good'
  click(w, 'Check again'); await sleep(6000)
  check('[pay] later recovery: verified', app.text().includes('Payment verified on the chain'))
  check('[pay] sends stayed at 1', wallet.sends.length === 1)
  await app.stop(); globalThis.fetch = realFetch
}

// ── C3: CreateBill — sent timeout, second form submit sends nothing, definitive result unlocks ──
{
  const createInput = encodeFunctionData({ abi: ABI, functionName: 'createBill', args: ['Lock test', R, [A, B], SHARE] })
  const chain = emulator({ contract: C1, billId: 99n, mode: 'timeout', kind: 'create', createInput })
  const wallet = makeWallet()
  const app = await boot({ search: '?network=testnet', provider: wallet.provider })
  const { w } = app
  await sleep(1500); await connect(app)
  const fill = () => {
    const d = w.document
    setValue(w, d.getElementById('title'), 'Lock test'); setValue(w, d.getElementById('recipient'), R); setValue(w, d.getElementById('share'), '0.001')
    setValue(w, d.querySelector('input[aria-label="Payer 1 address"]'), A); setValue(w, d.querySelector('input[aria-label="Payer 2 address"]'), B)
  }
  fill(); await sleep(100)
  click(w, 'Create bill'); await sleep(7000)
  check('[create] one wallet request, then sent-unverified', wallet.sends.length === 1 && app.text().includes('Sent, but the result is not verified yet'))
  check('[create] no Start over / Dismiss control exists', !has(w, 'Start over') && !has(w, 'Dismiss'))
  // A visit to the homepage must not discard the submitted-intent lock: the app stays mounted but hidden.
  click(w, 'SplitReceipt'); await sleep(500)
  check('[create] homepage visit: the homepage shows', app.text().includes('Split the bill. Keep the proof.'))
  // The settled example is a separate-tab link: following it must not navigate or remount the held app.
  const settledLinks = [...w.document.querySelectorAll('a')].filter((x) => x.textContent.includes('View a settled bill') || x.textContent.includes('Open Bill 1 in the app'))
  let observedPrevented = null
  w.document.addEventListener('click', (e) => { observedPrevented = e.defaultPrevented; e.preventDefault() }, { once: true })
  settledLinks[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await sleep(300)
  check('[create] settled example: new-tab anchors, click not intercepted, held app untouched', settledLinks.length === 2 && settledLinks.every((x) => x.target === '_blank' && /noopener/.test(x.rel)) && observedPrevented === false && w.location.search === '')
  click(w, 'Open app'); await sleep(500)
  check('[create] after the homepage visit the sent transaction is still held with Check again', app.text().includes('Sent, but the result is not verified yet') && has(w, 'Check again'))
  const form = w.document.querySelector('form')
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await sleep(1500) // e.g. pressing Enter
  check('[create] form submit while locked: ZERO second wallet request', wallet.sends.length === 1)
  check('[create] refusal notice shown', app.text().includes('still being verified'))
  chain.mode = 'cancelled'
  click(w, 'Check again'); await sleep(6000)
  check('[create] definitive: did not create the bill', app.text().includes('did not create the bill'))
  check('[create] no automatic resubmission', wallet.sends.length === 1)
  click(w, 'Create bill'); await sleep(6000)
  check('[create] explicit retry after reconciliation sends one more', wallet.sends.length === 2)
  check('[create] no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))
  await app.stop(); globalThis.fetch = realFetch
}

// ── B: last logs page found, receipt RPC fails: the retry button stays enabled, then a verified proof appears ──
{
  const FLOOR = HEAD - 50_000n
  const chain = emulator({ contract: C2, billId: 99n, mode: 'down', paid: [false, true], head: HEAD, logBlock: FLOOR + 10n })
  const app = await boot({ search: `?contract=${C2}&bill=99` })
  const { w } = app
  await sleep(3500)
  check('[history] fake bill with one paid share and no receipt yet', app.text().includes('Fake bill') && app.text().includes('1 of 2 paid') && has(w, 'Find missing receipts'))
  click(w, 'Find missing receipts'); await sleep(6000)
  check('[history] after the outage the retry button is VISIBLE and ENABLED', buttons(w).some((b) => /Retry receipt check/.test(b.textContent) && !b.disabled), buttons(w).map((b) => b.textContent.trim()).filter((t) => /receipt|History/.test(t)).join('|'))
  check('[history] not shown as "History searched"', !has(w, 'History searched'))
  chain.mode = 'good'
  click(w, 'Retry receipt check'); await sleep(6000)
  check('[history] recovery: verified receipt link for the paid payer', !![...w.document.querySelectorAll('a')].find((a) => a.href.includes(LOGTX)))
  check('[history] no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))
  await app.stop(); globalThis.fetch = realFetch
}
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length)
process.exit(0)
