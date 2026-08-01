# Snapshot architecture

## Match-detail contracts (Sprint 18B)

Canonical match pages use typed domain models in `lib/fixtures/types.ts` (`MatchPageModel`, lifecycle + settlement enums).  
Server loader: `lib/fixtures/loadMatchPage.server.ts` (CTA signing + settlement).  
Settlement rules: `docs/prediction-settlement-methodology.md`.

Publication snapshots on the match page are **observed at page build** from provider potentials/odds. Qualified-list history uses durable daily JSON archives (`data/daily-archives`) projected by `lib/archive/*` (Sprint 18G). A Postgres append-only odds log remains a follow-on.

## Homepage trust aggregates (Sprint 18C)

`lib/homepage/trustPerformance.ts` builds `HomepageTrustModel` from `data/daily-archives/*.json` plus today's list settlement.  
Metrics are list-market W/L/pending/void only — no invented ROI. Contracts in `lib/homepage/types.ts` are UI-independent for future API/Flutter clients.

## Design tokens (Sprint 18F)

Runtime tokens in `app/globals.css`; Flutter-mappable names in `lib/ui/tokens.ts`.  
Docs: `docs/design-system.md`, `docs/accessibility.md`. Future dark theme slots reserved, not activated.

## Acca Studio contracts (Sprint 18E)

- Domain: `lib/acca/*` (rules, odds, risk, share, persistence) — UI-independent  
- Global workspace: `components/acca/AccaWorkspace` in locale layout  
- Operators: `lib/acca/operators.server.ts` signs `placement: acca_studio`  
- Docs: `docs/acca-studio.md`  
- `/acca` is **noindex** (including `?share=` restore links)

## Discovery & search contracts (Sprint 18D)

- Search index/engine: `lib/search/*` (fuzzy tier, archive-window fixtures, countries)  
- UI-independent graph vocabulary/contracts: `lib/knowledge-graph/contracts.ts`  
- Country landings: `lib/countries/landing.ts` + quality gate `lib/seo/indexability.ts`  
- Docs: `docs/search-discovery.md`  
- No mass PSEO page factory; thin hubs stay noindex

## Decision: bounded Postgres payload (Option A)

Prepared combo snapshots store **normalized, capped** JSON in Postgres (`provider_snapshots.payload`).

Why:

- Single-host PM2 deployment
- Combo payloads already bounded (≤400 fixtures, ≤800 odds, ~1.5MB cap)
- No object storage dependency for launch

Not stored: raw unlimited provider dumps, API keys, full upstream responses.

## Tables

- `provider_snapshots` — candidates + valid/failed/superseded
- `active_snapshots` — one active pointer per `snapshot_type`
- `refresh_jobs` — job audit trail (also mirrored in-process for diagnostics)

Migration: `db/migrations/20260726_create_provider_snapshots.sql`

## Atomic activation

1. Build independently (`prepareComboData`)
2. Validate completeness (`validateComboSnapshotPayload`)
3. Immutable `snapshot_id` + checksum
4. Persist candidate (`building` → `valid`)
5. Transactionally switch `active_snapshots`
6. Failed refresh **never** replaces active valid snapshot (last-known-good)

## Freshness thresholds (seconds)

| State | Default |
|---|---|
| current | ≤ 15m |
| recently_updated | ≤ 60m |
| stale_but_usable | ≤ 6h |
| expired | > 6h (hard fail readiness beyond expired policy) |

Env: `SNAPSHOT_FRESH_*_SEC`.

## Adapters

- Memory (tests / no DB)
- Postgres when `SNAPSHOT_DATABASE_URL` or attribution/odds URL set
