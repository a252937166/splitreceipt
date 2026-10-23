# Submission copy — current draft fields

Updated 23 October 2026. **Draft only: technical mainnet evidence is complete; no DoraHacks form or submission is claimed.** These blocks are not an inspected form schema. Use the current text here instead of the dated Testnet-only description in older material.

The [official round](https://dorahacks.io/hackathon/arc-microgrants-2/detail) was rechecked on 23 October. Its displayed deadline is **2026-11-01 23:59 (UTC−4)**. Actual fields, character limits and track choices remain uninspected. The earlier Organizer Disclaimer was canceled; Studio login consent does not accept that event agreement.

## Project name

SplitReceipt

## Tagline

Shared bills with recoverable USDC payment receipts.

## Stage

Working prototype, publicly deployed on Arc Mainnet; two-person owner-controlled demonstration complete.

## Short description

SplitReceipt turns a shared bill into a shareable record of expected and confirmed USDC payments. A creator chooses one recipient, two to five payer addresses and an equal share. Each payer sends the exact native-USDC amount through the Arc contract, which forwards it directly to the recipient. The public app recovers and verifies receipts against canonical chain data, without a custodial backend or private indexer. The completed mainnet demonstration has two paid shares and two verified receipts.

## Description

Group payment confirmation often lives across chat messages and individual transfer screens. SplitReceipt keeps the intended recipient, each expected share, paid state and receipt together in one bill that readers can inspect without connecting a wallet.

The Solidity contract validates two to five unique payers, accepts an exact share once per payer and forwards payment to the recorded recipient. It uses reentrancy protection; it has no owner withdrawal or upgrade mechanism. The app scopes links, history and wallet actions to the selected network and reviewed deployment. Receipt candidates are verified against successful canonical receipts, the contract and exact `SharePaid` events. Bounded history scanning can recover older receipts, while explicit connector/account/chain checks guard writes when a wallet session changes.

The public mainnet release is `00658175885a03f1fd49d61c56a2ce3ff2f86b82`. [Bill 1](https://splitreceipt.axiqo.xyz/splitreceipt/?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1) is settled with two 0.001-USDC shares. Payer 1 is also the recipient, so its net change is Gas only; payer 2's [payment](https://explorer.arc.io/tx/0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5) sends 0.001 USDC through the application and contract to a distinct recipient wallet. Gross contract shares total 0.002 USDC; net transfer between the two owner-controlled wallets is 0.001 USDC. This is a real small-value demonstration, not customer revenue or independent adoption. A wallet-disconnected page reload showed both verified receipts.

The contract and original app began in Arc Studio; later Studio UI work and testing are recorded. Earlier local refinements and recent Codex-prepared inputs are disclosed. Recent inputs were actually applied/tested through Studio's official manual terminal and checked by exact hashes. Mainnet deployment used the owner's local CLI, not the Studio Contracts panel. This mixed history must not be described as exclusive Studio-AI authorship or assumed to satisfy the organizer's outside-Studio exclusion. [Provenance](../PROVENANCE.md) records the stages.

Current scope is equal-share payment tracking. Variable splits, partial payments, refunds, disputes, identity checks, customer adoption and a professional audit are not demonstrated. The value is a verifiable shared-payment record with recoverable receipts, rather than a full accounting system.

## Required-link candidates

| Item | Value / state |
| --- | --- |
| Live app | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Completed mainnet bill | [Bill 1, settled 2/2](https://splitreceipt.axiqo.xyz/splitreceipt/?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1) |
| Repository | https://github.com/a252937166/splitreceipt |
| Studio project | https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62; independent reviewer access **UNCONFIRMED** |
| Public builder profile | https://github.com/a252937166; public access verified 23 October, not an identity/rights confirmation |
| Deployed application commit | `00658175885a03f1fd49d61c56a2ce3ff2f86b82` |
| Public walkthrough video | **PENDING_PUBLIC_VIDEO**; no public URL has been verified |

## Mainnet contract

`0x8522Ea5A413c8402182fF6998Bd7471bAC886142` — Arc Mainnet **5042**.

[Contract on Arc explorer](https://explorer.arc.io/address/0x8522Ea5A413c8402182fF6998Bd7471bAC886142). Deployment [`0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f`](https://explorer.arc.io/tx/0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f).

## Mainnet transaction example

Use **payer 2's payment**, [`0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5`](https://explorer.arc.io/tx/0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5). It calls `payShare(1)`, sends **0.001 real USDC** and increases recipient `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74` by exactly that amount. Both addresses belong to the owner. This example is the distinct-wallet application payment; the separate wallet-funding transfers are not the requested evidence.

[Sanitized mainnet evidence](../../tests/evidence/mainnet-flow-2026-10-23.json) includes creation, both payments, final paid states, actual Gas and browser limitations. Total Gas across deployment, funding and application flow is **0.02263094 USDC**, below the **0.10** budget. Funding principal **0.10 USDC** is separate. No further real transaction is needed for this demonstration.

## Studio-use disclosure

The original contract and app originated in Arc Studio. Early local refinements were synchronized later; subsequent UI work was Studio-authored. Recent Codex-prepared inputs were actually written/tested in Studio's official manual terminal with exact source readback, followed by identical local adoption and static publication. Deployment used the owner-confirmed local CLI. This is mixed Studio/local history; the organizer's eligibility interpretation and independent Studio reviewer access remain unresolved.

## Suggested tags

Payment splitting; USDC payments; Arc; payment receipts.

These are candidate terms, not selected dropdown options or verified track names.

## Remaining form and video work

The required video walkthrough must show actual Studio build work and the mainnet transaction. **PENDING_PUBLIC_VIDEO** means a private file or partial clip must not be pasted as a public video URL. Verify final playback without the owner's session after authorized publication.

Owner/team/contact, rights to submit, prior Circle/Arc funding and jurisdiction screening remain unconfirmed. Use the owner's actual approved values only in the required private fields. The real form and event disclaimer still need review. The mixed-provenance issue is separate from mainnet success. See [readiness](READINESS.md); no BUIDL ID or submitted status is claimed.
