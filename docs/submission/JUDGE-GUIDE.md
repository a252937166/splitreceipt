# Judge guide — completed mainnet demonstration

Updated 23 October 2026. This guide verifies the public product and already completed mainnet transactions. **No wallet connection, new transaction or funds are needed to read it.** Submission and mixed-provenance acceptance remain separate.

## Read the settled mainnet bill

Open [Mainnet Bill 1](https://splitreceipt.axiqo.xyz/splitreceipt/?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1). The explicit network/chain/contract query selects the reviewed Arc Mainnet deployment; a blank link or the built-in Demo receipt selects historical Testnet material.

The public wallet-disconnected reload showed:

- **Arc Mainnet 5042**, Bill **1**, title **SplitReceipt mainnet demo**.
- **0.001 USDC per payer**, total gross shares **0.002 USDC**.
- **Settled**, **2 of 2 paid**, **2/2 receipts verified**.
- Receipt links matching the two payment hashes below and a **Connect wallet** control.

Recipient/payer 1 is `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74`. Payer 2 is `0xA944Fe45F10C61F94F8d6a17274673dd1FB51A7c`. Both belong to the owner. The browser readback followed disconnect and page reload in the existing environment; a new profile or cleared local cache was not claimed. If the public RPC is temporarily unavailable, use **Refresh bill**; **Continue receipt history** advances bounded receipt scans when offered. A paid-state count is distinct from the verified-receipt count.

## Inspect real USDC movement

Mainnet contract: [`0x8522Ea5A413c8402182fF6998Bd7471bAC886142`](https://explorer.arc.io/address/0x8522Ea5A413c8402182fF6998Bd7471bAC886142). The exact deployment/runtime was independently reviewed and matched onchain.

| Operation | Canonical successful transaction | Block | Value (USDC) | Gas (USDC) |
| --- | --- | --- | --- | --- |
| Deploy | [`0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f`](https://explorer.arc.io/tx/0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f) | 27419618 | 0 | 0.01532992 |
| Create Bill 1 | [`0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9`](https://explorer.arc.io/tx/0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9) | 27428463 | 0 | 0.00372428 |
| Pay share 1 | [`0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716`](https://explorer.arc.io/tx/0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716) | 27429239 | 0.001 | 0.00131944 |
| **Pay share 2 — distinct-wallet example** | [`0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5`](https://explorer.arc.io/tx/0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5) | 27444837 | 0.001 | 0.00141730 |

Each `payShare(1)` passes exactly `1000000000000000` native atoms, using 18 decimals. Canonical receipt/block checks, exact sender/target/calldata/value, matching `SharePaid` events and final `[true, true]` paid states all passed. Payer 2's transfer increased the recipient balance by **0.001 USDC** and reduced the payer by **0.001 plus Gas**.

Payer 1 is also the recipient, so that first share returns to its sender and its net wallet change is only Gas. Gross contract shares are 0.002 USDC; net transfer between the two wallets is 0.001 USDC. Wallet-funding transfers are not app-payment evidence. No external customer, revenue or independent-user claim is made. See [sanitized evidence](../../tests/evidence/mainnet-flow-2026-10-23.json).

## Verify source and checks

Repository: https://github.com/a252937166/splitreceipt. Deployed application source: `00658175885a03f1fd49d61c56a2ce3ff2f86b82`; dedicated-host release `20261023T083640Z-0065817`. [CI for this exact commit](https://github.com/a252937166/splitreceipt/actions/runs/39923724591) passed install/isolation/typecheck/tests/build and performs no Pages publication. Separate public static/TLS readback matched this release.

Actual 23 October Studio and independent local checks passed **80 TypeScript tests**, typecheck, production build and dependency isolation. **38 Solidity tests and 256 fuzz runs** were separately recorded on 21 October, including local-EVM mainnet-preparation cases. They are not a fresh Solidity rerun for this documentation update and are not the source of the real mainnet success claim.

From the repository root, using Node 22.23.1 and npm 10.9.8:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:isolation
npm run check
```

With Foundry available, `npm run contracts:test` runs the local contract suite from the repository root. These verification commands do not request a mainnet transaction.

## Review Studio and provenance

[Arc Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Independent reviewer access is **UNCONFIRMED**; the URL alone does not prove access without the owner's session.

The original contract/app originated in Studio, with later Studio UI work and tests. Early local refinements and recent externally prepared inputs remain disclosed. Recent inputs were actually written/tested through Studio's official manual terminal and adopted with exact hashes. Mainnet deployment used an owner-confirmed local CLI, not the Studio Contracts panel. Source correspondence does not establish exclusive Studio-AI authorship or acceptance under the outside-Studio exclusion. See [provenance](../PROVENANCE.md).

## Media and remaining boundaries

Public walkthrough URL: **PENDING_PUBLIC_VIDEO**. The private Studio/mainnet evidence edit has completed QA (**175.266667 seconds, 1920×1080, H.264, 30 fps, silent**) and remains unpublished. The earlier one-of-two clip is a partial historical checkpoint. The captures are manually sampled Studio/public-browser milestones with waits compressed; they do not show native wallet final confirmations or claim continuous recording.

Total actual Gas for deployment, two funding transfers, bill creation and two shares is **0.02263094 USDC**. Funding principal 0.10 USDC is separate. No new payment is needed for this review. No professional audit, production readiness, organizer acceptance, public final-video playback or completed DoraHacks submission is claimed. See [readiness](READINESS.md).
