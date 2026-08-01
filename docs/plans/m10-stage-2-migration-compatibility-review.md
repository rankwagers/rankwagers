# M10 Stage 2 — Migration & Long-Term Compatibility Review

**Reviewer:** Migration & Long-Term Compatibility Reviewer (Claude 6)
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2 preparation** (orchestration wiring of the Stage 1 producer into the M9 runners).
**Type:** Read-only compatibility review. **No runtime code, test, existing document, archive format, schema, flag, cron, environment, or deployment was changed.** Stage 2 is **not** implemented here; this review determines only whether the *proposed* Stage 2 can remain migration-compatible.

**Governing inputs read:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1); `docs/plans/m10-live-candidate-pipeline-architecture-review.md`; `docs/plans/m10-stage-1-candidate-provider-foundation.md`; `docs/plans/m10-stage-1-candidate-provider-implementation-review.md`; `docs/plans/sprint-23b-m9-closure.md`; `docs/plans/sprint-23b-m10-closure.md`; `docs/architecture/sprint-23b-implementation-contract.md`; `docs/architecture/phase-2-7-definition-of-done.md`. Repository implementations were inspected directly (file:line cited).

---

## 1. Executive Verdict

# MIGRATION CONDITIONALLY COMPATIBLE

The proposed Stage 2 is a **producer-only orchestration wiring**: it discovers candidates, classifies eligibility, drives M4 fetch + M5 derivation, assembles the two **frozen** consumer objects (`CaptureRequest`, `SettlementCandidate`), and passes bounded arrays into the already-built M9 runners inside the durable lock. It **adds no record type, no field, no identity/hash/revision/serialization formula, and no archive format**. Every record it causes to be written is a frozen M6/M8 builder output — content-addressed, self-describing, append-only, NDJSON-authoritative, and replayable. Therefore Stage 2 **cannot, by construction, create non-migratable, non-importable, or irreversible data**, and it preserves the safe future NDJSON→Postgres cutover verified for M8/M9.

Compatibility is **conditional** on a small set of **non-format-changing** obligations that the spec/architecture review already mandate and that Stage 2 must honour: (MC-1) derive settlement progress as *current-outcome-per-market* from existing `ValidationRecord` fields so corrections propagate and no format evolution is later forced; (MC-2) preserve the archive-as-sole-checkpoint model (INV-A) with discovery-inside-lock and **no persisted cursor**; (MC-3) strict determinism (no clock/random) in candidate assembly so replay and `inputContentHash` stay stable; (MC-4) any future retention/compaction must be append-only-safe (cold-archive, never prune within the checkpoint/replay horizon); (MC-5) a single bounded archive read per run under the bounded ceilings so the O(F²) file-adapter cost never forces a premature cutover. None requires touching a frozen contract.

**Crucial finding:** *all* normalized state Stage 2 needs is derivable from the **current** NDJSON records **with no new field** — the only "ambiguity" is the deliberately thin Stage-1 `SettlementArchiveState` *projection type* (a code type, not a stored format), which Stage 2 must enrich by reading fields the `ValidationRecord` already carries. **No archive-format evolution is required for M10.**

---

## 2. Frozen Contracts

Stage 2 MUST NOT change any of the following. Verified unchanged in the current tree; Stage 1 explicitly reuses them type-only (`lib/evidence-capture/candidates/types.ts:22-27`).

