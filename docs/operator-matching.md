# Combo Operator Matching

Module: `lib/combo/operators.ts`, `availability.ts`, `attribution.ts`

## Availability states

- `full` — every selection verified for the operator
- `partial` — subset verified; expose exact available selection count
- `unknown` — verification impossible (common today when bookmaker IDs are empty)
- `none` / unavailable — not placeable

## Ranking rules

- API returns ordered matches; UI must not re-rank
- Only `full` may receive Best Match / Full Combo Ready badges
- `unknown` must never imply the full combo can be placed
- Country eligibility is mandatory for affiliate CTAs

## Deep links

Hierarchy exists in types (`betslip` → `market` → `fixture` → `football_landing` → `homepage` → `unavailable`).

Current production affiliate surface uses validated `/go/{slug}` paths only. Unsafe absolute affiliate URLs are rejected (`isSafeGoPath`).

## Phase D

Availability resolves through `lib/combo/operator-availability.ts` using bookmaker-mapping confidence. With 0 provider IDs, all operators remain `unknown`. Ranking order is full > partial > unknown. Outbound paths use signed `/go/{slug}?ctx=…` tokens.

## UI

Unknown-heavy catalogs remain useful via Visit Operator, Copy Combo, and operator research links.
