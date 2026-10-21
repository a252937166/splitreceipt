/** Type contract for the offline-only prepare.mjs module; importing this module performs no RPC. */
export interface PreparationBaseline {
  readonly chainId: 5042
  readonly contractName: string
  readonly sourcePath: string
  readonly sourceHash: string
  readonly guardHash: string
  readonly compiler: string
  readonly evmVersion: string
  readonly optimizerRuns: number
  readonly historicalTestnetRuntimeHash: string
}
export const PREPARATION_BASELINE: Readonly<PreparationBaseline>

export interface UnsignedDeploymentDraft {
  chainId: 5042
  to: null
  value: '0x0'
  data: `0x${string}`
}

export interface PreparationManifest {
  /** Dynamic inspection of JSON fields returns unknown rather than introducing an implicit any. */
  [field: string]: unknown
  status: 'UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW'
  artifactReviewStatus: 'REQUIRES_INDEPENDENT_REVIEW'
  purpose: string
  chainId: 5042
  nativeCurrency: { symbol: 'USDC'; decimals: 18 }
  contract: string
  deployedAddress: null
  deploymentTransactionHash: null
  sourceHash: `0x${string}`
  reentrancyGuardHash: `0x${string}`
  compiler: string
  evmVersion: string
  optimizer: { enabled: true; runs: number }
  artifactSha256: string
  creationBytecodeKeccak256: `0x${string}`
  runtimeCodeHash: `0x${string}`
  historicalTestnetRuntimeHash: string
  historicalRuntimeExactMatch: boolean
  historicalComparisonNote: string
  creationBytecodeBytes: number
  runtimeBytecodeBytes: number
  unsignedTransactionSha256: string
  constructorArguments: []
  walletFrom: null
  nonce: null
  gasEstimate: null
  feeQuote: null
  preSigningRequirements: string[]
  actionsPerformed: { rpcRequests: 0; walletConnections: 0; signatures: 0; broadcasts: 0 }
  mainnetWritesEnabledInApplication: false
}

export interface PrepareDeploymentInput {
  /** Untrusted parsed JSON; prepare.mjs validates it against the pinned source/compiler baseline. */
  artifact: unknown
  artifactBytes?: Uint8Array
  sourceBytes: Uint8Array
  guardBytes: Uint8Array
}

export interface PreparedDeploymentBundle {
  manifest: PreparationManifest
  unsignedTransaction: UnsignedDeploymentDraft
  unsignedJson: string
}

export function prepareDeploymentBundle(input: PrepareDeploymentInput): PreparedDeploymentBundle
/** CLI entry point writes a new explicitly requested private output directory; never signs or broadcasts. */
export function main(args?: string[]): Promise<void>
