# M10 Stage 2E-B — Benchmark & Production-Readiness Gates (Planning Only)

**Document type:** Benchmark methodology & production-readiness plan (Stage 2E-B of M10). **PLANNING-ONLY — no runtime code, test, route, cron, flag, schema, database, migration, deployment, or production config was created or modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E-B — Benchmark & Production Readiness**.
**Date:** 2026-07-30
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1 — §7.2 INV-C, §7.3 INV-D, §9 performance, §10 observability, §12 Gate B5); the Stage-2E-A design (frozen) + its five reconciled reviews (all 0 blockers); `m10-stage-2d-closure.md`.
**Authorization consumed:** Stage-2E-B **planning** is authorized. This document **produces evidence design only** — it activates nothing, changes no runtime behaviour, and redesigns nothing in Stage 2E-A.

---

## 1. Executive Summary

Stage 2E-A froze a fail-closed, reversible activation design. Stage 2E-B is the **evidence phase** that must complete before any production write is authorized: it defines a **repeatable, repository-grounded, statistically-meaningful, reproducible** benchmark methodology and a set of binding production-readiness gates. It measures the whole route from **route entry** (not producer start) so the verified Stage-2D deadline-anchor gap (`producerDeadlineBudget` anchors `startedAtMs: now()` **after** `await provideCandidateBatch()` — `runner.ts:306,381`, so source-load + discovery currently escape the ≤45 s budget) is quantified and the required entry-anchor is sized. It validates the Stage-2D **provisional** constants (`DEFAULT_JOB_RESERVED_HEADROOM_MS=15000`, capture reserve `250 ms`, settlement reserve `120 ms`, ceiling `100`/hard `150`, effective-deadline hard-max `45000`) with measured p95/p99, and establishes the file-adapter depth ceiling below the `fs.readFile` string wall (~357 k snapshots / ~524 k validations per prior perf reviews) as a **hard** gate.

Stage 2E-B **produces evidence; it does not activate.** Its successful completion authorizes **Stage 2E implementation** (building the frozen 2E-A composition, default-OFF) and supplies the evidence that the activation gates consume — it is **not** alone sufficient to authorize production activation, which additionally requires the built composition to be reviewed, deployment provisioning, and phased human go/no-go (§17).

## 2. Objectives

1. Define exactly **what/where/how** each phase and resource is measured (measurement contract, §5).
2. Design 18 benchmark categories (§6–§11) over an **archive-depth × source × candidate-volume × mode** matrix.
3. Prove the route budget holds **from route entry** including source-load + discovery (§Route budget, F-C).
4. Validate or retune the Stage-2D provisional constants with measured evidence.
5. Establish the file-adapter depth **hard gate** below the string wall.
6. Prove dry-run **zero writes** even under injected failure.
7. Define deterministic canary evidence (first-N ordering stability, fairness, rollback).
8. Define the append-cost / growth / throughput / rollback evidence required before FULL_WRITE.
9. Produce durable, audit-suitable benchmark artifacts (§14).
10. Define production-readiness gates + a GO/NO-GO/DEFER matrix (§Gates, §Go-No-Go).
11. Slice the Stage-2E-B execution work (§Implementation Slices).

## 3. Repository Validation (grounding — verified this pass)

