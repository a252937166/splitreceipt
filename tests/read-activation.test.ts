import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { TransactionReceiptNotFoundError, encodeFunctionData } from 'viem'
import { EpochCounter } from '../src/epoch.ts'
import { ReceiptsController, startReceiptRead, type RefreshInput } from '../src/receiptController.ts'
import { startCreationProof, type Creator } from '../src/creationProof.ts'
import type { HintHash } from '../src/receiptHints.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../src/splitReceiptAbi.ts'
import { defaultCreateSearch, isHomeSearch } from '../src/homeRoute.ts'
import { parsePageContext, TESTNET } from '../src/networks.ts'
import {
  CHAIN as CREATE_CHAIN, CONTRACT as CREATE_CONTRACT, INTENDED, TX_HASH, createClient,
  CONTRACT, addr, hash, sharePaidLog, type Hex,
} from './fixtures.ts'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CHAIN = 5042002
const SCOPE = { chainId: CHAIN, contract: CONTRACT.toLowerCase(), billId: 7n }
const A = addr(0xa1).toLowerCase() as Hex
const SHARE = 1_000_000_000_000_000n
const HASH_A = hash(0xa1).toLowerCase() as HintHash

const deferred = () => {
  let release!: () => void
  const promise = new Promise<void>((r) => { release = r })
  return { promise, release }
}
const tick = () => new Promise((r) => setTimeout(r, 0))
const newEpochs = () => ({ wallet: new EpochCounter(), page: new EpochCounter() })

/** One paid share (A) with a canonical payment transaction. `holds` gates the first receipt lookups. */
function chain(holds: Array<Promise<void>> = [], counts = { rpc: 0, logs: 0 }) {
  const bh = hash(0x2222)
  let receiptCalls = 0
  return {
    counts,
    client: {
      getChainId: async () => { counts.rpc++; return CHAIN },
      getBlockNumber: async () => { counts.rpc++; return 10_000n },
      getBlock: async () => { counts.rpc++; return { hash: bh } },
      getLogs: async () => { counts.rpc++; counts.logs++; return [] },
      getTransactionReceipt: async ({ hash: h }: { hash: Hex }) => {
        counts.rpc++
        const gate = holds[receiptCalls++]
        if (gate) await gate
        if (h.toLowerCase() !== HASH_A) throw new TransactionReceiptNotFoundError({ hash: h })
        return {
          transactionHash: h, blockNumber: 900n, blockHash: bh, status: 'success', from: A, to: CONTRACT,
          logs: [{ ...sharePaidLog(7n, A, SHARE, h), blockNumber: 900n, blockHash: bh }],
        }
      },
      getTransaction: async ({ hash: h }: { hash: Hex }) => {
        counts.rpc++
        return {
          hash: h, from: A, to: CONTRACT, value: SHARE, blockHash: bh, blockNumber: 900n,
          input: encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'payShare', args: [7n] }),
        }
      },
    } as never,
  }
}

const buildFor = (client: never, persisted: string[] = []) => (isStale: () => boolean): RefreshInput => ({
  client, scope: SCOPE, share: SHARE, paidPayers: [A], candidates: [HASH_A], deployBlock: 0n, isStale,
  persist: (_s, hs) => { persisted.push(...hs) },
})

