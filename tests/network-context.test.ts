import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keccak256, type Hex } from 'viem'
import {
  ARC_MAINNET_CHAIN_ID, ARC_TESTNET_CHAIN_ID, MAINNET_WRITES_ENABLED, TESTNET_CONTRACT, TESTNET_RUNTIME_HASH,
  resolveNetworkContext, isCurrentLocationContext, checkDeployment, getWriteBlockReason, assertCanWrite,
  type PublicNetworkEnv, type ReadonlyDeploymentClient,
} from '../src/networkContext.ts'
import { requireChain } from '../src/onchain-facts.ts'

const code: Hex = '0x600060005260206000f3'
const runtimeHash = keccak256(code)
const wallet = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const customTestnet = '0x1111111111111111111111111111111111111111'
const customMainnet = '0x2222222222222222222222222222222222222222'
const testEnv: PublicNetworkEnv = {
  VITE_SPLIT_RECEIPT_TESTNET_ADDRESS: customTestnet,
  VITE_SPLIT_RECEIPT_TESTNET_DEPLOY_BLOCK: '123',
  VITE_SPLIT_RECEIPT_TESTNET_RUNTIME_HASH: runtimeHash,
}
const mainEnv: PublicNetworkEnv = {
  VITE_SPLIT_RECEIPT_MAINNET_ADDRESS: customMainnet,
  VITE_SPLIT_RECEIPT_MAINNET_DEPLOY_BLOCK: '456',
  VITE_SPLIT_RECEIPT_MAINNET_RUNTIME_HASH: runtimeHash,
}
function client(chainId: number, bytecode: Hex | undefined = code) {
  const calls = { chain: 0, code: 0 }
  const rpc: ReadonlyDeploymentClient = {
    async getChainId() { calls.chain++; return chainId },
    async getCode() { calls.code++; return bytecode },
  }
  return { rpc, calls }
}

test('blank and legacy bill URLs remain testnet despite mainnet env flags or deployment fields', () => {
  for (const href of ['', '?bill=3', '?chainId=5042002&bill=3']) {
    const context = resolveNetworkContext(href, { ...mainEnv, VITE_NETWORK: 'mainnet', VITE_MAINNET_WRITES_ENABLED: 'true' })
    assert.equal(context.chainId, ARC_TESTNET_CHAIN_ID)
    assert.equal(context.contract, TESTNET_CONTRACT)
    assert.equal(context.expectedRuntimeHash, TESTNET_RUNTIME_HASH)
    assert.equal(context.deploymentBlock, 67660831n)
    assert.equal(context.configError, null)
  }
})

test('mainnet missing configuration stays blank and cannot inherit any testnet deployment field', async () => {
  const context = resolveNetworkContext('?network=mainnet', {
    ...testEnv, VITE_SPLIT_RECEIPT_ADDRESS: TESTNET_CONTRACT, VITE_SPLIT_RECEIPT_DEPLOY_BLOCK: '67660831',
  })
  assert.equal(context.chainId, ARC_MAINNET_CHAIN_ID)
  assert.equal(context.contract, null)
  assert.equal(context.deploymentBlock, null)
  assert.equal(context.expectedRuntimeHash, null)
  const rpc = client(ARC_MAINNET_CHAIN_ID)
  assert.equal((await checkDeployment(rpc.rpc, context)).status, 'unconfigured')
  assert.deepEqual(rpc.calls, { chain: 0, code: 0 })
  assert.throws(() => assertCanWrite(context, null, ARC_MAINNET_CHAIN_ID, wallet), /not configured/)
})

test('unknown, contradictory and duplicate URL identities fail closed instead of switching implicitly', () => {
  for (const href of ['?network=other', '?network=', '?chainId=5042&bill=3', '?network=mainnet&chainId=5042002',
    '?network=testnet&network=mainnet', '?chainId=5042002&chainId=5042', '?contract=0x123',
    '?network=testnet&contract=0x2222222222222222222222222222222222222222']) {
    const context = resolveNetworkContext(href, mainEnv)
    assert.ok(context.configError, href)
    assert.ok(getWriteBlockReason(context, null, context.chainId, wallet), href)
  }
})

