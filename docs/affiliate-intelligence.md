# Affiliate Intelligence (Sprint 23)

**Status:** Implemented on localhost · admin-only · not deployed  
**Entry:** `/admin/affiliate` → `/admin/affiliate/overview`

## Purpose

Protected operational intelligence for operator availability, placements, signed redirects, attribution, and conversion funnels — without fabricating revenue, FTDs, or bonuses.

## Principles

- Affiliate optimization stays subordinate to product trust
- Server-signed redirects only
- UNKNOWN availability is never treated as AVAILABLE
- No public “best operator” rankings from quality scores
- Honest Unavailable for missing metrics

## Architecture

```
lib/affiliate-intelligence/
  contracts · availability · operators · placements · attribution
  funnels · campaigns · redirects · scoring · quality · issues
  diagnostics · queries · aggregations · exports · service · analytics
```

## Admin routes

All reuse Sprint 21 admin auth + `noindex, nofollow, noarchive`:

| Path | Section |
|------|---------|
| `/admin/affiliate` | → overview |
| `/admin/affiliate/overview` | KPIs |
| `/admin/affiliate/operators` | Registry |
| `/admin/affiliate/placements` | Placement inventory |
| `/admin/affiliate/funnels` | Funnel steps |
| `/admin/affiliate/campaigns` | Campaign stubs |
| `/admin/affiliate/redirects` | Redirect health |
| `/admin/affiliate/availability` | Reason-coded matrix |
| `/admin/affiliate/issues` | Issue list |
| `/admin/affiliate/quality` | Internal scores |

## APIs

`GET /api/admin/affiliate?section=` · `?operatorId=` · `GET /api/admin/affiliate/export`

## Experimentation note (Sprint 25)

Experiment assignment must never override operator availability, destination allowlists, signed redirects, or UNKNOWN≠AVAILABLE. CTA experiments remain DRAFT templates only.

## Related

- `docs/affiliate-operator-registry.md`
- `docs/affiliate-placement-contracts.md`
- `docs/affiliate-attribution.md`
- `docs/affiliate-funnels.md`
- `docs/affiliate-quality-rules.md`
- `docs/sprint-23-completion-report.md`
