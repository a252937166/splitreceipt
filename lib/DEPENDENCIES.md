# Solidity dependencies

- `forge-std/` is vendored source from the official `foundry-rs/forge-std` repository, tag `v1.9.7`, commit `77041d2ce690e692d6e03cc812b57d1ddaa4d505`.
- Source archive: `https://codeload.github.com/foundry-rs/forge-std/tar.gz/77041d2ce690e692d6e03cc812b57d1ddaa4d505`.
- MIT and Apache 2.0 licenses are preserved in the dependency directory. There is no submodule or external filesystem link.
- OpenZeppelin Contracts is the exact official npm package `@openzeppelin/contracts@5.1.0`, pinned with its registry integrity in the root npm lockfile. Foundry resolves it from this project's own `node_modules` directory after `npm ci`.
- Solidity compiler: `0.8.28`, Paris EVM, optimizer enabled with 200 runs. Build/test tooling never needs ArcPreflight.
