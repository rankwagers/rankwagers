# M10 Stage 2E-B — Benchmark & Production-Readiness Gates — Independent Performance & Scalability Review

**Document type:** Independent performance & benchmark-methodology review (review-only). No runtime code, route, cron, job, flag, test, schema, database, migration, or deployment was modified; no benchmark code was implemented or executed; no production was activated. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Performance & Scalability Reviewer, Sprint 23B / M10 Stage 2E-B.
**Under review:** `docs/plans/m10-stage-2e-b-benchmark-readiness-plan.md` (methodology only — I review whether it can produce **trustworthy production-performance evidence**; I do not review runtime implementation nor redesign Stage 2E-A).
**Inputs read:** the M10 spec (Rev A1); `m10-stage-2d-closure.md`; `m10-stage-2e-a-activation-design-plan.md`; `m10-stage-2e-a-closure.md`; the 2E-B plan.
**Method:** every grounding claim in the plan **re-verified against the repository** (I did not trust the plan). `file:line` cited.

**VERDICT: CONDITIONALLY PASSED** — the methodology is repeatable, reproducible, repository-grounded (all claims verified), statistically structured, fair, and production-representative; it **can** produce trustworthy evidence. **Blocker count: 0.** Conditions are seven clarifications that improve fidelity (chiefly: percentiles come from harness sampling not the metrics API; the route-entry total is a phase-sum model not an end-to-end measurement; cold samples must isolate FS-cold from tsx startup). See Findings.

---

## 1. Executive Summary

Stage 2E-B is an **evidence-only** methodology plan: a synthetic-fixture, temp-dir, actual-code-path benchmark harness (`scripts/bench/m10/`, tsx) over an archive-depth × source × candidate-volume × mode × concurrency matrix, with a measurement contract (route-entry start, serialize+lock-release stop, W=3 warmup, ≥30 warm + ≥10 cold, p50/p95/p99/max/mean/stddev/CV, CV≤0.25 stability), 18 performance categories, memory/CPU/event-loop/concurrency/failure sub-plans, durable audit artifacts, 13 readiness gates, and a GO/NO-GO/DEFER matrix. It measures the whole route including the verified Stage-2D gap where source-load+discovery escape the ≤45 s budget, validates the provisional constants (headroom 15 s, reserves 250/120, ceiling 100/150, hard-max 45 s), and sets the file-adapter string-wall depth (~357 k snapshots / ~524 k validations) as a hard gate.

**The plan does not activate anything, implements no benchmark, and requires no frozen/schema change** — consistent with the strict rules. Its repository grounding is accurate in every claim I checked. The methodology is sound; my findings are refinements to remove measurement bias and stated-vs-actual mismatches, none of which prevents trustworthy evidence.

## 2. Repository Validation (verified — I did not trust the plan)

| Plan claim | Verified in code | Status |
|---|---|---|
| Deadline anchored **post-discovery** (source+discovery escape budget) | `runner.ts:306` `createDeadline({startedAtMs: now()})` inside `producerDeadlineBudget` (`:297`), **called at `:401`/`:498` AFTER `await provideCandidateBatch()` `:381`/`:478`** | ✅ accurate |
| Route clock = handler entry | `cronHandler.ts:46` `started = Date.now()`; route `maxDuration = 60` | ✅ accurate |
| Provisional constants | `config.ts:120-122` (headroom 15000, reserves 250/120); `operational.ts:29` hard-max 45000; `limits.ts:11-12` 100/150 | ✅ accurate |
| Strict whole-archive readers exist | `file.ts:147` `readAllSnapshotsStrict`, `:165` `readAllValidationsStrict`; odds `file.ts:74` `readAllOddsRecordsStrict` | ✅ accurate |
| Writer = `appendFile`, **no fsync** | `file.ts:135`, odds `file.ts:167` (`appendFile`); grep `fsync/fdatasync/flush` → none | ✅ accurate |
| Frozen builders for fixtures | `snapshot.ts:202` `createEvidenceSnapshot`; `validation/records.ts` `createValidationRecord`; `odds-archive/record.ts` `buildOddsRecord` | ✅ accurate |
| Chain verifiers exist | `evidence/integrity.ts` `verifyEvidenceChain`; `validation/integrity.ts` `verifyValidationChain` | ✅ accurate |
| Lock: PG advisory, prod fail-closed | `locks.ts:10,27-28,39` (`requireDurable`+`NODE_ENV==="production"`+no `EVIDENCE_DATABASE_URL`→null); memory via `JOB_LOCK_ADAPTER=memory` | ✅ accurate |
| Harness convention | `scripts/{mock-server-only.cjs,launch-readiness.mjs,validate-release.ts,rehearse-migrations.mjs}` all present | ✅ accurate |
| Deployment | `ecosystem.rankwagers.cjs:35-40` `instances:1`, fork, `kill_timeout:10000`; **no SIGTERM drain** in `instrumentation.ts` | ✅ accurate (see F-5) |
| Metrics API | `metrics.ts:88-109` `snapshot()→{counters,gauges,timers}`; `:120` `publicMetricsView()`; timers = `{count,sum,avg,max}` | ✅ accurate — **but timers hold no percentiles (F-1)** |
| No Postgres evidence adapter | `service.ts` file/memory only | ✅ accurate |

