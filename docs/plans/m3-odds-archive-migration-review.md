# M3 — Odds Archive: Long-Term Migration & Schema-Compatibility Review

**Status:** RECORDED — documentation-only, non-binding. Review date 2026-07-28.
**Scope:** Milestone M3 ONLY (`lib/evidence-capture/odds-archive/*`, the §2.B registry it joins on,
and the shared hash). Forward-looking migration/compatibility risk only. **No code, no contract
change, no Postgres implementation, no review of M4+ runtime behavior.**
**Governed by:** `docs/architecture/sprint-23b-implementation-contract.md` (Rev 2, §2.B/§2.D/§4.1/§4.7/§5.8),
`docs/architecture/phase-2-7-definition-of-done.md` (DoD 4–8), `docs/architecture/phase-2-7-implementation-plan.md` (M3).
**Companion:** `docs/plans/m2-provider-archive-migration-review.md`, `docs/plans/sprint-23b-future-migration-risk-register.md`.

## Constraints honored
No runtime/contract change. Nothing added. No Postgres implemented. **A contract change is recommended
only for an objective current correctness defect — none was found** (see "Correctness scan").

## Headline verdict
M3 is internally correct and integrity-strong, and it is **better than M2 in three ways**: identity is
a structured hash (delimiter-ambiguity-proof, test #4), reads dedupe same-id/same-hash **and** fail
closed on same-id/**different**-hash on disk (file.ts:101–111), and appends are serialized by an
in-process per-path mutex. Two M3-specific themes dominate the long term:
1. **`source` (bookmaker/feed) sits in identity and is neither trimmed nor case-folded** — the most
   volatile identity input in the whole pipeline, and the sharpest rename/alias exposure.
2. **"Bounded"/retention (§5.8, mandatory) has no primitive in the append-only store** — retention =
   delete, which the store contract forbids; this must be reconciled (partition-drop) before sustained
   production and in the Postgres design. Note the odds archive is **not** part of §4.9 snapshot-replay
   determinism (odds ≠ `evidenceScore`, §4.6), so pruning old odds does not break replay — it only
   loses CLV/audit history.

Everything frozen the instant M3 writes its first production record: `oddsRecordId`, the 11-field
`oddsContentHash` basis (incl. `capturedAt` and `source`), `canonicalizeEvidence`, the sha256
primitive, the `captureId`/`captureWindowKey` formats, the reserved `evidence_capture` source, and the
§2.B key values in use.

Legend — **M3✓** blocks M3 closure · **Prod** blocks production activation · **PG** blocks/gates Postgres migration · **Frozen** frozen after first production write. (Y / N / Y-if-…)

---

## 1. Identity stability

`oddsRecordId` = `odd_` + `evidenceContentHash({captureId, marketKey, selectionKey, source})[:24]`.
`fixtureId`/`captureWindowKey`/`capturedAt`/values are **not** in the id (but `fixtureId` +
`captureWindowKey` are transitively in it via `captureId`). Identity is recomputed and enforced on
every read (`verifyOddsRecord`); the file adapter fails the whole read on any mismatch.

| Risk id | Trigger | Impact | Earliest MS | Mitigation | M3✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M3-ID-1** Bookmaker/feed `source` rename or rebrand | A `source` slug changes ("alpha-book"→"alpha"); bookmakers rebrand/acquire far more often than data providers | `source` is in id **and** hash → same slot mints a **different** id → a fork, not a dedupe; the pre-rename record is stranded under the old slug | M4 (sets `source`) | Freeze the canonical `source` slug per feed at the M4 boundary; map renames at the reader, never re-key records; records are self-describing so history stays valid | N | N | N | Y (per record) |
| **M3-ID-2** `source` not trimmed / not case-folded | Upstream emits " alpha-book", "Alpha-Book", or trailing whitespace | Silent identity fork (id+hash differ) → duplicate logical bookmaker; **asymmetry with M2** which `.trim()`s its source | M4 | Normalize `source` (trim + canonical case) once at the M4 boundary before it reaches M3; M3 stores verbatim by design. No M3 change while M4 guarantees clean slugs | N | N | N | Y |
| **M3-ID-3** `operatorKey` alias/whitespace/Unicode drift | Same operator re-observed under a variant string ("alpha " vs "alpha") | `operatorKey` is a **value** (hash, not id) → same slot, different hash → **`immutable_violation`** on re-append (rejected, not forked) | M4 | Canonicalize `operatorKey` upstream; treat immutable_violation as the intended fail-closed signal, not a bug | N | N | N | Y |
| **M3-ID-4** Market/selection taxonomy evolution | A §2.B key is renamed/removed/repurposed (e.g. "over25"→"o25") | `marketKey`/`selectionKey` are in id+hash → rename forks identity and breaks the DoD-7 direct join between historical odds and evidence markets | M5+ | Keep §2.B **additive-only and immutable** (the registry already declares this); never rename/repurpose an existing key; deprecate by marking, never removing | N | N | N | Y |
| **M3-ID-5** `captureWindowKey` / `captureId` format evolution | Any change to `${fixtureId}\|${windowStartISO}` or the `cap_` seed/slice | Both feed the odds id+hash → all historical odds ids change → mass verify failure → fail-closed unreadable | M1/M3 | Treat both formats as permanently frozen; components are numeric/ISO (delimiter-safe), so no injection risk today | N | Y-if-changed | N | Y |
| **M3-ID-6** Reserved `evidence_capture` source string change | Editing `EVIDENCE_CAPTURE_SOURCE` | Every fallback record forks; the real-vs-fallback distinction (`isRealQuoteRecord`) breaks for history | M3 | Permanently frozen constant; the no-odds/no-operator/`sampleOperators=0` invariant is build-enforced | N | Y-if-changed | N | Y |
| **M3-ID-7** fixture-identity welding | `matchId` space reassigned / second fixture provider | `fixtureId`→`captureId`→odds id welds odds identity to FootyStats `matchId` (register-wide risk) | Long-term | Long-term provider-identity migration (register); no M3 action now | N | N | N | Y |
| **M3-ID-8** Unicode / case / whitespace in `source` | Composed↔decomposed or case variants of a slug between fetches | Fork (source in id) or immutable_violation (if it were a value) | M4 | NFC + case-fold + trim `source`/`operatorKey` at the M4 boundary if they can carry non-ASCII | N | N | N | Y |
| **M3-ID-9** id truncation collision | 24-hex (96-bit) id over a high-cardinality `(captureId,market,selection,source)` space | Negligible at football volume (birthday ≈ 2^48); a real collision would surface as a spurious immutable_violation (fail-closed, not silent corruption) | M3 | Adequate; do not change. A secondary UNIQUE on the natural tuple (see PG) backstops it | N | N | N | Y |

---

## 2. Content-hash compatibility

M3 reuses `evidenceContentHash`/`canonicalizeEvidence` (`lib/evidence/hash.ts`) over the **11 §2.D
fields including `capturedAt`**. Same shared-hash fragility as M2 (register R2), plus typed
numeric/timestamp fields that a DB round-trip can perturb.

| Risk id | Trigger | Impact | Earliest MS | Mitigation | M3✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M3-HASH-1** Canonical serializer change | Any edit to `canonicalizeEvidence` (key sort, undefined-drop, array order, primitive rule) | All historical odds hashes fail → archive unreadable **and** un-appendable (append reads first) | M3 | Freeze `canonicalizeEvidence` under change control; any future algorithm applies via a reader keyed to write-epoch **outside** archived bodies, never by rewriting rows | N | Y-if-changed | N | Y |
| **M3-HASH-2** Object key ordering | Stored line uses insertion-order `JSON.stringify`, hash uses sorted-key canonicalization | **None** — serializer key-order cannot affect the hash (positive; tested) | — | No action | N | N | N | Y |
| **M3-HASH-3** Numeric formatting of `decimalOdds`/`impliedProbability` | JS float → `JSON.stringify(number)` shortest round-trip | Stable across Node/V8 (ECMAScript Number::toString is standardized); risk appears only at the DB boundary (see M3-PG-3) | Postgres cutover | Keep the JS-number JSON form as the hash basis; never re-derive it from a typed column | N | N | Y-if-unhandled | Y |
| **M3-HASH-4** Negative zero | `impliedProbability`/`sampleOperators` accept `-0` (`-0 >= 0`, `Number.isInteger(-0)`) | `JSON.stringify(-0)="0"` → hashes as `0`; deterministic, benign; `-0` provenance lost. (`decimalOdds>1` can't be `-0`.) | M4 | Accept as documented coercion; encode signed zero as string upstream only if it ever carries meaning | N | N | N | Y |
| **M3-HASH-5** Timestamp precision | `capturedAt` normalized to ms-ISO (`.toISOString()`) and hashed; a DB `TIMESTAMPTZ` renders µs and drops trailing-zero ms | Column-reconstructed timestamp (`2026-08-01 17:00:00+00`) ≠ hashed string (`2026-08-01T17:00:00.000Z`) → verify fails | Postgres cutover | Preserve the exact ISO string as the hash basis; `TIMESTAMPTZ` column is a query aid only (see M3-PG-3) | N | N | Y-if-unhandled | Y |
| **M3-HASH-6** Unicode normalization of `source`/`operatorKey` | Composed↔decomposed string forms across fetches | Different bytes → different hash → fork (source) or immutable_violation (operatorKey) | M4 | NFC-normalize the two string fields at the M4 boundary if they can carry non-ASCII | N | N | N | Y |
| **M3-HASH-7** Optional omission vs null | A future writer/DB reconstructs a nullable field as omitted (`undefined`) instead of `null` | `canonicalizeEvidence` drops `undefined` but keeps `null` → different hash. Current records always emit explicit `null` (consistent) | Postgres cutover | Reconstruct nullable fields as JSON `null`, never omitted; DB NULL → `null` | N | N | Y-if-unhandled | Y |
| **M3-HASH-8** Hash primitive replacement | Swapping sha256 in `evidenceContentHash` | All ids+hashes change; old records verify only under sha256; no algo tag (and none permitted) | M3 | Keep sha256 permanently for existing records; if superseded, dual-hash by external write-epoch, never re-mint bodies | N | Y-if-changed | N | Y |
| **M3-HASH-9** All-or-nothing read verification | Any HASH-1/5/8 drift, or one corrupt line | `readAll` throws on the first failing line → `get`/`list`/`append` all fail; hash stability governs **availability**, not just integrity | M3/prod | Freeze canonicalization+primitive; pair with line-level quarantine tooling (M3-PROD-4); Postgres isolates per-row | N | N | N | Y |

---

## 3. Schema evolution

M3 has **no open `payload`** — all 11 domain fields are enumerated and hashed. Positive: `oddsContentHash`
reads exactly those 11 named fields, so any *new* top-level field is automatically hash-excluded, and
`isOddsArchiveRecordShape` tolerates unknown extras — the additive path is sound. The cost: content
that *should* be integrity-protected can't join the frozen hash without breaking history.

| Risk id | Trigger | Impact | Earliest MS | Mitigation | M3✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M3-SCHEMA-1** Adding hash-excluded optional field (bookmaker metadata, margin, quote-freshness `observedAt`, availability/status enum) | Future need for richer odds provenance | Safe **iff** added as optional, top-level, hash-excluded; verify still passes (hash covers only the 11 fields), old records default it | M4+ | Follow the sanctioned pattern; readers default when absent. Not needed now | N | N | N | N (field addable) |
| **M3-SCHEMA-2** Wanting a new field **inside** integrity | A new field (e.g. `availabilityStatus`) must be tamper-evident | Cannot join the frozen 11-field hash without invalidating all history → weaker integrity for the new field, or a versioned hash | M5+ | Accept hash-exclusion (integrity via the enclosing capture), OR introduce an `evidenceInputVersion`-style discriminator at M7 and dispatch; never re-scope the existing hash | N | N | N | Y (existing basis) |
| **M3-SCHEMA-3** Absence ⇒ v1 | No version field on the record | Future readers must treat any missing later-field as original/v1 | M5+ | Encode "absent ⇒ v1" as the reader rule now (doc-only); keep the record frozen | N | N | N | N |
| **M3-SCHEMA-4** Optional field becoming required | A later field is promoted to required, or a strict reader rejects unknowns | Historical records (lacking it / carrying extras) rejected → fail-closed unreadable | M5+ | Mandate lenient readers: ignore unknown, default missing; never reject solely for a later-added field (current shape guard is already lenient) | N | N | N | N |
| **M3-SCHEMA-5** Availability/status & taxonomy enum growth | New availability states, or §2.B additions | Enum widening is fine if additive; old records carry the old (smaller) enum and must stay decodable | M5+ | Additive-only enums; readers tolerate unknown-future values on read; §2.B stays additive/immutable (M3-ID-4) | N | N | N | Partly |

---

## 4. Postgres mapping — proposed **logical** constraints only (not implemented)

Design goal: a byte-faithful home for the exact record the hash was computed over, plus query aids —
preserving the four invariants below. The **dominant M3 risk** is that typed columns (NUMERIC odds,
TIMESTAMPTZ `capturedAt`) do not reproduce the JSON the hash covers.

**Proposed logical shape**
- **Primary key / UNIQUE:** `PRIMARY KEY (id)` — the append-idempotency key. Exactly one unique key on `id`.
- **Safe secondary unique:** `UNIQUE (captureId, marketKey, selectionKey, source)` **is safe and recommended** — it is precisely the tuple `id` is derived from (one observation per slot), so it cannot over-constrain, and it backstops the 96-bit-truncation collision (M3-ID-9) and makes the natural key queryable.
- **Unsafe uniques (do NOT add):** `UNIQUE(id, contentHash)` (would admit same-id/different-hash → breaks §4.1 rejection); `UNIQUE(captureId)` or `UNIQUE(captureId, marketKey)` (multiple markets/selections/sources per capture — would wrongly reject legitimate rows).
- **contentHash:** a **non-unique** index for integrity audits; must not be unique.
- **Query indexes (non-unique btree):** `fixtureId`, `captureId`, `captureWindowKey`, `marketKey`, `source` (drives `listByFixture`/`listByCapture` and CLV joins).
- **Storage of the hash basis:** store the **canonical serialized record** (the exact NDJSON line, or a verified JSONB of the 11 fields) as the source of truth for hashing; expose `decimalOdds`/`impliedProbability`/`capturedAt`/keys as **derived, denormalized columns for querying only** — never reconstruct the record (and never recompute the hash) from those typed columns.
- **Timestamp type:** `capturedAt` as `TIMESTAMPTZ` for range/partition queries, but the hash basis stays the original ISO string (M3-HASH-5).
- **Decimal odds precision:** keep `decimalOdds` as the faithful JS number in the hash basis; a `NUMERIC` column is a query aid only (M3-HASH-3).
- **Permissions:** app role gets `INSERT, SELECT` only — **no UPDATE, no DELETE**.
- **Immutable-update prevention:** a `BEFORE UPDATE/DELETE` trigger that raises (defense-in-depth beyond the grant).
- **Retention (bounded, §5.8):** by **partition drop** of whole old windows (partition by `capturedAt` month/date), executed by an admin/maintenance role — never per-row `DELETE` — so per-row immutability holds while size is bounded.
- **Transactions:** batched `INSERT … ON CONFLICT (id) DO NOTHING`, one transaction per batch, idempotent re-run.
- **Conflict handling:** `ON CONFLICT (id) DO NOTHING` alone is **insufficient** — it silently swallows a different-hash conflict. The writer/migrator must, on conflict, compare the stored `contentHash` and **raise `immutable_violation`** when it differs (app-level, mirroring `file.ts`/`decideOddsAppend`).
- **Legacy NDJSON quarantine:** the file adapter throws on (a) malformed lines, (b) same-id/**different**-hash on-disk pairs (file.ts:101–111), (c) integrity-failed records. Migration must **stream** the file and route all three to a quarantine/rejected-log — never abort the batch, never auto-resolve a conflict.

**These constraints preserve, explicitly:**
- **same id / same hash idempotency →** `ON CONFLICT (id) DO NOTHING` when the stored hash equals the candidate's.
- **same id / different hash rejection →** app-level hash comparison on conflict raises `immutable_violation` (not silent).
- **immutable historical records →** no UPDATE/DELETE grant + trigger; retention via partition drop only.
- **replay determinism →** hash verification uses the retained serialized bytes, never column-reconstructed values (and odds are not part of §4.9 snapshot replay regardless).

| Risk id | Trigger | Impact | Earliest MS | Mitigation | M3✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M3-PG-1** Hash basis reconstructed from typed columns | JSONB/normalized-column design recomputes number/timestamp/null from `NUMERIC`/`TIMESTAMPTZ`/NULL | `verifyOddsRecord` fails for correctly-migrated rows → fail-closed unreadable — the single most acute M3 Postgres risk | Postgres cutover | Retain the exact serialized record as the hash basis; typed columns are query aids only | N | N | Y-if-unhandled | Y |
| **M3-PG-2** Wrong unique semantics | `UNIQUE(id, contentHash)`, or `UNIQUE(captureId,…)` too narrow | Admits immutable-violations, or wrongly rejects legitimate multi-market/source rows | Postgres cutover | `PRIMARY KEY(id)` + safe `UNIQUE(captureId,marketKey,selectionKey,source)`; app-level conflict detection | N | N | Y-if-unhandled | N |
| **M3-PG-3** Silent conflict swallow | `ON CONFLICT DO NOTHING` without a hash check | Different-hash conflict silently dropped → §4.1 rejection lost | Postgres cutover | Compare stored hash on conflict; raise immutable_violation | N | N | Y-if-unhandled | N |
| **M3-PG-4** Retention via row DELETE | Implementing §5.8 as per-row deletes | Breaks append-only immutability + the no-DELETE grant | Postgres cutover | Partition-drop retention only | N | N | Y-if-unhandled | N |
| **M3-PG-5** Legacy quarantine missing | Malformed / conflicting / integrity-failed NDJSON line during import | Adapter throws → whole batch aborts | Postgres cutover | Stream-and-quarantine the three failure classes | N | N | Y-if-unhandled | N |

---

## 5. Reader migration (NDJSON → Postgres)

| Risk id | Trigger | Impact | Earliest MS | Mitigation | M3✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M3-READ-1** Ordering drift across stores | A PG `ORDER BY` that doesn't match `compareOddsRecords` (captureId, market, selection, source, id) | Two stores return different orders → non-reproducible reads/CLV series | Postgres cutover | PG reads apply the identical total order; order is fully derivable from columns (no reliance on insertion order) | N | N | N | N |
| **M3-READ-2** Dual-read double counting | Cutover window reads NDJSON **and** PG | Same logical record counted twice | Postgres cutover | Content-addressed dedup by `id`; prefer a single atomic source-of-truth flip over merged dual-read | N | N | N | N |
| **M3-READ-3** Conflict quarantine on read | Same-id/different-hash pair reaches a reader | Fail-closed unreadable (correct) but blocks the whole read | Postgres cutover | Quarantine at migration (M3-PG-5); PG isolates the bad row instead of failing the scan | N | N | N | N |
| **M3-READ-4** Checksum verification | Confirming a faithful import | Deterministic ids/hashes make verification a pure recompute (`verifyOddsRecord` parity) + count-vs-distinct-valid-id | Postgres cutover | Full recompute-and-compare; block cutover until parity proven | N | N | N | N |
| **M3-READ-5** Rollback / partial migration | Abort mid-migration; env flip back to file | Idempotent inserts make it resumable; NDJSON retained as source of truth until verified → reversible flip | Postgres cutover | Shadow + verify; keep NDJSON through the window; reverse = `DROP TABLE` | N | N | N | N |
| **M3-READ-6** Read-after-write during shadow dual-write | Record in one store not yet in the other | Transient divergence | Postgres cutover | Single source of truth at any instant; flip atomically, do not merge live | N | N | N | N |

---

## 6. Production longevity

| Risk id | Trigger | Impact | Earliest MS | Mitigation | M3✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M3-PROD-1** Retention/"bounded" (§5.8) has no primitive in the store | Sustained capture with no prune path; the store interface has **no delete** | §5.8 makes retention **mandatory**, yet the reviewed store cannot prune, and a naive prune (row delete) would break append-only immutability | M3 (claimed) / M9 (ops) | Design retention as **partition-drop by capture window/date** (immutability-preserving); enforce before sustained production. Odds are **not** in §4.9 replay, so pruning old odds is replay-safe | N | **Y** | Y-if-row-delete | N |
| **M3-PROD-2** Archive growth / O(N) append | `append` calls `readAll` (whole file) before every write | O(N) per append, O(N²) build — even bounded, cost grows until retention caps it; the file.ts "O(1) append" note is true only of `appendFile`, not the read-before-write | M9 / prod | Postgres readiness gates sustained production (register R1); retention (PROD-1) caps the working set | N | **Y** | N | N |
| **M3-PROD-3** Multi-process / host writers | Capture run on >1 process/host | The in-process per-path mutex protects one Node process only; cross-process there is no lock → same-id/different-hash lines can co-persist (later surfaced fail-closed by `readAll`) | M9 / prod | Enforce single-writer via the M9 advisory lock / single cron; the adapter is single-process-safe only, by design | N | **Y-unless single-writer** | N | N |
| **M3-PROD-4** Corruption recovery all-or-nothing | One corrupt/torn/conflicting line | Detection is excellent (every line verified, conflicts caught) but `readAll` throws on the first → whole archive unreadable | M9 / prod | External line-level quarantine/repair tooling; Postgres isolates per-row | N | N | N | N |
| **M3-PROD-5** Backup/restore & DR | Loss/corruption of `odds-archive/records.ndjson` | Odds are **not** required for §4.9 snapshot replay (odds ≠ `evidenceScore`, §4.6) → replay survives; but capture-time prices are non-re-fetchable → CLV/audit history is **permanently** lost | M9 / prod | Back up before production; capture byte-length/line-count for truncation detection; verify restores by full recompute. Lower DR severity than M2 (not the replay basis), but the sole price record | N | N-for-replay / advisory-for-CLV | N | N |
| **M3-PROD-6** Provider/bookmaker discontinuation | A `source`/operator shuts down or rebrands | Historical records remain valid and self-describing (the slug is stored, not re-resolved); new captures simply stop including it | Long-term | Readers must **not** re-resolve `source`→live operator at read time (record what was true then); tolerate dead slugs | N | N | N | Y (per record) |
| **M3-PROD-7** Market-registry deprecation | A §2.B market retired | Old odds referencing it must stay readable and join-able | M5+ | Registry additive/immutable; deprecate by marking, never remove/rename (ties to M3-ID-4) | N | N | N | Y |
| **M3-PROD-8** Partitioning / archival tiers / 3-year volume | Three years of bounded capture | Without partitioning, even a bounded set scans linearly (NDJSON); needs a partition/tier strategy for retention + query cost | M9 / prod | Partition by `capturedAt` date (enables partition-drop retention + bounded scans); optional cold-tier of old partitions before drop | N | Advisory | N | N |

---

## Correctness scan (why no contract change)
Checked for an objective current defect in the frozen record/hash/store surface:
- `buildOddsRecord` validation is strict, coercion-free, getter-safe, and fail-closed (tests 8–11, 17–20).
- `verifyOddsRecord` recomputes id+hash over the same 11 fields `buildOddsRecord` used — consistent (test 6, "clone" test).
- `-0` in `impliedProbability`/`sampleOperators` coerces to `0` — deterministic and benign, not a defect.
- `source` un-trimmed and the missing retention primitive are **data-quality / missing-feature** matters that live upstream (M4) or in ops (M9) — **not** defects in the frozen record/hash/store contract.
**Conclusion: no objective current correctness defect → no M3 contract change recommended.**

## Positive findings (do not "fix")
- Structured-hash identity → **delimiter-ambiguity-proof** (test #4), fixing M2-ID-5.
- `readAll` dedupes same-id/same-hash **and** fails closed on same-id/**different**-hash on disk (file.ts:101–111) — stronger than M2.
- In-process per-path append mutex serializes concurrent same-process writers (tests 25–26).
- Hash uses sorted-key canonicalization while storage uses insertion-order `JSON.stringify` → serializer key-order can't break hashes.
- `capturedAt` in the hash is a deterministic window anchor (not wall-clock) → re-runs dedupe; timezone-independent (test #5).
- Records are self-describing (`source`/`operatorKey` stored verbatim) → no live re-resolution needed at read time.
- Odds archive is **not** on the §4.9 replay-determinism path → retention/pruning and even total loss do not compromise snapshot reproducibility (only CLV/audit).

## Gating summary
- **Blocks M3 closure:** none (no correctness defect). **No frozen-contract change recommended.** (Verify the §5.8 retention deliverable against the DoD — the mechanism is absent from the reviewed store surface; see M3-PROD-1.)
- **Blocks production activation:** M3-PROD-1 (bounded/retention is §5.8-mandatory), M3-PROD-2 (Postgres readiness — register R1), and M3-PROD-3 unless single-writer is enforced.
- **Gates Postgres migration (if unhandled):** M3-PG-1 (hash basis must be the retained serialized bytes, not typed columns — the acute one), M3-PG-2/3 (UNIQUE(id)+safe natural-key unique, app-level conflict detection), M3-PG-4 (partition-drop retention, not row delete), M3-PG-5 (quarantine).
- **Frozen the instant M3 writes its first production record:** `oddsRecordId`, the 11-field hash basis (incl. `capturedAt` and `source`), `canonicalizeEvidence`, sha256, the `captureId`/`captureWindowKey` formats, the reserved `evidence_capture` source, and the §2.B key values in use.

M3 MIGRATION REVIEW COMPLETE
