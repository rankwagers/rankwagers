# M8 — Settlement & Validation Revisions: Migration & Long-Term Compatibility Review

**Reviewer:** Claude 6 (migration / persistence / replay / long-term compatibility)
**Date:** 2026-07-29
**Scope:** Sprint 23B Milestone M8 (`lib/evidence-capture/outcomes.ts`, `lib/evidence-capture/settlement.ts`) plus the frozen contracts it depends on.
**Constraint honoured:** No runtime code modified. Documentation only.

**VERDICT: M8 MIGRATION CONDITIONALLY APPROVED.**

M8 introduces **no new persisted shape, no new identity, and no new stored field**. It composes only frozen builders (`createValidationRecord` / `reviseValidationRecord`), the frozen deterministic identifiers, and the frozen append-only store contract. Every migration-relevant value (`revisionId`, `revision`, `supersedesRevisionId`, `contentHash`, `recordedAt`, `settledAt`, `state`, `reasonCode`) is **self-describing inside each row** and derived clock-free. There is **no correctness blocker** to a file→Postgres migration or to distributed execution. The conditions below are activation/M9 gates and future-replay documentation, not defects in M8.

---

## 1. Migration summary

| Property | Finding |
|---|---|
| New persisted entity in M8 | **None.** M8 writes `ValidationRecord`s through the existing frozen store contract (`lib/archive/evidence/store.ts`). |
| New identity minted by M8 | **None.** `validationId` / `validationRevisionId` are frozen (`lib/evidence/identifiers.ts`). |
| Clock / RNG / locale in M8 identity | **None.** `settledAt = recordedAt = caller `completionInstant``; `nowSec` is a required integer; no `Date.now()`, `Math.random()`, or `localeCompare` in identity or hash. |
| Row self-describes its chain position | **Yes.** `revision`, `supersedesRevisionId`, `snapshotId`, `fixtureId` are stored in each row; none is derived from file/insert order. |
| Immutability enforced in substrate | **Yes.** Append-only contract: `(revisionId, contentHash)` idempotency; different hash on same id ⇒ `immutable_violation`; no update/delete path exists. |
| Migration determinism | **Byte-preserving and order-independent** (see §4). |
| Postgres adapter | **Not built yet** — deferred gate (§13, §14). `service.ts` branches only `memory` vs `file`. |
| Distributed execution | Safe by construction *once* a single-writer or per-`validationId` lock / `UNIQUE(revision_id)` is in place (§9). Currently dormant + single-writer. |

M8 is the smallest possible surface to migrate: it is a *pure producer* of already-frozen `ValidationRecord`s. The migration question is therefore almost entirely about the **store**, which was already reviewed under M2/M3; M8 adds only the settlement-specific chain semantics analysed in §5.

---

## 2. Relational mapping

Two tables. Snapshots are M6's concern (shown for the FK); M8 only writes the validations table.

### `evidence_validations` (the M8 write target)

| Column | Type | Source field | Notes |
|---|---|---|---|
| `revision_id` | `TEXT` | `revisionId` | **Primary key.** Globally unique per row; derived `f(validationId, revision)`. |
| `id` | `TEXT` | `id` (logical validationId) | Stable across revisions; grouping key. |
| `revision` | `INTEGER` | `revision` | 1-based, contiguous per `id`. |
| `supersedes_revision_id` | `TEXT NULL` | `supersedesRevisionId` | `NULL` at revision 1; else the immediate predecessor's `revision_id`. |
| `snapshot_id` | `TEXT` | `snapshotId` | **FK →** `evidence_snapshots(id)`. Enforces "no settlement of unrecorded evidence". |
| `fixture_id` | `BIGINT` | `fixtureId` | Query/index key; also on snapshot. |
| `market_key` | `TEXT` | `marketKey` | Part of `validationId` derivation. |
| `selection_key` | `TEXT` | `selectionKey` | Part of `validationId` derivation. |
| `state` | `TEXT` | `state` | CHECK against the 7 frozen states. |
| `reason_code` | `TEXT` | `reasonCode` | CHECK against the 8 frozen reason codes. |
| `note` | `TEXT NULL` | `note` | Correction rationale; non-empty required for `revision > 1`. |
| `recorded_at` | `TIMESTAMPTZ` **or** `TEXT` | `recordedAt` | See §4 warning — store as **TEXT** (verbatim) if it is part of the hash basis and any adapter might re-render it. |
| `settled_at` | `TIMESTAMPTZ` **or** `TEXT` NULL | `settledAt` | Same warning; `NULL` only for `pending` (which M8 never persists). |
| `recorded_by` | `TEXT` | `recordedBy` | Engine tag (`evidence_settlement`). |
| `schema_version` | `TEXT` | `schemaVersion` | `"23.0.0"`; part of hash basis. |
| `content_hash` | `TEXT` | `contentHash` | sha256 over the canonical body excluding this field. |

