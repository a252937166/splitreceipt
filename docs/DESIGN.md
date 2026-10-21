# SplitReceipt Visual Design Reference

## Concept and scenario

SplitReceipt is used by friends splitting a restaurant bill on phones in daylight. The interface needs to read amounts and payment states quickly at arm's length in variable light. This dictates a bright, high-contrast palette rather than a dark theme. The workspace must feel calm and trustworthy, not decorative.

## Reference rationale

### ReCart buyer interface
Borrowed: the relationship between a main workflow column and a quiet financial summary column, clear totals, restrained secondary actions, and explicit payment evidence states (pending, verified, confirmed). Not borrowed: PayPal branding, product catalogue, demo data, or dark background.

### Faktura (invoice system)
Borrowed: the structural logic of a real invoice document — bill number in a fixed position, fine horizontal rules as visual separators, a prominent total in a larger type size, recipient as a consistent bottom field, and transaction proof as part of the document rather than a modal. Not borrowed: any specific colour or product identity.

### ArcPreflight
Borrowed: generous internal padding (32px section rhythm), meaningful fieldset grouping separated by fine rules, compact but readable label/value rows. Not borrowed: any product-specific visual.

## Palette

| Token | Value | Role |
|---|---|---|
| `--canvas` | `#F3F6F4` | Page background — pale cool sage |
| `--surface` | `#FFFFFF` | Document and card surfaces |
| `--surface-subtle` | `#EDF2EF` | Zebra rows, header bands |
| `--ink` | `#152A24` | Primary text — deep forest |
| `--secondary` | `#52665C` | Labels, secondary text |
| `--subdued` | `#607267` | Tertiary text, metadata |
| `--placeholder` | `#607267` | Input placeholder — same as `--subdued`; ≈5.12:1 on white (AA) |
| `--border` | `#D5E0D9` | Dividers, card edges |
| `--border-strong` | `#B8CBBF` | Input borders |
| `--primary` | `#176B57` | CTA buttons, links, active indicators |
| `--primary-hover` | `#125548` | Primary button hover |
| `--rail-bg` | `#152A24` | Navigation rail — same deep forest as `--ink` |
| `--success` | `#145C44` | Success state text |
| `--success-bg` | `#E8F5EE` | Success state background |
| `--warn-ink` | `#7A4A00` | Warning text |
| `--warn-bg` | `#FEF3C7` | Warning background — testnet notice strip |
| `--danger` | `#991B1B` | Error text |

Contrast check (WCAG 2.1):
- `--subdued` / `--placeholder` both `#607267` on `--surface` `#FFFFFF` ≈ 5.12:1 (AA normal text ✓)
- White `#FFFFFF` on `--primary` `#176B57` ≈ 6.41:1 (AA normal text ✓; does not reach AAA 7:1)
- `--secondary` `#52665C` on white ≈ 6.6:1 (AA ✓)
- `--ink` `#152A24` on white ≈ 16:1 (AAA ✓)

Note: the earlier documentation incorrectly claimed the primary button contrast was 8.2:1 (AAA). The correct value is approximately 6.41:1 (AA).

## Typography

Single local sans stack: `'Avenir Next', 'Avenir', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`. No serif anywhere. Monospace only for wallet addresses, transaction hashes, and tabular amounts.

| Class | Size | Weight | Use |
|---|---|---|---|
| `.sr-heading-xl` | 28px | 700 | Page titles (Create bill, Wallet checks) |
| `.sr-heading-lg` | 22px | 700 | Bill title on receipt |
| `.sr-heading-md` | 18px | 600 | Section headings, totals |
| `.sr-heading-sm` | 14px | 600 | Field labels, table headers |
| `.sr-body` | 15px | 400 | Body paragraphs |
| `.sr-small` | 13px | 400/500 | Labels, badge text, alert text |
| `.sr-meta` | 12px | 400/600 | Metadata, counts, hints |
| `.sr-mono` | ui-monospace | tabular-nums | Addresses, hashes, amounts |

## Spacing rhythm

Base unit: 8px. Sections separated by 32px (4 units). Internal field spacing 16–20px. Card internal padding 24px (6 units). Rail internal padding 16px horizontal.

## Radii and shadows

8–12px corner radii on all surfaces. No heavy shadows. The only visible elevation cue is the white surface on the sage canvas background. Border `1px solid var(--border)` provides the card edge.

