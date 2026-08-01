# RankWagers — Visual Language Specification

**Scope:** Visual language only. No features, no workflows, no architecture.
**Date:** 2026-08-01.
**Status:** Definitive specification. Where this document and the current build disagree, this
document is correct.

---

## 0. The principle

**One family. Three weights. Three inks. One accent. One line. No shine.**

Everything below follows from a single diagnosis: this interface is *small and bold*. 1,516 type
usages sit at or below 14px against 40 at body size, and 861 usages carry medium weight or heavier
against 8 at regular. Small and bold everywhere is the texture of a dashboard. Large and light is
the texture of an instrument.

The correction is not decoration. It is **subtraction and enlargement**: fewer sizes, fewer weights,
fewer colours, fewer borders, no motion — and everything that carries meaning made larger.

Timeless is what remains when nothing is trying to impress you.

---

## 1. Typography

### 1.1 Typeface

**One family: Inter.** Already loaded. It carries the entire interface.

**Playfair Display is retired.** A high-contrast Didone is a fashion voice; its stroke contrast
collapses at UI sizes, and it dates a product to the year it was chosen. Nothing in this product is
improved by a serif.

**Monospace is reserved**, not decorative. It appears only on: identifiers, hashes, timestamps, and
tabular figures. Never on prose, never on labels, never on headings.

### 1.2 Scale

Six steps. Base 16px. Nothing outside this list ships.

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `display` | 40px / 2.5rem | 1.1 | 600 | Page title. One per page. |
| `title` | 30px / 1.875rem | 1.2 | 600 | Section heading |
| `heading` | 22px / 1.375rem | 1.3 | 600 | Card title, subsection |
| `body` | **16px / 1rem** | 1.55 | 400 | **The default. All prose.** |
| `secondary` | 14px / 0.875rem | 1.5 | 400 | Table cells, supporting text |
| `micro` | 12px / 0.75rem | 1.4 | 500 | Labels, provenance, metadata |

**12px is the floor.** `text-[11px]` and `text-[10px]` are deleted — 290 usages, none of them
justified. If something is too unimportant for 12px, it is too unimportant to render.

The current CSS scale (`--text-h1` … `--text-metadata`) is replaced by the above and becomes the
only type system. The parallel Tailwind-class system is retired; two type systems means neither is
authoritative.

### 1.3 Weight

**Exactly three.**

| Weight | Use |
|---|---|
| **400 Regular** | All body text. **The default.** |
| **500 Medium** | Micro-labels, table headers, emphasis inside prose, active nav |
| **600 Semibold** | Headings only |

**700, 800, and 900 are deleted** — 101 current usages. Heavy weight is how a product shouts. An
instrument does not shout.

The single largest texture change in this specification: today 462 elements are semibold and 8 are
regular. That inverts. Regular becomes the default state of text, and weight returns to meaning
something.

### 1.4 Case and letterspacing

- **Uppercase is reserved for micro-labels only.** Never buttons, never headings, never prose.
- A micro-label is at most **24 characters**.
- Uppercase micro-labels carry **exactly one tracking value: `0.08em`.** The current build uses ten
  (`tracking-wide`, `wider`, `widest`, and seven arbitrary em values). One gesture, one value.
- Headings at 30px and above receive **−0.01em** optical tightening. Nothing else is tracked.
- Sentence case everywhere else. Title Case is retired.

### 1.5 Numerals

- **`tabular-nums` on every number that appears in a column, a table, a card metric, or a chart.**
  Non-negotiable. It is already used in 39 files; it becomes universal.
- Percentages, prices, and probabilities use **tabular figures at body size or larger** — never
  micro.
- A unit always accompanies a number, at one step smaller and in `ink-secondary`, never in the same
  weight as the value.

---

## 2. Colour hierarchy

### 2.1 Canvas

The warm cream canvas is retired. Beige reads as hospitality and lifestyle; it tints every data
surface, muddies greys, and lowers contrast against chart ink.

**Three neutral surfaces. Cool, quiet, near-white.**

| Token | Value | Use |
|---|---|---|
| `canvas` | `#FAFAF9` | Page background |
| `surface` | `#FFFFFF` | Cards, tables, panels |
| `surface-sunken` | `#F4F4F2` | Table headers, wells, inset areas |

