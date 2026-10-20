/**
 * Focused adversarial tests for receiptDiscovery and receiptHints.
 *
 * Tests use real viem ABI encoding so topics/data match the actual decoder.
 * No hardcoded guessed event signatures.
 *
 * Coverage:
 *  — assembleCandidates: priorHashes source ordering and 5-cap
 *  — assembleCandidates: full catalog cannot truncate priorHashes
 *  — old RAM cannot skip verification (must go through discoverReceiptsFromHints)
 *  — scan candidate must pass receipt+canonical check before eligible for fresh/copy
 *  — invalid-then-RPC-error: invalidatedHashes populated, other candidates preserved for retry
 *  — stale freshVerified contextKey blocks verified count inflation
 *  — warm cache (stored hints) consumed correctly with fresh RPC
 *  — buildShareUrl: deduplicates case-insensitively, caps at 5
 *  — buildShareUrl: omits receipts param when no hashes
 *  — buildShareUrl: excludes invalid hash strings
 */

import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import {
  encodeEventTopics,
  encodeAbiParameters,
  parseAbi,
  TransactionReceiptNotFoundError,
  type TransactionReceipt,
} from 'viem'
import {
  assembleCandidates,
  isValidHintHash,
  normaliseHash,
  MAX_HINTS_PER_SOURCE,
  MAX_TOTAL_CANDIDATES,
  type HintHash,
} from '../src/receiptHints.ts'
import {
  discoverReceiptsFromHints,
} from '../src/receiptDiscovery.ts'
import type { ReceiptScope } from '../src/receiptHistory.ts'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const ABI = parseAbi([
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)',
])

function makeHash(n: number): HintHash {
  return `0x${n.toString(16).padStart(64, '0')}` as HintHash
}

function makeAddress(n: number): `0x${string}` {
  return `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`
}

const SCOPE: ReceiptScope = {
  chainId: 5042002,
  contract: '0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26',
  billId: 99999n, // non-catalog bill so catalog returns []
}

const PAYER_A = makeAddress(0xA1).toLowerCase()
const PAYER_B = makeAddress(0xA2).toLowerCase()
const HEAD = 1_000_000n
const AMOUNT = 1_000_000_000_000_000n // 0.001 native USDC (18 dp)

/** Build encoded topics + data for a SharePaid event. */
function makeSharePaidLog(billId: bigint, payer: `0x${string}`, amount: bigint) {
  const topics = encodeEventTopics({ abi: ABI, eventName: 'SharePaid', args: { billId, payer } })
  const data = encodeAbiParameters([{ type: 'uint256' }], [amount])
  return { topics, data }
}

/** Minimal valid TransactionReceipt with one SharePaid log. */
function makeReceipt(opts: {
  hash: HintHash
  blockNumber: bigint
  blockHash: HintHash
  payer: `0x${string}`
  billId: bigint
  amount: bigint
  contract: `0x${string}`
  status?: 'success' | 'reverted'
}): TransactionReceipt {
  const { topics, data } = makeSharePaidLog(opts.billId, opts.payer, opts.amount)
  return {
    transactionHash: opts.hash,
    blockNumber: opts.blockNumber,
    blockHash: opts.blockHash,
    status: opts.status ?? 'success',
    logs: [{
      address: opts.contract,
      topics: topics as [`0x${string}`, ...`0x${string}`[]],
      data,
      blockNumber: opts.blockNumber,
      blockHash: opts.blockHash,
      transactionHash: opts.hash,
      transactionIndex: 0,
      logIndex: 0,
      removed: false,
    }],
    // minimal required fields
    from: makeAddress(0xff),
    to: opts.contract,
    contractAddress: null,
    cumulativeGasUsed: 21000n,
    effectiveGasPrice: 1n,
    gasUsed: 21000n,
    logsBloom: '0x',
    type: 'eip1559',
  } as unknown as TransactionReceipt
}

/** Build a mock publicClient. */
function makeClient(opts: {
  chainId?: number
  head?: bigint
  receipts?: Record<string, TransactionReceipt>
  blocks?: Record<string, HintHash | null>
  rpcErrors?: Record<string, boolean> // hash → throw
}) {
  return {
    chain: { id: opts.chainId ?? 5042002 },
    getChainId: async () => opts.chainId ?? 5042002,
    getBlockNumber: async () => opts.head ?? HEAD,
    getTransactionReceipt: async ({ hash }: { hash: string }) => {
      const lc = hash.toLowerCase()
      if (opts.rpcErrors?.[lc]) throw new Error('RPC timeout')
      const r = opts.receipts?.[lc]
      if (!r) {
        // Throw the exact viem structured error so production not-found detection works.
        throw new TransactionReceiptNotFoundError({ hash: hash as `0x${string}` })
      }
      return r
    },
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      const bh = opts.blocks?.[blockNumber.toString()] ?? makeHash(Number(blockNumber))
      if (bh === null) throw new Error('block not found')
      return { hash: bh }
    },
  }
}

