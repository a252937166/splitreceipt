import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodeFunctionData, defineChain, toHex } from 'viem'
import { EpochCounter, RequestScope } from '../src/epoch.ts'
import { MAINNET, TESTNET, type NetworkContext } from '../src/networks.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../src/splitReceiptAbi.ts'
import {
  createGuardedProvider, describeTxMismatch, freezeCreateBill, freezePayShare, sendFrozenCall,
  type FrozenCall,
} from '../src/walletSend.ts'
import { guardedWrite, sessionKey, type Eip1193Provider, type WalletSnapshot } from '../src/writeGuard.ts'
import { INTENDED, addr } from './fixtures.ts'
import { keccak256 } from 'viem'

const ACCOUNT = '0x1111111111111111111111111111111111111111' as const
const SHARE = 1_000_000_000_000_000n
const CODE = '0x6080604052' as const

const chainOf = (n: NetworkContext) =>
  defineChain({ id: n.chainId, name: n.label, nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [n.rpcUrl] } } })

const deploymentFor = (n: NetworkContext) => ({ ...n.deployments[0], runtimeCodeHash: keccak256(CODE) })

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}
const tick = () => new Promise((r) => setTimeout(r, 0))

interface Call { method: string; params?: unknown }

/** A wholly fake EIP-1193 wallet. Counts every request; can hold viem's own preparation call. */
function fakeWallet(chainId: number) {
  const calls: Call[] = []
  const state = { chainHex: toHex(chainId), hold: null as ReturnType<typeof deferred> | null, failSend: null as unknown }
  const provider: Eip1193Provider = {
    async request({ method, params }) {
      calls.push({ method, params })
      switch (method) {
        case 'eth_chainId':
          if (state.hold) await state.hold.promise
          return state.chainHex
        case 'eth_accounts':
          return [ACCOUNT]
        case 'eth_sendTransaction':
          if (state.failSend) throw state.failSend
          return '0x' + 'ab'.repeat(32)
        default:
          throw new Error('unexpected ' + method)
      }
    },
  }
  const sends = () => calls.filter((c) => c.method === 'eth_sendTransaction')
  const signs = () => calls.filter((c) => c.method !== 'eth_chainId' && c.method !== 'eth_accounts' && c.method !== 'eth_sendTransaction')
  return { provider, state, calls, sends, signs }
}

function setup(network: NetworkContext, kind: 'create' | 'pay') {
  const sources = { wallet: new EpochCounter(), page: new EpochCounter() }
  const scope = new RequestScope(sources)
  const w = fakeWallet(network.chainId)
  const dep = deploymentFor(network)
  const wallet: WalletSnapshot = { connected: true, address: ACCOUNT, chainId: network.chainId, connectorId: 'fake' }
  const live = { wallet: { ...wallet } }
  const call: FrozenCall =
    kind === 'create'
      ? freezeCreateBill(network, dep, ACCOUNT, INTENDED)
      : freezePayShare(network, dep, ACCOUNT, 7n, SHARE)
  const rpc = { getChainId: async () => network.chainId, getCode: async () => CODE } as never
  /** Everything the app does for one click: the guard, then the real viem send through the boundary guard. */
  const click = () => {
    const token = scope.begin()
    return guardedWrite({
      client: rpc, network, deployment: dep, wallet: { ...wallet }, acknowledgedKey: sessionKey('fake', ACCOUNT),
      acknowledgedProvider: w.provider, getProvider: async () => w.provider, token, getWallet: () => ({ ...live.wallet }),
      send: (provider) => sendFrozenCall({ call, provider, chain: chainOf(network), guard: { token, wallet: { ...wallet }, getWallet: () => ({ ...live.wallet }) } }),
    })
  }
  /** Hold viem's own preparation request (made AFTER the pre-checks passed), change things, release. */
  const clickHeld = async (disturb: () => void) => {
    const hold = deferred()
    w.state.hold = null
    let armed = false
    const original = w.provider.request
    w.provider.request = async (a) => {
      if (a.method === 'eth_chainId' && armed) { w.state.hold = hold; }
      return original(a)
    }
    const token = scope.begin()
    const pending = guardedWrite({
      client: rpc, network, deployment: dep, wallet: { ...wallet }, acknowledgedKey: sessionKey('fake', ACCOUNT),
      acknowledgedProvider: w.provider, getProvider: async () => w.provider, token, getWallet: () => ({ ...live.wallet }),
      send: (provider) => { armed = true; return sendFrozenCall({ call, provider, chain: chainOf(network), guard: { token, wallet: { ...wallet }, getWallet: () => ({ ...live.wallet }) } }) },
    })
    for (let i = 0; i < 50 && !w.state.hold; i++) await tick()
    assert.ok(w.state.hold, 'viem preparation request must be pending after the pre-checks passed')
    disturb()
    hold.resolve()
    return pending
  }
  return { sources, scope, w, wallet, live, call, click, clickHeld, dep }
}