Elevation is expressed by these three values and a hairline. Nothing else.

### 2.2 Ink

**Three levels. The fourth is deleted.**

| Token | Value | Use |
|---|---|---|
| `ink` | `#141A18` | Headings, values, primary text |
| `ink-secondary` | `#4F5A56` | Supporting prose, table cells, descriptions |
| `ink-muted` | `#727C79` | Labels, provenance, metadata, disabled |

The current `--ink-muted` (`#6d7773`) and `--ink-subtle` (`#7c8581`) are perceptually the same grey.
A distinction the eye cannot make is not a distinction. One of them goes.

### 2.3 Accent

**One accent: green `#0E6B4F`.**

It marks **interaction and nothing else**: links, primary action, active state, focus. It is not a
decorative colour. It does not tint backgrounds for emphasis. It does not appear in headings.

Amber is demoted from brand colour to **semantic caution only**. Gold badges, gold gradients, and
gold decorative accents are deleted. A second brand colour is how a palette becomes a costume.

### 2.4 Semantic

Four, used **only** for state — never for emphasis, never for decoration.

| State | Ink | Surface |
|---|---|---|
| Positive | `#15966A` | `#EAF3ED` |
| Negative | `#A93F36` | `#FAECE9` |
| Caution | `#9A6510` | `#FBF2DF` |
| Information | `#1F5F8B` | `#E8F2F8` |

Semantic colour is always paired with a text label. **Colour alone never carries meaning.**

### 2.5 Data

One designed categorical ramp replaces the six arbitrary hex values currently hardcoded in the
chart. Requirements, in priority order:

1. Perceptually even spacing in lightness and hue.
2. Distinguishable under deuteranopia and protanopia — which means **red and green never appear in
   the same categorical set**.
3. Every series carries a second encoding (direct label or line pattern) so colour is never the sole
   channel.
4. Derived from tokens, never hardcoded, so it survives a theme.
5. Maximum **five** series before the chart aggregates. Six colours is already too many to hold.

The accent green is the **first** data colour. The data ramp and the interface accent are one system.

### 2.6 The hardcoded-colour rule

**46 distinct hex values currently ship in components**, including 78 usages of dark-theme navy
(`#0b1220`, `#111827`, `#0f172a`) neutralised by specificity overrides, and a bespoke header grey
(`#53615C`) that matches no token.

**No hex value appears outside the token layer.** Ever. The compatibility override block goes with
them.

---

## 3. Spacing and rhythm

### 3.1 Scale

4px base. The scale extends upward — the current one stops at 48px, which is why page rhythm is
improvised.

`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`

Values not on this scale do not ship.

### 3.2 Rhythm

| Relationship | Desktop | Mobile |
|---|---|---|
| Between major sections | **96px** | 64px |
| Between subsections | 48px | 32px |
| Heading → its content | 24px | 24px |
| Between sibling cards | 16px | 12px |
| Inside a card, between blocks | 16px | 16px |
| Label → value | 4px | 4px |

Current section spacing is 36px. Sections therefore run together and the page reads as one
undifferentiated scroll. **96px is the single most valuable spacing change in this document**: it is
what makes a page read as a sequence of considered ideas rather than a feed.

### 3.3 Internal rhythm

**Three gaps inside any component: 4, 8, 16.** Nothing else.

The current pick card stacks blocks at 16, 8, 8, 4, 16 — five gaps drawn from four values with no
system. The eye never settles because nothing repeats. Repetition is what reads as composed.

---

## 4. Alignment

- **One grid.** Every element on a page aligns to the same left edge. No optical exceptions.
- **Numbers right-align. Always.** Text left-aligns. Nothing centres except empty states and modal
  content.
- **Labels align with their values**, not with the container.
- **Baselines align across columns.** Card titles in a row sit on one baseline.
- **Icons align to the cap height** of adjacent text, never to its centre.

Right-aligning numeric columns is the highest-value alignment correction. Tabular figures exist so
digits stack; left-aligning them discards the entire benefit and tells a data-literate reader that
no one who works with data reviewed the screen.

---

## 5. Contrast

