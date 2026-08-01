# RankWagers — Next Sprints

> Living document  
> Last Updated: 2026-07-25

---

# Current Objective

The core architecture is complete.

From this point forward, every feature must satisfy at least one of these goals:

- Increase affiliate CTR
- Increase FTD
- Increase SEO traffic
- Improve user trust
- Improve evidence quality

If a feature does not contribute to one of these goals, it should not be prioritized.

---

# Already shipped (foundation for these sprints)

These items from prior work already support Sprint 1–3 and should not be rebuilt:

| Area | Status | Notes |
|---|---|---|
| AnalyticsProvider + typed events | Done | Console + first-party file log; PostHog/GA4 adapters ready |
| `operator_impression` / `operator_click` / `go_redirect` | Done | Partner cards + `/go/[brand]` |
| Fixture / filter / search / pagination / live-signal events | Done | Homepage interaction layer |
| Developer CTR dashboard | Done | `/developer/analytics` — operators, fixtures, leagues, markets, countries, sections, funnel, scroll, time, exits |
| Partner ranking engine | Done | Extensible scoring; ready for country + CTR metrics |
| Odds history (append-only) | Done | Postgres migration; needs `ODDS_HISTORY_DATABASE_URL` |
| CLV service | Done | Architecture-only; no UI yet |
| Country detection (geo) | Partial | Used on `/go` and match detail; not yet driving homepage partner order |

---

# Sprint 1 — CTR Analytics (Highest Priority)

## Goal

Understand exactly how users interact with RankWagers.

## Features

- [x] Operator CTR Dashboard
- [x] Fixture CTR Dashboard
- [x] League CTR Dashboard
- [x] Market CTR Dashboard
- [x] Country CTR Dashboard
- [x] Homepage section analytics
- [x] Click funnel
- [x] Scroll depth
- [x] Time on fixture
- [x] Exit analytics

## Questions this sprint should answer

- Which operator gets the highest CTR?
- Which league converts best?
- Which markets attract the most clicks?
- Which homepage section performs best?
- Which fixtures generate affiliate revenue?

Expected Result:

Everything becomes measurable.

### Implementation notes (shipped)

- `/developer/analytics` → multi-tab `CtrAnalyticsDashboard` (`lib/analytics/ctrDashboard.ts`).
- Events: `homepage_section_*`, `scroll_depth`, `fixture_time_spent`, `page_exit` via `HomepageEngagementTracker` + fixture expand flush.
- CTR numerators use `operator_click`; `go_redirect` is a separate redirects column.
- Keep Console + File providers; do not hard-wire GA4 in app code.

---

# Sprint 2 — Country Personalization

## Goal

Show every visitor the most relevant operators.

## Features

- [x] Country detection
- [x] Dynamic partner ranking
- [x] Regional operator ordering
- [x] Country analytics
- [x] Localized homepage recommendations

Examples

Brazil → configured partners + Brasileirão / Libertadores  
Nigeria → 1xBet / Melbet stack + NPFL / CAF  
Japan → J League / Champions League featured set  

Override for QA: `?country=BR` (persists `rw_country` cookie).

Expected Result:

Higher CTR  
Higher EPC  
Higher FTD

### Implementation notes (shipped)

- Module: `lib/personalization/*` (resolver, cookies, geo, countries, ranking, homepage).
- Middleware sets `x-rw-country` / `x-rw-country-source` + cookies.
- `PartnerRankingService` scores `country_preference` + future CTR/EPC/FTD hooks.
- Analytics events include `country`, `country_source`, `resolved_country`.
- `/developer/analytics` Countries tab: sessions, CTR, top operator/league/market.

---

# Sprint 3 — Odds Intelligence

## Goal

Transform RankWagers into an odds intelligence platform.

## Features

- [x] Opening Odds
- [x] Current Odds
- [x] Closing Odds
- [x] Odds Timeline
- [x] Steam Detection
- [x] CLV Calculation
- [x] Movement Indicators
- [x] Odds Charts

Expected Result

Unique content.  
Better SEO.  
Higher authority.

### Implementation notes (shipped)

- APIs: `/api/odds-history`, `/api/odds-history/intelligence`
- Engine: timeline, movement thresholds, snapshot, comparison, chart series, CLV UI
- UI: `OddsIntelligencePanel` inside expanded fixtures
- Storage: Postgres when `ODDS_HISTORY_DATABASE_URL` is set, otherwise in-memory fallback
- Never fabricate missing history points — empty states when observations are absent
- Movement thresholds: `ODDS_MOVE_MINOR_PCT` / `MEDIUM` / `MAJOR` / `STEAM`

