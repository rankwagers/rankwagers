# Sprint 23B — Milestone M8 (Settlement & Validation Revisions) — Implementation

**Status:** IMPLEMENTED — pure/dormant/injectable; no frozen contract changed; not activated. Date 2026-07-29.
**Governing authority (in precedence order):** `docs/plans/m8-settlement-architecture-review.md` (conditions R1–R7),
then the frozen code contracts, then `docs/architecture/phase-2-7-implementation-plan.md` §M8. The older
`docs/plans/sprint-23b-evidence-capture-settlement.md` Phase 4 is superseded where it conflicts (it named
`listSettleState`; see R2).

## Module structure
- **`lib/evidence-capture/outcomes.ts`** — pure, total outcome mapper. `resolveValidationOutcome(input)` maps one
  supported snapshot selection of a terminal fixture → a discriminated `ValidationOutcome`. No I/O, no clock, no
  mutation. Reuses frozen primitives `resolveHalfScores`, `isPredictionWin`, `kindForMarketKey`, `isIsoInstant`.
- **`lib/evidence-capture/settlement.ts`** — dormant orchestration over the frozen store + frozen validation
  builders. `settleSnapshot` / `settleLatestSnapshotForFixture`, plus `determineCorrectionReason` and the
  default-off flag. Node-only (frozen hashing).
- **`tests/evidenceSettlement.test.ts`** — 34 tests incl. the real NDJSON serialization/revision replay proof.

**Files modified:** none. No frozen type, no M0–M7 module, no archive adapter, no shared `featureFlags.ts` touched.

## Final public APIs
```
// outcomes.ts
resolveValidationOutcome(input: ValidationOutcomeInput): ValidationOutcome
type ValidationOutcome =
  | { kind:"settled"; state:"won"|"lost"; reasonCode:"settled_result"; settledAt }
  | { kind:"terminal_non_scored"; state:"postponed"|"cancelled"|"abandoned"|"void";
      reasonCode:"fixture_postponed"|"fixture_cancelled"|"fixture_abandoned"|"market_void"; settledAt }
  | { kind:"pending"; state:"pending"; reasonCode:"awaiting_result" }
  | { kind:"unsupported"; marketKey; selectionKey; message }
  | { kind:"invalid"; code:"malformed_row"|"invalid_lifecycle"|"invalid_timestamp"; message }

// settlement.ts
settleSnapshot(store, input: SettleSnapshotInput): Promise<SettlementResult>
settleLatestSnapshotForFixture(store, { fixtureId, ...rest }): Promise<SettlementResult>
determineCorrectionReason(cause: CorrectionCause): "settlement_correction"|"data_correction"|null
isEvidenceSettlementEnabled(flag?=EVIDENCE_SETTLEMENT_ENABLED): boolean
const EVIDENCE_SETTLEMENT_ENABLED = false
const SETTLEMENT_ENGINE = "evidence_settlement"
type CorrectionCause = "result_reinterpreted" | "source_lineage_changed"
type MarketSettlementStatus = appended|no_change|pending|unsupported|invalid_input|immutable_violation|append_failed
type SettlementResult = { ok, status:"settled"|"not_found"|"invalid_input", snapshotId, fixtureId, markets[], summary, message? }
```

## Outcome mapping table
| Lifecycle (`resolveMatchLifecycle`) | Data gate | state | reasonCode | Persisted? |
|---|---|---|---|---|
| `finished` + `isPredictionWin` true | required score inputs present | `won` | `settled_result` | yes (rev 1) |
| `finished` + `isPredictionWin` false | required score inputs present | `lost` | `settled_result` | yes (rev 1) |
| `finished`, FH/SH with HT/SH score missing | — | `pending` | `awaiting_result` | **no** |
| `finished` but `row.isFinished===false` | — | `pending` | `awaiting_result` | **no** |
| `postponed` | valid instant | `postponed` | `fixture_postponed` | yes (rev 1) |
| `cancelled` | valid instant | `cancelled` | `fixture_cancelled` | yes (rev 1) |
| `abandoned` | valid instant | `abandoned` | `fixture_abandoned` | yes (rev 1) |
| `suspended`/`live`/`half_time`/`pre_match`/`scheduled`/`unavailable` | — | `pending` | `awaiting_result` | **no** |
| authoritative `authoritativeMarketVoid===true` | valid instant | `void` | `market_void` | yes (rev 1) |
| unsupported market/selection | — | — (unsupported) | — | **no** |
| malformed row / bad lifecycle / bad instant | — | — (invalid) | — | **no** |
| later authoritative change of any persisted terminal | — | corrected terminal | `settlement_correction`/`data_correction` | yes (rev N+1) |

