# RankWagers — Product Sprint Plan (authoritative)

**Updated:** 2026-07-25 (Sprint 18A complete + future roadmap expansion)  
**Process:** Strict sprint-by-sprint. No skipping. No future-sprint work in earlier sprints.  
**Each sprint DoD:** full tests · build · lint · typecheck · security scan · docs + backlog update · completion report · **wait for approval** before next sprint.

**Non-goals until Sprint 19:** staging ops, deployment, PM2/nginx/TLS/DNS, real server migrations.  
**Non-goals in Sprint 18:** Flutter app code, fabricated performance claims, SofaScore/Flashscore clones.

Basis: `docs/product-completion-audit.md`, `product-completion-matrix.md`, `product-gap-backlog.md`, `.agents/product-marketing.md`.

---

## Product positioning

| Platform | Answers |
|----------|---------|
| Flashscore | What is happening? |
| SofaScore | How is the match being played? |
| **RankWagers** | What does the available evidence mean for a **betting decision**, how has that decision performed historically, and how can the user turn it into a **transparent Acca**? |

RankWagers is a **differentiated football betting decision-support platform** — not a fixture list, live-score clone, bookmaker directory, or generic tipster site.

It combines: live score **context** · focused betting statistics · explainable predictions · verified historical performance · Acca creation · odds/bookmaker discovery · secure affiliate handoff · strong SEO discovery.

### Primary product goals

1. Distinctive, high-trust product  
2. Maximize organic search visibility  
3. Increase qualified traffic and engagement  
4. Keep users inside the product longer  
5. Turn analysis into a natural Acca → affiliate conversion journey  
6. Preserve clean architecture that can later support Flutter  
7. Avoid feature-for-feature SofaScore/Flashscore copying  
8. Show only match data that supports betting decisions, prediction verification, trust, retention, SEO, and conversion  

### Preferred conversion journey

```
Traffic → landing page → fixture/prediction → evidence & trust
  → live/final verification → Add to Acca → bookmaker compare → secure /go handoff
```

---

## Process rules

1. Implement only the **current approved sprint**.  
2. Treat every sprint as a **production-quality, releasable** milestone.  
3. After each sprint checklist, **stop** and wait for approval.  
4. Do not merge later-sprint scope into earlier sprints.  
5. Infrastructure readiness ≠ product completion.  
6. CTA signing stays **server-only**; never expose partner secrets to the browser.  
7. No fabricated odds, bookmaker coverage, or performance claims.  

### Per-sprint completion checklist

1. Run full tests  
2. Run build  
3. Run lint  
4. Run typecheck  
5. Run security scan  
6. Update documentation  
7. Update backlog  
8. Produce a completion report  
9. Wait for approval before the next sprint  

---

## Scope layers (how to read this plan)

| Layer | Meaning |
|-------|---------|
| **Committed Sprint 18** | In-scope for the named sprint when approved; implement only after approval |
| **Later enhancements** | Valuable follow-ons inside the same product area after the committed sprint lands |
| **Post-launch opportunities** | After Sprint 19 / production evidence; not blocking 18B–18G |
| **Flutter-readiness** | Architectural constraints from 18B onward — **no Flutter code in Sprint 18** |

---

## Roadmap status

| Sprint | Name | Status |
|--------|------|--------|
| **18A** | Product Integrity & Navigation | **COMPLETE** — `docs/sprint-18a-completion-report.md` |
| **18B** | Match Detail & Live Match Intelligence | **COMPLETE** — `docs/sprint-18b-completion-report.md` |
| **18C** | Homepage Experience & Trust | **COMPLETE** — `docs/sprint-18c-completion-report.md` |
| **18D** | Search, Discovery & Programmatic SEO | **COMPLETE** — `docs/sprint-18d-completion-report.md` |
| **18E** | Acca Studio (flagship) | **COMPLETE** — `docs/sprint-18e-completion-report.md` |
| **18F** | Design, Mobile, A11y & Cross-Platform Readiness | **COMPLETE** — `docs/sprint-18f-completion-report.md` |
| **18G** | Transparency, Verification, Archive & Product Credibility | **COMPLETE** — `docs/sprint-18g-completion-report.md` |
| **19** | Production Readiness, Performance, Security & Launch Hardening | **COMPLETE** — `docs/sprint-19-completion-report.md` |
| **20** | Production Launch, Operations & Post-Launch Verification | **COMPLETE (ops package)** — live promote blocked; `docs/sprint-20-completion-report.md` |

