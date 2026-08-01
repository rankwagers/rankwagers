# Architecture notes (product surfaces)

## Acca surfaces (Sprint 18E + 19.5)

| Layer | Path | Role |
|-------|------|------|
| Acca Studio UI | `/{locale}/acca` | Manual slip workspace |
| Acca Builder UI | `/{locale}/acca/builder` | Automatic combination generation |
| Combo redirect | `/{locale}/combo` → builder | Single generation engine |
| Studio domain | `lib/acca/*` | Slip, odds, risk, share, persistence |
| Builder domain | `lib/acca-builder/*` | Eligibility, scoring, combinations (UI-independent) |
| Builder load | `lib/acca-builder/load.server.ts` | One snapshot: FootyStats lists + ≤16 odds |
| Studio API | `POST /api/acca/operators` | Server-signed affiliate CTAs |
| Builder API | `POST /api/acca/builder` | Validated config → ranked combinations |

## Published Acca surfaces (Sprint 20B-B + Sprint 24)

The **plural** `/{locale}/accas` family is the public, crawlable record of published Accas. It is a
different product from the singular `/{locale}/acca` family above, which is the private workspace
(Studio) and the generator (Builder), both `noindex`. There is deliberately **no**
`/{locale}/acca/{slug}` route: a second indexable URL for one document is a duplicate by
construction.

| Layer | Path | Role |
|-------|------|------|
| Public index | `/{locale}/accas` | Server-rendered list, filters, pagination |
| Public detail | `/{locale}/accas/{slug}` | Server-rendered record of one published Acca |
| Admin Studio | `/admin/accas`, `/admin/accas/{accaId}` | Operator review, publish, archive |
| Publication domain | `lib/acca-publication/*` | Contracts, lifecycle, service, adapters |
| Visibility boundary | `lib/acca-publication/public.ts` | The ONE place status + locale + flag are checked |
| Field boundary | `lib/acca-publication/publicView.ts` | The ONE place record → public projection |
| Freshness | `lib/acca-publication/freshness.ts` | Availability + odds-age derivation (pure) |
| Index model | `lib/acca-publication/publicIndex.ts` | Facets, filtering, paging, indexability (pure) |
| URLs | `lib/acca-publication/paths.ts` | Path + canonical URL construction (single source) |
| SEO | `lib/acca-publication/seo.ts`, `schema.ts` | Metadata and structured data |

### Publication chain

```
Builder combination
  → POST /api/admin/builder-approval/candidates              candidate DRAFT v1
  → .../approve                                              APPROVED v2
  → .../create-acca      (one transaction)                   candidate CONVERTED v3 + Acca DRAFT v1
  → POST /api/admin/accas/{id}/publish                       Acca PUBLISHED v2  → publicly visible
  → POST /api/admin/accas/{id}/archive                       Acca ARCHIVED v3   → withdrawn, terminal
```

One candidate produces at most one Acca, ever. One slug identifies at most one Acca, ever. The
published business snapshot is immutable; only lifecycle status, version and audit timestamps move.
Full detail: `docs/acca-publication-operations.md`.

### Two boundaries, not one

`public.ts` decides **which records** a reader may see (PUBLISHED + matching locale + flag on).
`publicView.ts` decides **which fields** of a visible record a reader may see. Public pages consume
the projection only; they are never handed an `AccaRecord`, so a storage id, a candidate id or a
payload checksum cannot reach a page even by accident.

## Data flow

```
FootyStats daily lists (+ optional API-Football odds)
  → normalize / eligibility / score
  → combinations (greedy, bounded)
  → AccaSelectionDraft[] (source: builder)
  → AccaProvider.transferBuilder (merge|replace)
  → Acca Studio slip (localStorage)
  → operators API → /go signed redirect
```

## Principles

- No second slip store  
- No invented fixtures, confidence, odds, ROI, or EV  
- CTA signing stays server-only  
- Flutter-ready pure domain modules where practical  

## SEO Intelligence (Sprint 22)

| Layer | Path | Role |
|-------|------|------|
| Domain | `lib/seo-intelligence/*` | Indexability, quality contracts, sitemap/schema/link audits |
| Admin UI | `/admin/seo/*` | Protected intelligence dashboards |
| Admin API | `/api/admin/seo/*` | Bounded JSON + CSV/JSON export |
| Crawl quality | `lib/crawl-quality/*` | Reused inventory / links / schema / sitemap mirror |
| Public SEO | `lib/seo.ts`, `app/sitemap.ts`, `app/robots.ts` | Live metadata + crawl surfaces |

## Affiliate Intelligence (Sprint 23)

| Layer | Path | Role |
|-------|------|------|
| Domain | `lib/affiliate-intelligence/*` | Registry, availability, placements, funnels, redirect health |
| Admin UI | `/admin/affiliate/*` | Protected operational dashboards |
| Admin API | `/api/admin/affiliate/*` | Bounded JSON + CSV/JSON export |
| Public handoff | `app/go/[brand]`, `lib/operators/go-path.ts` | Server-signed redirects only |

## Calibration Intelligence (Sprint 24)

| Layer | Path | Role |
|-------|------|------|
| Domain | `lib/calibration-intelligence/*` | Confidence bands, sample gates, ECE/Brier, Builder quality, issues |
| Admin UI | `/admin/calibration/*` | Protected governance dashboards |
| Admin API | `/api/admin/calibration/*` | Bounded JSON + CSV/JSON export |

No automatic model or threshold changes. Combination settlement requires durable Builder snapshots (Unavailable today).

## Experimentation Platform (Sprint 25)

| Layer | Path | Role |
|-------|------|------|
| Domain | `lib/experimentation/*` | Definitions, deterministic assignment, eligibility, SRM, metrics |
| Admin UI | `/admin/experiments/*` | Governance dashboards (local/test banner) |
| Admin API | `/api/admin/experiments/*` | JSON + export + preview/validate/analyze |
| Public boundary | `lib/experimentation/public.ts` | Disabled by default → CONTROL fallback |

No production activation endpoint. No auto-rollout. No fabricated experiment results.

Related: `docs/snapshot-architecture.md`, `docs/acca-builder.md`, `docs/acca-studio.md`, `docs/seo-intelligence.md`, `docs/affiliate-intelligence.md`, `docs/calibration-intelligence.md`, `docs/experimentation-platform.md`.
