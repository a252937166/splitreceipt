import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fmtNativeUsdc, parseUsdcToNative, validateUsdcInput } from '../src/usdcFormat.ts'

describe('usdcFormat', () => {
  it('parses to 18-decimal native units', () => {
    assert.equal(parseUsdcToNative('1'), 10n ** 18n)
    assert.equal(parseUsdcToNative('0.001'), 10n ** 15n)
    assert.equal(parseUsdcToNative(' 2.5 '), 25n * 10n ** 17n)
  })
  it('formats without rounding a positive amount to zero', () => {
    assert.equal(fmtNativeUsdc(0n), '0')
    assert.equal(fmtNativeUsdc(10n ** 15n), '0.001')
    assert.equal(fmtNativeUsdc(1n), '< 0.000001')
    assert.equal(fmtNativeUsdc(12n * 10n ** 18n), '12')
  })
  it('round-trips every 6-decimal value exactly', () => {
    for (const s of ['0.000001', '0.5', '123.456789', '1000000']) {
      assert.equal(fmtNativeUsdc(parseUsdcToNative(s)), s)
    }
  })
  it('rejects invalid input', () => {
    assert.equal(validateUsdcInput('1.1234567'), 'Maximum 6 decimal places')
    assert.ok(validateUsdcInput('0'))
    assert.equal(validateUsdcInput('1.5'), null)
  })
})
