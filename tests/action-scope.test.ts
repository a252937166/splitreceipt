import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keccak256 } from 'viem'
import { createActionScopeGuard, createActionScopeLifecycle, updateActionWalletIdentity, checkScopedWrite, type ActionScopeState } from '../src/actionScope.ts'
import { checkDeployment, resolveNetworkContext, type DeploymentCheck } from '../src/networkContext.ts'
import { buildNetworkNavigationUrl } from '../src/networkNavigation.ts'
import { buildShareUrl, catalogHintsForScope, loadStoredHints, saveVerifiedHints, type HintHash } from '../src/receiptHints.ts'
import { receiptScopeKey } from '../src/receiptHistory.ts'

const WALLET = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const CODE = '0x6001600055' as const
const TEST = resolveNetworkContext('https://app.example/?network=testnet', {
  VITE_SPLIT_RECEIPT_TESTNET_RUNTIME_HASH: keccak256(CODE),
})
const ready: DeploymentCheck = { status: 'ready', contextKey: TEST.contextKey, reason: null }
function setup(href = 'https://app.example/?bill=3') {
  const state: ActionScopeState = { active: true, generation: 1, walletChainId: TEST.chainId, walletAddress: WALLET, walletConnectorUid: 'metamask-page-1', href }
  return { state, guard: createActionScopeGuard(TEST, () => state) }
}

