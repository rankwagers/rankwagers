# RankWagers — Product Design Review

**Type:** Design critique. No implementation, no architecture changes, no code.
**Scope:** Visual and interaction design only.
**Date:** 2026-08-01.
**Method:** Design tokens, component source, and rendered markup read directly. Every claim below
is backed by a file reference or a count taken from the codebase.

---

## The verdict, in one paragraph

There is a real design system here — semantic tokens, a considered palette, accessible focus rings,
reduced-motion handling, and genuine restraint in the icon and emoji vocabulary. It is better than
most of its category. But it does not read as a research platform, because of three things, in
order of damage: **the entire interface is set at caption size**, **the brand is dressed as an
editorial/lifestyle product rather than an instrument**, and **the surfaces that carry the
credibility — charts, tables, evidence — are the least designed surfaces in the product.** Fixing
the first costs a week and changes the perceived tier of the whole product. The third is where the
mission is actually won or lost.

---

## 1. The single most damaging finding: everything is 14px or smaller

This is not an impression. It is a count across `app/` and `components/`:

| Size | Uses |
|---|---|
| `text-sm` (14px) | **752** |
| `text-xs` (12px) | **474** |
| `text-[11px]` | **197** |
| `text-[10px]` | **93** |
| `text-base` (16px) | **40** |

**1,516 usages at or below 14px, against 40 at body size.** A 38:1 ratio.

The interface has no body text. It has four grades of caption text — 10, 11, 12, 14 — occupying a
4-pixel range, and it uses them for everything: paragraphs, table cells, card content, labels,
descriptions, provenance, and legal copy.

Three consequences, all severe:

**It reads as an admin panel.** Dense small type signals "internal tool" to every user who has ever
seen one. Stripe sets body at 16px. Linear at 15–16px. Apple at 17px. They are not being generous;
they are signalling that the content is worth reading. The Bloomberg Terminal is the usual
counter-argument, but the Terminal earns its density with a monospaced grid, 100+ px of information
architecture per row, and a professional who trained on it. A public research platform gets no such
licence.

**The hierarchy is unusable.** Four sizes inside a 4px range cannot be perceptually distinguished
in context. When 11px and 12px both appear on the same card, the reader does not perceive two
levels — they perceive noise, and stop trying to parse the ranking. Hierarchy that cannot be seen
is not hierarchy; it is decoration for the person who wrote it.

**10px fails people.** 93 usages at `text-[10px]`, including provenance and timestamps
(`RankWagersHome.tsx:205` renders "Observed <time>" at 10px monospace). That is below the readable
floor for a substantial fraction of adults, and it is applied precisely to the metadata that the
product's entire credibility claim rests on.

There is also a **second, unused type system**: `globals.css` defines `--text-h1` through
`--text-metadata` as a considered scale, and the components almost entirely ignore it in favour of
Tailwind classes. Two type systems means neither is authoritative, and the one that ships is the
accidental one.

**The scale itself is also mis-shaped.** Steps: 2.25 / 1.75 / 1.375 / 1 / 0.875 / 0.75 / 0.6875 rem.
Ratios of 1.29, 1.27, **1.375**, 1.14, 1.17, 1.09. The largest jump in the scale sits between h3 and
body, exactly where readers need continuity, while the small end is crowded with four near-identical
steps where they need separation. A modular scale would invert both.

---

## 2. The brand is dressed for the wrong category

The palette is cream (`#f6f3ec`), forest green (`#0e6b4f`), and gold (`#9a6510`). The display face
is **Playfair Display** — a high-contrast Didone.

That combination is a specific, well-understood visual language: organic food, boutique hospitality,
editorial lifestyle, premium wedding. It is warm, soft, and human.

It is the opposite of the product's stated mission. Instruments — Bloomberg, TradingView, Stripe
Dashboard, Linear — are cool, neutral, and low-chroma, because the interface must recede so the data
can carry the colour. A cream canvas actively fights this: it reduces contrast against chart ink,
it makes greys look muddy, and it tints every data surface warm.

