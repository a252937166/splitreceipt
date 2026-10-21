# SplitReceipt

Create a shared bill, let each payer send their exact share, and recover a transaction receipt for every confirmed payment. Each share goes directly to the bill's recipient through the contract.

**Arc Testnet only · Chain ID 5042002 · Test USDC has no monetary value.** This project has no mainnet deployment or completed competition submission.

[Public demo](https://splitreceipt.axiqo.xyz/splitreceipt/) · [Settled bill 3](https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3) · [Source](https://github.com/a252937166/splitreceipt) · [Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62) · [Validation status](docs/VALIDATION.md)

The public site is deployed on dedicated static hosting (splitreceipt.axiqo.xyz) with verified HTTPS. On 18 October the dedicated domain was checked anonymously (no wallet connected) and bill 3 read back as settled with both receipts visible. Subsequently a Bill 4 create transaction was submitted on the new domain; the direct user confirmed the wallet approval dialog appeared with no malicious warning shown — this absence is user-reported for that createBill step only, native wallet pixels were not captured, and payShare confirmation on the new domain has not been retested. The old GitHub Pages hostname returned `recommendedAction: BLOCK` in one official scan; its cause remains unconfirmed. The new dedicated hostname returned `NONE` in one 18 October scan; this does not guarantee future wallet behavior or certify security. See the [site warning review](docs/METAMASK-SITE-REVIEW.md). The local standalone app also passed ordinary-wallet connection/rejection, creation/payment, disconnect/reload, account-change and testnet-switch checks; detailed boundaries are in the validation record.

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

**Current release (21 October 2026):** commit `003f005b4030f664dfb95f9ccc79205f14e92b27`, label `20261021T071846Z-003f005`. Six UI/design source files adopted as exact Studio-export bytes. ZIP SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14`. Light/forest navigation UI; desktop and mobile layouts at 360/390/768/1024px verified. Live browser on 21 October returned Bill 3 Settled 2/2 paid, 2/2 freshly verified receipts.

**INITIAL/HISTORICAL release checkpoint (2026-10-18 08:22:43 UTC):** label `20261018T080938Z-dd5013b`, four public dist files, 608,328 bytes, manifest SHA-256 `21ff2a604925a5e6b09f8cd623dca6b3848147ab67340eaae0387c4853c35215`. HTTPS manifest, TLS and redirect readback passed at that time. This release used the white/blue UI.

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

Receipt recovery runs in two sequential phases on page load and on every explicit refresh:

**Phase 1 — Hint fast-path.** A bundled catalog of known public testnet receipt hashes, plus any hashes stored from a previous visit or encoded in the `?receipts=` URL parameter, are each verified against the live RPC before use. Verification requires: `getChainId()` confirming Arc Testnet 5042002, a fresh `getBlockNumber()` head (receipts from blocks beyond head are rejected), a valid non-empty 32-byte `blockHash` on the receipt, equality with the canonical block hash from `getBlock()`, and a matching `SharePaid` log with correct contract address, bill ID, payer and amount. A receipt whose `blockHash` is missing, empty or mismatched is treated as explicitly invalid, not silently skipped.

Hashes that fail verification are tracked as `invalidatedHashes` and purged from all in-memory maps before the fallback scan runs. Hashes that return a transient RPC error are preserved for display only and are not treated as verified or invalidated. A conflicting distinct verified hash for the same payer marks the result as incomplete regardless of whether all payers have entries.

**Phase 2 — Fallback log scan.** Runs only after the hint phase completes, and only for payers who still lack a verified receipt. History is scanned newest first in pages of at most 2,000 blocks, with up to 25 pages per batch. A complete page reload rebuilds receipts from the chain, without a private database or external indexer. Continue scanning to reach earlier history; successful pages survive an in-page retry.

If all configured history has been scanned but some paid shares still lack links, **Retry full receipt history** starts a fresh scan while retaining already verified links.

The **Copy bill link** button encodes only the receipts freshly verified in the current run for current paid payers, at most five hashes. Preserved display links from prior sessions are not included in the shared URL.

Only confirmed successful payment events become receipt links. A wallet rejection, failed transaction or cancelled replacement must not be presented as a paid share.

## Development and source history

The contract and original application were created in Arc Studio. Standalone dependency isolation, history pagination, wallet handling and public delivery refinements were made with local development tooling, then synchronized back to Studio. Source changes now happen in Studio, followed by export, independent verification, build and publication.

The initial public deployment used the white/blue UI at revision `566a2f24d2faee88d441115d92127e01685058e9`. A 17 October UI pass refined five UI files locally for amount-summary consistency, narrow layouts, contrast, touch targets, dialog keyboard focus and network-switch feedback, then synchronized them back to Studio; that resynchronization was independently verified (see [provenance](docs/PROVENANCE.md)).

A later 18 October dark UI redesign used a local screenshot as a visual design reference only. Studio implemented the six dark UI files; subsequent Studio repairs corrected two misleading signature/permit labels, repaired mobile navigation at 390px, and restored the strict facts helper after an observed mismatch.

The current 21 October light/forest redesign was authored in Studio: all six UI/design files adopted from the Studio export as exact bytes (ZIP SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14`). A further Studio session applied five presentation corrections: narrow-viewport mobile nav (≤419px icon hide), bill totals CSS class (no break-all on amounts), Create bill preview visible on mobile, token aliases for the frozen wallet dialog, and correct dialog heading font override. This release was independently verified and published as `003f005b4030f664dfb95f9ccc79205f14e92b27`.

