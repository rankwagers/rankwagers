# M10 Stage 2D — Deadline / Lifecycle Enforcement — Production Review

**Review type:** Read-only production-safety review of the Stage 2D scope (INV-D job deadline, timeouts, partial-execution / remaining-time guard, loader failures, diagnostics / job accounting, and the retry / cancellation / shutdown / restart lifecycle). **No code, tests, routes, configuration, archives, or deployment were modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Production-Safety Reviewer, Sprint 23B / M10 Stage 2D.
**Governing:** `m10-live-candidate-pipeline-specification.md` (Rev A1) — **INV-D** (§7.3: effective job deadline strictly below the route budget), **INV-C** (§7.2 ceilings), **INV-A** (§7.5 archive is the sole checkpoint), Gate **A9/B5** (deadline clamp + benchmark); the Stage 2B/2C production reviews (deadline listed as the top carry-forward gate).
**Code inspected (file:line):** `lib/jobs/runner.ts:55-138` (`runWithLock` — no deadline/abort); `lib/evidence-capture/jobs/capture-run.ts:94` + `settlement-run.ts:131` (unguarded loops); `lib/evidence-capture/config.ts:138,153,241-243` (`DEFAULT_RUN_DEADLINE_MS = 300_000`); `app/api/internal/cron/*/route.ts:7` (`maxDuration = 60`); `lib/evidence-capture/routing/orchestrator.ts:76,104-119` (M4 fetch `deadlineExceeded`/`skipped_budget`/`skipped_deadline`, injected clock); `lib/jobs/diagnostics.ts` (process-local job log); `lib/evidence-capture/candidates/{capture,settlement}-pipeline.ts` ("NO deadline (INV-D) enforcement"); `instrumentation.ts:36-66` (no SIGTERM drain); `deploy/ecosystem.rankwagers.cjs:35-41` (`instances:1`, `fork`, `kill_timeout:10000`).

---

## 1. Executive Summary

**Stage 2D is UNBUILT** (verified): there is no `deadline.ts`, no job-level deadline / `AbortSignal` in `runWithLock`, no per-candidate remaining-time guard in either batch loop, no `deferred_by_deadline` accounting, and no Stage 2D document. The capture/settlement pipelines explicitly state "**NO deadline (INV-D) enforcement**." The only bounds today are the route `maxDuration = 60` (a platform hard-kill) and the M4 fetch orchestrator's own `runDeadlineMs`/`requestBudget` defer — which defaults to **300 s (5× the route budget)** and is **not clamped** for the web-cron path.

**The current posture is production-SAFE only because it is dormant.** Both cron routes run the M9 empty-safe pass (no producer wired, no live loader), so **no deadline, timeout, partial-execution, or cancellation risk is currently reachable in production** — a bare fire is ~0 ms. Across the lifecycle dimensions the dormant system is sound: loader failures fail closed (`failed`, never empty — tested in 2B/2C); retry is idempotent and serialized by the durable lock; restart recomputes pending work from the archive (INV-A, no cursor); and shutdown auto-releases the PG advisory lock on connection drop.

**But INV-D is a binding spec MUST, and it is unmet.** The moment a later stage wires a live loader/derivation and enables the flags, the absence of an enforced job deadline + a defer-not-overrun guard becomes an immediate risk: a run can exceed 60 s → the platform hard-kills it **mid-write** (no fsync) → a torn NDJSON tail line that fails-closed the whole file until quarantine. Stage 2D exists to close exactly this.

**Verdict: CONDITIONALLY PASSED** — the dormant system is safe across all evaluated dimensions with **no immediate regression and no blocking finding**, but live activation is gated on Stage 2D delivering: the INV-D deadline (clamp ≤ 45 s), the remaining-time / partial-execution defer guard (defer, never overrun), cooperative cancellation (never mid-append), and merged deferred-aware diagnostics/accounting.

---

## 2. Dimension Evaluation Matrix

Classes: **safe** (correct today) · **safe-dormant** (correct only because unreachable while dormant) · **gap** (must be built for INV-D before activation) · **carry-forward** (from 2B/2C).