---

# Sprint 4 — Operator SEO

## Goal

Own branded operator searches.

## Features

- [x] /operators/{brand}
- [x] Operator reviews (legacy `/reviews/[brand]` kept; intelligence canonical at `/operators`)
- [x] Market coverage
- [x] Supported countries
- [x] Pros & Cons (factual highlights only — no promotional badges)
- [x] Best odds
- [x] Recent fixtures
- [x] Related operators

Expected Result

Long-tail SEO traffic.

### Implementation notes (shipped)

- Entity: `lib/operators/*` (registry over brands, availability, performance, schema, links)
- Routes: `/[locale]/operators`, `/[locale]/operators/[slug]`
- SEO: dynamic metadata, Organization/WebPage/BreadcrumbList JSON-LD, sitemap entries
- Odds performance reuses Sprint 3 history (empty when no observations)
- Country availability uses Sprint 2 `getRequestCountryContext`
- Analytics: `operator_page_view`, CTA / related / odds panel events

---

# Sprint 5 — League Intelligence

## Goal

Become the best statistics source for football leagues.

## Features

- [x] League overview (shipped as Competition Intelligence hubs)
- [x] Goal trends (research-queue aggregates; empty when unmatched)
- [x] BTTS trends (via related market links)
- [x] Over trends (via related market links)
- [ ] xG trends (full-season feed — future)
- [ ] Team rankings
- [ ] Home/Away analysis
- [x] League evidence (market breakdown + methodology links)

Pages

/competitions/premier-league  

/competitions/la-liga  

/competitions/serie-a

Expected Result

Authority building.

### Implementation notes (shipped as user Sprint 6)

- Entity: `lib/competitions/*` registry with aliases for fixture.league matching
- Routes: `/[locale]/competitions`, `/[locale]/competitions/[slug]`
- Integrates fixtures, markets, operators, odds, country personalization
- SEO: CollectionPage + SportsOrganization + BreadcrumbList + sitemap
- Analytics: `competition_*` events
- No predictions / fake rankings — empty states when no matched fixtures

---

# Sprint 6 — Market Intelligence

## Goal

Dominate informational betting searches.

## Features

- [x] Market explanations
- [x] Historical statistics
- [x] Upcoming opportunities
- [x] Best operators
- [x] Evidence summaries
- [x] Educational content

Pages

/markets/over-2-5  

/markets/btts  

/markets/draw-no-bet

Expected Result

High-volume organic traffic.

### Implementation notes (shipped as user Sprint 5)

- Entity: `lib/markets/*` registry (tracked + educational markets)
- Routes: `/[locale]/markets`, `/[locale]/markets/[slug]`
- Integrates Sprint 2 country, Sprint 3 odds, Sprint 4 operators
- SEO: metadata, WebPage, FAQPage, BreadcrumbList, sitemap
- Analytics: `market_page_view` and related interaction events
- No tips / fake confidence — empty states when data is absent

---

# Sprint 7 — Knowledge Graph ✅

## Goal

Connect every football entity together.

Implemented in `lib/knowledge-graph/` (UI-independent):

- Entity registry + relationship engine (`registry.ts`, `relationships.ts`, `graph.ts`)
- Graph navigation + recommendations (`navigation.ts`, `recommendations.ts`)
- SEO helpers + related ItemList schema (`seo.ts`, `schema.ts`)
- Wired into competition / market / operator detail pages via `GraphEntityPanel`
- Analytics: `entity_view`, `entity_navigation`, `related_click`, `graph_navigation`, `recommendation_click`

Entities

Country  
↓  
Competition  
↓  
Season (stub)  
↓  
Fixture (hub)  
↓  
Market  
↓  
Operator  
↓  
Evidence  
↓  
Odds  

Future-ready types (empty until registries exist): League, Team, Player, Venue

Features

- [x] Entity relationships
- [x] Internal linking
- [x] Context navigation
- [x] Related fixtures
- [x] Related markets
- [x] Related operators

Expected Result

Exceptional topical authority.

---

# Sprint 8 — Production Readiness & Launch ✅

## Goal

Prepare RankWagers for public launch (quality, not new product surface).

Implemented

