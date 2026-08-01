# M10 Stage 2E-A — Activation Design — Closure Record

**Document type:** Formal milestone closure & review reconciliation (documentation-only). **No runtime code, test, route, feature flag, deployment, schema, or migration was created or modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E-A — Activation Design**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).

**Inputs reconciled:** the Stage-2E-A activation design plan; the five independent reviews — architecture (**CONDITIONALLY APPROVED**), production-safety (**CONDITIONALLY PASSED**), performance (**CONDITIONALLY PASSED**), test-strategy (**CONDITIONALLY APPROVED**), migration-compatibility (**CONDITIONALLY COMPATIBLE**); the Stage-2D closure. Each review's blocker declaration was verified from source: **all five report zero blockers.**

---

## 1. Executive Summary

Stage 2E-A produced a repository-grounded, fail-closed, reversible **design** for connecting the dormant M10 live-candidate pipeline to production writes — activation topology, a bounded all-OFF flag/mode hierarchy, a production completed-fixture-row reader over the **existing** daily-archive surface, testable route composition, the durable single-writer lock model, route-budget composition, dry-run/canary/full modes, kill switches, rollback, a failure-mode matrix, bounded observability, the Stage-2E-B benchmark contract, twelve activation gates, a go/no-go matrix, a test plan, and five default-OFF implementation slices.

Five independent reviews **unanimously report zero blockers**. The design requires **no frozen-contract, schema, or migration change**, an authoritative source **exists** with a known format, and every reviewer confirmed the plan's grounding claims against source (including the verified route-start deadline-anchor gap at `runner.ts` where the Stage-2D deadline is built after discovery). All "CONDITIONALLY" qualifiers attach to **implementation-spec pinning, Stage-2E-B benchmark evidence, production deployment provisioning, or the deferred capture-derivation stage** — none is a design defect.

The findings across the five reviews are **equivalent-merged** into a single de-duplicated carry-forward register (§4). No genuine design defect exists; **Stage 2E-A closes COMPLETE and the activation design is frozen.**

## 2. Review Reconciliation

| # | Review | Verdict | Blockers | Reconciliation |
|---|---|---|---|---|
| 1 | Architecture | CONDITIONALLY APPROVED | 0 | Design approved and **frozen**; the three clarifications (RC-1/RC-2/RC-3) are **implementation-spec** items requiring no architecture change → carried to Stage-2E-B implementation. At the architecture axis the design is **APPROVED**. |
| 2 | Production Safety | CONDITIONALLY PASSED | 0 | Path is fail-closed/reversible/dormant and safe-of-writes today; PC-1…PC-5 are pre-canary production clarifications (stall-detection, emergency-stop latency, multi-instance) → impl/deployment. |
| 3 | Performance | CONDITIONALLY PASSED | 0 | No unbounded production path; route-start anchor must ship before any write mode (= RC-3/PC-4); five benchmark-contract refinements → **Stage-2E-B benchmark**. |
| 4 | Test Strategy | CONDITIONALLY APPROVED | 0 | Four coverage items (A-1…A-5) asserted as design properties → enumerate as per-slice tests before the corresponding activation phase. |
| 5 | Migration / Compatibility | CONDITIONALLY COMPATIBLE | 0 | Additive-only, no schema/migration, HIGH-safety rollback; five bounded conditions the plan already specifies (strict reader, deadline anchor, no durable schema, Postgres read-port parity C-4, correction firewall). |

**Merged-equivalent findings (never duplicated):**
- **F-A — Missing-partition observability & path parity.** Architecture RC-1 ≡ Production PC-1. One item: distinguish/observe a legitimately-missing partition (ENOENT ⇒ empty/skip) vs a fault, and confirm the prepare-job ↔ reader resolve the same `data/daily-archives` path. → **2E-B implementation.**
- **F-B — Source freshness policy & stale-partition detection.** Architecture RC-2 ≡ Production PC-5 ≡ Test A-2. One item: a freshness threshold on the partition (`savedAt`/date) → `run_degraded`/defer on stale, with a stale-detection test. → **2E-B implementation (+ test).**
- **F-C — Route-entry deadline anchor + structural dry-run no-write test.** Architecture RC-3 ≡ Production PC-4 ≡ Performance (verified gap) ≡ Migration (deadline-anchor additive). One item: a **single** route-entry anchor so source-load+discovery are charged to ≤45 s, plus a **structural** dry-run zero-write test. → **2E-B implementation.**
- **F-D — Strict daily-archive reader.** Migration + the plan's own Gate C: `readDailyArchiveStrict` (ENOENT→empty; malformed/IO→throw), additive. → **2E-B implementation.**
- **F-E — Production NODE_ENV / durable-lock assertion.** Production PC-3: assert prod fail-closed durable lock (`requireDurable && NODE_ENV==="production"` + `EVIDENCE_DATABASE_URL`). → **2E-B implementation acceptance criterion + deployment (Gate D).**
- **F-F — PM2 / update-env restart & emergency-stop semantics.** Production PC-2: document request-time flag re-read vs restart; kill-switch latency. → **Deployment.**
- **F-G — Dry-run zero-write under failure & kill-switch semantics.** Test A-1 + A-3. → **2E-B implementation tests.**
- **F-H — Multi-instance contention.** Test A-4 (≡ Gate D): durable-lock contention test / `instances:1`-or-durable-lock. → **2E-B implementation test + deployment.**
- **F-I — Benchmark contract refinements.** Performance ×5: cold-vs-warm cache, concurrent capture+settlement, string-wall high-water **hard gate**, explicit file-only-adapter statement, scheduler-interval arrival-rate input. → **Stage-2E-B benchmark.**
- **F-J — Capture full-write deferred.** Test A-5 ≡ plan §21: gated on the unbuilt M4→M5 `deriveCaptureInput` stage. → **Future stage.**
- **F-K — Postgres read-port parity (C-4/CS-4/SC-1).** Migration: `createFile{Capture,Settlement}ReadPort` bypass the `EVIDENCE_ARCHIVE_ADAPTER` choke-point; a future Postgres cutover supplies matching read ports. Not worsened, not blocking. → **Future stage.**
- **F-L — Correction firewall.** Migration + plan §23: additive static+runtime+test+review guards; no correction behavior. → **2E-B implementation guard.**

