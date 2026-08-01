# M6 — Evidence Capture (Snapshot Mint): Migration & Long-Term Compatibility Review

**Status:** RECORDED — documentation-only, non-binding. Review date 2026-07-29.
**Scope:** Milestone M6 ONLY (`lib/evidence-capture/capture/{capture,build,canonical,odds,index}.ts`; the frozen
mint path `lib/evidence/{snapshot,identifiers,hash}.ts`; append rules `lib/archive/evidence/{rules,store}.ts`;
`tests/evidenceCaptureMint.test.ts`). M6 is the **first milestone that mints the durable, immutable,
content-hashed `EvidenceSnapshot`.**
**Governed by:** `sprint-23b-implementation-contract.md` (§2.A/§2.C, §4.1/§4.2/§4.3, §4.9-R2/R3/G, §5.11),
`phase-2-7-implementation-plan.md` (M6). Companions: M2–M5 migration/failure reviews, `sprint-23b-future-migration-risk-register.md`.
**Constraints honored:** no runtime/contract change; no Postgres implemented; review confined to M6.

## What M6 actually is (from the code)
A **dormant, injectable** capture boundary. `buildCaptureSnapshot` (pure: no clock/IO/random) invokes M5
derivation, **canonically sorts** the hash-sensitive collections, and mints via the frozen
`createEvidenceSnapshot`. `captureEvidenceSnapshot(store, request)` gates on admission → validates
fixture/window/provider integrity → **full-stream idempotency pre-check** → derives `sequence` +
`previousSnapshotId` from the head → appends through the immutable store, mapping outcomes to a result
vocabulary (`created` / `already_exists` / `immutable_violation` / `archive_error` — never swallowed). The
store is **injected, never env-resolved**; nothing wires M6 to a scheduler/cron/route/flag, and **no runtime
path consumes it** (grep-confirmed).

**M6 closes the two open M5 boundary binds:**
- **`modelVersion` stamp:** `SNAPSHOT_MODEL_VERSION = "23B.daily-evidence.v1"` (build.ts:34), explicitly **not**
  the stale `EVIDENCE_MODEL_VERSION="23.0.0"` (test asserts `s.modelVersion !== "23.0.0"`). ✔ resolves M5-VER-1.
- **Canonical order:** `sortSupportedMarkets` (by `marketKey`,`selectionKey`) + `sortSignals` (by `key`) using
  **codepoint** comparators (not `localeCompare`), plus sorted operator/country lists and normalized nested
  instants (canonical.ts). ✔ resolves M5-DET-1 (test: permuted markets/signals → identical id + contentHash).

**Objective M6 closure blocker: NONE** (correctness scan + closure decision at the end).

---

## 1. Frozen-at-first-write surface
The instant the first production snapshot is appended, the **entire hashed body** — everything except the
`contentHash` field itself — is externally frozen for that `(fixtureId, capturedAt, sequence)` under
`canonicalizeEvidence` + sha256. Precisely:

