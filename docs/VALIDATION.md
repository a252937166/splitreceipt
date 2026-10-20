# Validation record

This record distinguishes deterministic tests, mined chain evidence, local browser observations and public-site verification. The proof files below accompany this record; deployment results for individual source revisions are available in the [Actions history](https://github.com/a252937166/splitreceipt/actions/workflows/pages.yml).

## Standalone checks (17 October 2026)

| Check | Result |
| --- | --- |
| Frozen clean install | Passed in a fresh temporary source copy without node_modules, with an initially empty npm cache; Node 22.23.1, npm 10.9.8; frozen npm ci with lifecycle scripts disabled |
| Type checking | npm run typecheck passed in the clean copy and canonical project |
| Frontend tests | npm test: 16/16 passed: history 8, creation receipts 5, integer amounts 3 |
| Production build | Passed in the clean copy and canonical project |
| Solidity | 35/35 passed, including 256 fuzz runs; Solidity 0.8.28, Paris, optimizer 200 |
| Isolation | 215 integrity-pinned registry packages, zero external filesystem links and zero unused service SDKs |
| Chain check | Read-only verification of chain 5042002, runtime/source hashes and settled bill 1 at head 67666905 |
| Pages CI | [Run 39031619289](https://github.com/a252937166/splitreceipt/actions/runs/39031619289) succeeded for `566a2f24d2faee88d441115d92127e01685058e9` |

Local engineering reports and logs are retained outside tracked application artifacts.

## Studio persistence and preview (17 October 2026)

A new Studio Download Code archive was saved and independently inspected. The [sanitized source proof](../tests/evidence/studio-source-readback-2026-10-17.json) records 22 synchronized paths, with 20 byte-identical to the canonical working tree. Contract bytes matched. Only the development host adaptations in package.json and vite.config.ts differ.

Private ZIP SHA-256: `46e458e3125421abd5144b409c75e40dfb8aee7a98d284c57fc6582e673ccd69`. Studio reported TypeScript zero errors, 16 passing tests and a successful build. Its actual refreshed Preview displayed the testnet banner, public demo link and UTF-8 title-byte counter.

## UI source sync readback (17 October 2026)

The [UI source readback](../tests/evidence/studio-ui-source-readback-2026-10-17.json) verifies five UI files plus the strict Arc Testnet facts helper byte-for-byte (six paths total) after local refinement and Studio resynchronization. Final archive SHA-256: `336844d1c6cd173e827858ceb47e4cdeeb3601e44e4f6580b1ea91158e32a886`, 3,541,106 bytes. Both desktop and mobile Studio Previews were observed during this 17 October UI sync. Typecheck, 16 frontend tests, build and local dependency isolation passed.

## Dark UI Studio repairs (18 October 2026)

Studio repairs were applied to the dark UI: signature/permit wording corrected in two WalletChecks locations; mobile nav repaired for 390px; `src/onchain-facts.ts` restored to canonical content after an observed mismatch (cause unknown). Studio reported: typecheck clean, 16/16 tests pass, production build success, Preview HTTP 200. An earlier dark desktop embedded Preview was observed during this work. HTTP 200 from `curl` is not final browser-proof; final Studio mobile Preview was not validated.

The dark source candidate requires independent fresh ZIP readback, local build and live-release verification. The INITIAL/HISTORICAL dedicated release checkpoint (`20261018T080938Z-dd5013b`) used the white/blue UI. As of the 18 October checkpoint, no later publication had been verified.

## Dedicated hosting verification (18 October 2026)

| Item | Result |
| --- | --- |
| Primary URL | https://splitreceipt.axiqo.xyz/splitreceipt/ |
| Release label | `20261018T080938Z-dd5013b` (INITIAL/HISTORICAL checkpoint — white/blue UI; no later publication had been verified as of that 18 October checkpoint) |
| Files / bytes | 4 public dist files / 608,328 bytes |
| Manifest SHA-256 | `21ff2a604925a5e6b09f8cd623dca6b3848147ab67340eaae0387c4853c35215` |
| HTTPS/TLS/redirect readback | Passed 2026-10-18 08:22:43 UTC |
| Root/slash/HTTP redirects | Preserve bill query string |
| Hosting type | Dedicated static; isolated `/var/www/splitreceipt/releases/`; `current` symlink; no backend/port/dependency/secret uploaded |

The temporary `codex.axiqo.xyz/splitreceipt` route has been removed and must not be used as the primary demo.

## Bill 3 independent RPC verification (18 October 2026)

Read-only public RPC verification at 2026-10-18 08:16:19 UTC (head 67810050) confirmed:
- 2/2 payers paid on Arc Testnet 5042002
- Both SharePaid receipt events present
- Total principal 0.002 test USDC; total gas 0.007712475 test USDC
- No real money involved

Browser refresh on dedicated domain showed settled 2/2 anonymously (no wallet connected).

Creation and first payment used MetaMask; both signatures occurred off-camera. Second payment used a disposable test-account helper, not MetaMask. Chain success does not prove wallet software or continuous signing footage.

## Receipts and deterministic coverage

Tests cover continuation beyond 150,000 blocks, incremental refresh, failed-page retry, the genesis boundary, exact event filtering, conflicting hashes, navigation/scope cancellation, successful final replacement hashes, cancelled/reverted payments and complete BillCreated field matching. These tests do not claim real-wallet pending-transaction acceleration or cancellation on Arc Testnet.

The [history RPC smoke](../tests/evidence/history-rpc-smoke-2026-10-17.json) separately records the helper recovering bill 1's two hashes in three 2,000-block pages at head 67666623 without a configured deployment floor.

## Bill 2: browser wallet observations (17 October 2026)

The local standalone app was exercised with an ordinary MetaMask extension: connection, a rejected create request, successful creation, a rejected payment request and successful payment. Rejected requests were not presented as successful transactions or paid receipts. The second payer was the original disposable test account, paid by root through private local tooling.

| Transaction | Gas in test USDC |
| --- | --- |
| [Create](https://explorer.testnet.arc.io/tx/0x69c6209b9dd2f35de2a657879be66b1d76c1dd4f4f41bae6e32e2a8926aa1839) | 0.005349925 |
| [MetaMask share](https://explorer.testnet.arc.io/tx/0xc1a18f3c1698d207ca6c247643175b0e1f958ea4719da4ccb5d5b751532a2b6a) | 0.0017118 |
| [Original payer share](https://explorer.testnet.arc.io/tx/0x80d5b5c0c7d5941994eddd700587051d8f054c466a071afde5c7611ace315cb7) | 0.001771625 |
| Total | **0.00883335** |

Shares total 0.002; gas plus shares totals 0.01083335 test USDC. These are test assets. No mainnet transaction or additional paid service was used.

Final local browser observations:
- Refresh showed bill 2 settled 2/2. Disconnect followed by a hard reload restored the Connect wallet button and both payment hashes from chain history.
- Reconnection through MetaMask's native local-origin consent was cancelled once; a retry was accepted.
- Switching to an existing second MetaMask account showed address `0xA944…1A7c`, retained both receipts, and removed the old payer's marker.
- Switching the connected network to Sepolia caused the Switch to Arc Testnet banner to appear; the app action returned the wallet to Arc Testnet. No transaction was sent on Sepolia.

A rejected network-switch prompt was not exercised. Real post-broadcast nonce acceleration and cancellation were not exercised in the browser.

## Public delivery and remaining boundary

- Primary demo: https://splitreceipt.axiqo.xyz/splitreceipt/ (dedicated static hosting)
- Old GitHub Pages URL (`a252937166.github.io/splitreceipt`) is historical
- Anonymous bill 3 reading was observed on the dedicated domain
- **Public wallet connection was observed after human handling on the old GitHub Pages hostname.** The first attempt on that host produced a MetaMask phishing warning and was cancelled. Cause remains unconfirmed. The new dedicated hostname returned `NONE` in one 18 October scan; this does not guarantee future wallet behavior or certify security. See [METAMASK-SITE-REVIEW.md](METAMASK-SITE-REVIEW.md).
- Studio and browser recordings remain local, outside the source repository. No uploaded video URL is claimed.
- Mainnet deployment, mainnet payments and competition submission have not been performed. No new transaction for redesign. No additional paid service or upgrade; testnet transactions consumed testnet gas as separately documented.
