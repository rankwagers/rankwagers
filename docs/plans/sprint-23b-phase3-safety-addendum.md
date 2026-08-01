# Sprint 23B — Phase 3 Writer-Safety Acceptance Addendum

Status: **RECORDED (acceptance criteria only)** — 2026-07-28. No code changed.
Not part of Milestone M0. Companion to `docs/plans/sprint-23b-evidence-capture-settlement.md`.

Scope rule: **no frozen-contract changes are proposed.** Frozen contracts for this addendum
are the `EvidenceSnapshot` shape (`types/evidence`), the append-only store contract
(`lib/archive/evidence/store.ts` — id+contentHash idempotency, `immutable_violation`,
no update/delete), and the hash canonicalization (`lib/evidence/hash.ts`). Every item below
is satisfiable without altering any of them; each item's last field asserts this explicitly.

Each acceptance item is **binary and automatable**: a named CI test, a single pass condition
that is true/false, the phase in which the test must be green (blocking), and whether it
touches a frozen contract.

---

## A. Phase 3 capture-writer blockers

These block **merge and activation of the Phase 3 capture writer/cron**. All are enforced in
the writer/orchestration layer; none require a store-contract change.

### A1 — Same-window idempotency pre-check across the full fixture stream
- **CI test:** `capture.idempotency.sameWindowRerun`
- **Pass condition:** Running the writer twice over an identical archive for the same date
  appends **exactly one** snapshot per fixture. The second run reports `appended=false`
  (duplicate/skip) for every fixture, stream length is unchanged, and `head.sequence` is
  unchanged (no seq-2 accretion). The pre-check MUST scan the **entire** fixture stream for a
  snapshot whose `capturedAt === quantizedCapturedAt`, not only the head — the test includes a
  fixture whose same-window snapshot is not the current head and asserts it still dedupes.
- **Blocking phase:** Phase 3 (capture writer).
- **Frozen contract change:** No.

### A2 — One EvidenceSnapshot per fixture/window, all markets grouped
- **CI test:** `capture.grouping.oneSnapshotPerFixtureWindow`
- **Pass condition:** For an archive where a fixture appears in N daily-list tabs, the run emits
  **exactly one** snapshot for that fixture/window and `supportedMarkets` contains all N
  `(marketKey, selectionKey)` pairs. No fixture yields more than one snapshot per run. A partial
  input (missing tab) yields one snapshot with fewer `supportedMarkets`, never a separate chain
  link.
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

### A3 — Single-writer lock across read / derive / append
- **CI test:** `capture.concurrency.singleWriterLock`
- **Pass condition:** Two writer invocations racing on the same fixture stream never both append.
  The second either blocks on the lock or aborts. The resulting stream contains no duplicate
  `sequence` and no two rows sharing an `id` with differing `contentHash`; `verifyEvidenceChain`
  returns `verified: true`. The lock demonstrably spans the whole read→derive→append cycle
  (test fails if the lock is released before append).
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

### A4 — Stable `capturedBy = "evidence_capture"`
- **CI test:** `capture.provenance.stableCapturedBy`
- **Pass condition:** Every snapshot minted by the writer has `capturedBy === "evidence_capture"`
  exactly, independent of host, pid, or wall clock. Replaying the identical capture from a
  different simulated worker yields an identical `contentHash` and dedupes (no
  `immutable_violation`).
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

### A5 — Per-fixture error isolation
- **CI test:** `capture.resilience.perFixtureIsolation`
- **Pass condition:** With one poison fixture (mint throws / rejected) interleaved among healthy
  fixtures, the run completes without throwing, all healthy fixtures are persisted (persisted
  count == healthy count), and the failing fixture is reported in the run result with its error.
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

### A6 — Transient provider / baseline failure never persisted as weak evidence
- **CI test:** `capture.integrity.noWeakEvidenceOnTransientFailure`
- **Pass condition:** Under simulated provider outage, empty/missing archive, null baseline, or
  partial fetch, the writer persists **zero** snapshots for affected fixtures. No snapshot is
  minted from an absent/NaN `modelProbability` coerced to `0`/degraded score. The run
  distinguishes "unavailable/skipped" from "captured" and reports a skipped-unavailable count.
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