test('URL contract identity can match configuration but can never replace it', () => {
  const context = resolveNetworkContext(`?network=mainnet&chainId=5042&contract=${customMainnet}`, mainEnv)
  assert.equal(context.configError, null)
  assert.equal(context.contract, customMainnet)
  const replaced = resolveNetworkContext(`?network=mainnet&contract=${customTestnet}`, mainEnv)
  assert.equal(replaced.contract, customMainnet)
  assert.ok(replaced.configError)
})

test('zero, malformed and historical testnet addresses are refused as mainnet deployments before RPC', async () => {
  for (const configured of ['0x' + '0'.repeat(40), '0x1234', TESTNET_CONTRACT, TESTNET_CONTRACT.toUpperCase().replace('0X', '0x')]) {
    const context = resolveNetworkContext('?network=mainnet', { ...mainEnv, VITE_SPLIT_RECEIPT_MAINNET_ADDRESS: configured })
    const rpc = client(ARC_MAINNET_CHAIN_ID)
    assert.equal((await checkDeployment(rpc.rpc, context)).status, 'invalid', configured)
    assert.deepEqual(rpc.calls, { chain: 0, code: 0 })
  }
})

test('invalid deployment block/hash and conflicting testnet overrides are rejected', () => {
  for (const env of [
    { ...testEnv, VITE_SPLIT_RECEIPT_TESTNET_DEPLOY_BLOCK: '-1' },
    { ...testEnv, VITE_SPLIT_RECEIPT_TESTNET_DEPLOY_BLOCK: '1.5' },
    { ...testEnv, VITE_SPLIT_RECEIPT_TESTNET_RUNTIME_HASH: '0x1234' },
    { ...testEnv, VITE_SPLIT_RECEIPT_ADDRESS: customMainnet },
  ]) assert.ok(resolveNetworkContext('', env).configError)
  const overrideWithoutProof = resolveNetworkContext('', { VITE_SPLIT_RECEIPT_ADDRESS: customTestnet })
  assert.equal(overrideWithoutProof.expectedRuntimeHash, null)
  assert.equal(overrideWithoutProof.deploymentBlock, null)
})

test('a live RPC chain mismatch stops before fetching bytecode', async () => {
  const context = resolveNetworkContext('', testEnv)
  const rpc = client(ARC_MAINNET_CHAIN_ID)
  const verification = await checkDeployment(rpc.rpc, context)
  assert.equal(verification.status, 'wrong-chain')
  assert.deepEqual(rpc.calls, { chain: 1, code: 0 })
  assert.throws(() => assertCanWrite(context, verification, context.chainId, wallet), /wrong network/)
})

test('EOA, empty code and non-matching contract runtime cannot enable a write', async () => {
  const context = resolveNetworkContext('', testEnv)
  for (const bytecode of [undefined, '0x', '0x6001'] as const) {
    const rpc = client(context.chainId)
    rpc.rpc.getCode = async () => bytecode
    const verification = await checkDeployment(rpc.rpc, context)
    assert.equal(verification.status, !bytecode || bytecode === '0x' ? 'missing-code' : 'code-mismatch')
    let writeCalls = 0
    try { assertCanWrite(context, verification, context.chainId, wallet); writeCalls++ } catch { /* correctly blocked */ }
    assert.equal(writeCalls, 0)
  }
})

test('RPC failures remain errors and cannot reuse a prior ready result', async () => {
  const context = resolveNetworkContext('', testEnv)
  const rpc = client(context.chainId)
  const ready = await checkDeployment(rpc.rpc, context)
  assert.equal(ready.status, 'ready')
  rpc.rpc.getCode = async () => { throw new Error('transient private vendor diagnostic') }
  const failed = await checkDeployment(rpc.rpc, context)
  assert.equal(failed.status, 'rpc-error')
  assert.ok(!failed.reason?.includes('private vendor'))
  assert.throws(() => assertCanWrite(context, failed, context.chainId, wallet))
})