---

## Sprint 18A — Product Integrity & Navigation (COMPLETE)

**Goal:** Primary routes and navigation are trustworthy; conversion hubs are reachable; dead homepage controls are fixed or removed.

**Committed scope (done)**

- P0-01 `/best-betting-sites` → `variant="betting"` + correct metadata  
- P0-02 Saved: persist + list UI  
- P0-03 Highest confidence Inspect deep-opens fixture  
- P0-05 Match-detail fetch error + retry (expander only)  
- P0-06 / P1-01 Grouped nav + bookmaker hubs  
- P1-02 Homepage search deep-open hrefs  
- P1-04 Homepage date control `?date=`  
- P1-05 Homepage heading `id`s  
- P1-14 Availability page Design Bible restyle  
- P1-18 Trending markets apply market filter  

**Explicitly excluded from 18A (correctly not built)**

- Shareable match detail route / live intelligence → **18B**  
- Homepage narrative / trust performance surfaces → **18C**  
- Global search / programmatic SEO → **18D**  
- Acca Studio flagship → **18E**  
- Design system / Flutter readiness tokens → **18F**  
- SEO/trust archive & transparency → **18G**  
- Staging/deploy → **19**  

---

## Sprint 18B — Match Detail & Live Match Intelligence (COMPLETE)

**Status:** COMPLETE — `docs/sprint-18b-completion-report.md` · Settlement: `docs/prediction-settlement-methodology.md`

### Committed Sprint 18 scope (done)

- Permanent, shareable, SEO-friendly match URL (`/{locale}/fixtures/{matchId}`)  
- Match states: scheduled, pre-match, live, half-time, finished, postponed, cancelled, abandoned, suspended, unavailable  
- Live score, match clock/status when provider data is trustworthy (no fake live)  
- Goal events; red-card events; HT/FT score  
- Key match events where data quality permits  
- **Betting-relevant stats only** (when reliable): possession, shots, shots on target, xG, corners, cards, dangerous attacks  
- Explicitly **avoided**: throw-ins, pass maps, heatmaps, fabricated events  
- Prediction observation timestamp; odds at build; confidence; settlement statuses  
- Server-authoritative settlement for over15 / over25 / fh / sh / btts (+ helpers for 1X2/DC/DNB unpublished)  
- Prediction timeline: observed → odds → kickoff → settlement  
- Structured data (BreadcrumbList + SportsEvent when valid), canonical, metadata via `pageMetadata`  
- Soft 60s refresh only for live/HT  

### Deferred from committed “immutable archive” wording

- Append-only durable prediction archive + correction audit → **Sprint 18G** (page-build observation ships in 18B)  
- Publishing match_winner / double_chance / draw_no_bet selections → after durable selection snapshots  

### Later enhancements (after 18B committed land)

- Richer event taxonomy; optional commentary snippets  
- Multi-market settlement panels on one match  
- Push-ready match status event hooks (taxonomy only until mobile)  

### Post-launch opportunities

- Advanced live widgets; partner bet-slip deep injection where contracts allow  

### Flutter-readiness (architecture from 18B — no Flutter code)

- Domain settlement + `MatchPageModel` contracts reusable by a future API  
- Stable matchId deep links  
- No critical settlement math only in React components  

### Explicitly excluded from 18B (correctly not built)

- Homepage narrative / trust performance → **18C**  
- Global search / programmatic SEO expansion → **18D**  
- Acca Studio flagship → **18E**  
- Design-system / Flutter tokens polish → **18F**  
- Trust archive & transparency store → **18G**  
- Staging/deploy → **19**  

