# M10 Stage 2E-B — Benchmark & Production-Readiness Gates — Independent Test-Strategy & Verification Review

**Review type:** Read-only test-strategy & verification review of a **planning** document. **No runtime, route, cron, job, flag, test, schema, database, migration, deployment, or benchmark code was created, modified, or executed.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Test-Strategy & Verification Reviewer, Sprint 23B / M10 Stage 2E-B.
**Under review:** `docs/plans/m10-stage-2e-b-benchmark-readiness-plan.md` — solely its verification/benchmark methodology and readiness gates (not runtime implementation, not a 2E-A redesign).
**Read:** the M10 spec (Rev A1); `m10-stage-2d-closure.md`; `m10-stage-2e-a-activation-design-plan.md`; `m10-stage-2e-a-closure.md`; the 2E-B benchmark plan.
**Method:** every repository grounding claim in the plan's §3 was independently re-verified against source (not trusted). No benchmark was designed, built, or run.

---

## 1. Executive Summary

The Stage-2E-B plan defines a **repository-grounded, synthetic-only, statistically-specified, reproducible** benchmark methodology and 13 objective readiness gates whose sole purpose is to produce the evidence that must exist **before** any production write is authorized. It measures the whole route from **route entry** (the correct anchor), quantifies the verified Stage-2D deadline-anchor gap, validates the provisional operational constants with measured p95/p99, and hard-gates FULL_WRITE on specific measured thresholds. It activates nothing and redesigns nothing.

**Every load-bearing repository claim I checked is accurate** (§2). The methodology **can be independently verified, reproduced, audited, repeated, and compared over time**: each cell is a single pinned-seed command emitting a JSON+CSV artifact, fixtures are synthetic (frozen builders, temp dirs, no prod data/secret), machine/runtime spec and per-op hardware-independent counts are recorded, and an append-only benchmark history enables cross-time audit. The dry-run zero-write proof (pre/post sha256 archive manifest, repeated under injected failure) is objective and rigorous; canary determinism/fairness/rollback and full-write growth/ceiling evidence are well-specified; every gate resolves to GO/NO-GO/DEFER with an owner and a failure action, and no gate can silently pass without evidence (a missing external input forces DEFER, never a false GO).

**Verdict: CONDITIONALLY APPROVED.** The plan can be objectively verified before production use, so it is **not blocked**. The conditions are clarifications — none requires implementation, execution, or deployment to have occurred: the percentile evidence source, per-cell p99 sample strength, the external-input DEFER discipline, one **verified deployment gap** (`kill_timeout` 10 s < 45 s effective deadline), and a few minor failure/regression clarifications.

---

## 2. Repository Validation (independently verified — I did not trust the plan)

