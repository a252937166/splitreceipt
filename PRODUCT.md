# SplitReceipt: homepage product context

This is the product and surface brief behind the homepage in `src/components/Home.tsx` and `src/components/home/*`. It describes what the homepage is for and what it may claim. It does not replace `docs/DESIGN.md` (the app's visual system) or `README.md`.

## Who it is for

An ordinary person who needs to share a cost with two to five other people and wants to see, afterwards, who paid and be able to prove it. No crypto vocabulary is assumed. The app itself needs a wallet to write; looking at a bill never does.

## What the product does (and only this)

1. A creator makes a bill: a title, one fixed recipient, two to five payers and one equal USDC share.
2. Each listed payer pays exactly that share, once, from their own wallet. The contract forwards each payment straight to the recipient.
3. The bill page shows who has paid, and every payment links to its public transaction. A receipt is called verified only after the page has checked the transaction, its block and the matching payment event on the chain.

Not claimed: unequal splits, partial payments, refunds, editing a bill after it is created, identity checks, custody, an audit, customers, revenue or usage.

## Homepage message and structure

- Headline: "Split the bill. Keep the proof." Supporting copy is concrete: equal USDC shares, one recipient, public receipts.
- Hero (two calls to action): **Open app** and **View a settled bill**, beside one static receipt illustration that is labelled "Illustrative example" and contains no real address or hash.
- How it works: one divided three-step ledger (create, pay your exact share, inspect receipts).
- Receipts: what the product guarantees, nothing it does not.
- Real evidence: Arc Mainnet Bill 1 (owner-operated, two accounts, 0.001 USDC each, settled 2 of 2), one existing explorer payment, the contract, the public video and the source. The example is labelled as the owner's own demonstration.
- FAQ and footer: who pays what, wallet needed to write but not to view, Mainnet (real USDC) versus the default free Testnet, limits, and the caution that bill data is public onchain.

## Behavior that must not change

- **Routing.** The homepage is shown only for an exactly empty search string. Every non-empty search, with any content, goes unchanged to the app and its page-context parser. The refusal page's recovery link opens the explicit default Testnet app entry, never the bare path.
- **No wallet on the homepage.** The bare homepage mounts no wallet provider, imports no wallet or chain code and starts no wallet discovery or RPC call. The wallet side (`AppRoot`) is a lazy chunk requested only for an app address, with `reconnectOnMount={false}` and explicit wallet choice.
- **Open app** returns to the held app context if one exists, otherwise the default Testnet create form.
- **The settled example opens in a separate tab** (true anchors with `target="_blank"`, `rel="noopener noreferrer"` and an accessible "opens in a new tab" note), so it cannot navigate or remount a held app that may hold an unresolved submission lock.
- **A held app is never remounted or reset by the homepage.** It stays mounted but hidden. After each navigation the read-only views restart their checks under the current page epoch (`src/readActivation.ts`); stale results are still discarded.
- **Mainnet honesty.** Mainnet uses real USDC for both payment and network fee, and is opt-in. The default is Arc Testnet with free test USDC.

## Visual constraints

Existing sage, white, forest and green tokens and the local Avenir stack. All homepage styles live in `src/home.css`, namespaced `sr-home-*`; `src/index.css` and `docs/DESIGN.md` are untouched. 44px minimum touch targets, a visible focus ring, no external fonts or assets, no new dependencies.

## Where it is tested

`tests/home-route.test.ts` (exact routing rule), `tests/home-content.test.ts` (content, anchors, links, CSS rules), `tests/read-activation.test.ts` (Home then return with reads in flight, new-tab settled example, refusal-page recovery), `tests/production-entry.test.ts` (no wallet code reachable from the entry, bundle markers). Manual DOM-level scripts in `tests/jsdom/` (not a real browser).