---

## Sprint 18C — Homepage Experience & Trust (COMPLETE)

**Status:** COMPLETE — `docs/sprint-18c-completion-report.md`

### Committed Sprint 18 scope (done)

- Clear value proposition (dict-driven hero)  
- Today’s strongest betting signals (top picks → match pages)  
- Live matches and live prediction states (`LiveFeedPanel`; provider-only)  
- Thin Acca / Evidence Combo entry (not Acca Studio)  
- Verified performance from daily list archives (honest hit rate; no fabricated ROI)  
- Recent results with W/L/void/pending transparency  
- Methodology + why-trust narrative without guaranteed-win claims  
- Internal links: match pages, leagues, markets, teams, operators, archive entry anchors  
- Country-aware editorial operator cards (banner promos removed)  
- Mobile-first section hierarchy; hero search entry  
- Footer explore + trust/legal link groups  

### Explicitly excluded from 18C (correctly not built)

- Search redesign / PSEO / country landings → **18D**  
- Acca Studio flagship → **18E**  
- Full prediction archive pages → **18G** / 18D  
- Design-system / Flutter tokens polish → **18F**  
- Staging/deploy → **19**  

### Later enhancements

- Editorial “insight of the day”; personalized signal ranking  

### Post-launch opportunities

- Homepage A/B tests; RichAds landing variants measurable via experiments  

---

## Sprint 18D — Search, Discovery & Programmatic SEO (COMPLETE)

**Status:** COMPLETE — `docs/sprint-18d-completion-report.md` · Search: `docs/search-discovery.md` · SEO: `docs/seo-discovery.md`

### Committed Sprint 18 scope (done)

- Global search extended: competitions, seasons, teams, fixtures (archive window), markets, operators, countries  
- Fuzzy / typo-tolerance tier after exact/prefix/contains  
- Recent searches in GlobalSearch empty state; grouped results + highlight + keyboard nav  
- Deep links to entity + fixture + country hubs  
- URL-preserved `/search?q=&type=&country=` remains **noindex**  
- Quality-gated country landing foundation (`/countries`, `/countries/[code]`) — no doorway mass generation  
- Indexability policy helper (`lib/seo/indexability.ts`)  
- Graph contracts + country paths → `/countries/{code}`  
- Stronger internal links (competition/team → country; footer/sitemap countries shard)  
- Crawl-quality inventory/schema/breadcrumb/sitemap updated for countries  

### Deferred from committed wording

- Full searchable prediction archive → **18G** (homepage entry already exists)  
- Voice/query intent ranking; saved search alerts → later  
- Mass PSEO page factory → explicitly avoided  

### Explicitly excluded from 18D

- Acca Studio → **18E**  
- Transparency dashboard / archive IA → **18G**  
- Flutter app / deploy → **18F/19**  

### Later enhancements

- Voice/query intent ranking; saved search alerts  

### Post-launch opportunities

- Search Console–driven content expansion; crawl-budget automation  

---

## Sprint 18E — Acca Studio (flagship) (COMPLETE)

**Status:** COMPLETE — `docs/sprint-18e-completion-report.md` · Architecture: `docs/acca-studio.md`

**Core journey:** Build → Analyze → Compare → Save → Share → Place  

### Committed Sprint 18 scope (done)

- Global Acca state across the site (`lib/acca/*` + `AccaWorkspace`)  
- Add to Acca from: homepage top picks, fixture explorer, match detail, competition/team pages; search deep-links to match pages for add  
- Desktop Acca panel; mobile bottom sheet  
- Persistent local storage; safe hydration/restoration; undo; clear all  
- Duplicate-fixture handling; unsupported-market rejection  
- Markets: settlement-backed allowlist only (over15/25, BTTS, FH/SH, match winner when published)  
- Combined decimal odds; stake; potential return/profit (currency-neutral units)  
- Explainable risk classification with limitations  
- Operator compare + affiliate CTA via **secure server-generated** redirect (`acca_studio`)  
- Copy as text; Telegram-friendly export; shareable **noindex** URL; named saved Accas  
- Analytics: `acca_*` events (add/remove/open/clear/stake/share/handoff)  
- No client-side signing; no fake “bet placed”; no bet-slip injection  

