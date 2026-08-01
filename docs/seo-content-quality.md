# SEO content quality scoring

Engine: `lib/seo-intelligence/scoring.ts` + `content-quality.ts`

## Principles

- Explainable component scores — no opaque AI scoring
- Scores never override hard NOINDEX / REDIRECT / EXCLUDED / ERROR
- Thin detection uses structural/factual signals, not word-count filler rewards

## Components

| Component | Max / effect |
|-----------|----------------|
| Entity completeness | 15 |
| Unique factual content | 15 |
| Published evidence | 10 |
| Archive / settlement value | 10 |
| Metadata completeness | 10 |
| Schema validity | 10 (or Unavailable) |
| Internal-link support | 10 |
| Freshness | 10 (or Unavailable) |
| Duplicate-risk penalty | −10 |
| Thin-content penalty | −5 / −15 |
| Invalid-state penalty | −20 |

## Thin signals

Missing primary entity · no published prediction · no evidence · no archive value · too few fixtures · boilerplate-only · missing unique metadata · empty tables · placeholders · weak internal links · excessive overlap

Do not reward automatically generated filler text.
