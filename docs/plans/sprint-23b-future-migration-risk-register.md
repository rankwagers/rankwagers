# Sprint 23B — Future Migration Risk Register (non-binding)

**Status:** RECORDED — non-binding risk register. Accepted 2026-07-28.
**Scope:** forward-looking migration risks only. This document does **not** authorize code
changes, contract changes, or redesign. It is a governance record for future phases.
**Companion:** `docs/plans/sprint-23b-evidence-capture-settlement.md` (implementation plan).

## Governing constraints (binding on every entry below)

1. NDJSON is permitted **only** as an initial adapter. It must **not** become the sustained
   production archive at scale.
2. **Postgres readiness is required before sustained Evidence Capture production.**
3. Historical readers must preserve compatibility with **every** emitted `schemaVersion` and
   `modelVersion` — no version may be dropped from read support.
4. Future provider identity migration is a **long-term** risk, not a current Phase 2.7 redesign.
5. **No existing immutable identifier or snapshot shape may be changed in this phase.**
6. Any future hash-canonicalization compatibility must be handled **without modifying archived
   snapshot bodies** (no `hashAlgoVersion` or any new snapshot field — explicitly forbidden).

Every "current action" and "deferred action" below is constrained by the six rules above.

---

## Ranked register (most urgent first)

### R1 — NDJSON store degrades super-linearly; not viable as sustained production archive 🔴
- **Risk:** `lib/archive/evidence/file.ts` holds the whole archive in two monolithic files with no
  partitioning; `appendSnapshot` full-reads the file before every write (O(N) append, O(N²) build).
  Output caps bound reads, not input.
- **Trigger:** steady daily-list capture accumulation. Reached well inside the 3-year horizon.
- **Earliest phase affected:** Phase 3 (capture writes begin); becomes acute at Phase 5 (cron cadence).
- **Mitigation deadline:** **before sustained Evidence Capture production** — i.e. Postgres adapter
  (Phase 6) must be ready and verified before `EVIDENCE_CAPTURE_ENABLED` runs as a durable
  production pipeline (per Constraints 1 & 2).
- **Current action:** treat NDJSON as initial/staging adapter only; gate sustained production on
  Postgres readiness; monitor archive file size + append latency via Phase 9 diagnostics.
- **Explicitly deferred action:** NDJSON partitioning/rotation/compaction — **not** pursued; the
  sanctioned escape is the existing planned Postgres cutover, not investment in the file store.

### R2 — Content-hash canonicalization is code, not data; a silent mass-tamper landmine 🔴
- **Risk:** `contentHash = sha256(canonicalizeEvidence(body))` (`lib/evidence/hash.ts`); the
  canonicalization algorithm is unversioned code. `verifyEvidenceContentHash` recomputes at read
  time and treats a mismatch as `immutable_violation`. Any drift fails **all** historical rows at once.
- **Trigger:** any change to canonicalization semantics — key-sort, number/unicode normalization, or a
  `JSON.stringify` behavior shift across a Node major upgrade (multiple expected over 3 years).
- **Earliest phase affected:** Phase 8 (readers/integrity checks); latent from first write onward.
- **Mitigation deadline:** **before** the first canonicalization change or Node-major upgrade that
  touches serialization behavior post-launch.
- **Current action:** freeze `canonicalizeEvidence` semantics; pin/track the Node major used for
  hashing; document the canonicalization contract as change-controlled. Verification of historical
  rows must continue to succeed under the algorithm in force when they were written.
- **Explicitly deferred action:** adding `hashAlgoVersion` (or any snapshot field) is **forbidden**
  (Constraint 6). Future algorithm-version disambiguation must live **outside** the snapshot body —
  e.g. an external reader-side algorithm registry keyed by `schemaVersion`/write-epoch — and must
  never rewrite archived bodies.

### R3 — Version fields are stamped but no reader dispatches on them 🟠
- **Risk:** `EVIDENCE_SCHEMA_VERSION` / `EVIDENCE_MODEL_VERSION` / `VALIDATION_SCHEMA_VERSION`
  (`lib/evidence/constants.ts:12`) are stamped at mint (`snapshot.ts:277-279`), but no code branches
  on version. A mixed-version archive accumulates with no negotiation layer.