| # | Dimension | Current behaviour (verified) | Class | Stage-2D requirement |
|---|---|---|---|---|
| 1 | **Deadline** | No job-level deadline in `runWithLock`; `started = Date.now()` is a **metric only** (`runner.ts:95,109`). M4 fetch uses `runDeadlineMs` default **300 000** (`config.ts:153`) — 5× the route budget, unclamped. | **gap** | `effectiveJobDeadlineMs = min(configured, 60_000 − HEADROOM) ≤ 45_000`; the 300 s default is **clamped, never honoured** on the web-cron path (INV-D / A9). One authoritative deadline for the whole job. |
| 2 | **Timeouts** | Only hard bound = route `maxDuration = 60` (platform kill). M4 has per-fetch retry/timeout (`retryLimit`, `runDeadlineMs`). No job-body timeout; no `AbortSignal`. PM2 `kill_timeout = 10_000`. | **gap** | The job must **self-bound below 60 s** so the platform never hard-kills it; thread the clamped deadline as an `AbortSignal` into the loader/M4 (`orchestrateFetches` already accepts an injected clock/deadline). |
| 3 | **Partial execution** | Batch loops iterate **all** candidates (`capture-run.ts:94`, `settlement-run.ts:131`), no guard. On deadline the platform **hard-kills mid-loop** → uncontrolled partial (some committed, some not). Recovery is idempotent re-fire (capture `already_exists`/heal; settlement `already_settled`/`no_change`). | **safe-dormant / gap** | A **graceful per-candidate stop**: before starting candidate k, if remaining < worst-case per-candidate, **stop and defer** k..N (`deferred_by_deadline`), committing 1..k-1. Defer, never overrun. |
| 4 | **Remaining-time guard** | None in the runner/batch. M4 has `deadlineExceeded()` at the fetch grain but keyed on the 300 s default (`orchestrator.ts:104-119`). | **gap** | `remainingMs(start, now, effectiveDeadline)` + `shouldStartNext(remaining, worstCasePerCandidate)` reserving explicit headroom for **write-drain + diagnostics emission + response serialization**; injected clock (no `Date.now` in the guard's decision if it is to stay testable — mirror M4's injected clock). |
| 5 | **Loader failures** | `loadCompletedRows`/`loadSource`/`deriveCaptureInput` rejection → producer rejects → runner **`failed`** (fail-closed, tested 2B/2C). M4 transient fetch failure → `not_admitted`/deferred. **But** a *throwing* live derivation is not per-fixture isolated in the capture provider (Stage 2B CF-2). | **safe / carry-forward** | Keep fail-closed (`failed`, never empty). The live loader/derive-adapter must map faults **per fixture** (defer, not throw the whole batch), and a partial-loader result must not be counted as complete. |
| 6 | **Diagnostics** | `getEvidenceJobDiagnostics` (process-local `jobLog`, bounded 500, **reset on restart**) surfaces last status/error/`resultCounts`/freshness (`diagnostics.ts`). Producer `CandidateDiagnostics` are **not merged** into `resultCounts`; a discovery failure reports the generic `errorCode: "unhandled"`. | **gap / carry-forward** | Merge producer + batch counts into one flat, low-cardinality `resultCounts` with `deferred_by_deadline`/`deferred_by_cap`/`backlog`/`oldest_pending_age`; specific failure codes (`archive_read_failed`/`source_load_failed`); **no entity id as a label**; diagnostics emission must be best-effort (never fail the job). |
| 7 | **Job accounting** | `resultCounts` from the batch + `refresh_job_{total,success,failure,duration_ms}` metrics. `hardFailed = writeFailed>0 \|\| immutableViolation>0` → **only durable-write faults flip to `failed`**; `invalidInput`/`notFound`/`fixtureMismatch`/`invalidScore` are counted but do **not** alert via the 500 path (2C CF-2). No deadline-defer accounting. | **gap / carry-forward** | Reconciling identities: `eligible = selected + deferred_by_cap`; `selected = processed + deferred_by_deadline + failed`. Deferred ≠ failed ≠ rejected as distinct counters; surface input-validation faults so they are visible without reading raw logs. |
| 8 | **Safe retry** | External cron re-fire, serialized by the durable lock; idempotent (capture `already_exists`/heal; settlement `already_settled`/`no_change`). A deadline-deferred candidate carries **no state** (INV-A) → re-derived next fire. | **safe** | Preserve archive-derived re-discovery (no cursor); **count** deferred candidates so retry is observable and the capacity gate (`cadence × ceiling ≥ arrival`, INV-S) can be checked. |
| 9 | **Safe cancellation** | **No `AbortSignal`/cooperative cancel.** A route timeout is an uncontrolled platform kill, not a cooperative cancel. An in-flight append either completes (durable) or is torn (no fsync). | **safe-dormant / gap** | Cooperative cancellation via `AbortSignal` (from the clamped deadline and/or a platform signal) that **stops starting new candidates** and lets the in-flight atomic append finish — **never cancel mid-append**; deferred remainder counted. |
| 10 | **Safe shutdown** | PM2 SIGTERM → `kill_timeout 10_000` → SIGKILL. **No SIGTERM drain handler** (`instrumentation.ts` registers only `unhandledRejection`/`uncaughtException`). On clean completion `finally { lock.release() }` runs (`runner.ts:135-137`); on SIGKILL the PG advisory lock **auto-releases on connection drop**; committed appends persist; the last append may torn-tail (no fsync). | **safe / gap** | Ensure the job deadline (≤ 45 s) < route budget (60 s) < any SIGKILL grace, so a job is **never** killed mid-write. Optional: a SIGTERM handler that stops discovery. Recovery stays idempotent regardless. |
| 11 | **Safe restart** | `jobLog`/metrics are in-memory → **reset on restart** (non-authoritative, INV-A). **No cursor** → restart recomputes pending work from the durable archive. The lock is re-acquired fresh. | **safe** | No correctness change needed. Document that diagnostics freshness resets on restart (durable history/alerting is an ops gate); pending work is always archive-derived. |

