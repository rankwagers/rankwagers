# M10 Stage 2D — Operational Controls — Implementation Performance Review

**Document type:** Performance & scalability review (review-only). No runtime code, test, contract, feature flag, cron route, runner, schedule, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance Reviewer, Sprint 23B / M10 Stage 2D.
**Under review (built, verified this pass):** `lib/evidence-capture/candidates/operational.ts` (deadline/guard/ceiling/diagnostics/metrics/errors); `lib/evidence-capture/candidates/completed-rows.ts` (loader); the deadline seam in `lib/evidence-capture/jobs/capture-run.ts` / `settlement-run.ts`; the runner wiring `lib/jobs/runner.ts:297-337,378-432,475-…`; config `lib/evidence-capture/config.ts:120-154`; `tests/evidenceOperationalControls.test.ts`.
**Method:** every `file:line` read; **validation run** (tests + typecheck) and a **micro-benchmark** of the 2D hot-path helpers over synthetic in-memory data (deleted; no repo fixture, no runtime/test change). Numbers: **[measured-2D]** (this pass) or **[derived]** / **[measured-2B/2C]** for the inherited archive costs.

**VERDICT: PERFORMANCE REVIEW CONDITIONALLY PASSED** — every 2D control is a measured-negligible O(1)/O(bounded)/O(D) addition that *bounds* tail latency and adds no archive-scaling cost; the single condition is that the provisional `reservePerCandidateMs`/headroom constants must be validated at representative depth (Stage-2E Gate-B5). See §Verdict.

---

## Validation run (this pass)

| Check | Command | Result |
|---|---|---|
| Stage-2D operational controls | `--test tests/evidenceOperationalControls.test.ts` | **29 pass / 0 fail** |
| Capture + settlement pipelines | `--test tests/evidence{Capture,Settlement}Pipeline.test.ts` | **35 pass / 0 fail** |
| Typecheck | `tsc --noEmit -p tsconfig.typecheck.json` | **exit 0** |
| Behaviour spot-checks **[measured-2D]** | micro-bench | `resolveEffectiveJobDeadlineMs(300000)=45000`; `resolveEffectiveCeiling(500)=150`, `(-1)=100` |

---

## Deadline overhead (D-1)

- `resolveEffectiveJobDeadlineMs` = pure `clamp(min(configured, routeBudget−headroom), 1, min(routeBudget−headroom, 45_000))` (`operational.ts:49-63`) — **O(1) per run**, no allocation beyond a number. **[measured-2D]** the 300 s `runDeadlineMs` clamps to **45 000 ms** (never honoured); invalid/0/neg → bounded upper (fail-safe).
- `producerDeadlineBudget` builds the handle **once per run** and **only on a producer path** (`runner.ts:399-406`, gated on `usingProducer`); the static/empty M9 pass gets `undefined` → **zero overhead on the dormant route**.
- **Overhead: negligible, once/run.**

## Guard overhead (D-2)

- `shouldStartNext(remainingMs, reserve)` = `finite && remainingMs ≥ reserve` (`operational.ts:92-102`), called at the **top of each batch loop iteration before any store touch** (`capture-run.ts:116`, `settlement-run.ts:152`): `if (deadline && !shouldStartNext(deadline.remainingMs(), reserve)) { counts.deferredByDeadline += remaining; break; }`.
- **[measured-2D] 22.2 ns per candidate** (`remainingMs()` clock read + compare) → at ceiling 150 ≈ **~3.3 µs total per run**. No allocation (pure numeric).
- **Semantics (correct):** strictly **between candidates** — it never interrupts an in-flight mint/settle append; it bounds the *count* that begins, not a single candidate's duration. Engaged only on the producer path.
- **Residual (the conditional):** the reserve is a **fixed provisional constant** (capture 250 ms, settlement 120 ms — `config.ts:121-122`), **not depth-aware**. A single deep-archive candidate whose M6/M8 O(A) cost exceeds the reserve is started with ≥reserve ms left and can overrun into the **15 s headroom** (the 60 s route backstop). Correct and safe, but the constants must be validated at representative depth (§Verdict / Gate-B5).

## Diagnostics overhead (D-5/D-6/D-7/D-8)

