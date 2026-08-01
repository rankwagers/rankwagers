# M9 — Activation & Production Wiring: Storage Migration & Future Postgres-Cutover Re-Review

**Reviewer:** Claude 6 (Migration & Storage Compatibility Reviewer)
**Date:** 2026-07-30 (re-review; supersedes the 2026-07-29 forward-looking review)
**Milestone:** Sprint 23B — M9 (Activation & Production Wiring)
**Scope:** whether the **now-implemented** M9 runtime wiring, and the NDJSON data it produces, preserve a **safe future NDJSON→Postgres migration path** — complete, deterministic, append-only, internally consistent, reconstructable, safely importable, reversible before cutover, non-destructive after rollback. This review does **not** authorize Postgres, does **not** enable flags, does **not** modify frozen contracts, does **not** migrate or rewrite any data.

> **Status change since the prior review.** The 2026-07-29 review concluded *"M9 is presently UNBUILT."* **That is no longer true.** M9 is now implemented and was re-verified from source (not from the hand-off summary). Every claim below is anchored to a file:line read on 2026-07-30. The two biggest migration caveats the prior review flagged — the **fail-open evidence reader** and the **advisory lock decoupled from `EVIDENCE_DATABASE_URL`** — are both **now resolved in code**.

**VERDICT: M9 MIGRATION CONDITIONALLY APPROVED.**

The implemented M9 introduces **no new record type, no new persisted field, and no change to any identity/hash/serialization/revision formula**. It is additive job/route-boundary wiring over the frozen M2/M3/M6/M8 builders, so it **cannot create non-migratable or irreversible data**. The conditions are data-completeness and future-cutover gates — chiefly **provider-basis persistence** (M9 writes the snapshot↔odds pair but not a snapshot↔provider pair), **retention**, a **fail-closed importer**, and the future-Postgres requirements (hash-faithful TEXT timestamps; the `adapter="postgres"` silent-fallthrough trap). None is a defect in the shipped code; none touches a frozen contract. Postgres cutover remains correctly out of M9 scope and is **not** a blocker.

---

## 1. Current storage topology (verified at runtime construction, 2026-07-30)

| Record family | Contract module | Durable adapter | Runtime resolver | Reader policy | In-proc write mutex | Written by M9 at runtime? |
|---|---|---|---|---|---|---|
| `EvidenceSnapshot` | `lib/archive/evidence/*` | `createFileEvidenceArchive` → `snapshots.ndjson` | `getEvidenceArchiveStore()` (`service.ts:41`) → file unless `EVIDENCE_ARCHIVE_ADAPTER=memory` | **fail-CLOSED** (`file.ts:76-127`) | No (single-writer via job lock) | **Yes** — capture runner |
| `ValidationRecord` | `lib/archive/evidence/*` | same store → `validations.ndjson` | same resolver | **fail-CLOSED** | No | **Yes** — settlement runner |
| `OddsArchiveRecord` (incl. mandatory `evidence_capture`) | `lib/evidence-capture/odds-archive/*` | `createFileOddsArchive` → `odds-archive/records.ndjson` | **`getOddsArchiveStore()` (`service.ts:28`, NEW in M9)** → file default | **fail-CLOSED** (`file.ts:70-116`) | **Yes** (per-path promise chain) | **Yes** — mandatory-odds wiring (C5) |
| `ProviderArchiveRecord` | `lib/evidence-capture/provider-archive/*` | `createFileProviderArchive` → `provider-archive/records.ndjson` | **none — no `service.ts` resolver** | **fail-CLOSED** (`file.ts:86-136`) | **Yes** (per-path promise chain) | **No** — not persisted by M9 (see §5) |
| `inputContentHash` binding (M7) | `lib/evidence-capture/input-identity/*` | none (pure/dormant) | none | n/a | n/a | **No** — module unwired (C8 future) |

**Path construction (one shared base dir).** `resolveEvidenceArchiveDir()` (`lib/archive/evidence/file.ts:54-61`): `EVIDENCE_ARCHIVE_DIR` (trimmed, whitespace-only = unset) → else in `production` the shared default `/opt/rankwagers/shared/evidence-archive` → else `process.cwd()/data/evidence-archive`. Odds and provider place `records.ndjson` under `odds-archive/` and `provider-archive/` subdirectories of that same base (`odds-archive/file.ts:62-65`, `provider-archive/file.ts:78-81`). **All three families therefore share one durable base dir** — the migration input is one consistent set.

