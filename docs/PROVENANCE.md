# Source and deployment provenance

## Origin

The original SplitReceipt application and Solidity contract were generated and iterated in this [Arc Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Studio was used for application preview, contract authoring and testing. The initial Studio deployment path could not initiate a transaction because of its deployment policy limit.

An independent local deployment then used a fresh test-only wallet and the public Arc Testnet RPC. This produced the contract and example bill recorded in [arc-testnet.json](../deployments/arc-testnet.json). The recorded example has two `0.001` test-USDC payments. No mainnet wallet, mainnet API key or real USDC was used for that testnet run.

This standalone repository preserves the Studio-origin contract and application while adding locally developed dependency isolation, receipt-history pagination, wallet handling, verification and static publication. The final application refinements were synchronized back to Studio and checked through a new downloaded source archive, as recorded below.

## Final Studio source readback

On 2026-10-17, a fresh **Download Code** ZIP from Studio was saved and independently compared with the canonical working tree. The public [source-readback evidence](../tests/evidence/studio-source-readback-2026-10-17.json) records 22 synchronized paths: **20 were byte-identical**, including all synchronized application source and tests. The contract bytes also matched the canonical original Studio-authored contract.

Two files have the documented Studio sandbox adaptations: `package.json` changes the development host to `0.0.0.0`; `vite.config.ts` uses that development host and adds `allowedHosts: true`. The canonical project retains `127.0.0.1`. These are the only differences among the 22 compared paths; this comparison does not cover every dependency or generated artifact in the archive.

Archive SHA-256: `46e458e3125421abd5144b409c75e40dfb8aee7a98d284c57fc6582e673ccd69`. The ZIP is retained privately outside Git; only sanitized path hashes and the two configuration diffs are public.

The Studio UI reported zero TypeScript errors, 16 passing tests and a successful build. A real Preview refresh was observed and recorded with the new testnet banner, public demo link and UTF-8 title-byte counter visible. The downloaded-file comparison establishes source persistence independently of that UI report. Historical contract deployment and mainnet scope remain as described separately below.

## UI refinement and exact resynchronization

A later 17 October UI pass used generated desktop/mobile design references in the same Studio project. The references were concepts, not live application or transaction screenshots. Five UI files were reviewed and refined locally for amount-summary consistency, narrow layouts, contrast, touch targets, dialog keyboard focus and network-switch pending/error feedback, then synchronized back to Studio.

A new [independent source readback](../tests/evidence/studio-ui-source-readback-2026-10-17.json) verifies all six intended files byte-for-byte: the five UI files plus the restored strict Arc Testnet facts helper. Eleven protected public-source paths matched; Studio package/Vite host adaptations matched the earlier Studio export. A package lock was already absent from Studio exports. Two unused generated network helpers were removed. No contract, application chain, test or dependency change was adopted.

Final archive SHA-256: `336844d1c6cd173e827858ceb47e4cdeeb3601e44e4f6580b1ea91158e32a886`, 3,541,106 bytes. The archive remains private; only sanitized source hashes and scope are public. Both actual desktop and mobile Studio Previews were observed. Typecheck, 16 frontend tests, build and local dependency isolation passed. Wallet-dialog initial focus, bidirectional Tab wrapping and Escape/return-focus were exercised without initiating a new wallet request. Real-wallet transaction and network-switch failure branches were not rerun as part of that UI sync; later release checks must be recorded separately.

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
