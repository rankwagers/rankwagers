# Builder Approval — Operator Guide

**Sprint:** 20B-A (Phases A–E) · **Status:** internal, read-only, DRAFT-only
**Audience:** operators and engineers running the admin surface

> **PostgreSQL runtime behaviour is not yet integration-proven.**
>
> **A full production build with a real HTTPS SITE_URL has not yet been proven.**
>
> Phase E delivers the admin UI and this document. It does **not** close either condition above.

---

## 1. Purpose

Builder Approval gives operators a durable, server-owned record of a Builder combination that
an administrator explicitly chose to save for later review.

A candidate is an **immutable copy** of an already-computed Builder combination. Saving one
never recomputes predictions, confidence, Builder scores, eligibility or odds — it copies,
validates, checksums and stores.

**What this is not, in this sprint:** it is not an approval workflow, not a publication
pipeline, and not visible to any visitor.

## 2. Current capabilities

| Capability | Status |
|---|---|
| Create an internal DRAFT candidate (admin API) | ✅ implemented |
| List candidates (admin API + UI) | ✅ implemented |
| Inspect a candidate (admin API + UI) | ✅ implemented |
| Approve / reject / submit for review | ❌ not implemented (Sprint 20B-B) |
| Publish / unpublish / schedule | ❌ not implemented |
| Edit / delete / regenerate | ❌ not implemented — candidates are write-once |
| Public visibility of any kind | ❌ none. No public route exists |

The admin UI is **read-only**. It contains no mutating control, and no placeholder button
implying an unsupported action.

## 3. Candidate lifecycle as implemented

```
(admin explicitly saves a chosen Builder combination)
                 │
                 ▼
             DRAFT  ──────►  (no further transition exists in this sprint)
```

`DRAFT` is the only status. The database `CHECK` constraint permits only `'DRAFT'`, and no
code path writes any other value. Sprint 20B-B must widen both deliberately.

## 4. Admin access

- Routes: `/admin/builder-approval` (list), `/admin/builder-approval/[candidateId]` (detail).
- API: `POST|GET /api/admin/builder-approval/candidates`, `GET .../candidates/[candidateId]`.
- Authentication reuses the existing admin mechanism (`lib/security/adminAuth.ts`): a Bearer
  token or an opaque HttpOnly session cookie, both validated server-side. Query-string secrets
  are never accepted.
- Pages are wrapped in `AdminGate`; authorization is **not** client-side hiding.
- `app/admin/layout.tsx` already applies `noindex, nofollow, noarchive` to every admin route.
  Builder Approval appears in no public navigation, sitemap or SEO surface.

### Actor attribution is coarse

Admin access uses a single shared secret, so every candidate records `actor: "admin"`. This
means *an administrator*, not a named person. Do not treat it as individual attribution.
Named operator identity is deferred to Sprint 20B-B or a later auth sprint.

## 5. Feature flags

| Flag | Default | Effect |
|---|---|---|
| `FF_OPERATOR_APPROVAL_ENABLED` | **false** in every environment | Gates the admin API, the admin pages and the navigation item |
| `FF_EMERGENCY_DISABLE_APPROVAL` | false | Highest-precedence kill switch; forces the feature off even if enabled |

Unrecognised flag values fail safe to disabled. When disabled:

- the navigation item is not rendered;
- both routes return **404** — indistinguishable from a route that does not exist;
- the flag is checked **before** authentication and **before** any candidate read, so no
  candidate service call occurs and nothing misleading is rendered;
- public Builder behaviour is completely unaffected.

## 6. Storage: memory vs PostgreSQL

Adapter selection (`lib/builder-approval/environment.ts`), in precedence order:

1. `BUILDER_APPROVAL_ADAPTER=memory` → memory (forced)
2. `BUILDER_APPROVAL_ADAPTER=postgres` → PostgreSQL, or memory if no connection string
3. `NODE_ENV=test` → memory (tests never require a database)
4. A connection string in `BUILDER_APPROVAL_DATABASE_URL`, `ATTRIBUTION_DATABASE_URL`,
   `SNAPSHOT_DATABASE_URL` or `ODDS_HISTORY_DATABASE_URL` → PostgreSQL