**"External / ingested" metadata (kept OUTSIDE the frozen hashed body):**

| Column | Type | Purpose |
|---|---|---|
| `ingested_at` | `TIMESTAMPTZ DEFAULT now()` | Row landing time. **Must never enter `content_hash`** or it breaks idempotency. |
| `import_batch_id` | `TEXT NULL` | Migration provenance/audit only. |

**Correction cause / lineage** (`CorrectionCause`, `authoritativeMarketVoid`) is **deliberately absent from the row** — the frozen `ValidationRecord` carries no lineage field, only the derived `reason_code` (`settlement_correction` / `data_correction`) and the deterministic `note`. If a future milestone wants richer lineage, it belongs in a **sidecar table keyed on `revision_id`**, never a new column inside the hashed body (see §6).

### `evidence_snapshots` (M6 — FK target, not written by M8)

PK `id TEXT`; `UNIQUE (fixture_id, sequence)`; `content_hash`, `previous_snapshot_id`, `model_version`, JSONB payload mirrors. M8 reads it only through `store.latestSnapshot` / `store.listValidations`.

---

## 3. Required indexes and constraints

```
-- identity / immutability
PRIMARY KEY (revision_id)
UNIQUE (id, revision)                       -- no duplicated revision number per validation
CHECK  (revision >= 1)
CHECK  (state IN ('pending','won','lost','void','cancelled','postponed','abandoned'))
CHECK  (reason_code IN ('awaiting_result','settled_result','market_void',
        'fixture_cancelled','fixture_postponed','fixture_abandoned',
        'data_correction','settlement_correction'))
CHECK  ((revision = 1) = (supersedes_revision_id IS NULL))   -- rev 1 ⇔ no predecessor
FOREIGN KEY (snapshot_id) REFERENCES evidence_snapshots (id) -- evidence-exists rule

-- read patterns
INDEX (fixture_id, id, revision)            -- listValidations + current-head derivation
INDEX (id, revision DESC)                   -- current-head query (max revision per id)
INDEX (snapshot_id)                         -- per-snapshot settlement lookup (accuracy/ROI)
```

**Query → mechanism mapping**

| Operation | SQL shape |
|---|---|
| Current head per validation | `SELECT DISTINCT ON (id) * FROM evidence_validations WHERE fixture_id=$1 ORDER BY id, revision DESC` (mirrors `currentValidationRevisions`). |
| Full chain of one validation | `... WHERE id=$1 ORDER BY revision ASC` (mirrors `revisionsOf`). |
| Snapshot settlement lookup | `... WHERE snapshot_id=$1 ORDER BY id, revision DESC`. |
| Latest-snapshot lookup | on `evidence_snapshots`: `... WHERE fixture_id=$1 ORDER BY sequence DESC LIMIT 1` (mirrors `latestSnapshot`). |
| Idempotent insert | `INSERT ... ON CONFLICT (revision_id) DO NOTHING RETURNING …`; **zero rows ⇒ read back and compare `content_hash`** → equal ⇒ `duplicate`, differ ⇒ `immutable_violation`. Matches `decideValidationAppend` and the house pattern in `lib/acca-publication/adapters/postgres.ts` (`UNIQUE_VIOLATION = "23505"`). |
| Immutable-violation detection | The read-back comparison above; `UNIQUE (revision_id)` makes it storage-enforced rather than convention. |

