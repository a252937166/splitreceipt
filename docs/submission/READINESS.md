# Submission readiness — 23 October 2026

**The public application and mainnet payment demonstration are complete. The submission packet is not yet ready for a verified eligible submission:** a public Studio/mainnet walkthrough is missing, and the mixed Studio/local development history remains an unresolved eligibility issue. No form has been submitted.

## Latest checkpoint (23 October 2026, ~18:31–18:43 UTC): accepted and published; submission still not done

*Verified about 18:31–18:43 UTC. Everything marked "independent" below is reported by the independent browser, build and release operator; the Studio agent did not run remote acceptance, did not publish, and is only recording these reports.*

Where earlier passages below say the candidate is "not published", that independent acceptance or public-browser acceptance is "pending", or that the embedded Preview is "unconfirmed", this checkpoint supersedes **only those gates**; those passages are kept as dated earlier checkpoints. It does not supersede the open gates listed at the end of this checkpoint, and it does not rewrite the mixed development history.

- **Accepted source (independent).** Final exact Studio ZIP SHA-256 `1385756b481772ab1c8ca81a43ab29d35672c5291658b0ab36b5d5bc986890a5`. Independent clean-source acceptance **PASS**: 320 TypeScript tests, typecheck, production build and dependency isolation; 35 Forge contract tests reusing the exactly unchanged contract, contract test and compiler inputs. Real installed-viem checks of the final-send boundary with **mocked providers** passed all 20 scenarios (including account and page A→B→A, unmount and newer actions); those are mocked requests, not actual wallet signatures. The final source map has 186 files, SHA-256 `83c0a6bed028f0deb1968fe642d6ba7e5158a25b4d90dbaabe0021af08d31b44`: 113 files selected from the actual Studio ZIP plus 73 hash-identical baseline files retained. The seven protected-file hashes are unchanged.
- **Public Git (independent).** That accepted app source is public commit [`b2af1246ac952aca7eadacd71d5679dc440c0254`](https://github.com/a252937166/splitreceipt/commit/b2af1246ac952aca7eadacd71d5679dc440c0254). The root checks-only CI for that exact commit [succeeded](https://github.com/a252937166/splitreceipt/actions/runs/40005567874).
- **Published release (independent).** Static release `20261023T182638Z-83c0a6bed028` is active at https://splitreceipt.axiqo.xyz/splitreceipt/. Sealed manifest SHA-256 `97314eb9ae6bf88404f572c6fdbee1ae8a901167ebbc77e9864ab5f244c3644f`; the four public HTTPS files matched the accepted independent build and the remote staging by size and SHA-256. `/splitreceipt` returns 308; an unknown route and an unknown asset return 404. The sealed pre-Git manifest is not rewritten: its `sourceCommit` remains null, and the later Git commit binds the exact source map. Later documentation-only changes do not change this app release or its source binding.
- **Public-browser acceptance (independent) PASS.** Anonymous Mainnet Bill 1, fresh load: Settled 2/2, creator verified, two canonical payment transaction links, "Nothing to pay" disabled. At 375px: page `scrollWidth` 375, wallet trigger right edge 359, dialog left 39 / right 359 / width 320. Installed wallets listed: Phantom, OKX Wallet, MetaMask, SubWallet. Tab focused Phantom; Escape closed the dialog and restored Connect wallet. A wrong Mainnet-contract URL (the original Testnet contract in a Mainnet link) was refused with no wallet request and the generic footer without network-specific claims. Clicking the Pay 2 receipt opened the live explorer showing Success, `payShare`, value 0.001 USDC and the contract-forwarded 0.001 USDC.
- **Not done in that regression.** No actual new wallet connection or signature was made, so none is claimed; this is not a blanket security certification.
- **Studio-side checks (the agent, in this workspace, earlier on 23 October).** `tsc` exit 0; 320 TypeScript tests pass; `forge test --offline` 35 pass; production build succeeded with no instrumentation markers in `dist/`; dependency isolation independent; protected hashes 7 of 7. jsdom scripts with fake wallets were manual and partial. These are separate from, and weaker than, the independent checks above.
- **Mainnet and spending.** No new Mainnet transaction, deployment or payment was made during this rebuild, publication or recording, and no paid service or upgrade was purchased. The historical owner-operated two-account Bill 1 is unchanged: gross shares 0.002 USDC, net inter-wallet transfer 0.001 USDC, total historical Gas 0.02263094 USDC ([MAINNET-LIVE.md](../MAINNET-LIVE.md)).
- **Media.** Genuine native continuous footage of Studio repair, Preview, tests and export, and of the newly published product and explorer operations, has been recorded and retained. English narration, burned English subtitles and a Chinese SRT are being assembled and independently QA-checked as a separate local task. **There is no public final video URL**; video publication is a separate pending gate. The earlier slideshow and silent edits stay historical.
- **Still open (separate gates, none completed).** Formal contest submission; acceptance of the activity agreement; public video upload and playback check; reviewer access to the Studio project; and organizer acceptance of the mixed development history. The [official rules page](https://dorahacks.io/hackathon/arc-microgrants-2/detail) requires the video to show the Studio build and a mainnet transaction, and states no duration, format, platform or language mandate.

The sections below were written earlier on 23 October or before and are kept as dated checkpoints. The "Remaining gates" table below still applies except where this checkpoint states otherwise; the first-paragraph statement that a public walkthrough is missing is still true (the final video is not published).

## Current rules

The [official round](https://dorahacks.io/hackathon/arc-microgrants-2/detail) was rechecked on **23 October 2026**. It requires a Studio-built public app, Studio-written/tested contracts deployed to Arc Mainnet, at least one real USDC movement through the app and contract, the Studio project URL, a public repository, a Studio/mainnet video walkthrough, a short description and a public GitHub/X/Farcaster builder profile.

The page excludes outside-Studio projects, testnet-only builds, mockups/decks and work already funded by Circle or Arc. It states no external-authoring percentage or retroactive-import exception. SplitReceipt's later exact Studio synchronization does not by itself resolve its earlier local development. No eligibility acceptance has been obtained.

Displayed deadline: **2026-11-01 23:59 (UTC−4)**. Preserve that literal page offset and recheck before submitting. The inspected details page does not state a minimum transaction amount, required video length, continuous-recording rule or required promotional post; the uninspected actual form may add fields.

Scoring shown on the page: mainnet USDC activity **30%**, Studio use across contracts/testing/app **25%**, working product **25%**, future potential **20%**. One controlled demonstration establishes functionality; it is not external adoption or a guarantee of a microgrant.

## Verified now

| Item | Current evidence |
| --- | --- |
| Public application | https://splitreceipt.axiqo.xyz/splitreceipt/; release `20261023T083640Z-0065817` |
| Deployed application source | `00658175885a03f1fd49d61c56a2ce3ff2f86b82`; [exact-commit CI](https://github.com/a252937166/splitreceipt/actions/runs/39923724591) passed; public TLS/assets/routes read back |
| Mainnet contract | [`0x8522Ea5A413c8402182fF6998Bd7471bAC886142`](https://explorer.arc.io/address/0x8522Ea5A413c8402182fF6998Bd7471bAC886142), Arc Mainnet 5042; reviewed runtime and canonical deployment checked |
| Real app/contract USDC movement | [Payer 2](https://explorer.arc.io/tx/0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5) transfers 0.001 USDC to a distinct recipient wallet |
| Complete demonstration | [Bill 1](https://splitreceipt.axiqo.xyz/splitreceipt/?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1), two 0.001-USDC shares, paid states `[true, true]` |
| Public read-only receipt path | After wallet disconnect and reload: Connect wallet, 2/2 paid, 2/2 receipts verified; no fresh-profile claim |
| Public evidence | [Mainnet summary](../../tests/evidence/mainnet-flow-2026-10-23.json), [judge path](JUDGE-GUIDE.md), [evidence index](EVIDENCE-INDEX.md) |
| Deterministic checks (deployed commit `0065817`) | Actual 23 October Studio/local typecheck, 80 TypeScript tests, build and isolation; separate 21 October 38 Solidity tests / 256 fuzz runs. These belong to the deployed commit, not to the rebuild candidate below |
| Current draft copy | [Field blocks](FORM-FIELDS.md); older Testnet/preparation documents remain dated history |
| Studio project | https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62; independent reviewer access still unconfirmed |
| Public builder profile | https://github.com/a252937166; public API access verified 23 October; owner/form checks remain separate |
| Actual Gas | **0.02263094 USDC** spent, **0.07736906** of the **0.10** cap unused |

Gross contract shares total **0.002 USDC**. Payer 1 equals the recipient, so its principal returns to the same wallet; payer 2 supplies the **0.001-USDC net inter-wallet transfer**. Both wallets are owner-controlled. These are not customer/revenue metrics. Funding principal **0.10 USDC** is separate from Gas and from through-app evidence. No additional transaction, bridge, paid upgrade or service purchase is needed to complete the demonstrated technical flow.

## Remaining gates

| Gate | Status | Required completion |
| --- | --- | --- |
| Mixed Studio/local eligibility | **UNRESOLVED** | Honest organizer interpretation of the disclosed history; exact source correspondence is not automatic acceptance |
| Public video | **PENDING_PUBLIC_VIDEO** | A final film with real native continuous Studio and product footage, English narration and captions is being prepared; there is no public link yet. The earlier sampled or silent private edits (63 and 175 seconds) are historical only. Needs authorized publication and independent public playback |
| Studio reviewer access | **UNCONFIRMED** | Establish a review route without assuming the owner's logged-in session |
| Owner/team/rights/prior funding/jurisdiction | **UNCONFIRMED** | Truthful owner answers and required actual form disclosures |
| Actual schema/track/limits | **UNINSPECTED** | Inspect real form after handling the event Disclaimer appropriately; fill and read back current links/text |
| Organizer Disclaimer / final submission | **NOT ACCEPTED / NOT SUBMITTED** | Owner decision on displayed event agreements, final review and an explicit platform acknowledgement |

The earlier Organizer Disclaimer was canceled. Accepting Studio login terms does not accept that event agreement. The QA-checked private evidence edit and the earlier one-of-two clip are not a publicly playable walkthrough. Neither a Git push nor a successful onchain payment is a DoraHacks submission.

## Provenance and publication boundary

The original app/contract began in Studio, later UI work used Studio, and recent externally prepared inputs were actually written/tested in Studio's manual terminal with exact hash readback. Earlier local contributions remain disclosed in [provenance](../PROVENANCE.md). Deployment used the owner-confirmed local CLI. Do not recast the project as exclusively Studio-AI authored.

`00658175885a03f1fd49d61c56a2ce3ff2f86b82` is the deployed application commit. Any later evidence/documentation-only commit is separate and does not represent another app release. The contract/runtime, through-app payment, public readback, private media, public video and final form status are separately verified states. More mainnet spending will not resolve the remaining documentary or eligibility gates.

## Replacement-rebuild candidate (23 October 2026; not published) — earlier checkpoint

*Superseded only on the publication, independent-acceptance, embedded-Preview and public-browser rows by the latest checkpoint above; every other row stands.*

A dated addition; it changes no earlier row. The original Studio snapshot was restored, the older externally prepared wallet, receipt and core code was removed or quarantined, and the Studio AI newly reimplemented it in one Arc Studio thread, with two independent review and repair rounds recorded (round 2 found residual variants within the original nine findings) and the seven original protected files retained byte-for-byte. See [the rebuild record](../STUDIO-REIMPLEMENTATION-2026-10-23.md), [provenance](../PROVENANCE.md) and [validation](../VALIDATION.md). This does not rewrite the mixed history and does not establish organizer acceptance.

| Item | Status |
| --- | --- |
| Candidate publication | **NOT PUBLISHED.** Not deployed, pushed, uploaded, formally submitted or approved. The public site still runs the deployed commit `00658175885a03f1fd49d61c56a2ce3ff2f86b82` |
| Latest candidate checks (as observed) | Typecheck exit 0; 320 TypeScript tests in 20 files, all pass; `forge test --offline` 35 pass (256-run fuzz); production build success; dependency isolation independent; production bundle scan with no instrumentation markers; protected hashes 7 of 7 |
| Embedded Studio Preview | **OBSERVED WORKING by an independent operator** on 23 October, 17:58–18:01 UTC: create form (draft total 0.002 for share 0.001 with two payers) and wallet chooser (Phantom, OKX, MetaMask; Tab focus; Escape restores the trigger); no wallet connection, signing or transaction. The earlier "Connecting to sandbox" failure is dated history. Native continuous recordings (phases 7 and 8) are reported by the operator, not reviewed here |
| Public-browser / real-wallet / mobile QA | **PENDING.** Beyond the Studio Preview observation above, only jsdom checks with fake wallets exist |
| Independent acceptance of the final state | **NOT RECORDED.** Product acceptance is done independently from the exported exact bytes |
| Publication and public readback | **FUTURE GATE.** Separate from every item above |
| Mainnet | No new transaction or deployment during the rebuild or recording. Evidence unchanged: Bill 1 settled 2/2, two receipts, both payers owner demonstration accounts, 0.002 USDC gross shares, 0.001 USDC net transfer, 0.02263094 USDC total historical deployment and demonstration Gas |
