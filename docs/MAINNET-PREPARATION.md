# SplitReceipt — mainnet preparation

## Scope and current boundary

This preparation adds explicit network separation, fail-closed transaction checks, offline unsigned deployment material and local tests. The deployed public site remains the existing Arc Testnet release at commit `003f005b4030f664dfb95f9ccc79205f14e92b27`. This adaptation is unpublished. It does not authorize deployment, transaction signing, broadcasting, mainnet payment, a paid upgrade or competition submission.

Arc Testnet (`5042002`) remains the default and preserves the existing contract and historical demonstration receipts. Testnet evidence must never be relabelled as mainnet evidence. Arc mainnet (`5042`) is a separate preparation target. Its contract address is blank and its write actions are disabled.

`MAINNET_WRITES_ENABLED = false` is a source-level release lock compiled into the application. Providing an address, environment variable, URL parameter, cached verification result or connected mainnet wallet cannot enable mainnet writes in this release. Enabling them would require a future separately reviewed source change, followed by Studio application, export, independent verification and explicit authorization for each live action. Filling in an address alone is insufficient.

## Network safeguards

- Keep Arc Testnet (`5042002`) and Arc mainnet (`5042`) in separate immutable page contexts. Changing the app network performs a full navigation and clears the old bill, receipt hints and deployment identity from the URL. Selecting a network does not switch a wallet or send a transaction.
- A blank mainnet address means not deployed / not configured. Do not silently replace it with zero, a testnet address or any URL-provided contract. A share URL identifies a configured deployment; it does not override configuration.
- Before an app write, verify the read-only RPC chain and deployed runtime hash, then recheck the wallet account, wallet chain and page scope. Reject missing or unreviewed configuration, wrong-chain responses, missing code, hash mismatches and stale asynchronous actions.
- Keep bill reads, receipt hints, caches, history and explorer links scoped to the selected chain and configured contract. A testnet receipt must not populate a mainnet receipt view.
- Native USDC gas and payable value use 18 decimal places; the ERC-20 representation uses 6. SplitReceipt uses native `payShare`, with no ERC-20 approval or permit. A native transaction still requires the wallet owner's review and confirmation.

The implementation and test evidence for this session must be checked against these conditions; the document itself is not evidence that a check passed.

## Offline unsigned deployment material

`tools/mainnet/prepare.mjs` prepares review material offline. It has no RPC, wallet, signer or broadcast client. Its output must retain the status `UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW` and `artifactReviewStatus: REQUIRES_INDEPENDENT_REVIEW`.

The preparation tool validates pinned contract source and ReentrancyGuard dependency hashes, Solidity `0.8.28+commit.7893614a`, Paris EVM and optimizer 200, along with the expected ABI, constructor and compilation target. It records the actual artifact SHA-256, creation bytecode hash, runtime hash and unsigned JSON hash. These consistency checks do not make a new artifact independently reviewed.

The new runtime hash can differ from the historical testnet runtime hash because compiler metadata and source/remapping paths affect bytecode. The manifest records both hashes and `historicalRuntimeExactMatch`. A false match flag is not proof of an equivalent reviewed build; a true flag is not permission to deploy. Do not substitute the historical hash for the newly produced runtime hash or describe either the unsigned artifact or its bytecode as reviewed before independent review occurs.

The unsigned contract-creation JSON uses chain `5042`, no destination contract (`to: null`), zero native payment value and the actual creation data. It contains no sender, nonce, gas quote, private key, seed phrase, signature, API key, authentication token or wallet session. It is not a signed transaction, deployment receipt, payment receipt, cost guarantee or live authorization. A local EVM simulation is not onchain execution.

After an appropriate build, an authorized preparation-only invocation is:

```sh
node tools/mainnet/prepare.mjs --out <new-private-directory>
```

Keep generated artifacts private until their exact contents and public suitability have been checked. Before any future signature, independently review the source, compiler, dependencies, artifact, creation data and actual runtime hash, then estimate fresh gas and fees for the exact transaction and account. See [the cost study](submission/MAINNET-COST-STUDY.md) for the dated read-only fee model and its exclusions.

## Future owner-reviewed sequence