| Fact | Anchor | Benchmark implication |
|---|---|---|
| Deadline anchored **post-discovery** | `runner.ts:297,306,381,401` | Must measure source-load + discovery separately (they escape the current budget) → sizes the F-C entry-anchor. |
| Provisional constants | `config.ts:120-122` (headroom 15000, reserves 250/120); `operational.ts:29` (hard-max 45000); `limits.ts:11-12` (100/150) | These are the tunables 2E-B validates/retunes. |
| Route budget | both routes `maxDuration = 60`; `cronHandler.ts` `started = Date.now()` | Route clock = handler entry; total ≤ 60 s with ≥15 s reserve → effective ≤45 s. |
| Source | `dailyArchive.ts:readDailyArchive` → `data/daily-archives/<date>.json`, `ArchivedRow[]`; **fail-open** | Benchmark the strict-reader variant (F-D) + parse cost; ENOENT vs malformed distinction. |
| Evidence store | NDJSON strict whole-archive reads (`readAllSnapshotsStrict`/`readAllValidationsStrict`/`readAllOddsRecordsStrict`); `fs.readFile(utf8)` string wall | Depth matrix + string-wall hard gate. |
| Frozen M6/M8 cost | `captureEvidenceSnapshot` 3+M scans/fixture; `settleLatestSnapshotForFixture` 2+2T scans/fixture (prior perf reviews) | The O(F·A) dominant term — measured, not changed. |
| Lock | `locks.ts:tryAcquireJobLock` PG advisory bound to `EVIDENCE_DATABASE_URL`, prod fail-closed | Lock-acquire/wait/release + contention benchmarks. |
| Metrics evidence | `metrics.snapshot()` → `{counters, gauges, timers}`; `publicMetricsView()` | Primary in-process evidence source; supplemented by `process.memoryUsage()`, `perf_hooks`. |
| Harness convention | `scripts/*.{mjs,ts}` via `tsx` (e.g. `launch-readiness.mjs`, `validate-release.ts`); `mock-server-only.cjs` hook | Benchmark harness = `scripts/bench/m10/*.ts` (tsx), **not** tests, **not** runtime. |
| Deployment | `deploy/ecosystem.rankwagers.cjs` `instances:1`, fork, `kill_timeout:10000`; no SIGTERM drain | Single-instance today; concurrency benchmark models both `instances:1` and a durable-lock scale-out. |

**All 2E-A grounding claims re-verified; no discrepancy.** No production data, secret, or archive is read by any benchmark — all fixtures are synthetic + temp (§4).

## 4. Benchmark Methodology

**Harness (design; built in Slice 1, not here).** `scripts/bench/m10/`: deterministic tsx scripts run via `tsx`/`node --require ./scripts/mock-server-only.cjs`. Each benchmark:
- constructs **synthetic** temp fixtures (an isolated `mkdtemp` evidence dir + a temp `data/daily-archives/<date>.json`), never touches the production archive or any secret;
- pins the env to a bench profile (`EVIDENCE_ARCHIVE_DIR=<tmp>`, `JOB_LOCK_ADAPTER=memory` for non-lock cells / a disposable local PG for lock cells, all flags OFF unless the cell exercises a mode);
- runs the **actual** built code paths (producer, `buildX ArchiveState`, `runX Batch`, the strict readers) with an **injected fake clock** for deadline determinism and **wall-clock timing** (`process.hrtime.bigint()`) for the durations;
- deletes all temp fixtures on completion (no repo fixture added).

**Fixtures (deterministic, seeded).** Archive generators emit valid NDJSON at target depths using the frozen builders (`createEvidenceSnapshot`, `createValidationRecord`, `buildOddsRecord`) so hashes/identity are real; source generators emit `FootyMatchRow[]` (terminal / non-terminal / malformed / duplicate-across-tab) into the daily-archive JSON shape. Seeds are fixed (index-derived, no `Math.random`).

**Repeatability & hardware-independence.** Each cell records the machine/runtime spec (CPU model, cores, Node version, OS, filesystem) so results are comparable; where absolute wall-time is hardware-dependent, the plan also reports **per-op counts** (archive reads, bytes parsed, files opened, scans) which are hardware-independent, and **ratios** (e.g. discovery vs batch). Acceptance uses **hardware-relative** budgets (fraction of the 60 s route) plus hardware-independent invariants (single bounded read; no per-fixture rescan).

**Reproducibility.** Every cell is a single command with pinned seed + env, emitting a JSON artifact; a top-level `scripts/bench/m10/run-all.ts` reproduces the full matrix. Commands + seeds + machine spec are recorded in every artifact.

## 5. Measurement Contract

