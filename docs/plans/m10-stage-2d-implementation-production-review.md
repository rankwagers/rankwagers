# M10 Stage 2D — Operational Controls — Implementation Production Review

**Review type:** Read-only production-safety review of the **implemented** Stage 2D (INV-D deadline, remaining-time guard, partial-execution defer, producer diagnostics/accounting, completed-rows loader, operational config). **No runtime code, tests, routes, configuration, archives, or deployment were modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Production-Safety Reviewer, Sprint 23B / M10 Stage 2D.
**Under review:** `lib/evidence-capture/candidates/operational.ts` (new); `lib/evidence-capture/candidates/completed-rows.ts` (new); `lib/jobs/runner.ts` (producer-batch seam + INV-D wiring, additive); `lib/evidence-capture/jobs/{capture,settlement}-run.ts` (additive `deadline?` guard); `lib/evidence-capture/candidates/{types,diagnostics,capture-provider,settlement-provider}.ts` (additive counters/ceiling); `lib/evidence-capture/config.ts` (additive `resolveEvidenceOperationalConfig`); `tests/evidenceOperationalControls.test.ts` (new, 29). Frozen/unchanged: `types/evidence/*`, M6 `capture.ts`/`mandatory-odds.ts`, M8 `settlement.ts`/`outcomes.ts`/`validation/*`, identity/hash/revision/`settledAt`, archive NDJSON format, both cron routes, flag defaults, `locks.ts`, `cronHandler.ts`, `DEFAULT_CAPTURE_MAX_FIXTURES=500`, `DEFAULT_RUN_DEADLINE_MS=300_000`.
**Method:** every `file:line` read from source; deadline/guard/loader/runner integration verified directly and against the tests; validation re-run this pass.
**Validation (this pass):** targeted **175/175**; full suite **1824/1824** (0 fail; +29 over the 2C baseline of 1795); typecheck **exit 0**; lint **clean**; routes confirmed dormant; config defaults unchanged.

---

## 1. Executive Summary

Stage 2D implements the operational controls the 2B/2C reviews carried forward, as **pure, additive, dormant** helpers that engage **only on a live producer path** — the static-candidates and bare-cron paths are byte-for-byte M9. The cron routes are **unchanged** (both fire the bare job → empty-safe pass), no flag or config default changed, and the frozen M6/M8 cores and `types/evidence/*` are untouched (typecheck exit 0). All fifteen prior conditions are met and RC-1/RC-2 resolved.

**Verified safety properties (from source):**
- **INV-D deadline** (`operational.ts:49-63`): `resolveEffectiveJobDeadlineMs` = `clamp(min(configured, routeBudget−headroom), 1, min(routeBudget−headroom, 45_000))` — the 300 s default clamps to **≤45 s and is never honoured**; invalid/0/neg/NaN → fail-safe to 45 s (never unbounded, never 300 s). The clock is **injected** (`createDeadline`), a non-finite `now()` defers everything, and it **never enters** `capturedAt`/`completionInstant`/`nowSec`/identity/hash/ordering — it only gates whether the next candidate may begin.
- **Defer-not-overrun** (`capture-run.ts:114-119`, `settlement-run.ts:150-155`): the guard runs **at the top of each loop iteration, before any store touch** → defers the remainder (`deferredByDeadline += n`) and `break`s. It is strictly **between candidates**; an in-flight mint/settle append always completes, and only the *next* candidate is prevented. Absent ⇒ today's full-array M9 behaviour.
- **Fail-closed producer** (`runner.ts:379-397,476-494`): discovery runs **inside the held lock** (INV-L); a producer rejection is caught → run **`failed`** with a typed `producerErrorCode(err) ?? "unhandled"` — **never an empty success**. The completed-rows loader raises `ProducerError("source_load_failed")` on a reader throw **or a `null`/`undefined`** result (`completed-rows.ts`), never a silent `[]`.
- **Best-effort observability** (`operational.ts:330-361`, `runner.ts:317-337`): `mergeProducerResultCounts`/`emitProducerMetrics` are try/caught → a merge/emit failure falls back to the batch counts and **can never flip an otherwise-`succeeded` job to `failed`** (and, symmetrically, `hardFailed` is computed from the batch counts **before** the merge, so a merge failure can never mask a real write fault). Diagnostics are bounded, finite, low-cardinality — **no entity id is ever a key/label**.
- **Frozen append path untouched:** the deadline guard sits outside the M6/M8 core; each append stays one atomic content-addressed line; idempotency (snapshot id+hash / revisionId+hash) is preserved.

