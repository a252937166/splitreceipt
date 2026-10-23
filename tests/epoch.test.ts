import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { EpochCounter, RequestScope } from '../src/epoch.ts'

const sources = () => ({ wallet: new EpochCounter(), page: new EpochCounter() })

describe('request epochs', () => {
  it('a fresh token is live', () => {
    assert.equal(new RequestScope(sources()).begin().isLive(), true)
  })

  it('any wallet change kills a token, and returning to the old state does not revive it', () => {
    const s = sources()
    const token = new RequestScope(s).begin()
    s.wallet.bump() // A -> B
    assert.equal(token.isLive(), false)
    s.wallet.bump() // B -> A
    assert.equal(token.isLive(), false)
  })

  it('any page change kills a token (bill A -> B -> A)', () => {
    const s = sources()
    const token = new RequestScope(s).begin()
    s.page.bump()
    s.page.bump()
    assert.equal(token.isLive(), false)
  })

  it('unmount invalidates every outstanding token of the scope', () => {
    const scope = new RequestScope(sources())
    const a = scope.begin()
    const snap = scope.snapshot()
    scope.dispose()
    assert.equal(a.isLive(), false)
    assert.equal(snap.isLive(), false)
  })

  it('beginning a new request supersedes the previous one but not another scope', () => {
    const s = sources()
    const one = new RequestScope(s)
    const other = new RequestScope(s)
    const first = one.begin()
    const foreign = other.begin()
    const second = one.begin()
    assert.equal(first.isLive(), false)
    assert.equal(second.isLive(), true)
    assert.equal(foreign.isLive(), true)
  })

  it('a snapshot does not supersede earlier tokens', () => {
    const scope = new RequestScope(sources())
    const a = scope.begin()
    scope.snapshot()
    assert.equal(a.isLive(), true)
  })

  it('counters only increase', () => {
    const c = new EpochCounter()
    const seen = [c.value, c.bump(), c.bump(), c.value]
    assert.deepEqual(seen, [0, 1, 2, 2])
  })
})
