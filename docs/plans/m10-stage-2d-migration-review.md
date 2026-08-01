# M10 Stage 2D — Migration & Frozen-Contract Review (Operational Controls)

**Document type:** Review only (forward, pre-implementation). Stage 2D is **UNBUILT** — no deadline helper, mid-batch guard, diagnostics aggregation, specific failure codes, ceiling call-site wiring, or live completed-rows loader exists yet. No runtime code, test, contract, flag, cron, schema, environment, archive, or deployment changed. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Migration / frozen-contract / forward-compatibility (future Postgres, archive, configuration, rollback).
**Subject:** M10 **Stage 2D — Operational Controls** (the D-1…D-10 carry-forward that gates a *useful* live run across both capture and settlement paths).
**Governing:**
`docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1, INV-A/C/D/L/S, §9 perf, §10 observability),
`docs/plans/m10-stage-2c-closure.md` §9 (the D-1…D-10 scope) + §10 (Stage 2E boundary) + §11/§12 (corrections / future adapter),
`docs/plans/m10-stage-2c-implementation-migration-review.md` (CS-1…CS-4),
`docs/plans/m10-stage-2b-migration-compatibility-review.md` (SC-1/SC-2), `docs/plans/m10-stage-2-migration-compatibility-review.md` (MC-1…MC-5),
the M7 identity, M8 settlement, and M9 activation records, the frozen `types/evidence/*` + store interfaces.
**Method:** the exact surfaces Stage 2D will touch (runner options, batch orchestrators, config, `RefreshJobRecord`/diagnostics, the daily-archive source) were read from source (file:line). No file modified.

---

## 1. Executive Summary

**Verdict: COMPATIBLE.**

Stage 2D is the **operational-controls** layer: the INV-D effective deadline (≤ 45 s) + mid-batch remaining-time guard (D-1/D-2), call-site ceiling wiring (default 100 / hard 150, already provider-fail-safe — D-3/D-4), producer-diagnostics aggregation + specific failure codes (D-5/D-6), backlog / oldest-pending observability (D-7/D-8), and the live completed-rows source loader with fault isolation (D-9/D-10). **Every one of these lives in the producer / runner / config / observability layer and writes nothing to any durable archive.**

On the migration/contract axis this is the cleanest slice in the series:

- **Schema change required: NO.** Stage 2D touches no `types/evidence/*` record, no store interface, no archive file format. It appends no evidence, no odds, no validation.
- **Migration required: NO.** No backfill; nothing persisted gains a field. The only "output shapes" it grows — `resultCounts` counts, `errorCode` strings, metric labels — are **ephemeral, in-memory, open maps** (§4), never durable state.
- **Rollback safe: YES.** All of D-1…D-10 is additive optional wiring behind default-off flags and injected seams; reverting is deleting additive parameters/helpers. Nothing to un-migrate; the M9 empty-safe pass is the fallback.

Stage 2D does **not** touch `ValidationRecord`, `EvidenceSnapshot`, `OddsArchiveRecord`, `captureId`/`evidenceSnapshotId`/`validationId`/`revisionId`/`contentHash`/`inputContentHash`/`modelVersion`/`evidenceInputVersion`, the M8 settlement/correction contract, or the M4/M5 derivation math. It is a decision/observability layer over the already-frozen writers.

The verdict is unconditional on the migration axis. Four **forward conditions** (D-CS-1…D-CS-4, §10) are carried for the *correctness/observability* reviewers (determinism of the deadline clock; no-cursor for deadline-deferred candidates; low-cardinality diagnostics; source-loader fault isolation) — none is a schema, contract, or migration change, and none blocks a dormant merge.

---

## 2. Frozen Contract Audit

**Surfaces Stage 2D is expected to touch (all producer/runner/config/observability — verified as the additive seams they will extend):**

| D-item | Planned surface | Layer | Frozen-contract impact |
|---|---|---|---|
| D-1 effective deadline ≤ 45 s | new clamp helper `min(configured, ROUTE_BUDGET − HEADROOM)`; pass **clamped** value into the batch/M4 | producer/runner | none — a computed number, not a stored field |
| D-2 mid-batch remaining-time guard | additive optional `deadline?` param on `runCaptureBatch`/`runSettlementBatch` → `deferred_by_deadline` count | **M9 orchestrators** (`capture-run.ts:87`, `settlement-run.ts`) — **not** frozen M6/M8 | none — frozen `captureEvidenceSnapshot`/`settleSnapshot` untouched |
| D-3/D-4 ceilings 100/150 | wire the configured/clamped value at the call site; provider `normalizeBatchLimit` already fail-safe | config/producer | none — clamps at call site; does **not** edit `DEFAULT_CAPTURE_MAX_FIXTURES=500` |
| D-5 diagnostics aggregation | merge `CandidateDiagnostics` into `resultCounts` / metrics | `RefreshJobRecord.resultCounts` (open map) + metrics | none — open `Record<string,number>`, ephemeral (§4) |
| D-6 specific failure codes | replace generic `errorCode:"unhandled"` with classified codes | `RefreshJobRecord.errorCode` (open string) | none — ephemeral, non-persisted |
| D-7/D-8 backlog / oldest-pending | emit provider gauges | metrics/diagnostics | none |
| D-9 live completed-rows loader | thin filter over `readDailyArchive(date)` behind the injected `loadCompletedRows` seam | source read | none — reads the footystats daily archive; writes no evidence archive |
| D-10 source-loader isolation | map loader faults to defer/count, never uncaught mid-run | producer | none |

**Frozen surfaces — must stay byte-unchanged (Stage 2D reads/decides, never writes):**

| Frozen artefact | Anchor | Stage 2D interaction |
|---|---|---|
| `ValidationRecord` (all fields incl. `validationId`,`revisionId`,`revision`,`settledAt`,`contentHash`) | `types/evidence/validation.ts:48-71` | **untouched** — settlement writer is M8; 2D never assembles a record |
| `EvidenceSnapshot` / `OddsArchiveRecord` | `types/evidence/*` | untouched |
| `captureId`/`evidenceSnapshotId`/`inputContentHash`/`contentHash`/`modelVersion`/`evidenceInputVersion` | frozen identifiers | untouched — no identity/hash input; the deadline clock is a **decision** input only |
| M8 settlement + correction contract (`settleSnapshot`, `reviseValidationRecord`, `correctionCause`) | `settlement.ts` | untouched — corrections remain out (§11 correction stage) |
| M6 capture core (`captureEvidenceSnapshot`, `ensureMandatoryCaptureOdds`) | `capture/*` | untouched — deadline guard sits in the M9 orchestrator, not the frozen core |
| `EvidenceArchiveStore`/`OddsArchiveStore` interfaces | `store.ts` | **not widened** — 2D adds no store method |
| archive NDJSON format + directory resolution | `readNdjson`, `evidenceArchivePaths` | untouched — 2D adds no reader; D-9 reads the separate daily archive |
| append-only / immutable revisions | `validation.ts:6-12` | preserved — 2D appends nothing |

**No hidden public contract.** The one interface-shaped change (a `deadline?` option on the two batch orchestrators) extends **M9 code, not a frozen contract**, and is additive-optional; no `EvidenceArchiveStore`/`OddsArchiveStore` method is added.

---

## 3. Compatibility (Contracts · M8 · M9 · Configuration)

**M8 — unchanged.** Stage 2D never assembles or writes a `ValidationRecord`; M8 remains the authoritative writer. The deadline guard *defers* candidates (counted `deferred_by_deadline`) before M8 is called — it never interrupts a settle mid-record. A deferred candidate is re-derived next fire from the immutable archive (INV-A), so no partial/torn settlement can arise from the guard. Corrections stay out (§11), so `correctionCause` remains structurally absent (the Stage-2C first-settlement firewall is preserved).

**M9 — additive/backward-compatible.** The `deadline?` param on `runCaptureBatch`/`runSettlementBatch` is optional; absent → today's behaviour. The runner already threads `resultCounts` and calls `emitOutcomeMetrics`; D-5/D-6 enrich the *values*, not the runner contract. The lock/flag/route envelope (INV-L, flag-before-lock, empty-safe default) is untouched.

**Configuration — additive with safe defaults.** Stage 2D wires *clamped* values at the call site and does **not** edit the frozen defaults (`DEFAULT_CAPTURE_MAX_FIXTURES=500` at `config.ts:40`, `DEFAULT_RUN_DEADLINE_MS=300_000` at `config.ts:153`) — it must never let the raw 500/300 000 be the effective ceiling/deadline (INV-C/INV-D). Any new env knob (e.g. reserved-headroom ms) is additive with a fail-safe default; a zero/negative/malformed override must fail *safe to the bounded value*, exactly as `readPositiveInt` already does. No configuration is persisted as durable state, so no config migration exists.

**INV-D determinism note (forward, D-CS-1).** The effective deadline uses a wall-clock/elapsed read to decide *whether to start the next candidate*. That read is a **decision** input and must never enter any identity/hashed field — `capturedAt` stays kickoff-anchored and `completionInstant`/`settledAt` stay deterministic (Stage-2C CS-1). This preserves replay: the same archive re-derives the same records regardless of when the deadline fired.

---

## 4. Archive & Schema Compatibility

- **No archive-format change, no new record, no field.** Stage 2D writes nothing to the evidence/odds/validation archives. `readAllSnapshotsStrict`/`readAllValidationsStrict`/`readAllOddsRecordsStrict` and the strict `readNdjson` semantics are reused unchanged; D-9 reads the *daily* source archive (a separate subsystem), never the evidence archive.
- **The diagnostics/counts surface is ephemeral, not durable.** `RefreshJobRecord.resultCounts?: Record<string, number>` (`types.ts:27`) is an **open map**, and job records live only in a bounded **in-memory ring buffer** (`listRecentJobs`, `runner.ts:47`; the code explicitly notes "an unbounded log is a slow heap leak" — it is heap-resident, never written to a DB/file). Therefore D-5/D-6/D-7/D-8 add keys/codes to a non-persisted open structure → **no schema, no migration, no versioning obligation**, and a restart simply resets them (already the pattern). This is the decisive migration property of Stage 2D.
- **Bounded reads preserved (MC-5/PB-1).** Ceilings + deadline keep each run's archive reads bounded; Stage 2D tightens the bound (100/150, ≤ 45 s) and never loosens it. The O(F²) file-adapter cost stays gated until the Postgres cutover.

---

## 5. Migration Requirements

**Schema change required: NO. Migration/backfill required: NO.**

- No DDL, no new column, no index, no record-shape change, no data rewrite.
- Nothing Stage 2D produces is persisted to durable storage; the evidence/odds/validation archives are untouched.
- Historical archives read unchanged; a future offline file→Postgres import is unaffected (2D adds no field an importer must map). Append-only-safe retention (MC-4) is unaffected — 2D prunes nothing.

---

## 6. Future Postgres

**Compatible — Stage 2D is adapter-neutral and, if anything, Postgres-favourable.**

- The deadline/ceiling controls operate on candidate *counts* and *elapsed time*, not on any storage detail; they are identical under the file adapter and a future Postgres adapter.
- Diagnostics/metrics are computed from provider `CandidateDiagnostics` + batch counts — engine-independent.
- D-9's source loader reads the daily archive, orthogonal to the evidence store adapter.
- **Carried, not introduced by 2D:** the capture/settlement read ports still bypass the `EVIDENCE_ARCHIVE_ADAPTER` choke-point (Stage-2C **CS-4** / Stage-2B **SC-1**). Stage 2D does not worsen this; consolidating a shared `EVIDENCE_ARCHIVE_ADAPTER`-keyed read-port resolver should land with/before the Postgres adapter, not in 2D. The deadline clamp actually *helps* the eventual cutover by keeping runs inside budget while the file adapter's O(F²) scan is still in play.

---

## 7. Rollback & Reversibility

**Rollback safe: YES (HIGH).**

- **Dormant / default-off.** Both cron routes still run the M9 empty-safe pass; the settlement `loadCompletedRows` seam (D-9) has no live default, so nothing fires live until an activation stage composes it. Flags remain default-off.
- **Additive, reversible.** D-1…D-10 are optional parameters, injected seams, and open-map enrichments; reverting is deleting them. No persisted state, no cursor (INV-A) — a deadline-deferred candidate carries no durable mark and is simply re-derived next fire.
- **Append-only fallback safety.** Even if activated and then reverted, the archive holds only correct first settlements / captures; nothing 2D did requires a rewrite. Fail-closed semantics are preserved (a source-loader or read throw → `failed`, never a silent empty success).

---

## 8. Forward Compatibility

- **Determinism / replay (D-CS-1):** the deadline clock is decision-only; identity and hashed instants stay deterministic → the M7 serialization-boundary replay and M8 `no_change`-on-re-fire continue to hold over 2D-gated runs.
- **No-cursor (INV-A, D-CS-2):** deadline/cap deferrals persist no progress state; the immutable archive remains the sole checkpoint. Deferred = deterministically re-discoverable (INV-S), never lost.
- **Low-cardinality observability (D-CS-3):** D-5/D-7/D-8 must flatten to closed reason vocabularies and **never** use `fixtureId`/`captureId`/`validationId` as a metric label — a bounded-cardinality obligation, not a contract change.
- **Boundary respected:** Stage 2D does **not** unlock the Stage 2E activation/production gates (benchmarks, single-writer config, unlock-500 remediation, chain-verify sweep — §10) nor the later correction stage (§11); those remain prerequisites to a *live* activation.

---

## 9. Blocking Findings

**None.** Stage 2D introduces no schema change, no migration, no frozen-contract change, no `ValidationRecord`/M8/archive change. Its entire output surface is ephemeral and additive. There is no migration-or-contract blocker.

---

## 10. Conditions (forward, non-blocking; owned by correctness/observability reviewers)

Carried: **MC-1…MC-5**, **SC-1/SC-2**, **CS-1…CS-4** (all non-format-changing). Stage-2D-specific forward conditions (none is a schema/migration change):

- **D-CS-1 — Deadline clock is decision-only + deterministic completion instants.** The elapsed/wall-clock read used by the deadline guard must never enter identity or any hashed field; `completionInstant`/`settledAt` stay deterministic (freeze/version at activation — CS-1). Preserves replay.
- **D-CS-2 — No cursor for deadline/cap deferrals (INV-A).** A deferred candidate persists no progress state; it is re-derived from the immutable archive next fire.
- **D-CS-3 — Bounded-cardinality diagnostics.** Flatten `CandidateDiagnostics` to closed reason keys; no entity id as a metric label (D-5).
- **D-CS-4 — Source-loader fault isolation (D-10).** The live `loadCompletedRows` must not throw uncaught mid-run; map faults to defer/count/`failed`, never to a silent empty pass or a partial write.

---

## 11. Verdict

**COMPATIBLE.**

M10 Stage 2D — Operational Controls — is a producer / runner / config / observability layer that changes **no** frozen contract, **no** schema, **no** archive format, and **no** `ValidationRecord`/M8/M9-writer contract; requires **no** migration or backfill; and is fully reversible while the routes stay dormant. Its only growable output surfaces (`resultCounts`, `errorCode`, metrics) are ephemeral in-memory open maps with no persistence and therefore no migration or versioning obligation. The deadline/ceiling controls are decision-and-count logic that is adapter-neutral and Postgres-favourable; corrections and activation gates remain correctly out of scope (§11/Stage 2E). The four forward conditions (D-CS-1…D-CS-4) are correctness/observability gates owned by the safety and performance reviewers, not migration blockers.

- **Schema change required: NO**
- **Migration required: NO**
- **Rollback safe: YES**

Stage 2D preparation is migration-clear; implementation may proceed once its own architecture/safety/performance/test preparation reviews are reconciled (per the Stage-2C closure gate).

---

## 12. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract, archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified. Stage 2D remains **unbuilt**; this document assesses the migration/contract compatibility of its proposed D-1…D-10 surface. All cited `file:line` anchors (`RefreshJobRecord.resultCounts` open map + in-memory `listRecentJobs`, the batch orchestrator signatures, the frozen `config.ts` defaults, the frozen `types/evidence/*`) were read from the current repository so an implementer can verify them.
