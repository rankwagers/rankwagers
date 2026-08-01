# Operator Availability Resolution

Module: `lib/combo/operator-availability.ts`

## Selection states

- `available` — verified/configured mapping + usable market mapping + fresh same-operator quote
- `unavailable` — explicit negative (country, disabled, unsupported market, invalid price)
- `unknown` — cannot verify (default for unverified shells)

## Combo states

- `full` — every leg `available`
- `partial` — known available count with remaining unavailable/unknown legs
- `unknown` — no positive available legs and no explicit all-unavailable
- `unavailable` / `none` — country ineligible, disabled, or every leg unavailable

**Unknown never upgrades to partial/full.**

## Operator-specific combined odds

Product of selection odds only when:

- every leg available
- same provider bookmaker ID
- fresh decimals
- no mixing bookmakers

Full availability may exist with “Combined operator odds unavailable” when price coverage is incomplete.

## Freshness

`lib/combo/operator-freshness.ts`: `current` | `recently_updated` | `stale` | `unavailable`

Stale prices cannot earn Highest Compatible Odds or betslip deeplinks.
