# Deployment assumptions

## Single-instance deployment

RankWagers is deployed as **one Node.js process** (PM2 `instances: 1`, `exec_mode: fork`).

Process-local state is therefore acceptable for launch:

| Concern | Implementation | Notes |
|---|---|---|
| Rate limiting | In-memory (`RateLimiter` interface) | Warns if multi-instance env detected |
| Circuit breakers | In-process | Shared breaker needed only if horizontally scaled |
| Metrics | In-memory aggregates | Export via protected `/api/internal/metrics` |
| Attribution | Postgres when URL set; else memory | Prefer Postgres in staging/prod |
| Snapshots | Postgres bounded payload + memory adapter | Active pointer in DB |
| Job locks | Postgres advisory locks | Memory adapter for tests |
| Next.js `unstable_cache` | Process-local | Not shared across instances |

**Do not scale to multiple Node instances** without shared rate limits / accepting breaker & cache divergence.

## SITE_URL

| Environment | Rule |
|---|---|
| development / test | Defaults to `http://localhost:3000` when unset |
| staging | `SITE_URL` required, HTTPS, real staging host |
| production | `SITE_URL` required — **startup fails if missing** |

Forbidden placeholders: `example.com`, `your-domain.com`.

## Cron

`ENABLE_CRON=true` + strong `CRON_SECRET` (header `x-cron-secret` only).

## Diagnostics

Feature flag + secret (+ optional IP allowlist). `noindex` is not security.

## Health

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness |
| `GET /api/health/ready` | Readiness (db, snapshot, env, providers, secrets) |

## Attribution write path

DB failure → log + metrics → **still redirect**.

## Monitoring

`MonitoringProvider` → console now → Sentry later. No vendor hard-wiring in Phase C.

## Phase C non-goals

No Redis, general queue, ORM, Kubernetes, multi-region, or production promote in this phase.