**Not expressible as a single constraint:** the "candidate.revision == head.revision + 1 **and** supersedes == head.revisionId" contiguity/linkage check (`decideValidationAppend`). `UNIQUE (id, revision)` blocks *duplicate* numbers but not a *gap* inserted concurrently. This requires a transaction that reads the head under a lock before inserting — see §9. `verifyValidationChain` remains the read-time backstop.

---

## 4. File-to-Postgres determinism analysis

**Result: migration is byte-preserving and import-order-independent, with one storage-format caution.**

Values and their determinism:

- **`contentHash`** — `evidenceContentHash` canonicalizes with **sorted keys, `undefined` dropped, arrays in order** (`lib/evidence/hash.ts`). It is independent of column order, row order, and storage engine. Copying the row verbatim reproduces the same hash on read-verify. ✅
- **`revisionId` / `id`** — `digest()` joins parts with `|`, `String()`-coerces, sha256, `slice(0,24)` (`lib/evidence/identifiers.ts`). No locale, no clock. ✅
- **`revision` / `supersedesRevisionId`** — **stored in each row**, never inferred from file position. Import can load rows in any order. ✅
- **`recordedAt` / `settledAt`** — normalized once at mint by `assemble()` via `new Date(Date.parse(x)).toISOString()` (`lib/validation/records.ts:124`). This is **clock-free and TZ/locale-independent** (always UTC `Z`, ms precision). The *normalized string* is what was hashed, so the stored string must be preserved **verbatim**.

**CAUTION (storage format).** Because `recordedAt`/`settledAt` are part of the hashed body as *strings*, storing them as Postgres `TIMESTAMPTZ` and letting an adapter re-serialize them (`.toISOString()` vs `to_char`, `+00:00` vs `Z`, trailing `.000`) risks a body that no longer hashes to the stored `content_hash` → spurious `immutable_violation`/verify failure on read. **Recommendation:** store `recorded_at`/`settled_at` as **`TEXT` (verbatim)** for the hash-faithful column, and *additionally* mirror to a `TIMESTAMPTZ` generated/secondary column for time-range queries. This is the same "hash-faithfulness" gate flagged for M2/M3/M6 and applies identically here.

**Values with NO file/insert/clock/locale dependency in M8 logic:** `currentValidationRevisions` selects by `max(revision)` (order-independent); settlement's decision to append/no-op compares `head.state` to the newly derived `state` (order-independent). Nothing in `settlement.ts` or `outcomes.ts` reads the archive's *read order* to make a decision. ✅

**One cosmetic, non-identity note:** the file/memory adapters order cross-`id` reads with `a.id.localeCompare(b.id)`; Postgres `ORDER BY id` uses column collation (e.g. `C` vs `en_US`). This can change the *interleaving of different validations* in a `listValidations` result but **never** the per-`id` revision order, any identity, or any hash. Consumers already group by `id`, so this is immaterial; pin the Postgres column to `COLLATE "C"` if exact cross-adapter read-parity is ever wanted (optional, §15).

---

## 5. Revision-chain migration analysis

The chain is fully self-describing, so migration = copy rows + re-run the existing verifier. Behaviour per anomaly:

| Case | Detected by | Behaviour |
|---|---|---|
| Initial revision (rev 1) | `revision===index+1`, `supersedes IS NULL` | Accepted. |
| Multiple corrections | contiguity + `supersedes == predecessor.revisionId` | Accepted when contiguous. |
| Missing revision (gap) | `verifyValidationChain` → `revision_gap` | **Fail-closed** — chain reported unverified. |
| Invalid `supersedes` pointer | `chain_broken` | Fail-closed. |
| Duplicated revision number | `revision_duplicate` (read) / `UNIQUE (id, revision)` (write) | Fail-closed. |
| Duplicated `revisionId`, same hash | `PRIMARY KEY (revision_id)` + read-back equal | Idempotent `duplicate`. |
| Same `revisionId`, different hash | read-back differ | **`immutable_violation`** (loud). |
| Multiple heads / fork | contiguity + single-predecessor linkage | Fail-closed (`chain_broken`). |
| Orphan correction (rev>1, no rev1) | `revision_gap` (first ordered row not rev 1) | Fail-closed. |
| Chain gaps generally | `revision_gap` + `chain_broken` | Fail-closed. |
| Content edited in place | `content_hash_mismatch` | Fail-closed. |
| `revisionId` not derivable from `id/revision` | `revision_id_mismatch` | Fail-closed. |
| Illegal state transition | `illegal_transition` (uses `canTransition`) | Fail-closed. |
| `recordedAt` regression | `timestamp_regression` | Fail-closed. |
| Missing correction note | `missing_correction_note` | Fail-closed. |

**Recommended import validation order (fail-closed):**
1. Load all rows for a fixture (any order).
2. Per row: verify `content_hash` (`verifyValidationRecord`) and `revisionId` derivability — reject the *migration* on any mismatch (never "repair").
3. Group by `id`; run `verifyValidationChain` on each (contiguity from 1, single-predecessor linkage, transition legality, `recordedAt` monotonicity, correction-note presence).
4. Verify FK: every `snapshot_id` exists in `evidence_snapshots`.
5. Commit a fixture's rows only if **all** of its chains verify; otherwise quarantine the fixture and alert. Do **not** partially import a broken chain.

`verifyAllValidationChains` already implements steps 2–3 over a mixed set and is the natural post-import gate. Import is **idempotent**: re-running against a partially-loaded target lands duplicates as no-ops via `(revision_id, content_hash)`.

---

## 6. M7 compatibility

M8 stays cleanly layered outside M7 input identity. Verified:

- **Settlement state is excluded from `inputContentHash`.** M7's `inputContentHash = "iih_" + hash({evidenceInputVersion, providerContentHash, oddsContentHashes})` (per `[[m7-historical-input-identity-failure-review-v2]]`). It never reads `ValidationRecord.state`, `reasonCode`, or any settlement output. ✅
- **Validation revision is excluded from M7 identity.** M7 keys on retained provider/odds record hashes only; adding revisions to a validation chain does not touch any M7 input. ✅
- **Correction reason is excluded from M7 identity.** `settlement_correction` / `data_correction` live only on the validation row. ✅
- **`modelVersion` remains separate.** It is a snapshot field, excluded from `inputContentHash` (M7) and **not copied into the validation row** at all. Model evolution cannot perturb settlement identity. ✅
- **Provider input lineage can evolve without rewriting settlement history.** A provider correction produces a *new* input record with a *new* `providerContentHash` → a new `inputContentHash`; the *already-written* validation revisions are immutable and untouched. A late correction is expressed as a **new revision** (`data_correction`), not an edit. ✅
- **Historical snapshot identity remains immutable.** `snapshotId` is content-derived and frozen; M8 references it, never re-mints it. ✅

**Future lineage metadata → M8 correction classification.** When M9 wires lineage, the mapping (`source_lineage_changed → data_correction`, `result_reinterpreted → settlement_correction`) should be fed as the **explicit typed `CorrectionCause` input** to `settleSnapshot` — exactly the seam M8 already exposes (R5). Any richer lineage record (which provider record superseded which, M7 `inputContentHash` before/after) belongs in a **sidecar table keyed on `revision_id`**, so it can grow without altering any frozen `content_hash`. This preserves M7's frozen identities while giving audit its lineage.

---

## 7. Provider / model evolution analysis

What each change does to *already-settled* history vs *future* settlement:

| Change | Effect on frozen history | Effect on new settlement |
|---|---|---|
| Provider schema version change | None (rows immutable). | New captures ⇒ new snapshots ⇒ new independent validation chains. |
| Score field change | None. | Feeds `isPredictionWin` at settle time; only affects rows written after. |
| Lifecycle enum expansion | None. | `resolveMatchLifecycle` maps new provider strings; unknown → non-terminal ⇒ `pending` (fail-safe, no write). |
| Delayed provider correction | None (old revision stays byte-identical). | Expressed as a **new correction revision** with explicit `CorrectionCause`. |
| Authoritative source replacement | None. | New source lineage ⇒ `source_lineage_changed → data_correction`. |
| Market mapping evolution | None. | `kindForMarketKey` gates support; unmapped market ⇒ `unsupported` (no write). New markets need a mapping entry (additive). |
| Selection naming evolution | None. | Only `selectionKey==="over"` is supported today; a new selection is `unsupported` until the mapping is extended. |
| `modelVersion` change after capture | None — not in the validation row. | New model ⇒ new snapshot ⇒ new `validationId` ⇒ independent chain; no collision, no re-settle of the past. |
| `evidenceInputVersion` change | None. | Participates in M7 `inputContentHash` only; settlement is unaffected. |
| Replay with an **older canonicalizer** | Would change `content_hash` of *re-derived* rows → mismatch. | See §8 — do not re-derive; replay from the stored rows. |
| Replay with an **older lifecycle resolver** | Could change derived `state` → different row. | See §8. |

**Versions that must be retained to reproduce a historical settlement decision** (i.e. to *re-derive* a row from provider inputs rather than read the stored row): the effective versions of `resolveMatchLifecycle`, `isPredictionWin`, `resolveHalfScores`, the market mapping (`markets.ts`), `determineCorrectionReason`, and the canonicalizer (`canonicalizeEvidence`). See §8 for the classification and the recommended way to avoid needing them.

---

## 8. Version-retention requirements (canonicalizer & code retention)

M8 stores **no** explicit version for its settlement logic; the only version stamped is `schemaVersion = "23.0.0"` (shape, not behaviour). The relevant question is whether deterministic replay needs the *old* logic versions.

| Retained artefact | Needed for normal operation? | Needed for **re-derivation** replay/rebuild? | Classification |
|---|---|---|---|
| Old lifecycle mapping (`resolveMatchLifecycle`) | No | Yes | Future replay requirement |
| Old score interpretation (`isPredictionWin`, `resolveHalfScores`) | No | Yes | Future replay requirement |
| Old market settlement/mapping version | No | Yes | Future replay requirement |
| Old correction classification (`determineCorrectionReason`) | No | Yes | Future replay requirement |
| Old canonical serialization (`canonicalizeEvidence`) | No | Yes | Future replay requirement / migration gate |

**Classification: acceptable for M8; a future migration/replay requirement; NOT a pre-activation gate for M8 itself; NOT a correctness blocker.**

Reasoning: M8 writes each row **once**; afterwards settlement is idempotent — an unchanged current outcome writes nothing (`no_change`), and a byte-identical re-settle is absorbed by `(revisionId, contentHash)`. Normal operation **never re-derives** a written row, so it never needs old logic versions. Re-derivation only matters if a future milestone **rebuilds the validation archive from snapshots by re-running settlement**, or replays settlement against historical provider rows after the logic changed.

**Recommended posture (and the reason no version field is needed inside the frozen row):**
- The **validation records are themselves the source of truth.** Archive rebuild (§12) must reproject *from the stored immutable rows*, not by re-running `resolveValidationOutcome`. This removes any dependency on retained code versions and is why injecting a `settlementLogicVersion` into the frozen body is **not** recommended (it would enlarge the frozen surface for no operational gain).
- If a *re-derivation* replay milestone is ever built, treat "retain the effective versions of the six functions above, keyed to the settlement window" as that milestone's pre-activation gate, and pin them by `modelVersion`/date rather than by mutating history.
- **Do document**, at first activation, the effective commit/version of these functions (a deploy manifest), so a future auditor can identify the logic that produced a given `recordedAt` window. This is a cheap documentation gate, not a schema change.

