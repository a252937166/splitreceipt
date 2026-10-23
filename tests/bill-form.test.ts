import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateBillForm, utf8ByteLength, type BillFormValues } from '../src/billForm.ts'
import { addr } from './fixtures.ts'

const good: BillFormValues = { title: 'Dinner', recipient: addr(1), payers: [addr(2), addr(3)], share: '10.50' }

describe('validateBillForm', () => {
  it('builds the exact intended bill', () => {
    const r = validateBillForm({ ...good, title: '  Dinner  ' })
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.intended.title, 'Dinner')
      assert.equal(r.intended.share, 10_500_000_000_000_000_000n)
      assert.deepEqual(r.intended.payers, [addr(2), addr(3)])
    }
  })
  it('counts title length in UTF-8 bytes, like the contract', () => {
    assert.equal(utf8ByteLength('é'), 2)
    const ok = validateBillForm({ ...good, title: 'a'.repeat(80) })
    assert.equal(ok.ok, true)
    const tooLong = validateBillForm({ ...good, title: 'é'.repeat(41) })
    assert.equal(!tooLong.ok && Boolean(tooLong.errors.title), true)
    assert.equal(validateBillForm({ ...good, title: 'a'.repeat(81) }).ok, false)
  })
  it('requires a title', () => {
    assert.equal(validateBillForm({ ...good, title: '   ' }).ok, false)
  })
  it('rejects bad and zero recipients', () => {
    assert.equal(validateBillForm({ ...good, recipient: '0x12' }).ok, false)
    assert.equal(validateBillForm({ ...good, recipient: addr(0) }).ok, false)
  })
  it('allows the recipient to also be a payer', () => {
    assert.equal(validateBillForm({ ...good, payers: [addr(1), addr(3)] }).ok, true)
  })
  it('enforces 2 to 5 payers', () => {
    assert.equal(validateBillForm({ ...good, payers: [addr(2)] }).ok, false)
    assert.equal(validateBillForm({ ...good, payers: [2, 3, 4, 5, 6, 7].map(addr) }).ok, false)
    assert.equal(validateBillForm({ ...good, payers: [2, 3, 4, 5, 6].map(addr) }).ok, true)
  })
  it('rejects duplicate payers regardless of case', () => {
    const a = '0x' + 'ab'.repeat(20)
    const r = validateBillForm({ ...good, payers: [a, a.toUpperCase().replace('0X', '0x')] })
    assert.equal(!r.ok && r.errors.payers?.[1], 'Duplicate payer.')
  })
  it('rejects the zero payer and malformed payers', () => {
    assert.equal(validateBillForm({ ...good, payers: [addr(0), addr(3)] }).ok, false)
    assert.equal(validateBillForm({ ...good, payers: ['nope', addr(3)] }).ok, false)
  })
  it('rejects zero, negative, too precise and malformed shares', () => {
    for (const s of ['', '0', '0.0', '-1', '1.0000001', '1e3', 'abc', '1,5']) {
      assert.equal(validateBillForm({ ...good, share: s }).ok, false, s)
    }
  })
  it('accepts the smallest 6-decimal share as 18-decimal native units', () => {
    const r = validateBillForm({ ...good, share: '0.000001' })
    assert.equal(r.ok && r.intended.share, 1_000_000_000_000n)
  })
})
