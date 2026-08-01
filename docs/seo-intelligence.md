# SEO Intelligence (Sprint 22)

**Status:** Implemented on localhost · admin-only · not deployed  
**Entry:** `/admin/seo` → `/admin/seo/overview`

## Purpose

Govern and audit RankWagers programmatic pages. Prefer fewer high-quality indexable URLs over maximizing index count. No generic AI SEO content generation.

## Principles

- Maximize useful, factual, evidence-backed, technically valid indexed pages
- Deterministic indexability with explicit reason codes
- Hard noindex/redirect/excluded rules override quality scores
- Never fabricate statistics, ratings, or structured-data claims

## Architecture

```
lib/seo-intelligence/
  contracts · page-types · indexability · lifecycle · scoring
  content-quality · canonical · metadata · freshness
  structured-data · internal-links · sitemap · issues
  queries · aggregations · exports · service · analytics
```

Reuses `lib/crawl-quality/*` and `lib/seo/*` for inventory, links, schema, and sitemap mirroring.

## Admin routes

All reuse Sprint 21 admin auth + `noindex, nofollow, noarchive`:

| Path | Section |
|------|---------|
| `/admin/seo` | → overview |
| `/admin/seo/overview` | KPIs |
| `/admin/seo/urls` | URL inventory |
| `/admin/seo/page-types` | Contracts |
| `/admin/seo/issues` | Issue list |
| `/admin/seo/sitemaps` | Sitemap health |
| `/admin/seo/structured-data` | Schema audit |
| `/admin/seo/internal-links` | Orphans / graph |
| `/admin/seo/content-quality` | Thin candidates |

## APIs

| Endpoint | Notes |
|----------|--------|
| `GET /api/admin/seo?section=` | Section JSON |
| `GET /api/admin/seo?path=` | URL detail |
| `GET /api/admin/seo/export?section=&format=csv\|json` | Bounded export |

Auth required · rate limited · request IDs · no public access.

## Experimentation note (Sprint 25)

Experiments must not create variant-indexable URLs, duplicate canonicals, sitemap query variants, or cloaked content. SEO-impacting experiments remain inactive until a future explicit review.

## Related docs

- `docs/seo-page-type-contracts.md`
- `docs/seo-indexability-rules.md`
- `docs/seo-content-quality.md`
- `docs/seo-url-lifecycle.md`
- `docs/sprint-22-completion-report.md`
