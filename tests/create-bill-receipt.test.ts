import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applyCreationReplacement,
  confirmBillCreation,
  type BillCreatedLog,
  type CreateBillSubmission,
} from '../src/createBillReceipt.ts'
import type { ReceiptHash } from '../src/receiptHistory.ts'

const contract = '0x1111111111111111111111111111111111111111'
const creator = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const payer = '0xcccccccccccccccccccccccccccccccccccccccc'
const hash = (id: number) => `0x${id.toString(16).padStart(64, '0')}` as ReceiptHash
const request: CreateBillSubmission = {
  chainId: 5042002, contract, creator, recipient,
  title: 'Shared dinner', payers: [creator, payer], share: 1_000_000n, hash: hash(1),
}
const context = { receiptChainId: 5042002, connectedChainId: 5042002, connectedAddress: creator }
const log: BillCreatedLog = {
  address: contract,
  args: { billId: 9n, recipient, title: request.title, share: request.share, payers: request.payers },
}
const receipt = { status: 'success' as const, transactionHash: hash(1), logs: [log] }

test('a speedup is bound to the original request and confirms only the final mined hash', () => {
  const spedUp = applyCreationReplacement(request, { reason: 'repriced', replacedHash: hash(1), minedHash: hash(2) })
  assert.equal(spedUp.hash, hash(1))
  assert.equal(spedUp.minedHash, hash(2))
  assert.deepEqual(confirmBillCreation(spedUp, { ...receipt, transactionHash: hash(2) }, context), {
    kind: 'confirmed', billId: 9n, transactionHash: hash(2),
  })
  assert.equal(confirmBillCreation(spedUp, receipt, context).kind, 'stale')
  // An old asynchronous callback cannot rewrite a different request's expected hash.
  const nextRequest = { ...request, hash: hash(3) }
  assert.equal(applyCreationReplacement(nextRequest, { reason: 'repriced', replacedHash: hash(1), minedHash: hash(2) }), nextRequest)
})

test('mined cancellation, generic replacement, revert, or a snapshot without a wallet-returned hash never creates a bill', () => {
  for (const reason of ['cancelled', 'replaced'] as const) {
    const replaced = applyCreationReplacement(request, { reason, replacedHash: hash(1), minedHash: hash(2) })
    assert.equal(confirmBillCreation(replaced, { ...receipt, transactionHash: hash(2) }, context).kind, reason)
    assert.equal(confirmBillCreation(replaced, { ...receipt, transactionHash: hash(2), logs: [] }, context).kind, reason)
  }
  assert.equal(confirmBillCreation(request, { ...receipt, status: 'reverted' }, context).kind, 'reverted')
  assert.equal(confirmBillCreation({ ...request, hash: undefined }, receipt, context).kind, 'stale')
  assert.equal(confirmBillCreation(request, { ...receipt, logs: [] }, context).kind, 'missing-event')
})

test('every captured event field and the contract must match, including payer order and a nonremoved valid bill id', () => {
  const mismatches: BillCreatedLog[] = [
    { ...log, address: recipient },
    { ...log, removed: true },
    { ...log, args: { ...log.args, billId: 0n } },
    { ...log, args: { ...log.args, recipient: payer } },
    { ...log, args: { ...log.args, title: 'Other dinner' } },
    { ...log, args: { ...log.args, share: 2_000_000n } },
    { ...log, args: { ...log.args, payers: [payer, creator] } },
    { ...log, args: { ...log.args, payers: [creator] } },
  ]
  for (const mismatch of mismatches) {
    assert.equal(confirmBillCreation(request, { ...receipt, logs: [mismatch] }, context).kind, 'missing-event')
  }
  assert.equal(confirmBillCreation(request, {
    ...receipt,
    logs: [{ ...log, address: contract.toUpperCase(), args: { ...log.args, recipient: recipient.toUpperCase(), payers: request.payers.map(p => p.toUpperCase()) } }],
  }, context).kind, 'confirmed')
})

test('ambiguous bill ids are rejected rather than selecting the first matching event', () => {
  assert.equal(confirmBillCreation(request, {
    ...receipt, logs: [log, { ...log, args: { ...log.args, billId: 10n } }],
  }, context).kind, 'ambiguous-event')
  // A repeated copy of the same physical event still identifies one unique bill.
  assert.equal(confirmBillCreation(request, { ...receipt, logs: [log, log] }, context).kind, 'confirmed')
})

test('wallet or chain changes during confirmation cannot redirect another wallet to the earlier request', () => {
  assert.equal(confirmBillCreation(request, receipt, { ...context, connectedAddress: payer }).kind, 'wrong-wallet')
  assert.equal(confirmBillCreation(request, receipt, { ...context, connectedAddress: undefined }).kind, 'wrong-wallet')
  assert.equal(confirmBillCreation(request, receipt, { ...context, connectedChainId: 5042 }).kind, 'wrong-chain')
  assert.equal(confirmBillCreation(request, receipt, { ...context, receiptChainId: 5042 }).kind, 'wrong-chain')
  assert.equal(confirmBillCreation(request, receipt, context).kind, 'confirmed')
})
