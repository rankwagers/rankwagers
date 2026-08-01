# M10 Stage 2E-B — Benchmark & Production-Readiness Gates — Closure Record

**Document type:** Formal milestone closure & review reconciliation (documentation-only). **No runtime code, benchmark script, test, route, feature flag, deployment, schema, or migration was created or modified; no benchmark was executed.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E-B — Benchmark & Production Readiness**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).

**Inputs reconciled:** the Stage-2E-B benchmark & readiness plan; the five independent reviews — architecture (**CONDITIONALLY APPROVED**), production-safety (**CONDITIONALLY PASSED**), performance (**CONDITIONALLY PASSED**), test-strategy (**CONDITIONALLY APPROVED**), migration-compatibility (**COMPATIBLE**); the Stage-2E-A design (frozen) + its closure; the Stage-2D closure. Every review's blocker declaration was verified from source: **all five report zero blockers.**

---

## 1. Executive Summary

Stage 2E-B produced the **evidence-phase design** — a repeatable, repository-grounded, statistically-meaningful, reproducible benchmark methodology plus thirteen production-readiness gates and a GO/NO-GO/DEFER matrix — that must complete before any production write is authorized. It measures the route from **route entry** (charging the verified Stage-2D deadline-anchor gap where source-load + discovery escape the ≤45 s budget), validates the provisional constants (headroom 15 000, reserves 250/120, ceiling 100/150), and gates the file-adapter depth below the string wall. It **validates**; it never activates, persists, or redesigns.

Five independent reviews **unanimously report zero blockers.** No reviewer found a benchmark-planning defect: the methodology can produce trustworthy, audit-suitable evidence; the harness is additive and evidence-only (synthetic temp fixtures, no production data/secrets, reusing real code paths); and no frozen-contract/schema/migration change is required. Every condition is an **execution-time clarification, a Stage-2E implementation dependency, a deployment provisioning item, or a future milestone** — reconciled and de-duplicated into the register below.

Two findings were confirmed against source during reconciliation: (a) the frozen builders the plan references (`createEvidenceSnapshot` at `lib/evidence/snapshot.ts`, `createValidationRecord` at `lib/validation/records.ts`) **do exist** — BC-1 is a grounding nuance (also `buildCaptureSnapshot`/`buildOddsRecord` are available), not a plan error; and (b) a **real deployment gap** — `deploy/ecosystem.rankwagers.cjs` sets `kill_timeout: 10000` (10 s), **below** the 45 s effective deadline, so a graceful-shutdown SIGKILL could land mid-run before the deadline completes → a Deployment carry-forward (M-F).

**Stage 2E-B closes COMPLETE and the benchmark & readiness plan is frozen.**

## 2. Review Reconciliation

| # | Review | Verdict | Blockers | Reconciliation |
|---|---|---|---|---|
| 1 | Architecture | CONDITIONALLY APPROVED | 0 | Methodology + readiness-gate architecture sound and complete; BC-1…BC-4 are execution-time clarifications, none a defect; frozen 2E-A architecture untouched. |
| 2 | Production Safety | CONDITIONALLY PASSED | 0 | Evidence-only harness safe; F-1…F-3 are safety-critical **harness isolation guards** to pin before B-1/B-2 (temp-dir targeting; isolate the hardcoded source path; refuse prod URLs) — achievable with existing seams. |
| 3 | Performance | CONDITIONALLY PASSED | 0 | Repeatable/reproducible/grounded/fair/representative; no unbounded path; P-1…P-8 are fidelity refinements (raw-sample percentiles; route-entry = phase-sum model until impl; cold-start isolation; tail samples; disposable PG). |
| 4 | Test Strategy | CONDITIONALLY APPROVED | 0 | Objectively verifiable pre-production; T-1…T-6 clarifications incl. the **verified `kill_timeout` 10 s < 45 s deployment gap**. |
| 5 | Migration / Compatibility | COMPATIBLE | 0 | Additive harness; no schema/migration/frozen change; disposable PG (never prod); artifacts non-DB; Postgres/retention deferred. |

