# M2 — Provider Archive (normalized-input retention): Long-Term Migration & Compatibility Review

**Status:** RECORDED — documentation-only, non-binding. Review date 2026-07-28.
**Scope:** Milestone M2 ONLY (`lib/evidence-capture/provider-archive/*`). Forward-looking migration
and compatibility risks. This document does **not** authorize code or contract changes.
**Governed by:** `docs/architecture/sprint-23b-implementation-contract.md` (Rev 2),
`docs/architecture/phase-2-7-implementation-plan.md`. Companion to
`docs/plans/sprint-23b-future-migration-risk-register.md` (R1/R2 apply here too).

## Constraints honored by this review
No code change. No frozen-contract change. No new `hashAlgoVersion`, `schemaVersion`,
provider-instance field, or new identifier is proposed. No Postgres implementation is proposed.
**A contract change is recommended only for a true correctness blocker — none was found.**

## Reviewer's headline verdict
M2 is internally correct and integrity-strong at its current operating envelope
(single provider string, numeric normalized payloads, single-writer capture). Its identity,
content hash, and read-time verification are **frozen the instant the first production record is
written**, and every listed risk is a consequence of that freeze meeting future change. The two
that must be treated as production gates are archive growth (Postgres readiness, Constraint 2) and
disaster recovery of a **non-reconstructable** replay basis (§4.9). Nothing blocks M2 closure.

Legend — **M2✓** = blocks M2 closure · **Prod** = blocks production activation · **PG** = blocks/gates Postgres migration. (Y / N / Y-if-unhandled)

---

## 1. Identity evolution

Identity = `providerArchiveId(source, fixtureId, captureWindowKey)`; **payload excluded from id**,
so identity is the (source, fixture, window) triple. `verifyProviderArchiveRecord` recomputes the id
and rejects any mismatch; the file adapter then fails the whole read.

| Risk id | Trigger | Impact | Earliest milestone | Mitigation | M2✓ | Prod | PG |
|---|---|---|---|---|---|---|---|
| **M2-ID-1** Immutable id formula freeze | Any future change to the id seed format, prefix `prv_`, or 24-char slice | Every historical record fails `verifyProviderArchiveRecord` → file adapter throws → archive unreadable **and** un-appendable (append reads first) | M2 (frozen at first write) | Treat the id formula as permanently frozen; never alter seed/prefix/slice; pin it under change control alongside `evidenceContentHash` | N | Y-if-changed | N |
| **M2-ID-2** Provider/source rename | `source` string changes ("footystats"→"fs"/"footystats-v2") | Same fixture-window input mints a **different** id+hash → new fork; no dedupe against history; replay must know the historical source string | M4 (source routing sets `source`) | Freeze the canonical source string per provider; if a rename is ever unavoidable, map it at the reader, never re-key records | N | N | N |
| **M2-ID-3** Provider aliases / casing | Two spellings for one provider ("footystats" vs "FootyStats"); only `.trim()` is applied, no case/alias normalization | Divergent ids for one logical provider → silent duplicate logical inputs a reader cannot reconcile | M4 | Normalize the source token at the M4 boundary (decide the canonical form once); maintain an alias→canonical map in the reader layer, not in the record | N | N | N |
| **M2-ID-4** Multiple accounts/endpoints per provider | One provider fetched via >1 endpoint/account, all labeled with one `source`, returning slightly different normalized payloads | Same id, different hash → **`immutable_violation`**: the second endpoint's write is rejected (or, if labeled with distinct sources, identity forks) | M4 | Decide endpoint identity policy at M4: either canonicalize to one authoritative payload per window, or encode endpoint in `source` accepting the fork — do **not** silently rely on immutable_violation | N | N | N |
| **M2-ID-5** Delimiter-based id encoding not injective | A future `source` (or window) string containing `\|` | `providerArchiveId` seed `${source}\|${fixtureId}\|${captureWindowKey}` becomes ambiguous → two distinct triples can collide on one id → spurious `immutable_violation` or wrong dedupe/merge. (contentHash is safe — it canonicalizes a JSON object, not a delimiter join.) | M4 | Constrain `source` to a delimiter-free charset at the M4 boundary; document that `\|` is reserved. No change needed while sources are delimiter-free | N | N | N |
| **M2-ID-6** Collision handling is fail-closed only | Any same-id/different-hash pair (from M2-ID-4/5 or a race) | Legitimate distinct inputs sharing an id are permanently blocked; sha256[:24] (96-bit) collision is negligible but truncated | M2 | Keep fail-closed; prevent the upstream causes (ID-4/5) rather than loosening the rule | N | N | N |
| **M2-ID-7** Future `evidenceInputVersion` (M7) has no field on the M2 record | M7 introduces `inputContentHash`/`evidenceInputVersion` versioning of the input basis | M2 records are unversioned; adding a field is forbidden → M7 must layer version **externally** (absence ⇒ v1) or it stalls | M7 | Define now (doc-only): pre-M7 records are `evidenceInputVersion` v1 by definition; M7 carries the version outside the frozen M2 record and dispatches by it | N | N | N |