| Aspect | Definition (binding) |
|---|---|
| **What** | Per-phase wall duration, per-op counts, RSS/heap, event-loop delay, GC influence, lock timing, writes attempted/committed, deferrals, per-record append cost. |
| **Start** | **Route entry** — the instant `handleCronPost` begins (`started = Date.now()`), not producer start. Phase timers wrap each phase (source-load, archive-read, discovery, provider, candidate-loop, append, cleanup, lock-hold). |
| **End** | Response serialization complete + lock released (`runWithLock` `finally`). Total = end − route-entry. |
| **Warmup** | The first **W = 3** runs of a cell are discarded (JIT/FS-cache warmup). |
| **Cold runs** | A fresh process per cold sample (spawn `tsx` anew) — captures FS-cold + no-JIT worst case. **≥10 cold samples** per critical cell. |
| **Warm runs** | Same process, post-warmup — steady-state. **≥30 warm samples** per cell. |
| **Sample count** | ≥30 warm + ≥10 cold per critical cell; ≥10 warm for non-critical. |
| **Variance** | Report stddev + coefficient of variation (CV = stddev/mean). A cell is **unstable** (re-run/investigate) if CV > 0.25 on the total-duration metric. |
| **Statistics** | median (p50), p95, p99 (where n≥100 or aggregated across cells), maximum, mean, stddev, CV, n. |
| **Acceptable deviation** | p95 total ≤ the cell's budget; p99 ≤ budget × 1.1; **max never exceeds the 60 s route**. |
| **Confidence** | A budget is "validated" only when p95 ≤ budget at the **current-representative** and **high-water** depths with CV ≤ 0.25 over ≥30 warm + ≥10 cold samples; otherwise DEFER + retune. |

## 6. Performance Plan (the 18 categories)

Matrix axes: **archive depth** {small ~1k lines, medium ~10k, current-representative (from prod line counts, provided by Ops as a number — not by reading prod), high-water ~near the string wall} × **source** {normal, high-volume, malformed-heavy, duplicate-heavy} × **candidate volume** {0,1,10,50,100,150,>ceiling} × **mode** {dry-run, capture-canary, capture-full(dry-only), settlement-canary, settlement-full} × **concurrency** {isolated, capture+settlement concurrent}.

| # | Category | Instrument | Budget (fraction of 60 s; final numbers from evidence) | Notes |
|---|---|---|---|---|
| 1 | Source loading | phase timer around `loadCompletedRows`/`loadPublishedDailyPredictions` | ≤ ~8 s | file read + JSON.parse; strict-reader variant |
| 2 | Archive loading | timer around `buildX ArchiveState` (one bounded read/store, PB-1) | ≤ ~8 s | snapshots ∥ (validations\|odds); string-wall boundary |
| 3 | Discovery | timer around producer classify/order/cap | ≤ ~5 s | O(D log D); pure |
| 4 | Candidate filtering | `filterCompletedRows` cost at D∈{normal…dup-heavy} | ≤ ~1 ms/200 rows (prior measured ~0.46 ms) | per-row isolation cost |
| 5 | Settlement processing | `runSettlementBatch` per-candidate (2+2T scans) | ≤ ~30 s at ceiling | dominant O(F·A) |
| 6 | Capture processing (**dry-run only**) | producer discovery cost (no derivation) | ≤ ~5 s | writes deferred to derivation stage |
| 7 | Writer overhead | append cost per snapshot/odds/validation record | measured µs–ms/record | fsync absent (documented) |
| 8 | Lock acquisition | `tryAcquireJobLock` acquire + wait + release | ≤ ~1 s try-window | PG advisory vs memory |
| 9 | Route duration | total from route entry | **p95 ≤ 45 s, max < 60 s** | the primary gate |
| 10 | Complete job duration | lock-acquire → lock-release | ≈ route − auth/rate-limit | INV-L bound |
| 11 | Memory usage | §7 | RSS peak < instance limit | string-wall guard |
| 12 | CPU usage | §8 | bounded; hotspots identified | single fork |
| 13 | Event-loop delay | `perf_hooks.monitorEventLoopDelay` | p99 delay bounded | sync parse blocks |
| 14 | Concurrency behaviour | capture+settlement concurrent; contention | combined RSS/CPU bounded; no double-write | distinct locks |
| 15 | Canary execution | bounded ceiling run + selection stability | deterministic, < deadline | §H |
| 16 | Dry-run execution | discovery + zero-write proof | < deadline; **0 writes** | §Dry-run |
| 17 | Full-write execution | append cost + growth + throughput + rollback | evidence bundle | §Full-write |
| 18 | Failure-path execution | each §Failure-injection mode | fail-closed classification; bounded time | §Failure |

