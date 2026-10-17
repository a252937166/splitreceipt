import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtNativeUsdc, parseUsdcToNative, validateUsdcInput } from '../src/usdcFormat.ts'

test('USDC input scales exactly from six decimal places to native eighteen', () => {
  for (const [input, expected] of [
    ['0.000001', 1_000_000_000_000n], ['0.001', 1_000_000_000_000_000n],
    ['1.234567', 1_234_567_000_000_000_000n], ['10.50', 10_500_000_000_000_000_000n],
    [' 0001.010000 ', 1_010_000_000_000_000_000n],
    ['9007199254740993.000001', 9_007_199_254_740_993_000_001_000_000_000_000n],
  ] as const) {
    assert.equal(parseUsdcToNative(input), expected, input)
    assert.equal(validateUsdcInput(input), null, input)
  }
})

test('zero, invalid numbers and hidden rounding are rejected before a write', () => {
  for (const input of ['', ' ', '0', '0.000000', '-1', '+1', '.1', '1.', '1e3', '1,000', 'NaN', 'Infinity', '0x10', '0.0000001', '1.0000000']) {
    assert.throws(() => parseUsdcToNative(input), /./, input)
    assert.notEqual(validateUsdcInput(input), null, input)
  }
})

test('positive sub-micro values never display a false zero', () => {
  assert.equal(fmtNativeUsdc(0n), '0')
  assert.equal(fmtNativeUsdc(1n), '< 0.000001')
  assert.equal(fmtNativeUsdc(999_999_999_999n), '< 0.000001')
  assert.equal(fmtNativeUsdc(1_000_000_000_000n), '0.000001')
  assert.equal(fmtNativeUsdc(1_000_000_000_000_000n), '0.001')
  assert.equal(fmtNativeUsdc(1_234_567_999_999_999_999n), '1.234567')
  assert.equal(fmtNativeUsdc(9_007_199_254_740_993_000_001_000_000_000_000n), '9007199254740993.000001')
})