**Every grounding claim is repository-accurate** → high confidence in the plan's premises. `perf_hooks.monitorEventLoopDelay`, `process.cpuUsage()`, `process.memoryUsage()`, `process.hrtime.bigint()` are Node built-ins (available).

## 3. Benchmark Methodology Review

- **Repeatable:** ✅ fixed index-derived seeds (no `Math.random`), pinned env profile, W=3 warmup, ≥30 warm/≥10 cold.
- **Reproducible:** ✅ one command + seed + machine spec per cell → JSON artifact; `run-all.ts`; raw CSV; append-only benchmark history.
- **Repository-grounded:** ✅ exercises the **actual** built paths (producer, `buildXArchiveState`, `runXBatch`, strict readers) and generates fixtures via the **frozen** builders so hashes/identity are real; harness convention matches the repo.
- **Statistically meaningful:** ✅ largely — p50/p95/p99/max/mean/stddev/CV with a CV≤0.25 stability rule and p95≤budget / p99≤budget×1.1 / max<60 s acceptance. Caveat: per-cell p99 from ~40 samples is weak (F-4).
- **Implementation-independent:** ✅ reports hardware-independent **per-op counts** (archive reads, bytes parsed, files opened, scans) + **ratios** + **fraction-of-budget** acceptance alongside wall-time.
- **Fair:** ⚠️ mostly — synthetic fixtures via frozen builders, warmup discard, cold worst-case; **but** the cold-sample method conflates FS-cold with tsx/module-load startup that production does not pay (F-3).
- **Production representative:** ✅ depth × source(normal/high/malformed/duplicate) × volume(0–150+over) × mode × concurrency; string-wall high-water. Caveat: "current-representative depth" for a **dormant** pipeline ≈ 0 (F-6).

## 4. Measurement Contract Review

Start (route entry, `cronHandler.ts:46`), stop (serialize + `runWithLock` `finally` release), warmup (W=3), cold (≥10 fresh-process), warm (≥30), variance (stddev + CV), stats (p50/p95/p99/max/mean/n), acceptance (p95≤budget; p99≤budget×1.1; **max<60 s hard**), confidence (validated only at representative **and** high-water depth, CV≤0.25) — all **defined and coherent**. Three contract-level caveats:
- **F-1 (percentile source):** `metrics.snapshot()` timers expose only `{count,sum,avg,max}` — **no percentiles, no stddev, no raw samples** (`metrics.ts:88-109`). The p50/p95/p99/CV therefore **cannot** come from the metrics API; they must come from the harness's own `hrtime.bigint()` per-sample capture (§4/§14 do collect this). The §3 phrasing "metrics.snapshot() = primary evidence source" is imprecise for percentiles.
- **F-2 (route-entry total is modeled, not measured):** the entry-anchored composition (`runLiveXJob`, the route-entry deadline anchor) is built in **Stage 2E implementation, after 2E-B**. So 2E-B cannot measure an actual entry-to-response route; it **sums measured phase durations** (source+archive+discovery+provider+loop+cleanup+serialize+lock-release) to model it and size the reserve. Legitimate, but the plan must state the "complete route" number is a phase-sum reconstruction and the real anchored route is re-benchmarked post-build.
- **F-4 (p99 sample size):** ~40 samples/cell → per-cell p99 ≈ the top sample; the plan hedges ("n≥100 or aggregated"). The **max<60 s hard gate** is the real tail bound; treat per-cell p99 as indicative or raise n on the critical route cell.