describe('receipt proofs: a read in flight when the visitor goes Home and returns', () => {
  it('REPRO (no restart): the interrupted read must not leave "verifying" stuck, and a read-only retry must work', async () => {
    const epochs = newEpochs()
    const gate = deferred()
    const { client, counts } = chain([gate.promise])
    const ctl = new ReceiptsController()
    startReceiptRead(ctl, epochs, buildFor(client))
    await tick()
    assert.equal(ctl.view().status, 'verifying')

    epochs.page.bump() // Home
    epochs.page.bump() // return to the same bill: nothing else changed, so no dependency restarts the read
    gate.release()
    await tick(); await tick()

    const v = ctl.view()
    assert.notEqual(v.status, 'verifying', 'stale result is discarded without leaving the view stuck')
    assert.deepEqual(v.fresh, {}, 'the discarded result committed nothing')
    assert.ok(v.message, 'the interruption is explained')
    // The retry is not refused for being "verifying" any more. Its own stale guard still applies (the epoch moved),
    // so the view restarts the read after navigation; see the next tests.
    await ctl.searchHistory()
    assert.equal(ctl.view().scanning, false)
  })

  it('after Home and return, a restarted read leaves the read-only retry working (it makes RPC calls)', async () => {
    const epochs = newEpochs()
    const gate = deferred()
    const { client, counts } = chain([gate.promise])
    const ctl = new ReceiptsController()
    const cancel1 = startReceiptRead(ctl, epochs, buildFor(client))
    await tick()
    epochs.page.bump(); epochs.page.bump()
    cancel1()
    // The restarted read has no candidate hint for the paid payer, so the payer stays missing.
    startReceiptRead(ctl, epochs, (isStale) => ({ ...buildFor(client)(isStale), candidates: [] }))
    await tick(); await tick()
    assert.notEqual(ctl.view().status, 'verifying')
    const before = counts.logs
    await ctl.searchHistory()
    assert.ok(counts.logs > before, 'history search runs under the current epoch')
    gate.release()
    await tick()
  })

  it('FIX (the view restarts under the current epoch after Home and return): the proof settles as verified', async () => {
    const epochs = newEpochs()
    const gate = deferred()
    const { client } = chain([gate.promise])
    const ctl = new ReceiptsController()
    const persisted: string[] = []
    const cancel1 = startReceiptRead(ctl, epochs, buildFor(client, persisted))
    await tick()
    assert.equal(ctl.view().status, 'verifying')

    epochs.page.bump()
    epochs.page.bump()
    cancel1() // effect cleanup after the activation value changed
    const cancel2 = startReceiptRead(ctl, epochs, buildFor(client, persisted)) // restart under the current epoch
    await tick(); await tick(); await tick()
    assert.equal(ctl.view().status, 'complete')
    assert.deepEqual(ctl.view().fresh, { [A]: HASH_A })

    gate.release() // the OLD read finally returns, late
    await tick(); await tick()
    assert.equal(ctl.view().status, 'complete', 'a late stale result changes nothing')
    assert.equal(persisted.length, 1, 'only the current generation was stored')
    cancel2()
  })

  it('while the restarted read is still in flight, the earlier proof is awaiting revalidation, never fresh', async () => {
    const epochs = newEpochs()
    const { client } = chain()
    const ctl = new ReceiptsController()
    startReceiptRead(ctl, epochs, buildFor(client))
    await tick(); await tick(); await tick()
    assert.equal(ctl.view().status, 'complete')

    const gate = deferred()
    const held = chain([gate.promise]).client
    epochs.page.bump(); epochs.page.bump()
    startReceiptRead(ctl, epochs, buildFor(held))
    await tick()
    const mid = ctl.view()
    assert.equal(mid.status, 'verifying')
    assert.deepEqual(mid.fresh, {}, 'not fresh until re-verified')
    assert.deepEqual(mid.awaiting, { [A]: HASH_A }, 'retained and labelled as awaiting')
    gate.release()
    await tick(); await tick(); await tick()
    assert.equal(ctl.view().status, 'complete')
  })
})

describe('creation proof: a read in flight when the visitor goes Home and returns', () => {
  const base = (client: never, epochs: ReturnType<typeof newEpochs>, states: Creator[]) => ({
    client, chainId: CREATE_CHAIN, contract: CREATE_CONTRACT, hash: TX_HASH, billId: 7n, intended: INTENDED, epochs,
    onState: (s: Creator) => { states.push(s) },
  })
  const gated = (gate: Promise<void> | null) => {
    const { client } = createClient()
    const c = client as unknown as { getTransactionReceipt: (a: unknown) => Promise<unknown> }
    const orig = c.getTransactionReceipt
    let first = true
    c.getTransactionReceipt = async (a) => {
      if (gate && first) { first = false; await gate }
      return orig(a)
    }
    return client
  }

  it('REPRO: a discarded result leaves "checking" unless the view restarts the proof', async () => {
    const epochs = newEpochs()
    const gate = deferred()
    const states: Creator[] = []
    startCreationProof(base(gated(gate.promise), epochs, states))
    await tick()
    epochs.page.bump(); epochs.page.bump()
    gate.release()
    await tick(); await tick(); await tick()
    assert.equal(states.at(-1)?.kind, 'checking', 'the stale result was (correctly) discarded and nothing replaced it')
  })

  it('FIX: restarting under the current epoch settles to verified; the late old result commits nothing', async () => {
    const epochs = newEpochs()
    const gate = deferred()
    const states: Creator[] = []
    const cancel1 = startCreationProof(base(gated(gate.promise), epochs, states))
    await tick()
    epochs.page.bump(); epochs.page.bump()
    cancel1()
    const cancel2 = startCreationProof(base(gated(null), epochs, states))
    await tick(); await tick(); await tick()
    const verified = states.filter((s) => s.kind === 'verified')
    assert.equal(verified.length, 1)
    assert.equal(states.at(-1)?.kind, 'verified')

    gate.release()
    await tick(); await tick(); await tick()
    assert.equal(states.filter((s) => s.kind === 'verified').length, 1, 'the old run emitted nothing late')
    assert.equal(states.some((s) => s.kind === 'unverified'), false)
    cancel2()
  })

  it('a creation transaction for a different bill is shown as unverified, not as the creator', async () => {
    const epochs = newEpochs()
    const states: Creator[] = []
    startCreationProof({ ...base(gated(null), epochs, states), billId: 8n })
    await tick(); await tick(); await tick()
    assert.deepEqual(states.at(-1), { kind: 'unverified', reason: 'The creation transaction is for a different bill.' })
  })
})

