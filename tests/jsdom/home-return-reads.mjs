// Optional DOM-level check (jsdom + emulated JSON-RPC for a fake bill; jsdom is NOT a project dependency, install it
// temporarily and run from the project root: node tests/jsdom/home-return-reads.mjs).
// Covers: receipt proofs and the creation proof are IN FLIGHT when the visitor goes Home and returns to the SAME
// mounted bill. Each navigation bumps the page epoch (so the old results are discarded); the mounted views must then
// restart their read-only checks under the current epoch and settle, not stay "Verifying…" forever.
// The app is never remounted. No wallet is connected, nothing is sent. Not a real browser.
import { encodeEventTopics, encodeAbiParameters, encodeFunctionData, encodeFunctionResult, toHex, parseAbi } from 'viem'
const { boot, sleep } = await import('./harness.mjs')

const ABI = parseAbi([
  'function payShare(uint256 billId) payable',
  'function createBill(string title, address recipient, address[] payers, uint256 share) returns (uint256 billId)',
  'function getBill(uint256 billId) view returns (string title, address recipient, address[] payers, uint256 share, bool[] paidStates)',
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
  'event BillCreated(uint256 indexed billId, address indexed recipient, uint256 share, address[] payers, string title)',
])
const CONTRACT = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
const CREATOR = '0x9999999999999999999999999999999999999999'
const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const R = '0x3333333333333333333333333333333333333333'
const SHARE = 1_000_000_000_000_000n
const BILL = 99n
const TITLE = 'Fake bill'
const CREATE_TX = '0x' + 'c1'.repeat(32)
const PAY_TX = '0x' + 'a1'.repeat(32)
const BH = '0x' + 'cd'.repeat(32)
const zero = '0x' + '00'.repeat(32)
const REAL_RPC = 'https://rpc.testnet.arc.io'
const realFetch = globalThis.fetch
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra) }

