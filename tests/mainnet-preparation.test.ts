import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { keccak256 } from 'viem'
import { PREPARATION_BASELINE, prepareDeploymentBundle } from '../tools/mainnet/prepare.mjs'

// Read existing public source/dependency bytes; tests do not write artifacts, connect wallets or use an RPC.
const sourceBytes = readFileSync(resolve('contracts/SplitReceipt.sol'))
const guardBytes = readFileSync(resolve('node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol'))
function artifact() {
  return {
    abi: [
      { type: 'function', name: 'createBill', stateMutability: 'nonpayable', inputs: ['string', 'address', 'address[]', 'uint256'].map(type => ({ type })), outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'payShare', stateMutability: 'payable', inputs: [{ type: 'uint256' }], outputs: [] },
      { type: 'function', name: 'getBill', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: ['string', 'address', 'address[]', 'uint256', 'bool[]'].map(type => ({ type })) },
      { type: 'function', name: 'billCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
    ],
    bytecode: { object: '0x60006000', linkReferences: {} },
    deployedBytecode: { object: '0x6001600055', linkReferences: {}, immutableReferences: {} },
    metadata: {
      compiler: { version: PREPARATION_BASELINE.compiler },
      settings: { compilationTarget: { 'contracts/SplitReceipt.sol': 'SplitReceipt' }, evmVersion: 'paris', optimizer: { enabled: true, runs: 200 }, libraries: {} },
      sources: { 'contracts/SplitReceipt.sol': { keccak256: PREPARATION_BASELINE.sourceHash },
        'node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol': { keccak256: PREPARATION_BASELINE.guardHash } },
    },
  }
}
function prepare(candidate: ReturnType<typeof artifact>) {
  return prepareDeploymentBundle({ artifact: candidate, sourceBytes, guardBytes })
}

test('unsigned draft cannot claim review or deployment, even for matching source/compiler metadata', () => {
  const candidate = artifact()
  const result = prepare(candidate)
  assert.equal(result.manifest.status, 'UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW')
  assert.equal(result.manifest.artifactReviewStatus, 'REQUIRES_INDEPENDENT_REVIEW')
  assert.equal(result.manifest.deployedAddress, null)
  assert.equal(result.manifest.deploymentTransactionHash, null)
  assert.equal(result.unsignedTransaction.chainId, 5042)
  assert.equal(result.unsignedTransaction.to, null)
  assert.equal(result.unsignedTransaction.value, '0x0')
  assert.equal(result.unsignedTransaction.data, candidate.bytecode.object)
  assert.equal(result.manifest.runtimeCodeHash, keccak256(candidate.deployedBytecode.object as `0x${string}`))
  assert.equal(result.manifest.historicalRuntimeExactMatch, false)
  assert.deepEqual(result.manifest.actionsPerformed, { rpcRequests: 0, walletConnections: 0, signatures: 0, broadcasts: 0 })
  assert.equal(result.manifest.mainnetWritesEnabledInApplication, false)
  for (const field of ['walletFrom', 'nonce', 'gasEstimate', 'feeQuote']) assert.equal(result.manifest[field], null)
  assert.ok(result.manifest.preSigningRequirements.some((line: string) => /fresh gas/.test(line)))
})

test('changed first-party or dependency source bytes reject before preparing a bundle', () => {
  assert.throws(() => prepareDeploymentBundle({ artifact: artifact(), sourceBytes: Buffer.concat([sourceBytes, Buffer.from('\n')]), guardBytes }), /source differs/)
  assert.throws(() => prepareDeploymentBundle({ artifact: artifact(), sourceBytes, guardBytes: Buffer.concat([guardBytes, Buffer.from('\n')]) }), /dependency/)
})

test('untrusted artifacts cannot alter pinned compiler, optimizer, EVM, target or source attestations', () => {
  const mutations = [
    (a: ReturnType<typeof artifact>) => { a.metadata.compiler.version = '0.8.29' },
    (a: ReturnType<typeof artifact>) => { a.metadata.settings.evmVersion = 'cancun' },
    (a: ReturnType<typeof artifact>) => { a.metadata.settings.optimizer.runs = 999 },
    (a: ReturnType<typeof artifact>) => { a.metadata.settings.optimizer.enabled = false },
    (a: ReturnType<typeof artifact>) => { a.metadata.settings.compilationTarget['contracts/SplitReceipt.sol'] = 'Other' },
    (a: ReturnType<typeof artifact>) => { a.metadata.sources['contracts/SplitReceipt.sol'].keccak256 = '0x' + '0'.repeat(64) },
    (a: ReturnType<typeof artifact>) => { a.metadata.sources['node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol'].keccak256 = '0x' + '0'.repeat(64) },
  ]
  for (const mutate of mutations) { const candidate = artifact(); mutate(candidate); assert.throws(() => prepare(candidate)) }
})

test('wrong ABI and constructor/fallback behavior cannot produce a deployment draft', () => {
  const changedFunction = artifact()
  changedFunction.abi[1].stateMutability = 'nonpayable'
  assert.throws(() => prepare(changedFunction), /payShare/)
  const constructor = artifact()
  constructor.abi.push({ type: 'constructor', name: '', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] })
  assert.throws(() => prepare(constructor), /constructor/)
  const extra = artifact()
  extra.abi.push({ type: 'fallback', name: '', stateMutability: 'payable', inputs: [], outputs: [] })
  assert.throws(() => prepare(extra), /fallback/)
})

test('empty, odd, unresolved or malformed creation/runtime bytecode are refused', () => {
  for (const field of ['bytecode', 'deployedBytecode'] as const) {
    for (const value of ['0x', '0x123', '0x__$unresolved$__', 'not-hex']) {
      const candidate = artifact()
      candidate[field].object = value
      assert.throws(() => prepare(candidate), /bytecode/)
    }
  }
})
