# M10 Stage 2E-B — Benchmark & Production-Readiness Gates — Architecture Review

**Reviewer:** Independent Architecture Reviewer (Stage 2E-B).
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E-B — Benchmark & Production Readiness Gates**.
**Type:** Read-only architecture review. **No runtime code, route, job, feature flag, test, schema, database, migration, deployment, or benchmark script was created, modified, or executed. No benchmark was run.** The only file created is this document.
**Subject:** `docs/plans/m10-stage-2e-b-benchmark-readiness-plan.md`.
**Inputs read completely:** the spec (`m10-live-candidate-pipeline-specification.md`), `m10-stage-2d-closure.md`, `m10-stage-2e-a-activation-design-plan.md` (read in the 2E-A review this session), `m10-stage-2e-a-closure.md`, and the 2E-B plan.
**Source independently verified (file:line) this pass:** `lib/observability/metrics.ts:48-121` (`increment`/`gauge`/`timing`/`snapshot()→{counters,gauges,timers}`/`publicMetricsView()`); `lib/evidence-capture/capture/capture.ts:70` (`captureEvidenceSnapshot`), `capture/build.ts:70` (`buildCaptureSnapshot`), `odds-archive/record.ts:131` (`buildOddsRecord`), `settlement.ts:364,268` (`settleLatestSnapshotForFixture`, inline `ValidationRecord` mint); `lib/archive/evidence/file.ts:147,165` + `odds-archive/file.ts:74` (`readAll{Snapshots,Validations,OddsRecords}Strict`); `candidates/{settlement,capture}-pipeline.ts` (strict readers wired via `buildX ArchiveState`); `lib/jobs/runner.ts:306,381,401,478,498` (deadline anchored **post-discovery**); `lib/jobs/cronHandler.ts:46` (`started=Date.now()`); `lib/jobs/locks.ts` (prod fail-closed durable lock); `lib/evidence-capture/config.ts:120-122` (provisional constants); `lib/evidence-capture/candidates/operational.ts` (hard-max 45 000); `scripts/{mock-server-only.cjs,launch-readiness.mjs,rehearse-migrations.mjs}` (`refuseIfProd:22-25`).

---

## 1. Executive Summary

