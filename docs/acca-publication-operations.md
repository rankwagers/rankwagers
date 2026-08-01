# Acca Publication — Operations

**Sprint 20B-B (stages B1–B6)**, extended by **Sprint 24 (public Acca pages & shareable Accas)**.
Companion to `docs/builder-approval-operations.md`.

This document describes how a Builder candidate becomes a published, publicly readable Acca, what
each guarantee actually rests on, and — explicitly — what has **not** been proven.

---

## 1. The chain

```
Builder combination
  └─ POST /api/admin/builder-approval/candidates              (Sprint 20B-A)
       → candidate DRAFT v1
          └─ POST .../candidates/{id}/approve                 → APPROVED v2
          └─ POST .../candidates/{id}/reject                  → REJECTED v2   (terminal)
             └─ POST .../candidates/{id}/create-acca          → candidate CONVERTED v3
                                                                + Acca DRAFT v1   (ONE transaction)
                  └─ POST /api/admin/accas/{id}/publish       → PUBLISHED v2  (publicly visible)
                       └─ POST /api/admin/accas/{id}/archive  → ARCHIVED v3   (terminal, withdrawn)
```

A candidate produces **at most one** Acca, ever. A slug identifies **at most one** Acca, ever.

---

## 2. Enabling the feature

Everything above is dark by default. `operatorApprovalEnabled` is `false` in **every** environment,
including local.

```bash
FF_OPERATOR_APPROVAL_ENABLED=true
```

While disabled, every admin API and admin page returns **404** — deliberately indistinguishable
from a route that does not exist, so nothing is leaked to an unauthenticated caller. Disabling the
flag again closes the surface but changes no stored data; an already-published Acca stays published
in storage and simply cannot be administered until the flag returns.

Emergency kill switch (existing, unchanged): `FF_EMERGENCY_DISABLE_APPROVAL=true`.

---

## 3. Operator workflow

1. **Review** — `/admin/builder-approval` → open a candidate. The detail page shows the immutable
   stored payload; nothing is recomputed.
2. **Approve or reject** — rejection requires a bounded reason (≤500 chars) and is final.
3. **Create the Acca** — from an APPROVED candidate. You supply only **title, optional summary and
   locale**. Legs, odds, evidence, qualification and every lifecycle field are derived server-side;
   sending any of them is a `400`, not a silent drop.
4. **Review the draft** — `/admin/accas/{id}`. Check the **Evidence** panel. If it warns that the
   Acca carries no evidence lines, no warnings, no completeness signal and no per-selection
   confidence, publishing it would show readers a combination with nothing to explain it. The system
   does not block this; the decision is yours.
5. **Publish** — makes it publicly visible at `/{locale}/accas/{slug}`.
6. **Archive** — withdraws it from every public surface immediately. Archiving is **final**: an
   archived Acca cannot be re-published, because changing what a reader already saw would undermine
   the record. Publish a new Acca instead.

### Locale

An Acca is published under **one** locale and appears in that locale only. It is never echoed
across the other 29. The create form offers only locales this site actually serves; the API refuses
anything else with `invalid_metadata` / `locale_not_served_by_this_site`, because middleware only
routes known locale prefixes and an Acca under an unserved locale would be permanently unreachable.

---

## 4. What the public sees

| Status | Listed at `/{locale}/accas` | Detail page | Homepage | Sitemap |
|---|---|---|---|---|
| DRAFT | no | 404 | no | no |
| PUBLISHED | yes | yes | up to 3, newest | yes |
| ARCHIVED | no | 404 | no | no |

A draft, an archived record, an unknown slug and a slug from another locale all produce the **same**
404 — a reader cannot use the public route to discover that an unpublished Acca exists.

**Indexability is earned.** `/{locale}/accas` is served `noindex, follow` until that locale has at
least one published Acca, and the sitemap emits no Acca URLs at all while nothing is published.

Every public Acca page states that it is a record of evidence and not a recommendation, and that
the odds were captured at publication and are never re-fetched.

### Canonical URL policy

The public family is **plural**: `/{locale}/accas` and `/{locale}/accas/{slug}`. The singular
`/{locale}/acca` family is the Studio and the Builder — a different, `noindex` product. No
`/{locale}/acca/{slug}` route exists and none may be added: a second indexable URL for one document
is a duplicate by construction.

- Identity is the **slug**, not the storage id, and not the title. Renaming is not possible — the
  business snapshot is immutable — so a shared link cannot rot because someone edited a heading.
- Every absolute URL comes from `publicAccaCanonicalUrl` in `lib/acca-publication/paths.ts`. Links,
  share controls, structured data and the sitemap therefore cannot disagree.
