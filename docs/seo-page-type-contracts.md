# SEO page-type contracts

Source of truth: `lib/seo-intelligence/page-types.ts` (`PAGE_TYPE_CONTRACTS`).

Each contract defines:

- route patterns
- default indexability (`INDEX` / `NOINDEX` / `REDIRECT` / `EXCLUDED` / `CONDITIONAL`)
- sitemap eligibility
- expected schema types
- minimum content requirements
- stale-page behavior
- expected internal-link sources
- metadata source

## Highlights

| Type | Index default | Sitemap |
|------|---------------|---------|
| home | INDEX | yes |
| search | NOINDEX | no |
| fixture | CONDITIONAL | no (internal discovery) |
| competition / team / market | CONDITIONAL/INDEX | yes |
| archive hub | CONDITIONAL (≥3 settled) | yes |
| archive day | CONDITIONAL | no |
| methodology | INDEX | yes |
| operator / review | CONDITIONAL/INDEX | yes |
| country | CONDITIONAL (doorway gate) | indexable codes only |
| Acca Studio / Builder | NOINDEX | no |
| combo | REDIRECT | **no** (Sprint 22 fix) |
| admin / developer | EXCLUDED | no |

Transparency is a **component** on archive pages, not a separate route.
