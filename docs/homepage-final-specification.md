# RankWagers Homepage — Final Specification

**Lead Product Designer · definitive homepage spec · build-ready**
**Date:** 2026-08-01 · **Surface:** `/en` · **Supersedes:** the launch wireframe.

**Constraints.** Existing components only. No new feature, no new page, no business-logic change, no
roadmap change. Every token, class and component named below already exists in this repository.

---

## PART 0 — The design position

### 0.1 The discovery that decides everything

The design system is **already editorial and nobody is using it that way.**

| Token | Value | What it signals |
|---|---|---|
| `font-display` | Georgia / Cambria / Times — **a serif** | Newspaper, journal, record |
| `--canvas-primary` | `#f6f3ec` — **warm paper** | Printed page, not a screen |
| `--ink-primary` | `#13251f` — near-black green | Ink |
| Brand | one deep green | A masthead colour |
| Content chrome | hairlines, no gradients, no shadows | Broadsheet |

A serif display face on warm paper with a single accent is the visual grammar of **a record**. It is
the exact opposite of the neon-gradient-countdown grammar of every betting site on earth.

**The homepage is currently rendering this system as a dashboard: 24px headings, 11px uppercase
eyebrows, monospace numerals in the accent colour, fourteen equal grey sections.** The register is
being thrown away in the CSS.

### 0.2 The design position, in one line

> **RankWagers is a newspaper of record for football predictions. The homepage should read like a
> front page, not a betting slip.**

Everything below is that sentence turned into a specification.

### 0.3 The sentence the page must produce

> *"They showed me what they got wrong before they showed me what to bet."*

---

## PART 1 — Global systems

### 1.1 Width system

The page shell is unchanged: `.container-wide` → `mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10`.

Inside it, four fixed measures. **No section may be full-shell-width for text.**

| Measure | Value | Used for |
|---|---|---|
| **Editorial** | `max-w-[46rem]` (736px) | Hero headline + subtitle, S7 rows |
| **Reading** | `max-w-[38rem]` (608px) | Every section lead paragraph — 65–75 chars at 16px |
| **Data** | `max-w-[72rem]` (1152px) | Metric grid, result rows, pick grid |
| **Panel** | `max-w-2xl` (672px) | `LiveFeedPanel` — unchanged |

**Why:** a 1440px-wide line of 16px text is unreadable and instantly reads as a dashboard. Constrained
measure is the cheapest available signal of editorial intent.

### 1.2 Type scale — nine steps, one page

| # | Role | Class | px (mob → desk) | Face | Instances |
|---|---|---|---|---|---|
| **D1** | Display | `font-display text-4xl md:text-5xl font-semibold leading-[1.05] tracking-tight` | 36 → 48 | serif | **1** |
| **D2** | Figure | `font-mono text-4xl font-semibold tabular-nums` | 36 | mono | **4** |
| **H2** | Section | `font-display text-xl md:text-2xl font-semibold tracking-tight` | 20 → 24 | serif | **7** |
| **H3** | Sub-section | `font-display text-base md:text-lg font-semibold` | 16 → 18 | serif | 2 |
| **T1** | Item title | `text-lg font-semibold` | 18 | sans | picks, results |
| **B1** | Lead | `text-base leading-relaxed text-[var(--ink-secondary)]` | 16 | sans | ≤1 per section |
| **M1** | Meta | `text-sm` | 14 | sans | market · kickoff · links |
| **P1** | Provenance | `text-xs text-muted-foreground` | 12 | sans | `Observed`, `Last updated` |
| **E1** | Eyebrow | `text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground` | 11 | sans | **3** |

**Two hard laws:**

1. **12px is the floor.** `text-[10px]` is removed from the homepage. Provenance may be quiet; it may
   not be invisible.
2. **D2 is reserved.** The only 36px numerals on this page are the four in the Proof Band. No other
   figure — no pick percentage, no fixture count, no market count — may use D2.

### 1.3 Colour law

Brand green currently does four jobs. It is reduced to one.

| Element | Rule |
|---|---|
| `bg-brand` fill | **Primary CTA only. Maximum 2 on the page** (S1, S7) |
| `text-brand` | **Forbidden** in content. Not on numerals, eyebrows, icons, or links |
| Links | `text-foreground underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current` |
| Eyebrows | `text-muted-foreground` |
| Pick `%` | `text-[var(--ink-secondary)]` — neutral |
| `StatusBadge` | `STATUS_TONE_CLASS` unchanged — **the only chroma in content** |