The Stage 2E-B plan is a **methodology-and-gates document**, not a runtime change. Its architectural posture is correct: the benchmark harness lives in `scripts/bench/m10/*.ts` (the verified `tsx`/`mock-server-only.cjs` convention), constructs **synthetic temp fixtures**, exercises the **actual built code paths** (producers, `buildX ArchiveState`, `runX Batch`, the strict NDJSON readers) with an **injected fake clock for determinism** and wall-clock timers for durations, and produces evidence-only artifacts under a docs/evidence path. It **introduces no runtime coupling, changes no architecture, requires no schema/persistence/contract/deployment/routing/cron change, creates no benchmark-only runtime branch, and creates no production-only behaviour.** Every load-bearing repository claim I re-verified is accurate — the metrics API, the strict whole-archive readers, the frozen entry points, the post-discovery deadline-anchor gap (the plan's F-C, correctly quantified as a *measurement* target rather than an implemented fix), the prod-URL-refusal harness precedent, and the durable-lock model.

The methodology is **reproducible, statistically meaningful, and fair**: pinned seed+env per cell, ≥30 warm + ≥10 cold samples on critical cells, warmup discard, p50/p95/p99/max/mean/stddev/CV with a CV≤0.25 stability gate, hardware-independent per-op counts and ratios alongside hardware-dependent wall-time, and a single `run-all.ts` reproducer. The failure classification is fail-closed, and the dry-run zero-write proof (byte-identical pre/post archive manifest under injected failure) is a genuinely structural check.

**No genuine architecture defect exists.** Four bounded clarifications remain — all resolvable during the B-1…B-7 execution **without any change to the frozen 2E-A architecture**: (BC-1) the fixture-builder symbol names are inaccurate and no standalone `ValidationRecord` builder exists, so the depth-archive generation mechanism must be pinned; (BC-2) the §15 readiness-gate table and the §16 Go/No-Go matrix are not 1:1 and should be reconciled; (BC-3) the "route entry" measurement boundary must state whether it drives `handleCronPost` or the runner job directly, and account for the un-measured HTTP-framework overhead; (BC-4) the "current-representative" and "high-water/string-wall" depths depend on Ops-provided prod line counts and inherited estimates, and must degrade to DEFER (already R-1) rather than a fabricated number.

**Verdict: CONDITIONALLY APPROVED** — the benchmark methodology and readiness-gate architecture are sound and complete for a planning milestone; BC-1…BC-4 are execution-time clarifications, none a defect and none blocking the planning milestone.

---

## 2. Repository Validation (every plan claim re-verified against source)

| Plan claim (§3 grounding + methodology) | Source | Verdict |
|---|---|---|
| Deadline anchored **post-discovery**; source+discovery escape the ≤45 s budget | `runner.ts:306` (`createDeadline({startedAtMs: now()})`) called at `:401/498`, **after** `provideCandidateBatch()` at `:381/478` | ✅ **accurate — the plan's central F-C claim holds** |
| Provisional constants (headroom 15000, reserves 250/120; hard-max 45000; ceiling 100/150) | `config.ts:120-122`, `operational.ts` hard-max, `limits.ts` 100/150 | ✅ |
| Route budget = `maxDuration=60`; route clock = `cronHandler` `started=Date.now()` | both routes `:7`; `cronHandler.ts:46` | ✅ (see BC-3 on measurement boundary) |
| Source `readDailyArchive` → daily-archive JSON, fail-open | `dailyArchive.ts` (verified in 2E-A review) | ✅ |
| Evidence store: strict whole-archive reads `readAll{Snapshots,Validations,OddsRecords}Strict`; `fs.readFile` string wall | `archive/evidence/file.ts:147,165`; `odds-archive/file.ts:74`; wired in both pipelines | ✅ **strict readers exist and are the real read path** |
| Frozen M6/M8 per-fixture scan cost (3+M / 2+2T) | `captureEvidenceSnapshot` (capture.ts:70), `settleLatestSnapshotForFixture` (settlement.ts:364) | ✅ (entry points exist; scan counts inherited from prior perf reviews) |
| Lock: PG advisory bound to `EVIDENCE_DATABASE_URL`, prod fail-closed | `locks.ts` (verified) | ✅ |
| Metrics evidence: `metrics.snapshot()→{counters,gauges,timers}`, `publicMetricsView()` | `metrics.ts:88-121` | ✅ |
| Harness convention: `scripts/*.{mjs,ts}` via `tsx`, `mock-server-only.cjs` hook; prod-URL refusal precedent | `scripts/mock-server-only.cjs`, `launch-readiness.mjs`, `rehearse-migrations.mjs:22-25` (`refuseIfProd`) | ✅ **precedent real (R-5 grounded)** |
| Deployment: `instances:1`, fork, `kill_timeout:10000`, no SIGTERM drain | `deploy/ecosystem.rankwagers.cjs` (verified in 2E-A) | ✅ |
| Fixture builders `createEvidenceSnapshot`/`createValidationRecord`/`buildOddsRecord` | `buildOddsRecord` ✅ (record.ts:131); **`createEvidenceSnapshot` ✗ (real: `buildCaptureSnapshot`); `createValidationRecord` ✗ (no standalone builder; minted inside `settleLatestSnapshotForFixture:268`)** | ⚠️ **BC-1 — two of three symbols do not exist** |
| String-wall depth ~357k snapshots / ~524k validations | not in current source; "per prior perf reviews" | ⚠️ inherited estimate (BC-4) — the depth gate re-establishes it empirically |

**Result:** every architectural/behavioural claim the benchmark *depends on* is source-accurate, with the single concrete exception of the fixture-builder symbol names (BC-1) and the acknowledged inherited depth estimates (BC-4). The plan did **not** overstate the strict readers, the metrics API, the deadline gap, or the harness precedent.

---

## 3. Architecture Validation

**No hidden runtime coupling; no architecture change.** The harness invokes the *same* runtime functions the production path uses (producer → `buildX ArchiveState` → `runX Batch` → strict readers), which is the correct way to obtain a faithful measurement — it does **not** fork a benchmark-only variant of any runtime path, and it does **not** introduce a production-only branch. The injected fake clock is the existing Stage-2D seam (`now`), not a new hook. Determinism is preserved: the clock is a decision input only and never enters identity/hash/ordering (verified in prior stages).

**The ten architecture questions, answered:**
- Hidden runtime coupling — **NO** (scripts/bench only; reuses existing seams).
- Changes existing architecture — **NO**.
- Requires schema evolution — **NO**.
- Requires persistence changes — **NO** (temp `mkdtemp` archives only; no durable job-run store — §19 defers that unless canary proves it necessary).
- Requires contract changes — **NO**.
- Requires deployment redesign — **NO** (it *models* `instances:1` and a durable-lock scale-out; provisioning is a separate carry-forward, not a redesign).
- Requires routing redesign — **NO**.
- Requires cron redesign — **NO** (scheduler cadence is an *input* to the INV-S check, not a change).
- Creates benchmark-only code paths — **NO in runtime** (the harness scripts are benchmark-only by definition; no runtime branch is added). The one runtime change the plan *references* — the route-entry deadline anchor — is a Stage-2E **implementation** item the benchmark *measures the need for* (F-C), not something 2E-B builds.
- Creates production-only behaviour — **NO**.

**Frozen-boundary integrity:** the plan explicitly measures the frozen M6/M8 O(F·A) cost without changing it (§Repository validation, R-4), generates fixtures through frozen builders so hashes/identity are *real* (correct — a synthetic archive with fake hashes would invalidate the string-wall and read-cost cells), and prohibits any frozen-contract/schema/migration change (Stop Condition §22). Architecturally clean.

---

## 4. Benchmark Validation

| Property | Assessment |
|---|---|
| **Reproducible** | ✅ pinned seed+env per cell; single-command cells; `run-all.ts`; command+seed+machine spec in every artifact. |
| **Repository-grounded** | ✅ mostly — actual code paths, real strict readers/metrics/lock; the fixture-builder naming (BC-1) is the one grounding inaccuracy, resolvable in B-2. |
| **Implementation-independent** | ✅ measures the real implementation (intended) and *also* reports hardware-independent per-op counts (archive reads, bytes parsed, scans) + ratios (discovery vs batch), so conclusions survive a re-implementation of timing. |
| **Deployment-independent** | ✅ machine-spec captured; acceptance = fraction-of-budget + hardware-independent invariants (single bounded read; no per-fixture rescan). Absolute wall-time budgets are hardware-dependent (R-3), mitigated as stated. |
| **Statistically meaningful** | ✅ ≥30 warm + ≥10 cold on critical cells; warmup discard (W=3); p50/p95/p99/max/mean/stddev/CV; CV>0.25 ⇒ unstable/re-run; p99 flagged as only meaningful at n≥100 or aggregated (internally consistent). |
| **Fair** | ✅ synthetic fixtures, no prod data/secret/entity-id, consistent env profiles; disposable-PG lock cells guarded against prod URLs (R-5, precedent verified). |
| **Repeatable** | ✅ deterministic seeds (index-derived, no `Math.random`), temp-dir lifecycle, append-only benchmark history for cross-run comparison. |

**Measurement boundaries (verified):** Start = route entry (`handleCronPost` `started`), End = response-serialize + lock release; phase timers wrap source-load/archive-read/discovery/provider/loop/append/cleanup/lock-hold. The **F-C route-budget proof** (report the phase split from route entry and prove `t_source + t_discovery + t_loop + t_cleanup ≤ budget − reserve`) is the right architectural artifact — it quantifies exactly how much budget the pre-anchor phases consume, sizing the Stage-2E entry-anchor. **Deadline anchor, reserve budget, headroom, ceiling, NDJSON string-wall** are all correctly identified as the tunables the benchmark validates/retunes rather than assumes.

**Assumptions that need pinning to be measurable (not defects):**
- **BC-1 (fixture generation):** generating a *representative-depth* archive of `ValidationRecord`s requires a mint mechanism, but there is **no standalone `createValidationRecord`** — records are produced only inside `settleLatestSnapshotForFixture`. The harness must therefore either drive settlement over seeded snapshots (realistic; one validation per settle, requires a matching snapshot per record) or replicate the frozen record construction including `contentHash`. Snapshots likewise use `buildCaptureSnapshot`, not `createEvidenceSnapshot`. Until B-2 pins this, the high-water/string-wall depth cells cannot be generated with real identity — which is exactly what makes those cells valid. **Resolvable in B-2; no architecture impact.**
- **BC-3 (route-entry boundary):** the harness calls the runner jobs; it does not necessarily traverse the real Next.js route + `handleCronPost` auth/rate-limit/serialization. The plan half-acknowledges this (category 10: "≈ route − auth/rate-limit"). Pin whether the harness drives `handleCronPost` or the job directly, and record the un-measured HTTP-framework overhead as a small, bounded addend so the "≤45 s from route entry" claim is honest.
- **BC-4 (depth inputs):** "current-representative" and "high-water" depths depend on Ops-provided prod line counts + inherited string-wall estimates. The plan handles absence via DEFER (R-1) — correct; pin that the depth gate is **DEFER, never a fabricated number**, and that the string-wall constant is re-confirmed empirically by the memory cells (§7) rather than assumed.

---

## 5. Readiness Gate Review

Thirteen gates (Environment · Secrets · Archive · Reader · Writer · Benchmark · Memory · Performance · Concurrency · Rollback · Deployment · Observability · Scheduler), each with purpose/owner/evidence/acceptance/failure-action. Reviewed for duplicates, gaps, contradictions, architecture leakage:

- **Purpose/owner/evidence/acceptance/failure-action** — all five fields present and coherent per gate; owners are correctly non-architecture (Platform/Ops/Perf/FootyStats), so **no architecture leakage** — gates describe *evidence to produce*, not code to change.
- **Duplicates** — Benchmark (matrix completeness) vs Performance (route p95 ≤45 s) overlap but are distinct (coverage vs a specific budget); acceptable, not a true duplicate.
- **Contradictions** — none. Failure actions (NO-GO for blocking gates; DEFER for depth/perf/observability/writer/scheduler) are internally consistent with the Go/No-Go rule.
- **Gap / reconciliation (BC-2):** the §15 gate table and the §16 Go/No-Go matrix are **not 1:1**. The matrix contains criteria with no named §15 gate row (**Frozen integrity**, **Dry-run zero-write**, **Canary evidence**, **Capture-full defer**), while §15 gates **Observability**, **Scheduler**, and the §13 **failure-injection classification** have **no Go/No-Go row**. Neither omission is a contradiction (the missing criteria are covered by §10/§11/§13 evidence and the 2E-A Gate L firewall), but the two tables should be reconciled so every Go/No-Go criterion maps to exactly one named gate with an owner and evidence artifact, and every blocking gate has a Go/No-Go disposition. **Documentation reconciliation; no architecture impact.**
- **Provability** — every gate's acceptance is provable from a concrete artifact (§14 per-cell JSON/CSV/metrics snapshot, dry-run manifest sha256, chain-verify output, env/secret-presence check, ecosystem review) or a source scan (frozen integrity). No gate requires evidence that cannot be produced by the harness or an ops check. The **Archive** gate ("current depth < operating ceiling") is not circular: the benchmark's §12 growth curve establishes the *operating ceiling*; Ops supplies the *current depth*; the gate compares — a legitimate two-input comparison.

---

## 6. Go / No-Go Review

- **Complete** — mostly; covers frozen integrity, reader, route p95, memory, concurrency, dry-run, canary, depth headroom, deployment/single-writer, capture-full deferral. **Incomplete vs §15** on Observability, Scheduler/INV-S, and failure-injection classification (BC-2) — these have gates but no matrix rows.
- **Internally consistent** — yes. Each criterion resolves to exactly one of GO/NO-GO/DEFER; the rule "any NO-GO on a blocking gate ⇒ activation refused; DEFER ⇒ waits on named remediation; no auto-promotion" is coherent and matches the 2E-A §24/§27 phased human go/no-go.
- **Architecturally enforceable** — yes. Every criterion maps to measurable evidence (bench artifacts, byte-identical manifest, chain-verify, per-op counts) or a config assertion (frozen source scan, `NODE_ENV`/durable-lock check, `instances:1`/lock proof). Nothing relies on an unfalsifiable claim. The "Capture full write → DEFER (needs M4→M5 derivation)" entry correctly encodes the future-stage dependency as a standing DEFER rather than a GO path.

---

## 7. Findings

**BLOCKER — none.** No genuine architecture defect; no runtime coupling; no schema/contract/migration/deployment/route/cron change; no benchmark-only runtime path; no production-only behaviour. The methodology is reproducible, statistically sound, and repository-grounded.

**Benchmark clarifications (resolvable in B-1…B-7; no architecture change):**
- **BC-1 — Fixture-builder grounding.** §4/§B-2 cite `createEvidenceSnapshot` and `createValidationRecord`, which do not exist (real: `buildCaptureSnapshot`; and `ValidationRecord`s are minted only inside `settleLatestSnapshotForFixture:268` — no standalone builder). Pin the depth-archive generation mechanism (drive settlement over seeded snapshots, or replicate the frozen record construction with a real `contentHash`) so the high-water / string-wall cells carry real identity. `buildOddsRecord` is correct.
- **BC-3 — Route-entry measurement boundary.** State whether the harness drives `handleCronPost` (real auth/rate-limit/serialization) or the runner job directly, and record the un-measured HTTP-framework overhead as a bounded addend so "≤45 s from route entry" is faithful.

**Implementation clarification (documentation reconciliation; no architecture change):**
- **BC-2 — Gate ↔ Go/No-Go reconciliation.** Make §15 and §16 1:1: give Observability, Scheduler/INV-S, and failure-injection classification a Go/No-Go disposition, and map the matrix-only criteria (Frozen integrity, Dry-run, Canary, Capture-full) to named gates with owners/artifacts.

**Benchmark/deployment clarification:**
- **BC-4 — Depth inputs.** "Current-representative"/"high-water" depths and the ~357k/~524k string-wall are Ops-provided/inherited; pin that their absence forces **DEFER** (never a fabricated number) and that the string-wall constant is re-confirmed empirically by the memory cells.

**Future-stage items (correctly deferred, not blocking):** capture M4→M5 `deriveCaptureInput` derivation (blocks capture write); Postgres evidence adapter + shared read-port resolver; durable job-run store only-if-canary-insufficient; streaming-read hardening if the event-loop stall DEFERs FULL_WRITE at deep archives; the correction stage.

---

## 8. Carry-Forward

- **Into Stage 2E-B execution (B-1…B-7):** BC-1 fixture-mint mechanism; BC-2 gate/matrix reconciliation; BC-3 route-entry boundary statement; BC-4 depth-input DEFER discipline. Plus the plan's own Bucket-2 measurement targets (F-A missing-partition observability, F-B freshness, F-C entry-anchor + structural dry-run no-write, F-D strict reader, F-E durable-lock assertion, F-L firewall) — 2E-B *measures/gates* these; the Stage-2E **implementation** builds them.
- **Into deployment:** `EVIDENCE_DATABASE_URL` provisioning + reachability (Gate D); `instances:1` or durable lock before scale-out; `kill_timeout` > effective deadline; secret/scheduler provisioning; PM2/update-env restart & kill-latency (F-F).
- **Into future stages:** capture derivation (F-J); Postgres adapter + read-port parity (F-K); durable job-run store (conditional); correction stage. **None pulled into 2E-B.**

---

## 9. Final Verdict

# STAGE 2E-B — CONDITIONALLY APPROVED

The Stage 2E-B benchmark methodology and production-readiness-gate architecture are **repository-grounded, internally consistent, statistically meaningful, reproducible, and architecturally clean.** The harness reuses the real runtime code paths over synthetic temp fixtures with an injected clock, introducing no runtime coupling, no benchmark-only runtime path, and no production-only behaviour, and it requires **no** schema, persistence, contract, deployment, routing, or cron change. It correctly measures the whole route **from route entry** — quantifying (not implementing) the verified post-discovery deadline-anchor gap — and it validates rather than assumes the provisional constants and the string-wall depth ceiling. The readiness gates are provable from concrete artifacts, and the Go/No-Go matrix is architecturally enforceable with no auto-promotion.

It is **CONDITIONALLY APPROVED** rather than APPROVED solely because four bounded clarifications (BC-1 fixture-builder grounding + validation-record mint mechanism; BC-2 §15↔§16 gate/matrix reconciliation; BC-3 route-entry measurement boundary; BC-4 depth-input DEFER discipline) should be pinned during the B-1…B-7 execution; **none is an architecture defect, and per the planning-milestone rule none blocks this planning milestone** — all are execution-time refinements that leave the frozen 2E-A architecture untouched. There is **no BLOCKER**: no genuine architecture defect, no unmeasurable assumption that cannot be pinned, no unprovable gate, no circular dependency, and no future coupling pulled forward.

- **Verdict:** CONDITIONALLY APPROVED
- **Blocker count:** 0
- **Benchmark clarifications:** 3 (BC-1, BC-3, BC-4)
- **Implementation clarifications:** 1 (BC-2)
- **Hidden runtime coupling:** NONE · **Architecture change:** NONE · **Schema/persistence/contract change:** NONE · **Deployment/routing/cron redesign:** NONE · **Benchmark-only or production-only runtime path:** NONE
- **Measurement from route entry (F-C):** correctly specified (measures the gap; entry-anchor is a Stage-2E impl item)
- **Dry-run zero-write proof:** structurally sound (byte-identical manifest under injected failure)
- **Readiness gates provable:** YES · **Go/No-Go enforceable:** YES (reconcile §15↔§16 per BC-2)
- **Stage 2E-B execution authorized (by this review):** design-authorized to proceed to execution; Stage 2E implementation and production activation remain NOT authorized (pending 2E-B evidence + independent review + gates + deployment + phased human go/no-go)

---

## 10. Confirmation

- No runtime code modified.
- No benchmark executed.
- No tests modified.
- No routes/jobs/feature flags modified or enabled.
- No deployment modified.
- No schemas modified.
- No migrations modified or created.
- No production reader wired; no cron activated; no production data/secret/archive read.

The only file created is `docs/plans/m10-stage-2e-b-architecture-review.md`.
