# Accessibility (Sprint 18F)

## Goals

WCAG-oriented improvements for keyboard, screen readers, focus, contrast, and reduced motion — without a full redesign.

## Implemented patterns

| Area | Pattern |
|------|---------|
| Focus | Global `:focus-visible` ring; search/Acca/nav restore rings |
| Sheets / drawers | Escape closes; Tab trap; focus restore (`BottomSheet`, Acca, MobileNav, Combo sheet) |
| Search | Combobox roles; polite `aria-live` result summary |
| Status | Non-color marker dots on `StatusBadge`; sr-only “Status:” prefix |
| Touch | `--touch-min` / `min-h-9+` on filters and nav links |
| Motion | `prefers-reduced-motion` kills decorative + enter animations |
| Errors | `role="alert"` on API / live feed failures with plain-language copy |

## Heading hierarchy

Homepage and entity pages use section `id`s on `h2`s (Sprint 18A). Acca panel uses labelled `h2` (`acca-panel-title`).

## Known limitations

- Full automated axe suite not in CI yet  
- Some Live Signals card chrome still denser than research surfaces  
- Locale-specific screen-reader strings remain largely English for research chrome  

## Testing

See `tests/sprint18fDesignA11y.test.ts` for token, reduced-motion, sheet, and filter contracts.

## Admin SEO Intelligence (Sprint 22)

`components/admin-seo/*`: semantic tables with captions, severity text (not color-only), keyboard-focusable filters/nav, `aria-live` status for filter/export chrome, `prefers-reduced-motion` inherited from global tokens.

## Admin Affiliate Intelligence (Sprint 23)

`components/admin-affiliate/*`: same patterns — table captions, severity text + color, funnel ordered lists, filter/export `aria-live`, focus-visible nav.

`components/admin-calibration/*`: semantic tables with captions, confidence-band charts with tabular equivalents, sample status as text (not color-only), severity announced for screen readers, focus-visible nav/filters, `motion-reduce` on chart transitions.

`components/admin-experiments/*`: semantic tables, status text (not color-only), local/test warning as `role="status"`, focus-visible nav/filters, export links keyboard reachable. Future public variants require the ethics accessibility checklist before approval.

## Acca Builder (Sprint 19.5)

`components/acca-builder/AccaBuilderView.tsx`:

- Semantic form / fieldset / legend for configuration  
- Risk mode as `radiogroup` with `aria-checked`  
- Visible `focus-visible` rings  
- `aria-live="polite"` for generation status  
- Leg evidence via `<details>` / `<summary>`  
- Merge/replace dialog: `role="dialog"`, `aria-modal`, initial focus on actions  
- Warnings include text (not color-only)  
- Target usable at 320px; keyboard-operable Generate + transfer flows

## Public Acca pages (Sprint 24)

`app/[locale]/accas/*`, `components/acca-publication/Public*` and `AccaShareControls`:

- **Everything readable is server-rendered.** The index lists, filters and paginates with
  JavaScript disabled; the detail page's disclosures open. Nothing a reader needs depends on
  hydration, so nothing a reader needs can fail to hydrate.
- One `<h1>` per page; every section is a `<section aria-labelledby>` bound to its own `<h2>`, in
  reading order — summary, selections, reasoning, evidence, status, limitations, methodology,
  share, related.
- The selections table is a real `<table>` with an `sr-only` `<caption>`, `<th scope="col">` headers
  and `<th scope="row">` fixture rows — not a grid of divs.
- Disclosures are native `<details>` / `<summary>`. No `role="button"` reimplementation: the native
  element is already keyboard-operable and already announced.
- Share controls are native `<button>` elements. Every outcome — copied, clipboard refused, share
  sheet opened — is announced through a single `role="status" aria-live="polite"` region. The
  fallback input is **read-only, not disabled**, so it stays keyboard reachable and selectable, and
  it is labelled with `<label for>`.
- Filters and pagination are `<a>` links inside named `<nav aria-label>` landmarks, with
  `aria-current` on the selected option. No form, no script.
- Every state is words, never colour: "Current", "Partly under way", "Closed", "Kicked off",
  "Captured 72 hours ago", "Nothing recorded". Amber is decoration on top of a label that already
  carries the meaning.
- Visible `focus-visible` rings on every interactive element.
- No animation or transition was introduced, so there is nothing for `prefers-reduced-motion` to
  suppress.

Covered by `tests/sprint24PublicAccaPages.test.ts` (`A11Y:` and `SHARE:` cases).
