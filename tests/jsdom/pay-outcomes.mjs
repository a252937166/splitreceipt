// Optional DOM-level checks (jsdom, fake EIP-1193 wallet, emulated JSON-RPC for one fake bill). jsdom is NOT a
// project dependency: install it temporarily (`bun add -d jsdom`, then remove it) and run from the project root:
//   node tests/jsdom/pay-outcomes.mjs
// Real RPC is still used for the contract's runtime code; the fake bill, transactions and receipts are emulated.
// This is not a real browser. No real wallet request, signature or transaction is made.
import { encodeEventTopics, encodeAbiParameters, encodeFunctionData, encodeFunctionResult, toHex, parseAbi } from 'viem'
import { boot, sleep } from './harness.mjs'

const ABI = parseAbi([
  'function payShare(uint256 billId) payable',
  'function getBill(uint256 billId) view returns (string title, address recipient, address[] payers, uint256 share, bool[] paidStates)',
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
])
const CONTRACT = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
const A = '0x1111111111111111111111111111111111111111'
const B = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const SHARE = 1_000_000_000_000_000n
const BILL = 99n
const SUBMITTED = '0x' + 'ab'.repeat(32)
const BLOCK = 100n
const BLOCK_HASH = '0x' + 'cd'.repeat(32)
const REAL_RPC = 'https://rpc.testnet.arc.io'
const realFetch = globalThis.fetch

const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(ok ? 'PASS' : 'FAIL', name, extra) }