---

## 3. Deadline & Timeout Safety

- **No enforced job deadline exists (INV-D unmet).** `runWithLock` runs `fn` to completion with no timeout/abort; `Date.now()` is used only for the `refresh_job_duration_ms` metric. The route `maxDuration = 60` is the sole hard bound, and it is a **platform hard-kill**, not a cooperative deadline.
- **The M4 fetch layer already has the right *shape* — but the wrong *value*.** `orchestrateFetches` computes `deadlineExceeded()` against an **injected monotonic clock** (never `Date.now`, `orchestrator.ts:76`) and defers remaining fetches as `skipped_deadline`/`skipped_budget` (`:104-119`). This is the correct defer-not-overrun pattern, but it keys on `runDeadlineMs` (default **300 s**) and only covers capture's fetch step — not the settlement path, and not the archive-write/serialization phases. Stage 2D must (a) clamp the effective deadline to ≤ 45 s and (b) extend the guard to the **whole job** (fetch + derive + write + diagnostics + serialization), not just M4 fetch.
- **Why this is safe today and unsafe once live.** Dormant: an empty pass never approaches 60 s. Live: a ceiling-sized run (≤150) against a large NDJSON archive is the documented O(F²) risk (Stage 2C perf) — capable of exceeding 60 s → platform kill **mid-write** → torn tail line → whole-file fail-closed read until quarantine. INV-D + the Gate B5 benchmark (ceiling-sized run < effective deadline at representative archive depth) are the required controls.

---

## 4. Partial-Execution & Remaining-Time Guard

- **Today: uncontrolled partial on kill.** Both batch loops process every candidate; there is no `remaining`-time check, so a deadline is only "enforced" by the platform killing the process mid-loop. The committed prefix persists; the rest is silently dropped for that fire (re-derived next fire). This is *recoverable* (idempotent re-fire) but not *graceful*.
- **Required: defer, never overrun.** Before each candidate, compute `remainingMs` and compare to a conservative worst-case per-candidate cost (capture: fetch+derive+snapshot append+odds appends; settlement: `listValidations`+`latestSnapshot`+per-market append). If insufficient, **stop and defer** the remainder, counted `deferred_by_deadline`, and return `succeeded` with the committed prefix — never start work that can't finish before the platform kill. Reserve headroom for write-drain + diagnostics + response serialization (so a committed run's 200/JSON actually returns).
- **Deferred candidates are re-discoverable by design (INV-A/INV-S):** they carry no state; the next fire re-derives them from the archive in deterministic order, so no candidate is lost or starved — provided the capacity gate holds and the deferral is **counted** (so the backlog/oldest-age signals exist).

---

## 5. Loader-Failure Behaviour