**The consequence is the brand.** After this rule, the only coloured things inside the content area of
a betting homepage are **won · lost · void · pending**. Colour means outcome and nothing else. No
competitor can copy that, because no competitor publishes the outcome.

### 1.4 Spacing scale

Section padding is **not uniform**. Vertical space encodes importance.

| Section | Desktop | Mobile | Separation from previous |
|---|---|---|---|
| S1 Hero | `pt-8 pb-12` | `pt-6 pb-10` | — |
| S2 Proof | `py-12` | `py-10` | **Full-bleed `bg-[var(--canvas-secondary)]` + `border-y border-[var(--border-subtle)]`** |
| S3 Picks | `py-12` | `py-10` | Whitespace only — no rule |
| S4 Live | `py-10` | `py-8` | `border-t border-[var(--border-subtle)]` |
| S5 Research | `py-10` | `py-8` | `border-t border-[var(--border-subtle)]` |
| S6 Bookmakers | `py-10` | `py-8` | `border-t border-[var(--border-subtle)]` |
| S7 Method | `pt-12 pb-16` | `pt-10 pb-12` | Whitespace only — no rule |

**Three separation treatments, not one.** S2 is the only full-bleed band; S4–S6 are hairline-ruled;
S1→S2→S3 and S6→S7 breathe. The page acquires a rhythm instead of a pulse.

Intra-section: eyebrow→heading `mt-1` · heading→lead `mt-3` · lead→content `mt-8` · grid `gap-4` ·
card padding `p-5`.

> **Why S2's band is tonal, not tinted.** `--canvas-secondary` (`#fbf9f4`) against
> `--canvas-primary` (`#f6f3ec`) is a whisper. That is deliberate. The one available tint
> (`--green-surface`) is also `--status-won-bg`; spending it on the section background would code the
> whole proof band as *win*. **The Proof Band earns its prominence through scale and space, not
> colour** — which is the same argument the product makes about itself.

### 1.5 Empty-state law

`EmptySection` remains the only primitive. One new rule:

> **A section with no content collapses to heading + one `EmptySection` line, padding drops to
> `py-6`, and its rule is suppressed. Order never changes.**

No section may occupy a full screen to say nothing. No conditional reordering — position is static so
the page is the same page on every visit.

### 1.6 Accessibility floors (non-negotiable)

- Minimum type 12px · minimum touch target `min-h-11` (44px, `--touch-min`)
- Every interactive element keeps `focus-visible:outline focus-visible:outline-2
  focus-visible:outline-offset-2 focus-visible:outline-brand`
- Heading order strictly `h1 → h2 → h3`, no skips
- Status is never colour-only — `StatusBadge` already pairs tone with a text label
- All `data-analytics-section` attributes and `SectionTrackLink` wrappers survive every merge

### 1.7 Breakpoints

Tailwind defaults. Only three matter here: **`sm` 640** (cards go 2-up), **`lg` 1024** (cards go 3-up,
hero becomes two-column), **`md` 768** (type steps up).

---

## PART 2 — Section specification

### Order at a glance

| Order | Section | Anchor(s) | Visual priority | Desktop height | Share of page |
|---|---|---|---|---|---|
| **S1** | Hero | `#today` | **1** | ~356px | 11% |
| **S2** | The Proof Band | `#verified-performance` `#recent-results` | **2** (weight: 1) | ~640px | 20% |
| **S3** | Today's Picks | `#top-picks` | **3** | ~600px | 19% |
| **S4** | Live Signals | `#live-signals` | **6** | ~340px | 11% |
| **S5** | Research | `#fixtures` `#saved` `#featured-leagues` | **7** | ~740px | 23% |
| **S6** | Bookmakers | — | **5** | ~300px | 9% |
| **S7** | How This Works | `#why-trust` `#prediction-archive` `#methodology` | **4** | ~400px | 13% |

Total desktop ≈ **3,376px (3.75 screens at 900px)**. Current page ≈ 6,200px.

---

## S1 · HERO

