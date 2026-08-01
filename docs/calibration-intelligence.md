# Calibration Intelligence (Sprint 24)

Protected internal system for prediction calibration, Acca Builder quality measurement, and decision governance.

## Routes

- `/admin/calibration` → redirects to overview
- `/admin/calibration/overview`
- `/admin/calibration/confidence`
- `/admin/calibration/markets`
- `/admin/calibration/leagues`
- `/admin/calibration/predictions`
- `/admin/calibration/builder`
- `/admin/calibration/combinations`
- `/admin/calibration/exclusions`
- `/admin/calibration/cohorts`
- `/admin/calibration/issues`
- `/admin/calibration/methodology`

## APIs

- `GET /api/admin/calibration/[section]`
- `GET /api/admin/calibration/export?section=&format=csv|json`

Admin authorization matches Sprint 21+. Disabled admin → **404**. All responses: `noindex, nofollow, noarchive` + `X-Robots-Tag`.

## Domain

`lib/calibration-intelligence/*` — calculations are server-side, deterministic, and tested. React components only render results.

## Principles

- Measurement and governance only — **no auto-tuning** of confidence, weights, or thresholds
- Primary evaluation uses archive-time confidence + final settlement
- Daily archives are **best-effort publication proxies** (overwrite-mutable) — not append-only freeze
- Probability metrics only when confidence semantics allow
- ROI/return metrics stay **Unavailable** without complete historical odds
- Builder combination settlement **Unavailable** without durable generation snapshots
- Experiments (Sprint 25) must not rewrite historical publication snapshots, settlements, or calibration cohorts

## Versions

- Methodology: `24.0.0`
- Confidence normalization: `24.0.0-pct100`

See also: [confidence-semantics](./confidence-semantics.md), [methodology](./calibration-methodology.md), [sample gates](./calibration-sample-gates.md), [builder quality](./builder-quality-evaluation.md), [combination settlement](./combination-settlement.md), [issues](./calibration-issues.md).