const decodeSent = (tx: Record<string, string>) => decodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, data: tx.data as `0x${string}` })

for (const kind of ['create', 'pay'] as const) {
  for (const network of [MAINNET, TESTNET]) {
    const label = `${kind} on ${network.label}`

    describe(`final wallet request: ${label}`, () => {
      it('a consistent session sends exactly once with the exact frozen fields', async () => {
        const s = setup(network, kind)
        const r = await s.click()
        assert.equal(r.ok, true)
        assert.equal(r.ok && r.value.ok, true)
        assert.equal(s.w.sends().length, 1)
        assert.equal(s.w.signs().length, 0)
        const tx = (s.w.sends()[0].params as Record<string, string>[])[0]
        assert.equal(tx.from.toLowerCase(), ACCOUNT)
        assert.equal(tx.to.toLowerCase(), network.deployments[0].address)
        assert.equal(BigInt(tx.chainId), BigInt(network.chainId))
        const d = decodeSent(tx)
        if (kind === 'create') {
          assert.equal(d.functionName, 'createBill')
          assert.equal(BigInt(tx.value ?? '0x0'), 0n, 'create carries no value')
          const [title, recipient, payers, share] = d.args as [string, string, string[], bigint]
          assert.deepEqual([title, recipient.toLowerCase(), payers.map((p) => p.toLowerCase()), share],
            [INTENDED.title, INTENDED.recipient.toLowerCase(), INTENDED.payers.map((p) => p.toLowerCase()), INTENDED.share])
        } else {
          assert.equal(d.functionName, 'payShare')
          assert.equal(BigInt(tx.value), SHARE, 'pay sends exactly the share')
          assert.deepEqual(d.args, [7n])
        }
        if (network.key === 'mainnet') {
          assert.equal(BigInt(tx.maxFeePerGas), 40_000_000_000n)
          assert.equal(BigInt(tx.maxPriorityFeePerGas), 0n)
        } else {
          assert.equal(tx.maxFeePerGas, undefined, 'testnet must not get the mainnet fee policy')
          assert.equal(tx.maxPriorityFeePerGas, undefined)
        }
      })

      const disturbances: [string, (s: ReturnType<typeof setup>) => () => void][] = [
        ['wallet account A -> B -> A', (s) => () => {
          s.live.wallet = { ...s.wallet, address: '0x2222222222222222222222222222222222222222' }; s.sources.wallet.bump()
          s.live.wallet = { ...s.wallet }; s.sources.wallet.bump()
        }],
        ['connector changes and returns', (s) => () => {
          s.live.wallet = { ...s.wallet, connectorId: 'other' }; s.sources.wallet.bump()
          s.live.wallet = { ...s.wallet }; s.sources.wallet.bump()
        }],
        ['wallet network leaves and returns', (s) => () => {
          s.live.wallet = { ...s.wallet, chainId: 1 }; s.sources.wallet.bump()
          s.live.wallet = { ...s.wallet }; s.sources.wallet.bump()
        }],
        ['page A -> B -> A', (s) => () => { s.sources.page.bump(); s.sources.page.bump() }],
        ['owner unmounts', (s) => () => { s.scope.dispose() }],
        ['a newer action begins', (s) => () => { s.scope.begin() }],
        ['account changes with no event at all (snapshot differs)', (s) => () => {
          s.live.wallet = { ...s.wallet, address: '0x2222222222222222222222222222222222222222' }
        }],
      ]
      for (const [name, make] of disturbances) {
        it(`sends nothing when ${name} while the library is still preparing the request`, async () => {
          const s = setup(network, kind)
          const r = await s.clickHeld(make(s))
          assert.equal(s.w.sends().length, 0, 'final eth_sendTransaction count')
          assert.equal(s.w.signs().length, 0, 'no signing request either')
          assert.equal(r.ok, true) // the pre-checks passed; the boundary refused
          assert.equal(r.ok && r.value.ok, false)
        })
      }

      it('a rejected or failed send is rethrown and never repeated', async () => {
        const s = setup(network, kind)
        s.w.state.failSend = Object.assign(new Error('User rejected the request.'), { code: 4001 })
        await assert.rejects(s.click())
        assert.equal(s.w.sends().length, 1)
        const t = setup(network, kind)
        t.w.state.failSend = Object.assign(new Error('internal'), { code: -32603 })
        await assert.rejects(t.click())
        assert.equal(t.w.sends().length, 1, 'transport retries are disabled')
      })
    })
  }
}