## Layout and breakpoints

Two distinct breakpoints are in use:

**Rail breakpoint: 768px (Tailwind `md`)**
At ≥768px the deep-forest left rail appears (208px, sticky, full height) and the mobile header+tab strip is hidden. Below 768px the rail is hidden; a compact brand+wallet header (h-14) and a horizontal scrollable nav tab strip are shown instead.

**Two-column content breakpoint: 1024px (Tailwind `lg`)**
The Create page editor/preview split and the BillDetails receipt/action split only engage at ≥1024px. Below 1024px (including the 768–1023px range where the rail is already visible) the content renders as a single column. This prevents overflow at 360–390px and at the 768–1024px intermediate range.

CSS classes `.layout-create` and `.layout-details` in `index.css` implement this. Default is `grid-template-columns: minmax(0, 1fr)`; the two-column fractions are inside `@media (min-width: 1024px)`.

**Create page receipt preview on mobile:** The receipt preview is always rendered (no `hidden` class). On mobile it stacks naturally below the editor form as a second block inside `.layout-create`. At ≥1024px the `.create-preview` CSS class applies `position: sticky; top: 32px`. This gives mobile users a live preview of the bill total without a separate tap.

**Mobile nav at ≤419px:** At very narrow widths the three tab labels ("Create bill", "Demo receipt", "Wallet checks") would overflow a scrollable strip. A `@media (max-width: 419px)` rule hides the SVG icon inside each `.mobile-nav-link`, sets `flex: 1; justify-content: center; padding: 8px 4px; gap: 0`. All three labels fit without horizontal scrolling; minimum height of 44px is preserved.

Content max-width 1120px, centered within the workspace column. WalletChecks: single max-w-2xl column.

## Touch targets

Primary buttons (`.btn-primary`), rail nav links (`.rail-nav-link`), and mobile nav links (`.mobile-nav-link`) all have `min-height: 44px` or `min-height: 48px` and meet the 44px touch target guideline. The payer-remove icon buttons are wrapped in a 44×44px touch target. Ghost/secondary action buttons (`.btn-ghost`, Copy link, view-demo, retry) have `min-height: 36px` and are treated as supplementary actions, not primary targets. Inline transaction hash and explorer links are text links and are not required to be 44px tall. The "Use my wallet" caption button has `min-height: 44px`.

## Navigation rail

Deep forest background (#152A24). Inactive links: medium sage (#A8BCAF) at 14px/500. Active link: white (#FFFFFF) at 14px/600 with 12% white fill background. Hover: 8% white fill. Three destinations only: Create bill, Demo receipt, Wallet checks.

## Receipt document structure

Inspired by a physical printed receipt:
- Thin emerald top accent border (3px, `--primary`)
- Header: bill number (uppercase metadata) + title (heading-lg)
- Dashed rule before draft preview totals
- Solid rule before the total line
- Payer ledger: alternates with 1px border separators, no zebra fill on payers
- Subtle header band on column headers (surface-subtle)
- Recipient in a distinct surface-subtle footer band

## Primary button

48px height, 8px radius, `--primary` fill, white text, no width constraint in action panels, full width in editor column.

## Prefers-reduced-motion

Transition on `.progress-bar__fill` and `.collapsible-chevron` are suppressed. Spinner animation is suppressed (`opacity: 0.5`).

## Wallet dialog typography

`wallet-ui.tsx` is frozen (it passes an independent security and functionality audit and must not be changed). Its source contains an inline serif heading style. This is overridden via CSS only:

```css
section[role="dialog"] h2 {
  font-family: 'Avenir Next', 'Avenir', system-ui, … !important;
}
```

The `!important` is necessary because `wallet-ui.tsx` sets `fontFamily` as an inline style, which would otherwise take precedence. The `section[role="dialog"]` selector matches the dialog's exact markup without touching wallet-ui.tsx source.

## What was removed from the previous design

- All serif/Iowan/Georgia font references
- Dark canvas and surface tokens (black/near-black backgrounds)
- Heavy card shadows and nested card patterns
- Teal/sky/amber accent palette
- Large decorative "How it works" card (replaced by a compact security note beneath the preview)
- Top horizontal navigation bar on desktop (moved to rail)
- Network badge in the header (moved to rail footer; mobile keeps it in the testnet strip)
