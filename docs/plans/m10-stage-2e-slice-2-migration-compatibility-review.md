# M10 Stage 2E — Slice 2 (Measurement Layer & Route-Entry Timing) — Migration & Long-Term Compatibility Review

**Document type:** Independent, read-only long-term compatibility review. No runtime, route, cron, job, flag, test, schema, database, migration, deployment, or benchmark artifact was created, modified, or executed for production. The **only** file created is this document.
**Date:** 2026-07-30
**Subject:** M10 Stage 2E **Implementation Slice 2 — Measurement Layer & Route-Entry Timing** (`docs/plans/m10-stage-2e-impl-slice-2-measurement-layer.md`; BUILT, dormant).
**Method:** the exact Slice-2 diff was read from source (file:line); the modified-file set confirmed by mtime; the additive runtime seam and frozen cores independently verified; the Slice-2 + settlement + M9 tests re-run green.

---

## 1. Scope Verified

Slice 2 ships exactly two things, and the split is compatibility-decisive:

1. **One runtime change — `lib/jobs/runner.ts` (additive, dormant).** `producerDeadlineBudget` gained an optional 4th param `anchorMs?`; `runEvidenceCaptureJob`/`runPredictionSettlementJob` each gained an optional `deadlineAnchorMs?: number` threaded into it. Verified `runner.ts:315`: `startedAtMs = typeof anchorMs === "number" && Number.isFinite(anchorMs) ? anchorMs : now()` — **absent or non-finite ⇒ `now()`, byte-for-byte the pre-Slice-2 behaviour.** Every current caller (the dormant cron routes, all tests) passes nothing ⇒ unchanged.
2. **Non-runtime benchmark measurement layer — `scripts/bench/m10/*` + `tests/m10Slice2Measurement.test.ts`.** Synthetic, in-process, execution only via an explicit CLI (direct-invocation guard); importing runs nothing; the app imports none of it.

**Modified-file set (mtime-confirmed):** `lib/jobs/runner.ts` (20:42) + `scripts/bench/m10/*` + the test. Frozen cores predate and are byte-unchanged: `types/evidence/validation.ts` (Jul 28), `settlement.ts` (Jul 29), `capture.ts` (Jul 29), the cron route (Jul 29), and — notably — `lib/footystats/dailyArchive.ts` (Jul 1, **the fail-open reader is untouched; the strict variant was NOT built in Slice 2**).

---

## 2. Compatibility Findings

| Axis | Finding | Verdict |
|---|---|---|
| **Additive architecture** | The sole runtime change is two optional parameters that default to prior behaviour; the benchmark harness is a separate `scripts/` tree that couples to nothing at app runtime (barrel stays runtime-free). | **PASS** |
| **Backward compatibility** | `anchorMs`/`deadlineAnchorMs` absent ⇒ `startedAtMs = now()` (pre-Slice-2, verified `runner.ts:315`); non-finite fails safe to `now()`. No current caller is affected. | **PASS** |
| **Future PostgreSQL** | No coupling introduced. The harness forces `JOB_LOCK_ADAPTER=memory` and refuses a prod-looking `EVIDENCE_DATABASE_URL` (`assertDisposableDatabaseUrl`); no evidence adapter, no schema, no store-interface change. The advisory-lock path is untouched. | **PASS** |
| **Archive compatibility** | Fixtures are minted by the **real frozen builders** `createEvidenceSnapshot` (`lib/evidence/snapshot.ts:202`) + `createValidationRecord` (`lib/validation/records.ts:135`) into `mkdtemp` temp dirs; the production archive is never opened. No format change. | **PASS** |
| **Evidence compatibility** | No `ValidationRecord`/`EvidenceSnapshot`/identity/hash/`settledAt` change; fixtures are format/hash-faithful by construction; immutable evidence untouched. | **PASS** |
| **Benchmark framework extensibility** | `phases.ts`/`measure.ts`/`cells.ts`/`fixtures.ts` are additive; `types.ts`/`report.ts` extended additively (`Sample` gained fields; raw CSV added). New cells/phases are added without touching runtime — the framework grows by extension, not modification. | **PASS** |
| **Activation compatibility** | The route-entry anchor seam is the *additive foundation* a later activation slice wires into a real request boundary (explicitly deferred, §6 of the impl doc). Slice 2 neither activates nor forecloses it. | **PASS** |
| **Future strict-reader compatibility** | The strict daily reader was **not** built here; `readDailyArchive` remains fail-open and untouched. The strict variant remains a later additive sibling (`readDailyArchiveStrict`), unblocked. | **PASS** |
| **Dry-run compatibility** | Not built/activated; the measurement cells run discovery-only against synthetic fixtures and invoke **no write batch**. No dry-run runtime path is created or altered. | **PASS** |
| **Canary compatibility** | No canary cell, flag, ceiling, or selection path added; the canary design (2E-A) is untouched and unblocked. | **PASS** |
| **FULL_WRITE compatibility** | No write path exercised against any durable archive; FULL_WRITE remains unauthorized and gated on 2E-B evidence + activation slices. Slice 2 measures, never writes. | **PASS** |

