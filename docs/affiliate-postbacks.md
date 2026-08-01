# Affiliate Postbacks

## Route

`POST /api/affiliate/postback/[operatorSlug]`

## Adapter architecture

`lib/affiliate/postbacks/`

- `types.ts`, `registry.ts`, `verify.ts`, `normalize.ts`, `process.ts`
- `adapters/disabled.ts`

## Current status

All **13** adapters are `not_configured`.

- No simulated conversions
- No fake credentials
- No guessed field mappings
- Disabled adapters return HTTP 501 `not_configured`

## Conversion types

registration · first_deposit · qualified_ftd · revenue · rejected · chargeback

## Required before enabling an adapter

1. Partner specification
2. Auth method (shared secret / HMAC / IP allowlist)
3. Field mapping
4. Environment credentials
5. Configured status in registry

Raw payload retention is off by default (hash only).