- [x] Security headers + CSP (`lib/security/headers`, `next.config.js`)
- [x] Rate limiting on `/go`, `/api/analytics`, `/api/track`
- [x] Health endpoint `/api/health` + instrumentation logging
- [x] Loading / error / global-error / polished 404
- [x] Accessibility: single main landmark, reduced-motion, empty states
- [x] Performance: image formats, compress, dynamic OddsIntelligencePanel
- [x] SEO: sitemap index (`generateSitemaps`), robots blocks, structured-data validation
- [x] Deployment checklist: `docs/production-checklist.md`
- [x] Nginx example hardened (`deploy/nginx-site.conf.example`)

Expected Result

Production-ready platform.

---

# Sprint 9 — Team Intelligence Platform ✅

## Goal

Teams as first-class, indexable research entities on the shared knowledge graph.

Implemented

- [x] `lib/teams/*` entity model, resolver, registry, intelligence, SEO/schema
- [x] `/[locale]/teams` index + `/[locale]/teams/[slug]` detail pages
- [x] Evidence/fixture/competition/market/operator integrations (factual only)
- [x] Knowledge graph team nodes + GraphEntityPanel / EntityViewTracker
- [x] Sitemap shard `teams`, Header nav, analytics `team_*` events
- [x] Honest empty states for missing goal/xG enrichment
- [x] Tests in `tests/teams.test.ts`

Expected Result

Canonical team → competition → fixture → evidence → market → operator paths.

---

# Sprint 10 — Season Intelligence Platform ✅

## Goal

Seasons as the canonical time dimension on the knowledge graph.

Implemented

- [x] `lib/seasons/*` entity, registry, resolver, intelligence, SEO/schema
- [x] `/[locale]/seasons` index + `/[locale]/competitions/[slug]/seasons/[season]`
- [x] Competition pages link current/available seasons (no hardcoding)
- [x] Team/fixture/market/operator integrations (factual; no standings)
- [x] Knowledge graph season nodes (replaces stubs)
- [x] Sitemap shard `seasons`, Header nav, `season_*` analytics
- [x] Tests in `tests/seasons.test.ts`

Expected Result

Country → Competition → Season → Team → Fixture → Evidence → Market → Operator

---

# Sprint 11 — Data Quality & Entity Integrity ✅

## Goal

Platform-wide validation so public entities stay canonical, connected and evidence-backed.

Implemented

- [x] `lib/data-quality/*` validation engine (registry, relationships, resolvers, graph, SEO, sitemap, analytics, routes)
- [x] Integrity scorecard + coverage metrics (cached)
- [x] `/developer/data-quality` read-only dashboard with filters
- [x] `/api/data-quality` monitoring payload
- [x] Lightweight `assertPublicEntity` gate on team/season pages
- [x] Tests in `tests/dataQuality.test.ts`

Expected Result

Observably healthy entity graph before search/AI/player expansion.

---

# Sprint 12 — Global Search & Discovery Platform

## Features

- [x] Unified search module (`lib/search/*`)
- [x] Global entity index (integrity-gated registries only)
- [x] Query normalization + ranking engine
- [x] `/api/search` public API
- [x] Header + mobile autocomplete (`GlobalSearch`)
- [x] SSR `/[locale]/search` (noindex,follow)
- [x] Discovery panels (graph + analytics)
- [x] Country-aware operator filtering
- [x] Search analytics + `/developer/search`
- [x] Tests (`tests/search.test.ts`)

Expected Result

Search becomes the primary navigation layer for validated RankWagers entities.

---

# Sprint 13 — Discovery & Recommendation Platform

## Features

- [x] `lib/discovery/*` recommendation engine (graph + analytics)
- [x] Graph traversal with cycle prevention
- [x] Related entities + Continue Exploring
- [x] Popular Research (analytics-only)
- [x] Recently Viewed (localStorage / session fallback)
- [x] Country-aware operator recommendations
- [x] SSR discovery on competition / season / team / market / operator / search
- [x] `/api/discovery` + `/developer/discovery`
- [x] Discovery analytics events
- [x] Tests (`tests/discovery.test.ts`)

Expected Result

Every entity page leads users to other integrity-validated entities through explainable graph relationships.

> Note: former “User Features” (saved fixtures, watchlist, follow, notifications) moves to a later sprint.

---

# Sprint 14 — Evidence UX & Research Quality Platform

## Features