function emulator(mode) {
  const state = { paid: [false, false], rpc: [] }
  const zeroHash = '0x' + '00'.repeat(32)
  const common = { blockHash: BLOCK_HASH, blockNumber: toHex(BLOCK), transactionIndex: '0x0' }
  const goodTx = { hash: SUBMITTED, from: A, to: CONTRACT, value: toHex(SHARE), input: encodeFunctionData({ abi: ABI, functionName: 'payShare', args: [BILL] }) }
  // "cancellation": a successful self-send with empty calldata, no events
  const cancelTx = { hash: SUBMITTED, from: A, to: A, value: '0x0', input: '0x' }
  const tx = mode === 'cancelled' ? cancelTx : goodTx
  const logs = mode === 'cancelled' ? [] : [{
    address: CONTRACT, removed: false, logIndex: '0x0', transactionHash: SUBMITTED, transactionIndex: '0x0', blockHash: BLOCK_HASH, blockNumber: toHex(BLOCK),
    topics: encodeEventTopics({ abi: ABI, eventName: 'SharePaid', args: { billId: BILL, payer: A } }),
    data: encodeAbiParameters([{ type: 'uint256' }], [SHARE]),
  }]
  const answer = (m, p) => {
    switch (m) {
      case 'eth_call': {
        if (p[0].to?.toLowerCase() === CONTRACT && p[0].data?.startsWith(encodeFunctionData({ abi: ABI, functionName: 'getBill', args: [BILL] }).slice(0, 10))) {
          return encodeFunctionResult({ abi: ABI, functionName: 'getBill', result: ['Fake bill 99', RECIPIENT, [A, B], SHARE, state.paid] })
        }
        return undefined
      }
      case 'eth_getTransactionByHash':
        if (p[0] === SUBMITTED) return { ...common, ...tx, nonce: '0x1', gas: '0x5208', gasPrice: '0x1', maxFeePerGas: '0x1', maxPriorityFeePerGas: '0x0', type: '0x2', chainId: toHex(5042002), v: '0x0', r: zeroHash, s: zeroHash, yParity: '0x0', accessList: [] }
        return undefined
      case 'eth_getTransactionReceipt':
        if (p[0] === SUBMITTED) {
          if (mode === 'good') state.paid = [true, false] // the contract state changes when the payment is mined
          return { ...common, transactionHash: SUBMITTED, from: tx.from, to: tx.to, status: '0x1', logs, contractAddress: null, cumulativeGasUsed: '0x5208', gasUsed: '0x5208', effectiveGasPrice: '0x1', logsBloom: '0x' + '00'.repeat(256), type: '0x2' }
        }
        return undefined
      case 'eth_getBlockByNumber':
        if (p[0] === toHex(BLOCK)) return { number: toHex(BLOCK), hash: BLOCK_HASH, parentHash: zeroHash, timestamp: '0x1', transactions: [], gasLimit: '0x1', gasUsed: '0x0', miner: A, nonce: '0x0000000000000000', difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', logsBloom: '0x' + '00'.repeat(256), sha3Uncles: zeroHash, stateRoot: zeroHash, receiptsRoot: zeroHash, transactionsRoot: zeroHash, size: '0x1', uncles: [], baseFeePerGas: '0x1', mixHash: zeroHash }
        return undefined
      default:
        return undefined
    }
  }
  globalThis.fetch = async (url, init) => {
    if (typeof url === 'string' && url.startsWith(REAL_RPC) && init?.body) {
      const body = JSON.parse(init.body)
      const one = (req) => {
        state.rpc.push(req.method)
        const result = answer(req.method, req.params ?? [])
        return result === undefined ? null : { jsonrpc: '2.0', id: req.id, result }
      }
      if (!Array.isArray(body)) {
        const r = one(body)
        if (r) return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
      }
    }
    return realFetch(url, init)
  }
  return state
}

function makeWallet() {
  const listeners = {}
  const sends = []
  const provider = {
    on(e, h) { (listeners[e] ??= new Set()).add(h) },
    removeListener(e, h) { listeners[e]?.delete(h) },
    async request({ method, params }) {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [A]
      if (method === 'eth_chainId') return '0x4cef52'
      if (method === 'eth_sendTransaction') { sends.push(params[0]); return SUBMITTED }
      const e = new Error('unsupported ' + method); e.code = -32601; throw e
    },
  }
  return { provider, sends }
}

const click = (w, text) => {
  const b = [...w.document.querySelectorAll('button')].find((x) => x.textContent.trim().includes(text) && !x.disabled)
  if (!b) throw new Error('no button: ' + text)
  b.click()
}

async function scenario(mode) {
  const chain = emulator(mode)
  const wallet = makeWallet()
  const app = await boot({ search: `?bill=${BILL}`, provider: wallet.provider })
  const { w } = app
  await sleep(2500)
  check(`[${mode}] fake bill loads unpaid`, app.text().includes('Fake bill 99') && app.text().includes('0 of 2 paid'))
  click(w, 'Connect wallet'); await sleep(200)
  click(w, 'Test Wallet'); await sleep(1500)
  click(w, 'Pay 0.001 USDC'); await sleep(9000)
  check(`[${mode}] exactly one wallet request`, wallet.sends.length === 1)
  const text = app.text()
  if (mode === 'cancelled') {
    check(`[${mode}] status-success tx WITHOUT SharePaid is not announced as a payment`, !text.includes('Payment verified') && !text.includes('Payment confirmed'))
    check(`[${mode}] UI says the transaction did not pay the share`, text.includes('did not pay your share') && text.includes('still unpaid'))
    check(`[${mode}] bill still unpaid, nothing marked paid`, text.includes('0 of 2 paid') && !text.includes('Settled'))
    check(`[${mode}] no automatic second wallet request`, wallet.sends.length === 1)
    check(`[${mode}] explicit retry stays available`, [...w.document.querySelectorAll('button')].some((b) => /Pay 0\.001 USDC/.test(b.textContent) && !b.disabled))
  } else {
    check(`[${mode}] verified payment is announced after event + paid state agree`, text.includes('Payment verified on the chain'))
    check(`[${mode}] bill shows 1 of 2 paid`, text.includes('1 of 2 paid'))
  }
  check(`[${mode}] no console errors`, app.errors.length === 0, JSON.stringify(app.errors.slice(0, 2)))
  await app.stop()
  globalThis.fetch = realFetch
}

await scenario('cancelled')
await scenario('good')
console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED', results.filter(Boolean).length + '/' + results.length)
process.exit(0)