**Line serialization.** Every adapter writes `${JSON.stringify(record)}\n` via `fs.appendFile` — never a whole-file rewrite. Records are minified single-line JSON; stored key order is irrelevant to identity because hashing is over the canonical sorted form, not the stored bytes.

**No Postgres in the evidence path.** `grep createPostgres lib/archive/evidence lib/evidence-capture` → **NONE**. `service.ts` (evidence) and `service.ts` (odds) construct `memory|file` only. The only Postgres touchpoint reachable from the pipeline is the **advisory lock** (§8), which stores no records.

---

## 2. Implemented M9 data effects (verified from source)

M9 is now built as additive wiring; the pieces that touch persisted data:

- **Job types + runners.** `JobType` gains `evidence_capture` + `prediction_settlement` (`lib/jobs/types.ts:5-6`). `runEvidenceCaptureJob` / `runPredictionSettlementJob` (`runner.ts:282-346`) each gate on their flag (C2, fail-closed → `skipped`/409), acquire a **durable** lock (C1), run an injected-candidate batch, classify the frozen result vocabulary into counts (C6), and emit metrics (C7).
- **Cron routes.** `app/api/internal/cron/evidence-capture/route.ts` and `.../prediction-settlement/route.ts` — access + rate-limit + response mapping via `handleCronPost` (`cronHandler.ts`), `maxDuration=60`. No external scheduling authored in-repo.
- **Capture batch** (`jobs/capture-run.ts`): drives frozen `captureEvidenceSnapshot` per injected candidate, then enforces **C5** via `ensureMandatoryCaptureOdds`. Candidates are **injected** — the live M4→M5 derivation pipeline is out of M9 scope, so a bare cron fire runs a safe empty pass.
- **Mandatory odds** (`capture/mandatory-odds.ts`): reconstructs `captureId` from the snapshot and appends one frozen fallback `evidence_capture` odds record per supported market (§5).
- **Settlement batch** (`jobs/settlement-run.ts`): C3 (fixture correspondence) + C4 (score sanity) guards **outside** the frozen M8 algorithm, then frozen `settleLatestSnapshotForFixture`.
- **Odds resolver** (`odds-archive/service.ts`): new process-wide choke-point selecting the **file** adapter by default (previously the barrel exported only the memory adapter). This is what makes the mandatory odds record land in durable NDJSON at runtime.
- **Diagnostics** (`jobs/diagnostics.ts`, C7): read-only projection over the in-process job log; changes no persisted data.

**Net persisted-data effect:** M9 begins writing, at runtime, the **evidence snapshot**, **validation**, and **mandatory `evidence_capture` odds** NDJSON — all through frozen builders, all under the shared base dir. It does **not** begin writing provider-archive records (§5) and does **not** persist any `inputContentHash` (§6).

---

## 3. Frozen-contract verification

M9 changed **no** frozen identity/hash/serialization/revision module. Verified:

- **Identity/hash primitives unchanged.** `captureId` = `cap_` + `evidenceContentHash({seed:"<fixtureId>|<captureWindowKey>"}).slice(0,24)` (`identity.ts:107-123`); snapshot id excludes `modelVersion`; odds id/contentHash over the frozen §2.D fields; provider id/contentHash unchanged. The M9 mandatory-odds path **derives** `captureId` from the snapshot (`mandatory-odds.ts:48-59`) — it invents no new formula.
- **Frozen builders reused verbatim.** `buildOddsRecord` (with its `source===EVIDENCE_CAPTURE_SOURCE` branch enforcing null odds/operator/implied + `sampleOperators=0`, `odds-archive/record.ts:222-229`), `captureEvidenceSnapshot`, `settleLatestSnapshotForFixture`. M9 only sequences and classifies their existing outputs.
- **`JobType` enum additions are not a frozen evidence contract** — they are the internal job vocabulary; additive members do not touch any persisted evidence record or its identity.
- **No frozen file was edited by M9.** The new logic lives in *new* files (`jobs/*-run.ts`, `capture/mandatory-odds.ts`, `odds-archive/service.ts`, cron routes, `jobs/diagnostics.ts`) plus additive edits to `jobs/runner.ts` and `jobs/locks.ts` (lock-URL binding). The identity/record/hash/settlement modules are untouched.
- **Test corroboration:** the full frozen-verifier suite (identity, content-hash, chain, serialization-boundary replay) passes unchanged (§14).

**Conclusion:** no contract drift. Every record M9 produces is byte-for-byte a frozen-builder output.

---

## 4. Record-by-record relational mapping (review-level only — NOT to be implemented in M9)

