# Source and deployment provenance

## Origin

The original SplitReceipt application and Solidity contract were generated and iterated in this [Arc Studio project](https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62). Studio was used for application preview, contract authoring and testing. The initial Studio deployment path could not initiate a transaction because of its deployment policy limit.

An independent local deployment then used a fresh test-only wallet and the public Arc Testnet RPC. This produced the contract and example bill recorded in [arc-testnet.json](../deployments/arc-testnet.json). The recorded example has two `0.001` test-USDC payments. No mainnet wallet, mainnet API key or real USDC was used for that testnet run.

This standalone repository preserves the Studio-origin contract and application while adding locally developed dependency isolation, receipt-history pagination, wallet handling, verification and static publication. Final application refinements were synchronized back to Studio and checked through new downloaded source archives, as recorded below.

## Observed helper mismatches

On multiple occasions, after a later Studio task began, `src/onchain-facts.ts` was found with different bytes (hash `c7c314ada2f6be684dcd24c703fee3fec68f8bc0a2c7c9d1bcf3633c33199abd`, 16,223 bytes) than the canonical strict version (SHA-256 `b4c45994e26e377923c5f54e706709449435af051ce89f493027f111cdf2f070`, 1,080 bytes). On the same occasions, `src/onchain-money.ts` and `src/onchain-wait.ts` were found present after having been deleted. The cause and triggering mechanism are not established. The canonical `onchain-facts.ts` was restored by explicit write and verified by hash after each observation. Future Studio exports must verify these three file states before accepting the archive.

## Final Studio source readback (17 October, initial UI)

On 2026-10-17, a fresh **Download Code** ZIP from Studio was saved and independently compared with the canonical working tree. The public [source-readback evidence](../tests/evidence/studio-source-readback-2026-10-17.json) records 22 synchronized paths: **20 were byte-identical**, including all synchronized application source and tests. The contract bytes also matched the canonical original Studio-authored contract.

Two files have the documented Studio sandbox adaptations: `package.json` changes the development host to `0.0.0.0`; `vite.config.ts` uses that development host and adds `allowedHosts: true`. The canonical project retains `127.0.0.1`. These are the only differences among the 22 compared paths.

Archive SHA-256: `46e458e3125421abd5144b409c75e40dfb8aee7a98d284c57fc6582e673ccd69`. The ZIP is retained privately outside Git.

The Studio UI reported zero TypeScript errors, 16 passing tests and a successful build. A real Preview refresh was observed with the testnet banner, public demo link and UTF-8 title-byte counter visible.

## UI refinement and exact resynchronization (17 October, UI sync)

A later 17 October UI pass used generated desktop/mobile design references in the same Studio project. The references were concepts, not live application or transaction screenshots. Five UI files were reviewed and refined locally for amount-summary consistency, narrow layouts, contrast, touch targets, dialog keyboard focus and network-switch pending/error feedback, then synchronized back to Studio.

A new [independent source readback](../tests/evidence/studio-ui-source-readback-2026-10-17.json) verifies five UI files plus the restored strict Arc Testnet facts helper byte-for-byte (six paths total). Eleven protected public-source paths matched; Studio package/Vite host adaptations matched the earlier Studio export. Two unused generated network helpers were removed. No contract, application chain, test or dependency change was adopted.

Final archive SHA-256: `336844d1c6cd173e827858ceb47e4cdeeb3601e44e4f6580b1ea91158e32a886`, 3,541,106 bytes. The archive remains private. Both actual desktop and mobile Studio Previews were observed during the 17 October UI sync. Typecheck, 16 frontend tests, build and local dependency isolation passed.

## Dark UI redesign (18 October)

A dark workspace UI was implemented in Studio using a local screenshot as a visual design reference only. The screenshot is a local reference draft; it was not a prior Studio screenshot or transaction evidence. Studio implemented the six dark UI files (`src/index.css`, `src/App.tsx`, `src/components/CreateBill.tsx`, `src/components/BillDetails.tsx`, `src/wallet-ui.tsx`, and new `src/components/WalletChecks.tsx`). Subsequent Studio repairs addressed:

- Two misleading "Permit or signature required: No — only a single transaction" labels corrected to: "No — wallet transaction confirmation is required; no permit or message signature"
- Mobile navigation repaired to expose all three nav links at 390px viewport width
- `src/onchain-facts.ts` restored to canonical 1,080-byte content after an observed mismatch; cause unknown

Studio repairs reported: typecheck clean, 16/16 tests pass, production build success, Preview HTTP 200. An earlier dark desktop embedded Preview was observed during this work. HTTP 200 from `curl` is not final browser-proof; final Studio mobile Preview was not validated. The dark source candidate requires independent fresh ZIP readback, local build and live-release verification before claiming it as published.