**No blocking finding.** The residual items (Gate B5 benchmark that discovery+batch < 60 s, the concrete completed-rows reader as an injected activation dependency, H-1 unlock-500, fsync, external alerting, route composition) are **later-stage activation gates** — none is a Stage-2D regression and none is reachable while the routes are dormant.

**Verdict: CONDITIONALLY PASSED.**

---

## 2. Dimension Evaluation

| Dimension | Verdict | Evidence |
|---|---|---|
| **Fail-closed behaviour** | **SAFE** | Producer rejection (loader/archive throw/conflict) inside the lock → `failed` + typed code (`runner.ts:389-397,486-494`); whole-source loader failure/`null` → `ProducerError("source_load_failed")` (`completed-rows.ts`); strict archive reads (2A/2B/2C) unchanged; a merge/emit failure cannot flip status. Tested (source rejection, archive throw). |
| **Deadline safety (INV-D)** | **SAFE** | `resolveEffectiveJobDeadlineMs` clamps ≤45 s, fail-safe → 45 s, never 300 s (`operational.ts:49-63`); injected clock, non-finite → defer-all (`:74-86`); engaged only on the producer path (`runner.ts:399-406,496-503`); static/bare-fire pass **no** deadline (M9 back-compat); clock never enters evidence data. Nuance in §3. |
| **Partial execution** | **SAFE** | Between-candidate guard, before any store touch, defers remainder + `break` (`capture-run.ts:114-119`, `settlement-run.ts:150-155`); never mid-append; deferred counted + re-discoverable (INV-A). |
| **Retry** | **SAFE** | Idempotent (capture `already_exists`/heal; settlement `already_settled`/`no_change`), lock-serialized; deadline-deferred candidates carry no state → re-derived from the archive; now **counted** (`deferred_by_deadline`) so retry is observable. |
| **Lock behaviour** | **SAFE** | Distinct fail-closed durable lock (no memory fallback in prod); discovery inside the lock; single non-nested lock released in `finally`; overlap → 409. Unchanged from M9; producer discovery correctly under the lock. |
| **Diagnostics** | **SAFE** | `flattenDiagnostics` bounded/finite fixed keys + `rejected_<reason>` over the **seeded, closed** set; **no entity id** (`operational.ts:297-318`); best-effort merge/emit (never fails a job); `run_degraded` is a visibility flag that does **not** flip status; reconciliation is internal-consistency only (does not fail the job). |
| **Loader failures** | **SAFE** | Whole-source failure (throw or `null`) → `source_load_failed` → `failed`, never empty; per-row faults isolated (dropped + counted, bounded reasons); non-terminal excluded (not a fault); pure/deterministic (matchId asc); read-only; concrete reader injected (activation dependency, not fabricated). |
| **Append safety** | **SAFE** | Frozen M6/M8 append paths unchanged; guard is outside the core, between candidates; each append one atomic content-addressed line; idempotency preserved. No fsync (pre-existing carry-forward). |
| **Shutdown** | **SAFE** | Effective deadline (≤45 s) < route budget (60 s) < PM2 `kill_timeout` (10 s post-SIGTERM); `finally` releases the lock; SIGKILL auto-releases the PG advisory lock; recovery idempotent. No SIGTERM drain (optional hardening). RC-2: no `AbortSignal` reaches any append. |
| **Restart** | **SAFE** | In-memory `jobLog`/metrics reset (non-authoritative, INV-A); **no cursor**; pending recomputed from the durable archive; lock re-acquired cleanly. Diagnostics freshness lost on restart (ops/alerting carry-forward). |
| **Crash recovery** | **SAFE** | Before append → nothing persisted → re-fire recomputes; after append → committed → idempotent (`already_exists`/`no_change`); torn mid-write line (no fsync) → strict read throws → `failed` until quarantine (pre-existing carry-forward, **minimized** by the deadline guard bounding the write phase). |
| **Dormant routes** | **SAFE** | Both routes call the bare job with no producer (`route.ts:13`), empty-safe M9 pass; no flag/route change; config defaults unchanged. The whole stage is reusable + dormant, exercised only by injected callers/tests. |
| **Operational invariants** | **SAFE** | INV-D (≤45 s clamp, injected clock, never in evidence data); INV-C (ceiling clamp `[1,150]` default 100, `500→150`, overflow deferred+counted); INV-A (no cursor, archive sole checkpoint, deferred re-discoverable); INV-L (discovery in lock); frozen identity/hash/revision/`settledAt` untouched; bounded-cardinality metrics; 2C first-settlement firewall preserved (no `correctionCause`, no `currentValidationHeads`). |

