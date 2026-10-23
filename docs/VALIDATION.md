# Validation record

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

This record distinguishes deterministic tests, mined chain evidence, local browser observations and public-site verification. The proof files below accompany this record; deployment results for individual source revisions are available in the [Actions history](https://github.com/a252937166/splitreceipt/actions/workflows/pages.yml).

## Latest checkpoint (23 October 2026, ~18:31–18:43 UTC): independent acceptance and published release

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

## Replacement-rebuild candidate: latest checks (23 October 2026) — earlier checkpoint

*Written before the checkpoint above; its "not published", "unconfirmed" and "pending" statements are superseded only on the publication, independent-acceptance and public-browser gates. The Studio-side numbers in its table remain accurate for the checks the agent ran.*

This section is added; every dated section below it keeps its own counts and boundaries. It covers the **candidate source in the Studio workspace**, not the deployed public release (application commit `00658175885a03f1fd49d61c56a2ce3ff2f86b82`, whose 80 TypeScript tests belong to that commit). The candidate has not been published, uploaded, formally submitted or approved. Context: the original Studio snapshot was restored, the older externally prepared wallet, receipt and core code was removed or quarantined, and the Studio AI reimplemented it in one thread with two independent review and repair rounds; see [the rebuild record](STUDIO-REIMPLEMENTATION-2026-10-23.md) and [provenance](PROVENANCE.md).

| Check | Observed result at the end of this work | Boundary |
| --- | --- | --- |
| Typecheck | `tsc --noEmit` exit 0, no errors | Candidate source |
| TypeScript tests | 320 tests in 20 files; 320 pass, 0 fail | Includes the regression suites for the final wallet-request boundary, Mainnet and Testnet fee fields, settlement and replacement outcomes, receipt recovery and proofs, the submission lock, epochs and write guards. Fake providers and mocked chains only |
| Solidity | `forge test --offline`: 35 pass, 0 fail, including a 256-run fuzz test | Local EVM; contract unchanged |
| Production build | `vite build` success; one chunk-size warning | |
| Production bundle scan | Zero matches for Studio trace, console-capture, preview-bridge and preview-host markers and for fetch/wallet patching; no `window.ethereum` reference | Generic library `postMessage` uses are not instrumentation |
| Dependency isolation | Independent: 215 registry packages, 0 external filesystem links, 0 unused service SDKs | |
| Clean-source reproducibility | The suite also ran in a copy without `contracts/contract-metadata`, `contracts/out`, `dist`, `.env` and `.git`: 320 tests pass, with the ABI-parity test reading a committed ABI-only compiler fixture (see the rebuild record) | Added after an independent clean-source/CI check found an `ENOENT` on the generated Studio metadata |
| Protected files | 7 of 7 SHA-256 values match the owner's list | Contract, contract test, `src/index.css`, `src/receiptDiscovery.ts`, `src/usdcFormat.ts`, `src/vite-env.d.ts`, `docs/DESIGN.md` |
| DOM-level scripts (jsdom, fake wallet, emulated RPC) | Submission-lock and last-page-retry script: 26 of 26 assertions pass. Earlier scripts (wallet guard 32 of 32, payment outcomes 13 of 13) passed in the previous round and were not re-run after the final edits | Manual scripts; jsdom is not a project dependency |
| Mutation checks | Removing the final-boundary guard fails 28 wallet-send tests; reverting the scanner or the round-2 fixes fails the recovery tests; disabling the lock check makes the jsdom script send a second request | Shows the regressions are sensitive |

**Browser observation (independent operator, 23 October, 17:58–18:01 UTC).** After the earlier "Connecting to sandbox" failure (dated history, see the rebuild record), the official full Studio Preview pane loaded and the operator used the real app: title, recipient, two payer addresses and a share of 0.001 gave a draft total of 0.002; the wallet chooser opened listing Phantom, OKX and MetaMask; Tab focused an option; Escape closed it and restored focus to the trigger. No wallet was connected and nothing was signed or sent. The operator reports native continuous recordings (phases 7 and 8) preserve this; the agent has not reproduced or reviewed them. **Not verified.** Bill pages, wrong-context links, mobile layout measurement (375 or 390px), connecting or signing with a real wallet, a screen reader and any public browser were not covered. Server rendering, HTTP 200 and jsdom are not browser tests. Replacement detection was tested through a fake wait function, not a real replaced transaction. The Mainnet fee setting (40 gwei maximum fee per gas, zero priority) caps a price, not the total fee. No wallet request, signature, deployment, push, paid service or new mainnet transaction was made. Product acceptance and any publication are done independently from the exported exact bytes; publication and public readback remain a separate future gate.

## Deployed public release and wallet-flow verification (21–22 October 2026; historical checkpoint)

Application source `4dae47f01bb78126e5c70621d87af0c9899cb9c6`, dedicated-host release `20261021T192007Z-4dae47f`. Independent server-release, HTTPS/TLS, redirects and public asset readback matched four static files (652,054 bytes). [Exact application-commit CI](https://github.com/a252937166/splitreceipt/actions/runs/39660377061) passed install, dependency isolation, typecheck, tests and build. A future documentation-only commit is distinct from that deployed application source.

| Check | Observed result | Boundary |
| --- | --- | --- |
| Studio source adoption | Latest 11 wallet source/test files matched actual Studio SHA readback and identical sealed inputs | Official manual-terminal application of Codex-prepared inputs; not a new full ZIP or all-Studio-AI claim |
| TypeScript / build / isolation | 76 tests, typecheck, build and isolation passed in Studio and independently locally on 21 October | Current recorded source suite, not a new 22 October run |
| Solidity preparation | 38 tests and 256 fuzz runs passed in Studio and locally on 21 October | Local EVM; chain-5042 tests are not mainnet/fork execution |
| Wallet policy | Named discovered providers, no targetless legacy slot or automatic reconnect; explicit session and stale-action guards covered by actual wagmi/core tests | Does not repair external extension code |
| Public Bill 6 | Created, payer 1 paid, then payer 2 paid: 2/2 paid and 2/2 receipts verified | 22 October public app; two owner-controlled demo accounts |
| Canonical chain proof | Runtime, successful transaction/receipt status, sender/target/call data/value, block hashes and matching bill/payment events checked | Independent read-only chain proof, not browser-signature footage |
| Disconnect / reload | Same profile remained disconnected and displayed both verified receipts | Storage/cache not cleared; not a new anonymous profile |
| Historical regressions | Bills 3 and 5 displayed 2/2 verified receipts on the new release | Not new Bill 6 transactions |
| Security-warning observations | Owner reported no warning for creation and payment 2 | No native wallet capture; payment 1 signature/actor and warning not observed |
| Console sample | No error-level entries; MetaMask listener/orphan-stream warnings remained | Not complete extension repair or blanket domain safety proof |
| Process video | 63 seconds, 21 milestone screenshots, silent, 1080p/30fps; source/decoded/full-decode/privacy/timing QA passed | Noncontinuous, waits compressed, no Studio editing/native signing; private and not uploaded |

[Sanitized Bill 6 evidence](../tests/evidence/public-wallet-flow-2026-10-22.json) records all three exact transaction hashes, amounts, blocks, fees and observation limits. Total principal was 0.002 test USDC, gas 0.007650575 test USDC. Test tokens have no monetary value. The app's **Use this wallet** acknowledgement is not a wallet signature. The creator hash is derived from chain/scenario proof, not a fully visible hash in the saved creation-page screenshot.

**Historical statement, as of 22 October:** the mainnet context was unconfigured with writes locked, and no mainnet deployment/payment, paid upgrade, public final-video URL or completed competition submission was established. The 23 October mainnet deployment and Bill 1 supersede the mainnet part; see [MAINNET-LIVE.md](MAINNET-LIVE.md). No public final-video URL or completed competition submission is established. [Readiness](submission/READINESS.md) tracks rule/provenance/form gaps.

## Historical records below

Each dated subsection describes its own revision and observation window. Older source hashes, counts, auto-restored connections and “not yet retested” boundaries do not replace the current record above.

## Standalone checks (17 October 2026)

| Check | Result |
| --- | --- |
| Frozen clean install | Passed in a fresh temporary source copy without node_modules, with an initially empty npm cache; Node 22.23.1, npm 10.9.8; frozen npm ci with lifecycle scripts disabled |
| Type checking | npm run typecheck passed in the clean copy and canonical project |
| Frontend tests | npm test: 16/16 passed: history 8, creation receipts 5, integer amounts 3 |
| Production build | Passed in the clean copy and canonical project |
| Solidity | 35/35 passed, including 256 fuzz runs; Solidity 0.8.28, Paris, optimizer 200 |
| Isolation | 215 integrity-pinned registry packages, zero external filesystem links and zero unused service SDKs |
| Chain check | Read-only verification of chain 5042002, runtime/source hashes and settled bill 1 at head 67666905 |
| Pages CI | [Run 39031619289](https://github.com/a252937166/splitreceipt/actions/runs/39031619289) succeeded for `566a2f24d2faee88d441115d92127e01685058e9` |

Local engineering reports and logs are retained outside tracked application artifacts.

## Studio persistence and preview (17 October 2026)

A new Studio Download Code archive was saved and independently inspected. The [sanitized source proof](../tests/evidence/studio-source-readback-2026-10-17.json) records 22 synchronized paths, with 20 byte-identical to the canonical working tree. Contract bytes matched. Only the development host adaptations in package.json and vite.config.ts differ.

Private ZIP SHA-256: `46e458e3125421abd5144b409c75e40dfb8aee7a98d284c57fc6582e673ccd69`. Studio reported TypeScript zero errors, 16 passing tests and a successful build. Its actual refreshed Preview displayed the testnet banner, public demo link and UTF-8 title-byte counter.

## UI source sync readback (17 October 2026)

The [UI source readback](../tests/evidence/studio-ui-source-readback-2026-10-17.json) verifies five UI files plus the strict Arc Testnet facts helper byte-for-byte (six paths total) after local refinement and Studio resynchronization. Final archive SHA-256: `336844d1c6cd173e827858ceb47e4cdeeb3601e44e4f6580b1ea91158e32a886`, 3,541,106 bytes. Both desktop and mobile Studio Previews were observed during this 17 October UI sync. Typecheck, 16 frontend tests, build and local dependency isolation passed.

## Dark UI Studio repairs (18 October 2026)

Studio repairs were applied to the dark UI: signature/permit wording corrected in two WalletChecks locations; mobile nav repaired for 390px; `src/onchain-facts.ts` restored to canonical content after an observed mismatch (cause unknown). Studio reported: typecheck clean, 16/16 tests pass, production build success, Preview HTTP 200. An earlier dark desktop embedded Preview was observed during this work. HTTP 200 from `curl` is not final browser-proof; final Studio mobile Preview was not validated.

The INITIAL/HISTORICAL dedicated release checkpoint (`20261018T080938Z-dd5013b`) used the white/blue UI.

## Historical light/forest UI release and presentation corrections (21 October 2026, 003f005)

The earlier `003f005` app release reflected the light/forest redesign authored in Arc Studio. Six UI/design files were adopted from the Studio export as exact bytes. A second Studio session applied five targeted presentation fixes: narrow-viewport mobile nav (≤419px icon hide), bill totals CSS class replacing `break-all` with `overflow-wrap: anywhere`, Create bill receipt preview visible on all screen widths, CSS token aliases (`--muted`, `--surface-raised`) required by the frozen wallet dialog, and a correct `section[role="dialog"] h2` font override.

| Check | Result | Source |
|---|---|---|
| Typecheck | Clean | Studio + local, that historical source |
| Frontend tests | 36/36 pass | Studio + CI run `39561037667` |
| Production build | Success | Studio + local |
| Dependency isolation | 215 registry packages, zero external links | CI run `39561037667` |
| UI desktop/mobile | 360/390/768/1024px verified | Independent local QA |
| Live browser readback | Bill 3 Settled 2/2, 2/2 freshly verified | 21 October 2026 operator browser observation (existing authorized account auto-restored; no new connection or signature initiated) |
| App release | `003f005b4030f664dfb95f9ccc79205f14e92b27`, label `20261021T071846Z-003f005` | Independent |
| ZIP SHA-256 | `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14` | Six UI/design files |
| Four dist assets | 633,573 bytes | That historical build |
| `src/onchain-facts.ts` SHA-256 | `b4c45994e26e377923c5f54e706709449435af051ce89f493027f111cdf2f070` | Drifted at this docs session start; restored by explicit write during this session; verified at session end |
| `src/wallet-ui.tsx` SHA-256 | `4d0a1e0b8712c7e9a4ca422b4a87df38c938795a01c8156a77c18e616eed93fc` | Matched at session start and end; unchanged |

The `src/onchain-facts.ts` helper restore described above was a source write inside Studio (restoring the canonical 1,080-byte file after different bytes were observed; the cause of the drift is unestablished). No functional product changes were authored or adopted in this documentation session.

The 20-test receipt-discovery suite covers adversarial verification: `assembleCandidates` prior-hash ordering and cap, middle-source merged cap, old RAM bypass prevention, canonical block check, RPC error handling, stale contextKey guard, warm cache re-verification, `buildShareUrl` dedup/cap/exclusion. These tests run as part of the 36-test suite in CI; the 36-test count is the historical CI record for commit `003f005`. At that earlier UI checkpoint, the referenced Solidity record was 35 tests and 256 fuzz runs from 17 October. The later 21 October preparation separately ran 38 tests with 256 fuzz runs; contract source remained unchanged.

Bill 4 create transaction (`0x0834d17d37afc7fa267bc84648e34ebdf973433b72597db5e64a75018b20d826`) succeeded on testnet under the new hostname. Direct user confirmed manual wallet approval with no malicious warning shown. This is user-reported for the createBill step only; native wallet pixels were not captured; payShare on the new domain had not yet been retested at that Bill 4 checkpoint; the complete later Bill 6 flow is recorded above.

## Dedicated hosting verification (18 October 2026)

| Item | Result |
| --- | --- |
| Primary URL | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Release label | `20261018T080938Z-dd5013b` (INITIAL/HISTORICAL checkpoint — white/blue UI; no later publication had been verified as of that 18 October checkpoint) |
| Files / bytes | 4 public dist files / 608,328 bytes |
| Manifest SHA-256 | `21ff2a604925a5e6b09f8cd623dca6b3848147ab67340eaae0387c4853c35215` |
| HTTPS/TLS/redirect readback | Passed 2026-10-18 08:22:43 UTC |
| Root/slash/HTTP redirects | Preserve bill query string |
| Hosting type | Dedicated static; isolated release directory; `current` symlink; no backend/port/dependency/secret uploaded |

The temporary `codex.axiqo.xyz/splitreceipt` route has been removed and must not be used as the primary demo.

## Bill 3 independent RPC verification (18 October 2026)

Read-only public RPC verification at 2026-10-18 08:16:19 UTC (head 67810050) confirmed:
- 2/2 payers paid on Arc Testnet 5042002
- Both SharePaid receipt events present
- Total principal 0.002 test USDC; total gas 0.007712475 test USDC
- No real money involved

Browser refresh on dedicated domain showed settled 2/2 anonymously (no wallet connected).

Creation and first payment used MetaMask; both signatures occurred off-camera. Second payment used a disposable test-account helper, not MetaMask. Chain success does not prove wallet software or continuous signing footage.

## Receipts and deterministic coverage

Tests cover continuation beyond 150,000 blocks, incremental refresh, failed-page retry, the genesis boundary, exact event filtering, conflicting hashes, navigation/scope cancellation, successful final replacement hashes, cancelled/reverted payments and complete BillCreated field matching. These tests do not claim real-wallet pending-transaction acceleration or cancellation on Arc Testnet.

The [history RPC smoke](../tests/evidence/history-rpc-smoke-2026-10-17.json) separately records the helper recovering bill 1's two hashes in three 2,000-block pages at head 67666623 without a configured deployment floor.

## Bill 2: browser wallet observations (17 October 2026)

The local standalone app was exercised with an ordinary MetaMask extension: connection, a rejected create request, successful creation, a rejected payment request and successful payment. Rejected requests were not presented as successful transactions or paid receipts. The second payer was the original disposable test account, paid by root through private local tooling.

| Transaction | Gas in test USDC |
| --- | --- |
| [Create](https://explorer.testnet.arc.io/tx/0x69c6209b9dd2f35de2a657879be66b1d76c1dd4f4f41bae6e32e2a8926aa1839) | 0.005349925 |
| [MetaMask share](https://explorer.testnet.arc.io/tx/0xc1a18f3c1698d207ca6c247643175b0e1f958ea4719da4ccb5d5b751532a2b6a) | 0.0017118 |
| [Original payer share](https://explorer.testnet.arc.io/tx/0x80d5b5c0c7d5941994eddd700587051d8f054c466a071afde5c7611ace315cb7) | 0.001771625 |
| Total | **0.00883335** |

Shares total 0.002; gas plus shares totals 0.01083335 test USDC. These are test assets. No mainnet transaction or additional paid service was used.

Final local browser observations:
- Refresh showed bill 2 settled 2/2. Disconnect followed by a hard reload restored the Connect wallet button and both payment hashes from chain history.
- Reconnection through MetaMask's native local-origin consent was cancelled once; a retry was accepted.
- Switching to an existing second MetaMask account showed address `0xA944…1A7c`, retained both receipts, and removed the old payer's marker.
- Switching the connected network to Sepolia caused the Switch to Arc Testnet banner to appear; the app action returned the wallet to Arc Testnet. No transaction was sent on Sepolia.

A rejected network-switch prompt was not exercised. Real post-broadcast nonce acceleration and cancellation were not exercised in the browser.

## Public delivery and remaining boundary

Primary demo: https://splitreceipt.axiqo.xyz/splitreceipt/; deployed application source `4dae47f01bb78126e5c70621d87af0c9899cb9c6`, release `20261021T192007Z-4dae47f`. The old GitHub Pages hostname and earlier `003f005` release are historical. The complete current public Bill 6 flow is recorded above; its first/second payments must not be replaced with Bill 3's older helper-paid history.

Recordings remain private and no final public-video URL or contest submission is claimed. The [22 October rules check](https://dorahacks.io/hackathon/arc-microgrants-2/detail) requires Studio provenance and real mainnet operation; testnet success alone does not qualify. As of 22 October mainnet writes were disabled (superseded on 23 October; see [MAINNET-LIVE.md](MAINNET-LIVE.md)). Mixed-history acceptance and Studio reviewer access are unresolved, and the actual form schema was not inspected after its Organizer Disclaimer was canceled. See [submission readiness](submission/READINESS.md) and [provenance](PROVENANCE.md).
