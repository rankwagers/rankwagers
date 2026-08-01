# Sprint 18B Completion Report — Match Detail Platform & Live Match Intelligence

**Date:** 2026-07-25  
**Status:** COMPLETE — awaiting approval  
**Next:** Do not start Sprint 18C until approved  
**Confirmation:** No Sprint 18C+ product functionality was implemented (no homepage narrative rewrite, no Acca Studio, no PSEO expansion, no deploy).

---

## Implemented items

### Route & contracts
- Canonical localized route: `/{locale}/fixtures/{matchId}`
- Stable numeric `matchId` resolution via `parseFixtureMatchId`; invalid → `notFound()`
- Market context via `?market=` + source attribution via `?source=`
- Server loader: `lib/fixtures/loadMatchPage.server.ts` (`server-only`)
- Typed models: `lib/fixtures/types.ts` (`MatchPageModel`, lifecycle + settlement enums)
- Path helpers: `lib/fixtures/paths.ts`, market code map: `lib/fixtures/marketCodes.ts`

### Match header & states
- Competition, country, teams, logos, kickoff, venue, status label, minute (live/HT only), HT/FT scores
- Lifecycle: scheduled, pre_match, live, half_time, finished, postponed, cancelled, abandoned, suspended, unavailable
- No fake live when provider status is empty after kickoff
- Breadcrumbs + links to competition/team when registry matches

### Live intelligence (provider-gated)
- Score, clock, goal & red-card events, HT/FT
- Stats when present: possession, shots, shots on target, xG, corners, cards, dangerous attacks
- Explicit empty / unavailable / message states (no SofaScore clone features)

### Predictions & settlement
- Published markets when potentials &gt; 0: `over15`, `over25`, `fh`, `sh`, `btts`
- Statuses: pending / won / lost / void / push / cancelled
- Unit P/L when odds observed and won/lost
- Timeline: observation → odds snapshot → kickoff → settlement
- Server-authoritative `settlePrediction` (`lib/fixtures/settlement.ts`)
- Methodology: `docs/prediction-settlement-methodology.md`

### Affiliate
- Contextual signed offers in aside; signing only in server loader
- Editorial vs commercial copy separated

### SEO
- Unique title/description via `pageMetadata`
- Canonical + hreflang + OG/Twitter
- `index` only when `indexable` (teams + kickoff + ≥1 prediction + usable lifecycle)
- BreadcrumbList + SportsEvent JSON-LD when valid

### Wiring
- Explorer “Open match page”
- Saved → `/fixtures/{id}?market=&source=saved`
- Highest confidence / search → canonical fixture paths
- Soft live refresh 60s only for live/HT

### Analytics
- `match_detail_viewed`, `match_prediction_expanded`, `match_evidence_viewed`, `match_detail_retry`, `match_related_click`

### A11y / responsive
- Semantic headings, score `aria-label`, breadcrumb nav, expandable predictions, focus-visible CTAs
- Desktop two-column; mobile compact score header

---

## Deferred items (exact reasons)

| Item | Reason |
|------|--------|
| Immutable append-only prediction archive | No durable store yet; page-build observation only → **18G** |
| Publish match_winner / double_chance / draw_no_bet | Settlement helpers ready; no durable selection snapshot |
| Corners / cards / AH / correct score / player props settlement | Provider contracts unsafe (`DEFERRED_SETTLEMENT_MARKETS`) |
| Heatmaps, pass maps, ratings, touch maps, throw-ins | Explicitly out of scope (low decision value / unsupported) |
| Full Acca Studio / Add-to-Acca UX | **18E** |
| Homepage trust narrative / performance boards | **18C** |
| Global search + PSEO thin-page program | **18D** |
| Sitemap enumeration of all fixtures | Demand-loaded dynamic pages; avoid thin shells |

---

## Supported match states

`scheduled` · `pre_match` · `live` · `half_time` · `finished` · `postponed` · `cancelled` · `abandoned` · `suspended` · `unavailable`

## Supported statistics (when provider fields exist)

Possession % · Total shots · Shots on target · xG · Corners · Cards · Dangerous attacks

## Supported prediction markets (published)

`over15` · `over25` · `fh` · `sh` · `btts`

Helpers only (unpublished): `match_winner` · `double_chance` · `draw_no_bet`

## Settlement rules implemented

See `docs/prediction-settlement-methodology.md`. Summary:

- Over 1.5 / 2.5 from FT totals  
- BTTS from FT scoring both sides  
- FH from HT totals (can settle at HT/live when HT known)  
- SH from FT−HT (requires HT)  
- Postponed → void; cancelled/abandoned → cancelled; missing scores → void; DNB draw → push  

---

## Routes and contracts added

| Path / module | Role |
|---------------|------|
| `app/[locale]/fixtures/[matchId]/page.tsx` | Match page + metadata |
| `components/fixtures/*` | Presentation, tracker, soft refresh |
| `lib/fixtures/*` | Domain, settlement, SEO schema, analytics, loader |
| `lib/footystats/matchDetail.ts` | `getMatchLiveContext` |
| `docs/prediction-settlement-methodology.md` | Settlement methodology |

---

## Tests added / updated

- `tests/sprint18bMatchDetail.test.ts` (paths, lifecycle, settlement, SEO/CTA boundaries, analytics, wiring)
- Updated: `tests/sprint18aIntegrity.test.ts`, `tests/homepageInteractions.test.ts`

---

## Validation gates

| Gate | Result |
|------|--------|
| 1. `npm test` | **PASS** — 269/269 |
| 2. `npm run build` | **PASS** — includes `/[locale]/fixtures/[matchId]` |
| 3. `npm run lint` | **PASS** |
| 4. `npm run typecheck` | **PASS** |
| 5. `npm run security:scan` | **PASS** — `{"ok":true,"scanned":556}` |
| 6. `npm run scan:cta-boundary` | **PASS** — no findings |
| 7. SEO/schema | BreadcrumbList + SportsEvent helpers + `pageMetadata` covered by unit/source tests |
| 8–10. Docs / backlog / matrix / completion report | Updated |

---

## Known limitations

1. Publication “snapshot” = observation at page build, not an immutable DB archive.  
2. Original and current odds may be identical when both are observed at the same fetch.  
3. Live events/stats depend entirely on FootyStats field availability.  
4. Match pages are demand-rendered (`force-dynamic`); not bulk-sitemapped.  
5. 1X2 / DC / DNB not shown as published predictions yet.

---

## Confirmation: no Sprint 18C+ work

- No homepage VP/trust rewrite (18C)  
- No global/PSEO program (18D)  
- No Acca Studio (18E)  
- No design-token / Flutter UI sprint (18F)  
- No durable trust archive (18G)  
- No staging/deploy (19)  
- No Flutter application code  

**Stop here — wait for Sprint 18B approval before Sprint 18C.**
