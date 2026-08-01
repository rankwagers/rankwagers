# RankWagers — Product Completion Audit (Sprint 18)

**Date:** 2026-07-25  
**Scope:** Product / UI / UX / content / SEO / navigation / data presentation — **audit only**  
**Non-goals honored:** No deploy, migrations, PM2/nginx/TLS, staging ops, or implementation of findings.

**Technical baseline (not product completion):** production build green · tests green · typecheck/lint/security/release gates green · CTA signing boundary fixed · local code ready for server configuration.

**Roadmap (updated after Sprint 20):** Authoritative plan in `docs/product-sprint-plan.md`. Product direction = football **betting decision-support** (not SofaScore/Flashscore). Sprints 18A–20 ops package complete; live promote blocked on real domain (`docs/launch-report.md`). Roadmap v1.1 / Flutter / Acca Builder AI / dark mode remain locked.

---

## Executive summary

RankWagers is a **technically substantial** Next.js evidence-first football research + affiliate platform, but it does **not** yet feel like a finished consumer product.

**Direct verdict on the homepage:** it reads as a **collection of research widgets with unfinished workspace surfaces**, not a complete football research platform. Affiliate conversion paths exist on separate routes but are **orphaned from primary navigation**. Match “detail” is an **inline expander**, not a shareable page. Several high-traffic affiliate SEO routes have **wrong variant / metadata wiring**.

| Metric | Value |
|--------|------:|
| **Overall product completion (user-facing)** | **~58%** |
| Public page routes audited | **25** (`route-inventory` public_page) |
| Locale-prefixed product surfaces | **~24** × 31 locales (sitemap multiplies) |
| App `page.tsx` files inspected | **34** (excl. aff-panel) |
| Product components under `components/` | **~117** |
| P0 findings | **7** |
| P1 findings | **18** |
| P2 findings | **24** |
| P3 findings | **14** |

### What works today

- Daily qualified fixtures pipeline (FootyStats lists → homepage explorer)
- Inline fixture evidence, H2H/form, odds snapshot, signed partner CTAs (API-signed)
- Combo Studio end-to-end API + empty/error/stale states
- Entity graph pages: competitions, teams, markets, operators, seasons
- Global entity search (header + `/search`, `noindex`)
- Legal/compliance footer links, age gate, affiliate disclaimer patterns
- Strong internal engineering (diagnostics, snapshots, signed redirects)

### What blocks “product complete”

1. ~~No dedicated, shareable **match detail page**~~ → **DONE (18B)** `/{locale}/fixtures/{matchId}`
2. Homepage **Saved / Research Notes** are largely **dead or decorative**
3. Primary nav **omits affiliate hubs**; overcrowded research IA
4. **`/best-betting-sites` ships crypto variant** (wrong product surface)
5. Homepage + explorer copy largely **hardcoded English** despite 31 locales
6. Fixture deep-links / homepage search collapse to `#fixtures` without opening a match
7. Entity pages can be **thin** when daily queue has no fixtures for that entity
8. Availability / legal pages have **visual theme breakage**
9. Confidence language (“Highest confidence”, “Model v2.4.1”) risks overclaim without methodology clarity
10. Mobile: dense filter chips, long desktop nav dumped into drawer, large fixture detail

---

## 1. Full route and page audit

Inventory source: `docs/route-inventory.generated.md` (69 total; **25 public_page**).

