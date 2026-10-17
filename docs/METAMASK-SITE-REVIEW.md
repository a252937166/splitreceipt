# MetaMask public-site warning review

Reviewed on 17 October 2026 for `https://a252937166.github.io/splitreceipt/`.

During a new connection from the public site, MetaMask displayed a native warning describing signs of phishing or wallet-draining activity. This wording indicates a site risk classification. Its cause remains unconfirmed; there is no evidence that it is a routine prompt shown for every new site.

## Verified public evidence

- In the official `eth-phishing-detect` [configuration snapshot at commit `91555173e39ea43c65223403abaaf0adc8411576`](https://github.com/MetaMask/eth-phishing-detect/blob/91555173e39ea43c65223403abaaf0adc8411576/src/config.json), the exact hostname `a252937166.github.io` and its applicable parent domains had no blocklist match. The snapshot contained 106,778 blocked entries, including 415 other GitHub Pages subdomains, but no blanket `github.io` entry. Its fuzzy check also did not match this hostname: the closest distance was 16 against a tolerance of 1.
- The official [PhishingController source](https://github.com/MetaMask/core/blob/main/packages/phishing-controller/src/PhishingController.ts) also implements dynamic URL classification and cached results in addition to static lists. The current [URL normalization source](https://github.com/MetaMask/core/blob/main/packages/phishing-controller/src/utils.ts) sends the exact hostname for this GitHub Pages address; its project path is not included. The installed wallet's exact classification source and cached state were not inspected, and no scan API was called during this review.
- MetaMask's [official security-alert guidance](https://support.metamask.io/configure/wallet/security-alerts#how-to-report-a-false-classification) explains that multiple intelligence sources contribute to classifications. For an incorrectly classified URL, it directs users to support for manual review, with the URL, network, screenshot and verification links. Absence from one public list does not establish that a live classification has been cleared.

## Browser validation outcome and limits

After the user personally handled the native warning, the operator observed the public page connected to account `0xA944…1A7c` and bill 2 showing both shares paid, with two receipts. Public-site connection was therefore exercised after human handling. This does not establish that the underlying risk classification was removed or that future visitors will avoid the warning.

The warning screenshot itself does not display its request origin, and the foreground browser tab in that image is local. Attribution to the public connection relies on the recorded sequence of public-site connection, pending wallet request and warning, rather than the screenshot alone.

The operator did not submit a false-positive report, change wallet security settings, move hosting or modify application code as part of this review. The user's own handling of the warning was not inspected. If the warning recurs, the supported next step is an evidence-based manual classification review through MetaMask support; its outcome is still pending any such request.
