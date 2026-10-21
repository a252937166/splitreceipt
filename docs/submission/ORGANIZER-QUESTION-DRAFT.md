# Organizer question — draft (unsent)

**Status: DRAFT. This message has not been sent. Do not send without independent review.**

---

## Draft message

Subject: Arc Microgrants 2 — question about mixed Studio/local provenance

Hello,

I am preparing a submission for Arc Microgrants 2 and have a question about provenance before I submit.

My project, SplitReceipt, was started in Arc Studio:
- Studio project: https://studio.arc.io/app/65acc04e-7e22-4ae8-b72d-c2520b9f8a62
- Public repository: https://github.com/a252937166/splitreceipt

The Solidity contract was originally authored in Arc Studio. The latest UI/design files, receipt-discovery changes and current submission documentation were also authored through Studio. However, the initial Studio deployment path was blocked by a platform policy limit, so the unchanged contract was deployed from a local test-only wallet using the public Arc Testnet RPC. Earlier development work — dependency isolation, history pagination, wallet handling, static delivery tooling, and some UI refinements — was also done with local tooling and synchronized back to Studio. The current testnet demo is at https://splitreceipt.axiqo.xyz/splitreceipt/ and is testnet-only; no mainnet deployment has been made yet.

My question: Does this mixed provenance — contract and later UI authored in Studio, but some tooling and the deployment itself done outside Studio — satisfy your "Studio-written and tested contracts" and "Studio-built app" requirements? Or is an end-to-end Studio workflow (including deployment initiated from Studio) required?

I want to be honest about the development history before investing time in a mainnet deployment. I am happy to provide the repository, CI runs, and any other evidence you need.

Thank you.

---

## Notes on this draft

- This is a clarifying question only. It does not assert acceptance, claim a testnet exemption, or make eligibility representations.
- Do not assert that the app meets the contest requirements in the message body — the current state is testnet-only and the question is specifically about whether the provenance is acceptable.
- The Studio URL opens the project workspace. Access for an independent reviewer has not been verified; confirm sharing or review access before submission.
- Verify the organizer's contact channel (DoraHacks project page, Discord, or email) before sending.
- Personal name, contact details and any required disclosures must be added before sending.
- Do not send this draft from Arc Studio.
