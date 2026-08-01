# RankWagers Design System — Specification v1

> **Type:** Normative design-system specification. **No new components.** Every component named below
> already exists in the codebase; this document defines its canonical form and retires its variants.
> **Date:** 2026-08-01. **Supersedes:** `lib/design/bible.ts` and the standalone `design/` project as
> sources of truth. **Companions:** `[[design-review]]` (system audit), `[[design-review-removal-audit]]` (surface audit).

---

## 0. The three laws

Everything below follows from three rules. Where this document is silent, apply them.

1. **One token, one syntax, one home.** A value exists once, in `app/globals.css`, and is referenced
   one way. `rounded-md` and `rounded-[var(--radius-md)]` are the same value written two ways; only
   the first is legal. `lib/design/bible.ts` and `design/` are retired as color sources.
2. **Structure is carried by borders and spacing, not by shadow and color.** Elevation is a
   three-step ladder used sparingly; color is reserved for meaning. Nothing on this surface emits
   light.
3. **Arbitrary values are defects.** `text-[9px]`, `rounded-[14px]`, `tracking-[0.08em]`,
   `shadow-[0_0_16px_...]` are not customization; they are the system failing to have an opinion.
   Every one has a token below.

**Current state, measured:** 25 hardcoded hex colors · 15 type sizes · 9 letter-spacings · 12 radii ·
10 shadow treatments · 9 greens · 8 badge geometries · 3 icon sources · 189 hand-rolled buttons
against 14 uses of the button primitive. **This specification reduces that to one of each.**

---

# PART I — FOUNDATIONS

## 1. Color

### 1.1 The palette (canonical)

| Role | Token | Value |
|---|---|---|
| Canvas | `--canvas-primary` | `#f6f3ec` |
| Canvas raised | `--canvas-secondary` | `#fbf9f4` |
| Surface | `--surface-elevated` | `#ffffff` |
| Ink primary | `--ink-primary` | `#13251f` |
| Ink secondary | `--ink-secondary` | `#4f5d58` |
| Ink muted | `--ink-muted` | `#6d7773` |
| Border subtle | `--border-subtle` | `#e9e6de` |
| Border default | `--border-default` | `#dedbd3` |
| Border strong | `--border-strong` | `#bfc4be` |

**Greens — three, not nine.**

| Token | Value | Sole use |
|---|---|---|
| `--green-primary` | `#0e6b4f` | brand, primary action, positive state |
| `--green-deep` | `#174c3c` | hover/pressed on primary, dense text on green surface |
| `--green-positive` | `#15966a` | positive delta in data only |
| `--green-surface` | `#eaf3ed` | tint background |

**Retired greens:** `#1a8566` (CTA gradient only), `#0f766e` (chart), and the entire Tailwind
`emerald-400/500/800/900/950` ramp used in `LiveFeedParts` and `WorldCupTickerBar`. Emerald is not the
brand green and never was.

**Accents:** `--amber-primary` `#9a6510` · `--red-primary` `#a93f36` · `--info-primary` `#1f5f8b`.
Each has a matching `-surface` tint. These are the only accents.

**Retired entirely:** the Tailwind cold ramp — `slate-*`, `gray-*`, `#0b1220` (40 uses), `#111827`
(31 uses), `#0f172a`, `#1e293b`. They are a different color temperature from the canvas and are the
single cause of every measured contrast failure. **No `text-slate-*`, `bg-white/[…]`, or
`border-white/…` on any surface.**

### 1.2 Semantic sets (already correct — do not change)

`--status-{won,lost,void,pending,live}-{fg,bg}` · `--risk-{low,balanced,aggressive,very-aggressive}-{fg,bg}`
· `--confidence-{high,mid,low}`.

These are the most sophisticated part of the existing system. **Every badge, chip, table cell and
chart series that expresses state must draw from these and nothing else.** A green that is not a state
is decoration.

### 1.3 Contrast floor

| Text | Minimum |
|---|---|
| Body, labels, table cells | **4.5 : 1** |
| Headings ≥ 24px / semibold ≥ 19px | **3 : 1** |
| Borders, dividers, disabled | **1.5 : 1** (non-text) |