5. Otherwise → memory

### Durability implications — read this before relying on candidates

| Mode | Durable? | Reality |
|---|---|---|
| `memory` | **No** | Process-local. **Every candidate is lost on restart.** Also wrong under multiple instances |
| `postgres` | Yes | Survives restart |

Memory mode is reported honestly everywhere: the store reports `durable: false`, the API
response carries a `degradedNotice`, readiness reports `builder_approval` as **degraded** in
deployed environments, and the admin UI shows a "Not durable" panel. Never describe
memory-backed candidates as durable.

**Not yet proven:** no PostgreSQL server has been contacted in any test run. Create/get/list,
idempotency dedupe and conflict, concurrency and restart durability are design-reviewed and
statically asserted only. See §12.

## 7. Migration

`db/migrations/20260726_create_builder_approval.sql` — additive, `CREATE TABLE IF NOT EXISTS`,
no destructive statement.

**It has not been executed.** Nothing auto-runs it: the readiness check only verifies the file
exists (`"migration SQL files present (apply on DB separately)"`), and no application code
contains a `CREATE TABLE` statement. Apply it separately per `docs/migration-runbook.md`.

## 8. API rate limits

Two limiters with distinct purposes:

| Limiter | Key | Limit | Purpose |
|---|---|---:|---|
| Admin auth | `admin:<client>` | 30/min | Credential-guessing / global admin abuse. Charged on every request including failed auth |
| Route (write) | `admin-builder-approval:<client>` | 10/min | Candidate creation is a deliberate human action |
| Route (read) | `admin-builder-approval:<client>` | 20/min | List and detail reads |

Route limits are deliberately tighter than the auth limiter, so the route limiter is the
binding constraint for authenticated callers. A route `429` carries a real `Retry-After`
taken from the limiter result. An auth-layer `429` carries **no** `Retry-After`, because that
limiter does not expose its window and a fabricated value could be wrong.

The limiter is process-local and assumes a single instance. Horizontal scale needs a shared
limiter.

## 9. CSRF expectations

Admin **write** endpoints are protected by `lib/security/adminCsrf.ts`:

- A request authenticated by **cookie** must prove same origin. `Origin` is preferred,
  `Referer` is the fallback; both are compared by **parsed canonical origin equality**
  (`new URL(x).origin`), never string prefix. Scheme, hostname and effective port must match;
  hostname case and explicit default ports normalise correctly.
- URLs carrying credentials (userinfo) are rejected, because `URL.origin` strips userinfo and
  would otherwise canonicalise an attacker URL onto the trusted origin.
- A request authenticated by a **verified** Bearer credential is exempt: the credential lives
  in a custom header, which a cross-site form cannot set and which triggers a CORS preflight
  this application never satisfies. The exemption is based on the *verified* auth mode, never
  on the mere presence of an `Authorization` header.
- In **staging/production**, a missing or unparseable `SITE_URL` **fails closed**. Locally it
  falls back to same-host comparison, and fails closed if `Host` is also absent.

`SITE_URL` is therefore a hard prerequisite for using the write endpoint in a deployed
environment.

The admin **pages** are read-only server components and perform no mutation, so no CSRF token
is involved in browsing the UI.

## 10. Idempotency semantics

Creation requires an idempotency key (header `Idempotency-Key`, or an `idempotencyKey` body
field as a documented fallback). Keys are opaque, 8–200 printable-ASCII characters, never
parsed or split.

| Case | Result |
|---|---|
| Same key + identical request | `200`, the original candidate, `deduplicated: true` |
| Same key + any different request | `409 idempotency_conflict` with `existingCandidateId` |
| Different key + same payload | a new candidate |
| Missing / empty / whitespace-only / oversized key | `400` |