| Frozen symbol | Location (verified) | Migration relevance |
|---|---|---|
| `CaptureRequest` | `lib/evidence-capture/capture/capture.ts:36` | Producer output; consumer-owned. Fields: `admitted, fixtureId, capturedAt, modelInput` (+ optional `providerRecord, competitionId, seasonId, operatorAvailability, bestOddsSnapshot, modelVersion`). |
| `SettlementCandidate` | `lib/evidence-capture/jobs/settlement-run.ts:34` | Producer output. Fields: `fixtureId, row, completionInstant, nowSec` (+ optional `correctionCause, recordedBy`). No result/outcome field. |
| `EvidenceSnapshot` | `types/evidence/snapshot.ts:113` | Immutable body: `id, fixtureId, competitionId, seasonId, capturedAt, evidenceScore, qualification, supportedMarkets[], signals[], operatorAvailability, bestOddsSnapshot, modelVersion, status, schemaVersion, sequence, contentHash, previousSnapshotId, capturedBy`. |
| `ValidationRecord` | `types/evidence/validation.ts:48` | Immutable revision: `id, revisionId, revision, supersedesRevisionId, snapshotId, fixtureId, marketKey, selectionKey, state, reasonCode, note, recordedAt, settledAt, recordedBy, schemaVersion, contentHash`. |
| `OddsArchiveRecord` (incl. mandatory `evidence_capture`) | `lib/evidence-capture/odds-archive/record.ts` | Natural key `(captureId, marketKey, selectionKey, source)`; `source='evidence_capture'` ⇒ null odds/operator/implied + `sampleOperators=0` (`record.ts:222-229`). |
| `ProviderArchiveRecord` | `lib/evidence-capture/provider-archive/record.ts` | Content-hashed raw-input basis; feeds `inputContentHash`. |
| `EvidenceArchiveStore` interface | `lib/archive/evidence/store.ts` | Adapter-neutral seam; Stage 2 reads/writes only through it. |
| Snapshot identity | `evidenceSnapshotId(fixtureId, capturedAt, sequence)` — `lib/evidence/identifiers.ts:27` | Excludes `modelVersion`; binds `sequence` (archive-state-dependent, forward-only). |
| Capture identity | `captureWindowKey = "<fixtureId>|<capturedAt>"`; `captureId = "cap_"+evidenceContentHash(fixtureId‖captureWindowKey)[0:24]` — `lib/evidence-capture/identity.ts:68-123`, reconstructed at `capture/mandatory-odds.ts:48-59` | Pure function of `(fixtureId, capturedAt)`; recoverable from a retained snapshot. |
| Validation identity | `validationId(snapshotId, marketKey, selectionKey)` + `validationRevisionId(validationId, revision)` — `lib/evidence/identifiers.ts` | Logical id stable across revisions; `revisionId` is the archive key. |
| Content-hash / canonicalizer | `evidenceContentHash` / `canonicalizeEvidence` (sorted keys, order-independent) — `lib/evidence/hash.ts` | Storage-order-independent hashing; engine-independent. |
| `inputContentHash` (M7) | `"iih_"+evidenceContentHash({evidenceInputVersion, providerContentHash, sortedOddsContentHashes})` — `lib/evidence-capture/input-identity/identity.ts:9`, **excludes `modelVersion`** | Reconstructable from retained provider+odds; not persisted. |
| Revision / correction semantics | `reviseValidationRecord`; `CorrectionCause` → `result_reinterpreted→settlement_correction`, `source_lineage_changed→data_correction` — `lib/evidence-capture/settlement.ts:71-73,130-131` | Append-only revision chain; "current" = MAX(revision) at read. |
| Version semantics | `modelVersion="23B.daily-evidence.v1"` (`snapshot.ts:127`, contract §2.A); `evidenceInputVersion` (`input-identity/version.ts`, fail-closed on unsupported) | `modelVersion` = scoring/snapshot identity; `evidenceInputVersion` = input identity in `inputContentHash`. |
| Closed key registries | `marketKey ∈ {over15,over25,fh,sh,1x2,btts}`; `selectionKey ∈ {over,under,home,draw,away,yes,no}` (contract §2.B) | Direct-equality join; Stage 2 rejects non-members (`unsupported_market`). |

**Verified:** the Stage-1 provider re-exports `CaptureRequest`/`SettlementCandidate` type-only and populates them field-for-field (impl review I2/I3 = PASS; typecheck exit 0). Stage 2 wiring extends none of these. `phase-2-7-definition-of-done.md` gates "**no frozen contract was modified**" as a baseline for DONE — this review adopts that as a hard compatibility precondition (spec R8, DoD §intro).

---

## 3. NDJSON Compatibility

**Current storage topology (verified — carried from the M9 migration review, unchanged by Stage 1):**
- Three physically-separate append-only NDJSON stores under one shared base dir (`resolveEvidenceArchiveDir()`, `lib/archive/evidence/file.ts:54-61`; prod default `/opt/rankwagers/shared/evidence-archive`): `snapshots.ndjson` + `validations.ndjson` (evidence), `odds-archive/records.ndjson`, `provider-archive/records.ndjson`.
- Every write is `${JSON.stringify(record)}\n` via `fs.appendFile` — never a whole-file rewrite. Key order is irrelevant to identity (hash over canonical sorted form).
- **Strict fail-closed reads** on all three families (`evidence/file.ts:76-127`, `odds-archive/file.ts:70-116`, `provider-archive/file.ts:86-136`): ENOENT→empty; malformed/permission/I/O/other errno→throw; conflicting id+different-hash→`immutable_violation`-on-disk throw.
- **No cursor/checkpoint/offset state anywhere** — grep over `lib/evidence-capture`, `lib/jobs`, `lib/archive/evidence` returns nothing (verified). Ordering is reconstructed from fields (`sequence`/`previousSnapshotId`; `revision`/`supersedesRevisionId`; deterministic comparators), never trusted from file position.

**Stage 2 effect on NDJSON:** Stage 2 causes the M6/M8 builders to *write* snapshots, mandatory odds, provider records, and validation revisions at runtime for **live** candidates (today the runners fire with an empty candidate set — M9 dormant posture). It writes nothing of a new shape. The Stage-1 provider itself performs **no I/O** (`candidates/types.ts:12-15`): it reads no store and writes nothing; archive-derived progress is *injected* as normalized read-only state. Stage 2 adds only the orchestration read (one bounded scan/run) + the existing runner writes, inside the durable lock.

