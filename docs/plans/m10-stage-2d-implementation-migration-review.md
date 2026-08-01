# M10 Stage 2D — Implementation Migration & Frozen-Contract Review (Operational Controls)

**Document type:** Review only. No runtime code, test, contract, flag, cron, schema, environment, archive, or deployment changed. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Migration / frozen-contract / forward-compatibility (schema, adapters, configuration, rollback, future Postgres).
**Subject:** M10 **Stage 2D — Operational Controls** — **BUILT**, dormant (routes unchanged, flags off, producer not route-composed).
**Governing:**
`docs/plans/m10-stage-2d-operational-controls-implementation.md` (impl record),
`docs/plans/m10-stage-2d-operational-controls-plan.md` + the five prep reviews,
`docs/plans/m10-stage-2d-migration-review.md` (the forward review this confirms — verdict COMPATIBLE),
`docs/plans/m10-stage-2c-implementation-migration-review.md` (CS-1…CS-4), the M8/M9 records, the frozen `types/evidence/*`.
**Method:** the exact Stage 2D diff was read from source (file:line), the modified-file set confirmed by mtime, and targeted + frozen-contract + regression tests, typecheck, and lint re-run this pass.

---

## 1. Executive Summary

**Verdict: COMPATIBLE.**

Stage 2D implements the D-1…D-10 Operational Controls (INV-D deadline + between-candidate guard, ceiling wiring, diagnostics aggregation, typed failure codes, backlog/oldest-pending observability, dormant completed-rows loader) exactly to plan. The diff is **eleven files** (3 created, 8 modified additively), mtime-confirmed as the only files touched in the build window (2026-07-30 18:00–18:59). **Every frozen schema, both M6/M8 cores, and both cron routes predate the build and are byte-unchanged.**

- **Schema change required: NO.** `types/evidence/validation.ts` and `types/evidence/snapshot.ts` are untouched (Jul 28). No record gains a field; no archive NDJSON format changes.
- **Migration required: NO.** Nothing Stage 2D produces is persisted to a durable archive; the only growable surfaces (`CandidateDiagnostics` fields, `resultCounts` keys, `errorCode` strings, metric labels) are **ephemeral, in-memory, open structures**.
- **Additive design: CONFIRMED.** Every change is an optional parameter, a new module, or a new field on an ephemeral diagnostics/counts type. The frozen `captureEvidenceSnapshot`/`settleSnapshot`/`ensureMandatoryCaptureOdds` writers are untouched.
- **Dormant activation: CONFIRMED.** Both cron routes remain bare M9 delegates; the deadline engages only on a producer path; the completed-rows loader is built-but-not-wired.
- **Rollback safe: YES.** Drop the optional params / delete the two new modules + 4 additive diagnostics fields — no schema, no migration, no persisted state.

Validation re-run this pass: targeted Stage-2D + frozen-contract + regression **199/199**, typecheck **exit 0**, lint **clean**.

The verdict is unconditional on the migration axis. The residuals the impl record lists (hung-loader 60 s bound, provisional reserve constants, uninterruptible in-flight scan, `run_degraded` alert routing, process-local diagnostics) are **Stage-2E operational/performance gates, not migration or contract concerns**.

---

## 2. Frozen Contract Audit

**Exact modified-file set (mtime-confirmed; the only files newer than 2026-07-30T18:00 under `lib`/`tests`/`types`/`app`):**

| File | Change | Nature |
|---|---|---|
| `candidates/operational.ts` | **created** | pure helpers: deadline/ceiling/diagnostics/failure-code/metrics |
| `candidates/completed-rows.ts` | **created** | dormant loader (`filterCompletedRows` + `createCompletedRowLoader`) |
| `tests/evidenceOperationalControls.test.ts` | **created** | 29 tests (fake clock) |
| `candidates/types.ts` | **modified** | **4 additive** `CandidateDiagnostics` fields |
| `candidates/diagnostics.ts` | **modified** | seed the 4 new fields to 0 |
| `candidates/capture-provider.ts` | **modified** | RC-1 counters + surface `effectiveCeiling` |
| `candidates/settlement-provider.ts` | **modified** | surface `effectiveCeiling` |
| `jobs/capture-run.ts` | **modified** | additive optional `deadline?` guard + `deferredByDeadline` count |
| `jobs/settlement-run.ts` | **modified** | symmetric |
| `jobs/runner.ts` | **modified** | `provideCandidateBatch?` seam + injected `now?` + merge helpers |
| `config.ts` | **modified** | additive `resolveEvidenceOperationalConfig` + provisional constants |

**Frozen surfaces — verified byte-unchanged (mtime predates the 18:00–18:59 build):**

