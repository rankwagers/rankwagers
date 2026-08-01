# RankWagers — Design Review

> **Type:** Creative-direction review. **Design only — engineering ignored, no architecture proposed.**
> **Date:** 2026-08-01. **Method:** the shipped design layer — `app/globals.css`,
> `tailwind.config.ts`, `lib/design/bible.ts`, and all 201 components. Every claim is measured, not
> impressionistic. Where a first impression proved wrong under measurement, it was withdrawn.

---

## The four questions, answered first

### What immediately looks unfinished?

**Entire pages are invisible.** `/how-we-rank` — the best-written page on the site — is set in
`text-slate-100`, `text-slate-300`, `text-slate-400` and `text-amber-200` on a cream canvas
(`body { @apply bg-ink }` → `--canvas-primary: #f6f3ec`). Measured contrast:

| Class | Hex | On #f6f3ec | Verdict |
|---|---|---|---|
| `text-slate-100` (an `<h2>`) | `#f1f5f9` | **≈1.0 : 1** | invisible |
| `text-amber-200` ("What we do not assess" heading) | `#fde68a` | **≈1.1 : 1** | invisible |
| `text-slate-300` (body, ×4) | `#cbd5e1` | **≈1.3 : 1** | invisible |
| `text-slate-400` (body, ×3) | `#94a3b8` | **≈2.3 : 1** | fails AA |
| `text-slate-500` | `#64748b` | **≈4.1 : 1** | fails AA (needs 4.5) |
| `border-white/10`, `bg-white/[0.02]` | — | — | no visible card |

This is not a subtle regression. A page was written for a dark theme that does not exist. The same
idiom appears in **62 files**, including `/terms` (3× `text-slate-300`) and `/responsible-gambling`
(2× `text-slate-300`) — legal and duty-of-care pages, partially unreadable.

Also unfinished: **3 loading states for 34 routes**; **3 error/not-found boundaries** total; a
`PageSkeleton` component that almost nothing uses; and a type-scale token set (`--text-h1` …
`--text-metadata`) that is defined and then ignored by every component.

### What immediately looks enterprise?

The density signature. Measured across all components: **750 `text-sm` + 472 `text-xs` versus 40
`text-base`.** Body copy is the rarest size on the site. Add 22 files containing raw `<table>`
markup, admin dashboards, uppercase `tracking-widest` micro-labels at 10–11px, and the result reads
as an internal analytics tool: information-dense, competent, and impersonal. That is a legitimate
choice for a research platform — but it is currently an accident of accumulation rather than a stated
position, because nothing at `text-base` or above establishes a reading voice to contrast against.

### What immediately looks premium?

Genuinely, three things:

1. **The token architecture.** `globals.css` defines a semantic, Flutter-mappable layer with real
   design intent: `--status-won/lost/void/pending`, `--risk-low/balanced/aggressive/very-aggressive`,
   `--confidence-high/mid/low`. Semantic status color as a *system* rather than ad-hoc greens and reds
   is a senior move, and rare in this vertical.
2. **The serif/sans pairing.** `--font-display` (serif) for headings against a system sans stack, with
   `font-mono tabular-nums` for figures. That is an editorial-quality decision.
3. **Motion restraint.** A proper `prefers-reduced-motion` block including a global kill-switch
   (`globals.css:393` — `animation-duration: 0.01ms !important`), plus a real `:focus-visible`
   treatment at `:206`. Most teams ship neither.

### What immediately looks cheap?

- **`.btn-play-now-shine`** — a 3s infinite background sweep (`shine` keyframe, `tailwind.config.ts`)
  on the affiliate CTA. Perpetual shimmer is the single most downmarket pattern in this category.
  *(Currently defined in CSS with no `.tsx` reference — dead, but still shipped and still the
  intent of record.)*
- **`StarRating`** rendering hardcoded 4.4–4.9 values, paired with `StickyCta` and `badge-gold`. Gold
  badges plus star ratings plus a sticky CTA is the visual grammar of a coupon site, sitting directly
  against a refined cream/forest-green palette that is trying to be something else.
- **`text-[9px]` (15×), `text-[8px]` (5×), `text-[7px]` (1×).** Nothing at 7–9px is readable. Type
  that small reads as "we ran out of room", which is the opposite of confidence.

---

## 1. The central problem: three color systems that disagree

There is no single source of truth for color. There are three, and they hold **different values for
the same semantic role**:

| Role | `globals.css` (tokens) | `lib/design/bible.ts` (hex) | Δ |
|---|---|---|---|
| Border | `--border-default: #dedbd3` | `border-[#D8D5CC]` | different |
| Muted text | `--ink-muted: #6d7773` | `text-[#7D8782]` | different |
| Secondary text | `--ink-secondary: #4f5d58` | `text-[#53615C]` | different |
| Amber / watch | `--amber-primary: #9a6510` | `text-[#A96E12]` | different |
| Surface | `--canvas-secondary: #fbf9f4` | `bg-[#FBF9F4]` | matches |

