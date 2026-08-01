# M3 — Odds Archive: Failure-Mode Review

**Status:** RECORDED — documentation-only, non-binding analysis. Review date 2026-07-28. **No runtime code changed; no frozen contract or type changed; no M4+ behavior reviewed.**
**Scope:** Milestone M3 ONLY — `lib/evidence-capture/odds-archive/{record,store,memory,file,index}.ts`, the §2.B registry it validates against (`lib/evidence-capture/keys.ts`), the shared normalizer (`provider-archive/record.ts::normalizeProviderPayload`), the shared hash (`lib/evidence/hash.ts`), and the M1 identity primitives it embeds. Fault behavior only (crash/IO/concurrency/replay/exhaustion) — not migration/schema (see companion).
**Governing documents:** implementation-contract (Rev 2 §2.B/§2.C/§2.D/§3/§4.1/§4.7/§5.8), phase-2.7 DoD (4–8), phase-2.7 implementation-plan (M3), phase3 safety addendum, future-migration-risk-register (R1/R2/R5/R6), m2-provider-archive-migration-review, m3-odds-archive-migration-review.
**Accepted governance inputs (not reopened without objective code/contract evidence):** Claude 2 → **M3 PASS**; Claude 3 → **M3 SAFE**; M3 remains **dormant** (no wired caller — confirmed by grep: no `buildOddsRecord`/`createFileOddsArchive`/`create*OddsArchive` usage outside the module and its test); no objective current identity / integrity / append / read-I/O / concurrency defect established.

