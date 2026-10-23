# SplitReceipt — current mainnet status

Updated 23 October 2026.

## Verified contract deployment

- Network: Arc Mainnet, chain ID **5042**. Native USDC uses 18 decimals for payment value and Gas.
- Contract: [0x8522Ea5A413c8402182fF6998Bd7471bAC886142](https://explorer.arc.io/address/0x8522Ea5A413c8402182fF6998Bd7471bAC886142).
- Deployment: [0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f](https://explorer.arc.io/tx/0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f), block **27419618**.
- Runtime keccak256: `0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b`. Exact creation/runtime/ABI were independently reproduced with solc 0.8.28, Paris, optimizer 200. The executable code matches the historical Testnet contract after removing CBOR metadata; the full runtime hashes differ.
- Initial deployment state: billCount **0**, ReentrancyGuard slot 0 **1**. Deployment Gas: **0.01532992 USDC**. See [machine-readable deployment](../deployments/arc-mainnet.json).

## Application and payment boundary

This source release pins that deployment's chain, address, block, runtime hash and successful deployment hash. Mainnet writes require the exact pin, fresh RPC chain/runtime checks, and a matching explicitly acknowledged wallet session. A URL, environment flag, storage value or arbitrary address cannot create another reviewed deployment. Blank and legacy links still select Arc Testnet 5042002; the built-in Demo receipt remains historical Testnet Bill 3.

Publication acceptance is separate from a Git commit or successful build. The dedicated project domain is [splitreceipt.axiqo.xyz](https://splitreceipt.axiqo.xyz/splitreceipt/). A mainnet-enabled release must receive exact public-asset/TLS/readback checks before it is called published. GitHub Pages automatic deployment has been removed from CI; checks and static build remain.

**Through-application mainnet payment: not yet verified at this deployment checkpoint.** Deploying the contract and moving funds between the owner's wallets do not satisfy that evidence. The planned public-app demonstration creates a two-payer bill with **0.001 real USDC per share**, then verifies both contract-forwarded payments and their canonical receipt events. Owner-controlled demonstration accounts are not external customers, revenue or independent users.

## Budget and signing

The owner personally confirmed the local deployment-and-funding batch. The batch consumed **0.01616992 USDC Gas** including two wallet-funding transactions. The overall mainnet demonstration Gas budget is **0.10 USDC**, leaving **0.08383008 USDC** before application requests. Funding principal **0.10 USDC** remains in owner accounts; it is separate from Gas. Each future application transaction requires its own owner wallet confirmation and fresh budget review. App requests cap maxFeePerGas at 40 Gwei with zero priority fee; that per-gas cap alone is not an aggregate budget enforcement mechanism. No bridge, exchange, paid upgrade or extra service is required by this deployment.

## Provenance and submission

This activation uses externally prepared inputs actually applied through Arc Studio's official manual terminal, followed by actual hashes and identical local adoption. It is not a claim that Studio AI generated every source file. Mainnet deployment used the owner-confirmed local CLI; no private key was uploaded to Studio, the website or repository. Earlier mixed Studio/local development remains disclosed in [provenance](PROVENANCE.md).

The 23 October process images are manually sampled milestones with compressed waits, not continuous recording or native-wallet signing footage. No public final-video URL or competition submission is claimed. A final Studio/mainnet walkthrough, through-app payment proof, updated entry fields and resolution of the mixed-provenance interpretation remain separate submission gates.
