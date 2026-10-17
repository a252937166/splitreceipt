# Validation record

Checked on 2026-10-17. This record distinguishes deterministic tests, mined chain evidence, local browser observations and public-site verification. Public reading and wallet connection were observed. The proof files below accompany this record; deployment results for individual source revisions are available in the [Actions history](https://github.com/a252937166/splitreceipt/actions/workflows/pages.yml).

## Standalone checks

| Check | Result |
| --- | --- |
| Frozen clean install | Passed in a fresh temporary source copy without node_modules, with an initially empty npm cache; Node 22.23.1, npm 10.9.8; frozen npm ci with lifecycle scripts disabled |
| Type checking | npm run typecheck passed in the clean copy and canonical project |
| Frontend tests | npm test: 16/16 passed: history 8, creation receipts 5, integer amounts 3 |
| Production build | Passed in the clean copy and canonical project; final npm run check passed after the development-base adjustment |
| Solidity | 35/35 passed, including 256 fuzz runs; Solidity 0.8.28, Paris, optimizer 200 |
| Isolation | 215 integrity-pinned registry packages, zero external filesystem links and zero unused service SDKs |
| Chain check | Read-only verification of chain 5042002, runtime/source hashes and settled bill 1 at head 67666905 |
| Pages CI | [Run 39031619289](https://github.com/a252937166/splitreceipt/actions/runs/39031619289) succeeded for 566a2f24d2faee88d441115d92127e01685058e9 |

Local engineering reports and logs are retained outside tracked application artifacts. Cold npm verification does not establish a cold Foundry/compiler installation: a new Solidity environment needs Foundry and its pinned compiler download. No ArcPreflight directory, faucet, API or wallet service is required to install or run this application.

## Studio persistence and preview

A new Studio Download Code archive was saved and independently inspected. The [sanitized source proof](../tests/evidence/studio-source-readback-2026-10-17.json) records 22 synchronized paths, with 20 byte-identical to the canonical working tree, including all synchronized application source and tests. Contract bytes matched the original canonical Studio contract. Only the development host adaptations in package.json and vite.config.ts differ: Studio uses 0.0.0.0 and allowedHosts, while the canonical project retains localhost binding.

The private ZIP has SHA-256 `46e458e3125421abd5144b409c75e40dfb8aee7a98d284c57fc6582e673ccd69`; it is outside Git. Studio reported TypeScript zero errors, 16 passing tests and a successful build. Its actual refreshed Preview displayed the new testnet banner, public demo link and UTF-8 title-byte counter, with screenshots/frames captured. These UI observations, downloaded source comparisons and the independent local/CI test results are separate evidence layers. See [PROVENANCE.md](PROVENANCE.md).

## Receipts and deterministic coverage

Tests cover continuation beyond 150,000 blocks, incremental refresh, failed-page retry, the genesis boundary, exact event filtering, conflicting hashes, navigation/scope cancellation, successful final replacement hashes, cancelled/reverted payments and complete BillCreated field matching. These tests do not claim real-wallet pending-transaction acceleration or cancellation on Arc Testnet.

The [history RPC smoke](../tests/evidence/history-rpc-smoke-2026-10-17.json) separately records the helper recovering bill 1’s two hashes in three 2,000-block pages at head 67666623 without a configured deployment floor. All-history retry remains available for a paid share lacking a link after a complete scan, including delayed RPC indexing.

## Bill 2: browser wallet and independent proof

The local standalone app was exercised with an ordinary MetaMask extension: connection, a rejected create request, successful creation, a rejected payment request and successful payment. Rejected requests were not presented as successful transactions or paid receipts. The second payer was the original disposable test account, paid by root through private local tooling.

The [creation proof](../tests/evidence/browser-wallet-bill2-create.json) independently verifies its successful transaction, source/target, calldata, title, recipient, share and ordered payers. The [final proof](../tests/evidence/browser-wallet-bill2-final.json) verifies both successful payment receipts, exact nonremoved SharePaid events, final hashes, current paid state [true, true], and the recipient’s historical balance increase of exactly 0.002 test USDC.

| Transaction | Gas in test USDC |
| --- | --- |
| [Create](https://explorer.testnet.arc.io/tx/0x69c6209b9dd2f35de2a657879be66b1d76c1dd4f4f41bae6e32e2a8926aa1839) | 0.005349925 |
| [MetaMask share](https://explorer.testnet.arc.io/tx/0xc1a18f3c1698d207ca6c247643175b0e1f958ea4719da4ccb5d5b751532a2b6a) | 0.0017118 |
| [Original payer share](https://explorer.testnet.arc.io/tx/0x80d5b5c0c7d5941994eddd700587051d8f054c466a071afde5c7611ace315cb7) | 0.001771625 |
| Total | **0.00883335** |

Shares total 0.002; gas plus shares totals 0.01083335 test USDC. These are test assets. No mainnet transaction or additional paid service was used. A proposed top-up was skipped because the browser wallet had sufficient test USDC.

Final local browser observations:

- Refresh showed bill 2 settled 2/2. Disconnect followed by a hard reload restored the Connect wallet button and both payment hashes from chain history, with the bill still settled.
- Reconnection through MetaMask’s native local-origin consent was cancelled once: the app showed “Wallet request cancelled.” A retry was accepted and connected successfully.
- Switching to an existing second MetaMask account showed address `0xA944…1A7c`, retained both receipts, and removed the old payer’s “you” marker. This was a connection/account-change check; it sent no transaction from that account.
- Switching the connected network to existing Sepolia testnet caused the Create Bill page to show its Switch to Arc Testnet banner and action. Using the app action returned the wallet to Arc Testnet successfully. No transaction was sent on Sepolia.

A rejected network-switch prompt was not exercised. Real post-broadcast nonce acceleration and cancellation were not exercised in the browser; their receipt/replacement invariants have deterministic coverage where listed above.

## Public delivery and remaining boundary

- The [public repository](https://github.com/a252937166/splitreceipt) exists on main with public visibility and Pages enabled.
- The [HTTPS site](https://a252937166.github.io/splitreceipt/) is deployed. GitHub reports workflow publishing and HTTPS enforcement. Anonymous bill reading was observed in the public browser; RPC CORS was independently checked for this origin.
- The [bill 2 URL](https://a252937166.github.io/splitreceipt/?bill=2) was read back in the public browser showing the connected `0xA944…1A7c` account, settled 2/2 status and both payment hashes. Screenshots and frames were captured separately from the scripted RPC proof.
- **Public wallet connection was observed after human handling.** The first attempt produced a MetaMask phishing warning and was cancelled. The user then personally handled the wallet security flow; the subsequent public page showed a connected account and both receipts. The cause of the classification remains unconfirmed. This does not establish that it was a false positive, was removed, or will not recur for future visitors. See [METAMASK-SITE-REVIEW.md](METAMASK-SITE-REVIEW.md).
- The successful initial run above identifies the observed deployment precisely. The later proof files and documentation preserve the deployed application code; use the Actions history to check their own source revision and deployment result.

Studio and browser recordings remain local, outside the source repository. No uploaded video URL is claimed. Mainnet deployment, mainnet payments and competition submission have not been performed.