**Independently verified:** the Slice-2 measurement test + `evidenceSettlement` + `m9Activation` re-run **65/65 green** this pass (full suite 1837/1837 per the impl record); the additive param is dormant when unsupplied.

---

## 3. Migration Risk

**NONE.**

- **No migration required.** The only runtime delta is two optional function parameters — no DB, archive, config, reader, writer, or deployment migration.
- **No archive conversion required.** Fixtures are synthetic temp; the production archive is never read or written.
- **No historical rewrite required.** Immutable evidence is untouched; nothing rewrites, revises, or reformats existing records.
- **No public API break.** `producerDeadlineBudget` is a module-private function (not exported). The two exported job functions gained an **optional** options property — purely additive; no existing call signature changes. TypeScript/lint/full-suite green confirm no break.
- **No future blocker introduced.** The F-C anchor is closed by an additive seam that a later slice extends; nothing is foreclosed.

---

## 4. Future Extensibility

- **Route-entry anchor is the correct additive foundation.** By threading an optional monotonic `deadlineAnchorMs` rather than editing the shared cron handler (a declared STOP condition), Slice 2 lets the benchmark charge source-load + discovery to the budget **without** touching any production route/scheduler. A later activation slice supplies the anchor from a real request boundary — a pure extension of the same seam.
- **Benchmark harness grows by addition.** New cells (strict-reader, lock-contention, canary, full-write-sim, production-depth) attach to the `MeasurableCell`/`PhaseRecorder` registry without runtime change; the runtime-free barrel keeps the framework decoupled from the app.
- **Postgres cutover unobstructed.** The disposable-PG-only lock discipline + memory-lock default mean future Postgres evidence-adapter benchmarking is an additive cell set; no assumption is baked into the runtime.
- **Percentile source-of-truth is raw samples** (raw CSV), so future reruns/re-analysis need no schema and compare against prior baselines.

---

## 5. Carry-forward (unchanged by this review; owned by later slices)

- **Production route/handler route-entry capture** — wire the anchor into a real request boundary (activation slice).
- **Strict daily reader** (`readDailyArchiveStrict`, additive sibling), dry-run/canary/full-write cells, lock-contention + production-depth cells, ≥100-sample tail-confident runs — all deferred, none built here.
- **Capture full write** — still gated on the separate M4→M5 derivation stage.
- **Postgres evidence adapter + shared read-port resolver** (CS-4/SC-1), durable job-run store (only-if-canary-insufficient), and the Stage-3 correction pipeline — none pulled into Slice 2.

---

## 6. Verdict

**COMPATIBLE.**

Stage 2E Slice 2 is fully additive and backward-compatible: its only runtime change is two optional, fail-safe, dormant parameters that reproduce prior behaviour byte-for-byte when unsupplied, and its measurement layer is a non-runtime, synthetic, guarded benchmark harness that touches no production archive, schema, flag, route, or immutable evidence. It requires **no migration, no archive conversion, and no historical rewrite**; it introduces **no public API break and no future blocker**; and it preserves full compatibility with future PostgreSQL, activation, strict-reader, dry-run, canary, and FULL_WRITE work — closing the F-C deadline-anchor gap on the additive foundation those later slices extend.

---

## 7. Explicit Confirmations

- No runtime code changed except the additive, dormant `lib/jobs/runner.ts` optional-anchor seam ✅
- No routes, cron, flags, schema, migration, archive format, or evidence contract modified ✅
- No production archive read or written; all benchmark data synthetic-temp ✅
- No production activation, dry-run, canary, or FULL_WRITE performed ✅
- Frozen M6/M8 cores + `types/evidence/*` + fail-open `readDailyArchive` byte-unchanged (mtime-verified) ✅
- The only file created by this review is `docs/plans/m10-stage-2e-slice-2-migration-compatibility-review.md`. All cited `file:line` anchors were read from the current repository.
