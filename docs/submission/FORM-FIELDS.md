# Submission copy — draft fields

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

**Draft only; no registration or submission is claimed.** These are proposed content blocks, not an inspected form schema. The 22 October attempt to open **Submit Build** stopped at an Organizer Disclaimer. It was not accepted, **Cancel** was selected, and the underlying fields, limits and track choices remain uninspected. Accepting Studio login terms is a different action and does not imply accepting this event disclaimer.

The [official details page](https://dorahacks.io/hackathon/arc-microgrants-2/detail), checked live on 22 October 2026, displays **2026-11-01 23:59 under UTC−4**. Keep that literal offset; the displayed label must not be silently converted to New York local time. The page requires Studio development and a deployed mainnet app/contract with a USDC movement; testnet-only projects are excluded. The packet below cannot currently satisfy that gate.

## Project name

SplitReceipt

## Tagline

Shared bills with recoverable USDC payment receipts.

## Stage

Prototype / working Arc Testnet demonstration

## Short description

SplitReceipt lets a group create an equal-share bill on Arc Testnet and recover verified receipts for each confirmed payment. A creator records the recipient, two to five payers and their exact share. Each payer confirms a native test-USDC transaction through the contract, which forwards the share directly to the recipient. Receipt recovery checks canonical chain data without a custodial backend or private indexer. Test USDC has no monetary value; this version is not deployed on mainnet.

## Longer description

Use the [project brief](PROJECT-BRIEF.md). It explains the use case, native-value payment contract, receipt verification and bounded history recovery, explicit wallet-session controls, tests, scope limits and mixed Studio/local development history. Do not replace that history with an all-Studio-AI claim.

## Candidate links

| Item | Proposed value / status |
| --- | --- |
| Live app | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Repository | https://github.com/a252937166/splitreceipt |
| Studio project | https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62; independent reviewer access unconfirmed |
| Latest read-only testnet example | [Bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6), settled 2/2 with both receipts |
| Builder profile | https://github.com/a252937166 |
| Deployed application source | `4dae47f01bb78126e5c70621d87af0c9899cb9c6`; a later docs-only commit is separate |

The repository and builder-profile URLs returned public content in an unauthenticated web-reader check on 22 October; those responses used cached pages. This is link availability evidence, not owner identity, team, jurisdiction, prior-funding or eligibility verification. GitHub is one permitted builder-profile option on the details page. A builder profile is separate from a promotional post; no required social promotional post was found in the inspected page. The uninspected form may add fields.

## Testnet contract and example transaction — supplementary only

- Chain: **Arc Testnet 5042002**; no monetary value.
- Contract: [`0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`](https://explorer.testnet.arc.io/address/0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26).
- Bill 6 payer 1: [`0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e`](https://explorer.testnet.arc.io/tx/0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e).
- Each paid share: 0.001 test USDC; two owner-controlled demo payers.

Never paste these testnet values into a required mainnet field.

## Mainnet contract address

**NOT_AVAILABLE** — no mainnet deployment. The published mainnet preview has a blank address and writes locked in source.

## Mainnet example transaction / explorer link

**NOT_AVAILABLE** — no USDC movement on Arc mainnet through the app/contract.

## Public video URL

**NOT_AVAILABLE** — the latest QA-checked private 63-second sampled public-page record has not been uploaded. It lacks Studio-editing and mainnet scenes. See [asset status](LOCAL-ASSETS.md) and [the future video plan](VIDEO-SCRIPT.md).

## Studio-use disclosure

The contract and original app originated in Arc Studio. Early local refinements were synchronized back. Later UI work was authored in Studio. Recent Codex-prepared mainnet/wallet inputs were applied and tested in the official Studio manual terminal with actual hash readback. Source correspondence does not establish that this mixed history is eligible. An organizer answer and reviewer-accessible Studio evidence remain unresolved.

## Suggested tags

Payment splitting; USDC payments; Arc Testnet; payment receipts.

These are candidate terms, not verified dropdown options or confirmed competition tracks.

## Team, contact and personal confirmations

**UNCONFIRMED.** Verify the actual form and ask the owner for required name/roles/contact, jurisdiction, ownership/submission rights, prior Circle/Arc funding and payout-wallet details. Do not infer these from a public profile, test wallet or another project's submission. No private contact or credentials are copied into this generic packet.

## Submission gates

Consult [READINESS.md](READINESS.md) before any final form work. Missing mainnet evidence, the Studio/mainnet walkthrough and public video link, mixed-provenance clarification, Studio reviewer access, personal confirmations and the actual schema/disclaimer remain separate gates. The Disclaimer has not been accepted; no form has been filled or submitted.
