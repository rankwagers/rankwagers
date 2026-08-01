# Privacy & retention

## Attribution

- No email / raw IP / UA by default
- Click retention default 90 days (`purgeExpired`)
- Postback events store hashes/status — not raw unlimited payloads
- Dedup keys retained with conversions

## Snapshots

- Bounded normalized payloads only
- Retain active + previous valid for rollback
- Failed metadata ~7 days; superseded ~3 days
- Cleanup job never deletes active/previous pointers

## Metrics / logs

- Secret redaction in logger
- Metrics strip sensitive label keys/values
- Diagnostics/metrics endpoints gated

## Cleanup entry points

- `POST /api/internal/cron/cleanup`
- `runAttributionCleanupJob({ dryRun: true })`