| Frozen artefact | mtime | Status |
|---|---|---|
| `types/evidence/validation.ts` (`ValidationRecord`, all fields incl. `validationId`/`revisionId`/`revision`/`settledAt`/`contentHash`) | 2026-07-28 | **unchanged** |
| `types/evidence/snapshot.ts` (`EvidenceSnapshot`) | 2026-07-28 | **unchanged** |
| `settlement.ts` / `outcomes.ts` (M8 core, correction path) | 2026-07-29 | **unchanged** |
| `capture/capture.ts` / `capture/mandatory-odds.ts` (M6 core) | 2026-07-29 | **unchanged** |
| both cron routes | 2026-07-29 | **unchanged** — dormancy |
| `SettlementCandidate` type | `settlement-run.ts:48-57` | **unchanged** — `{fixtureId,row,completionInstant,nowSec,correctionCause?,recordedBy?}`; `deadline` lives on the separate additive `SettlementBatchOptions` |

**No `EvidenceArchiveStore`/`OddsArchiveStore` interface widening; no hidden public contract.** The one interface-shaped change (`deadline?` on the batch options, `provideCandidateBatch?` on the runner options) extends **M9 orchestration code, not a frozen contract**, and is additive-optional.

**Conclusion:** zero frozen-schema/contract change. Audit clean.

---

## 3. ValidationRecord / Evidence Schema / Archive

- **ValidationRecord & EvidenceSnapshot untouched.** Stage 2D never assembles or writes a `ValidationRecord`/`EvidenceSnapshot`; M8/M6 remain the sole writers. `settledAt`/`recordedAt`/`contentHash`/`validationId`/`revisionId`/`revision` semantics are unchanged. Corrections stay out (`correctionCause`/`currentValidationHeads` untouched; a static-guard test asserts `operational.ts`/`completed-rows.ts` reference neither).
- **Archive NDJSON format unchanged.** Stage 2D adds no reader/writer to the evidence/odds/validation archives; the deadline guard sits *between candidates* and the completed-rows loader reads the *daily source* archive, never the evidence archive.
- **The diagnostics surface is ephemeral, not durable — the decisive migration property.** The 4 new fields (`candidatesDeferredByDeadline`, `sourceRowsAdmitted`, `groupedFixtures`, `effectiveCeiling`, `types.ts:136-150`) are on `CandidateDiagnostics` — a producer-return type, never serialized to an archive. They flow into `RefreshJobRecord.resultCounts?: Record<string,number>` — an **open map held only in the bounded in-memory `listRecentJobs` ring buffer** (reset on restart, never written to a DB/file). So D-5/D-6/D-7/D-8 impose **no schema, no migration, no versioning obligation**; a restart simply clears them.

---

## 4. M8 & M9 Contracts

**M8 — unchanged and still authoritative.** The settlement deadline guard is **strictly between candidates**: `settlement-run.ts:150-154` runs `if (deadline && !shouldStartNext(remainingMs(), reservePerCandidateMs)) { counts.deferredByDeadline += candidates.length - i; break; }` at the *top* of the loop, *before* `settleLatestSnapshotForFixture` (`:180`) — an in-flight settle append always completes; only the *next* candidate is prevented (INV-D defer-not-overrun). A deferred candidate is re-derived next fire from the immutable archive (INV-A, no cursor). Corrections remain out, so the Stage-2C first-settlement firewall is intact. `SettlementBatchCounts` gained an additive `deferredByDeadline` counter (ephemeral).

**M9 — additive/backward-compatible.** The runner adds `provideCandidateBatch?` (rich `{candidates, diagnostics}`) alongside the unchanged `provideCandidates?` (Stage 2B array) and an injected `now?: () => number`; absent → today's behaviour. INV-D `producerDeadlineBudget` engages **only on a producer path** (`runner.ts:378,401`), so the bare cron fire and the M9 static-candidates path are byte-for-byte unchanged (regression green). `resultCounts` stays `Record<string,number>`; `mergeProducerResultCounts` adds a `run_degraded: 0|1` key (additive, ephemeral) and never flips `hardFailed`/HTTP status — the frozen no-false-write behaviour is preserved. Typed producer `errorCode` falls back to `"unhandled"` for non-`ProducerError` (back-compat); the route `failed→500` mapping is unchanged. Best-effort diagnostics: a merge/emit throw falls back to batch counts, never fails the job.

---

## 5. Configuration

