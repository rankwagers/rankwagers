# M10 Stage 2D — Operational Controls — Performance Review

**Document type:** Performance & scalability review (review-only). No runtime code, test, contract, feature flag, cron route, runner, schedule, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance Reviewer, Sprint 23B / M10 Stage 2D.
**Build state (verified):** Stage 2D is **NOT built** — no `stage-2d` doc/module/test exists; the runner has no deadline, the provider diagnostics are dropped at the `provideCandidates` seam, and there is no live completed-rows loader. This is a forward-looking review of the *planned* Stage 2D operational controls (D-1…D-10, `m10-stage-2c-closure.md:§9`).
**Scope of Stage 2D (from the 2C closure):** INV-D effective deadline (≤45 s) + mid-batch remaining-time guard (D-1/D-2); call-site ceiling wiring/observation (D-3/D-4); producer diagnostics aggregation + specific failure codes (D-5/D-6); backlog/oldest-pending observability (D-7/D-8); the live completed-rows source loader + fault isolation (D-9/D-10).
**Method:** every `file:line` read this pass; marginal costs **derived** from the already-**measured** 2B/2C discovery + M8 numbers (no new benchmark warranted — see §Benchmark). Numbers: **[measured-2B/2C]** or **[derived]**.

**VERDICT: PERFORMANCE REVIEW CONDITIONALLY PASSED** — every Stage 2D control is an O(1)/O(bounded)/O(D) addition that *improves* tail-latency and throughput-reliability without adding any archive-scaling cost; the conditions are correctness-of-construction constraints (injected clock, bounded cardinality, loader isolation) and the inherited whole-route/RSS/event-loop gates that remain Stage 2E. See §Verdict.

---

## Evidence

| Fact | Anchor |
|---|---|
| Route budget `maxDuration = 60`; runner has **no** deadline today | cron routes; `runner.ts:298-320,349-371` |
| `DEFAULT_RUN_DEADLINE_MS = 300_000` (5× route) — must be clamped, not honoured | `config.ts:153` |
| INV-D target: `min(configured, 60_000 − 15_000) ≤ 45_000 ms` | spec §7.3; locked-discovery plan §13 |
| Provider diagnostics already **built**, bounded, seeded, fixed-cardinality | `candidates/diagnostics.ts:1-61` (`seededReasonMap`, `bumpReason` ignores unknown keys) |
| `backlogSize`/`oldestPendingAgeMs` already computed by the provider | `capture-provider.ts:187-191`; `settlement-provider.ts:148-154` |
| Diagnostics dropped at the seam today (CL-1); metrics = `{job,outcome}` only | `runner.ts:307-318,354-368`; `emitOutcomeMetrics` |
| Ceiling default 100 / hard 150, provider-fail-safe | `limits.ts:10-27` (`normalizeBatchLimit`) |
| No live completed-rows loader (D-9); `loadCompletedRows` is a required injected seam | `settlement-pipeline.ts:63-68` |
| Discovery cost baseline (unchanged by 2D) | **[measured-2C]** 100 k → ~4.1 s / 391 MB; **[measured-2B]** 100 k snap → ~4.8 s |
| Frozen M8/M6 per-fixture O(A) scans (unchanged by 2D) | settlement `F·(2+2T)`; capture `F·(3+M)` |

---

## Deadline impact (D-1/D-2)

- **Clamp (D-1):** `effectiveJobDeadlineMs = min(configuredRunDeadlineMs, ROUTE_BUDGET − HEADROOM)` → ≤45 s. This is a **pure O(1) comparison** at run start; the 300 s `runDeadlineMs` is clamped, never honoured, and passed into `orchestrateFetches` (which already checks `deadlineExceeded()` per source, `orchestrator.ts:104-114`). **Zero per-candidate cost.**
- **Mid-batch guard (D-2):** before starting each candidate, compare `remainingMs()` against a conservative per-candidate estimate; if insufficient, **break** and count the rest `deferred_by_deadline`. Cost = **one clock read + one comparison per candidate** (O(F), ~ns each). Requires an **injected/monotonic clock** (never per-candidate `Date.now()` entering identity — identity is source-derived; the clock is a *decision* input only).
- **Performance effect — positive and bounding:** converts a potential route-timeout / PM2 kill (`kill_timeout` 10 s) into graceful partial progress + deterministic defer (re-discovered next run, INV-A). It **caps p100 run wall-time ≤45 s**; it does **not** reduce per-candidate cost.
- **Nuance (must be documented):** the guard checks **between** candidates. A single deep-archive candidate's M6/M8 does 3+M / 2+2T **uninterruptible** whole-file scans — the guard cannot stop an in-flight scan, only refuse to start the *next* candidate. So on a very deep archive one candidate can still overrun; the guard bounds count, not a single candidate's duration. (Real fix = streaming/off-process — Stage 2E, E-3.)

---

## Candidate ceilings (D-3/D-4)