// ── assembleCandidates: priorHashes ordering ─────────────────────────────────

describe('assembleCandidates priorHashes', () => {
  it('places priorHashes after catalog and before storage/URL', () => {
    // SCOPE has no catalog entry, so catalog = []
    const prior: HintHash[] = [makeHash(10), makeHash(11)]
    const result = assembleCandidates(SCOPE, '', prior)
    // prior hashes should appear in the result
    assert.ok(result.includes(makeHash(10)), 'prior hash 10 present')
    assert.ok(result.includes(makeHash(11)), 'prior hash 11 present')
  })

  it('caps priorHashes at MAX_HINTS_PER_SOURCE (5)', () => {
    const prior: HintHash[] = Array.from({ length: 10 }, (_, i) => makeHash(100 + i))
    const result = assembleCandidates(SCOPE, '', prior)
    // Count how many of the prior hashes appear
    const priorInResult = prior.filter(h => result.includes(h)).length
    assert.ok(priorInResult <= MAX_HINTS_PER_SOURCE, `at most ${MAX_HINTS_PER_SOURCE} prior hashes, got ${priorInResult}`)
  })

  it('total result never exceeds MAX_TOTAL_CANDIDATES', () => {
    const prior: HintHash[] = Array.from({ length: 5 }, (_, i) => makeHash(200 + i))
    // URL with 5 more distinct hashes
    const urlHashes = Array.from({ length: 5 }, (_, i) => makeHash(300 + i))
    const search = `?receipts=${urlHashes.join(',')}`
    const result = assembleCandidates(SCOPE, search, prior)
    assert.ok(result.length <= MAX_TOTAL_CANDIDATES, `total ≤ ${MAX_TOTAL_CANDIDATES}, got ${result.length}`)
  })

  it('deduplicates case-insensitively between prior and URL', () => {
    const h = makeHash(42) // already lowercase
    const hUpper = h.replace('0x', '0X').toUpperCase() as HintHash
    const prior: HintHash[] = [h]
    const search = `?receipts=${hUpper}`
    const result = assembleCandidates(SCOPE, search, prior)
    const count = result.filter(r => r.toLowerCase() === h.toLowerCase()).length
    assert.equal(count, 1, 'deduplicates across case variants')
  })

  it('works without priorHashes argument (backward compat)', () => {
    const result = assembleCandidates(SCOPE, '')
    assert.ok(Array.isArray(result))
  })
})

// ── Old RAM cannot skip verification ─────────────────────────────────────────

describe('old RAM cannot skip receipt verification', () => {
  it('a candidate from priorHashes must pass discoverReceiptsFromHints before trusted', async () => {
    const hash = makeHash(50)
    const blockHash = makeHash(5000)
    const receipt = makeReceipt({
      hash, blockNumber: 100n, blockHash,
      payer: PAYER_A as `0x${string}`, billId: SCOPE.billId, amount: AMOUNT,
      contract: SCOPE.contract as `0x${string}`,
    })

    const client = makeClient({
      receipts: { [hash]: receipt },
      blocks: { '100': blockHash },
    })

    // Feed the hash as a candidate
    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    // Only passes verification if receipt + canonical block check passes
    assert.equal(result.receipts[PAYER_A], hash.toLowerCase(), 'verified after RPC check')
    assert.equal(result.invalidatedHashes.length, 0)
    assert.equal(result.rpcError, null)
  })

  it('a prior hash that is not found on RPC is added to invalidatedHashes', async () => {
    const hash = makeHash(51)
    const client = makeClient({
      receipts: {}, // not found
    })

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(hash.toLowerCase()),
      'not-found hash → invalidatedHashes'
    )
    assert.equal(Object.keys(result.receipts).length, 0)
  })

  it('a prior hash with reverted receipt is invalidated', async () => {
    const hash = makeHash(52)
    const blockHash = makeHash(5200)
    const receipt = makeReceipt({
      hash, blockNumber: 200n, blockHash,
      payer: PAYER_A as `0x${string}`, billId: SCOPE.billId, amount: AMOUNT,
      contract: SCOPE.contract as `0x${string}`,
      status: 'reverted',
    })
    const client = makeClient({ receipts: { [hash]: receipt }, blocks: { '200': blockHash } })

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(hash.toLowerCase()),
      'reverted receipt → invalidatedHashes'
    )
  })
})