---

## 9. Distributed execution recommendations

Today M8 is dormant and single-writer; the frozen store is read-decide-append with **no in-process mutex** (documented in `file.ts` and R7). For future Postgres, per-scenario:

| Scenario | Risk | Minimal safe pattern |
|---|---|---|
| Two concurrent settlers, same snapshot, **identical** outcome | None — deterministic bytes | Both land the same `revision_id`; second is `duplicate`. Safe with no lock. |
| Two concurrent settlers, **competing** corrections (both read head=N, both write N+1) | Fork / gap | **Per-`validationId` lock** (`pg_advisory_xact_lock(hashtextextended(id))`) **or** `SERIALIZABLE`, around *read-head → insert*. Loser retries against the new head. |
| Stale read | Writes a revision that duplicates a number | `UNIQUE (id, revision)` rejects it as `23505`; treat as "chain advanced, re-read and retry", **not** fatal. |
| Transaction retry | Double insert | Idempotent on `(revision_id, content_hash)`; retried identical insert is a no-op. |
| Unique-key conflict (`23505`) | — | Read back, compare `content_hash`: equal ⇒ `duplicate`; differ ⇒ `immutable_violation` (terminal, do **not** retry). |
| Serializable transaction abort | — | Retry the whole read-head→insert; bounded attempts, then surface. |
| Outbox / event delivery of "settled" | Duplicate downstream events | Emit from the same transaction as the insert (transactional outbox), keyed on `revision_id`; consumers dedupe on it. |
| Exactly-once vs at-least-once scheduling | Duplicate settle attempts | Design for **at-least-once**: idempotency keys the whole flow on `revision_id`, so at-least-once scheduling is safe; exactly-once is not required. |

**Minimal recommended pattern (do not implement now):** wrap settlement of one snapshot in a transaction; take a **per-`validationId` advisory xact lock** (or run `SERIALIZABLE`); read the current head; build the record via the frozen builder; `INSERT ... ON CONFLICT (revision_id) DO NOTHING`; classify via read-back. `UNIQUE (id, revision)` + `UNIQUE (revision_id)` + `FK snapshot_id` are the storage-level backstops; `immutable_violation` stays loud, never downgraded (R7). This mirrors the existing transactional/optimistic pattern in `lib/acca-publication/adapters/postgres.ts`.

---

## 10. Accuracy / ROI compatibility

The state model is already built for this (`lib/validation/states.ts`):

- **Distinguishable outcomes:** `won`, `lost`, `void`, `postponed`, `cancelled`, `abandoned` are first-class `ValidationState`s (plus non-terminal `pending`). M8's `outcomes.ts` produces `won`/`lost` (scored), `postponed`/`cancelled`/`abandoned`/`void` (terminal non-scored), and `pending` (unwritten). ✅
- **Terminal non-scored excluded from metrics:** `isScoredValidationState` returns true only for `won`/`lost`; `isUnscoredTerminalState` marks `void`/`cancelled`/`postponed`/`abandoned`. Hit-rate, accuracy, ROI denominator, and loss count must gate on `isScoredValidationState`. The predicate exists and is the stated gate. ✅
- **Corrected historical metrics:** `currentValidationRevisions` (max revision per `id`) yields the corrected head; it is sufficient for "current truth" metrics. ✅

**Downstream consumer requirements (must be honoured by the future Accuracy/ROI milestone):**
1. **Use latest revision only** for live metrics (`currentValidationRevisions` / `DISTINCT ON (id) … ORDER BY revision DESC`).
2. **Retain all revisions** for audit and for "as-of" reconstruction (never delete superseded rows).
3. **Recompute aggregates after any correction** — a `data_correction`/`settlement_correction` can flip a `won`↔`lost` or move a fixture in/out of the scored set.
4. **Invalidate cached metrics** on new revision append (key caches by the max `revision_id` seen per fixture/period).
5. **Aggregate per-snapshot, then pick one snapshot per fixture.** Because `validationId` includes `snapshotId`, a fixture with multiple snapshots has multiple chains; metrics must select **one snapshot per fixture** (the latest, via `latestSnapshot`) to avoid double-counting. This is the single most important consumer rule and should be stated explicitly in the Accuracy milestone.