**Route-budget proof (F-C, binding).** For each depth/volume cell, report the phase split from **route entry**: `t_source + t_archive + t_discovery + t_provider + t_loop + t_cleanup + t_serialize + t_lock_release`. The plan proves the guarantee `t_source + t_discovery + t_loop + t_cleanup ≤ route_budget − reserve` and that **source+discovery are charged** — i.e. it quantifies exactly how much budget the pre-anchor phases consume, which the Stage-2E entry-anchor must reserve. If source+discovery p95 exceeds the reserve, the entry-anchor + pre-batch defer-all is **mandatory** before any write mode (already the 2E-A design).

## 7. Memory Plan

Instrument with `process.memoryUsage()` sampled at phase boundaries + peak-tracking between samples, and `--expose-gc` optional cells:
- **RSS / heapUsed / heapTotal** at: baseline, after-source-load, after-archive-read (peak — concurrent snapshot+odds/validation materialization), after-discovery, after-batch, after-cleanup.
- **Heap growth** across N consecutive warm runs in one process → detect leaks (growth must plateau to steady-state; a monotone climb over ≥30 runs = leak → NO-GO).
- **GC influence:** optional `--expose-gc` + `perf_hooks` GC entries; report GC pause contribution to event-loop delay.
- **Peak allocation:** the transient whole-file string (≈ file size) + split array + parsed array (~4–5× file) — the dominant peak; report per depth and confirm the **string-wall hard gate** (a read that would exceed `MAX_STRING_LENGTH` ~512 MB must be **prevented by the depth ceiling**, fail-closed, not attempted).
- **Steady-state:** RSS after warmup must be bounded and not grow across the matrix.

**Acceptance:** peak RSS at current-representative depth < the PM2 instance memory budget (Ops-provided); no leak (growth plateaus); string-wall depth ceiling documented and enforced by the depth gate.

## 8. CPU Plan

- **CPU % / wall clock:** per-phase CPU time (`process.cpuUsage()` deltas) vs wall time → CPU-bound vs IO-bound classification per phase.
- **Hotspots:** `--prof` (V8) or `--cpu-prof` on the heaviest cells (batch at high depth) → top self-time functions (expected: NDJSON `JSON.parse`, odds `verifyOddsRecord` hash, `evidenceContentHash`); report but **do not optimize** (frozen paths).
- **Event-loop lag:** `monitorEventLoopDelay()` histogram (p50/p99/max) — the synchronous whole-file parse is the risk; report the max stall per cell (prior estimate ~4–6 s/100k). A stall that risks user-request starvation on the single fork is a DEFER (→ streaming-read hardening, a later item).
- **Idle time / scheduler pressure:** measure the between-fire idle and the effect of the scheduler interval (arrival-rate input) on backlog/oldest-age (INV-S capacity relation `cadence × ceiling ≥ arrival`).

## 9. Concurrency Plan (Lock Analysis)

| Cell | Setup | Measure | Acceptance |
|---|---|---|---|
| Single instance | one process, distinct locks | capture+settlement concurrent combined RSS/CPU/event-loop | no double-write; combined resource < instance budget |
| Contention (same key) | two acquirers of `job:evidence_capture` | loser → `null`; wait time | loser 409/skipped ≤1 s try-window; winner unaffected |
| Lock wait | pre-acquire, then acquire | wait until timeout | bounded try-window; never blocks indefinitely |
| Lock release | normal + thrown-body path | release in `finally` | always released; reacquirable |
| Failure recovery | kill session mid-hold (disposable PG) | auto-release on drop | reacquirable; committed appends persist |
| Stale lock recovery | process death | session-scoped advisory auto-releases | no stale lock survives; no reaper needed |
| Multi-instance | two processes + shared disposable PG advisory lock | cross-process single-writer | exactly one writer; the other 409 |

**Binding:** the concurrency benchmark must prove **no two capture writers / no two settlement writers** under the durable lock, and that `instances:1` OR the provisioned durable lock is the single-writer guarantee (Gate D). Memory-adapter cells are for non-lock timing only (never a single-writer claim).

## 10. Dry-Run Evidence (zero writes, even under failure)

