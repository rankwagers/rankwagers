# Affiliate attribution governance

Module: `lib/affiliate-intelligence/attribution.ts`

## Allowed fields

partner · operator · campaign · placement · page type · locale · country · fixture · competition · market · builder mode · Acca leg count · source channel · session correlation · request ID · signed redirect ID · timestamp

## Protected (client must not override)

operator · placement · campaign · partner · requestId · signedRedirectId

## Rules

- No PII
- Bounded string/number values
- Secret-like values rejected
- Unknown fields dropped with warning
- No arbitrary user-controlled campaign injection into protected fields

`/go` currently uses placement + operator (+ subid); `campaignId` on click records exists in schema but is not stamped by the route today.
