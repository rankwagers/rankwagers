# Sprint 23B — Milestone M2 (Provider Archive: normalized-input retention) — Failure Review & Safety Addendum

Status: **RECORDED (analysis + acceptance gates only)** — no runtime code changed, no frozen types/fields altered, no fixes implemented.
Scope: ONLY M2 — `lib/evidence-capture/provider-archive/{record,store,memory,file}.ts` and `tests/providerArchive.test.ts`.
Governs against: implementation contract §2.E/§3/§4.1/§4.9, Phase 2.7 DoD (crit. 3/4/8), future-migration risk register R1/R2/R3/R5.
Standing fact: **M2 is dormant** — `EVIDENCE_CAPTURE_ENABLED` defaults OFF (§6.3) and **no writer/orchestrator calls `store.append`** yet. Every "writer" scenario below concerns the adapter's own read-modify-write and the future wired caller.

---

## 1. Writer failures

The file adapter's `append` = `verify → readAll → find existing → decide → mkdir → appendFile`. No lock, no fsync, no atomic-rename.

| Scenario | Behaviour | Verdict |
|---|---|---|
| crash **before** append | nothing written; retry rebuilds byte-identical record (id/hash exclude `retrievedAt`) → appends | **safe** |
| crash **during** append | `appendFile` can leave a **truncated/partial final line**. Next `readAll` → `JSON.parse` throws → `malformed NDJSON at line N` → **every read AND append for every fixture fails** until manual repair | **critical (F1)** |
| crash **after** append, before response | record durable; caller retries → `readAll` finds same id + same hash → `duplicate` no-op | **safe** (retrievedAt-exclusion is what makes this work) |
| retry after **uncertain** append | safe iff retry re-normalizes the *same* payload; if provider changed → same id, different hash → `immutable_violation` (first write wins, window frozen) | **safe / by-contract** |
| duplicate retry | `duplicate` no-op | **safe** |
| conflicting retry | `immutable_violation` | **safe / by-contract** |
| disk full (ENOSPC) | caught → `write_failed`; but a **partial line may already be on disk** → poisons all subsequent reads (see F1). No fsync → an ok-returning append may not be durable across power loss | **F1 + durability gap (F5)** |
| permission denied (EACCES) on write | `mkdir`/`appendFile` → `write_failed` | safe-ish |
| permission denied / EIO on **read** | `readAll`'s `readFile` catch returns `[]` for **any** error → EACCES/EIO **masquerade as "empty archive"**; `get`/`listByFixture` silently return empty; admission-read sees "no existing" | **F2 (fail-open read)** |
| directory missing | `append` does `mkdir(recursive)`; reads treat ENOENT as empty | safe |
| file deleted / replaced mid-flight | `appendFile` recreates the file → **prior records silently lost**; a substituted but internally-consistent file passes per-line verify (no file-level anchor/checksum) | **F3 (undetected substitution/loss)** |
| malformed existing line | `readAll` throws → all reads/appends fail closed | **F1 (no quarantine/recovery)** |
| corrupted hash on a line | `verifyProviderArchiveRecord` false → `readAll` throws `corrupted record at line N` | detected, but **F1 blast radius** |
| partial final line | = crash-during-append → **F1** | **critical** |

**F1 (headline):** the reader is whole-file and fail-closed with **no torn-line quarantine and no automated recovery** — a single bad byte from a crash/ENOSPC/torn NFS write makes the *entire* provider archive unreadable **and unwritable for all fixtures**, permanently, until an operator hand-edits the file. This is *intentional* "no silent recovery" (M2 §6/§7) but the blast radius + absence of a recovery runbook is the risk.
**F2:** IO read errors are swallowed to `[]` — inconsistent with the module's fail-closed intent; only *parse/integrity* failures are fail-closed, *IO* read failures are fail-**open**.
**F3/F5:** no file-level integrity anchor (whole-file loss/substitution undetectable) and no fsync (no durability barrier).

## 2. Concurrent writers

There is **no lock** anywhere in `file.ts`; `append` `await`s between the admission read and the write, so the read-modify-write is **not atomic**.