Timestamps that participate in a `contentHash` must be stored **verbatim as `TEXT`** for the hashed value (mirrored to `TIMESTAMPTZ` for queries) — see §7 caveat. `JSONB` only for open/nested structures; scalar identity/index fields mirrored to columns.

**`evidence_snapshots`** — natural key `(fixtureId, capturedAt, sequence)`; PK `id TEXT`; `UNIQUE (fixture_id, sequence)`; ordering `sequence`; parent `previous_snapshot_id` (self-FK, nullable); `captured_at TEXT` (hashed); `model_version TEXT`; `content_hash TEXT UNIQUE`; JSONB for `signals[]`, `supported_markets[]`, `operator_availability`, `best_odds_snapshot`.
- **identity:** `id`; **FK-like:** `previous_snapshot_id` self-chain; **content hash:** `content_hash`; **ordering:** `sequence` (+ `previousSnapshotId`); **revision semantics:** none (immutable; new capture = new row); **append/duplicate:** `(id, contentHash)` idempotent, same-id/different-hash → `immutable_violation`; **immutable-violation behaviour:** rejected on write, thrown on read (fail-closed); **reconstruction deps:** self-contained.

**`odds_archive` (incl. mandatory `evidence_capture`)** — natural key `(captureId, marketKey, selectionKey, source)`; PK `id TEXT`; grouping `capture_id` (index); `fixture_id BIGINT` (index); `capture_window_key TEXT`; `captured_at TEXT` (hashed); value cols `decimal_odds NUMERIC NULL`, `operator_key TEXT NULL`, `implied_probability NUMERIC NULL`, `sample_operators INT`; `source TEXT`; `content_hash TEXT`. **CHECK:** `source='evidence_capture'` ⇒ null odds/operator/implied AND `sample_operators=0` (mirrors `record.ts:222-229`). **One `evidence_capture` row per supported (market,selection) per `capture_id`** is the DoD-5 invariant (§5).
- **identity:** `id`; **FK-like:** `capture_id`↔snapshot (via reconstructed identity, not a hard FK), `fixture_id`; **content hash:** `content_hash` over the 11 §2.D fields; **inputContentHash relevance:** the odds `content_hash` set is one of the two inputs to `inputContentHash` (§6); **ordering:** `compareOddsRecords` (deterministic; file order ignored); **revision:** none; **append/duplicate:** `(id, contentHash)` idempotent, conflicting id → `immutable_violation`-on-disk (thrown); **timestamps:** normalized ISO, hashed; **reconstruction deps:** self-contained; `capture_id` re-derivable from the snapshot.

**`provider_archive`** — PK `id TEXT`; `content_hash TEXT`; `fixture_id`; normalized provider payload as `JSONB` (JSON-safety-normalized at build); hashed timestamp as `TEXT`.
- **identity:** `id`; **FK-like:** joined to odds/snapshots by `fixtureId`/`captureId`, not a hard FK; **content hash:** `content_hash` (feeds `inputContentHash`); **ordering:** `compareProviderRecords`; **revision:** none; **append/duplicate:** `(id, contentHash)` idempotent, conflicting → `immutable_violation`-on-disk; **reconstruction deps:** **the sole non-reconstructable raw-input basis** — must be retained (§5, §6). **Not written by M9 at runtime** (§5).

**`evidence_validations`** — PK `revision_id TEXT`; `UNIQUE (id, revision)`; parent `snapshot_id` (FK → `evidence_snapshots.id`); `revision` key; chain pointer `supersedes_revision_id`; `recorded_at`/`settled_at TEXT` (hashed; `settled_at` NULL only for pending, which is never persisted); `content_hash TEXT`.
- **revision semantics:** rev 1 = original; `reviseValidationRecord` increments + sets `supersedesRevisionId`; "current" derived at read (`DISTINCT ON (id) … ORDER BY revision DESC`); **correction records:** `settlement_correction`/`data_correction` are higher-revision rows (no separate table); **append/duplicate:** `(revision_id, contentHash)` idempotent, conflict → `immutable_violation`; **reconstruction deps:** parent snapshot must exist (FK).

**`inputContentHash` / revision-correction sidecars** — **no column, no table added by M9.** `inputContentHash` is derivable from retained provider + odds `content_hash` (§6); if ever materialized it belongs in a **sidecar keyed on `snapshot_id`**, never inside a frozen hashed body. Chain-verification metadata is never persisted — recomputed by `verifyEvidenceChain`/`verifyOddsRecord`/`verifyProviderArchiveRecord`.