Playfair on a market-intelligence platform is the sharpest single note of mismatch. It appears on
the wordmark (`Header.tsx:64`), on every section heading (`sectionChrome.tsx:26`), and on the
homepage h1 (`RankWagersHome.tsx:101`). A Didone says *taste*. This product needs to say
*instrument*. No serious data product in this class uses a high-contrast serif for UI headings, and
the reason is not fashion — it is that Didone stroke contrast degrades badly at UI sizes and at
weight, which is why it lives in fashion magazines at 60px and nowhere near a table.

This is a positioning decision, not a preference, and it is the reason the product will read as a
"betting site with nice branding" rather than a reference source, no matter how good the data is.

---

## 3. Homepage

**The hero has no focal point.** Between the eyebrow and the fold, it presents: an eyebrow, an h1, a
subtitle, two CTAs, a search field, a live-count status line, a date control, and a monospace
metadata string. Eight elements competing at similar weight (`RankWagersHome.tsx:90-150`). Premium
homepages resolve to one idea and one action. This one asks the visitor to choose from eight.

**The h1 is undersized for its job.** `text-3xl md:text-4xl` — 30px rising to 36px. For a homepage
that must establish an entire category position, that is a section heading, not a statement. The
subtitle beneath it is `text-sm md:text-base`: the core value proposition renders at **14px on
mobile**, which is where most of the traffic is.

**The metadata line is debug output.** `modelMeta` is built as five facts joined by middots and
rendered as 11px monospace in the hero's top-right corner (`page.tsx:63`, `RankWagersHome.tsx:143`):

```
2 August 2026 · 47 qualified fixtures · Model v2.4.1 · Updated 09:15 UTC · United Kingdom
```

Two problems. Visually, an 11px monospace run-on string reads as a log line, not a credential — the
platform's strongest trust signals are presented in its least authoritative typography. And
`Model v2.4.1` is a **hardcoded string** in the page source. A version number that does not change
when the model changes is a decorative trust signal, and a decorative trust signal is the most
expensive kind of design debt a credibility product can carry: it is precisely the detail a skeptical
reader checks.

**Card rhythm is arbitrary.** The pick cards stack blocks at `mt-4, mt-2, mt-2, mt-1, mt-4`
(`RankWagersHome.tsx:190-206`). Five different gaps in one card, none derived from a spacing step.
Meanwhile the card's own type ladder is 11 → 24 → 16 → 12 → 12 → 10px. The result is legible but
restless — the eye never settles because nothing repeats.

**What works:** the probability is the largest element on the card, in tabular monospace
(`font-mono text-2xl tabular-nums`). That is exactly right. The card knows what it is about. It is
the best single design decision in the product, and it should be the model for everything else.

---

## 4. Spacing and visual rhythm

The token set stops at `--space-12` (3rem / 48px). There is no token above it, so **page-level
rhythm has no vocabulary** and section spacing is improvised in Tailwind (`pb-16`, `py-9`,
`pb-10`, `pt-5`). `py-9` is a 36px vertical gap between major sections — roughly half of what a
premium layout uses. Sections therefore run together, and the page reads as one long scroll rather
than a sequence of considered ideas.

Premium layouts breathe at 64 / 96 / 128px between sections, and the difference between 36 and 96 is
the entire difference between "dense" and "composed". This is the second-cheapest high-impact fix in
the document, after type size.

The 4px base rhythm itself is correct, and the omission of `--space-7/9/11` is a good, opinionated
restriction. The problem is only at the top of the scale.

---

## 5. Cards

`.card` is `rounded-lg border border-border bg-ink-card` — a clean, restrained definition. Then
`--shadow-card` (`0 4px 20px -6px`) is applied elsewhere alongside borders.

**Double-encoding elevation is an amateur tell.** A card should be separated from the canvas by a
border *or* a shadow, not both; using both is a hedge, and it reads as one. Apple and Linear
overwhelmingly use a single hairline on a slightly-shifted surface. Stripe uses shadow with no
border. Pick one and let elevation mean something.