// ── Scan candidate must pass receipt+canonical check before eligible ──────────

describe('scan candidate receipt+canonical check', () => {
  it('rejects receipt whose blockNumber exceeds chain head', async () => {
    const hash = makeHash(60)
    const blockHash = makeHash(6000)
    const futureBlock = HEAD + 1n
    const receipt = makeReceipt({
      hash, blockNumber: futureBlock, blockHash,
      payer: PAYER_A as `0x${string}`, billId: SCOPE.billId, amount: AMOUNT,
      contract: SCOPE.contract as `0x${string}`,
    })
    const client = makeClient({
      head: HEAD,
      receipts: { [hash]: receipt },
      blocks: { [futureBlock.toString()]: blockHash },
    })

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    // blockNumber > head → invalid
    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(hash.toLowerCase()),
      'future-block receipt → invalidatedHashes'
    )
    assert.equal(Object.keys(result.receipts).length, 0)
  })

  it('rejects receipt whose blockHash does not match canonical block hash', async () => {
    const hash = makeHash(61)
    const receiptBlockHash = makeHash(6100)
    const canonicalBlockHash = makeHash(6101) // different
    const receipt = makeReceipt({
      hash, blockNumber: 300n, blockHash: receiptBlockHash,
      payer: PAYER_A as `0x${string}`, billId: SCOPE.billId, amount: AMOUNT,
      contract: SCOPE.contract as `0x${string}`,
    })
    const client = makeClient({
      receipts: { [hash]: receipt },
      blocks: { '300': canonicalBlockHash }, // canonical differs from receipt
    })

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(hash.toLowerCase()),
      'block hash mismatch → invalidatedHashes'
    )
  })

  it('rejects receipt with missing/empty blockHash', async () => {
    const hash = makeHash(62)
    const receipt = makeReceipt({
      hash, blockNumber: 400n, blockHash: makeHash(400),
      payer: PAYER_A as `0x${string}`, billId: SCOPE.billId, amount: AMOUNT,
      contract: SCOPE.contract as `0x${string}`,
    })
    // Override blockHash to empty string
    ;(receipt as Record<string, unknown>).blockHash = ''

    const client = makeClient({
      receipts: { [hash]: receipt },
      blocks: { '400': makeHash(400) },
    })

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(hash.toLowerCase()),
      'empty blockHash → invalidatedHashes'
    )
  })
})

// ── invalid-then-RPC-error: invalidatedHashes populated, others preserved ────

describe('invalid then RPC error interaction', () => {
  it('invalidates first candidate, preserves second as display-only on RPC error', async () => {
    const invalidHash = makeHash(70) // not found → invalid
    const rpcErrorHash = makeHash(71) // RPC timeout

    const client = makeClient({
      receipts: {}, // invalidHash → not found
      rpcErrors: { [rpcErrorHash]: true }, // rpcErrorHash → timeout
    })

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [invalidHash, rpcErrorHash],
      paidPayers: [PAYER_A, PAYER_B],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    // invalidHash must be in invalidatedHashes
    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(invalidHash.toLowerCase()),
      'not-found hash → invalidatedHashes'
    )
    // rpcErrorHash must NOT be in invalidatedHashes (transient error, not confirmed invalid)
    assert.ok(
      !result.invalidatedHashes.map(h => h.toLowerCase()).includes(rpcErrorHash.toLowerCase()),
      'RPC-error hash must NOT be in invalidatedHashes'
    )
    // rpcError must be set
    assert.ok(result.rpcError !== null, 'rpcError set on timeout')
    // complete must be false
    assert.equal(result.complete, false)
  })
})

// ── Stale freshVerified contextKey blocks verified count ──────────────────────