See [provenance](docs/PROVENANCE.md) for archive hashes and validation boundaries.
See [submission/EVIDENCE-INDEX.md](docs/submission/EVIDENCE-INDEX.md) for the full evidence map.

Studio and testnet process recordings are retained locally. They have not been uploaded and no public video URL is claimed. Mainnet evidence, final contest materials and contest submission remain outside this testnet release.

Original project code is available under the [MIT license](LICENSE). Dependencies retain their own licenses. This is an independent project and is not operated or endorsed by Circle.


## Unpublished mainnet preparation (21 October 2026)

The public site remains the Arc Testnet release `003f005b4030f664dfb95f9ccc79205f14e92b27`. This session prepares an unpublished adaptation with separate Arc mainnet (`5042`) context, a blank mainnet deployment address, read-only deployment identity checks and offline unsigned review material. Testnet (`5042002`) remains the default and its contract and receipts remain testnet evidence.

`MAINNET_WRITES_ENABLED = false` is a source-level release lock compiled into this preparation build. Filling an address or changing environment, URL or wallet settings cannot enable mainnet writes. Future live use requires a separately reviewed source change plus explicit authorization and owner-reviewed signatures for deployment, bill creation and each payment. No deployment, onchain write/broadcast or paid upgrade is included in this preparation.

The offline preparation tool produces `UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW` material, not a reviewed deployment or a signed transaction. Fresh artifact/runtime hashes are recorded separately from the historical testnet hash; metadata can cause a difference. See [mainnet preparation](docs/MAINNET-PREPARATION.md) for review gates and [the dated cost study](docs/submission/MAINNET-COST-STUDY.md) for fee assumptions and exclusions.

Codex prepared source inputs, then actual file changes are applied through Arc Studio's official manual terminal without a paid upgrade. This is not a claim that Studio AI generated all source. The daily Studio agent quota was observed at 99%; an observed Download Code archive was an older snapshot, so the current terminal files require exact terminal export and independent readback. The [provenance record](docs/PROVENANCE.md) preserves the earlier mixed Studio/local history.

The starting Studio baseline passed typecheck, 36 TypeScript tests, 35 Solidity tests and a production build. **Final adaptation in Studio: typecheck, 67 TypeScript tests, 38 Solidity tests (including three local 5042 preparation tests), 256 fuzz runs, production build, dependency isolation and offline unsigned-bundle generation passed. Exact terminal export and independent local typecheck, 67 TypeScript tests, 38 Solidity tests, 256 fuzz runs, build and dependency isolation passed. Local browser checks confirmed the disabled mainnet preview, wrong-context recovery and preserved legacy testnet Bill 3 with 2/2 freshly verified receipts. Live wallet connection/signing was not retested; one external wallet-extension injection error was observed. See tests/evidence/mainnet-preparation-2026-10-21.json.** Local EVM tests and unsigned artifacts are preparation evidence only; no new mainnet deployment, payment receipt, public video or competition submission is claimed.
