# Operator Bookmaker Mapping

## Canonical model

`lib/operators/bookmaker-mapping.ts`

Each operator has a mapping shell:

- `operatorId` (brand slug)
- `provider` (currently `api-football`)
- `providerBookmakerIds[]`
- `aliases[]` (exact match only)
- optional `countries[]`
- `confidence`: `verified` | `configured` | `unverified`
- `source`, `enabled`, `updatedAt`

## Current honest state

- **13** configured operator shells
- **0** verified API-Football bookmaker IDs
- **0** configured IDs
- All shells are `unverified` with empty `providerBookmakerIds`

Selection availability therefore remains **unknown** until explicit provider IDs are added via `MANUAL_BOOKMAKER_OVERRIDES`.

## Confidence rules

Positive availability (`full` / `partial`) requires:

- `verified`, or
- `configured` **with at least one explicit provider ID**

Unverified / empty ID lists never unlock positive availability.

No fuzzy name matching on request-time paths.

## Validation

Checks for duplicate provider IDs, conflicting canonical owners, alias collisions, country-scoped conflicts, disabled operators, and empty verified/configured ID lists.