```
┌─ container-wide ──────────────────────────────────────────────────────┐
│                                                            pt-8       │
│  FOOTBALL DECISION SUPPORT · SAT 01 AUG              E1 · 11px        │
│                                                            mt-1       │
│  Evidence before the bet.                            D1 · 48px serif  │
│  Settlement after the whistle.                       leading 1.05     │
│                                                            mt-4       │
│  Qualified goal-market predictions, published before                  │
│  kickoff and settled transparently after it.         B1 · 16px        │
│                                        max-w-[46rem]       mt-6       │
│  ┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │
│  │ See verified         │ │ Review today's   │ │ 🔍 Search…       │  │
│  │ performance  [BRAND] │ │ picks  [outline] │ │       [existing] │  │
│  └──────────────────────┘ └──────────────────┘ └──────────────────┘  │
│   ← one row at lg, stacked below                           mt-4       │
│  132 qualified fixtures today · 8 live               M1 · 14px        │
│                                                            pb-12      │
└───────────────────────────────────────────────────────────────────────┘
```

- **Exact order:** 1 of 7. First element after site chrome.
- **Visual priority:** **1.** D1 is the largest type on the page and appears exactly once.
- **Typography:** E1 eyebrow → D1 headline → B1 subtitle (2-line cap) → M1 buttons → M1 status line.
- **Spacing:** `pt-8 pb-12` desktop, `pt-6 pb-10` mobile. Internal: `mt-1 / mt-4 / mt-6 / mt-4`.
- **Width:** text column `max-w-[46rem]`. Action row spans the same measure.
- **Desktop:** headline breaks to exactly 2 lines at 48px within 736px. At `lg`, the two CTAs and the
  search field sit on **one row** (`flex flex-wrap items-center gap-3`), which is what keeps the
  section at 356px and the Proof Band's numerals inside the first viewport.
- **Mobile:** headline 36px, 3 lines. CTAs stack full-width, `min-h-11`, brand-filled first. Search
  below. Total ~440px — the hero owns the mobile fold alone, by design.
- **Why it exists:** it is the only element on the current page that already works, and the single
  strongest asset RankWagers owns. Two clauses, one idea, no adjectives.
- **Why it deserves this position:** it answers *"what is this?"* in under two seconds and hands the
  visitor exactly two doors — one to the product, one to the proof.

**Changes from current:** D1 grows `text-3xl md:text-4xl` → `text-4xl md:text-5xl`. **CTAs swap
priority** — `See verified performance` takes the brand fill and now scrolls one section, not four.
The `Model v2.4.1 · Updated 07:39 UTC · NG` monospace rail and `HomepageDateControl` **move to S3**.
`132 qualified fixtures` is kept and promoted from 11px mono to M1. The trailing subtitle clause
*"…with Acca workflows coming next."* is removed.

---

## S2 · THE PROOF BAND — *the section this entire specification exists to create*

```
╔═ FULL-BLEED · bg-[var(--canvas-secondary)] · border-y ════════════════╗
║                                                            py-12      ║
║  VERIFICATION                                        E1 · 11px        ║
║  What we said, and what happened                     H2 · 24px serif  ║
║  Losses are included. ROI is omitted until publication odds are       ║
║  durably archived.                          B1 · 16px · max-w-[38rem] ║
║  Qualified list markets · 2026-07-30 → today         M1 · 14px        ║
║                                              max-w-[72rem]   mt-8     ║
║  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐             ║
║  │ SETTLED   │ │ WON       │ │ LOST      │ │ HIT RATE  │  E1 · 11px  ║
║  │           │ │           │ │           │ │           │             ║
║  │    181    │ │    138    │ │     43    │ │   76.2%   │  D2 · 36px  ║
║  │           │ │           │ │  ▲ IDENTICAL TREATMENT  │  mono tabular║
║  │ 456 pend  │ │           │ │           │ │ void: 6   │  P1 · 12px  ║
║  └───────────┘ └───────────┘ └───────────┘ └───────────┘             ║
║                                                              mt-8     ║
║  ┌──────────────────────────────────────────────────────────────┐    ║
║  │ Los Angeles II vs Colorado Rapids II       3–0    [  WON  ]  │ T1 ║
║  │ MLS Next Pro · 1st Half Over 0.5 · 01 Aug              ▲only │ M1 ║
║  ├──────────────────────────────────────────────────────────────┤ chroma
║  │ …6 rows                                                      │    ║
║  └──────────────────────────────────────────────────────────────┘    ║
║                                                              mt-6     ║
║  Full prediction archive    Settlement methodology    M1 · underlined ║
║  Last updated 31 Jul 2026, 23:31 UTC                 P1 · 12px        ║
╚═══════════════════════════════════════════════════════════════════════╝
```

