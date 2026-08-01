# M10 Stage 2E — Implementation Slice 2 (Measurement Layer & Route-Entry Timing) — Architecture Review

**Reviewer:** Independent Architecture Reviewer (Stage 2E, Slice 2).
**Date:** 2026-07-31.
**Type:** Read-only architecture review, **persisted documentation of an already-completed review**. **No runtime, test, script, configuration, schema, migration, route, cron, feature flag, or other documentation was modified.** The only file created is this document.
**Subject:** `docs/plans/m10-stage-2e-impl-slice-2-measurement-layer.md` and the code it describes.
**Method:** every claim below re-verified against repository source (file:line), not the plan document.

**Source re-verified this pass:**
- `lib/jobs/runner.ts:308` (`anchorMs?: number`), `:314-316` (`startedAtMs = finite(anchorMs) ? anchorMs : now()` → `createDeadline({ startedAtMs, effectiveJobDeadlineMs, now })`), `:377` + `:420` (capture `deadlineAnchorMs?` threaded), `:481` + `:523` (settlement `deadlineAnchorMs?` threaded).
- `deadlineAnchorMs` / Slice-2 markers exist in **only** `lib/jobs/runner.ts` across `lib/` + `app/`.
- `lib/evidence/snapshot.ts:202` `createEvidenceSnapshot`, `lib/validation/records.ts:135` `createValidationRecord` — both real exports (BC-1).
- No `lib/`/`app/` import of `scripts/bench` (no reverse coupling).
- No Slice-2 / `deadlineAnchor` / `routeEntry` leakage into `types/`, `lib/archive/`, `lib/evidence/snapshot.ts`, `lib/validation/records.ts`.
- Benchmark modules (`scripts/bench/m10/{measure,cells,fixtures,cli,phases}.ts`) — measurement layer, one-way coupled to runtime, CLI-gated.
- `tests/m10Slice2Measurement.test.ts` — **13/13 pass** (re-run independently).

---

## 1. Scope

Slice 2 adds the **measurement layer** that benchmarks the live-candidate settlement pipeline **from route entry**, and introduces an **additive, dormant** runtime seam that lets a caller anchor the effective deadline at route entry so source-loading + discovery are charged to the budget. It builds on the Slice-1 framework (`scripts/bench/m10/`). The runtime footprint is a single file, changed additively.

---

## 2. Architecture Findings

- **Single runtime file, additive.** The only runtime change is `lib/jobs/runner.ts`. `producerDeadlineBudget` gained an optional 4th parameter `anchorMs?: number`; its body computes `startedAtMs = (typeof anchorMs === "number" && Number.isFinite(anchorMs)) ? anchorMs : now()` and builds `createDeadline({ startedAtMs, effectiveJobDeadlineMs, now })` (runner.ts:308,314-316). `runEvidenceCaptureJob` and `runPredictionSettlementJob` each gained an optional `deadlineAnchorMs?: number` threaded into that call (runner.ts:377/420, 481/523). Grep confirms these markers exist **only** in `runner.ts` across `lib/` and `app/`.
- **Benchmark layer is non-runtime.** New `scripts/bench/m10/{phases,measure,fixtures,cells,cli}.ts` plus extensions to the framework `types.ts`/`report.ts`. `fixtures.ts` mints synthetic fixtures via the **real frozen builders** `createEvidenceSnapshot` and `createValidationRecord`, which exist at `lib/evidence/snapshot.ts:202` and `lib/validation/records.ts:135` (BC-1, below).
- **F-C proven against the real runner.** The `settlement.deadline_gap` cell drives the actual `runPredictionSettlementJob`: with `deadlineAnchorMs` set and a fake clock advanced during discovery past the effective 45 s budget, the between-candidate guard defers the batch; without the anchor the deadline is anchored post-discovery and the full budget is restored, so the batch proceeds. The cell asserts `deferredWith > 0 && deferredWithout === 0`.

---

## 3. Verified Architecture

**Additive and dormant deadline-anchor seam.** The seam is a pair of optional parameters (`anchorMs?` on `producerDeadlineBudget`; `deadlineAnchorMs?` on both job entry points). It is engaged only on a producer-driven path and only when a caller supplies the anchor. No current caller — including the dormant cron routes — supplies it. Verified: `deadlineAnchorMs` markers are confined to `runner.ts`; no route/cron/flag/scheduler file references it.

**Backward compatibility when the anchor is omitted.** When `anchorMs` is absent (or non-finite), `startedAtMs = now()` — byte-for-byte the pre-Slice-2 behaviour (runner.ts:314-315). The dormant routes fire the bare jobs with no producer, so the deadline branch is not even engaged. Independent test run: `tests/m10Slice2Measurement.test.ts` 13/13 pass; the plan reports the full suite at 1837/1837, typecheck exit 0, lint clean — consistent with a purely additive/optional change.

