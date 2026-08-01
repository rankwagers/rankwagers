# Sprint 19 — SEO final audit (engineering)

Companion to `docs/seo-discovery.md`, `docs/homepage-seo.md`, `docs/transparency.md`.

## Indexable surface checklist

| Surface | Canonical | Robots | Sitemap | Schema | Notes |
|---------|-----------|--------|---------|--------|-------|
| Homepage | ✓ | index | static | Organization/WebSite (existing) | |
| Competitions / teams / markets / seasons | ✓ | index | shards | Collection/WebPage/Breadcrumb | |
| Countries | ✓ gated | thin → noindex | indexable codes only | WebPage + crumbs | |
| Operators / reviews | ✓ | index | operators shard | Organization | |
| Compare | ✓ | partial noindex policy | compare shard | | |
| Archive hub | ✓ | index when settled ≥ 3 | static | CollectionPage + crumbs | 18G |
| Archive day | ✓ | sample gate | discover via hub | CollectionPage + SportsEvent list | avoid thin |
| Methodology | ✓ | index | static | WebPage + crumbs | 18G |
| Search | ✓ | **noindex** | excluded | — | |
| Acca / share | ✓ | **noindex** | excluded | — | |
| Admin / developer / api | — | noindex headers | excluded | — | |

## Validated in CI/tests

- `validateStructuredData()` covers markets, operators, competitions, teams, seasons, **archive**, **methodology**  
- `pageMetadata` asserts canonical, hreflang, Open Graph, Twitter  
- Crawl-quality inventory includes `/archive` + `/methodology`  
- Staging robots isolation coded (`app/robots.ts`); live proof needs staging smoke  

## Hreflang / pagination

- Locale prefixes via `hreflangLanguages`  
- Archive pagination is query-based (`?page=`); canonical stays on the base archive path (filter pages not separately sitemapped — correct for crawl budget)

## Thin-page protection

- Country gate (`lib/countries/landing`)  
- Archive index gates on settled/sample size  
- No mass doorway PSEO generators  

## Ops remaining

- Search Console property + sitemap submit (see `docs/launch-checklist.md`)  
- Live staging robots Disallow verification with `EXPECT_STAGING=1`  