`--ink-muted` on `--canvas-primary` is the muted floor. Nothing lighter is permitted for text.

### 1.4 Token naming correction

`ink.DEFAULT`, `ink.soft`, `ink.card` currently map to **canvas** values, so `bg-ink` paints cream.
Ink means the mark, not the paper. These three aliases are retired in favour of
`bg-background` / `bg-muted` / `bg-card`. This naming inversion is the documented cause of the
dark-on-light contrast defects; correcting the name is a prerequisite to correcting the usage.

---

## 2. Typography

### 2.1 Families

| Role | Token |
|---|---|
| Display (h1–h3) | `--font-display` (serif) |
| Interface & body | `--font-sans` |
| Numerals, IDs, hashes | `--font-mono` + `tabular-nums` |

The `premium` family alias in `tailwind.config.ts` duplicates `sans` and is retired.

### 2.2 The scale — seven steps

The scale already exists in tokens and is currently unused. It is now the only legal scale.

| Step | Token | Size | Line | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| Display | `--text-h1` | 2.25rem / 36px | 1.2 | 600 | −0.01em | page title, one per page |
| Title | `--text-h2` | 1.75rem / 28px | 1.2 | 600 | −0.01em | section |
| Subtitle | `--text-h3` | 1.375rem / 22px | 1.3 | 600 | 0 | subsection, card title |
| Body | `--text-body` | 1rem / 16px | 1.5 | 400 | 0 | prose, the default |
| Body small | `--text-body-sm` | 0.875rem / 14px | 1.5 | 400 | 0 | dense UI, table cells |
| Caption | `--text-caption` | 0.75rem / 12px | 1.4 | 400 | 0 | help text, footnotes |
| Micro-label | `--text-metadata` | 0.6875rem / 11px | 1.3 | 500 | **0.14em**, uppercase | the signature label |

**Retired:** `text-[10px]` (93 uses) → micro-label · `text-[9px]` (15), `text-[8px]` (5),
`text-[7px]` (1) → micro-label · `text-[12px]`, `text-[44px]` → nearest step.
**11px is the floor.** Nothing smaller ships.

### 2.3 Weights — three

`400` body · `500` labels, micro-labels, active nav · `600` headings and emphasis.

**Retired:** `700` and `900` in UI chrome. `font-black` on an 11px uppercase badge is the single
loudest downmarket signal in the component layer.

### 2.4 Letter-spacing — two values

`0.14em` for uppercase micro-labels. `−0.01em` for display and title. Everything else `0`.

**Retired:** `tracking-wide` (154), `tracking-[0.12em]` (29), `[0.16em]` (24), `tracking-wider` (14),
`tracking-widest` (12), `[0.1em]` (6), `[0.08em]`. Nine values collapse to two.

### 2.5 Measure

Prose columns cap at **65ch**. Table and dashboard content is exempt.

---

## 3. Spacing

**4px rhythm.** Legal steps: `1 (4) · 2 (8) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 8 (32) · 10 (40) ·
12 (48)`.

Half-steps (`0.5`, `1.5`, `2.5`) are legal **only as vertical padding inside controls** — badges,
chips, small buttons — where 4px granularity is too coarse. They are never legal for layout.

**Retired:** `py-9` (13 uses — 36px, off-rhythm; use `8` or `10`).

**Vertical rhythm.** Section gap `10` (40px) · block gap `6` (24px) · related elements `3` (12px) ·
tight pairs `2` (8px). The measured defaults (`py-2` 544, `px-3` 489, `gap-2` 179, `gap-3` 172) are
already close to this; the rhythm is codified, not changed.

---

## 4. Radius — four values, one syntax

| Token | Value | Applies to |
|---|---|---|
| `rounded-sm` | 6px | nested/inline elements, inputs inside a control group |
| `rounded-md` | 8px | **all controls** — buttons, inputs, selects |
| `rounded-lg` | 12px | **all cards and panels** |
| `rounded-xl` | 16px | sheets, modals, the bottom sheet |
| `rounded-full` | — | badges, chips, pills, avatars |