- **same id / same hash (race):** both readAll see no existing → both append → **two identical physical lines**. `listByFixture` returns the record **twice** (no dedup on read). → duplicate physical records, silent.
- **same id / different hash (race):** both see no existing → both append → **two conflicting bodies under one id, both individually valid** (per-line verify passes). `get` returns the first physical line; `listByFixture` returns both. The `immutable_violation` guard **only fires when the conflict is serialized** — a race bypasses it entirely. → **conflicting physical records, silent, undetected** (F4).
- **interleaved append / stale read before append:** the admission snapshot is stale by write time → same duplicate/conflict outcomes.
- **separate Node processes:** no shared in-memory guard (memory adapter is per-instance); file adapter has no flock/lockfile → same races cross-process.
- **separate hosts on shared FS (NFS):** `O_APPEND` atomicity is **not guaranteed** on NFS → concurrent appends can **interleave bytes within a line** → malformed NDJSON → F1 whole-archive poison. Plus no cross-host lock.

**F4 (headline):** §4.1 append-only (one hash per id: duplicate-collapse + `immutable_violation`) holds **only under a single serialized writer**. The **memory adapter** enforces it (synchronous `get→set` critical section, no `await` between) within one process; the **file adapter does not**, and nothing wires the existing `lib/jobs/locks.ts`. Concurrency produces duplicate or *conflicting* records that the per-line reader never detects — directly threatening §4.9-G replay determinism.

## 3. Record construction failures

`buildProviderArchiveRecord` + `normalizeProviderPayload` — fail-closed, return `errors[]`, never throw.

| Scenario | Behaviour | Verdict |
|---|---|---|
| malformed fixtureId (NaN/1.5/≤0/string) | `isValidFixtureId` rejects | **fail-closed** ✓ |
| malformed captureWindowKey | only **non-empty string** checked — **no structural (`${fixtureId}\|${capturedAt}`) validation, no anchor canonicalization** | **gap (F6)** |
| source mismatch | trimmed + non-empty only — **no case/closed-set normalization** (`"FootyStats"` ≠ `"footystats"` → different id/hash) | **gap (F6)** |
| malformed retrievedAt | `isValidInstant` (lenient `Date.parse`) → parseable garbage accepted, canonicalized; **excluded from hash** so only provenance is wrong | minor (F7) |
| invalid payload (fn/symbol/undefined/bigint/non-finite) | `ProviderPayloadError` → caught → `ok:false` | **fail-closed** ✓ (tested) |
| oversized payload | **no size cap** — MB-scale line accepted, whole file read into memory | **gap (F8)** |
| deeply nested payload | recursive normalize **no depth cap** → `RangeError` — but caught → `ok:false` | fail-closed, coarse (F8) |
| circular payload | `WeakSet` cycle detect → `ok:false` | **fail-closed** ✓ (tested) |
| shared-ref **DAG** payload | `seen.delete` after each node allows re-entry → a deep diamond DAG **expands exponentially** (2^depth) → hang/OOM before any cap | **gap (F8, algorithmic DoS)** |
| getter throws | thrown during `obj[key]` access → caught (Error or not) → `ok:false`; getter side-effects do run | fail-closed |
| class instance | proto ≠ `Object.prototype`/`null` → rejected | **fail-closed** ✓ (tested; cross-realm plain objects also rejected — edge) |
| binary values (Buffer/TypedArray) | non-plain proto → rejected | **fail-closed** ✓ |

**F6:** the record layer trusts `captureWindowKey` and `source` as opaque strings. A non-canonical window anchor (`...17:00:00Z` vs `...17:00:00.000Z`) or case-variant source mints a **divergent id for the same logical window** → dedupe defeated, `compareProviderRecords` mis-orders. Safe only because the *future* single wired caller supplies canonical values.
**F8:** no payload size / depth / DAG-expansion bound and no archive-wide size bound (§5.7 "no unbounded" is about raw-vs-normalized, not magnitude; R1 is about count). Algorithmic-complexity and memory DoS are reachable from a hostile/buggy provider payload.

## 4. Replay failures

- **parses but hash fails:** `verifyProviderArchiveRecord` recomputes → mismatch → `readAll` throws → **detected** (DoD-3) ✓.
- **hash passes but provenance malformed:** `retrievedAt` is **not hashed and not re-validated** by `verifyProviderArchiveRecord` (shape check is only `typeof string`) → a garbage `retrievedAt` **survives all integrity checks**. Provenance (DoD-8) is **trust-on-write, no read-time protection** (F7 — inherent to hash-excluding retrievedAt; a documented trade-off, not a fixable defect without breaking dedupe/contract).
- **payload round-trip changes semantics:** `JSON.parse(JSON.stringify(...))` on a normalized JSON-safe payload is lossless; `-0`→`0` and key-order both canonicalize identically in the hash → **stable** ✓.
- **duplicate physical records / conflicting physical records:** produced by §2 races, **not detected** by per-line integrity; replay `get(id)` deterministically returns the first physical line but a hidden second body exists (F4).
- **source naming changes in future:** `id = f(source, …)` → any source rename orphans historical ids; new captures mint different ids (risk R5).
- **hash canonicalization changes in future:** shares the **unversioned** `canonicalizeEvidence`/Node-`JSON.stringify` path (risk R2). Any drift (or Node-major serialization shift) → **every** historical provider record fails verify → F1 total-archive outage. More acute here than the evidence adapter because the reader is fail-closed whole-file. `hashAlgoVersion`/new field is forbidden (Constraint 6).