**Additive with safe defaults; no existing default changed.** `DEFAULT_CAPTURE_MAX_FIXTURES=500` (`config.ts:40`) and `DEFAULT_RUN_DEADLINE_MS=300_000` are untouched, with an explicit code comment that the legacy 500 "is deliberately NOT wired here" (`config.ts:117`). New additive constants — `DEFAULT_JOB_RESERVED_HEADROOM_MS=15_000`, capture/settlement per-candidate reserves (250/120 ms, provisional) — and a new `resolveEvidenceOperationalConfig` reader for `EVIDENCE_JOB_RESERVED_HEADROOM_MS`/per-candidate-reserve env vars, each fail-safe to the bounded default. The effective deadline `clamp(min(configured, min(60000−15000, 45000)), …)` guarantees the 300 s default clamps to ≤ 45 s and is never honoured on the web-cron path (INV-D); the effective ceiling `normalizeBatchLimit ⇒ [1,150]` default 100 guarantees 500 → 150 (INV-C). No configuration is persisted as durable state → no config migration exists.

---

## 6. Adapters & Future Postgres

**Compatible — adapter-neutral and Postgres-favourable.** Stage 2D's controls operate on candidate *counts* and *elapsed time*, not on any storage detail; they are identical under the file adapter and a future Postgres adapter. Diagnostics/metrics are computed from provider `CandidateDiagnostics` + batch counts — engine-independent. The completed-rows loader reads the daily source over an **injected** whole-source reader (`createCompletedRowLoader`), orthogonal to the evidence store adapter; the concrete production reader is a deliberately-unfabricated activation dependency.

- **Carried, not introduced by 2D:** the capture/settlement read ports still bypass the `EVIDENCE_ARCHIVE_ADAPTER` choke-point (Stage-2C **CS-4** / Stage-2B **SC-1**). Stage 2D does not worsen this; the shared read-port resolver should land with/before the Postgres adapter. The deadline clamp actively *helps* the eventual cutover by keeping runs inside budget while the file adapter's O(F²) scan is still in play.
- **Append-only preserved.** Stage 2D adds no update path; a future file→Postgres import maps no new field.

---

## 7. Rollback & Reversibility

**Rollback safe: YES (HIGH).**

- **Dormant / default-off.** A scope test asserts both routes wire no `provideCandidate*`, no `produce*Requests`, and no `createCompletedRowLoader`; no flag default changed; the loader is built-but-not-wired. The bare fire and the M9 static path are byte-for-byte unchanged.
- **Additive, reversible.** Reverting is deleting the two new modules + the 4 additive diagnostics fields + the optional params. No persisted state, no cursor (INV-A) — a deadline/cap-deferred candidate carries no durable mark and is re-derived next fire.
- **Fail-closed & bounded even if accidentally engaged.** Whole-source loader failure → `ProducerError("source_load_failed")` → run `failed`, never a silent empty success; per-row faults are dropped+counted; between-candidate deferral cannot tear an evidence/validation write; the append-only archive + first-settle-only firewall guarantee no false or partial record.

---

## 8. Blocking Findings

**None.** No schema change, no migration, no frozen-contract change, no `ValidationRecord`/M6/M8/route change; the design is additive, dormant, reversible, and fail-closed.

---

## 9. Verdict

**COMPATIBLE.**

M10 Stage 2D — Operational Controls — is an eleven-file, purely additive, dormant producer/runner/config/observability layer that changes **no** frozen schema, **no** archive format, **no** `ValidationRecord`/`EvidenceSnapshot`, **no** M8/M6 core, and **no** cron route; requires **no** migration or backfill; and is fully reversible while the routes stay dormant. Its only growable output surfaces (`CandidateDiagnostics` fields, `resultCounts` keys, `errorCode`, metrics) are ephemeral in-memory open structures with no persistence and therefore no migration or versioning obligation. The INV-D deadline guard is verified between-candidate (never mid-append), the INV-C ceiling clamps 500→150, and both M8 authority and the first-settlement firewall are preserved. Adapter-neutral and Postgres-favourable; corrections and the Stage-2E activation/benchmark gates remain correctly out of scope.

- **Schema change required: NO**
- **Migration required: NO**
- **Additive design: YES**
- **Dormant activation: YES**
- **Rollback safe: YES**

Validation re-run green: 199/199 targeted (Stage-2D + frozen-contract + regression), typecheck exit 0, lint clean.

---

## 10. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract, archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified in producing this review. All cited `file:line` anchors — the eleven-file modified set (mtime-confirmed), the untouched frozen `types/evidence/*` + M6/M8 cores + routes, the between-candidate deadline guard (`settlement-run.ts:150-154`), the open-map `resultCounts`, and the unchanged `config.ts` defaults — were read/executed against the current repository so an implementer can verify them.
