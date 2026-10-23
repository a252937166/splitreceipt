import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { keccak256 } from 'viem'
import { MAINNET, TESTNET, type ReviewedDeployment } from '../src/networks.ts'
import {
  DISCONNECTED, guardedWrite, parseChainId, sameWalletSession, sessionKey, verifyRuntime, walletReadiness,
  type Eip1193Provider, type WalletSnapshot,
} from '../src/writeGuard.ts'
import { EpochCounter, RequestScope } from '../src/epoch.ts'

const CODE = '0x6080604052' as const
const deployment: ReviewedDeployment = {
  address: '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26',
  label: 'test',
  runtimeCodeHash: keccak256(CODE),
  deployBlock: null,
}
const wallet: WalletSnapshot = { connected: true, address: '0xAbC0000000000000000000000000000000000001', chainId: TESTNET.chainId, connectorId: 'io.metamask' }
const ack = sessionKey(wallet.connectorId, wallet.address)

const rpc = (o: { chain?: number; code?: string | undefined; fail?: boolean } = {}) =>
  ({
    getChainId: async () => { if (o.fail) throw new Error('down'); return o.chain ?? TESTNET.chainId },
    getCode: async () => ('code' in o ? o.code : CODE),
  }) as never

describe('walletReadiness', () => {
  it('requires a connection first', () => {
    const r = walletReadiness(DISCONNECTED, TESTNET.chainId, null)
    assert.equal(!r.ready && r.need, 'connect')
  })
  it('requires acknowledgement of the displayed session', () => {
    const r = walletReadiness(wallet, TESTNET.chainId, null)
    assert.equal(!r.ready && r.need, 'acknowledge')
  })
  it('a different account invalidates a previous acknowledgement', () => {
    const r = walletReadiness({ ...wallet, address: '0x0000000000000000000000000000000000000002' }, TESTNET.chainId, ack)
    assert.equal(!r.ready && r.need, 'acknowledge')
  })
  it('a different provider invalidates a previous acknowledgement', () => {
    const r = walletReadiness({ ...wallet, connectorId: 'other' }, TESTNET.chainId, ack)
    assert.equal(!r.ready && r.need, 'acknowledge')
  })
  it('asks to switch when the wallet is on another chain', () => {
    const r = walletReadiness({ ...wallet, chainId: 1 }, TESTNET.chainId, ack)
    assert.equal(!r.ready && r.need, 'switch-network')
  })
  it('is ready when connected, acknowledged and on the right chain', () => {
    assert.deepEqual(walletReadiness(wallet, TESTNET.chainId, ack), { ready: true })
  })
  it('session keys ignore address case', () => {
    assert.equal(sessionKey('a', '0xABC'), sessionKey('a', '0xabc'))
    assert.equal(sessionKey(null, '0xabc'), null)
  })
  it('sameWalletSession detects account, chain and provider changes', () => {
    assert.equal(sameWalletSession(wallet, { ...wallet }), true)
    assert.equal(sameWalletSession(wallet, { ...wallet, chainId: 1 }), false)
    assert.equal(sameWalletSession(wallet, { ...wallet, address: '0x1' }), false)
    assert.equal(sameWalletSession(wallet, { ...wallet, connectorId: 'x' }), false)
  })
})

describe('verifyRuntime', () => {
  it('accepts the reviewed runtime hash', async () => {
    assert.equal((await verifyRuntime(rpc(), TESTNET, deployment)).ok, true)
  })
  it('rejects different code', async () => {
    assert.equal((await verifyRuntime(rpc({ code: '0x6080' }), TESTNET, deployment)).ok, false)
  })
  it('rejects empty code', async () => {
    assert.equal((await verifyRuntime(rpc({ code: '0x' }), TESTNET, deployment)).ok, false)
    assert.equal((await verifyRuntime(rpc({ code: undefined }), TESTNET, deployment)).ok, false)
  })
  it('rejects a wrong-chain RPC', async () => {
    assert.equal((await verifyRuntime(rpc({ chain: 1 }), TESTNET, deployment)).ok, false)
  })
  it('reports RPC failure as transient', async () => {
    const r = await verifyRuntime(rpc({ fail: true }), TESTNET, deployment)
    assert.equal(!r.ok && r.transient, true)
  })
})


describe('parseChainId', () => {
  it('accepts only 0x hex quantities', () => {
    assert.equal(parseChainId('0x4cef52'), 5042002)
    assert.equal(parseChainId('0x13b2'), 5042)
    for (const bad of ['5042002', 5042002, null, undefined, '0x', '0xzz', '', {}, '0x1'.repeat(10)]) {
      assert.equal(parseChainId(bad), null, String(bad))
    }
  })
})

