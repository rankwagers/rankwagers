# Sprint 25 completion report — Experimentation Platform, A/B Testing Governance & Decision Quality

**Status:** COMPLETE on localhost · **not deployed** · Sprint 20B remains operator-gated  
**Date:** 2026-07-26

## Current-state capability audit

| Area | Status | Notes |
|------|--------|-------|
| Public analytics spine | fully_supported | `/api/analytics` + file log |
| Admin analytics separation | fully_supported | console channels per admin domain |
| Session ID | partial | `sessionStorage` tab-scoped |
| Durable anonymous visitor | unavailable | No consent-aware cookie ID |
| Consent gating | privacy_constraint | Reason code when `consentGranted === false`; banner not mounted |
| Feature flags | partial → extended | `experimentationEnabled` default **false** |
| Deterministic assignment | fully_supported | sha256 buckets |
| Exposure logging (live) | unavailable for real traffic | Disabled by default; 0 real exposures |
| FTD/revenue metrics | unavailable | Registry rejects |
| Production activation | unavailable | No endpoint (by design) |

## Supported exposure units

- **session** (partial stability)
- **request**
- **admin_test_identity** (preview)
- anonymous_visitor / device_like / locale_session documented as unavailable or future

## Assignment model

`sha256(experimentId|assignmentVersion|assignmentKey)` → `[0,1)`. Traffic % uses separate salt. Stable within key+version; changes when version changes. No `Math.random()`.

## Eligibility / variants / exposures

Reason-coded eligibility; CONTROL + TREATMENT variants with typed config (no secrets/executables). Exposure only after meaningful render; preview isolated; primary analysis uses first valid exposure.

## Metric / guardrail / SRM / stopping

Typed registry with primary mandatory. Guardrail breach → `STOP_FOR_HARM`. SRM: NO_ISSUE / WATCH / MATERIAL_SRM / INSUFFICIENT_DATA. Stopping recommendations manual-only; `mayAutoRollout() === false`.

## Environment / preview / SSR

LOCAL/TEST/STAGING/PRODUCTION aware. Localhost banner required. Preview does not record production exposure. Public boundary returns CONTROL when disabled.

## SEO / affiliate / calibration safety

Documented: no variant URLs; no operator eligibility override; no historical calibration rewrite.

## Routes & APIs

- UI: `/admin/experiments/*`
- GET `/api/admin/experiments/[section]`, `/export`
- POST `/api/admin/experiments/preview|validate|analyze`
- **No** `/activate` or production start endpoint

## Validation results

| Gate | Result |
|------|--------|
| Full test suite | **406/406 PASS** |
| Lint | PASS |
| Typecheck | PASS |
| Production build | PASS |
| Security scan | PASS (814 files) |
| CTA boundary | PASS |
| Origin verification | **14/14 PASS** |
| Disabled admin | 404 `route_disabled` |
| Templates | All DRAFT, trafficPercent=0 |
| Service overview | running=0, productionActivationAvailable=false |

## Confirmations

- **No real experiment was run**
- **No fabricated participants, uplift, or statistical significance claimed**
- **No staging or production deployment**
- **No infrastructure credentials requested**
- **Sprint 20B remains operator-gated**
- **Sprint 26+ not started**

## Deferred activation work

- P1-25a: consent-aware durable visitor ID
- P1-25b: operator-approved staging/production activation workflow

## Stop

Sprint 25 complete — awaiting approval.