---

## 5. Mandatory-capture-pair completeness analysis

**Pair identity is deterministic and reconstructable.** `captureIdentityFromSnapshot` (`mandatory-odds.ts:48-59`) computes `captureWindowKey = "<fixtureId>|<capturedAt>"` and `captureId = deriveCaptureId(...)`. Because a snapshot's `capturedAt` **is** the window start (`captureWindowKey.quantizedCapturedAt === windowStart`, `identity.ts:58-95`), and `captureId` is a pure content hash of `(fixtureId ‖ captureWindowKey)`, this reconstructs **the exact `captureId` the M1/M6 pipeline computed** from the immutable snapshot alone — no stored back-pointer needed. ✔ *"share the correct deterministic capture identity."*

**Partial pairs are detectable.** Given any snapshot, recompute `captureId` and query `oddsStore.listByCapture(captureId)`; a snapshot with zero mandatory rows is an incomplete pair. Detection needs no extra state.

**Partial pairs heal without mutation.** `runCaptureBatch` re-runs `ensureMandatoryCaptureOdds` even for an `already_exists` snapshot (`capture-run.ts:16-19, 125-147`); appends are idempotent (`duplicate`). A snapshot minted before odds wiring is repaired on the next run — append-only, never a rewrite. ✔

**Conflicting pairs fail closed.** An odds append with the same id + different hash returns `immutable_violation`; `ensureMandatoryCaptureOdds` propagates it (`mandatory-odds.ts:146-147`); `runCaptureBatch` counts the capture as **failed**, never captured (`capture-run.ts:137-142`). A build rejection or empty `supportedMarkets` is a **failed capture** (`mandatory-odds.ts:73-75`), never a silent empty success — "zero odds records is a failed capture (DoD 5)". ✔

**Future import can reconcile pair completeness.** An importer joins `odds_archive` to `evidence_snapshots` on the reconstructed `capture_id`; a snapshot with no `evidence_capture` odds row is flagged (never auto-healed at import). This is a mechanical reconciliation over immutable rows.

**Asymmetry that gates the verdict — the pair M9 guarantees is snapshot↔ODDS, NOT snapshot↔PROVIDER.** `captureEvidenceSnapshot` treats `providerRecord` as an **optional** input, integrity-checks it when present (`capture.ts:83-85`), and **never persists it**. There is **no provider-archive runtime resolver** (`provider-archive/index.ts` exports only the memory adapter; no `service.ts`). So M9's activation wiring writes snapshot + fallback odds, but the **provider raw-input basis is produced/persisted upstream** (M4 candidate production), which is out of M9 scope. **Consequence for migration:** for a bare/mandatory-only capture, the retained basis is the fallback odds record only; the provider record may be absent. This is not an M9 defect (provider persistence was never an M9 deliverable and `inputContentHash` wiring is the future C8 milestone), but it means **pair-completeness is CLOSED for snapshot↔odds and PARTIAL for snapshot↔provider** — see the gate matrix (§11) and §6.

---

## 6. Input-hash (`inputContentHash`) reconstructability

**Trace (verified).** `input-identity/identity.ts` canonicalizes retained **provider** `providerContentHash` + retained **odds** `oddsContentHashes` (code-point sort, strict validation) → `inputContentHash = "iih_" + hash(evidenceInputVersion, providerContentHash, sortedOddsContentHashes)`. The module is **pure and dormant** — `captureEvidenceSnapshot` does not call it, and there is **no `inputContentHash` field** on `EvidenceSnapshot`. It hashes the *content-hash strings*, never re-hashes payload bodies, so it is **storage-format-independent**.

**Reconstructability status:**
- ✔ The **odds** side of the basis is now produced by M9 (mandatory `evidence_capture` record) and content-addressed.
- ⚠ The **provider** side is **not produced by M9** (§5). Full `inputContentHash` reconstruction requires `providerContentHash`; if no provider record exists for a capture, the binding cannot be reconstructed from M9-produced data alone.
- Because `modelVersion` is excluded from both `inputContentHash` and `snapshotId`, and a new model mints a **new snapshot** (new `capturedAt`/`sequence` → independent chain), old and new models coexist without collision; replay pins outcomes by `modelVersion`; there is no silent reinterpretation.

**Requirement:** retain provider + odds + snapshots + validations as **one consistent set** for as long as any referencing snapshot must be replayable. `inputContentHash` reconstructability is therefore **CLOSED conditional on provider-basis retention** — which today depends on the upstream/injected pipeline persisting provider records, not on M9. Do **not** add an `inputContentHash` field to the frozen snapshot; a future sidecar keyed on `snapshot_id` is the only sanctioned materialization.

