# Form-guide language — v2

Decoded from `design/prototype-v2/RankWagers Today v3.html`. That file is a bundled export: its
**figures are mock**. Nothing numeric, no label and no claim is taken from it — only the
composition and the system. Every number on a shipped page comes from the pipeline.

This supersedes `motion-language.md` for surfaces converted in the rebrand. That document remains
correct for the fixture page until PASS 2 converts it.

## Tokens

Replacing the values inside the `.rw-hero` scope. **The scope mechanism is kept** — tokens stay
scoped so an unconverted surface is unaffected, which is what makes the pass reversible.

| Token | Value | Use |
|---|---|---|
| ground | `#f7f7f6` | the page |
| surface | `#ffffff` | a raised plane |
| ink | `#201e1d` | text, and the inverted ground |
| ink-2 | `#55524e` | secondary text |
| accent | `#ec3013` | **at most two uses per page** |
| live | `#ff6a4d` | the live dot and the minute. Nothing else. |

`ink-3` from v1 (`#6b6f78`) is retired: v2 carries two ink weights, not three. Any contrast pair
introduced here is checked against its own ground, not inherited from v1's.

**Radius is `0` everywhere in scope.** No exception, no "just the badge".

### Type

- **Heading** — Archivo 800, wired through `next/font`. **No runtime `@import`.** A blocking
  third-party font request reintroduces the layout shift `next/font` exists to prevent, and the v1
  refusal of the prototype's Google Fonts import stands unchanged.
- **Mono** — `ui-monospace` system stack. Labels, figures, tabular data.
- **Scale** — mono 9.5–11 · body 14–16 · headings 34 / 46 / 58 · lead numeral 148.

Sizes outside that ladder are a mistake, not a decision. The map uses tracking from `-.055em` at
the lead numeral to `.04em` on mono labels: **the larger the type, the tighter it sets.**

### Rules

The ladder is `0.5 / 1 / 1.5 / 2 / 5px`. A rule's weight carries meaning — hairlines separate
peers, the heavy rule closes a movement. Nothing between the steps.

### Motion

One easing: `cubic-bezier(.16, 1, .3, 1)`. Everything decelerates.

The v1 rules that survive unchanged, because they are about restraint rather than palette:

1. Nothing is fast.
2. One curve family; nothing overshoots.
3. Entrances resolve focus — opacity, blur and rise together.
4. Nothing travels beyond 12px, nothing scales beyond 2%.
5. Values never jump — **and this still does not license a count-up.** A figure appearing for the
   first time appears at its true value; a 0→148 ramp renders numbers the pipeline never observed
   (§3.2). Rule 5 governs a live reading moving to a new value, nothing else.

`prefers-reduced-motion` strips everything, by name and not only by duration.

## Sections, in map order

1. **Header** — active destination carries an underline.
2. **Hero lead** — one enormous numeral (148) **with its market beneath it**. A bare figure is not
   a claim anyone can check. Venue lines draw proportionally **from zero**. Crests are real, 36px,
   bare — no plate, no ring.
3. **Funnel** — the ruled text line, not a chart.
4. **Supporting table** — 26px crests, `%`-with-sample discipline throughout.
5. **Settled record** — wins and losses both shown.
6. **Live desk** — the page's **one** inverted ink ground (the footer is the other; there are no
   more). `--color-live` is confined here.
7. **Operators / acca** — the quietest register on the page. Affiliate is never the hero.
8. **Footnote †** — the reference system for anything a figure needs qualified.
9. **Footer** — on ink.

## Data honesty — carried over unchanged

These are behaviours already live. The rebrand is a change of clothes; none of them moves.

- **Null omission.** A missing value omits its row rather than printing a placeholder.
- **Sample beside rate.** No rate renders without the observations behind it — `82% (9/11)`, never
  `82%`. The rate takes display weight, the sample label weight.
- **researchRun stages** keep their observed counts; an unobserved run is not zero.
- **"Cleared threshold"** is the funnel's fourth stage. Nothing user-facing calls a threshold pass
  a qualification.
- **"Provider potential"** — FootyStats' figure, never "confidence", never "model probability",
  and it carries no sample, which is stated rather than implied.
- **Last-good provenance line** — when the board is replayed from disk the page says so, with the
  original retrieval time.

## Empty states are design citizens

Not skeletons, not spinners, not a shrug.

- **Lead with no venue samples** renders the numeral and its market, and **omits the lines block
  entirely.** No zero-height placeholder, no skeleton — the absence is the design.
- **An empty day** keeps the funnel line and the edition line. The page still tells you what was
  looked at and when.

## Below sm

The map is desktop-only, so nothing here is decoded from it. These rules DERIVE from the
language above — the ladder, the rules, the empty-state law and the CLS law all hold below `sm`;
what changes is composition, and only where the desktop composition physically cannot hold at
360px.

- **Masthead** — one row: the wordmark left, the hamburger right. The meta line
  (`retrieved · edition · 18+`) sits BENEATH that row at 9.5 mono, full width. ONE masthead
  rule closes the block — the 2px ink over its 1px half-ink hairline is that one rule. No
  floating hamburger row, no doubled rules: the hamburger never wraps to a line of its own, and
  no second rule appears between the meta line and the page.
- **Funnel** — the descent turns VERTICAL: five stages, one per line, value-then-label
  unchanged. Each level indents one step further, left to right, so the descent reads as a
  staircase down the page — the shape is still the claim, rotated. `cleared†` keeps its accent
  overline (the budget does not move), and the † footnote is unchanged.
- **Lead** — the numeral clamps: `clamp(72px, 22vw, 148px)`. At desktop widths the clamp
  resolves to 148, so the ladder's top step is unchanged where the map applies. The three venue
  tracks stay side-by-side — they fit — and obey the empty-state law: no samples, no tracks
  block, ever.
- **Stacked table rows** — compressed to at most FIVE lines per row: the fixture; flag and
  league on ONE line; kick-off; AT HOME and AWAY as paired cells sharing one line; POTENTIAL
  and the market sharing the next. A stacked row that restates every desktop column on its own
  line is a column of labels, not a row.
- **Buttons** — the trailing `→` MUST render. The arrow is an explicit character in its own
  element with the sans stack as fallback (the mono stack's glyph coverage is not assumed), and
  a bordered button never carries an overflow ellipsis — a button that truncates its own arrow
  is pointing at nothing.

Everything else inherits the desktop rules verbatim. `prefers-reduced-motion` and the CLS law
are unchanged at every width.

## Non-negotiable

- **Zero CLS.** Only `opacity`, `transform` and `filter` animate. An element occupies its final
  height from the first frame.
- **Mobile.** The supporting table collapses to stacked rows below `sm`. **Never two columns** —
  a 2-col table at 360px is a table nobody can read.
- **Accent budget.** Two uses per page. Colour that appears everywhere means nothing.
- **No figure, label or claim from the prototype.**
