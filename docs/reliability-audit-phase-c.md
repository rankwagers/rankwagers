# Sprint 17 Phase C — Reliability audit refresh

Date: 2026-07-25

## Findings (pre-implementation)

### Provider calls without reliable timeout

| Location | Issue |
|---|---|
| `lib/api-football/enrich.ts` | Raw `fetch` without AbortController |
| `lib/footystats/matchDetail.ts` | Raw `fetch` without timeout |
| `lib/api-football/request.ts` | Timeout existed but errors swallowed to `null` |
| `lib/footystats/client.ts` | Timeout existed; no retry/classification |

### Retries

None before Phase C (beyond Next `unstable_cache` revalidation).

### Error formats

Ad-hoc `null` returns; no stable provider error codes.

### Blocking provider I/O on user paths

- `prepareComboData({ enrichOdds: true })` on SSR/combo prepare
- `getFixtureOdds` via `unstable_cache` (120s) still hits network on miss
- Match detail FootyStats team stats on entity pages

### Stale-data fallbacks

- FootyStats daily archive (`dailyArchive`)
- Process prepared combo singleton
- Odds history memory fallback when DB unset

### Snapshot mutation risks

- `setPreparedComboData` mutates process singleton non-atomically
- No durable active pointer before Phase C

### Non-atomic refresh

Prepare overwrote process state immediately; failure could leave empty/partial local state.

### Process-local reliability state

Rate limits, combo sessions, prepared data, search/discovery Maps, circuit (new), metrics (new).

### Jobs to externalize

Fixtures/odds/evidence refresh + cleanup — cron endpoints (not `setInterval`).

## Blockers

None — single-instance PM2 + Postgres sufficient; no Redis/queue required for Phase C.

## Follow-ups applied after audit agent

- `/combo` SSR now uses `resolveComboClientSnapshot` (durable LKG first; live prepare only on cold miss)
- Analytics outbound `fetch` uses AbortController timeout (default 3s)