// ── guardedWrite ─────────────────────────────────────────────────────────────

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

/** A world where every external call can be held pending, and the wallet/page can change meanwhile. */
function world(opts: { network?: typeof TESTNET; chainHex?: string; accounts?: string[] } = {}) {
  const network = opts.network ?? TESTNET
  const dep: ReviewedDeployment = { ...deployment }
  const sources = { wallet: new EpochCounter(), page: new EpochCounter() }
  const scope = new RequestScope(sources)
  const state = {
    wallet: { ...wallet, chainId: network.chainId } as WalletSnapshot,
    chainHex: opts.chainHex ?? '0x' + network.chainId.toString(16),
    accounts: opts.accounts ?? [wallet.address as string],
  }
  const gates: Record<'code' | 'getProvider' | 'chain' | 'accounts', ReturnType<typeof deferred> | null> = {
    code: null, getProvider: null, chain: null, accounts: null,
  }
  const provider: Eip1193Provider = {
    request: async ({ method }) => {
      if (method === 'eth_chainId') { await gates.chain?.promise; return state.chainHex }
      if (method === 'eth_accounts') { await gates.accounts?.promise; return state.accounts }
      throw new Error('unexpected ' + method)
    },
  }
  let current: unknown = provider
  const client = {
    getChainId: async () => network.chainId,
    getCode: async () => { await gates.code?.promise; return CODE },
  } as never
  let sent = 0
  const run = (over: Partial<Parameters<typeof guardedWrite<string>>[0]> = {}) => {
    const token = scope.begin()
    return guardedWrite<string>({
      client, network, deployment: dep, wallet: { ...state.wallet },
      acknowledgedKey: sessionKey(state.wallet.connectorId, state.wallet.address),
      acknowledgedProvider: provider,
      getProvider: async () => { await gates.getProvider?.promise; return current },
      token, getWallet: () => ({ ...state.wallet }),
      send: async () => { sent++; return '0xhash' },
      ...over,
    })
  }
  /** Wallet goes to another account and comes back: the final snapshot equals the first. */
  const walletAtoBtoA = () => {
    const original = { ...state.wallet }
    state.wallet = { ...original, address: '0x0000000000000000000000000000000000000002' }
    sources.wallet.bump()
    state.wallet = original
    sources.wallet.bump()
  }
  return { sources, scope, state, gates, provider, run, walletAtoBtoA, setProvider: (p: unknown) => { current = p }, sent: () => sent, network, dep }
}

