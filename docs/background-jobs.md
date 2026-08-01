# Background jobs

## Model

Not a general queue. Typed jobs with Postgres advisory locks (or memory locks in tests).

Job types: `fixtures_refresh`, `odds_refresh`, `evidence_prepare`, `snapshot_cleanup`, `attribution_cleanup`, `conversion_reconciliation`, `sitemap_refresh`.

States: queued → running → succeeded | failed | skipped | cancelled.

## Protected cron endpoints

All `POST` only, disabled unless `ENABLE_CRON=true`, secret via `x-cron-secret` (never query string):

- `/api/internal/cron/fixtures-refresh`
- `/api/internal/cron/odds-refresh`
- `/api/internal/cron/evidence-prepare`
- `/api/internal/cron/cleanup` (optional `x-cron-dry-run: 1`)

Rate limited. Overlap → `409` + `skipped` / `lock_unavailable`.

## Locking

`pg_try_advisory_lock` per job type when DB URL present. Process-local Set when `JOB_LOCK_ADAPTER=memory`.

Do not use `setInterval` inside Next.js.

## External cron example

```bash
curl -X POST https://rankwagers.com/api/internal/cron/evidence-prepare \
  -H "x-cron-secret: $CRON_SECRET"
```
