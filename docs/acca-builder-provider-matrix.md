# Acca Builder — provider capability matrix

Verified from repository integrations and runtime wiring used by `runAccaBuilder` (`lib/acca-builder/load.server.ts` → `prepareComboData`).  
Do not assume older docs without checking these paths.

| Source | Integration path | Fixtures | Predictions | Statistics | Odds | Live | Update / cache | Rate limits | Credentials | Localhost operational | Unavailable / partial |
|--------|------------------|----------|-------------|------------|------|------|----------------|-------------|-------------|----------------------|------------------------|
| FootyStats daily lists | `lib/footystats/client.ts` → `getDailyMatchListsSafe` | Today’s list rows (`over15`/`over25`/`fh`/`sh`) | List % potentials as confidence | Competition/country on row; not full team stats | No | `isLive` flag; finished filtered | Today: `unstable_cache` revalidate **300s**; archive for past dates | Provider HTTP limits; app uses cache | `FOOTYSTATS_*` env | Yes when key present; empty lists degrade honestly | No BTTS/1X2 lists; cancelled rows dropped in normalize |
| API-Football odds | `lib/api-football/odds.ts` → `getFixtureOdds` via `prepareComboData` enrichOdds | Fixture match by teams/kickoff | — | — | Decimal quotes when resolved | Not used for builder live markets | Cache revalidate **120s**; max **16** lookups/generation | Provider quota headers handled in reliability layer | `API_FOOTBALL_*` / related env | Partial — enrichment may be 0 quotes | Missing match mapping → odds unavailable (never invented) |
| Combo prepare snapshot | `lib/combo/prepare.ts` | Maps lists → qualified fixtures | Via list markets | — | Aggregates odds entries | Live rows skippable | In-process prepare; builder uses `persist: false` | Shares FootyStats + odds limits | Server-only | Yes via builder API | Snapshot empty when lists empty |
| Sprint 18G archive | `lib/footystats/dailyArchive.ts` + `lib/archive/*` | Historical settled days | Settled list outcomes | Aggregates on archive UI | Not used for builder ROI | — | File-backed `data/daily-archives` | N/A (local files) | None | Available for archive pages | **Builder scoring: skipped** until sample gates wired |
| Acca Studio / operators | `lib/acca/*`, `POST /api/acca/operators` | Uses transferred legs | Evidence on selection | — | From selection odds metadata | — | localStorage slip | Operator API rate limits | Affiliate signing secrets server-only | Yes after transfer | Availability may be unknown per operator |
| Live feed | `components/predictions/LiveFeedPanel` + live providers | Live context | Signals | — | — | Yes elsewhere | Separate from builder | Provider limits | Live env keys | Not default input for builder | `includeLive` default **false** |

## Expected provider calls per generation

1. FootyStats daily lists (cache hit possible)  
2. Up to **16** API-Football fixture odds lookups for unique fixtures  
3. Zero archive API calls in Sprint 19.5 builder path  
4. Zero per-combination provider fan-out  

## Localhost notes

- Builder works when FootyStats returns non-empty lists.  
- Odds may be `unavailable` / `partial` — combinations can still show with honest “odds unavailable”.  
- Target-odds mode excludes legs without real odds.  