`market_void` is **never** produced from daily-list data — only via the explicit `authoritativeMarketVoid` flag,
which no daily-list caller sets. Cancelled/postponed/abandoned/missing-score can never become `lost`.

## Lifecycle authority (R2)
Terminal classification is `resolveMatchLifecycle` only. `listSettleState` is deliberately NOT used (it returns
only won/lost/pending/postponed and cannot express cancelled/abandoned). Test 31 proves settlement yields
`cancelled` — a state `listSettleState` cannot produce — even when `row.listResult==="won"`.

## Deterministic timestamp rule (R1)
`recordedAt = settledAt = the caller-supplied completionInstant` (a source-derived terminal instant). The mapper
never substitutes a clock: a missing/invalid `completionInstant` returns `invalid` (`invalid_timestamp`) and
settlement returns `invalid_input`. `resolveMatchLifecycle` is always called with an explicit integer `nowSec`
(non-integer `nowSec` fails closed) — its `Date.now()` default is never reached. Consequence: replaying the same
authoritative source data reconstructs a byte-identical `ValidationRecord` (same `revisionId` **and**
`contentHash`), so re-settlement is absorbed as a no-op duplicate. No `Date.now`/`new Date`/`Math.random`/
`process.env`/`localeCompare` appears in either module (grep-verified; the only textual hits are comments and the
frozen `market_void`/`void` union members).

## Missing-data policy (R3)
`over15`/`over25` need only FT (`homeScore+awayScore`). `fh` requires `resolveHalfScores(row).htKnown`; `sh`
requires `shKnown`. A `finished` fixture that is not reflected as `row.isFinished` is treated as incomplete. When
the required inputs are absent the outcome is `pending` (no record) — a missing score is **never** settled as
`lost`. `isPredictionWin` is only consulted after completeness is proven.

## Pending write policy (R4)
`pending`/`awaiting_result` writes **no** `ValidationRecord`. Settlement reports a per-market `pending` status and
appends nothing; repeated calls stay no-op. The absence of a record IS the pending state; revision 1 is always a
terminal settlement. (No frozen code requires a persisted pending row.)

## Correction reason rule (R5)
The frozen `ValidationRecord` carries no source lineage, so the smallest explicit typed cause is required and
validated fail-closed: `CorrectionCause` → `determineCorrectionReason`:
- `result_reinterpreted` → `settlement_correction` (authoritative result/lifecycle changed; same retained lineage)
- `source_lineage_changed` → `data_correction` (retained source/input basis was replaced by a provider correction)

A correction (state change on an already-settled selection) with no `correctionCause` returns `invalid_input` and
appends nothing — never an arbitrary default. Same inputs always yield the same reason code (and thus hash). The
correction `note` is a deterministic pure function of the transition (`${from}->${to}:${reason}`).

## Settlement subject rule (R6)
The subject is ONE immutable snapshot (`settleSnapshot`), identified by `snapshotId` via
`validationId({snapshotId, marketKey, selectionKey})`. `settleLatestSnapshotForFixture` is a convenience that
settles ONLY the latest snapshot, selected by the store's frozen `sequence` ordering (`latestSnapshot`), never by
archive read order; it never settles multiple historical snapshots in one call (tests 38–40). A fixture with no
snapshot returns `not_found`.

## Revision / idempotency behavior
- Initial settlement mints revision 1 via `createValidationRecord`.
- Unchanged current outcome (head state equals the derived state) → no append (`no_change`).
- Changed outcome → exactly one `reviseValidationRecord`; `revision = head.revision+1`,
  `supersedesRevisionId = head.revisionId` (head = current highest revision, derived not stored).
