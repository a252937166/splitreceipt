# Video script — testnet preparation walkthrough

**Purpose:** Narration and scene guide for a roughly 2-minute testnet walkthrough video. This is a preparation document, not a finished recording. The existing private material (18 screenshots sourced 2026-10-21 03:07:44–07:27:21 UTC, waits compressed, silent, no native wallet) is not an actual 54-second continuous walkthrough capture; it does not substitute for a final eligible video because it lacks the required mainnet segment. The official contest page does not state a required continuous-session format; verify recording requirements before shooting.

**Editorial note on duration:** Approximately 2 minutes is a reasonable preparation target. No official minimum or maximum duration has been confirmed from the contest rules; verify before recording.

---

## Scene table

| # | Scene | Narration | Notes |
|---|---|---|---|
| 1 | Title card: "SplitReceipt — Arc Testnet walkthrough" | "SplitReceipt lets a group of friends split a bill and get a verified receipt for every payment — directly from the blockchain, no backend needed." | Static card, 5s |
| 2 | Arc Studio project — contract source open | "The Solidity contract was authored in Arc Studio. The latest UI and receipt-discovery logic were also authored there. Earlier local refinements were synchronized back; provenance is mixed — see the repository's PROVENANCE.md for the full record." | Show SplitReceipt.sol, highlight `payShare` function |
| 3 | Test evidence (historical) | "35 Solidity tests and 256 fuzz runs were verified by independent local tooling on 17 October 2026 — these are historical logs, not a Studio Foundry run. Contract source is unchanged. 36 TypeScript frontend tests are the current CI record." | Show existing dated local test logs; do not present a new run or imply Studio ran the Foundry suite |
| 4 | Open live app — Create bill page | "On the live app, a group member opens Create bill, enters a title, recipient, the payer addresses and the per-person share." | Type a bill title; add two payer addresses; enter 0.001 USDC share; show the live draft receipt preview updating |
| 5 | Create bill — review only, do not submit | "This is a draft. I won't submit this transaction during this recording — no funds are involved in this walkthrough." | Move mouse to Create button but do not click. Show "Draft" badge on preview. |
| 6 | Navigate to Demo receipt — bill 3 | "Here is a real settled bill on Arc Testnet. Both shares have been paid." | Open `?bill=3`. Show Settled badge, 2/2 paid, progress bar full. |
| 7 | Receipt links — expand verification detail | "The app recovers verified receipts from the blockchain. Each one is checked against the live RPC: chain ID, block height, canonical block hash, and the exact SharePaid event." | Click "View receipt" for payer 1. Show collapsible verification detail. |
| 8 | Explorer — open pay 1 transaction | "Here is payer 1's transaction on the Arc Testnet explorer. Status: Success. 0.001 USDC sent, forwarded to the recipient." | Show explorer page for `0xc0d0e3…` |
| 9 | Back to app — refresh / retry receipt history | "If the app loses its receipt history, the Refresh button re-verifies from known hashes first, then scans the contract's event log in bounded pages." | Click Refresh. Wait for 2/2 verified badge to reappear. |
| 10 | Wallet checks page | "The Wallet checks page explains exactly what each transaction sends: a wallet transaction confirmation is required for each payment, but there is no ERC-20 approval step — just a single native USDC transfer." | Show WalletChecks page, expand the "What pay sends" section. |
| 11 | Title card: "Mainnet — not yet recorded" | "A final eligible video will include deploying to Arc mainnet, making a real USDC payment, and verifying it on the mainnet explorer. That segment is pending." | Static card, 5s |

---

## Caption / description draft

> **SplitReceipt** — Shared bills with recoverable USDC payment receipts.
>
> Built in Arc Studio on Arc Testnet. The Solidity contract accepts native USDC with no ERC-20 approval step and forwards each share directly to the recipient. Receipt recovery verifies each payment hash against a live RPC chain of custody before showing it.
>
> This video shows the testnet build. A mainnet deployment and real USDC transfer are required to complete the submission.
>
> Source: https://github.com/a252937166/splitreceipt
> Live demo: https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3
> Studio: https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62

---

## What this script does not include

- No wallet connection or signing during the Create bill scene.
- No new transaction sent during recording.
- No mainnet segment — this remains unrecorded.
- The existing private material (18 screenshots, compressed waits, silent) is retained locally and is not uploaded. It lacks the required mainnet segment and is not a continuous walkthrough capture.
- No public video URL to claim until recording and upload are complete.
