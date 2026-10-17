# SplitReceipt

Create a shared bill, let each payer send their exact share, and recover a transaction receipt for every confirmed payment. Each share goes directly to the bill's recipient through the contract.

**Arc Testnet only · Chain ID 5042002 · Test USDC has no monetary value.** This project has no mainnet deployment or completed competition submission.

[Public demo target](https://a252937166.github.io/splitreceipt/) · [Settled example bill](https://a252937166.github.io/splitreceipt/?bill=1) · [Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62) · [Validation status](docs/VALIDATION.md)

The demo links are the configured publication targets; see the validation record for deployment confirmation.

## Try a bill

1. Open the demo and connect an injected EVM wallet. Switch to Arc Testnet when prompted. The [official network reference](https://docs.arc.io/arc/references/connect-to-arc) lists the RPC and wallet configuration.
2. Get free **test** USDC from the [Circle faucet](https://faucet.circle.com/), selecting Arc Testnet. A wallet needs test USDC for both its share and transaction gas.
3. Create a bill with a title, recipient, two to five unique payer addresses, and an equal share amount. Share amounts in the app support up to six decimal places.
4. Share the generated `?bill=<id>` link. Each listed payer connects their own wallet and pays once. The contract requires the exact share and forwards it to the recipient.
5. Open each confirmed transaction in the explorer. Reload the bill to rebuild its payment receipts from onchain events. Use **Continue receipt history** when an older bill needs more pages.

Bill titles, addresses, amounts and payment events are public onchain. Keep personal contact or bank details out of titles. The public application never asks for private keys or recovery phrases.

## Testnet deployment

| Item | Evidence |
| --- | --- |
| Contract | [`0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`](https://explorer.testnet.arc.io/address/0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26) |
| Deployment | [Transaction](https://explorer.testnet.arc.io/tx/0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac), block `67660831` |
| Example bill 1 | [Creation](https://explorer.testnet.arc.io/tx/0xc6c8fafd050738cd8c37321db5b7a8f9feae8ec36822f9dda0f445874f122c80) |
| First share | [Payment](https://explorer.testnet.arc.io/tx/0x4736c401fc2a9757d21f6c09aa8de5550e8c9e76027475ce2fb63a7e3b176b54), `0.001` test USDC |
| Second share | [Payment](https://explorer.testnet.arc.io/tx/0xe1fba09d727a8eae598de8f794ac11b4fdfbfa188355805d492ffb856b598e25), `0.001` test USDC |

The machine-readable [deployment manifest](deployments/arc-testnet.json) records the compiler, code hashes, deployment and example transactions. Arc's native gas token uses **18 decimals**; the contract uses native USDC transfers rather than ERC-20 approvals.

## Run locally

Use Node.js `22.23.1` and npm `10.9.8`. Clone this repository into its own directory, then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:isolation
npm run typecheck
npm test
npm run build
npm run dev -- --port 4177
```

Open `http://127.0.0.1:4177/splitreceipt/`. To serve the production build locally, run `npm run preview -- --port 4177` after building. The public deployment configuration is already included; no secret environment variables, Circle API key or application backend are required.

Additional checks:

```sh
# All frontend checks above in one command
npm run check

# Cold install and checks in an independent temporary copy with an empty package cache
npm run verify:clean

# Read-only verification against the public testnet RPC
npm run chain:check

# Requires a local Foundry installation; solc is pinned to 0.8.28
npm run contracts:build
npm run contracts:test
```

See [dependency isolation](docs/DEPENDENCY-ISOLATION.md) and [vendored Solidity dependencies](lib/DEPENDENCIES.md). Dependencies are installed or vendored inside this project; ArcPreflight is not a runtime, build, funding or indexing dependency.

## Receipts and limits

The browser reads bill state and validates matching `SharePaid` events from the configured contract. History is scanned newest first in pages of at most 2,000 blocks, with up to 25 pages per batch. Continue scanning to reach earlier history; successful pages survive an in-page retry. A complete page reload rebuilds receipts from the chain, without a private database or external indexer.

Only confirmed successful payment events become receipt links. A wallet rejection, failed transaction or cancelled replacement must not be presented as a paid share. The validation record distinguishes deterministic provider tests from ordinary-wallet and mined-chain checks. Public RPC availability and rate limits can affect history loading.

## Development and publication

The contract and original application were created in Arc Studio. Standalone dependency isolation, history pagination, wallet handling and public delivery refinements were made with local development tooling. See [provenance](docs/PROVENANCE.md).

The [Pages workflow](.github/workflows/pages.yml) performs a frozen install, dependency-isolation check, typecheck, tests and production build before deploying `dist/`. It uses standard Ubuntu runners, pinned official actions, HTTPS and the `/splitreceipt/` base path. [Publication setup](docs/PUBLIC-DELIVERY-PLAN.md) records initial setup and verification requirements. No paid hosting or mainnet operation is part of this release.

Studio and testnet process recordings are retained locally. They have not been uploaded and no public video URL is claimed. Mainnet evidence, final contest materials and contest submission remain outside this testnet release.

Original project code is available under the [MIT license](LICENSE). Dependencies retain their own licenses. This is an independent project and is not operated or endorsed by Circle.
