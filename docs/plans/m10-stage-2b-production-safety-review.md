# M10 Stage 2B — Capture Pipeline Wiring — Production-Safety Review

**Review type:** Read-only production-safety / failure-mode review of the **implemented** Stage 2B capture wiring. **No code, tests, routes, configuration, archives, or deployment were modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Production-Safety Reviewer, Sprint 23B / M10 Stage 2B.
**Inputs read:** `m10-live-candidate-pipeline-specification.md` (Rev A1), `m10-stage-2b-capture-failure-review.md`, `m10-stage-2b-capture-pipeline-wiring.md`, `m10-stage-2-production-safety-review.md`, `m10-stage-2b-test-plan.md`, `m10-stage-2a-implementation-review.md`.
**Code inspected (file:line):** `lib/evidence-capture/candidates/capture-pipeline.ts` (full); `lib/jobs/runner.ts:282-346` (seam); `lib/archive/evidence/file.ts:147-151` (`readAllSnapshotsStrict`) + `:73-126` (`readNdjson`); `lib/evidence-capture/odds-archive/file.ts:62-123` (`oddsArchivePaths`, `readAllOddsRecordsStrict`) + `:124-175` (store); `lib/evidence-capture/candidates/archive-state/*` (Stage 2A); `lib/evidence-capture/candidates/capture-provider.ts`, `eligibility.ts`; `lib/jobs/locks.ts`, `cronHandler.ts`; `app/api/internal/cron/evidence-capture/route.ts`; `tests/evidenceCapturePipeline.test.ts`.
**Verification re-run this pass:** targeted 101/101; full suite **1769/1769**; typecheck exit 0; lint clean.

---

## 1. Executive Summary

**Stage 2B is a narrow, dormant, fail-closed slice** — it composes the capture producer (`produceCaptureRequests` + `createFileCaptureReadPort`), exports two strict whole-archive readers, and adds an optional `provideCandidates` seam that the runner invokes **inside the held durable lock** (INV-L). It wires **no route** (the cron route still calls `runEvidenceCaptureJob()` with no candidates → the M9 empty-safe pass), enforces **no deadline** (explicitly deferred), aggregates **no producer diagnostics**, and performs **no live M4→M5 derivation** (the derivation seam is still injected/synchronous). The wiring doc states this honestly and does **not** claim production readiness.

**Every failure mode I injected/analysed resolves to `failed`, `deferred`, `safe no-op`, or `retryable partial` — none to corruption, false success, silent duplicate, or permanent starvation.** The key safety facts, verified from source:

- **Discovery is inside the lock (INV-L).** `runEvidenceCaptureJob` calls `await options.provideCandidates()` *inside* `runWithLock` (`runner.ts:302-306`); a bare fire (no seam) is the unchanged empty pass. Confirmed by the seam test and the untouched route.
- **Reads are strict / fail-closed.** `readAllSnapshotsStrict` reuses `readNdjson` (ENOENT⇒`[]`, else throw); `readAllOddsRecordsStrict` throws on malformed/integrity/conflict; Stage 2A builders never catch; `produceCaptureRequests` never catches → a corrupt read **rejects** the producer → the runner reports **`failed`**, never an empty success (`runner.ts:123-134`; test `a rejecting provideCandidates fails the run`).
- **Odds discovery path == odds write path.** The pipeline port resolves `<evidenceDir>/odds-archive/records.ndjson` (`capture-pipeline.ts:61-63`), identical to `getOddsArchiveStore()`'s `oddsArchivePaths()` (`odds-archive/file.ts:62-64`) — no read/write directory divergence.
- **Frozen substrate untouched.** M6 `runCaptureBatch`, `captureEvidenceSnapshot`, `ensureMandatoryCaptureOdds`, identity/hash/revision formulas, archive formats, locks, `cronHandler`, and flag defaults are unchanged; the only edits are two additive exported readers + one additive optional runner parameter (typecheck exit 0 confirms no contract drift).