const state = { gate: null, release: null, held: 0 }
const holdLookups = () => { state.gate = new Promise((r) => { state.release = r }) }
const blockObj = (n) => ({ number: toHex(n), hash: BH, parentHash: zero, timestamp: '0x1', transactions: [], gasLimit: '0x1', gasUsed: '0x0', miner: A, nonce: '0x0000000000000000', difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', logsBloom: '0x' + '00'.repeat(256), sha3Uncles: zero, stateRoot: zero, receiptsRoot: zero, transactionsRoot: zero, size: '0x1', uncles: [], baseFeePerGas: '0x1', mixHash: zero })
const log = (topics, data, hash, bn) => ({ address: CONTRACT, removed: false, logIndex: '0x0', transactionHash: hash, transactionIndex: '0x0', blockHash: BH, blockNumber: toHex(bn), topics, data })
const createLog = () => log(encodeEventTopics({ abi: ABI, eventName: 'BillCreated', args: { billId: BILL, recipient: R } }), encodeAbiParameters([{ type: 'uint256' }, { type: 'address[]' }, { type: 'string' }], [SHARE, [A, B], TITLE]), CREATE_TX, 100n)
const payLog = () => log(encodeEventTopics({ abi: ABI, eventName: 'SharePaid', args: { billId: BILL, payer: A } }), encodeAbiParameters([{ type: 'uint256' }], [SHARE]), PAY_TX, 200n)

async function answer(m, p) {
  switch (m) {
    case 'eth_call': {
      if (p[0].to?.toLowerCase() !== CONTRACT) return undefined
      // 'latest': A has paid. At the (older) creating block every share is unpaid.
      const paid = p[1] === 'latest' ? [true, false] : [false, false]
      return encodeFunctionResult({ abi: ABI, functionName: 'getBill', result: [TITLE, R, [A, B], SHARE, paid] })
    }
    case 'eth_getTransactionByHash':
    case 'eth_getTransactionReceipt': {
      if (p[0] !== CREATE_TX && p[0] !== PAY_TX) return undefined
      if (state.gate) { state.held++; await state.gate }
      const isCreate = p[0] === CREATE_TX
      const bn = isCreate ? 100n : 200n
      const input = isCreate
        ? encodeFunctionData({ abi: ABI, functionName: 'createBill', args: [TITLE, R, [A, B], SHARE] })
        : encodeFunctionData({ abi: ABI, functionName: 'payShare', args: [BILL] })
      const from = isCreate ? CREATOR : A
      if (m === 'eth_getTransactionByHash') return { blockHash: BH, blockNumber: toHex(bn), transactionIndex: '0x0', hash: p[0], from, to: CONTRACT, value: isCreate ? '0x0' : toHex(SHARE), input, nonce: '0x1', gas: '0x5208', gasPrice: '0x1', maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x0', type: '0x2', chainId: toHex(5042002), v: '0x0', r: zero, s: zero, yParity: '0x0', accessList: [] }
      return { blockHash: BH, blockNumber: toHex(bn), transactionIndex: '0x0', transactionHash: p[0], from, to: CONTRACT, status: '0x1', logs: [isCreate ? createLog() : payLog()], contractAddress: null, cumulativeGasUsed: '0x5208', gasUsed: '0x5208', effectiveGasPrice: '0x1', logsBloom: '0x' + '00'.repeat(256), type: '0x2' }
    }
    case 'eth_getBlockByNumber': return blockObj(BigInt(p[0]))
    default: return undefined
  }
}
globalThis.fetch = async (url, init) => {
  if (typeof url === 'string' && url.startsWith(REAL_RPC) && init?.body) {
    const body = JSON.parse(init.body)
    if (!Array.isArray(body)) {
      const r = await answer(body.method, body.params ?? [])
      if (r !== undefined) return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: r }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
  }
  return realFetch(url, init)
}
const buttons = (w) => [...w.document.querySelectorAll('button')]
const click = (w, text) => { const b = buttons(w).find((x) => x.textContent.trim().includes(text) && !x.disabled); if (!b) throw new Error('no button: ' + text); b.click() }

const search = `?network=testnet&chainId=5042002&contract=${CONTRACT}&bill=${BILL}&created=${CREATE_TX}&receipts=${PAY_TX}`
const app = await boot({ search })
const { w } = app

// 1. Both read-only proofs start and are held in flight (the receipt/creation lookups wait on a gate).
holdLookups()
await sleep(3500)
check('[in flight] the bill is loaded and both proofs are waiting on the held lookups', app.text().includes(TITLE) && state.held >= 1, `held=${state.held}`)
check('[in flight] creation proof shows "Verifying creation transaction…" and the receipt shows "Verifying…"', app.text().includes('Verifying creation transaction') && app.text().includes('Verifying…'))

// 2. Home and return to the SAME mounted bill (no remount: a marker on the existing DOM node survives).
const titleEl = [...w.document.querySelectorAll('h1, h2, h3')].find((x) => x.textContent.includes(TITLE))
click(w, 'SplitReceipt'); await sleep(400)
check('[home] the homepage shows while the proofs are still held', app.text().includes('Split the bill. Keep the proof.'))
click(w, 'Open app'); await sleep(400)
check('[return] the same bill address is back', w.location.search === search)
check('[return] the same view is still mounted (not remounted): the bill title element is the same DOM node', !!titleEl && w.document.contains(titleEl))

// 3. Release the held lookups: the OLD reads resolve stale and are discarded; the restarted reads (new epoch) settle.
state.gate = null; state.release()
await sleep(5000)
const t = app.text()
check('[settled] the creation proof settles under the current epoch (not stuck on "Verifying creation transaction…")', !t.includes('Verifying creation transaction') && t.includes('Creation transaction'))
check('[settled] the receipt proof settles: a canonical receipt link for the paid payer, no "Verifying…"', !t.includes('Verifying…') && [...w.document.querySelectorAll('a')].some((a) => a.href.includes(PAY_TX)))
check('[settled] the creator is shown from the canonical transaction sender, not from an event', t.toLowerCase().includes(CREATOR))
check('[settled] the unpaid payer is still unpaid; nothing was marked paid by the restart', /Unpaid/.test(t) && (t.match(/Paid0x/g) ?? []).length === 1)
check('[settled] no wallet was connected and nothing was sent', w.ethereum === undefined && buttons(w).some((b) => b.textContent.includes('Connect wallet')))
check('[settled] no console errors', app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))

// 4. A second Home round trip with nothing in flight keeps the proofs (they re-verify, and end verified again).
click(w, 'SplitReceipt'); await sleep(300); click(w, 'Open app'); await sleep(4000)
const t2 = app.text()
check('[second round trip] proofs end verified again', t2.includes('Creation transaction') && [...w.document.querySelectorAll('a')].some((a) => a.href.includes(PAY_TX)) && !t2.includes('Verifying…'))

await app.stop()
const failed = results.filter((x) => !x).length
console.log(failed ? `SOME FAILED ${failed}/${results.length}` : `ALL PASS ${results.length}/${results.length}`)
process.exit(failed ? 1 : 0)
