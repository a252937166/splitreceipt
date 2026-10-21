#!/usr/bin/env node
/** OFFLINE ONLY: construct unsigned review material. This module has no RPC, wallet or broadcast client. */
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { encodeDeployData, keccak256, toHex } from 'viem'

export const PREPARATION_BASELINE = Object.freeze({
  chainId: 5042,
  contractName: 'SplitReceipt',
  sourcePath: 'contracts/SplitReceipt.sol',
  sourceHash: '0xd8e26dac4e5bf1066753ee02539f6427d229819c87e8f513608d9bc0bd3a2670',
  guardHash: '0x11a5a79827df29e915a12740caf62fe21ebe27c08c9ae3e09abe9ee3ba3866d3',
  compiler: '0.8.28+commit.7893614a',
  evmVersion: 'paris',
  optimizerRuns: 200,
  historicalTestnetRuntimeHash: '0xbbd2f2b7c23a525b0cbb77c31d8b4a82b99797158bcfd7da6cd94c12b74b8074',
})
const sha256 = value => createHash('sha256').update(value).digest('hex')
const requiredFunctions = Object.freeze({
  createBill: ['nonpayable', ['string', 'address', 'address[]', 'uint256'], ['uint256']],
  payShare: ['payable', ['uint256'], []],
  getBill: ['view', ['uint256'], ['string', 'address', 'address[]', 'uint256', 'bool[]']],
  billCount: ['view', [], ['uint256']],
})

function requireCondition(ok, message) { if (!ok) throw new Error(message) }
function bytecodeOf(raw, name) {
  const value = typeof raw === 'string' ? raw : raw?.object
  requireCondition(typeof value === 'string' && /^0x(?:[0-9a-f]{2})+$/i.test(value), `${name} must be non-empty, linked even-length hex bytecode.`)
  if (typeof raw === 'object' && raw !== null) {
    requireCondition(!Object.values(raw.linkReferences ?? {}).some(refs => Object.keys(refs).length), `${name} has unresolved library references.`)
    requireCondition(!Object.keys(raw.immutableReferences ?? {}).length, `${name} has unsupported immutable references.`)
  }
  return value.toLowerCase()
}