---

## 7. Corruption / import policy (strict-read verification)

**Authoritative runtime readers now fail closed — verified across all three archives.** The prior review's crux caveat (evidence reader fail-open) is **resolved:**

| Anomaly | `evidence/file.ts:76-127` | `odds-archive/file.ts:70-116` | `provider-archive/file.ts:86-136` |
|---|---|---|---|
| Missing file (ENOENT) | → empty | → empty | → empty |
| Malformed / truncated line | **throw** (line no.) | **throw** (line no.) | **throw** (line no.) |
| Permission (EACCES/EPERM) | **throw** (differentiated) | **throw** (`read failed (code)`) | **throw** (`read failed (code)`) |
| I/O (EIO/EBUSY/ENXIO/ENODEV) | **throw** (differentiated) | **throw** | **throw** |
| Other errno (EISDIR/ELOOP/…) | **throw** | **throw** | **throw** |
| Duplicate id + same hash | (dedup on read n/a here) | collapse to one | collapse to one |
| Conflicting id + different hash | admission rejects on write | **throw** `immutable_violation`-on-disk | **throw** `immutable_violation`-on-disk |
| Integrity-failed record | chain verifier flags | **throw** (`verifyOddsRecord`) | **throw** (`verifyProviderArchiveRecord`) |
| Revision gap/fork/dup | `verifyValidationChain` codes | n/a | n/a |
| Reordered records | tolerated (fields reconstruct order) | tolerated | tolerated |

A future migration reader can therefore **distinguish** missing-file / malformed-line / permission / I/O / duplicate-identity / conflicting-identity / revision-fork / partial-truncation by errno + message. The evidence adapter now differentiates errno explicitly (`file.ts:82-109`), so the "never reuse a fail-open reader" hazard is **reduced at the source** — but the importer policy still stands on its own.

**Serving-path fail-soft is separate and intentional.** `service.ts` (evidence) wraps reads for the *presentation* path and reports `archive_unavailable`/empty/null on throw (`service.ts:82-122`) — a bad line renders empty state, never a crashed page. The **write path is fail-closed:** capture reads the stream via `store.listSnapshots`/`latestSnapshot` (not the fail-soft wrappers), so a corrupt read surfaces as `archive_error` → `writeFailed` (`capture.ts:90-116`, `capture-run.ts:99-105`), and appends propagate `write_failed`. Note `nextEvidenceSequence` returns `1` on unreadable history (`service.ts:154-161`), but the capture path does **not** use it — it derives sequence from `store.latestSnapshot`, which throws fail-closed. No silent sequence collision.

**Future importer policy (required):**
1. **Never reuse a fail-open reader.** Read fail-closed; a bad line aborts the file, not the record.
2. **Quarantine corrupt files/lines** with errno + line number; never rewrite or "repair" an archive.
3. **Produce reconciliation counts** — total, per-type, per-fixture, per-`captureId` (odds), per-`validationId` revision — from a fail-closed pre-scan, matched post-import.
4. **Refuse cutover on any unresolved inconsistency** — orphaned validation (missing parent snapshot), snapshot missing its mandatory odds row, conflicting-hash duplicate, broken revision chain.
5. **Idempotent load:** `INSERT … ON CONFLICT (<pk>) DO NOTHING` + read-back `content_hash` compare (equal ⇒ duplicate, differ ⇒ `immutable_violation` → quarantine).
6. **Re-run the frozen verifiers** on source and target; assert count parity + replay parity before any flag flip.

---

## 8. Lock / storage relationship

**The advisory lock is now bound to `EVIDENCE_DATABASE_URL` and fails closed — verified.** `tryAcquireJobLock(key, {requireDurable})` (`locks.ts:18-96`):
- Capture and settlement both pass `requireDurable=true` (`runner.ts:72-74`), so both key off **`EVIDENCE_DATABASE_URL`** (`locks.ts:27-28`). Other jobs keep the legacy `SNAPSHOT|ATTRIBUTION|ODDS_HISTORY` resolution.
- **Globally shared by all evidence writers:** both durable jobs resolve the **same** DB authority (`EVIDENCE_DATABASE_URL`). They use **distinct lock keys** (`job:evidence_capture` vs `job:prediction_settlement`) so capture and settlement don't block each other, but each is single-writer **cross-process** on that shared authority. There is **one** lock authority, not two — the prior review's "future cutover uses two unrelated lock authorities" concern does not materialize.
- **Fail-closed in production:** if `EVIDENCE_DATABASE_URL` is unset, or `JOB_LOCK_ADAPTER=memory`, or the lock DB is unreachable, a durable lock in `NODE_ENV=production` returns `null` (`locks.ts:39-41, 56-62, 91-95`) → the job is `skipped` (`runner.ts:75-86`). It **never** degrades to the in-process `Set`. Cross-process single-writer is thus guaranteed *when the feature runs*; if the lock DB is absent the feature simply does not run (safe).
- **Lock configuration is independent of record storage — and does not alter any schema.** The lock lives in a Postgres DB; the evidence records live in NDJSON files. A PG lock existing says nothing about where evidence is stored. Acquiring/releasing the lock writes no record and changes no persisted format.

