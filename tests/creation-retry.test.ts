import assert from 'node:assert/strict'
import { test } from 'node:test'
import { creationMayRetry } from '../src/creationRetry.ts'

test('cancelled, replaced and reverted requests release the same retry guard used by createBill', () => {
  for (const kind of ['cancelled', 'replaced', 'reverted']) assert.equal(creationMayRetry(kind), true)
})

test('an unexplained successful receipt or another wallet/context does not silently permit another bill', () => {
  for (const kind of ['confirmed', 'stale', 'missing-event', 'ambiguous-event', 'wrong-wallet', 'wrong-chain']) {
    assert.equal(creationMayRetry(kind), false)
  }
})
