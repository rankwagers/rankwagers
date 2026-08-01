# M10 Stage 2A — Strict Archive Discovery & Archive-State Normalization

**Document type:** Implementation-stage record (Stage 2A of M10).
**Date:** 2026-07-30
**Status:** Stage 2A implemented, **dormant, unwired**. **M10 is NOT complete.**
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1)
**Governing reviews:**
`docs/plans/m10-stage-2-production-safety-review.md`,
`docs/plans/m10-stage-2-performance-scalability-review.md`,
`docs/plans/m10-stage-2-test-verification-plan.md`,
`docs/plans/m10-stage-2-migration-compatibility-review.md`.
**Predecessor:** Stage 1 (`docs/plans/m10-stage-1-candidate-provider-foundation.md`) — pure
candidate provider, which *consumes* the normalized state this stage *produces*.

---

## 1. Scope

Stage 2A builds the **strict archive discovery + archive-state normalization** layer: pure,
reusable builders that read the durable evidence / odds / validation archives through a
**strict, injected whole-archive read port** and reduce them to the normalized progress state
the Stage-1 candidate provider consumes (`CaptureArchiveState`, `SettlementArchiveState`).

**In scope (this stage):**
- Strict archive discovery via an injected read port (single bounded read per store).
- Pure normalizers: raw records → normalized capture/settlement state.
- Reusable async builders combining port + normalizers, fail-closed.
- The MC-1 enrichment of the thin Stage-1 `SettlementArchiveState` projection type
  (current-outcome-per-market), plus the capture `orphanOddsWindowKeys` distinction —
  **both additive, no archive-format change**.
- Unit tests.

**Explicitly NOT in scope** (unchanged, untouched, verified): provider wiring, capture /
settlement runner integration, M6 / M8 internals, cron routes, schedulers, feature flags,
the durable lock, activation, deadline enforcement, diagnostics aggregation, Postgres, and
**any archive format / frozen-contract change**. The builders are **invoked by nothing** and
**connected to nothing** — a concrete port backed by the frozen file adapters, inside the
durable job lock, is a later orchestration stage.

## 2. Files

**Created:**
- `lib/evidence-capture/candidates/archive-state/types.ts` — strict read-port interfaces
  (`SnapshotReader` / `OddsReader` / `ValidationReader` and the `Capture` / `Settlement` /
  combined `EvidenceArchiveReadPort` compositions) + `ArchiveStateConflictError`.
- `lib/evidence-capture/candidates/archive-state/normalize.ts` — pure normalizers
  (`normalizeCaptureArchiveState`, `normalizeSettlementArchiveState`).
- `lib/evidence-capture/candidates/archive-state/builders.ts` — reusable async builders
  (`buildCaptureArchiveState`, `buildSettlementArchiveState`).
- `lib/evidence-capture/candidates/archive-state/index.ts` — barrel.
- `tests/evidenceArchiveStateBuilders.test.ts` — 25 unit tests.
- `docs/plans/m10-stage-2a-archive-normalization.md` — this record.

**Modified (additive only, backward-compatible):**
- `lib/evidence-capture/candidates/types.ts` — enriched the two normalized-state types:
  `CaptureArchiveState.orphanOddsWindowKeys?` and `SettlementArchiveState.currentValidationHeads?`
  (+ the new `ValidationHead` type). Both are **optional**; the Stage-1 classifier and
  `archiveStateOk` guard read only the pre-existing fields, so behaviour is unchanged.
- `lib/evidence-capture/candidates/index.ts` — re-export of the new builders/normalizers/types.

**No change** to any frozen contract (`types/evidence/*`, `EvidenceArchiveStore` /
`OddsArchiveStore` interfaces, identity/hash/revision formulas, archive record shapes), the
Stage-1 provider/eligibility/ordering/limits/diagnostics logic, M6/M8, cron, runners, locks,
flags, config, environment, or deployment. No existing test was modified.

## 3. Architecture

```
   STRICT READ PORT (injected; concrete impl is a later stage)
   ┌───────────────────────────────┐
   │ readAllSnapshots()            │  strict whole-archive reads:
   │ readAllOddsRecords()          │  ENOENT ⇒ [] ; malformed / EACCES / EIO /
   │ readAllValidations()          │  hash-conflict ⇒ THROW (never empty)
   └───────────────────────────────┘
                 │  one bounded read per store per run (PB-1)
                 ▼
   BUILDERS (this stage)                       NORMALIZERS (this stage, pure)
   buildCaptureArchiveState(port)   ─────────▶ normalizeCaptureArchiveState(snaps, odds)
   buildSettlementArchiveState(port)─────────▶ normalizeSettlementArchiveState(snaps, vals)
        │  Promise.all → first rejection            │  reduce into Sets/Maps; fail-closed
        │  propagates (fail-closed, never caught)   │  on conflicting immutable ids
        ▼                                           ▼
   CaptureArchiveState / SettlementArchiveState  →  consumed by the Stage-1 provider (later)
```

- **Adapter-neutral (spec §4.0):** the builders depend only on the abstract read port, never
  on the file adapter — Postgres-safe by construction.
- **Pure normalizers:** no I/O, no clock (`Date.now`/`Math.random` absent), no env, no hidden
  state, no identity minting. Snapshots and odds are joined on the frozen window-key shape
  `"<fixtureId>|<capturedAt>"` (identical to `captureWindowKey().key` and
  `OddsArchiveRecord.captureWindowKey`), so nothing is re-hashed here.