**Configuration ambiguity to record (not a defect):** `EVIDENCE_DATABASE_URL` is **double-duty** — `locks.ts` uses it as the lock-coordination DB, and `config.ts:92` also surfaces it as `databaseUrl` ("Postgres connection for the evidence adapter"). Today only the lock uses it (no Postgres record adapter exists). At a **future Postgres cutover** the *same* URL would naturally become both the record store and the lock authority — the desired unification, but it must be **intentional and asserted-present**, never two unrelated URLs. Relatedly, `config.readAdapter` accepts `"postgres"` (`config.ts:59-64`) but `service.ts` builds only `memory|file` — **setting `EVIDENCE_ARCHIVE_ADAPTER=postgres` today silently falls through to file NDJSON.** That is harmless now but is a **latent cutover trap** (operator believes Postgres; writes go to NDJSON): the future adapter must be wired *and* fail-closed on a missing URL. Recorded in §12.

**Migration-tooling implication:** a future import job must exclude live writers using the **same** `EVIDENCE_DATABASE_URL` advisory authority, and must hold **both** durable keys (or a superset lock) to fence capture *and* settlement. `advisoryLockKey` (sha256→31-bit, `locks.ts:10-14`) is stable across app versions, so keys collide correctly across versions.

---

## 9. Shared-directory durability

**The durability wiring is landed — verified** (`file.ts:37-61`). This is the single most important item the prior review said M9 owed (MG-1); it now exists:
- **Production archive path is outside release directories.** In `production`, the base defaults to `/opt/rankwagers/shared/evidence-archive` (`file.ts:43,59`), matching the shared `.env` convention — **not** a per-release `process.cwd()`. Release swaps do **not** orphan the NDJSON.
- **All three families share that base** (§1), so a release swap moves none of them.
- **Configuration override is deterministic:** `EVIDENCE_ARCHIVE_DIR` (trimmed) is authoritative; whitespace-only is treated as unset (never an empty path); dev/test fall back to `cwd/data/evidence-archive` unchanged (`file.ts:54-61`). Pure, env-only.
- **Directory permissions fail explicitly:** reads throw on EACCES/EPERM/EIO (§7); writes `mkdir -p` then `appendFile`, returning `write_failed` on any error (`file.ts:129-135`, `odds/file.ts:152-161`, `provider/file.ts:173-182`). No silent empty-on-permission-denied.
- **Backups can capture a consistent state:** append-only files with content-addressed, self-describing records and single-writer discipline mean an offline copy + sha256 manifest is a consistent snapshot; order is reconstructed from fields, so a copy taken mid-run yields at worst a prefix, never a corrupt record.
- **Retention does not delete source records — because no retention exists yet.** No adapter prunes; retention remains an **operational gate** (MG-3). The requirement stands: **never prune the provider/odds/snapshot/validation basis** while any referencing snapshot must be replayable.

---

## 10. Cutover strategy & rollback boundary

**Preferred strategy: offline (maintenance-window) migration.** The data is append-only, content-addressed, engine-independent, and single-writer-fenced — the simplest safe design:
1. **Freeze writers** via the existing durable lock (hold both `job:evidence_capture` + `job:prediction_settlement` on `EVIDENCE_DATABASE_URL`; process-level `instances:1, fork` in `deploy/ecosystem.rankwagers.cjs:35-36` is the belt-and-braces).
2. **Back up NDJSON** — offsite immutable copy + checksum manifest.
3. **Verify chains** fail-closed (§7 pre-scan; frozen verifiers).
4. **Import** transactionally, idempotently, streaming (§4 mapping, §7 policy).
5. **Reconcile** counts + hashes (per-type/fixture/capture/revision).
6. **Replay** sample then full — parity assertion.
7. **Shadow-read** Postgres while NDJSON still serves.
8. **Flip backend** by one explicit env/config flag.
9. **Observe;** keep NDJSON authoritative until Postgres-only writes begin.

