# M0 — Configuration Decision Record
### Frozen upstream-configuration defaults & semantics for Sprint 23B, Phase 2.7. Authoritative for `lib/evidence-capture/config.ts` (`resolveEvidenceUpstreamConfig`).

These values are **frozen**. Changing any of them is a configuration decision that requires a new record; it is not an implementation detail. The running implementation matches this record exactly.

## Frozen defaults

| Field | Frozen default | Env var | Specification source |
|---|---|---|---|
| `globalConcurrency` | `4` | `EVIDENCE_UPSTREAM_GLOBAL_CONCURRENCY` | Conservative total in-flight provider calls. |
| `footystatsConcurrency` | `2` | `EVIDENCE_UPSTREAM_FOOTYSTATS_CONCURRENCY` | Conservative single-provider parallelism (≤ global). |
| `teamStatsTtlMs` | `21600000` (6h) | `EVIDENCE_TEAM_STATS_TTL_MS` | `SNAPSHOT_FRESH_STALE_SEC = 21600` (`.env.example`). |
| `leagueBaselineTtlMs` | `86400000` (24h) | `EVIDENCE_LEAGUE_BASELINE_TTL_MS` | `SNAPSHOT_FRESH_EXPIRED_SEC = 86400` (`.env.example`). |
| `matchDetailTtlMs` | `300000` (5m) | `EVIDENCE_MATCH_DETAIL_TTL_MS` | FootyStats client `revalidate: 300` (`lib/footystats/client.ts`). |
| `maxSourceAgeMs` | `86400000` (24h) | `EVIDENCE_MAX_SOURCE_AGE_MS` | `SNAPSHOT_FRESH_EXPIRED_SEC = 86400` (`.env.example`). |
| `requestBudget` | `null` | `EVIDENCE_UPSTREAM_REQUEST_BUDGET` | Unset/blank ⇒ null (no ceiling). |
| `retryLimit` | `3` | `EVIDENCE_UPSTREAM_RETRY_LIMIT` | `DEFAULT_RETRY.maxAttempts = 3` (`lib/providers/reliability/policy.ts`). |
| `runDeadlineMs` | `300000` (5m) | `EVIDENCE_RUN_DEADLINE_MS` | Bounded to the provider cache cadence (`revalidate: 300`). |
| `staleFallbackAllowed` | `false` | `EVIDENCE_STALE_FALLBACK_ALLOWED` | Contract §5.13 — never freeze stale as evidence. |
| `maxFailureRatio` | `0.5` | `EVIDENCE_MAX_FAILURE_RATIO` | Conservative run-abort threshold (>50% failures). |
| `cacheVersion` | `1` | `EVIDENCE_CACHE_VERSION` | Initial cache namespace version. |
| `cacheAdapter` | `"memory"` | `EVIDENCE_UPSTREAM_CACHE_ADAPTER` | Matches `SNAPSHOT_ADAPTER=memory` / `ATTRIBUTION_ADAPTER=memory` (`.env.example`). |

## Frozen semantics

- **`requestBudget = null`** means **no explicit configured provider-budget ceiling**. It never disables concurrency, the run deadline, the fixture cap, retry, or any provider safety control — those remain fully enforced.
- **`matchDetailTtlMs = 0`** is meaningful: it means **cache bypass**. Zero is accepted only for this field.
- **All other positive-only integer fields reject zero** (`globalConcurrency`, `footystatsConcurrency`, `teamStatsTtlMs`, `leagueBaselineTtlMs`, `maxSourceAgeMs`, `retryLimit`, `runDeadlineMs`, `cacheVersion`) and fall back to their frozen default.
- **`maxFailureRatio`** accepts finite values in the inclusive interval **[0, 1]**; anything non-finite or out of range falls back to `0.5`.
- **Stale fallback defaults off** (`staleFallbackAllowed = false`); it is enabled only by explicit `true`/`1`.
- **Postgres is selectable but no Postgres cache is activated by M0.** `cacheAdapter` parses and returns `"postgres"` as a valid selector value; M0 implements **no** cache and activates **no** Postgres store. Activation is a later milestone and an out-of-repo operational action.
- **Deterministic fallback.** Malformed, blank, negative, non-finite, and unsupported values fall back deterministically to the frozen defaults above.
- **No side effects.** Importing `config.ts` performs no I/O and no `process.env` mutation; the resolver reads only its injected `env` argument and never calls `Date.now()`, creates clients, or initializes caches.

## Verification basis
Frozen defaults and semantics are proven by `tests/evidenceUpstreamConfig.test.ts` (13 tests): conservative defaults, valid overrides, malformed/negative fallback, `matchDetailTtlMs=0` acceptance, strict-positive zero rejection, `requestBudget` null/positive semantics, boolean parsing, adapter validation, `maxFailureRatio` boundaries, env-object injection, and no import side effects.