**Retired:** `rounded-[var(--radius-*)]` (23 uses — same values, second syntax), `rounded-[14px]`,
`rounded-2xl`, `rounded-3xl`, `rounded-none`. Twelve values become five.

---

## 5. Elevation — three steps, no glow

| Level | Treatment | Use |
|---|---|---|
| **0 — Flat** | `1px solid --border-default`, no shadow | default for cards, tables, panels |
| **1 — Card** | `--shadow-card` + `1px --border-subtle` | a card that must separate from a busy background |
| **2 — Elevated** | `--shadow-elevated` | sheets, modals, dropdowns, popovers only |

**Border-first.** Most surfaces are Level 0. If a border can do the job, a shadow must not.

**Retired:** every `0 0 Npx` emission — `shadow-glow` (3 uses), `shadow-[0_0_16px_rgba(16,185,129,…)]`,
`shadow-[inset_0_0_0_1px_…]`, the CTA's `0 0 12px`, the ticker badge's `0 0 20px -8px`. Also
`shadow-sm/lg/xl/2xl`. Ten treatments become three.

`--shadow-focus` (`0 0 0 3px`) is a **ring**, not a shadow, and is retained (§6).

---

## 6. Focus, motion, and state

**Focus.** One treatment, everywhere: `--shadow-focus` ring with `outline-offset: 3px`, on
`:focus-visible` only. Already correct globally; the 39 components adding their own must defer to it.

**Motion — two durations.** `--motion-fast` 150ms (state change: hover, toggle, selection) ·
`--motion-base` 220ms (entry/exit: sheets, panels, disclosure). `--ease-out` for both.

**Motion is feedback, never decoration.** Legal: entry of a newly-loaded panel, state transition,
skeleton shimmer. **Illegal: any infinite loop.** Retired — `play-now-pulse 2.4s infinite`,
`play-now-sweep 2.8s infinite`, `wc-ticker-shine`, `pct-shine`, `shine`. The product currently runs
three infinite decorative animations and six total functional ones; that ratio inverts.

`prefers-reduced-motion` (already implemented with a global kill-switch) is authoritative.

**Interactive states.** Every interactive component defines five: `default · hover · active ·
focus-visible · disabled`. Disabled uses `--opacity-disabled` (0.45), which exists and is currently
consumed by nothing.

---

# PART II — COMPONENTS

Each entry: what exists today (measured) → the specification.

## 7. Buttons

**Today:** `.btn-primary`, `.btn-ghost`, `.btn-play-now` (+ `.btn-play-now-shine`) used in 14 files,
against **189 hand-rolled `px-N py-N rounded` strings**. No secondary, no destructive, no disabled, no
size scale. The primitive governs ~7% of buttons.

**Specification — four variants × two sizes.**

| Variant | Fill | Text | Border | Use |
|---|---|---|---|---|
| **Primary** | `--green-primary` | white | none | one per view; the single most important action |
| **Secondary** | `--canvas-secondary` | `--ink-primary` | `1px --border-default` | the common action |
| **Ghost** | transparent | `--ink-secondary` | none | tertiary, toolbars, table row actions |
| **Destructive** | transparent | `--red-primary` | `1px --red-primary` | irreversible actions (admin) — formalizes existing hand-rolled usage against the existing `--destructive` token |

| Size | Height | Padding | Type |
|---|---|---|---|
| Default | 36px | `px-4` | body-sm / 500 |
| Small | 28px | `px-3` | caption / 500 |

Radius `md`. Hover: primary → `--green-deep`; others → one border step stronger. Active: no transform
beyond `translateY(1px)`. Disabled: `--opacity-disabled`, no pointer events. Icon+label gap `2` (8px);
icon `16px`.

**Retired:** `.btn-play-now` and `.btn-play-now-shine` in full — the gradient, the infinite pulse, the
sweep, the glow, and the hover acceleration. A primary action is a solid fill.

**Mobile:** any button that is a primary touch target meets `--touch-min` (44px) via padding, not by
changing the type scale.

## 8. Cards