- **Already enforced** in the provider: `normalizeBatchLimit` clamps `[1,150]`, fail-safe to 100, never unbounded (`limits.ts`). Stage 2D only **wires the configured value at the call site** and **observes** the deferral counts — an O(1) `slice` + counter read, no new scan.
- **The ceiling is the primary throughput/latency knob:** it bounds F (per-run work → per-run wall-time, peak concurrency of M6/M8 scans, peak RSS window). It does **not** bound accumulated depth A — per-candidate cost stays O(A). At default 100 on a **shallow** archive, one run fits ≤45 s comfortably (**[measured-M9]** settle ~85–97 ms/fixture → ~10–15 s at 100–150; capture steeper).
- **Recommendation:** keep default **100**, hard **150**; Stage 2D must pass the *clamped* config value, **never** the legacy `DEFAULT_CAPTURE_MAX_FIXTURES=500`. Overflow is deferred+counted (`candidatesDeferredByCap`), never dropped.

---

## Diagnostic overhead (D-5/D-6/D-7/D-8)

- **Already-built, bounded aggregates.** `CandidateDiagnostics` uses **pre-seeded, fixed-cardinality** reason maps (~10–18 closed keys); `bumpReason` ignores unknown keys so the map **cannot grow** (`diagnostics.ts:38-53`). `backlogSize`/`oldestPendingAgeMs` are computed **once per run** by the provider (O(deferred)).
- **Aggregation cost (D-5):** flatten the reason map into `rejected_<reason>` counters and emit via `emitOutcomeMetrics` = **one `metrics.increment` per non-zero outcome, once per run** (~≤20 increments) — the metrics counter itself is bounded, label-sanitized, 64-char-capped (`observability/metrics.ts:18-53`). **O(bounded) per run; negligible CPU/memory.**
- **Cardinality constraint (binding, D-5):** aggregate **per run**, never per fixture; **no `fixtureId`/`matchId`/`captureId`/`validationId`/payload id as a metric label** — otherwise the counter map grows unbounded (a real memory leak). The closed reason vocabulary already satisfies this; Stage 2D must preserve it.
- **Specific codes (D-6):** replacing generic `unhandled` with `archive_read_failed`/`source_load_failed` is a string-classification of a rejection — **O(1), no cost**.
- **Net:** diagnostic overhead is trivial **iff** the no-entity-label rule holds. The one thing to forbid is per-candidate metric emission.

---

## Loader cost (D-9/D-10)

- **Settlement completed-rows loader (D-9):** likely a thin filter over `readDailyArchive(date)` → terminal `FootyMatchRow[]` (the same source class capture uses via `loadPublishedDailyPredictions`). Cost = **one daily-archive read + O(D) parse/filter**, D = daily-list size (tens–low-hundreds), **bounded by D, not A**. It runs **concurrently** with the 2 archive-state reads (`Promise.all`, `settlement-pipeline.ts:107-110`), so it adds ~0 to wall-time (it is dwarfed by the ~5 s archive read).
- **Fault isolation (D-10):** the loader **must not throw uncaught mid-run**; a rejection must propagate fail-closed → run `failed` (never empty), exactly as the pipeline already does (`settlement-pipeline.ts:97-99`). Per-row faults map to defer/count, not a crash. **No performance cost; a reliability requirement.**
- **Capture analog (out of 2D):** the capture "loader" equivalent is `deriveCaptureInput` (M4 fetch + M5 derive), network-bound per selected fixture — that live wiring is a separate later stage, not Stage 2D.

---

## Memory

Stage 2D adds **no new whole-archive read and no new O(A) structure.** The deadline guard holds no state; diagnostics maps are O(bounded reason keys); the loader materializes the daily list (O(D), small). Peak RSS is therefore **unchanged** from 2C: dominated by the concurrent snapshot+validation materialization (**[measured-2C]** 391 MB at 100 k; GB-scale on deep archive; ~4–5× file per read). Stage 2D's marginal memory ≈ **O(reason keys + D)** — negligible.

---

## Event loop

Stage 2D adds **no new synchronous parse** → the event-loop profile is **unchanged**: the existing **[measured-2C]** ~4–6 s/100 k synchronous discovery block + the frozen M6/M8 per-fixture scans remain the risk (Stage 2E gate E-3). The deadline guard is **beneficial** — it bounds how long the loop is monopolized *per run* by capping the candidate count — but (as noted) it cannot interrupt a single in-flight whole-file scan. The diagnostics/deadline checks are O(1) and do not block. Loader parse is O(D), negligible.

---

## Throughput

`throughput/run = min(effectiveCeiling, deadline-bound count)`; `throughput/hr = runs/hr × that × successRate`. Stage 2D's effect is a **reliability conversion**, not a raw increase: without D-1/D-2 a deep-archive run risks a route/PM2 kill (0 useful throughput + wasted work); with them it yields a **bounded partial batch + deterministic defer** (re-discovered next run). Capacity at default 100 × ~6 runs/hr × ~0.95 ≈ **~570/hr**, far above the tens–low-hundreds/day arrival. The ceiling (D-3/D-4) is the lever that trades throughput/run against per-run latency.