/** An artifact with matching metadata is still not an independently reviewed deployment artifact. */
export function prepareDeploymentBundle({ artifact, artifactBytes, sourceBytes, guardBytes }) {
  const baseline = PREPARATION_BASELINE
  requireCondition(artifact && typeof artifact === 'object', 'A Foundry artifact object is required.')
  const actualSourceHash = keccak256(toHex(sourceBytes))
  const actualGuardHash = keccak256(toHex(guardBytes))
  requireCondition(actualSourceHash === baseline.sourceHash, 'Contract source differs from the pinned Studio-origin source.')
  requireCondition(actualGuardHash === baseline.guardHash, 'ReentrancyGuard bytes differ from the pinned dependency.')
  let metadata = artifact.metadata ?? artifact.rawMetadata
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata) } catch { throw new Error('Artifact compiler metadata is invalid JSON.') }
  }
  requireCondition(metadata && typeof metadata === 'object', 'Compiler metadata is required.')
  const settings = metadata.settings ?? {}
  requireCondition(metadata.compiler?.version === baseline.compiler, 'Compiler version differs from the pinned baseline.')
  requireCondition(settings.evmVersion === baseline.evmVersion, 'EVM version differs from the pinned Paris baseline.')
  requireCondition(settings.optimizer?.enabled === true && settings.optimizer.runs === baseline.optimizerRuns && !settings.optimizer.details,
    'Optimizer settings differ from the pinned baseline.')
  requireCondition(Object.keys(settings.compilationTarget ?? {}).length === 1 && settings.compilationTarget[baseline.sourcePath] === baseline.contractName,
    'Artifact compilation target is not contracts/SplitReceipt.sol:SplitReceipt.')
  requireCondition(!Object.values(settings.libraries ?? {}).some(refs => Object.keys(refs).length), 'Linked libraries are not supported by this deployment draft.')
  const sources = metadata.sources ?? {}
  requireCondition(sources[baseline.sourcePath]?.keccak256 === baseline.sourceHash, 'Artifact does not attest the pinned contract source.')
  const guards = Object.entries(sources).filter(([name]) => name.endsWith('/ReentrancyGuard.sol'))
  requireCondition(Object.keys(sources).length === 2 && guards.length === 1 && guards[0][1].keccak256 === baseline.guardHash,
    'Artifact dependency source identities differ from the pinned baseline.')
  const abi = artifact.abi
  requireCondition(Array.isArray(abi), 'Artifact ABI is required.')
  const functions = abi.filter(item => item.type === 'function')
  requireCondition(functions.length === Object.keys(requiredFunctions).length, 'Unexpected contract functions in artifact ABI.')
  for (const [name, [state, inputs, outputs]] of Object.entries(requiredFunctions)) {
    const matches = functions.filter(item => item.name === name)
    requireCondition(matches.length === 1 && matches[0].stateMutability === state &&
      JSON.stringify((matches[0].inputs ?? []).map(item => item.type)) === JSON.stringify(inputs) &&
      JSON.stringify((matches[0].outputs ?? []).map(item => item.type)) === JSON.stringify(outputs), `Artifact ABI mismatch for ${name}.`)
  }
  const constructors = abi.filter(item => item.type === 'constructor')
  requireCondition(constructors.length <= 1 && constructors.every(item => (item.inputs ?? []).length === 0 && item.stateMutability !== 'payable'),
    'SplitReceipt deployment must have no constructor arguments or payable constructor.')
  requireCondition(!abi.some(item => item.type === 'fallback' || item.type === 'receive'), 'Unexpected fallback/receive entry in artifact ABI.')
  const creationBytecode = bytecodeOf(artifact.bytecode, 'Creation bytecode')
  const runtimeBytecode = bytecodeOf(artifact.deployedBytecode, 'Runtime bytecode')
  const data = encodeDeployData({ abi, bytecode: creationBytecode, args: [] })
  requireCondition(data === creationBytecode, 'Unexpected constructor arguments were appended.')
  const runtimeHash = keccak256(runtimeBytecode)
  const unsignedTransaction = { chainId: baseline.chainId, to: null, value: '0x0', data }
  const unsignedJson = JSON.stringify(unsignedTransaction, null, 2) + '\n'
  const manifest = {
    status: 'UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW',
    artifactReviewStatus: 'REQUIRES_INDEPENDENT_REVIEW',
    purpose: 'Offline unsigned contract-creation draft. Not a signed transaction, deployment, cost guarantee or authorization.',
    chainId: baseline.chainId,
    nativeCurrency: { symbol: 'USDC', decimals: 18 },
    contract: baseline.contractName,
    deployedAddress: null,
    deploymentTransactionHash: null,
    sourceHash: actualSourceHash,
    reentrancyGuardHash: actualGuardHash,
    compiler: baseline.compiler,
    evmVersion: baseline.evmVersion,
    optimizer: { enabled: true, runs: baseline.optimizerRuns },
    artifactSha256: sha256(artifactBytes ?? Buffer.from(JSON.stringify(artifact))),
    creationBytecodeKeccak256: keccak256(creationBytecode),
    runtimeCodeHash: runtimeHash,
    historicalTestnetRuntimeHash: baseline.historicalTestnetRuntimeHash,
    historicalRuntimeExactMatch: runtimeHash === baseline.historicalTestnetRuntimeHash,
    historicalComparisonNote: 'Compiler metadata and source/remapping paths can change runtime bytes. A mismatch is not a claim of reviewed equivalence; both matches and mismatches still require independent review.',
    creationBytecodeBytes: (creationBytecode.length - 2) / 2,
    runtimeBytecodeBytes: (runtimeBytecode.length - 2) / 2,
    unsignedTransactionSha256: sha256(unsignedJson),
    constructorArguments: [],
    walletFrom: null,
    nonce: null,
    gasEstimate: null,
    feeQuote: null,
    preSigningRequirements: ['Independently confirm source, artifact, creation data and runtime hash.',
      'Confirm Arc Mainnet chain ID 5042 in the wallet.', 'Estimate fresh gas and fees for the exact reviewed transaction and account.',
      'The owner signs separately; this tool cannot sign or broadcast.'],
    actionsPerformed: { rpcRequests: 0, walletConnections: 0, signatures: 0, broadcasts: 0 },
    mainnetWritesEnabledInApplication: false,
  }
  return { manifest, unsignedTransaction, unsignedJson }
}

export async function main(args = process.argv.slice(2)) {
  const options = { artifact: 'contracts/out/SplitReceipt.sol/SplitReceipt.json', source: 'contracts/SplitReceipt.sol',
    guard: 'node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol', out: '' }
  if (args.includes('--help')) {
    console.log('Offline only: node tools/mainnet/prepare.mjs --out <new-private-directory> [--artifact <file>] [--source <file>] [--guard <file>]')
    return
  }
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]?.replace(/^--/, '')
    requireCondition(name && Object.hasOwn(options, name) && args[i + 1] && !args[i + 1].startsWith('--'), 'Unknown option or missing option value.')
    options[name] = args[i + 1]
  }
  requireCondition(options.out, 'An explicit private --out directory is required; nothing was written.')
  const [artifactBytes, sourceBytes, guardBytes] = await Promise.all([
    readFile(resolve(options.artifact)), readFile(resolve(options.source)), readFile(resolve(options.guard)),
  ])
  const bundle = prepareDeploymentBundle({ artifact: JSON.parse(artifactBytes.toString('utf8')), artifactBytes, sourceBytes, guardBytes })
  const out = resolve(options.out)
  // A new directory and exclusive files prevent silently overwriting a reviewed bundle.
  await mkdir(out, { recursive: false })
  await writeFile(resolve(out, 'unsigned-deployment.json'), bundle.unsignedJson, { flag: 'wx', mode: 0o600 })
  await writeFile(resolve(out, 'preparation-manifest.json'), JSON.stringify(bundle.manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  console.log(JSON.stringify({ status: bundle.manifest.status, out, runtimeCodeHash: bundle.manifest.runtimeCodeHash,
    historicalRuntimeExactMatch: bundle.manifest.historicalRuntimeExactMatch, rpcRequests: 0, broadcasts: 0 }, null, 2))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