- **Exact order:** 2 of 7. Immediately after the hero, with **no rule between them.**
- **Visual priority:** **2 by position, 1 by weight.** The only full-bleed band and the only D2
  numerals on the page.
- **Typography:** E1 → H2 → B1 → M1 window → `MetricCard`(E1 label / **D2 value** / P1 detail) → row
  T1 + M1 + `StatusBadge` → M1 links → P1 timestamp.
- **Spacing:** `py-12` / `py-10` mobile. `mt-8` before metrics, `mt-8` before rows, `mt-6` before links.
- **Width:** lead `max-w-[38rem]`; metrics and rows `max-w-[72rem]`; band background full-bleed.
- **Desktop:** metrics `grid-cols-4`. Result rows full-width list with score and badge right-aligned.
  Six rows, not twelve.
- **Mobile:** metrics `grid-cols-2` — **never `grid-cols-1`.** WON and LOST must sit side by side on
  every viewport; the comparison *is* the message, and a stacked column destroys it. Rows become
  two-line stacks with the badge on the second line, right-aligned.
- **Why it exists:** it is the only content on this homepage no competitor can copy, and the only
  section that answers *"why is this different?"* and *"why should I trust it?"* simultaneously —
  with evidence rather than assertion.
- **Why it deserves this position:** the hero promises *"settlement after the whistle."* This is the
  whistle. Placing it second makes the page pay its own headline within one scroll, and means every
  percentage in S3 is read *through* the loss counter the visitor has already seen. The same number
  means something different in this order.

**Changes from current:**
- **Merge:** `#verified-performance` + `#recent-results` into one section; both anchors retained on
  the merged container.
- **Resize:** `MetricCard` value `text-2xl` → **D2 (`text-4xl`)**.
- **Re-slot:** the four cards change from Total / Settled / Pending / Hit-rate to
  **Settled / Won / Lost / Hit rate.** `pending` and `void` demote to the P1 detail line the component
  already supports. Same data, same component, different emphasis.
- **`LOST` receives identical treatment to `WON`.** Same size, weight, colour, position. Not
  diminished, not red-flagged, not apologised for. **This is the single decision the specification
  exists to make.**
- **Promote:** *"ROI is omitted until publication odds are durably archived"* from 12px muted to the
  **B1 lead slot.** It is the most credible sentence on the site and currently hides in a footnote.
- **Promote:** `Last updated` 10px → P1, rendered through the existing date formatter, never as
  `2026-07-31T23:31:25.115Z`.
- **Resize:** result-row team names `text-sm` → **T1**. Rows 12 → **6**.

> **Acceptance condition (data, not design).** This section is inert if the result list renders only
> `PENDING`. Today twelve rows render with zero losses, and the two rows whose scores imply a loss are
> marked pending. That is a known defect logged in the launch reviews. **The design is correct; the
> section cannot ship at this priority until settled rows appear.**

---

## S3 · TODAY'S PICKS

```
┌───────────────────────────────────────────────────────────────────────┐
│  TODAY                                               E1 · 11px        │
│  Today's qualified markets                           H2 · 24px serif  │
│  Highest model probabilities among today's qualified markets.         │
│  Confidence is a model signal, not a promise.        B1 · 16px        │
│                                                            mt-6       │
│  [ Sat 01 Aug ▾ ]   1H 0.5 · 49   O1.5 · 74   O2.5 · 85   2H · 55    │
│   date control        ← trending markets, merged as an M1 row         │
│                                              max-w-[72rem]   mt-6     │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐│
│  │ TASMANIA STHN CHMP  │ │ SA STATE LEAGUE 1   │ │ TASMANIA NPL     ││ E1
│  │                     │ │                     │ │                  ││
│  │ Clarence Zebras II  │ │ Fulham United       │ │ Glenorchy Knights││ T1
│  │ vs New Town Eagles  │ │ vs Eastern United   │ │ vs Devonport City││ 18px
│  │                     │ │                     │ │                  ││
│  │ Over 1.5 · 04:30    │ │ Over 1.5 · 05:30    │ │ Over 1.5 · 06:45 ││ M1
│  │ Model 100%          │ │ Model 100%          │ │ Model 100%       ││ M1
│  │                     │ │                     │ │                  ││ neutral
│  │ Observed 3 min ago  │ │ Observed 3 min ago  │ │ Observed 3 min   ││ P1
│  │ [Open match][+Acca] │ │ [Open match][+Acca] │ │[Open match][+Acca]││
│  └─────────────────────┘ └─────────────────────┘ └──────────────────┘│
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐│
│  │ …3 more                                                          ││
└───────────────────────────────────────────────────────────────────────┘
```