- **Fail-closed, verified (2B/2C).** A source-loader or archive-read rejection propagates through `Promise.all` in the producer → the producer rejects → `runWithLock`'s `try/catch` maps it to `status: "failed"` (`errorCode: "unhandled"`) → 500. **Never an empty "0 processed" success.** No partial writes precede discovery, so a discovery-phase failure is clean.
- **Carry-forward (must land with the live loader):** a *throwing* live derivation/loader is not per-fixture isolated in the capture provider (`capture-provider.ts:212` has no try/catch) — a throw aborts the whole batch. The live derive-adapter/completed-rows loader must map faults to `{ok:false, reason}` per fixture (defer, not throw), and the generic `unhandled` code should be replaced with a specific classification (`source_load_failed`/`archive_read_failed`) so loader failures are distinguishable from write faults.

---

## 6. Diagnostics & Job Accounting

- **Current surface is process-local and coarse.** `getEvidenceJobDiagnostics` projects the in-process `jobLog` (bounded 500, **reset on restart**, per-process): last status/error/`resultCounts`/`lastSuccessAgeSec`. Adequate for a single-instance PM2 deployment as a scrape target, but it loses history on restart and does not aggregate producer-stage counts.
- **Accounting gaps Stage 2D must close:**
  - No `deferred_by_deadline` / `deferred_by_cap` / `backlog` / `oldest_pending_age` in the job record — required to observe INV-C/INV-D/INV-S behaviour.
  - Producer `CandidateDiagnostics` (discovered/eligible/selected/…) are not merged into `resultCounts`.
  - `hardFailed` flips to `failed` **only** on `writeFailed`/`immutableViolation`; `invalidInput`/`notFound`/`fixtureMismatch`/`invalidScore` are counted but do not alert via 500 — so a malformed-candidate or a mis-corresponded row is silent to the HTTP path (no false settlement is written; the count exists). Surface these when diagnostics land.
  - Reconciliation identities must be assertable and **no entity id may be a metric label** (bounded cardinality).
  - Diagnostics emission must be **best-effort** — a diagnostics failure must never fail an otherwise-successful job.

---

## 7. Retry / Cancellation / Shutdown / Restart

- **Retry — SAFE.** External cron re-fire; the durable lock serializes; idempotent recovery (capture full-stream `already_exists` + odds heal; settlement `already_settled`/`no_change`). Deadline-deferred candidates are re-discovered from the archive (INV-A, no cursor). Stage 2D only needs to **count** deferrals so retry is observable.
- **Cancellation — SAFE-DORMANT / gap.** No cooperative cancellation exists; today "cancellation" is a platform kill. It is safe only because the route is dormant. Stage 2D must add `AbortSignal`-based cooperative cancellation that stops *starting* candidates and never interrupts an in-flight atomic append (each append is one line; a candidate is either committed or not-started, never half-written by the guard).
- **Shutdown — SAFE (with a caveat).** On clean completion the `finally` releases the lock; on SIGKILL after the 10 s PM2 grace the PG advisory lock auto-releases on connection drop and committed appends persist. The only exposure is a torn tail line if a SIGKILL lands mid-`appendFile` (no fsync) — which the ≤45 s job deadline (well inside the 60 s route and the 10 s post-SIGTERM grace) is designed to make unreachable. No SIGTERM drain handler exists; adding one is optional hardening, not a correctness requirement, because recovery is idempotent.
- **Restart — SAFE.** In-memory `jobLog`/metrics reset on restart (non-authoritative); there is **no cursor** (INV-A), so a fresh process recomputes identical pending work from the durable archive. The lock is re-acquired cleanly. The only loss is diagnostics freshness (an ops/alerting concern, not correctness).

---

## 8. Blocking Findings

**None (no immediate regression).** Stage 2D is unbuilt, but nothing built is broken: the routes are dormant (empty-safe), loader failures fail closed, retry/restart are idempotent and archive-checkpointed, shutdown auto-releases the lock, and the M4 fetch layer already defers on its own budget/deadline. There is no reachable deadline/partial/cancellation hazard in the current production posture.

The unmet items are **gates**, not defects in existing code: INV-D is a binding spec MUST that must be satisfied **before** live activation, not a bug in the dormant system.

---

## 9. Stage 2D Blocking Conditions (must be satisfied before live activation)

