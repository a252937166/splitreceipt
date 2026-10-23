# Source and deployment provenance

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

## Origin

The original SplitReceipt application and Solidity contract were generated and iterated in this [Arc Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Studio was used for application preview, contract authoring and testing. The initial Studio deployment path could not initiate a transaction because of its deployment policy limit.

An independent local deployment then used a fresh test-only wallet and the public Arc Testnet RPC. This produced the contract and example bill recorded in [arc-testnet.json](../deployments/arc-testnet.json). The recorded example has two `0.001` test-USDC payments. No mainnet wallet, mainnet API key or real USDC was used for that testnet run.

This standalone repository preserves the Studio-origin contract and application while adding locally developed dependency isolation, receipt-history pagination, wallet handling, verification and static publication. The dated records below distinguish downloaded Studio archives from later exact terminal exports and per-file hash readback. They establish correspondence for those stages, not exclusive Studio authorship or organizer acceptance.

## Historical helper mismatches (17–early 21 October)

This subsection describes the helper used before the later network-context adaptation. Its 1,080-byte hash is historical, not the current helper to restore. The intentionally adapted helper in the published application has SHA-256 `146a498c2fe00b4ec3d4fb1dc4b5a7732fb76d079c0d6fcb2e44b1604426483f`.

On multiple occasions, after a later Studio task began, `src/onchain-facts.ts` was found with different bytes (hash `c7c314ada2f6be684dcd24c703fee3fec68f8bc0a2c7c9d1bcf3633c33199abd`, 16,223 bytes) than the canonical strict version (SHA-256 `b4c45994e26e377923c5f54e706709449435af051ce89f493027f111cdf2f070`, 1,080 bytes). On the same occasions, `src/onchain-money.ts` and `src/onchain-wait.ts` were found present after having been deleted. The cause and triggering mechanism are not established. The canonical `onchain-facts.ts` was restored by explicit write and verified by hash after each observation. Those historical readbacks checked the helper and two removed files. Future readbacks must compare against the correct approved revision, rather than blindly restoring an earlier helper.

## Final Studio source readback (17 October, initial UI)

On 2026-10-17, a fresh **Download Code** ZIP from Studio was saved and independently compared with the canonical working tree. The public [source-readback evidence](../tests/evidence/studio-source-readback-2026-10-17.json) records 22 synchronized paths: **20 were byte-identical**, including all synchronized application source and tests. The contract bytes also matched the canonical original Studio-authored contract.

Two files have the documented Studio sandbox adaptations: `package.json` changes the development host to `0.0.0.0`; `vite.config.ts` uses that development host and adds `allowedHosts: true`. The canonical project retains `127.0.0.1`. These are the only differences among the 22 compared paths.

Archive SHA-256: `46e458e3125421abd5144b409c75e40dfb8aee7a98d284c57fc6582e673ccd69`. The ZIP is retained privately outside Git.

The Studio UI reported zero TypeScript errors, 16 passing tests and a successful build. A real Preview refresh was observed with the testnet banner, public demo link and UTF-8 title-byte counter visible.

## UI refinement and exact resynchronization (17 October, UI sync)

A later 17 October UI pass used generated desktop/mobile design references in the same Studio project. The references were concepts, not live application or transaction screenshots. Five UI files were reviewed and refined locally for amount-summary consistency, narrow layouts, contrast, touch targets, dialog keyboard focus and network-switch pending/error feedback, then synchronized back to Studio.

A new [independent source readback](../tests/evidence/studio-ui-source-readback-2026-10-17.json) verifies five UI files plus the restored strict Arc Testnet facts helper byte-for-byte (six paths total). Eleven protected public-source paths matched; Studio package/Vite host adaptations matched the earlier Studio export. Two unused generated network helpers were removed. No contract, application chain, test or dependency change was adopted.

Final archive SHA-256: `336844d1c6cd173e827858ceb47e4cdeeb3601e44e4f6580b1ea91158e32a886`, 3,541,106 bytes. The archive remains private. Both actual desktop and mobile Studio Previews were observed during the 17 October UI sync. Typecheck, 16 frontend tests, build and local dependency isolation passed.

## Dark UI redesign (18 October)

A dark workspace UI was implemented in Studio using a local screenshot as a visual design reference only. The screenshot is a local reference draft; it was not a prior Studio screenshot or transaction evidence. Studio implemented the six dark UI files (`src/index.css`, `src/App.tsx`, `src/components/CreateBill.tsx`, `src/components/BillDetails.tsx`, `src/wallet-ui.tsx`, and new `src/components/WalletChecks.tsx`). Subsequent Studio repairs addressed:

- Two misleading "Permit or signature required: No — only a single transaction" labels corrected to: "No — wallet transaction confirmation is required; no permit or message signature"
- Mobile navigation repaired to expose all three nav links at 390px viewport width
- `src/onchain-facts.ts` restored to canonical 1,080-byte content after an observed mismatch; cause unknown

Studio repairs reported: typecheck clean, 16/16 tests pass, production build success, Preview HTTP 200. An earlier dark desktop embedded Preview was observed during this work. HTTP 200 from `curl` is not final browser-proof; final Studio mobile Preview was not validated. At that dark-design checkpoint the candidate still required fresh ZIP readback, an independent build and live-release verification; that statement is not the status of the later published light/forest release.

The INITIAL/HISTORICAL dedicated release checkpoint (`20261018T080938Z-dd5013b`) used the white/blue UI. As of the 18 October checkpoint, no later publication had been verified.

**Future source/UI/docs changes must happen in Studio, followed by export, independent verification, build and publication.**

## Historical light/forest UI release (21 October, 07:18 label)

The earlier `003f005` release reflected a full light/forest UI redesign authored in Arc Studio across two Studio sessions:

**Session 1 (design):** Arc Studio authored all six UI/design files (`src/index.css`, `src/App.tsx`, `src/components/CreateBill.tsx`, `src/components/BillDetails.tsx`, `src/components/WalletChecks.tsx`, `docs/DESIGN.md`). The visual reference was a screenshot from the owner's own local ReCart project, used as a layout/workflow reference only — no shared code, dependencies or data. The six files were exported and adopted as exact bytes by independent verification.

**Session 2 (presentation corrections):** Five targeted CSS/JSX corrections were applied in Studio: narrow-viewport mobile nav icon hide at ≤419px; bill totals named CSS class replacing `break-all` with `overflow-wrap: anywhere`; Create bill receipt preview always visible (no `hidden lg:block`); CSS token aliases `--muted` and `--surface-raised` required by frozen `wallet-ui.tsx`; `section[role="dialog"] h2` font override to cover the frozen wallet dialog's inline serif style. `docs/DESIGN.md` contrast ratios, breakpoints, touch targets and wallet dialog typography notes were corrected. All non-UI files (contract, tests, helpers, receipt logic, config, packages) were unchanged.

The final ZIP SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14` covers the output of both sessions as independently verified before publication.

At the start of one or more Studio sessions, `src/onchain-facts.ts` was found with different bytes (the 16,223-byte generated version, hash `c7c314a…`) rather than the canonical strict version. The cause and triggering mechanism are not established. On each occasion, the canonical 1,080-byte version was restored by explicit write in Studio and hash-verified before the session's work was finalised. `src/onchain-money.ts` and `src/onchain-wait.ts` were also found present after having been deleted on the same occasions; cause unconfirmed. See Observed helper mismatches above.

Independent verification of the 21 October release: typecheck clean, 36/36 frontend tests pass, production build success, dependency isolation passed; desktop/mobile layouts at 360/390/768/1024px verified via local QA; live browser on 21 October 2026 returned Bill 3 Settled 2/2, 2/2 freshly verified receipts. Release published as commit `003f005b4030f664dfb95f9ccc79205f14e92b27`, label `20261021T071846Z-003f005`.

**Future source/UI/docs changes must happen in Studio, followed by export, independent verification, build and publication.**

## Bill 3 provenance

Bill 3 was created and settled on Arc Testnet 5042002 at contract `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`. Title: Published UI retest - testnet. Recipient: `0x7c50fF360EE4Ee53097ADFb6D0a464c2E9F77336`. Payers (ordered): `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74` and `0x92F6772880Bc6FFe9F8112E5F202bB7eC5428B6e`. Each share: 0.001 native test USDC, total 0.002.

- Create: tx `0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7`, block 67806955, gas 0.00422905 test USDC
- Pay 1: tx `0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4`, block 67809882, gas 0.0017118 test USDC
- Pay 2: tx `0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9`, block 67810029, gas 0.001771625 test USDC

Independent read-only public RPC verification at 2026-10-18 08:16:19 UTC (head 67810050) confirmed 2/2 paid, both SharePaid receipt events, total principal 0.002 and gas 0.007712475 test USDC. Browser refreshed to settled 2/2 on dedicated domain anonymously. Creation and first payment used MetaMask; both signatures occurred off-camera. Second payment used a disposable test-account helper, not MetaMask. Chain success does not prove wallet software or continuous signing footage.

## Build boundary

The historical deployment used Solidity `0.8.28+commit.7893614a`, Paris EVM and the optimizer with 200 runs. Its runtime-code hash and source hashes are recorded in the deployment manifest. The OpenZeppelin `ReentrancyGuard.sol` bytes were checked against the official `@openzeppelin/contracts@5.1.0` package.

Local directory names and source paths affect Solidity metadata, so recompilation is not claimed to produce byte-for-byte identical historical deployment bytecode. `npm run chain:check` verifies the recorded deployed runtime and transaction evidence separately from a fresh source build.

## Recordings and scope

Build and testnet walkthrough recordings are retained locally, outside the public source tree. They have not been uploaded. The recordings document the actual captured browser sequence; a public recording URL or a continuous recording from an empty project is not claimed. Recordings are local/private, sampled actual screenshots with real gaps compressed, not continuous.

**Historical statement, as of the 22 October checkpoint:** public transaction functionality was restricted to Arc Testnet and a disabled mainnet preparation view did not constitute a deployment; no mainnet deployment, mainnet payment or competition submission had been completed. That was superseded on 23 October by the verified mainnet deployment and Bill 1 recorded in [MAINNET-LIVE.md](MAINNET-LIVE.md); no competition submission has been completed. The official round page, rechecked on 22 October, excludes testnet-only projects and requires Studio development plus mainnet operation before submission. Acceptance of this mixed development history remains unconfirmed.

## Licensing and attribution

The original contract carries an MIT SPDX identifier. The repository's original application code and documentation are distributed under [LICENSE](../LICENSE). Vendored and installed dependencies retain their own notices and licenses.

Arc Studio and Circle are acknowledged as development tools and network providers. This application is an independent project; no Circle approval or endorsement is claimed.


## Mainnet preparation actually applied in Studio (21 October)

Codex prepared source inputs outside Studio. The project files were then actually written through Arc Studio's official manual terminal without a paid upgrade, while the Studio agent quota was observed at 99%. This records the editing mechanism; it does not claim that Studio AI generated those inputs or that later application cures external authorship under the rules.

A Download Code archive was observed to contain an older agent snapshot. The accepted preparation instead used exact terminal export SHA-256 `28f93fdd46c74e23566a926daf4f639294249008d7f1237f43ebdae1aea43454`; its 25 source/document files were copied byte-for-byte and protected contract/build dependency bytes remained unchanged. The separate documentation readback and the later wallet readback are different records, not additional full-source ZIPs.

Studio and independent local checks passed typecheck, 67 TypeScript tests, 38 Solidity tests, 256 fuzz runs, build, dependency isolation and offline unsigned-bundle generation. Local browser QA confirmed disabled mainnet preview, wrong-context recovery and historical testnet Bill 3's two receipts. Live wallet signing was not retested **at that preparation checkpoint**; an external injected-extension `Cannot redefine property: ethereum` error was observed then. See [the dated preparation evidence](../tests/evidence/mainnet-preparation-2026-10-21.json). Tests using `vm.chainId(5042)` and `vm.deal` run entirely on a local EVM; they are not mainnet or fork execution.

At that 21 October checkpoint the prepared mainnet context had no contract address, and `MAINNET_WRITES_ENABLED = false` was a source lock (historical; see [MAINNET-LIVE.md](MAINNET-LIVE.md)). The unsigned deployment draft remains `UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW`. The tool records pinned source/dependency/compiler settings and the actual new artifact/creation/runtime hashes. Its `historicalRuntimeExactMatch: false` is disclosed; the historical testnet runtime is not a reviewed hash for a fresh artifact. Independent review and fresh fee estimation remain future gates.

## Explicit wallet selection and current public application (21–22 October)

A subsequent 11-file source/test refinement removed the targetless legacy-injection connector, selected named EIP-6963 providers, disabled automatic reconnect on reload and gated transactions on the explicitly acknowledged live connector/account/chain session. Active provider events and A→B→A changes invalidate old selections and pending actions. This app behavior does not repair code inside Phantom, MetaMask or another extension.

These inputs were prepared with Codex outside Studio, actually applied through the official Studio manual terminal, and tested there. Actual Studio per-file SHA readback matched the sealed inputs before identical bytes were adopted locally. This is **11-file hash adoption**, not a new complete Studio source ZIP. Typecheck, **76 TypeScript tests**, build and dependency isolation passed in Studio and independently locally on 21 October; the 38 Solidity tests and 256 fuzz runs were separately completed during that day's preparation.

The deployed application source is `4dae47f01bb78126e5c70621d87af0c9899cb9c6`, release `20261021T192007Z-4dae47f`. Exact [CI](https://github.com/a252937166/splitreceipt/actions/runs/39660377061) succeeded; independent dedicated-host asset/TLS/readback matched four public files, 652,054 bytes. Hosting is external to Studio. A future documentation-only repository commit is distinct from this deployed application source commit.

On 22 October the public app completed [Bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6) creation and two payments of 0.001 test USDC. Independent canonical chain readback confirmed the configured runtime, successful transactions, exact bill fields/payment events and `[true, true]` paid states. Public UI showed 2/2 paid and 2/2 verified receipts; app Disconnect plus reload in the same browser profile retained the receipts and showed Connect wallet. This is not clean-profile or empty-cache proof. Historical Bills 3 and 5 also displayed both receipts on the new release. See [the sanitized public-flow evidence](../tests/evidence/public-wallet-flow-2026-10-22.json).

The owner reported personally confirming creation and the second payment with no security warning. The first payment's native signature actor/action and warning state were not observed, so chain success is not assigned to an observed browser signature. No native wallet screens were captured. The captured console sample had no error-level messages but retained MetaMask listener/orphan-stream warnings.

## Latest process record and contest boundary (22 October)

A private 63-second silent 1920×1080/30fps video was assembled from 21 manually captured public-page milestone screenshots, with waits compressed. All original and decoded samples, full decode, timing, privacy and source immutability checks passed. Video SHA-256: `144b70d5cb3d072a9710ce2de0f6ee9dd0e63ddfe6487c32e14b9142ae4601a4`. The segment has no Studio editor/terminal/source editing or native wallet screens; its filename is not evidence of Studio AI generation. No upload or public final-video URL exists. See [asset status](submission/LOCAL-ASSETS.md).

The original Studio work, early local refinements, Studio-authored UI, Codex-prepared terminal inputs, exports, independent tests and external hosting are distinct steps. The [official rules](https://dorahacks.io/hackathon/arc-microgrants-2/detail) require Studio provenance across contract, tests and app, and exclude externally built and testnet-only projects. They do not specify an allowed external percentage or a retroactive import exception. Mixed-history eligibility and reviewer access to the Studio project remain unresolved; no organizer acceptance is claimed. The current submission packet is draft material, not proof that its future Studio application or a contest submission has occurred.

## Latest checkpoint (23 October 2026, ~18:31–18:43 UTC): accepted, committed and published

*Verified about 18:31–18:43 UTC. Everything marked "independent" below is reported by the independent browser, build and release operator; the Studio agent did not run remote acceptance, did not publish, and is only recording these reports.*

Where earlier passages below say the candidate is "not published", that independent acceptance or public-browser acceptance is "pending", or that the embedded Preview is "unconfirmed", this checkpoint supersedes **only those gates**; those passages are kept as dated earlier checkpoints. It does not supersede the open gates listed at the end of this checkpoint, and it does not rewrite the mixed development history.

- **Accepted source (independent).** Final exact Studio ZIP SHA-256 `1385756b481772ab1c8ca81a43ab29d35672c5291658b0ab36b5d5bc986890a5`. Independent clean-source acceptance **PASS**: 320 TypeScript tests, typecheck, production build and dependency isolation; 35 Forge contract tests reusing the exactly unchanged contract, contract test and compiler inputs. Real installed-viem checks of the final-send boundary with **mocked providers** passed all 20 scenarios (including account and page A→B→A, unmount and newer actions); those are mocked requests, not actual wallet signatures. The final source map has 186 files, SHA-256 `83c0a6bed028f0deb1968fe642d6ba7e5158a25b4d90dbaabe0021af08d31b44`: 113 files selected from the actual Studio ZIP plus 73 hash-identical baseline files retained. The seven protected-file hashes are unchanged.
- **Public Git (independent).** That accepted app source is public commit [`b2af1246ac952aca7eadacd71d5679dc440c0254`](https://github.com/a252937166/splitreceipt/commit/b2af1246ac952aca7eadacd71d5679dc440c0254). The root checks-only CI for that exact commit [succeeded](https://github.com/a252937166/splitreceipt/actions/runs/40005567874).
- **Published release (independent).** Static release `20261023T182638Z-83c0a6bed028` is active at https://splitreceipt.axiqo.xyz/splitreceipt/. Sealed manifest SHA-256 `97314eb9ae6bf88404f572c6fdbee1ae8a901167ebbc77e9864ab5f244c3644f`; the four public HTTPS files matched the accepted independent build and the remote staging by size and SHA-256. `/splitreceipt` returns 308; an unknown route and an unknown asset return 404. The sealed pre-Git manifest is not rewritten: its `sourceCommit` remains null, and the later Git commit binds the exact source map. Later documentation-only changes do not change this app release or its source binding.
- **Public-browser acceptance (independent) PASS.** Anonymous Mainnet Bill 1, fresh load: Settled 2/2, creator verified, two canonical payment transaction links, "Nothing to pay" disabled. At 375px: page `scrollWidth` 375, wallet trigger right edge 359, dialog left 39 / right 359 / width 320. Installed wallets listed: Phantom, OKX Wallet, MetaMask, SubWallet. Tab focused Phantom; Escape closed the dialog and restored Connect wallet. A wrong Mainnet-contract URL (the original Testnet contract in a Mainnet link) was refused with no wallet request and the generic footer without network-specific claims. Clicking the Pay 2 receipt opened the live explorer showing Success, `payShare`, value 0.001 USDC and the contract-forwarded 0.001 USDC.
- **Not done in that regression.** No actual new wallet connection or signature was made, so none is claimed; this is not a blanket security certification.
- **Studio-side checks (the agent, in this workspace, earlier on 23 October).** `tsc` exit 0; 320 TypeScript tests pass; `forge test --offline` 35 pass; production build succeeded with no instrumentation markers in `dist/`; dependency isolation independent; protected hashes 7 of 7. jsdom scripts with fake wallets were manual and partial. These are separate from, and weaker than, the independent checks above.
- **Mainnet and spending.** No new Mainnet transaction, deployment or payment was made during this rebuild, publication or recording, and no paid service or upgrade was purchased. The historical owner-operated two-account Bill 1 is unchanged: gross shares 0.002 USDC, net inter-wallet transfer 0.001 USDC, total historical Gas 0.02263094 USDC ([MAINNET-LIVE.md](MAINNET-LIVE.md)).
- **Media.** Genuine native continuous footage of Studio repair, Preview, tests and export, and of the newly published product and explorer operations, has been recorded and retained. English narration, burned English subtitles and a Chinese SRT are being assembled and independently QA-checked as a separate local task. **There is no public final video URL**; video publication is a separate pending gate. The earlier slideshow and silent edits stay historical.
- **Still open (separate gates, none completed).** Formal contest submission; acceptance of the activity agreement; public video upload and playback check; reviewer access to the Studio project; and organizer acceptance of the mixed development history. The [official rules page](https://dorahacks.io/hackathon/arc-microgrants-2/detail) requires the video to show the Studio build and a mainnet transaction, and states no duration, format, platform or language mandate.

The provenance statements in the next section and in every section above are unchanged history. This checkpoint establishes source correspondence and publication of the accepted bytes; it does not rewrite the mixed development history (Studio-authored work plus externally prepared inputs applied through Studio) and does not show organizer acceptance of it.

## Studio replacement rebuild (23 October 2026)

*Earlier checkpoint (candidate, not yet published when written); superseded only on the publication, independent-acceptance and public-browser gates by the checkpoint above.*

This is a dated addition. Every earlier section above keeps describing its own checkpoint and is not rewritten.

**Starting point and removal.** The owner restored the original Studio snapshot before this work (owner statement; a ten-file restore readback was present in the sandbox when the thread began). The older externally prepared wallet, receipt and core code, including the work described in the 21–22 October sections above, was removed or quarantined by the owner and operator. None of that removed or quarantined code was copied back.

**Reimplementation by the Studio AI.** In a single Arc Studio thread, on the already installed dependencies, the Studio AI newly wrote the network and page-context layer, the wallet session and named-wallet menu (no targetless injected fallback, no automatic reconnect), the request-epoch and write guards, the final wallet-request boundary with a per-network fee policy, create and pay settlement, the receipt history, recovery and proof layers, the create and bill screens, the header and footer, and their tests. The exact file lists, hashes and checks are in [the rebuild record](STUDIO-REIMPLEMENTATION-2026-10-23.md). Studio's own preview instrumentation files were left on disk and are loaded only in development inside the Studio preview frame; the production build contains none of it (marker scan: no matches).

**Seven original protected files retained** byte-for-byte: `contracts/SplitReceipt.sol` (`df06d8d0…04c2`), `contracts/test/SplitReceipt.t.sol` (`486e9b0d…5440`), `src/index.css` (`ee46f490…fc0d`), `src/receiptDiscovery.ts` (`fb8a9716…b923`), `src/usdcFormat.ts` (`ec0bf644…1cb9`), `src/vite-env.d.ts` (`65996936…ddb5`) and `docs/DESIGN.md` (`b06026e1…c05a`). The full hashes were checked at the end of the final round and match.

**Independent review and repair rounds (as reported by the owner).** Round 1 reviewed an exported ZIP (SHA-256 `3032e2852df19fc12d2196eb048d998113c304e6667c032526cde7207c240afc`) that had passed typecheck, 195 TypeScript tests, the build and 35 Forge tests, and reproduced nine defects; they were repaired. Round 2 reviewed the repaired export, confirmed 308 tests, the build and the final-send guard with the Mainnet fee setting, and reported three residual variants within those same nine findings (not new independent findings); they were repaired. Round 2's export hash is not recorded here. No review of the final state is recorded.

**Latest checks as observed** (candidate source, end of this work): typecheck exit 0; 320 TypeScript tests in 20 files, all passing; `forge test --offline` 35 passing including a 256-run fuzz test; production build success; dependency isolation independent (215 registry packages, 0 external links); protected hashes 7 of 7. These do not replace the dated counts above.

**What this does not establish.** It does not rewrite the mixed history of the project, which still combines Studio-authored work with externally prepared inputs; it does not show that the organizer accepts that history; it is not a security audit; and it is not a publication. The candidate has not been deployed, pushed, uploaded, formally submitted or approved. The earlier "Connecting to sandbox" failure of the embedded Studio Preview is dated history; later, an independent browser operator opened the official full Studio Preview pane on 23 October (17:58–18:01 UTC), filled the create form (title, recipient, two payers, share 0.001, draft total 0.002) and opened the wallet chooser (Phantom, OKX and MetaMask listed; Tab focused an option; Escape closed it and restored focus to the trigger), with no wallet connection, signature or transaction (independent operator's observation; the agent did not reproduce it). Public-browser, real-wallet and mobile QA remain pending. Acceptance and any publication are done independently from the exported exact bytes, and publication with public readback is a separate future gate. No new mainnet transaction or deployment was made during this rebuild or its recording. The existing mainnet evidence (Bill 1, settled 2/2, two receipts, both payers owner demonstration accounts, 0.002 USDC gross shares, 0.001 USDC net inter-wallet transfer, 0.02263094 USDC total historical deployment and demonstration Gas) is in [MAINNET-LIVE.md](MAINNET-LIVE.md).