- **Exact order:** 3 of 7.
- **Visual priority:** **3.**
- **Typography per card:** E1 league → **T1 teams (largest element in the card)** → M1 market · kickoff
  → M1 `Model 100%` neutral → P1 `Observed` → M1 buttons.
- **Spacing:** `py-12` / `py-10`. Card `p-5`, grid `gap-4`.
- **Width:** lead `max-w-[38rem]`; grid `max-w-[72rem]`.
- **Desktop:** `grid-cols-3`, two rows of three. Date control and market row share one line above.
- **Mobile:** `grid-cols-1`; at `sm` `grid-cols-2`. Market row scrolls horizontally
  (`overflow-x-auto`, no scrollbar chrome). Date control full-width above it.
- **Why it exists:** it is what the visitor searched for, and the recurring daily reason to return.
- **Why it deserves this position:** third, not first. Alone it is indistinguishable from every
  tipster site on the internet. Positioned after the proof, it becomes the *application* of a method
  the visitor has already seen validated. Same cards, different meaning.

**Changes from current — the card is re-cast:**

| Element | Current | Specified |
|---|---|---|
| `%` | `font-mono text-2xl text-brand`, top-right | **M1, `--ink-secondary`, inline under the market** |
| Team names | `text-base` | **T1 (18px) — largest element in the card** |
| League | E1 fused with `#rank` | E1, **`#rank` removed** |
| Evidence line | *"Model probability 100% on Over 1.5 Goals"* | **Removed** — verbatim restatement of the badge |
| `Observed` | 10px mono | **P1 (12px)** |
| CTAs | brand fill + secondary | unchanged |

- **Merge:** `Trending markets` becomes the M1 counts row under the heading — same links, same data,
  one-tenth the height, now functioning as context for the grid rather than a separate destination.
- **Move in:** `HomepageDateControl` from the hero. A date control belongs beside the fixtures it filters.
- **Remove:** the 12px *"Prefer an automatic multi-leg Acca? Open Acca Builder"* line — the weakest of
  four Acca pitches, sitting between a heading and its content.

---

## S4 · LIVE SIGNALS

```
┌─ border-t ────────────────────────────────────────────────────────────┐
│  Live matches                                        H2 · 24px serif  │
│  Live scores and prediction states appear only when provider data     │
│  supports them. Nothing is fabricated.               B1 · 16px        │
│                                                            mt-6       │
│  ┌────────────────────────────────────────┐   max-w-2xl              │
│  │  [ LiveFeedPanel — internals unchanged ]│                          │
│  └────────────────────────────────────────┘                          │
└───────────────────────────────────────────────────────────────────────┘
```

- **Exact order:** 4 of 7. **Visual priority: 6.**
- **Typography:** **no eyebrow.** H2 alone, then B1. Dropping E1 is how a section signals it is
  supporting rather than structural.
- **Spacing:** `py-10` / `py-8`. `border-t border-[var(--border-subtle)]`.
- **Width:** `max-w-2xl` (unchanged).
- **Desktop:** left-aligned panel, not centred — it is a module, not a hero.
- **Mobile:** full-width, panel internals unchanged.
- **Why it exists:** it proves the product is live, and it carries *"Nothing is fabricated"* — a
  top-five trust sentence currently rendered as a 14px description nobody reaches. Promoted to B1, it
  becomes the section's lead line.
- **Why it deserves this position:** the page's spine is a timeline — **S2 past → S3 today → S4 now.**
  Live belongs at the end of that sequence. Critically, it must sit **outside** the trust sequence:
  this section contains locked rows and an unlock modal, and adjacency to the Proof Band is what makes
  a lock read as a paywall on evidence.

**Changes from current:** reordered out from between the picks and the proof. Eyebrow dropped.
Description promoted to B1. **The duplicated explainer paragraph is removed** — it currently renders
twice, verbatim.

---

## S5 · RESEARCH

