# SplitReceipt

> Built with Arc Studio — group bill splitting on Arc Testnet

Split a shared expense onchain. A creator opens a bill (title, fixed recipient, 2–5 payers, USDC share). Each listed payer pays once; the contract immediately forwards their share to the recipient. Shareable `?bill=<id>` URL lets everyone see paid/unpaid status in real time.

---

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Arc Light design tokens
- Web3: wagmi 3 + viem (EIP-6963 named wallets, no auto-reconnect, no ConnectKit)
- Contracts: Solidity ^0.8.20, OpenZeppelin 5.1.0 ReentrancyGuard, Foundry
- Chain: Arc Testnet (Chain ID 5042002, RPC https://rpc.testnet.arc.io)
- Payment: Arc native USDC — `msg.value` at 18 decimals, forwarded immediately to recipient
- Toasts: Sonner

## Key Files

- `src/App.tsx` — header, wallet menu, routing from the URL context (`?network=&chainId=&contract=&bill=&created=`)
- `src/networks.ts` — fail-closed page context; reviewed deployments with pinned runtime hashes (Arc Testnet and Arc Mainnet)
- `src/components/CreateBill.tsx`, `BillDetails.tsx`, `OpenBill.tsx`, `ContextProblemView.tsx` — views
- `src/wallet/WalletSession.tsx`, `WalletMenu.tsx` — wallet discovery, explicit connect, "Use this wallet" acknowledgement, network switch
- `src/writeGuard.ts` — runtime-hash check, fresh provider chain/account check and epoch checks before every write
- `src/epoch.ts`, `src/hooks/useRequestScope.ts` — request epochs
- `src/walletSend.ts` — the final EIP-1193 boundary: frozen transactions, per-network fee policy (Mainnet 40 gwei max fee / 0 priority, Testnet none), guarded provider around the acknowledged provider, send through viem `writeContract` with retries off. App code must not use wagmi `writeContract`/`useWriteContract` (a test enforces it)
- `src/submissionLock.ts` — submitted-intent lock: held from the wallet's hash until a read-only reconciliation is verified or definitively not completed; no UI control may discard it
- `src/settlement.ts` — verified / not-completed / sent-unverified / stale outcomes for a sent create or payment; success needs the final canonical transaction, the event and the reconciled paid state, never `receipt.status` alone
- `src/receiptProofs.ts`, `src/receiptRecovery.ts`, `src/receiptController.ts` — generation-bound receipt proofs, missing-identity history recovery, and the controller `useReceipts` wraps
- `src/creationHints.ts` — public creation-transaction candidates (always re-verified)
- `src/a11y.ts` — wallet dialog focus cycling
- `src/studio-preview.ts` — DEV-only, Studio-preview-only loader for the Studio instrumentation
- `tests/jsdom/` — optional jsdom checks (not part of `npm test`; jsdom is not a dependency)
- `src/createBillReceipt.ts` — verifies a creation tx: creator = canonical `tx.from`, decoded `createBill` calldata equals intent, `BillCreated` event, `getBill` at the creating block
- `src/paymentVerification.ts` — verifies a payment tx: sender = payer, target, value, `payShare(billId)` calldata
- `src/receiptDiscovery.ts`, `receiptHints.ts`, `receiptHistory.ts` — canonical receipt discovery, hint storage, bounded SharePaid history scan
- `src/splitReceiptAbi.ts` — human-readable ABI used by pure modules (parity-tested against the compiler ABI)
- `src/splitReceiptContract.ts` — protected original ABI/address module (unchanged, not used by the rebuilt UI)
- `contracts/SplitReceipt.sol` — the contract (protected, unchanged)

## ABI facts (do not "fix" the contract or ABI to match older wording)

- There is NO public `paid()` method. Paid status is `getBill()[4]` (`paidStates`, aligned with `payers`).
- `BillCreated(billId, recipient, share, payers, title)` has NO creator. Creator = canonical `tx.from` plus decoded `createBill` calldata matching the intended bill.
- `SharePaid(billId, payer, amount)` has NO recipient. Recipient = fixed `getBill()[1]` on the runtime-pinned contract.

## Protected files (never edit; SHA-256 checked 2026-10-23)

| File | SHA-256 |
|---|---|
| `contracts/SplitReceipt.sol` | `df06d8d017fc9170f39eeb08d38f5f7f5dbcbd4b4e34a8542cc3eaa216d504c2` |
| `contracts/test/SplitReceipt.t.sol` | `486e9b0dd7691aed25bc9c3383644406082ee2a1371712df7473e2e82fb65440` |
| `src/index.css` | `ee46f490fdc015b19c8bb4035b172fcc3d325b688e9872f039af023b848afc0d` |
| `src/receiptDiscovery.ts` | `fb8a9716ea4c94987d4266662e05fbe68d98214a87242fd85ee9f8d53384b923` |
| `src/usdcFormat.ts` | `ec0bf64447ae8a1a0587488323d140cdc83d2924b1946fe46219e9b220c11cb9` |
| `src/vite-env.d.ts` | `65996936fbb042915f7b74a200fcdde7e410f32a669b1ab9597cfaa4b0faddb5` |
| `docs/DESIGN.md` | `b06026e1d58bbd0b8f01c4588ccad56491d5ac3d0eb39b5a1797dc796416c05a` |

Not protected: `src/config.ts`, `src/onchain-facts.ts` (an earlier note in this file wrongly listed other files as protected).

## Contract

- Source: `contracts/SplitReceipt.sol`
- ABI: hand-matched in `src/splitReceiptContract.ts`
- No constructor args
- Functions: `createBill`, `payShare` (payable), `getBill` (view), `billCount` (view)

## Deployment Status

### Deployment 2 — Arc Studio SCP (2026-10-23) ← current

Deployed via Arc Studio's Circle Smart Contract Platform deployer.

| Field | Value |
|---|---|
| Contract address | `0xb168fcf0698c65fb0d516a35d97c44dcc06cb440` |
| Chain | Arc Testnet (chainId 5042002) |
| Deploy tx | `0xa2ca0bfe19986de922b9e241aff8457f63cfcd47f4926120e577e6f8cfe6ffc9` |
| Deployed at | 2026-10-23T04:58:13.515Z |
| Explorer | https://explorer.testnet.arc.io/address/0xb168fcf0698c65fb0d516a35d97c44dcc06cb440 |
| Deploy tx explorer | https://explorer.testnet.arc.io/tx/0xa2ca0bfe19986de922b9e241aff8457f63cfcd47f4926120e577e6f8cfe6ffc9 |
| `billCount` at deploy | `0` — confirmed via RPC |

### Deployment 1 — External local runner (2026-10-17)

Deployed externally by local runner using a disposable testnet-only wallet. Verified by runtime bytecode keccak256 match.

| Field | Value |
|---|---|
| Contract address | `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26` |
| Chain | Arc Testnet (chainId 5042002) |
| Deploy block | `67660831` |
| Deploy tx | `0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac` |
| Runtime keccak256 | `0xbbd2f2b7c23a525b0cbb77c31d8b4a82b99797158bcfd7da6cd94c12b74b8074` |
| Compiler | solc 0.8.28 / paris / optimizer 200 |
| Explorer | https://explorer.testnet.arc.io/address/0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26 |
| Deploy tx explorer | https://explorer.testnet.arc.io/tx/0x7808b47303974a4b69f8b306e1fff0bdfbb408b6cd26de53790187d77eccacac |

Verification (2026-10-17): RPC `eth_getCode` returns 3200 bytes; `keccak256(bytecode)` computed via viem matches the runner-provided hash exactly. `billCount` reads `0` — clean deployment.

## Environment Variables

| Name | Purpose | Status |
|---|---|---|
| `VITE_SPLIT_RECEIPT_ADDRESS` | Deployed SplitReceipt address | Set — `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26` |
| `VITE_RECEIPT_WAIT_MS` | Optional: how long to wait for a receipt before saying "sent, not yet verified" (1000 to 600000; default 120000) | Not set |
| `VITE_SPLIT_RECEIPT_DEPLOY_BLOCK` | First block to scan for SharePaid logs | Set — `67660831` |

## Build & Test

```bash
forge test -v                              # 35 Solidity tests
node --import tsx --test tests/*.test.ts   # 320 TypeScript tests in 20 files
bunx tsc --noEmit                          # typecheck
bunx vite build                            # production build
```

## Networks (updated 2026-10-23)

Arc Testnet (5042002, default for blank and legacy links) and Arc Mainnet (5042) are both supported as separate page contexts (`src/networks.ts`). Earlier notes in this file and in `docs/` saying the app was testnet-only, that mainnet writes were locked, or that restored files had to keep exact hashes describe earlier checkpoints. They were superseded by the authorized redevelopment of this app, which re-implemented the wallet, network, context, create and receipt layers on the installed dependencies.

- **Mainnet deployment (reviewed, public):** `0x8522Ea5A413c8402182fF6998Bd7471bAC886142`, deploy block `27419618`, runtime keccak256 `0x93454cc56d1f8531f7d506ff22ccbfeefe1b34913c0f688910ee2a20e7bfd18b`. The only mainnet contract the app accepts; an environment address never repoints it.
- **Mainnet uses real USDC** for payments and gas. The page shows a real-funds notice and button labels say so. The app only asks the connected wallet to sign; the wallet owner reviews every write.
- **Anonymous Bill 1:** reads, creator and receipts can be recovered without a wallet. Bill 1 carries its two public payment hashes as unverified candidates, and a bounded history scan from the deploy block recovers them with no hints. Both were checked read-only against the live chain: runtime hash, `getBill(1)` paid states `[true, true]`, creator from the creation transaction's sender, and 2 of 2 payment receipts.
- **No mainnet writes or deployments were made by this redevelopment.** All mainnet checks were read-only RPC calls.
- Switching network is a full navigation (`?network=`) that drops the bill, receipt hints and contract from the URL.
- Testnet and mainnet receipts, bills, hints and caches are keyed by chain and contract and never mix.

## Production entry and the Studio preview bridge

The Studio Preview panel appears to need console output (and optional traces) from the framed app. Evidence from this sandbox: the preview rendered while `src/main.tsx` loaded `console-capture.ts` and `tracing.ts`, and `console.jsonl` stopped receiving entries the moment those imports were removed (the dev server itself kept answering HTTP 200). The panel's own readiness logic is not visible from the sandbox, so this is the best-supported diagnosis rather than a confirmed one. History: the pane stayed at "Connecting to sandbox" after the imports were removed (owner's observation). Later on 23 Oct (17:58–18:01 UTC) an independent browser operator opened the full official Preview pane and used the real app: the create form (title, recipient, two payers, share 0.001, draft total 0.002) and the wallet chooser (Phantom, OKX, MetaMask listed; Tab focused an option; Escape closed it and restored the trigger), with no wallet connection, signature or transaction. That is consistent with the bridge but does not prove it, and it does not cover bill pages, wallet connection or signing, chain reads from a connected wallet, or mobile. Public-browser acceptance of an exported or public copy is still required.