| Surface | Value / behavior (from code) | In identity? | In hash? | Frozen? |
|---|---|---|---|---|
| **Identity tuple** | `evidenceSnapshotId(fixtureId, capturedAt, sequence)` → `evs_`+sha256(`fixtureId\|capturedAt\|sequence`)[:24] | **yes (defines id)** | via id only | **Yes** |
| **modelVersion** | `"23B.daily-evidence.v1"` | **no** | yes | **Yes** |
| **schemaVersion** | `"23.0.0"` (`EVIDENCE_SCHEMA_VERSION`) | no | yes | **Yes** |
| **Canonical JSON** | `canonicalizeEvidence`: sort object keys, **drop `undefined`**, **keep `null`**, arrays in order, primitives via `JSON.stringify` | — | serializer | **Yes** |
| **null vs omitted** | `null` is hashed; `undefined` is dropped. build sets `competitionId/seasonId ?? null`, `operator/bestOdds` `null` when absent | — | yes | **Yes** (convention) |
| **Number formatting** | `JSON.stringify(number)` shortest round-trip; `evidenceScore`/weights 2dp, `impliedProbability`/`modelProbability` 6dp | — | yes | **Yes** |
| **Timestamp formatting** | `normalizeInstant` = `new Date(Date.parse(x)).toISOString()` → ms-precision `…sssZ` | — | yes | **Yes** |
| **Array ordering** | markets by `(marketKey,selectionKey)`; signals by `key`; `operatorKeys`/`restrictedCountries` codepoint-sorted | — | yes | **Yes** |
| **Tie-breaking** | canonical sorts have **no secondary tiebreak** beyond the sort key → ties fall to input order (see R5) | — | yes | **Yes (with caveat)** |
| **Signal keys** | `season_<mkt>_<venue>`, `counter_<mkt>_<venue>_<i>` (M5 formats) | no | yes | **Yes** |
| **Market keys** | §2.B closed registry values | no | yes | **Yes** |
| **supportedMarkets ordering** | codepoint `(marketKey,selectionKey)` | no | yes | **Yes** |
| **qualificationReasons** | **ephemeral** (diagnostics only; no snapshot field) | no | **no** | **No** |
| **Source identifiers** | signal `source = "footystats:team"` (M5) | no | yes | **Yes** |
| **qualification enum** | in snapshot; `{qualified,provisional,unqualified,excluded}` | no | yes | **Yes** |
| **evidenceStrength** | **ephemeral** (diagnostics; no snapshot field) | no | **no** | **No** |
| **confidenceBand** | **ephemeral** (diagnostics) | no | **no** | **No** |
| **bindingMarketKey** | **ephemeral** (diagnostics) | no | **no** | **No** |
| **Content hash algo/input** | sha256 over canonicalized body (all fields except `contentHash`) | — | defines hash | **Yes** |

**Key distinction:** the persisted, hashed body is frozen; the M5/M6 **diagnostics** (`qualificationReasons`,
`evidenceStrength`, `confidenceBand`, `bindingMarketKey`, per-market diagnostics) are **not persisted** and
therefore **not frozen** — they can evolve freely. This is the single most important compatibility fact of M6.

---

## 2. Schema evolution
`EvidenceSnapshot`/`SupportedMarket`/`EvidenceSignal` are frozen §2.A shapes; the hash covers the whole body.

| Change | Requires |
|---|---|
| Add/remove/retype a **snapshot body field** | **New `schemaVersion`** (persisted shape change) **and/or new `modelVersion`** if it changes derived content; **prohibited in-place rewrite** of old rows; **migration-free coexistence** (old rows keep their schemaVersion; readers additive) |
| Add an **optional** body field | Still changes the hash of new rows → **new schemaVersion**; old rows unaffected; **additive backward-compatible reader** (absent ⇒ default) |
| **Diagnostics** (reasons/strength/band/bindingMarketKey/per-market) | **None** — ephemeral, not persisted → **migration-free coexistence**, additive reader only |
| **Market types** (§2.B) | Additive-only; **new modelVersion** if derivation changes; rename **prohibited** (forks hash + breaks joins) |
| **Signal types** (new `key`/`source`) | **New modelVersion** (signal keys/sources are hashed) |
| **Source references** (`source` string) | **New modelVersion** (hashed) |
| **Odds references** (`bestOddsSnapshot`) | Field exists + frozen; a shape change is a **new schemaVersion** |
| **Qualification states** | Enum is frozen 4-value; widening is a **new schemaVersion**; M6 emits only 3 (never `excluded`, §5.10) |
| **Strength bands** | Ephemeral (not persisted) → **free**, additive reader |
| **schemaVersion field** | Bumping it is the mechanism itself; **migration-free coexistence** with old rows mandatory |