describe('boundary guard refuses anything but the frozen transaction', () => {
  const frozen = freezePayShare(MAINNET, deploymentFor(MAINNET), ACCOUNT, 7n, SHARE).tx
  const good = (over: Record<string, unknown> = {}) => ({
    from: ACCOUNT, to: frozen.to, data: frozen.data, value: toHex(SHARE), chainId: toHex(5042),
    maxFeePerGas: toHex(40_000_000_000n), maxPriorityFeePerGas: '0x0', ...over,
  })
  const request = async (params: unknown, method = 'eth_sendTransaction') => {
    const w = fakeWallet(5042)
    const sources = { wallet: new EpochCounter(), page: new EpochCounter() }
    const token = new RequestScope(sources).begin()
    const wallet: WalletSnapshot = { connected: true, address: ACCOUNT, chainId: 5042, connectorId: 'fake' }
    const g = createGuardedProvider(w.provider, frozen, { token, wallet, getWallet: () => wallet })
    let refused = false
    await g.request({ method, params: params as unknown[] }).catch(() => { refused = true })
    return { refused, sent: w.sends().length, other: w.signs().length }
  }

  it('accepts the exact transaction', async () => {
    assert.deepEqual(await request([good()]), { refused: false, sent: 1, other: 0 })
  })
  const bad: [string, Record<string, unknown>][] = [
    ['another sender', { from: addr(0x99) }],
    ['another target', { to: addr(0x98) }],
    ['other calldata', { data: '0xdeadbeef' }],
    ['more value', { value: toHex(SHARE + 1n) }],
    ['no value on a payment', { value: undefined }],
    ['another chain', { chainId: toHex(5042002) }],
    ['a higher fee cap', { maxFeePerGas: toHex(41_000_000_000n) }],
    ['a priority fee', { maxPriorityFeePerGas: '0x1' }],
    ['a missing fee cap', { maxFeePerGas: undefined }],
    ['a legacy gas price', { gasPrice: '0x1' }],
    ['an unexpected gas field', { gas: '0x5208' }],
    ['a nonce', { nonce: '0x1' }],
    ['a legacy type', { type: '0x0' }],
  ]
  for (const [name, over] of bad) {
    it(`refuses ${name}`, async () => {
      assert.deepEqual(await request([good(over)]), { refused: true, sent: 0, other: 0 })
    })
  }
  it('refuses a missing or multiple transaction object', async () => {
    assert.equal((await request([])).refused, true)
    assert.equal((await request([good(), good()])).refused, true)
    assert.equal((await request(undefined)).refused, true)
  })
  for (const m of ['personal_sign', 'eth_sign', 'eth_signTypedData_v4', 'eth_signTransaction', 'eth_sendRawTransaction', 'wallet_sendCalls']) {
    it(`blocks ${m} entirely`, async () => {
      assert.deepEqual(await request(['x'], m), { refused: true, sent: 0, other: 0 })
    })
  }
  it('passes harmless reads through', async () => {
    const w = fakeWallet(5042)
    const wallet: WalletSnapshot = { connected: true, address: ACCOUNT, chainId: 5042, connectorId: 'fake' }
    const g = createGuardedProvider(w.provider, frozen, { token: { isLive: () => true }, wallet, getWallet: () => wallet })
    assert.equal(await g.request({ method: 'eth_chainId' }), '0x13b2')
  })
  it('describeTxMismatch is null only for the exact transaction', () => {
    assert.equal(describeTxMismatch(good(), frozen), null)
    assert.notEqual(describeTxMismatch(null, frozen), null)
  })
})

describe('network fee policy', () => {
  it('Mainnet is 40 gwei max and 0 priority; Testnet has no policy', () => {
    assert.deepEqual(MAINNET.fees, { maxFeePerGas: 40_000_000_000n, maxPriorityFeePerGas: 0n })
    assert.equal(TESTNET.fees, undefined)
  })
  it('frozen calls carry the policy of their own network only', () => {
    const m = freezeCreateBill(MAINNET, deploymentFor(MAINNET), ACCOUNT, INTENDED).tx
    const t = freezeCreateBill(TESTNET, deploymentFor(TESTNET), ACCOUNT, INTENDED).tx
    assert.equal(m.maxFeePerGas, 40_000_000_000n)
    assert.equal(m.maxPriorityFeePerGas, 0n)
    assert.equal(t.maxFeePerGas, undefined)
    assert.equal(t.maxPriorityFeePerGas, undefined)
    assert.equal(m.chainId, 5042)
    assert.equal(t.chainId, 5042002)
  })
})
