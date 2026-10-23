import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { TransactionReceiptNotFoundError, encodeFunctionData } from 'viem'
import { discoverReceiptsFromHints } from '../src/receiptDiscovery.ts'
import { assembleCandidates, type HintHash } from '../src/receiptHints.ts'
import { verifyPaymentTransaction } from '../src/paymentVerification.ts'
import { catalogCreationHint } from '../src/creationHints.ts'
import { scanSharePaidPage } from '../src/receiptHistory.ts'
import { SPLIT_RECEIPT_HUMAN_ABI } from '../src/splitReceiptAbi.ts'
import { addr, hash, sharePaidLog, type Hex } from './fixtures.ts'

const MAIN = '0x8522ea5a413c8402182ff6998bd7471bac886142' as Hex
const SCOPE = { chainId: 5042, contract: MAIN, billId: 1n }
const PAY1 = '0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716' as HintHash
const PAY2 = '0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5' as HintHash
const P1 = addr(0xa1)
const P2 = addr(0xa2)
const SHARE = 1_000_000_000_000_000n
const HEAD = 27_480_000n

interface Chain { [hash: string]: { payer: Hex; block: bigint; blockHash: Hex; from?: Hex; to?: Hex; value?: bigint; contract?: Hex; billId?: bigint } }

/** A fresh-RPC fake of Arc Mainnet. It answers only for transactions it contains. */
function mainnet(chain: Chain, liveChainId = 5042) {
  const logFor = (h: string) => {
    const t = chain[h]
    return { ...sharePaidLog(t.billId ?? 1n, t.payer, SHARE, h as Hex), address: t.contract ?? MAIN, blockNumber: t.block, blockHash: t.blockHash }
  }
  const receipt = (h: string) => {
    const t = chain[h.toLowerCase()]
    if (!t) throw new TransactionReceiptNotFoundError({ hash: h as Hex })
    return {
      transactionHash: h, blockNumber: t.block, blockHash: t.blockHash, status: 'success', from: t.from ?? t.payer,
      to: t.to ?? MAIN, logs: [logFor(h.toLowerCase())],
    }
  }
  return {
    getChainId: async () => liveChainId,
    getBlockNumber: async () => HEAD,
    getTransactionReceipt: async ({ hash: h }: { hash: Hex }) => receipt(h),
    getBlock: async ({ blockNumber }: { blockNumber: bigint }) => {
      const t = Object.values(chain).find((x) => x.block === blockNumber)
      return { hash: t?.blockHash ?? hash(Number(blockNumber)) }
    },
    getTransaction: async ({ hash: h }: { hash: Hex }) => {
      const t = chain[h.toLowerCase()]
      if (!t) throw new Error('not found')
      return {
        hash: h, from: t.from ?? t.payer, to: t.to ?? MAIN, value: t.value ?? SHARE, blockHash: t.blockHash,
        input: encodeFunctionData({ abi: SPLIT_RECEIPT_HUMAN_ABI, functionName: 'payShare', args: [t.billId ?? 1n] }),
      }
    },
  } as never
}

const GOOD: Chain = {
  [PAY1]: { payer: P1, block: 27_428_500n, blockHash: hash(0xb1) },
  [PAY2]: { payer: P2, block: 27_428_600n, blockHash: hash(0xb2) },
}

async function recover(client: never, candidates: readonly HintHash[]) {
  const found = await discoverReceiptsFromHints({
    client, scope: SCOPE, candidates, paidPayers: [P1, P2], amount: SHARE, isCancelled: () => false,
  })
  const accepted: Record<string, HintHash> = {}
  for (const [payer, h] of Object.entries(found.receipts)) {
    const tx = await verifyPaymentTransaction(client, { contract: MAIN, billId: 1n, payer, amount: SHARE, hash: h })
    if (tx.ok) accepted[payer] = h
  }
  return { found, accepted }
}

const g = globalThis as { localStorage?: unknown }
afterEach(() => { delete g.localStorage })