Rule of thumb: **anything in the hashed body → new `schemaVersion` (shape) or new `modelVersion` (content);
never a rewrite. Anything ephemeral → free.** Readers must be additive and tolerate a mixed-version archive.

---

## 3. Model evolution — coupling & permanent-retention (M7)
The reproducibility of a snapshot depends on a **chain of couplings**, all reachable from `buildCaptureSnapshot`:

- **M5 derivation logic** (`model/derive.ts`) → produces score/qualification/markets/signals.
- **M5 compile-time constants** (`model/constants.ts`: BASELINE_SCALE, W_PRIMARY_MAX/W_COUNTER_MAX, SAMPLE_MIN/TARGET, NEUTRAL_EPS_PP, COUNTER_MIN_PCT, LEAGUE_MIN_SAMPLE).
- **Shared `lib/evidence` thresholds** (`EVIDENCE_QUALIFICATION_THRESHOLDS`, `EVIDENCE_MIN_SAMPLE_SIZE`, `EVIDENCE_SCORE_*`) — used by `deriveQualification`/`normalizeEvidenceScore`.
- **M6 `modelVersion` stamp** (`23B.daily-evidence.v1`) — the ONLY discriminator of which model produced a row.
- **Canonicalization + hash** (`canonicalizeEvidence`, sha256) and **source interpretation** (payload→`MarketInput`).

**What M7 must retain permanently** so any archived `modelVersion` replays byte-identically (§4.9-R3/G):
logic, constants, **shared thresholds** (they are model-version-bound in effect even though they live outside
`model/`), canonicalization implementation, source-interpretation mapping, and the serialization/hash behavior.
Today none of this is versioned in code — the tie is a comment. A `modelVersion → {logic, constants, thresholds,
canonicalizer}` registry is an **M7 requirement**, not an M6 closure blocker (only one model exists).

---

## 4. Identity & modelVersion (verified in code)
`evidenceSnapshotId` is keyed on `(fixtureId, capturedAt, sequence)` only; `modelVersion` is in the hashed body,
**not** the id (build.ts + test "identity excludes modelVersion; content hash includes it").

- **Why two model versions collide on identity:** same `(fixtureId, capturedAt, sequence)` under v1 and v2 →
  **same id, different contentHash**.
- **Expected behavior:** the append rule returns **`immutable_violation`** (same id, different hash) — M6 maps it
  to `status:"immutable_violation"`; the first-written row is never overwritten (test confirms).
- **Contract-intended?** **Yes.** §2.C keys capture identity on the window/sequence, not the model; §4.9-G says
  the same coordinates reproduce the *same* snapshot under the *same* modelVersion. The collision-as-rejection is
  the guarantee that a re-scored snapshot can never silently overwrite the captured one.
- **Deployment sequencing / single-writer:** a model change must be a coordinated new-version release; **single-writer
  capture** (advisory lock, M9) ensures only one worker mints a given window, avoiding a concurrent v1/v2 race that
  would otherwise surface as `immutable_violation`.
- **Rollback consequences:** old snapshots are immutable and keep their `modelVersion`; re-deriving an
  already-captured slot after rollback → `immutable_violation` (already exists), which is safe.
- **Why version strings must never be reused:** since the id excludes `modelVersion`, the string is the *sole*
  provenance of which logic/constants produced a row; reuse across different logic makes historical
  segmentation, replay sourcing, and calibration ambiguous (§4.9-R3). **Frozen identity is not redesigned here.**

---

## 5. Canonical-order compatibility (byte-for-byte reproduction rules)
Replay and every future writer must reproduce these exactly:

- **Market order:** `sortSupportedMarkets` — codepoint `(marketKey, selectionKey)`.
- **Signal order:** `sortSignals` — codepoint `key`.
- **Set-like lists:** `operatorKeys`, `restrictedCountries` — codepoint sort.
- **Nested instants:** `resolvedAt`, best-odds `capturedAt` normalized to ms-ISO.
- **Object keys:** sorted by `canonicalizeEvidence` (writer key order is irrelevant — positive).