**No immediate blocker and no false production-readiness claim.** The residual risks (INV-D deadline, per-fixture isolation of a *throwing* live derivation, single-writer config dependency, H-1 unlock-500, torn-line blast radius, producer diagnostics) are all **carry-forward gates that belong to later stages (2D/2E) before live activation** — exactly the boundary the task says not to block on. Verdict: **PRODUCTION-SAFETY CONDITIONALLY PASSED**; **Stage 2B may close: YES** (as a dormant, reusable, green slice).

---

## 2. Failure Matrix

Legend: **failed** = run reports `failed` (→500, alertable), no partial-success masking · **deferred** = counted/rejected, re-derived next fire · **safe no-op** = correct empty/idempotent result · **retryable partial** = a durable partial (partial pair) that heals on re-fire · **corruption / false success / duplicate / permanent starvation** = must be **none**.

| # | Failure mode | Outcome | Anchor / reasoning |
|---|---|---|---|
| 1 | Strict **snapshot** read throws (EACCES/EIO) | **failed** | `readAllSnapshotsStrict`→`readNdjson` throws → `buildCaptureArchiveState` rejects → `produceCaptureRequests` rejects → runner `failed` (`unhandled`). No writes attempted. |
| 2 | Strict **odds** read throws | **failed** | `readAllOddsRecordsStrict` throws (`odds-archive/file.ts:82-84`) → same fail-closed path. |
| 3 | One `Promise.all` branch rejects after the other completed | **failed**, clean | `produceCaptureRequests` `Promise.all([loadSource, buildCaptureArchiveState])` (`:122-125`): `Promise.all` attaches a handler to **every** branch, so the late rejection is handled (no `unhandledRejection`); pure reads ⇒ no partial writes ⇒ `failed`. |
| 4 | Malformed NDJSON | **failed** | Strict readers throw `malformed NDJSON at line N`. Whole-file read ⇒ one bad line fails the pass for *all* fixtures (blast radius — §4, carry-forward). |
| 5 | Torn final line (no fsync) | **failed** | Parses as malformed → throws (as #4). fsync gap is a substrate carry-forward, not a Stage-2B regression. |
| 6 | Immutable ID/hash conflict | **failed** | On read: `readAllOddsRecordsStrict` + Stage 2A `ArchiveStateConflictError` throw → producer `failed`. On write: `decideSnapshotAppend`/`decideOddsAppend`→`immutable_violation` → `runCaptureBatch` counts it → `hardFailed` → runner `failed`+`immutable_violation` (`runner.ts:301-306`). Never blind-retried; detected, not silent. |
| 7 | Missing archive file | **safe no-op** | ENOENT ⇒ `[]` (**only** ENOENT is empty) → empty archive state → normal first-run capture. Correct. |
| 8 | Wrong archive directory | **safe no-op** (config gate) | Wired default is path-consistent (§1). A mis-injected dir ⇒ ENOENT/empty discovery, but the write path is the real store and `capture.ts`'s full-stream pre-check + `decideSnapshotAppend` are the true idempotency guards ⇒ `already_exists`/`duplicate`, no corruption; wasted work only. Belongs to activation precondition AP-5 (archive ownership/path). |
| 9 | Source prediction load failure | **failed** (→ deferred re-fire) | `loadSource` rejects → producer rejects → runner `failed`; no writes; next cron retries. |
| 10 | Derivation callback failure | **deferred** (returns `{ok:false}`) / **failed** (throws) | `buildCaptureCandidates` counts a returned `{ok:false,reason}` and does **not** emit the candidate (`capture-provider.ts:221-224`). A *thrown* derivation is **not** per-fixture isolated (`:212` has no try/catch) → aborts the whole pass → `failed`. Acceptable now (seam is stubbed/synchronous); the live adapter **must** catch per-fixture (Gate G-2, §10). |
| 11 | Derivation returns inconsistent fixture/window identity | **deferred (rejected)** | `result.modelInput.fixtureId !== c.fixtureId` → `source_correspondence_failure`, candidate dropped (`capture-provider.ts:225-228`). `capturedAt` is set by the provider, never by derivation ⇒ the window anchor cannot be corrupted. No false candidate reaches M6. |
| 12 | Candidate provider throws | **failed** | Invalid `evaluationInstant`/`leadMinutes` → `TypeError` (`capture-provider.ts:45-61`) → producer rejects → runner `failed`. No writes. |
| 13 | M6 fails **before** snapshot append | **failed** or **deferred** | `archive_error` (pre-check read throw) → `writeFailed` → `failed`; `not_admitted`/`invalid_input`/`derivation_failed` → counted, no write, safe for that fixture. No snapshot ⇒ no partial pair. |
| 14 | M6 fails **after** snapshot, **before** odds | **retryable partial** | Snapshot committed, `ensureMandatoryCaptureOdds` fails → `writeFailed`/`immutableViolation` → run `failed` (zero-odds = failed capture, DoD-5). Snapshot persists as a partial pair; not a false success. |
| 15 | Retry after partial pair | **retryable partial → resolved** | Discovery derives `partialWindowKeys` (snapshot present, mandatory odds absent — Stage 2A `normalize.ts:104-106`) → healing candidate → `capture.ts` `already_exists` + C5 ensures missing odds. No duplicate snapshot, no new identity. |
| 16 | Retry after complete pair | **safe no-op** | Discovery derives `capturedWindowKeys` → `already_captured`, 0 candidates (test `complete pair → already_captured`). If injected anyway: `already_exists` + odds `duplicate`. No duplicate. |
| 17 | Duplicate job invocation | **safe no-op / deferred (409)** | Durable lock serializes; the second either 409s or runs after release and sees `already_exists`. No duplicate. |
| 18 | Two workers overlap | **deferred (409)** | Discovery is **inside** the lock; loser gets `null` → `skipped`/`lock_unavailable`/409, does no discovery/read. Cross-process guarantee rests on `EVIDENCE_DATABASE_URL` (M9, unchanged) — carry-forward config, not a Stage-2B regression. |
| 19 | Lock acquisition failure | **deferred (409, fail-closed)** | `tryAcquireJobLock`→`null` (no/`memory` `EVIDENCE_DATABASE_URL` in prod, or DB unreachable) → `runWithLock` returns `skipped` **before** `provideCandidates` runs → no discovery, no reads, no writes (`locks.ts:34-62`). |
| 20 | Unlock failure | **false-failure (H-1), not corruption** | `release()` unlock throw propagates through `finally` → runner → `cronHandler.ts:47` (no try/catch) → 500, misreporting a **successful, committed, idempotent** run. Unchanged from M9 (H-1). Not a false success; a false 500. Re-fire is idempotent. |
| 21 | Route timeout while locked work continues | **retryable partial** (latent; route dormant) | No INV-D deadline in Stage 2B. But the **route is dormant** (empty pass ≈ 0 ms), so no timeout is reachable in the merged state. When wired live, a >60 s run is platform-killed → lock auto-released, committed writes persist, re-fire idempotent. Gate G-1 (§10) before live wiring. |
| 22 | Process crash during discovery | **safe no-op / deferred** | Discovery is pure reads; crash writes nothing; lock auto-released; re-fire re-derives from the archive (INV-A). |
| 23 | Process crash during archive append | **retryable partial** | Mid-append torn line (no fsync) → next read throws → `failed` until quarantine (§4); crash between snapshot and odds → partial pair → heal (#15). Frozen M6 write path, unchanged by Stage 2B. |
| 24 | Empty candidate list | **safe no-op** | Provider `[]` or bare route → `runCaptureBatch([])` → `succeeded` zero-count = M9 baseline. |
| 25 | Very large archive | **safe no-op** (latent perf) | Single bounded whole-archive read per store (PB-1) — correct design; but O(A) parse/memory with no deadline is a live-wiring perf gate (G-1/benchmark), not a merged-state risk (route dormant). |
| 26 | Very large source prediction set | **safe no-op** (bounded output) | Stage-1 `normalizeBatchLimit` caps output at ≤150 (default 100), invalid config → 100 — never 500/unbounded **writes** (INV-C). Classification compute over a huge source is unbounded (deadline gate, live wiring). |

**Sweep property (holds):** across {corrupt read, conflict, source-load fail, derivation reject, identity mismatch, partial pair, missing score, in-play} the wired capture path yields only `failed`/`deferred`/`safe no-op`/`retryable partial` — **never** a duplicate immutable record, a false capture success, or a permanently starved candidate.

---

## 3. Lock and Worker Safety

- **Discovery under the lock (INV-L) — VERIFIED.** `runEvidenceCaptureJob` acquires the durable lock via `runWithLock("evidence_capture", …)` and only then `await options.provideCandidates()` (`runner.ts:302-306`). The flag check (`isCaptureEnabled`) short-circuits **before** the lock (`runner.ts:296-298`), so a disabled fire never discovers (test: `disabled capture flag short-circuits before discovery`, `calls===0`). No source/archive read happens before the lock is held.
- **Distinct key, no nesting.** Capture uses `job:evidence_capture` (M9), not shared with settlement; `provideCandidates` acquires no second lock — single non-nested lock, released in `finally` (`runner.ts:135-137`). No deadlock/ordering surface introduced.
- **Overlap / duplicate invocation.** Loser of a concurrent fire gets `null` → `skipped`/`lock_unavailable`/**409** (`locks.ts:64-90`), does **no** discovery. Serialized winner sees the archive at a single consistent head.
- **Acquisition/DB failure (fail-closed).** No/`memory` `EVIDENCE_DATABASE_URL` in production or an unreachable lock DB → `null` → `skipped`/409, **no memory fallback** for evidence jobs (`locks.ts:34-62`). Discovery never runs.
- **Cross-process single-writer** remains guaranteed **only** by the durable advisory lock bound to `EVIDENCE_DATABASE_URL` (M9). Stage 2B correctly placed discovery inside that lock and added no new writer, so it introduces **no** new cross-process hazard; the config dependency is an unchanged carry-forward (§8).
- **Unlock failure (H-1).** Unchanged from M9: a successful run whose `pg_advisory_unlock` throws surfaces as 500 (`cronHandler.ts:47` has no try/catch around `run()`). A false-500, not a data hazard; re-fire idempotent. Carry-forward (§8).

**No worker-safety regression. Stage 2B strengthens the boundary by putting discovery inside the lock.**

---

## 4. Archive Corruption Behaviour

- **Strict readers, no masking.** `readAllSnapshotsStrict` = `readNdjson(snapshots)` — ENOENT⇒`[]`; `EACCES/EPERM`, `EIO/EBUSY/ENXIO/ENODEV`, malformed line, any other errno ⇒ **throw** (`file.ts:73-126`). `readAllOddsRecordsStrict` — ENOENT⇒`[]`; malformed line, integrity-failed record, **and same-id/different-hash conflict** ⇒ throw (`odds-archive/file.ts:74-123`). Stage 2A builders **never catch** and `produceCaptureRequests` **never catches** → a corrupt archive **rejects** the producer → runner **`failed`** (DR-6 honoured: corruption is never counted as "0 candidates / empty success").
- **Conflict detection (two layers).** On read: `ArchiveStateConflictError` (Stage 2A normalizer, same-id/different-hash) + the odds reader's own conflict throw. On write: `immutable_violation`. Both surface as `failed`, never averaged or "pick-one".
- **Blast radius (carry-forward, availability not integrity).** Because reads are **whole-file**, a single malformed/torn line makes the entire snapshot (or odds) read throw → the **whole capture pass fails for all fixtures** until the file is quarantined/repaired. This is fail-closed (no corruption, no false success), but it is a real availability exposure. Mitigations belong to later stages/ops: fsync-on-append, the scheduled `verifyEvidenceChain` sweep, and line-level quarantine tooling (§8/§10). Not a Stage-2B regression — inherited from the frozen adapter design.
- **Orphan odds (odds-only) stays observability-only.** Stage 2A derives `orphanOddsWindowKeys` but the classifier ignores it; an odds-only window is treated as "no snapshot" ⇒ capture proceeds idempotently (never skipped/healed off the orphan). Confirmed the Stage-2B pipeline consumes only `capturedWindowKeys`/`partialWindowKeys` via the Stage-1 provider.

---

## 5. Partial-Pair Recovery

- **Cause (unchanged).** Snapshot (`snapshots.ndjson`) and mandatory odds (`odds-archive/records.ndjson`) are **separate, non-atomic** appends; a crash/write-failure between them leaves a snapshot without (all of) its odds.
- **Detection is correct (the critical dependency).** Stage 2A `normalizeCaptureArchiveState` keys **completeness on the reserved mandatory `evidence_capture` odds row per window**, not on any odds/operator quote: snapshot **+ mandatory odds** ⇒ `capturedWindowKeys` (skip); snapshot **only** ⇒ `partialWindowKeys` (heal) (`normalize.ts:96,104-106`; Stage-2A review §5.4). A partial pair is therefore classified **partial**, never complete — so it is **re-emitted**, not permanently excluded (the PP-4 trap from the failure review is closed).
- **Heal is idempotent.** The producer emits a `healing:true` candidate (test `snapshot-only → partial-pair healing candidate`, `candidatesHealing===1`); `captureEvidenceSnapshot` returns `already_exists` (full-stream pre-check) and `ensureMandatoryCaptureOdds` appends the missing odds (present → `duplicate`, missing → `appended`). No duplicate snapshot, no new identity.
- **Reported honestly.** A run that leaves a partial pair (odds write failed) reports `failed` (DoD-5: zero/partial-odds capture is a failed capture), so it is alerted and re-fired — not a false success.

**Partial-pair recovery is correct and derivation-gated on the right key. PASS.**

---

## 6. Retry and Idempotency

- **No internal retry wrapper** exists in the wired path (verified in the failure review; unchanged) — retries are external cron re-fires, serialized by the lock, each a bounded idempotent pass.
- **Idempotent re-fire.** Complete pair → `already_captured` (0 candidates); partial pair → heal; a fully-successful day re-fired → all `already_captured`/`duplicate`, zero new writes (= M9 empty pass).
- **Determinism preserved.** The pipeline reads **no clock** — `evaluationInstant` is injected (`capture-pipeline.ts:92`); `capturedAt` derives from kickoff−lead, not the decision clock; Stage 2A/Stage 1 are pure. So re-derivation is byte-stable and identity is `evalInstant`-independent (RE-2/RE-3 properties). Stage 2B adds no `Date.now`/`Math.random` (lint/typecheck clean; the only new clock reads are the M9 runner's existing `new Date()` for record timestamps, unchanged).
- **`immutable_violation` is non-idempotent-by-design** — a same-id/different-hash conflict signals a producer determinism bug; the runner reports `failed`+`immutable_violation` and it must be escalated, never blind-looped (a stuck fixture, not corruption).
- **INV-A (archive is the sole checkpoint).** No cursor/offset/cache added; progress is recomputed from the archive each pass (Stage 2A + the seam), so restart/replay recompute identical pending work.

---

## 7. False-Success Analysis

A "false success" would be a run reported `succeeded`/200 that silently dropped, duplicated, or half-wrote evidence. **None found:**

- **Corrupt/missing/throwing read → `failed`, never empty success.** `produceCaptureRequests` and the Stage 2A builders never catch; the runner's `try/catch` maps a producer rejection to `failed` (`runner.ts:123-134`), proven by the test `a rejecting provideCandidates fails the run (not an empty success)` (`status==="failed"`).
- **Partial pair → `failed`, never `captured`.** Zero/partial mandatory odds ⇒ `writeFailed`/`immutableViolation` ⇒ `hardFailed` ⇒ `failed` (DoD-5).
- **Empty result is genuinely empty.** A `succeeded` zero-count arises **only** from ENOENT (truly no archive) or no eligible fixtures — never from a swallowed error.
- **The one misreport is the opposite direction:** H-1 unlock-throw turns a *success* into a *500* (false failure), which is safe (re-fire idempotent), not a false success.
- **Observability nuance (non-blocking):** a discovery/producer throw is reported with the generic `errorCode: "unhandled"` rather than a specific `archive_read_failed`/`source_load_failed` code. It is still `failed`/500/alertable; only the *classification* is coarse. Recommend a specific code when producer diagnostics land (§10, non-blocking).

---

## 8. Carry-Forward Production Risks

None is a Stage-2B regression; all are inherited or explicitly-deferred, and all gate **live activation**, not this merge:

- **CF-1 — No INV-D deadline.** `runWithLock` has no internal deadline; only `maxDuration=60`. Latent while the route is dormant; **must** land (clamp ≤45 s, no-candidate-without-budget, clamped deadline into M4) before live wiring, with the B5 benchmark at representative archive depth.
- **CF-2 — Throwing derivation not per-fixture isolated.** `buildCaptureCandidates` does not wrap `deriveCaptureInput` in try/catch (`capture-provider.ts:212`); a live adapter that *throws* aborts the whole pass. The live derive-adapter must map faults to `{ok:false,reason}` per fixture (never throw).
- **CF-3 — Cross-process single-writer depends on `EVIDENCE_DATABASE_URL` config** (M9). Unchanged; an activation precondition (fail-closed if absent in prod).
- **CF-4 — H-1 unlock-throw → false 500.** Unchanged from M9; land the swallow/log so a committed idempotent run is not misreported.
- **CF-5 — Whole-file read blast radius + no fsync.** One torn/malformed line fails all fixtures until quarantine; a mid-append crash can torn-tail. fsync + scheduled `verifyEvidenceChain` sweep + quarantine tooling are ops/later-stage gates.
- **CF-6 — Producer-stage diagnostics not aggregated.** The producer's `CandidateDiagnostics` are returned but not merged into `resultCounts`/metrics; discovery failures report the generic `unhandled` code. Belongs to the diagnostics stage.
- **CF-7 — Very-large source classification compute is unbounded** (output is bounded by the ceiling; input classification is not) — bounded by the deadline gate (CF-1) once live.

---

## 9. Blocking Findings

**None.**

- No runtime regression: full suite **1769/1769** (M9 baseline preserved), typecheck exit 0, lint clean.
- No frozen-contract/identity/hash/revision/archive-format change (only two additive exported readers + one additive optional runner parameter).
- The bare cron route is **unchanged and dormant** (empty-safe M9 pass); no production caller passes `provideCandidates`.
- Fail-closed reads, discovery-in-lock, and correct partial-pair derivation are all present and tested.
- The wiring doc does **not** falsely claim production readiness (it explicitly defers deadline/diagnostics/live-derivation/settlement and states "M10 is NOT complete").

Per the review directive, deadline/diagnostics/live-derivation belonging to later stages are **not** blockers, and no immediate regression or false readiness claim exists.

---

## 10. Required Stage 2D/2E Gates (before live activation)

These MUST be closed before any caller wires `provideCandidates` into the live cron route with flags on:

- **G-1 (INV-D deadline).** Effective job deadline `min(configured, 60_000 − HEADROOM) ≤ 45 s`; start **no** candidate without sufficient remaining budget; pass the clamped deadline/AbortSignal into M4 fetch; reserve headroom for write-drain + diagnostics + serialization; record the B5 benchmark (capture at the ceiling vs representative archive depth < 60 s).
- **G-2 (per-fixture derivation isolation).** The live `deriveCaptureInput` (M4 fetch + M5 derive) must catch per fixture and map every fault (transient/timeout/integrity/no-baseline/missing-odds) to `{ok:false,reason}` — **never throw** (else it aborts the batch, CF-2). Add FA-7 isolation + FA-1 transient-fetch tests.
- **G-3 (single-writer config precondition).** Assert `EVIDENCE_DATABASE_URL` present + reachable and `NODE_ENV=production` before enabling; verify the multi-worker overlap test (409-not-500, loser does no discovery).
- **G-4 (H-1 unlock swallow).** Land the `pg_advisory_unlock` swallow/log so a successful idempotent capture is not reported as 500.
- **G-5 (corruption resilience ops).** fsync-on-append (or accept + document the torn-tail window) + scheduled `verifyEvidenceChain` sweep + line-level quarantine tooling, given the whole-file read blast radius (§4).
- **G-6 (producer diagnostics + specific error codes).** Merge `CandidateDiagnostics` into `resultCounts`/metrics with reconciling low-cardinality counters; replace the generic `unhandled` discovery-failure code with a specific `archive_read_failed`/`source_load_failed` classification; no entity id as a label.
- **G-7 (replay + crash/replay integration).** A4 serialization-boundary replay over live-derived captures; crash-after-N-of-M → re-fire completes M−N with no loss/duplicate; no-cursor static assertion.
- **G-8 (route wiring test).** When the route calls a `runLive*Job()`, assert auth/rate-limit/status-map unchanged, flag-off does no discovery, and discovery+reads fire only after the lock (IN-1/IN-12/IN-13).

---

## 11. Verdict

# PRODUCTION-SAFETY CONDITIONALLY PASSED

Stage 2B capture wiring is a **correct, dormant, fail-closed slice**: discovery runs inside the durable lock (INV-L), archive reads are strict and never masked as empty (a corrupt read → `failed`, never a false success), the odds discovery path matches the write path, partial pairs are derived on the mandatory-odds key and heal idempotently, the bare route stays dormant (M9 empty-safe pass), and no frozen contract/identity/format changed. Every one of the 26 evaluated failure modes resolves to `failed`, `deferred`, `safe no-op`, or `retryable partial` — **never corruption, false success, silent duplicate, or permanent starvation**. Full suite **1769/1769**, typecheck exit 0, lint clean.

The verdict is **CONDITIONALLY PASSED** (not PASSED) solely because live activation is gated on the §10 carry-forward gates (chiefly INV-D deadline, per-fixture isolation of a throwing live derivation, single-writer config, H-1, and producer diagnostics) — all of which the wiring doc correctly defers to later stages and none of which is a Stage-2B regression or a false production-readiness claim. It is **not BLOCKED**.

- **Verdict:** PRODUCTION-SAFETY CONDITIONALLY PASSED.
- **Immediate blockers:** none.
- **Carry-forward production risks:** CF-1 no deadline (INV-D); CF-2 throwing derivation not isolated; CF-3 single-writer `EVIDENCE_DATABASE_URL` config; CF-4 H-1 unlock-500; CF-5 whole-file-read blast radius + no fsync; CF-6 producer diagnostics/error-code granularity; CF-7 unbounded large-source classification.
- **Stage 2B may close: YES** (dormant, reusable, green; live activation gated on §10 G-1…G-8).
- **Files modified:** only `docs/plans/m10-stage-2b-production-safety-review.md` (this document).

**Confirmation:** review-document-only change. No runtime code, tests, routes, configuration, archives, feature flags, environment, database, or deployment were modified; no existing document was altered.
