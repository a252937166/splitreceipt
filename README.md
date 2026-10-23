# SplitReceipt

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](docs/MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

> **23 October 2026 (Studio replacement rebuild, candidate only):** the original Studio snapshot was restored; the older externally prepared wallet, receipt and core code was removed or quarantined and then newly reimplemented by the Studio AI in one Arc Studio thread, with two independent review and repair rounds recorded. The seven original protected files are retained byte-for-byte. This candidate is **not published, uploaded, formally submitted or approved**: the public site still runs the earlier deployed commit described below. The earlier "Connecting to sandbox" failure of the embedded Studio Preview is dated history: an independent browser operator opened the official full Studio Preview pane on 23 October (17:58–18:01 UTC), filled the create form (title, recipient, two payers, share 0.001, draft total 0.002) and opened the wallet chooser (Phantom, OKX and MetaMask listed; Tab focused an option; Escape closed it and restored focus to the trigger), with no wallet connection, signature or transaction. Public-browser acceptance, real-wallet QA and publication are pending. This does not rewrite the mixed development history or establish organizer acceptance. See [the rebuild record](docs/STUDIO-REIMPLEMENTATION-2026-10-23.md) and [the section below](#23-october-2026-studio-replacement-rebuild-candidate-not-published).

Create a shared bill, let each payer send their exact share, and recover a transaction receipt for every confirmed payment. Each share goes directly to the bill's recipient through the contract.

**Default: Arc Testnet 5042002.** Blank and legacy bill links remain on Testnet. The deployed release (and the 23 October rebuild candidate) support an explicit Arc Mainnet 5042 context for the independently verified, source-pinned contract. Mainnet uses real USDC for both payments and gas; review the network and exact request before signing. See [current mainnet evidence](docs/MAINNET-LIVE.md). No competition submission has been completed.

[Public demo](https://splitreceipt.axiqo.xyz/splitreceipt/) · [Latest completed bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6) · [Source](https://github.com/a252937166/splitreceipt) · [Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62) · [Validation](docs/VALIDATION.md) · [Submission readiness](docs/submission/READINESS.md)

Historical public Testnet checkpoint (21–22 October): the dedicated HTTPS site ran application source `4dae47f01bb78126e5c70621d87af0c9899cb9c6`, release `20261021T192007Z-4dae47f`. On 22 October 2026, the public app completed Bill 6 creation and two `0.001` test-USDC payments, showed **2/2 paid and 2/2 verified receipts**, and retained both receipts after app Disconnect and reload in the same browser profile. A separate read-only chain check confirmed the transactions, canonical blocks and matching bill/payment events. These are owner-controlled demo accounts, not evidence of outside customers.

The wallet integration now lists named discovered providers, avoids the shared legacy injection slot, disables automatic reconnect on reload and requires explicit confirmation of the displayed wallet session before writes. The owner reported no security warning for Bill 6 creation or the second payment; the first payment's native signature and warning state were not observed. Native wallet screens were not captured. Extension listener/orphan-stream warnings remain; neither a universal warning clearance nor a security audit is claimed. See [the warning review](docs/METAMASK-SITE-REVIEW.md) and [current testnet evidence](tests/evidence/public-wallet-flow-2026-10-22.json).

## Try a bill

1. Open the demo and explicitly choose a named EVM wallet. After a reload, choose the wallet again; an account or provider change may require **Use this wallet** to acknowledge the displayed session. This acknowledgement is not a signature. Switch to Arc Testnet when prompted. The [official network reference](https://docs.arc.io/arc/references/connect-to-arc) lists the RPC and wallet configuration.
2. Get free **test** USDC from the [Circle faucet](https://faucet.circle.com/), selecting Arc Testnet. A wallet needs test USDC for both its share and transaction gas.
3. Create a bill with a title, recipient, two to five unique payer addresses, and an equal share amount. Share amounts in the app support up to six decimal places.
4. Share the generated link, which includes the configured network, chain ID, contract and bill ID. Each listed payer connects their own wallet and pays once. The contract requires the exact share and forwards it to the recipient.
5. Open each confirmed transaction in the explorer. Reload the bill to rebuild its payment receipts from onchain events. When an older bill needs more pages, use **Continue receipt history** (deployed release) or **Find missing receipts** (rebuild candidate).

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

### Bill 3 — historical built-in demo

The app’s built-in Demo receipt navigation still opens Bill 3. It remains a working historical demo; Bill 6 below is the newest completed public-wallet retest. Title: **Published UI retest - testnet**. Recipient: `0x7c50fF360EE4Ee53097ADFb6D0a464c2E9F77336`. Payers (ordered): `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74` and `0x92F6772880Bc6FFe9F8112E5F202bB7eC5428B6e`. Each share: **0.001 test USDC**, total **0.002 test USDC**. No real money.

| Transaction | Block | Gas (test USDC) |
| --- | --- | --- |
| [Create](https://explorer.testnet.arc.io/tx/0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7) | 67806955 | 0.00422905 |
| [Pay — payer 1](https://explorer.testnet.arc.io/tx/0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4) | 67809882 | 0.0017118 |
| [Pay — payer 2](https://explorer.testnet.arc.io/tx/0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9) | 67810029 | 0.001771625 |

Independent read-only public RPC verification at 2026-10-18 08:16:19 UTC (head 67810050) confirmed 2/2 paid, both SharePaid receipt events, total principal 0.002 test USDC and gas 0.007712475 test USDC. All transactions succeeded. Creation and first payment session used MetaMask; both signatures occurred off-camera. Second payment used a disposable test-account helper, not MetaMask. Chain success does not prove wallet software or continuous signing footage.

### Bill 6 — latest public-wallet retest (22 October 2026)

[Open Bill 6 without a wallet](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6). Title: **Public wallet retest 2026-10-22**. Creator, recipient and payer 1: `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74`. Payer 2: `0xA944Fe45F10C61F94F8d6a17274673dd1FB51A7c`. Each share is **0.001 test USDC**; the settled principal is **0.002 test USDC**.

| Operation | Transaction | Block | Gas fee (test USDC) |
| --- | --- | --- | --- |
| Create | [Receipt](https://explorer.testnet.arc.io/tx/0x9fc1c8409b65668fadbcc04ec3e5e1c099328293eabca58d13e1cfb30f8e40f4) | 68476739 | 0.00422965 |
| Payer 1 | [Receipt](https://explorer.testnet.arc.io/tx/0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e) | 68476809 | 0.0016493 |
| Payer 2 | [Receipt](https://explorer.testnet.arc.io/tx/0x0a5bed3b9d6f33bce647cbce41b99212add66b47a9917ecac3dcb170a4f5a2fd) | 68478093 | 0.001771625 |

All three succeeded. Total gas was **0.007650575 test USDC**; gas plus transferred principal was **0.009650575 test USDC**. The public UI and independent canonical chain evidence are distinct checks. The creator/second-payment confirmations and their no-warning observations were reported by the owner; the first payment's native signature actor/action was not observed. See the [judge guide](docs/submission/JUDGE-GUIDE.md) for exact hashes and verification boundaries.

## Hosting

Primary demo: **https://splitreceipt.axiqo.xyz/splitreceipt/**

Dedicated static Dogyun hosting. Verified HTTPS and a dedicated release directory with a `current` symlink. Only public `dist/` files uploaded; no backend, port, dependency or secret uploaded.

**Historical deployed application source (21–22 October):** `4dae47f01bb78126e5c70621d87af0c9899cb9c6`, release `20261021T192007Z-4dae47f`. Independent HTTPS/TLS, server-release and public asset readback matched four static files (652,054 bytes). [CI for this exact application commit](https://github.com/a252937166/splitreceipt/actions/runs/39660377061) passed installation, isolation, typecheck, tests and build; its GitHub Pages deployment is separate from the dedicated Dogyun release. Source checks recorded at that checkpoint were 76 TypeScript tests and 38 Solidity tests including 256 fuzz runs, completed on 21 October in Studio and independently locally (historical counts; the rebuild candidate's latest checks are recorded below). The Solidity 5042 cases use a local EVM, not mainnet.

A future documentation-only commit has its own repository SHA; it does not change the deployed application source SHA above unless the app is separately built, published and read back.

**Historical light/forest UI release (21 October 2026):** commit `003f005b4030f664dfb95f9ccc79205f14e92b27`, label `20261021T071846Z-003f005`. Six UI/design files were adopted as exact Studio-export bytes (ZIP SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14`). At that checkpoint, 360/390/768/1024px layouts and Bill 3's two receipts were verified.

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

This section describes the behavior of the 23 October rebuild candidate in this workspace. The public site runs the earlier deployed commit until a separate publication and readback.

Receipts are recovered from the chain every time a bill is opened. Nothing stored in the browser or carried in a link is trusted.

1. **Candidates.** A bundled list of public transaction hashes for known bills (testnet Bills 1 to 3 and mainnet Bill 1), any hashes saved from an earlier visit, and any in the `?receipts=` link parameter are treated only as candidates.
2. **Canonical block and event check.** Each candidate is verified against a fresh RPC: the live chain id equals the page network, the receipt is successful and not beyond the current head, its block hash equals the canonical block hash, and a `SharePaid` log from the exact contract matches the bill, payer and share amount.
3. **Transaction check.** The transaction must have been sent by the payer to the pinned contract, call `payShare` for this bill, and carry exactly the share as value.
4. **Search the history.** If a paid share still has no receipt, **Find missing receipts** scans `SharePaid` logs for the bill in pages of 5,000 blocks (12 pages per press), newest first, down to the reviewed deployment block (or a bounded recent window when a deployment's block is unknown). Candidates found this way go through the same checks.

`SharePaid` has no recipient field and `BillCreated` has no creator field. The recipient shown is the fixed recipient returned by `getBill`. A creator is shown only when a creation transaction is named in the link (or known for a public example bill) and its sender and calldata verify against the chain. Paid status is the `paidStates` list returned by `getBill`; the contract has no `paid()` method.

A pay or create request is made only after the app re-checks the chain, the contract's runtime hash, and a fresh `eth_chainId` and `eth_accounts` from the selected wallet. Any wallet or page change while those checks run cancels the request. The page never reconnects a wallet automatically.

A rejected, failed, cancelled or replaced transaction is never shown as a paid share: a payment counts only when the final transaction, its payment event and the bill's paid state all agree. If a transaction was sent but its result cannot be read yet, the app says it was sent and not yet verified, and does not resubmit anything.

On Arc Mainnet each write carries a cap of 40 gwei on the price per unit of gas and a priority fee of 0. That caps the price of gas, not the total fee. The **Copy bill link** button includes at most five freshly verified receipt hashes.

## Development and source history

The contract and original application were created in Arc Studio. Standalone dependency isolation, history pagination, wallet handling and public delivery refinements were made with local development tooling, then synchronized back to Studio. Later changes include both Studio-authored work and externally prepared inputs actually applied through Studio’s official manual terminal, followed by hash readback and independent verification. These steps do not erase the earlier mixed authorship.

The initial public deployment used the white/blue UI at revision `566a2f24d2faee88d441115d92127e01685058e9`. A 17 October UI pass refined five UI files locally for amount-summary consistency, narrow layouts, contrast, touch targets, dialog keyboard focus and network-switch feedback, then synchronized them back to Studio; that resynchronization was independently verified (see [provenance](docs/PROVENANCE.md)).

A later 18 October dark UI redesign used a local screenshot as a visual design reference only. Studio implemented the six dark UI files; subsequent Studio repairs corrected two misleading signature/permit labels, repaired mobile navigation at 390px, and restored the strict facts helper after an observed mismatch.

The earlier 21 October light/forest redesign was authored in Studio: all six UI/design files adopted from the Studio export as exact bytes (ZIP SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14`). A further Studio session applied five presentation corrections: narrow-viewport mobile nav (≤419px icon hide), bill totals CSS class (no break-all on amounts), Create bill preview visible on mobile, token aliases for the frozen wallet dialog, and correct dialog heading font override. This release was independently verified and published as `003f005b4030f664dfb95f9ccc79205f14e92b27`.

See [provenance](docs/PROVENANCE.md) for archive hashes and validation boundaries.
See [submission/EVIDENCE-INDEX.md](docs/submission/EVIDENCE-INDEX.md) for the full evidence map.

The 22 October private process record is a QA-checked **63-second, silent, 1080p** video assembled from 21 milestone screenshots with waits compressed. It is not continuous footage and contains no Studio editing or native wallet signing screens. No public video URL exists. A final film with real native continuous Studio and product footage, English narration and captions is being prepared; it does not exist as a public link yet, and the earlier sampled or silent edits are historical only. See [local asset status](docs/submission/LOCAL-ASSETS.md). The later mainnet deployment and walkthrough status are recorded separately in [current mainnet status](docs/MAINNET-LIVE.md).

The [official round page](https://dorahacks.io/hackathon/arc-microgrants-2/detail), rechecked on 22 October, requires Studio development and an app/contract moving USDC on Arc mainnet before submission. It excludes testnet-only projects. It displays **2026-11-01 23:59 under UTC−4**; do not silently substitute New York local time. Mixed development provenance still needs an organizer answer. The current materials are a preparation packet, not an eligible or submitted entry.

Original project code is available under the [MIT license](LICENSE). Dependencies retain their own licenses. This is an independent project and is not operated or endorsed by Circle.


## 23 October 2026: Studio replacement rebuild (candidate, not published)

**What this is.** A dated replacement record. The original Studio snapshot was restored (owner statement). The older externally prepared wallet, receipt and core code was removed or quarantined and was not copied back. The Studio AI then newly wrote the network and page-context layer, wallet session and menu, request-epoch and write guards, the final wallet-request boundary with a per-network fee policy, create and pay settlement, receipt history, recovery and proofs, the create and bill screens, and their tests, in one Arc Studio thread on the already installed dependencies. Seven original protected files are retained byte-for-byte (contract, contract test, `src/index.css`, `src/receiptDiscovery.ts`, `src/usdcFormat.ts`, `src/vite-env.d.ts`, `docs/DESIGN.md`; hashes in [the rebuild record](docs/STUDIO-REIMPLEMENTATION-2026-10-23.md)).

**Independent review.** Round 1 (an exported ZIP, SHA-256 `3032e2852df19fc12d2196eb048d998113c304e6667c032526cde7207c240afc`) reproduced nine defects after passing its own checks; round 2 found three residual variants within those same nine findings (not new independent findings). The nine findings, including those variants, were repaired in the same thread. No review of the final state is recorded.

**Latest checks, as observed at the end of this work** (candidate source in this workspace):

| Check | Result |
| --- | --- |
| Typecheck (`tsc --noEmit`) | exit 0, no errors |
| TypeScript tests (`node --import tsx --test tests/*.test.ts`) | 320 tests in 20 files, 320 pass, 0 fail |
| Solidity (`forge test --offline`) | 35 pass, 0 fail, including a 256-run fuzz test |
| Production build (`vite build`) | success, one chunk-size warning |
| Production bundle scan | no Studio trace, console-capture, preview-bridge or fetch/wallet patch markers; no `window.ethereum` reference |
| Dependency isolation | independent: 215 registry packages, 0 external filesystem links, 0 unused service SDKs |
| Protected files | 7 of 7 hashes match |

These replace, and do not erase, the earlier counts (16, 36, 67, 76 and 80 TypeScript tests; 35 and 38 Solidity tests), which belong to their own dated checkpoints and to the deployed commits.

**Not established.** The embedded Studio Preview was observed working by an independent operator (17:58–18:01 UTC, 23 October: create form, draft total and wallet chooser only; no wallet connection, signing or transaction); the earlier "Connecting to sandbox" failure is dated history in [the rebuild record](docs/STUDIO-REIMPLEMENTATION-2026-10-23.md). That observation does not cover bill pages, mobile widths, connecting or signing with a real wallet, or a public browser. DOM-level checks used a simulated DOM (jsdom) with fake wallets and emulated RPC; they are not a real browser, a real wallet or a mobile-layout measurement, and the remaining real-browser, real-wallet and public-browser QA is pending. The mainnet fee setting caps the price per unit of gas; it is not a limit on the total fee. Product acceptance and any publication are to be done independently from the exported exact bytes; publication and public readback are a separate future gate. Nothing here claims that this candidate is published, uploaded, formally submitted or approved.

**Mainnet evidence is unchanged.** Arc Mainnet Bill 1 at `0x8522Ea5A413c8402182fF6998Bd7471bAC886142` is settled 2/2 with two verified receipts. Both payers are owner-controlled demonstration accounts. The contract accepted 0.002 USDC in gross shares; the net transfer between the two wallets was 0.001 USDC. Historical deployment and demonstration Gas totalled 0.02263094 USDC. No new mainnet transaction or deployment was made during this rebuild or its recording. Details: [current mainnet status](docs/MAINNET-LIVE.md).

## Mainnet status and history

**Current:** Arc Mainnet (`5042`) is a separate page context (`?network=mainnet`). The only mainnet contract accepted is the reviewed deployment `0x8522Ea5A413c8402182fF6998Bd7471bAC886142` (block `27419618`, runtime hash `0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b`). Mainnet uses real USDC for payments and for gas; the app shows a notice, labels the buttons accordingly, and only asks your own wallet to sign. Existing Bill 1 can be read and its receipts verified without a wallet. See [current mainnet status](docs/MAINNET-LIVE.md).

**Historical (21 October):** an earlier checkpoint kept a blank mainnet address and a compiled `MAINNET_WRITES_ENABLED = false` lock, before the contract was deployed. That lock and the statements about an undeployed mainnet in [mainnet preparation](docs/MAINNET-PREPARATION.md) describe that checkpoint only; the current build has no such flag, and the pinned runtime hash plus a fresh wallet check guard writes instead. The 21 October counts (67 and 76 TypeScript tests) also belong to that checkpoint, which mixed Studio work with externally prepared inputs; see [provenance](docs/PROVENANCE.md).

No competition submission or eligibility is claimed by this README.
