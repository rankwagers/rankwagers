# SEO indexability rules

Engine: `lib/seo-intelligence/indexability.ts`  
Decisions: `INDEX` · `NOINDEX` · `EXCLUDED` · `REDIRECT` · `ERROR` · `REVIEW_REQUIRED`

## Hard rules (always)

| Surface | Decision | Reason codes |
|---------|----------|--------------|
| `/admin/*` | EXCLUDED | `ADMIN_ROUTE` |
| `/developer/*` | EXCLUDED | `DEVELOPER_ROUTE` |
| `/search` | NOINDEX | `SEARCH_RESULT_PAGE` |
| `/acca`, `/acca/builder` | NOINDEX | `PRIVATE_WORKSPACE` |
| `/combo` | REDIRECT | `CANONICAL_REDIRECT` |
| Staging / `STAGING_NOINDEX` | NOINDEX | `STAGING_OVERRIDE` |

## Conditional examples

- **Fixture:** INDEX only when match model reports indexable; cancelled → `CANCELLED_FIXTURE`; unloaded → `REVIEW_REQUIRED`
- **Archive hub:** INDEX when settled ≥ 3 → `VALID_SETTLED_ARCHIVE`
- **Archive day:** INDEX when settled ≥ 1 or total ≥ 3; unknown counts → `REVIEW_REQUIRED` (no invention)
- **Thin entity (≥2 signals):** `REVIEW_REQUIRED` with `THIN_CONTENT`
- **Doorway country risk:** NOINDEX `AFFILIATE_DOORWAY_RISK`

## Published Accas — `/{locale}/accas` (Sprint 20B-B + Sprint 24)

The **plural** family is public and crawlable. The singular `/acca`, `/acca/builder` family above
stays NOINDEX; no `/{locale}/acca/{slug}` route exists, so one document never has two addresses.

| View | Decision | Reason |
|---|---|---|
| Index, unfiltered, page 1, ≥1 published Acca for the locale | INDEX | Indexability is earned, not assumed |
| Index, unfiltered, page ≥2, in range | INDEX | Real pagination carries different Accas — own canonical, own title |
| Index, no published Acca for the locale | NOINDEX, follow | Empty listing is a thin page whatever the URL says |
| Index, any filter applied | NOINDEX, follow → canonical to bare index | A facet is a view of the same inventory, not a new document |
| Index, `?page=` out of range | NOINDEX, follow → canonical to bare index | A clamped page renders page 1 at a different URL |
| Detail, PUBLISHED, matching locale | INDEX | |
| Detail, DRAFT / ARCHIVED / other locale / unknown slug | **404** | All four are indistinguishable; an unpublished Acca leaks nothing, not even its existence |
| Any Acca surface with `FF_PUBLIC_ACCA_PAGES_ENABLED=false` | **404** | Indistinguishable from a route that does not exist |

Rules that follow from the above:

- `?page=1` is never emitted — not in a link, not in a canonical.
- Filter links are `follow`, never `nofollow`: the detail pages they lead to should stay reachable.
- A detail page declares a canonical and **no `hreflang` alternates**. An Acca is published under
  one locale and every other locale 404s for its slug.
- Structured data: `Article` inside a `CollectionPage`, with `BreadcrumbList`. Never `Offer`,
  `Product`, `aggregateRating` or any rating type — research is not commerce and nothing here is
  rated. Legs are described once, as `SportsEvent` entries under `about`; no competing `ItemList`,
  which would restate them in a weaker vocabulary and add an ordering claim the page does not make.

## Sitemap eligibility

Only `decision === INDEX` **and** page-type `sitemapEligible === true`.

Redirects and noindex URLs must never be sitemapped.

The `accas` shard (`app/sitemap.ts`, `generateSitemaps()` id `accas`) additionally guarantees:

- **Published records only.** Drafts, archived records and unpublished candidates never appear.
- **One URL per Acca**, under its own locale — not one per locale per Acca.
- An `/{locale}/accas` index URL only for locales that actually have a published Acca.
- No filtered or paginated variants are ever advertised.
- Nothing at all while `FF_PUBLIC_ACCA_PAGES_ENABLED=false` — sitemap inclusion follows public
  visibility.
- Fails soft: a storage outage omits Acca URLs for one crawl cycle rather than failing the sitemap.
