# Observability

## MonitoringProvider

`lib/monitoring/provider.ts` — console today; Sentry later. Never hard-wire a vendor in app code.

## Structured logger

`lib/monitoring/logger.ts` — JSON lines, secret redaction, scopes.

## Metrics

`lib/observability/metrics.ts` — in-memory counters/gauges/timers + structured export.

Protected exposure: `GET /api/internal/metrics` (diagnostics auth).

Never expose: revenue, commission, conversion values, private scores, secrets, raw click IDs.

## Key metrics

Application, combo, affiliate, provider, jobs, database — see Phase C checklist in `docs/next-sprints.md`.