- [x] Shared `lib/evidence-ui` presentation layer
- [x] Canonical EvidenceCard + Evidence Strength
- [x] Sample quality / QualificationPanel / BaselineComparison / SplitCard
- [x] Evidence timeline + provenance (no odds)
- [x] Entity integrations (competition, season, team, market, fixture explorer)
- [x] `/developer/evidence` + diagnostics API
- [x] Evidence analytics events
- [x] Tests (`tests/evidenceUi.test.ts`)

Expected Result

Every evidence surface shares the same research language: sample size, coverage, strength, baseline, qualification, and source.

---

# Sprint 15 — Crawl Quality, Internal Linking & SEO Integrity Platform

## Features

- [x] Shared `lib/crawl-quality` validation layer (no live HTTP crawl)
- [x] Public route inventory (competition, season, team, market, operator, hubs, search)
- [x] Internal link / orphan / thin / canonical / hreflang / breadcrumb / schema / sitemap audits
- [x] Link optimizer helpers (`dedupeByHref`, `limitRepeatedLinks`, `balanceSurfaces`)
- [x] Crawl metrics + SEO regression suite (`tests/crawlQuality.test.ts`)
- [x] `/developer/crawl-quality` dashboard
- [x] `/api/crawl-quality` public scores only
- [x] Cached reports (dashboard/API only; public SSR unaffected)

Expected Result

Every public entity page is crawlable, internally linked, canonical, hreflang-valid, structured-data compliant, and sitemap-registered — without changing football intelligence architecture.

---

# Sprint 16 — Evidence Combo Studio

## Goal

Let users build evidence-supported multi-selection combinations and convert through honest operator availability states.

## Phases

### Phase A — Domain engine

- [x] Types, config, risk profiles, validation
- [x] Candidates, qualification, scoring, correlation, optimizer
- [x] Alternatives, replace/remove, serialization
- [x] Operator matching + availability + attribution stub
- [x] Tests (`tests/combo.test.ts`)

### Phase B — APIs

- [x] `POST /api/combo/generate|replace|remove|operators`
- [x] `GET /api/combo/diagnostics`
- [x] Public contracts, rate limits, safe `/go` paths
- [x] Tests (`tests/comboApi.test.ts`)

### Phase C — UI & conversion surface

- [x] Server prepare boundary (`lib/combo/prepare.ts`)
- [x] `/[locale]/combo` studio route (canonical, breadcrumbs, methodology, FAQ)
- [x] Studio form (supported markets only) + generate/replace/remove/alternatives
- [x] Evidence reasoning via Sprint 14 evidence UI
- [x] Operator cards (full / partial / unknown / unavailable)
- [x] Mobile sticky bar + operator sheet
- [x] Homepage launcher + nav link
- [x] Analytics hooks (`combo_*`)
- [x] Crawl inventory + sitemap for `/combo`
- [x] Docs (`docs/combo-ui.md`, engine/methodology/operator-matching)
- [x] Tests (`tests/comboUi.test.ts`)

### Phase D — Operator integration & attribution

- [x] Bookmaker / market / fixture mapping foundation (13 unverified shells, 0 provider IDs)
- [x] Server-side bounded per-bookmaker quotes in prepare path
- [x] Selection-level availability resolver (unknown until verified IDs)
- [x] Operator-specific combined odds (only when fully verifiable)
- [x] Deeplink registry + builder (homepage only; no invented betslip)
- [x] HMAC signed `/go` redirect context + attribution store
- [x] Postback adapter architecture (all not_configured)
- [x] Ranking refinement + public reason codes
- [x] Developer diagnostics (`/developer/combo`, `/developer/operators`)
- [x] Tests (`tests/operatorIntegration.test.ts`) + docs

### Still blocked before production

- Supply verified API-Football bookmaker IDs
- Operator deeplink documentation for market/fixture/betslip
- Hard country allowlists where required
- Partner postback credentials + specs
- Confirm real production domain + promote only after readiness gates

Expected Result

Users can configure, generate, inspect, mutate, and convert an evidence combo without fabricated availability or tips. Operator integration fails closed to unknown/homepage safely.

---

# Sprint 17 — Production Infrastructure

## Goal

Make RankWagers safe to run as a single-instance production service: real canonical host, durable attribution, honest health signals, and locked-down diagnostics.

## Phase A — Audit

- [x] Architecture / persistence / security audit (no code)

## Phase B — Config, persistence, protection