A 20px blur radius is also soft for this category — large diffuse shadows read as consumer/marketing;
instruments use tight, low-opacity shadows (4–8px) or none.

Radius is reasonably disciplined — `rounded-md` 245, `rounded-lg` 132 — but seven radii are in
circulation including single uses of `2xl` and `3xl`. Those one-offs are worth deleting purely as a
signal of intent.

---

## 6. Tables

Tables are where a research platform is judged, and these are the weakest primary surface in the
product. From `ArchiveTable.tsx`:

**Numbers are left-aligned.** The table is `text-left` throughout, and the `Model %` column keeps
that alignment despite carrying `tabular-nums` (`:106`). Tabular figures exist so digits align in a
column; left-aligning them discards the entire benefit. **Numeric columns right-align.** This is not
a style preference — it is what makes a column scannable, and getting it wrong is the fastest way to
tell a reader that no one who works with data has looked at this screen.

**Timestamps are raw `toLocaleString()`** (`:127`, `:132`). That renders `25/12/2026, 15:00:00` —
variable width, seconds nobody needs, no timezone, and a different format per visitor. In a table
where three timestamps stack in a single cell, the effect is a mess of shifting glyph widths. A
research platform needs one timestamp format, monospaced, with an explicit zone.

**"unavailable" ships to production.** Line 90 renders literally:

```
Original odds: unavailable · Unit P/L: unavailable
```

Never show a user the name of a field you do not have. This single line does more damage to
perceived quality than any visual choice in the product — it is an unfinished schema leaking
through the interface, and a reader who sees it will assume the rest is unfinished too.

**Status badges print raw enum values.** `<StatusBadge status={row.status} label={row.status} />`
(`:100`) puts the machine token — `won`, `lost`, `void` — in front of the user in lowercase.

**Rows contain disclosures containing bulleted lists.** A `<details>` element inside a table cell
(`:80-93`) makes row heights unpredictable and causes the table to reflow on interaction. That cell
is a card that has been forced into a grid. Either the table is a table, or these rows are cards.

**Header type is 11px uppercase** (`:35`) — small even by this product's standards, for the labels
that make the table navigable.

---

## 7. Charts

`OddsChart.tsx` is 95 lines and is the product's flagship data visualisation. It is a wireframe.

**No x-axis.** A time-series chart with no time labels at all. There is nothing to tell the reader
whether they are looking at six hours or six weeks.

**Two y-labels — min and max only** (`:60-65`). No gridlines, no intermediate ticks, no units. The
reader cannot read a value off the chart; they can only see a shape.

**A hardcoded six-colour array** (`:5`): `#0E6B4F, #1F4B7A, #A96E12, #6B3FA0, #B42318, #0F766E`.
This bypasses the token system entirely, mixes green and red in one categorical set with no
secondary encoding (fatal for colour-blind readers, and roughly 8% of men), places purple beside
red, and has no perceptual spacing between the two teals. It also cannot survive a theme change.

**No interaction.** No hover, no tooltip, no value readout, no crosshair. On a research platform,
the chart is the interface, and this one cannot be interrogated.

**Every point is dotted at r=2.5 over a 2px stroke.** On any dense series this becomes a caterpillar
and destroys the line.

**Accessibility is a single generic label**: `role="img" aria-label="Odds history chart"` (`:44`).
A screen-reader user receives four words and no data. A chart of this importance needs a table
equivalent.

**It is unciteable.** No title, no source, no as-of timestamp, no units. If someone screenshots it —
which is the entire distribution mechanism for this kind of content — the image carries no
attribution and no context. Every chart in a credibility product should be self-describing when it
travels alone.

The chart is not badly built. It is *unfinished* — and it is the surface that most determines
whether the product reads as an instrument.

---

## 8. Navigation

