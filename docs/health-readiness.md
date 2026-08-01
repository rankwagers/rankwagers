# Health & readiness

## Liveness — `GET /api/health`

Shallow `{ "status": "ok" }` — process up.

## Readiness — `GET /api/health/ready`

Checks:

- env / SITE_URL
- database connectivity
- migration files present
- redirect signing secret
- active combo snapshot + age
- critical provider state
- attribution store mode
- diagnostics config safety
- rate limiter mode
- odds history / analytics soft signals

### Status rules

**healthy** — critical deps valid; active snapshot current/recent.

**degraded** — LKG stale_but_usable; provider degraded/quota; memory attribution in prod; optional gaps.

**unhealthy** — no valid snapshot / expired; DB down when required; migration missing; weak signing secret; invalid critical config.

Dev/test softens signing_secret and missing snapshot to degraded so local work continues.