### Deferred from committed wording

- Direct add-from search result rows (fixtures open match page → add there)  
- Live bet-slip injection / bookmaker confirmation — not supported by partners  
- Indexed public Acca pages / OG image cards → later  

### Later enhancements / future-capable (not required to ship 18E)

- Public shared Accas; trending/curated daily Accas  
- Safe / balanced / value / high-odds presets  
- Deterministic evidence-based assisted Acca generation (user-editable)  
- Community/editorial layers; Acca image/social cards  
- Performance tracking for historical public Accas  

### Flutter-readiness

- Acca rules UI-independent in `lib/acca/`  
- Acca IDs stable; anonymous local-first with named saves for future sync  

---

## Sprint 18F — Design, Mobile, Accessibility & Cross-Platform Readiness (COMPLETE)

**Status:** COMPLETE — `docs/sprint-18f-completion-report.md` · Design: `docs/design-system.md` · A11y: `docs/accessibility.md`

### Committed Sprint 18 scope (done)

- Consolidated design tokens (spacing, radius, elevation, status, risk, live, motion) in `globals.css` + Tailwind var wiring  
- Shared UI: BottomSheet, InlineAlert, StatusBadge tones, EmptyState/PageSkeleton polish  
- Acca / Combo sheets + MobileNav: focus trap, Escape, restore focus, layered surfaces  
- GlobalSearch: focus-visible, aria-live results, wider header field  
- Filter chips: horizontal snap scroll + touch targets (320px)  
- Fixture card density + Acca risk tone badges + actionable API error copy  
- Reduced-motion covers enter animations + decorative shine/pulse  
- Future dark theme token slots documented (not activated)  
- Flutter-mappable token names in `lib/ui/tokens.ts`  

### Deferred

- Full dark-mode toggle / advanced motion language  
- Importing design-kit shadcn wholesale  
- Live Signals full visual rewrite  

### Flutter-readiness

- Token + component mapping docs for mobile parity  
- No Flutter package introduced in Sprint 18  

---

## Sprint 18G — Transparency, Verification, Archive & Product Credibility (COMPLETE)

**Status:** COMPLETE — `docs/sprint-18g-completion-report.md` · Architecture: `docs/transparency.md`, `docs/methodology.md`

### Prediction transparency (done)

- Durable daily archives projected into `ArchivePredictionRecord`  
- Publication proxy, kickoff, market, selection, confidence, evidence summary, score, settlement reason, void/pending  
- Original odds / unit P/L explicitly unavailable until odds log exists (never fabricated)  
- Losses always included; hit rate = settled W+L only  

### Performance surfaces (done)

- `/archive` hub + `/archive/{date}` daily pages  
- Filters: market, status, competition, team, search; pagination  
- Transparency dashboard with factual metrics only  
- Competition/team/market via filters (no thin mass archive doorways)  

### Methodology & SEO (done)

- Public `/methodology` page + docs  
- CollectionPage / BreadcrumbList / SportsEvent list stubs where appropriate  
- Sitemap + inventory for archive + methodology; index gates for thin samples  
- Archive analytics events registered  

### Explicitly deferred from 18G

- Durable publication-odds log → average odds / optional yield  
- Search Console / CWV ops monitoring → Sprint 19+  
- Deployment, Flutter app, Acca Builder AI, dark-mode toggle → **not started**  

### Affiliate conversion strategy (enforced continuously across 18C–18G)

- Track full funnel; stable documented event names  
- Partner / country / league / market / placement attribution  
- Contextual offers; clear disclosure; region-permitted operators only  

---