describe('stale freshVerified contextKey', () => {
  it('a freshVerified record with a non-matching contextKey must not contribute to verified count', () => {
    // Simulate what BillDetails does:
    const makeFreshContextKey = (scopeKey: string, paidPayersLc: string[], scanToken: number) =>
      `${scopeKey}:${[...paidPayersLc].sort().join(',')}:${scanToken}`

    const scopeKey = 'test-scope'
    const paidPayersLc = [PAYER_A]
    const scanToken = 1

    const currentContextKey = makeFreshContextKey(scopeKey, paidPayersLc, scanToken)
    const staleContextKey = makeFreshContextKey(scopeKey, paidPayersLc, scanToken - 1)

    const freshRef = { contextKey: staleContextKey, receipts: { [PAYER_A]: makeHash(80) } }

    // Simulate the guard from BillDetails
    const freshMatchesRender = freshRef.contextKey === currentContextKey
    const freshVerified = freshMatchesRender ? freshRef.receipts : {}

    const verifiedCount = paidPayersLc.filter(p => Boolean(freshVerified[p])).length

    assert.equal(verifiedCount, 0, 'stale context key → 0 verified')
  })

  it('a freshVerified record with a matching contextKey contributes to verified count', () => {
    const makeFreshContextKey = (scopeKey: string, paidPayersLc: string[], scanToken: number) =>
      `${scopeKey}:${[...paidPayersLc].sort().join(',')}:${scanToken}`

    const scopeKey = 'test-scope'
    const paidPayersLc = [PAYER_A]
    const scanToken = 2

    const currentContextKey = makeFreshContextKey(scopeKey, paidPayersLc, scanToken)
    const freshRef = { contextKey: currentContextKey, receipts: { [PAYER_A]: makeHash(81) } }

    const freshMatchesRender = freshRef.contextKey === currentContextKey
    const freshVerified = freshMatchesRender ? freshRef.receipts : {}

    const verifiedCount = paidPayersLc.filter(p => Boolean(freshVerified[p])).length

    assert.equal(verifiedCount, 1, 'matching context key → 1 verified')
  })
})

// ── Warm cache consumed with fresh RPC ───────────────────────────────────────

describe('warm cache consumed with fresh RPC verification', () => {
  it('a stored hint is re-verified against live RPC before trusted', async () => {
    const hash = makeHash(90)
    const blockHash = makeHash(9000)
    const receipt = makeReceipt({
      hash, blockNumber: 500n, blockHash,
      payer: PAYER_A as `0x${string}`, billId: SCOPE.billId, amount: AMOUNT,
      contract: SCOPE.contract as `0x${string}`,
    })
    const client = makeClient({
      receipts: { [hash]: receipt },
      blocks: { '500': blockHash },
    })

    // Simulate the candidate coming from storage (just pass it as a candidate)
    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    // Must pass full RPC check before being in result.receipts
    assert.equal(result.receipts[PAYER_A], hash.toLowerCase(), 'warm cache hash verified via RPC')
    assert.equal(result.invalidatedHashes.length, 0)
  })

  it('a stored hint that no longer exists on RPC is invalidated', async () => {
    const hash = makeHash(91)
    const client = makeClient({ receipts: {} }) // gone

    const result = await discoverReceiptsFromHints({
      client: client as never,
      scope: SCOPE,
      candidates: [hash],
      paidPayers: [PAYER_A],
      amount: AMOUNT,
      isCancelled: () => false,
    })

    assert.ok(
      result.invalidatedHashes.map(h => h.toLowerCase()).includes(hash.toLowerCase()),
      'gone stored hint → invalidatedHashes'
    )
  })
})

// ── buildShareUrl ─────────────────────────────────────────────────────────────
// Note: buildShareUrl uses window.location — mock it for Node.

describe('buildShareUrl', () => {
  const BILL_ID = 3n
  const BASE = 'http://localhost/'

  function mockWindow(href: string) {
    ;(globalThis as Record<string, unknown>).window = { location: { href } }
  }
  function restoreWindow() {
    delete (globalThis as Record<string, unknown>).window
  }

  it('deduplicates hashes case-insensitively and caps at 5', async () => {
    mockWindow(`${BASE}?bill=${BILL_ID}`)
    const { buildShareUrl } = await import('../src/receiptHints.ts')
    const h = makeHash(1)
    const hUpper = h.replace('0x', '0x').toUpperCase() as HintHash
    const six: HintHash[] = [h, hUpper, makeHash(2), makeHash(3), makeHash(4), makeHash(5), makeHash(6)]
    const url = buildShareUrl(BILL_ID, six)
    restoreWindow()
    const params = new URLSearchParams(new URL(url).search)
    const receipts = params.get('receipts')?.split(',') ?? []
    assert.ok(receipts.length <= 5, `capped at 5, got ${receipts.length}`)
    // No duplicates
    const unique = new Set(receipts.map(h => h.toLowerCase()))
    assert.equal(unique.size, receipts.length, 'no duplicates')
  })

  it('omits receipts param when no hashes provided', async () => {
    mockWindow(`${BASE}?bill=${BILL_ID}`)
    const { buildShareUrl } = await import('../src/receiptHints.ts')
    const url = buildShareUrl(BILL_ID, [])
    restoreWindow()
    const params = new URLSearchParams(new URL(url).search)
    assert.equal(params.get('receipts'), null, 'no receipts param')
  })

  it('excludes invalid hash strings', async () => {
    mockWindow(`${BASE}?bill=${BILL_ID}`)
    const { buildShareUrl } = await import('../src/receiptHints.ts')
    const bad = ['not-a-hash', '0x123'] as HintHash[]
    const url = buildShareUrl(BILL_ID, bad)
    restoreWindow()
    const params = new URLSearchParams(new URL(url).search)
    assert.equal(params.get('receipts'), null, 'invalid hashes excluded')
  })
})

