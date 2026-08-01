# Raw Provider Archive — Design & Implementation (Sprint 23B)

**Date:** 2026-08-01
**Mission:** Capture every provider response (FootyStats + API-Football) forever — append-only, immutable, content-hashed, replayable, with lineage and provider-secret redaction, fail-open, and **zero runtime regression**. Ship **dormant** (not activated in production), ready for later merge. No PostgreSQL. No SEO.

**Status:** Implemented and dormant. New module `lib/providers/raw-archive/` + one additive, flag-gated seam in `lib/providers/reliability/execute.ts`. Validation: focused **18/18**, full suite **1893/1893**, typecheck exit 0, lint clean.

---

## 1. Investigation — safest interception seam

Both providers already funnel every HTTP call through **one** function:

- `lib/api-football/request.ts` → `executeProviderCallSoft(...)`
- `lib/footystats/client.ts` + `lib/footystats/matchDetail.ts` → `executeProviderCallSoft(...)`
- `executeProviderCallSoft` wraps `executeProviderCall` in `lib/providers/reliability/execute.ts` (timeout, retry, circuit breaker, quota, metrics).

`executeProviderCall` is therefore the **single safest interception seam**: every FootyStats and API-Football response passes through `const res = await ctx.fetch(signal)` (line ~137), with the parsed body produced later by `ctx.parse(res)`. Capturing here covers both providers with one hook and requires no change to either client.

Existing archives were reviewed and are **not** the right home: the M2 `lib/evidence-capture/provider-archive/` retains *normalized, fixture-window-scoped replay inputs* and dedupes benign re-fetches — it is not a raw, capture-everything log. The raw archive is a new, physically separate store that mirrors M2's proven conventions (content hash via `@/lib/evidence/hash`, append-only NDJSON, fail-closed reads, verify-on-read, in-process append mutex).

---

## 2. Architecture

```
provider client ─▶ executeProviderCall (reliability seam)
                     │  after fetch(): maybeCaptureRawResponse(ctx, res, {attempts})   ← DORMANT unless flag on
                     │  terminal fail:  maybeCaptureRawFailure(ctx, {attempts,code})   ← body-less lineage
                     ▼
        lib/providers/raw-archive/
          record.ts   pure: record shape, content hash, per-event id, redaction, fail-closed build, verify
          store.ts    append-only admission rule (append / duplicate / immutable_violation)
          memory.ts   client-safe in-memory adapter
          file.ts     server-only NDJSON adapter (append-only, fail-closed reads, per-path mutex)
          config.ts   flag + knobs (dormant by default)
          capture.ts  fail-open, flag-gated hook (clock/random/storage live ONLY here)
          index.ts    client-safe barrel (file adapter imported lazily)
```

**Capture point (line ~148 of execute.ts):** immediately after `rememberQuota(...)` and **before** `if (!res.ok)` / `ctx.parse(res)`, so it captures **every** response — success *and* HTTP error — and clones the body **before** the caller consumes it. **Failure point (line ~260):** the terminal network/timeout path records body-less lineage.

---

## 3. Requirements → implementation

| Requirement | How |
|---|---|
| **Append-only** | Store contract has only `append`/`get`/`list`; file adapter is single-line `appendFile`, never a rewrite. |
| **Immutable** | `id` is content-bound (folds in `contentHash`); admission rejects a same-id/different-hash line as `immutable_violation`; records are `Object.freeze`d; verify-on-read recomputes both hashes. |
| **Content hash** | `rawProviderContentHash` = sha256 (`evidenceContentHash`) over `{provider,operation,endpoint,outcome,httpStatus,body}` — identity-of-content for replay/dedupe/verification. |
| **Replayable** | Verbatim response `body` retained (redacted); `verifyRawProviderRecord` proves a record is untampered → deterministic replay basis. |
| **Lineage** | `capturedAt` (provenance instant), `attempts`, `durationMs`, `outcome`, `httpStatus`, `errorCode`, optional `lineage.{requestId,runId}`; terminal network failures are recorded too. |
| **Provider redaction** | `redactSecrets` scrubs `FOOTYSTATS_API_KEY`/`API_FOOTBALL_KEY` values from the body **before** hashing/storage → a secret is never persisted and the stored body always matches its hash. The seam never even sees the request URL/key (only `ctx.endpoint`, which excludes the key). |
| **Fail-open** | `capture.ts` guards every path (try/catch + `.catch`); the hook returns `void`, runs fire-and-forget after a synchronous clone, and can never throw into or fail the provider call. |
| **Zero runtime regression** | Dormant fast path: the hook checks `RAW_PROVIDER_ARCHIVE_ENABLED` first and returns before any clone/allocation/I-O. The seam call result is byte-identical whether capture is on or off (proven by test). |

**Per-event vs content identity:** the mission is "capture *every* response forever," so identical repeated responses are all retained — `id` folds in `capturedAt` + a random `nonce` (stored, so `id` stays fully verifiable), while `contentHash` lets consumers dedupe/verify by content.

