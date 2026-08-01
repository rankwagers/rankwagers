# SEO audit (living)

**Updated:** Sprint 22 — SEO Intelligence  

## Current tooling

| Layer | Location |
|-------|----------|
| Public metadata / hreflang | `lib/seo.ts` |
| Indexability helpers | `lib/seo/indexability.ts` |
| Schema validation | `lib/seo/validate.ts` |
| Crawl quality suite | `lib/crawl-quality/*` + `/developer/crawl-quality` |
| **SEO Intelligence (admin)** | `lib/seo-intelligence/*` + `/admin/seo/*` |

## Governance changes (Sprint 22)

- Acca Studio / Builder inventory correctly **noindex**
- `/combo` redirect **removed from sitemap**
- Deterministic indexability decisions with reason codes
- Page-type quality contracts documented
- Admin SEO dashboard for URLs, issues, sitemaps, schema, links, quality

## Do not

- Index search, admin, Acca Studio/Builder
- Generate generic AI SEO articles or fake descriptions
- Contact Search Console / Bing from this tooling
- Deploy as part of SEO audits

See `docs/seo-intelligence.md` and `docs/sprint-22-completion-report.md`.
