# Judge guide

This guide describes how to verify the project's current testnet state without connecting a wallet or sending a transaction.

---

## Read the demo bill (no wallet required)

Open the settled demo bill directly:

**https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3**

You should see:

- Bill title: **Published UI retest - testnet**
- Status: **Settled**
- Each pays: **0.001 USDC** · Total: **0.002 USDC** · Paid: **2 / 2**
- Two payer rows, each marked Paid with a verified receipt link
- Explorer links for both payment transactions

No wallet connection, account, or test funds are needed to read this page.

---

## Verify receipts onchain

Both payment transactions are public on Arc Testnet explorer:

| Event | Transaction |
|---|---|
| Bill created | https://explorer.testnet.arc.io/tx/0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7 |
| Payer 1 paid | https://explorer.testnet.arc.io/tx/0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4 |
| Payer 2 paid | https://explorer.testnet.arc.io/tx/0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9 |

Contract address: [`0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`](https://explorer.testnet.arc.io/address/0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26)

Each SharePaid transaction sent exactly 0.001 native test USDC and forwarded it to recipient `0x7c50fF360EE4Ee53097ADFb6D0a464c2E9F77336`.

---

## Verify source and tests

The public repository contains the full source:

**https://github.com/a252937166/splitreceipt**

Current app release commit: `003f005b4030f664dfb95f9ccc79205f14e92b27`

The latest CI run includes typecheck, 36 frontend tests, production build and dependency isolation:

**https://github.com/a252937166/splitreceipt/actions/runs/39561037667**

To run checks locally:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test           # 36 tests: history, receipts, amounts
npm run build
```

Solidity tests (35 tests, 256 fuzz runs, run date 17 October 2026) run separately via Foundry. Foundry must be installed. From the repository root:

```sh
npm run contracts:test
# or equivalently: forge test  (from the repository root)
```

---

## Arc Studio project

The Studio project is at:

**https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62**

Note: the Studio URL opens the project owner's workspace. Whether a reviewer without an owner session can browse it is unverified; no reachability assumption should be made. Source code is fully available in the public repository instead.

---

## Provenance and validation records

- [Source and deployment provenance](../PROVENANCE.md)
- [Validation record](../VALIDATION.md)
- [MetaMask site review](../METAMASK-SITE-REVIEW.md)
- [Evidence index](EVIDENCE-INDEX.md)
- [Design reference](../DESIGN.md)

---

## What this build does not include

- No mainnet deployment or mainnet USDC transfer.
- No competition submission has been made.
- No professional security audit.
- Creation and first payment for bill 3 were signed off-camera; second payment used a disposable test-account helper. Chain success does not prove wallet software or continuous signing footage.
- Studio project access for a reviewer without an owner session is unverified. The repository, CI and explorer links are the auditable public record.