---

## 2. Hash evolution

M2 reuses `evidenceContentHash`/`canonicalizeEvidence` (`lib/evidence/hash.ts`) over an **open,
arbitrary payload** — a far larger surface than the fixed evidence-snapshot body. Every record's hash
is re-verified on every read/append; drift bricks reads (fail-closed) as well as integrity.

| Risk id | Trigger | Impact | Earliest milestone | Mitigation | M2✓ | Prod | PG |
|---|---|---|---|---|---|---|---|
| **M2-HASH-1** Canonicalization change | Any edit to `canonicalizeEvidence` (key sort, `undefined` drop, array order, primitive rule) | All historical hashes fail → archive unreadable/un-appendable; mirrors register R2 over a bigger surface | M2 (frozen at first write) | Freeze `canonicalizeEvidence` under change control; any future algorithm must be applied by a reader keyed to write-epoch/version **outside** archived bodies (Constraint 6), never by rewriting rows | N | Y-if-changed | N |
| **M2-HASH-2** Hash primitive replacement | Swapping sha256 in `evidenceContentHash` | All ids+hashes change; old records verify only under sha256; no algo tag (and none permitted) | M2 | Keep sha256 permanently for existing records; if ever superseded, dual-hash by external write-epoch, never re-mint archived bodies | N | Y-if-changed | N |
| **M2-HASH-3** Unicode normalization of payload strings | Provider payload carries human strings (team/league names) whose composed↔decomposed form varies between fetches | Different bytes → different hash: benign re-fetch of the same window becomes **`immutable_violation`**; or forked records | M4 (payload contents defined) | Decide payload string policy at M4: if payloads carry strings, NFC-normalize at the M4 normalization boundary before hashing. Non-issue while payloads are purely numeric | N | Y-if-strings | N |
| **M2-HASH-4** `-0` / number identity | Normalized payload contains `-0` | `JSON.stringify(-0)="0"` → `-0` and `0` hash identically and round-trip to `+0`; `-0` provenance silently lost (deterministic, not a break) | M4 | Accept as documented coercion; if signed-zero ever carries meaning, encode it as a string at M4 | N | N | N |
| **M2-HASH-5** Large-number precision | Provider integer stat > 2^53 in payload | Precision lost identically at build and `JSON.parse` readback, so hash still matches, but the retained value is wrong | M4 | Encode out-of-range integers as strings at M4; negligible for football denominators | N | N | N |
| **M2-HASH-6** Old-record verification is all-or-nothing / load-bearing for availability | Any HASH-1/2 drift, or a single corrupted line | `readAll` throws on the first failing line → `get`/`list`/`append` all fail; hash stability governs **availability**, not just integrity | M2 | Keep the canonicalization+primitive frozen; pair with line-level quarantine tooling (see M2-PROD-4) so one bad line ≠ total outage | N | N | N |

---

## 3. Record schema evolution

Positive baseline: the hash covers **only** `{source, fixtureId, captureWindowKey, payload}`, so any
new top-level record field is automatically hash-excluded (like `retrievedAt`), and
`isProviderArchiveRecordShape` ignores unknown extra fields. A sanctioned additive path already exists.

| Risk id | Trigger | Impact | Earliest milestone | Mitigation | M2✓ | Prod | PG |
|---|---|---|---|---|---|---|---|
| **M2-SCHEMA-1** Adding provenance / request-metadata fields | Future need for endpoint, request id, http status, provider API version | Safe **iff** added as optional, hash-excluded, top-level fields; a *required* or hash-included field breaks all historical records | M4+ | Follow the `retrievedAt` precedent: optional, top-level, hash-excluded; readers default it when absent. Not needed now | N | N | N |
| **M2-SCHEMA-2** Metadata leaking into `payload` | Someone stores request metadata inside `payload` | `payload` is hashed and is the replay basis → forks hashes / immutable_violation and pollutes replay inputs | M4+ | Doc rule: metadata lives at record top level (hash-excluded), **never** in `payload` | N | N | N |
| **M2-SCHEMA-3** Normalized-payload shape change (unversioned) | M4/M5 evolve what fields the normalized input carries | Old vs new payload shapes coexist with **no discriminator**; derivation/replay can't tell them apart | M5 / M7 | Introduce `evidenceInputVersion` at M7 as the discriminator; absence ⇒ v1; dispatch by it in readers. No M2 change | N | N | N |
| **M2-SCHEMA-4** Strict reader rejecting historical records | A future reader requires a later-added field or rejects unknown fields | Historical records rejected → fail-closed unreadability | M5+ | Mandate lenient readers: ignore unknown fields, default missing ones; never reject a record solely for lacking a later field (current shape guard is already lenient) | N | N | N |
| **M2-SCHEMA-5** Discriminated/versioned decoding without touching M2 | Need to decode multiple payload generations | Achievable without changing the frozen M2 record: version is inferred (absent⇒v1) or carried in a future optional hash-excluded field, dispatched by a reader | M7 | Record the strategy now; keep the M2 record frozen | N | N | N |

