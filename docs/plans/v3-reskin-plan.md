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

### I — Acca chrome to v3, and the legacy-token close-out

Studio, builder and panel chrome to the rw3 language; clear the residual
`--hero-*` usages; then the closing probe — zero legacy tokens/classes on
every reader route — turns the no-deploy rule into a test.