**Conclusion:** Stage 2 is byte-for-byte NDJSON-compatible with M1–M9. It introduces no new line shape, no format flag, and no reader/writer change.

---

## 4. Normalized State Sufficiency

The central migration question: can Stage 2 derive every normalized state it needs from the **current** NDJSON records **without adding a field**? Verified per state:

### Capture states — SUFFICIENT from current records, no new field
`CaptureArchiveState { capturedWindowKeys, partialWindowKeys? }` (`candidates/types.ts:141-146`) uses the frozen window-key shape `"<fixtureId>|<capturedAt>"`, identical to `captureWindowKey().key` and `captureIdentityFromSnapshot` (`identity.ts:91`, `mandatory-odds.ts:51`).

| State | Derivation from current NDJSON |
|---|---|
| **Complete pair** | snapshot exists for `(fixtureId, capturedAt)` **and** ≥1 `evidence_capture` odds row exists for its reconstructed `captureId` → `capturedWindowKeys`. |
| **Snapshot-only** (missing odds) | snapshot exists, no mandatory odds row → `partialWindowKeys` → re-emitted for M6/C5 healing (idempotent), **not** rejected (Stage-1 §5, impl review I6 = PASS). |
| **Odds-only** (orphan) | cannot arise from the frozen path (mandatory odds is written per minted snapshot); if injected by corruption, the strict read surfaces it and the window is simply absent from `capturedWindowKeys` → capture re-attempted idempotently (existing snapshot check). |
| **Duplicate pair** | identical `(fixtureId, capturedAt)` → same window → M6 full-stream pre-check returns `already_exists`; odds re-append collapses to `duplicate`. Idempotent no-op. |
| **Corrupt/conflicting** | strict read throws (`immutable_violation`-on-disk / malformed); Stage 2 MUST defer + alert, never treat as empty (spec §8, DoD B4). No duplicate mint. |

### Settlement states — SUFFICIENT at the record level; the Stage-1 *projection type* is INSUFFICIENT for corrections (MC-1)
`SettlementArchiveState { capturedFixtureIds, settledFixtureIds }` (`candidates/types.ts:151-156`) represents only the pending/settled *binary* per fixture.

| State | Derivable from current NDJSON records? | Representable in the Stage-1 projection? |
|---|---|---|
| **Pending** | Yes — snapshot exists, no terminal `ValidationRecord`. | Yes (`capturedFixtureIds \ settledFixtureIds`). |
| **Settled** | Yes — a terminal `ValidationRecord` (`state≠pending`) at the current (MAX-revision) head. | Yes (`settledFixtureIds`). |
| **Correction / revision** | **Yes at the record level** — the `ValidationRecord` already carries `state`, `revision`, `supersedesRevisionId`, `marketKey`, `selectionKey`, `snapshotId`; the *current outcome per market* is `DISTINCT ON (id) ORDER BY revision DESC`. | **No** — a bare `settledFixtureIds` set cannot express *settled-to-what-outcome* or *per-market* head, so it cannot detect a genuine change (M8 requires `correctionCause` only when `head.state !== outcome.state`, `settlement.ts:301`). |
| **Duplicate validation** | Yes — M8 revision-aware append: re-injecting an unchanged outcome → `noChange` (idempotent). | N/A (handled downstream). |
| **Corrupt/conflicting** | Yes — strict read throws; classifier fails closed to `corrupt_archive_state` (Stage-1 §8). | Yes (fail-closed). |

**The ambiguity that would otherwise force format evolution — and why it does NOT:** the *only* insufficiency is that the Stage-1 `SettlementArchiveState` type is a thin fixture-id-set projection. Correction propagation needs *current-outcome-per-(fixture,market)*. **That richer state is a pure projection of fields the `ValidationRecord` already stores** (`state`, `revision`, `marketKey`, `selectionKey`) — so Stage 2 supplies it by reading existing records differently, **not** by adding any field to any archive record. Impl review §15/§16 and I14 confirm this is a "richer archive-derived state" requirement, not a schema change. **No archive-format evolution is required for M10** (MC-1).

---

## 5. PostgreSQL Forward Mapping

Review-level mapping (NOT to be implemented in M10; consistent with the M8/M9 migration reviews). Every state and operation Stage 2 produces maps cleanly to a future relational representation; Stage 2 blocks none of it.