**Merged-equivalent findings (never duplicated):**
- **M-A — Harness fixture builders.** Architecture BC-1 ≡ Compatibility C-3. Bind the harness generators to the **verified** frozen builders (`createEvidenceSnapshot` + `createValidationRecord` confirmed present; `buildCaptureSnapshot`/`buildOddsRecord` available); pin the validation-record mint mechanism at execution. → **Benchmark execution** (+ minor plan-wording cleanup).
- **M-B — Gate↔matrix mapping.** Architecture BC-2. Tighten the §15 readiness-gates ↔ §16 go/no-go 1:1 mapping. → **Stage 2E-B cleanup.**
- **M-C — Route-entry measurement.** Architecture BC-3 ≡ Performance P-2. The route-entry total is a phase-sum **model** until the entry-anchor + composition ship; the end-to-end route-entry benchmark runs **after** Stage 2E implementation. → **Benchmark execution** (ordering; depends on impl).
- **M-D — Representative production depth.** Architecture BC-4 ≡ Production F-5 ≡ Performance P-6 ≡ Test T-4. External Ops-provided input; **DEFER** until provided. → **Benchmark execution** (input dependency).
- **M-E — Harness isolation guards.** Production F-1 ≡ F-2 ≡ F-3 (+ Compat/Perf disposable-PG guard). Assert write cells target a **temp** evidence dir (never the prod `/opt/rankwagers/shared/evidence-archive` default that `NODE_ENV=production` selects); isolate the hardcoded `process.cwd()/data/daily-archives` source path; refuse prod-looking PG URLs. → **Benchmark execution** (pin before B-1/B-2).
- **M-F — Deployment kill-timeout gap.** Production F-4 ≡ Performance P-5 ≡ Test T-2. **Verified:** `kill_timeout=10000` < 45 s effective deadline → set `kill_timeout` > the effective deadline (and confirm `maxDuration=60`) so a shutdown never kills mid-run. → **Deployment.**
- **M-G — Percentile source.** Performance P-1 ≡ Test T-1. The harness computes p50/p95/p99 from **raw per-sample durations**, not from the metrics API (`metrics.timing` aggregates count/sum/max only). → **Benchmark execution.**
- **M-H — Cold-start normalization.** Performance P-3. Cold samples must isolate FS-cold from tsx/JIT startup. → **Benchmark execution** (+ cleanup wording).
- **M-I — Tail confidence.** Performance P-4 ≡ Test T-3. ≥100 samples on critical cells for p99. → **Benchmark execution.**
- **M-J — Metrics-failure coverage.** Test T-5. Benchmark the best-effort metrics-failure path. → **Benchmark execution.**
- **M-K — Regression preservation.** Test T-6. The Stage 2E implementation (when built) keeps the full suite green; the harness itself is not a test. → **Stage 2E implementation.**
- **M-L — Additive harness.** Compatibility C-1. Confirmed additive, no runtime coupling — no action. → **(compatibility confirmation).**
- **M-M — Stage 2E implementation.** Compatibility C-4. The next milestone that consumes the evidence and ships the route-entry anchor + composition (default OFF). → **Stage 2E implementation.**
- **M-N — Artifact persistence.** Compatibility C-5. Persist artifacts to a versioned/audit docs-evidence location (not a durable DB schema). → **Benchmark execution.**
- **M-O — Retention / future storage.** Performance P-8. Deep-archive retention / Postgres cutover. → **Future milestone.**

## 3. Final Decision

**STAGE 2E-B COMPLETE.** No reviewer declared a blocker; no genuine benchmark-planning defect exists. Per the closure mandate, none of the following blocks closure: benchmarks not executed; implementation not written; deployment unfinished; future milestones remaining. The benchmark & readiness plan is **frozen**; downstream work consumes it as-is (no new methodology, no redesign of Stage 2E-A).

## 4. Carry Forward — Classified Register

Each reconciled finding is placed in **exactly one** bucket.

### Bucket 1 — Stage 2E-B cleanup (optional, plan-wording, non-blocking)
- **M-B** tighten §15 gates ↔ §16 go/no-go 1:1 mapping.
- **M-A (partial)** correct/confirm the frozen-builder symbol references in plan §4/§18 (builders verified present).
- **M-H (partial)** sharpen cold-start-isolation wording.
- **M-L** additive-harness confirmation (no action).

