# Evidence index — 23 October 2026

The current demonstration is **Arc Mainnet Bill 1, settled 2/2 with two verified receipts**. Publication, source correspondence, deterministic tests, canonical chain results, public-browser observations, media and competition acceptance are separate evidence states.

## Current public release

| Item | Evidence |
| --- | --- |
| App | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Public builder profile | https://github.com/a252937166; public API access verified 23 October, not an owner-identity attestation |
| Completed mainnet bill | [Bill 1](https://splitreceipt.axiqo.xyz/splitreceipt/?network=mainnet&chainId=5042&contract=0x8522Ea5A413c8402182fF6998Bd7471bAC886142&bill=1) |
| Application source | `00658175885a03f1fd49d61c56a2ce3ff2f86b82` |
| Dedicated-host release | `20261023T083640Z-0065817` |
| Exact-commit CI | [Successful checks/build](https://github.com/a252937166/splitreceipt/actions/runs/39923724591) |
| Public delivery | Four sealed static files; all asset bytes, TLS, network query routes, redirects and remote release identity matched |
| Release manifest SHA-256 | `6b4603779616056a410aad28b43c839b0692efdcfb46bedc9cf61afe398eadb9` |
| Canonical source-map SHA-256 | `3fad7fb62471f78223245d5512f630ffcd1edc0ec2feedc57804cdc878ab75f3`; 143 files at the deployed application revision |

A later documentation/evidence commit is not a redeployed application. GitHub Pages is historical; its automatic deployment was removed from CI. The dedicated project domain is the current demo.

## Mainnet contract and flow

[Deployment record](../../deployments/arc-mainnet.json), [current status](../MAINNET-LIVE.md) and [sanitized machine-readable flow](../../tests/evidence/mainnet-flow-2026-10-23.json).

| Evidence | Public link / result |
| --- | --- |
| Contract, Arc Mainnet 5042 | [`0x8522Ea5A413c8402182fF6998Bd7471bAC886142`](https://explorer.arc.io/address/0x8522Ea5A413c8402182fF6998Bd7471bAC886142) |
| Reviewed runtime hash | `0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b` |
| Deployment, block 27419618 | [`0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f`](https://explorer.arc.io/tx/0x65f5a438a7a7e7dd068e53a7fd06e5af02f733dc25f4c250178425c1da00962f) |
| Bill creation, block 27428463 | [`0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9`](https://explorer.arc.io/tx/0x389acbe376e7adb426efbd66095dbea24b764b21f6a9c214874d14546473eee9) |
| Payment 1, block 27429239 | [`0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716`](https://explorer.arc.io/tx/0x06da59bcccdc87f96970ae89753e9d640bb3c97b2620877f06e9673e487b3716) |
| Payment 2, block 27444837 | [`0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5`](https://explorer.arc.io/tx/0xf246c9ed15463fd871c96e9da353ffd183b6ff31c0b1b940982c86d09f56d5e5) |
| Final contract state | Two payers, share 0.001 USDC, paid states `[true, true]` |
| Distinct-wallet balance proof | Payer 2 loses 0.001 USDC plus Gas; recipient gains exactly 0.001 USDC |
| Public read-only UI | After wallet disconnect/reload: Connect wallet, Settled, 2/2 paid, 2/2 receipts verified; both mainnet hashes match |

All three app receipts were successful and canonical; call identity, exact value and events matched. Runtime identity was checked with final payment. Payer 1 equals the recipient, so the first share's net principal movement is zero. Gross app shares **0.002 USDC** and net inter-wallet movement **0.001 USDC** must not be conflated. The accounts are owner-controlled demonstration identities, not customers, independent users or revenue.

Gas: deployment/funding **0.01616992 USDC** plus app flow **0.00646102** = **0.02263094**, leaving **0.07736906** of the **0.10** cap. Funding principal **0.10 USDC** is separate. No more real transaction is needed for the completed technical demonstration.

## Studio, source and deterministic checks

| Record | What it establishes / limit |
| --- | --- |
| [Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62) | Actual origin/workspace URL; independent reviewer access unconfirmed |
| [Provenance](../PROVENANCE.md) | Original Studio source, dated UI work, earlier local refinements and recent externally prepared/manual-terminal inputs; no exclusive Studio-AI claim |
| 23 October actual Studio/local verification | 80 TypeScript tests, typecheck, build and isolated dependencies passed; deployed 143-file map matched exact adopted source |
| Exact-commit CI above | Check/build success for `00658175885a03f1fd49d61c56a2ce3ff2f86b82`; not a claim that CI deployed the dedicated site |
| [21 October contract preparation](../../tests/evidence/mainnet-preparation-2026-10-21.json) | Separate 38 Solidity tests / 256 fuzz runs, local-EVM cases; not newly run for this document change |
| [17 October source readback](../../tests/evidence/studio-source-readback-2026-10-17.json) | Historical 20/22 exact synchronized paths, two disclosed sandbox adaptations |
| [17 October UI readback](../../tests/evidence/studio-ui-source-readback-2026-10-17.json) | Historical exact UI/helper synchronization, not current whole-source archive |

Recent pin/docs inputs were actually applied in the official Studio manual terminal and checked by hashes; the inputs were externally prepared. Deployment used the owner's local CLI. These facts do not resolve the organizer's outside-Studio exclusion. No new complete Studio ZIP or Studio-AI generation is inferred from the later manual-terminal work.

## Historical Testnet material

[Bill 6 public-wallet evidence](../../tests/evidence/public-wallet-flow-2026-10-22.json) remains a separate complete Testnet demonstration on chain **5042002**, not evidence of mainnet USDC. Historical source `4dae47f01bb78126e5c70621d87af0c9899cb9c6`, release `20261021T192007Z-4dae47f`, its 76-test checkpoint and older private media are superseded for the current app release. The built-in Demo receipt remains historical Testnet Bill 3.

## Media and submission

Public video URL: **PENDING_PUBLIC_VIDEO**. The private two-of-two Studio/browser evidence edit has completed QA: **175.266667 seconds, 1920×1080, H.264, 30 fps, silent**; SHA-256 `dcf190e1ac38fb50575b9e06a4be97ff3da9c8776785393b1d16c23923e6c0c9`. It remains unpublished. The earlier partial one-of-two mainnet clip is historical; it is not the final settled proof or a public video. Captures use sampled milestones with compressed waits. Native wallet final confirmations were not directly recorded. No public upload or reviewer playback is claimed.

The [official rules](https://dorahacks.io/hackathon/arc-microgrants-2/detail) were rechecked on 23 October. Displayed deadline: **2026-11-01 23:59 (UTC−4)**. Studio-built app/contracts, mainnet USDC, Studio URL, repo, builder profile and a Studio/mainnet walkthrough are required. Mainnet technical gates now have evidence. The public video, Studio reviewer access, actual form/disclosures/agreements and mixed-provenance eligibility remain open. No form submission or organizer acceptance is claimed. See [current field copy](FORM-FIELDS.md), [judge guide](JUDGE-GUIDE.md) and [readiness](READINESS.md).

## 23 October 2026: replacement-rebuild candidate (not published)

The sections above describe the deployed public release (application commit `00658175885a03f1fd49d61c56a2ce3ff2f86b82`) and the mainnet evidence, and are unchanged. The Studio replacement-rebuild candidate is a separate, unpublished source state: see [the rebuild record](../STUDIO-REIMPLEMENTATION-2026-10-23.md) (files, protected hashes, review rounds, checks, limits), [validation](../VALIDATION.md) and [provenance](../PROVENANCE.md). It is not deployed, uploaded, formally submitted or approved; an independent operator observed the embedded Studio Preview working on 23 October (17:58–18:01 UTC; create form and wallet chooser only, no wallet connection or transaction; the earlier "Connecting to sandbox" failure is dated history), while public-browser and real-wallet QA are pending. No public video link exists; the final film is being prepared.