| Family / operation | PK | Unique / natural key | Indexes | Immutable cols | Revision / append semantics | Idempotent insert | Conditional update |
|---|---|---|---|---|---|---|---|
| `evidence_snapshots` | `id TEXT` | `UNIQUE(fixture_id, sequence)`; `content_hash UNIQUE` | `fixture_id`, `captured_at` | all (append-only) | none (new capture = new row); `previous_snapshot_id` self-FK | `ON CONFLICT(id) DO NOTHING` + read-back hash compare | **none** |
| `odds_archive` (incl. mandatory `evidence_capture`) | `id TEXT` | natural `(capture_id, market_key, selection_key, source)` | `capture_id`, `fixture_id` | all | none | `ON CONFLICT DO NOTHING` | **none**. CHECK: `source='evidence_capture'` ⇒ null odds/operator/implied + `sample_operators=0` |
| `provider_archive` | `id TEXT` | `content_hash` | `fixture_id` | all | none | `ON CONFLICT DO NOTHING` | **none** |
| `evidence_validations` | `revision_id TEXT` | `UNIQUE(id, revision)` | `snapshot_id`, `fixture_id`, `(id, revision DESC)` | all | append-only revisions; `supersedes_revision_id` chain; current = `DISTINCT ON (id) … ORDER BY revision DESC` | `ON CONFLICT(revision_id) DO NOTHING` | **none** (corrections are new rows, never updates) |

- **Pair completeness:** a snapshot's mandatory-odds pair is the join `odds_archive.capture_id = reconstruct(fixtureId, captured_at)` with `source='evidence_capture'`; an importer flags any snapshot with zero such rows per supported market (§11).
- **Transaction boundaries:** per-record idempotent insert; per-fixture batches are independent (partial-batch crash leaves a valid prefix — spec §8). No multi-row transaction is *required* for correctness (each record is self-contained and content-addressed).
- **Advisory-lock scope:** the same durable authority M9 uses — `EVIDENCE_DATABASE_URL`, per-job keys `job:evidence_capture` / `job:prediction_settlement`, fail-closed in production (`lib/jobs/locks.ts:27-95`). Discovery+selection+processing all run inside this held lock (INV-L). A future import job must hold the same authority (both keys, or a superset) to fence live writers.
- **Append-only / no conditional update:** there is **no** update path anywhere in the frozen adapters; corrections are appended revisions. This is the single most important Postgres-forward property Stage 2 preserves — it keeps the store a pure immutable log with no divergence-resolution policy.
- **Hash-faithful timestamps (carried G5):** `recordedAt`/`settledAt` (validation) and `capturedAt` (odds) participate in `contentHash` and are normalized ISO at mint. A future Postgres adapter MUST store the hashed instant as verbatim `TEXT` (mirror `TIMESTAMPTZ` for queries) or re-serialization breaks the hash. Stage 2 does not change this; it is a future-adapter requirement.

**Stage 2 verified non-blocking to Postgres:** identity is content/coordinate-derived (never file-offset); no NDJSON line order is business identity; single append per record; no dual-write; adapter-neutral producer (`EvidenceArchiveStore`/`OddsArchiveStore` interfaces, not the file adapter directly — spec §4.0, arch review §18). The cutover remains a later reversible env flip.

---

## 6. Importer Requirements (future NDJSON → PostgreSQL)

Defined here for the future milestone; Stage 2 must produce data that satisfies these (it does).

1. **Order independence** — reconstruct order from `sequence`/`previousSnapshotId` (snapshots), `revision`/`supersedesRevisionId` (validations), deterministic comparators (odds/provider). File order is not authoritative.
2. **Duplicate handling** — idempotent on the immutable PK + `content_hash`: same id+hash → no-op; same id + different hash → `immutable_violation` → quarantine (never first-wins).
3. **Partial-pair handling** — reconcile each snapshot against its mandatory `evidence_capture` odds rows; a snapshot missing its pair is flagged, never auto-invented (self-healing is a *runtime* re-fire concern, not an import fabrication).
4. **Corrupt-line policy** — read **fail-closed** (reuse the strict adapter semantics, never a fail-open reader); quarantine the file/line with errno + line number; never rewrite/repair.
5. **Content-hash validation** — recompute and compare via the frozen verifiers (`verifyEvidenceChain`, `verifyOddsRecord`, `verifyProviderArchiveRecord`, `verifyValidationChain`) before and after import.
6. **Identity validation** — re-derive `snapshotId`/`captureId`/`validationId`/`inputContentHash` from row fields and assert equality (state, not assume).
7. **Revision history** — rebuild from rows (`DISTINCT ON (id) ORDER BY revision DESC` = current); never re-derive outcomes; preserve every revision.
8. **Terminal settlement states** — preserve the full `ValidationState` enum `{pending, won, lost, void, cancelled, postponed, abandoned}` verbatim (`validation.ts:63-70`).
9. **`correctionCause` / reason codes** — preserve `reasonCode` (`data_correction`/`settlement_correction` and the terminal reason codes) and `note` verbatim; do not recompute.
10. **Audit report** — per-type / per-fixture / per-capture / per-revision reconciliation counts matched source↔target; refuse cutover on any unresolved inconsistency (orphan validation, missing pair, hash conflict, broken chain).