## 5. Performance Coverage

All eleven required dimensions have a defined instrument and budget: **source-loading** (cat 1, phase timer), **archive-loading** (2, `buildXArchiveState`), **discovery** (3), **candidate-filtering** (4, `filterCompletedRows`), **settlement** (5, `runSettlementBatch`, the O(F·A) dominant), **capture dry-run only** (6, correctly no writes — capture writes gated on the unbuilt M4→M5 derivation), **writer** (7, append µs/record; O(1) write + O(A) admission read; fsync-absent noted), **lock** (8), **complete route** (9, from entry) and **complete job** (10, lock-acquire→release) distinguished, **cleanup** (within reserve). The route-budget proof (F-C) correctly quantifies the pre-anchor (source+discovery) consumption to size the entry-anchor. **Coverage is complete.**

## 6. Memory Review

`process.memoryUsage()` at phase boundaries + peak tracking; RSS/heapUsed/heapTotal at baseline/after-source/after-archive(peak)/after-discovery/after-batch/after-cleanup; **leak detection** via heap growth across ≥30 warm runs (monotone climb = NO-GO); GC influence via optional `--expose-gc` + `perf_hooks` GC entries; **peak allocation** = the transient whole-file string + split + parsed (~4–5× file); **string-wall hard gate** (a read that would exceed `MAX_STRING_LENGTH` ~512 MB must be **prevented** by the depth ceiling, not attempted). Methodology is **sound and complete** for the file adapter. Note: peak-RSS acceptance depends on an **Ops-provided instance memory budget** (external input).

## 7. CPU Review

Per-phase `process.cpuUsage()` deltas → CPU-bound vs IO-bound classification; hotspots via `--cpu-prof`/`--prof` on the heaviest cells (expected top self-time: NDJSON `JSON.parse`, odds `verifyOddsRecord` hash, `evidenceContentHash`) — **report-only, no optimization** (frozen paths), correct; **event-loop lag** via `monitorEventLoopDelay()` p50/p99/max (the synchronous whole-file parse is the stall risk, prior ~4–6 s/100 k) → a user-starvation risk on the single fork is a **DEFER → streaming-read hardening** (future), correctly not pulled in; idle/scheduler pressure tied to the INV-S capacity relation. **Complete.** Caveat folds into F-3: CPU/event-loop cold samples in a fresh tsx process include interpreter/JIT warmup absent from a warm prod process — baseline-subtract.

## 8. Scalability Review

Archive depth {small/medium/current/high-water}, candidate count {0–150+over}, **growth behaviour** (route-duration-vs-depth curve → the O(F·A) climb → the file-adapter operating ceiling), throughput (records/run at ceiling; runs/hr at cadence; `cadence×ceiling` vs projected arrival), concurrent execution (capture+settlement), large archives (string-wall), high-volume/duplicate-heavy days, scheduler overlap. **The dominant frozen O(F·A) cost is measured, not changeable** — a representative-depth p95 breach is an anticipated legitimate DEFER→retention/Postgres (F-8), correctly out of 2E-B scope. Coverage is **thorough**; the one framing issue is F-6 (a dormant pipeline has no "current production depth" — depths are projected).

## 9. Concurrency Review

Single-instance (distinct locks, capture+settlement concurrent, no double-write), same-key contention (loser→null/409, ≤1 s try-window), lock wait/hold/release (finally + thrown-body), failure recovery (session-drop auto-release, committed persists), stale-lock (session-scoped, no reaper), multi-instance (two processes + shared disposable PG advisory → exactly one writer). The binding claim — **no two capture/settlement writers under the durable lock** — is correctly the acceptance. **Environment dependency (F-7):** the durable-lock/single-writer cells need a **disposable local Postgres**; the memory adapter cannot prove cross-process single-writer (per-process only). If no PG is available in the bench environment the single-writer proof DEFERs — this dependency (with the R-5 prod-URL guard mirroring `rehearse-migrations.mjs`) must be secured before B-5.