For every dry-run cell (incl. failure-injected):
- capture a **pre-run manifest** of the temp evidence archive: file list + sizes + mtimes + per-file sha256.
- run dry-run (producer runs; write batch **not** invoked, per 2E-A §13).
- capture a **post-run manifest**.
- **Assert:** file set, sizes, mtimes, and sha256 are **byte-identical** ⇒ zero writes, zero append, zero persistence, zero mutation. Additionally assert `writes_committed == 0` in the metrics snapshot.
- Repeat with injected failures (missing/corrupt/stale source, archive read throw, deadline exceeded, config invalid): the manifest must **still** be byte-identical (a failure in dry-run never writes).

**Acceptance:** 100% of dry-run cells (nominal + all failure injections) show a byte-identical archive manifest and `writes_committed == 0`. Any write in dry-run = NO-GO (design defect escalation).

## 11. Canary Evidence

- **Selection determinism:** run the same seeded source+archive twice → identical selected candidate set (byte-equal ordering) — proves first-N under the total order (`capturedAt`/`completionInstant` asc, tie `fixtureId`) is stable.
- **Ordering stability:** shuffle the source input order → identical selection (order-independent producer).
- **Fairness / drain:** with eligible > canary ceiling, over consecutive fires the backlog **drains** deterministically (deferred → next fire) — no permanent starvation; `oldest_pending_age` bounded under the INV-S relation.
- **League subset:** with `EVIDENCE_CANARY_LEAGUE_ALLOWLIST` set → only allowlisted `leagueCode` selected; empty ⇒ first-N.
- **Repeatability:** ≥3 consecutive canary runs with expected writes == preceding dry-run candidate counts; chain-verify (`verifyEvidenceChain`/`verifyValidationChain`) clean over canary-written records; no duplicate/immutable-violation.
- **Rollback:** flags → OFF, next fire writes nothing; already-written canary records remain valid/immutable.

## 12. Full-Write Evidence (required before FULL_WRITE authorization)

- **Append cost:** per-record snapshot/odds/validation append (µs–ms), at each archive depth (append is O(1) write but O(A) admission read in the frozen path).
- **Archive-depth growth:** bytes/records added per run; projected days-to-string-wall at the expected arrival rate → sets the retention/cutover horizon.
- **Growth behaviour:** total route duration vs archive depth curve (the O(F·A) climb) → the depth at which p95 exceeds the effective deadline = the **file-adapter operating ceiling**.
- **Throughput:** records/run at ceiling; runs/hr at the scheduler cadence; capacity `cadence × ceiling` vs projected arrival (INV-S).
- **Rollback evidence:** flags-off stops writes; re-fire idempotent (`already_exists`/`already_settled`/`no_change`), no duplicate/no loss.

**Binding gate:** FULL_WRITE (either path) is authorized only when p95 route ≤ 45 s **and** max < 60 s at the **current-representative** depth, the depth-vs-deadline curve locates the operating ceiling **above** the projected accumulation for the retention horizon, and the reserves (250/120)/headroom(15 s) are validated or retuned to the measured p99 per-candidate cost.

## 13. Failure Injection Benchmarks

Each mode (from the 2E-A §17 matrix) is benchmarked for **classification correctness + bounded time + no-false-empty**:

| Injection | Expected classification | Bench assertion |
|---|---|---|
| Missing archive/partition | ENOENT → empty (`succeeded` zero) | distinguished from fault; zero write |
| Corrupt archive | strict read throw → `archive_read_failed`/`failed` | never empty success; fast fail |
| Stale archive | freshness threshold → `run_degraded`/defer | detected (F-B) |
| Lock unavailable | `null` → `skipped`/409 | no discovery, bounded |
| Deadline exceeded | pre-batch/between-candidate defer | `deferred_by_deadline`, bounded, no overrun |
| Writer failure | `write_failed` → `failed` | idempotent re-fire; no partial-pair success |
| Reader failure | `source_load_failed`/`archive_read_failed` → `failed` | fail-closed, never `[]` |
| Configuration failure (invalid flag/int) | fail-safe to OFF/bounded default | never unbounded, never widens ceiling/deadline |

**Acceptance:** every failure resolves to a documented fail-closed/bounded outcome; none converts a source failure into an empty success (except a genuinely-missing partition, distinguished by the strict reader); each within a bounded time budget.

## 14. Benchmark Artifacts (must exist before production activation)