| Route | Purpose | Status | Key gaps |
|-------|---------|--------|----------|
| `/:locale` | Predictions / research home | FUNCTIONAL BUT INCOMPLETE | Widget collage; Saved dead; EN-hardcoded; no match URLs |
| `/:locale/today` | Alias | COMPLETE (redirect) | Redirect-only |
| `/:locale/combo` | Combo Studio | FUNCTIONAL BUT INCOMPLETE | Dense UX; snapshot-dependent; feature-flaggable `notFound` |
| `/:locale/search` | Entity search | FUNCTIONAL BUT INCOMPLETE | No fixture search; `noindex`; limited typo UX |
| `/:locale/competitions` | Competition index | FUNCTIONAL BUT INCOMPLETE | Thin if registry-only |
| `/:locale/competitions/:slug` | Competition detail | FUNCTIONAL BUT INCOMPLETE | Tied to daily queue sample |
| `/:locale/competitions/:slug/seasons/:season` | Season detail | PARTIAL | Nested depth; discoverability low |
| `/:locale/seasons` | Season index | PARTIAL | Nav present; secondary IA |
| `/:locale/teams` / `:slug` | Team graph | FUNCTIONAL BUT INCOMPLETE | Empty when team not in today’s queue |
| `/:locale/markets` / `:slug` | Market graph | FUNCTIONAL BUT INCOMPLETE | Good structure; sample-bound |
| `/:locale/operators` / `:slug` | Operator intelligence | FUNCTIONAL BUT INCOMPLETE | Dual with `/reviews` brand pages |
| `/:locale/reviews/:brand` | Affiliate review | FUNCTIONAL BUT INCOMPLETE | Not in primary nav; static brand data |
| `/:locale/compare/:slug` | Brand vs brand | FUNCTIONAL BUT INCOMPLETE | Combinatorial; partial index |
| `/:locale/best-betting-sites` | Main affiliate landing | **BROKEN PRODUCT INTENT** | Uses `variant="crypto"`; wrong meta keys |
| `/:locale/best-crypto-betting-sites` | Crypto affiliate list | FUNCTIONAL BUT INCOMPLETE | OK variant; FAQ certainty language |
| `/:locale/bonuses` | Bonus hub | FUNCTIONAL BUT INCOMPLETE | Orphaned from header |
| `/:locale/availability` | Geo notice | PARTIAL / PLACEHOLDER feel | Dark-theme classes on light site; chips not links |
| `/:locale/privacy` / `terms` / `responsible-gambling` | Legal | FUNCTIONAL BUT INCOMPLETE | Dictionary-driven; verify depth per locale |
| `/not-available` | Blocked geo | PARTIAL | Separate from locale chrome |
| `/` (`app/page.tsx`) | Root redirect | COMPLETE | — |
| 404 `app/not-found.tsx` | Not found | FUNCTIONAL | Hardcoded `/en` links |
| `app/[locale]/loading.tsx` | Locale loading | COMPLETE | PageSkeleton |
| `app/[locale]/error.tsx` | Locale error | COMPLETE | Retry + home |
| Match detail **page** | Shareable fixture URL | **NOT IMPLEMENTED** | Only expander + `/api/match-detail` |
| Country browse pages | Country → leagues | **NOT IMPLEMENTED** | Only `?country=` personalization + availability chips |
| League pages (human IA) | Distinct from competitions | PARTIAL | Competitions registry ≈ leagues; naming mismatch |

Developer/admin/diagnostics routes exist but are **out of product scope** (must stay non-indexable / gated).

---

## 2. Homepage audit

**Composition (`RankWagersHome`):** Today hero → Combo launcher → Highest confidence → Trending markets → Live signals → Operator strip → Fixture explorer → Saved → Research notes / methodology.

### Direct assessment

| Question | Answer |
|----------|--------|
| Complete football research platform? | **No** |
| Developer dashboard? | **Partially** (model meta, mono timestamps, technical labels) |
| Disconnected widgets? | **Yes — primary feeling** |
| Unfinished data explorer? | **Yes** |

### Critical homepage issues

| ID | Sev | Finding |
|----|-----|---------|
| HP-01 | P0 | `#saved` explains Save but **does not list saved fixtures**; save state is in-memory only |
| HP-02 | P0 | “Highest confidence / Inspect” links to `#fixtures` — **does not expand the fixture** |
| HP-03 | P1 | Hero/section titles hardcoded English; ignore `dict.predictions` for main H1 |
| HP-04 | P1 | `aria-labelledby` targets IDs that **SectionHeading never sets** (`highest-confidence`, etc.) |
| HP-05 | P1 | Affiliate hubs (best sites, bonuses, reviews) **absent from header** |
| HP-06 | P1 | Header has **13 nav items** — desktop overflow / drawer dump on mobile |
| HP-07 | P2 | “Model v2.4.1” + “Highest confidence” overclaims without plain-language caveats in hero |
| HP-08 | P2 | Trending markets also only jump to `#fixtures` without market filter applied |
| HP-09 | P2 | Live Signals gated/Telegram UX may feel disconnected from evidence narrative |
| HP-10 | P3 | Research notes “Latest insights” are **aggregates**, not editorial notes |

