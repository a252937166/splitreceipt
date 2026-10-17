# Source and deployment provenance

## Origin

The original SplitReceipt application and Solidity contract were generated and iterated in this [Arc Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Studio was used for application preview, contract authoring and testing. The initial Studio deployment path could not initiate a transaction because of its deployment policy limit.

An independent local deployment then used a fresh test-only wallet and the public Arc Testnet RPC. This produced the contract and example bill recorded in [arc-testnet.json](../deployments/arc-testnet.json). The recorded example has two `0.001` test-USDC payments. No mainnet wallet, mainnet API key or real USDC was used for that testnet run.

This standalone repository preserves the Studio-origin contract and application while adding locally developed dependency isolation, receipt-history pagination, wallet handling, verification and static publication. The local project and the Studio workspace are distinct environments; a local revision is not automatically claimed to have been replayed in Studio.

## Build boundary

The historical deployment used Solidity `0.8.28+commit.7893614a`, Paris EVM and the optimizer with 200 runs. Its runtime-code hash and source hashes are recorded in the deployment manifest. The OpenZeppelin `ReentrancyGuard.sol` bytes were checked against the official `@openzeppelin/contracts@5.1.0` package.

This repository pins that package and vendors the specified Forge test-library source. See [lib/DEPENDENCIES.md](../lib/DEPENDENCIES.md). Local directory names and source paths affect Solidity metadata, so recompilation is not claimed to produce byte-for-byte identical historical deployment bytecode. `npm run chain:check` verifies the recorded deployed runtime and transaction evidence separately from a fresh source build.

## Recordings and scope

The build and testnet walkthrough recordings are retained locally, outside the public source tree. They have not been uploaded. The recordings document the actual captured browser sequence; a public recording URL or a continuous recording from an empty project is not claimed.

The public release is restricted to Arc Testnet. Mainnet deployment, mainnet payment evidence, and competition submission have not been completed. A working testnet demonstration does not establish satisfaction of a contest's mainnet requirements.

## Licensing and attribution

The original contract carries an MIT SPDX identifier. The repository's original application code and documentation are distributed under [LICENSE](../LICENSE). Vendored and installed dependencies retain their own notices and licenses; the root license does not relicense third-party code, Circle's tools, or trademarks.

Circle's [Developer Terms, section 6](https://console.circle.com/legal/developer-terms) distinguish ownership of its tools from rights retained in a developer's own service. [Arc Studio's terms](https://studio.arc.io/terms-of-use) describe generated apps and independent deployment outside Studio. These references support distinguishing this application from the Studio service; they are not a warranty that generated output is free of third-party rights.

Arc Studio and Circle are acknowledged as development tools and network providers. This application is an independent project; no Circle approval or endorsement is claimed.