- `flattenDiagnostics` (`operational.ts:297-318`): fixed aggregate keys + `rejected_<reason>` over the **seeded, CLOSED** reason set. **[measured-2D] 25.3 µs/run, 31 bounded keys** — cardinality cannot grow (`bumpReason` ignores unknown keys); **no `fixtureId`/`captureId`/`validationId` ever a key.** Once per run.
- `emitProducerMetrics` (`:330-361`): ≤7 outcome increments + closed-reason increments + 2 gauges, labels `{job,outcome}`/`{job,reason}` only, wrapped in `try/catch` → **best-effort, can never fail a job**. Bounded, once/run.
- `mergeProducerResultCounts` (`runner.ts:317-337`): sets 3 diag fields + flatten + emit, `try/catch` falls back to batch counts → **never flips `succeeded`→`failed`**. `run_degraded` is a **visibility flag** that does **not** change HTTP status.
- Reconciliation helpers (`reconcile{Capture,Settlement}Diagnostics`) are O(bounded reason keys), not in the runner hot path.
- **Overhead: ~25 µs/run, bounded, low-cardinality. Negligible.**

## Loader cost (D-9/D-10)

- `filterCompletedRows(rows, {nowSec})` (`completed-rows.ts:62-123`): pure, O(D) (`resolveMatchLifecycle`/row + Set dedup) + O(D log D) `matchId`-asc sort; per-row fault isolation (drop+count, never throws). **[measured-2D] 460 µs/run at D=200** finished rows.
- `createCompletedRowLoader` wraps an **injected** `readRows(date)`; **the concrete production reader is NOT fabricated** (activation dependency, Stage-2E). Whole-source failure → fail-closed `ProducerError("source_load_failed")` (never silent `[]`); read-only; deterministic (injected `nowSec`, no clock).
- Bounded by **D (source rows, tens–low-hundreds), not archive size A**; runs at the orchestration boundary before the batch (concurrent with the archive read in the pipeline).
- **Cost: sub-millisecond/run; a whole-source read (deferred). RC-2 hung-reader is a documented Stage-2E residual (60 s platform kill; safe because read-only).**

## Memory

Stage 2D adds **no new whole-archive read and no new O(A) structure.** Marginal footprint: one deadline closure/run, one flattened `Record` (31 keys)/run, the loader's kept-rows array + `seen` Set (O(D)). All bounded, per-run, GC'd. **Peak RSS is unchanged from 2C** (dominated by the concurrent snapshot+validation materialization — **[measured-2C]** 391 MB at 100 k; GB-scale on deep archive). Marginal Δ ≈ O(reason keys + D).

## Event loop

**No new synchronous parse** → the event-loop profile is **unchanged** (the inherited **[measured-2C]** ~4–6 s/100 k discovery block + frozen M6/M8 scans remain the risk — Stage-2E E-3). The guard is **beneficial**: it bounds how long the loop is monopolized *per run* by capping the candidate count. The 2D helpers themselves (22 ns guard, 25 µs flatten, 0.46 ms loader) do not block.

## CPU

**[measured-2D]** all 2D additions sum to **≪ 1 ms/run** (guard ~3.3 µs at ceiling 150 + flatten 25 µs + loader 0.46 ms + O(1) resolves) against a run that spends **seconds** in frozen `JSON.parse`. The dominant CPU (whole-archive parse + odds hash-verify) is **unchanged**. Negligible marginal CPU.

## Throughput

`throughput/run = min(effectiveCeiling, deadline-bound count)`. Stage 2D's effect is a **reliability conversion**: a deep-archive run that would have hit the 60 s route / 10 s PM2 kill now yields a **bounded partial batch + deterministic `deferred_by_deadline`** (re-discovered next fire, INV-A) — no wasted-and-lost work. Capacity at ceiling 100 × ~6 runs/hr ≈ ~570/hr ≫ arrival (tens–low-hundreds/day).

## Latency

D-1 **caps p100 run wall-time at ≤45 s** (route 60 − 15 headroom), preventing the route/PM2 overrun; **[measured-2D]** the controls' own added latency is `~3.3 µs (guard) + ~25 µs (diag) + ~0.46 ms (loader)` per run — effectively zero. User-facing latency on the single fork is still bounded by the (unchanged) discovery+processing block within that ≤45 s window (off-process/streaming is the Stage-2E fix).

## Candidate ceilings (D-3/D-4)

