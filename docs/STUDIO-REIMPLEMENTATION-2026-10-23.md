# Studio reimplementation record, 23 October 2026

This records what the Arc Studio agent newly wrote in this thread, what was checked, and what was not. It is a work record, not an audit, not a claim of publication, organizer approval or eligibility.

## Latest checkpoint (23 October 2026): accepted, committed and published

*Dated 23 October 2026, verified about 18:31–18:43 UTC. Everything marked "independent" below is reported by the independent browser, build and release operator; the Studio agent did not run remote acceptance, did not publish, and is only recording these reports.*

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

The rest of this record was written before that checkpoint and is kept as the dated record of the work; its statements that the candidate is unpublished, that acceptance is pending or that the Preview is unconfirmed are earlier checkpoints, superseded only on the gates named above. Its "not a claim of publication" sentence describes this document's own purpose: the publication facts above are the independent operator's reports.

## Scope and boundaries

- The existing public release is unchanged. Nothing was deployed, pushed, published or paid for.
- No real wallet request, signature or transaction was made. Every write path was exercised only with fake EIP-1193 providers. Mainnet checks were read-only RPC calls.
- Acknowledging the mainnet notice was not treated as authorization for any new financial operation.
- Contract and protected files were not touched.

## Protected files (checked at the end of this session, unchanged)

| File | SHA-256 |
|---|---|
| `contracts/SplitReceipt.sol` | `df06d8d017fc9170f39eeb08d38f5f7f5dbcbd4b4e34a8542cc3eaa216d504c2` |
| `contracts/test/SplitReceipt.t.sol` | `486e9b0dd7691aed25bc9c3383644406082ee2a1371712df7473e2e82fb65440` |
| `src/index.css` | `ee46f490fdc015b19c8bb4035b172fcc3d325b688e9872f039af023b848afc0d` |
| `src/receiptDiscovery.ts` | `fb8a9716ea4c94987d4266662e05fbe68d98214a87242fd85ee9f8d53384b923` |
| `src/usdcFormat.ts` | `ec0bf64447ae8a1a0587488323d140cdc83d2924b1946fe46219e9b220c11cb9` |
| `src/vite-env.d.ts` | `65996936fbb042915f7b74a200fcdde7e410f32a669b1ab9597cfaa4b0faddb5` |
| `docs/DESIGN.md` | `b06026e1d58bbd0b8f01c4588ccad56491d5ac3d0eb39b5a1797dc796416c05a` |

## Newly authored by the Studio agent in this thread

Source (new): `src/networks.ts`, `src/receiptHistory.ts`, `src/createBillReceipt.ts`, `src/paymentVerification.ts`, `src/writeGuard.ts`, `src/billForm.ts`, `src/splitReceiptAbi.ts`, `src/epoch.ts`, `src/creationHints.ts`, `src/a11y.ts`, `src/lib/share.ts`, `src/studio-preview.ts`, `src/walletSend.ts`, `src/settlement.ts`, `src/receiptProofs.ts`, `src/receiptRecovery.ts`, `src/receiptController.ts`, `src/submissionLock.ts`, `src/hooks/useBillData.ts`, `src/hooks/useReceipts.ts`, `src/hooks/useRequestScope.ts`, `src/wallet/WalletSession.tsx`, `src/wallet/WalletMenu.tsx`, `src/components/ui.tsx`, `src/components/ContextProblemView.tsx`, `src/components/OpenBill.tsx`.

Source (rewritten): `src/App.tsx`, `src/main.tsx`, `src/config.ts`, `src/components/CreateBill.tsx`, `src/components/BillDetails.tsx`.

Source (edited): `src/receiptHints.ts` (public mainnet Bill 1 payment hashes added to the candidate list). `vite.config.ts` was edited once by the agent and later replaced by an explicit allow list written outside the agent's turns; the current file is not agent-authored.

Tests (new): `tests/fixtures.ts` and `tests/{wallet-send, settlement, receipt-recovery, submission-lock, ui-source, studio-preview, networks, mainnet-context, mainnet-recovery, create-bill-receipt, payment-verification, write-guard, epoch, a11y, bill-form, receipt-history, usdc-format, abi-parity, production-entry}.test.ts`. Optional DOM-level scripts, run by hand: `tests/jsdom/{lock-and-retry, harness, read-only-pages, wallet-flows, pay-outcomes, studio-bridge}.mjs`.

