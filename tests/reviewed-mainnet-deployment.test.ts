import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesReviewedMainnetDeployment, transactionFeeFields, MAINNET_MAX_FEE_PER_GAS, type ReviewedMainnetDeployment } from '../src/mainnetDeployment.ts'
const record: ReviewedMainnetDeployment = Object.freeze({ chainId: 5042,
  contract: '0x2222222222222222222222222222222222222222', deploymentBlock: 123n,
  runtimeHash: `0x${'1'.repeat(64)}`, deploymentTransactionHash: `0x${'2'.repeat(64)}` })
const context = { chainId: 5042, contract: record.contract, deploymentBlock: record.deploymentBlock, expectedRuntimeHash: record.runtimeHash }
test('only a complete exact reviewed deployment identity matches; unknown is closed', () => {
  assert.equal(matchesReviewedMainnetDeployment(context, null), false)
  assert.equal(matchesReviewedMainnetDeployment(context, record), true)
  for (const changed of [{ ...context, chainId: 5042002 }, { ...context, contract: null },
    { ...context, contract: '0x3333333333333333333333333333333333333333' as const },
    { ...context, deploymentBlock: 124n }, { ...context, expectedRuntimeHash: `0x${'3'.repeat(64)}` as const }]) {
    assert.equal(matchesReviewedMainnetDeployment(changed, record), false)
  }
})
test('incomplete and invalid source records cannot enable writes', () => {
  for (const changed of [{ ...record, deploymentBlock: 0n }, { ...record, contract: `0x${'0'.repeat(40)}` as const },
    { ...record, runtimeHash: `0x${'0'.repeat(64)}` as const }, { ...record, deploymentTransactionHash: `0x${'0'.repeat(64)}` as const }]) {
    assert.equal(matchesReviewedMainnetDeployment(context, changed), false)
  }
})


test('mainnet create/pay request fees are capped at40Gwei with zero priority fee; testnet unchanged', () => {
  assert.deepEqual(transactionFeeFields({ chainId: 5042 }), { maxFeePerGas: 40_000_000_000n, maxPriorityFeePerGas: 0n })
  assert.equal(MAINNET_MAX_FEE_PER_GAS, 40_000_000_000n)
  assert.deepEqual(transactionFeeFields({ chainId: 5042002 }), {})
  assert.throws(() => transactionFeeFields({ chainId: 1 }), /Unsupported/)
})