### A7 — Replay-safe timestamp normalization
- **CI test:** `capture.replay.timestampNormalization`
- **Pass condition:** Two captures whose nested instants (`bestOddsSnapshot.capturedAt`,
  `operatorAvailability.resolvedAt`) are equivalent but differently formatted produce an
  identical `contentHash`; replay dedupes rather than raising `immutable_violation`. Achieved by
  the writer normalizing all instants **before** calling `createEvidenceSnapshot` (input-side
  normalization; hash function untouched).
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

### A8 — Sequence conflicts surfaced, never silently swallowed
- **CI test:** `capture.errors.sequenceConflictSurfaced`
- **Pass condition:** A forced `sequence_conflict` (stale/concurrent head) is reported in the run
  result as a non-zero conflict/failure count and is **not** counted as a successful capture. A
  store read error MUST NOT be masked as a successful `sequence = 1` capture via the
  `nextEvidenceSequence` catch→1 fallback: a simulated read failure yields a reported failure and
  zero persisted snapshots, not a seq-1 write.
- **Blocking phase:** Phase 3.
- **Frozen contract change:** No.

---

## B. Existing implementation-hardening candidates

Currently shipped defects. These block as a **pre-Phase-3 hardening batch** (must be green before
the Phase 3 writer is activated, because the writer's guarantees depend on them). None change a
frozen contract.

### B1 — Null array validation in `createEvidenceSnapshot`
- **CI test:** `snapshot.validation.nullOperatorArrays`
- **Pass condition:** `createEvidenceSnapshot` with `operatorAvailability.restrictedCountries` or
  `operatorAvailability.operatorKeys` set to `null`/`undefined`/non-array returns
  `{ ok: false, errors: [...] }` and **does not throw** (never-throw contract upheld). Existing
  valid inputs still return `{ ok: true }`.
- **Blocking phase:** Hardening (pre-Phase 3).
- **Frozen contract change:** No (adds validation, reuses existing error result shape).

### B2 — Postgres adapter must fail closed, not silently use file
- **CI test:** `archive.adapter.postgresFailsClosed`
- **Pass condition:** With `EVIDENCE_ARCHIVE_ADAPTER=postgres` and no implemented postgres
  adapter, store resolution throws a clear "adapter not implemented" error naming `postgres`; it
  does **not** return the file adapter. (When a real adapter ships, this test flips to asserting a
  postgres-backed store is returned.)
- **Blocking phase:** Hardening (pre-Phase 3).
- **Frozen contract change:** No (config/factory resolution behavior only).

### B3 — Malformed NDJSON lines require metrics and alerts
- **CI test:** `archive.file.malformedLineMetrics`
- **Pass condition:** `readNdjson` over a file containing K unparseable lines returns the valid
  rows **and** increments a malformed-line counter / emits a metric by exactly K (observable via
  an injected sink or log spy). Zero silent drops; a non-zero count is alert-eligible. Valid rows
  are still returned unchanged.
- **Blocking phase:** Hardening (pre-Phase 3).
- **Frozen contract change:** No (adds telemetry; read/skip semantics unchanged).

---

## Enforcement summary

| ID | CI test | Blocking phase | Frozen-contract change |
|----|---------|----------------|------------------------|
| A1 | `capture.idempotency.sameWindowRerun` | Phase 3 | No |
| A2 | `capture.grouping.oneSnapshotPerFixtureWindow` | Phase 3 | No |
| A3 | `capture.concurrency.singleWriterLock` | Phase 3 | No |
| A4 | `capture.provenance.stableCapturedBy` | Phase 3 | No |
| A5 | `capture.resilience.perFixtureIsolation` | Phase 3 | No |
| A6 | `capture.integrity.noWeakEvidenceOnTransientFailure` | Phase 3 | No |
| A7 | `capture.replay.timestampNormalization` | Phase 3 | No |
| A8 | `capture.errors.sequenceConflictSurfaced` | Phase 3 | No |
| B1 | `snapshot.validation.nullOperatorArrays` | Hardening (pre-Phase 3) | No |
| B2 | `archive.adapter.postgresFailsClosed` | Hardening (pre-Phase 3) | No |
| B3 | `archive.file.malformedLineMetrics` | Hardening (pre-Phase 3) | No |

No contract changes are proposed by this addendum.
