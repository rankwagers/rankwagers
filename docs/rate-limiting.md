# Rate limiting

## Adapter

Memory fixed-window (`lib/security/rateLimit.ts`) for single PM2 fork.

Interface `RateLimiter` kept for future Postgres/Redis.

Startup warns if `PM2_INSTANCES` / `WEB_CONCURRENCY` > 1 with memory adapter.

## Fail modes

| Route | Adapter failure |
|---|---|
| Combo generate | fail-open + metric |
| Diagnostics / cron / postbacks | fail-closed |
| `/go` redirect | fail-open (never block safe redirect) |

Rejected requests emit `rate_limit_rejected_total` and `Retry-After` where applicable.

Stable codes: `rate_limited`, `limiter_unavailable`.

No Redis in Phase C.