**Today:** `.card` and `.bible-article` (duplicates), plus ad-hoc construction across the component
tree; 12 radii and 10 shadows in circulation.

**Specification — one card, two paddings, two elevations.**

- Radius `lg` (12px). Border `1px --border-subtle`. Background `--canvas-secondary`.
- Padding: **default** `4` (16px) · **compact** `3` (12px) for dense lists and nested cards.
- Elevation: **Level 0** by default; **Level 1** only when the card floats over a busy region.
- Internal rhythm: title (`h3`) → `2` → body → `3` → actions. Actions bottom-right, ghost or
  secondary; **never primary inside a repeated card** — a list of ten primary buttons has no primary.

**Retired:** `.bible-article` (fold into `.card`), all gradient card backgrounds, the `border-2`
neon treatment in `LiveFeedParts`.

## 9. Tables

**Today:** 22 files hand-roll `<table>`; `globals.css` contains **no table styling**. Three of four
sampled files use `bg-white/5 text-slate-500` (invisible header band on cream, ~4.1:1 text); one uses
tokens. `scope="col"` present in half.

**Specification.** The dominant existing pattern is already correct and becomes law.

| Part | Spec |
|---|---|
| Header cell | micro-label (11px / 500 / uppercase / 0.14em), `--ink-muted`, `px-3 py-2`, `scope="col"` **mandatory** |
| Header band | `--canvas-primary`, `1px --border-default` bottom rule |
| Body cell | body-sm / 400, `--ink-primary`, `px-3 py-2` |
| Row rule | `1px --border-subtle` between rows; **no zebra striping, no vertical rules** |
| Numerics | `--font-mono` + `tabular-nums`, **right-aligned**, header right-aligned to match |
| Row hover | `--canvas-secondary` |
| Empty | the existing `EmptyState` primitive — never a blank table body |
| Overflow | horizontal scroll on the container; the first column may be sticky |

Alignment law: **text left, numbers right, status centred.** Column alignment never varies by table.

## 10. Charts

**Today:** one chart (`OddsChart`), hand-rolled SVG, correctly responsive with `role="img"` and a
written empty state. Its palette — `#0E6B4F, #1F4B7A, #A96E12, #6B3FA0, #B42318, #0F766E` — invents
navy, purple and teal, and places green adjacent to red.

**Specification.**

- **Categorical palette, five series, drawn from existing tokens, in this order:**
  `--green-primary` → `--amber-primary` → `--info-primary` → `--ink-secondary` → `--red-primary`.
  Beyond five series, the chart is the wrong chart.
- **Never encode by color alone** — every series carries a label or direct annotation. Green/red
  adjacency is retired; the ordering above separates them.
- Axis labels: micro-label token (not `fontSize="10"`). Gridlines: `1px --border-subtle`, horizontal
  only. Axis line: `--border-default`.
- Series stroke 1.5px. Points shown only on hover or when the series has ≤ 12 points.
- State colors in data (won/lost/void) use the `--status-*` set, never the categorical palette.
- Empty state: the written message pattern already used. Loading: skeleton at chart height —
  never a collapsing container.

## 11. Tags, badges, and chips

**Today:** 12 files implement badge-like elements and **every geometry is unique** — 3 weights
(semibold / bold / black), 3 sizes (10px / 11px / xs), 5 padding pairs, some uppercase, some with
`ring-1 ring-inset`, some with `shadow-sm`. Plus `.chip` and `.badge-gold`.

**Specification — one badge, one chip.**

**Badge** (non-interactive, states facts):
- Micro-label token (11px / 500 / uppercase / 0.14em) · `px-2 py-0.5` · `rounded-full` ·
  `1px` border · foreground and background from a **semantic pair only**
  (`--status-*`, `--risk-*`, `--confidence-*`, or neutral `--ink-muted` on `--canvas-primary`).
- No shadow. No ring. No gradient. No `font-black`. One line, never wraps.

**Chip** (interactive, filters and selection):
- Same geometry; adds `hover`, `selected`, `focus-visible`, `disabled`.
- Selected: `--ink-primary` fill, canvas text. Idle: transparent fill, `--border-default`,
  `--ink-secondary`. This is the existing `filterActive`/`filterIdle` pair from `bible.ts`, promoted
  and re-pointed at tokens.