Docs: this file; `README.md` and `AGENTS.md` (testnet-only and locked-writes claims removed, current behavior described). A later pass added the dated replacement-rebuild record to `README.md`, `docs/PROVENANCE.md`, `docs/VALIDATION.md`, `docs/submission/{READINESS, VIDEO-SCRIPT, LOCAL-ASSETS, EVIDENCE-INDEX}.md` and a pointer in `docs/MAINNET-LIVE.md`, and labeled older undated Testnet-only or disabled-mainnet sentences in `docs/DEPENDENCY-ISOLATION.md` and `docs/submission/{PROJECT-BRIEF, MAINNET-COST-STUDY, ORGANIZER-QUESTION-DRAFT}.md` as historical. Dated historical evidence was preserved. Older files under `docs/` describe earlier checkpoints and were not rewritten.

Not authored in this thread: `src/receiptDiscovery.ts` (protected), `tests/receipt-discovery.test.ts`, the generated `src/onchain-facts.ts`, `src/onchain-money.ts`, `src/onchain-wait.ts`, `src/splitReceiptContract.ts` (no longer used by the app), and `src/console-capture.ts` / `src/tracing.ts` (Studio instrumentation kept on disk; see the next section).

## Replacement-rebuild record (23 October 2026)

This is a dated addition. It does not rewrite the earlier mixed history, replace any dated evidence, or establish organizer acceptance.