`src/main.tsx` does not import the instrumentation. It calls `src/studio-preview.ts` only inside `if (import.meta.env.DEV)`. The bridge dynamically imports `console-capture.ts` and `tracing.ts` (which patch `console`, `fetch` and the wallet provider's `request`) only when the page is framed AND is the Studio preview host (`*.preview.studio.arc.io`) or has a `studio.arc.io` parent. A production build removes all of it; `tests/production-entry.test.ts` fails if `main.tsx` imports the instrumentation directly, if anything but the bridge references it, or if the built bundle contains any trace/console/bridge marker. Opening the dev server in a normal tab loads none of it. Wallets are discovered per EIP-6963 only: no targetless injected connector, no persisted connection, no automatic reconnect.

`vite.config.ts` currently carries an explicit `allowedHosts` list (`localhost`, `127.0.0.1`, `.preview.studio.arc.io`) written outside this agent's turns. It was checked with Host headers: the preview host and E2B hosts answer 200, unknown hosts answer 403. It was left as is.

## Request epochs and the write guard

Pending work is invalidated by epoch counters, not by comparing strings (`src/epoch.ts`): a wallet epoch bumped by provider and wagmi events, a page epoch bumped on navigation, and a per-component op epoch bumped on a new request and on unmount. A token captured before an A -> B -> A change never becomes live again. `guardedWrite` (`src/writeGuard.ts`) checks the token after every await and once more immediately before the wallet request, and freshly asks the acknowledged provider for `eth_chainId` and `eth_accounts`.

## Design

Bright forest-green light theme from the protected `src/index.css`; see the protected `docs/DESIGN.md` (single local sans stack, monospace only for addresses, hashes and amounts). Layout classes (`layout-create`, `layout-details`, `bill-totals`, `payer-row`) come from that stylesheet.

## Known Limitations

1. **Push-forward design** — if the bill recipient is a contract that rejects ETH, `payShare` will revert with `ForwardFailed`. Payers lose no funds (revert undoes everything), but the bill becomes un-payable. This is the specified behavior.
2. **No ERC-20 path** — uses Arc native USDC (18-decimal `msg.value`) only, not the 6-decimal ERC-20 interface. This matches the spec and Arc's architecture.
3. **Bill immutability** — title, recipient, payers, and share are fixed after creation. No cancellation or amendment.
4. **No ENS / address book** — all addresses entered manually.
5. **Two networks, every contract pinned by a reviewed runtime hash** — a new deployment needs a new entry in `src/networks.ts` with its reviewed runtime hash; swapping only `VITE_SPLIT_RECEIPT_ADDRESS` is ignored unless it names a reviewed Testnet deployment. `VITE_SPLIT_RECEIPT_ADDRESS` configures Testnet only.
