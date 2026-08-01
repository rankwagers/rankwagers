# Security

## Principles

- Fail closed for diagnostics, cron, metrics
- No security through robots/noindex alone
- Secrets via headers, never query strings (deployed)
- Destination URLs never come from the client on `/go`
- Attribution DB failure must not create open redirects

## Headers / CSP

Built by `lib/security/headers.ts` (+ `headers.cjs` for Next config).

- Production omits `unsafe-eval` (kept only for Next.js HMR in development)
- `unsafe-inline` retained for Next bootstrap + GTM (nonce migration tracked)
- HSTS **without preload** by default; set `HSTS_PRELOAD=true` + `HSTS_INCLUDE_SUBDOMAINS=true` only after domain readiness
- Sensitive routes (`/go`, `/api/internal`, diagnostics, admin, developer) send `Cache-Control: no-store`

## Feature flags

See `docs/feature-flags.md`. Security decisions are server-side only.

## Redirect tokens

See `docs/redirect-secret-rotation.md`. Format `r2`; verifies active + previous secrets.

## Affiliate Intelligence (Sprint 23)

Admin audits under `/admin/affiliate` must never display signing secrets or raw tokens. Export redaction strips `signedHref` / token-like strings. Client destination overrides on `/go` remain rejected.

## Experimentation (Sprint 25)

`FF_EXPERIMENTATION_ENABLED` defaults **false**. Admin write routes (`preview`/`validate`/`analyze`) use CSRF origin/bearer checks. No production activation endpoint. Exports strip IP/UA/secrets. No fingerprinting.

## Public Acca pages (Sprint 24)

The reader surface is **read-only by construction**. No public API was added: the pages are
server-rendered, so `GET /api/acca` and `GET /api/acca/{id}` would be a second surface to secure,
rate-limit and version for no capability gain. Publication remains the existing admin-only
`POST /api/admin/accas/{id}/publish`, behind admin auth, CSRF origin checks, per-identity rate
limits and mandatory `Idempotency-Key` + `expectedVersion`.

- No public surface can reach a mutation, an admin endpoint or the store — enforced by test across
  every route and component on the surface.
- **Two boundaries.** `lib/acca-publication/public.ts` decides which records are visible (PUBLISHED
  + matching locale + `publicAccaPagesEnabled`). `lib/acca-publication/publicView.ts` decides which
  fields are visible; public components are never handed an `AccaRecord`, so storage ids, candidate
  ids, payload checksums, actor fields and moderation metadata cannot be rendered.
- A draft, an archived record, another locale's slug, an unknown slug and a disabled flag all
  produce the **same 404** and the same metadata. An unpublished Acca leaks nothing, not even its
  existence, and never its stored title.
- Query input is bounded and validated: page number range-checked, facet values length- and
  character-bounded, unknown values ignored. No request value reaches a column name, a sort key or
  a sort direction — ordering is hard-coded in both adapters.
- Public reads **fail soft and safe**: a storage outage renders the empty state, never a stack
  trace, a driver message or a connection string.
- Analytics carries an exhaustive property allowlist (`PUBLIC_ACCA_ANALYTICS_PROPERTY_KEYS`) with
  no free-form bag. The slug is sent as `publicAccaId`; the storage id, filter values, referrer and
  any PII are not.
- No third-party script, share widget or tracking pixel was introduced.

## Request limits

`lib/security/requestLimits.ts` — JSON body caps for combo APIs (256KB), content-type checks, prototype-pollution guard.

## Request correlation (Sprint 19)

Middleware mints/propagates opaque `x-request-id` on responses and request headers. Ready endpoint logs the id. Never embed PII in request ids.

## CTA boundary

`npm run scan:cta-boundary` is required in CI and `validate:release` — no client-side signing.

## Audit

`docs/security-audit-phase-d.md` · `docs/sprint-19-completion-report.md`