**Existing infrastructure note (verified):** `scripts/rehearse-migrations.mjs` rehearses `db/migrations/*.sql` against a staging DB and **refuses prod-looking URLs**; `db/migrations/` contains `create_provider_snapshots.sql` and `create_odds_history.sql` for **other** subsystems. **No evidence-archive Postgres adapter, migration, or importer exists** (`grep createPostgres` over `lib/archive/evidence` + `lib/evidence-capture` → none). The importer above is future work (§14); Stage 2 must not smuggle it in.

---

## 7. Retention and Compaction

**Current reality:** no adapter prunes or compacts today (retention is an operational gate — M9 closure H-4, contract §2.D "odds archive is bounded; retention limits mandatory"). Reads are whole-file O(A) scans.

**Stage 2 dependence on completeness (the key long-term coupling):** M10's correctness rests on **archive-as-sole-checkpoint** (INV-A). `already_captured`/`already_settled` and the anti-starvation ordering are *recomputed every fire from the archive*. Therefore:
- **Full scans without a cursor are intended** (INV-A) — they are the checkpoint, not a defect. They are bounded per run by the ceilings (§7.2) + single-read (§7.2 "single bounded archive read per run").
- **Retention/compaction MUST be append-only-safe.** Deleting a snapshot within the active horizon would break the full-stream idempotency check → a later fire re-mints with `sequence = last+1`, producing a **genuinely different** `snapshotId` (a second capture), not a duplicate no-op. Deleting an `evidence_capture` odds row would make a complete window look partial → a healing re-emit. So retention must **never delete within the replay/checkpoint horizon** — it may only **cold-archive** (move, not drop) records that are past their capture window *and* fully settled, and only physical-duplicate-line compaction (same id+hash, already collapsed on read) is unconditionally safe.

**What can be added later WITHOUT changing semantics (MC-4):**
- Physical de-duplication of byte-identical lines (readers already collapse them).
- Time-partitioned **cold storage** of fully-settled, past-window fixtures — safe for new-candidate derivation (forward-only means their windows are `expired`), provided the cold set stays available for replay/verification/import.
- An archive-size warning at ~50 k lines / ~10 MB (spec §9.3) and the Postgres cutover as the real scaling remedy (turns O(A) scans into O(log A) indexed lookups).

**Long-lived NDJSON + duplicate historical records + corrections** do **not** require format change — duplicates are idempotent, corrections are additive revisions. They require only the bounded-read discipline and the future cutover; retention is out of M10 scope but M10 **must not assume pruning happens** (MC-4).

---

## 8. Reversibility and Rollback

Verified reversible on every axis; Stage 2 preserves the M9 dormant-rollback posture (M9 closure §10, M10 closure §14):

| Mechanism | Status |
|---|---|
| **Flags off** | `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED` default-off (`config.ts:80-81`); a disabled fire short-circuits before the lock (`runner.ts:288-289,325-326`) → empty safe pass, no discovery, no write. |
| **No scheduler change** | Routes are in-repo; scheduling is an out-of-repo operational action (spec §2.2). Rollback = unschedule; no code change. |
| **Dormant provider path** | The Stage-1 provider is invoked by nothing until Stage 2 wires it; even wired, it runs only inside an enabled, lock-held fire. Dormant by default. |
| **Unchanged archive records** | Producer writes nothing of a new shape; append-only; no rewrite/mutation/delete path exists. |
| **No destructive migration** | No Postgres cutover, no data transformation. Nothing to reverse. |
| **No cursor state** | INV-A: nothing persisted between fires (verified grep-clean). No divergent state to unwind. |
| **Replay from archive** | The M7 serialization-boundary replay reconstructs Evidence Inputs + `contentHash` under the original `modelVersion` from retained provider+odds (must continue to pass over M10 output — DoD A4). |

**Conclusion:** rollback of M10 activation is a **configuration action (flags off / cron unscheduled), not a code revert, and requires no data cleanup.** The append-only archive guarantees no orphaned or half-migrated state.

---

## 9. Source/Provider Evolution

Where change is absorbed **without touching frozen identity** — verified against the layering:

| Evolution | Absorbing layer (change here, not in identity) | Compatibility mechanism |
|---|---|---|
| **Provider row schema change** | M4 normalization + `admitProviderArchive` (`routing/admission.ts`) | Normalized to the content-hashed `ProviderArchiveRecord`; identity is over the *canonical normalized* body, so raw-shape drift is absorbed before hashing. |
| **Renamed / new source statuses** | `resolveMatchLifecycle` (`lib/fixtures/status.ts`), called identically by M8 and the Stage-1 classifier (`eligibility.ts:185`) | An unknown status resolves to `unavailable` → `unsupported_outcome_state` **deferred/rejected fail-closed** — never a wrong settle. Add the mapping in the resolver, not in identity. |
| **New market** | Closed registry `§2.B` (frozen) | Requires a registry change = a frozen-contract change = **out of M10**. Until then the classifier rejects unknown markets (`unsupported_market`). No silent widening. |
| **`sourceVersion` / `evidenceInputVersion` change** | `input-identity/version.ts` (fail-closed on unsupported) | Version participates in `inputContentHash`; a new version is an append-only addition to the supported set — no silent cross-version collision. |
| **`modelVersion` change** | M5 derivation + capture (`modelVersion` defaults to frozen v1; never invented — `candidates/types.ts:171-176`) | Excluded from `inputContentHash` and `snapshotId`; a new model mints a **new snapshot chain** → old/new coexist, no reinterpretation, replay pins by `modelVersion`. |
| **Competition mappings** | Provenance passthrough (`competitionId`/`seasonId`) + `supportedCompetitions` config filter (`candidates/types.ts:165-166`) | Provenance only; not in identity. Remapping changes a filter, not a hash. |
| **Late corrections** | M8 revision path + enriched settlement state (MC-1) | Appends a new revision; requires current-outcome-per-market state (§10). |
| **Missing terminal timestamp** | `deriveCompletionInstant` (injectable; default = deterministic kickoff, `candidates/types.ts:276-277`) | `FootyMatchRow` carries no explicit terminal instant; the deterministic kickoff default keeps `recordedAt`/`settledAt` idempotent. A precise instant may be injected in Stage 2 (R5) — must stay deterministic. |

**Principle:** every source/provider drift is absorbed in the **adapter/classifier/normalization** layer (M4, `resolveMatchLifecycle`, M5, provenance passthrough). **No drift is ever allowed to change a frozen identity/hash formula** (spec R8, contract §5.1: escalate, never amend). This is exactly what keeps historical records importable across years of source evolution.

---

## 10. Correction and Revision Compatibility

Inspected M8 (`settlement.ts`, `outcomes.ts`) and the validation contract.

- **What Stage 2 MUST preserve now:** the ability to append a **first** terminal settlement for every legitimately-terminal fixture — including lifecycle terminals (`postponed`/`cancelled`/`abandoned`) that M8 settles to a **written** `terminal_non_scored` record. This was the Stage-1 blocker **BF-S1**, now **resolved** (`m10-stage-1-candidate-provider-foundation.md` §13; classifier calls `resolveMatchLifecycle`, verified `eligibility.ts:185`; full suite 1735/1735). Without it the archive permanently under-settles.
- **Richer archive state it must expose (MC-1):** to append a *correction* revision, M8 requires an explicit `correctionCause` only when `head.state !== outcome.state` (`settlement.ts:301`). Detecting that needs **current-outcome-per-(fixture,market)** — the enrichment of the thin `SettlementArchiveState` (§4), derived from existing `ValidationRecord` fields, no new column.
- **Can corrections be safely deferred?** **Yes, partially and explicitly.** First-settlement is *not* lost (BF-S1 fixed), so deferring *later-correction propagation* to a subsequent Stage-2 increment is a bounded completeness gap, not data loss — **provided it is documented and gated**. But **terminal lifecycle transitions that constitute a correction** (e.g. a `finished` won/lost fixture later `abandoned`, or a scored result reinterpreted) **do** require the correction path; shipping settlement wiring that can *never* correct would leave a stale terminal head. Recommendation: land correction support with the enriched state (MC-1) in the same Stage-2 settlement increment, or explicitly scope + meter it and block go-live on unresolved corrections.
- **Future PostgreSQL uniqueness implications:** `UNIQUE(id, revision)`; `revision` monotonic 1-based; current head = MAX(revision); `supersedes_revision_id` chain preserved; `reasonCode`/`note` verbatim. Corrections are new rows — **no update path** — which is the property that keeps the log immutable and the importer trivially idempotent.

---

## 11. Pair-Completeness Compatibility

The mandatory snapshot+odds pair (contract §4.7, DoD 5) remains representable and **self-healing** in both stores:

- **NDJSON:** deterministic `captureId` reconstructed from the snapshot alone (`mandatory-odds.ts:48-59`); pair completeness = snapshot + ≥1 `evidence_capture` odds row for that `captureId`. A snapshot-only window is `partialWindowKeys` and is **re-emitted for healing** (idempotent odds append) rather than rejected (Stage-1 §5, impl review I6 PASS). Conflicting pair → `immutable_violation` fail-closed. Detectable, healable, fail-closed — no state to drift.
- **Postgres:** the same reconstructed `capture_id` join; an importer flags any snapshot with zero mandatory odds rows per supported market; self-healing is an idempotent runtime re-fire (`INSERT … ON CONFLICT DO NOTHING`), never an import fabrication.
- **Stage 2 obligation:** derive `capturedWindowKeys` vs `partialWindowKeys` from a single bounded read of snapshots + odds under the lock (INV-A/INV-C); a corrupt/unreadable odds file must **defer**, never be treated as "no odds" (which would falsely re-heal or, worse, look complete). Verified the strict reads make this fail-closed.

