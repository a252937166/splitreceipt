# Evidence index

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

**Updated 22 October 2026.** This index separates application publication, Studio source correspondence, tests, chain receipts, browser observations and private media. A documentation-only commit does not update the deployed app SHA.

## Current deployed application

| Item | Record |
| --- | --- |
| Application source commit | `4dae47f01bb78126e5c70621d87af0c9899cb9c6` |
| Dedicated-host release | `20261021T192007Z-4dae47f` |
| Public app | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Latest completed public-wallet retest | [Bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6) |
| Exact commit CI | https://github.com/a252937166/splitreceipt/actions/runs/39660377061 |
| Public delivery | Four static files, 652,054 bytes; independent public asset, server-release, HTTPS/TLS and redirects readback matched |

GitHub Pages CI deployment and Dogyun publication are separate records. The dedicated domain is the primary demo; the old GitHub Pages hostname is historical.

## Source and deterministic verification

| Record | What it establishes | Limit |
| --- | --- | --- |
| [Provenance](../PROVENANCE.md) | Studio origin; dated archive/terminal/per-file correspondence; early local and recent Codex-prepared contributions | Mixed history is not exclusively Studio-authored; no organizer acceptance |
| [17 October source readback](../../tests/evidence/studio-source-readback-2026-10-17.json) | 20/22 synchronized paths identical, two documented dev-host adaptations | Historical source archive |
| [17 October UI readback](../../tests/evidence/studio-ui-source-readback-2026-10-17.json) | Six exact synchronized UI/helper paths | Historical UI archive |
| 21 October light/forest ZIP | Six UI/design files, SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14` | Earlier `003f005` release, not current full-source ZIP |
| [21 October mainnet preparation](../../tests/evidence/mainnet-preparation-2026-10-21.json) | Actual Studio terminal export `28f93fdd46c74e23566a926daf4f639294249008d7f1237f43ebdae1aea43454`; 67 TypeScript/38 Solidity tests, 256 fuzz runs, build/isolation/unsigned generation | Dated phase; its no-wallet-test and unpublished flags describe that checkpoint |
| Latest wallet refinement | Actual 11-file Studio hash readback plus identical sealed-input adoption; Studio/local typecheck, 76 TypeScript tests, build/isolation | Per-file source adoption, not a fresh full-source ZIP |
| [Current public-flow summary](../../tests/evidence/public-wallet-flow-2026-10-22.json) | Latest source/CI, Bill 6 chain/UI and media metadata | Sanitized curated summary; no native wallet signature footage |

The current 76-test TypeScript count comes from observed 21 October Studio and independent local runs. The exact application-commit CI's test step also passed. The 38 Solidity tests and 256 fuzz runs were completed separately during preparation; chain-5042 cases execute locally, not on mainnet. Older 16-, 35- and 36-test counts remain dated history.

## Bill 6 — current complete testnet example

Chain 5042002; contract `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`. Title **Public wallet retest 2026-10-22**. Recipient/payer 1 `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74`; payer 2 `0xA944Fe45F10C61F94F8d6a17274673dd1FB51A7c`. Two shares of 0.001 test USDC, both paid.

| Event | Explorer |
| --- | --- |
| Creation | https://explorer.testnet.arc.io/tx/0x9fc1c8409b65668fadbcc04ec3e5e1c099328293eabca58d13e1cfb30f8e40f4 |
| Payment 1 | https://explorer.testnet.arc.io/tx/0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e |
| Payment 2 | https://explorer.testnet.arc.io/tx/0x0a5bed3b9d6f33bce647cbce41b99212add66b47a9917ecac3dcb170a4f5a2fd |

Canonical chain readback checked the runtime, successful receipts, call data/value, block hashes, matching events and `[true, true]` paid states. Total gas: **0.007650575 test USDC**; principal: **0.002 test USDC**. The creation hash comes from chain/scenario evidence, not a fully visible creation-hash screenshot.

The 22 October public UI showed settled 2/2 and both verified receipts. App Disconnect plus reload retained both in the same profile and showed Connect wallet. No new-profile/empty-cache claim is made. Historical Bills 3 and 5 also read back 2/2 on this release. The owner reported no security warning for creation and payment 2; payment 1's native signature and warning were not observed. Captured MetaMask listener/orphan-stream warnings remained.

## Historical chain and release checkpoints

| Checkpoint | Evidence / boundary |
| --- | --- |
| Testnet deployment | [Transaction](https://explorer.testnet.arc.io/tx/0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac), block 67660831; unchanged Studio-origin contract, deployed by local test-only wallet after Studio policy limit |
| Bill 2, 17 October | [Create proof](../../tests/evidence/browser-wallet-bill2-create.json), [final proof](../../tests/evidence/browser-wallet-bill2-final.json); local MetaMask flow plus helper-paid second share |
| Bill 3, 18 October | Built-in demo; [create](https://explorer.testnet.arc.io/tx/0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7), [pay 1](https://explorer.testnet.arc.io/tx/0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4), [pay 2](https://explorer.testnet.arc.io/tx/0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9); 0.002 test-USDC principal, 0.007712475 gas; second share used helper, not MetaMask |
| Bill 4 | [Create](https://explorer.testnet.arc.io/tx/0x0834d17d37afc7fa267bc84648e34ebdf973433b72597db5e64a75018b20d826); owner-reported no-warning create observation, not the later complete Bill 6 flow |
| Initial white/blue hosting, 18 October | `20261018T080938Z-dd5013b`; 4 files/608,328 bytes; manifest SHA-256 `21ff2a604925a5e6b09f8cd623dca6b3848147ab67340eaae0387c4853c35215` |
| Earlier light/forest hosting, 21 October | `003f005b4030f664dfb95f9ccc79205f14e92b27`, `20261021T071846Z-003f005`; [historical CI](https://github.com/a252937166/splitreceipt/actions/runs/39561037667), 36 TypeScript tests; superseded application revision |

## Media

Latest private media: `SplitReceipt-Studio-public-wallet-release-testnet-sampled-20261022.mp4`, SHA-256 `144b70d5cb3d072a9710ce2de0f6ee9dd0e63ddfe6487c32e14b9142ae4601a4`. It is **63 seconds, 1920×1080, H.264, 30fps, 1,890 frames, silent**, assembled from **21 milestone screenshots**, captured 21 October 19:14:10.902–22 October 06:36:12.928 UTC. Waits are compressed. Original/decoded sample review, full decode, timing, privacy and immutability QA passed.

This is noncontinuous supporting public-page process material, not the final competition video. It contains no Studio editing or native wallet screens, proves no new Studio-AI generation and has no public URL. The earlier 54-second/18-screenshot record is separate historical material. See [LOCAL-ASSETS.md](LOCAL-ASSETS.md) and [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md).

## Rules and remaining evidence

The [official page](https://dorahacks.io/hackathon/arc-microgrants-2/detail) was checked live on 22 October: deadline displayed **2026-11-01 23:59 (UTC−4)**; Studio development and mainnet app/contract/USDC movement required. Public builder profile is required; a promotional social post was not explicitly required on the inspected details page. Mixed-provenance acceptance, Studio reviewer access, actual form schema and owner confirmations remain unresolved. The Organizer Disclaimer was canceled, not accepted. Mainnet evidence and a public Studio/mainnet walkthrough are absent. See [READINESS.md](READINESS.md).