- **SD-1 — Enforced INV-D job deadline.** `effectiveJobDeadlineMs = min(configured, 60_000 − HEADROOM) ≤ 45_000`, clamping the 300 s default on the web-cron path; one authoritative deadline for the whole job (not just M4 fetch); injected clock for testability.
- **SD-2 — Remaining-time / defer-not-overrun guard.** Per-candidate `remainingMs` + `shouldStartNext(remaining, worstCasePerCandidate)`; start no candidate without budget; defer the remainder (counted), commit the prefix, return `succeeded`. Reserve headroom for write-drain + diagnostics + serialization.
- **SD-3 — Cooperative cancellation.** Thread the clamped deadline as an `AbortSignal` into the loader/M4 and the batch loop; stop starting candidates; never cancel mid-append.
- **SD-4 — Deferred-aware diagnostics/accounting.** Merge producer + batch counts; add `deferred_by_deadline`/`deferred_by_cap`/`backlog`/`oldest_pending_age`; reconciling identities; specific failure codes; no entity-id labels; best-effort emission (never fails the job).
- **SD-5 — Loader/derivation per-fixture isolation (carry-forward).** The live loader/derive-adapter maps faults per fixture (defer, not throw the batch); loader failure stays `failed`, never empty.
- **SD-6 — Gate B5 benchmark.** Ceiling-sized capture and settlement runs against representative archive depth complete within the effective deadline (< 60 s); the deadline+workload combination is not accepted without the recorded benchmark.
- **SD-7 — Dormancy preserved / honest scope.** Keep the routes on the empty-safe pass until activation; do not claim production readiness; document deadline/diagnostics as the Stage-2D deliverables.

---

## 10. Carry-forward Risks (out of Stage 2D)

- **CF — H-1 unlock-500:** a committed idempotent run whose `pg_advisory_unlock` throws misreports as 500 (M9). Independent of the deadline; land the swallow/log.
- **CF — Single-writer config:** `EVIDENCE_DATABASE_URL` present/reachable + `NODE_ENV=production` (M9) is an activation precondition for the cross-process lock.
- **CF — Corruption resilience:** fsync-on-append (removes the torn-tail window the deadline guard minimises) + scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep + quarantine tooling.
- **CF — Stage-3 corrections:** the settlement correction path (`currentValidationHeads`) remains deferred; Stage 2D does not enable it.
- **CF — Durable diagnostics/alerting:** process-local diagnostics reset on restart; external alerting on failure/deadline-defer/staleness is an ops gate.

---

## 11. Verdict

# CONDITIONALLY PASSED

Stage 2D (the INV-D deadline, remaining-time guard, partial-execution defer, and diagnostics/accounting enforcement) is **unbuilt**, but the current dormant system is **production-safe across every evaluated dimension with no immediate regression and no blocking finding**: no deadline/timeout/partial/cancellation hazard is reachable while the routes run the empty-safe pass; loader failures fail closed (`failed`, never empty); retry and restart are idempotent and archive-checkpointed (INV-A, no cursor); and shutdown auto-releases the durable lock with idempotent recovery. The M4 fetch layer already implements the correct defer-not-overrun pattern (on an injected clock), which Stage 2D must clamp (≤ 45 s) and extend to the whole job.

The verdict is **CONDITIONALLY PASSED** (not PASSED) because INV-D is a binding spec MUST that is currently unmet, and it — together with the defer guard, cooperative cancellation, and deferred-aware diagnostics — is a **mandatory gate before live activation**: once a live loader/derivation is wired and the flags are enabled, an unbounded job can exceed the 60 s route budget and be hard-killed mid-write (torn tail → whole-file fail-closed). It is **not BLOCKED** because nothing built is broken and the risk is unreachable in the dormant posture.

- **Verdict:** CONDITIONALLY PASSED.
- **Immediate blockers:** none.
- **Required (before activation):** SD-1 enforced ≤45 s deadline (clamp the 300 s default); SD-2 remaining-time defer-not-overrun guard; SD-3 cooperative `AbortSignal` cancellation (never mid-append); SD-4 deferred-aware merged diagnostics/accounting; SD-5 per-fixture loader/derivation isolation; SD-6 Gate B5 benchmark; SD-7 dormancy preserved.
- **Safe today (dormant):** deadline/timeout/partial/cancellation unreachable; loader failures fail closed; retry/restart idempotent (archive checkpoint); shutdown auto-releases the lock.

**Confirmation:** review-document-only change. No runtime code, tests, routes, configuration, archives, feature flags, environment, database, or deployment were modified; the only file created is `docs/plans/m10-stage-2d-production-review.md`.