---

## 3. Deadline Safety Detail (INV-D)

- **Clamp is correct and fail-safe.** `resolveEffectiveJobDeadlineMs(300_000, …)` → `min(300_000, 60_000−15_000=45_000)` = **45_000**; a `0`/negative/`NaN`/non-number configured value → the bounded upper (45_000), never unbounded, never 300 s. Boundary-tested in the operational suite.
- **Injected clock, deterministic, isolated.** `createDeadline({startedAtMs, effectiveJobDeadlineMs, now})` computes `remainingMs = (startedAtMs + effective) − now()`; a non-finite `now()` returns `0` (defer everything). The runner defaults `now = Date.now` (correct — the deadline must bound wall time), but the clock is used **only** for `remainingMs`; every evidence field (`capturedAt`/`completionInstant`/`nowSec`) comes from the producer's injected `evaluationInstant`, never this clock. Verified in `operational.ts` and the runner.
- **Engaged only on the producer path.** `usingProducer` gates `producerDeadlineBudget`; the static-`candidates`/bare-fire path passes `undefined` → the batch behaves exactly as M9 (no deadline). This preserves the dormant empty-safe pass byte-for-byte.
- **Nuance (carry-forward, not a blocker):** the budget's `startedAtMs = now()` is captured **after** discovery, so the batch (the write phase) gets a fresh ≤45 s window while read-only discovery is **not** charged against it. Total wall time = lock + discovery + min(45 s, batch). If discovery ever exceeds the 15 s headroom, total could approach/exceed the 60 s route budget. This is **safe against corruption** (discovery is read-only — a platform kill there tears nothing) and the write phase is bounded to 45 s, but it means the **Gate B5 benchmark must prove discovery + batch < 60 s at representative archive depth** before live activation (perf review B5). Not reachable while dormant; not a Stage-2D correctness defect.

---

## 4. Partial-Execution, Loader & Diagnostics Detail

- **Partial execution defers, never overruns.** Both batch loops check `shouldStartNext(remainingMs(), reservePerCandidateMs)` at the loop top before `considered++` and before any store read/write; on insufficient budget they add the remaining count to `deferredByDeadline` and `break`, committing the processed prefix and returning `succeeded`. The in-flight candidate (already past the guard) always finishes its atomic append. Deferred candidates are counted and re-discovered next fire (INV-A/INV-S, no cursor) — no loss, no starvation from the mechanism itself.
- **Loader is fail-closed and read-only.** `createCompletedRowLoader` raises `ProducerError("source_load_failed")` on a reader throw **or** a `null`/`undefined` result — never a silent `[]`; `filterCompletedRows` is pure, isolates per-row faults (bounded drop reasons, never a fixture id), excludes non-terminal rows (not a fault, re-checked next fire), and dedups by `matchId` deterministically. The concrete whole-source reader is an **injected activation dependency, deliberately not fabricated** — nothing is wired into a route.
- **Diagnostics never endanger a job.** `mergeProducerResultCounts` and `emitProducerMetrics` are try/caught and fall back to the batch counts; `hardFailed` is derived from the batch result **before** the merge, so neither a merge failure nor a metrics failure can flip `succeeded↔failed` or mask a write fault. `run_degraded` (counted-but-safe rejects) is a **visibility flag only** — no false write occurs, and it does not change HTTP status (consistent with the M9/2C `hardFailed` policy). Reconciliation (RC-1 four grains / RC-2) is an internal-consistency check that is observable but does not fail the job (the underlying writes are content-addressed and idempotent, so a count mismatch is a metrics bug, not evidence corruption).

---

## 5. Frozen-Contract & Dormancy Confirmation

- **Frozen cores untouched:** M6 (`capture.ts`, `mandatory-odds.ts`), M8 (`settlement.ts`, `outcomes.ts`, `validation/*`), `types/evidence/*`, identity/hash/revision/`settledAt`, and the archive NDJSON format are unmodified (typecheck exit 0; the 2C first-settlement firewall — no `correctionCause`, no `currentValidationHeads` — remains intact).
- **Config defaults unchanged:** `DEFAULT_CAPTURE_MAX_FIXTURES=500` and `DEFAULT_RUN_DEADLINE_MS=300_000` are **clamped at the call site**, never edited; the new `resolveEvidenceOperationalConfig` (headroom + per-candidate reserves) is additive with provisional Stage-2E-tunable defaults.
- **Routes dormant:** both cron routes call `runEvidenceCaptureJob()` / `runPredictionSettlementJob()` with no producer and no `provideCandidate*` — the empty-safe M9 pass. No flag default changed. The entire Stage 2D surface is reusable-but-unwired, reachable only through injected callers and the test suite.