---

## 4. NDJSON → Postgres migration

`prv_` id is a stable, content-derived primary key; there is **no sequence/monotonic counter** (order
is fully derivable from `(captureWindowKey, source, id)` via `compareProviderRecords`), which makes the
migration simpler than the evidence archive. Semantics to preserve: **same id + same hash = duplicate
no-op; same id + different hash = immutable_violation.**

| Risk id | Trigger | Impact | Earliest milestone | Mitigation | M2✓ | Prod | PG |
|---|---|---|---|---|---|---|---|
| **M2-PG-1** Wrong unique-constraint semantics | Migration uses `UNIQUE(id, contentHash)` instead of `UNIQUE(id)` | Permits two rows with same id/different hash → silently admits the exact immutable_violation the store forbids | Postgres cutover | PK/UNIQUE on **`id` only**; detect hash conflict in app code on `ON CONFLICT (id)` (compare stored hash), mirroring `acca-publication` SQLSTATE 23505 handling | N | N | Y-if-unhandled |
| **M2-PG-2** Duplicate physical lines | Same id+same hash written twice (replay/multi-writer) | Benign: `INSERT ... ON CONFLICT (id) DO NOTHING` dedupes | Postgres cutover | Content-addressed idempotent insert; no action beyond ON CONFLICT | N | N | N |
| **M2-PG-3** Conflicting physical lines | Same id, **different** hash lines coexist (from a writer race, M2-PROD-2) | Migration must choose/quarantine; a naive bulk insert either errors the batch or admits the wrong row | Postgres cutover | Pre-migration scan for duplicate-id/different-hash; quarantine + halt for review; never auto-resolve | N | N | Y-if-unhandled |
| **M2-PG-4** Malformed legacy lines abort import | A single corrupt/failed-integrity line | Adapter `readAll` throws on first bad line → whole batch aborts | Postgres cutover | Migrate by streaming the file line-by-line with a **quarantine** path for bad lines, not via the O(N) adapter reads | N | N | Y-if-unhandled |
| **M2-PG-5** Batching / ordering | Large file import | Safe: inserts are idempotent+re-runnable; order need not be preserved (comparator derives from columns) | Postgres cutover | Stream in batches, checkpoint by file offset, one transaction per batch, ON CONFLICT DO NOTHING; handle conflicts (PG-3) outside the bulk path | N | N | N |
| **M2-PG-6** Verification | Confirming a faithful import | Because ids/hashes are deterministic, verification is a pure recompute (`verifyProviderArchiveRecord` parity) + row-count vs distinct-valid-id count | Postgres cutover | Post-import full recompute-and-compare; block cutover until parity proven | N | N | N |
| **M2-PG-7** Transactional import & rollback | Cutover / abort | NDJSON stays source of truth until verified; rollback = flip adapter env back to file (Constraint 1, reversible flip); reverse = `DROP TABLE` | Postgres cutover | Shadow-write + verify period; single reversible env flip; retain NDJSON through the window | N | N | N |

---

## 5. Reader compatibility

| Risk id | Trigger | Impact | Earliest milestone | Mitigation | M2✓ | Prod | PG |
|---|---|---|---|---|---|---|---|
| **M2-READ-1** Reading old normalized payloads | Payload is open + unversioned; a future reader meets a v1 payload | Cannot distinguish payload generations without a discriminator | M5 / M7 | `evidenceInputVersion` dispatch (M7), absence⇒v1; readers stay lenient (SCHEMA-4) | N | N | N |
| **M2-READ-2** Provider schema drift is absorbed at normalization — but re-normalization is impossible | Raw provider shape changes (M4 remaps raw→normalized); raw JSON is **not** retained (§5.7) | Old records keep their old normalized payload → replay stays deterministic (**positive**); but the normalization mapping's meaning silently splits v1/v2 with no marker | M4 / M5 | Freeze payload key **semantics** per `evidenceInputVersion`; a changed normalization ⇒ new version, never a re-key of old records | N | N | N |
| **M2-READ-3** Immutable historical replay | §4.9-G byte-identical reproduction required years later | Holds only while canonicalization + sha256 + id formula are frozen (HASH-1/2, ID-1) | M2 | Freeze those three; they are the replay guarantee's foundation | N | N | N |
| **M2-READ-4** Reinterpreting old records under new assumptions | A payload key's meaning is repurposed | Old records silently misread; no discriminator prevents it | M5 / M7 | Never repurpose a payload key; new meaning ⇒ new key or new `evidenceInputVersion` | N | N | N |

