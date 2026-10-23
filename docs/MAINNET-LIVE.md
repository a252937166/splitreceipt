# SplitReceipt — current mainnet status

Updated 23 October 2026. **The public mainnet demonstration is complete: Bill 1 is settled, with two paid shares and two verified receipts. The competition submission is still incomplete.**

## Public application and contract

- [Open the completed mainnet bill](https://splitreceipt.axiqo.xyz/splitreceipt/?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1) without connecting a wallet.
- Application: [SplitReceipt](https://splitreceipt.axiqo.xyz/splitreceipt/); deployed source `00658175885a03f1fd49d61c56a2ce3ff2f86b82`, dedicated-host release `20261023T083640Z-0065817`. Public static bytes, TLS, network-query routes and redirects matched the sealed release. A later documentation-only commit does not change this deployed application revision.
- Network: **Arc Mainnet 5042**. Native USDC uses **18 decimals** for payment value and Gas.
- Contract: [`0x8522Ea5A413c8402182fF6998Bd7471bAC886142`](https://explorer.arc.io/address/0x8522Ea5A413c8402182fF6998Bd7471bAC886142).
- Deployment: [`0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f`](https://explorer.arc.io/tx/0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f), block **27419618**; deployment Gas **0.01532992 USDC**.
- Runtime keccak256: `0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b`. The reviewed creation/runtime/ABI were independently reproduced using solc 0.8.28, Paris and optimizer 200. Runtime identity was checked again with the final payment.

The application pins that chain, contract, deployment block, runtime hash and deployment hash. Mainnet writes require fresh RPC identity checks and an explicitly acknowledged matching wallet session. Blank/legacy links still select Arc Testnet 5042002; **Demo receipt** remains historical Testnet Bill 3. Use the explicit mainnet link above for this demonstration.

## Completed application flow

Bill **1**, **SplitReceipt mainnet demo**, names recipient `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74` and two payer addresses. Each share is **0.001 real USDC**.

| Operation | Mainnet transaction | Block | Gas (USDC) |
| --- | --- | --- | --- |
| Create bill; payment value 0 | [`0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9`](https://explorer.arc.io/tx/0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9) | 27428463 | 0.00372428 |
| Payer 1 | [`0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716`](https://explorer.arc.io/tx/0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716) | 27429239 | 0.00131944 |
| Payer 2 | [`0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5`](https://explorer.arc.io/tx/0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5) | 27444837 | 0.00141730 |

Canonical readback verified successful receipts, target, sender, exact call/value, canonical block hashes, matching events, reviewed runtime and final paid states `[true, true]`. The second transaction above forwards 0.001 USDC back to its sender because payer 1 is also the recipient; that account's net change is Gas only. **Payer 2's payment is the distinct-wallet example:** `0xA944Fe45F10C61F94F8d6a17274673dd1FB51A7c` paid through `payShare(1)`, and the recipient's balance increased by exactly **0.001 USDC**.

The contract accepted **0.002 USDC in gross shares**; net transfer between the two wallets is **0.001 USDC**. Both wallets are owner-controlled demonstration accounts, not customers, external users or revenue. Wallet funding transfers are separate setup activity, not application-payment evidence.

After disconnecting the wallet and reloading the public bill, the browser showed **Connect wallet**, **2 of 2 paid**, **2/2 receipts verified** and both correct mainnet receipt links. This does not claim a fresh browser profile or cleared local storage. See the [sanitized public evidence](../tests/evidence/mainnet-flow-2026-10-23.json) and [judge guide](submission/JUDGE-GUIDE.md).

## Actual Gas and principal

| Item | USDC |
| --- | --- |
| Deployment and two funding-transfer Gas fees | 0.01616992 |
| App creation and two payment Gas fees | 0.00646102 |
| **Total Gas spent** | **0.02263094** |
| Approved Gas budget | 0.10 |
| **Unused Gas budget** | **0.07736906** |

Funding principal **0.10 USDC** (0.08 / 0.02) was transferred to the owner's demonstration accounts and is separate from Gas. The app's two 0.001-USDC shares are also principal, not fees. No additional paid service was purchased. No more deployment or payment is needed to finish this technical demonstration. A budget allowance is not a request to spend the remainder.

The owner confirmed the setup batch and the wallet transactions. Native-wallet final confirmations were not directly recorded, and this material does not claim otherwise.

## Source verification and provenance

[Exact application-commit CI](https://github.com/a252937166/splitreceipt/actions/runs/39923724591) passed checks and build. Actual 23 October Studio and independent local runs passed typecheck, **80 TypeScript tests**, production build and dependency isolation. The separate **38 Solidity tests / 256 fuzz runs** were recorded during 21 October preparation; they were not freshly rerun for this documentation update. Those local-EVM tests are separate from the real mainnet receipts above.

The original app and contract began in [Arc Studio](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Earlier local refinements remain in the history. Recent mainnet inputs were prepared outside Studio, actually written/tested through Studio's official manual terminal and adopted with exact source hashes. Mainnet deployment used the owner-confirmed local CLI, not Studio's Contracts panel. No private key was uploaded to Studio, the website or public repository. This establishes correspondence and a working deployment, not exclusive Studio-AI authorship. See [provenance](PROVENANCE.md).

## Submission status

**Public video: PENDING_PUBLIC_VIDEO.** A private Studio/mainnet evidence edit has completed QA: **175.266667 seconds, 1920×1080, H.264, 30 fps, silent**. It has no public URL or independent public playback. The earlier one-of-two clip is a historical checkpoint. Captures are sampled milestones with compressed waits, not continuous recording or native-wallet signing footage.

The [official round](https://dorahacks.io/hackathon/arc-microgrants-2/detail), checked 23 October, requires development in Studio across the build and excludes outside-Studio projects. Acceptance of this mixed Studio/local history remains **unresolved**. Independent Studio reviewer access, a publicly playable walkthrough, owner/form disclosures, the actual form schema and event agreements remain open. No organizer acceptance, formal submission, professional audit or production-readiness claim is made. See [readiness](submission/READINESS.md).

## Note added 23 October 2026 (rebuild candidate)

The counts and source revision above describe the deployed application commit. A separate, unpublished Studio replacement-rebuild candidate is recorded in [the rebuild record](STUDIO-REIMPLEMENTATION-2026-10-23.md). No new mainnet transaction or deployment was made for it; the evidence on this page is unchanged.