- Byte-identical rebuild → the store's `(revisionId, contentHash)` idempotency yields `duplicate` → `no_change`.
- `revisionId` + different `contentHash` → `immutable_violation`, surfaced loudly (`ok:false`), **never**
  downgraded (test 24b uses a fake store returning `immutable_violation`).
- Corrections never mutate/delete prior revisions; earlier rows stay byte-identical (verified after correction).

## Concurrency / pre-activation gate (R7)
The frozen `appendValidation` (`lib/archive/evidence/file.ts`) is read-decide-append with **no in-process mutex**.
M8 stays dormant and single-writer. Two settlers planning against the same head are safe: with deterministic
timestamps the loser's append is absorbed as a `duplicate` (test 48), and any genuine divergence is caught as
`immutable_violation` — never a silent divergent revision. **Pre-activation gate:** any future cron/worker MUST
enforce single-writer settlement or a store-level append mutex / Postgres unique-constraint on `revisionId`, and
treat `immutable_violation`/`revision_conflict` as "chain advanced — re-read and retry," not fatal.

## Flag / dormancy proof
`EVIDENCE_SETTLEMENT_ENABLED = false` (a pure constant, no env read) + pure `isEvidenceSettlementEnabled`. M8
ships **no caller** of the flag and no scheduler/cron/route/worker/UI/timer/startup import. Wiring the flag into
the shared `FeatureFlags` framework and gating a scheduler on it is a **deferred M9 activation gate** — done there
rather than expanding the shared `featureFlags.ts` here, to keep M8 to two dormant modules and add no env-read
path to settlement. No `lib/` or `app/` file imports `outcomes`/`settlement` (grep-verified; tests only). Import
has no side effects (test 41).

## Replay proof (real serialization boundary)
`tests/evidenceSettlement.test.ts` → "serialization-boundary settlement + revision replay survives real NDJSON":
persists a real snapshot + settles through the **file** archive (`createFileEvidenceArchive`), reads back through
a fresh store (new-process view of the same dir) and `verifyAllValidationChains`, re-settles identically (0 new
appends, byte-identical `contentHash`), changes the authoritative score (exactly one correction per market),
re-verifies the full chain with earlier revisions byte-identical, repeats the correction (no-op), and proves a
postponed fixture is recorded as `postponed` — never `lost`. It is a genuine write→read→verify→re-settle cycle,
not a `JSON.stringify` of a result object.

## Exact files changed
- Added: `lib/evidence-capture/outcomes.ts`, `lib/evidence-capture/settlement.ts`, `tests/evidenceSettlement.test.ts`,
  `docs/plans/m8-settlement-implementation.md`.
- Modified: none.

## Frozen-contract confirmation
No change to `ValidationRecord`/`ValidationState`/`ValidationReasonCode`/`EvidenceSnapshot` shapes, to the
`validationId`/`revisionId`/`contentHash` formulas, to append-only/chain-verification/current-revision semantics,
or to any M0–M7 module. A settled record carries exactly the 16 frozen `ValidationRecord` keys (test 49).
Settlement state never enters the M7 `inputContentHash` (test 50); M7 bindings are untouched.

## Deferred / gated (activation, Postgres, cron)
- **M9 activation:** wire `EVIDENCE_SETTLEMENT_ENABLED` into `FeatureFlags` (default off), add the cron/route that
  invokes `settleLatestSnapshotForFixture`, and supply the deterministic `completionInstant`/`nowSec` from real
  provider completion data. None built here.
- **Concurrency (R7 gate):** single-writer or store-level atomicity before any concurrent settlement.
- **Persistence/Postgres:** unchanged NDJSON archive; a Postgres unique constraint on `revisionId` would satisfy
  the concurrency gate at the DB tier. Deferred.
- **Fixture-level scan scalability:** `settleLatestSnapshotForFixture` uses the store's indexed `latestSnapshot`;
  no full-archive scan is added in pure evaluation.

## Unresolved objective blockers
None. All architecture-review conditions R1–R7 are resolved in code and tested; the remaining items are
activation-time gates (M9), not M8 blockers.