`resolveEffectiveCeiling = normalizeBatchLimit` → `[1,150]`, default 100. **[measured-2D]** `500→150`, `-1→100` — the legacy 500 can never be effective; `effectiveCeiling` is now surfaced in diagnostics (`effective_ceiling`). O(1); the ceiling bounds F (per-run work), not depth A.

## Archive reads

**Unchanged — Stage 2D adds ZERO new archive reads.** Discovery remains the single-bounded 2 reads (snapshots + odds for capture; snapshots + validations for settlement, 2A/2B/2C); M6/M8 remain frozen. The loader reads the **source** (daily archive) via an **injected** reader — not the evidence archive — and only once per run, concurrent with the archive-state read.

## Additional allocations

Per run (all bounded, GC'd): 1 deadline-handle closure; 1 flattened diagnostics `Record` (31 keys); loader kept-rows array + `seen` Set (O(D)); ≤~25 short-lived metric-label objects. **The per-candidate guard allocates nothing** (numeric compare). No per-candidate allocation growth; no unbounded map (closed reason vocabulary + `bumpReason` guard).

---

## Blocking Findings

**None.** Every 2D control is measured-negligible, adds no archive read / no O(A) memory / no event-loop block, is fail-safe (deadline clamp, ceiling clamp, best-effort metrics that never fail a job, fail-closed loader), and is engaged only on the producer path (zero overhead on the dormant route). No regression to the M9/2B/2C posture.

**Non-blocking / conditional:**
- **N-1 (the condition):** `reservePerCandidateMs` (250/120 ms) and `reservedHeadroomMs` (15 s) are **provisional, depth-independent** constants. Because per-candidate M6/M8 cost is O(A), on a deep archive the guard can start a candidate that overruns the reserve and leans on the 15 s headroom. Validate/tune against representative archive depth in **Stage-2E Gate-B5** (already flagged in the impl record).
- **N-2:** RC-2 hung-loader bounded only by the 60 s platform kill (read-only, safe) — Stage-2E residual.
- **N-3:** the dominant scaling costs (frozen `F·(2+2T)`/`F·(3+M)` amplification, ~4–6 s/100 k block, GB-scale RSS, ~357 k/~524 k string walls) remain Stage-2E gates E-1…E-5, which 2D bounds but does not eliminate.

---

## Verdict

### PERFORMANCE REVIEW CONDITIONALLY PASSED

Stage 2D wires the operational controls with **measured-negligible overhead and no archive-scaling cost**: the INV-D deadline is an O(1) clamp (300 s → **45 000 ms**, verified) engaged once per producer run; the mid-batch guard is **22 ns/candidate** (≈3.3 µs/run at ceiling 150), strictly between candidates, never interrupting an in-flight append; diagnostics flatten+emit is **~25 µs/run** at fixed 31-key, closed-reason, no-entity-id cardinality, best-effort so it can never fail a job; the completed-rows loader is **~0.46 ms/run at D=200**, O(D) and fail-closed over an injected (deferred) source reader. Stage 2D adds **zero new archive reads, no new O(A) memory, no new event-loop block, and ≪ 1 ms/run CPU**; the ceilings clamp 500→150 / −1→100; memory, event-loop, and RSS profiles are **unchanged** from 2C. Validation is green (29/29 + 35/35, typecheck exit 0). It correctly **bounds p100 run latency to ≤45 s** and converts a deep-archive overrun into a deterministic, re-discoverable defer — a reliability gain, no regression.

It is **CONDITIONALLY** passed because the provisional, depth-independent `reservePerCandidateMs` (250/120 ms) and 15 s headroom do not track the O(A) per-candidate cost, so on a deep archive the guard relies on the headroom rather than precisely deferring — these constants must be validated/tuned at representative archive depth in **Stage-2E Gate-B5** — and the dominant inherited scaling costs (frozen M6/M8 amplification, ~4–6 s/100 k discovery block, GB-scale RSS, the ~357 k/~524 k `MAX_STRING_LENGTH` walls) remain Stage-2E activation gates that 2D bounds but does not remove. No frozen contract, identity, hash, revision, ordering, or replay semantic is affected.

**Confirmation:** the only file created is `docs/plans/m10-stage-2d-implementation-performance-review.md`. **No runtime or test file was modified**; the micro-benchmark ran against built code with in-memory data (deleted; no repo fixture added).