- **Trigger:** first `schemaVersion` or `modelVersion` bump that requires reading old rows differently.
- **Earliest phase affected:** Phase 8 (historical readers / API routes).
- **Mitigation deadline:** **before** the first schema or model version increment.
- **Current action:** enforce Constraint 3 — every reader must accept every emitted `schemaVersion`
  and `modelVersion`; add a read-compatibility regression test that pins the current version set as a
  floor. No version may be dropped from support.
- **Explicitly deferred action:** building the full version-dispatch/compatibility-matrix layer —
  deferred until a real version increment exists; recorded here so it is not "discovered" late.

### R4 — Snapshot identity has no model dimension; multi-model capture is inexpressible 🟠
- **Risk:** `evidenceSnapshotId = f(fixtureId, capturedAt, sequence)` (`lib/evidence/identifiers.ts:27`)
  has no model input, and each `SupportedMarket` holds one `modelProbability`. Champion/challenger or
  ensemble capture at the same window collides on id. Separately, bumping `EVIDENCE_MODEL_VERSION` and
  re-capturing a window yields the same id but a different `contentHash` → `immutable_violation`.
- **Trigger:** introducing concurrent/competing models, or a model-version bump over an already-captured window.
- **Earliest phase affected:** none in Sprint 23B (single-model). A future multi-model sprint.
- **Mitigation deadline:** before any multi-model / champion-challenger capture is scheduled.
- **Current action:** document that Sprint 23B is single-model-per-window; a model-version change must
  target a **new** capture window, never re-mint an existing one (avoids `immutable_violation`).
- **Explicitly deferred action:** any change to the identity function or snapshot shape to carry a
  model dimension — **forbidden this phase** (Constraint 5); deferred to a future contract sprint.

### R5 — Fixture identity is welded to one provider's id space 🟠
- **Risk:** `EvidenceSnapshot.fixtureId: number` is the identity anchor and equals the FootyStats
  `matchId`. Provider-level enums (`ProviderName` etc., `lib/providers/reliability/types.ts:1`) are
  closed unions. No cross-provider fixture-identity mapping layer exists; immutable rows can't be re-keyed.
- **Trigger:** sourcing fixtures from a second provider, or FootyStats reassigning/retiring match ids.
- **Earliest phase affected:** none in Sprint 23B. Long-term only.
- **Mitigation deadline:** before onboarding a second fixture-identity provider (long-horizon).
- **Current action:** none required now — recorded as a **long-term** risk per Constraint 4; keep
  provider identity assumptions documented at the capture choke-point (`identity.numericFixtureId`).
- **Explicitly deferred action:** cross-provider identity mapping and any provider-enum widening —
  **explicitly not a Phase 2.7 redesign** (Constraint 4); deferred.

### R6 — Immutability vs. column promotion; hash-frozen rows can't be reshaped 🟡
- **Risk:** the planned Postgres mirror (Phase 6) stores some fields as scalar columns and the rest as
  JSONB. Promoting a JSONB field to a queryable column later leaves historical immutable rows
  un-backfillable → a permanent NULL cliff at the schema-version boundary. Because `contentHash`
  covers `schemaVersion`/`modelVersion` (inside `body`, `snapshot.ts:279`), old rows are hash-frozen and
  cannot be mechanically reshaped in place.
- **Trigger:** first schema evolution that needs a previously-JSONB field to be independently queryable.
- **Earliest phase affected:** Phase 6 (Postgres schema) and any later additive migration.
- **Mitigation deadline:** before the first column-promotion migration.
- **Current action:** document that queries over promoted columns are valid only for rows written at or
  after the promoting `schemaVersion`; readers must treat pre-promotion rows via JSONB, not the column.
- **Explicitly deferred action:** any in-place backfill or row rewrite — **impossible by construction
  and forbidden** (Constraint 5). Non-additive needs must use a parallel store/projection, never a
  mutation of archived bodies.

---

## Summary of what stays frozen this phase

- `EvidenceSnapshot` and all `types/evidence/*` contracts — **unchanged**.
- No `hashAlgoVersion` or any new snapshot field.
- No change to `evidenceSnapshotId` / `validationId` / `validationRevisionId` or `contentHash` semantics.
- NDJSON permitted as initial adapter only; Postgres readiness gates sustained production.
- Readers preserve compatibility with every emitted `schemaVersion` and `modelVersion`.

FUTURE MIGRATION RISK REGISTER RECORDED