## 10. Failure-Path Review

Every 2E-A §17 mode is benchmarked for **classification correctness + bounded time + no-false-empty**: missing (ENOENT→empty, distinguished), corrupt (strict throw→`archive_read_failed`), stale (freshness→degraded/defer), lock-unavailable (null→skipped/409), deadline-exceeded (pre-batch/between-candidate defer, no overrun), writer-failure (`write_failed`→failed, idempotent re-fire), reader-failure (`source_load_failed`, never `[]`), metrics-failure (best-effort swallow), config-failure (fail-safe OFF/bounded). The **dry-run zero-write proof** (byte-identical pre/post archive manifest — file set + sizes + mtimes + per-file sha256 + `writes_committed==0`, held even under injected failure) is a strong, well-designed invariant. **Complete and correctly fail-closed.**

## 11. Readiness Evidence

The 13 gates (Environment/Secrets/Archive/Reader/Writer/Benchmark/Memory/Performance/Concurrency/Rollback/Deployment/Observability/Scheduler) each carry purpose·owner·evidence·acceptance·failure-action, and the GO/NO-GO/DEFER matrix resolves each criterion. Evidence sufficiency:
- **GO** decisions are supportable: route p95≤45 s + max<60 s at representative+high-water, dry-run byte-identical, single-writer proven, no leak.
- **NO-GO/DEFER** paths are explicit and correctly scoped (depth-at-wall→retention DEFER; capture-full→derivation DEFER; p95 45–55 s→retune reserves DEFER).
- **F-5 (deployment gate mismatch):** the Deployment gate acceptance *"kill_timeout > effective deadline"* is **unmet by current config** (`kill_timeout:10000` = 10 s < 45 s effective). It is **safe** (atomic single-`appendFile` writes + no cursor + idempotent re-fire ⇒ a mid-run SIGKILL loses no committed data and re-derives), but the gate as written fails today and requires a deployment change (raise `kill_timeout` above the effective deadline, or restate the acceptance). Correctly deferred to deployment provisioning (§20) — but the discrepancy should be explicit.

**Overall the evidence design is sufficient to make trustworthy Go/No-Go/Defer production decisions**, once F-1…F-3 are incorporated (so the numbers mean what they claim).

## 12. Findings (classified)