## Sprint 19 — Production Readiness, Performance, Security & Launch Hardening (COMPLETE)

**Status:** COMPLETE — `docs/sprint-19-completion-report.md`  
**Engineering:** READY WITH ACCEPTED LIMITATIONS · **Promote:** NOT READY until ops evidence  

### Done (engineering hardening — no new product features)

- CTA boundary gate in CI + `validate:release`  
- Global `x-request-id` correlation via middleware + ready logs  
- Performance posture: lucide `optimizePackageImports`, image `remotePatterns`  
- SEO schema validation extended to archive + methodology  
- 404/error a11y + locale-aware recovery links  
- Smoke coverage: archive, methodology, security headers, request id  
- Audits: performance / SEO / a11y docs; expanded `docs/launch-checklist.md`  
- Production readiness report updated  

### Ops remaining (blocked — not code)

Staging HTTPS smoke, restore/rollback drills, Search Console, live signed-redirect flag flip, incident drill — see launch checklist.

### Explicitly not started after 19 (ops / later)

Flutter application · dark-mode toggle · marketing landing pages · new research features  

---

## Sprint 19.5 — Evidence-Based Acca Builder Integration (APPROVED AND CLOSED)

**Status:** **APPROVED AND CLOSED**  
**Launch status after close:** **PRODUCT READY FOR STAGING OPERATIONS**  
**Docs:** `docs/acca-builder.md` · `docs/acca-builder-methodology.md` · `docs/acca-builder-provider-matrix.md` · `docs/acca-builder-localhost-acceptance.md` · `docs/sprint-19-5-completion-report.md`

### Scope (delivered)

- Canonical `/{locale}/acca/builder` + `POST /api/acca/builder`  
- Domain `lib/acca-builder/*` (deterministic, explainable)  
- Real FootyStats lists + bounded odds enrichment  
- Transfer into Acca Studio (merge/replace)  
- `/combo` consolidates to the same builder engine  
- Preserve Sprint 20 ops tooling; do not deploy  

---

## Sprint 20 — Production Launch, Operations & Post-Launch Verification (COMPLETE — ops only)

**Status:** COMPLETE (ops package + local rehearsal) — tooling preserved  
**Product status:** **PRODUCT READY FOR STAGING OPERATIONS** (after Sprint 19.5 approval)  
**Reports:** `docs/sprint-20-completion-report.md` · `docs/launch-report.md` · `docs/search-console-and-bing.md`

> Sprint 20 operational tooling is prepared and preserved. Production has not been deployed. Staging/production remain operator-gated until Sprint 20B evidence.

### Done

- Preflight runner: `npm run ops:sprint20-preflight`  
- Origin verification: `npm run ops:verify-origin`  
- Rollback layout rehearsal: `npm run ops:rollback-rehearse`  
- GSC + Bing operator checklist  
- Launch report with honest blockers (placeholder `SITE_URL`, no server credentials)

### Not executed (operator / infra)

- Live production deploy to a real domain  
- Search Console / Bing property creation  
- Server PM2 rollback drill  
- Production Lighthouse / field CWV  
- `FF_SIGNED_REDIRECT_REQUIRED` live flip  

### Explicitly not started

Roadmap v1.1 · Flutter · dark mode · marketing redesign  

---

## Sprint 20B — Staging Deployment & Live Operations Verification (PREPARED — not started)

**Status:** PREPARED — waiting on operator infrastructure details  
**Do not execute** until domain, DNS, TLS, secrets, and deploy credentials are provided.  
**Checklist:** `docs/sprint-20b-staging-ops-checklist.md`

Covers staging deploy, health/origin verify, Acca Builder + Studio smokes, signed redirects, analytics, staging robots/noindex, rollback/restore drills, request IDs, and production promotion decision.  
**No launch-readiness claim** until staging evidence is collected.

---

## Sprint 21 — Internal Intelligence Dashboard (COMPLETE — localhost)