- A detail page declares a canonical and **no locale alternates**. An Acca exists in one locale;
  every other locale 404s for that slug, and advertising 29 URLs that 404 was a real defect fixed
  in Sprint 24.
- `?page=1` is never emitted anywhere. Page one is the bare path.
- Filtered views (`?profile=`, `?competition=`, `?state=`) canonicalise to the bare index and are
  served `noindex, follow`. Real pagination (`?page=2` unfiltered) is indexable and has its own
  canonical and title.

### Freshness policy

Two independent dimensions, derived in `lib/acca-publication/freshness.ts` from the stored snapshot
plus the server clock. Nothing polls, nothing re-fetches, nothing is estimated.

| Dimension | States | Derived from |
|---|---|---|
| Availability | `ACTIVE` · `PARTIALLY_STARTED` · `EXPIRED` · `WITHDRAWN` · `UNKNOWN` | Stored kick-off times vs now; `ARCHIVED` outranks all |
| Odds freshness | `FRESH` · `STALE` · `UNKNOWN` | Hours since capture vs `ACCA_ODDS_STALE_AFTER_HOURS` (24) |
| Settlement | `NOT_RECORDED` only | Nothing — see below |

- **24 hours** matches the Builder's daily list cycle: a price older than one cycle is one a reader
  should not assume is still on offer. It is a constant, not an environment variable — a disclosure
  that varies between deployments is not a disclosure.
- Staleness changes what the page **says**. It never hides a page, never de-indexes one, and never
  alters a stored value.
- `UNKNOWN` is used whenever a timestamp cannot be read. The state is stated, never guessed.
- **Settlement is not supported.** An `AccaRecord` carries no result for any leg and nothing writes
  back to it, so the page says outcomes are not recorded here and points at `/{locale}/archive`,
  which does carry settled single predictions. Adding a "settled" badge would mean inventing one.

### Revision policy

The published snapshot is immutable and is never rewritten. Later corrections do not edit history:

- Withdraw the record with **archive** — final, and immediate on every public surface.
- Publish a **new** Acca from a new candidate.

`ARCHIVED` is terminal precisely so that re-publishing cannot silently change what a reader already
saw. There is no update, patch, save or delete operation anywhere in the store contract.

### Public/private field boundary

`lib/acca-publication/publicView.ts` projects a stored record into a `PublicAccaView`, field by
field. The record is never spread, so a field added later cannot appear on a public page by
default. Deliberately dropped, and asserted by test:

`accaId` · `sourceCandidateId` · `sourceReferences` (candidate id, request id, snapshot id, payload
checksum) · `version` · `updatedAt` · `archivedAt` · `createdBy` / `publishedBy` / `archivedBy` ·
raw `status` · `schemaVersion` as a labelled internal field.

What replaces them: the slug as the public identity, the derived availability state instead of the
raw status, and a provenance line stating that every value was copied from the approved candidate
at publication and is never re-fetched.

The **generation methodology version is not recorded on the snapshot**. The page says so and links
to `/{locale}/methodology` rather than presenting the publication format version as if it were a
model version.

---

## 5. Concurrency and retries

- Every mutation requires `expectedVersion` (or `expectedCandidateVersion`). A stale caller gets a
  typed `409` and nothing moves.
- Every mutation requires an `Idempotency-Key` header (8–200 chars, `[A-Za-z0-9._:-]`). A repeat
  with the same key and body **replays** the stored response; the same key with a different body is
  `409 idempotency_conflict`.
- The Studio mints one key per action per page load, so a double-click replays rather than mutating
  twice.

> **Idempotency and rate limiting are memory-only and process-local.** Under more than one Node
> process they do not coordinate. What still protects correctness is the `expectedVersion`
> precondition, which is enforced in storage. Idempotency is a response-stability mechanism here,
> **not** the concurrency guarantee.

Rate limits (per minute, per admin identity, fail-closed): candidate lifecycle 10 · Acca creation 5
· Acca lifecycle 10 · admin reads 30.

---

## 6. Security model

- Admin auth is the existing shared secret (Bearer or HMAC-signed session cookie). There are **no
  named operator accounts**, so every actor is recorded as the coarse `"admin"` — meaning "an
  administrator", never an individual. Do not present it as personal attribution.
- Actor identity is always server-derived. `x-user-id`, `x-admin`, `x-role`, query-string roles and
  body `actor`/`createdBy` are ignored or rejected.
- CSRF is enforced on every mutation via parsed canonical-origin comparison; verified-bearer
  requests are exempt for the reason documented in `lib/security/adminCsrf.ts`.
