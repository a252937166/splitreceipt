# Evidence index

This index maps each verifiable claim to its supporting evidence and states the boundary of each record.

---

## App release (current)

| Item | Value |
|---|---|
| Commit | `003f005b4030f664dfb95f9ccc79205f14e92b27` |
| Release label | `20261021T071846Z-003f005` |
| Six UI/design source files | Adopted as exact Studio-export bytes |
| ZIP SHA-256 | `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14` |
| Public app | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Demo bill | https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3 |

---

## CI and automated checks

| Check | Record | Scope |
|---|---|---|
| Latest CI run | https://github.com/a252937166/splitreceipt/actions/runs/39561037667 | Typecheck, 36 frontend tests, build, dependency isolation — current source at `003f005` |
| Historical CI (17 Oct) | https://github.com/a252937166/splitreceipt/actions/runs/39031619289 | Passed for commit `566a2f24d2faee88d441115d92127e01685058e9` (white/blue UI) |

**Frontend test count:** 36 total — 16 original (history pagination ×8, creation receipts ×5, integer amounts ×3) plus 20 receipt-discovery tests added during Studio implementation.

**Solidity tests:** 35 tests, 256 fuzz runs. Run date: 17 October 2026. Not rerun in latest UI round; source unchanged since original authoring.

---

## Onchain evidence

All transactions are on Arc Testnet, chain ID 5042002. Test USDC only; no real value.

| Event | Transaction hash | Explorer link |
|---|---|---|
| Contract deployment | `0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac` | https://explorer.testnet.arc.io/tx/0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac |
| Bill 3 create | `0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7` | https://explorer.testnet.arc.io/tx/0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7 |
| Bill 3 pay 1 | `0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4` | https://explorer.testnet.arc.io/tx/0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4 |
| Bill 3 pay 2 | `0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9` | https://explorer.testnet.arc.io/tx/0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9 |
| Bill 4 create (new domain) | `0x0834d17d37afc7fa267bc84648e34ebdf973433b72597db5e64a75018b20d826` | https://explorer.testnet.arc.io/tx/0x0834d17d37afc7fa267bc84648e34ebdf973433b72597db5e64a75018b20d826 |

Bill 4 create transaction succeeded on testnet; direct user confirmed manual wallet approval with no malicious warning shown. This absence is user-reported for the createBill step only; native wallet pixels were not captured. payShare confirmation on the new domain has not been retested.

---

## Live browser readback (current)

| Date | What was observed | Source |
|---|---|---|
| 21 October 2026 | Bill 3 — Settled, 2/2 paid, 2/2 freshly verified receipts | Operator browser observation (existing authorized account auto-restored; no new connection initiated). Bill 4 warning absence is user-reported only. |
| 18 October 2026 | Bill 3 — Settled, 2/2 paid, 2/2 receipts; RPC read at head 67810050 | Read-only public RPC; independent verification; anonymous (no wallet connected) |

The 21 October readback reflects current app release `003f005` with the light/forest UI. The 18 October RPC verification predates the current UI but the chain data is unchanged.

---

## Historical checkpoints (superseded but preserved)

| Date | Release | UI | Notes |
|---|---|---|---|
| 18 October 2026 | `20261018T080938Z-dd5013b` | White/blue | INITIAL dedicated hosting checkpoint; 4 files / 608,328 bytes; manifest SHA `21ff2a60…` |
| 17 October 2026 | Commit `566a2f24` | White/blue | Initial public deployment; Studio readback SHA `336844d1…` |

---

## Screenshots and recordings

Three current UI screenshots were taken during the earlier 21 October UI release QA (before this documentation session). This documentation session has separate manually-triggered milestone screenshots; these are not fixed 2-second continuous samples.

The earlier private material consists of 18 screenshots, including portrait captures, with no native wallet footage. A separate 54-second 1920×1080 MP4 was assembled from those screenshots and has no audio track. The source screenshots were captured 2026-10-21 03:07:44.480Z–07:27:21.315Z with waits compressed. This is not an actual 54-second continuous walkthrough capture. No public video URL exists. All visual material is retained privately; filesystem paths are not cited here.

---

## What this index does not claim

- No mainnet deployment or mainnet USDC transfer.
- No completed competition submission.
- No professional security audit.
- Creation and first payment for bill 3 were signed off-camera; bill 3 second payment used a disposable test-account helper. Chain success does not prove wallet software or continuous signing footage.
- No references to scratchpad or ephemeral Studio files that are not in the public repository.