Every live step below is deferred. Each needs explicit authorization and a review of its concrete request. The wallet owner must personally review and sign any future mainnet transaction.

1. **Deploy.** Review the final artifact, chain `5042`, zero deployment value and wallet's actual native-USDC gas budget. After the owner signs and the transaction confirms, independently verify the receipt, deployed bytecode, contract address and explorer link. Never fill the mainnet address from a guess or a testnet record.
2. **Configure and review.** Enter the independently verified address, deployment block and reviewed runtime hash in Arc Studio. A future separately reviewed source change is also necessary to remove the mainnet release lock; configuration alone cannot enable this build. Export and verify the resulting application and safeguards before requesting any app transaction. Configuration does not prove deployment.
3. **Create a bill.** Review the title, recipient, two to five unique payer addresses, exact equal share, selected chain and contract. `createBill` sends zero payment value and still consumes native-USDC gas. The owner must review and sign this separate request.
4. **Pay one share.** Review the bill, payer, recipient, exact native-USDC share value, contract, chain and gas budget before the payer signs `payShare`. Independently confirm the live receipt and matching payment event. Gas is additional to the share amount.
5. **Complete settlement if required.** One payment on a two-payer bill is `1/2` paid, not settled. A `2/2` demonstration requires a separate reviewed and owner-signed payment from the other listed payer, followed by independent receipt verification.

Stop after any failed, rejected, unexpected or ambiguous request. Do not replace it with an unreviewed approval, signature, transfer or retry. Never bypass a browser or wallet security warning through automation.

## Verification record

At the session's starting Studio baseline, typecheck, 36 TypeScript tests, 35 Solidity tests and a production build were observed to pass. Those observations describe the earlier baseline, not acceptance of this adaptation.

**Final adaptation in Studio: typecheck, 67 TypeScript tests, 38 Solidity tests (including three local 5042 preparation tests), 256 fuzz runs, production build, dependency isolation and offline unsigned-bundle generation passed. Exact terminal export and independent local typecheck, 67 TypeScript tests, 38 Solidity tests, 256 fuzz runs, build and dependency isolation passed. Local browser checks confirmed the disabled mainnet preview, wrong-context recovery and preserved legacy testnet Bill 3 with 2/2 freshly verified receipts. Live wallet connection/signing was not retested; one external wallet-extension injection error was observed. See tests/evidence/mainnet-preparation-2026-10-21.json.**

Record exact commands, actual results, exported-source hashes and independent readback here after they have been observed. Planned checks cover preserved testnet behavior, blank mainnet configuration, the unconditional mainnet release lock, chain/address separation, wrong-network and bytecode rejection, native decimal conversion, exact payable values, stale wallet/page scope handling and unsigned artifacts without signing or broadcasting. Solidity tests using `vm.chainId(5042)` and `vm.deal` run on a local EVM with local balances; they are not mainnet or fork execution.

## Source and process provenance

For this preparation, Codex prepared source inputs outside Studio, and the actual file changes are applied through Arc Studio's official manual terminal. The Studio agent daily quota was observed at 99%; this path uses the available terminal without a paid upgrade. It must not be described as Studio AI generating every source file.

An observed Download Code archive was an older snapshot. Acceptance therefore requires exact terminal export of the current files, byte-for-byte readback and independent verification. An archive download alone is not proof of the current terminal state. See [PROVENANCE.md](PROVENANCE.md) for historical mixed Studio/local development and this session's record.

Retain the actual editing, tests and export process as supporting material. Where only manual milestone screenshots are available, describe the video as sampled screenshots with waits compressed, not a continuous recording. Stage labels such as checked or pass are not independent acceptance results. This preparation does not supply a deployed mainnet address, a mainnet receipt, a public final-demo URL, organizer acceptance or an eligibility exemption.

## Exact readback result

The initial exact terminal export SHA-256 is 28f93fdd46c74e23566a926daf4f639294249008d7f1237f43ebdae1aea43454. Its 25 source/document files were copied byte-for-byte; the protected contract and build dependency files remained unchanged. Final documentation and this evidence record are exported as a separate docs-only readback. The deployed public release remains 003f005; no mainnet deployment or broadcast occurred.
