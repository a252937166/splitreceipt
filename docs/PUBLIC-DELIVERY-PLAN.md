# Free public testnet delivery plan

Checked on 2026-10-17. This is a preparation note; it does not establish that a repository or site has been published.

## Recommended route

Publish an independent public `a252937166/splitreceipt` repository and its static build to `https://a252937166.github.io/splitreceipt/`. Use GitHub Pages with a standard Ubuntu Actions runner. No new hosting account, custom domain, paid runner, server, database, or API key is required for this route.

The authenticated GitHub user was `a252937166`; the target repository API returned HTTP 404. The canonical directory was not yet a Git repository at inspection time. These are observations with the current credentials, not a reservation of the repository name.

[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) allow public repositories on GitHub Free, with a 1 GB published-site maximum and 100 GB/month soft bandwidth limit. [Standard Actions runners](https://docs.github.com/en/billing/concepts/product-billing/github-actions) are free for public repositories and Pages; larger runners are billed. Use a standard runner, short artifact retention, and a small site artifact; omit video/raw recordings and unnecessary caches from CI.

## Hosting scope

Publish a clearly labeled, noncommercial **Arc Testnet demonstration**, using only test assets. Disable mainnet support in the deployed app. Do not collect passwords, private keys, card details, payments for service, or wallet recovery phrases.

GitHub's [Pages policy](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#pages) describes project showcases as its primary purpose and excludes sites mainly facilitating commercial transactions or SaaS. A free project demonstration with valueless test assets is a reasonable fit for the present scope; this is an interpretation, not explicit GitHub approval. Do not extend this hosting decision to a mainnet payment service without reassessing it.

## Required configuration

- Set Vite `base: '/splitreceipt/'` for the repository project site. A root/custom-domain deployment instead needs `/`. See the [Vite deployment guide](https://vite.dev/guide/static-deploy.html#github-pages).
- Keep links at `/splitreceipt/?bill=1`. The app currently routes bill IDs through the query string, so a direct reload requests the existing index rather than an unsupported `/bill/1` path. Preserve the current pathname when building share links.
- Build and upload only `dist/`. Set Pages to the GitHub Actions source and use the official checkout/setup-node/configure-pages/upload-pages-artifact/deploy-pages workflow, pinned to reviewed revisions. Grant `contents: read`, `pages: write`, and `id-token: write` only where needed.
- Use the standalone lockfile and documented runtime. CI must pass its frozen install, typecheck, meaningful frontend tests, and production build without following links into ArcPreflight.
- Include only the public testnet contract address, deployment block, ABI and RPC URL. Chain configuration and writes must be restricted to `5042002`.
- The public build must exclude the local test-wallet signer bridge, test private keys, local run manifests, `.env` files, raw logs and Studio-only tracing hooks. Public users use their own injected wallet and approve requests in that wallet.
- The [default GitHub Pages domain](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https) provides HTTPS automatically. Ensure RPC, explorer, fonts and other assets also use HTTPS.

## Live RPC compatibility check

At `2026-10-17 11:58:50 UTC`, read-only requests to `https://rpc.testnet.arc.io` using Origin `https://a252937166.github.io` returned:

| Request | Result |
| --- | --- |
| OPTIONS with POST/content-type preflight | HTTP 204; allowed Origin matched; POST and content-type allowed |
| POST `eth_chainId` | HTTP 200; `0x4cef52` = `5042002`; allowed Origin matched |

No authenticated proxy is needed based on this check. It verifies current response headers, not future RPC availability or a completed browser deployment. Verify the actual public site after publishing. The [official Arc network reference](https://docs.arc.io/arc/references/connect-to-arc) lists this public testnet RPC and chain ID.

## Public source and handoff material

The repository should contain the application, contract source/tests, dependency lockfile, build/verification scripts, deployment configuration, license and short README. Document the Studio project URL, deployed testnet address/block, native-USDC 18-decimal units, free faucet instructions, the two-payer walkthrough, receipt recovery behavior and limitations, and exact tested commands. Credit Arc Studio accurately. Link the recordings separately after privacy review; do not imply that testnet evidence meets a mainnet contest requirement.

Before publishing, review the exact tracked-file list and build output for secrets, machine-local paths, symlinks and accidental ArcPreflight coupling. After publishing, verify anonymous repository access, the root page, asset URLs, `?bill=1` after a hard reload, disconnected read-only receipts, an ordinary injected-wallet connection and testnet-only transaction controls. Record the final commit, Actions deployment, site URL and checks in the handoff.

## Initial Pages setup

After reviewing and pushing the public repository's `main` branch, the maintainer can select Actions publishing with the [official Pages REST API](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site):

```sh
gh api --method POST repos/a252937166/splitreceipt/pages -f build_type=workflow
gh workflow run pages.yml --repo a252937166/splitreceipt --ref main
gh run list --repo a252937166/splitreceipt --workflow pages.yml --limit 3
gh api repos/a252937166/splitreceipt/pages --jq '{html_url,build_type,status,https_enforced}'
```

If a Pages site already exists, inspect it before changing it; the update endpoint is `PUT /repos/{owner}/{repo}/pages`. The first push can start the workflow before Pages is configured, so rerun the existing workflow after setup if needed. The workflow intentionally cannot create a Pages site using its restricted deployment token. Record the successful Actions run and public browser results in [VALIDATION.md](VALIDATION.md); creating a repository or enabling Pages alone is not deployment proof.

## Ordinary-wallet test guidance

[MetaMask's developer guidance](https://docs.metamask.io/metamask-connect/evm/guides/manage-user-accounts/) calls for user-triggered connection, handling rejection `4001` and pending request `-32002`, and reacting to account/network changes. Test connect rejection, transaction rejection, a wrong-network switch rejection, account changes and disconnect without creating a receipt or a duplicate pending request.

[MetaMask's pending-transaction guidance](https://support.metamask.io/manage-crypto/transactions/how-to-speed-up-or-cancel-a-pending-transaction) explains that speed-up and cancel use a replacement with the same nonce, and apply only while the original remains pending. Arc Testnet may confirm too quickly for reliable UI replacement. Use deterministic provider/RPC tests for replacement/cancellation semantics, and distinguish those tests from a real browser wallet and mined testnet transaction. A cancelled replacement must never become a paid-share receipt; a successful speed-up must link the final mined payment hash.

## User actions

No user action is presently identified for the GitHub route: the CLI is authenticated and the user has authorized public source/site delivery. If GitHub rejects repository/Pages writes for missing scope or verified-email requirements, report that exact failure and request only the required authentication action. Do not enable billing or substitute a paid service.
