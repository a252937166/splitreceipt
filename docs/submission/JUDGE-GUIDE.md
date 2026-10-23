# Judge guide — current testnet demonstration

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

This guide verifies the public prototype without requesting a wallet connection or a new transaction. It is a testnet review path, not an eligible-mainnet submission claim.

## Read Bill 6 without a wallet

Open [the latest completed public-wallet retest](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6). The 22 October 2026 readback showed:

- Title: **Public wallet retest 2026-10-22**.
- Chain: **Arc Testnet 5042002**; test USDC has no monetary value.
- Recipient and payer 1: `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74`.
- Payer 2: `0xA944Fe45F10C61F94F8d6a17274673dd1FB51A7c`.
- Each share **0.001 test USDC**; total **0.002**; **Settled, 2/2 paid**.
- Two payment receipt links and **2/2 receipts verified**.

No wallet or funds are needed for reading. A temporary RPC failure or an older fixed-head history run can delay links; **Refresh bill** starts fresh verification, and **Continue receipt history** advances bounded history scanning when offered. A paid-state count and a verified receipt count are different indicators.

The app's built-in **Demo receipt** button still opens [historical Bill 3](https://splitreceipt.axiqo.xyz/splitreceipt/?bill=3). It was also read back with both receipts on the new release; do not confuse its older transactions with Bill 6.

## Inspect the public chain evidence

Contract: [`0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`](https://explorer.testnet.arc.io/address/0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26). All three transactions below succeeded on chain 5042002.

| Operation | Transaction | Block | Gas fee (test USDC) |
| --- | --- | --- | --- |
| Bill 6 creation | [`0x9fc1c8409b65668fadbcc04ec3e5e1c099328293eabca58d13e1cfb30f8e40f4`](https://explorer.testnet.arc.io/tx/0x9fc1c8409b65668fadbcc04ec3e5e1c099328293eabca58d13e1cfb30f8e40f4) | 68476739 | 0.00422965 |
| Payer 1 | [`0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e`](https://explorer.testnet.arc.io/tx/0x4ac7376f58da853c8e020db7a7a4b2b9545dcb41b44ec62da7a815160d875f4e) | 68476809 | 0.0016493 |
| Payer 2 | [`0x0a5bed3b9d6f33bce647cbce41b99212add66b47a9917ecac3dcb170a4f5a2fd`](https://explorer.testnet.arc.io/tx/0x0a5bed3b9d6f33bce647cbce41b99212add66b47a9917ecac3dcb170a4f5a2fd) | 68478093 | 0.001771625 |

Creation sends zero payment value. Each `payShare(6)` sends exactly `1000000000000000` native atoms (0.001 test USDC, 18 decimals). Independent canonical readback checked runtime identity, sender/target/call data/value, successful receipts, canonical block hashes, matching `BillCreated`/`SharePaid` events and both paid states. Total gas was 0.007650575 test USDC. See [the sanitized evidence](../../tests/evidence/public-wallet-flow-2026-10-22.json).

The public page showed creation 0/2, first payment 1/2, then second payment 2/2 with both receipts. After app Disconnect and reload in the **same browser profile**, it still showed both verified receipts and Connect wallet. Local hints/storage were not cleared; this is not a clean-profile test.

## Verify source and tests

Repository: https://github.com/a252937166/splitreceipt. Deployed application source: `4dae47f01bb78126e5c70621d87af0c9899cb9c6`; dedicated-host release `20261021T192007Z-4dae47f`. Any later documentation-only commit is a separate repository revision, not proof of a new app deployment.

[CI for that exact application commit](https://github.com/a252937166/splitreceipt/actions/runs/39660377061) passed install, dependency isolation, typecheck, tests and build. Its Pages deployment is separate from the dedicated-host HTTPS/asset readback. Studio and independent local records dated 21 October show **76 TypeScript tests** passing. The CI test step succeeded; its job name alone is not the source of that count.

Using Node 22.23.1 and npm 10.9.8, from the repository root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:isolation
npm run typecheck
npm test
npm run build
```

With Foundry installed, still from the repository root:

```sh
npm run contracts:test
```

The 21 October preparation recorded **38 Solidity tests and 256 fuzz runs**, in Studio and independently locally. Three added mainnet-preparation cases use local-EVM chain ID 5042 and locally supplied balances; they do not use a mainnet fork, mainnet funds or a mainnet deployment. The older 35-test/17 October record remains historical. Do not run the Solidity command from `contracts/`.

## Review Studio provenance

[Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Access for an independent reviewer without the owner's session is **unconfirmed**; a project URL alone is not anonymous-access proof. The public repo and [provenance record](../PROVENANCE.md) expose source/history while that access question remains open.

The contract and original app began in Studio. Earlier local refinements were later synchronized; later UI work was Studio-authored. Latest mainnet/wallet inputs were prepared with Codex outside Studio and actually applied/tested through Studio's official manual terminal. Exact terminal/per-file hashes establish correspondence, not exclusive Studio-AI authorship or organizer acceptance. No new full-source ZIP or Studio-AI generation is claimed for the latest public retest.

## Recording and observation limits

The latest private video is 63 seconds, silent, and assembled from 21 milestone screenshots with waits compressed. It passed media QA but is not uploaded. It contains no Studio editor/source edits or native wallet signature screens. The owner reported no security warning when confirming creation and the second payment; the first payment's native signature actor/action and warning state were not observed. Chain verification is separate from those browser-signature observations.

The captured app console sample contained no error-level entries, but MetaMask listener/orphan-stream warnings persisted. The app's explicit-provider/session repair does not establish that every extension-internal error or all future security warnings are fixed.

No mainnet deployment/payment, professional audit or completed competition submission is claimed. See [readiness](READINESS.md), [validation](../VALIDATION.md), [site review](../METAMASK-SITE-REVIEW.md) and [evidence index](EVIDENCE-INDEX.md).
