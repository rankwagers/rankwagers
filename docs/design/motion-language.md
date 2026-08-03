# Motion and type language

Extracted from `design/prototype/src/index.css` and `design/prototype/src/components/motion.ts`.
This is the reference S3–S7 are built against. The prototype is the source; this file is what
shipped, including where the two deliberately differ.

## The five rules

1. **Nothing is fast.** Shortest state change 240ms; shortest entrance 1100ms. Speed reads as
   cheap.
2. **One curve family.** Everything decelerates. No overshoot, bounce, spring or ease-in-out.
   Motion arrives and stops.
3. **Entrances resolve focus.** Opacity, a 6px blur and a 12px rise move together. The element
   sharpens into place; it does not slide in.
4. **Nothing travels beyond 12px. Nothing scales beyond 2%.** Restraint reads as confidence.
5. **Values never jump.** A reading that *changes* glides to its new value on the same curve.

### Rule 5 is not a count-up

Rule 5 governs a **live reading moving to a new value** — `--dur-live`, `.m-tick`, `.m-live`,
`useLive`. A figure appearing for the **first time** appears at its true value.

A 0→100 ramp renders roughly sixty intermediate numbers the pipeline never observed. §3.2 forbids
displaying a football statistic that does not exist, and "it was only on screen for 40ms" is not an
exemption. Disclosure — the figure resolving into focus at its real value — never a ramp.

`useResolve` / `useResolveOnView` from the prototype are therefore **not** used for evidence
figures. They remain available for geometry that has no numeric reading (arc lengths, rail widths),
where there is no false value to display.

## Tokens

All scoped to `.rw-hero`. Nothing leaks to surfaces that have not adopted the scope.

| Token | Value | Use |
|---|---|---|
| `--ease-settle` | `cubic-bezier(0.16, 1, 0.3, 1)` | entrances, reveals, draws |
| `--ease-respond` | `cubic-bezier(0.28, 0.11, 0.32, 1)` | hover and state |
| `--ease-glide` | `cubic-bezier(0.33, 0, 0.15, 1)` | live values, continuous data |
| `--ease-exit` | `cubic-bezier(0.5, 0, 0.75, 0)` | things leaving, slightly quicker |
| `--dur-tap` | 180ms | press acknowledgement |
| `--dur-respond` | 520ms | hover, colour, small transforms |
| `--dur-expand` | 900ms | expansion, elevation |
| `--dur-reveal` | 1300ms | scroll entrances |
| `--dur-resolve` | 2400ms | arcs, beams — the slowest thing we do |
| `--dur-live` | 1100ms | a live value moving to its new reading |
| `--stagger` | 140ms | between siblings in a group |
| `--lead` | 220ms | before the first thing on the page moves |
| `--travel` | 12px | rule 4's ceiling |
| `--focus` | 6px | the blur an entrance resolves from |

### Colour tokens taken

`ink` `#0b0c0e`, `ink-2` `#4a4d55`, `canvas` `#f7f7f6`, `surface` `#ffffff`, `line` `#e7e6e3`,
`line-2` `#efeeec`, `accent` `#2a55e0`, `pos` `#16794a`.

### Colour tokens refused

- **`--color-ink-3: #82868f` — refused.** 3.40:1 on the canvas, below WCAG AA for body text.
  `--hero-ink-3` stays `#6b6f78` (4.70:1). The prototype uses it for labels and secondary
  readings, which is exactly where a contrast failure does the most damage.
- **`--color-live: #e0342a` — not adopted on this page.** The fixture header marks live state with
  `--hero-accent`. A dedicated live red is worth taking when a surface shows several live states at
  once; one status line does not need its own token.
- **The `@theme` block itself — refused.** It defines `--font-sans: Instrument Sans` and
  `--font-mono: JetBrains Mono` via a Google Fonts `@import`. Shipped type is wired through
  `next/font` (`--font-hero-sans`, `--font-hero-mono`); a runtime `@import` would add a
  render-blocking third-party request and reintroduce the layout shift `next/font` exists to
  prevent.

### Label size

The prototype's `.label` is 10px mono at `0.14em` tracking, uppercase. Shipped `.rw-label` keeps an
**11px floor** — uppercase mono at that tracking is the least legible combination on the page, and
10px was below what the shipped surfaces could carry. Every other property matches.

## Classes

`.reveal` is canonical for new surfaces; `.rw-reveal` is the name the hero already ships. They are
the **same rule**, not two implementations. Same for `.m-press` / `.rw-press`, `.m-live` /
`.rw-live`, `.m-fade` / `.rw-fade`.

| Class | Behaviour |
|---|---|
| `.reveal` + `.is-in` | rule 3 entrance, held until observed; `--i` drives stagger delay |
| `.rw-enter` | the same resolve, played on mount rather than on view |
| `.m-press` | −1px on hover, 0.992 scale on press |
| `.m-lift` | −3px on hover, for surfaces rather than actions |
| `.m-live` | geometry gliding to a new value |
| `.m-tick` | a live reading brightening back after it changes |
| `.m-breathe`, `.m-breathe-slow`, `.pulse-ring` | ambient; **hero stage only** |
| `.m-sweep`, `.m-scan` | ambient planes; **hero stage only** |

**Ambient motion does not belong on a research page.** Nothing on the fixture page moves unless the
reader scrolled it into view or pressed it.

## Type scale and rhythm

From `Today.tsx`.

| Role | Value |
|---|---|
| Section title | `.display` `clamp(2.2rem, 4.4vw, 3.4rem)` |
| Sub-section (the centre of a page) | `.display` `clamp(1.9rem, 3.4vw, 2.8rem)` |
| Lead figure | `.tnum` 22–26px, `tracking-[-0.03em]`, medium |
| Row title | 17px, medium, `tracking-[-0.025em]` |
| Body | 16px / `leading-8`, max 52–64ch |
| Secondary | 13px |
| Label | `.label`, 11px mono uppercase |
| Between groups | `mt-20` / `mt-24` |
| Between rows | `py-6` / `py-7` |
| Column gap | `gap-x-12` |

### The claim and its qualifier

A rate string such as `82% (9/11)` is one string doing two jobs. The percentage is the claim; the
denominator is what licenses it. Render them at **different weights** — display for the rate, label
for the sample — or a list of them reads as a spreadsheet.

Split the model's string; never rebuild it. The text on both sides of the parenthesis is what the
model produced, and re-deriving it would let the page and the archive disagree.

## Non-negotiable

- **`prefers-reduced-motion` removes everything.** A global kill-switch zeroes durations, and the
  scope additionally names every transform, sets `--travel`/`--focus` to `0`, and forces `.reveal`
  to its settled state. Neutralising duration alone leaves displacement behind.
- **Zero CLS.** Only `opacity`, `transform` and `filter` animate. No box property, ever. An element
  occupies its final height from the first frame, before its observer fires.
- **No figure, label or claim is taken from the prototype.** It is a visual reference. Every number
  on a shipped page comes from the pipeline.