**Primary nav appears only at `xl:` (1280px)** (`Header.tsx:69`). Every laptop below that width —
which includes a very large share of 13" machines in practice — gets the mobile hamburger. Hiding
navigation from desktop users is a serious loss of orientation for a platform whose value is depth
and cross-linking.

**Hardcoded colours in the header.** `bg-[#FBF9F4]` (`:41`, `:44`) duplicates
`--canvas-secondary`, and inactive nav links use `text-[#53615C]` (`:96`) — a grey that matches **no
token in the system** (`--ink-secondary` is `#4f5d58`, `--ink-muted` is `#6d7773`). A bespoke value
in the most-seen component in the product.

**The 18+ chip sits in prime real estate** (`:105`), immediately beside search, competing with the
wordmark. It is a compliance obligation, and it belongs in the footer or in a quieter treatment.

**No dark-mode control**, because there is no dark mode (§10).

The skip-link (`:47`) and `aria-label="Primary navigation"` are correct and well implemented.

---

## 9. Dark mode

**It does not exist.** In `globals.css` it is a *commented-out block* with a note reading "Future
dark theme slots (not activated — light defines the brand)."

Meanwhile the components contain **78 usages of dark-theme colours hardcoded as hex** — `#0b1220`
(40), `#111827` (31), `#0f172a` (7) — and `globals.css` carries a "Temporary compatibility mappings
for legacy page modules" block that overrides `.text-slate-300`, `.border-white/10`, and similar
inside `#main-content`.

Two things follow. First, the product carries the residue of a previous dark theme in ~78 places,
neutralised by specificity hacks rather than removed — a system fighting itself, and the kind of
thing that produces mysterious one-off colour bugs forever. Second, **for the stated category,
dark mode is not a preference feature — it is table stakes.** Every instrument in the reference set
ships dark. Traders and analysts work at night, on multiple monitors, for hours. A light-only data
product with a cream canvas signals "marketing site" regardless of what the data underneath is
worth.

Related: **46 distinct hardcoded hex values** across `app/` and `components/`. The token layer is
genuinely well designed; it is simply not being obeyed.

---

## 10. Evidence UI

The best-designed subsystem in the product, and it should be the template for everything else.

`EvidenceCard.tsx` is disciplined: a labelled heading, a prominent value, a strength badge, sample
quality, baseline comparison, qualification summary, and an updated stamp — composed from a shared
token file (`evidenceUiTokens`) rather than ad-hoc classes. `EvidenceStrengthBadge` carries a proper
`aria-label` and does not rely on colour alone. `SplitCard`, `ProvenanceBlock`, `BaselineComparison`,
and `SampleQualityBlock` show a team thinking in components rather than screens.

Two critiques:

**The as-of stamp is the least prominent element on the card** (`EvidenceCard.tsx:38`,
`text-[11px] text-muted-foreground`). On a card whose entire purpose is provenance, the timestamp
is the payload, not a footnote. Provenance should be *quiet but legible* — 12–13px, not 11px, and
ideally monospaced so it reads as a fact rather than a caption.

**Badge vocabulary is proliferating.** Across the product there are strength badges, validation
badges, qualification badges, status badges, risk badges, confidence bands, chips, and gold badges —
each with its own size, radius, weight, and case treatment. `StatusBadge` uses 11px uppercase with a
1.5px dot; `EvidenceStrengthBadge` uses 11px uppercase with a border and no dot; `.chip` uses 12px
sentence case, rounded-full. A reader cannot learn a system with eight badge dialects, and badges
are the primary way this product communicates state.

---

## 11. Research UI and interaction quality

The research surfaces are competent and unremarkable — filters, tables, pagination, disclosure. What
is missing is the interaction vocabulary that makes a tool feel like a tool:

- **No hover state on data.** Charts have no tooltip; table rows have a background change only.
- **No selection or comparison affordance.** Nothing can be pinned, compared, or held.
- **No keyboard model beyond focus rings.** A research product should have `/` for search, `?` for
  shortcuts, arrow-key traversal in tables, `Esc` to dismiss. Linear's reputation rests almost
  entirely on this, and it costs no visual design at all.
