# Sprint 18G Completion Report — Transparency, Verification, Archive & Product Credibility

**Date:** 2026-07-25  
**Status:** COMPLETE — awaiting approval  
**Next:** Sprint 19 approved and complete — see `docs/sprint-19-completion-report.md`  
**Confirmation (at 18G close):** No Sprint 19+ product functionality was implemented in 18G.

---

## Archive features

- Hub `/{locale}/archive` — transparency dashboard, day chips, filters, search, pagination  
- Daily `/{locale}/archive/{date}` — day snapshot + same filter/pagination model  
- Competition / team / market archive via filters (no thin mass doorway pages)  
- Empty, loading-friendly SSR, and `notFound` for missing dates  
- Every row links to the original match page  
- Settlement & evidence disclosure per row (publication proxy, kickoff, reason, evidence)

## Transparency features

- Factual metrics only: totals, settled, W/L/void/pending, hit rate, sample note, last update  
- By-market and top-competition breakdowns  
- Average odds explicitly **Unavailable** (never fabricated)  
- No ROI / profitability metrics  

## Methodology pages

- Public `/{locale}/methodology` — generation, confidence, evidence, settlement, archive preservation  
- Docs: `docs/methodology.md`, `docs/transparency.md`  
- Settlement reference remains `docs/prediction-settlement-methodology.md`

## Structured data

- Archive hub/day: `CollectionPage` + `BreadcrumbList`  
- Day pages: optional `ItemList` of `SportsEvent` stubs for archived matches  
- Methodology: `WebPage` + `BreadcrumbList`  
- No misuse of Product/Review/AggregateRating for tipster claims  

## SEO improvements

- Canonical + metadata via `pageMetadata`  
- Hub indexed only when settled sample ≥ 3; day pages gated on settled/sample  
- Sitemap + crawl inventory include `/archive` and `/methodology`  
- Internal links from footer, nav, homepage trust, entity evidence hrefs, knowledge graph  

## Analytics additions

| Event | Trigger |
|-------|---------|
| `archive_viewed` | Archive hub |
| `archive_day_viewed` | Daily archive |
| `archive_filter_used` | Filter form submit |
| `archive_prediction_opened` | Match link from archive |
| `methodology_viewed` | Methodology page |
| `transparency_viewed` | Hub / transparency surface |
| `transparency_interaction` | Reserved for dashboard interactions |

## Architecture changes

- New domain package `lib/archive/*` (types, project, aggregate, query, load, schema, analytics, links)  
- UI `components/archive/*`  
- Flutter-ready contracts remain UI-independent; loaders stay server-side  

## Files changed (primary)

| Area | Paths |
|------|-------|
| Domain | `lib/archive/**` |
| UI | `components/archive/**` |
| Routes | `app/[locale]/archive/**`, `app/[locale]/methodology/page.tsx` |
| Nav / trust | `Footer.tsx`, `primaryNav.ts`, `trustPerformance.ts`, `RankWagersHome.tsx`, entity `*/links.ts`, knowledge graph |
| SEO | `app/sitemap.ts`, `lib/crawl-quality/sitemap.ts`, `inventory.ts` |
| Analytics | `lib/analytics/types.ts` |
| Tests | `tests/sprint18gArchive.test.ts` (+ homepage footer assertions) |
| Docs | `docs/transparency.md`, `docs/methodology.md`, `docs/sprint-18g-completion-report.md`, sprint plan / backlog / matrix / SEO / analytics / settlement |

## Tests added

`tests/sprint18gArchive.test.ts` — projection, aggregation honesty, filters/pagination, routes/schema, sitemap/inventory, analytics registration, a11y markers, internal links.

## Validation results

| Gate | Result |
|------|--------|
| `npm test` | **PASS** — 310/310 |
| `npm run lint` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** — includes `/[locale]/archive`, `/[locale]/archive/[date]`, `/[locale]/methodology` |
| `npm run security:scan` | **PASS** — `{"ok":true,"scanned":606}` |
| `npm run scan:cta-boundary` | **PASS** — `{"ok":true,"findings":[]}` |

## Known limitations

- Publication timestamp is archive `savedAt` (day snapshot), not a per-prediction append-only log  
- Original odds / unit P/L unavailable until durable odds archive exists  
- Match-page publication snapshots remain page-build observations (not rewritten by archive UI)  
- No weekly/monthly/seasonal chart surfaces yet (filters + aggregates cover honesty needs)  

## Deferred work

- Append-only prediction odds log → enables average odds / optional yield metrics  
- Search Console / CWV operational monitoring (ops; Sprint 19+)  
- Full research UI i18n for explorer chrome  
- Sprint 19 deployment preparation  
- Flutter application  
- Evidence-Based Acca Builder (beyond existing Acca Studio / Combo)  
- Dark mode toggle  

## Confirmation: no Sprint 19+ work

No staging deploy automation, Flutter package, Acca Builder AI, or dark-mode product toggle was started.

**Stop here — wait for Sprint 18G approval before Sprint 19.**
