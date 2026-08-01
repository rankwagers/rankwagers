# Affiliate operator registry

Source: `lib/affiliate-intelligence/operators.ts` over `lib/operators/registry` + `lib/brands`.

## Fields

stable operator ID · display name · partner ID · supported/blocked countries · markets · destination configured · active/inactive · verification · availability source · signing ready · disclaimer source · logo · fallback · known issues · availability decision + reason codes

## Availability decisions

`AVAILABLE` · `UNAVAILABLE` · `UNKNOWN` · `DISABLED` · `MISCONFIGURED` · `REVIEW_REQUIRED`

Empty `supportedCountries` means **no configured restriction** in product rules — not a legal clearance. With unknown visitor geo this yields **UNKNOWN** (never silently AVAILABLE for geo claims).

## Honest gaps

- Most brands do not set `acceptedCountries` today
- Postback adapters are disabled shells
- `campaignId` is not stamped by `/go` yet
- Deeplinks are homepage-capability first