Hidden-dependency audit:
- **Caller input order** → neutralized for markets/signals by the sorts (test-proven); **but see the tie caveat**.
- **JS object insertion order** → irrelevant (canonicalizer sorts keys).
- **Sort stability** → ES2019 stable sort; only matters under ties.
- **`localeCompare`** → **not used** (codepoint `< / >`), correctly avoided (locale is not frozen).
- **Unicode normalization** → **not applied** — a `source`/`operatorKey`/label carrying composed↔decomposed forms
  hashes differently (inherited M3-HASH-3 class; here it reaches the snapshot body).
- **Case normalization** → not applied (codepoint order is case-sensitive; consistent but case-variant strings sort/verify distinctly).
- **Comparator tie behavior** → **the one gap:** the sorts have no total tiebreak, so **duplicate `(marketKey,selectionKey)` market inputs (or duplicate signal `key`s) fall back to input order** → residual input-order sensitivity → hash instability across input orderings (R5).
- **undefined/null** → `undefined` dropped, `null` kept by the canonicalizer (consistent; writers must emit explicit `null`).

---

## 6. Archive compatibility
- **Memory vs Postgres parity:** M6 writes through the `EvidenceArchiveStore` **interface** (injected) — adapter-agnostic; a future Postgres adapter must satisfy the same append rules and byte-faithful hash storage.
- **Immutable insert / same-content idempotency / different-content conflict:** enforced by `decideSnapshotAppend` — duplicate `(id, contentHash)` → `duplicate` no-op; same id, different hash → `immutable_violation`; plus `sequence_conflict` for non-contiguous sequence. M6 surfaces all, swallows none.
- **Unique constraints (future PG):** `UNIQUE(id)` only (+ the natural `UNIQUE(fixtureId, sequence)`); **never** `UNIQUE(id, contentHash)` (would admit an immutable-violation).
- **Hash verification:** `verifyEvidenceContentHash(evidenceSnapshotBody(s), s.contentHash)` (test-proven); every reader can recompute.
- **Corrupted historical records / export-import / backup-restore fidelity:** content-addressed → restore is verifiable and idempotent re-capture is a no-op; a corrupt row is detectable by hash recompute. NDJSON fail-closed reads apply (inherited).
- **JSONB vs canonical hash bytes:** the hash is over the canonical **JSON** of typed fields; a PG adapter that reconstructs the body from typed columns (NUMERIC score, TIMESTAMPTZ capturedAt) may not reproduce the hashed bytes → **must store the serialized body as the hash basis** (M3-PG-1 class, R8).

---

## 7. Mixed-version deployment
- **Rolling deploy / two active writer versions / stale workers / retry from an older worker:** if two workers
  mint the **same window** with **different constants**, the id (excluding modelVersion) collides → the second is
  rejected `immutable_violation`. No corruption, but a losing worker's work is discarded.
- **Version skew M5↔M6:** M6 stamps a fixed `SNAPSHOT_MODEL_VERSION`; if M5 constants change without bumping that
  string, the **same modelVersion** yields **different bodies** across workers → §4.9-G break + `immutable_violation`.
- **Version skew app↔DB constraints:** a future PG `modelVersion`/`schemaVersion` column + CHECK must accept every
  value any deployed worker emits (widen constraints **before** deploying new-value writers).
- **Deploy rollback:** safe — immutable rows persist; never reuse a version string.

**Safe deployment sequence (no runtime activation implied):**
1. Deploy code with capture **flag off**; verify dormant (no consumer).
2. Any model/constant/canonicalization change ships as a **new `modelVersion` string** in the same release.
3. Ensure **single-writer** capture (advisory lock) before enabling.
4. Quiesce/drain in-flight capture across a model-version cutover (no two versions minting concurrently).
5. Widen any DB `modelVersion`/`schemaVersion` constraint **before** the writer that emits the new value.
6. Enable capture; monitor `immutable_violation`/`sequence_conflict` counts as the skew signal.
7. Rollback = disable flag + revert code; archived rows remain valid, segmented by `modelVersion`.

