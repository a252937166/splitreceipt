import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  TESTNET, buildContextSearch, contextKey, defaultDeployment, parsePageContext, type PageContext,
} from '../src/networks.ts'
import { receiptScopeKey, sameScope } from '../src/receiptHistory.ts'

const ORIGINAL = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
const STUDIO = '0xb168fcf0698c65fb0d516a35d97c44dcc06cb440'
const MAINNET_CONTRACT = '0x8522Ea5A413c8402182fF6998Bd7471bAC886142'

describe('parsePageContext', () => {
  it('blank and legacy links stay on testnet with the default contract', () => {
    for (const s of ['', '?bill=3']) {
      const r = parsePageContext(s)
      assert.equal(r.ok, true)
      if (r.ok) {
        assert.equal(r.context.network.chainId, 5042002)
        assert.equal(r.context.deployment.address, ORIGINAL)
      }
    }
    const r = parsePageContext('?bill=3')
    assert.equal(r.ok && r.context.billId, 3n)
  })

  it('accepts a full explicit testnet link', () => {
    const r = parsePageContext(`?network=testnet&chainId=5042002&contract=${ORIGINAL.toUpperCase().replace('0X', '0x')}&bill=6`)
    assert.equal(r.ok && r.context.billId, 6n)
    assert.equal(r.ok && r.context.explicitContract, true)
  })

  it('accepts the second reviewed deployment by explicit link only', () => {
    const r = parsePageContext(`?contract=${STUDIO}&bill=1`)
    assert.equal(r.ok && r.context.deployment.address, STUDIO)
    assert.equal(parsePageContext('?bill=1').ok && (parsePageContext('?bill=1') as { context: PageContext }).context.deployment.address, ORIGINAL)
  })

  it('fails closed on unknown networks instead of falling back', () => {
    for (const n of ['ethereum', 'arc', 'base', 'testnet2']) {
      const r = parsePageContext(`?network=${n}&bill=1`)
      assert.equal(!r.ok && r.problem.code, 'unsupported-network')
    }
  })

  it('fails closed on a chain id mismatch', () => {
    assert.equal((parsePageContext('?chainId=5042') as { problem: { code: string } }).problem.code, 'chain-mismatch')
    assert.equal((parsePageContext('?network=testnet&chainId=1') as { problem: { code: string } }).problem.code, 'chain-mismatch')
  })

  it('does not accept an unreviewed or foreign contract', () => {
    for (const c of ['0x0000000000000000000000000000000000000001', MAINNET_CONTRACT, 'nonsense', '']) {
      const r = parsePageContext(`?contract=${c}`)
      assert.equal(!r.ok && r.problem.code, 'contract-not-reviewed', c)
    }
  })

  it('rejects invalid bill ids', () => {
    for (const b of ['0', '-1', '1.5', 'abc', '01', '1'.repeat(80), '115792089237316195423570985008687907853269984665640564039457584007913129639936']) {
      const r = parsePageContext(`?bill=${b}`)
      assert.equal(!r.ok && r.problem.code, 'bad-bill', b)
    }
  })

  it('keeps a valid creation hash only', () => {
    const good = `0x${'ab'.repeat(32)}`
    assert.equal(parsePageContext(`?bill=1&created=${good}`).ok && (parsePageContext(`?bill=1&created=${good}`) as { context: PageContext }).context.createdHash, good)
    const bad = parsePageContext('?bill=1&created=0x12') as { context: PageContext }
    assert.equal(bad.context.createdHash, null)
  })
})

describe('defaultDeployment', () => {
  it('honours a configured reviewed address', () => {
    assert.equal(defaultDeployment(TESTNET, STUDIO.toUpperCase().replace('0X', '0x')).address, STUDIO)
  })
  it('ignores a configured address that is not reviewed', () => {
    assert.equal(defaultDeployment(TESTNET, '0x0000000000000000000000000000000000000001').address, ORIGINAL)
  })
  it('every reviewed deployment has a lowercase address and a 32-byte runtime hash', () => {
    for (const d of TESTNET.deployments) {
      assert.equal(d.address, d.address.toLowerCase())
      assert.match(d.runtimeCodeHash, /^0x[0-9a-f]{64}$/)
    }
  })
})

describe('links and scope keys', () => {
  it('buildContextSearch round-trips through parsePageContext', () => {
    const ctx = { network: TESTNET, deployment: TESTNET.deployments[1] }
    const search = buildContextSearch(ctx, 12n)
    const r = parsePageContext(search)
    assert.equal(r.ok && r.context.billId, 12n)
    assert.equal(r.ok && r.context.deployment.address, STUDIO)
  })
  it('different contracts and bills produce different context and receipt keys', () => {
    const a = { network: TESTNET, deployment: TESTNET.deployments[0], billId: 1n }
    const b = { network: TESTNET, deployment: TESTNET.deployments[1], billId: 1n }
    assert.notEqual(contextKey(a), contextKey(b))
    const s1 = { chainId: 5042002, contract: ORIGINAL, billId: 1n }
    assert.equal(receiptScopeKey(s1), `5042002:${ORIGINAL}:1`)
    assert.equal(sameScope(s1, { ...s1, contract: ORIGINAL.toUpperCase().replace('0X', '0x') }), true)
    assert.equal(sameScope(s1, { ...s1, billId: 2n }), false)
    assert.equal(sameScope(s1, { ...s1, chainId: 5042 }), false)
  })
})
