# Affiliate quality rules

Modules: `scoring.ts`, `quality.ts`, `issues.ts`

## Operator score components (internal only)

Configuration completeness · verified availability · signing health · verification status · compliance metadata

## Placement score components

Attribution schema · signing method · duplicate-CTA penalty · click-to-redirect (when available) · inventory quality status

## Hard rules

- Scores must never power public “best operator” UI
- `purpose: internal_operational_only`
- CRITICAL issues include unconfigured destinations that remain affiliate-enabled
- HIGH: unsigned redirect not required flag in deployed contexts

## Issue severities

CRITICAL · HIGH · MEDIUM · LOW · INFO — no automatic destructive fixes