## Baseline (what M3 already guarantees, vs the corrected M2 adapter)
Materially hardened over M2 and covered by `tests/oddsArchive.test.ts`:
- Structured-hash identity `odd_ + evidenceContentHash({captureId,marketKey,selectionKey,source})[:24]` — delimiter-ambiguity-proof (test 4); excludes values/runtime/model dimensions (tests 2–3).
- Content hash over exactly the 11 §2.D fields **including `capturedAt`** (a deterministic window anchor, not wall-clock) → timezone-independent, re-run-dedupe-stable (test 5).
- `verifyOddsRecord` recomputes id+hash and rejects tampered id/hash/shape (test 6); coercion-free field validation (tests 7–9); reserved `evidence_capture` source cannot carry odds/operator/prob and must have `sampleOperators=0`, and mints a distinct id from a real quote (tests 10–11).
- Normalizer is getter-safe (reads descriptors, never invokes), rejects symbols, sparse arrays, `undefined`, class instances (Map/Set/Date/URL/Error/Buffer/typed-arrays), circular refs, and categorizes deep-recursion `RangeError` (test 17–20).
- File adapter: **ENOENT-only** is empty; every other read errno surfaces (test 21, EISDIR); malformed/torn line and integrity-failed line **throw** (fail-closed, no silent recovery); same-id/same-hash physical duplicates **collapse**; same-id/**different**-hash physical lines are detected and **throw** `conflicting duplicate id` (file.ts:101–111, test 22–24); appends to one path are serialized by an **in-process per-path mutex** (tests 25–26); memory + file both enforce append/duplicate/`immutable_violation`; reads return frozen defensive copies; memory instances are isolated.

**Objective M3 closure blocker: NONE.** Everything below is dormant-acceptable, an activation gate, a sustained-production/Postgres gate, or a recovery/runbook requirement. No item is "blocking now."

---

## 1. Writer failures

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| W1 | crash **before** append | none needed | nothing written; deterministic rebuild mints the same id+hash → later re-append dedupes | none | dormant-acceptable |
| W2 | crash **during** append (torn write) | reader (`readAll`) on next read/append | a truncated final line → `JSON.parse` throws → **whole archive unreadable and un-appendable** until the partial line is removed (fail-closed by design; **no auto-repair**) | med (availability) | recovery/runbook-only |
| W3 | torn/partial final line (any cause) | `readAll` `malformed NDJSON at line N` | same as W2; N is reported in the error | med | recovery/runbook-only |
| W4 | ENOSPC | `append` catch → `write_failed` | append fails cleanly; a partial line may remain → W2/W3 on next read | med | recovery/runbook-only (+ activation: retry policy) |
| W5 | EACCES (write) | `mkdir`/`appendFile` throw → `write_failed` | no write; surfaced | low | production-activation-only (perms provisioning) |
| W6 | EIO (write) | catch → `write_failed` | no confirmed write; a partial line may remain → W2 | med | recovery/runbook-only |
| W7 | EMFILE/ENFILE (fd exhaustion) | `readFile`/`appendFile` throw | admission read → `write_failed` (surfaced as read-fail); or append → `write_failed`; **no corruption** (no partial line if the open itself failed) | low | production-activation-only (fd limits/monitoring) |
| W8 | mkdir failure | catch → `write_failed` | no write | low | production-activation-only |
| W9 | **fsync absence** | none (silent) | `appendFile` does **not** fsync; an OK result is **not a durability guarantee** — power loss can lose a "written" record or leave a torn final line. **No crash-durability is claimed.** | med | recovery/runbook-only (+ activation: durability policy) |
| W10 | NFS / interleaved multi-writer | `readAll` conflict/malformed throw | O_APPEND atomicity is not guaranteed on NFS → byte-interleaved lines → malformed → W2; or two writers persist same-id/diff-hash → detected fail-closed on read. **No multi-host safety is claimed.** | high (if enabled multi-host) | production-activation-only (single-writer) |
| W11 | retry after unknown append outcome | admission `readAll` | if the first write landed, retry rebuilds identical id+hash → **duplicate no-op**; if it landed with different values (re-fetch drift), same id/diff hash → `immutable_violation` (first wins). Safe **iff** retry does not auto-loop on a corruption-class `write_failed` (see O-OBS) | low | production-activation-only (retry rule) |

## 2. Reader failures

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| R1 | ENOENT | `readAll` | empty archive `[]` (correct) | none | passed (A) |
| R2 | EISDIR / other errno | `readAll` | `read failed (<code>)` throws; append → `write_failed` (test 21) — does **not** masquerade as empty | none | passed (A) |
| R3 | malformed JSON line | `JSON.parse` catch | throws `malformed NDJSON at line N` | med (avail.) | recovery/runbook-only |
| R4 | schema-invalid record | `verifyOddsRecord`→`isOddsArchiveRecordShape` | throws `corrupted record at line N` | med | recovery/runbook-only |
| R5 | content-hash corruption | `verifyOddsRecord` recompute | throws `corrupted record at line N` (test 24) | med | recovery/runbook-only |
| R6 | same-id/same-hash physical duplicates | `readAll` dedupe map | collapse to one; count stable (test 23) | none | passed (A) |
| R7 | same-id/**different**-hash physical duplicates | `readAll` id map + hash compare | throws `conflicting duplicate id … (immutable_violation on disk)` (file.ts:101–111, test 24) | med (avail.) | recovery/runbook-only |
| R8 | oversized archive | none | whole-file read + per-line re-verify+rehash on **every** read/append → latency, then memory pressure | med | sustained-production/Postgres-only |
| R9 | truncated final line | `readAll` | `malformed NDJSON` throw (= W3) | med | recovery/runbook-only |

## 3. Identity / cardinality failures

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| I1 | multiple quotes in one identity slot `(captureId,market,selection,source)` | admission | different values → same id, diff hash → `immutable_violation`; only distinct `source` values coexist per slot. `operatorKey` is a **value** not an id dim → two operators under one `source` collide (2nd rejected) → per-**source** aggregation is intended, not per-operator | low | dormant-acceptable (writer aggregates per source) |
| I2 | operator/source rename | verify (self-describing) | `source` in id → rename **forks** id (new slot); `operatorKey` in hash → **`immutable_violation`**. Records stay valid; map renames at the reader, never re-key (M3-ID-1/-3) | low | sustained-production/Postgres-only |
| I3 | source aliases / whitespace / case / Unicode drift | none in M3 (stored verbatim; **not** trimmed/case-folded, asymmetric with M2) | silent identity fork or immutable_violation. This is an **upstream (M4 writer) data-quality** normalization duty, not an M3 record-layer defect (accepted reviews) | low | production-activation-only (writer normalizes `source`/`operatorKey`) |
| I4 | evidence_capture vs real quote | `isEvidenceCaptureRecord`/`isRealQuoteRecord`; build guards | reserved source is build-constrained (no odds/operator/prob, sample=0) and mints a distinct id (tests 10–11) | none | passed (A) |
| I5 | value change under the same id | admission | `immutable_violation` (first write wins) | none | passed (A) |
| I6 | canonical market/selection migration | build-time `isCanonicalPairing` only | non-canonical pairing rejected at **build**; `verifyOddsRecord` does **not** re-check pairing → historical rows with a later-retired key stay **readable** (read-compat preserved). Keep §2.B additive/immutable (M3-ID-4) | low | sustained-production/Postgres-only |
| I7 | truncated-hash (96-bit id) collision | admission | distinct slots colliding on 24-hex id → full-length `contentHash` differs → spurious `immutable_violation` (**fail-closed, never a silent merge**); negligible at football volume (M3-ID-9) | negligible | dormant-acceptable |

**Note on the identity quad.** The record layer validates each field and format (`captureId` matches `cap_<24hex>`) but does **not** re-derive `captureId` from `(fixtureId, captureWindowKey)` nor check `captureWindowKey == ${fixtureId}|${capturedAt}`. Per the accepted governance interpretation (mirroring evidence_capture cardinality), constructing a **consistent** quad from the M1 primitives is the future capture writer's responsibility; M3 provides representation + immutable admission. This is **not** classified as a current M3 defect (no contract clause obliges the record layer to re-derive the quad, and both accepted reviews returned PASS/SAFE). Optional defense-in-depth quad re-derivation is recorded as a production-activation hardening, not a closure blocker.

## 4. evidence_capture failures (accepted governance interpretation)

M3 provides the record representation + immutable admission semantics; the **future capture writer** enforces the mandatory per-capture cardinality; **M3 itself does not fabricate a missing record.**

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| E1 | missing mandatory record (no `evidence_capture` row for a capture) | writer-level (future); not M3 | M3 cannot detect absence — it never fabricates. §4.7 cardinality is the writer's gate | n/a for M3 | production-activation-only (writer) |
| E2 | duplicate mandatory records | admission | identical → duplicate no-op; different → `immutable_violation` | none | passed (A) |
| E3 | real quote mislabeled `evidence_capture` | build guard | if it carries odds/operator/prob/sample>0 → **rejected**; if the writer strips it to nulls, M3 accepts a valid fallback (data loss is a **writer** routing error) | low | production-activation-only (writer routing discipline) |
| E4 | `evidence_capture` mislabeled real quote | none in M3 | a real `source` with all-null/sample=0 is a legitimate "priceless real quote" (§2.D allows null `decimalOdds`); only `source==="evidence_capture"` is the reserved fallback | low | dormant-acceptable (semantics preserved) |
| E5 | fabricated odds/operator/probability/sample | build guard | structural fabrication under the reserved source → **rejected**; a **plausible fake price** under a real source cannot be detected by M3 (truthfulness is upstream) | low | production-activation-only (writer/source integrity) |
| E6 | accidental use as evidence/scoring input | out of M3 scope | odds are **not** on the §4.9 replay path and never feed `evidenceScore` (§4.6); the record carries no score/qualification fields | none | dormant-acceptable |

## 5. Retention (exact current condition — **not optional**)

- The frozen contract requires **bounded / retention-limited** odds storage: §2.D ("the odds archive is **bounded** (retention-limited)") and §5.8 ("MUST NOT let the odds archive grow unbounded; retention limits are mandatory"); the M3 plan states "retention bound enforced."
- **No retention implementation exists in M3** (grep confirms no prune/bound/cap/rotate logic in `odds-archive/*`; the store interface exposes only `append`/`get`/`listByCapture`/`listByFixture` — no delete).
- Append-only NDJSON provides **no safe deletion mechanism**: a per-row delete would violate append-only immutability and the §4.1 admission model.
- Under the accepted PASS/SAFE reviews and the dormant state (nothing is being written, so nothing grows), this is **not a dormant-M3 correctness defect** — no closure blocker.
- It **is a hard production-activation gate.** Production capture **must not** be enabled while storage can grow without an approved bound.
- Preferred sustained-production resolution: **Postgres partitioning with partition-drop** (partition by `capturedAt` window/date; drop whole old partitions via a maintenance role — never per-row DELETE), or another explicitly approved immutable-compatible policy. Odds are not part of §4.9 snapshot replay, so dropping old odds is replay-safe (loses only CLV/audit history).

Classification: **production-activation-only** (mechanism/enforcement) with the structural resolution **sustained-production/Postgres-only**.

## 6. Concurrency

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| C1 | same-process duplicate | in-process mutex + admission | serialized → one appended, one duplicate no-op; list length 1 (test 25) | none | passed (A) |
| C2 | same-process conflict | in-process mutex + admission | serialized → one appended, one `immutable_violation`; list length 1 (test 26) | none | passed (A) |
| C3 | **multi-process** conflict | reader only (post-hoc) | the per-path mutex is **in-process only** — **no multi-process safety is claimed**; two processes can persist same-id/diff-hash lines, later surfaced fail-closed by `readAll` (`conflicting duplicate id`) → archive-poison until quarantine | high (if multi-writer) | production-activation-only (single-writer) |
| C4 | **multi-host** conflict | reader only | as C3 plus NFS byte-interleave (W10); **no multi-host safety is claimed** | high | production-activation-only (single-writer) + sustained-production (DB UNIQUE) |
| C5 | stale external lock | n/a (M3 has no external lock) | M3 relies on an external single-writer guarantee it does not itself provide; a stale/lost external lock re-enables C3/C4 | med | production-activation-only (lock design + liveness) |
| C6 | retry after ambiguous outcome | admission | idempotent dedupe on identical rebuild; `immutable_violation` on drift (= W11). Corruption-class `write_failed` must not auto-loop | low | production-activation-only (retry rule) |

## 7. Replay & migration failures

Odds are **not** on the §4.9 snapshot-replay path (odds ≠ `evidenceScore`, §4.6), so none of these compromise snapshot reproducibility — they affect odds/CLV read availability and cross-store fidelity. All gate Postgres/sustained, none block closure.

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| M1 | identity-formula change (`oddsRecordId`, `captureId`/`captureWindowKey` format) | verify mass-fail | all historical ids change → verify fails → fail-closed unreadable; freeze the formulas (M3-ID-5) | high-if-changed | sustained-production/Postgres-only |
| M2 | serializer/hash change (`canonicalizeEvidence`, sha256, Node-major JSON shift) | verify mass-fail | **all** historical hashes fail at once → whole-archive fail-closed (register R2); pin + change-control; algorithm dispatch lives **outside** rows (no `hashAlgoVersion` field permitted) | high-if-changed | sustained-production/Postgres-only |
| M3 | timestamp representation change | verify | `capturedAt` hashed as the stored ms-ISO string; verify recomputes over stored bytes → old rows stay valid; risk is only at a DB `TIMESTAMPTZ` round-trip (M3-HASH-5) | med | sustained-production/Postgres-only |
| M4 | decimal representation change | verify | `decimalOdds`/`impliedProbability` hashed via `JSON.stringify(number)`; keep the JS-number JSON form as the hash basis — never re-derive from a `NUMERIC` column (M3-HASH-3/PG-1) | med | sustained-production/Postgres-only |
| M5 | source/operator rename | verify (self-describing) | = I2 (fork/`immutable_violation`); map at reader, never re-key | low | sustained-production/Postgres-only |
| M6 | market-registry evolution | build-only | old rows readable (verify does not re-check pairing); §2.B additive/immutable | low | sustained-production/Postgres-only |
| M7 | null vs omitted change | verify | current rows emit **explicit `null`**; `canonicalizeEvidence` keeps `null`, drops `undefined` → a DB reconstruction that omits a NULL field changes the hash (M3-HASH-7) | med | sustained-production/Postgres-only |
| M8 | reconstructing hashed JSON from typed Postgres columns | verify parity check | the acute Postgres risk: NUMERIC/TIMESTAMPTZ/NULL columns don't reproduce the exact JSON → verify fails for correctly-migrated rows. Retain the exact serialized bytes as the hash basis; typed columns are query aids only (M3-PG-1) | high-if-unhandled | sustained-production/Postgres-only |

## 8. Resource exhaustion

| # | Failure scenario | Detection | Current behavior | Severity | Classification |
|---|---|---|---|---|---|
| X1 | O(N) read-before-append | none | every `append` calls `readAll` (whole file, parse+verify+rehash every line) before writing | med | sustained-production/Postgres-only |
| X2 | O(N²) lifetime growth | none | N appends → O(N²) cumulative parse+hash; the "O(1) append" note is true only of `appendFile`, not the read-before-write | med | sustained-production/Postgres-only |
| X3 | whole-file reads | none | `get`/`listBy*` each read+verify the whole file | med | sustained-production/Postgres-only |
| X4 | full-record integrity verification | none | sha256 recomputed for every line on every op — strong integrity, linear cost | low | sustained-production/Postgres-only |
| X5 | mutex-serialized batch writes | none | correctness-preserving but serializes throughput on one path (single-writer is required anyway) | low | production-activation-only |
| X6 | no retention | none | see §5 — unbounded growth compounds X1–X4 | high (at scale) | production-activation-only (bound) + Postgres (structure) |
| X7 | corruption blast radius | `readAll` first-throw | one bad/torn/conflicting line makes the **whole** archive unreadable+un-appendable (**no automatic repair**) | med (avail.) | recovery/runbook-only |
| X8 | unbounded payload breadth / deep nesting / DAG expansion | normalizer | deep nesting → categorized `RangeError` (handled); **no hard size/breadth/depth cap**, and shared-ref DAGs still expand (`seen.delete`) → possible compute/memory blow-up from a hostile input object (extra fields are normalized then discarded). A hard bound is an explicit activation gate (documented in code) | med | production-activation-only |

---

## Binary acceptance matrix

Each requirement is PASS/FAIL against a named deterministic check (`tests/oddsArchive.test.ts` unless noted). No requirement adds a field or alters a frozen type.

### A. Passed requirements for M3 closure (green now)
- **A1** Normalization fails closed on hostile inputs without invoking getters (symbols, sparse arrays, `undefined`, class instances, circular, non-finite/bigint, deep-recursion→categorized). *(test 17–20)* — PASS
- **A2** Deterministic structured identity, delimiter-ambiguity-proof, excluding values/runtime/model. *(tests 2–4)* — PASS
- **A3** Hash covers exactly the 11 §2.D fields incl. `capturedAt`; timezone-independent; values change hash, id stable. *(test 5)* — PASS
- **A4** `verifyOddsRecord` rejects tampered id/hash/shape. *(test 6)* — PASS
- **A5** Canonical §2.B pairing enforced at build; coercion-free odds/prob/sample validation. *(tests 7–9)* — PASS
- **A6** Reserved `evidence_capture` source is fabrication-proof and id-distinct from a real quote. *(tests 10–11)* — PASS
- **A7** Memory + file: append / same-id-same-hash duplicate / same-id-different-hash `immutable_violation`. *(tests 12–16, 22–24)* — PASS
- **A8** File reads: ENOENT-only empty, other errno surfaces, malformed/corrupt/conflicting lines fail closed, same-id-same-hash physical dup collapses. *(tests 21–24)* — PASS
- **A9** In-process per-path serialization of concurrent same-process appends. *(tests 25–26)* — PASS
- **A10** Defensive frozen copies + per-instance isolation. *(tests 12–16, clone test)* — PASS

**No objective M3 closure blocker was found.**

### B. Dormant-acceptable limitations (recorded, no gate now — safe only because M3 is dormant)
- **B1** In-process mutex only — **no multi-process/host safety claimed** (C3/C4/W10).
- **B2** No fsync/durability barrier — **no crash durability claimed** (W9).
- **B3** No hard payload size/breadth/depth cap; DAG shared-ref expansion possible (X8).
- **B4** No retention enforcement — nothing grows while dormant (§5).
- **B5** Whole-file O(N)/O(N²) read-verify cost — archive empty/small while dormant (X1–X4).
- **B6** `source`/`operatorKey` stored verbatim (not trimmed/case-folded) — upstream (M4) normalization duty (I3).
- **B7** Identity-quad cross-field consistency is writer-supplied, not re-derived by the record layer (§3 note).
- **B8** Quote staleness beyond `capturedAt` is unrepresentable (no quote-timestamp field; frozen §2.D) — writer freshness gate needed at activation.

### C. Mandatory production-activation gates (must pass before `EVIDENCE_CAPTURE_ENABLED` writes durably)
- **C1 (RETENTION — mandatory, not optional)** An approved bounded-retention policy is enforced; storage cannot grow without an approved bound. Production capture MUST NOT be enabled otherwise (§5).
- **C2** Single-writer enforcement (external advisory lock / single cron) with liveness handling; multi-process/host writes are prohibited without it (C3/C4/C5, W10).
- **C3** Hard payload size + depth + breadth/DAG-expansion bound, fail-closed in bounded time/memory (X8).
- **C4** Writer-side identity/quality discipline: consistent capture-identity quad from M1 primitives (optional record-layer re-derivation as defense-in-depth); `source`/`operatorKey` normalized (trim/case/NFC) upstream (I3, §3 note).
- **C5** Quote-freshness gate: no stale/transient price persisted as a fresh window observation (E5, B8; §5.13-analog).
- **C6** Reserved-source routing discipline: never route a real quote through `evidence_capture`; never emit a real `source` with fabricated values (E3/E5).
- **C7** Mandatory per-capture cardinality (exactly one `evidence_capture` odds record) enforced by the writer; M3 does not fabricate (E1).
- **C8** Retry rule: a corruption-class `write_failed` (admission-read failure) is NOT auto-retried; only transient IO is retried (W11/C6). *(`write_failed` currently spans both — callers must disambiguate by message/telemetry.)*

### D. Mandatory sustained-production / Postgres gates
- **D1** Postgres readiness gates sustained production (register R1); NDJSON is an initial adapter only (X1–X4, R8).
- **D2** Retention via **partition-drop** (or approved immutable-compatible policy), never per-row DELETE; app role `INSERT, SELECT` only + BEFORE UPDATE/DELETE trigger (§5, M3-PG-4).
- **D3** `PRIMARY KEY(id)` + safe `UNIQUE(captureId,marketKey,selectionKey,source)`; app-level hash compare on conflict raises `immutable_violation` (`ON CONFLICT DO NOTHING` alone is insufficient) (M3-PG-2/3) — this also structurally closes C2/C3/C4 across processes/hosts.
- **D4** Hash basis is the **retained serialized bytes**, never reconstructed from typed columns; explicit `null` (not omitted), exact ISO `capturedAt`, exact JS-number decimals (M8, M3/M4/M7, M3-PG-1).
- **D5** Frozen-forever surface is preserved: `oddsRecordId`, the 11-field hash basis, `canonicalizeEvidence`, sha256, `captureId`/`captureWindowKey` formats, reserved `evidence_capture`, §2.B keys in use (M1/M2/M5/M6). Any successor algorithm dispatches from an external write-epoch registry — no `hashAlgoVersion`/new field.
- **D6** Migration streams and quarantines the three NDJSON failure classes (malformed / same-id-diff-hash / integrity-failed); reader applies the identical `compareOddsRecords` total order; cutover blocked until full recompute parity (M3-PG-5, M3-READ-1/4).

### E. Recovery & operational runbook requirements
- **E1** Torn/malformed/conflicting line = whole-archive fail-closed (**no automatic repair**). Runbook: parse the error (`… at line N` / `conflicting duplicate id …`), quarantine the offending line to a rejected-log, restore from backup; safe truncation only of a torn **final** line after verifying it is the last and incomplete (W2/W3/R3–R5/R7/X7).
- **E2** `write_failed` triage: distinguish permanent corruption (admission-read threw) from transient IO (ENOSPC/EIO/EMFILE); corruption-class is quarantined + alerted, never auto-retried (W4/W6/W7/W11/C8).
- **E3** Post-crash integrity sweep (no fsync): after any hard stop, run a full `readAll`/`verifyOddsRecord` sweep, reconcile a possible torn tail, and confirm line-count/byte-length against the last known-good before resuming writes (W9).
- **E4** Backup/restore & DR before activation: periodic backup of `odds-archive/records.ndjson`; capture line-count + byte-length for truncation detection; verify restores by full recompute. Odds loss does not break §4.9 replay but permanently loses CLV/audit prices — treat as advisory-severity DR (M3-PROD-5).
- **E5** Multi-writer remediation: on any `conflicting duplicate id` from disk, treat as a single-writer violation — quarantine the conflicting line, confirm/repair the single-writer guarantee (C2/C3/C4), do not auto-resolve which body "wins."

---

## Report

1. **Documentation file written:** `docs/plans/m3-odds-archive-failure-review.md` (this file; documentation-only).
2. **Objective M3 closure blocker found:** **No.** All A-requirements pass; no current identity/integrity/append/read-I/O/concurrency defect established (consistent with the accepted M3 PASS/SAFE reviews).
3. **Production-activation blockers:** C1 retention bound (**mandatory**), C2 single-writer enforcement, C3 payload hard bound, C4 writer identity/normalization discipline, C5 quote-freshness gate, C6 reserved-source routing discipline, C7 per-capture `evidence_capture` cardinality (writer), C8 no-auto-retry on corruption-class `write_failed`.
4. **Sustained-production / Postgres blockers:** D1 Postgres readiness (R1), D2 partition-drop retention + no-UPDATE/DELETE, D3 PK(id)+safe natural-key UNIQUE + app-level conflict raise, D4 serialized-bytes hash basis (null/timestamp/decimal fidelity), D5 frozen id/hash/serializer/primitive surface, D6 stream-quarantine migration + order parity.
5. **Required recovery procedures:** E1 line-level quarantine/restore (no auto-repair), E2 `write_failed` corruption-vs-transient triage, E3 post-crash integrity sweep (no fsync durability), E4 backup/restore & truncation detection, E5 multi-writer conflict remediation.
6. **No runtime code changed** — one documentation-only file created; no frozen contract or type altered; no M4+ milestone reviewed.

Constraints honored: retention is **not** classified as optional (mandatory production-activation gate); **no** multi-process safety claimed; **no** crash durability claimed without fsync; **no** automatic archive repair claimed.

M3 FAILURE REVIEW COMPLETE
