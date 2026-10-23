import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { MAINNET, TESTNET, buildContextSearch, contextKey, parsePageContext, type PageContext } from '../src/networks.ts'
import { assembleCandidates } from '../src/receiptHints.ts'
import { receiptScopeKey } from '../src/receiptHistory.ts'
import { walletReadiness } from '../src/writeGuard.ts'

const MAIN = '0x8522ea5a413c8402182ff6998bd7471bac886142'
const MAIN_MIXED = '0x8522Ea5A413c8402182fF6998Bd7471bAC886142'
const TEST_ORIGINAL = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'
const RUNTIME = '0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b'

const ctx = (s: string) => {
  const r = parsePageContext(s)
  assert.equal(r.ok, true, s)
  return (r as { context: PageContext }).context
}
const problem = (s: string) => (parsePageContext(s) as { problem?: { code: string } }).problem?.code

describe('Arc Mainnet 5042', () => {
  it('is the reviewed public deployment with the pinned block and runtime hash', () => {
    assert.equal(MAINNET.chainId, 5042)
    assert.equal(MAINNET.realFunds, true)
    assert.equal(TESTNET.realFunds, false)
    assert.equal(MAINNET.rpcUrl, 'https://rpc.mainnet.arc.io')
    assert.equal(MAINNET.deployments.length, 1)
    const d = MAINNET.deployments[0]
    assert.equal(d.address, MAIN)
    assert.equal(d.deployBlock, 27419618n)
    assert.equal(d.runtimeCodeHash, RUNTIME)
  })

  it('parses the full public Bill 1 link', () => {
    const c = ctx(`?network=mainnet&chainId=5042&contract=${MAIN_MIXED}&bill=1`)
    assert.equal(c.network.key, 'mainnet')
    assert.equal(c.deployment.address, MAIN)
    assert.equal(c.billId, 1n)
  })

  it('defaults to the reviewed contract when only the network is named', () => {
    assert.equal(ctx('?network=mainnet').deployment.address, MAIN)
    assert.equal(ctx('?network=MAINNET&bill=1').network.key, 'mainnet')
  })

  it('a blank or legacy link never lands on mainnet', () => {
    assert.equal(ctx('').network.key, 'testnet')
    assert.equal(ctx('?bill=1').network.key, 'testnet')
  })

  it('requires the matching chain id', () => {
    assert.equal(problem('?network=mainnet&chainId=5042002'), 'chain-mismatch')
    assert.equal(problem('?network=testnet&chainId=5042'), 'chain-mismatch')
  })

  it('keeps contracts separated per network', () => {
    assert.equal(problem(`?network=mainnet&contract=${TEST_ORIGINAL}`), 'contract-not-reviewed')
    assert.equal(problem(`?network=testnet&contract=${MAIN}`), 'contract-not-reviewed')
    assert.equal(problem(`?contract=${MAIN}`), 'contract-not-reviewed')
  })

  it('an environment address can never repoint mainnet', () => {
    const r = parsePageContext('?network=mainnet', TEST_ORIGINAL)
    assert.equal(r.ok && r.context.deployment.address, MAIN)
    const t = parsePageContext('?network=testnet', MAIN)
    assert.equal(t.ok && t.context.deployment.address, TESTNET.defaultAddress)
  })

  it('links, context keys and receipt scopes differ between networks', () => {
    const a = { network: MAINNET, deployment: MAINNET.deployments[0], billId: 1n }
    const b = { network: TESTNET, deployment: TESTNET.deployments[0], billId: 1n }
    assert.notEqual(contextKey(a), contextKey(b))
    const search = buildContextSearch(a, 1n)
    assert.match(search, /network=mainnet/)
    assert.match(search, /chainId=5042&/)
    assert.equal(ctx(search).network.key, 'mainnet')
    assert.notEqual(
      receiptScopeKey({ chainId: 5042, contract: MAIN, billId: 1n }),
      receiptScopeKey({ chainId: 5042002, contract: MAIN, billId: 1n }),
    )
  })

  it('anonymous Bill 1 carries the two public payment hashes as candidates, only for its own scope', () => {
    const scope = { chainId: 5042, contract: MAIN, billId: 1n }
    const hints = assembleCandidates(scope, '')
    assert.deepEqual(hints, [
      '0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716',
      '0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5',
    ])
    assert.deepEqual(assembleCandidates({ ...scope, chainId: 5042002 }, ''), [])
    assert.deepEqual(assembleCandidates({ ...scope, billId: 2n }, ''), [])
    assert.deepEqual(assembleCandidates({ ...scope, contract: TEST_ORIGINAL }, ''), [])
  })

  it('wallet readiness is relative to the page network', () => {
    const w = { connected: true, address: '0x1', chainId: 5042002, connectorId: 'a' }
    const key = 'a:0x1'
    assert.deepEqual(walletReadiness(w, 5042002, key, 'Arc Testnet'), { ready: true })
    const r = walletReadiness(w, 5042, key, 'Arc Mainnet')
    assert.equal(!r.ready && r.need, 'switch-network')
    assert.match(!r.ready ? r.message : '', /Arc Mainnet/)
  })

  it('the repository deployment record agrees with the pinned values', () => {
    const rec = JSON.parse(readFileSync(new URL('../deployments/arc-mainnet.json', import.meta.url), 'utf8'))
    assert.equal(rec.chainId, 5042)
    assert.equal(rec.contract.toLowerCase(), MAIN)
    assert.equal(rec.deploymentBlock, '27419618')
    assert.equal(rec.runtimeCodeHash, RUNTIME)
  })
})