## 4. Normalized state

### Capture (`CaptureArchiveState`)
Per capture window `"<fixtureId>|<capturedAt>"`:
| State | Derivation | Field |
|---|---|---|
| **completed pair** | snapshot present **and** a `source==="evidence_capture"` odds row for the window | `capturedWindowKeys` |
| **snapshot only** | snapshot present, no mandatory odds row | `partialWindowKeys` (heal, never skip — AR-partial) |
| **odds only (orphan)** | mandatory odds row, no snapshot (cannot arise from the frozen path) | `orphanOddsWindowKeys` (descriptive; re-captured idempotently) |
| **duplicate pair** | identical id+hash lines | collapsed in the Sets (idempotent) |
| **never captured** | window absent from all three sets | (derived by the provider vs the source) |
| **corrupt/conflicting** | same snapshot/odds id, different contentHash | **throws `ArchiveStateConflictError`** |

A real operator quote alone does **not** complete a window — completeness keys on the reserved
mandatory `evidence_capture` observation (DoD-5).

### Settlement (`SettlementArchiveState`)
| State | Derivation | Field |
|---|---|---|
| **pending prediction** | captured snapshot, no terminal head | `capturedFixtureIds \ settledFixtureIds` |
| **already settled** | current head `state !== "pending"` | `settledFixtureIds` |
| **validation identity** | `validationId` (`id`) + `revisionId` per head | `currentValidationHeads[fixtureId][].{validationId,revisionId}` |
| **duplicate validation** | identical revisionId+hash; `MAX(revision)` wins | collapsed to the head |
| **correction/revision-capable** | current outcome per `(fixture, market)` — MC-1 | `currentValidationHeads` (state at head) |
| **corrupt/conflicting** | same revisionId different hash, or two revisionIds at one `(id, revision)` | **throws `ArchiveStateConflictError`** |

"Current" = `MAX(revision)` per `validationId` — derived at read time (there is no stored
`isCurrent`/`supersededBy`). `currentValidationHeads` is the MC-1 enrichment (from existing
`ValidationRecord` fields only) that lets a later stage detect a genuine correction and set
`correctionCause`, which the bare `settledFixtureIds` binary cannot express.

## 5. Invariants honoured

- **INV-A (archive is the sole checkpoint):** progress is derived purely from durable archive
  records; **no cursor / offset / checkpoint / cache** is created or read. No identity is
  derived from NDJSON line position (joins use record fields).
- **PB-1 (single bounded read per store per run):** each builder reads each store it needs at
  most once and classifies in memory — no per-fixture rescan, no O(F²) amplification.
- **SC-1 / AR-0 / SC-4 / DR-6 (strict, fail-closed reads):** the port contract mandates strict
  reads (ENOENT ⇒ empty; every other errno / malformed line / on-disk hash conflict ⇒ throw);
  the builders never catch, so corruption/IO failure can **never** be misreported as empty
  or zero-candidate progress. `Promise.all` short-circuits to the first rejection — no partial
  state is returned after a throw. The normalizers add a second fail-closed guard: conflicting
  immutable ids throw rather than collapse to an ambiguous state.
- **MC-3 (determinism):** no `Date.now`, no `Math.random`, no env, no wall clock, no
  environment-dependent ordering. Output is a pure function of the record inputs and
  order-independent (reduced into Sets/Maps; head lists sorted by `validationId`).
- **MC-1 (correction-capable settlement state, no format change):** enrichment reads only
  existing `ValidationRecord` fields; no archive record shape changes.
- **Frozen contracts preserved:** consumer objects, identity/hash/revision formulas, and
  archive formats are untouched; the two state-type changes are additive optional fields.

## 6. Tests

`tests/evidenceArchiveStateBuilders.test.ts` — **25 unit tests** (no integration tests):
- **Capture normalize:** empty→empty; complete pair; snapshot-only→partial; real-operator-odds
  does not complete; odds-only→orphan; duplicate collapse; multi-window independence;
  conflicting snapshot throws; conflicting odds throws; order-independence.
- **Settlement normalize:** empty→empty; pending (no validation); terminal→settled+head;
  correction→MAX(revision) head; multi-market deterministic ordering; pending-state head not
  settled; duplicate collapse; conflicting-hash throws; ambiguous-revision throws;
  order-independence.
- **Builders:** single bounded read per store (call counts asserted); strict-read throw
  propagates and rejects (never empty) for both capture and settlement; normalizer conflict
  surfaces through the builder.

## 7. Validation

| Check | Command | Result |
|---|---|---|
| New Stage-2A tests | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceArchiveStateBuilders.test.ts` | **25 pass / 0 fail** |
| Full suite | `npm test` | **1760 pass / 0 fail / 0 skip** (was 1735; +25) |
| Typecheck | `npm run typecheck` | **clean (exit 0)** |
| Lint | `npm run lint` | **clean — no ESLint warnings or errors** |

## 8. Activation status — explicit

The builders are **dormant library code, invoked by nothing**. No provider wiring, capture /
settlement runner integration, M6 / M8 change, cron change, scheduler change, feature-flag
change, lock integration, activation, deadline enforcement, diagnostics aggregation, Postgres
change, archive-format change, or deployment change was made. This document does **not** mark
M10 complete. Supplying a concrete strict read port (backed by the frozen adapters) and calling
these builders inside the durable job lock is a subsequent M10 stage.