```
┌─ border-t ────────────────────────────────────────────────────────────┐
│  Browse all research                                 H2 · 20px serif  │
│                                                            mt-4       │
│  Premier League · La Liga · Serie A · Bundesliga · Ligue 1 ·          │
│  Champions League · NPFL                    All competitions →   M1   │
│                                                            mt-6       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  [ BibleFixtureExplorer — internals unchanged ]                  ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                            mt-10      │
│  Saved                                               H3 · 16px serif  │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  [ SavedFixturesPanel ] — collapses to one line when empty       ││
│  └──────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────┘
```

- **Exact order:** 5 of 7. **Visual priority: 7** — deliberately the quietest section.
- **Typography:** H2 at the **`text-xl` step only** (20px, no `md:text-2xl`), no eyebrow, no icon.
  Sub-block at H3. This is how the page signals a shift from *narrative* to *tool*.
- **Spacing:** `py-10` / `py-8`. `mt-10` between the explorer and Saved.
- **Width:** full container for the explorer; league row `max-w-[72rem]`.
- **Desktop:** league row inline, wrapping. Explorer unchanged.
- **Mobile:** league row `overflow-x-auto` single line. Explorer unchanged. Saved collapsed.
- **Why it exists:** it is the site's actual depth — 132 fixtures across four markets — and the working
  surface for a visitor who has decided to stay.
- **Why it deserves this position:** after the argument is made, not inside it. A visitor who reaches
  a ~50-item filter and `Page 1 of 22` has already been convinced; one who meets it first has not.

**Changes from current — three merges:**
- `Featured leagues` → a single M1 text row (was an 8-cell `min-h-12` grid; ~200px recovered).
  **The `CAF` entry is removed** — it renders as a dashed-border `span` with no `href`, a visible dead
  placeholder. Any entry without a link is dropped.
- `Recently qualified` → `BibleFixtureExplorer`, internals untouched, heading demoted.
- `Saved` → H3 sub-block. Currently it holds a full section with eyebrow, H2 and a 16px paragraph to
  tell 100% of launch traffic that it is empty. `#saved` anchor retained so site navigation resolves.

---

## S6 · BOOKMAKERS

```
┌─ border-t ────────────────────────────────────────────────────────────┐
│  Compare licensed bookmakers                         H2 · 20px serif  │
│  Research above is separate from commercial offers. We may earn a     │
│  commission when you sign up through links on this site.     M1 · 14px│
│                                                            mt-6       │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │  [ BibleOperatorStrip — internals unchanged ]                    ││
│  └──────────────────────────────────────────────────────────────────┘│
│  Full operator rankings →                                       M1    │
└───────────────────────────────────────────────────────────────────────┘
```

- **Exact order:** 6 of 7. **Visual priority: 5.**
- **Typography:** H2 at `text-xl` only, no eyebrow. Disclosure at M1 — deliberately *not* B1; it is a
  disclosure, not a lead.
- **Spacing:** `py-10` / `py-8`, `border-t`.
- **Width:** `max-w-[72rem]`.
- **Desktop:** three operator cards in a row, unchanged.
- **Mobile:** stacked, `min-h-11` CTAs.
- **Why it exists:** it is the business model, and disclosing it prominently is correct.
- **Why it deserves this position:** **after every research surface, without exception.** The section
  already claims *"research above is separate from commercial offers."* Placed here, the claim becomes
  literally true of the layout. Today three `Continue` buttons sit inside the evidence sequence, and
  the layout contradicts the sentence. **Layout is what people believe.**

**Changes from current:** moved from position 9 (between Featured leagues and the fixture explorer) to
position 6. Heading demoted, eyebrow dropped. Affiliate disclosure raised to sit with the section
rather than only in the footer.

---

## S7 · HOW THIS WORKS

```
┌───────────────────────────────────────────────────────────────────────┐
│                                              (whitespace, no rule)    │
│  METHODOLOGY                                         E1 · 11px        │
│  How this works                                      H2 · 24px serif  │
│                                                            mt-6       │
│  01  Predictions are observed before or as lists are published —      │
│      not rewritten after kickoff.                    B1 · 16px        │
│  02  Evidence and model signals sit next to every qualified market.   │
│  03  Live scores appear only when the provider supplies them.         │
│  04  Settlement is server-authoritative: void, pending, won, lost.    │
│  05  Historical archives support verification.       max-w-[46rem]    │
│                                                            mt-8       │
│  [ BibleHomeNotes — qualification explainer ]                         │
│                                                            mt-8       │
│  ┌──────────────────────┐ ┌───────────────────────┐                  │
│  │ Read methodology     │ │ Prediction archive    │                  │
│  │      [BRAND]         │ │      [outline]        │                  │
│  └──────────────────────┘ └───────────────────────┘                  │
└───────────────────────────────────────────────────────────────────────┘
```