Under a versioned, audit-suitable location (proposed `docs/benchmarks/m10/2e-b/` or `artifacts/bench/m10/` — a docs/evidence path, not runtime):
- **Per-cell result JSON:** cell id, matrix coordinates, machine/runtime spec, env profile, seed, reproducible command, warm/cold samples, p50/p95/p99/max/mean/stddev/CV/n, per-phase durations, per-op counts, RSS/heap peaks, event-loop histogram, writes attempted/committed, deferrals, pass/fail vs budget.
- **Raw timing CSV** per cell (all samples) for re-analysis.
- **Metrics snapshot** (`metrics.snapshot()`) per cell.
- **Acceptance summary** (one signed document): each gate → GO/NO-GO/DEFER + evidence links + tuning recommendations for the constants.
- **Failure summary:** every injected failure → classification + assertion result.
- **Benchmark history:** an append-only index of runs (date, git SHA, machine, headline p95) so future production audits can compare.
All artifacts are **synthetic-fixture-derived, contain no production data / no secret / no entity ids**, and are reproducible from the recorded command+seed.

## 15. Readiness Gates

Each gate: **purpose · owner · evidence · acceptance · failure action.**

| Gate | Purpose | Owner | Evidence | Acceptance | Failure action |
|---|---|---|---|---|---|
| **Environment** | Correct NODE_ENV/adapter | Platform | env manifest | `NODE_ENV=production`, `EVIDENCE_ARCHIVE_ADAPTER=file` | NO-GO until fixed |
| **Secrets** | Cron auth + DB present | Platform | secret-presence check (not values) | `CRON_SECRET`/`ENABLE_CRON`/`EVIDENCE_DATABASE_URL` set | NO-GO |
| **Archive** | Depth below string wall | Ops | prod line counts + §6 depth curve | current depth < operating ceiling | DEFER → retention/cutover |
| **Reader** | Strict fail-closed source | FootyStats owner | strict-reader parity bench | ENOENT→empty, malformed→throw, deterministic | NO-GO |
| **Writer** | Idempotent append cost bounded | Perf | §12 append + rollback | idempotent; append cost within budget | DEFER |
| **Benchmark** | Full matrix recorded | Perf | §14 artifacts | all critical cells GO; artifacts complete | NO-GO |
| **Memory** | No leak; peak < limit | Perf | §7 | steady-state; peak RSS < instance limit | NO-GO |
| **Performance** | Route ≤45 s p95 | Perf | §6 route | p95 ≤ 45 s, max < 60 s at representative depth | DEFER → retune/streaming |
| **Concurrency** | Single-writer proven | Platform | §9 | no double-write; durable lock or instances:1 | NO-GO |
| **Rollback** | Flags-off stops writes | Ops | §11/§12 drill | flags-off ⇒ zero next-fire writes; no data delete | NO-GO |
| **Deployment** | Single-instance/lock + kill semantics | Platform | ecosystem review | instances:1 or durable lock; kill_timeout > effective deadline | NO-GO |
| **Observability** | Bounded metrics present | Ops | metrics audit | §M metric set, no entity id, best-effort | DEFER |
| **Scheduler** | Cadence ≥ arrival capacity | Ops | INV-S check | `cadence × ceiling ≥ projected arrival` | DEFER → denser cadence |

## 16. Go / No-Go Matrix

Each criterion resolves to exactly one of **GO / NO-GO / DEFER**.

| Criterion | GO if | NO-GO if | DEFER if |
|---|---|---|---|
| Frozen integrity | no M6/M8/schema change | any frozen change | — |
| Reader readiness | strict reader bench passes | fail-open used | reader not yet built |
| Route p95 ≤ 45 s (representative) | p95 ≤ 45 s, CV ≤ 0.25 | max ≥ 60 s repeatably | p95 45–55 s → retune reserves |
| Memory | no leak, peak < limit | leak | peak near limit → depth cap |
| Concurrency single-writer | proven | double-write possible | durable lock not provisioned |
| Dry-run zero-write | 100% byte-identical | any write | — |
| Canary evidence | ≥3 clean + chain-verify clean | any abort criterion | insufficient runs |
| Depth headroom | depth < operating ceiling | at string wall | near ceiling → retention plan |
| Deployment/single-instance | instances:1 or durable lock | multi-instance no lock | provisioning pending |
| Capture full write | (never here) | — | **DEFER** — needs M4→M5 derivation |