`bible.ts` claims lineage from `design/src/styles/theme.css` — a **separate Vite project** in the
repo, which is a third source.

These are *near misses*, which is worse than a clash. A user cannot name the problem; they just
perceive the surface as slightly grubby — two greys that are almost the same, two borders that don't
quite align in tone. Adjacent near-miss colors are how a palette dies.

**And the split is load-bearing:** `bible.ts` is imported by `app/[locale]/page.tsx` — **the
homepage** — plus two `components/bible/*` files. So the highest-traffic page on the site runs on a
different palette from every other page.

Beyond that: **25 distinct hardcoded hex colors, 123 occurrences, across 40 component files.** The top
two are `#0B1220` (40×) and `#111827` (31×) — Tailwind's cold gray-900/slate-900. The brand is a warm
cream and forest green. **Two color temperatures are running simultaneously**, and the cold one is the
most-used literal on the site.

---

## 2. Token naming is semantically inverted

`--ink-*` is used for **two opposite things**:

- `--ink-primary: #13251f` — dark text. Correct.
- but in `tailwind.config.ts`: `ink.DEFAULT` → `--canvas-primary` (#f6f3ec, cream), `ink.soft` and
  `ink.card` → `--canvas-secondary`.

So **`bg-ink` paints a cream background** and `text-ink-primary` paints near-black text. `body { @apply
bg-ink }` is the light canvas. "Ink" universally means the dark mark, not the paper.

This is almost certainly the mechanism behind §"unfinished": a designer reading `bg-ink` reasonably
assumes a dark surface and reaches for `text-slate-300`. **The naming caused the defect.** It will
keep causing it.

---

## 3. Typography — Weak

- **15 distinct size classes** in use. Five are arbitrary pixel values *below* the smallest scale
  step: `text-[11px]` (197×), `text-[10px]` (93×), `text-[9px]` (15×), `text-[8px]` (5×),
  `text-[7px]` (1×). Plus one-off `text-[12px]` and `text-[44px]`.
- The scale defined in tokens (`--text-h1: 2.25rem` … `--text-metadata: 0.6875rem`) is **used by
  essentially nothing**. A designed scale exists and lost to ad-hoc Tailwind steps.
- 11px uppercase `tracking-widest` micro-labels appear 197 times — a strong, repeated texture that is
  doing real work, and is the closest thing the site has to a signature. It should be a named token;
  it is currently a copy-paste.
- No line-height discipline per size. `--leading-heading` / `--leading-body` exist and are set once on
  `body`; every other block inherits or improvises.
- **Verdict:** the site has typographic *texture* but no typographic *system*. The one strong idea (the
  micro-label) is undocumented, and the scale beneath it is ad-hoc.

---

## 4. Spacing, grid, visual rhythm — Mixed

- The 4px rhythm is defined (`--space-1` … `--space-12`, `--touch-min: 2.75rem`) and is sound.
- Container is consistent: `.container-wide` → `max-w-[1440px] px-4 sm:px-6 lg:px-10`. Good.
- **But `bible.ts` defines a competing container**: `page: "mx-auto w-full max-w-[1440px] px-6 lg:px-10"`
  — same max-width, **different mobile padding** (px-6 vs px-4). The homepage is therefore inset
  differently from every other page at mobile widths. That is a visible, measurable rhythm break at
  the most-viewed breakpoint.
- No column-grid primitive exists; layout is per-component flex/grid. For a site this table-heavy,
  the absence of a shared grid is why alignment drifts between sections.

---

## 5. Cards — Weak

A `.card` class exists (`globals.css:277`) alongside `.bible-article` (`:273`), and both are
outnumbered by ad-hoc card construction. **Radii tell the story: 12 distinct values**, including the
same token written two ways — `rounded-md` (243×) *and* `rounded-[var(--radius-md)]` (23×) — plus
off-scale `rounded-[14px]` (2×), `rounded-2xl`, `rounded-3xl`.

Elevation is defined well (`--shadow-card`, `--shadow-elevated`, both with correct negative-spread
soft shadows) but there is no rule for *when* each applies, so cards sit at inconsistent apparent
heights within the same viewport.

---

## 6. Component consistency & button hierarchy — Weakest layer

- Primitives that exist: `.btn-primary`, `.btn-ghost`, `.btn-play-now`, `.chip`, `.badge-gold`, `.card`.
- **`.btn*` classes appear in 14 files. Ad-hoc button-shaped className strings (`px-N py-N` +
  `rounded`) appear 189 times.** The button primitive governs roughly 7% of buttons.
- The hierarchy itself is incomplete: **primary, ghost, and an affiliate shine button.** There is no
  secondary, no tertiary, no destructive, no disabled treatment, and no size scale. A research
  platform with tables and forms needs at least secondary and destructive; without them, every
  non-primary action is invented locally.
- `--opacity-disabled: 0.45` is defined but no disabled variant consumes it.

**This is the highest-leverage inconsistency on the site.** Buttons are the most-repeated interactive
object; 189 hand-rolled variants is why nothing looks like it came from one studio.

---

## 7. Tables — Weak

22 files hand-roll `<table>`; `globals.css` contains **no table styling at all**. Sampling four:

| File | Header treatment | `scope="col"` |
|---|---|---|
| `admin-dashboard/AdminSectionView` | `bg-white/5 text-slate-500` | ✗ |
| `acca-publication/AccaListView` | `bg-white/5 text-slate-500` | ✓ |
| `acca-publication/PublicAccaDetailView` | `bg-white/5 text-slate-500` | ✓ |
| `developer/CtrAnalyticsDashboard` | `bg-ink-soft text-muted-foreground` | ✗ |

Three of four use the dark-theme idiom — so on the cream canvas the header band (`bg-white/5`) is
**invisible** and the header text (`text-slate-500`) sits at ~4.1:1. One file uses tokens correctly.
`scope="col"` is present in half. Cell padding (`px-3 py-2`) is the one thing that is consistent.

For a platform whose core artifact is tabular evidence, having no table primitive is a structural
gap, not a detail.

---

## 8. Charts — Weak (one chart, off-system palette)

There is exactly **one** chart on the site: `components/odds/OddsChart.tsx`, a hand-rolled SVG.

Credit where due — it is **properly responsive** (`viewBox` + `h-auto w-full min-w-[320px]`), it
carries `role="img"` and an `aria-label`, and it has a real empty state with a written explanation
rather than a blank frame. That is better than most.

The palette is the problem: `["#0E6B4F", "#1F4B7A", "#A96E12", "#6B3FA0", "#B42318", "#0F766E"]`
— brand green, navy, amber, **purple**, red, **teal**. Purple and teal exist nowhere else in the
design system; navy exists nowhere else. It is a categorical palette invented inline, and green
adjacent to red makes it fail for the most common form of color-vision deficiency. Axis labels are
hardcoded `fontSize="10"`, bypassing the type scale.

For a platform whose thesis is quantitative research, one chart with an unmanaged palette is a
significant expressive shortfall.

---

## 9. Dark mode — Not implemented, but written for

`:root { color-scheme: light }` and there is **no `.dark` block and no `prefers-color-scheme: dark`
override**. A comment at `globals.css:122` says dark surfaces are pending approval.

Meanwhile **62 files already use dark-theme idioms**. The site is in the worst possible state: dark
mode does not exist, yet a meaningful share of the UI is authored as though it does. Every one of
those files is currently rendering wrong, and would need re-auditing when dark mode does land.

---

## 10. Evidence UI & Research UI — the missed opportunity

`components/evidence/` and `components/evidence-ui/` exist and the semantic vocabulary underneath them
is excellent — status, risk band, confidence band, all tokenized. This is the most distinctive
material the design system has.

But there is no *evidence-specific visual language* built on top of it: no consistent provenance
treatment, no shared "as of" timestamp component, no standard citation or hash chip, no verified-badge
primitive. Evidence is currently presented with the same generic cards and tables as everything else.
The one thing this product has that no competitor has is styled like the things every competitor has.

Research UI is thinner still: filters are the archive's flat control set, and there is no shared
filter-chip, applied-filters bar, or empty/zero-result treatment. The `.filterActive` / `.filterIdle`
pair in `bible.ts` is the only filter styling defined — and it lives in the palette that only the
homepage uses.

---

## 11. Forms — Under-specified

`globals.css:144` styles `input, select, textarea` as a group; `--touch-min: 2.75rem` is defined.
Beyond that: no label convention, no help-text or error-text style, no required-field marker, no
validation state, no fieldset rhythm. `--opacity-disabled` is unused here too. The Acca Builder is the
most interactive surface on the site and has no form language to build on.

---

## 12. Navigation — Adequate, with one gap

Header uses a `buildPrimaryNav` source with active-state detection (`navActive`) — good, and the skip
link (`href="#main-content"`) is present. `MobileNav` and `BottomSheet` exist.

The footer carries 17 links in two columns with no visual grouping hierarchy beyond column split —
"Acca Builder" sits at the same weight as "Privacy". A footer this long needs a heading rhythm; at
present it reads as an undifferentiated list.

---

## 13. Animation, loading, skeletons — Weak

- **Animation in use across 201 components: `animate-pulse` ×4, `animate-ping` ×1, `animate-fade-up`
  ×1.** Six instances total. `fade-up` and `shine` are defined in config; `fade-up` is used once.
  There is effectively no motion design — no transitions between states, no list entrance, no optimistic
  feedback. `--motion-fast/base/slow` and `--ease-out` are defined and almost entirely unused.
- **3 `loading.tsx` files for 34 routes.** 31 routes flash from nothing to content.
- `components/ui/PageSkeleton.tsx` exists but only 7 files reference any skeleton or pulse. Skeletons
  are the cheapest available perceived-performance win and they are 90% unbuilt.

---

## 14. Accessibility — Mixed, with one severe failure

**Good:** global `:focus-visible` (`:206`), 39 components adding their own focus treatment,
`prefers-reduced-motion` with a global kill-switch (`:393`), `--touch-min: 2.75rem` (44px — meets the
target-size guideline), skip link, RTL handling with an Arabic-capable font stack (`:236`),
`role="img"` + `aria-label` on the chart, `aria-labelledby` on page sections.

**Severe:** the contrast failures in §"unfinished" are WCAG 1.4.3 violations at ratios as low as
1.0:1 — on legal, safety and transparency pages. `text-slate-500` at 4.1:1 fails AA even where it is
merely "dim" rather than invisible.

**Inconsistent:** `scope="col"` on half the sampled tables. No `aria-live` convention for the live-feed
surfaces. Micro-type at 7–9px is a legibility failure independent of contrast.

---

## 15. Professional polish — the honest summary

The **foundations are better than the surface**. Someone with real taste designed the token layer: the
semantic status/risk/confidence system, the shadow curves, the motion tokens, the serif pairing, the
reduced-motion kill-switch. That work is genuinely good and largely invisible, because the component
layer stopped consuming it and started improvising — three palettes, 189 hand-rolled buttons, 15 type
sizes, 12 radii, and a dark theme pasted onto a light canvas.

The gap between the design system as *specified* and the design system as *used* is the entire
finding. There is no need to redesign anything. There is a need to make the components obey the
system that already exists.

---

## 16. Full inconsistency register

| # | Inconsistency | Evidence |
|---|---|---|
| 1 | Three color sources with numerically different values for the same role | §1 table |
| 2 | Homepage runs a different palette from the rest of the site | `bible.ts` imported by `app/[locale]/page.tsx` |
| 3 | 25 distinct hardcoded hexes, 123 occurrences, 40 files | measured |
| 4 | Cold slate/gray-900 literals dominant in a warm cream/green brand | `#0B1220` ×40, `#111827` ×31 |
| 5 | `ink` token means canvas, not text | `tailwind.config.ts` → `--canvas-primary` |
| 6 | Dark-theme classes on a light-only site, 62 files | `text-slate-*`, `border-white/`, `bg-white/[` |
| 7 | Contrast failures down to ~1.0:1 on trust/legal pages | §"unfinished" table |
| 8 | 15 type sizes; 5 arbitrary px steps below the scale, down to 7px | measured |
| 9 | `--text-h1…--text-metadata` tokens defined and unused | `globals.css` vs components |
| 10 | Two container definitions with different mobile padding | `.container-wide` px-4 vs `bible.page` px-6 |
| 11 | 12 radius values; same token in two syntaxes | `rounded-md` 243× vs `rounded-[var(--radius-md)]` 23× |
| 12 | Button primitive used in ~7% of cases | 14 files vs 189 ad-hoc |
| 13 | No secondary / tertiary / destructive / disabled button variants | `globals.css` |
| 14 | `--opacity-disabled` defined, never consumed | measured |
| 15 | No table primitive; two competing header idioms | §7 table |
| 16 | `scope="col"` on half of sampled tables | §7 table |
| 17 | Chart palette introduces purple, teal, navy — off-system | `OddsChart.tsx:5` |
| 18 | Chart axis type bypasses the scale (`fontSize="10"`) | `OddsChart.tsx:60,63` |
| 19 | 3 loading states for 34 routes | measured |
| 20 | `PageSkeleton` exists, ~unused | 7 files reference any skeleton |
| 21 | 6 total animation instances; motion tokens unused | measured |
| 22 | No form label / error / help / validation language | `globals.css:144` |
| 23 | Micro-label (11px uppercase tracking-widest) used 197× but untokenized | measured |
| 24 | `shine` infinite-shimmer CTA defined in CSS, unreferenced in components | dead but shipped |
| 25 | Elevation tokens exist with no usage rule | `--shadow-card` / `--shadow-elevated` |

---

_Reviewed against the shipped design layer only. Two initial suspicions were withdrawn after
measurement: the odds chart is responsive, and `prefers-reduced-motion` is correctly implemented._