---

## Latency

- **Per-run latency** = discovery (~5 s/100 k) + Σ processed candidates (M6/M8 O(A) each). D-1 **caps p100 at ≤45 s** (route 60 s − 15 s headroom), preventing the 60 s route kill / 10 s PM2 `kill_timeout` overrun. Without it, tail latency is unbounded on deep archives.
- **User-facing latency:** cron shares the single `instances:1` fork, so discovery+processing blocks user requests during the run; D-1 bounds that window to ≤45 s (still large — off-process/streaming is the real fix, E-3). Overlap → 409 within the ≤1 s lock try-window (never blocks a second fire).
- **Marginal latency of the controls themselves:** sub-millisecond (O(1) clock/compare + O(bounded) metric emits + O(D) loader).

---

## CPU

Stage 2D adds **negligible CPU**: O(1) deadline comparisons, ≤~20 metric increments/run, O(D) loader parse. The dominant CPU remains the frozen `JSON.parse` (+ odds hash-verify on the capture side) over whole archives in discovery and M6/M8 — **unchanged** by Stage 2D. No new hot loop, no new per-candidate CPU beyond one clock read.

---

## Benchmark

**No new benchmark is warranted.** Every Stage 2D component is provably O(1) (deadline/clamp), O(bounded reason keys) (diagnostics), or O(D) (loader) — none is archive-scaling. The scaling costs Stage 2D *sits on* (2-read discovery; frozen `F·(2+2T)`/`F·(3+M)` M8/M6 amplification; ~4–6 s/100 k event-loop block; GB-scale RSS; the ~357 k-snapshot / ~524 k-validation string walls) were **already measured** in the Stage 2B/2C implementation reviews and are carried as **Stage 2E gates E-1…E-5** (whole-route <45 s, M8 read-amplification, event-loop delay, peak RSS, depth ceiling). Stage 2D's own marginal cost does not move those numbers. *(No temp-data microbenchmark of the diagnostics merge was run — it would only confirm the O(bounded) analysis.)*

---

## Blocking Findings

**None.** Stage 2D is a set of bounded operational controls that *reduce* tail-latency/timeout risk and add per-run-bounded observability, with no new archive-scaling cost. Correctness-of-construction constraints (not blockers, but binding for the build):
- **C-1** deadline guard must use an **injected/monotonic clock**, check **between** candidates, and accept that a single in-flight scan is uninterruptible (document the residual deep-archive overrun; the real fix is E-3).
- **C-2** diagnostics must stay **per-run aggregate, bounded, no entity-id labels** (preserve the closed reason vocabulary; forbid per-candidate emission).
- **C-3** the live loader (D-9) must be **O(D), concurrent, fault-isolated** (fail-closed rejection, never uncaught mid-run; per-row faults → defer/count).
- **C-4** pass the **clamped** ceiling (≤150), never the 500 default.

---

## Verdict

### PERFORMANCE REVIEW CONDITIONALLY PASSED

The planned Stage 2D operational controls are **performance-safe and net-beneficial**. The INV-D deadline clamp + mid-batch guard (D-1/D-2) are O(1)/O(F) additions that **bound p100 run latency to ≤45 s** and convert a deep-archive route-timeout/kill into graceful, deterministic defer — a throughput-*reliability* gain, at the cost of one clock read + comparison per candidate. The ceilings (D-3/D-4) are already provider-fail-safe (100/150); Stage 2D only wires the clamped value and observes deferrals. Diagnostics aggregation + specific codes + backlog/oldest-pending (D-5…D-8) are **O(bounded), per-run, fixed-cardinality** and cost effectively nothing **provided** no entity id becomes a metric label. The settlement completed-rows loader (D-9/D-10) is **O(D), concurrent, and fault-isolated** — dwarfed by the ~5 s archive read it runs beside. Stage 2D adds **no new whole-archive read, no new O(A) memory, no new event-loop block, and negligible CPU**; memory, event-loop, and RSS profiles are **unchanged** from Stage 2C.

It is **CONDITIONALLY** passed, not unconditionally, because (a) Stage 2D is unbuilt and its benefit depends on the four construction constraints C-1…C-4 (injected clock, bounded cardinality, loader isolation, clamped ceiling), and (b) the dominant scaling costs it sits upon — the frozen `F·(2+2T)`/`F·(3+M)` M8/M6 amplification, the ~4–6 s/100 k synchronous discovery block, GB-scale peak RSS, and the ~357 k/~524 k `MAX_STRING_LENGTH` walls — remain **Stage 2E activation gates E-1…E-5**, which the deadline guard bounds but does not eliminate. No frozen contract, identity, hash, revision, ordering, or replay semantic is affected.

**Confirmation:** the only file created is `docs/plans/m10-stage-2d-performance-review.md`. No runtime code, test, or configuration was modified; no benchmark of modified code was run.
