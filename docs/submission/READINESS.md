# Submission readiness — 23 October 2026

**The public application and mainnet payment demonstration are complete. The submission packet is not yet ready for a verified eligible submission:** a public Studio/mainnet walkthrough is missing, and the mixed Studio/local development history remains an unresolved eligibility issue. No form has been submitted.

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

## Replacement-rebuild candidate (23 October 2026; not published)

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