Pair completeness is fully compatible across both stores and requires no format change.

---

## 12. Long-Term Risks

| Risk | Assessment | Control (present / required) |
|---|---|---|
| **Archive growth / O(F²) scans** | Real at scale (perf review; capture is the steeper curve due to per-market odds `readAll`). | Bounded ceilings ≤150 + single bounded read/run (MC-5); Postgres cutover is the documented escape hatch (spec §9.4). Not a *compatibility* blocker. |
| **Schema drift under pressure** | Would break importability if a frozen record changed. | Producer-only; DoD "no frozen contract modified"; escalate-don't-amend (contract §5.1). |
| **Source drift / provider identifier change** | Absorbed in M4 normalization + `resolveMatchLifecycle`; never in identity (§9). | Content-hash over normalized body; unknown status fail-closed. |
| **Status enum expansion** | `ValidationState`/`ValidationReasonCode` are **additive** enums ("new codes never remove old ones", `validation.ts:70`). | Forward-compatible; a *new* state must be handled by the future importer + calibration, not by M10. |
| **Deterministic timestamp fallback** | `completionInstant` defaults to kickoff and is **hashed into** `ValidationRecord.contentHash` (via `recordedAt`/`settledAt`). If the fallback derivation *changes across code versions*, a replay of an already-settled record re-derives a different hash (a replay divergence, **not** a stored rewrite — the record stays). | **Freeze/version the completionInstant derivation once settlement is activated** (MC-3 corollary); store hashed instants as verbatim TEXT in Postgres (G5). |
| **Replay across code versions** | `modelVersion` pins snapshot replay; but `completionInstant`/`nowSec` are M10-owned and unversioned. | Determinism (MC-3) + freezing the derivation; A4 replay test extended to M10 output. |
| **`modelVersion` omission** | Safe — omitted ⇒ frozen default `"23B.daily-evidence.v1"`; never invented (`candidates/types.ts:171-176`, contract §4.9-R3). | No action. |
| **Duplicate records** | Idempotent everywhere (full-stream check; `noChange`; `ON CONFLICT`). | No action. |
| **Migration after years of data** | Bounded per-run reads + additive append-only records + engine-independent hashing make a one-shot offline import feasible; cold-storage keeps the working set bounded. | Future importer (§6) + retention/cold-storage discipline (MC-4). |

No long-term risk requires a format change; each is controlled by the bounded/determinism/retention discipline or is explicitly a future-Postgres concern.

---

## 13. Blocking Compatibility Conditions

These are the conditions Stage 2 MUST satisfy to remain migration-compatible. **All are non-format-changing** and most are already mandated by the spec/architecture review — this review adopts them as compatibility gates.

- **MC-1 — Correction-capable settlement state (from existing fields).** Stage 2 must derive settlement progress as *current-outcome-per-(fixture, market)* by reading existing `ValidationRecord` fields (`state`, `revision`, `marketKey`, `selectionKey`, `snapshotId`), enriching the thin Stage-1 `SettlementArchiveState`. This is required so genuine corrections propagate and **so no future format evolution is ever forced** by a lossy progress model. **No new archive field.** (§4, §10; impl review §15/§16, I14; spec R6.)
- **MC-2 — Archive-as-sole-checkpoint, no persisted cursor (INV-A) + discovery-inside-lock (INV-L).** Progress recomputed from durable archive state every fire; no process-local/filesystem/request cursor is ever authoritative; discovery+classification+selection+processing all inside the held durable lock. A persisted cursor would create a divergent, non-importable state surface. (§7, §8; spec §7.1/§7.5, arch review §10/§14.)
- **MC-3 — Strict determinism at the producer boundary.** Every candidate field is a pure function of retained/source data + the injected `evalInstant`; no `Date.now`/`Math.random`/ambient-config leak. `capturedAt`, `completionInstant`, `nowSec` deterministic. Otherwise replay and `inputContentHash` break at the boundary M10 owns — the frozen M6/M7/M8 guarantees fail. The completionInstant derivation must be frozen/versioned once activated. (§12; spec §5 determinism note, DoD A2/A4.)
- **MC-4 — Append-only-safe retention only.** Stage 2 must not assume pruning; any future retention/compaction may cold-archive (move, never delete) only fully-settled, past-window records, plus physical duplicate-line compaction. Deleting within the replay/checkpoint horizon breaks INV-A and forward-only sequence monotonicity. (§7.)
- **MC-5 — Single bounded archive read per run under bounded ceilings.** Capture ≤150 (default 100, clamp, never the 500 default), symmetric settlement ≤150; one bounded read/run, classify in memory. Keeps the O(F²) file-adapter cost from forcing a premature/unsafe cutover and keeps each fire inside the 60 s route budget. (§7.2/§9.3; M9 closure H-2/H-3.)

