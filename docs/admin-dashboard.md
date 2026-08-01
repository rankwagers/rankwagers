# Internal Intelligence Dashboard (Sprint 21)

**Status:** Implemented · not public · not indexable  
**Entry:** `/admin` → `/admin/dashboard`

## Purpose

Admin-only analytics for prediction quality, builder performance, operators, search, and system health. Primary post-launch decision tool.

## Access

- Existing admin auth (`ADMIN_KEY` → HttpOnly session cookie or Bearer)
- Kill switches: `FF_ADMIN_ENABLED`, `FF_EMERGENCY_DISABLE_ADMIN`
- Middleware + metadata: `noindex, nofollow, noarchive`
- Anonymous visitors see login only (or 404 when admin disabled)

## Routes

| Path | Section |
|------|---------|
| `/admin` | Redirect → dashboard |
| `/admin/dashboard` | Overview |
| `/admin/predictions` | Prediction quality |
| `/admin/markets` | Market analysis |
| `/admin/leagues` | League analysis |
| `/admin/builder` | Acca Builder intelligence |
| `/admin/operators` | Operator redirects / CTR |
| `/admin/search` | Search intelligence |
| `/admin/system` | System health |
| `/admin/traffic` | Legacy site view/click analytics |
| `/admin/seo/*` | SEO Intelligence (Sprint 22) — see `docs/seo-intelligence.md` |
| `/admin/affiliate/*` | Affiliate Intelligence (Sprint 23) — see `docs/affiliate-intelligence.md` |
| `/admin/calibration/*` | Calibration Intelligence (Sprint 24) — see `docs/calibration-intelligence.md` |
| `/admin/experiments/*` | Experimentation Platform (Sprint 25) — see `docs/experimentation-platform.md` |

## APIs

| Endpoint | Notes |
|----------|--------|
| `GET /api/admin/dashboard?section=` | JSON section payload |
| `GET /api/admin/dashboard/export?section=&format=csv\|json` | Download export |

Both require admin authorization. Responses set `Cache-Control: no-store` and robots headers.

## Architecture

```
lib/admin-dashboard/
  contracts.ts      DTOs + MetricValue
  filters.ts        Date/competition/market filters
  queries.ts        Server-side archive + analytics load (bounded)
  aggregations.ts   Pure aggregations (no React)
  formatters.ts     Metric helpers
  export.ts         CSV / JSON
  charts.ts         Chart math for client bars
  service.ts        Section orchestration
  adminAnalytics.ts Admin-only console channel (not public analytics)
```

UI: `components/admin-dashboard/*`  
Aggregation runs on the server; browsers receive pre-aggregated DTOs.

## Honesty rules

- Never fabricate statistics.
- Missing inputs → `{ available: false, reason }` rendered as **Unavailable**.
- Average odds / ROI never computed without archived publication odds.
- In-memory search counters are not used (non-durable).

## Related

- Metrics catalog: `docs/admin-metrics.md`
- Auth: `docs/admin-authentication.md`
- Completion: `docs/sprint-21-completion-report.md`
