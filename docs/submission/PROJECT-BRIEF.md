# SplitReceipt — project brief

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

**Tagline:** Shared bills with recoverable USDC payment receipts.

## Short description

SplitReceipt turns a shared bill into verifiable payment records on Arc Testnet (22 October description; a separate Arc Mainnet context for one reviewed contract exists since 23 October, see [MAINNET-LIVE.md](../MAINNET-LIVE.md)). A creator chooses one recipient, two to five payers and an equal share. Each payer sends the exact native test-USDC amount through the contract, which forwards it to the recipient. The app recovers and rechecks payment receipts from the chain without a custodial backend or private indexer. Test USDC has no monetary value; as of 22 October there was no mainnet deployment (historical; superseded on 23 October by the verified deployment and Bill 1 in [MAINNET-LIVE.md](../MAINNET-LIVE.md)).

## Product value

Group payment confirmation is often scattered across messages and individual transfer screens. SplitReceipt keeps the expected shares, paid state, recipient and transaction evidence together in one shareable bill. A payer can check which share was paid; an organiser can review the whole bill; a reader can inspect receipts without connecting a wallet.

The demonstrated use is a small equal-share bill, not a full accounting, invoicing or dispute-resolution system. Current limits are two to five unique payer addresses, one fixed recipient and exact equal payments. Partial payments, variable splits, identity checks, refunds and customer adoption are not demonstrated.

## Technical work

- **Direct native-USDC payments.** `payShare` requires the exact `msg.value` and forwards it to the recorded recipient. There is no ERC-20 approval or permit step; a wallet transaction confirmation is still required. The contract has no owner withdrawal or upgrade mechanism.
- **Recoverable, checked receipts.** Known hashes and local/URL hints are only candidates. Successful receipts must match the configured chain/contract, canonical block hash and exact `SharePaid` event. Missing receipts trigger newest-first history scans with bounded pages and continuation. A fixed scan head can require an explicit refresh for later payments.
- **Explicit wallet sessions.** Named discovered providers replace the shared legacy injection slot. Reload does not automatically reconnect. Writes require an acknowledged connector/account/chain snapshot and are blocked if the session changes, including A→B→A during an asynchronous check.
- **Deployment separation.** Testnet is the default; network/chain/contract identity scopes reads, links, hints and writes. The mainnet preparation view has no contract address and a compiled `MAINNET_WRITES_ENABLED = false` lock.
- **Recorded verification.** On 21 October, Studio and independent local checks passed 76 TypeScript tests, typecheck, build and dependency isolation. The separate preparation ran 38 Solidity tests and 256 fuzz runs in Studio and locally. Chain-ID 5042 cases are local-EVM tests, not mainnet execution.

## Current public evidence — checked 22 October 2026

| Item | Record |
| --- | --- |
| Live app | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Latest settled public-wallet retest | [Bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6), 2/2 paid and 2/2 verified receipts |
| Public source | https://github.com/a252937166/splitreceipt |
| Studio project | https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62; independent reviewer access unconfirmed |
| Deployed application source | `4dae47f01bb78126e5c70621d87af0c9899cb9c6` |
| Dedicated-host release | `20261021T192007Z-4dae47f` |
| Exact application-commit CI | https://github.com/a252937166/splitreceipt/actions/runs/39660377061 |
| Testnet contract | [`0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`](https://explorer.testnet.arc.io/address/0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26), chain 5042002 |
| Payment example | [Bill 6 payer 1](https://explorer.testnet.arc.io/tx/0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e) |
| Process media | Private 63-second sampled record; QA complete, not uploaded |

Bill 6 uses owner-controlled demo accounts. It moved 0.002 test USDC in two equal shares, with 0.007650575 test USDC in total gas. App Disconnect plus reload in the same profile retained both verified receipt links; this is not proof of a fresh profile or outside users. The built-in Demo receipt button still opens historical Bill 3.

A future documentation-only commit is separate from the deployed application source above. [Public-flow evidence](../../tests/evidence/public-wallet-flow-2026-10-22.json), [validation](../VALIDATION.md) and the [judge guide](JUDGE-GUIDE.md) provide the detailed boundaries.

## How Studio was used

The contract and original app originated in Studio. Early dependency isolation, history pagination, wallet handling, delivery tooling and some UI refinements were authored locally and later synchronized. Later UI work was Studio-authored. More recent mainnet-preparation and wallet-session inputs were prepared with Codex outside Studio and then actually written/tested through the official Studio manual terminal, with exact terminal/per-file hash readback before adoption. Those steps establish source correspondence, not exclusive Studio-AI authorship or organizer acceptance. See [provenance](../PROVENANCE.md).

## Competition status

The [official round page](https://dorahacks.io/hackathon/arc-microgrants-2/detail) was rechecked on 22 October. It requires Studio development and a live app/contract moving USDC on Arc mainnet before submission; it excludes testnet-only work. SplitReceipt has neither a mainnet deployment nor a mainnet payment and is **not ready for an eligible submission**. Mixed provenance also needs an organizer answer. No professional audit, revenue, public final video or completed contest submission is claimed. See [readiness](READINESS.md) for the remaining gates.