Request identity is a **structured canonical fingerprint** (`computeRequestFingerprint`), not
delimiter concatenation. Consequently `["a|b"]` cannot collide with `["a","b"]`, `1` cannot
collide with `"1"`, and `false` cannot collide with `"false"`.

### Omitted vs null semantics

For the three optional source identifiers (`sourceRequestId`, `sourceSnapshotId`,
`sourceDate`):

| Input | Result |
|---|---|
| Property absent | presence `omitted` |
| Property present, `null` | presence `null` |
| `""` or whitespace-only | **rejected `400 empty_optional_string`** |
| Any other string | preserved **verbatim** — never trimmed |

Omitted and explicit-null are **distinct requests** for idempotency: presence is folded into
the fingerprint, so reusing a key across the two returns `409`, not a silent dedupe.

**Storage cannot preserve that distinction** — both persist as SQL `NULL`. The admin UI
therefore renders both as "Not provided" and says so on screen. The distinction exists only
in the fingerprint at creation time.

## 11. Rollback procedure

Git is not available in this environment, so rollback is hash-manifest based. Two independent
checkpoints exist and neither overwrites the other:

```
.continuation-backups/sprint-20b-a-pre-implementation/          # Phases A–D
.continuation-backups/sprint-20b-a-phase-e-pre-implementation/  # Phase E
```

Each contains `MANIFEST.sha256.json`, a flat `MANIFEST.sha256.txt`, byte-exact copies of every
pre-existing file it will modify, and a record of files that did not previously exist. The
Phase D checkpoint also carries `SUPPLEMENT.created.json` for files created after the original
plan.

To verify or roll back, use the restore tooling in dry-run first:

```powershell
verify-or-restore-20ba.ps1  -Mode Verify              # read-only drift + rollback plan
verify-or-restore-phase-e.ps1 -Mode Verify            # Phase E equivalent
# only after reviewing the plan:
verify-or-restore-phase-e.ps1 -Mode Restore -Confirm  # restores modified, deletes created
```

Restore refuses without `-Confirm`, and refuses to restore from a backup that fails its own
hash check.

**Fastest safe disable without any rollback:** set `FF_OPERATOR_APPROVAL_ENABLED=false` (or
`FF_EMERGENCY_DISABLE_APPROVAL=true`). Routes 404, the nav item disappears, no candidate read
occurs, and public Builder behaviour is unchanged.

## 12. Known limitations

1. **PostgreSQL runtime behaviour is not integration-proven.** No PostgreSQL server has been
   contacted. Concurrency proof exists for the **memory adapter only** (20-way and 50-way
   identical, and a 50-way two-fingerprint conflict case), and the memory adapter's atomicity
   comes from single-threaded JavaScript execution — a different mechanism from PostgreSQL's
   unique-index `ON CONFLICT`.
2. **Memory mode loses everything on restart** and is incorrect under multiple instances.
3. **Actor attribution is coarse** — `"admin"`, never a named individual.
4. **The rate limiter is process-local**; horizontal scale needs a shared limiter.
5. **Unknown top-level request fields are stripped, not rejected.**
6. **`schemaVersion` is client-supplied but allowlisted.** With one supported value this is
   equivalent to server-owned; when a second version lands, decide explicitly whether the
   client may still select.
7. **The checksum is an artefact integrity checksum only** — not a ledger, not a hash chain,
   not proof of custody.
8. **No approval, publication or public surface exists.** Sprint 20B-B.

## 13. External pre-deployment conditions

Both remain **open**. Phase E does not close either.

```
1. Real PostgreSQL integration test.
2. Full `npm run build` with a real HTTPS SITE_URL and exit code 0.
```

For (2), the current environment has `SITE_URL=http://localhost:3000`, and
`scripts/prepare-dev.mjs` correctly blocks production builds on a non-HTTPS host. Compilation
of the Builder Approval routes has been verified independently (webpack compiled, both routes
emitted and present in the route manifest), but the whole-build exit code is non-zero because
`/robots.txt` and the sitemap routes require a non-localhost `SITE_URL`
(`lib/config/env.ts:74-77`). Do not bypass that guard to claim success.