---

## 8. Postgres migration considerations
M6 introduces **no Postgres and needs none for closure** (NDJSON via interface). For a *future* adapter, changes
can be **additive and online**:
- **Unique indexes:** `UNIQUE(id)`, `UNIQUE(fixtureId, sequence)` — created `CONCURRENTLY`.
- **Hash column:** `content_hash TEXT` with a plain index for audits; **never** a unique on `(id, contentHash)`.
- **modelVersion / schemaVersion indexes:** plain btree for calibration segmentation + mixed-version reads; additive, `CONCURRENTLY`.
- **JSONB fields:** store the **serialized canonical body** as the hash basis; typed columns are **generated/denormalized query aids only** (must not be the hash source).
- **Generated columns:** acceptable for query aids (e.g. `evidence_score NUMERIC`), never for hash reconstruction.
- **Backfills:** immutable rows → **no backfill of a new hash-affecting column is possible**; a promoted column is null for historical rows (NULL-cliff, register R6 class) — surface, don't rewrite.
- **Validation constraints:** add as `NOT VALID` then `VALIDATE CONSTRAINT` (online); ensure they accept all historical values.
- **No-rewrite strategy:** all of the above are additive/online; **table rewrites are prohibited** (immutability).

---

## 9. Replay compatibility (M6 stores enough?)
M6 persists a self-verifying body: `id`, `capturedAt`, `sequence`, `previousSnapshotId`, `modelVersion`,
`schemaVersion`, `contentHash`, and the full derived content. This is sufficient to distinguish:
- **Replay of original archived inputs** → needs the **retained M2 provider payload** (M6 does not store raw inputs; it stores derived outputs) + the historical model — an M7/retention dependency, not stored by M6.
- **Verification against the stored snapshot** → **fully supported now**: recompute `contentHash` over the stored body (no model needed).
- **Recalculation under the historical model** → needs retained logic+constants+thresholds+canonicalizer of that `modelVersion` (M7 registry).
- **Recalculation under a new model** → produces a **new** snapshot at a new capture (never overwrites; identity collision → `immutable_violation`).
- **Comparison without rewriting history** → supported: `modelVersion` segments rows; `evidenceScoreDelta`/hash compare across versions without mutation.

M6's contribution: it stores a **stable, hash-verifiable identity + body**; it does **not** itself retain the
inputs or the model — those are M2 (inputs) and M7 (model) retention obligations.

---

## 10. Rollback & recovery
| Scenario | Outcome |
|---|---|
| Rollback **before any mint** | Clean — nothing frozen yet; the first-mint decisions are still reversible. |
| Rollback **after first mint** | Code reverts; **archived rows are immutable and permanent** — the frozen surface (§1) is now irreversible. |
| Rollback **after a mixed-version collision** | The winning row stands; the loser was rejected (`immutable_violation`) and never persisted → no corruption. |
| **Retry after uncertain commit** | Safe — content-addressed idempotency: same `(id, contentHash)` re-append is a `duplicate` no-op. |
| **Restore from backup** | Verifiable (recompute hash) + idempotent re-capture refills missing rows. |
| **Correction of bad model logic** | New `modelVersion` going forward; historical rows **cannot be edited** — corrections are new captures, never rewrites. |
| **Correction of bad upstream data** | New capture (new window/sequence) or a validation revision (M8); the original snapshot stays. |
| **Editing historical snapshots** | **Impossible by construction** (append-only + hash-frozen) — this is the intended guarantee. |

---