- Body and secondary text: **minimum 7:1** on canvas. This is a reading product.
- Micro text at 12px: **minimum 7:1**. Small text needs *more* contrast, not less — the current
  pattern of muted grey at 10–11px inverts this.
- Non-text (borders, dividers, chart axes): **minimum 3:1**.
- Disabled: 40% opacity, and never the only signal of unavailability.
- **Focus is always visible**: 2px accent ring, 2px offset. The current implementation is correct
  and stays.

---

## 6. Containers

| Property | Value |
|---|---|
| Max width, reading | 720px |
| Max width, data | 1280px |
| Max width, page shell | 1440px |
| Gutter | 24px mobile · 40px desktop |

A single page never mixes container widths without a visible section boundary. Prose does not run to
1280px; tables do not squeeze to 720px.

---

## 7. Cards

**A card is a hairline on a surface. Nothing more.**

| Property | Value |
|---|---|
| Background | `surface` (#FFFFFF) |
| Border | 1px `#E6E5E1` |
| Shadow | **None** |
| Radius | 10px |
| Padding | 20px mobile · 24px desktop |
| Internal gaps | 16px between blocks, 4px label→value |

**Border and shadow together are deleted.** Double-encoding elevation is a hedge, and it reads as
one. A card sits on the page; it does not float above it.

**Shadow is reserved exclusively for overlays** — modals, popovers, sheets, dropdowns. In-page
elements never cast one. The current 20px-blur card shadow is soft, consumer-grade, and goes.

Hover on an interactive card: **border darkens one step.** No lift, no scale, no shadow, no
translate.

---

## 8. Tables

Tables are where this product is judged. They receive the most exact specification.

| Property | Value |
|---|---|
| Header | 12px, weight 500, uppercase, 0.08em, `ink-muted`, on `surface-sunken` |
| Cell text | 14px regular, `ink-secondary` |
| Cell — primary column | 14px medium, `ink` |
| Cell — numeric | 14px **tabular, right-aligned** |
| Row height | 44px minimum |
| Cell padding | 12px vertical · 16px horizontal |
| Divider | 1px `#EEEDEA`, horizontal only |
| Vertical rules | **None** |
| Zebra striping | **None** |
| Row hover | `surface-sunken` background. Nothing else. |
| Column alignment | Text left · numbers right · status centre-left with its label |

**Rules:**

- **Every numeric column is right-aligned and tabular.** No exceptions.
- **One timestamp format sitewide**, monospaced, with an explicit timezone. Locale-dependent
  `toLocaleString()` output — variable width, seconds nobody needs, no zone — is deleted.
- **A table cell contains one idea.** No nested disclosures, no bulleted lists, no stacked
  timestamps. A cell that needs three lines belongs in a card.
- **No placeholder strings.** A field without data renders an em-dash (`—`) in `ink-muted`. Never
  the words "unavailable", "n/a", or "pending" where a value belongs.
- **Enum values never reach the reader.** Every status renders as a human label.
- Row density is uniform. Variable row heights are the fastest way to make a table feel unbuilt.

---

## 9. Buttons

**Three variants. One height. No gradients. No animation.**

| Variant | Appearance |
|---|---|
| **Primary** | Solid accent, white label, 6px radius |
| **Secondary** | 1px border, transparent fill, `ink` label |
| **Text** | Accent label, no chrome, underline on hover |

| Property | Value |
|---|---|
| Height | 40px standard · 44px touch |
| Padding | 16px horizontal |
| Label | 14px, weight 500, **sentence case** |
| Radius | 6px |
| Hover | Background darkens one step. Nothing moves. |
| Active | Background darkens two steps |
| Disabled | 40% opacity, no pointer |

**Deleted:** gradient fills, animated sweeps, pulsing glows, hover translate, uppercase labels,
`font-black` labels, and any button that draws attention to itself when idle.

One primary button per view. If two things are primary, neither is.

---

## 10. Icons

**One family — Lucide. Already correct. It stays.**

| Size | Use |
|---|---|
| 16px | Default. Inline with text, buttons, list items. |
| 20px | Section headings only |
| 8px | Status dot only |

Three sizes. The current build uses eight.

- Stroke 1.5px, uniform.
- Icons inherit text colour. **They are never accent-coloured for decoration** — only semantic status
  may carry colour, and only alongside a label.
- Icons are never larger than 20px in the interface. Illustration is a different discipline and this
  product does not need it.
- **An icon never appears alone as the only label for an action.**

---

## 11. Micro-labels

The eyebrow / label / caption tier — currently the most abused surface in the product.

| Property | Value |
|---|---|
| Size | 12px |
| Weight | 500 |
| Case | Uppercase |
| Tracking | 0.08em |
| Colour | `ink-muted` |
| Max length | 24 characters |

One definition, used everywhere: section eyebrows, table headers, badge text, field labels, chart
legends.

**Badges are micro-labels with a surface.** The product currently runs eight badge dialects —
strength, validation, qualification, status, risk, confidence, chip, gold — each with a different
size, radius, weight, and case. They collapse into **one badge**:

| Property | Value |
|---|---|
| Type | Micro-label spec above |
| Padding | 6px horizontal · 2px vertical |
| Radius | 4px |
| Surface | Semantic surface token |
| Ink | Semantic ink token |
| Dot | Optional 8px, current colour, only for live/active state |

Pills (`rounded-full`) are reserved for **removable filter chips only**. Nothing else is a pill.

---

## 12. Borders and dividers

**One hairline weight: 1px. Three tones.**

| Token | Value | Use |
|---|---|---|
| `border` | `#E6E5E1` | Card and container edges |
| `divider` | `#EEEDEA` | Between rows and list items |
| `border-strong` | `#C9CCC7` | Input edges, active boundaries |

Rules:

- **A divider separates siblings. A border encloses a container.** They are not interchangeable.
- **Space before a line.** If 24px of whitespace separates two blocks adequately, the line is
  removed. The current build has 399 bottom-borders and 22 `divide-y` — separation by default rather
  than by decision. Most of those borders are doing work whitespace should do.
- **Never two lines within 16px of each other.** A card border adjacent to a section divider is one
  line too many.
- No vertical rules in tables. No decorative rules anywhere.

---

## 13. Motion

**Motion acknowledges. It never performs.**

| Duration | Use |
|---|---|
| 120ms | Colour, opacity, border |
| 180ms | Small transforms, disclosure |
| 240ms | Overlays, sheets |

One easing: `cubic-bezier(0.22, 1, 0.36, 1)`. The current curve is correct and stays.

**The entire permitted vocabulary:**
- Opacity 0 → 1
- Translate ≤ 8px
- Background and border colour transitions

**Deleted, without exception:**
- **Every infinite animation.** No pulses, no shimmer sweeps, no glow cycles, no shine. An interface
  element that animates while the user is doing nothing is asking for attention it has not earned —
  and a **number that glows is a number a reader discounts.**
- Hover translate and hover scale on any element.
- Entrance animations longer than 240ms. The current 500ms fade-up reads as lag.
- Staggered list entrances.
- Anything that moves on scroll.

`prefers-reduced-motion` handling is already thorough and stays exactly as built.

---

## 14. Charts

Data ink follows the same language.

| Property | Value |
|---|---|
| Axis line | 1px `divider` |
| Gridline | 1px `divider`, horizontal only, maximum 5 |
| Axis label | 12px, `ink-muted`, tabular |
| Series stroke | 2px, from the data ramp (§2.5) |
| Point marker | Only at endpoints, on hover, or on a single-point series |
| Legend | Direct labels at the line end where space allows; otherwise micro-labels |
| Chart title | `heading`, above the plot |
| Source and as-of | 12px `ink-muted`, below the plot, **always present** |

**Every chart carries an x-axis.** A time series without time labels is a decoration.
**Every chart carries its units, its source, and its as-of timestamp** so that it remains
self-describing when it travels as an image.
**Every chart has a text or table equivalent.** A four-word `aria-label` for an entire series is
not an alternative.

---

## 15. Everything that should be removed

1. **Playfair Display**, and the display font slot entirely.
2. **`text-[10px]` and `text-[11px]`** — 290 usages.
3. **Font weights 700, 800, 900** — 101 usages.
4. **Every infinite animation** — pulses, shimmer sweeps, glow cycles.
5. **Hover translate and lift** on buttons and cards.
6. **Card shadows.** Shadow survives only on overlays.
7. **The 46 hardcoded hex values**, the 78 dark-theme leftovers, and the legacy compatibility
   override block.
8. **Nine of the ten letterspacing values.**
9. **Seven of the eight badge dialects.**
10. **The warm cream canvas** and gold as a brand colour.
11. **Zebra striping, vertical table rules**, and most `border-b`.
12. **Placeholder strings** where values belong.
13. **Raw enum values** as user-facing labels.
14. **`toLocaleString()` timestamps.**
15. **Radius values `xl`, `2xl`, `3xl`.**
16. **Uppercase button labels.**
17. **Point markers on every data point.**
18. **Decorative gradients** — ticker bars, logo shells, badge fills.
19. **Nested disclosures inside table cells.**
20. **Icon sizes other than 8, 16, 20.**

---

## 16. Everything that should stay

Unchanged, because it is already right:

1. **Inter**, and the mono stack for numerals and identifiers.
2. **`tabular-nums`** — and it becomes universal.
3. **The 4px spacing base.**
4. **Lucide**, single icon family, and the discipline of four emoji in the entire product.
5. **`:focus-visible`** — 2px accent, 3px offset.
6. **`prefers-reduced-motion`** handling, in full.
7. **The easing curve** `cubic-bezier(0.22, 1, 0.36, 1)`.
8. **The eyebrow / title / description** section pattern.
9. **The semantic token architecture** — naming, RGB channels for opacity, status and risk families.
10. **`sr-only` table captions**, skip-links, RTL handling, minimum touch targets.
11. **The evidence card composition** — label, value, badge, sample, baseline, provenance.
12. **The pick card's core idea**: the probability, largest, tabular. It becomes the model for every
    metric in the product.

---

## 17. Everything that should become larger

1. **Body text** — 14px → **16px**. The single highest-impact change in this document.
2. **Section spacing** — 36px → **96px**.
3. **Page titles** — 30/36px → **40px**.
4. **Provenance and timestamps** — 10/11px → **12px**, and always visible without interaction.
5. **Table row height** — → **44px**.
6. **Card padding** — → **24px**.
7. **Metric values** — every headline number to `heading` or larger, tabular.
8. **Chart plot area** — larger, with real axes and gridlines.
9. **Settlement reasoning** — from collapsed disclosure to visible content.
10. **Disclosure copy** — from 10px fine print to body size at the point of decision.

---

## 18. Everything that should become quieter

1. **Weight.** Regular becomes the default; 462 semibold elements become a handful.
2. **The accent.** Green marks interaction only — never decoration, never headings, never emphasis.
3. **Borders.** Most become whitespace.
4. **Badges.** One dialect, muted surfaces, no gold.
5. **Buttons.** Flat, still, sentence case; one primary per view.
6. **Icons.** Inherit text colour; never accent for decoration.
7. **Motion.** Present only in response to the user.
8. **The canvas.** Neutral, so the data carries the colour.
9. **Uppercase.** Micro-labels only.
10. **Elevation.** One hairline instead of border-plus-shadow.
11. **Chart markers.** Endpoints and hover only.
12. **The 18+ chip and compliance furniture** — necessary, not prominent.

---

## 19. The timeless test

Before anything ships, four questions:

1. **Does it date?** A gradient, a glow, a heavy weight, or a trend-borrowed shape dates a product to
   its year. A hairline, a grotesque, and generous whitespace do not.
2. **Does it perform when idle?** Anything that moves, pulses, or shimmers without the user is
   asking for attention it has not earned.
3. **Does it shout to be understood?** If a thing needs bold, uppercase, colour, and a badge to
   register, the hierarchy around it has failed.
4. **Would it survive being printed?** Strip colour, motion, and elevation. If the hierarchy still
   reads in black on white, it is structural. If it collapses, it was decoration.

**Not trendy:** no gradients, no glass, no glow, no oversized radii, no animated accents.
**Not startup:** no heavy weights, no exclamation, no shimmer, no attention-seeking primaries.
**Not gambling:** no gold, no pulsing, no all-caps CTAs, no colour used to excite.

---

## 20. In one line

**Make the type bigger, the weights lighter, the colours fewer, the lines quieter, and the motion
still — and remove everything that was trying to be noticed.** What remains is the product, and the
product is the data.
