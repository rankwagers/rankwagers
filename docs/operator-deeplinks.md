# Operator Deeplinks

## Registry

`lib/operators/deeplink-registry.ts` + `lib/operators/build-deeplink.ts`

Priority:

betslip → market → fixture → football_landing → homepage → unavailable

## Current configuration

- Homepage capability for all 13 operators (from existing affiliate URLs)
- Football landing only when explicitly allowlisted (none today)
- **No** betslip / market / fixture capabilities (not invented)

## Security

- Templates are server-side only
- `allowedHosts` mandatory
- Client never receives destination URLs — only signed `/go/{slug}?ctx=…`
- Client-supplied `destination` / `url` / `redirect` / `host` are rejected
- Fallback reason returned when capability falls through

## Signed redirect

`lib/operators/redirect-token.ts` — HMAC short-lived opaque context (`r1.` prefix).

Contains operator/combo/placement/availability metadata. **Never** contains the affiliate destination URL.
