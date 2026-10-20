# MetaMask public-site warning review

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

Reviewed on 18 October 2026.

The official scan API `https://dapp-scanning.api.cx.metamask.io/v2/scan?url=splitreceipt.axiqo.xyz` returned `recommendedAction: NONE` in one scan on 18 October 2026.

**This does not guarantee future wallet behavior or certify security.** A single NONE result from one scan at one point in time does not mean:
- The site is free of all risk classifications
- The result will be the same for future visitors or future scan times
- The application has been audited or certified as safe
- Wallet warnings will never appear

Anonymous bill reading on the dedicated domain (bill 3, settled 2/2) was observed without a wallet connection. A wallet connection on the new hostname was not independently recorded in the same way as the old hostname test.

## What to do if you see a wallet security warning

1. **Stop.** Do not approve, bypass, dismiss or "continue anyway."
2. Verify the URL in your browser address bar is exactly `https://splitreceipt.axiqo.xyz/splitreceipt/`.
3. Verify you are on Arc Testnet (chain ID 5042002).
4. Verify the contract address in any pending transaction matches `0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26` exactly.
5. If you cannot verify all three, do not proceed.
6. If all three match and you still see a warning, contact MetaMask official support with the URL, network, contract address, and a screenshot. Do not act on advice from unofficial sources or direct messages.

## Scope

This review is bounded. It is not a security audit of the application, contract, or hosting infrastructure. It does not establish the application is safe, audited, or that any warning is a false positive.
