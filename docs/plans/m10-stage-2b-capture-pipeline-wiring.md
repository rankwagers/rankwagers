# M10 Stage 2B — Capture Pipeline Wiring

**Document type:** Implementation-stage record (Stage 2B of M10).
**Date:** 2026-07-30
**Status:** Stage 2B implemented, **default-off / dormant at the route**. **M10 is NOT complete.**
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1)
**Predecessors:** Stage 2A (`docs/plans/m10-stage-2a-archive-normalization.md`, approved),
Stage 1 (`docs/plans/m10-stage-1-candidate-provider-foundation.md`).

---

## 1. Scope

**Exactly one thing:** wire the capture pipeline —

```
Archive State (Stage 2A, strict single read)
   → Stage 1 Provider (buildCaptureCandidates)
      → CaptureRequest[]
         → M6 Capture Runner (runEvidenceCaptureJob → runCaptureBatch)
```

**Deliberately NOT done** (explicitly out of this stage): settlement wiring; INV-D deadline
enforcement; producer-stage diagnostics/metric aggregation (§10); replay logic/tests;
concurrency / multi-worker / overlap machinery (the durable lock already exists from M9);
Postgres; feature-flag/scheduler/deployment changes; and the live **async M4-fetch + M5-derive
derivation** (the frozen M4 fetchers are dormant and the Stage-1 derivation dependency is
synchronous — a live derivation is a separate later stage).

## 2. Files

**Created:**
- `lib/evidence-capture/candidates/capture-pipeline.ts` — `createFileCaptureReadPort` (concrete
  strict read port over the NDJSON adapters) + `produceCaptureRequests` (the producer) +
  `CapturePipelineDeps` / `CapturePipelineConfig`. Server-only.
- `tests/evidenceCapturePipeline.test.ts` — 9 unit tests.
- `docs/plans/m10-stage-2b-capture-pipeline-wiring.md` — this record.

**Modified (additive, backward-compatible):**
- `lib/archive/evidence/file.ts` — exported `readAllSnapshotsStrict(env?)`: a single bounded,
  fail-closed whole-archive read of all snapshots (PB-1), reusing the existing `readNdjson`.
- `lib/evidence-capture/odds-archive/file.ts` — extracted the store's whole-archive read to a
  module-level exported `readAllOddsRecordsStrict(recordsFile)` (same fail-closed semantics);
  the store closure now delegates to it. No behaviour change.
- `lib/jobs/runner.ts` — added an optional `provideCandidates?: () => Promise<readonly
  CaptureRequest[]>` seam to `runEvidenceCaptureJob`, invoked **inside the held durable lock**
  (INV-L). Absent → the M9 `candidates ?? []` path is unchanged (empty-safe default).

**No change** to: frozen contracts (`types/evidence/*`, store interfaces, identity/hash/revision
formulas, archive formats), M6 capture / M8 settlement internals, the Stage-1/Stage-2A provider
logic, cron routes, schedulers, feature-flag defaults, config, environment, or deployment.

## 3. Architecture

- **`createFileCaptureReadPort(env?)`** implements the Stage-2A `CaptureArchiveReadPort` over the
  real NDJSON adapters using the two new exported strict whole-archive readers — a **single
  bounded read per store** (PB-1). It is fail-closed: a corrupt/unreadable archive throws.
- **`produceCaptureRequests(deps, config)`** reads the source (`loadPublishedDailyPredictions`
  by default) and the archive state (`buildCaptureArchiveState`) concurrently, then runs the
  pure Stage-1 `buildCaptureCandidates` to classify → order → cap → assemble the frozen
  `CaptureRequest[]` through the injected derivation. It returns the provider result verbatim.
- **Runner seam (INV-L).** The producer is composed by the caller and passed as
  `provideCandidates`; `runEvidenceCaptureJob` calls it **after acquiring the durable lock**, so
  discovery happens under the lock. A rejecting producer (e.g. a strict-read throw) makes the
  run report `failed` — never an empty success.
- **The derivation seam** (`deriveCaptureInput`) is a required injected dependency. Wiring the
  live async M4→M5 implementation behind it (which also needs an async provider variant) is a
  separate stage; until then a caller supplying no real derivation simply yields no candidates,
  and the untouched cron route continues its M9 empty-safe pass.

## 4. Invariants honoured

- **INV-L (discovery inside the lock):** the producer runs inside `runWithLock`, never before it.
- **PB-1 (single bounded read per store):** each store is read once per pass via the new
  whole-archive strict readers; no per-fixture rescan.
- **Strict / fail-closed (SC-1 / AR-0):** the concrete port reuses the adapters' fail-closed
  reads (ENOENT ⇒ empty; malformed/IO/conflict ⇒ throw); `produceCaptureRequests` and the runner
  never mask a throw as empty — a corrupt archive surfaces as `failed`.
- **INV-A (archive is the sole checkpoint):** no cursor/offset/cache introduced; progress is the
  archive state built each pass.
- **Determinism / default-off preserved:** no clock/random added in the wiring; the M9
  empty-safe default and the flag-off short-circuit (before the lock) are unchanged.
- **Frozen contracts untouched:** only additive exported readers + an additive optional runner
  parameter; no format, identity, or interface change.

## 5. Tests

`tests/evidenceCapturePipeline.test.ts` — **9 unit tests** (fake source, fake strict read port,
stub derivation, memory stores):
- **Producer:** empty archive → 1 `CaptureRequest` (admitted, correct `capturedAt`); complete
  pair in archive → `already_captured`, 0 candidates; snapshot-only → partial-pair healing
  candidate; `leadMinutes` default; strict-read throw propagates (fail-closed, never empty).
- **Runner seam:** `provideCandidates` invoked once and threaded to `runCaptureBatch`; static
  `candidates` path still works (M9 backward-compat); a rejecting producer → run `failed` (not an
  empty success); disabled flag short-circuits before discovery (producer never called).

## 6. Validation

| Check | Command | Result |
|---|---|---|
| New Stage-2B tests | `... --test tests/evidenceCapturePipeline.test.ts` | **9 pass / 0 fail** |
| Full suite | `npm test` | **1769 pass / 0 fail / 0 skip** (was 1760; +9) |
| Typecheck | `npm run typecheck` | **clean (exit 0)** |
| Lint | `npm run lint` | **clean — no ESLint warnings or errors** |

## 7. Activation status — explicit

The cron route is **unchanged** and still runs the M9 empty-safe pass; no feature flag, scheduler,
or deployment was changed. The capture pipeline is reusable, injectable, and tested, but is not
firing live candidates in production because the injected async M4→M5 derivation is a later stage.
Settlement wiring, INV-D deadline enforcement, producer diagnostics/metrics, replay, and
multi-worker concurrency are all out of this stage. **M10 is NOT complete.**