test('a verified testnet deployment requires the exact wallet chain and valid account', async () => {
  const context = resolveNetworkContext('', testEnv)
  const ready = await checkDeployment(client(context.chainId).rpc, context)
  assert.equal(getWriteBlockReason(context, ready, context.chainId, wallet), null)
  assert.doesNotThrow(() => assertCanWrite(context, ready, context.chainId, wallet))
  for (const [chainId, account] of [[ARC_MAINNET_CHAIN_ID, wallet], [undefined, wallet], [context.chainId, undefined],
    [context.chainId, '0x' + '0'.repeat(40)]] as const) {
    assert.throws(() => assertCanWrite(context, ready, chainId, account))
  }
})

test('no URL, environment flag or ready deployment can arm mainnet transactions', async () => {
  const context = resolveNetworkContext('?network=mainnet&chainId=5042', {
    ...mainEnv, VITE_MAINNET_WRITES_ENABLED: 'true', MAINNET_WRITES_ENABLED: 'true',
  })
  const ready = await checkDeployment(client(context.chainId).rpc, context)
  assert.equal(ready.status, 'ready')
  assert.equal(MAINNET_WRITES_ENABLED, false)
  assert.equal(context.mainnetWritesEnabled, false)
  let writes = 0
  try { assertCanWrite(context, ready, context.chainId, wallet); writes++ } catch { /* required preparation lock */ }
  assert.equal(writes, 0)
  assert.match(getWriteBlockReason(context, ready, context.chainId, wallet)!, /disabled/)
})

test('verification identity includes chain, contract, runtime hash and deployment block', async () => {
  const context = resolveNetworkContext('', testEnv)
  const ready = await checkDeployment(client(context.chainId).rpc, context)
  for (const next of [
    resolveNetworkContext('?network=mainnet', mainEnv),
    resolveNetworkContext('', { ...testEnv, VITE_SPLIT_RECEIPT_TESTNET_ADDRESS: customMainnet }),
    resolveNetworkContext('', { ...testEnv, VITE_SPLIT_RECEIPT_TESTNET_RUNTIME_HASH: '0x' + '1'.repeat(64) }),
    resolveNetworkContext('', { ...testEnv, VITE_SPLIT_RECEIPT_TESTNET_DEPLOY_BLOCK: '124' }),
  ]) {
    assert.notEqual(next.contextKey, context.contextKey)
    assert.ok(getWriteBlockReason(next, ready, next.chainId, wallet))
  }
})

test('pending callback location checks reject cross-chain, changed-contract and contradictory URLs', () => {
  const context = resolveNetworkContext('', testEnv)
  assert.ok(isCurrentLocationContext(context, '?bill=3'))
  assert.ok(isCurrentLocationContext(context, `?network=testnet&chainId=5042002&contract=${customTestnet}&bill=3`))
  for (const href of ['?network=mainnet', `?network=testnet&contract=${customMainnet}`, '?network=testnet&chainId=5042',
    '?network=testnet&network=mainnet']) assert.equal(isCurrentLocationContext(context, href), false)
})

test('chain facts keep native decimals at eighteen, expose correct explorers and reject unsupported chains', () => {
  const testnet = requireChain(ARC_TESTNET_CHAIN_ID)
  const mainnet = requireChain(ARC_MAINNET_CHAIN_ID)
  assert.equal(testnet.nativeCurrency.decimals, 18)
  assert.equal(mainnet.nativeCurrency.decimals, 18)
  assert.equal(testnet.isTestnet, true)
  assert.equal(mainnet.isTestnet, false)
  assert.notEqual(testnet.explorerBase, mainnet.explorerBase)
  assert.throws(() => requireChain(1), /Unsupported network/)
})
