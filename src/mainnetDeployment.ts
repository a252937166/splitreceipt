import { isAddress, type Address, type Hex } from 'viem'

/** Set only after an independently reviewed, successful Arc Mainnet deployment. */
export interface ReviewedMainnetDeployment {
  readonly chainId: 5042
  readonly contract: Address
  readonly deploymentBlock: bigint
  readonly runtimeHash: Hex
  readonly deploymentTransactionHash: Hex
}

/** No environment variable, browser storage or URL can create this release record. */
export const REVIEWED_MAINNET_DEPLOYMENT: ReviewedMainnetDeployment | null = Object.freeze({
  chainId: 5042,
  contract: '0x8522Ea5A413c8402182fF6998Bd7471bAC886142',
  deploymentBlock: 27419618n,
  runtimeHash: '0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b',
  deploymentTransactionHash: '0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f',
})

interface DeploymentIdentity {
  readonly chainId: number
  readonly contract: Address | null
  readonly deploymentBlock: bigint | null
  readonly expectedRuntimeHash: Hex | null
}

/** Pure identity comparison; a match is still followed by fresh RPC and wallet checks. */
export function matchesReviewedMainnetDeployment(
  context: DeploymentIdentity,
  reviewed: ReviewedMainnetDeployment | null = REVIEWED_MAINNET_DEPLOYMENT,
): boolean {
  if (!reviewed || reviewed.chainId !== 5042 || context.chainId !== reviewed.chainId) return false
  if (!isAddress(reviewed.contract) || /^0x0{40}$/i.test(reviewed.contract) || reviewed.deploymentBlock <= 0n) return false
  if (!/^0x[0-9a-f]{64}$/i.test(reviewed.runtimeHash) || /^0x0{64}$/i.test(reviewed.runtimeHash)) return false
  if (!/^0x[0-9a-f]{64}$/i.test(reviewed.deploymentTransactionHash) || /^0x0{64}$/i.test(reviewed.deploymentTransactionHash)) return false
  return context.contract?.toLowerCase() === reviewed.contract.toLowerCase() &&
    context.deploymentBlock === reviewed.deploymentBlock &&
    context.expectedRuntimeHash?.toLowerCase() === reviewed.runtimeHash.toLowerCase()
}


/** Upper fee quote for the approved mainnet demo; owner still reviews wallet estimates. */
export const MAINNET_MAX_FEE_PER_GAS = 40_000_000_000n
export function transactionFeeFields(context: { readonly chainId: number }) {
  if (context.chainId === 5042002) return {}
  if (context.chainId !== 5042) throw new Error('Unsupported transaction network.')
  return { maxFeePerGas: MAINNET_MAX_FEE_PER_GAS, maxPriorityFeePerGas: 0n }
}