---

## 6. Production limits

| Risk id | Trigger | Impact | Earliest milestone | Mitigation | M2✓ | Prod | PG |
|---|---|---|---|---|---|---|---|
| **M2-PROD-1** Archive growth / O(N) append | Sustained capture; `append` calls `readAll` (whole-file) before every write | Append is O(N), building the archive O(N²); the file.ts "O(1) per append" note is true only for `appendFile`, not the read-before-write. Hard wall at scale | M9 / production | **Postgres readiness gates sustained production** (Constraint 2, register R1). NDJSON is initial-adapter-only (Constraint 1) | N | **Y** | N |
| **M2-PROD-2** Multi-process writers not safe | Capture parallelized without external serialization | `readAll`→`appendFile` is non-atomic and lock-free: two writers each see an empty existing → both append; same-id/different-hash pair persists **undetected** (each line self-verifies) → later PG-3 | M9 / production | Enforce single-writer via the M9 advisory lock / single cron (contract §M9); the adapter is single-writer-only by design | N | **Y-unless single-writer** | N |
| **M2-PROD-3** Filesystem append atomicity/durability | Payload line > PIPE_BUF (~4 KB), or networked FS (NFS), or crash mid-append; no fsync | Torn/interleaved/partial lines → malformed NDJSON → fail-closed total read outage; tail loss on crash | M9 / production | Single-writer + local FS + sub-PIPE_BUF lines; otherwise Postgres. Treat large payloads as a trigger to prioritize cutover | N | N | N |
| **M2-PROD-4** Corruption recovery is all-or-nothing | One corrupt line anywhere in the file | Detection is **excellent** (every line integrity-checked, fail-closed — better than the evidence adapter which skips) but `readAll` throws on first bad line → whole archive unreadable | M9 / production | Add external line-level quarantine/repair tooling (doc/runbook); Postgres isolates per-row. Keep the strict detection | N | N | N |
| **M2-PROD-5** Backup/restore truncation blind spot | Partial/truncated backup copy | Content-addressing makes restore verifiable and idempotent re-capture can refill recent tail — **but** truncation is only noticed when a reader hits it | M9 / production | Capture byte-length/line-count in the backup manifest; verify restores by full re-scan (pure recompute) | N | N | N |
| **M2-PROD-6** Provider archive is the sole non-reconstructable replay basis | Loss/corruption of `records.ndjson` | Raw JSON is not retained (§5.7) and past pre-kickoff windows cannot be re-fetched live → losing the archive **permanently** destroys Historical Capture replay (§4.9-G) for affected windows | M9 / production | **Mandatory backup/DR before production activation**; the provider archive is a first-class durable asset, not a cache. Elevates PROD-5 from nice-to-have to a production gate | N | **Y** | N |

---

## Positive findings (do not "fix")
- Identity correctly **excludes payload**; hash correctly **excludes `retrievedAt`** → benign re-fetch dedupes, meaningful change splits. Verified by tests.
- Hash covers only `{source, fixtureId, captureWindowKey, payload}` → additive optional top-level fields are forward-compatible for free.
- Stored line uses insertion-order `JSON.stringify` but the hash uses sorted-key canonicalization → **serializer key-order changes cannot break hashes**.
- Fail-closed reads (no silent malformed-line skipping) → strong corruption **detection**.
- No `sequence`/monotonic field → migration ordering is derivable from columns, simpler than the evidence archive.
- `modelVersion` correctly absent from provider-archive identity and hash (test-asserted), aligning with the M7 input-vs-scoring identity separation.

## Gating summary
- **Blocks M2 closure:** none. M2 is correct and integrity-strong at its current envelope. **No frozen-contract change recommended.**
- **Blocks production activation:** M2-PROD-1 (Postgres readiness — Constraint 2), M2-PROD-6 (mandatory DR/backup of the non-reconstructable replay basis), and M2-PROD-2 unless single-writer serialization is enforced.
- **Gates Postgres migration (if unhandled):** M2-PG-1 (UNIQUE on `id` only), M2-PG-3 (conflict quarantine), M2-PG-4 (malformed-line quarantine).
- **Frozen-forever the instant M2 writes its first production record:** the id formula (ID-1), canonicalization (HASH-1), and hash primitive (HASH-2). These three carry the §4.9 replay guarantee and must never change for existing records.

M2 MIGRATION REVIEW COMPLETE