---

## 11. Retention requirements (what must never be discarded)

| Artefact | Retain? | Why |
|---|---|---|
| Evidence snapshots | **Never discard** | FK target; the settlement subject; replay/projection basis. |
| **All** validation revisions (incl. superseded) | **Never discard** | The immutable audit chain; "as-of" metrics; chain verification. Deleting a superseded row breaks contiguity (`revision_gap`). |
| Provider source data (M2) + odds (M3) | Retain per M2/M3 policy | Needed for M7 input identity and any re-derivation replay; also the `data_correction` basis. |
| Deterministic completion timestamps (`settledAt`/`recordedAt` strings) | **Never discard / never re-render** | Part of the hash basis; loss ⇒ unverifiable history (§4 caution). |
| Correction lineage (sidecar, if added) | Retain | Explains *why* each correction; keyed on `revision_id`. |
| M7 input-identity bindings | Retain once persisted | Ties a snapshot to its exact input basis; M9 gate G4. |
| Derived current-state projection | Discardable | Rebuildable from the immutable rows (§12). |

Append-only compaction is limited to **cold-partition archival**, never row deletion. Backup/restore and checksum verification reuse `verifyAllValidationChains` + per-row `verifyValidationRecord`; a restore is trusted only after the full chain verifies.

---

## 12. Archive rebuild strategy

**Rebuild current-state projections *from the immutable validation rows*, not by re-running settlement.** This is the key decision that decouples rebuild from code-version retention (§8):

1. Read all `evidence_validations` for the scope (fixture / period / all).
2. `verifyAllValidationChains` — abort and quarantine any fixture whose chain does not verify; never project from a broken chain.
3. Group by `id`; take `max(revision)` → current head (`currentValidationRevisions`).
4. Project metrics/accuracy/ROI over heads, gating on `isScoredValidationState`, one snapshot per fixture (§10).
5. For "as-of T" reconstruction, filter heads to `recordedAt <= T` before projecting — the immutable chain makes point-in-time truth reproducible.

Because every row is content-addressed and self-describing, this projection is **deterministic and independent of storage engine or import order**. Re-deriving outcomes from provider rows is reserved for a dedicated, version-pinned replay milestone (§8) and is **not** how routine rebuild works.

---

## 13. Migration blockers

**None.** No value in M8 depends on file order, insertion order, filesystem metadata, process time, locale, or unstable object ordering that would break a Postgres migration or a rebuild. The chain is self-describing and the hashing is canonical.

---

## 14. Pre-activation gates (carried into M9 / production)

These are activation conditions, not M8 defects — consistent with the M8 architecture/production reviews and the prior-milestone gate structure:

- **G1 — Deterministic completion-instant source.** M9 must wire `completionInstant` / `nowSec` to real terminal provider data (source-derived, never `Date.now()`). M8 already fails closed on a non-ISO instant / non-integer `nowSec`.
- **G2 — Single-writer or storage-level concurrency guard.** Before any concurrent settlement, add a per-`validationId` lock / `SERIALIZABLE` txn, or the Postgres `UNIQUE (revision_id)` + `UNIQUE (id, revision)` constraints (§9). Until then, keep settlement single-writer.
- **G3 — Flag-gated, default-off activation.** `EVIDENCE_SETTLEMENT_ENABLED` must be wired into the shared `FeatureFlags` framework and a scheduler gated on it (currently a dormant pure constant).
- **G4 — M7 input-identity binding retention.** First production activation must durably persist the M7 `inputContentHash` binding and couple mint↔binding (co-required with the M7 gate `[[m7-historical-input-identity-failure-review-v2]]` F-1).
- **G5 — Hash-faithful timestamp storage in the Postgres adapter.** Store `recorded_at`/`settled_at` as verbatim `TEXT` for the hashed body (mirror to `TIMESTAMPTZ` for queries) so re-serialization cannot desync `content_hash` (§4). Include a golden-vector round-trip test (write via file adapter → read via Postgres adapter → identical `content_hash`).
- **G6 — Settlement-logic version manifest (documentation).** At activation, record the effective commit/version of `resolveMatchLifecycle`, `isPredictionWin`, `resolveHalfScores`, `markets.ts`, `determineCorrectionReason`, and `canonicalizeEvidence` per deploy, so a future re-derivation replay can pin them (§8). No schema change.