test('late create/payment callbacks are invalid after wallet, navigation, generation or unmount changes', () => {
  for (const mutate of [
    (s: ActionScopeState) => { s.walletChainId = 5042 },
    (s: ActionScopeState) => { s.walletAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    (s: ActionScopeState) => { s.walletAddress = undefined },
    (s: ActionScopeState) => { s.href = 'https://app.example/?network=mainnet' },
    (s: ActionScopeState) => { s.href = 'https://app.example/?network=testnet&contract=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    (s: ActionScopeState) => { s.generation++ },
    (s: ActionScopeState) => { s.active = false },
  ]) {
    const { state, guard } = setup()
    const snapshot = guard.capture()
    assert.equal(guard.isCurrent(snapshot), true)
    mutate(state)
    assert.equal(guard.isCurrent(snapshot), false)
  }
})

test('the shared write gate blocks a wallet/navigation change during readonly verification', async () => {
  for (const mutate of [
    (s: ActionScopeState) => { s.walletAddress = undefined },
    (s: ActionScopeState) => { s.walletChainId = 5042 },
    (s: ActionScopeState) => { s.href = 'https://app.example/?network=mainnet' },
    (s: ActionScopeState) => { s.generation++ },
  ]) {
    const { state, guard } = setup()
    let writes = 0
    const result = await checkScopedWrite(TEST, guard, async () => { mutate(state); return ready }, TEST.chainId, WALLET)
    if (!result.blocked) writes++
    assert.equal(writes, 0)
    assert.match(result.blocked ?? '', /changed/i)
  }
})

test('the same gate used by handlers refuses wrong RPC chain, EOA, code mismatch and RPC failure', async () => {
  const clients = [
    { getChainId: async () => 5042, getCode: async () => CODE },
    { getChainId: async () => TEST.chainId, getCode: async () => '0x' as const },
    { getChainId: async () => TEST.chainId, getCode: async () => '0x6000' as const },
    { getChainId: async (): Promise<number> => { throw new Error('offline') }, getCode: async () => CODE },
  ]
  for (const client of clients) {
    const { guard } = setup()
    let writes = 0
    const result = await checkScopedWrite(TEST, guard, () => checkDeployment(client, TEST), TEST.chainId, WALLET)
    if (!result.blocked) writes++
    assert.equal(writes, 0)
    assert.ok(result.blocked)
  }
})

test('verified testnet identity permits a request only for the connected matching wallet chain', async () => {
  for (const walletChainId of [undefined, 1, 5042, TEST.chainId]) {
    const { state, guard } = setup()
    state.walletChainId = walletChainId
    const result = await checkScopedWrite(TEST, guard, async () => ready, walletChainId, WALLET)
    assert.equal(result.blocked === null, walletChainId === TEST.chainId)
  }
})

test('unconfigured mainnet does zero RPC and zero writes; even a ready mock cannot unlock it', async () => {
  let calls = 0
  const client = { getChainId: async () => { calls++; return 5042 }, getCode: async () => { calls++; return CODE } }
  const mainnet = resolveNetworkContext('https://app.example/?network=mainnet', {
    VITE_SPLIT_RECEIPT_MAINNET_ADDRESS: '', VITE_SPLIT_RECEIPT_MAINNET_DEPLOY_BLOCK: '', VITE_SPLIT_RECEIPT_MAINNET_RUNTIME_HASH: '',
  })
  const state: ActionScopeState = { active: true, generation: 0, walletChainId: 5042, walletAddress: WALLET, walletConnectorUid: 'metamask-page-1', href: 'https://app.example/?network=mainnet' }
  const guard = createActionScopeGuard(mainnet, () => state)
  const result = await checkScopedWrite(mainnet, guard, () => checkDeployment(client, mainnet), 5042, WALLET)
  assert.ok(result.blocked)
  assert.equal(calls, 0)
  const configured = resolveNetworkContext(state.href, {
    VITE_SPLIT_RECEIPT_MAINNET_ADDRESS: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    VITE_SPLIT_RECEIPT_MAINNET_DEPLOY_BLOCK: '1', VITE_SPLIT_RECEIPT_MAINNET_RUNTIME_HASH: keccak256(CODE),
  })
  const readyMock: DeploymentCheck = { status: 'ready', contextKey: configured.contextKey, reason: null }
  const stillBlocked = await checkScopedWrite(configured, createActionScopeGuard(configured, () => state), async () => readyMock, 5042, WALLET)
  assert.match(stillBlocked.blocked ?? '', /disabled/)
})

test('network navigation clears bill, receipts, contract and fragment without any wallet call', () => {
  const href = buildNetworkNavigationUrl('https://app.example/splitreceipt/?bill=3&receipts=0x123&contract=0x123#checks', 'mainnet')
  const url = new URL(href)
  assert.equal(url.searchParams.get('network'), 'mainnet')
  assert.equal(url.searchParams.get('chainId'), '5042')
  for (const field of ['bill', 'receipts', 'contract']) assert.equal(url.searchParams.get(field), null)
  assert.equal(url.hash, '')
  assert.equal(resolveNetworkContext(href).key, 'mainnet')
})

test('share URLs roundtrip network, chain and configured contract; legacy bill links stay testnet', () => {
  const original = (globalThis as Record<string, unknown>).window
  ;(globalThis as Record<string, unknown>).window = { location: { href: 'https://app.example/splitreceipt/?bill=999&receipts=bad#checks' } }
  try {
    const hash = `0x${'1'.repeat(64)}` as HintHash
    const url = new URL(buildShareUrl(3n, [hash], TEST))
    assert.equal(url.searchParams.get('network'), 'testnet')
    assert.equal(url.searchParams.get('chainId'), String(TEST.chainId))
    assert.equal(url.searchParams.get('contract'), TEST.contract)
    assert.equal(url.searchParams.get('bill'), '3')
    assert.equal(url.searchParams.get('receipts'), hash)
    assert.equal(url.hash, '')
    assert.equal(resolveNetworkContext(url.href).contract, TEST.contract)
    assert.equal(resolveNetworkContext('https://app.example/?bill=3').key, 'testnet')
    assert.throws(() => buildShareUrl(3n, [], { key: 'mainnet', chainId: 5042, contract: null }), /unconfigured/)
  } finally {
    if (original === undefined) delete (globalThis as Record<string, unknown>).window
    else (globalThis as Record<string, unknown>).window = original
  }
})

test('same bill and address on different chains never share receipt storage or catalog entries', () => {
  const oldStorage = (globalThis as Record<string, unknown>).localStorage
  const values = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  try {
    const testScope = { chainId: TEST.chainId, contract: TEST.contract!, billId: 3n }
    const mainScope = { ...testScope, chainId: 5042 }
    const otherContract = { ...testScope, contract: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }
    const hash = `0x${'2'.repeat(64)}` as HintHash
    saveVerifiedHints(testScope, [hash])
    assert.deepEqual(loadStoredHints(testScope), [hash])
    assert.deepEqual(loadStoredHints(mainScope), [])
    assert.deepEqual(loadStoredHints(otherContract), [])
    assert.notEqual(receiptScopeKey(testScope), receiptScopeKey(mainScope))
    assert.notEqual(receiptScopeKey(testScope), receiptScopeKey(otherContract))
    assert.equal(catalogHintsForScope(testScope).length, 2)
    assert.deepEqual(catalogHintsForScope(mainScope), [])
  } finally {
    if (oldStorage === undefined) delete (globalThis as Record<string, unknown>).localStorage
    else (globalThis as Record<string, unknown>).localStorage = oldStorage
  }
})

test('wallet or connector A → B → A invalidates old asynchronous requests permanently', () => {
  const { state, guard } = setup()
  const pending = guard.capture()
  updateActionWalletIdentity(state, { walletAddress: WALLET, walletChainId: TEST.chainId, walletConnectorUid: 'okx-page-1' })
  assert.equal(guard.isCurrent(pending), false, 'same account and chain cannot hide a provider change')
  updateActionWalletIdentity(state, { walletAddress: WALLET, walletChainId: TEST.chainId, walletConnectorUid: 'metamask-page-1' })
  assert.equal(guard.isCurrent(pending), false, 'returning to the original connector must not revive a callback')
  const fresh = guard.capture()
  assert.equal(guard.isCurrent(fresh), true)
  updateActionWalletIdentity(state, { walletAddress: undefined, walletChainId: undefined, walletConnectorUid: undefined })
  updateActionWalletIdentity(state, { walletAddress: WALLET, walletChainId: TEST.chainId, walletConnectorUid: 'metamask-page-1' })
  assert.equal(guard.isCurrent(fresh), false, 'disconnect/reconnect creates another action generation')
})

test('BFCache restoration reloads the app without reactivating an earlier transaction callback', () => {
  const { state, guard } = setup()
  const pending = guard.capture()
  let reloads = 0
  const lifecycle = createActionScopeLifecycle(() => state, () => { reloads++ })
  lifecycle.leave()
  assert.equal(state.active, false)
  assert.equal(guard.isCurrent(pending), false)
  lifecycle.restoreFromCache()
  assert.equal(reloads, 1)
  assert.equal(state.active, false, 'the cached instance stays inactive until replaced by reload')
  assert.equal(guard.isCurrent(pending), false, 'old requests cannot revive after pageshow')
  const reloaded = setup()
  assert.equal(reloaded.guard.isCurrent(reloaded.guard.capture()), true, 'a fresh page can accept a new action')
})
