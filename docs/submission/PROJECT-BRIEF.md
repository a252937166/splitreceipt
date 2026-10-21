# SplitReceipt — Project Brief

**Tagline:** Shared bills with recoverable USDC payment receipts.

---

## Short description (paste-ready)

SplitReceipt turns a shared bill into verifiable USDC payment records. A creator chooses one recipient, two to five payers and an equal share. Each payer sends the exact amount through the contract, which forwards it directly to the recipient. Receipts can be recovered and checked against live chain data without a custodial backend or private indexer. The current demonstration runs on Arc Testnet; test USDC has no monetary value.

---

## Problem

Payment confirmation is often fragmented between group messages and individual transfer screens. The organiser needs one shared view linking each expected share to a confirmed payment and recipient. SplitReceipt provides that bill-level record for its listed payers.

---

## How it works

1. One person creates a bill: title, recipient wallet, the payers (two to five addresses), and the per-person share amount in USDC.
2. The contract records the bill onchain. Each listed payer sends their exact share; the contract forwards it immediately to the recipient.
3. The app recovers a verified receipt for every confirmed payment directly from Arc Testnet event logs — no private database or indexer.
4. Anyone with the bill link can read the settled state. Confirmed payment records can be checked on the test chain while the chain and RPC remain available.

---

## Technical differentiation

- **Native USDC as gas and value.** Arc Testnet uses USDC as its native asset. The contract accepts `msg.value`; payers need no ERC-20 approval step.
- **Recoverable receipts without an indexer.** Phase 1 fast-path verifies known hashes against a live RPC chain of custody: `getChainId`, `getBlockNumber`, `getTransactionReceipt` (status = success), canonical block hash equality, and exact `SharePaid` log field matching. Phase 2 falls back to bounded paged `eth_getLogs` scanning newest-first in bounded pages from recent history; invalidated hashes are purged before fallback runs.
- **Non-custodial.** The contract has no owner, no withdrawal function, and no upgrade path. Shares go directly from the payer's wallet to the recipient in the same transaction.
- **Contract authored in Arc Studio; independently verified tests.** The contract was originally authored in Arc Studio. 35 Solidity tests and 256 fuzz runs were completed by independent local verification on 17 October 2026 (not a proven Studio Foundry run; Studio reported 16 frontend tests at that time under a separate runner). Contract source is unchanged since. 36 TypeScript frontend tests are the current CI record for release `003f005` (16 original plus 20 receipt-discovery tests added during Studio implementation).

---

## Current evidence

| Item | Status |
|---|---|
| Public app | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Demo bill (settled 2/2) | https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3 |
| Source repository | https://github.com/a252937166/splitreceipt |
| Arc Studio project | https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62 |
| CI (latest) | https://github.com/a252937166/splitreceipt/actions/runs/39561037667 |
| Contract (testnet) | `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26` on chain 5042002 |
| Bill 3 live browser read | 21 October 2026 — Settled, 2/2 paid, 2/2 freshly verified receipts |
| App release | `003f005b4030f664dfb95f9ccc79205f14e92b27`, `20261021T071846Z-003f005` |

---

## Current limits

- **Arc Testnet only.** Chain ID 5042002. Test USDC has no monetary value.
- **No mainnet deployment.** A mainnet deployment, mainnet USDC transfer, and mainnet explorer evidence have not been completed. The project is not yet eligible for the Arc Microgrants contest under its current rules.
- **Unaudited prototype.** The contract has not received a professional security audit. Do not use with real funds.
- **No adoption or revenue claimed.** This is a personal experiment. No customers, users or revenue are claimed.
- **Scope.** Two to five unique equal payers. No partial payments, no variable splits, no ERC-20 approval path.

---

## Studio use

The Solidity contract was authored in Arc Studio. The 35 Foundry tests and 256 fuzz runs are independent local verification from 17 October 2026, not a proven Studio Foundry run. The latest UI/design files and receipt-discovery logic were also authored in Studio. The initial Studio deployment path was blocked by a platform policy limit; the unchanged contract was deployed locally via a test-only wallet. Earlier local refinements (dependency isolation, history pagination, wallet handling, public delivery tooling) were developed locally and synchronized back to Studio. Local delivery tooling also exists independently. Provenance is mixed; see [docs/PROVENANCE.md](../PROVENANCE.md) for the full record. No adoption or revenue is claimed. Reimporting to Studio does not prove all work happened there.
