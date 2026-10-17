# Validation record

This file distinguishes recorded historical evidence, checks on the standalone repository, and work that still needs verification. Pending rows are not completed claims. Update the revision, commands and observations before marking the release complete.

## Recorded testnet evidence

The [deployment manifest](../deployments/arc-testnet.json) records an Arc Testnet deployment and the bill-1 create/pay/pay sequence. Explorer references are in [README.md](../README.md#testnet-deployment). The previous browser walkthrough showed the bill settled with two receipts and receipt recovery after a reload. Those recordings remain local and have not been uploaded.

This evidence predates the standalone repository refinements below. The current source and published site require their own verification.

A [2026-10-17 read-only RPC smoke artifact](../tests/evidence/history-rpc-smoke-2026-10-17.json) records the new standalone history helper recovering both known payment hashes in three 2,000-block pages at head `67666623`, without a configured deployment-block floor. Its scanned range was `67660624`–`67666623`. This is scripted RPC evidence, separate from browser-wallet or Studio recording evidence.

## Standalone checks

| Check | Command or observation | Status |
| --- | --- | --- |
| Frozen clean install | Node 22.23.1, npm 10.9.8; `npm run verify:clean` performs the frozen install/checks in an independent copy | Pending |
| Type checking | `npm run typecheck` | Pending |
| Frontend unit/provider tests | `npm test` | Pending |
| Production build | `npm run build` | Pending |
| Solidity build and tests | `npm run contracts:build`; `npm run contracts:test` | Pending |
| Read-only chain verification | `npm run chain:check`: chain, deployed runtime and recorded bill/receipts | Pending |
| Dependency isolation | `npm run verify:isolation`; no symlink, package resolution, build, runtime, faucet or indexer dependency on ArcPreflight | Pending final audit |
| Public build privacy | No private keys, API secrets, local signing bridge, machine-local paths or raw logs | Pending final audit |

## Receipt and wallet cases

| Case | Required result | Status |
| --- | --- | --- |
| History older than 50,000 blocks | Continue pages to earlier ranges and recover verified links | Pending canonical test run |
| Refresh and retry | Scan new blocks; keep verified pages; retry the failed cursor without skipping blocks | Pending canonical test run |
| Scope and event validation | Ignore wrong contract/bill/payer/amount and removed events; isolate navigation state | Pending canonical test run |
| Wallet speed-up | Associate payment with the final mined hash and matching successful event | Pending deterministic test |
| Wallet cancellation/revert | Never show a paid-share success or receipt for cancellation/revert | Pending deterministic test |
| Ordinary injected-wallet connection | Real browser wallet connects; account and chain changes update the app | Pending browser verification |
| Connection/transaction rejection | Clear recoverable state; no transaction or receipt falsely claimed | Pending browser verification |
| Wrong-network switch rejection | Payment stays disabled until Arc Testnet is active | Pending browser verification |
| Complete payment and reload | Mine a testnet payment, show the matching receipt, recover after reload | Historical walkthrough recorded; standalone run pending |

Deterministic provider/RPC tests are distinct from using an ordinary browser wallet. Arc Testnet may confirm too quickly to reliably reproduce a real pending-transaction replacement. Any replacement test must record whether it was simulated or mined.

## Public delivery

| Item | Target | Status |
| --- | --- | --- |
| Public source | `https://github.com/a252937166/splitreceipt` | Pending creation/push |
| Static site | `https://a252937166.github.io/splitreceipt/` | Pending deployment |
| Example deep link | `https://a252937166.github.io/splitreceipt/?bill=1` | Pending public browser check |
| HTTPS, asset paths and RPC CORS | Anonymous browser load and hard reload of bill 1 | RPC CORS checked with the target Origin; deployed browser check pending |
| Release revision and Actions run | Record commit SHA and successful deployment run URL | Pending |
| Mainnet | None | Not performed |
| Competition submission | None | Not performed |

## Release observations

Add dated, concrete results here after the corresponding checks. Do not replace a failed or missing check with a blanket "all tests passed" statement.