---

## 15. Optional improvements (non-blocking)

- **`COLLATE "C"` on `id`** in Postgres if exact cross-adapter read-interleaving parity with the file adapter's `localeCompare` is ever wanted (identity/hash are unaffected regardless).
- **Lineage sidecar table** keyed on `revision_id` for `CorrectionCause` / pre- and post-`inputContentHash` (§6), so audit gains lineage without touching any frozen body.
- **Transactional outbox** for "validation settled/corrected" events keyed on `revision_id` (§9), enabling at-least-once downstream delivery with consumer dedupe.
- **Materialized current-head view** (`DISTINCT ON (id) … ORDER BY revision DESC`) refreshed on append, to serve Accuracy/ROI without repeated max-revision scans.
- **Post-import verification job** wrapping `verifyAllValidationChains` as a first-class migration acceptance gate (fail the import, don't repair).

---

## 16. Exact verification results

Run on 2026-07-29 in `/var/www/rankwagers`:

| Check | Command | Result |
|---|---|---|
| Full test suite | `npm test` | **1654 pass / 0 fail / 0 skipped**, exit 0 (`# pass 1654`, `# fail 0`). |
| M8 settlement + replay | included above (`tests/evidenceSettlement.test.ts`) | Pass — incl. `serialization-boundary settlement + revision replay survives real NDJSON` (writes → reads through the real `createFileEvidenceArchive` adapter → re-settles byte-identical (no new append) → applies one correction per market with earlier revisions byte-identical → repeat correction is a no-op → `postponed` never `lost`). |
| Chain / archive integrity | `evidenceArchive.test.ts`, `evidenceArchiveFileAdapter.test.ts` | Pass (part of the 1654). |
| Typecheck | `npm run typecheck` | **exit 0**, no errors. |
| Lint | `npm run lint` | **exit 0** — "No ESLint warnings or errors". |
| Stored serialized records | inspected `data/evidence-archive/*.ndjson` | Empty on disk (M8 dormant, nothing wired) — expected; tests generate and read real NDJSON through the file adapter at the serialization boundary, which is the migration-relevant path. |

---

## 17. Final verdict

# M8 MIGRATION CONDITIONALLY APPROVED

M8 is migration-safe by construction: it mints no identity, adds no stored field, and produces only frozen, content-addressed, self-describing `ValidationRecord`s through the append-only store contract. A file→Postgres migration is **byte-preserving and import-order-independent**; the revision chain is fully verifiable post-import via the existing `verifyAllValidationChains`; distributed execution is safe once a per-`validationId` lock / unique constraints are in place; M7 identities remain untouched; and Accuracy/ROI has the exact predicates it needs (`isScoredValidationState`, `currentValidationRevisions`). There is **no correctness or migration blocker**.

Approval is conditioned on the six activation gates in §14 — chiefly **G5 (hash-faithful timestamp storage in the Postgres adapter)** and **G2 (concurrency guard)** for the migration itself, plus **G1/G3/G4** carried from the M8/M7 activation work and **G6** (a documentation-only logic-version manifest for any future re-derivation replay). None requires a change to any frozen record, and none is owed by M8 in its current dormant form.
