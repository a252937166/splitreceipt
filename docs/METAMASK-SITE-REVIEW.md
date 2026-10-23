# MetaMask public-site warning review

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

## Summary

This review covers two hostnames used during the project:

- `a252937166.github.io` — old GitHub Pages hostname (historical, no longer primary demo)
- `splitreceipt.axiqo.xyz` — current dedicated hosting hostname (primary demo)

**Stop immediately if your wallet shows a security alert.** Do not approve, bypass, or dismiss unknown warnings. Check the URL, network, and contract address, then contact official support before continuing.

## Old hostname: a252937166.github.io

Reviewed on 17 October 2026.

During a new connection from the public GitHub Pages site, MetaMask displayed a native warning describing signs of phishing or wallet-draining activity. This wording indicates a site risk classification. Its cause remains unconfirmed; there is no evidence that it is a routine prompt shown for every new site.

### API scan result (old hostname)

The official scan API `https://dapp-scanning.api.cx.metamask.io/v2/scan?url=a252937166.github.io` returned `recommendedAction: BLOCK` at 2026-10-18 07:57:10 UTC. Reason and contributing vendor are unknown. This is not a confirmed false positive.

### eth-phishing-detect list check

In the official `eth-phishing-detect` [configuration snapshot at commit `91555173e39ea43c65223403abaaf0adc8411576`](https://github.com/MetaMask/eth-phishing-detect/blob/91555173e39ea43c65223403abaaf0adc8411576/src/config.json), the exact hostname `a252937166.github.io` and its applicable parent domains had no blocklist match. The snapshot contained 106,778 blocked entries, including 415 other GitHub Pages subdomains, but no blanket `github.io` entry. Its fuzzy check also did not match this hostname: the closest distance was 16 against a tolerance of 1.

Absence from one public static list does not establish that a live classification has been cleared. The installed wallet's exact classification source and cached state were not inspected.

### Browser validation outcome and limits

After the user personally handled the native warning, the operator observed the public page connected to account `0xA944…1A7c` and bill 2 showing both shares paid, with two receipts. Public-site connection was therefore exercised after human handling. This does not establish that the underlying risk classification was removed or that future visitors will avoid the warning.

The operator did not submit a false-positive report, change wallet security settings, move hosting or modify application code as part of this review. If the warning recurs on this hostname, the supported next step is an evidence-based manual classification review through MetaMask support; its outcome is still pending any such request.

## New hostname: splitreceipt.axiqo.xyz

Historical scan reviewed on 18 October 2026; later public-wallet observations are recorded separately below.

The official scan API `https://dapp-scanning.api.cx.metamask.io/v2/scan?url=splitreceipt.axiqo.xyz` returned `recommendedAction: NONE` in one scan on 18 October 2026.

**This does not guarantee future wallet behavior or certify security.** A single NONE result from one scan at one point in time does not mean:
- The site is free of all risk classifications
- The result will be the same for future visitors or future scan times
- The application has been audited or certified as safe
- Wallet warnings will never appear

Anonymous bill reading on the dedicated domain (bill 3, settled 2/2) was observed without a wallet connection on 18 October 2026.

At the earlier Bill 4 checkpoint, the owner reported a create approval without a malicious-site warning. Payment confirmation on the new domain had not yet been retested **at that checkpoint**.

### Current public-wallet retest — 22 October 2026

The published application source `4dae47f01bb78126e5c70621d87af0c9899cb9c6` completed [Bill 6](https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6) creation and two 0.001 test-USDC payments. The public UI reached 2/2 paid and 2/2 verified receipts, confirmed separately by canonical chain proof. App Disconnect plus reload in the same profile retained both receipts and showed Connect wallet.

The owner explicitly reported personally confirming creation and payment 2 without a security warning. Native wallet pixels were not captured. The first payment's native signature actor/action and warning state were not observed. This is a bounded report for those steps, not proof that every wallet or future visit is warning-free. No fresh 22 October classification scan or cleared-support appeal is claimed.

The app's wallet repair lists named EIP-6963 providers, avoids the shared targetless legacy injection slot, disables automatic reconnect on reload and gates writes on explicit connector/account/chain acknowledgement. It addresses app selection/session ambiguity; it does not repair extension-internal scripts. An earlier `Cannot redefine property: ethereum` error originated from an injected extension script. The current captured console sample had no error-level messages but retained MetaMask listener/orphan-stream warnings. No complete extension repair or security certification is claimed.

See [VALIDATION.md](VALIDATION.md) for the full current check record.

## What to do if you see a wallet security warning

1. **Stop.** Do not approve, bypass, dismiss or "continue anyway."
2. Verify the URL in your browser address bar is exactly `https://splitreceipt.axiqo.xyz/splitreceipt/`.
3. Verify you are on Arc Testnet (chain ID 5042002).
4. Verify the contract address in any pending transaction matches `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26` exactly.
5. If you cannot verify all three, do not proceed.
6. If all three match and you still see a warning, contact MetaMask official support with the URL, network, contract address, and a screenshot. Do not act on advice from unofficial sources or direct messages.

## Scope

This review is bounded. It is not a security audit of the application, contract, or hosting infrastructure. It does not establish the application is safe, audited, or that any warning is a false positive.