**Rule:** any NO-GO on a blocking gate ⇒ production activation is refused; a DEFER ⇒ authorization waits on the named remediation. No auto-promotion; every production step requires human go/no-go.

## 17. Final Decision — Is Stage 2E-B alone sufficient?

**NO — additional milestones remain.** Successful Stage 2E-B produces the **evidence** the activation gates consume, and thereby authorizes **Stage 2E implementation** (building the frozen 2E-A composition: `resolveM10ActivationConfig`, `readDailyArchiveStrict`, the activation composition modules, the route-entry deadline anchor, dry-run/canary wiring, reconciliation wiring — all default-OFF), which must then be **independently reviewed**. **Production activation** additionally requires: the built composition merged (default OFF); deployment provisioning (`EVIDENCE_DATABASE_URL`, secrets, `instances:1`/durable lock, scheduler cadence — a separate authorized task); and the phased **human go/no-go** (dry-run → canary → full) per 2E-A §24. **Capture full write** further requires the separate M4→M5 `deriveCaptureInput` derivation stage. Stage 2E-B **validates**; it never activates.

## 18. Implementation Slices (Stage 2E-B execution — planned, not built)

| Slice | Scope | Dependencies | Acceptance | Stop condition |
|---|---|---|---|---|
| **B-1 — Harness scaffold** | `scripts/bench/m10/` runner, phase-timer + memory/CPU/event-loop instrumentation, artifact writer, machine-spec capture | tsx; `metrics`, `perf_hooks` | harness runs an empty cell → valid artifact | writes to prod archive / reads a secret |
| **B-2 — Fixture generators** | seeded synthetic NDJSON archive (depths) + daily-archive JSON (source variants) via frozen builders; temp-dir lifecycle | frozen `createEvidenceSnapshot`/`createValidationRecord`/`buildOddsRecord` | valid archives at all depths; deleted after | any non-synthetic/prod data |
| **B-3 — Route-budget + performance cells** | categories 1–10; route-entry phase split; F-C quantification | B-1/B-2 | p50/p95/p99 recorded per cell | any prod route touched |
| **B-4 — Memory/CPU/event-loop cells** | categories 11–13 + §7/§8 | B-1/B-2 | leak/steady-state + hotspot + lag artifacts | — |
| **B-5 — Concurrency/lock cells** | category 14 + §9; disposable local PG for durable-lock cells | B-1; disposable PG | single-writer proven | prod DB used |
| **B-6 — Mode cells (dry-run/canary/full-sim/failure)** | categories 15–18 + §10–§13; **full-write cells against the temp archive only** | B-1..B-5 | zero-write proof; canary determinism; append/growth curves; failure classification | any write to prod archive / any flag enabled |
| **B-7 — Readiness-gate verification + acceptance report** | §14 artifacts, §15 gates, §16 matrix; signed acceptance summary + benchmark history | B-3..B-6 + Ops-provided prod depth | all gate artifacts produced; GO/NO-GO/DEFER per criterion | activation attempted |

No slice enables a flag, wires a production reader, activates a route, or writes to a production archive.

## 19. Acceptance Criteria (Stage 2E-B complete when)

1. Full benchmark matrix executed with the §5 measurement contract; artifacts (§14) complete and reproducible.
2. Route p95 ≤ 45 s and max < 60 s at current-representative depth (or a validated retune of reserves/headroom recorded), with source+discovery charged from route entry (F-C quantified).
3. No memory leak; peak RSS < instance budget; string-wall depth ceiling documented and gated.
4. Single-writer proven (durable lock or `instances:1`); no double-write in any concurrency cell.
5. Dry-run byte-identical archive manifest (zero writes) across nominal + all failure injections.
6. Canary determinism/fairness/rollback + chain-verify-clean evidence recorded.
7. Full-write append/growth/throughput/rollback evidence + operating-ceiling curve recorded.
8. Every failure-injection mode classified fail-closed/bounded with no false-empty.
9. All readiness gates have their evidence; the GO/NO-GO matrix is resolved; the signed acceptance summary exists.
10. No runtime/route/flag/schema/migration/deployment change was made to produce the evidence.

## 20. Carry-forward Items