**Status:** COMPLETE on localhost · not public · not deployed  
**Report:** `docs/sprint-21-completion-report.md`  
**Docs:** `docs/admin-dashboard.md`, `docs/admin-metrics.md`

Admin-only intelligence platform (`/admin/*`) with server-side aggregations over archives + analytics logs, CSV/JSON export, charts, and honest Unavailable metrics.  
**Sprint 20B remains blocked** on staging credentials; this sprint did not deploy.

---

## Sprint 22 — SEO Intelligence, Index Quality & Content Governance (COMPLETE — localhost)

**Status:** COMPLETE on localhost · admin-only · not deployed  
**Report:** `docs/sprint-22-completion-report.md`  
**Docs:** `docs/seo-intelligence.md`, `docs/seo-page-type-contracts.md`, `docs/seo-indexability-rules.md`, `docs/seo-content-quality.md`, `docs/seo-url-lifecycle.md`

Protected `/admin/seo/*` audits programmatic pages: indexability, thin/duplicate risk, sitemaps, schema, internal links, lifecycle. Removed `/combo` from sitemap; Acca surfaces inventory aligned to noindex.  
**No deploy · no Sprint 20B · no Search Console/Bing.**

---

## Sprint 23 — Affiliate Intelligence, Operator Quality & Conversion Governance (COMPLETE — localhost)

**Status:** COMPLETE on localhost · admin-only · not deployed  
**Report:** `docs/sprint-23-completion-report.md`  
**Docs:** `docs/affiliate-intelligence.md`, placement/attribution/funnel/quality docs

Protected `/admin/affiliate/*` covers operator registry, availability reason codes, placements, funnels, redirect health, and internal quality scores — no fabricated FTDs/revenue.  
**No deploy · no Sprint 20B · no credential requests.**

---

## Sprint 24 — Prediction Calibration, Builder Quality & Decision Governance (COMPLETE — localhost)

**Status:** COMPLETE on localhost · admin-only · not deployed  
**Report:** `docs/sprint-24-completion-report.md`  
**Docs:** `docs/calibration-intelligence.md` and related methodology docs

Protected `/admin/calibration/*` measures confidence calibration, market/league cohorts, sample gates, Builder generation metrics, and review-only recommendations — **no auto-tuning** of model weights or thresholds.  
**No deploy · no Sprint 20B · no credential requests.**

---

## Sprint 25 — Experimentation Platform, A/B Testing Governance & Decision Quality (COMPLETE — localhost)

**Status:** COMPLETE on localhost · admin-only · not deployed  
**Report:** `docs/sprint-25-completion-report.md`  
**Docs:** `docs/experimentation-platform.md` and related experiment docs

Protected `/admin/experiments/*` provides typed definitions, deterministic assignment, exposure semantics, metric/SRM/guardrail governance, and preview isolation. Public behavior remains **control** unless `FF_EXPERIMENTATION_ENABLED` is explicitly set. No production activation endpoint. No fabricated uplifts.  
**No deploy · no Sprint 20B · no credential requests.**

---

## Flutter / mobile application readiness (cross-cutting)

**Do not introduce Flutter code during Sprint 18.**

From **Sprint 18B onward**, architecture should support a future Flutter app:

- API-first domain services; versioned API contracts  
- Shared domain terminology  
- Server-authoritative fixture, prediction, settlement, Acca rules  
- UI-independent business logic  
- Typed schemas; consistent IDs (fixtures, teams, leagues, markets, predictions, operators, Accas)  
- Auth readiness without forcing auth early  
- Deep-link-compatible URLs  
- Push-notification-ready event taxonomy  
- Mobile-compatible analytics events  
- Saved Accas/preferences designed for eventual account sync  
- First implementation may remain anonymous and local-first  

---

## Success metric (after 18G, before 19)

Users can discover RankWagers via SEO, evaluate an evidence-backed prediction on a shareable match page, verify live/settled outcomes transparently, build an Acca, and hand off to a permitted bookmaker — without SofaScore cloning, tipster theater, or unsigned CTAs.
