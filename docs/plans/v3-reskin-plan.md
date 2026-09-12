# V3 reskin — the block map

Status: authoritative scope for the `feat/v3-reskin` branch. The visual law is
`docs/design/bible-v3.md`; the measured truth is `design/v3/karakter.html`
(unpacked under `design/v3/unpacked/`). Where the mock and the bible differ,
the bible wins; where either is silent about a fact's source, the truth laws
win (a number without its registry- or archive-backed source does not render).

**THE NO-DEPLOY RULE.** This branch does not deploy until every reader-facing
family speaks v3 — homepage, fixture, free bets, all list families, archive,
search, 404s, and the Acca chrome. Interior pages may render v2 inside the v3
shell only *while the branch is in progress*; a mixed page is a branch state,
never a release state. The final block (I) closes with a probe: zero legacy
tokens/classes (`--hero-*`, `rw-hero`, `rw-m`, `rw-h`, `rw-display`, …) on
all reader routes.

Verification bar for every block: full gate (`npm test`) true green,
typecheck and lint clean, and the touched routes rendered on `:3100`
(`npm run dev:3100`). One commit per block.

## Done

| Block | Commit | Scope |
|-------|-----------|-------|
| A | `21b1b43` | The rw3 scope: tokens, one icon family (typed module + sprite), motion law, the five illustrations transcribed, design probes (18px cap, ellipsis ban, icon-set-only, reduced motion, filled-CTA register). |
| B | `1a06e46` | The shell: HeaderV3 / FooterV3 / MobileTabsV3, both rails with real-source builders, three placements, the v3 string family born across all 30 locales (birth gate). |
| C | `147863e` | The homepage center: live strip, editor band (engine auto-fill), day tabs with real counts, market filter, rate/time sort, the prediction table (one row per fixture, venue rate/sample pair, honest odds omission). Sitemap index relocated to `/sitemap-index.xml` behind a middleware rewrite (Next 14.2 dev catch-all conflict — see `tests/sitemapIndex.test.ts`). |
| D′ | `57a7c9a` | The match page converted in place (five levels keep their laws; mock frame `1fr · 300px` with the per-market aside and the `offer_of_the_day_fixture` slot) and `/operators` reskinned as an offers surface. Four keys born; family pin 59. |
| E | `c830fd3` | Empty states: no-snapshot wired into the model's view (real capture-window time), both 404s on the fifth illustration; probes for the frame (120×90, one accent detail, never a placeholder table). |

D′ is a partial of the original Block D: the admin/featured picks manager was
not built in session 1 (the band auto-fills only), and free bets landed on
`/operators` rather than its own page. Blocks F and G below settle both.

## Remaining

### F — Admin/featured: the editor picks manager (the original Block D)

The admin surface that feeds the homepage editor band ahead of the engine:

- Pick fixtures from the current boards — search and filter.
- Drag-order (the band renders admin order; `drag` icon from the rw3 set).
- The editor sentence: ≤110 chars with a live counter — the card's one claim.
- Optional long note → renders as the "editor note" block under L1 on that
  fixture's page (the `rw3-match` mock's Editör notu).
- Pinned operator for the offer-of-the-day slot (already accepted by
  `buildOfferOfTheDay(pinnedSlug)`).
