import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SubmissionLock, releasesLock } from '../src/submissionLock.ts'

describe('SubmissionLock', () => {
  it('only a verified or a definitively not-completed reconciliation releases it', () => {
    assert.equal(releasesLock('verified'), true)
    assert.equal(releasesLock('not-completed'), true)
    assert.equal(releasesLock('sent-unverified'), false)
    assert.equal(releasesLock('stale'), false)
  })

  it('a timeout (sent-unverified) or a stale context keeps the intent held', () => {
    const lock = new SubmissionLock<{ submittedHash: string }>()
    lock.hold({ submittedHash: '0xaa' })
    assert.equal(lock.held, true)
    assert.equal(lock.reconcile('sent-unverified'), false)
    assert.equal(lock.reconcile('stale'), false)
    assert.equal(lock.held, true)
    assert.equal(lock.intent?.submittedHash, '0xaa')
  })

  it('definitive reconciliation unlocks for an explicit retry', () => {
    const lock = new SubmissionLock<{ submittedHash: string }>()
    lock.hold({ submittedHash: '0xaa' })
    assert.equal(lock.reconcile('not-completed'), true)
    assert.equal(lock.held, false)
    lock.hold({ submittedHash: '0xbb' })
    assert.equal(lock.reconcile('verified'), true)
    assert.equal(lock.held, false)
  })

  it('there is no way to release it by hiding a notice: the class has no such operation', () => {
    const names = Object.getOwnPropertyNames(SubmissionLock.prototype).sort()
    assert.deepEqual(names, ['constructor', 'held', 'hold', 'intent', 'reconcile'])
  })
})