**F-C closed at the mechanism level.** The Stage-2E-B F-C finding (deadline anchored *after* discovery, so source-load + discovery escaped the budget) is closed as a runtime capability: when the route-entry anchor is supplied, `deadlineAtMs = startedAtMs + effectiveJobDeadlineMs` is fixed at route entry, so elapsed source-load + discovery time reduces `remainingMs()` and the between-candidate guard defers accordingly. This is proven end-to-end against the real `runPredictionSettlementJob` by the `settlement.deadline_gap` cell (defer-with-anchor / proceed-without-anchor), not merely asserted in documentation.

**Production route-entry wiring deferred.** No production caller supplies the anchor; the shared cron handler is not modified to capture a route-entry timestamp (capturing one across the multiple route entry points was an explicit Slice-2 STOP condition). The live path therefore still anchors post-discovery today — but that path is dormant and activation is multi-gated. Wiring the anchor into a real request boundary is a later activation slice. This is correct incremental sequencing: the seam is ready and proven; only its production activation is deferred.

**BC-1 resolved.** The frozen builders the fixtures rely on — `createEvidenceSnapshot` (`lib/evidence/snapshot.ts:202`) and `createValidationRecord` (`lib/validation/records.ts:135`) — exist as real exports. The earlier Stage-2E-B BC-1 concern (that these names did not exist) was a grep against the wrong subtree (`lib/evidence-capture/`); the builders live under `lib/evidence/` and `lib/validation/`. Fixtures use the real frozen builders; nothing is fabricated.

**No schema / archive / evidence contract evolution.** No Slice-2 / `deadlineAnchor` / `routeEntry` markers appear in `types/`, `lib/archive/`, `lib/evidence/snapshot.ts`, or `lib/validation/records.ts`. `ValidationRecord`, `EvidenceSnapshot`, archive NDJSON format, identity/hash/revision/`settledAt`, and store interfaces are untouched. The extended `types.ts` is the **benchmark** framework's types (Sample fields), not a runtime contract.

**No runtime coupling from the benchmark framework; benchmark isolated.** No `lib/`/`app/` file imports `scripts/bench` (coupling is one-way: bench → runtime, correct for a benchmark). The framework barrel `index.ts` stays runtime-free; the runtime-coupled modules (`cells`, `fixtures`, `cli`) are imported directly by the CLI/tests. The CLI runs isolation guards first (`assertBenchmarkSafeEnv`, `assertDisposableDatabaseUrl`), forces `process.env.JOB_LOCK_ADAPTER=memory` for the run (restored in `finally`), keeps the settlement flag on an injected job env only (never `process.env`), uses a memory evidence store, and has a direct-invocation guard so importing executes nothing.

**No feature activation.** No flag is flipped; the settlement flag is set only on an injected env object for the real-runner cell; `assertBenchmarkSafeEnv` refuses a live pipeline flag on `process.env`.

**Anchor captured once and immutable.** `routeEntryAnchorMs()` is captured once per run via the monotonic `nowMs()`; in the runtime, `anchorMs` is consumed once to set `startedAtMs`, which is fixed inside the `createDeadline` closure and never re-derived or reset. No nested deadline budgets exist (one `producerDeadlineBudget`/`createDeadline` per job).

---

## 4. Architectural Risks

- **Low / bounded:** if settlement were activated *before* the anchor-wiring slice, source-load + discovery would still escape the budget on the live path. Mitigated in depth — production is dormant, activation is multi-gated, the between-candidate guard still bounds the batch even unanchored, and the platform `maxDuration=60` is the outer bound. No data-safety exposure.
- **None on isolation:** the real-runner cell touches no production store, lock, flag, or archive (memory store, injected-env flag, forced memory lock, prod-URL/flag guards run first).

---

## 5. Carry-forward Items

1. Wire the route-entry anchor into the production cron handler (later activation slice) to close F-C on the live path — the runtime seam is ready and proven.
2. Deep-archive extrapolation of the deadline gap and ≥100-sample tail-confident critical runs (Slice-2 honestly reports tail confidence INSUFFICIENT, n<100; no GO/NO-GO issued).

---

## 6. Verdict

Slice 2 is additive, dormant, and backward-compatible: one runtime file changed via optional parameters, byte-for-byte behaviour when the anchor is omitted, no schema/archive/evidence contract evolution, no feature activation, and a one-way-isolated benchmark layer. The F-C closure mechanism is implemented and independently proven against the real runner; production route-entry wiring is a deliberately-deferred, correctly-sequenced carry-forward. BC-1 is resolved. **Zero blockers.**

- Additive and dormant deadline-anchor seam: **confirmed**
- Backward compatibility when the anchor is omitted: **confirmed** (`startedAtMs = now()`)
- F-C closed at mechanism level: **confirmed** (proven against the real `runPredictionSettlementJob`)
- Production route-entry wiring deferred: **confirmed** (later activation slice)
- BC-1 resolved: **confirmed** (`createEvidenceSnapshot` + `createValidationRecord` exist)
- No schema/archive/evidence contract evolution: **confirmed**
- Blockers: **0**

**Confirmed:** NO runtime code modified · NO tests modified · NO scripts modified · NO configuration/schema/migration modified · NO routes/cron/flags modified · NO other documentation modified. The only file created is `docs/plans/m10-stage-2e-slice-2-architecture-review.md`.

APPROVED
