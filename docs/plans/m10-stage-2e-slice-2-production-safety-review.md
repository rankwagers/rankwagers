# M10 Stage 2E — Implementation Slice 2 (Measurement Layer & Route-Entry Timing) — Independent Production-Safety Review

**Document type:** Independent production-safety review (documentation-only, persisted record). **No runtime, tests, scripts, configuration, schemas, migrations, routes, cron, flags, deployment files, or any other documentation were modified in producing this record.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E — Implementation Slice 2: Measurement Layer & Route-Entry Timing**.
**Date:** 2026-07-31
**Reviewer:** Independent Production-Safety Reviewer.
**Under review:** `lib/jobs/runner.ts` (the single additive, dormant runtime change) + the non-runtime benchmark measurement layer `scripts/bench/m10/{phases,measure,fixtures,cells,cli}.ts` (+ Slice-1 framework) + `tests/m10Slice2Measurement.test.ts`.
**Governing:** `m10-stage-2e-impl-slice-2-measurement-layer.md`; `m10-stage-2e-b-benchmark-readiness-plan.md` (finding **F-C**); the Stage-2E-A frozen design.
**Method:** every claim re-verified against current repository source (file:line anchors below); the verdict reached in the independent review is preserved unchanged.

---

## 1. Executive Summary

Stage 2E Slice 2 adds the **synthetic, in-process, dormant** measurement layer that benchmarks the settlement discovery path **from route entry**, and closes benchmark-readiness finding **F-C** (the deadline budget was anchored *after* discovery, so source-load + discovery escaped it) with an **additive, dormant** runtime seam. It activates nothing. It runs the existing frozen pipeline against **synthetic fixtures** in **memory**, gated behind an **explicit CLI** with **fail-closed isolation guards that execute before any benchmark cell**.

**One runtime file was touched** — `lib/jobs/runner.ts` — an optional `deadlineAnchorMs?` param threaded into a new optional 4th param of `producerDeadlineBudget`. It is **additive, dormant, and byte-for-byte back-compatible for every production caller**: absent ⇒ `startedAtMs = now()`, the exact pre-Slice-2 behaviour, and the param is only reachable on a producer path, which the bare cron routes never take. **No production caller's behaviour changes.** Everything else is scripts-only under `scripts/bench/m10/`.

Assuming a production deployment tomorrow: **no runtime behaviour change, no operational risk, trivial rollback.** The independently reached verdict is preserved: **PASSED.**

---

## 2. Repository Re-Verification (all claims confirmed from source)

| # | Claim | Anchor (verified) | Result |
|---|---|---|---|
| 1 | Cron routes remain the **bare, dormant** M9 delegate | `app/api/internal/cron/evidence-capture/route.ts:13` `runEvidenceCaptureJob()`; `.../prediction-settlement/route.ts:13` `runPredictionSettlementJob()` (no options) | ✅ |
| 2 | Runner anchor param is **additive & dormant** (absent ⇒ pre-Slice-2 behaviour) | `runner.ts:297,308-314` — `anchorMs?` optional; `startedAtMs = Number.isFinite(anchorMs) ? anchorMs : now()` | ✅ |
| 3 | Anchor is reachable **only on a producer path** (bare routes never take it) | `runner.ts:393,415-420` and `:496,518-523` — `usingProducer = !!(provideCandidateBatch \|\| provideCandidates)`; `producerDeadlineBudget(...)` called only then | ✅ |
| 4 | **No runtime module imports the harness** (not app-reachable, not bundled) | `grep scripts/bench` over `app lib components pages` → **no hits** | ✅ |
| 5 | Repo benchmark **artifact dirs are empty** (only `.gitkeep`) | `scripts/bench/m10/artifacts/{json,csv,summary,logs}` → placeholders only | ✅ |
| 6 | Isolation **guards run before any cell** | `cli.ts:70-71` (`assertBenchmarkSafeEnv` + `assertDisposableDatabaseUrl`) precede the cell loop at `cli.ts:98` and `ensureArtifactDirs` at `:84` | ✅ |
| 7 | **CLI-only execution** — import runs nothing | `cli.ts:164-168` — `main()` runs only when `process.argv[1].endsWith("cli.ts")` (independently confirmed: importing `cli.ts`+`cells.ts` ran no `main()` and wrote no artifact) | ✅ |
| 8 | Guards are **fail-closed** on prod URL / prod dir / live flag | `guards.ts:36-37` (`smellsProd \|\| !isLocal`), `:53-59,67-80` (prod evidence dir + live `data/`), `:85-89` (refuses `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED`/`EVIDENCE_M10_LIVE_ENABLED` on) — each throws `BenchIsolationError` | ✅ |
| 9 | Cell flag lives **only on the injected job env**, never `process.env`; **memory** store; memory locks | `cells.ts:146-148` (spread into a new `enabled` object; `EVIDENCE_SETTLEMENT_ENABLED:"true"` + `JOB_LOCK_ADAPTER:"memory"`); `:142,174` `memoryEvidenceStore(...)` | ✅ |
| 10 | **No write-to-disk / canary / full-write / lock-contention / prod-depth** cell | `cells.ts:12` — explicitly none; three settlement measurement cells only | ✅ |
| 11 | **Synthetic fixtures only** — frozen builders, index-derived, memory | `fixtures.ts:15-17` (`createEvidenceSnapshot`/`createValidationRecord`/`createMemoryEvidenceArchive`); `:24` base fixture `700000`; no `Math.random`; `:145-148` `mkdtemp` + `assertIsolatedDir` | ✅ |
| 12 | Slice-2 tests green | `tests/m10Slice2Measurement.test.ts` — **13/13** (re-run in the review session); full suite **1837/1837**, typecheck exit 0, lint clean (per Slice-2 record) | ✅ |