- **Starting point.** The owner restored the original Studio snapshot before this thread (owner statement; a ten-file restore readback was present in the sandbox when the thread began). The older, externally prepared wallet, receipt and core code was removed or quarantined by the owner and operator, and was not copied back.
- **Reimplementation.** In this thread the Studio AI newly wrote, on the already installed dependencies, the network and page-context layer, the wallet session and menu, the request-epoch and write guards, the final wallet-request boundary and per-network fee policy, create and pay settlement, the receipt history, recovery and proof layers, the create and bill components, the header and footer, and their tests. The file list is above.
- **Seven original protected files retained** byte-for-byte; the hashes in the table above were checked at the end of every round, including the last.
- **Independent review and repair rounds** (as reported to the Studio thread by the owner; the reviewers' own reports are not reproduced here):
  1. *Round 1* reviewed an exported ZIP, SHA-256 `3032e2852df19fc12d2196eb048d998113c304e6667c032526cde7207c240afc`. It passed typecheck, 195 TypeScript tests, the production build and 35 Forge tests, but independent tests reproduced nine defects: the final wallet-request boundary, missing Mainnet fee fields, a false payment success, replacement and uncertain outcomes, a history scan that stopped before a missing payer, stale receipt proofs, inaccurate records, a mobile wallet entry that overflowed at 390px, and a footer that claimed Testnet for an invalid context. All nine were repaired in this thread.
  2. *Round 2* reviewed the exported repaired source. It confirmed 308 tests, the build, the real viem final-send guard and the Mainnet 40 gwei / zero priority fee, and reported three residual variants within the original nine findings (not new independent findings): candidates from earlier pages lost after a later page error, unresolved verification treated as history exhaustion, and "Start over" / "Dismiss" unlocking a second write while a sent hash could still confirm. The nine findings, including these variants, were repaired in this thread. The export hash for round 2 is not recorded in this workspace.
  3. *No review of the final state is recorded.* Whether a later export passes is not known to this record.
- **Not established by this record:** organizer acceptance, eligibility under the round's Studio rules, publication, a security audit, or real-browser and real-wallet behavior.

## Studio preview instrumentation: the actual boundary

- `src/main.tsx` does not import `console-capture.ts` or `tracing.ts`.
- `src/studio-preview.ts` is the only importer. It imports both dynamically, and only when `import.meta.env.DEV` is true AND the page is framed AND it is the Studio preview host (`*.preview.studio.arc.io`) or has a `studio.arc.io` parent. Those two modules patch `console`, `fetch` and the wallet provider's `request`. So in the development preview inside Studio they are loaded and active.
- A production build contains none of it. The built bundle has zero occurrences of `studio-trace`, `studio-console`, `patching fetch`, `console-capture`, `tracing.ts`, `preview.studio.arc.io` or `studio-preview`, and no `window.ethereum` reference. Two `postMessage` strings remain and are not instrumentation: React's scheduler (`MessageChannel`) and `src/lib/share.ts`, which asks the Studio parent for a share-link base (`arc-share:hello`) and patches nothing.
- `tests/production-entry.test.ts` fails if `main.tsx` imports the instrumentation, if anything but the bridge references it, if the application source patches `fetch` or touches `window.ethereum`, or if `dist/` contains the markers above.
- Whether the Studio Preview panel needs this traffic to come up is an inference from `console.jsonl` (entries stopped when the imports were removed). It is not confirmed from the panel's own code. The pane was later observed loading the app with the bridge present (see "Studio Preview: dated history"), which is consistent with the inference but does not prove it.

## Studio Preview: dated history

All times are as reported to the agent. The earlier "Connecting to sandbox" failure was observed by the project owner in the Studio UI. The 17:58–18:01 UTC observation was made by an independent browser operator in the official Studio Preview pane. Neither was observed by the agent, which has no browser.

| When | Observation | Source |
|---|---|---|
| 23 Oct, after `src/main.tsx` stopped importing the Studio instrumentation (before the development bridge existed) | The Studio Preview pane stayed at "Connecting to sandbox / Preview will appear shortly", also after Refresh. The dev server still returned HTTP 200 and `console.jsonl` had stopped receiving entries. | Owner's browser observation; sandbox logs |
| 23 Oct, later turn | Agent added `src/studio-preview.ts` (development, Studio-framed only). No preview result was observed by the agent at that time. | Agent |
| 23 Oct, 17:58–18:01 UTC | An independent operator opened the full official Studio Preview pane and operated the real app. Title, recipient, two payer addresses and a share of 0.001 gave a draft receipt total of 0.002. The wallet chooser opened and listed Phantom, OKX and MetaMask; Tab focused an option; Escape closed it and restored focus to the trigger. No wallet was connected, nothing was signed and no transaction was requested. The operator reports native continuous recordings (phases 7 and 8) preserve this. | Independent operator's browser observation (recordings not reviewed or reproduced by the agent) |

What this does and does not show:

- The Preview pane loads the application; the create form, the payer rows, the draft receipt total and the wallet chooser (open, Tab focus, Escape closes and restores the trigger) worked in the independent operator's browser. That replaces "still connecting" as the current state; the earlier failure stays in the table above as history. It does not cover bill pages, wrong-context links, mobile widths, connecting or signing with a wallet, or a public browser, and acceptance and publication remain pending.
- It is consistent with the development bridge restoring whatever the pane waits for, but it does not prove that was the cause. Other changes happened between the two observations, and the pane's own readiness logic is not visible from the sandbox.
- It does not cover: wallet connection, any network or contract read, bill pages, the mobile header, keyboard and touch behavior of the wallet dialog, writes of any kind, or the production build. Independent browser acceptance of an exported or public copy is still required.

## Repairs made after independent review

1. **Final wallet boundary.** Sends no longer go through wagmi's `writeContract`, which awaits connector calls after the guard. `src/walletSend.ts` wraps the exact acknowledged provider object (no global patch) and, on the one `eth_sendTransaction` request, checks synchronously that the wallet/page/action epochs are live, the wallet snapshot is unchanged, and the transaction is exactly the frozen one (from, to, calldata, value, fee caps), then adds an explicit `chainId`. Every other signing or sending method is refused. The send is viem's real `writeContract` over that provider with transport retries off. Tests hold viem's own preparation request after the pre-checks passed, then change the wallet account, connector, network, page, unmount, or start a newer action, and assert the fake wallet's `eth_sendTransaction` count is 0. A consistent session sends exactly 1. Removing the boundary check makes 28 of those tests fail.
2. **Mainnet fees.** `networks.ts` carries `fees` for Mainnet only: `maxFeePerGas` 40 gwei (40000000000 wei), `maxPriorityFeePerGas` 0. Testnet has none. Tests assert the final fake wallet fields for both `createBill` (value 0) and `payShare` (value exactly the share), on both networks: chain, pinned contract, calldata, fees. A cap on gas price is not a limit on the total fee, and the Mainnet notice says so.
3. **No false payment success.** `src/settlement.ts` keeps four outcomes apart: verified, not-completed, sent-unverified, stale. A payment is verified only if the final transaction is payer to the pinned contract with `payShare(billId)` and exactly the share, a canonical `SharePaid` for that bill and payer exists, and `getBill` then shows the payer as paid. A successful replacement self-send with no `SharePaid` and an unchanged unpaid bill is not-completed: no toast, no cache entry, no settled claim. Retry is available only by the user pressing Pay again; nothing is resubmitted automatically.
4. **Replacements and uncertain outcomes.** The submitted hash and the final hash are tracked separately (viem `onReplaced`). Repricing is verified under the final hash; cancellation or altered calldata is not-completed. After a hash exists, a timeout or RPC failure says the transaction was sent and the result is not verified yet, with a read-only "Check again" and an explorer link, never "nothing was created or paid". While unverified, the create and pay buttons are held until the user reconciles or dismisses.
5. **History scan.** `scanSharePaidPage` takes the exact still-missing payer identities. A payer who is already verified does not count toward stopping, and the cursor is never marked done early; `done` means the floor was reached. `recoverMissingReceipts` keeps scanning past invalid candidates, carries undecided candidates through an RPC outage with the cursor preserved, and stops requesting pages once the context is stale.
6. **Stale proofs.** `ReceiptProofs` binds proofs to chain, contract, bill, share, paid set and a generation. During a refresh, previous proofs are only "awaiting re-verification" (never linked as verified, never copied into a share link); a payer who is no longer paid is dropped; a definitively invalid proof is cleared; late results from an older generation are ignored; another bill never inherits proofs. `ReceiptsController` holds this logic; `useReceipts` is a thin shell around it.
7. **Records.** AGENTS.md, this file and the README were corrected (see the instrumentation section above). Mainnet copy no longer says "test USDC".
8. **Mobile header.** The header wraps into two rows below 640px (brand and wallet, then the network choice, which shrinks), the wallet trigger and network choices are touch targets, the "Wrong network" badge collapses to a dot on narrow screens, and the wallet dialog is capped to the viewport width and scrolls. `src/index.css` is untouched.
9. **Invalid context footer.** The footer says no network or contract was validated and makes no network-specific claim.

## Checks run (final state of the session)

| Check | Result |
|---|---|
| `bunx tsc --noEmit` | exit 0, no errors |
| `node --import tsx --test tests/*.test.ts` | 320 tests in 20 files, 320 pass, 0 fail |
| `forge test --offline` | 35 pass, 0 fail (includes a 256-run fuzz test) |
| `bunx vite build` | success; one chunk-size warning (about 600 kB) |
| Production bundle scan | zero matches for the markers listed above |
| `node scripts/verify-isolation.mjs` | independent: 215 registry packages, 0 external filesystem links, 0 unused service SDKs |
| Protected hashes | 7 of 7 match |
| Mutation checks | removing the boundary check fails 28 wallet-send tests; reverting the scanner to count-based stopping fails 7 recovery tests; reverting fixes A and B fails 4 recovery tests; disabling the lock check in both components makes the jsdom lock script send a second wallet request |

DOM-level checks run by hand with jsdom (not a project dependency; installed temporarily outside the project and removed). They run React effects, StrictMode, events and focus in a simulated DOM, with a fake EIP-6963 wallet and either real RPC reads or an emulated RPC for one fake bill:

- Mainnet Bill 1 and testnet Bill 3, wallet disconnected: Settled, both receipts, verified creator, disabled "Nothing to pay", zero console errors.
- Wrong-context links show the refusal page and the footer without a network claim.
- Wallet dialog: focus entry, Tab wrap, Escape with focus return, outside press, no wallet request before the user chooses a wallet.
- Guard: a consistent wallet sends exactly one request; account, network and page changes (including A -> B -> A) while the check is pending send none. 32 of 32 assertions.
- Payment outcomes (emulated bill 99): a status-success self-send with no `SharePaid` and an unchanged unpaid bill is shown as "did not pay your share", the bill stays 0 of 2 paid, no second wallet request, retry stays available; a matching payment with its event and paid state is shown as verified, 1 of 2 paid. 13 of 13 assertions.
- Read-only live checks against public RPC with the earlier verifier modules: Arc Testnet and Arc Mainnet runtime hashes match the pins; mainnet `getBill(1)` paid states `[true, true]`; creation transaction and both payment receipts verify; a history scan with no hints recovers both. These were not re-run after the latest edits to the receipt code, which the offline tests and the jsdom runs against live mainnet Bill 1 and testnet Bill 3 do cover.

## Round 2: three residual variants within the original nine findings (A, B, C)

- **A. Pages that succeeded before a failed page are kept.** `src/receiptRecovery.ts` now verifies (or retains in `carry`) the candidates from pages already read before it returns a page error. The cursor stays on the failed page. Test: A and B missing, A at block 9000 on the first page, the next page fails; A is verified in the first call and the retry recovers B and A. A variant with the receipt RPC also down keeps A in `carry` and the retry verifies it.
- **B. Unresolved verification is not terminal exhaustion.** The controller reports `exhausted` only when the reviewed floor was reached and nothing is waiting to be verified, and exposes `unresolved`. The button reads "Retry receipt check" and stays enabled while candidates are unresolved; "History searched" appears only for true exhaustion. Tests: controller sequence receipt failure, then enabled retry, then a verified proof; true exhaustion still reported.
- **C. Submitted-intent lock.** New `src/submissionLock.ts`. The lock is taken synchronously when the wallet returns a hash and is released only by a read-only reconciliation that is verified or definitively not completed; a timeout or stale context keeps it held. The "Start over" (create) and "Dismiss" (pay) controls were removed, so no UI action discards a submitted intent. A new optional `VITE_RECEIPT_WAIT_MS` (1000 to 600000) shortens the receipt wait; the default stays 120 seconds. The lock is in memory for the current page view: reloading the page drops it, and a transaction that never confirms can only be left behind that way.
- **Component events** (`tests/jsdom/lock-and-retry.mjs`, jsdom, emulated RPC for a fake bill, fake wallet): pay: timeout, no Dismiss control, forced call of the Pay handler sends nothing and shows the refusal notice, Check again with a definitive result releases the lock, an explicit retry sends exactly one more request; pay: timeout then a confirmed payment is verified with one request total; create: timeout, a form submit while locked sends nothing, definitive result then an explicit retry sends one more; history: last-page candidate with the receipt RPC down shows an enabled "Retry receipt check", then a verified receipt link. 26 of 26 assertions.

## Clean-export fixture repair (23 October 2026, after independent clean-source/CI check)

- **Finding.** `tests/abi-parity.test.ts` read `contracts/contract-metadata/SplitReceipt.json`. That generated Studio file is intentionally excluded from the public source because it includes `deployerWalletId` and other platform data, so a clean checkout failed with `ENOENT` before its four ABI assertions. Public CI runs install, isolation, typecheck, `npm test` and build, without Forge or Studio metadata.
- **Repair.** New `tests/fixtures/splitreceipt-compiler-abi.json` holds only the `abi` array taken from the actual Forge compiler artifact of `contracts/SplitReceipt.sol` (solc 0.8.28, Paris, optimizer 200): 18 items (4 functions, 2 events and 12 errors). It has no wallet ids, addresses, deployments or platform data. The ABI-parity test now reads this fixture. One guard test was added, so the suite is **320** tests (319 before this repair): it fails if the fixture has any key other than `abi`, any address, or any wallet, deployer, network or deployment text.
- **Compared with the actual compiler output.** The fixture's `abi` equals the Forge artifact's `abi` exactly, and also equals the `abi` in the generated Studio metadata file (all 18 items, same order). Fixture SHA-256: `481d0417a5480760e8555f2306f144c97aa52f2504f6a931c2a2fd1a3768e0d0`.
- **Proof without the metadata directory.** A copy of the project made without `contracts/contract-metadata`, `contracts/out`, `contracts/cache`, `dist`, `.env` and `.git` (dependencies linked from the workspace) ran the whole suite: 320 tests, 320 pass, 0 fail, no `ENOENT`. Removing the `SharePaid` event from the fixture in that copy makes 2 parity tests fail, so the fixture is actually compared. In the workspace itself: `tsc` exit 0; 320 tests pass; `forge test --offline` 35 pass; production build success with no instrumentation markers in `dist/`; isolation independent (215 packages); protected hashes 7 of 7.
- **Unchanged.** Production `src/` bytes, `package.json`, the lockfile, the CI workflow, the contract and the seven protected files were not touched. Only a test, a test fixture and this documentation changed. If the contract ABI ever changes, regenerate the fixture from the new Forge artifact's `abi` field and nothing else.

## Limits of these checks

- **No real browser was available.** Server rendering, HTTP 200 and jsdom are not browser tests. Mobile overflow at 375 and 390px was not measured (jsdom has no layout engine); the header change is structural and covered by source assertions only. The agent has no browser; the only real-browser observation is the independent operator's 17:58–18:01 UTC Studio Preview session (create form, draft total and wallet chooser only; see "Studio Preview: dated history").
- Real wallets (extensions, vendors, how they treat an explicit `chainId` and fee fields on `eth_sendTransaction`) are untested. Replacement detection is tested through a fake wait function and through viem's documented `onReplaced` hook, not against a real chain with a real replacement.
- The mainnet fee cap is a cap on price per unit of gas. It is not proof of, or a limit on, the total fee, and no mainnet transaction was made to measure one.
- The wallet-session wiring (wagmi subscription and provider event listeners that bump the wallet epoch) is exercised by the jsdom scripts, not by the node test suite.
- The lock is not persisted across a reload or tab close, and only one pending intent per view is tracked; a multi-pending feature was not built.
- The jsdom scripts are manual; they need jsdom installed temporarily and are not part of `npm test`.

## Pending browser QA (owner or a browser-equipped session)

1. Load a blank link, a testnet bill link and the mainnet Bill 1 link while disconnected; confirm paid state, both receipts and the verified creator appear after a reload.
2. Open the wallet dialog with keyboard only and with touch at 360, 375, 390, 768 and 1024px: no horizontal page scroll, Connect wallet fully visible and at least 44px tall, dialog fits, focus entry, Escape, focus return, Tab wrap, outside tap.
3. Connect a real wallet on Testnet and change account, change network, disconnect and reconnect while a create or pay check is pending; confirm nothing is sent. Do not send any mainnet transaction as part of this test.
4. On Testnet, create and pay a small bill and confirm the wallet shows the expected target, value and chain; on a replacement or speed-up, confirm the result follows the final transaction.
5. Open a settled bill with a payer wallet connected; confirm the disabled "Nothing to pay" state.
6. Open wrong-context links (`?network=ethereum`, `?network=mainnet&chainId=5042002`, a testnet contract on mainnet); confirm the refusal page and footer.
7. Studio Preview pane: observed working by an independent operator at 17:58–18:01 UTC on 23 Oct (create form, draft total, wallet chooser with Tab and Escape focus restore; no wallet connection, signature or transaction). Still to confirm: bill pages, wrong-context links, mobile widths, and wallet connection and signing on Testnet. Then repeat items 1 to 6 on an exported or public copy, which is the independent acceptance step.

## Prior mixed history

The contract and first application were created in Arc Studio. Dependency isolation, history pagination, wallet handling, the 21 October preparation controls and the dark and light UI revisions mixed Studio-authored work with externally prepared inputs applied through Studio's terminal; `docs/PROVENANCE.md` and the README keep that record. This session's source files listed above were newly written by the Studio agent in this thread, not copied from removed implementations or backups. That does not change the earlier mixed authorship, and no eligibility, submission, publication or organizer approval is claimed here.
