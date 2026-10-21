import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createConfig, createStorage, connect, disconnect, getConnection, getConnectorClient, hydrate, type Config } from '@wagmi/core'
import { announceProvider } from 'mipd'
import { custom, defineChain, keccak256, ResourceUnavailableRpcError, UserRejectedRequestError } from 'viem'
import { createExplicitWalletSession, watchExplicitWalletSession, checkExplicitWalletWrite, walletSnapshotMatchesDisplay } from '../src/walletSelection.ts'
import { createActionScopeGuard, updateActionWalletIdentity, checkScopedWrite, type ActionScopeState } from '../src/actionScope.ts'
import { resolveNetworkContext, checkDeployment } from '../src/networkContext.ts'
import { EXPLICIT_WALLET_CONFIG, WALLET_RECONNECT_ON_MOUNT, walletRequestErrorMessage } from '../src/walletPolicy.ts'

const ACCOUNT = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const chain = defineChain({ id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: ['https://unused.invalid'] } } })
class WalletMock extends EventEmitter {
  calls: string[] = []
  authorized = false
  mode: 'grant' | 'reject' | 'pending' = 'grant'
  chainId = 1
  async request({ method }: { method: string }): Promise<unknown> {
    this.calls.push(method)
    switch (method) {
      case 'wallet_requestPermissions':
      case 'eth_requestAccounts': {
        if (this.mode === 'reject') throw Object.assign(new Error('User declined'), { code: 4001 })
        if (this.mode === 'pending') throw Object.assign(new Error('Permission request is open'), { code: -32002 })
        this.authorized = true
        return method === 'eth_requestAccounts' ? [ACCOUNT] : [{ caveats: [{ value: [ACCOUNT] }] }]
      }
      case 'eth_accounts': return this.authorized ? [ACCOUNT] : []
      case 'eth_chainId': return `0x${this.chainId.toString(16)}`
      case 'wallet_revokePermissions': this.authorized = false; return null
      default: throw new Error(`Unexpected wallet request: ${method}`)
    }
  }
}
function surface() {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const oldFetch = globalThis.fetch
  const win = new EventTarget()
  let legacyReads = 0, networkCalls = 0
  Object.defineProperty(win, 'ethereum', { configurable: false, get() { legacyReads++; throw new TypeError('Legacy ethereum provider must not be read') } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win })
  globalThis.fetch = async () => { networkCalls++; throw new Error('Network access is forbidden in wallet unit tests') }
  const values = new Map<string, string>()
  const storage = createStorage({ storage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  } })
  const announcements: (() => void)[] = []
  const configs: Config[] = []
  function config() {
    const result = createConfig({ ...EXPLICIT_WALLET_CONFIG, chains: [chain], storage,
      transports: { [chain.id]: custom({ request: async () => { networkCalls++; throw new Error('Public RPC is forbidden') } }) } })
    configs.push(result)
    return result
  }
  function announce(wallet: WalletMock, name: string, rdns: string, n: number) {
    announcements.push(announceProvider({ info: { name, rdns, uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, icon: 'data:image/png;base64,' }, provider: wallet as never }))
  }
  function clean() {
    for (const off of announcements) off()
    for (const item of configs) item._internal.mipd?.destroy()
    globalThis.fetch = oldFetch
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
  return { win, storage, config, announce, clean, legacyReads: () => legacyReads, networkCalls: () => networkCalls }
}
async function rehydrate(config: Config) {
  const store = config._internal.store as unknown as { persist: { rehydrate(): Promise<void> } }
  await store.persist.rehydrate()
}

const allowed = new Set(['wallet_requestPermissions', 'eth_requestAccounts', 'eth_accounts', 'eth_chainId', 'wallet_revokePermissions'])
function assertSafe(env: ReturnType<typeof surface>, ...wallets: WalletMock[]) {
  assert.equal(env.legacyReads(), 0)
  assert.equal(env.networkCalls(), 0)
  for (const wallet of wallets) for (const method of wallet.calls) assert.ok(allowed.has(method), `no send/sign/switch call allowed: ${method}`)
}

