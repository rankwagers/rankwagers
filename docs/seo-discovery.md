# SEO & Discoverability (Sprint 18D)

Companion to `docs/search-discovery.md` and `docs/homepage-seo.md`.

## Principles

- Quality over page count — no thin, doorway, or duplicate landings  
- Every indexed URL must justify crawl budget  
- Prefer noindex over low-value index  

## Indexability policy

`lib/seo/indexability.ts`

| Surface | Default |
|---------|---------|
| `/search` | **noindex** (SRP) |
| `/countries/[code]` | Index only when competitions + operators + unique summary pass gate |
| Thin country hubs | Render OK, stay **noindex** |

## Metadata & social

Entity and country pages use `pageMetadata` (`lib/seo.ts`): title, description, canonical, hreflang, Open Graph, Twitter Cards. Avoid duplicate canonicals by resolving a single locale-prefixed path per entity.

## Structured data

- Country: WebPage + BreadcrumbList (`lib/countries/schema.ts`)  
- Existing entity schemas remain in crawl-quality validators  
- Semantic section chrome: `components/seo/SemanticEntitySections.tsx` (Summary / Key Facts / Related / Navigation)

## Sitemap / robots

- Countries shard lists only indexable codes  
- Search SRP never sitemapped as a query factory  

## AI-search readiness

Prefer structured sections over prose walls. Do not invent AI summaries. Evidence and predictions stay tied to real data models.

## Out of scope here

Mass programmatic page generation. Archive IA shipped in 18G (`/archive`, `/methodology`). Acca Studio in 18E.