---

## 14. Non-blocking Future Work

Recorded for the future milestone; **not** owed by M10 and **not** a compatibility blocker:

1. **Evidence Postgres adapter + reversible cutover** — indexed lookups replace O(A) scans; a later env flip (out of M10; spec §9.4).
2. **Fail-closed NDJSON→Postgres importer tooling** (§6) — reconciliation + frozen-verifier re-runs; refuse cutover on any inconsistency. (M9 closure H-5.)
3. **Hash-faithful TEXT timestamp storage (G5)** in the future adapter — verbatim TEXT for hashed instants; mirror `TIMESTAMPTZ`.
4. **Retention / cold-storage policy** for the odds archive (bounded, contract §2.D) and past-window snapshots — append-only-safe per MC-4. (M9 closure H-4.)
5. **Precise `completionInstant` injection** when the source exposes a true terminal instant (spec R5); keep deterministic and frozen.
6. **A4 replay test extension** over M10-produced captures; **determinism static rule** forbidding `Date.now`/`Math.random` under `lib/evidence-capture/` (spec R1).
7. **H-1 `pg_advisory_unlock` 500-misreport** swallow/log fix (low severity; PG lock path).

---

## 15. Final Verdict

# MIGRATION CONDITIONALLY COMPATIBLE

The proposed M10 Stage 2 orchestration is **archive-format compatible, identity compatible, Postgres-forward, replay-deterministic, reversible, importable, retention-safe, and independent of persistent cursors** — verified from source, not from the hand-off summary. It is a producer-only wiring that feeds the two **frozen** consumer objects into the built M9 runners and touches **no** record type, field, identity/hash/revision formula, or archive format. Every record it causes to be written is a frozen M6/M8 builder output: content-addressed, self-describing, append-only, NDJSON-authoritative, and reconstructable — so it preserves the safe future NDJSON→Postgres cutover and creates no non-migratable or irreversible data.

The single substantive finding is that **all normalized state Stage 2 needs is derivable from the current NDJSON records with no new field** — the only insufficiency is the thin Stage-1 `SettlementArchiveState` *projection type*, which Stage 2 must enrich by reading fields the `ValidationRecord` already stores (MC-1). **No archive-format evolution is required for M10.**

Compatibility is conditioned on **MC-1…MC-5** (§13), every one of which is non-format-changing and already mandated by the spec/architecture review: correction-capable settlement state from existing fields; archive-as-sole-checkpoint with no cursor and discovery-inside-lock; strict producer determinism; append-only-safe retention; and single bounded reads under bounded ceilings. The future Postgres adapter, importer, hash-faithful TEXT timestamps, and retention policy (§14) are out of M10 scope and are not blockers.

**On the migration/compatibility axis, M10 Stage 2 introduces no blocker and may proceed after Stage 1 is formally re-approved** (the Stage-1 implementation review's BLOCKED verdict was raised solely on BF-S1, which is now resolved and green — full suite **1735/1735**, targeted candidate provider **48/48**, typecheck exit 0, lint clean, re-run this pass). Sign-off of the other five Stage-1/Stage-2 reviews and the Gate A/B + benchmark closure remains governed by the spec, not by this migration review.

---

### Test evidence (re-run this pass, 2026-07-30, read-only)

| Suite | Command | Result |
|---|---|---|
| Stage-1 candidate provider | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceCandidateProvider.test.ts` | **48 pass / 0 fail / 0 skip** |
| Full suite | `npm test` | **1735 pass / 0 fail / 0 skip** |

**Independently verified from source:** no cursor/checkpoint/offset state under `lib/evidence-capture`/`lib/jobs`/`lib/archive/evidence` (grep-clean); the Stage-1 provider performs no I/O and re-exports the frozen `CaptureRequest`/`SettlementCandidate` type-only (`candidates/types.ts`); BF-S1 fix present (`eligibility.ts:185` `resolveMatchLifecycle`); strict fail-closed reads on all three archives; no evidence Postgres adapter/migration/importer (`grep createPostgres` → none; `db/migrations` + `rehearse-migrations.mjs` target other subsystems only); frozen record shapes unchanged (`types/evidence/snapshot.ts:113`, `types/evidence/validation.ts:48`). **No runtime code, test, existing document, archive format, schema, flag, cron, environment, or deployment was modified in producing this review.**