describe('the restart signal reaches the mounted read hooks without remounting or relaxing anything', () => {
  const entry = read('src/Entry.tsx')
  const receipts = read('src/hooks/useReceipts.ts')
  const details = read('src/components/BillDetails.tsx')

  it('Entry publishes the page epoch at every navigation through a context and never keys or remounts the app', () => {
    assert.match(entry, /ReadActivationContext\.Provider value=\{activation\}/)
    assert.equal((entry.match(/setActivation\(appEpochs\.page\.value\)/g) ?? []).length, 2, 'in go() and on popstate')
    assert.doesNotMatch(entry, /<AppRoot[^>]*\skey=/)
    assert.doesNotMatch(entry, /\bkey=\{/)
  })

  it('useReceipts and the creation proof start under the current epoch and list the activation value as a dependency', () => {
    assert.match(receipts, /useReadActivation\(\)/)
    assert.match(receipts, /startReceiptRead\(ctl, epochs, buildInput\)/)
    assert.match(receipts, /\[client, ctl, buildInput, epochs, scopeKey, activation\]/)
    assert.match(details, /useReadActivation\(\)/)
    assert.match(details, /startCreationProof\(/)
    assert.match(details, /creationHash, context\.network\.chainId, context\.deployment\.address, billId, activation\]/)
  })

  it('staleness checks are unchanged: the epoch is still captured per run and compared before any commit', () => {
    const ctl = read('src/receiptController.ts')
    assert.match(ctl, /const isStale = \(\) => !live \|\| epochs\.page\.value !== pageEpoch/)
    assert.match(read('src/creationProof.ts'), /live && input\.epochs\.page\.value === pageEpoch/)
  })
})

describe('homepage navigation cannot discard a held app', () => {
  it('both settled-example links are separate-tab anchors with explicit new-tab semantics and no click handler', () => {
    for (const f of ['src/components/home/Hero.tsx', 'src/components/home/Proof.tsx']) {
      const s = read(f)
      assert.match(s, /<ExternalLink href=\{settledHref\}/, f)
      assert.doesNotMatch(s, /preventDefault|onViewSettled/, f)
      assert.doesNotMatch(s, /<ExternalLink href=\{settledHref\}[^>]*onClick/, f)
    }
    const link = read('src/components/home/ExternalLink.tsx')
    assert.match(link, /target="_blank" rel="noopener noreferrer"/)
    assert.match(link, /\(opens in a new tab\)/)
  })

  it('Entry has no code path that replaces the held app address for the settled example', () => {
    const entry = read('src/Entry.tsx')
    assert.doesNotMatch(entry, /viewSettled|onViewSettled|go\(settled/)
    assert.match(entry, /const settledHref = useMemo/)
    assert.doesNotMatch(read('src/components/Home.tsx'), /onViewSettled/)
  })

  it('"Open app" still returns to the held context before the default create form', () => {
    assert.match(read('src/Entry.tsx'), /go\(appSearch \?\? defaultCreateSearch\(readEnvAddress\(\)\)\)/)
  })
})

describe('the refusal page recovery is an explicit Testnet app entry, not the marketing homepage', () => {
  it('links to the clean default create address built by the existing helper', () => {
    const s = read('src/components/ContextProblemView.tsx')
    assert.match(s, /defaultCreateSearch\(readEnvAddress\(\)\)/)
    assert.doesNotMatch(s, /href=\{window\.location\.pathname\}/)
  })

  it('that address is a non-empty supported Testnet context (never Home) and parses', () => {
    const search = defaultCreateSearch(undefined)
    assert.notEqual(search, '')
    assert.equal(isHomeSearch(search), false)
    const parsed = parsePageContext(search)
    assert.equal(parsed.ok, true)
    if (parsed.ok) { assert.equal(parsed.context.network.key, 'testnet'); assert.equal(parsed.context.billId, null) }
    assert.match(search, new RegExp(`chainId=${TESTNET.chainId}`))
  })

  it('the invalid incoming query is still refused, never normalised into a bill', () => {
    const bad = parsePageContext(`?network=mainnet&contract=${TESTNET.deployments[0].address}&bill=1`)
    assert.equal(bad.ok, false)
  })
})