## 11. Data retention (what must remain available)
For verification/replay/audit to hold long-term, retain permanently:
- **Provider archives (M2)** — the only replay-input basis (raw not retained, §5.7).
- **Odds archives (M3)** — capture-time prices for `bestOddsSnapshot` provenance/CLV (not required for snapshot replay).
- **Admission metadata** — build outcomes are ephemeral; nothing extra to retain beyond the archives themselves.
- **Model implementation + constants + shared thresholds** — per `modelVersion` (M7 registry).
- **Canonicalization implementation** — `canonicalizeEvidence` + sha256 (frozen; register R2).
- **Snapshot body + hash (M6 archive)** — the durable record itself.
- **Source registry mappings** — §2.B keys/labels/`source` strings that entered hashed bodies.

---

## 12. Public/API compatibility
M6 exports `captureEvidenceSnapshot`, `buildCaptureSnapshot`, the canonicalizers, and
`bestOddsSnapshotFromOddsRecord`. The **store is injected**, so callers own persistence. Future callers can evolve
safely by adding **optional `CaptureRequest` fields that map to existing body fields** (e.g. `operatorAvailability`,
`bestOddsSnapshot`) — snapshot semantics are unchanged. Any new field that would enter the **hashed body** is a
`schemaVersion`/`modelVersion` event, not a transparent API addition. No routes/public APIs are required for M6.

---

## 13. Migration risk register

| ID | Area | Trigger | Affected historical data | Failure manifestation | Detection | Mitigation | Owner MS | Closure classification |
|---|---|---|---|---|---|---|---|---|
| **M6-R1** | Frozen surface / irreversibility | First production mint | All snapshots forever | Any later change to body/canonicalization/ordering/strings desyncs from history | Hash recompute drift; version diff | Enumerate & change-control the §1 surface; changes ⇒ new version, never rewrite | M6 | **Irreversible first-mint** |
| **M6-R2** | Identity ⊄ modelVersion | Two model versions, same slot | The colliding window | `immutable_violation` (loser discarded) | Append code metric | Single-writer + coordinated version bump (contract-intended) | M6/M9 | **Dormant-acceptable** (by design) |
| **M6-R3** | Model retention | Edit derive logic/constants without retaining old | Rows of the superseded version | Old `modelVersion` not replayable from code | Replay verification fails | `modelVersion→{logic,constants,thresholds,canonicalizer}` registry | **M7** | **M7 requirement** |
| **M6-R4** | Shared-threshold coupling | Edit `lib/evidence` thresholds/precision | All rows under the same modelVersion | Same modelVersion yields different outputs → replay break / `immutable_violation` | Replay/hash mismatch | Treat shared constants as model-version-bound; bump on change | M5/M7 | **Pre-activation gate** |
| **M6-R5** | Canonical-order tie | Duplicate `(marketKey,selectionKey)` / signal `key` inputs | Any affected snapshot | Input-order-dependent hash → nondeterministic contentHash | Permutation/replay hash diff | Validate/dedupe uniqueness of market inputs before mint | M6 | **Pre-activation gate** |
| **M6-R6** | Bounded idempotency | >`EVIDENCE_HISTORY_MAX_LIMIT`(200) snapshots per fixture | That fixture's stream | Same-window duplicate beyond the scan window minted at a new sequence | Sequence growth; two rows same `capturedAt` | Use a true full-stream / `capturedAt` existence check (unreachable at realistic volume) | M6 | **Pre-activation gate** (low) |
| **M6-R7** | Schema evolution | Add/retype a body field | New rows only | Hash change; strict readers reject old rows | schemaVersion diff | New `schemaVersion`; additive readers; migration-free coexistence | M7+ | **Dormant-acceptable** |
| **M6-R8** | Postgres hash-faithfulness | PG adapter reconstructs body from typed columns | All migrated rows | `verifyEvidenceContentHash` fails post-migration | Parity recompute | Store serialized body as hash basis; typed columns = query aids | Postgres | **Sustained-Postgres gate** |
| **M6-R9** | Mixed-version deploy | Rolling deploy, different constants, concurrent capture | Windows minted during skew | `immutable_violation` races; discarded work | Append-code spikes at deploy | Single-writer; quiesce across version cutover; §7 sequence | M9 | **Pre-activation gate** |
| **M6-R10** | bestOdds impliedProbability | Snapshot recomputes `impliedProbability` from `decimalOdds` | bestOddsSnapshot field | Snapshot value differs from M3 odds record's stored value | Cross-store compare | Documented (odds value advisory); deterministic → no defect | M6 | **Dormant-acceptable** |
| **M6-R11** | Timestamp precision | `capturedAt`/nested instants → ms-ISO; PG TIMESTAMPTZ round-trip | All rows | Column-reconstructed timestamp ≠ hashed string | Parity recompute | Preserve exact ISO string in the hash basis | Postgres | **Sustained-Postgres gate** |
| **M6-R12** | Retention dependency | Losing provider/odds/model/canonicalizer retention | Rows needing replay/audit | Replay/recalculation impossible | Retention audit | Retain the §11 set permanently | M7/ops | **M7 requirement** |
| **M6-R13** | Mixed-version reads | Archive accumulates modelVersion/schemaVersion mix | Historical rows | Strict reader rejects older rows | Version distribution | Additive, version-tolerant readers | M7+ | **Dormant-acceptable** |
| **M6-R14** | Unicode/case of hashed strings | `source`/`operatorKey`/label carries variant form | Affected rows | Composed↔decomposed → different hash / fork | Hash fork on re-derive | NFC + case policy at the M4/M6 authoring boundary (inherited) | M4/M6 | **Pre-activation gate** |