| Plan claim | Verified? | Evidence |
|---|---|---|
| **Deadline anchored post-discovery (F-C gap)** | **TRUE** | `producerDeadlineBudget` calls `createDeadline({ startedAtMs: now(), … })` and is invoked **after** `await options.provideCandidateBatch()` (`runner.ts` ~381 → ~401); source-load+discovery escape the ≤45 s budget. The plan's central measurement rationale is correct. |
| **Provisional constants** | **TRUE** | `config.ts:120-122` `DEFAULT_JOB_RESERVED_HEADROOM_MS=15_000`, capture reserve `250`, settlement reserve `120` (both commented "provisional"); `operational.ts:29` `EFFECTIVE_DEADLINE_HARD_MAX_MS=45_000`; `limits.ts:11-12` `CANDIDATE_LIMIT_MAX=150`/`DEFAULT=100`. |
| **Route budget = handler entry; `maxDuration=60`** | **TRUE** | both routes `maxDuration = 60`; `cronHandler.ts` `started = Date.now()`. |
| **Source fail-open** | **TRUE** | `dailyArchive.ts:71-77` `readDailyArchive` → `catch { return null }`. Strict-reader requirement is genuine. |
| **Strict whole-archive readers exist** | **TRUE** | `readAllSnapshotsStrict` (`file.ts:147`), `readAllValidationsStrict` (`file.ts:165`), `readAllOddsRecordsStrict` (`odds-archive/file.ts:74`). |
| **`metrics.snapshot()` → {counters, gauges, timers}; `publicMetricsView()`** | **TRUE (with caveat)** | `metrics.ts:88-120` returns `{counters, gauges, timers{count,sum,avg,max}}` + `publicMetricsView`. **Caveat (F-1):** timers retain only count/sum/avg/**max** — **no per-sample retention, no percentiles.** p50/p95/p99 cannot come from `metrics.snapshot()`; they must come from the harness's own raw `hrtime.bigint()` samples (§14 CSV). |
| **Lock: PG advisory, prod fail-closed** | **TRUE** | `locks.ts:tryAcquireJobLock` durable + `requireDurable && NODE_ENV==="production"` → `null` (no memory degrade). |
| **Deployment `instances:1`, fork, `kill_timeout:10000`, no SIGTERM drain** | **TRUE (with finding)** | `ecosystem.rankwagers.cjs:35-40`; no SIGTERM/drain in `instrumentation.ts`. **Finding (F-2):** `kill_timeout:10000` (10 s) is **below** the 45 s effective deadline — the plan's own Deployment gate acceptance ("kill_timeout > effective deadline") currently **fails**. |
| **Harness convention `scripts/*.{mjs,ts}` via tsx; no existing bench** | **TRUE** | `scripts/` has `launch-readiness.mjs`/`validate-release.ts`/`rehearse-migrations.mjs`/`mock-server-only.cjs`; **no** `bench`/`perf` script or npm target exists (harness is genuinely new, unbuilt — correct). |
| **String-wall depth (~357k snapshots / ~524k validations, MAX_STRING_LENGTH ~512 MB)** | **PLAUSIBLE, self-grounding** | `MAX_STRING_LENGTH` is a real V8/64-bit limit; the specific counts are cited from prior perf reviews and are **empirically re-grounded by the benchmark's own depth/bytes-per-record measurement** — the plan treats them as estimates to replace, which is correct. |

**Conclusion:** the plan's repository grounding is faithful. No false or unverifiable assumption underpins the methodology; the two caveats (F-1 percentiles, F-2 kill_timeout) are surfaced below, not defects in the grounding.

---

## 3. Verification Strategy Review — can the evidence be trusted independently?

| Property | Assessment |
|---|---|
| **Verified** | Methodology rests on verified repo facts (§2); runs the *actual* built code paths + frozen builders, not a re-implementation. **Strong.** |
| **Reproduced** | Each cell = one command, pinned index-derived seed (no `Math.random`), fixed env profile, JSON artifact; `run-all.ts` reproduces the matrix; command+seed+machine-spec in every artifact. **Strong.** |
| **Audited** | Per-cell JSON + raw-timing CSV (all samples) + `metrics.snapshot()` + a signed acceptance summary; no entity ids / no prod data / no secrets. **Strong.** |
| **Repeated / compared over time** | Append-only benchmark history (date, git SHA, machine, headline p95) for cross-time audit. **Good.** |
| **Trusted independently** | Synthetic temp fixtures only; harness guard against prod-looking DB URLs (R-5, mirrors `rehearse-migrations.mjs`); disposable local PG for lock cells; temp dirs deleted. **Strong.** |
| **Hardware independence** | Records machine spec + reports hardware-**independent** per-op counts (reads, bytes parsed, scans) and ratios alongside wall-time; acceptance uses fraction-of-60 s budgets. **Good** — mitigates the wall-time hardware dependence (R-3). |

The verification strategy is sound and materially better than a naive "time it once" plan. The one clarification is F-1: §3 lists `metrics.snapshot()` as the "primary in-process evidence source," which is misleading for percentiles — percentiles derive from harness raw samples; the plan should state this explicitly so an auditor does not expect p95/p99 from the metrics timers.

---

## 4. Benchmark Verification Review — statistical methodology

| Aspect | Plan (§5) | Assessment |
|---|---|---|
| Cold runs | fresh process per sample, ≥10 per critical cell | **Good** — captures FS-cold/no-JIT worst case |
| Warm runs | ≥30 post-warmup (W=3 discarded) | **Good** |
| Sample count | ≥30 warm + ≥10 cold critical; ≥10 warm non-critical | **Adequate** |
| Variance / stability | stddev + CV; **unstable if CV > 0.25** on total duration | **Strong** — explicit re-run trigger |
| Statistics | p50/p95/p99/max/mean/stddev/CV/n | **Good** |
| Confidence | "validated" only if p95 ≤ budget at representative **and** high-water with CV ≤ 0.25 over ≥30 warm+≥10 cold; else DEFER+retune | **Strong** |
| Acceptable deviation | p95 ≤ budget; p99 ≤ budget×1.1; **max never > 60 s** | **Strong** — hard tail cap |

**Findings:** (F-3, benchmark clarification) a per-cell **p99 from ~30 samples is weakly estimated** (p99 of 30 ≈ the max); the plan acknowledges this ("p99 where n≥100 or aggregated across cells"), but should make the **critical route cell (category 9) collect ≥100 samples** so its p99 is robust rather than aggregated. (F-1) the percentile source must be the raw CSV, not `metrics.timing` (avg/max-only). Otherwise the statistical design is rigorous and independently reproducible.

---

## 5. Readiness Gate Verification — does every gate have objective proof?

All 13 gates (§15) carry purpose · owner · evidence · acceptance · failure action, and each resolves to an **objective** GO/NO-GO/DEFER:

| Gate | Objective proof? | Note |
|---|---|---|
| Environment / Secrets | Yes (manifest / presence-check) | — |
| Archive (depth) | Yes, **contingent** on Ops-provided prod line counts | R-1: absent → conservative estimate + **DEFER** (never false GO). Objective-or-DEFER. |
| Reader | Yes (strict-reader parity bench) | reader unbuilt → F-D carry-forward; bench validates once built |
| Writer / Benchmark / Memory | Yes | — |
| Performance (route p95 ≤ 45 s) | Yes, **contingent** on representative depth | Same external-input dependency as Archive — see F-4 |
| Concurrency (single-writer) | Yes (disposable-PG multi-process cell) | strongest possible in-harness proof |
| Rollback | Yes (flags-off drill + manifest) | — |
| **Deployment** | Yes | acceptance "kill_timeout > effective deadline" — **currently fails** (F-2): 10 s < 45 s |
| Observability / Scheduler | Yes; Scheduler contingent on projected-arrival input | objective-or-DEFER |

**No gate can silently pass without evidence.** The two contingencies (representative depth, projected arrival) are external Ops inputs not in the repo; the plan correctly DEFERs when they are absent. **Finding F-4 (verification clarification):** make the Performance gate explicit that "no representative-depth input ⇒ mandatory DEFER, never a GO on an estimate alone" (as R-1 already states for the Archive gate) — so the highest-stakes gate cannot be argued to a GO without the real number. **Finding F-2 (future-stage/deployment):** the Deployment gate correctly catches the current `kill_timeout` (10 s) < effective deadline (45 s); this must be remediated (raise `kill_timeout` above the effective deadline and/or add a SIGTERM drain) as a deployment change before activation — the plan routes it to carry-forward (F-F) but should surface that the **current config fails this gate today.**

---

## 6. Failure Coverage Review

§13 benchmarks the pipeline failure modes for **classification correctness + bounded time + no-false-empty**: missing partition (ENOENT→empty, distinguished), corrupt archive (throw→failed), stale (freshness→degraded/defer), lock unavailable (skip/409), deadline exceeded (defer, bounded), writer failure (write_failed→failed, idempotent), reader failure (fail-closed, never `[]`), config failure (fail-safe OFF/bounded). **This is the safety-critical set and it is strong** (acceptance: none converts a source failure into an empty success except a genuinely-missing partition).

**Findings (test clarifications, non-blocking):**
- **F-5** the §13 table omits three meta-failures the review asks about: **metrics failure** (2E-A §17 has it as best-effort-swallowed; 2D tested it; add a bench cell asserting a broken sink never fails/skews the run), **scheduler interruption** as a distinct cell (currently folded into concurrency lock-loser), and **benchmark-run interruption** (harness robustness — a partially-run matrix must mark incomplete cells so a partial run is never mistaken for a pass). None is safety-critical, but each is named in the review scope.

---

## 7. Dry-Run Verification

§10 is the strongest section: a **pre/post archive manifest** (file set + sizes + mtimes + **per-file sha256**) asserted **byte-identical**, plus `writes_committed == 0`, **repeated under every injected failure** (missing/corrupt/stale source, archive-read throw, deadline exceeded, invalid config). This objectively proves **zero writes / zero append / zero persistence / zero archive mutation / zero evidence mutation, even under failure** — exactly the review's demand. Acceptance is binary (100% byte-identical or NO-GO). **No gap.** (Minor: "zero persistence" is correctly scoped to the durable archive; ephemeral jobLog/metrics are non-authoritative and out of scope for the manifest — appropriate.)

---

## 8. Canary Verification

§11 covers all six requested properties objectively: **selection stability** (same seed → identical set), **ordering stability** (shuffled input → identical selection, order-independent producer), **repeatability** (≥3 consecutive runs; writes == preceding dry-run counts; chain-verify clean), **bounded execution** (< effective deadline), **fairness** (backlog drains deterministically over fires; `oldest_pending_age` bounded under INV-S), **rollback** (flags-off → zero next-fire writes; canary records remain immutable). League-allowlist subset also covered. **No gap.**

---

## 9. Full-Write Verification

§12 + §16 hard-gate FULL_WRITE on measured evidence: append cost per record at depth, archive-depth growth (days-to-string-wall projection), the **depth-vs-deadline growth curve locating the file-adapter operating ceiling**, throughput vs INV-S capacity, and rollback idempotency — with the binding rule that FULL_WRITE is authorized **only** when p95 route ≤ 45 s **and** max < 60 s at current-representative depth, the operating ceiling sits **above** projected accumulation for the retention horizon, and reserves/headroom are validated to the measured p99 per-candidate cost. **This is a sufficient, objective gate definition.** The evidence itself is (correctly) unproduced; capture FULL_WRITE additionally and correctly DEFERs to the unbuilt M4→M5 derivation. The methodology is sufficient to *eventually* authorize FULL_WRITE; nothing here would let FULL_WRITE be authorized on weak evidence.

---

## 10. Findings (classified)

| ID | Finding | Class |
|---|---|---|
| **F-1** | `metrics.snapshot().timers` retain count/sum/avg/**max only — no percentiles** (verified). §3 calls metrics the "primary evidence source"; p50/p95/p99 must come from the harness raw-sample CSV. State this explicitly. | **Verification clarification** |
| **F-2** | `kill_timeout:10000` (10 s) < 45 s effective deadline (verified). The Deployment gate acceptance ("kill_timeout > effective deadline") **fails on the current config**; remediation (raise kill_timeout above the effective deadline and/or add a SIGTERM drain) is a deployment change required before activation. | **Future-stage item (deployment)** |
| **F-3** | Per-cell p99 from ~30 samples is weak; make the **critical route cell (cat. 9) ≥100 samples** for a robust (non-aggregated) p99. | **Benchmark clarification** |
| **F-4** | The **Performance gate**'s objectivity depends on the Ops-provided representative depth; state "no representative depth ⇒ mandatory DEFER, never a GO on estimate" (extend R-1's Archive-gate rule to Performance). | **Verification clarification** |
| **F-5** | Add distinct failure-bench cells for **metrics failure**, **scheduler interruption**, and **benchmark-run interruption** (partial-matrix must mark incomplete cells, never read as pass). | **Test clarification** |
| **F-6** | State explicitly that the `scripts/bench/m10/` harness changes **no runtime and no `tests/`**, so the **1824/1824 regression floor is preserved by construction** (regression is not re-run by the benchmark and does not need to be). | **Test clarification** |
| **F-7** | String-wall record counts (~357k/~524k) are prior-review estimates; ensure artifacts record the **measured bytes-per-record** so the depth ceiling is empirically grounded, not inherited. | **Benchmark clarification** |

**Blocker count: 0.** No finding prevents the benchmark plan from being objectively verified before production use.

---

## 11. Carry-forward

- **To Stage 2E-B execution:** fold in F-1/F-3/F-4/F-5/F-6/F-7 when authoring the harness + acceptance summary (all clarifications; none changes the plan's structure).
- **To Stage 2E implementation:** the frozen 2E-A Bucket-2 items the benchmark *measures and gates but does not build* — `readDailyArchiveStrict` (F-D), route-entry deadline anchor + structural dry-run no-write (F-C), freshness/stale detection (F-B), `NODE_ENV`/durable-lock assertion (F-E), dry-run-zero-write/kill-switch/multi-instance tests, correction-firewall guards.
- **To deployment (F-2/F-F):** raise `kill_timeout` above the 45 s effective deadline (and/or SIGTERM drain), provision `EVIDENCE_DATABASE_URL`/secrets/`instances:1`-or-durable-lock, scheduler cadence.
- **To future stages:** capture M4→M5 derivation (blocks capture FULL_WRITE); Postgres evidence adapter; durable job-run store only-if-canary-insufficient; correction stage. **None pulled into 2E-B.**

---

## 12. Final Verdict

### CONDITIONALLY APPROVED

The Stage-2E-B benchmark & readiness methodology **can be independently verified, reproduced, audited, repeated, and compared over time, and can be trusted before production use.** Every load-bearing repository claim was re-verified and is accurate; the measurement contract (route-entry anchor, cold/warm/warmup, CV instability trigger, p95/p99/max caps, confidence definition) is statistically rigorous; the dry-run zero-write proof (sha256 manifest under injected failure) and the FULL_WRITE hard-gate are objective and sufficient; and every readiness gate resolves to GO/NO-GO/DEFER with an owner and a failure action, with external-input absence forcing DEFER rather than a false GO. Under the stated blocking rule — block only if the plan cannot be objectively verified before production use — **it is not blocked.**

Approval is conditional on the seven clarifications (F-1…F-7), of which two are worth elevating: **F-1** (percentiles come from harness raw samples, not the avg/max-only metrics timers) and **F-2** (the current `kill_timeout` 10 s < 45 s effective deadline fails the plan's own Deployment gate and must be remediated before activation). None requires implementation, benchmark execution, or deployment to have occurred; all are documentation/rigor refinements to be folded into the harness and acceptance summary during the (separately authorized) Stage-2E-B execution.

---

## 13. Explicit Confirmations

- **NO runtime code modified** ✅
- **NO benchmark executed** (none designed, built, or run) ✅
- **NO tests modified** ✅
- **NO routes modified** ✅
- **NO cron / jobs / feature flags modified** ✅
- **NO deployment modified** ✅
- **NO schemas modified** ✅
- **NO migrations modified** ✅
- **NO production activation performed** ✅
- **Only file created:** `docs/plans/m10-stage-2e-b-test-strategy-review.md`. All cited behaviours were verified against the current repository by read-only inspection.