Loading: locale `loading.tsx` OK. Empty fixtures: EmptySection + explorer empty copy OK. API error banner on home OK. Footer compliance present via layout.

---

## 3. Match detail audit

**Architecture:** No `/:locale/fixtures/:id` (or similar). Detail = `BibleFixtureExplorer` accordion + `GET /api/match-detail`.

| Expected surface | Present? | Notes |
|------------------|----------|-------|
| Fixture header / teams / competition / kickoff / venue | Yes | In expander |
| Form / H2H | Yes | When API returns history |
| Standings context | **No** | Not surfaced |
| Goals / FH / SH evidence | Yes | Evidence UI + qualification |
| Market qualification | Yes | QualificationPanel |
| Operator offers | Yes | `signedPartnerOffersByMarket` |
| Affiliate fallback | Partial | Region / unavailable states in offers |
| Related matches | Weak | Same-match multi-market list only |
| Breadcrumb | **No** (no page) |
| Share / copy | **No** |
| Responsible-use note | Weak | Site footer only |
| Data-source attribution | Partial | Odds timestamps; source labels uneven |
| Stale/missing detail | Partial | Failed fetch silently returns (`if (!response.ok) return`) |
| Mobile | Dense | Multi-section expander; filter chip wrap |

**Backend capability not in UI:** standings, durable save, shareable URL, next/prev match, dedicated SEO page for fixtures.

---

## 4. Combo Studio audit

Route: `/:locale/combo` · UI: `ComboStudio` + rich empty/error/stale/progress components.

| Journey step | Status |
|--------------|--------|
| Entry (nav + homepage launcher) | Present |
| Explanation / FAQ / JSON-LD | Present |
| Form (odds, markets, risk, filters) | Present |
| Generate / replace / remove | Present |
| Reasoning / evidence | Present |
| Operator availability honesty | Present (full/partial/unknown) |
| Signed outbound CTA | Present (server paths) |
| Copy combo | Present |
| Empty / no-result / stale / rate-limit | Present |
| Mobile | Risk — sticky bar + sheet + comparison modal density |
| Accessibility | Mixed — good labels in places; comparison table on small screens |
| Feature flag `comboRouteEnabled` | Can 404 entire product surface |

**Gaps:** candidate pool transparency before generate is limited; correlation warnings may be jargon-heavy; homepage presets don’t explain qualification thresholds; no deep-link back to underlying fixtures as pages.

---

## 5. Search and discovery audit

| Surface | Status | Gap |
|---------|--------|-----|
| Header `GlobalSearch` | Wired | Entities only (not fixtures) |
| `/search` page | Wired | `index: false`; filters; empty states good |
| Homepage fixture search event | Partial | `rankwagers:home-search` → explorer; **href always `#fixtures`** (`homeSearchRoutes.ts`) |
| Autocomplete / keyboard | Present | listbox pattern in GlobalSearch |
| Typo tolerance | Limited | Normalizer-based; not fuzzy product UX |
| URL state on `/search` | Present | `q`, `type`, `country` |
| Fixture URL state | **Missing** | Filters/pagination not in URL; back/forward weak |
| Discovery modules | Present | Popular / recently viewed / related on entity pages |

---

## 6. Navigation audit

**Header (product):** Today, Combo, Qualified Fixtures, Live Signals, Methodology, Operators, Markets, Competitions, Teams, Seasons, Search, Research Notes, Saved.

**Missing from primary nav:** Best betting sites, Crypto sites, Bonuses, Reviews, Compare, Responsible gambling (footer only).

