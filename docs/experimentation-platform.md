# Experimentation Platform (Sprint 25)

Protected, deterministic, privacy-conscious experimentation capability for RankWagers.

## Defaults

- Public experimentation **disabled** (`FF_EXPERIMENTATION_ENABLED` default false)
- All catalog templates are **DRAFT** with `trafficPercent: 0`
- No production activation endpoint
- No auto-rollout
- Local admin UI banner: **LOCAL/TEST DATA — NOT REAL USER EVIDENCE**

## Routes

`/admin/experiments/*` — overview, definitions, assignments, exposures, metrics, results, guardrails, issues, methodology, audit

## APIs

- `GET /api/admin/experiments/[section]`
- `GET /api/admin/experiments/export`
- `POST /api/admin/experiments/preview` (localhost/admin-safe)
- `POST /api/admin/experiments/validate`
- `POST /api/admin/experiments/analyze` (synthetic fixtures only)

## Domain

`lib/experimentation/*` — assignment, eligibility, exposures, metrics, SRM, statistics, stopping rules.

Public boundary: `getExperimentAssignment`, `evaluateExperimentEligibility`, `recordExperimentExposure`, `getVariantConfig` — control fallback when disabled.

## Related docs

- [Definition contract](./experiment-definition-contract.md)
- [Assignment](./experiment-assignment.md)
- [Metrics](./experiment-metrics.md)
- [Statistics](./experiment-statistics.md)
- [Guardrails](./experiment-guardrails.md)
- [Privacy](./experiment-privacy.md)
- [Ethics](./experiment-ethics.md)