**Dual-write should be avoided.** It forces a divergence-resolution policy (which store wins on a hash mismatch?) that contradicts a single immutable history. **Shadow-read** (step 7) gives most of the confidence of dual-read with none of the write-divergence risk. **CDC** is unwarranted for an append-only archive of this size. **Dual-read** is acceptable transiently; **dual-write is not.**

**Rollback boundary (last safe point before Postgres-only writes):**

| Point | State | Rollback |
|---|---|---|
| A — before import | NDJSON authoritative; PG empty | Trivial — abort. |
| B — after import, before flip | PG populated; NDJSON still writer/reader | Trivial — drop/ignore PG. |
| **C — after flip, before Postgres-only writes** | PG serving reads; no new writes | **Safe — flip env back to NDJSON.** The two are byte-reconciled; no divergent write exists. **← last safe rollback point.** |
| D — after Postgres-only writes | PG has rows absent from NDJSON | Unsafe without export — must export new PG rows back to canonical `${JSON.stringify(record)}\n` NDJSON and append. Deterministic (identity/serialization fixed) but a maintenance step, not a flag flip. |

**The safe rollback boundary is C.** Past D, rollback requires a deterministic export step. Old application versions read all imported records unchanged (no field added). A single-writer maintenance window is required for a clean cutover — and M9 already establishes cross-process single-writer, so no new mechanism is owed.

---

## 11. Migration gate matrix

| Gate | Status | Basis |
|---|---|---|
| **Shared-directory durability** (MG-1) | **CLOSED** | `file.ts:43,54-61` prod shared default; all three families share the base; whitespace-safe override. The prior review's "one item M9 genuinely owes" — now landed. |
| **Mandatory capture odds record** (MG-2 / C5) | **CLOSED** | `mandatory-odds.ts` + `capture-run.ts:129-147`: per-market, idempotent, healing, fail-closed; zero markets/violation = failed capture. Odds resolver defaults to file (`odds-archive/service.ts`). |
| **Source retention (no-prune)** (MG-3) | **PARTIAL** | No adapter prunes (safe by default), but no enforced retention policy exists; remains an operational gate. Provider basis not produced by M9 (§5). |
| **Fail-closed importer** (MG-4) | **OPEN** (future) | Runtime readers now fail-closed (§7), reducing the fail-open hazard, but the importer/verification tooling is unwritten. Policy defined (§7). |
| **Strict primary archive reads** | **CLOSED** | Evidence reader upgraded to fail-closed (`file.ts:76-127`); odds + provider already fail-closed. Errno-differentiated. |
| **Pair completeness — snapshot↔odds** | **CLOSED** | Deterministic `captureId` from snapshot; detectable/healable/fail-closed (§5). |
| **Pair completeness — snapshot↔provider** | **PARTIAL** | M9 does not persist provider records; provider basis is upstream/injected (§5). Not an M9 deliverable, but the pair is incomplete without it. |
| **Hash reconstructability** | **CLOSED** (NDJSON) / **PARTIAL** (future PG) | Odds/provider/snapshot/validation content hashes reproduce byte-for-byte on NDJSON round-trip; future Postgres must store hashed timestamps as verbatim TEXT (§7 caveat, G5). |
| **`inputContentHash` reconstructability** | **CLOSED conditional on provider retention** | Hashes content-hash strings; odds side produced by M9; provider side depends on retention/upstream (§6). |
| **Cross-process single-writer lock** (C1) | **CLOSED** | `locks.ts:27-41,56-62,91-95`: durable lock on `EVIDENCE_DATABASE_URL`, fail-closed in production, never in-proc fallback (§8). |

---

## 12. Remaining risks (all future-milestone or operational — none an M9 code defect)