The INITIAL/HISTORICAL dedicated release checkpoint (`20261018T080938Z-dd5013b`) used the white/blue UI. As of the 18 October checkpoint, no later publication had been verified.

**Future source/UI/docs changes must happen in Studio, followed by export, independent verification, build and publication.**

## Light/forest UI redesign (21 October)

The current release reflects a full light/forest UI redesign authored in Arc Studio across two Studio sessions:

**Session 1 (design):** Arc Studio authored all six UI/design files (`src/index.css`, `src/App.tsx`, `src/components/CreateBill.tsx`, `src/components/BillDetails.tsx`, `src/components/WalletChecks.tsx`, `docs/DESIGN.md`). The visual reference was a screenshot from the owner's own local ReCart project, used as a layout/workflow reference only — no shared code, dependencies or data. The six files were exported and adopted as exact bytes by independent verification.

**Session 2 (presentation corrections):** Five targeted CSS/JSX corrections were applied in Studio: narrow-viewport mobile nav icon hide at ≤419px; bill totals named CSS class replacing `break-all` with `overflow-wrap: anywhere`; Create bill receipt preview always visible (no `hidden lg:block`); CSS token aliases `--muted` and `--surface-raised` required by frozen `wallet-ui.tsx`; `section[role="dialog"] h2` font override to cover the frozen wallet dialog's inline serif style. `docs/DESIGN.md` contrast ratios, breakpoints, touch targets and wallet dialog typography notes were corrected. All non-UI files (contract, tests, helpers, receipt logic, config, packages) were unchanged.

The final ZIP SHA-256 `b92cfe708d31acb756301b85eab742984ff50f0b5ab3830ec936ae4668181e14` covers the output of both sessions as independently verified before publication.

At the start of one or more Studio sessions, `src/onchain-facts.ts` was found with different bytes (the 16,223-byte generated version, hash `c7c314a…`) rather than the canonical strict version. The cause and triggering mechanism are not established. On each occasion, the canonical 1,080-byte version was restored by explicit write in Studio and hash-verified before the session's work was finalised. `src/onchain-money.ts` and `src/onchain-wait.ts` were also found present after having been deleted on the same occasions; cause unconfirmed. See Observed helper mismatches above.

Independent verification of the 21 October release: typecheck clean, 36/36 frontend tests pass, production build success, dependency isolation passed; desktop/mobile layouts at 360/390/768/1024px verified via local QA; live browser on 21 October 2026 returned Bill 3 Settled 2/2, 2/2 freshly verified receipts. Release published as commit `003f005b4030f664dfb95f9ccc79205f14e92b27`, label `20261021T071846Z-003f005`.

**Future source/UI/docs changes must happen in Studio, followed by export, independent verification, build and publication.**

## Bill 3 provenance

Bill 3 was created and settled on Arc Testnet 5042002 at contract `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26`. Title: Published UI retest - testnet. Recipient: `0x7c50fF360EE4Ee53097ADFb6D0a464c2E9F77336`. Payers (ordered): `0x3dc8BD7393c65C632ec6395Ad6C7916A65662e74` and `0x92F6772880Bc6FFe9F8112E5F202bB7eC5428B6e`. Each share: 0.001 native test USDC, total 0.002.

- Create: tx `0x0accd8568a0d9844bbd65228d21eb8431cfdb18957c5f6a87c3c1744338707d7`, block 67806955, gas 0.00422905 test USDC
- Pay 1: tx `0xc0d0e348b75178251ac1e71a6d8d3a7831267aeba447ee4dd81c20eb3dfec6f4`, block 67809882, gas 0.0017118 test USDC
- Pay 2: tx `0xf79dc80600bd05be25fb904d845f126d4d95b59dad94ad47c164c38a35b9e9c9`, block 67810029, gas 0.001771625 test USDC

Independent read-only public RPC verification at 2026-10-18 08:16:19 UTC (head 67810050) confirmed 2/2 paid, both SharePaid receipt events, total principal 0.002 and gas 0.007712475 test USDC. Browser refreshed to settled 2/2 on dedicated domain anonymously. Creation and first payment used MetaMask; both signatures occurred off-camera. Second payment used a disposable test-account helper, not MetaMask. Chain success does not prove wallet software or continuous signing footage.

## Build boundary

The historical deployment used Solidity `0.8.28+commit.7893614a`, Paris EVM and the optimizer with 200 runs. Its runtime-code hash and source hashes are recorded in the deployment manifest. The OpenZeppelin `ReentrancyGuard.sol` bytes were checked against the official `@openzeppelin/contracts@5.1.0` package.

