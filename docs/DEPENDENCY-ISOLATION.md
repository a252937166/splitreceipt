# Independent installation and dependency boundaries

The canonical SplitReceipt project is self-contained. Its npm lockfile, installed packages, Vite/TypeScript configuration, Solidity source and test dependencies all belong to this directory. Runtime code does not import another local project, query its network metadata, use its faucet or read its wallet credentials.

## Installation

Use Node.js 22 and npm 10.9.8, then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:isolation
npm run check
```

The committed lockfile pins all transitive npm packages to official `registry.npmjs.org` URLs and package integrity hashes. Lifecycle scripts are not required. Native esbuild/Rollup optional packages are selected by the platform and CPU running npm. On macOS, install and run with the same Node architecture; mixing a Rosetta x64 installation with a native arm64 Node binary is unsupported.

The wallet integration uses Wagmi 3.0.0 and Viem 2.57.2 with browser-injected EIP-1193/EIP-6963 providers. It does not need ConnectKit, WalletConnect, a Circle SDK, an account API key or a remote wallet service. The optional MetaMask, Coinbase and WalletConnect SDK peers are not installed. An installed browser extension retains its own keys and signing approvals.

`npm run verify:isolation` checks every dependency link and registry URL, rejects external filesystem links, checks the exact OpenZeppelin version and rejects unrelated project paths in executable source/configuration. Ordinary npm `.bin` links are allowed only when their resolved target remains in this project.

## Fresh checkout verification

```sh
npm run verify:clean
```

This script copies source, configuration, tests and the committed lockfile into a new temporary directory, excluding `node_modules` and generated output. It uses an initially empty npm cache, executes frozen `npm ci`, then typechecks, tests and builds. It compares the lockfile hash before and after. The local report is written to `.verification/clean-install.json`; temporary logs and package caches are not public application assets.

## Solidity

Install Foundry, then run `forge test`. Foundry obtains the pinned compiler from its official distribution when it is not already cached. The observed verification used `forge test --offline` with Solidity 0.8.28 already installed; an empty compiler cache cannot be used offline.

The compiler is Solidity 0.8.28, Paris EVM, optimizer 200 runs. OpenZeppelin Contracts is exactly 5.1.0 from this project's npm installation. Forge Standard Library is vendored at a fixed official commit; see `lib/DEPENDENCIES.md`. There are no Git submodules or dependency links to another project.

## Network and credentials

The public application configures only Arc Testnet, chain ID 5042002, and the official public RPC `https://rpc.testnet.arc.io`. Mainnet chains and transports are absent. The app's native test USDC uses 18 decimals; its displayed/input precision is limited to 6 decimals using integer arithmetic.

`npm run chain:check` independently checks the RPC chain ID, the historical deployment's runtime hash, the checked-in contract source hash, the settled example bill and its two mined `SharePaid` receipts. It is read-only and does not load a private key or send a transaction. The deployment record is public in `deployments/arc-testnet.json`.

The existing disposable local test wallets and their private keys are outside the project and are not required to install, build, browse, verify receipts or use the public app. There is no local signing bridge or Studio tracing code in the public build.

The historical testnet contract was funded once during the earlier demonstration through a project faucet. That historical transaction remains public evidence; this installation and app have no ongoing dependency on that faucet. A new user needs their own browser wallet and free testnet USDC to create or pay a bill. Reading bills and receipts requires no wallet.

## Verified on 17 October 2026

| Check | Observed result |
| --- | --- |
| Independent frozen install | Passed in a fresh temporary checkout and initially empty npm cache; Node 22.23.1 / npm 10.9.8; install, typecheck, tests and production build all exited 0. |
| Lockfile | SHA-256 `71e263e58efab869ca054f3a1a1ad8e0260a95ded5d7dc7cb47492459558a025`; unchanged by frozen installation. |
| Dependency isolation | 215 registry-locked packages including platform alternatives; 0 external filesystem links and 0 unused service/multi-wallet SDK packages. 23 normal npm executable links resolve inside the project. |
| Frontend deterministic tests | 16 passed: resumable receipt history, successful/replaced/cancelled bill receipts, stale callback isolation and exact integer amount handling. |
| Solidity tests | 35 passed, including the wrong-amount fuzz test with 256 runs; no failures or skipped tests. |
| Production client | Vite build passed. |
| Independent live readback | At RPC head 67666905, the deployed runtime hash and local Solidity source hash matched; example bill 1 had two paid flags and both recorded payment hashes had successful matching `SharePaid` events. No signing occurred. |

These checks cover the standalone dependency tree on macOS arm64 and the public testnet readback. Ordinary browser extension interaction, public hosting and final UI verification are recorded separately in `VALIDATION.md`; a local build result alone is not evidence of a deployment.
