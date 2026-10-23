# Organizer question — draft, unsent

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

**Not sent. No organizer response, exception or acceptance is claimed.** Verify the official contact channel and review the exact message before any external send.

## Proposed message

Subject: Built with Arc Studio — mixed-source workflow clarification

Hello,

I am preparing SplitReceipt for this round and want to clarify the Studio requirement before considering a mainnet deployment.

- Studio project: https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62
- Public source: https://github.com/a252937166/splitreceipt
- Current public app: https://splitreceipt.axiqo.xyz/splitreceipt/ (Arc Testnet only as of 22 October; a reviewed Arc Mainnet context exists since 23 October, see [MAINNET-LIVE.md](../MAINNET-LIVE.md))

The contract and original app began in Arc Studio. Some earlier dependency isolation, wallet/receipt handling, delivery work and UI refinements were authored locally and later synchronized back. Later UI and receipt-discovery work was authored in Studio. More recent mainnet-preparation and explicit-wallet-session inputs were prepared with Codex outside Studio, then actually written and tested through Studio's official manual terminal. We retained exact terminal/per-file hash readback; those records do not establish that all source was authored by Studio AI.

The original Studio deployment route hit a policy limit, so the unchanged contract was deployed with a separate test-only wallet. The exported static app is hosted externally. We have genuine testnet creation/two-payment/receipt evidence, but, as of 22 October, no mainnet deployment or payment (superseded on 23 October; see [MAINNET-LIVE.md](../MAINNET-LIVE.md)), and understand testnet evidence alone does not qualify. On 21 October, actual Studio testing included 76 TypeScript tests and the separate preparation's 38 Solidity tests with 256 fuzz runs; chain-5042 cases were local EVM tests, not mainnet.

Would this mixed authorship satisfy the round's Studio requirement, or would locally/Codex-authored portions need a different permitted Studio or CLI workflow? Does later synchronization count at all, and if so what evidence is needed? Also, may a Studio-authored contract be deployed from a self-custodied wallet and its exported app hosted externally? How should we provide reviewer access to the Studio project?

I would prefer to resolve provenance before spending funds on mainnet. Thank you.

## Use and evidence notes

The [official page](https://dorahacks.io/hackathon/arc-microgrants-2/detail), rechecked on 22 October, covers Studio development from contract through the working app, excludes externally built and testnet-only work, and expressly mentions a Studio CLI for retrieving the project URL. It does not define a permitted external-source percentage, a retroactive import exception or an exclusively browser-AI workflow. External hosting/direct deployment compatibility is not an organizer-approved exception.

Do not soften the mixed history into “only local verification.” Do not assert that syncing or terminal application cures external authorship. The message requests clarification; it makes no mainnet/testnet exemption claim. The public Studio URL exists, but independent reviewer access remains unconfirmed.

Use only the owner's reviewed contact/identity/disclosures when needed. No personal contact from another project is included here. The current DoraHacks entry attempt was canceled at its Organizer Disclaimer, which was not accepted; actual form fields remain uninspected. Sending this draft, accepting a disclaimer, registering and submitting are separate actions.
