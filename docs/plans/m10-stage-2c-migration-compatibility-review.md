# M10 Stage 2C — Migration, Frozen-Contract & Forward-Compatibility Review (Settlement Pipeline Wiring)

**Document type:** Review only (forward, pre-implementation). Stage 2C is **UNBUILT** (no settlement pipeline module, no settlement `provideCandidates` seam, no `readAllValidationsStrict` export exist yet). No runtime code, test, contract, flag, cron, schema, environment, archive, or deployment changed. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Migration / frozen-contract / forward-compatibility (future Postgres, correction/revision semantics, flags-off rollback, historical import).
**Subject:** M10 **Stage 2C — Settlement Pipeline Wiring** (the settlement counterpart to Stage 2B's capture wiring).
**Governing:**
`docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1),
`docs/plans/m10-stage-2-migration-compatibility-review.md` (MC-1…MC-5),
`docs/plans/m10-stage-2b-migration-compatibility-review.md` (SC-1/SC-2 + the proven 2B pattern),
`docs/plans/m10-stage-2a-archive-normalization.md` (settlement normalizer + `currentValidationHeads`),
the M7 identity/versioning records, the M8 settlement/correction records (implementation + migration reviews), the frozen `types/evidence/validation.ts`, and the Rev 2 contract.
**Method:** the frozen settlement contract, the Stage-2A settlement enrichment, the M8 correction path, and the exact shape of the (proposed) Stage-2C surface were read from source (file:line cited). The settlement substrate was re-run green this pass (107/107).

---

## 1. Executive Summary

**Verdict: STAGE 2C MIGRATION CONDITIONALLY COMPATIBLE.**

Stage 2C, by exact analogy to the already-approved Stage 2B capture wiring, is a purely **additive, dormant** producer that reads existing archive records and produces `SettlementCandidate[]` for the frozen M8 settlement path. On the migration/contract axis it introduces **no schema change and no data migration**, because every field settlement needs is already stored on the frozen `ValidationRecord` and every progress projection it needs is already exposed by Stage 2A.

- **No frozen contract changes.** `SettlementCandidate`, `ValidationRecord`, `EvidenceSnapshot`, `EvidenceArchiveStore`, `validationId`/`revisionId`/`revision`/`snapshotId`/`fixtureId`/`marketKey`/`selectionKey`/`state`/`settledAt`/`correctionCause`/`contentHash`, `inputContentHash`/`modelVersion`/`evidenceInputVersion`, the market registry, and archive directory resolution are all read-only to Stage 2C and stay byte-unchanged.
- **Existing `ValidationRecord` fields are sufficient** for current head, unchanged result, genuine correction, revision increment, and correction lineage (§3). No new column, no `isCurrent`/`supersededBy` flag (which the contract deliberately forbids), no backfill.
- **Stage 2A `currentValidationHeads` is sufficient** to detect a genuine correction (current-outcome-per-`(fixture,market)`); it is a pure projection of existing fields and is already built and green. The bare `settledFixtureIds` binary supports first-settle; corrections require consuming the enrichment (already present, presently ignored by the classifier).
- **Append-only + immutable historical revisions preserved.** Stage 2C appends nothing itself; M8 appends new revisions (never edits). First settlement stands; a correction is an additive revision with `supersedesRevisionId` lineage.
- **Reversible / rollback-safe** while the route is dormant (§7).

The verdict is *conditional* (not unconditional) on carrying forward the settlement-specific obligations that are genuinely load-bearing for correctness and future migration — the same class the M8 and Stage-2 reviews already mandate: **CS-1** determinism + freezing of the `completionInstant`/`settledAt` derivation at activation (it is hashed into `ValidationRecord.contentHash`); **CS-2** consume `currentValidationHeads` (not the coarse `settledFixtureIds` binary) if Stage 2C ships corrections, else explicitly meter + gate the deferral; **CS-3** add the settlement strict reader as a *module-level* export (never widen the store interface); **CS-4** the capture and settlement read ports SHOULD share one adapter resolver (the reinforced SC-1). None requires a schema change or a migration.

---

## 2. Frozen Contract Audit

Stage 2C's proposed surface (mirroring 2B, verified absent today):

| Proposed artefact | Analogue in 2B | Nature |
|---|---|---|
| `lib/.../candidates/settlement-pipeline.ts` (**new**) | `capture-pipeline.ts` | `createFileSettlementReadPort` + `produceSettlementCandidates` + deps/config; server-only |
| `readAllValidationsStrict(env?)` export in `lib/archive/evidence/file.ts` (**new**) | `readAllSnapshotsStrict` | **module-level** fail-closed whole-archive reader (PB-1) |
| `provideSettlementCandidates?` / `provideCandidates?` seam on `runPredictionSettlementJob` (**new**) | capture runner seam | additive **optional** option, invoked inside `runWithLock` (INV-L) |
| `tests/evidenceSettlementPipeline.test.ts` (**new**) | `evidenceCapturePipeline.test.ts` | unit tests |

**Verified present today (Stage 2C builds on, does not modify):**
- `SettlementArchiveReadPort = SnapshotReader & ValidationReader` requiring `readAllSnapshots()` + `readAllValidations()` (`archive-state/types.ts:43,50`) — the typed port already exists.
- `buildSettlementArchiveState(port)` (`archive-state/builders.ts:53-58`) — already built, single bounded read per store.
- `ValidationHead` + `SettlementArchiveState.currentValidationHeads?` (`candidates/types.ts:166-197`) — the MC-1 enrichment, already built.
- `readAllSnapshotsStrict` (Stage 2B, `evidence/file.ts:147`) — reusable by the settlement port for the snapshot half.

**Frozen surfaces — read-only to Stage 2C, unchanged:**

| Frozen artefact | Anchor | Stage 2C interaction |
|---|---|---|
| `ValidationRecord` (`id`,`revisionId`,`revision`,`supersedesRevisionId`,`snapshotId`,`fixtureId`,`marketKey`,`selectionKey`,`state`,`reasonCode`,`note`,`recordedAt`,`settledAt`,`recordedBy`,`schemaVersion`,`contentHash`) | `types/evidence/validation.ts:48-71` | **read only** (via the strict validations reader); never written by Stage 2C |
| `SettlementCandidate` (`fixtureId`,`row`,`completionInstant`,`nowSec`,`correctionCause?`,`recordedBy?`) | `settlement-run.ts:34-42` | **produced** field-for-field; no field added; no result/outcome field |
| `EvidenceSnapshot` | `types/evidence/snapshot.ts` | read only (for `capturedFixtureIds`) |
| `EvidenceArchiveStore` | `archive/evidence/store.ts` | **not widened** — the strict validations reader is module-level (CS-3) |
| `validationId`/`revisionId`/`revision`/`snapshotId`/`fixtureId`/`marketKey`/`selectionKey`/`state`/`settledAt`/`correctionCause`/`contentHash` | frozen | identity/hash formulas untouched; M8 owns the revision math |
| `inputContentHash`/`modelVersion`/`evidenceInputVersion` | M7 | **not touched** — settlement neither mints snapshots nor re-hashes inputs; it settles existing snapshots |
| market registry | — | read-only |
| archive directory resolution | `resolveEvidenceArchiveDir` | reused, not modified (see CS-4) |
| append-only / immutable revisions | `validation.ts:6-12` | preserved — M8 appends revisions, never edits |

**No interface widening, no hidden public contract** — provided CS-3 is honored (keep `readAllValidationsStrict` a module-level function, exactly as 2B kept `readAllSnapshotsStrict`/`readAllOddsRecordsStrict` out of the store interface). A `readAll*` method added to `EvidenceArchiveStore` *would* be an accidental public contract every adapter (incl. Postgres) must implement — avoid it.

**Conclusion:** zero frozen-contract change on the proposed surface. Audit clean, subject to CS-3.

---

## 3. Correction and Revision Compatibility

The M8 correction contract (`settlement.ts:288-323`) is:
- **Unchanged result:** `head.state === outcome.state` → `no_change`, **no append**.
- **Genuine correction:** `head.state !== outcome.state` → requires an explicit typed `correctionCause` (else `invalid_input`, no write) → `reviseValidationRecord(head, …)` produces the next revision.
- **First settlement:** no head → new revision-1 record.
- **Append idempotent** on `revisionId`+`contentHash`; `immutable_violation` stays loud.

**Are existing `ValidationRecord` fields sufficient? YES — for all five:**

| Need | Sufficient from existing fields? | How |
|---|---|---|
| **Current validation head** | **YES** | "Current" = `MAX(revision)` per `id` (`validationId`) — derived at read time from `ValidationRecord.{id,revision}`; there is deliberately no stored `isCurrent` (`validation.ts:11`). Stage 2A already computes this into `ValidationHead`. |
| **Unchanged result** | **YES** | Compare head `state` to the derived outcome `state`. M8 does this authoritatively; the producer can pre-filter via `currentValidationHeads[fixtureId][].state`. |
| **Genuine correction** | **YES** | `head.state !== outcome.state` on the current-outcome-per-`(fixture,market)`. `ValidationHead` carries `marketKey`/`selectionKey`/`state` — exactly the per-market granularity required. |
| **Revision increment** | **YES** | `reviseValidationRecord` computes `revision = head.revision + 1` from the head record M8 re-reads; `ValidationHead.revision` (1-based) confirms the base at discovery time. No producer input needed beyond `correctionCause`. |
| **Correction lineage** | **YES** | `supersedesRevisionId` chain + `reasonCode` (`data_correction`/`settlement_correction`) + `note` — all existing frozen fields, all M8-computed from the head. |

**Critical safe-design point (no TOCTOU):** the `SettlementCandidate` does **not** carry the head; M8's `settleLatestSnapshotForFixture` re-reads the authoritative head from the durable store **under the lock** at settle time. The producer's `currentValidationHeads` is a *discovery-time decision hint* only — used to decide whether to emit a candidate and whether to set `correctionCause`. If the head changed between discovery and settle, M8's authoritative idempotent check governs: a stale "correction" candidate becomes `no_change`; a correction that appears after discovery is re-derived next fire (INV-A). So the discovery/settle head split is safe by idempotency, and the archive-derived head can never force a wrong revision.

**Is Stage 2A `currentValidationHeads` sufficient? YES.** It projects `id`,`revision`,`revisionId`,`snapshotId`,`marketKey`,`selectionKey`,`state` — a complete correction-decision basis with **no new archive field** (MC-1). It is already built and green (`evidenceArchiveStateBuilders.test.ts`). The one gap is *consumption*: the Stage-1 settlement provider's `archiveStateOk` currently validates only `capturedFixtureIds`/`settledFixtureIds` (`settlement-provider.ts:46-51,102-103`) and ignores `currentValidationHeads`. So:
- **First-settle-only Stage 2C** (the Stage-2 minimum) uses `settledFixtureIds` → never sets `correctionCause` → M8 never sees a change → correct and idempotent; corrections are a **documented, metered completeness gap**, not data loss (BF-S1 first-settlement is preserved).
- **Correction-capable Stage 2C** consumes `currentValidationHeads` — additive provider logic, **no schema change** (CS-2).

**Conclusion:** correction and revision semantics are fully expressible from existing fields; Stage 2A already supplies the sufficient enrichment.

---

## 4. Archive Format Compatibility

- **No format change.** Stage 2C reads via `readAllSnapshotsStrict` (existing) + a new `readAllValidationsStrict` that must reuse the frozen `readNdjson` fail-closed semantics (ENOENT ⇒ empty; malformed line / `EACCES`/`EPERM` / `EIO`/`EBUSY`/`ENXIO`/`ENODEV` / any other errno ⇒ **throw**; never masked as empty). This is exactly the 2B snapshot-reader pattern.
- **Single bounded read per store (PB-1 / MC-5).** `buildSettlementArchiveState` reads snapshots + validations once each per pass and reduces in memory — no per-fixture `listValidations` rescan, no O(F²) amplification. The settlement scan cost (`(1+2T)` per settle on the file adapter, M8 perf review) is bounded by the ≤150 ceiling until the Postgres cutover.
- **Directory resolution unchanged.** The settlement port derives snapshot + validations paths from `evidenceArchivePaths(env)` (both live directly under the evidence dir — `snapshots.ndjson`/`validations.ndjson`, `file.ts:67-68`), so — unlike the odds file (2B SC-2) — there is **no separate subdir recompute**; the settlement port is simpler and less path-coupled than the capture port.
- **Append-only preserved.** Stage 2C writes nothing; M8 appends revisions.

**Conclusion:** archive format and directory resolution fully compatible; historical NDJSON reads unchanged.

---

## 5. Migration and Backfill Requirements

**Schema change required: NO. Migration/backfill required: NO.**

- No archive-format evolution, no new field on any record, no `isCurrent`/`supersededBy` (contract-forbidden), no DDL, no index, no data rewrite.
- Every settlement progress projection (current head, per-market outcome, revision, lineage) is a **read-time derivation** of fields the `ValidationRecord` already stores. This is the same finding the Stage-2 migration review reached (MC-1): "no archive-format evolution is required for M10."
- Historical archives (any age, any accumulated revision depth) read unchanged; a genuinely-terminal fixture settled long ago reads back as `settledFixtureIds` + a current head — no reprocessing.
- **Historical import safe.** The typed validations reader asserts integrity fail-closed and returns domain records; a future offline file→Postgres import reproduces identical `contentHash` engine-independently (M8 migration review G5 hash-faithful TEXT timestamps). Stage 2C bakes in no line/offset/file-layout assumption an importer must replicate. Append-only-safe retention (MC-4) is unaffected — Stage 2C prunes nothing and must not assume pruning.

---

## 6. Future Postgres Compatibility

**Compatible — same typed-port design as 2B, reinforced by a second consumer of `readAllSnapshots`.**

- **Format-neutral port.** `SettlementArchiveReadPort = { readAllSnapshots(): Promise<readonly EvidenceSnapshot[]>; readAllValidations(): Promise<readonly ValidationRecord[]> }` (`types.ts:43-50`) — typed domain objects, no NDJSON/line/offset in the signature. **No file-specific logic leaks into provider logic**; the NDJSON-ness is fully encapsulated in `createFileSettlementReadPort`. A future `createPostgresSettlementReadPort` implements the same two methods with indexed `SELECT`s (current head = `DISTINCT ON (id) … ORDER BY revision DESC`, M8 migration review) — O(log A) vs O(A) — with **no contract change** to the port, the provider, or the pipeline. `readPort` is injectable (as in 2B), so the cutover supplies its port by injection.
- **Append-only / no update path preserved** — the single most important Postgres-forward property; corrections are new rows (`ON CONFLICT(revision_id) DO NOTHING`), never updates. Stage 2C adds no update path.
- **CS-4 (reinforced SC-1): capture and settlement read ports SHOULD share one adapter resolver.** Both ports need `readAllSnapshots`; settlement adds `readAllValidations`; capture adds `readAllOddsRecords`. Today the concrete `createFile*ReadPort` factories are file-specific and do **not** consult `EVIDENCE_ARCHIVE_ADAPTER` (the choke-point the write stores honor — 2B SC-1). With two consumers of the snapshot read, the risk of read/write divergence at the Postgres (or `memory`) cutover doubles. **Recommend a single `getEvidenceReadPort()` (or `getCapture/getSettlementReadPort()`) resolver keyed on the same `EVIDENCE_ARCHIVE_ADAPTER`**, so capture, settlement, and the write path can never read different stores. Non-blocking now (production is file-only and dormant; and M8's authoritative under-lock head re-read backstops correctness even under a read/write mismatch — a divergent discovery head only wastes a pass, never forges a revision), but this should land with (or before) the Postgres adapter.

**Conclusion:** Postgres-transparent; the future adapter implements the same typed port. CS-4 is the wiring discipline to consolidate the two read ports.

---

## 7. Rollback and Reversibility

- **Flags-off rollback safe.** `runPredictionSettlementJob` short-circuits on `isSettlementEnabled` before the lock; with the settlement flag off (default) the producer is never reached. The cron route stays the M9 empty-safe pass.
- **Reversible while route dormant.** As in 2B, no production route need compose `produceSettlementCandidates` until the live-derivation stage; the producer is dormant, injectable, tested. Reverting Stage 2C is deleting additive functions + one optional runner parameter — **nothing to un-migrate** (writes nothing, changes no format).
- **Append-only makes even an accidental fire safe.** If settlement did run: a first settlement is correct and stands; a re-fire is `no_change` (idempotent); a correction is an additive revision with lineage — historical revisions remain immutable. No rewrite, no destructive path.
- **Fail-closed.** A strict validations-read throw → run `failed`, never a silent empty success (which could mis-classify a settled fixture as pending and attempt a spurious settle — though M8's head re-read would catch it).

**Rollback safety: HIGH.**

---

## 8. Blocking Findings

**None.** No schema change, no migration, no frozen-contract change; existing `ValidationRecord` fields and Stage 2A `currentValidationHeads` are sufficient; the design is dormant, reversible, and fail-closed. There is no migration-or-contract blocker to Stage 2C.

---

## 9. Conditions

Carried (inherited, non-format-changing): **MC-1…MC-5** (Stage-2 migration), **SC-1/SC-2** (Stage-2B). New/settlement-specific:

- **CS-1 — Freeze & version the `completionInstant`/`settledAt` derivation at activation (MC-3 corollary).** `completionInstant`→`settledAt`/`recordedAt` are hashed into `ValidationRecord.contentHash` but excluded from identity (`validationId`/`revisionId`). The producer MUST derive them deterministically (kickoff-anchored, no wall-clock/`fetchedAt`) so a replay of an already-settled record re-derives the same `contentHash`. If the derivation changes across code versions, replay diverges (a replay mismatch, not a stored rewrite). Freeze it once settlement is activated. (M8 migration review; Stage-2 §12.)
- **CS-2 — Corrections: consume `currentValidationHeads`, or explicitly meter + gate the deferral.** First-settle-only is fail-safe but leaves later corrections unpropagated (a terminal fixture reinterpreted/abandoned after first settlement keeps a stale head). Ship correction support from the (already-built) enrichment in the same increment, or explicitly scope + meter it and **block go-live on unresolved corrections**. No schema change either way.
- **CS-3 — Keep the settlement strict reader module-level.** `readAllValidationsStrict` MUST be a module-level export mirroring `readAllSnapshotsStrict`; do **not** add `readAll*` to `EvidenceArchiveStore` (would be an accidental public contract on every adapter, incl. Postgres).
- **CS-4 — Share one adapter resolver across capture + settlement read ports (reinforced SC-1).** Both consume `readAllSnapshots`; route them through a single `EVIDENCE_ARCHIVE_ADAPTER`-keyed resolver so discovery and write cannot diverge at the Postgres/memory cutover. Land with/before the Postgres adapter.

---

## 10. Verdict

**STAGE 2C MIGRATION CONDITIONALLY COMPATIBLE.**

The proposed settlement wiring is a purely additive, dormant, reversible producer that changes **no** frozen contract, requires **no** schema change and **no** migration/backfill, and preserves append-only + immutable historical revisions. Existing `ValidationRecord` fields are sufficient for current head, unchanged result, genuine correction, revision increment, and correction lineage; Stage 2A's `currentValidationHeads` is the sufficient (already-built, no-new-field) correction-detection basis. The typed `SettlementArchiveReadPort` is format-neutral, so a future Postgres adapter implements it without any contract change, and no file-specific logic leaks into provider logic. The verdict is *conditional* solely on the settlement-specific correctness/forward obligations CS-1…CS-4 (determinism/freeze of the hashed completion instant; corrections consumed-or-gated; module-level reader; shared adapter resolver) — none of which is a schema change or a migration.

**Stage 2C coding may begin: YES** (on the migration/contract axis; sign-off of the other reviewers and the live-derivation stage remains governed by the spec).

---

### Final Response Summary

- **Verdict:** STAGE 2C MIGRATION CONDITIONALLY COMPATIBLE
- **Schema change required:** NO
- **Migration required:** NO (no backfill; existing `ValidationRecord` fields + Stage 2A `currentValidationHeads` sufficient; historical import safe)
- **Blockers:** NONE
- **Stage 2C coding may begin:** YES (conditions CS-1…CS-4 are forward obligations, not blockers)
- **Files modified (by this review):** only `docs/plans/m10-stage-2c-migration-compatibility-review.md`

---

## 11. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract, archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified. Stage 2C remains **unbuilt**; this document assesses the migration/contract compatibility of its proposed surface. All cited `file:line` anchors, the frozen `ValidationRecord` field set, the M8 correction path, and the Stage-2A enrichment were read from the current repository, and the settlement substrate was re-run green (107/107) this pass, so an implementer can verify them.
