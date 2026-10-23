import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cycleFocusIndex } from '../src/a11y.ts'

describe('cycleFocusIndex (wallet dialog focus boundary)', () => {
  it('Tab wraps from the last element to the first', () => {
    assert.equal(cycleFocusIndex(3, 2, false), 0)
    assert.equal(cycleFocusIndex(3, 0, false), 1)
  })
  it('Shift+Tab wraps from the first element to the last', () => {
    assert.equal(cycleFocusIndex(3, 0, true), 2)
    assert.equal(cycleFocusIndex(3, 2, true), 1)
  })
  it('focus outside the dialog enters at the first (or last) control', () => {
    assert.equal(cycleFocusIndex(3, -1, false), 0)
    assert.equal(cycleFocusIndex(3, -1, true), 2)
    assert.equal(cycleFocusIndex(3, 9, false), 0)
  })
  it('a single control keeps focus; an empty dialog has none', () => {
    assert.equal(cycleFocusIndex(1, 0, false), 0)
    assert.equal(cycleFocusIndex(1, 0, true), 0)
    assert.equal(cycleFocusIndex(0, 0, false), -1)
  })
  it('never leaves the valid range', () => {
    for (let n = 1; n < 6; n++)
      for (let c = -1; c <= n; c++)
        for (const back of [false, true]) {
          const i = cycleFocusIndex(n, c, back)
          assert.ok(i >= 0 && i < n)
        }
  })
})