1. **Provider-basis not persisted by M9** (§5). The activation wiring produces snapshot + fallback odds but no provider record; full `inputContentHash` reconstruction and the snapshot↔provider pair depend on the upstream/injected pipeline (M4/C8) and on retention. **Action (future):** wire a provider-archive runtime resolver + persistence, or formally accept that mandatory-only captures carry no provider basis.
2. **`EVIDENCE_ARCHIVE_ADAPTER=postgres` silently falls through to file** (`config.ts:59-64` vs `service.ts:33-39`) — latent cutover trap. **Action (future):** the Postgres adapter must be wired *and* fail-closed on a missing/blank `EVIDENCE_DATABASE_URL`, never silent-open to NDJSON.
3. **`EVIDENCE_DATABASE_URL` double-duty** (lock authority + future record store; §8). Keep it a single asserted-present authority at cutover; do not split into two unrelated URLs.
4. **Retention/backup/restore are unenforced operational gates** (MG-3, §9). Unbounded NDJSON growth without shared-dir retention is the only thing that would *become* a migration blocker.
5. **Timestamp hash-faithfulness for future Postgres** (§7): a `TIMESTAMPTZ` re-serialization (`+00:00` vs `Z`, trailing `.000`) would break `content_hash`. Store hashed instants as verbatim TEXT (G5).
6. **Fail-closed importer unwritten** (MG-4): the reconciliation/verification tool is future work; the policy is specified (§7) but not code.

---

## 13. Test evidence (run 2026-07-30 in `/var/www/rankwagers`)

| Suite | Command | Result |
|---|---|---|
| Evidence archive + file adapter + provider + odds + input-identity + settlement + capture-mint + config + source + routing + model + M1 | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceArchive.test.ts …(12 files)` | **237 pass / 0 fail / 0 skip** |
| **M9 activation + concurrency** (runners, mandatory odds, durable lock, diagnostics) | `… --test tests/m9Activation.test.ts tests/m9Concurrency.test.ts` | **29 pass / 0 fail / 0 skip** |
| Full suite | `npm test` | **1687 pass / 0 fail / 0 skip** |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **exit 0** |
| Lint | `npm run lint` (`next lint`) | **No ESLint warnings or errors** |

**Independently re-verified from source (not from the hand-off summary):** `JobType` now has `evidence_capture`+`prediction_settlement` (`types.ts:5-6`); `runEvidenceCaptureJob`/`runPredictionSettlementJob` exist (`runner.ts:282-346`); both cron routes exist; `getOddsArchiveStore` resolves the **file** adapter (`odds-archive/service.ts`); `ensureMandatoryCaptureOdds` writes per-market fallback odds fail-closed (`mandatory-odds.ts`); the evidence reader is **fail-closed/errno-differentiated** (`file.ts:76-127`); the durable lock keys off `EVIDENCE_DATABASE_URL` and fails closed in production (`locks.ts:27-95`); provider archive has **no runtime resolver** and is **not** persisted by M9; `grep createPostgres` over the evidence tree → **NONE**. No production migration code was written; no frozen contract, flag, or NDJSON archive was modified by this review.

---

## 14. Final verdict

# M9 MIGRATION CONDITIONALLY APPROVED

The **implemented** M9 preserves a safe future NDJSON→Postgres migration path. It adds **no record type, no field, no identity/hash/serialization/revision change** — every record it produces (snapshot, validation, mandatory `evidence_capture` odds) is a frozen-builder output: content-addressed, self-describing, NDJSON-authoritative, and replayable. A future import is therefore **byte-preserving, order-independent, idempotent, and fully reconcilable** with the existing frozen verifiers, and creates **no irreversible or non-migratable data**. Two of the prior review's biggest caveats are now **resolved in code**: the evidence reader is **fail-closed/errno-differentiated**, and the durable single-writer lock is **bound to `EVIDENCE_DATABASE_URL` and fails closed in production**. The shared-directory durability wiring (the one item the prior review said M9 owed) is **landed**.

Approval is conditioned on the migration-relevant gates in §11–§12, none of which is a defect in the shipped code and none of which touches a frozen contract:
- **PARTIAL — snapshot↔provider pair / provider-basis persistence:** M9 writes the snapshot↔odds pair but not provider records; provider persistence and full `inputContentHash` reconstruction depend on the upstream/injected pipeline (C8) and on retention (§5, §6).
- **PARTIAL/OPEN — retention (MG-3)** and **fail-closed importer (MG-4):** operational/future gates; policy specified (§7, §9).
- **Future-Postgres requirements:** hash-faithful verbatim-TEXT timestamps, `ON CONFLICT` idempotency, the `adapter="postgres"` silent-fallthrough trap, and a single asserted-present `EVIDENCE_DATABASE_URL` authority (§8, §12).

Rollback boundary **C** (after flip, before Postgres-only writes) is the last safe flag-flip rollback; dual-write must be avoided. Postgres cutover is correctly out of M9 scope and is **not** a blocker. Full suite **1687/1687**, typecheck and lint green. No frozen contract was touched, no flag enabled, no Postgres activated, and no NDJSON rewritten.
