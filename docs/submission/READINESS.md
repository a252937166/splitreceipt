# Submission readiness — 22 October 2026

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

**Not ready for an eligible Built with Arc Studio submission.** The public testnet product and current supporting materials can be reviewed now. Required mainnet deployment/payment evidence is absent, and the project's mixed Studio/local provenance remains unresolved. No form submission has been made.

## Rule basis and deadline

The [official round details](https://dorahacks.io/hackathon/arc-microgrants-2/detail) were checked live on **22 October 2026**. They require Studio development across contracts, testing and app, a public working app connected to Arc-mainnet contracts and at least one actual mainnet USDC movement through app and contract before submission. Testnet-only and externally built projects are excluded. The page gives no permitted external-authoring percentage or retroactive-import exception; later synchronization is not proven eligibility.

The displayed deadline is **2026-11-01 23:59 under UTC−4**. That is a literal page label, not a verified New York-local or independently confirmed absolute deadline. New York changes daylight-saving offset on that date, so do not silently substitute its local time. Program dates can change; recheck before final submission.

The page requires a public GitHub/X/Farcaster builder profile. It did not explicitly require a promotional social post, tags/community campaign, continuous recording, video length or minimum transaction amount. Those are observations about this page, not waivers; the underlying form has not been inspected.

The published scoring weights are mainnet USDC activity 30%, Studio use across the build 25%, working product 25% and future potential 20%. Product polish and a passing testnet demonstration cannot substitute for the two provenance/mainnet gates.

## Available now

| Material | State / evidence |
| --- | --- |
| Public application | https://splitreceipt.axiqo.xyz/splitreceipt/; dedicated-host release `20261021T192007Z-4dae47f` |
| Application source | `4dae47f01bb78126e5c70621d87af0c9899cb9c6`; [repo](https://github.com/a252937166/splitreceipt), [exact-commit CI](https://github.com/a252937166/splitreceipt/actions/runs/39660377061) |
| Current testnet flow | [Bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6), actual create plus two payments, 2/2 paid and 2/2 verified receipts |
| Canonical transaction summary | [Public evidence](../../tests/evidence/public-wallet-flow-2026-10-22.json), including three hashes and observation limits |
| Deterministic checks | Recorded 21 October: 76 TypeScript tests, typecheck/build/isolation; separate 38 Solidity tests and 256 fuzz runs in Studio and locally |
| Draft text | [Brief](PROJECT-BRIEF.md), [field copy](FORM-FIELDS.md), [judge guide](JUDGE-GUIDE.md), [evidence index](EVIDENCE-INDEX.md), [video plan](VIDEO-SCRIPT.md) |
| Studio project URL | https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62; access for an independent reviewer is unconfirmed |
| Builder profile candidate | https://github.com/a252937166; public content retrieved by an unauthenticated reader using a cached page |
| Private media | 63-second sampled process record, QA complete, not uploaded; [asset inventory](LOCAL-ASSETS.md) |
| Mainnet preparation | Published disabled view, blank address, source lock false; offline unsigned draft and local-EVM tests only |
| Fee research | [21 October historical model](MAINNET-COST-STUDY.md); not refreshed, not a current guaranteed minimum |

The public testnet proof uses owner-controlled demo accounts; it does not prove customers/revenue or a mainnet transaction. The same-profile disconnected reload is not a clean-profile test. Media does not contain native wallet signatures or Studio editing. No additional paid upgrade is needed to prepare these drafts; funding and fees for any future mainnet work remain separate and unauthorized here.

## Remaining gates

| Gate | Current status | Completion evidence needed |
| --- | --- | --- |
| Studio mixed-history eligibility | **UNRESOLVED** | Organizer answer covering early local refinements and later Codex-prepared inputs applied in Studio; [unsent question](ORGANIZER-QUESTION-DRAFT.md) |
| Mainnet contract | **MISSING** | Separately authorized deployment, independently reviewed artifact/runtime, successful receipt/address and actual explorer link |
| Real mainnet USDC through app/contract | **MISSING** | Separately authorized owner-reviewed app payment; exact successful receipt/event and mainnet explorer link |
| Studio/mainnet walkthrough and public video | **MISSING** | Genuine Studio build coverage and mainnet transaction scene, honest source disclosure, privacy QA, upload and reviewer playback |
| Studio reviewer access | **UNCONFIRMED** | Project sharing/review route verified without assuming the owner's session |
| Identity/team/right-to-submit/prior funding/jurisdiction | **UNCONFIRMED** | Owner's truthful confirmations and any actual form disclosures; a profile URL does not establish these |
| Actual form fields/track/limits | **UNINSPECTED** | Read the real schema after appropriately handling the separate event Disclaimer; no inferred completed fields |
| Organizer Disclaimer / submission | **NOT ACCEPTED / NOT SUBMITTED** | Owner's decision on the actual event terms, final field/link review and explicit final submission evidence |

The 22 October **Submit Build** attempt displayed an Organizer Disclaimer; it was not accepted and **Cancel** was selected. Studio login consent is separate from this event agreement. No registration, field filling or submission acknowledgement is inferred.

## Publication and revision boundary

`4dae47f01bb78126e5c70621d87af0c9899cb9c6` identifies the **deployed application source**, not an anticipated documentation-only commit. This packet is draft submission material. Studio application/hash readback, a repository commit, any new app build/publication, video upload and final DoraHacks submission are separate evidence states; this draft alone does not establish any of them. Record each state only when separately observed. Presence of a draft does not claim that Studio AI generated it or that the organizer accepted its provenance.

Mainnet address remains blank and `MAINNET_WRITES_ENABLED = false`. Preparing text, reviewing evidence or running local simulations does not authorize removing that lock, connecting/funding a mainnet wallet, deployment, a payment, a paid upgrade or an organizer message.
