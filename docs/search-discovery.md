# Search & Discovery (Sprint 18D)

## Universal search

Engine: `lib/search/engine.ts`  
Index: `lib/search/indexer.ts` (registries + country hubs + short-horizon fixtures from `data/daily-archives`)  
API: `GET /api/search`  
UI: `components/search/GlobalSearch.tsx`  
SSR page: `app/[locale]/search/page.tsx` (**always noindex**)

### Indexed entity types

competition · season · team · fixture · market · operator · country

### Match tiers (best → weakest)

`exact_slug` → `exact_title` → `exact_alias` → `prefix` → `contains` → `fuzzy`

Fuzzy (`lib/search/fuzzy.ts`) is typo tolerance only (bounded edit distance). It never invents entities.

### Fixtures

Indexed from the last ~3 daily archive files (sync, no live provider I/O). Deep link: `/{locale}/fixtures/{matchId}`.

### UX

- Grouped results + keyboard navigation  
- Highlight matching text  
- Recent searches (localStorage) on empty results  
- Graceful loading / empty / error states  

## Entity graph contracts

`lib/knowledge-graph/contracts.ts` — UI-independent DTOs + vocabulary for Country → … → Archive.

Country graph paths resolve to `/countries/{code}` (quality-gated landings).

## Country landing foundation

- Index: `/{locale}/countries`  
- Detail: `/{locale}/countries/[code]`  
- Assembly: `lib/countries/landing.ts`  
- Indexability: `lib/seo/indexability.ts` (`countryLandingIndexability`)  
- Sitemap shard: only codes that pass the gate  

Configured profiles include BR, NG, JP, DE, GB, US, IN, CO, ID, VN. Thin/doorway hubs stay noindex.

## What this sprint does not do

- Mass PSEO page generation  
- Archive search/filters on `/archive` (18G)  
- Voice/alerts later  

- Acca Studio (18E)  
- Flutter app / deploy  
