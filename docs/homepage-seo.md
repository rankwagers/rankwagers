# Homepage SEO (Sprint 18C)

## Goals

The homepage is the primary organic entry for RankWagers as a **football betting decision-support** product — not a bookmaker landing page or scoreboard clone.

## Metadata

- Title / description: `dict.predictions.metaTitle` / `metaDescription` via `pageMetadata` in `app/[locale]/page.tsx`
- Canonical + hreflang + Open Graph + Twitter: provided by `lib/seo.ts` `pageMetadata`
- JSON-LD: `PredictionsPageJsonLd`

## On-page structure

Heading hierarchy (home):

1. `h1` — product value proposition  
2. Section `h2`s — top picks, markets, live, verified performance, recent results, leagues, Acca entry, operators, research queue, why trust, archive entry, methodology  

Internal links target existing entity hubs (`/competitions`, `/markets`, `/teams`, `/operators`, `/countries`, `/fixtures/{id}`, `/search`, `/archive`, `/methodology`) and homepage anchors (`#verified-performance`, `#methodology` research notes).

## Content rules

- No guaranteed-win claims  
- No fabricated performance metrics  
- Hit rate only when settled W+L sample exists  
- ROI / average odds omitted until durable publication odds archive exists  

## Programmatic SEO readiness

Sprint **18D** delivered quality-gated country landings and universal search (see `docs/search-discovery.md`). Sprint **18G** delivered prediction archive IA and methodology pages (see `docs/transparency.md`). Mass doorway PSEO remains out of scope.