- [x] `lib/config/env.ts` — typed env, fail-fast staging/production
- [x] Remove `example.com` SITE_URL fallback (dev → localhost; prod missing → fail)
- [x] Migrations: `affiliate_clicks`, `affiliate_conversions`, `postback_events`
- [x] Persistent `AttributionStore` (Postgres + memory for tests)
- [x] Attribution write failure never blocks `/go` redirect
- [x] `/api/health` liveness + `/api/health/ready` readiness
- [x] Structured logger redaction + `MonitoringProvider` (console → Sentry later)
- [x] Diagnostics / `/developer/*` gated (flag → secret → optional IP → 404/403)
- [x] Keep memory rate limiter; preserve `RateLimiter` interface
- [x] Document single-instance assumption (`docs/deployment-assumptions.md`)

## Phase C — Reliability, observability & snapshot ops

- [x] Reliability audit refresh (`docs/reliability-audit-phase-c.md`)
- [x] Provider reliability layer (timeout / retry / circuit / health / quota)
- [x] Durable snapshots + atomic activation + LKG
- [x] Refresh jobs + Postgres advisory locks
- [x] Protected cron endpoints + cleanup
- [x] Operational metrics (memory) + protected `/api/internal/metrics`
- [x] Readiness refinement (active snapshot, providers, attribution mode)
- [x] Rate limiter production behavior (fail-open/closed policies)
- [x] Cache / ops docs + load script (`scripts/load-phase-c.mjs`)
- [x] Failure + reliability tests (`tests/sprint17Reliability.test.ts`)

## Phase D — Security, release engineering & staging readiness

- [x] Security/release audit (`docs/security-audit-phase-d.md`)
- [x] Typed feature flags (`lib/config/featureFlags.ts`)
- [x] Diagnostics/cron fail-closed + header-only secrets
- [x] Environment-aware CSP/HSTS (no preload by default; prod omits unsafe-eval)
- [x] Redirect secret rotation (active + previous)
- [x] Request body limits + content-type checks
- [x] Staging noindex + banner + robots disallow
- [x] CI workflow + security scan + route inventory
- [x] `scripts/validate-release.ts` gates (`validate:release:fast` green)
- [x] Staging smoke script (no real affiliate follows)
- [x] Docs: security, staging, CI/CD, rollback, budgets, launch checklist
- [x] App typecheck project (`tsconfig.typecheck.json`); production build verified
- [x] **No production deploy in Phase D**

## Phase E — Operational validation & launch readiness

- [x] Admin auth hardened (Bearer + HttpOnly session; no `?key=`)
- [x] Versioned release deploy + rollback scripts
- [x] Signed CTA producers via `buildGoPath`
- [x] Migration/restore/backup rehearsal tooling
- [x] Expanded smoke + Phase E tests
- [x] Launch checklist + production readiness report (**NOT READY**)
- [x] **No production deploy in Phase E**
- [ ] Live staging HTTPS deploy (ops)
- [ ] Live staging smoke sign-off (ops)
- [ ] Staging DB restore rehearsal measured (ops)
- [ ] Artifact rollback validated on server (ops)
- [ ] `FF_SIGNED_REDIRECT_REQUIRED=true` on staging after smoke (ops)
- [ ] Real production domain confirmation (ops)
- [ ] Manual production approval after READY decision

## Phase F (future)

- Production promote only after Phase E ops checkboxes clear
- Optional monitoring vendor evaluation (explicit decision)

---

# Success Metrics

SEO

- Organic traffic
- Indexed pages
- Average ranking
- Internal linking score

Affiliate

- CTR
- EPC
- FTD
- Revenue per session

User

- Session duration
- Pages per visit
- Bounce rate
- Returning visitors

Performance

- Lighthouse
- Core Web Vitals
- API latency

---

# Priority Order

P0

- CTR Analytics
- Country Personalization

P1

- Odds Intelligence
- Operator SEO

P2

- League Intelligence
- Market Intelligence

P3

- Knowledge Graph
- Discovery & Recommendation

P4

- Performance
- Global Search & Discovery
- User Features (later)

Future (post-roadmap, NOT STARTED)

- **AI Intelligence Layer** — evidence-first ranking, Bet of the Day, AI Acca, explainability, Why Not?, and transparent performance reporting. Must begin only after the current roadmap, M10 production activation, settlement history, accuracy/ROI dashboards, public prediction/Acca archives, and core SEO growth layers are complete. See `docs/plans/ai-intelligence-layer-roadmap.md`.

---

# Guiding Principle

Every new feature must answer at least one question:

- Does it increase trust?
- Does it increase SEO?
- Does it increase affiliate revenue?
- Does it make evidence more valuable?

If the answer is "no", it should not be implemented.