test('named MetaMask keeps its exact provider despite a readonly throwing legacy ethereum property', async () => {
  const env = surface(), meta = new WalletMock(), okx = new WalletMock(), phantom = new WalletMock()
  try {
    assert.throws(() => Object.defineProperty(env.win, 'ethereum', { value: phantom }), /Cannot redefine property: ethereum/)
    env.announce(okx, 'OKX Wallet', 'com.okex.wallet', 1)
    env.announce(meta, 'MetaMask', 'io.metamask', 2)
    env.announce(phantom, 'Phantom', 'app.phantom', 3)
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    assert.deepEqual(config.connectors.map(item => item.name), ['OKX Wallet', 'MetaMask', 'Phantom'])
    assert.ok(config.connectors.every(item => item.id !== 'injected'))
    assert.equal(meta.calls.length + okx.calls.length + phantom.calls.length, 0)
    const connector = config.connectors.find(item => item.id === 'io.metamask')!
    assert.equal(await connector.getProvider(), meta)
    assert.equal((await connect(config, { connector })).chainId, 1, 'connecting does not switch the wallet chain')
    assert.equal(getConnection(config).connector?.name, 'MetaMask')
    const client = await getConnectorClient(config)
    assert.equal(await client.request({ method: 'eth_chainId' }), '0x1')
    assert.equal(okx.calls.length + phantom.calls.length, 0)
    assertSafe(env, meta, okx, phantom)
  } finally { env.clean() }
})

