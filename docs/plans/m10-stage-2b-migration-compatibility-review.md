# M10 Stage 2B — Migration, Contract & Forward-Compatibility Review (Capture Pipeline Wiring)

**Document type:** Review only. No runtime code, test, contract, flag, cron, schema, environment, archive, or deployment changed. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Migration / frozen-contract / forward-compatibility (future Postgres, future settlement, future activation, flags-off rollback, historical import).
**Subject:** M10 **Stage 2B — Capture Pipeline Wiring** (BUILT, dormant at the route).
**Governing:**
`docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1),
`docs/plans/m10-stage-2-migration-compatibility-review.md` (MC-1…MC-5),
`docs/plans/m10-stage-2b-architecture-review.md` (FC-1…FC-5),
`docs/plans/m10-stage-2b-capture-pipeline-wiring.md` (impl record),
`docs/plans/m10-stage-2a-implementation-review.md` (Stage 2A APPROVED),
the M7 input-identity, M8 settlement, and M9 activation records, the Rev 2 implementation contract, the Phase 2.7 DoD, the frozen `types/evidence/*` + store interfaces.
**Method:** the exact Stage 2B surface was read from source (file:line cited); the modified-file set was confirmed by mtime; targeted + frozen-contract tests, typecheck, and lint were re-run this pass.

---

## 1. Executive Summary

**Verdict: MIGRATION AND CONTRACT COMPATIBLE.**

Stage 2B wires the capture producer — `Archive-State (2A strict read) → Stage-1 provider → CaptureRequest[] → M6 runner` — behind an injectable seam. The exact diff is **five files** (2 created, 3 modified additively), independently confirmed by mtime to be the *only* files touched in the build window (2026-07-30 13:22–13:24); every frozen contract predates it (Jul 28–29) and is byte-unchanged.

- **No frozen contract changed.** `CaptureRequest`, `EvidenceSnapshot`, `OddsArchiveRecord`, `ProviderArchiveRecord`, `ValidationRecord`, the `EvidenceArchiveStore`/`OddsArchiveStore` interfaces, the identity/hash formulas, `modelVersion`/`evidenceInputVersion`, and the NDJSON format are all untouched. The new code **reads** existing records and **produces** `CaptureRequest[]`; it writes nothing new and adds no field to any record.
- **No migration required.** No archive-format evolution, no schema change, no new column, no data backfill. Historical archives read unchanged.
- **Identity is discovery-time-independent.** `capturedAt` is kickoff-anchored (`window.quantizedCapturedAt`); the run's `evaluationInstant` feeds only the window-open decision (`not_yet`/`expired_window`), never an identity or hashed field — so M7's `inputContentHash`/`captureId`/`evidenceSnapshotId` semantics stay independent of runtime discovery time.
- **The new read port is a clean format-neutral boundary.** It returns typed domain objects (`EvidenceSnapshot[]`/`OddsArchiveRecord[]`), not NDJSON lines — no file/NDJSON assumption leaks into provider logic; a future Postgres adapter implements the same `CaptureArchiveReadPort` signature with **no contract change**.
- **Reversible / rollback-safe.** The cron route is unchanged and still runs the M9 empty-safe pass; the pipeline fires no live candidates (the async M4→M5 derivation is a later stage). Rollback = do nothing / disable wiring; there is nothing to un-migrate.

Validation re-run this pass: targeted Stage 2A+2B **34/34**, frozen-contract/identity/M9 subset **210/210**, typecheck **exit 0**, lint **clean**. (Impl record's full-suite 1769/1769 was not independently re-run in full; the 244-test frozen subset I ran is green.)

Two **non-blocking conditions** for the *next* stages are recorded (§11): **SC-1** the concrete read port bypasses the `EVIDENCE_ARCHIVE_ADAPTER` choke-point the write stores honor — the future Postgres cutover MUST inject a matching read port through the existing `readPort` seam (or a resolver must be added) so read/write cannot diverge; **SC-2** the odds-file path is recomputed in the port rather than reused from the store, a latent path-coupling to freeze behind a shared resolver at the Postgres stage. Neither affects the current dormant, file-only build.

---

## 2. Frozen Contract Audit

**Exact modified-file set (mtime-confirmed; the only files newer than 2026-07-30T13:00 under `lib`/`tests`/`types`/`app`):**

| File | Change | Nature |
|---|---|---|
| `lib/evidence-capture/candidates/capture-pipeline.ts` | **created** | `createFileCaptureReadPort`, `produceCaptureRequests`, `CapturePipelineDeps`/`Config`; server-only |
| `tests/evidenceCapturePipeline.test.ts` | **created** | 9 unit tests |
| `lib/archive/evidence/file.ts` | **modified** | added `export readAllSnapshotsStrict(env?)`; reuses existing `readNdjson` |
| `lib/evidence-capture/odds-archive/file.ts` | **modified** | extracted `export readAllOddsRecordsStrict(recordsFile)`; store `readAll` now delegates (no behaviour change) |
| `lib/jobs/runner.ts` | **modified** | added optional `provideCandidates?` to `runEvidenceCaptureJob` options |

**Frozen surfaces — verified byte-unchanged (mtime Jul 28–29, all predate the build):**

| Frozen artefact | Anchor | Status |
|---|---|---|
| `CaptureRequest` | Stage-1 re-export of frozen type | **unchanged** — Stage 2B produces it field-for-field; typecheck exit 0 |
| `EvidenceSnapshot` | `types/evidence/snapshot.ts` (Jul 28) | **unchanged** — read only |
| `OddsArchiveRecord` | `lib/evidence-capture/odds-archive/record.ts` (Jul 28) | **unchanged** — read only; `verifyOddsRecord` integrity preserved in the extracted reader |
| `ProviderArchiveRecord` | `provider-archive/record.ts` (Jul 28) | **unchanged** — not touched at all (capture producer does not read the provider archive) |
| `ValidationRecord` | `types/evidence/validation.ts` (Jul 28) | **unchanged** — settlement not wired this stage |
| `EvidenceArchiveStore` / `OddsArchiveStore` | `store.ts` (Jul 28) | **unchanged** — no method added; the two `*Strict` readers are module-level functions, **not** interface members |
| `captureId` / `evidenceSnapshotId` / `inputContentHash` / `contentHash` | `lib/evidence/identifiers.ts` (Jul 28) | **unchanged** — no formula edited |
| `modelVersion` / `evidenceInputVersion` | — | **unchanged** — defaulted, never invented (FC-2) |
| market registry | — | **unchanged** — provider reads it read-only |
| archive directory resolution | `resolveEvidenceArchiveDir`/`evidenceArchivePaths` | **behaviour unchanged** — reused, not modified (see §4/SC-2) |
| NDJSON format | `readNdjson`/`appendLine` | **unchanged** — reader reused verbatim |
| append-only behaviour | store append paths | **unchanged** — Stage 2B appends nothing; it only reads + produces requests |
| correction semantics | `settlement.ts` (Jul 29) | **unchanged** — settlement is explicitly out of Stage 2B |

**No interface widening.** The `EvidenceArchiveStore`/`OddsArchiveStore` interfaces did **not** gain a `readAll*` method (which would be an accidental public contract every adapter must implement). Instead Stage 2B added *module-level* `readAllSnapshotsStrict`/`readAllOddsRecordsStrict` and an abstract `CaptureArchiveReadPort` (Stage 2A) the concrete file port satisfies. This is the right layering: the store interface stays minimal; the whole-archive read is a port the pipeline composes.

**Conclusion:** zero frozen-contract change. The audit is clean.

---

## 3. Identity and Hash Compatibility

The load-bearing forward property is that the producer boundary is deterministic and that **runtime discovery time never enters identity** (FC-1/FC-3, MC-3).

- **`capturedAt` reused, not regenerated.** Verified `eligibility.ts:78-81`: `capturedAt = window.quantizedCapturedAt`, computed from `(kickoffAt, leadMinutes)` only. The evaluation instant (`evalMs`) is used **exclusively** for the window-open decision — `evalMs < capturedAtMs → not_yet`, `evalMs >= kickoffMs → expired_window` (`eligibility.ts:97-100`). It is a *decision* input, never a coordinate. The pipeline threads `config.evaluationInstant` + `leadMinutes` into `buildCaptureCandidates` and reads **no clock of its own** (`capture-pipeline.ts:92` "the pipeline reads no clock").
- **`captureId` / `evidenceSnapshotId` independent of discovery time.** Because `capturedAt` is kickoff-derived, the window key `"<fixtureId>|<capturedAt>"`, the `captureId`, and the sequence-bearing `evidenceSnapshotId` are reproducible from retained data regardless of *when* the run fired. A retry at a different wall-clock reconstructs the identical identity → the M6 full-stream pre-check returns `already_exists`, never a duplicate mint.
- **`inputContentHash` / `evidenceInputVersion` (M7).** Unchanged and unreachable from this stage — Stage 2B assembles `CaptureRequest` and hands it to the frozen runner; the M7 hash is computed downstream over the retained normalized basis. `modelVersion` defaults to the frozen `"23B.daily-evidence.v1"` via the provider config and is **never invented** here (FC-2). The M7 serialization-boundary replay guarantee therefore continues to hold over Stage-2B-produced captures (A4) — the stage introduces no live-only input.
- **`contentHash` (odds/snapshot).** The extracted `readAllOddsRecordsStrict` preserves `verifyOddsRecord` integrity and the same-id/different-hash conflict throw (`odds-archive/file.ts:102-115`) — identical to the store's prior behaviour; no record is re-hashed or rewritten on read.

**Conclusion:** identity and hash compatibility fully preserved; discovery time is provably excluded from all identity/hash coordinates.

---

## 4. Archive Format Compatibility

- **No format change.** Stage 2B reads via the existing `readNdjson` (evidence) and the extracted odds reader; both keep the frozen fail-closed semantics (ENOENT ⇒ empty; malformed line / `EACCES`/`EPERM` / `EIO`/`EBUSY`/`ENXIO`/`ENODEV` / any other errno ⇒ **throw**; `readAllSnapshotsStrict` verified `file.ts:147-151`; odds conflict-throw `file.ts:102-115`). A corrupt archive can **never** be misread as empty — the pipeline propagates the throw and the runner reports `failed`, not an empty success (`capture-pipeline.ts:111`, `runner.ts:304-306`).
- **Single bounded read per store (PB-1 / MC-5).** `createFileCaptureReadPort` reads each store exactly once per pass; `buildCaptureArchiveState` reduces in memory — no per-fixture `listSnapshots` rescan, no O(F²) amplification. This is the discipline that keeps the file adapter viable until the Postgres cutover.
- **Behaviour-preserving extraction.** The odds store's `readAll` now delegates to `readAllOddsRecordsStrict` (`odds-archive/file.ts:127-129`); the dedup-by-id + conflict-throw + ordering logic is byte-identical to what lived in the closure. No existing test changed; `oddsArchive.test.ts` green.
- **Directory resolution unchanged.** `resolveEvidenceArchiveDir` (env → `EVIDENCE_ARCHIVE_DIR` → prod shared default → dev cwd) and `evidenceArchivePaths` are reused, not modified. The port derives the odds file as `<evidenceDir>/odds-archive/records.ndjson` — the same path the odds store default computes (verified equal: `oddsArchivePaths(join(resolveEvidenceArchiveDir(env),"odds-archive")).records` == store default). See SC-2 for the recompute-vs-reuse coupling note.

**Conclusion:** archive format and directory resolution fully compatible; historical NDJSON reads unchanged.

---

## 5. Runner API Compatibility

**Does adding `provideCandidates` change the M9 runner contract incompatibly? No.**

- The new field is an **optional** property on `runEvidenceCaptureJob`'s options object (`runner.ts:288-293`). Existing M9 callers (the cron route, M9 tests) pass no `provideCandidates`; the resolution `options?.provideCandidates ? await options.provideCandidates() : (options?.candidates ?? [])` (`runner.ts:304-306`) preserves the M9 static-array path and the empty-safe default verbatim. Verified by the test "static candidates path still works (M9 backward-compat)" and "disabled capture flag short-circuits before discovery" (producer never called).
- **INV-L honoured.** `provideCandidates()` is invoked **inside** the `runWithLock` callback (`runner.ts:298,304`), so authoritative discovery happens under the held durable lock — never before it. A rejecting producer surfaces as `failed` (fail-closed), not an empty success.
- **Settlement runner untouched.** `runPredictionSettlementJob` gained no seam this stage — consistent with settlement being deferred.
- **No new route, no new job type, no lock change.** The M9 lock/flag/route envelope is unchanged; the flag short-circuit still precedes the lock (`runner.ts:295-297`).

`provideCandidates` is an **acceptable additive API** on the runner, backward-compatible with M9.

---

## 6. Future Postgres Compatibility

**Compatible — the port abstraction is the correct forward seam, but two coupling notes gate the eventual cutover (SC-1/SC-2, non-blocking now).**

- **Format-neutral port.** `CaptureArchiveReadPort` is `{ readAllSnapshots(): Promise<readonly EvidenceSnapshot[]>; readAllOddsRecords(): Promise<readonly OddsArchiveRecord[]> }` (Stage 2A `types.ts:33-47`) — typed domain objects, no NDJSON/line/offset in the signature. **No file assumption leaks into provider logic**; the entire NDJSON-ness is encapsulated inside `createFileCaptureReadPort`. A future `createPostgresCaptureReadPort` implements the same two methods (indexed `SELECT`s replacing the global scan, O(log A) vs O(A)) with **no contract change** to the port, the provider, or the pipeline. This is exactly the adapter-neutral Option C design (spec §4.0/§9.4).
- **`readPort` is injectable.** `CapturePipelineDeps.readPort` defaults to the file port but is overridable (`capture-pipeline.ts:86,119`), so the Postgres cutover supplies its port by injection — no edit to `produceCaptureRequests`.
- **Bounded reads + append-only preserved.** Stage 2B adds no update path and appends nothing; the single-bounded-read discipline (MC-5) keeps the file adapter within budget until the reversible env cutover. The immutable append-only log property (the single most important Postgres-forward invariant) is untouched.
- **SC-1 (condition, not a blocker now):** `createFileCaptureReadPort` is **file-specific and does not consult `EVIDENCE_ARCHIVE_ADAPTER`**, whereas the write path (`getEvidenceArchiveStore`/`getOddsArchiveStore`) honors it (`odds-archive/service.ts:21-26`). Today production defaults to the file adapter for both, so read and write agree. But a naive Postgres cutover that flips only the store services would leave the pipeline default reading the file — a read/write divergence. **The Postgres stage MUST inject a matching read port through the `readPort` seam, or a `getCaptureReadPort()` resolver keyed on the same `EVIDENCE_ARCHIVE_ADAPTER` must be added** so the two cannot diverge. (Same footgun exists today under `EVIDENCE_ARCHIVE_ADAPTER=memory`, but that is test-only and idempotency backstops correctness — discovery would merely under-report captured windows, never mint a duplicate, because the M6 full-stream pre-check reads the real store.)

**Conclusion:** Postgres-transparent by construction; the cutover is a later reversible env flip that supplies a port implementation, with SC-1 the one wiring discipline to honor.

---

## 7. Settlement and Correction Compatibility

- **Settlement is explicitly out of Stage 2B** (wiring doc §1) — no settlement runner seam, no `SettlementCandidate` assembly, no correction path exercised. `ValidationRecord`, `reviseValidationRecord`, and M8's `correctionCause`/`head.state !== outcome.state` logic are untouched (`settlement.ts` Jul 29, byte-unchanged).
- **Forward-compatible with the future settlement wiring.** The settlement pipeline will mirror this stage: a strict `SettlementArchiveReadPort` (Stage 2A already defines the settlement normalizer + the MC-1 `currentValidationHeads` enrichment), a `produceSettlementCandidates`, and a symmetric `provideCandidates` seam on `runPredictionSettlementJob`. Nothing in Stage 2B blocks that; the runner pattern is proven and additive.
- **Correction path remains reachable without format change** (MC-1): the current-outcome-per-(fixture,market) state needed to set `correctionCause` is a pure projection of existing `ValidationRecord` fields already exposed by Stage 2A. Stage 2B neither closes nor complicates that path.

**Conclusion:** compatible with future settlement and correction wiring; no regression, no constraint introduced.

---

## 8. Rollback and Reversibility

- **Flags-off rollback safe.** The cron route is unchanged and still executes the M9 empty-safe pass; the capture flag short-circuits before the lock. With the flag off (default), `runEvidenceCaptureJob` returns `flagSkippedJob` before any discovery — the pipeline is never reached.
- **Reversible by disabling wiring.** No route calls `produceCaptureRequests`/`provideCandidates` in production yet (the async M4→M5 derivation is a later stage), so the live producer is dormant. Reverting Stage 2B is deleting two additive functions + one optional parameter; **there is no data to un-migrate** because the stage writes nothing and changes no format.
- **No persisted state, no cursor (INV-A).** Progress is the archive state rebuilt each pass; nothing is checkpointed. A disabled/rolled-back pipeline leaves the archive exactly as it was.
- **Fail-closed, not fail-open.** A strict-read throw → `failed` run, never a silent empty success that could mask corruption or trigger a re-mint.

**Rollback safety: HIGH.** Disabling the wiring (or simply not composing the producer) restores the M9 baseline with no residue.

---

## 9. Migration Requirements

**Migration required: NO.**

- No archive-format evolution, no new field on any record, no schema/DDL, no index, no data backfill, no historical rewrite.
- Historical archives (any age) read unchanged through the reused `readNdjson` / extracted odds reader.
- No hidden mandatory migration: the stage is a *reader + producer*; it introduces nothing that must be migrated before or after deploy.
- **Historical archive import safe.** Because the read port returns typed domain records and asserts integrity fail-closed, a future offline import (file → Postgres) can reproduce identical hashes engine-independently; Stage 2B bakes in no assumption (line order, offset, file layout) that an importer would have to replicate. Append-only-safe retention (MC-4) is unaffected — Stage 2B prunes nothing and must not assume pruning.

---

## 10. Blocking Findings

**None.** No frozen contract changed; no migration is required; the build is dormant, reversible, and fail-closed. There is no migration-or-contract blocker to Stage 2B closure.

---

## 11. Conditions

All carried conditions remain **non-format-changing** and are inherited, not newly imposed:

- **MC-1…MC-5** (Stage-2 migration review) — correction-capable settlement state from existing fields; archive-as-sole-checkpoint / no cursor / discovery-inside-lock; strict producer determinism (+ freeze `completionInstant` derivation at settlement activation); append-only-safe retention only; single bounded read under bounded ceilings. Stage 2B honors every one that is in scope (INV-L, INV-A, PB-1, determinism); the settlement-only ones (MC-1, completionInstant freeze) remain future obligations of the settlement stage.
- **FC-1/FC-2/FC-3** (Stage-2B architecture review) — `capturedAt` reused verbatim + no live-only input; `modelVersion` never invented; determinism at the producer boundary. **All satisfied** in this build (§3).

**New Stage-2B-specific conditions (for the NEXT stages; none blocks closure):**

- **SC-1 — Read/write adapter parity at the Postgres (and memory) boundary.** `createFileCaptureReadPort` does not consult `EVIDENCE_ARCHIVE_ADAPTER`. Before the Postgres cutover, the future live-derivation/settlement wiring MUST inject a read port matching the active write adapter (via the existing `readPort` seam) or introduce a `getCaptureReadPort()` resolver keyed on the same env, so discovery and write can never read different stores. (Non-blocking now: production is file-only and dormant; the M6 full-stream idempotency backstops correctness even under a mismatch.)
- **SC-2 — Freeze the odds-file path behind a shared resolver.** The port recomputes `<evidenceDir>/odds-archive/records.ndjson` rather than reusing the store's own path resolution; they are equal today but are two copies of the convention. Consolidate behind one resolver when the read-port resolver (SC-1) lands, so a future path change cannot desync the read and write sides.

---

## 12. Verdict

**MIGRATION AND CONTRACT COMPATIBLE.**

Stage 2B is a five-file, purely additive, dormant capture-pipeline wiring that changes **no** frozen contract, requires **no** migration, and is **fully reversible**. Identity, hashing, append-only, and NDJSON format are preserved; `capturedAt` is kickoff-anchored so M7 identity stays independent of discovery time; the new read port is a format-neutral boundary that a future Postgres adapter implements without any contract change. The two new conditions (SC-1 read/write adapter parity, SC-2 shared path resolver) are forward obligations of the *later* Postgres/live-derivation/settlement stages and do not gate this stage. Validation re-run green (34/34 targeted, 210/210 frozen subset, typecheck exit 0, lint clean).

**Stage 2B may close: YES** (on the migration/contract axis; sign-off of the other reviewers and the live-derivation stage remains governed by the spec).

---

### Final Response Summary

- **Verdict:** MIGRATION AND CONTRACT COMPATIBLE
- **Frozen-contract changes found:** NONE (all `types/evidence/*`, store interfaces, identity/hash formulas, `modelVersion`/`evidenceInputVersion`, market registry, NDJSON format, dir resolution byte-unchanged; the two `*Strict` readers are module-level functions, not interface members)
- **Migration required:** NO (no format/schema/field change; no backfill; historical import safe)
- **Rollback safety:** HIGH — flags-off restores the M9 empty-safe pass; nothing to un-migrate; fail-closed
- **Stage 2B may close:** YES
- **Files modified (by this review):** only `docs/plans/m10-stage-2b-migration-compatibility-review.md`

---

## 13. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract, archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified in producing this review. All cited `file:line` anchors, the modified-file set (mtime-confirmed), the test/typecheck/lint results, and the frozen-surface audit were read/executed against the current repository so an implementer can verify them.