**Orphan / weak destinations:**

- `#saved`, `#research-notes` — low utility
- Affiliate SEO pages — sitemap + footer-adjacent only via methodology link
- Season nested routes — hard to reach
- `/today` redirect — fine
- Dual IA: `/operators/:slug` vs `/reviews/:brand` — confusing labels

**Locale switcher:** present; many locales fall back to English dictionary → label/locale mismatch risk.

---

## 7. UI/UX consistency audit

| Area | Assessment |
|------|------------|
| Design tokens | Ivory/green Design Bible mostly on research home |
| Availability page | **Broken look** (`text-white`, `slate-300` on light layout) |
| Affiliate list pages | Older card/list patterns vs bible home |
| Buttons | `btn-primary` / ghost mixed with one-off classes |
| Density | Homepage + fixture detail **very dense** |
| Cards | Overused on research home vs design rules for interactive-only cards |
| Loading skeletons | Locale-level yes; fixture detail loading weak |
| Dark/light | Light assumed; some leftover dark classes |

Feels **visually mid-migration**: research bible vs legacy affiliate vs dark legal remnant.

---

## 8. Mobile audit (code-level; breakpoints 320–768)

Not a live device pass — issues inferred from markup/CSS.

| Component | Issue | Sev |
|-----------|-------|-----|
| Header nav | 13 items → mobile drawer wall of links | P1 |
| Fixture filter chips | Horizontal wrap / overflow risk at 320 | P1 |
| Fixture detail expander | Long scroll; multiple grids | P1 |
| Combo comparison table | Horizontal scroll risk | P1 |
| Operator offer grids | Dense two-col at small widths | P2 |
| Live unlock modals | Focus trap / scroll lock need QA | P2 |
| Sticky combo bar | May obscure CTAs | P2 |
| GlobalSearch header | Width contention with 18+ / lang | P2 |

---

## 9. Accessibility audit (severity)

| Sev | Issue |
|-----|-------|
| P1 | Homepage `aria-labelledby` IDs missing on headings |
| P1 | Mobile menu close control is “✕” without clear accessible name on icon button (partial) |
| P1 | Fixture expand/collapse: verify `aria-expanded` / controls wiring end-to-end |
| P2 | Filter buttons: many; no skip/group label beyond “Filter” |
| P2 | Contrast: gold API error banner — check WCAG |
| P2 | Live regions for search loading / combo status uneven |
| P3 | Reduced-motion not systematically applied |
| P3 | 404/error hardcode English `/en` |

---

## 10. Content and trust audit

| Issue | Sev |
|-------|-----|
| “Highest confidence” without definition | P1 |
| Crypto FAQ: “best crypto betting site this month is {brand}” | P1 |
| “Model v2.4.1” unexplained | P2 |
| Hardcoded EN on primary research UI | P1 |
| Live Signals win/lost language — tipster risk if not carefully framed | P1 |
| Dual “verified odds” vs “unknown availability” — users may conflate | P1 |
| Affiliate disclosure: footer strong; homepage operator strip weaker | P2 |
| Responsible-use: footer OK; match/combo inline weak | P2 |
| Review pages use static brand.bonus — may go stale | P2 |

Must not imply (policy): guaranteed wins, AI predictions, universal bookmaker coverage, real-time when snapshot — **copy still flirts with confidence theater**.

---

## 11. SEO product audit

| Issue | Sev |
|-------|-----|
| `/best-betting-sites` uses crypto variant + likely wrong title keys | **P0** |
| No indexable fixture URLs | P1 (opportunity + IA) |
| Entity pages thin when queue empty — soft 200s with empty samples | P1 |
| 31 locales × English fallback → thin/duplicate locale risk | P1 |
| Compare: partial `noindex` strategy good; still many crawlable URLs | P2 |
| Search correctly `noindex` | OK |
| Sitemap includes combo, entity indexes, reviews, compare subset | OK |
| Reviews vs operators duplicate intent | P2 |
| `availability` low-value indexable page | P2 |

