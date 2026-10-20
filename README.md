# SplitReceipt

Create a shared bill, let each payer send their exact share, and recover a transaction receipt for every confirmed payment. Each share goes directly to the bill's recipient through the contract.

**Arc Testnet only · Chain ID 5042002 · Test USDC has no monetary value.** This project has no mainnet deployment or completed competition submission.

[Public demo](https://splitreceipt.axiqo.xyz/splitreceipt/) · [Settled bill 3](https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3) · [Source](https://github.com/a252937166/splitreceipt) · [Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62) · [Validation status](docs/VALIDATION.md)

The public site is deployed on dedicated static hosting (splitreceipt.axiqo.xyz) with verified HTTPS. The dedicated domain was checked anonymously (no wallet connected) and bill 3 read back as settled with both receipts visible. MetaMask connection, wallet signing and the related security warning belong to the earlier old GitHub Pages and temporary hosting session, not to a wallet retest on the new dedicated hostname. The old GitHub Pages hostname returned `recommendedAction: BLOCK` in one official scan; its cause remains unconfirmed. The new dedicated hostname returned `NONE` in one 18 October scan; this does not guarantee future wallet behavior or certify security. See the [site warning review](docs/METAMASK-SITE-REVIEW.md). The local standalone app also passed ordinary-wallet connection/rejection, creation/payment, disconnect/reload, account-change and testnet-switch checks; detailed boundaries are in the validation record.

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

Arc's native gas token uses **18 decimals**; the contract uses native USDC transfers rather than ERC-20 approvals.

### Bill 3 — primary public demo

Bill 3 is the current primary demo bill on the dedicated domain. Title: **Published UI retest - testnet**. Recipient: `0x7c50fF360EE4Ee53097ADFb6D0a464c2E9F77336`. Payers (ordered): `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74` and `0x92F6772880Bc6FFe9F8112E5F202bB7eC5428B6e`. Each share: **0.001 test USDC**, total **0.002 test USDC**. No real money.

| Transaction | Block | Gas (test USDC) |
| --- | --- | --- |
| [Create](https://explorer.testnet.arc.io/tx/0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7) | 67806955 | 0.00422905 |
| [Pay — payer 1](https://explorer.testnet.arc.io/tx/0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4) | 67809882 | 0.0017118 |
| [Pay — payer 2](https://explorer.testnet.arc.io/tx/0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9) | 67810029 | 0.001771625 |

Independent read-only public RPC verification at 2026-10-18 08:16:19 UTC (head 67810050) confirmed 2/2 paid, both SharePaid receipt events, total principal 0.002 test USDC and gas 0.007712475 test USDC. All transactions succeeded. Creation and first payment session used MetaMask; both signatures occurred off-camera. Second payment used a disposable test-account helper, not MetaMask. Chain success does not prove wallet software or continuous signing footage.

## Hosting

Primary demo: **https://splitreceipt.axiqo.xyz/splitreceipt/**

Dedicated static Dogyun hosting. Verified HTTPS and an isolated `/var/www/splitreceipt/releases/` directory with a `current` symlink. Only public `dist/` files uploaded; no backend, port, dependency or secret uploaded.

**INITIAL/HISTORICAL release checkpoint (2026-10-18 08:22:43 UTC):** label `20261018T080938Z-dd5013b`, four public dist files, 608,328 bytes, manifest SHA-256 `21ff2a604925a5e6b09f8cd623dca6b3848147ab67340eaae0387c4853c35215`. HTTPS manifest, TLS and redirect readback passed at that time. Root, slash and HTTP redirects preserved bill query strings. This release used the white/blue UI. A new publication must be independently verified after source export before being claimed as deployed.

The temporary `codex.axiqo.xyz/splitreceipt` route has been removed. The old `a252937166.github.io/splitreceipt` hostname remains historical but is no longer the primary demo.

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

Open `http://127.0.0.1:4177/` for development. To serve the production build locally, run `npm run preview -- --port 4177` after building and open `http://127.0.0.1:4177/splitreceipt/`. The public deployment configuration is already included; no secret environment variables, Circle API key or application backend are required.

Additional checks:

```sh
npm run check
npm run verify:clean
npm run chain:check
npm run contracts:build
npm run contracts:test
```

See [dependency isolation](docs/DEPENDENCY-ISOLATION.md) and [vendored Solidity dependencies](lib/DEPENDENCIES.md).

## Receipts and limits

The browser reads bill state and validates matching `SharePaid` events from the configured contract. History is scanned newest first in pages of at most 2,000 blocks, with up to 25 pages per batch. Continue scanning to reach earlier history; successful pages survive an in-page retry. A complete page reload rebuilds receipts from the chain, without a private database or external indexer.

If all configured history has been scanned but some paid shares still lack links, **Retry full receipt history** starts a fresh scan while retaining already verified links.

Only confirmed successful payment events become receipt links. A wallet rejection, failed transaction or cancelled replacement must not be presented as a paid share.

## Development and source history

The contract and original application were created in Arc Studio. Standalone dependency isolation, history pagination, wallet handling and public delivery refinements were made with local development tooling, then synchronized back to Studio. Source changes now happen in Studio, followed by export, independent verification, build and publication.

The initial public deployment used the white/blue UI at revision `566a2f24d2faee88d441115d92127e01685058e9`. A 17 October UI pass refined five UI files locally for amount-summary consistency, narrow layouts, contrast, touch targets, dialog keyboard focus and network-switch feedback, then synchronized them back to Studio; that resynchronization was independently verified (see [provenance](docs/PROVENANCE.md)).

A later 18 October dark UI redesign used a local screenshot as a visual design reference only. Studio implemented the six dark UI files; subsequent Studio repairs corrected two misleading signature/permit labels, repaired mobile navigation at 390px, and restored the strict facts helper after an observed mismatch. The dark source candidate requires independent fresh ZIP readback, local build and live-release verification before claiming it as published.

See [provenance](docs/PROVENANCE.md) for archive hashes and validation boundaries.

Studio and testnet process recordings are retained locally. They have not been uploaded and no public video URL is claimed. Mainnet evidence, final contest materials and contest submission remain outside this testnet release.

Original project code is available under the [MIT license](LICENSE). Dependencies retain their own licenses. This is an independent project and is not operated or endorsed by Circle.