describe('anonymous mainnet Bill 1 receipt recovery (fresh RPC, hints are only candidates)', () => {
  it('recovers both receipts from the public candidate hashes', async () => {
    const hints = assembleCandidates(SCOPE, '')
    assert.deepEqual([...hints], [PAY1, PAY2])
    const { found, accepted } = await recover(mainnet(GOOD), hints)
    assert.equal(found.complete, true)
    assert.deepEqual(accepted, { [P1]: PAY1, [P2]: PAY2 })
  })

  it('trusts nothing: when the chain does not have the hashes, no receipt is shown', async () => {
    const { found, accepted } = await recover(mainnet({}), assembleCandidates(SCOPE, ''))
    assert.deepEqual(accepted, {})
    assert.equal(found.complete, false)
    assert.equal(found.invalidatedHashes.length, 2)
  })

  it('a poisoned browser cache cannot create a receipt', async () => {
    const poisoned = hash(0xdead)
    g.localStorage = { getItem: () => JSON.stringify([poisoned]) }
    const { accepted } = await recover(mainnet({}), assembleCandidates(SCOPE, ''))
    assert.deepEqual(accepted, {})
  })

  it('a poisoned ?receipts= link cannot create a receipt', async () => {
    const { accepted } = await recover(mainnet({}), assembleCandidates(SCOPE, `?receipts=${hash(0xbeef)}`))
    assert.deepEqual(accepted, {})
  })

  it('rejects a real transaction for another bill or another contract', async () => {
    const otherBill = { [PAY1]: { ...GOOD[PAY1], billId: 2n }, [PAY2]: GOOD[PAY2] }
    const a = await recover(mainnet(otherBill), [PAY1, PAY2])
    assert.deepEqual(Object.keys(a.accepted), [P2])
    const otherContract = { [PAY1]: { ...GOOD[PAY1], contract: addr(0xbad) }, [PAY2]: GOOD[PAY2] }
    const b = await recover(mainnet(otherContract), [PAY1, PAY2])
    assert.deepEqual(Object.keys(b.accepted), [P2])
  })

  it('rejects a payment whose canonical sender is not the payer', async () => {
    const chain = { [PAY1]: { ...GOOD[PAY1], from: addr(0x99) }, [PAY2]: GOOD[PAY2] }
    const { accepted } = await recover(mainnet(chain), [PAY1, PAY2])
    assert.deepEqual(Object.keys(accepted), [P2])
  })

  it('rejects a payment with the wrong value', async () => {
    const chain = { [PAY1]: { ...GOOD[PAY1], value: SHARE - 1n }, [PAY2]: GOOD[PAY2] }
    const { accepted } = await recover(mainnet(chain), [PAY1, PAY2])
    assert.deepEqual(Object.keys(accepted), [P2])
  })

  it('refuses entirely when the RPC answers with the other network', async () => {
    const { found, accepted } = await recover(mainnet(GOOD, 5042002), [PAY1, PAY2])
    assert.deepEqual(accepted, {})
    assert.ok(found.rpcError)
  })

  it('recovers through the bounded history scan with no hints at all', async () => {
    const client = {
      getBlockNumber: async () => HEAD,
      getLogs: async (a: { fromBlock: bigint; toBlock: bigint }) =>
        [[PAY1, P1, 27_428_500n], [PAY2, P2, 27_428_600n]]
          .filter(([, , b]) => (b as bigint) >= a.fromBlock && (b as bigint) <= a.toBlock)
          .map(([h, p]) => ({ transactionHash: h, args: { payer: p }, removed: false })),
    } as never
    const scan = await scanSharePaidPage(client, SCOPE, { nextTo: 27_430_000n, floor: 27_419_618n, done: false }, { missingPayers: [P1, P2] })
    const { accepted } = await recover(mainnet(GOOD), scan.candidates.map((c) => c.hash as HintHash))
    assert.deepEqual(Object.keys(accepted).sort(), [P1, P2])
  })
})

describe('creation candidate', () => {
  it('is offered only for the exact mainnet Bill 1 scope (and testnet Bill 3)', () => {
    assert.equal(catalogCreationHint(SCOPE), '0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9')
    assert.equal(catalogCreationHint({ ...SCOPE, billId: 2n }), null)
    assert.equal(catalogCreationHint({ ...SCOPE, chainId: 5042002 }), null)
    assert.equal(catalogCreationHint({ ...SCOPE, contract: addr(1) }), null)
  })
})