**Should defer indexing until stronger:** empty entity shells, weak locale translations, combinatorial compare (already partially gated), staging (infra — out of scope).

---

## 12. Data presentation audit

| Backend concept | User clarity |
|-----------------|--------------|
| Qualification difference vs threshold | Medium — panel exists, jargon remains |
| Sample quality / integrity | Medium — Evidence UI |
| Snapshot / LKG for combo | Medium — stale banner |
| Operator availability unknown | Good copy in Combo; weaker on homepage offers |
| Ranking reasons | Partial on partners |
| Correlation / replace logic | Partial — power-user |
| Provider source labels | Uneven across Live vs FootyStats vs odds |

Technically correct outputs often still **analyst-facing**.

---

## 13. Functional interaction audit

| Control | Status |
|---------|--------|
| Save to research notes | **Dead product loop** (state only) |
| Highest confidence Inspect | **Incomplete** (scroll only) |
| Homepage search → fixture | **Partial** (filter/event; no deep open URL) |
| match-detail fetch failure | **Silent no-op** |
| Locale switch | Works; content may stay EN |
| Combo generate/replace/remove/copy | Wired |
| Affiliate CTA analytics | Wired on several surfaces |
| Date `?date=` on home | Server supports; **no obvious UI date picker** on RankWagersHome |
| best-betting variant | **Wrong** |

---

## 14. Classification totals

| Priority | Count | Themes |
|----------|------:|--------|
| **P0** | **7** | Wrong affiliate landing; dead Saved; Inspect no-op; no match page; silent detail failure; EN-only research chrome; nav omits conversion hubs |
| **P1** | **18** | Mobile nav/filters; a11y labelledby; thin entities; locale SEO; trust language; fixture search href; availability theme; dual operator/review IA |
| **P2** | **24** | Density, schema polish, sticky UX, compare crawl, methodology clarity |
| **P3** | **14** | Polish, motion, microcopy |

See `docs/product-gap-backlog.md` for the full backlog IDs.

---

## 15–16. Matrix and sprint plan

- Completion matrix → `docs/product-completion-matrix.md`
- Prioritized backlog → `docs/product-gap-backlog.md`
- Implementation sprints → `docs/product-sprint-plan.md`

---

## Incomplete routes (summary)

- Match detail page — **not implemented**
- Country browse — **not implemented**
- `/best-betting-sites` — **implemented incorrectly**
- `#saved` / Saved workspace — **placeholder**
- Availability — **partial / broken chrome**
- Many locales — **dictionary fallback incomplete** for research UI

## Incomplete / dead components (highlights)

- Saved section (`RankWagersHome`)
- Highest-confidence cards (no fixture targeting)
- `homepageSearchResultHref` always `#fixtures`
- `SidebarBannerSlot` unused in current home path
- Date selector for `searchParams.date` (server-ready, UI missing)
- Standings (domain absence in UI)

## External-data blockers

- FootyStats / API-Football keys and freshness
- Telegram live-feed engine for Live Signals richness
- Affiliate program configuration per brand
- Real odds coverage breadth (honest unknown availability)

These are **BLOCKED BY EXTERNAL DATA** for fullness, not excuses for broken IA/copy.

---

## Recommended next sprint

**Sprint 18A — Product integrity & navigation (P0/P1)**  
Fix best-betting variant/meta; repair primary nav IA; kill or implement Saved; wire Inspect + search deep-open; surface date control; harden match-detail error UI.

**Exact first implementation prompt scope** (do not run until approved):

> Implement Sprint 18A only: (1) fix `best-betting-sites` to `variant="betting"` and correct metadata keys; (2) redesign Header/MobileNav information architecture (research vs bookmakers); (3) either implement a real Saved list with persistence or remove Saved nav/section; (4) make Highest confidence / homepage search open the target fixture in the explorer; (5) add visible error/empty UI when `/api/match-detail` fails; (6) add homepage date control bound to `?date=`. No deploy. No new match detail route yet (reserved for 18B).

---

## Stop

Audit complete. **No backlog implementation performed.**