- **Exact order:** 7 of 7. **Visual priority: 4** — deliberately above S5 and S6 in weight despite
  being last. It is the final thing read and must feel substantial.
- **Typography:** E1 → H2 (full `md:text-2xl`) → five B1 rows with M1 ordinals → CTAs.
- **Spacing:** `pt-12 pb-16` / `pt-10 pb-12`. No rule above — whitespace returns the reader to the
  argument.
- **Width:** `max-w-[46rem]` — editorial measure, matching the hero. The page opens and closes at the
  same width, which is what makes it feel composed rather than assembled.
- **Desktop:** single column. The current two-column card grid is dropped.
- **Mobile:** identical; the ordinal sits inline, not stacked above.
- **Why it exists:** it converts the visitor who wants to verify before trusting — and three separate
  sections currently make this identical argument in three places.
- **Why it deserves this position:** the page's rhetorical arc closes here. Promise (S1) → proof (S2)
  → application (S3) → currency (S4) → depth (S5) → disclosure (S6) → **method (S7)**. Ending on
  method rather than on monetisation is the whole positioning, expressed as an order.

**Changes from current — three merges:** `#why-trust` + `#prediction-archive` + `#methodology`, all
three anchors retained. The five `Why RankWagers` cards become five text rows — the bordered card
chrome and the decorative brand-green `01`–`05` monospace numerals add ~180px and no meaning. The
strings *"…while the full searchable archive ships in a later sprint"* and *"a fuller prediction
archive is planned"* are removed. A launch page does not discuss what is unbuilt, least of all
directly beneath its verification promise.

---

## PART 3 — The fold budget

The specification's central claim is that **`LOST 43` renders inside the first desktop viewport.**
The arithmetic, at the specified sizes:

**Desktop 1280 × 800** (the demanding case)

| Element | px |
|---|---|
| Site header | 64 |
| S1 `pt-8` | 32 |
| E1 eyebrow + `mt-1` | 19 |
| D1 headline, 2 lines @ 48 × 1.05 | 101 |
| `mt-4` + B1 subtitle, 2 lines @ 16 × 1.6 | 67 |
| `mt-6` + action row (`lg`: CTAs + search on one line) | 68 |
| `mt-4` + M1 status line | 36 |
| S1 `pb-12` | 48 |
| S2 `py-12` top | 48 |
| E1 + H2 + `mt-3` + B1 (2 lines) + M1 window | 137 |
| `mt-8` | 32 |
| **`MetricCard` — E1 label + D2 value + P1 detail + `p-5`×2** | **151** |
| **Running total** | **803** |

At 800px the final ~3px of the metric card's detail line is below the fold; **the D2 numerals — `138`
and `43` — are fully visible at ~700px.** At 1440 × 900 the metric row clears with ~130px to spare and
the first result row enters view.

**Mobile 390 × 844.** The hero owns the fold alone (~440px). The contract is different and explicit:

> **`LOST` must appear within the first 600px of scroll past the fold.**

S2 begins at ~496px; its pre-card block is ~180px on mobile; the D2 numerals land at ~676px — **inside
one thumb swipe.** This is why S2's metric grid is `grid-cols-2` on mobile and never `grid-cols-1`:
stacking would push `LOST` to ~980px and break the contract.

---

## PART 4 — Component mapping

Every element maps to a component that ships today. Nothing new.

| Section | Components |
|---|---|
| S1 | `SectionTrackLink` ×2, `HomepageSearchEntry` |
| S2 | `SectionHeading`, `MetricCard` ×4, `StatusBadge`, `SectionTrackLink`, `EmptySection` |
| S3 | `SectionHeading`, `HomepageDateControl`, `SectionTrackLink`, `AddToAccaButton`, `EmptySection` |
| S4 | `SectionHeading`, `LiveFeedPanel` |
| S5 | `SectionHeading`, `SectionTrackLink`, `BibleFixtureExplorer`, `SavedFixturesPanel` |
| S6 | `SectionHeading`, `BibleOperatorStrip`, `SectionTrackLink` |
| S7 | `SectionHeading`, `BibleHomeNotes`, `SectionTrackLink` ×2 |

