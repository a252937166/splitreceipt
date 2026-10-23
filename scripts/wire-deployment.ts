/**
 * wire-deployment.ts
 *
 * After an external runner deploys SplitReceipt and reports back the contract
 * address and deployment block, run this script to wire both values into the
 * app's .env and update AGENTS.md.
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x<addr> DEPLOY_BLOCK=<number> bun run scripts/wire-deployment.ts
 *
 * The script:
 *   1. Validates the address and block number.
 *   2. Verifies that code actually exists at the address on Arc Testnet.
 *   3. Appends/overwrites VITE_SPLIT_RECEIPT_ADDRESS and
 *      VITE_SPLIT_RECEIPT_DEPLOY_BLOCK in /home/user/app/.env.
 *   4. Writes contract-metadata/SplitReceipt.json for the contracts panel.
 *   5. Prints the shareable URL format so the user can test immediately.
 *
 * NEVER prints private keys or auth tokens. Only public values (address, block).
 */

import fs from 'fs'
import { createPublicClient, http } from 'viem'

const WORK_DIR = '/home/user/app'
const ENV_PATH = `${WORK_DIR}/.env`
const METADATA_PATH = `${WORK_DIR}/contracts/contract-metadata/SplitReceipt.json`
const AGENTS_PATH = `${WORK_DIR}/AGENTS.md`
const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.io'
const ARC_TESTNET_EXPLORER = 'https://explorer.testnet.arc.io'
const CHAIN_ID = 5042002

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`)
  return v.trim()
}

function isValidAddress(s: string): s is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(s)
}

function upsertEnvVar(envPath: string, key: string, value: string): void {
  let content = ''
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8')
  }
  const re = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  if (re.test(content)) {
    content = content.replace(re, line)
  } else {
    content = content.endsWith('\n') || content === ''
      ? content + line + '\n'
      : content + '\n' + line + '\n'
  }
  fs.writeFileSync(envPath, content)
}

async function main(): Promise<void> {
  const contractAddress = requireEnv('CONTRACT_ADDRESS')
  const deployBlockRaw = requireEnv('DEPLOY_BLOCK')

  if (!isValidAddress(contractAddress)) {
    throw new Error(`CONTRACT_ADDRESS is not a valid 0x-prefixed 20-byte address: ${contractAddress}`)
  }
  if (!/^\d+$/.test(deployBlockRaw)) {
    throw new Error(`DEPLOY_BLOCK must be a plain integer: ${deployBlockRaw}`)
  }
  const deployBlock = BigInt(deployBlockRaw)

  console.log('=== wire-deployment ===')
  console.log('Contract address:', contractAddress)
  console.log('Deploy block:    ', deployBlock.toString())
  console.log('Verifying code on Arc Testnet...')

  const client = createPublicClient({
    transport: http(ARC_TESTNET_RPC),
  })

  const chainId = await client.getChainId()
  if (chainId !== CHAIN_ID) {
    throw new Error(`RPC returned wrong chainId: ${chainId}, expected ${CHAIN_ID}`)
  }

  const code = await client.getCode({ address: contractAddress })
  if (!code || code === '0x') {
    throw new Error(`No code found at ${contractAddress} on Arc Testnet (chainId ${CHAIN_ID}). Deploy the contract first.`)
  }
  console.log('Code verified:', code.slice(0, 20) + '...[' + (code.length - 2) / 2 + ' bytes]')

  // Verify the block exists
  const block = await client.getBlock({ blockNumber: deployBlock })
  const blockHashPreview = block.hash ? block.hash.slice(0, 14) + '...' : '(pending)'
  console.log('Deploy block confirmed:', block.number.toString(), '(hash:', blockHashPreview + ')')

  // Update .env
  console.log('\nUpdating .env...')
  upsertEnvVar(ENV_PATH, 'VITE_SPLIT_RECEIPT_ADDRESS', contractAddress)
  upsertEnvVar(ENV_PATH, 'VITE_SPLIT_RECEIPT_DEPLOY_BLOCK', deployBlockRaw)
  console.log('  VITE_SPLIT_RECEIPT_ADDRESS    =', contractAddress)
  console.log('  VITE_SPLIT_RECEIPT_DEPLOY_BLOCK =', deployBlockRaw)

  // Write contract metadata
  console.log('\nWriting contract metadata...')
  fs.mkdirSync(`${WORK_DIR}/contracts/contract-metadata`, { recursive: true })
  const explorerUrl = `${ARC_TESTNET_EXPLORER}/address/${contractAddress}`
  const metadata = {
    contractAddress,
    network: 'ARC-TESTNET',
    contract_code_path: `${WORK_DIR}/contracts/SplitReceipt.sol`,
    contract_compiled_code_path: `${WORK_DIR}/contracts/out/SplitReceipt.sol/SplitReceipt.json`,
    contract_network_and_links: { 'Arc Testnet': explorerUrl },
    contract_deployments: [{
      chain: 'Arc Testnet',
      address: contractAddress,
      explorerUrl,
      deployedAt: new Date().toISOString(),
    }],
  }
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2) + '\n')
  console.log('  Wrote:', METADATA_PATH)

  // Update AGENTS.md
  console.log('\nUpdating AGENTS.md...')
  let agents = fs.existsSync(AGENTS_PATH) ? fs.readFileSync(AGENTS_PATH, 'utf8') : ''
  const deploymentNote = `
## SplitReceipt — Arc Testnet Deployment

- **Contract address**: \`${contractAddress}\`
- **Deploy block**: ${deployBlockRaw}
- **Chain**: Arc Testnet (chainId 5042002)
- **Explorer**: ${explorerUrl}
- **Wired**: \`VITE_SPLIT_RECEIPT_ADDRESS\` and \`VITE_SPLIT_RECEIPT_DEPLOY_BLOCK\` in .env

**Important**: Restart the Vite dev server after running this script so the new
.env values take effect (\`import.meta.env\` is read at startup, not hot-reloaded).
`
  if (!agents.includes(contractAddress)) {
    fs.writeFileSync(AGENTS_PATH, agents.trimEnd() + '\n' + deploymentNote)
    console.log('  Updated AGENTS.md with deployment info.')
  } else {
    console.log('  AGENTS.md already contains this address — skipping.')
  }

  console.log('\n=== Done ===')
  console.log('Next steps:')
  console.log('  1. Restart the Vite dev server (Vite reads .env only at startup):')
  console.log('       pkill -f vite && bun run dev')
  console.log('  2. Open the app preview — the undeployed banner should be gone.')
  console.log('  3. Create a bill in the UI and share the ?bill=<id> link.')
  console.log('  4. Run the E2E test:')
  console.log('       CONTRACT_ADDRESS=' + contractAddress + ' \\')
  console.log('       PAYER1_PRIVATE_KEY=0x<key1> \\')
  console.log('       PAYER2_PRIVATE_KEY=0x<key2> \\')
  console.log('       RECIPIENT_ADDRESS=0x<recipient> \\')
  console.log('       bun run scripts/e2e-splitreceipt.ts')
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('Error:', msg.replace(/\b[A-Za-z0-9+/=_-]{32,}\b/g, '[redacted]'))
  process.exit(1)
})