Local directory names and source paths affect Solidity metadata, so recompilation is not claimed to produce byte-for-byte identical historical deployment bytecode. `npm run chain:check` verifies the recorded deployed runtime and transaction evidence separately from a fresh source build.

## Recordings and scope

Build and testnet walkthrough recordings are retained locally, outside the public source tree. They have not been uploaded. The recordings document the actual captured browser sequence; a public recording URL or a continuous recording from an empty project is not claimed. Recordings are local/private, sampled actual screenshots with real gaps compressed, not continuous.

The public release is restricted to Arc Testnet. Mainnet deployment, mainnet payment evidence, and competition submission have not been completed. A working testnet demonstration does not establish satisfaction of a contest's mainnet requirements. Mainnet and competition submission remain paused; testnet-only status remains ineligible under current contest rules.

## Licensing and attribution

The original contract carries an MIT SPDX identifier. The repository's original application code and documentation are distributed under [LICENSE](../LICENSE). Vendored and installed dependencies retain their own notices and licenses.

Arc Studio and Circle are acknowledged as development tools and network providers. This application is an independent project; no Circle approval or endorsement is claimed.


## Unpublished mainnet adaptation (21 October 2026)

The public release remains commit `003f005b4030f664dfb95f9ccc79205f14e92b27`, label `20261021T071846Z-003f005`. This session's adaptation is unpublished. It preserves Arc Testnet `5042002` and its historical deployment/receipts, while preparing a separate Arc mainnet `5042` context with a blank deployment address. `MAINNET_WRITES_ENABLED = false` is a compiled source-level release lock: an address, environment variable, URL parameter, cached check or mainnet wallet cannot enable writes. Future enabling requires a separately reviewed source change and explicit authorization; no mainnet deployment or onchain write/broadcast is part of this preparation.

For this session, Codex prepared source inputs outside Studio; the actual project changes are applied through Arc Studio's official manual terminal. The Studio agent daily quota was observed at 99%. The available manual terminal path is used without a paid upgrade. This records where the files were actually changed and does not claim that Studio AI generated every source file, erase earlier local contributions or establish organizer acceptance of that provenance.

An observed **Download Code** archive was an older snapshot rather than the latest terminal state. Current source acceptance therefore uses an exact terminal export, followed by byte-for-byte comparison and independent validation. The archive, terminal export and public release are separate states. Record exact export hashes, adopted paths and any approved sandbox-only differences after readback; do not present an old download hash as the current source snapshot.

At this session's starting Studio baseline, typecheck, 36 TypeScript tests, 35 Solidity tests and the production build were observed to pass. These are baseline observations. **Final adaptation in Studio: typecheck, 67 TypeScript tests, 38 Solidity tests, 256 fuzz runs, production build, dependency isolation and offline unsigned-bundle generation passed. Exact terminal export and independent local typecheck, 67 TypeScript tests, 38 Solidity tests, 256 fuzz runs, build and dependency isolation passed. Local browser checks confirmed the disabled mainnet preview, wrong-context recovery and preserved legacy testnet Bill 3 with 2/2 freshly verified receipts. Live wallet connection/signing was not retested; one external wallet-extension injection error was observed. See tests/evidence/mainnet-preparation-2026-10-21.json.** No deployed state is asserted. Tests that set `vm.chainId(5042)` and fund accounts with `vm.deal` are local EVM tests, with no mainnet, fork, RPC, signature or broadcast implied by that chain ID.

The offline deployment preparation tool validates pinned source/dependency identity and compiler settings, then records the actual fresh artifact, creation bytecode and runtime hashes. Its status remains `UNSIGNED_NOT_DEPLOYED_REQUIRES_INDEPENDENT_REVIEW`. The fresh runtime may differ from the historical testnet runtime because source/remapping paths and compiler metadata affect bytecode. `historicalRuntimeExactMatch: false` is a disclosed comparison result, not a reviewed-equivalence claim; neither a match nor a mismatch authorizes deployment. The historical runtime hash must not be relabelled as the reviewed hash of a fresh artifact. Independent artifact/bytecode review and a fresh gas/fee estimate remain necessary before any future owner-reviewed signature.

Actual Studio edits, test invocations and export milestones are retained as local supporting material. Where manual milestone screenshots are assembled into a process record, they are sampled screenshots with waits compressed, not continuous footage or a final competition demonstration. Stage labels are not independent QA results. No native wallet footage, mainnet receipt, public video upload, paid upgrade or competition submission is established by this preparation. See [MAINNET-PREPARATION.md](MAINNET-PREPARATION.md) for the separate future review/signature sequence.
