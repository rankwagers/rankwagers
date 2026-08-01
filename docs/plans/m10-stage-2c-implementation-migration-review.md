# M10 Stage 2C — Implementation Migration & Frozen-Contract Review (Settlement Pipeline Wiring)

**Document type:** Review only. No runtime code, test, contract, flag, cron, schema, environment, archive, or deployment changed. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Migration / frozen-contract / forward-compatibility (future Postgres, append-only/immutable revisions, rollback, dormant-route safety).
**Subject:** M10 **Stage 2C — Settlement Pipeline Wiring** — **BUILT** (first-settlement-only; dormant at the route).
**Governing:**
`docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1),
`docs/plans/m10-stage-2c-settlement-integration-plan.md` (the architecture it implements),
`docs/plans/m10-stage-2c-migration-compatibility-review.md` (the prior forward review + CS-1…CS-4),
`docs/plans/m10-stage-2b-migration-compatibility-review.md` (the proven capture-wiring pattern + SC-1/SC-2),
`docs/plans/m10-stage-2-migration-compatibility-review.md` (MC-1…MC-5),
the M7 identity/versioning records, the M8 settlement/correction records, the frozen `types/evidence/validation.ts`.
**Method:** the exact Stage 2C diff was read from source (file:line), the modified-file set confirmed by mtime, and targeted + frozen-contract tests, typecheck, and lint re-run this pass.

---

## 1. Executive Summary

**Verdict: MIGRATION COMPATIBLE.**

Stage 2C is the settlement mirror of the approved Stage 2B capture wiring, implemented exactly to plan. The diff is **four files** (1 created, 3 modified additively), mtime-confirmed as the *only* files touched in the build window (2026-07-30 17:51); every frozen contract predates it (Jul 28–29) and is byte-unchanged. It changes **no schema, requires no migration/backfill, touches no M8 contract, and consumes no correction state**.

- **Schema change required: NO.** No archive-format evolution, no new field on any record.
- **Migration required: NO.** No backfill; historical NDJSON reads unchanged; existing `ValidationRecord` fields suffice.
- **Rollback safe: YES.** The cron route is unchanged (still the M9 empty-safe pass); the producer is dormant (`loadCompletedRows` is an injected seam with no live default); reverting is deleting additive functions + one optional runner parameter — nothing to un-migrate.

The first-settlement firewall is **real in code, not just documentation**: the settlement provider constructs each `SettlementCandidate` as `{fixtureId, row, completionInstant, nowSec, recordedBy?}` — `correctionCause` is *structurally never set* (`settlement-provider.ts:157-166`), `currentValidationHeads` is *never read*, and already-settled fixtures are excluded by the classifier. The prior review's condition CS-2 (corrections consumed-or-gated) and CS-3 (module-level reader) are **satisfied by construction**; CS-1 (freeze the hashed completion instant) and CS-4 (shared adapter resolver) remain forward activation gates, not blockers for this dormant merge.

Validation re-run this pass: targeted Stage-2C + settlement + archive-state + identity + M9 **232/232**, typecheck **exit 0**, lint **clean**. (Impl doc's full-suite figure was not independently re-run in full; the 232-test frozen/targeted subset is green.)

---

## 2. Frozen Contract Audit

**Exact modified-file set (mtime-confirmed; the only files newer than 2026-07-30T13:40 under `lib`/`tests`/`types`/`app`):**

| File | Change | Nature |
|---|---|---|
| `lib/evidence-capture/candidates/settlement-pipeline.ts` | **created** | `createFileSettlementReadPort` + `produceSettlementRequests` + deps/config; server-only |
| `tests/evidenceSettlementPipeline.test.ts` | **created** | unit tests |
| `lib/archive/evidence/file.ts` | **modified** | added `export readAllValidationsStrict(env?)`; reuses existing `readNdjson` |
| `lib/jobs/runner.ts` | **modified** | added optional `provideCandidates?` to `runPredictionSettlementJob` options |

**Frozen surfaces — verified byte-unchanged (all predate the 17:51 build):**

| Frozen artefact | Anchor / mtime | Status |
|---|---|---|
| `SettlementCandidate` (`fixtureId`,`row`,`completionInstant`,`nowSec`,`correctionCause?`,`recordedBy?`) | `settlement-run.ts:34` (Jul 29) | **unchanged** — produced field-for-field; `correctionCause` never populated |
| `ValidationRecord` (all 17 fields incl. `validationId`=`id`,`revisionId`,`revision`,`supersedesRevisionId`,`snapshotId`,`fixtureId`,`marketKey`,`selectionKey`,`state`,`settledAt`,`contentHash`) | `types/evidence/validation.ts:48-71` (Jul 28) | **unchanged** — read only via the strict reader; never written by Stage 2C |
| `EvidenceSnapshot` | `types/evidence/snapshot.ts` (Jul 28) | **unchanged** — read only (for `capturedFixtureIds`) |
| `validationId` / `revisionId` / `revision` / `settledAt` / `contentHash` | frozen identifiers | **unchanged** — no formula edited; M8 owns the revision math |
| `modelVersion` / `evidenceInputVersion` / `inputContentHash` | M7 | **not touched** — settlement settles existing snapshots; it neither mints snapshots nor re-hashes inputs |
| `EvidenceArchiveStore` | `archive/evidence/store.ts` (Jul 28) | **not widened** — `readAllValidationsStrict` is a **module-level** function, not an interface member (CS-3 ✓) |
| `currentValidationHeads` | `candidates/types.ts:197` (Jul 30 12:42, Stage 2A) | **untouched & unconsumed** — Stage 2C never reads it |
| `correctionCause` semantics | `settlement.ts:299-323` (Jul 29) | **untouched** — never produced by the pipeline |
| M8 contracts (`settleLatestSnapshotForFixture`, `settleSnapshot`, `reviseValidationRecord`, `runSettlementBatch`) | `settlement.ts` (Jul 29), `settlement-run.ts` (Jul 29) | **unchanged** — M8 remains the authoritative writer |
| archive format / directory resolution | `readNdjson`, `evidenceArchivePaths` | **unchanged** — reader reused verbatim; both readers resolve from one `evidenceArchivePaths(env)` |
| append-only / immutable revisions | `validation.ts:6-12` | **preserved** — Stage 2C appends nothing; M8 appends revisions, never edits |

**No interface widening, no hidden public contract.** `readAllValidationsStrict` mirrors 2B's `readAllSnapshotsStrict` exactly: a module-level export reusing the frozen fail-closed `readNdjson` (ENOENT ⇒ empty; malformed / `EACCES`/`EPERM` / `EIO`/`EBUSY`/`ENXIO`/`ENODEV` / any other errno ⇒ **throw**; `file.ts:165-168`). The `EvidenceArchiveStore` interface gained no `readAll*` method — so no accidental public contract is imposed on any adapter (incl. Postgres). CS-3 satisfied.

**Conclusion:** zero frozen-contract change. Audit clean.

---

## 3. Compatibility

**Runner API (M9 backward-compat).** `provideCandidates?` is an **optional** property on `runPredictionSettlementJob`'s options (`runner.ts:339-343`); resolution `options?.provideCandidates ? await options.provideCandidates() : (options?.candidates ?? [])` (`runner.ts:354-356`) preserves the M9 static-array path and the empty-safe default. Precedence is pinned (producer wins when both supplied — `runner.ts:336-337`). Invoked **inside** `runWithLock` (`runner.ts:349,354`) → INV-L honored (authoritative discovery under the durable `prediction_settlement` lock). A rejecting producer → run `failed`, never an empty success (fail-closed). Symmetric to the 2B capture seam; verified by the Stage-2C runner-seam tests.

**First-settlement firewall (correction state untouched).** Verified in code, three independent layers:
1. **Producer never sets `correctionCause`** — the constructed candidate literal omits it (`settlement-provider.ts:158-163`); `recordedBy` is the only optional field ever attached.
2. **`currentValidationHeads` never consumed** — `produceSettlementRequests` passes `archiveState` to `buildSettlementCandidates`, whose `archiveStateOk` reads only `capturedFixtureIds`/`settledFixtureIds` (`settlement-provider.ts:50-51,103`); the enrichment is ignored.
3. **Already-settled excluded + M8 backstop** — the classifier drops `settledFixtureIds` (`already_settled`), so no correction candidate is emitted; if one ever slipped through, frozen M8 fails closed to `invalid_input` on a causeless `head.state !== outcome.state` change (`settlement.ts:301-303`). M8 stays the authoritative writer and idempotency backstop.

**Completion-instant determinism.** `deriveCompletionInstant` is an injected, deterministic override defaulting to the fixture's canonical kickoff instant (`settlement-pipeline.ts:80-86`); the pipeline "reads no clock" (`:76`). `completionInstant`→`settledAt`/`recordedAt` is hashed into `ValidationRecord.contentHash` but excluded from identity (`validationId`/`revisionId`). Determinism holds today; **freezing/versioning the derivation at activation is CS-1** (a forward gate, not a merge blocker — the seam is dormant).

**No-TOCTOU (discovery vs settle head).** `SettlementCandidate` carries no head; M8's `settleLatestSnapshotForFixture` re-reads the authoritative head under the lock at settle time. The producer's archive state is a discovery-time decision hint only; a stale decision degrades to `no_change`/re-derivation, never a forged revision. Preserved.

---

## 4. Archive Format Compatibility

- **No format change.** `readAllValidationsStrict` reads `evidenceArchivePaths(env).validations` via the frozen `readNdjson` — identical fail-closed semantics to the store's own read; a corrupt/torn/permission/IO archive **throws** and can never be misread as empty (the pipeline propagates it → `failed`). Same-id/different-hash and ambiguous-revision conflicts are surfaced one layer up by the Stage-2A normalizer's `ArchiveStateConflictError` (documented at `file.ts:160-163`).
- **Single bounded read per store (PB-1 / MC-5).** `createFileSettlementReadPort` reads snapshots + validations once each per pass; `buildSettlementArchiveState` reduces in memory — no per-fixture `listValidations` rescan, no O(F²) amplification.
- **Directory resolution — simpler than capture.** Both readers resolve from one `evidenceArchivePaths(env)` (`snapshots.ndjson` + `validations.ndjson` under the evidence dir); there is **no separate odds subdir**, so the 2B SC-2 path-recompute coupling does not arise here (`settlement-pipeline.ts:47-52`).
- **Append-only preserved.** Stage 2C writes nothing; M8 appends revisions.

**Conclusion:** archive format and directory resolution fully compatible; historical NDJSON reads unchanged.

---

## 5. Migration Requirements

**Schema change required: NO. Migration/backfill required: NO.**

- No DDL, no new column, no index, no `isCurrent`/`supersededBy` flag (contract-forbidden), no data rewrite.
- Every settlement decision is a read-time derivation of existing `ValidationRecord` fields; first-settlement uses only `settledFixtureIds`/`capturedFixtureIds`. No enriched state is even consumed this stage.
- Historical archives (any age/revision depth) read unchanged; a long-settled fixture reads back as `settledFixtureIds` → `already_settled` → excluded, no reprocessing.
- **Historical import safe.** The typed validations reader returns domain records; a future offline file→Postgres import reproduces identical `contentHash` engine-independently (M8 migration review G5). Stage 2C bakes in no line/offset/file-layout assumption. Append-only-safe retention (MC-4) unaffected — Stage 2C prunes nothing.

---

## 6. Future Postgres

**Compatible — the typed port stays adapter-neutral; file-backed reader leaks nothing into provider logic.**

- **Format-neutral port.** `SettlementArchiveReadPort = { readAllSnapshots(): Promise<readonly EvidenceSnapshot[]>; readAllValidations(): Promise<readonly ValidationRecord[]> }` (Stage 2A) — typed domain objects, no NDJSON/line/offset in the signature. `createFileSettlementReadPort` fully encapsulates the file-ness (`settlement-pipeline.ts:54-61`); the provider consumes only typed records. A future `createPostgresSettlementReadPort` implements the same two methods with indexed `SELECT`s (current head = `DISTINCT ON (id) … ORDER BY revision DESC`) — O(log A) vs O(A) — with **no contract change** to the port, provider, or pipeline. `readPort` is injectable (`:70,105`), so the cutover supplies its port by injection.
- **Append-only / no update path** — corrections are new rows, never updates; Stage 2C adds no update path. This is the property that keeps a future importer trivially idempotent.
- **CS-4 (reinforced SC-1) — shared adapter resolver, still open.** Both `createFileSettlementReadPort` and the capture `createFileCaptureReadPort` are file-specific and do **not** consult `EVIDENCE_ARCHIVE_ADAPTER` (the choke-point the write stores honor). With settlement now a second consumer of `readAllSnapshots`, the Postgres/`memory` cutover should route capture + settlement reads through one `EVIDENCE_ARCHIVE_ADAPTER`-keyed resolver so discovery and write cannot diverge. **Non-blocking now** (production is file-only and dormant; M8's authoritative under-lock head re-read backstops correctness even under a read/write mismatch — a divergent discovery head only wastes a pass, never forges a revision). Land with/before the Postgres adapter.

---

## 7. Rollback

**Rollback safe: YES (HIGH).**

- **Dormant route.** The cron route is unchanged and still runs the M9 empty-safe pass; `runPredictionSettlementJob` short-circuits on `isSettlementEnabled` before the lock. The producer's `loadCompletedRows` is a **required injected seam with no live default** (`settlement-pipeline.ts:26-28,63-68`) — nothing composes it in production yet, so no live candidates fire.
- **Reversible by disabling wiring.** Reverting Stage 2C is deleting one module + one export + one optional runner parameter; **nothing to un-migrate** (writes nothing, changes no format).
- **Append-only makes even an accidental fire safe.** A first settlement is correct and stands; a re-fire is `no_change` (idempotent); no correction is ever produced; historical revisions remain immutable. No destructive path.
- **Fail-closed.** A strict validations-read throw or source-loader rejection → run `failed`, never a silent empty success.

---

## 8. Blocking Findings

**None.** No schema change, no migration, no frozen-contract change, no M8-contract change; the first-settlement firewall is enforced in code; the build is dormant, reversible, and fail-closed.

---

## 9. Verdict

**MIGRATION COMPATIBLE.**

Stage 2C is a four-file, purely additive, dormant, first-settlement-only settlement-pipeline wiring that changes **no** frozen contract, requires **no** schema change and **no** migration/backfill, and preserves append-only + immutable historical revisions. `SettlementCandidate`/`ValidationRecord`/`EvidenceSnapshot`/`validationId`/`revisionId`/`revision`/`settledAt`/`contentHash`/`modelVersion`/`evidenceInputVersion` are all read-only-or-produced-field-for-field and byte-unchanged; `currentValidationHeads` and `correctionCause` are provably untouched (correction detection structurally impossible this stage); M8 contracts are unchanged and remain the authoritative writer; the file-backed reader is adapter-neutral so a future Postgres adapter implements the same typed port with no contract change; rollback is safe while the route stays dormant. The two remaining conditions — **CS-1** freeze/version the hashed `completionInstant`→`settledAt` derivation at activation, and **CS-4** share one `EVIDENCE_ARCHIVE_ADAPTER`-keyed read-port resolver across capture + settlement — are forward activation gates, not merge blockers.

Validation re-run green: 232/232 targeted (Stage-2C + settlement + archive-state + identity + M9), typecheck exit 0, lint clean.

- **Schema change required: NO**
- **Migration required: NO**
- **Rollback safe: YES**

---

## 10. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract, archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified in producing this review. All cited `file:line` anchors, the four-file modified set (mtime-confirmed), the frozen-surface audit, and the test/typecheck/lint results were read/executed against the current repository so an implementer can verify them.