- **No density control.** Research users want to choose comfortable versus compact. This product
  has already chosen compact for everyone, without saying so.
- **No empty-state design as a first-class surface.** `EmptySection` is a single line of muted text
  in a bordered box. Empty states are where a tool teaches; here they are where it goes quiet.

`BottomSheet`, `InlineAlert`, `EmptyState`, and `PageSkeleton` exist as shared primitives — a good
sign, and evidence that the team already knows how to do this. The vocabulary is simply thin.

---

## 12. Motion

Motion tokens are well chosen: 150 / 220 / 360ms with `cubic-bezier(0.22, 1, 0.36, 1)`. That is a
professional easing curve and a sensible three-step duration scale. Entrance animations are small
and directional (4–16px), which is correct.

Then there is `.btn-play-now` (`globals.css`), which runs simultaneously:

- an infinite 2.4s background-position pulse,
- an infinite 2.8s white sweep across the surface,
- a `0 0 12px` green glow,
- a translate on hover,
- and a three-stop gradient fill.

And `.pct-shine`, which applies an **infinite pulsing glow to a percentage value**.

These two are the most damaging elements in the product for professional perception. Infinite
attention-seeking animation on a CTA is the visual signature of affiliate and casino marketing, and
a **glowing number** actively undermines the thing the platform is selling: that its numbers are
measured, not promoted. Data that shimmers is data a reader discounts.

Nothing in Apple, Stripe, or Linear has an infinitely animating element in the interface. Motion
there responds to the user; it never performs at them.

The `fade-up` keyframe at 500ms is also roughly double the right duration for entrance — it is slow
enough to be perceived as lag on a fast connection.

Credit where due: `prefers-reduced-motion` is handled twice, including a global nuke of all
animation and transition. That is more thorough than most production sites.

---

## 13. Trust signals

The credibility architecture is present but designed backwards: **the trust signals are the
smallest, quietest things on every screen.**

- Provenance timestamps: 10–11px, muted, monospace.
- The model/version line: 11px monospace, in the corner, run-on.
- Evidence "Updated": 11px, last element on the card.
- Settlement reasoning: hidden inside a `<details>` inside a table cell.

Meanwhile the CTA glows and pulses. A visitor's eye is drawn to the thing being sold and away from
the thing that justifies it. That ordering is exactly inverted for a product whose entire strategy
is credibility.

The specific fixes are small: give provenance a designed treatment (a consistent, legible,
monospaced stamp with a clear icon), give the method/version a real component instead of a string,
and stop hiding settlement reasoning behind a disclosure. None of these is a redesign; all of them
are a decision about what deserves visual weight.

And `Model v2.4.1` being hardcoded must be resolved on integrity grounds alone.

---

## 14. Accessibility

Genuinely above average, and worth stating plainly:

- `:focus-visible` with a 2px brand outline and 3px offset, applied globally.
- A working skip-link.
- `prefers-reduced-motion` handled comprehensively.
- `role`, `aria-label`, and `aria-labelledby` used correctly and often.
- `<caption class="sr-only">` on tables — a detail most teams never reach.
- RTL support with a font-stack swap and gradient-text neutralisation.
- Minimum touch target token (`--touch-min: 2.75rem`) and `min-h-11` on CTAs.

Three real gaps:

1. **10px text** (93 usages) fails legibility for a meaningful share of users.
2. **Charts have no non-visual equivalent** — a four-word `aria-label` for an entire data series.
3. **Colour-only encoding in charts**, with red and green in the same categorical palette and no
   secondary channel.

The muted text colour (`--ink-muted: #6d7773`) on the cream canvas is also worth measuring — at
10–11px, borderline contrast becomes a genuine failure rather than a technicality.

---

## 15. What makes it feel amateur

Ranked by damage:

1. **Everything is caption-sized.** 1,516 usages ≤14px against 40 at 16px. It reads as an internal
   tool, and no other change matters as much.
