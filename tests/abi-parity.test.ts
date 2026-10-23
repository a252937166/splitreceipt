import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { SPLIT_RECEIPT_HUMAN_ABI, GET_BILL_PAID_STATES_INDEX, GET_BILL_RECIPIENT_INDEX } from '../src/splitReceiptAbi.ts'

interface Param { name?: string; type: string; indexed?: boolean }
interface Item { type: string; name?: string; inputs?: Param[]; outputs?: Param[]; stateMutability?: string }

// Clean-export fixture: the compiler ABI of contracts/SplitReceipt.sol (solc 0.8.28, Paris, optimizer 200), copied from
// the forge artifact's `abi` field and nothing else. It deliberately carries no wallet ids, addresses, deployments or
// platform metadata, so public CI can run without Forge or the generated Studio contract-metadata directory.
const FIXTURE_URL = new URL('./fixtures/splitreceipt-compiler-abi.json', import.meta.url)
const fixtureRaw = JSON.parse(readFileSync(FIXTURE_URL, 'utf8')) as { abi: Item[] }
const compiler = fixtureRaw.abi
const sig = (i: Item) => {
  const ins = (i.inputs ?? []).map((p) => `${p.type}${p.indexed ? ' indexed' : ''} ${p.name ?? ''}`).join(',')
  const outs = (i.outputs ?? []).map((p) => `${p.type} ${p.name ?? ''}`).join(',')
  return `${i.type} ${i.name}(${ins})${i.type === 'function' ? ` ${i.stateMutability} -> (${outs})` : ''}`
}
const set = (abi: readonly Item[]) => abi.filter((i) => ['function', 'event', 'error'].includes(i.type)).map(sig).sort()

describe('human ABI matches the compiled contract', () => {
  it('the committed compiler-ABI fixture contains only the ABI and no platform or deployment data', () => {
    assert.deepEqual(Object.keys(fixtureRaw), ['abi'])
    const text = readFileSync(FIXTURE_URL, 'utf8')
    assert.ok(!/wallet|deployer|network|deployment|contractAddress/i.test(text))
    assert.ok(!/0x[0-9a-fA-F]{40}/.test(text), 'no addresses')
    for (const item of fixtureRaw.abi) assert.ok(['function', 'event', 'error'].includes(item.type), `unexpected ABI item type ${item.type}`)
  })

  it('has identical functions, events and errors', () => {
    assert.deepEqual(set(SPLIT_RECEIPT_HUMAN_ABI as unknown as Item[]), set(compiler))
  })

  it('there is no public paid() method; paid status is getBill()[4]', () => {
    const names = compiler.filter((i) => i.type === 'function').map((i) => i.name)
    assert.ok(!names.includes('paid'))
    const getBill = compiler.find((i) => i.name === 'getBill')!
    assert.equal(getBill.outputs![GET_BILL_PAID_STATES_INDEX].name, 'paidStates')
    assert.equal(getBill.outputs![GET_BILL_PAID_STATES_INDEX].type, 'bool[]')
    assert.equal(getBill.outputs![GET_BILL_RECIPIENT_INDEX].name, 'recipient')
  })

  it('BillCreated has no creator; SharePaid has no recipient', () => {
    const created = compiler.find((i) => i.type === 'event' && i.name === 'BillCreated')!
    assert.deepEqual(created.inputs!.map((p) => p.name), ['billId', 'recipient', 'share', 'payers', 'title'])
    const paid = compiler.find((i) => i.type === 'event' && i.name === 'SharePaid')!
    assert.deepEqual(paid.inputs!.map((p) => p.name), ['billId', 'payer', 'amount'])
  })

  it('the contract source is unchanged from the reviewed bytes', async () => {
    const { createHash } = await import('node:crypto')
    const sha = createHash('sha256').update(readFileSync(new URL('../contracts/SplitReceipt.sol', import.meta.url))).digest('hex')
    assert.equal(sha, 'df06d8d017fc9170f39eeb08d38f5f7f5dbcbd4b4e34a8542cc3eaa216d504c2')
  })
})