---

## 6. Blocking Findings

**None.** Stage 2D is additive, dormant, deterministic, and fail-closed; it changes no frozen contract, no flag default, and no route; the deadline/guard/loader/diagnostics are pure and best-effort where they touch observability; and the full suite (1824/1824), typecheck (exit 0), and lint (clean) are green. No path produces a false success, a false correction, a duplicate/forked record, an unbounded run, an entity-id metric label, or a mid-append cancellation.

---

## 7. Carry-forward Risks (later-stage activation gates)

- **CF-1 — Gate B5 benchmark.** Prove discovery + ceiling-sized batch < 60 s at representative archive depth (the §3 discovery-not-charged nuance); tune the per-candidate reserves (capture 250 ms / settlement 120 ms are provisional).
- **CF-2 — Concrete completed-rows reader.** The whole-source reader is an injected activation dependency; a Stage-2E caller must supply and validate it (and route-compose the producer) before flags flip.
- **CF-3 — Cooperative loader/M4 cancellation (RC-2 residual).** A hung read-only loader is bounded only by the 60 s platform kill (safe — no partial write); a deadline-bounded loader timeout / `AbortSignal` is the recommended Stage-2E hardening.
- **CF-4 — H-1 unlock-500.** A committed idempotent run whose `pg_advisory_unlock` throws still misreports as 500 (M9, unchanged).
- **CF-5 — Corruption resilience.** fsync-on-append (removes the torn-tail window the deadline guard already minimizes) + scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep + quarantine tooling.
- **CF-6 — Durable diagnostics + alerting.** Process-local diagnostics reset on restart; external alerting on `failed`/`run_degraded`/`deferred_by_deadline`/staleness is an ops gate.
- **CF-7 — Single-writer config precondition.** `EVIDENCE_DATABASE_URL` present/reachable + `NODE_ENV=production` (M9) before enabling the cross-process lock.

---

## 8. Verdict

# CONDITIONALLY PASSED

The implemented Stage 2D operational controls are **correct, additive, dormant, and fail-closed**. INV-D is enforced (effective job deadline clamped ≤45 s, injected clock isolated from all evidence data, engaged only on the producer path with byte-for-byte M9 back-compat); partial execution defers between candidates and never mid-append; the completed-rows loader is read-only and fail-closed (whole-source failure → `failed`, never empty; per-row faults isolated); diagnostics/metrics are bounded, low-cardinality, and best-effort (never fail or mask a job); the frozen M6/M8 append paths, identity/hash/revision semantics, archive format, flag defaults, config defaults, and both cron routes are unchanged; and retry/shutdown/restart/crash recovery are idempotent and archive-checkpointed (INV-A). Validation is green on every axis: targeted **175/175**, full suite **1824/1824**, typecheck exit 0, lint clean.

The verdict is **CONDITIONALLY PASSED** (not PASSED) because the slice ships **dormant** and live activation is gated on the §7 carry-forward items — chiefly the **Gate B5 benchmark** (discovery + batch < 60 s, since discovery time is not charged against the batch's ≤45 s window), the **concrete injected completed-rows reader + route composition**, and the standing H-1 / fsync / alerting / single-writer-config gates. None is a Stage-2D regression, and none is reachable while the routes fire the bare empty-safe job. It is **not BLOCKED**: there is no immediate correctness or safety regression and no blocking finding.

- **Verdict:** CONDITIONALLY PASSED.
- **Immediate blockers:** none.
- **Verified operational invariants:** INV-D (≤45 s clamp, injected clock, never in evidence data), defer-not-overrun (between-candidate, never mid-append), INV-C (ceiling `[1,150]`/100, `500→150`), INV-A (no cursor, deferred re-discoverable), INV-L (discovery in lock), fail-closed producer/loader (`failed`, never empty), best-effort diagnostics (never fail/mask a job, no entity-id labels), frozen contracts + routes + defaults unchanged.
- **Carry-forward (activation gates):** CF-1 B5 benchmark + reserve tuning; CF-2 concrete reader + route composition; CF-3 loader cancellation hardening; CF-4 H-1; CF-5 fsync/sweep; CF-6 durable diagnostics/alerting; CF-7 single-writer config.

**Confirmation:** review-document-only change. No runtime code, tests, routes, configuration, archives, feature flags, environment, database, or deployment were modified; the only file created is `docs/plans/m10-stage-2d-implementation-production-review.md`.