describe('guardedWrite', () => {
  it('sends exactly once when every fresh check agrees (testnet and mainnet)', async () => {
    for (const net of [TESTNET, MAINNET]) {
      const w = world({ network: net })
      const r = await w.run()
      assert.deepEqual(r, { ok: true, value: '0xhash' })
      assert.equal(w.sent(), 1)
    }
  })

  for (const stage of ['code', 'getProvider', 'chain', 'accounts'] as const) {
    it(`refuses when the wallet account goes A -> B -> A while ${stage} is pending`, async () => {
      const w = world()
      w.gates[stage] = deferred()
      const pending = w.run()
      await new Promise((r) => setTimeout(r, 0))
      w.walletAtoBtoA()
      w.gates[stage]!.resolve()
      const r = await pending
      assert.equal(r.ok, false)
      assert.equal(w.sent(), 0)
    })

    it(`refuses when the connector changes and returns while ${stage} is pending`, async () => {
      const w = world()
      w.gates[stage] = deferred()
      const pending = w.run()
      await new Promise((r) => setTimeout(r, 0))
      const original = { ...w.state.wallet }
      w.state.wallet = { ...original, connectorId: 'io.other' }
      w.sources.wallet.bump()
      w.state.wallet = original
      w.sources.wallet.bump()
      w.gates[stage]!.resolve()
      assert.equal((await pending).ok, false)
      assert.equal(w.sent(), 0)
    })

    it(`refuses when the wallet network goes away and back while ${stage} is pending`, async () => {
      const w = world()
      w.gates[stage] = deferred()
      const pending = w.run()
      await new Promise((r) => setTimeout(r, 0))
      const original = { ...w.state.wallet }
      w.state.wallet = { ...original, chainId: 1 }
      w.sources.wallet.bump()
      w.state.wallet = original
      w.sources.wallet.bump()
      w.gates[stage]!.resolve()
      assert.equal((await pending).ok, false)
      assert.equal(w.sent(), 0)
    })

    it(`refuses when the page goes bill A -> B -> A while ${stage} is pending`, async () => {
      const w = world()
      w.gates[stage] = deferred()
      const pending = w.run()
      await new Promise((r) => setTimeout(r, 0))
      w.sources.page.bump()
      w.sources.page.bump()
      w.gates[stage]!.resolve()
      assert.equal((await pending).ok, false)
      assert.equal(w.sent(), 0)
    })

    it(`refuses when the view unmounts while ${stage} is pending`, async () => {
      const w = world()
      w.gates[stage] = deferred()
      const pending = w.run()
      await new Promise((r) => setTimeout(r, 0))
      w.scope.dispose()
      w.gates[stage]!.resolve()
      assert.equal((await pending).ok, false)
      assert.equal(w.sent(), 0)
    })

    it(`refuses an older request superseded by a newer click while ${stage} is pending`, async () => {
      const w = world()
      const gate = deferred()
      w.gates[stage] = gate
      const first = w.run()
      await new Promise((r) => setTimeout(r, 0))
      w.gates[stage] = null
      const second = w.run()
      assert.equal((await second).ok, true)
      gate.resolve()
      assert.equal((await first).ok, false)
      assert.equal(w.sent(), 1)
    })
  }

  it('refuses when the provider reports a different first account than the cached one', async () => {
    const w = world({ accounts: ['0x0000000000000000000000000000000000000009', wallet.address as string] })
    const r = await w.run()
    assert.equal(r.ok, false)
    assert.equal(w.sent(), 0)
  })

  it('accepts the selected account regardless of address case', async () => {
    const w = world({ accounts: [(wallet.address as string).toUpperCase().replace('0X', '0x')] })
    assert.equal((await w.run()).ok, true)
  })

  it('refuses when the provider has no accounts', async () => {
    const w = world({ accounts: [] })
    assert.equal((await w.run()).ok, false)
    assert.equal(w.sent(), 0)
  })

  it('refuses when a fresh eth_chainId disagrees with the cached wallet chain', async () => {
    const w = world({ chainHex: '0x1' })
    const r = await w.run()
    assert.equal(r.ok, false)
    assert.equal(w.sent(), 0)
  })

  it('refuses a malformed eth_chainId answer', async () => {
    for (const bad of ['5042002', '', '0xzz']) {
      const w = world({ chainHex: bad })
      assert.equal((await w.run()).ok, false, bad)
      assert.equal(w.sent(), 0)
    }
  })

  it('refuses the other Arc network on the page network (mainnet page, testnet wallet)', async () => {
    const w = world({ network: MAINNET, chainHex: '0x' + TESTNET.chainId.toString(16) })
    assert.equal((await w.run()).ok, false)
    assert.equal(w.sent(), 0)
  })

  it('refuses when the connector now returns a different provider object', async () => {
    const w = world()
    w.setProvider({ request: async () => '0x4cef52' })
    assert.equal((await w.run()).ok, false)
    assert.equal(w.sent(), 0)
  })

  it('refuses when no provider was captured at acknowledgement', async () => {
    const w = world()
    assert.equal((await w.run({ acknowledgedProvider: null })).ok, false)
    assert.equal(w.sent(), 0)
  })

  it('refuses when the wallet session was not acknowledged', async () => {
    const w = world()
    assert.equal((await w.run({ acknowledgedKey: null })).ok, false)
    assert.equal(w.sent(), 0)
  })

  it('refuses when the contract runtime differs, before touching the provider', async () => {
    const w = world()
    w.dep.runtimeCodeHash = '0x' + '11'.repeat(32) as `0x${string}`
    let touched = false
    const r = await w.run({ deployment: w.dep, getProvider: async () => { touched = true; return w.provider } })
    assert.equal(r.ok, false)
    assert.equal(touched, false)
    assert.equal(w.sent(), 0)
  })

  it('reports provider failures without sending', async () => {
    const w = world()
    const r = await w.run({ getProvider: async () => { throw new Error('gone') } })
    assert.equal(r.ok, false)
    assert.equal(w.sent(), 0)
  })

  it('a token captured before the checks is stale if the epoch moved before the call even starts', async () => {
    const w = world()
    const token = w.scope.begin()
    w.sources.wallet.bump()
    const r = await w.run({ token })
    // run() begins a new scope token only when none is passed; here the stale one is used.
    assert.equal(r.ok, false)
    assert.equal(w.sent(), 0)
  })
})
