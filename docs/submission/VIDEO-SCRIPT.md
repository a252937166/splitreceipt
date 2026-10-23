# Video plan — testnet evidence and missing final scenes

> **23 October 2026 update:** Arc Mainnet contract deployment is now verified. See [current mainnet status and evidence](../MAINNET-LIVE.md) for the exact source-pinned deployment, live application/receipt status, fees and remaining submission work. Deployment and wallet funding alone are not a through-application payment. The dated Testnet/preparation material below is retained as historical evidence; its statements about an undeployed or disabled mainnet describe that earlier checkpoint. No competition submission or eligibility acceptance is claimed.

**Draft storyboard, not a finished competition video.** The official details page, rechecked on 22 October, requires a walkthrough showing the build in Studio and a mainnet transaction. It states no explicit minimum/maximum duration, resolution or continuous-session format. The underlying form has not been inspected; do not invent a format waiver or requirement.

## Existing material that can be reused accurately

The latest private file is `SplitReceipt-Studio-public-wallet-release-testnet-sampled-20261022.mp4` (SHA-256 `144b70d5cb3d072a9710ce2de0f6ee9dd0e63ddfe6487c32e14b9142ae4601a4`). It is 63 seconds, silent, 1080p/30fps, assembled from 21 manually captured public-page milestone screenshots with waits compressed. Media QA is complete; it has not been uploaded. Its capture window spans 21–22 October, not a continuous 63-second live session.

The sequence includes public release/page checks, historical Bills 3 and 5, Bill 6 creation 0/2, payment 1 reaching 1/2, explicit session acknowledgement after changing account, payment 2 reaching 2/2 and two verified receipts, then app Disconnect/reload. It records app requests/results, not native wallet confirmations. It includes no Studio editing or new Studio-AI generation. Do not overlay a fictional signature, Studio activity or mainnet transaction onto it.

The earlier 54-second/18-screenshot material is separate historical footage. [LOCAL-ASSETS.md](LOCAL-ASSETS.md) records availability and limitations.

## Future final walkthrough — proposed structure

This table is a plan. Missing scenes must be genuinely captured, with source/privacy review, before they can be described as recorded. A target around two minutes is editorial only.

| Scene | Proposed narration | Actual evidence / missing action |
| --- | --- | --- |
| 1. Problem and scope | “SplitReceipt puts a shared bill and each payer's verified receipt in one link.” | Show real public app; label the current example Arc Testnet. No outside-customer claim. |
| 2. Studio project and contract | “The contract and original app began in Studio. Earlier local refinements were synchronized. More recent Codex-prepared inputs were applied through Studio's official terminal; the repository records that mixed history.” | Capture actual Studio source/test work or clearly dated existing genuine Studio material. The current 63-second segment contains none. |
| 3. Tests | “On 21 October, Studio and independent local checks passed 76 TypeScript tests. The preparation also passed 38 Solidity tests with 256 fuzz runs.” | Label old logs by date; if rerun, capture actual invocation/result. Local-EVM chain-5042 tests are not mainnet execution. |
| 4. Testnet product flow | “A creator records a recipient, two to five payers and an exact share. Each payment goes through the contract to the recipient.” | Existing Bill 6 milestones can be shown with a visible sampled/waits-compressed label. Do not imply native signing footage. |
| 5. Receipt recovery | “The app checks successful receipts, canonical blocks and exact payment events, then falls back to bounded history scans.” | Show Bill 6's two receipt links and real testnet explorer evidence. A paid count is separate from receipt verification. |
| 6. Required mainnet operation | “This transaction moves USDC through the deployed contract and public app on Arc mainnet.” | **22 October status: MISSING. Superseded 23 October:** the contract and Bill 1 now exist ([MAINNET-LIVE.md](../MAINNET-LIVE.md)). The line below describes the earlier plan. Only after separate authorization, review and genuine owner signatures could a real scene be recorded. At that checkpoint mainnet writes were locked (historical). |
| 7. Mainnet explorer | “Here are the actual mainnet contract address and successful payment transaction.” | **22 October status: MISSING. Superseded 23 October:** show the existing, independently verified Bill 1 receipts read-only. Show independently verified real mainnet receipt/event. Never use Bill 6 or a local-EVM test as a stand-in. |
| 8. Close with links and limits | “Source, Studio project and live app are linked; this prototype is unaudited.” | Confirm reviewer access and public video playback before form submission. Mixed-provenance acceptance remains a separate gate. |

## Caption for the existing sampled record, if later published

> SplitReceipt — Arc Testnet public-wallet retest. This silent 63-second supporting record uses 21 real milestone screenshots with waits compressed. Bill 6 reached 2/2 paid and 2/2 verified receipts, including a disconnected reload in the same profile. Test USDC has no monetary value. No Studio source editing, native wallet signing or mainnet activity is shown. The source record discloses mixed Studio/local development. This is not the final competition walkthrough.

Source: https://github.com/a252937166/splitreceipt

Live testnet Bill 6: https://splitreceipt.axiqo.xyz/splitreceipt/?network=testnet&chainId=5042002&contract=0x6996d66f6f74802a644e1e52c6d771a4d5c6ad26&bill=6

Studio project: https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62 (independent reviewer access unconfirmed).

## Before a final video URL is used

Verify all scenes against actual evidence, keep testnet/mainnet labels visible, remove visible credentials/unrelated account content, distinguish recorded signatures from owner reports and obtain any required permission for public media. The owner reported no warning for Bill 6 creation and payment 2; payment 1's native signature/warning was not observed. Do not say every wallet warning or extension error was fixed.

A public video URL is **NOT_AVAILABLE**. An upload, anonymous playback, required Studio/mainnet coverage, actual form requirements and final submission are separate checks. No upload, paid service or mainnet operation is performed by this plan.

## 23 October 2026: final film requirements (replacement rebuild)

A dated addition; the plan above is kept as history.

- **Status.** The final film is being prepared. It will use real native continuous Studio and product footage, English narration and captions. **There is no public video link yet.** The earlier 63-second sampled slideshow (and the other silent or sampled private edits) are historical only and must not be presented as the final walkthrough.
- **No new mainnet activity.** No new mainnet transaction or deployment is made for the recording. Mainnet scenes show the existing Bill 1 read-only (settled 2/2, two receipts; both payers are owner demonstration accounts; 0.002 USDC gross shares, 0.001 USDC net inter-wallet transfer; 0.02263094 USDC total historical deployment and demonstration Gas).
- **Truthful narration points.** The original Studio snapshot was restored. The older externally prepared wallet, receipt and core code was removed or quarantined, and the Studio AI newly reimplemented it in one thread. Seven original files were retained. Two independent review and repair rounds are recorded. The mixed development history is not erased and organizer acceptance is not established.
- **Numbers.** Quote test counts only from the run shown on screen. The latest observed candidate run was 320 TypeScript tests in 20 files and 35 Forge tests; do not quote the older 76 or 38 as current.
- **Must not claim.** That the candidate is published, uploaded, formally submitted or approved; that the embedded Studio Preview is confirmed beyond what was observed (an independent operator saw the create form and the wallet chooser work, with no wallet connection, signing or transaction; the earlier failed "Connecting to sandbox" state is dated history); that browser or wallet behavior was tested natively unless it is actually shown; or that any wallet warning or extension error was fixed.
- **Before using a URL.** Review for credentials and unrelated account content, keep Testnet and Mainnet labels visible, obtain any permission needed for public media, and verify anonymous playback. Upload, playback and final submission remain separate checks.