- **To Stage 2E implementation (built after 2E-B evidence):** the frozen 2E-A Bucket-2 items — `readDailyArchiveStrict` (F-D), route-entry deadline anchor + structural dry-run no-write test (F-C), missing-partition observability + path parity (F-A), freshness/stale detection (F-B), `NODE_ENV`/durable-lock assertion (F-E), dry-run-zero-write/kill-switch/multi-instance tests (F-G/F-H), correction-firewall guards (F-L). *(Stage 2E-B measures and gates these; it does not build them.)*
- **To deployment:** provisioning (F-E/Gate D), PM2/update-env restart & kill-latency (F-F), scheduler cadence.
- **To future stages:** capture M4→M5 derivation (F-J, blocks capture write); Postgres evidence adapter + shared read-port resolver (F-K); durable job-run store only-if-canary-insufficient; correction stage. **None pulled into Stage 2E-B.**

## 21. Risks

- **R-1** Current-representative + high-water depths depend on Ops-provided production line counts; if unavailable, the depth axis uses conservative estimates and the depth gate DEFERs. 
- **R-2** The synchronous whole-file parse (event-loop stall) may DEFER FULL_WRITE at deep archives → streaming-read hardening (a later item, not this plan).
- **R-3** Absolute wall-time is hardware-dependent; mitigated by hardware-independent per-op counts + fraction-of-budget acceptance + recorded machine spec.
- **R-4** The frozen O(F·A) M6/M8 cost is measured, not changeable — if it exceeds budget at representative depth, remediation is retention/Postgres (future), not a 2E-B redesign.
- **R-5** Disposable-PG lock cells must never point at production DB (harness guard: refuse prod-looking URLs, mirroring `rehearse-migrations.mjs`).

## 22. Stop Conditions (declare BLOCKED if)

Stage 2E-B execution must halt and escalate (not work around) if: the benchmark cannot avoid touching production data/secrets/archive; a dry-run cell produces any write; the route cannot fit source+discovery+loop+cleanup within 60 s even with the entry-anchor + max ceiling/deadline (a genuine design gap → back to 2E-A, not a benchmark tweak); single-writer cannot be proven; the string wall is reachable at current-representative depth (activation depth-blocked → retention/cutover milestone); or any evidence would require a frozen-contract/schema/migration change. *(None is anticipated; the 2E-A design is fail-closed and additive.)*

## 23. Authorizations

- **Stage 2E-B execution (build the harness, run the matrix, produce artifacts): AUTHORIZED to plan → proceed to independent review of this plan, then execute.** *(This document plans; the harness/benchmark run is the next authorized step, evidence-only.)*
- **Stage 2E implementation (build the 2E-A composition): NOT authorized here** — authorized only after Stage-2E-B evidence + gate pass + independent review.
- **Production activation / cron enablement / capture activation / settlement activation: NOT authorized.**
- **Schema / migration / Postgres redesign / correction implementation: PROHIBITED** (out of scope, §Out-of-scope).

---

## Out of Scope (prohibited in Stage 2E-B)

Runtime implementation of the pipeline; production activation; cron enablement; capture activation; settlement activation; schema changes; migrations; PostgreSQL evidence-adapter redesign; correction implementation; any modification to routes/jobs/flags/tests/deployment/production config. Stage 2E-B **validates** — it never redesigns, never activates, never persists new schema, never touches immutable evidence.

---

# STAGE 2E-B PLAN READY FOR INDEPENDENT REVIEW

- Planning status: **COMPLETE**
- Benchmark categories designed: **18/18**
- Measurement contract: **DEFINED**
- Readiness gates: **13 defined (Environment · Secrets · Archive · Reader · Writer · Benchmark · Memory · Performance · Concurrency · Rollback · Deployment · Observability · Scheduler)**
- Go/No-Go matrix: **DEFINED (GO/NO-GO/DEFER)**
- Implementation slices: **7 (B-1…B-7), all evidence-only, none activating**
- Route budget charged from **route entry** (F-C): **YES**
- Dry-run zero-write proof: **DEFINED (byte-identical manifest under failure)**
- Stage 2E implementation authorized: **NO** (pending 2E-B evidence + review)
- Production activation authorized: **NO**
- Additional milestones remain: **YES** (Stage 2E implementation → deployment provisioning → phased activation; capture also needs M4→M5 derivation)
