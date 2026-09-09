# Bible V3 — the visual law of the v3 reskin

Status: authoritative for every v3 route. Supersedes the visual laws of the
ink-on-paper bible and `visual-language-specification.md`. The truth laws it
does **not** touch: direction, rate/sample pairing, window labeling, one clock,
kickoff freeze, empty-state omission, no fake precision, the signal engine, the
evidence/settlement line, the 30-locale dictionary and its registers, bundle
budgets, and DATA-AS-DOOR (no surprise redirects; a visible Continue on every
commercial link).

The approved mock is `design/v3/karakter.html` (unpacked under
`design/v3/unpacked/`). The mock is the visual truth; this document is the law.
Where they differ, this document wins; where it is silent, measure the mock.

## Positioning

Affiliate-first football predictions site. Every percentage is backed by the
verified record — a number without its sample does not render. Calm, dense,
product-like. Personality lives in details (icon strokes, empty-state
illustrations, microcopy), never in scale: nothing shouts, nothing is large.

## Tokens

| token        | value                  |
|--------------|------------------------|
| `--bg`       | `#161616`              |
| `--surface`  | `#1d1d1d`              |
| `--hover`    | `#242424`              |
| `--pctbg`    | `#242424`              |
| `--line`     | `#2a2a2a`              |
| `--text`     | `#ececec`              |
| `--muted`    | `#8c8c8c`              |
| `--accent`   | `#22c55e`              |
| `--accent-ink` | `#06170c`            |
| `--win`      | `#22c55e`              |
| `--loss`     | `rgba(214,69,69,.7)`   |
| radius       | `6px`                  |
| shadows      | none, ever             |

## Type

Inter only, via the existing font pipeline. Archivo is retired.

- 11px — labels, secondary, pills
- 12px — meta
- 13px — body (default)
- 14px — emphasis
- 16px — page titles
- **Hard cap 18px** — no computed font-size above 18px on any v3 route (probed)
- Uppercase section labels: 11px, weight 600, letter-spacing `.06em`
- Numerals: `font-variant-numeric: tabular-nums`

## Layout

- Desktop ≥1200: `224px` left rail · fluid center · `300px` right rail
- Table columns: `44 · 1fr · 112 · 88 · 42 · 44 · 72 · 104` (gap 12px)
- Row padding `17px 0`
- Pills: padding `1px 6px`, radius 6px
- ≥10 table rows above the fold at 1440×900

## CTA tiers

- **FILLED green** (`--accent` bg, `--accent-ink` text): curated only — editor
  band cards and the offer of the day. **Max 5 filled-green CTAs per page**
  (probed).
- **GHOST** (1px `--line` border, `--text`, arrow icon): table odds, rail
  Devam/Continue, secondary actions. Ghost fills green on hover.
- No separate "Play" column anywhere.

## Interaction law

- Every clickable surface: hover → `#242424` (`--hover`), 120ms.
- Ghost buttons fill `--accent` on hover (background, border-color, color —
  120ms).
- Pressed: one step darker (`#1d1d1d`), 60ms.
- Keyboard focus: `:focus-visible` 2px ring in `--text`, no transition.
- Only one row/surface highlighted at a time.

## Icon law

One family: the rw3 set — 24-unit grid, 1.5px single stroke, round caps/joins,
`currentColor`, rendered at 16/20px (smaller only inside pills/buttons per the
mock). Transcribed as a typed TS module + inline SVG sprite; no icon library.

Icons appear **only** where meaning-bearing:

- market pills (left of the label): over, under, btts, bttsNo, home, away,
  corner, h1, h2, dnb
- status labels: live, verified, locked, sponsored, best, editor, snapshot
- filter / sort / search controls
- the ghost-button arrow
- mobile bottom nav: navPred, navSites, navFree, navRecord
- action glyphs where the mock shows them: follow, external, close, drag

Probes: no icon outside the set renders on v3 routes; no icon on plain text
buttons.

## Motion law

Four movements, all under 250ms, ease-out. Motion explains a state change;
there is no decorative motion.

- **Form dots**: 200ms total — per-dot 120ms `opacity 0→1`,
  `translateX(-4px)→0`, `cubic-bezier(.2,.7,.2,1)`, 20ms stagger L→R. Trigger:
  row enters viewport, once.
- **Verified pct lock tick**: 240ms, tick path drawn via `stroke-dashoffset`
  (dasharray 14), ease-out, color `--win`. Ring static; only the tick animates.
  Trigger: hit-rate card load, once. The number never animates.
- **Hover**: 120ms background/border-color/color; pressed 60ms.
- **Editor band cards**: per-card 160ms `opacity 0→1`, `translateY(4px)→0`,
  ease-out, 60ms stagger (≤180ms until last card starts). Trigger: page load.
- Table rows never animate. Numbers/counters never animate.
- `prefers-reduced-motion: reduce` → `animation: none; transition: none;` show
  the final frame (probed).

## Empty-state law

A section with nothing to say renders its illustration + one line of microcopy
— never a placeholder table, never a spinner, never fake rows. The five
illustrations (SVG, 120×90, single stroke `--muted` 1.5px, exactly one
`--accent` detail):

1. no matches today
2. no offers in your country
3. no snapshot yet
4. editor picks empty → band auto-fills from the engine
5. 404

Microcopy lives in the dictionary — EN-first authored, registered across all
30 locales per the accaStrings pattern. Counts and times inside microcopy come
from real data or are omitted (no fake precision).

## No truncation

Offers, editor sentences, and team names wrap to at most 2 lines. Ellipsis
(`text-overflow: ellipsis`, `…` truncation) is **banned** on v3 routes
(probed). Where the mock shows ellipsis, the mock is wrong and this law wins.

## Compliance

- Every commercial element carries "Sponsored · 18+" (localized).
- The footer carries the commission sentence: offers are sponsored; commission
  never affects predictions.
- The offer of the day appears exactly once per page (probed).
- Vocabulary: "tips", "free bets", "bonuses", "offers" are allowed. TIP_DEBT
  machinery is retired (see the DECIDED note where it lived). Claim-integrity
  and label scans remain in force.

## Budgets

Homepage ≤155 kB first-load JS. Icons are inline (module + sprite) — no icon
library dependency. Illustrations are inline SVG components.