## 5. Operational observability — distinguishability matrix

Codes: `invalid_record`, `immutable_violation`, `write_failed`; read path throws `Error("malformed NDJSON at line N" | "corrupted record at line N")`.

| Failure class | Signal today | Distinguishable? |
|---|---|---|
| invalid record | `invalid_record` (append) | **Yes** ✓ |
| immutable conflict | `immutable_violation` (append) | **Yes** ✓ (serialized only) |
| duplicate | `ok:true, duplicate:true, appended:false` | **Yes** ✓ |
| I/O failure | `write_failed` (append) / **swallowed to `[]`** on read | **Partial** — read-IO invisible (F2) |
| corruption | read: thrown message; **append: collapsed into `write_failed`** | **Partial** — no typed code; append conflates with transient IO |
| parse failure | thrown `"malformed NDJSON…"` message only | **Partial** — message-only, no code |
| race / physical conflict | **none** | **No (F4)** — the exact "no lock" outcome is silent |

**F9:** `write_failed` conflates **permanent corruption** (admission `readAll` threw) with **transient write IO** (ENOSPC/EACCES). A caller cannot tell "quarantine & alert" from "safe to retry"; auto-retry on a corruption-class `write_failed` **hot-loops forever**. Race-created duplicates/conflicts have **no signal at all**.

---

## 6. M2 Safety Acceptance Addendum (binary gates)

Every gate is PASS/FAIL against a named deterministic check. No gate adds a field, alters a frozen type, or requires runtime code beyond the wired caller/DB/telemetry it names. "already green" = provable against shipped `tests/providerArchive.test.ts`.

### A. Blockers before M2 can CLOSE
*(Component-level guarantees; provable offline / in-adapter now. All must be green to legitimately mark M2 done.)*

| ID | Binary gate | Status |
|---|---|---|
| A1 | Normalization fails closed on **every** non-JSON-safe input (fn, symbol, `undefined`, `bigint`, non-finite, class instance, Buffer/TypedArray, circular) → `ok:false`, never throws out of `buildProviderArchiveRecord`. | already green |
| A2 | Deterministic identity: identical `(source, fixtureId, captureWindowKey, payload)` → identical `id` + `contentHash` irrespective of object key order, timezone spelling, and `retrievedAt`. | already green |
| A3 | Serialized append semantics on **both** adapters: byte-identical re-append → `duplicate` no-op; same-id/different-hash → `immutable_violation`. | already green |
| A4 | Read-time fail-closed: a malformed NDJSON line and a hash/id-corrupted line each make `get`/`listByFixture` reject, and a corrupted admission-read makes `append` fail (never a silent-recovery success). | already green |
| A5 | **Torn/partial final line** (crash-/ENOSPC-during-append simulation: append a truncated line) is treated as corruption by the reader — named test pinning F1, so "no silent recovery" is a proven property, not incidental. | **ADD** |
| A6 | **Single-writer precondition recorded in the DoD trace:** DoD crit. 4 for the *file* adapter is claimed ONLY under a single serialized writer; a named test demonstrates that unserialized concurrent appends can yield duplicate/conflicting physical lines (invariant is **not** self-enforcing → F4). Closing M2 must not overclaim §4.1 for the file adapter. | **ADD (record)** |
| A7 | **`write_failed` overload recorded:** a test/doc pins that `write_failed` covers both admission-read corruption and write IO (F9), with the stated caller rule: a corruption-class `write_failed` MUST NOT be auto-retried. | **ADD (record)** |

### B. Limitations ACCEPTABLE while M2 remains dormant
*(No gate now; recorded so they are not "discovered" at activation. Each is safe only because no writer is wired and flags are OFF, §6.3.)*