- Start/end window per pick; outside it the pick is invisible to readers.
- Live band preview (the real EditorBand component, admin's picks in).
- Compliance-check panel: banned-claim scan of the sentence/note before save.
- Empty admin selection → the reader band auto-fills from the engine (the
  already-shipped behavior); the admin surface — and only the admin surface —
  shows the editor-empty illustration with its microcopy.
- Storage consistent with existing admin patterns; any new commercial
  surface registered in `lib/affiliate-intelligence/placements.ts`.

### G — Free bets as its own page

Per the approved design (page 6, `rw3-freebets`): `/free-bets` with the offer
card grid — operator · offer · terms summary · Sponsored·18+ · ghost
Continue; FILLED only on the one Best card — and a country filter driven by
availability. The nav's "Free Bets" door points here; `/operators` returns to
its sites-page role (ordering disclosure + operator intelligence rows).
Only registry-backed attributes render: no offer types, no expiries, no
invented terms.

### H — List families to v3

Restyle in place, keeping every existing truth probe:

- `markets` (+ `[slug]`)
- `competitions` (+ `[slug]`, + seasons) — the league page adds compact
  standings and the league market-rates table per the design.
- `teams` (+ `[slug]`) — the team page adds the scored form strip and H2H.
- `countries` (+ `[code]`)
- `archive` (+ `[date]`) — ZERO commercial: no sites rail, no offer slots;
  adds the period picker.
- `search`

## Fixture v3.1 — the approved match-page design

Source: `design/v3/match-v31.pdf` — a MOCK, adapted to real data, never
cloned. All standing laws hold: the five-layer law, the truth laws,
DATA-AS-DOOR, dictionary births ×30, the fixtures bundle ceiling (≤140 kB),
and the DECIDED no-standings rule (the mock's rank/points/round fields are
OMITTED — no provider standings source exists). The settlement/evidence
truth surfaces (research table, record, timeline, evidence history) are
retained below the five layers, untouched in law.

Blocks, one commit each:

| Block | Scope |
|-------|-------|
| V1 | Layer 1 — header (32px crests, names, league · kickoff · venue, last-5 form chips from real results) + the VERDICT (the page's ONE >18px number, 32–36px, probe-pinned; market pill · scope · sample; ±pp-vs-league chip, green only when direction favors the claim; the 5-segment SAMPLE STRENGTH bar — tiers <5:1, 5–9:2, 10–14:3, 15–24:4, 25+:5, never called "confidence"; provenance line; lead sentence + editor note) + "Play this market" (availability-first, verified-first, one Best badge, ghost odds, sponsored no-number fallback, odds-as-of line) + right-rail other-markets/offer. All v3.1 dictionary births land here (one locale pass). |
| V2 | Layer 2 — evidence rows (rank · sentence · icon+scope · 14px pct · deviation bar with league-average marker · ±pp chip · form dots where FT scores can answer); sorted by the engine's weighted score; rows beyond three collapse under "N more signals ▾" (chips), expanding inline via `<details>` — no navigation, no JS. Unmeasured / n<5 never appear here. |
| V3 | Layer 3 — head-to-head (only at ≥3 meetings): W/D/L share bar (data-semantic green/gray/red), market rates over the available window with samples and the "last N meetings · years" label, last-5 result cards; n<5 muted + small sample. MODEL VIEW: 2–4 sentences from a TEMPLATE REGISTRY — each template names its computed inputs and is omitted whole when any input is missing; no ranking claim without a computed rank (none is, so none claims); ends with the lock line + See the record. |
| V4 | Layer 4 — team comparison: two cards (form chips overall/home/away + points-per-match derived from real fixtures; stats table with samples; paired horizontal bars for the key stats). Missing stat → row omitted, never 0. No standings fields. |
| V5 | Layer 5 — operators × markets matrix (logo chip · name · one Best; ghost observed prices; the market's TOP price outlined — the mock outlines the highest and decimal odds' best IS the highest, deviating deliberately from the instruction's "min"; "—" muted for no observation; ghost Continue per row) + mobile composition (verdict first, play-panel under it, compact evidence, H2H scroll, stacked comparison, per-market accordion) + the probe sweep + bundle ceiling check. |

DECIDED — best price = HIGHEST decimal. The instruction's probe line says
"min over observed prices", but the approved mock outlines the highest
price in every column and the repo's standing best-price law
(`bestPriceForRow`) has always taken the highest decimal — the punter's
best. Implemented as max; flagged in the session report.

### I — Acca chrome to v3, and the legacy-token close-out

Studio, builder and panel chrome to the rw3 language; clear the residual
`--hero-*` usages; then the closing probe — zero legacy tokens/classes on
every reader route — turns the no-deploy rule into a test.

DECIDED — the retired v2 corpus stays in-tree, unreachable. The dead v2
home and its organs (RankWagersHome, the hero stage, the live desk,
BibleFixtureExplorer/OperatorStrip, the old Header/Footer/SiteTopChrome/
WorldCupTickerBar) are pinned by ~30 suites that document their laws;
deleting them means demolishing that recorded history for no reader-facing
gain. Instead the close-out probe walks the REAL import graph from
`app/[locale]` and the root 404: every reachable source must be free of
the v2 language, and the corpus is asserted unreachable by name — the day
something imports it back onto a route, the probe fails on that file.
Removing the corpus (and its suites) wholesale is future housekeeping,
deliberately out of this branch's scope.