### Bucket 2 — Stage 2E implementation (the next build milestone, default OFF — consumes 2E-B evidence)
- **M-M** build the frozen 2E-A composition (`resolveM10ActivationConfig`, `readDailyArchiveStrict`, activation modules, **route-entry deadline anchor**, dry-run/canary wiring, reconciliation wiring) — the anchor that M-C's true benchmark depends on.
- **M-K** regression preservation (keep the full suite green when the composition lands).

### Bucket 3 — Benchmark execution (the evidence-run after the harness is built)
- **M-A** harness generators bind the verified frozen builders + pin the validation mint mechanism.
- **M-C** run the end-to-end route-entry benchmark **after** the entry-anchor ships (ordering).
- **M-E** harness isolation guards (temp-dir assertion; isolate hardcoded source path; refuse prod URLs; disposable PG).
- **M-G** compute percentiles from raw per-sample durations (not the metrics API).
- **M-H** cold-sample FS-cold vs startup isolation.
- **M-I** ≥100 samples on critical cells for p99 tail confidence.
- **M-J** metrics-failure best-effort cell.
- **M-N** persist artifacts to a versioned audit location.
- **M-D** representative production depth — **DEFER** on the Ops-provided depth input.

### Bucket 4 — Deployment (production rollout only)
- **M-F** set `kill_timeout` > the effective deadline (currently 10 s < 45 s); confirm `maxDuration=60` vs the deadline; `instances:1`/durable-lock; secret + scheduler provisioning.

### Bucket 5 — Future milestone (outside Stage 2E)
- **M-O** retention / deep-archive / Postgres future storage.
- Carried from 2E-A (unchanged): capture live M4→M5 `deriveCaptureInput` derivation (blocks capture write); Postgres evidence adapter + shared read-port resolver; durable job-run store only-if-canary-insufficient; correction stage. **None pulled into Stage 2E-B.**

## 5. Authorizations

- **Stage 2E implementation planning: AUTHORIZED.** The next milestone plans (then, after review, builds) the frozen 2E-A composition (default-OFF), including the route-entry deadline anchor + strict reader + the harness; it does **not** activate anything.
- **Stage 2E implementation: NOT AUTHORIZED** (pending its own planning + independent review).
- **Benchmark execution: NOT AUTHORIZED** (the harness must first be built as part of the Stage-2E implementation planning/build; the evidence-run follows).
- **Production activation: NOT AUTHORIZED** (pending built+reviewed composition, benchmark evidence + gate pass, deployment provisioning, and phased human go/no-go).
- **Capture FULL_WRITE: NOT AUTHORIZED** (additionally blocked on the M4→M5 derivation stage).

No auto-promotion; every activation phase requires explicit human go/no-go per Stage-2E-A §24.

## 6. Files

- **Created:** `docs/plans/m10-stage-2e-b-closure.md` (only project file).
- **Modified:** none (documentation-only closure; the session memory index + a closure note are updated per standing memory practice — no repository/runtime artifact).

---

## Final Status

STAGE 2E-B COMPLETE — BENCHMARK & READINESS PLAN FROZEN

Planning status:

COMPLETE

Independent reviews:

5/5 reconciled

Architecture:

CONDITIONALLY APPROVED

Production:

CONDITIONALLY PASSED

Performance:

CONDITIONALLY PASSED

Testing:

CONDITIONALLY APPROVED

Compatibility:

COMPATIBLE

Blockers:

0

Stage 2E implementation planning authorized:

YES

Stage 2E implementation authorized:

NO

Benchmark execution authorized:

NO

Production activation authorized:

NO

Files created:

docs/plans/m10-stage-2e-b-closure.md

Files modified:

NONE

Confirm explicitly:

NO runtime code modified

NO benchmark executed

NO benchmark scripts modified

NO tests modified

NO routes modified

NO feature flags enabled

NO deployment modified

NO schema changed

NO migration created

NO production activation performed