2. **Infinite pulsing/shimmering CTAs and glowing numbers.** The single clearest category signal of
   affiliate marketing, on the exact elements that should be most sober.
3. **"Original odds: unavailable · Unit P/L: unavailable" in production.** Unfinished data model
   leaking into the interface.
4. **Left-aligned numeric columns with tabular figures.** Tells a data-literate reader immediately
   that no data person reviewed the screen.
5. **A time-series chart with no time axis, no tooltip, and no gridlines.**
6. **Raw `toLocaleString()` timestamps** stacked three-deep in table cells.
7. **Raw enum values as user-facing labels** (`won`, `lost`, `void`).
8. **46 hardcoded hex values**, including 78 dark-theme leftovers neutralised by CSS specificity
   hacks — a system visibly fighting its own history.
9. **Two parallel type systems** (CSS custom properties vs Tailwind classes), with the accidental
   one winning.
10. **Cards with both border and shadow**, and a 20px soft blur.
11. **Eight badge dialects** with no shared grammar.
12. **A hardcoded version number presented as a trust signal.**

---

## 16. What makes it feel premium

Stated honestly, because there is more here than the list above implies:

1. **The token layer is genuinely well designed** — semantic naming, RGB channels for opacity
   modifiers, status and risk families, confidence bands, motion scale. This is a system built by
   someone who has done it before.
2. **The evidence UI subsystem** is disciplined, componentised, and thoughtful. It is the strongest
   design work in the product.
3. **The pick card's information hierarchy** — the probability, large, monospaced, tabular — is
   exactly right.
4. **Accessibility is above the category norm**, including several details most teams never reach.
5. **Motion easing and duration tokens** are professionally chosen.
6. **Icon and emoji restraint** — four emoji in the entire product, and a single consistent icon
   family (Lucide). This alone separates it from 90% of the category.
7. **Section chrome (eyebrow / title / description)** is a good, repeatable editorial pattern.
8. **`tabular-nums` is used in 39 files** — someone knew to reach for it.
9. **`sr-only` table captions, RTL handling, and skip-links** show real craft attention.

The foundations are good. The product is not badly designed; it is **under-decided** — the system
was built and then not enforced, and the surfaces that matter most for the mission received the
least design attention.

---

## 17. The fix list, by impact against effort

**Do first — highest impact, lowest cost**

1. Raise body text to 16px and collapse 10/11/12px into a two-step small scale. Delete `text-[10px]`
   entirely. This one change moves the perceived tier of the whole product.
2. Delete `.btn-play-now`'s infinite animations and `.pct-shine` entirely.
3. Right-align every numeric column.
4. Remove "unavailable" placeholder strings from the UI.
5. Replace `toLocaleString()` with one canonical timestamp format, monospaced, with a timezone.
6. Map status enums to human labels.
7. Add section-level spacing tokens above 48px and set major section rhythm to 80–96px.

**Do next — high impact, real work**

8. Finish the chart: x-axis, gridlines, hover readout, a designed categorical palette from tokens,
   a title/source/as-of stamp, and a table equivalent for screen readers.
9. Give provenance a designed, legible, consistent treatment and promote it visually.
10. Reduce the homepage hero to one idea, one action, and one supporting proof.
11. Unify the badge system into one grammar with defined variants.
12. Show primary navigation from `lg:` (1024px), not `xl:`.

**Strategic — requires a decision, not just execution**

13. Replace Playfair Display with a neutral grotesque for UI, and cool the canvas toward a neutral
    off-white or light grey. This is the change that makes the product read as an instrument.
14. Ship dark mode, and remove the 78 hardcoded dark-theme hex values and the legacy compatibility
    overrides while doing it.
15. Build the keyboard and density vocabulary that makes a research tool feel like a tool.

---

## 18. The one-sentence summary

The system is better than the interface it produced: **make the type bigger, stop the things that
glow, finish the chart, and dress the product as an instrument rather than a magazine** — and the
same underlying design work will read one full tier higher.