## 3. Final Decision

**STAGE 2E-A COMPLETE.** No reviewer declared a blocker; no genuine design defect exists. Every condition is tied to Stage-2E-B benchmark evidence, deployment provisioning, activation gating, or the deferred capture-derivation stage — and per the closure mandate **must not block** Stage-2E-A closure. The activation design is **frozen**; downstream stages consume it as-is (no redesign).

## 4. Carry Forward — Classified Register

Each finding is placed in **exactly one** bucket.

### Bucket 1 — Stage 2E-A cleanup (optional, non-blocking)
- None material. (Any minor plan-wording polish is optional and does not gate closure; the design is frozen as-written.)

### Bucket 2 — Stage 2E-B implementation (required before implementation completes)
- **F-A** missing-partition observability + prepare↔reader path parity.
- **F-B** source-freshness policy + stale-partition detection (impl + test).
- **F-C** single route-entry deadline anchor + structural dry-run no-write test.
- **F-D** `readDailyArchiveStrict` (additive, ENOENT-vs-throw parity).
- **F-E** production `NODE_ENV`/durable-lock fail-closed assertion (impl acceptance criterion).
- **F-G** dry-run zero-write-under-failure test; kill-switch-semantics test.
- **F-H** multi-instance durable-lock contention test.
- **F-L** correction-firewall static+runtime+test guards.

### Bucket 3 — Stage 2E-B benchmark (performance / readiness)
- The full §25 benchmark contract, **plus the five refinements (F-I):** cold-vs-warm cache; concurrent capture+settlement; string-wall high-water as an explicit **hard gate**; explicit file-only-adapter statement; scheduler-interval arrival-rate input.
- FULL_WRITE (either path) not authorized until a ceiling-sized run < effective ≤45 s at representative depth and the provisional `reservePerCandidateMs`(250/120)/headroom(15 s) are validated or retuned.

### Bucket 4 — Deployment (production rollout only)
- **F-E/Gate D** provision + reachability of `EVIDENCE_DATABASE_URL`; `instances:1` **or** durable-lock before scale-out.
- **F-F** PM2/update-env restart & kill-switch-latency semantics (request-time re-read documented).
- Secret/scheduler provisioning (`CRON_SECRET`/`INTERNAL_CRON_SECRET`, `ENABLE_CRON`, cadence) — separate authorized deployment task.

### Bucket 5 — Future stages (outside Stage 2E)
- **F-J** capture live M4→M5 `deriveCaptureInput` derivation (blocks capture write).
- **F-K** Postgres evidence adapter + shared `EVIDENCE_ARCHIVE_ADAPTER`-keyed read-port resolver (later reversible cutover).
- Durable job-run store — **only if** canary proves ephemeral diagnostics insufficient (separate migration plan; §19 of the plan).
- Correction stage (`currentValidationHeads`/`correctionCause`/classification/revision/replay) — never pulled into Stage 2E.

## 5. Authorizations

- **Stage 2E-B planning: AUTHORIZED.** Stage 2E-B must produce its implementation spec pinning Bucket-2 items and its benchmark plan (Bucket-3), then undergo independent pre-implementation review.
- **Stage 2E implementation: NOT AUTHORIZED** (pending Stage-2E-B planning + reviews).
- **Production activation: NOT AUTHORIZED** (pending all gates A–L, the benchmark, deployment provisioning, and phased human go/no-go).
- **Capture full write: NOT AUTHORIZED** (additionally blocked on the future M4→M5 derivation stage).

No auto-promotion; every activation phase requires explicit human go/no-go per the plan's §24/§27.

## 6. Files

- **Created:** `docs/plans/m10-stage-2e-a-closure.md` (only project file).
- **Modified:** none (documentation-only closure; the session memory index + a closure note are updated per standing memory practice — no repository/runtime artifact).

---

## Final Status

STAGE 2E-A COMPLETE — ACTIVATION DESIGN FROZEN

Planning status:

COMPLETE

Independent reviews:

5/5 reconciled

Architecture:

APPROVED

Production:

CONDITIONALLY PASSED

Performance:

CONDITIONALLY PASSED

Testing:

CONDITIONALLY APPROVED

Compatibility:

CONDITIONALLY COMPATIBLE

Blockers:

0

Stage 2E-B planning authorized:

YES

Stage 2E implementation authorized:

NO

Production activation authorized:

NO

Files created:

docs/plans/m10-stage-2e-a-closure.md

Files modified:

NONE

Confirm explicitly:

NO runtime code modified

NO test modified

NO route modified

NO feature flag enabled

NO production reader wired

NO cron activated

NO benchmark executed

NO deployment modified

NO schema changed

NO migration created

NO correction behavior implemented
