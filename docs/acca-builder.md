# Evidence-Based Acca Builder

**Canonical route:** `/{locale}/acca/builder`  
**API:** `POST /api/acca/builder`  
**Domain:** `lib/acca-builder/*`  
**UI:** `components/acca-builder/AccaBuilderView.tsx`

## What it is

Automatic, explainable accumulator generation from **published FootyStats daily list markets** and optional **API-Football odds enrichment**. Generated combinations transfer into existing **Acca Studio** (same slip model — no second state).

This is **not**:

- Acca Studio (manual leg selection)
- An AI model (do not call it “AI”)
- A bookmaker bet slip
- A guarantee of outcomes

## Relationship to `/combo`

`/{locale}/combo` **redirects** to `/acca/builder` (compatible `target` / `risk` / `country` query params preserved where useful). One generation engine only.

Legacy combo APIs under `/api/combo/*` remain for regression/tests but are not the product UI path.

## Configuration

| Control | Notes |
|---------|--------|
| Risk mode | `conservative` · `balanced` · `aggressive` — see methodology |
| Legs | 2–8, capped by risk mode |
| Min confidence | 50–99; floors also apply per risk mode |
| Markets | `over15`, `over25`, `fh`, `sh` (list-published only) |
| Competition / team filters | Optional string includes / excludes |
| Target odds | Optional; requires real odds on every leg |
| Pre-match only | Default on; live inclusion off until live path verified |
| One selection per fixture | Default on |

## Pipeline

1. Load bounded daily lists (+ ≤16 odds lookups)  
2. Normalize → attach odds → eligibility → score  
3. Conflict / correlation handling  
4. Bounded greedy combinations → rank  
5. Diagnostics + transfer drafts for Studio  

Provider volume per generation ≈ **1 list fetch + ≤16 odds lookups** (not N×candidates).

## Transfer into Acca Studio

- Empty Studio → replace with combination  
- Non-empty → merge / replace dialog  
- Preserves odds, evidence summaries, `source: "builder"`  
- Operator handoff remains server-signed via existing Acca operators API  

## Analytics

Events prefixed `acca_builder_*` — see `lib/acca-builder/analytics.ts` and `docs/analytics.md`.

## Evaluation (Sprint 24)

Admin Calibration Intelligence measures Builder **generation counts** from analytics. Durable generation/combination snapshots are not persisted today, so selected-leg and combination settlement remain **Unavailable**. See `docs/builder-quality-evaluation.md`. No automatic threshold tuning.

## Docs

- Methodology thresholds: `docs/acca-builder-methodology.md`  
- Provider matrix: `docs/acca-builder-provider-matrix.md`  
- Localhost acceptance: `docs/acca-builder-localhost-acceptance.md`  
- Builder quality evaluation: `docs/builder-quality-evaluation.md`  