---

## 14. Closure decision

**Objective M6 closure blockers: NONE.** Correctness scan: `buildCaptureSnapshot` is pure (no clock/IO/random,
input not mutated — tests 104–110); identity/hash correct and `modelVersion`-excluding (72–80); canonical order
neutralizes input permutation (83–101); idempotency via full-stream pre-check + append (`created`→`already_exists`,
115–125); comprehensive fail-closed vocabulary (`not_admitted`/`invalid_input`/`derivation_failed`/`immutable_violation`/`archive_error`,
128–162); `immutable_violation` never overwrites (145–159); `modelVersion` stamped `23B.daily-evidence.v1`, not `23.0.0`.
M6 is dormant, injectable, and unwired. No runtime change is required or recommended.

- **Dormant-acceptable risks:** R2 (identity-collision-by-design), R7/R13 (schema/version-mix — additive readers), R10 (odds impliedProbability advisory).
- **Pre-activation requirements (before enabling capture):** R5 (dedupe/validate unique market inputs → total canonical order), R6 (unbounded full-stream idempotency), R9 (single-writer + coordinated version cutover), R14 (NFC/case policy on hashed strings), R4 (treat shared thresholds as model-version-bound). Plus inherited M2/M3 activation gates (retention, single-writer).
- **M7 requirements:** R3 + R12 — permanent, versioned retention of logic, constants, shared thresholds, canonicalization, source interpretation, and the M2/M3 archives, so any archived `modelVersion` replays byte-identically.
- **Sustained Postgres requirements:** R8 + R11 — store the serialized canonical body as the hash basis (never typed-column reconstruction); `UNIQUE(id)`/`UNIQUE(fixtureId,sequence)` only; additive/online index & constraint changes; no table rewrite.
- **Irreversible choices made by the first production mint:** the entire §1 frozen surface — identity tuple, `modelVersion="23B.daily-evidence.v1"`, `schemaVersion="23.0.0"`, `canonicalizeEvidence`+sha256, null-vs-omitted convention, number/timestamp formatting, market/signal codepoint ordering, signal-key formats, `source="footystats:team"`, and the qualification enum — become permanent for all history and are changeable only via a new version, never a rewrite.

No speculative future feature is required for M6 closure; the above are activation/M7/Postgres gates, not closure blockers.

M6 MIGRATION REVIEW COMPLETE