**Removed from the homepage:** `HomepageAccaEntry` (Acca is pitched four times; this is the weakest
instance). Component untouched, still used elsewhere.

**Icons:** the five `lucide-react` section icons (`Activity`, `BarChart3`, `Radio`, `ShieldCheck`,
`Clock3`) are dropped from headings. Serif headings do not need a 16px glyph to be legible, and one
decorative icon per section is noise disguised as structure.

---

## PART 5 — Compliance and acceptance

### 5.1 Constraint compliance

| Constraint | Status |
|---|---|
| Existing components only | ✅ Part 4 |
| No new feature | ✅ Every element ships today |
| No new page | ✅ All links target existing routes |
| No business-logic change | ✅ Same queries, same sort, same settlement — presentation only |
| No roadmap change | ✅ Nothing scheduled, nothing deferred |
| Anchors preserved | ✅ `#today #top-picks #verified-performance #recent-results #featured-leagues #live-signals #fixtures #saved #why-trust #prediction-archive #methodology` |
| Analytics preserved | ✅ All `data-analytics-section` + `SectionTrackLink` retained on merged containers |
| Nav links resolve | ✅ `/en#fixtures` → S5 · `/en#live-signals` → S4 · `/en#saved` → S5 |
| Hero CTAs resolve | ✅ `#verified-performance` → S2 · `#top-picks` → S3 |

### 5.2 Acceptance criteria

1. `LOST` renders at D2 (36px), identical treatment to `WON`, on every viewport ≥ 360px.
2. `LOST` is fully visible at ≤ 800px scroll depth on mobile and within the first viewport at 1280 × 800.
3. No `text-[10px]` anywhere on the homepage.
4. `text-brand` appears **zero** times inside content; `bg-brand` appears exactly twice (S1, S7).
5. `font-mono text-4xl` appears exactly four times — the Proof Band metrics.
6. The homepage contains **zero** occurrences of "coming next", "is planned", "later sprint".
7. No paragraph renders twice.
8. No cell renders without an `href`.
9. Total desktop page height ≤ 3,600px.
10. Interactive targets above the fold ≤ 4.
11. Section count = 7. Eyebrow count = 3.
12. All eleven anchors resolve; all analytics attributes present.

### 5.3 Before / after

| Metric | Current | Specified |
|---|---|---|
| Sections | 14 | **7** |
| Targets before 2nd scroll | 17 | **4** |
| Desktop page height | ~6,200px | **~3,376px** |
| Largest element | `100%` ×6 @ 24px brand | **`WON 138` / `LOST 43` @ 36px** |
| Trust asset max size | 14px | **36px** |
| Type floor | 10px | **12px** |
| `bg-brand` / `text-brand` uses | ~20 | **2 / 0** |
| Colour in content | brand green throughout | **outcome status only** |
| Section eyebrows | 12 | **3** |
| Decorative icons | 5 | **0** |
| "Coming soon" admissions | 3 | **0** |
| Duplicated paragraphs | 1 | **0** |
| Dead cells | 1 (`CAF`) | **0** |
| Acca pitches | 4 | **2** |

---

## PART 6 — Why this is not another betting website

Every betting site on the internet shares five signals: a large accent-coloured percentage above the
fold, five-star ratings, a countdown, a gradient, and a hidden loss record.

This specification removes four of them and inverts the fifth.

| Their signal | This page |
|---|---|
| Big coloured percentage | 14px, neutral, third section |
| Five-star ratings | absent from the homepage entirely |
| Countdown / urgency | none |
| Gradients, shadows, neon | warm paper, hairlines, one accent |
| Hidden losses | **`LOST 43` at 36px, second section, same size as `WON`** |

The register does the rest. A serif headline on warm paper, a constrained editorial measure, three
eyebrows on the entire page, and the only colour in the content area meaning *outcome* — this is the
visual grammar of a record, not a sportsbook.

**Nothing was invented to achieve it.** The serif was already in the config. The paper canvas was
already in the tokens. The loss counter was already in the data. They were a caption, a background,
and an afterthought.

This specification makes them the page.