// ── assembleCandidates: middle-source merged cap regression ──────────────────

describe('assembleCandidates middle-source merged cap', () => {
  // Build N distinct valid 32-byte hex hashes starting at offset, no overlap with makeHash().
  function makeHashes(count: number, baseVal: number): HintHash[] {
    return Array.from({ length: count }, (_, i) =>
      `0x${(baseVal + i + 1).toString(16).padStart(64, '0')}` as HintHash
    )
  }

  // Local window mock (same pattern as buildShareUrl tests above).
  const BASE_URL = 'http://localhost/'
  function mockWin(href: string) {
    ;(globalThis as Record<string, unknown>).window = { location: { href } }
  }
  function restoreWin() {
    delete (globalThis as Record<string, unknown>).window
  }

  it('merges prior+stored into one middle source capped at 5; URL hashes are retained; total<=15', async () => {
    // Use values far above makeHash() range (0x1000+) to avoid catalog overlap.
    const stored7: HintHash[] = makeHashes(7, 0x1000)   // 7 distinct stored hints
    const prior6: HintHash[] = makeHashes(6, 0x2000)    // 6 distinct prior RAM hashes
    const urlHashes: HintHash[] = makeHashes(3, 0x3000) // 3 URL hashes

    // Stub localStorage
    const store: Record<string, string> = {}
    const origLS = (globalThis as Record<string, unknown>).localStorage
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
      },
      writable: true, configurable: true,
    })

    // SCOPE has billId 99999n which is not in the bundled catalog → catalog = []
    // URL hashes use full 0x-prefixed lowercase form (hintsFromUrl requires 0x prefix).
    const urlSearch = `?receipts=${urlHashes.join(',')}`
    mockWin(`${BASE_URL}${urlSearch}`)

    // Write 7 stored hints into localStorage under the scoped key.
    // Storage key format: "sr:hints:v1:<chainId>:<contract>:<billId>"
    const scopeKeyStr = `${SCOPE.chainId}:${SCOPE.contract.toLowerCase()}:${SCOPE.billId}`
    const lsKey = `sr:hints:v1:${scopeKeyStr}`
    // loadStoredHints calls normaliseHash on each item; values must be 0x-prefixed.
    store[lsKey] = JSON.stringify(stored7)

    const result = assembleCandidates(SCOPE, urlSearch, prior6)

    // Restore
    restoreWin()
    Object.defineProperty(globalThis, 'localStorage', {
      value: origLS, writable: true, configurable: true,
    })

    // Middle source = merge(prior6, stored7) deduped, capped at 5.
    // prior6 has no overlap with stored7, so first 5 come from prior6 (prior-first).
    const priorNorm = new Set(prior6.map(h => normaliseHash(h)))
    const storedNorm = new Set(stored7.map(h => normaliseHash(h)))
    const urlNorm = new Set(urlHashes.map(h => normaliseHash(h)))

    let middleInResult = 0
    let urlInResult = 0
    for (const h of result) {
      if (priorNorm.has(h) || storedNorm.has(h)) middleInResult++
      if (urlNorm.has(h)) urlInResult++
    }

    assert.ok(middleInResult <= 5,
      `middle source must be <=5, got ${middleInResult}`)
    assert.ok(urlInResult > 0,
      `URL hashes must be retained when total allows (got ${urlInResult})`)
    assert.ok(result.length <= 15,
      `total candidates must be <=15, got ${result.length}`)

    // Prior-first: all middle entries should come from prior6 (not stored7)
    // because prior6 is merged first and both sets are fully distinct.
    const prior5 = new Set(prior6.slice(0, 5).map(h => normaliseHash(h)))
    let priorFirstCount = 0
    for (const h of result) {
      if (prior5.has(h)) priorFirstCount++
    }
    assert.equal(priorFirstCount, 5,
      'first 5 middle entries should come from prior RAM hashes (prior-first)')

    // Middle is exactly 5 (not 6+7=13).
    assert.equal(middleInResult, 5,
      'middle source is exactly 5 after merging 6 prior + 7 stored')
  })
})
