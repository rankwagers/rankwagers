# Performance budgets

Baselines should be measured on staging with durable LKG snapshots (Phase C load script).

| Surface | Baseline method | Budget (adopt after measure) | CI |
|---|---|---|---|
| Homepage SSR | smoke / Lighthouse | p95 < 2.5s TTFB staging | warn |
| Combo SSR (LKG) | smoke | p95 < 1.5s | warn |
| Combo generate API | `load:phase-c` | p95 < 800ms warm | warn |
| Ready endpoint | smoke | p95 < 500ms | warn |
| `/go` + attribution ok | local mock | p95 < 300ms | warn |
| `/go` + attribution fail | local mock | p95 < 300ms | warn |
| Public JS | build analyzer | document after first staging build | warn |

Do not invent hard fail thresholds without measured staging numbers. Re-run:

```
npm run load:phase-c -- https://staging-host
```

## Sprint 19 status

Code-level CWV prep documented in `docs/sprint-19-performance-audit.md` (`optimizePackageImports`, image remotePatterns).

Baselines **not yet measured** on live staging. Keep CI at **warn-only**. After measurement, record:

| Surface | p50 | p95 | p99 | samples | warn | block |
|---|---|---|---|---|---|---|
| Homepage SSR | _pending_ | | | | | |
| Combo SSR (LKG) | _pending_ | | | | | |
| Combo generate | _pending_ | | | | | |
| Ready | _pending_ | | | | | |
| `/go` attr ok/fail | _pending_ | | | | | |

Never remove evidence UI to hit budgets.