test('refresh with old injected state or a previous named connection requires an explicit wallet choice', async () => {
  const env = surface(), meta = new WalletMock(), okx = new WalletMock()
  meta.authorized = true; okx.authorized = true
  try {
    env.announce(meta, 'MetaMask', 'io.metamask', 4)
    env.announce(okx, 'OKX Wallet', 'com.okex.wallet', 5)
    await env.storage.setItem('recentConnectorId', 'injected')
    await env.storage.setItem('injected.connected', true)
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    assert.equal(getConnection(config).status, 'disconnected')
    assert.equal(meta.calls.length + okx.calls.length, 0)
    await connect(config, { connector: config.connectors.find(item => item.id === 'io.metamask')! })
    const count = meta.calls.length + okx.calls.length
    const refreshed = env.config()
    await rehydrate(refreshed)
    await hydrate(refreshed, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    assert.equal(getConnection(refreshed).status, 'disconnected')
    assert.equal(meta.calls.length + okx.calls.length, count, 'hydration does not query any authorized provider')
    assert.ok(refreshed.connectors.every(item => item.id !== 'injected'))
    assertSafe(env, meta, okx)
  } finally { env.clean() }
})

test('rejected or pending MetaMask requests do not fall back to another authorized wallet', async () => {
  for (const mode of ['reject', 'pending'] as const) {
    const env = surface(), meta = new WalletMock(), okx = new WalletMock()
    meta.mode = mode; okx.authorized = true
    try {
      env.announce(okx, 'OKX Wallet', 'com.okex.wallet', 6)
      env.announce(meta, 'MetaMask', 'io.metamask', 7)
      const config = env.config()
      await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
      await assert.rejects(connect(config, { connector: config.connectors.find(item => item.id === 'io.metamask')! }), error => {
        const text = walletRequestErrorMessage(error, 'MetaMask')
        assert.match(text, mode === 'reject' ? /MetaMask request cancelled/ : /MetaMask already has a pending request/)
        return true
      })
      assert.equal(meta.calls.filter(method => method === 'wallet_requestPermissions').length, 1)
      assert.equal(getConnection(config).status, 'disconnected')
      assert.equal(okx.calls.length, 0)
      assertSafe(env, meta, okx)
    } finally { env.clean() }
  }
})

test('disconnecting the chosen wallet leaves the app disconnected without prompting another wallet', async () => {
  const env = surface(), meta = new WalletMock(), okx = new WalletMock()
  okx.authorized = true
  try {
    env.announce(meta, 'MetaMask', 'io.metamask', 8)
    env.announce(okx, 'OKX Wallet', 'com.okex.wallet', 9)
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    await connect(config, { connector: config.connectors.find(item => item.id === 'io.metamask')! })
    await disconnect(config)
    assert.equal(getConnection(config).status, 'disconnected')
    assert.equal(okx.calls.length, 0)
    assertSafe(env, meta, okx)
  } finally { env.clean() }
})

test('missing wallet announcements leave an empty chooser instead of using the legacy provider', async () => {
  const env = surface()
  try {
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    assert.deepEqual(config.connectors, [])
    assert.equal(getConnection(config).status, 'disconnected')
    assertSafe(env)
  } finally { env.clean() }
})

test('wrapped pending and rejection errors identify the chosen wallet and keep retry manual', () => {
  const pending = new ResourceUnavailableRpcError(Object.assign(new Error('Permission is open'), { code: -32002 }))
  const rejected = new UserRejectedRequestError(Object.assign(new Error('Declined'), { code: 4001 }))
  assert.match(walletRequestErrorMessage(pending, 'MetaMask'), /MetaMask already has a pending request.*Open MetaMask.*finish or cancel/i)
  assert.match(walletRequestErrorMessage(rejected, 'MetaMask'), /MetaMask request cancelled/)
  assert.match(walletRequestErrorMessage({ cause: { cause: { code: -32002 } } }, 'OKX Wallet'), /OKX Wallet already has a pending request/)
})

test('wallet-originated connect events remain a library behavior even when refresh reconnect is disabled', async () => {
  const env = surface(), meta = new WalletMock(), okx = new WalletMock()
  okx.authorized = true
  try {
    env.announce(meta, 'MetaMask', 'io.metamask', 10)
    env.announce(okx, 'OKX Wallet', 'com.okex.wallet', 11)
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    await connect(config, { connector: config.connectors.find(item => item.id === 'io.metamask')! })
    assert.equal(getConnection(config).connector?.name, 'MetaMask')
    okx.emit('connect', { chainId: '0x1' })
    await new Promise<void>(resolve => queueMicrotask(resolve))
    await new Promise<void>(resolve => queueMicrotask(resolve))
    assert.equal(getConnection(config).connector?.name, 'OKX Wallet', 'the library reflects a wallet-initiated connection')
    assertSafe(env, meta, okx)
  } finally { env.clean() }
})


test('late and repeated wallet announcements keep one named choice after hydration', async () => {
  const env = surface(), meta = new WalletMock()
  try {
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    assert.equal(config.connectors.length, 0)
    env.announce(meta, 'MetaMask', 'io.metamask', 12)
    assert.equal(config.connectors.length, 1)
    env.announce(meta, 'MetaMask', 'io.metamask', 12)
    env.announce(meta, 'MetaMask', 'io.metamask', 13)
    assert.equal(config.connectors.length, 1)
    assert.equal(config.connectors[0]?.id, 'io.metamask')
    assert.equal(meta.calls.length, 0)
    assertSafe(env, meta)
  } finally { env.clean() }
})


test('the handlers shared wallet and deployment gates refuse provider events and same-account A → B → A', async () => {
  const env = surface(), meta = new WalletMock(), okx = new WalletMock()
  meta.chainId = chain.id; okx.chainId = chain.id; okx.authorized = true
  const code = '0x6001600055' as const
  const network = resolveNetworkContext('https://app.example/?network=testnet', { VITE_SPLIT_RECEIPT_TESTNET_RUNTIME_HASH: keccak256(code) })
  const state: ActionScopeState = { active: true, generation: 0, walletChainId: undefined, walletAddress: undefined, walletConnectorUid: undefined, href: 'https://app.example/?network=testnet' }
  let unwatch = () => {}, unwatchAction = () => {}
  try {
    env.announce(meta, 'MetaMask', 'io.metamask', 14)
    env.announce(okx, 'OKX Wallet', 'com.okex.wallet', 15)
    const config = env.config()
    await rehydrate(config)
    await hydrate(config, { reconnectOnMount: WALLET_RECONNECT_ON_MOUNT }).onMount()
    const session = createExplicitWalletSession(config)
    unwatch = watchExplicitWalletSession(config, session)
    const syncIdentity = () => {
      const current = getConnection(config)
      updateActionWalletIdentity(state, { walletAddress: current.address, walletChainId: current.chainId, walletConnectorUid: current.connector?.uid })
    }
    const { watchConnection } = await import('@wagmi/core')
    unwatchAction = watchConnection(config, { onChange: syncIdentity })
    const action = createActionScopeGuard(network, () => state)
    const metaConnector = config.connectors.find(item => item.id === 'io.metamask')!
    const result = await connect(config, { connector: metaConnector })
    assert.equal(session.capture(), null, 'an announced connection cannot approve itself for writes')
    assert.equal(session.select(metaConnector.uid, { account: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', chainId: result.chainId }), false, 'a changed UI account cannot be confirmed')
    assert.equal(session.select(metaConnector.uid, { account: result.accounts[0], chainId: 1 }), false, 'a changed UI chain cannot be confirmed')
    assert.equal(session.capture(), null)
    assert.equal(session.select(metaConnector.uid, { account: result.accounts[0], chainId: result.chainId }), true)
    const original = session.capture()!
    assert.equal(walletSnapshotMatchesDisplay(original, { account: ACCOUNT, chainId: chain.id, connectorUid: metaConnector.uid }), true)
    assert.equal(walletSnapshotMatchesDisplay(original, { account: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', chainId: chain.id, connectorUid: metaConnector.uid }), false)
    assert.equal(walletSnapshotMatchesDisplay(original, { account: ACCOUNT, chainId: 1, connectorUid: metaConnector.uid }), false)
    assert.equal(walletSnapshotMatchesDisplay(original, { account: ACCOUNT, chainId: chain.id, connectorUid: 'another-wallet' }), false)
    const readonlyCheck = () => checkDeployment({ getChainId: async () => chain.id, getCode: async () => code }, network)
    const stable = await checkExplicitWalletWrite(session, original, () => checkScopedWrite(network, action, readonlyCheck, chain.id, ACCOUNT))
    let allowedMockWrites = 0
    if (!stable.blocked) allowedMockWrites++
    assert.equal(allowedMockWrites, 1, 'the same complete gate allows the correctly selected testnet wallet')
    assert.equal(original.connector, metaConnector)
    assert.equal(original.account.toLowerCase(), ACCOUNT)
    const oldAction = action.capture()
    let attemptedWrites = 0
    const changed = await checkExplicitWalletWrite(session, original, () => checkScopedWrite(network, action, async () => {
      okx.emit('connect', { chainId: `0x${chain.id.toString(16)}` })
      await new Promise<void>(resolve => queueMicrotask(resolve))
      await new Promise<void>(resolve => queueMicrotask(resolve))
      assert.equal(getConnection(config).connector?.name, 'OKX Wallet')
      return readonlyCheck()
    }, chain.id, ACCOUNT))
    if (!changed.blocked) attemptedWrites++
    assert.equal(attemptedWrites, 0)
    assert.equal(session.capture(), null, 'an external provider cannot approve itself')
    await connect(config, { connector: metaConnector })
    assert.equal(session.capture(), null, 'returning to MetaMask does not restore the page choice')
    assert.equal(session.isCurrent(original), false)
    assert.equal(action.isCurrent(oldAction), false)
    assert.equal(session.select(metaConnector.uid), true, 'Use this wallet is an explicit confirmation of the current provider')
    assert.equal(session.isCurrent(original), false, 'new confirmation cannot revive old callbacks')
    assert.equal(session.isCurrent(session.capture()), true)
    session.clear()
    assert.equal(session.capture(), null)
    assertSafe(env, meta, okx)
  } finally { unwatch(); unwatchAction(); env.clean() }
})
