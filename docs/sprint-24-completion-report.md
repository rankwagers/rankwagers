# Sprint 24 completion report — Prediction Calibration, Builder Quality & Decision Governance

**Status:** COMPLETE on localhost · **not deployed** · Sprint 20B remains operator-gated  
**Date:** 2026-07-26

## Current-state capability audit

| Analysis | Status | Notes |
|----------|--------|-------|
| Settled W/L/void hit rate | fully_supported | Daily archives |
| Confidence-band observed rates | fully_supported | 0–100 archive confidence |
| Brier / log-loss / ECE | partial | Allowed under `CALIBRATABLE_PROBABILITY`; archives overwrite-mutable |
| Market / league calibration | fully_supported | Exact market keys preserved |
| Publication lead time | partial | `publishedAt` = archive `savedAt` proxy |
| Evidence completeness | partial | Heuristic from `evidenceSummary` |
| Immutable publication freeze | unavailable | Archives overwrite on re-save |
| Historical odds / ROI | unavailable | `originalOdds` always null |
| Builder generation counts | partial | Analytics events only |
| Combination / leg settlement | unavailable | No durable generation snapshots |
| Exclusion tallies / counterfactuals | unavailable / statistically_unsafe | Missing populations |
| Mode configuration ordering | fully_supported | `RISK_MODE_RULES` |

## Confidence semantics

- Scale: **0–100**
- Classification: `CALIBRATABLE_PROBABILITY` via `normalizeConfidence()`
- Normalization version: `24.0.0-pct100`
- Probability metrics (Brier/ECE/log-loss) computed only under probabilistic semantics

## Immutable snapshot coverage

- Primary cohorts use archive-time confidence/market/fixture + final settlement
- Issue `PUBLICATION_SNAPSHOT_MUTABLE` raised for best-effort archives
- No historical snapshot rewrite; no reconstructed confidence in primary path

## Cohort model

Explicit `cohortDefinition` on every section payload (date window + market/competition/country/q). Hidden filtering not used.

## Sample gates

Documented in `docs/calibration-sample-gates.md`. Statuses: INSUFFICIENT / EARLY_SIGNAL / REVIEWABLE / RELIABLE.

## Prediction calibration metrics (localhost evidence)

Window `2026-04-28 → 2026-07-26` (12 archive days):

| Metric | Value |
|--------|-------|
| Published | 1588 |
| Settled (W+L+V) | 1252 |
| Won / Lost / Void / Pending | 1010 / 223 / 19 / 336 |
| Hit rate | ~81.9% |
| Overall calibration gap | ~0.085 |
| Brier | ~0.151 |
| Confidence semantics | `CALIBRATABLE_PROBABILITY` |
| Settled combinations | Unavailable (`null`) |
| Mode ordering | `MATCHES_CONFIG` |

Confidence-band W/L/V reconciled with archive totals (`match: true`).

Notable bands (observed success among W+L):

| Band | Published | Observed | Sample |
|------|-----------|----------|--------|
| 70–74 | 118 | ~58.0% | REVIEWABLE |
| 75–79 | 138 | ~74.1% | RELIABLE |
| 80–84 | 90 | ~72.1% | REVIEWABLE |
| 85–89 | 171 | ~77.7% | RELIABLE |
| 90+ | 1071 | ~86.9% | RELIABLE |

## Builder findings

- Generations/transfers from analytics (1 successful generation in window)
- Settled legs/combinations: **Unavailable**
- Mode ordering: `MATCHES_CONFIG` (conservative 78 > balanced 70 > aggressive 62)
- Exclusions: Unavailable; retrospective policy `RETROSPECTIVE_DIAGNOSTIC_ONLY`

## Issue taxonomy

See `docs/calibration-issues.md`. Recommendations are review-required and non-automatic.

## Routes and APIs

- UI: `/admin/calibration/*` (AdminGate; `FF_ADMIN_ENABLED=false` → **404**)
- API: `/api/admin/calibration/[section]`, `/api/admin/calibration/export`
- Robots: `noindex, nofollow, noarchive` + `X-Robots-Tag`
- Rate limits + request IDs

## Exports

CSV/JSON with row limits; secrets stripped. Localhost CSV export for confidence bands returned 200 with disposition attachment.

## Files changed (primary)

- `lib/calibration-intelligence/*`
- `components/admin-calibration/*`
- `app/admin/calibration/**`
- `app/api/admin/calibration/**`
- `tests/sprint24CalibrationIntelligence.test.ts`
- Docs listed in sprint brief + product plan/matrix/backlog/architecture/analytics/a11y updates
- `components/admin-dashboard/AdminShell.tsx` (nav link)
- `docs/archive.md` (created — archive/calibration linkage)

## Validation results

| Gate | Result |
|------|--------|
| Full test suite | **388/388 PASS** |
| Lint | PASS |
| Typecheck | PASS |
| Production build | PASS (includes `/admin/calibration/*` + APIs) |
| Security scan | PASS (`ok:true`, scanned 786) |
| CTA boundary | PASS (`ok:true`, 0 findings) |
| Sprint 20 origin verification | **14/14 PASS** |
| Admin auth (API unauthenticated) | 401 + `x-robots-tag` |
| Admin auth (Bearer) | 200 overview JSON with requestId |
| Disabled admin | `route_disabled` status **404** |
| Rate limiting | 429 after burst on `/api/admin/calibration/overview` |
| CSV export | 200 + attachment |
| Page `/admin/calibration/overview` | 200, capability matrix + noindex meta |
| Archive W/L reconcile vs bands | PASS |
| No auto-tuning | Confirmed in code/docs |
| Staging / deploy | **Not started** |

## Localhost evidence notes

- Service evaluation and HTTP checks used real `data/daily-archives` on this workstation.
- Temporary `next start` on `127.0.0.1:3470` with process-only `ADMIN_KEY` (not written to `.env.local`).
- `.env.local` on this machine does not persist an `ADMIN_KEY`; operators must set one locally for ongoing admin use.

## Known limitations

1. Archives not append-only
2. Builder combination settlement Unavailable
3. ROI Unavailable without odds
4. Evidence bands are heuristic
5. Lead time uses archive save proxy
6. 70–74 band observed rate materially below higher bands — surfaced via sample-gated metrics/issues when thresholds met; no auto threshold change

## Deferred work

- Append-only publication snapshots (P1-24a)
- Persist Builder generation/combination snapshots (P1-24b)
- Sprint 25+ not started

## Auto-tuning confirmation

**No** prediction confidence values, Builder weights, or thresholds were modified by this sprint. System produces review recommendations only.

## Staging / deployment confirmation

**No** staging begun. **No** production deployment. **No** credentials requested. Sprint 20B remains operator-gated.

## Stop

Sprint 24 complete — awaiting approval. Do not begin Sprint 25 or Sprint 20B without explicit instruction.