**Body cap:** `RAW_PROVIDER_ARCHIVE_MAX_BODY_BYTES` (default 5 MB) bounds growth; an over-cap body is stored truncated with `truncated: true` + `originalBodyBytes` (these providers' JSON is far below the cap).

---

## 4. Files

**New (`lib/providers/raw-archive/`):** `record.ts`, `store.ts`, `memory.ts`, `file.ts`, `config.ts`, `capture.ts`, `index.ts`.
**Modified (additive, the ONLY existing runtime file):** `lib/providers/reliability/execute.ts` — one import + two flag-gated fail-open hook calls (after fetch; at terminal failure). No behavioural change when the flag is off.
**New test:** `tests/rawProviderArchive.test.ts` (18 tests).
**Doc:** this file.

Nothing else changed. No client, no config default flipped, no route/cron/flag/schema/migration/deployment, no PostgreSQL, no SEO.

---

## 5. Dormancy & activation

- **Default OFF:** `RAW_PROVIDER_ARCHIVE_ENABLED` unset ⇒ the seam is a no-op. Grep confirms the flag is only *read* (config.ts), never *set* anywhere.
- **Client-safe:** the barrel and `capture.ts` never statically import `server-only`; the durable file adapter (`file.ts`, the only `server-only` module) is loaded via dynamic `import("./file")` only when capture runs with the file adapter.
- **Later activation (out of scope here):** set `RAW_PROVIDER_ARCHIVE_ENABLED=1` (optionally `RAW_PROVIDER_ARCHIVE_ADAPTER=file|memory`, `RAW_PROVIDER_ARCHIVE_MAX_BODY_BYTES`). File records land under `<evidence-archive-dir>/provider-archive-raw/records.ndjson` (separate from evidence + M2 provider archives). **Activation gate:** the NDJSON adapter's append mutex is single-process only; sustained multi-process production needs an external single-writer lock (or the future Postgres cutover) — the same gate M2 carries. Not enabled here.

---

## 6. Validation

- Focused `tests/rawProviderArchive.test.ts`: **18/18** — content-hash determinism; per-event id uniqueness; verify/tamper detection (body, id, nonce); redaction before hashing (secret never stored); fail-closed build; append-only + duplicate + `invalid_record`; admission rule (pure) incl. `immutable_violation` backstop; file round-trip + ENOENT-empty + corrupt-line/EISDIR fail-closed; dormant-by-default config; capture hook dormant/enabled/fail-open/non-invasive (original response still parses after clone); **seam zero-regression** (identical result on/off) + seam-enabled capture is replay-verifiable.
- Provider/reliability regression (`sprint17Reliability`, `providerArchive`, `evidenceCandidateProvider`, `rawProviderArchive`): **52/52**.
- Full suite: **1893/1893**, 0 fail. Typecheck exit 0. Lint clean.

---

## 7. Rollback

Additive: rollback = delete `lib/providers/raw-archive/`, revert the `execute.ts` import + two hook calls (backup at session scratchpad `rawarchive-backup-*/execute.ts.bak`), delete the test + this doc. No data/schema/config/flag/deployment touched; the archive writes nothing while dormant.

---

## 8. Out of scope (per brief)

PostgreSQL (NDJSON initial adapter only); SEO; production activation / flag enablement; external multi-process single-writer lock (activation gate); retention/pruning policy; a replay/reader CLI. All are later, separately-authorized steps; the current deliverable is the dormant, merge-ready capture subsystem.

---

## 9. Amendment (2026-08-01) — Foundation Preservation Initiative reconciliation

Re-verified the implementation against the approved objective list and closed two gaps so **every**
objective is met verbatim:

- **Response timing (was unpopulated).** `executeProviderCall` now measures the fetch (`fetchStartedAt`)
  and threads `durationMs` into `maybeCaptureRawResponse`; the terminal-failure hook records
  `Date.now() − started`. Every captured record now carries true provider response timing (previously
  defaulted to 0). Additive; still fire-and-forget + fail-open + dormant.
- **Future providers (previously collapsed to "unknown").** `RawProviderName` is now free-form
  `string` and `normalizeProvider` preserves any non-blank provider verbatim (blank ⇒ "unknown"), so a
  future provider (e.g. "sportmonks") is recorded under its real identity. FootyStats + API-Football +
  any future provider are all supported.

Objective coverage: raw provider archive ✓ · immutable storage ✓ · append-only ✓ · content hash ✓ ·
provider metadata (provider/operation/endpoint/httpStatus/ok/attempts) ✓ · response timing ✓ ·
lineage (capturedAt/attempts/durationMs/outcome/errorCode/requestId·runId) ✓ · replay capability ✓.
Rules held: internal-only (no export/API/UI), never delays requests, fire-and-forget, fail-open,
additive, reversible, dormant. No analytics/dashboards/SEO. No feature creep.

**Validation (post-amendment):** focused `tests/rawProviderArchive.test.ts` **19/19**; reliability +
provider regression **100/100**; full suite **1894/1894**, 0 fail; typecheck exit 0; changed files
lint-clean (`eslint lib/providers/raw-archive lib/providers/reliability/execute.ts tests/rawProviderArchive.test.ts` → 0).
*(Note: the full-project `next lint` reports one PRE-EXISTING, unrelated error in the user-facing
`components/fixtures/MatchPredictionsPanel.tsx` — not introduced by and out of scope for this
preservation-only initiative; not modified.)*