**Retired:** `.badge-gold` · `ring-1 ring-inset` badges · `shadow-sm` badges · the 10px tier ·
`font-black` · the `EvidenceStrengthBadge` / `ValidationBadge` / `LiveEventBadge` / `StatusBadge`
geometry divergence — **all four keep their names and semantics and adopt the single geometry.**

## 12. Icons

**Today:** three sources — `lucide-react` (3 files, 4 icons: `Info`, `MapPin`, `ShieldCheck`,
`Target`), inline `<svg>` (6 files), and **38 emoji/dingbats** (✓×14, ★×12, ✕×5, ✅×2, ⚠×2, 🏆, ⚡, ✈).

**Specification — one source.**

- **`lucide-react` only.** It is already a dependency and already tree-shaken in config.
- Sizes: **14px** (inline with caption/micro) · **16px** (default, with body-sm) · **20px** (section
  headers, empty states). No other size.
- Stroke `1.5`. Color `currentColor` — icons never carry their own color.
- Optical alignment: icons sit on the text baseline box, gap `2` (8px) from the label.
- Decorative icons `aria-hidden="true"`; meaningful icons carry a label.

**Retired:** every emoji and dingbat. They have no stroke weight, no optical sizing, no baseline
alignment, and render differently per platform — and ✓ and ✅ currently express the same meaning two
ways. Inline `<svg>` is retired except for the brand mark and the chart.

## 13. Containers

**Today:** `.container-wide` (`max-w-[1440px] px-4 sm:px-6 lg:px-10`), `.container-page`, and a
competing `bible.page` (`px-6 lg:px-10`) used by the homepage — so the homepage is inset differently
from every other page at mobile.

**Specification — one container.**

`--container-max` 1440px · padding `px-4` (mobile) / `px-6` (≥640) / `px-10` (≥1024).
Prose regions cap at 65ch inside it. `.container-page` and `bible.page` are retired into it.

Grid: 12 columns, gutter `6` (24px) desktop / `4` (16px) mobile. Cards align to columns; nothing is
optically centred by hand.

## 14. Forms

**Today:** `globals.css` styles `input, select, textarea` with **`outline-offset: 3px` and nothing
else.** All control styling is ad hoc across 21 files. No error, help, required, or validation
language. `--opacity-disabled` unused.

**Specification.** The de-facto convention (`<label className="block text-sm">`) is formalized.

| Part | Spec |
|---|---|
| Label | body-sm / 500 / `--ink-primary`, above the control, gap `2` |
| Required | `--red-primary` asterisk after the label text |
| Control | height 40px (44px touch on mobile), `px-3`, radius `md`, `1px --border-default`, background `--surface-elevated`, body-sm |
| Placeholder | `--ink-muted` — never a substitute for a label |
| Focus | `--shadow-focus` ring, border → `--green-primary` |
| Help | caption / `--ink-muted`, below, gap `1` |
| Error | border `--red-primary`, message caption / `--red-primary`, gap `1`; the existing `InlineAlert` (`tone="error"`) for form-level errors |
| Disabled | `--opacity-disabled`, background `--canvas-primary` |
| Field rhythm | gap `4` between fields, `6` between groups |

Validation appears on blur, never on keystroke.

## 15. Header

**Today:** grouped nav with active detection and a skip link — structurally sound.

**Specification.** Height 64px, background `--canvas-primary`, bottom `1px --border-subtle`, sticky.
Brand mark left; primary navigation centre-left; search right. Nav item: body-sm / 400 /
`--ink-secondary`; hover `--ink-primary`; **active** `--ink-primary` / 500 with a `1px --green-primary`
underline (never 2px). Skip link retained. Mobile collapses to the existing `MobileNav`/`BottomSheet`
— no second pattern.

## 16. Footer

**Today:** 17 links, two columns, one typographic weight — "Acca Builder" reads identically to
"Privacy".

