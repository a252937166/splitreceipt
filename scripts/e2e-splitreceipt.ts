/**
 * SplitReceipt E2E test — create-bill / pay-two-shares / receipt-reload
 *
 * Runs entirely with public RPC (no API keys, no Circle credentials).
 * Requires two funded EOA wallets on Arc Testnet (chain 5042002).
 *
 * Environment variables (all required, never logged):
 *   CONTRACT_ADDRESS        — deployed SplitReceipt address (0x...)
 *   PAYER1_PRIVATE_KEY      — 0x-prefixed private key for payer 1
 *   PAYER2_PRIVATE_KEY      — 0x-prefixed private key for payer 2
 *   RECIPIENT_ADDRESS       — recipient address (does not need to sign)
 *
 * Optional:
 *   RPC_URL                 — defaults to https://rpc.testnet.arc.io
 *   SHARE_USDC              — per-payer USDC share as decimal string e.g. "0.01"
 *                             defaults to "0.001"
 *
 * Usage:
 *   bun run scripts/e2e-splitreceipt.ts
 *
 * Exits 0 on full success, non-zero on any failure.
 * NEVER prints private keys, auth tokens, or secret values.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbiItem,
  decodeEventLog,
  type Chain,
  type Hex,
  type Address,
  type TransactionReceipt,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// ── Arc Testnet chain definition (built from public constants only) ───────────
const ARC_TESTNET_CHAIN_ID = 5042002 as const
const ARC_TESTNET_RPC_DEFAULT = 'https://rpc.testnet.arc.io'
const ARC_TESTNET_EXPLORER = 'https://explorer.testnet.arc.io'

function buildArcTestnetChain(rpcUrl: string): Chain {
  return {
    id: ARC_TESTNET_CHAIN_ID,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: {
      default: { name: 'Arc Testnet Explorer', url: ARC_TESTNET_EXPLORER },
    },
    testnet: true,
  }
}

// ── ABI (matches contracts/SplitReceipt.sol exactly) ─────────────────────────
const SPLIT_RECEIPT_ABI = [
  {
    type: 'function', name: 'createBill', stateMutability: 'nonpayable',
    inputs: [
      { name: 'title',     type: 'string'    },
      { name: 'recipient', type: 'address'   },
      { name: 'payers',    type: 'address[]' },
      { name: 'share',     type: 'uint256'   },
    ],
    outputs: [{ name: 'billId', type: 'uint256' }],
  },
  {
    type: 'function', name: 'payShare', stateMutability: 'payable',
    inputs: [{ name: 'billId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function', name: 'getBill', stateMutability: 'view',
    inputs: [{ name: 'billId', type: 'uint256' }],
    outputs: [
      { name: 'title',      type: 'string'   },
      { name: 'recipient',  type: 'address'  },
      { name: 'payers',     type: 'address[]'},
      { name: 'share',      type: 'uint256'  },
      { name: 'paidStates', type: 'bool[]'   },
    ],
  },
  {
    type: 'event', name: 'BillCreated',
    inputs: [
      { name: 'billId',    type: 'uint256',   indexed: true  },
      { name: 'recipient', type: 'address',   indexed: true  },
      { name: 'share',     type: 'uint256',   indexed: false },
      { name: 'payers',    type: 'address[]', indexed: false },
      { name: 'title',     type: 'string',    indexed: false },
    ],
  },
  {
    type: 'event', name: 'SharePaid',
    inputs: [
      { name: 'billId', type: 'uint256', indexed: true  },
      { name: 'payer',  type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// ── Amount helpers (integer-only, no floating-point) ─────────────────────────

const SCALE    = 10n ** 12n   // native-18 / SCALE = 6-dp units
const MAX_6DP  = 10n ** 6n

function parseUsdcToNative(text: string): bigint {
  const t = text.trim()
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`Not a decimal number: ${t}`)
  const [whole, frac = ''] = t.split('.')
  if (frac.length > 6) throw new Error(`Too many decimal places (max 6): ${t}`)
  const sixDp = BigInt(whole) * MAX_6DP + BigInt(frac.padEnd(6, '0'))
  if (sixDp === 0n) throw new Error('Share must be > 0')
  return sixDp * SCALE
}

function fmtNativeUsdc(raw: bigint): string {
  if (raw === 0n) return '0'
  const sixDp = raw / SCALE
  if (sixDp === 0n) return '< 0.000001'
  const whole = sixDp / MAX_6DP
  const frac  = sixDp % MAX_6DP
  if (frac === 0n) return whole.toString()
  return `${whole}.${frac.toString().padStart(6, '0').replace(/0+$/, '')}`
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v?.trim()) throw new Error(`Missing required env var: ${name}`)
  return v.trim()
}

function assertSuccess(receipt: TransactionReceipt, label: string): void {
  if (receipt.status !== 'success') {
    throw new Error(
      `${label}: transaction reverted (status=${receipt.status}, hash=${receipt.transactionHash})`
    )
  }
}

const SHARE_PAID_EVENT = parseAbiItem(
  'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)'
)

/** Find the first SharePaid log in a receipt that originates from contractAddress. */
function findSharePaidLog(
  receipt: TransactionReceipt,
  contractAddress: Address
): TransactionReceipt['logs'][number] | undefined {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue
    try {
      decodeEventLog({ abi: [SHARE_PAID_EVENT], data: log.data, topics: log.topics })
      return log
    } catch {
      // not a SharePaid log — skip
    }
  }
  return undefined
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Public config — safe to print
  const contractAddress = requireEnv('CONTRACT_ADDRESS') as Address
  const rpcUrl          = process.env.RPC_URL?.trim() || ARC_TESTNET_RPC_DEFAULT
  const shareUsdc       = process.env.SHARE_USDC?.trim() || '0.001'
  const recipientAddress = requireEnv('RECIPIENT_ADDRESS') as Address

  // Private keys: converted to account objects immediately, never referenced again
  const account1 = privateKeyToAccount(requireEnv('PAYER1_PRIVATE_KEY') as Hex)
  const account2 = privateKeyToAccount(requireEnv('PAYER2_PRIVATE_KEY') as Hex)

  const share = parseUsdcToNative(shareUsdc)
  const chain = buildArcTestnetChain(rpcUrl)

  console.log('=== SplitReceipt E2E Test ===')
  console.log('Contract:   ', contractAddress)
  console.log('Chain:      ', `Arc Testnet (chainId ${ARC_TESTNET_CHAIN_ID})`)
  console.log('RPC:        ', rpcUrl)
  console.log('Payer1:     ', account1.address)
  console.log('Payer2:     ', account2.address)
  console.log('Recipient:  ', recipientAddress)
  console.log('Share:      ', fmtNativeUsdc(share), `USDC (${share.toString()} native units)`)
  console.log('')

  const transport    = http(rpcUrl)
  const publicClient = createPublicClient({ chain, transport })
  const wallet1      = createWalletClient({ account: account1, chain, transport })
  const wallet2      = createWalletClient({ account: account2, chain, transport })

  // ── RPC health check ──────────────────────────────────────────────────────
  const chainId = await publicClient.getChainId()
  if (chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error(`Wrong chain: got ${chainId}, expected ${ARC_TESTNET_CHAIN_ID}`)
  }
  const headBefore = await publicClient.getBlockNumber()
  console.log(`[RPC OK] chainId=${chainId}, head block=${headBefore}`)

  // ── Balance check ─────────────────────────────────────────────────────────
  const bal1 = await publicClient.getBalance({ address: account1.address })
  const bal2 = await publicClient.getBalance({ address: account2.address })
  console.log(`[Balances] payer1=${fmtNativeUsdc(bal1)} USDC, payer2=${fmtNativeUsdc(bal2)} USDC`)
  if (bal1 < share) throw new Error(`Payer1 balance (${fmtNativeUsdc(bal1)}) < share (${fmtNativeUsdc(share)})`)
  if (bal2 < share) throw new Error(`Payer2 balance (${fmtNativeUsdc(bal2)}) < share (${fmtNativeUsdc(share)})`)

  // ── Step 1: createBill ────────────────────────────────────────────────────
  console.log('\n[Step 1] createBill...')
  const createHash = await wallet1.writeContract({
    address: contractAddress,
    abi: SPLIT_RECEIPT_ABI,
    functionName: 'createBill',
    args: ['E2E Test Bill', recipientAddress, [account1.address, account2.address], share],
  })
  console.log('  tx submitted:', createHash)

  const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash })
  assertSuccess(createReceipt, 'createBill')
  console.log(`  mined in block: ${createReceipt.blockNumber}  status: ${createReceipt.status}`)
  console.log(`  explorer: ${ARC_TESTNET_EXPLORER}/tx/${createHash}`)

  // Decode BillCreated event to extract billId
  const billCreatedEvent = parseAbiItem(
    'event BillCreated(uint256 indexed billId, address indexed recipient, uint256 share, address[] payers, string title)'
  )
  let billId: bigint | undefined
  for (const log of createReceipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: [billCreatedEvent],
        data: log.data,
        topics: log.topics,
      })
      billId = decoded.args.billId
      break
    } catch { /* not BillCreated — skip */ }
  }
  if (billId === undefined) throw new Error('BillCreated event not found in receipt logs')
  console.log('  billId:', billId.toString())

  // ── Step 2: getBill — verify storage ─────────────────────────────────────
  console.log('\n[Step 2] getBill (verify storage)...')
  const [storedTitle, storedRecipient, storedPayers, storedShare, initialPaid] =
    await publicClient.readContract({
      address: contractAddress,
      abi: SPLIT_RECEIPT_ABI,
      functionName: 'getBill',
      args: [billId],
    })
  console.log('  title:     ', storedTitle)
  console.log('  recipient: ', storedRecipient)
  console.log('  payers:    ', storedPayers.join(', '))
  console.log('  share:     ', fmtNativeUsdc(storedShare), 'USDC')
  console.log('  paidStates:', initialPaid.map(String).join(', '))

  if (storedTitle !== 'E2E Test Bill')                                    throw new Error('title mismatch')
  if (storedRecipient.toLowerCase() !== recipientAddress.toLowerCase())   throw new Error('recipient mismatch')
  if (storedShare !== share)                                               throw new Error('share mismatch')
  if (initialPaid[0] !== false || initialPaid[1] !== false)               throw new Error('paidStates should be false initially')

  // ── Step 3: payShare — payer1 ─────────────────────────────────────────────
  console.log('\n[Step 3] payShare (payer1)...')
  const recipBalBefore = await publicClient.getBalance({ address: recipientAddress })
  const pay1Hash = await wallet1.writeContract({
    address: contractAddress,
    abi: SPLIT_RECEIPT_ABI,
    functionName: 'payShare',
    args: [billId],
    value: share,
  })
  console.log('  tx submitted:', pay1Hash)

  const pay1Receipt = await publicClient.waitForTransactionReceipt({ hash: pay1Hash })
  assertSuccess(pay1Receipt, 'payShare payer1')
  console.log(`  mined in block: ${pay1Receipt.blockNumber}  status: ${pay1Receipt.status}`)
  console.log(`  explorer: ${ARC_TESTNET_EXPLORER}/tx/${pay1Hash}`)

  // Verify SharePaid log
  const log1 = findSharePaidLog(pay1Receipt, contractAddress)
  if (!log1) throw new Error('SharePaid event not found in payer1 receipt')
  const decoded1 = decodeEventLog({ abi: [SHARE_PAID_EVENT], data: log1.data, topics: log1.topics })
  if (decoded1.args.billId !== billId)
    throw new Error('SharePaid billId mismatch for payer1')
  if (decoded1.args.payer?.toLowerCase() !== account1.address.toLowerCase())
    throw new Error('SharePaid payer mismatch for payer1')
  if (decoded1.args.amount !== share)
    throw new Error('SharePaid amount mismatch for payer1')
  console.log(
    `  SharePaid: billId=${decoded1.args.billId}, payer=${decoded1.args.payer?.slice(0, 10)}..., amount=${fmtNativeUsdc(decoded1.args.amount)} USDC`
  )

  // Verify recipient received exactly `share`
  const recipBalAfter1 = await publicClient.getBalance({ address: recipientAddress })
  if (recipBalAfter1 - recipBalBefore !== share)
    throw new Error(`Recipient balance delta after payer1: expected ${share}, got ${recipBalAfter1 - recipBalBefore}`)
  console.log(`  Recipient balance +${fmtNativeUsdc(share)} USDC [OK]`)

  // ── Step 4: getBill — payer1 paid, payer2 unpaid ──────────────────────────
  console.log('\n[Step 4] getBill after payer1 payment...')
  const [,,,, paidAfter1] = await publicClient.readContract({
    address: contractAddress, abi: SPLIT_RECEIPT_ABI, functionName: 'getBill', args: [billId],
  })
  if (paidAfter1[0] !== true)  throw new Error('payer1 should be marked paid')
  if (paidAfter1[1] !== false) throw new Error('payer2 should still be unpaid')
  console.log('  paidStates:', paidAfter1.map(String).join(', '), '[OK]')

  // ── Step 5: payShare — payer2 ─────────────────────────────────────────────
  console.log('\n[Step 5] payShare (payer2)...')
  const pay2Hash = await wallet2.writeContract({
    address: contractAddress,
    abi: SPLIT_RECEIPT_ABI,
    functionName: 'payShare',
    args: [billId],
    value: share,
  })
  console.log('  tx submitted:', pay2Hash)

  const pay2Receipt = await publicClient.waitForTransactionReceipt({ hash: pay2Hash })
  assertSuccess(pay2Receipt, 'payShare payer2')
  console.log(`  mined in block: ${pay2Receipt.blockNumber}  status: ${pay2Receipt.status}`)
  console.log(`  explorer: ${ARC_TESTNET_EXPLORER}/tx/${pay2Hash}`)

  const log2 = findSharePaidLog(pay2Receipt, contractAddress)
  if (!log2) throw new Error('SharePaid event not found in payer2 receipt')
  const decoded2 = decodeEventLog({ abi: [SHARE_PAID_EVENT], data: log2.data, topics: log2.topics })
  if (decoded2.args.billId !== billId)
    throw new Error('SharePaid billId mismatch for payer2')
  if (decoded2.args.payer?.toLowerCase() !== account2.address.toLowerCase())
    throw new Error('SharePaid payer mismatch for payer2')
  console.log(
    `  SharePaid: billId=${decoded2.args.billId}, payer=${decoded2.args.payer?.slice(0, 10)}..., amount=${fmtNativeUsdc(decoded2.args.amount)} USDC`
  )

  // ── Step 6: getBill — both paid ───────────────────────────────────────────
  console.log('\n[Step 6] getBill after payer2 payment...')
  const [,,,, paidAfter2] = await publicClient.readContract({
    address: contractAddress, abi: SPLIT_RECEIPT_ABI, functionName: 'getBill', args: [billId],
  })
  if (paidAfter2[0] !== true) throw new Error('payer1 should be paid')
  if (paidAfter2[1] !== true) throw new Error('payer2 should be paid')
  console.log('  paidStates:', paidAfter2.map(String).join(', '), '[OK]')

  // ── Step 7: Receipt reload — fetch SharePaid logs from chain ─────────────
  console.log('\n[Step 7] Receipt reload (fetch SharePaid logs for billId)...')
  const currentHead = await publicClient.getBlockNumber()
  // Use exact bill-creation block as the lower bound — no guessing
  const fromBlock = createReceipt.blockNumber
  const sharePaidEventDef = parseAbiItem(
    'event SharePaid(uint256 indexed billId, address indexed payer, uint256 amount)'
  )
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: sharePaidEventDef,
    args: { billId },
    fromBlock,
    toBlock: currentHead,
  })
  if (logs.length !== 2) throw new Error(`Expected 2 SharePaid logs, got ${logs.length}`)
  const payerSet = new Set(logs.map(l => l.args.payer?.toLowerCase()))
  if (!payerSet.has(account1.address.toLowerCase())) throw new Error('payer1 not found in SharePaid logs')
  if (!payerSet.has(account2.address.toLowerCase())) throw new Error('payer2 not found in SharePaid logs')
  console.log(`  Found ${logs.length} SharePaid logs:`)
  for (const l of logs) {
    console.log(`    payer=${l.args.payer}, txHash=${l.transactionHash}`)
  }
  console.log('  Receipt reload: [OK]')

  // ── Final balance check ───────────────────────────────────────────────────
  const recipBalFinal = await publicClient.getBalance({ address: recipientAddress })
  const delta = recipBalFinal - recipBalBefore
  console.log(`\n[Final] Recipient balance delta: ${fmtNativeUsdc(delta)} USDC (expected ${fmtNativeUsdc(share * 2n)})`)
  if (delta !== share * 2n) throw new Error('Final recipient balance delta incorrect')

  console.log('\n=== E2E PASSED ===')
  console.log('billId:        ', billId.toString())
  console.log('createBill tx: ', createHash)
  console.log('payShare1 tx:  ', pay1Hash)
  console.log('payShare2 tx:  ', pay2Hash)
  console.log(`Explorer:       ${ARC_TESTNET_EXPLORER}/address/${contractAddress}`)
}

main().catch((err: unknown) => {
  console.error('\n=== E2E FAILED ===')
  const msg = err instanceof Error ? err.message : String(err)
  // Redact anything resembling a long secret before printing
  console.error(msg.replace(/\b[A-Za-z0-9+/=_-]{32,}\b/g, '[redacted]'))
  process.exit(1)
})