---

## 3. Explicit Production-Safety Verifications (as required)

- **Production remains dormant** — ✅ both cron routes call the bare job (no producer, no anchor, no flag); the M9 empty-safe pass is unchanged; the runner anchor param is inert for every production caller (§2 #1–#3).
- **No cron or scheduler change** — ✅ no cron route body, scheduler, or cadence file was touched; routes unchanged.
- **No feature flag enabled** — ✅ no flag default changed; the settlement flag is set only on a cell-local injected job env (`cells.ts:146-148`), never `process.env`; the guard refuses any live flag on `process.env` before cells run.
- **No FULL_WRITE activation** — ✅ no full-write/canary cell exists (`cells.ts:12`); FULL_WRITE remains unauthorized and un-exercised; capture M4→M5 remains deferred.
- **No production benchmark** — ✅ all cells are synthetic + in-memory; repo artifact dirs hold only placeholders; smoke runs targeted temp dirs; no GO/NO-GO conclusion issued.
- **No production database / archive access** — ✅ CLI forces `JOB_LOCK_ADAPTER=memory` (`cli.ts:93-94`, restored in `finally` `:111-112`) so the real-runner cell opens no Pool; `assertDisposableDatabaseUrl` refuses prod-looking `EVIDENCE_DATABASE_URL`; cells use memory ports/stores; `assertIsolatedDir` refuses the prod evidence dir and the live `data/` source dir.
- **Synthetic fixtures only** — ✅ deterministic, index-derived (base `700000`), built through the real frozen builders; memory stores; guarded temp dirs (§2 #11).
- **Benchmark guards execute before cells** — ✅ `runCells` invokes both isolation guards before the cell loop and before creating artifact dirs (`cli.ts:70-71` → `:84` → `:98`); a refusal throws before any cell runs or any artifact is written.
- **CLI-only execution** — ✅ execution occurs only via the explicit CLI / `runCells`; the module-level `invokedDirectly` guard runs `main()` only under direct `tsx` invocation.
- **Imports and app startup execute nothing** — ✅ the barrel is pure exports; `cli.ts` is import-inert (direct-invocation guard); no `app`/`lib` imports the harness, so app startup never loads or runs it (`scripts/bench` is not in the Next build graph).
- **Rollback remains trivial** — ✅ revert the additive, no-caller-dependent `runner.ts` param + delete `scripts/bench/m10/` + the one test; no schema, migration, flag, data, deployment, or persisted state to unwind; leaving the dormant param in place has zero runtime effect (HIGH rollback safety).
- **Zero blockers** — ✅ no finding indicates a production-unsafe path; every isolation property holds fail-closed and is verified from source.

---

## 4. Focus Determinations

- **Would this Slice change runtime behaviour?** **No.** One runtime file changed (`lib/jobs/runner.ts`), but the change is behaviourally inert for every production caller: the bare routes never reach `producerDeadlineBudget`, and a producer path without an anchor is byte-for-byte identical to before. Deployed behaviour is unchanged (full suite 1837/1837, incl. a test asserting runtime-unchanged when the anchor is absent).
- **Would this Slice create operational risk?** **No.** The harness is CLI-gated, guard-protected (guards run first and fail closed on live flags / prod DB URLs / prod & live-`data/` dirs), memory-locked, and synthetic — even accidental execution on a prod host is refused before any cell. The lone process-local mutation (`JOB_LOCK_ADAPTER` during a run) is restored in `finally` and occurs only in the ephemeral benchmark process the app never runs.
- **Would rollback still be trivial?** **Yes (HIGH).** As in §3 — a pure code revert with no state to unwind and a dormant, no-dependency runtime param.

---

## 5. Findings, Operational Risks, Carry-forward

- **Production Findings:** one honest nuance — unlike a pure scripts-only slice, Slice 2 modified a runtime file (`lib/jobs/runner.ts`); the change is additive, dormant, and back-compatible for all production callers. No other runtime, route, cron, flag, schema, or deployment change.
- **Operational Risks:** none material. Cosmetic: (a) the deadline-gap cell temporarily sets/restores `process.env.JOB_LOCK_ADAPTER` in its own process; (b) `scripts/` is inside `tsconfig.typecheck.json`, so a future bench edit that breaks types fails `npm run typecheck` — a safety feature.
- **Carry-forward (deferred by design, unchanged status):** wiring the route-entry anchor into a real production request boundary; strict daily-archive reader; canary / full-write / lock-contention / production-depth cells; ≥100-sample tail-confident runs; all activation gates. FULL_WRITE, capture M4→M5 derivation, and production activation remain **unauthorized**. Tail confidence for the smoke run is honestly reported **INSUFFICIENT (n<100)** with **no GO/NO-GO** issued.

---

## 6. Confirmation

Documentation-only persistence. No runtime code, tests, scripts, configuration, schemas, migrations, routes, cron, feature flags, deployment files, or any other documentation were modified; no benchmark was executed against any non-synthetic target; the repository artifact directories remain empty. The only file created is `docs/plans/m10-stage-2e-slice-2-production-safety-review.md`. The independently reached verdict is preserved.

## 7. Verdict

Independent production-safety verdict — preserved and re-verified against repository source: **zero blockers; production remains dormant; rollback trivial.**

PASSED