**Specification.** Background `--canvas-secondary`, top `1px --border-default`, `py-10`.
Group heading: micro-label token. Links: body-sm / `--ink-secondary`, hover `--ink-primary`, row gap
`2`. Legal line: caption / `--ink-muted`. **Two levels of hierarchy, not one** — the micro-label
already exists and simply is not applied here.

## 17. Navigation states

One state model, used by header, mobile nav, tabs, and in-page section navigation:

| State | Treatment |
|---|---|
| Idle | `--ink-secondary`, 400 |
| Hover | `--ink-primary`, 400, `--motion-fast` |
| Active | `--ink-primary`, 500, `1px --green-primary` underline |
| Focus | `--shadow-focus` ring |
| Disabled | `--opacity-disabled` |

## 18. Loading and empty states

**Today:** `PageSkeleton` exists; 3 `loading.tsx` for 34 routes; 7 files reference any skeleton.
`EmptyState` and `InlineAlert` exist and are the correct primitives.

**Specification.**

- **Skeleton over spinner**, always. Skeletons mirror the geometry they replace — same radius, same
  height, same column count — using `--canvas-secondary` with the existing `animate-pulse`. A skeleton
  that does not match its content's shape causes layout shift and is worse than nothing.
- Every route that fetches renders a skeleton. Every list that can be empty renders `EmptyState` with
  a written explanation (the odds chart's empty message is the reference implementation).
- Errors use `InlineAlert`, which is already the only variant-bearing primitive (`tone`).
- **Never** a collapsing container, a bare spinner, or a blank frame.

---

# PART III — CONFORMANCE

## 19. Consolidation ledger

| Element | Today | Spec |
|---|---|---|
| Color sources | 3 (`globals.css`, `bible.ts`, `design/`) | **1** |
| Hex literals in components | 25 distinct / 123 uses | **0** |
| Greens | 9 | **3** + 1 tint |
| Type sizes | 15 | **7** |
| Font weights | 5 (incl. 700, 900) | **3** |
| Letter-spacings | 9 | **2** |
| Radii | 12 / 2 syntaxes | **5** / 1 syntax |
| Shadows | 10 (incl. 4 glows) | **3** + focus ring |
| Button variants | 3 classes + 189 ad-hoc | **4** × 2 sizes |
| Card patterns | 2 classes + ad-hoc | **1** × 2 paddings |
| Badge geometries | 8 | **1** badge + **1** chip |
| Icon sources | 3 (incl. 38 emoji) | **1** |
| Containers | 3 | **1** |
| Table styling | none (22 hand-rolled) | **1** spec |
| Chart palette | 6 off-system colors | **5** token-derived |
| Infinite animations | 3 | **0** |

## 20. Conformance checklist

A component conforms when all fourteen hold:

1. No hex literal, no `rgb()`/`rgba()` literal.
2. No `slate-*`, `gray-*`, `bg-white/[…]`, `border-white/…`.
3. Every type size from the seven-step scale; nothing below 11px.
4. Weight ∈ {400, 500, 600}.
5. Letter-spacing ∈ {0, 0.14em, −0.01em}.
6. Radius ∈ {sm, md, lg, xl, full}, Tailwind alias syntax only.
7. Shadow ∈ {none, card, elevated} + focus ring; no `0 0 Npx`.
8. Spacing on the 4px rhythm; half-steps only inside controls.
9. All five interactive states defined.
10. Focus is `:focus-visible` with the shared ring.
11. Icons are lucide, `currentColor`, ∈ {14, 16, 20}px.
12. Color that expresses state comes from a semantic pair.
13. Loading renders a shape-matched skeleton; empty renders `EmptyState`.
14. Contrast meets §1.3.

## 21. Precedence

`app/globals.css` → `tailwind.config.ts` → this document's component specs → component code.
On conflict, the earlier wins. `lib/design/bible.ts` and `design/` hold **no authority**; their one
original contribution — the `filterActive`/`filterIdle` pair — is absorbed into §11 and re-pointed at
tokens.

---

_Specification only. No component is introduced; every one named above exists today. Related:
`[[design-review]]`, `[[design-review-removal-audit]]`, `[[information-architecture]]`._