- Failure responses are assembled from an allowlist. SQL text, constraint names, connection
  strings, driver messages and stack traces never reach a caller.

---

## 7. Storage

| Adapter | Durable | Use |
|---|---|---|
| memory (default) | **no** | tests, local development |
| postgres | yes | set `ACCA_PUBLICATION_DATABASE_URL`, or reuse `BUILDER_APPROVAL_DATABASE_URL` / `DATABASE_URL` |

Migration: `db/migrations/20260728_create_published_accas.sql`. Apply per
`docs/migration-runbook.md`. It is additive, creates one table, and touches no existing table.

The admin Studio labels memory storage "Not durable — lost on restart, and process-local", and warns
before publishing from it.

---

## 8. Honest status

```
Implemented and tested locally .......... B1 domain, B2 persistence, B3 APIs,
                                          B4 admin Studio, B5 public pages, B6 integration
PostgreSQL adapter implemented .......... YES
PostgreSQL migration created ............ YES
PostgreSQL runtime integration .......... NOT EXECUTED
PostgreSQL concurrency proven ........... NO
HTTP idempotency durability ............. MEMORY ONLY (process-local)
Rate-limit durability ................... MEMORY ONLY (process-local)
Production build verification ........... NOT PROVEN
Staging cycle ........................... NOT EXECUTED
```

No statement in this repository has been executed against a real PostgreSQL server. Structural tests
assert the SQL's shape, not its behaviour, and must not be read as runtime proof.

### Before enabling in production

1. Apply the migration and set a real connection string.
2. Verify `storage.durable === true` on `GET /api/admin/accas`.
3. Run a full `npm run build` with a real HTTPS `SITE_URL` to exit code 0.
4. Complete one staging cycle.
5. Only then set `FF_OPERATOR_APPROVAL_ENABLED=true`.

---

## 9. The public surface (Sprint 24)

### Index — `/{locale}/accas`

Server-rendered end to end. Cards, filter links and page links are all in the HTML the server
returns; the only client code is an analytics island that renders nothing. **Disable JavaScript and
the index still lists, filters, paginates and links.**

- 12 cards per page, ordered newest first, grouped into "Still ahead" and "Closed". Never ordered
  by odds, confidence or apparent quality.
- Filters: **state**, **profile** (Builder risk mode), **competition**. Every option is counted from
  the published records themselves, and a facet with fewer than two distinct values is not rendered
  — a control offering one choice that changes nothing is decoration.
- One index request examines at most `PUBLIC_ACCA_MAX_SCAN` (200) published rows for the locale. If
  it truncates, the page says so. State and competition are derived rather than stored columns, so
  filtering them in the store would mean either a schema change or a JSON predicate the memory and
  PostgreSQL adapters would implement differently — and adapter parity is a property this domain
  has and keeps.

### Detail — `/{locale}/accas/{slug}`

Sections: at a glance · the selections · why these selections · what this was built on · is this
still current · limitations · how this was put together · share · check the record.

Per-selection reasoning uses native `<details>` disclosures — keyboard-operable, screen-reader
announced, and functional with scripting disabled. A selection with nothing recorded says so, and
says that is a gap in the record rather than a judgement about the selection.

### Sharing

`AccaShareControls` is the one interactive island. Copy-to-clipboard with a Web Share button added
by feature detection **in an effect** (branching during render would be a hydration error), plus a
labelled read-only input holding the canonical URL as the always-available fallback. Every outcome
— including a refused clipboard — is announced through a polite live region. No login, no
third-party share targets, no tracking parameters, and the URL is never read from
`window.location`, so a link shared from a page reached with a stray query string still points at
the canonical address.

Share metadata reuses the existing site conventions: `pageMetadata` supplies Open Graph, the
Twitter summary card and the existing branded `/opengraph-image`. **No per-Acca dynamic OG image
infrastructure was built** — the repository has no foundation for it and adding one would be a
sprint of its own.

### Operating the public surface

```bash
FF_PUBLIC_ACCA_PAGES_ENABLED=false   # closes /{locale}/accas, the homepage section and the sitemap shard
```

See `docs/feature-flags.md` for the full interaction table with `operatorApprovalEnabled`.

---

## 10. Not in this sprint

Affiliate calls-to-action on public Acca pages (Sprint 21 or a later integration sprint), per-Acca
dynamic share/OG images, non-English public copy, settlement of published Accas, and any
post-publication performance reporting. The Decision Ledger (Sprint 26) remains paused and is loaded
by nothing in this chain.