| # | Finding | Class | Basis |
|---|---|---|---|
| **F-1** | `metrics.snapshot()` timers = `{count,sum,avg,max}` only — **no percentiles/stddev/raw samples**; p50/p95/p99/CV must come from the harness's own `hrtime` sampling (which §4/§14 provide). §3's "metrics.snapshot() = primary evidence source" is imprecise for percentiles. | **Benchmark clarification** | `metrics.ts:88-109` |
| **F-2** | The "complete route from route entry" is a **phase-sum model**, not an end-to-end measurement — the entry-anchored composition (`runLiveXJob`, route-entry anchor) is built **after** 2E-B. State this; re-benchmark the real anchored route post-build (carry-forward). | **Benchmark clarification** | 2E-A design; no composition module exists |
| **F-3** | **Cold samples** use a fresh tsx process/sample → conflates FS-cold (relevant) with tsx+module-load+JIT startup (**not** paid by the warm long-lived prod process). Subtract an empty-cell/harness baseline to isolate FS-cold, else cold numbers over-count. | **Benchmark clarification** | §5/§7 cold method; harness = fresh tsx |
| **F-4** | Per-cell **p99 from ~40 samples** is statistically weak (≈ top sample); rely on the `max<60 s` hard gate for the tail or raise n on the critical route cell. Plan already hedges ("n≥100 or aggregated"). | **Performance clarification** | §5 sample sizes |
| **F-5** | Deployment gate *"kill_timeout > effective deadline"* is **unmet today** (10 s < 45 s). Safe (atomic append + idempotent re-fire) but needs a deployment change; make the discrepancy explicit. | **Future-stage item** (deployment) | `ecosystem.rankwagers.cjs:40` |
| **F-6** | "Current-representative depth from prod line counts" ≈ **0** for a never-activated (dormant) pipeline; meaningful depths are **projected** steady-state + high-water. Frame the depth axis as projected. | **Benchmark clarification** | flags off since M9; empty evidence archive |
| **F-7** | Single-writer/multi-instance proof requires a **disposable local Postgres** in the bench env (memory adapter can't prove cross-process); secure it (with the R-5 prod-URL guard) before B-5 or the Concurrency gate DEFERs. | **Implementation clarification** (harness env) | `locks.ts`; §9 |
| **F-8** | A representative-depth p95 breach from the frozen O(F·A) M6/M8 cost is an anticipated legitimate **DEFER→retention/Postgres**, correctly out of 2E-B. | **Future-stage item** | prior perf reviews; §21 R-4 |

**No BLOCKER.** Blocking rule test: the methodology **can** produce trustworthy performance evidence (grounding fully verified; repeatable/reproducible/statistical/fair/representative), and it contains **no known unbounded production path** and requires **no** frozen/schema/migration change. F-1…F-3 are fidelity clarifications, not defects that void the evidence; the plan already collects the raw samples that make percentiles valid (F-1) and already frames F-C as reserve-sizing (F-2).

## 13. Carry-forward

- **Into the 2E-B harness build (B-1…B-7):** incorporate F-1 (compute stats from harness raw samples; label metrics.snapshot() as counters/gauges/aggregate-timers only), F-2 (phase-sum modeling + explicit note + post-build re-benchmark), F-3 (baseline-subtract harness/tsx startup from cold samples), F-4 (max-as-tail-bound; raise n on the route cell), F-6 (projected-depth framing), F-7 (disposable-PG provisioning + prod-URL guard).
- **Into Stage 2E implementation:** re-benchmark the **actual** route-entry-anchored composition end-to-end once `runLiveXJob` + the entry anchor exist (closes F-2).
- **Into deployment:** raise `kill_timeout` above the effective deadline (or restate the gate) — F-5; scheduler cadence from p99 run-duration (2E-B) + observed arrival rate.
- **Future (correctly excluded):** capture M4→M5 derivation; Postgres evidence adapter benchmark; streaming-read hardening (F-3 event-loop DEFER remedy); retention/cutover (F-8).

## 14. Final Verdict

### CONDITIONALLY PASSED

The Stage-2E-B benchmark methodology is **capable of producing trustworthy production-performance evidence.** Its repository grounding is **accurate in every claim I independently verified** (runner post-discovery anchor, cron entry clock, provisional constants, strict readers, no-fsync writer, frozen builders, chain verifiers, lock prod-fail-closed, harness scripts, deployment topology, metrics shape). The measurement contract is coherent and complete across all eleven performance dimensions, memory, CPU, event-loop, scalability, concurrency, and failure paths; it correctly measures from route entry, quantifies the verified Stage-2D deadline-anchor gap, sets the string-wall as a hard depth gate, designs a strong byte-identical dry-run zero-write proof, and resolves a full readiness-gate + GO/NO-GO/DEFER matrix. It implements no benchmark, activates nothing, and needs no frozen/schema/migration change.

It is **CONDITIONALLY** passed — not unconditionally — because three clarifications materially affect whether the recorded numbers mean what the plan claims and must be incorporated before/within harness execution: **F-1** (percentiles come from harness sampling, not the metrics API, whose timers hold no percentiles), **F-2** (the "complete route" figure is a phase-sum model, not an end-to-end measurement, until the entry-anchored composition is built), and **F-3** (cold samples must isolate FS-cold from tsx/module-load startup to avoid over-counting a cost production never pays). Four further items (F-4 p99 sampling, F-5 kill_timeout gate, F-6 dormant-depth framing, F-7 disposable-PG dependency) are lower-severity clarifications/future-stage items. **Blocker count: 0.** None of the plan's stop conditions (§22) is triggered; the design remains fail-closed and additive.

**Explicit confirmations:**
- **NO runtime code modified.** ✅
- **NO benchmark executed.** ✅ (no benchmark implemented; this review only read code + docs)
- **NO tests modified.** ✅
- **NO deployment modified.** ✅
- **NO schema modified.** ✅
- **NO migration modified.** ✅
- **NO production activation performed.** ✅

The only file created is `docs/plans/m10-stage-2e-b-performance-review.md`.
