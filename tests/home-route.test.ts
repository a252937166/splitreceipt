import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { SETTLED_BILL_ID, defaultCreateSearch, isHomeSearch, settledBillSearch } from '../src/homeRoute.ts'
import { MAINNET, TESTNET, buildContextSearch, defaultDeployment, parsePageContext } from '../src/networks.ts'

const MAIN_CONTRACT = '0x8522Ea5A413c8402182fF6998Bd7471bAC886142'
const TEST_CONTRACT = '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26'

describe('the exact routing rule: only an empty search is the homepage', () => {
  it('the empty search is the homepage', () => {
    assert.equal(isHomeSearch(''), true)
  })

  it('every non-empty search goes to the app unchanged, whatever it contains', () => {
    const searches = [
      '?', '?x', '?utm_source=newsletter', '?ref=abc&x=1', '?%', ' ', '#x',
      '?network=', '?network=ethereum', '?network=mainnet&network=testnet', '?bill=3&bill=4', '?bill=', '?bill=abc',
      '?chainId=1', '?contract=0x1', '?created=0x1', `?receipts=0x${'ab'.repeat(32)}`,
      '?bill=3', '?bill=1', '?network=testnet', '?network=mainnet',
      `?network=testnet&chainId=5042002&contract=${TEST_CONTRACT}&bill=6`,
      `?network=mainnet&chainId=5042&contract=${MAIN_CONTRACT}&bill=1`,
      `?network=testnet&chainId=5042002&contract=${TEST_CONTRACT}&bill=3&created=0x${'ab'.repeat(32)}`,
      `?contract=${TEST_CONTRACT}&bill=99`,
    ]
    for (const s of searches) assert.equal(isHomeSearch(s), false, JSON.stringify(s))
  })

  it('nothing in the router filters, normalizes or ignores part of an incoming query to pick the homepage', () => {
    const route = readFileSync(new URL('../src/homeRoute.ts', import.meta.url), 'utf8')
    const code = route.replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(code, /URLSearchParams|new URL\(|\.replace\(|\.trim\(|\.toLowerCase\(|\.split\(|APP_PARAMS/)
    const entry = readFileSync(new URL('../src/Entry.tsx', import.meta.url), 'utf8')
    assert.doesNotMatch(entry, /URLSearchParams|new URL\(/)
    // the incoming string is stored and handed to the parser exactly as the browser gave it
    assert.match(entry, /useState\(\(\) => window\.location\.search\)/)
    assert.match(entry, /commit\(window\.location\.search\)/)
  })

  it('what the app then does with a non-empty query is the parser\'s decision, as before', () => {
    for (const l of ['?network=', '?network=ethereum', '?contract=0x1', '?bill=abc']) {
      assert.equal(parsePageContext(l).ok, false, `${l} is still refused`)
    }
    for (const l of ['?', '?utm_source=newsletter', '?x']) {
      const parsed = parsePageContext(l)
      assert.equal(parsed.ok, true, l)
      if (parsed.ok) assert.equal(parsed.context.network.key, 'testnet')
    }
  })

  it('a blank address still parses to the default Testnet context the app opens with', () => {
    const parsed = parsePageContext('')
    assert.equal(parsed.ok, true)
    if (parsed.ok) assert.equal(parsed.context.network.key, 'testnet')
  })
})

describe('the two homepage destinations', () => {
  it('"View a settled bill" is read-only Arc Mainnet Bill 1 on the reviewed contract', () => {
    assert.equal(SETTLED_BILL_ID, 1n)
    const search = settledBillSearch()
    assert.equal(
      search,
      `?network=mainnet&chainId=5042&contract=${MAIN_CONTRACT.toLowerCase()}&bill=1`,
    )
    assert.equal(isHomeSearch(search), false)
    const parsed = parsePageContext(search)
    assert.equal(parsed.ok, true)
    if (parsed.ok) {
      assert.equal(parsed.context.network.key, 'mainnet')
      assert.equal(parsed.context.billId, 1n)
      assert.equal(parsed.context.deployment.address, defaultDeployment(MAINNET).address)
    }
  })

  it('"Open app" opens the create form (no bill) on the default network and reviewed contract', () => {
    const search = defaultCreateSearch()
    assert.equal(search, buildContextSearch({ network: TESTNET, deployment: defaultDeployment(TESTNET) }, null))
    assert.equal(isHomeSearch(search), false)
    const parsed = parsePageContext(search)
    assert.equal(parsed.ok, true)
    if (parsed.ok) {
      assert.equal(parsed.context.billId, null)
      assert.equal(parsed.context.network.key, 'testnet')
    }
  })

  it('an unreviewed configured address is ignored, as for every other entry point', () => {
    assert.equal(defaultCreateSearch('0x1111111111111111111111111111111111111111'), defaultCreateSearch())
  })
})