- **B1** No lock / non-atomic read-modify-write in the file adapter (F4) — safe while single/no writer.
- **B2** Whole-archive fail-closed blast radius with no automated quarantine/recovery (F1) — acceptable dormant; becomes a runbook requirement at activation.
- **B3** IO read errors (EACCES/EIO) swallowed to empty archive (F2) — nothing to read while dormant.
- **B4** No payload size/depth/shared-ref-expansion bound and no archive-wide size bound (F8).
- **B5** `captureWindowKey`/`source` not structurally validated or canonically normalized at the record layer (F6) — relies on a canonical single caller.
- **B6** `retrievedAt` has **no** read-time integrity protection (F7) — permanent, by-design trade-off (excluded from hash to enable benign-refetch dedupe); provenance is trust-on-write.
- **B7** No fsync/durability barrier and no whole-file integrity anchor (F3/F5) — power-loss durability deferred to Postgres.

### C. Requirements before PRODUCTION ACTIVATION
*(Must be green before `EVIDENCE_CAPTURE_ENABLED` performs durable writes. All satisfiable without touching frozen types — caller/writer, telemetry, or ops.)*

| ID | Binary gate |
|---|---|
| C1 | **Single-writer enforcement:** the wired capture writer serializes provider-archive appends through `lib/jobs/locks.ts`. Gate: N concurrent capture runs over one fixture-window produce **zero** duplicate and **zero** conflicting physical records; `listByFixture` returns ≤1 record per id (closes F4). |
| C2 | **Cross-record integrity sweep:** a whole-archive check detects duplicate ids and same-id/different-hash conflicts that per-line verify misses. Gate: a seeded conflicting/duplicate archive is flagged FAIL (closes F4 detection). |
| C3 | **Corruption vs transient-IO distinguishability + recovery runbook:** corruption-class and transient-IO failures emit distinct operator signals; corruption-class never auto-retries; a documented quarantine/repair procedure for a torn/corrupt line exists and is tested (closes F1 ops-gap, F9). |
| C4 | **Surface IO-read unavailability:** `get`/`listByFixture` distinguish ENOENT (legitimately empty) from EACCES/EIO (unavailable) — a permission-denied fixture yields a surfaced "unavailable" signal, never `[]` (closes F2). |
| C5 | **Payload bounds:** enforce max normalized-payload byte size + max nesting depth + reject shared-ref expansion blowup, all fail-closed within bounded time/memory. Gate: oversize / deep / DAG-bomb payloads → `ok:false` and no OOM/hang (closes F8). |
| C6 | **Caller-side identity canonicalization:** the wired writer supplies a `captureWindowKey` matching `${fixtureId}\|${capturedAt}` with a canonical ISO anchor and a canonical `source`. Gate: a non-canonical window anchor or case-variant source cannot mint a divergent id for the same logical window (closes F6). |
| C7 | **Freshness/quality gate (§5.13):** a transient/partial/timeout provider fetch is **not** persisted as the record that permanently wins the window. Gate: a degraded fetch is refused at the writer, not frozen as the window's replay basis. |
| C8 | **NDJSON is staging-only (Constraint 1/R1):** production activation of durable capture is gated on C-D Postgres readiness; sustained production on the file store is prohibited. |

### D. Requirements before POSTGRES MIGRATION
*(Per risk register R1/R2/R3/R5 and governing Constraints 1-6. No archived body is rewritten; no new field; no id re-key.)*

| ID | Binary gate |
|---|---|
| D1 | **Postgres provider-archive adapter passes every A-gate + C1/C2 structurally:** a DB `UNIQUE(id)` + append-only role (no UPDATE/DELETE grant) enforces one-hash-per-id transactionally. Gate: attempted overwrite/delete rejected at the DB; the M2 DoD gates pass against the Postgres adapter (R1, Constraints 1-2). |
| D2 | **Hash-canonicalization pinning (R2):** before any canonicalization change or Node-major upgrade, historical provider records still verify under the algorithm in force when written; canonicalization is change-controlled; disambiguation lives in an **external reader-side registry**, never a `hashAlgoVersion`/new snapshot field (Constraint 6). |
| D3 | **Source-identity stability (R5):** `source` is a frozen identity input; a provider rename / second provider is handled by a mapping layer **outside** archived rows. Gate: migration re-keys **no** historical id; every historical id stays reachable. |
| D4 | **Version read-compat (R3/Constraint 3):** the Postgres reader accepts every record shape ever emitted; no version dropped from read support. |
| D5 | **Migration preserves duplicate/conflict history for audit:** any duplicate/conflict physical records found by C2 are quarantined, not silently collapsed, during import (no undetected data loss across the cutover). |

---

M2 FAILURE REVIEW COMPLETE
