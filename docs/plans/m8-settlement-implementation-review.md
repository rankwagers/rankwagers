# Sprint 23B — Milestone M8 (Settlement & Validation Revisions) — Implementation Review

**Reviewer:** Claude 2 (implementation correctness review)
**Scope:** Implementation review ONLY. No runtime code modified. No features added. Documentation-only.
**Date:** 2026-07-29
**Predecessor:** `docs/plans/m8-settlement-architecture-review.md` (Claude 1, CONDITIONALLY APPROVED, R1–R7 + G1–G4).

> This review verifies the *repository*, not the implementation report. Every claim below was
> checked against actual code behavior and re-run test output, not against comments.

---

## 1. Implementation summary

M8 is **implemented, dormant, and correct**. It adds exactly the two pure modules the architecture
review scoped, plus one test file:

- `lib/evidence-capture/outcomes.ts` — pure, total `(lifecycle, row, market/selection, instant) → ValidationOutcome`
  discriminated union. No clock/env/IO; never throws.
- `lib/evidence-capture/settlement.ts` — injectable orchestration (`settleSnapshot`,
  `settleLatestSnapshotForFixture`) that turns a terminal fixture + one immutable snapshot into
  append-only, revision-aware `ValidationRecord`s **only** through the frozen builders and store contract.

The substrate (`types/evidence/validation.ts`, `lib/validation/records.ts`, `states.ts`, `integrity.ts`,
`lib/archive/evidence/rules.ts`, store adapters, `lib/evidence/identifiers.ts`, `hash.ts`) is **untouched**.
Architecture conditions R1–R7 are all satisfied in code. The module is wired to no runtime.

**Verdict: M8 IMPLEMENTATION APPROVED** (see §14).

---

## 2. Files reviewed

| File | Role | Finding |
|---|---|---|
| `lib/evidence-capture/outcomes.ts` | Pure outcome mapper | Correct, deterministic, fail-closed |
| `lib/evidence-capture/settlement.ts` | Orchestration | Correct, append-only, idempotent, dormant |
| `tests/evidenceSettlement.test.ts` | 34 tests | Genuinely proves the invariants (§7) |
| `types/evidence/validation.ts` | Frozen record contract | Unmodified |
| `lib/validation/records.ts` | Frozen mint/revise builders | Unmodified; used correctly |
| `lib/validation/states.ts` | Frozen state machine | Unmodified |
| `lib/validation/integrity.ts` | Frozen chain verifier | Unmodified |
| `lib/archive/evidence/rules.ts` | Frozen append admission | Unmodified |
| `lib/archive/evidence/memory.ts` / `store.ts` | Store contract + ref impl | Unmodified |
| `lib/evidence/identifiers.ts` | Frozen id formulas | Unmodified |
| `lib/evidence-capture/markets.ts` | Frozen market mapping | Unmodified; used for support gate |
| `lib/fixtures/status.ts` | `resolveMatchLifecycle` | Reused; called with explicit `nowSec` |
| `lib/footystats/predictionWin.ts` / `halfScores.ts` | Scoring | Reused; gated behind completeness |
| `lib/evidence/snapshot.ts` | `isIsoInstant`, snapshot mint | Reused validator |

---

## 3. Correctly implemented behavior

- **Terminal-first composition (R2).** `outcomes.ts` classifies via `resolveMatchLifecycle` (passed in as
  `lifecycle`): `abandoned/cancelled/postponed` → non-scored terminals; `finished` → scored via
  `isPredictionWin`; everything else → `pending`. `listSettleState` is **not** imported (verified by grep;
  only a comment mentions it). won/lost is never inferred from daily-list result strings.
- **Deterministic timestamps (R1).** `settledAt` is *only ever* the caller-supplied `completionInstant`;
  `recordedAt = settledAt = completionInstant` at the record build (`settlement.ts:279-280`). No
  `Date.now`/`new Date`/`Math.random` in either module (verified by grep — matches are comment-only).
  `resolveMatchLifecycle` is always called with an explicit `nowSec`; a non-integer `nowSec` fails closed.
- **`nowSec`-independence of persisted content.** Every *terminal* lifecycle branch
  (finished/postponed/cancelled/abandoned) is a pure function of the provider status string, never `nowSec`.
  The only `nowSec`-dependent classifications (scheduled/pre_match/unavailable) are all non-terminal →
  `pending` → not persisted. Persisted bytes therefore never depend on the clock argument. This is stronger
  than R1 requires.
- **Missing-score safety (R3).** `requiredScoreInputsPresent` gates *before* `isPredictionWin`: `fh` requires
  `resolveHalfScores(row).htKnown`, `sh` requires `shKnown`, `over15/over25` require finite FT scores, and any
  row not `isFinished` returns `pending`. Missing HT/FT can never produce `lost`.
- **Pending never persisted (R4).** `pending` returns a `no-write` per-market status; the orchestrator appends
  nothing. Repeated pending is a no-op (nothing to diff, nothing to write).
- **Correction classification (R5).** Reason is a pure total function of a typed `CorrectionCause` union
  (`result_reinterpreted → settlement_correction`, `source_lineage_changed → data_correction`); unknown →
  `null` → fail closed. Not derived from wall-clock, retry count, or free text. A state change with no explicit
  cause fails closed (`invalid_input`, nothing appended). The correction `note` is a pure function of the
  transition (`from->to:reason`), so replay reproduces it byte-identically.
- **Single-snapshot subject (R6).** `settleSnapshot` settles exactly one immutable snapshot's
  `supportedMarkets`. `settleLatestSnapshotForFixture` selects the latest via `store.latestSnapshot`
  (highest `sequence`), never archive read order; earlier snapshots are never settled by one call.
- **Loud immutable violations / no false exactly-once claim (R7).** `store.appendValidation` returning
  `immutable_violation` surfaces as market status `immutable_violation` and forces `ok:false`; it is never
  downgraded to `no_change`. No mutex is claimed; dormancy + single-writer is documented as the pre-activation
  gate. Concurrent identical intent is absorbed by content-addressed idempotency, not by a lock.
- **Fail-closed input validation.** Malformed snapshot/row, non-ISO `completionInstant`, and non-integer
  `nowSec` each short-circuit to `status:"invalid_input"` with nothing written.
- **Append-only through frozen builders.** Records are constructed *only* via `createValidationRecord` /
  `reviseValidationRecord`; corrections always revise the derived current head
  (`currentValidationRevisions`), so `revision+1` and `supersedesRevisionId` are minted by the frozen code,
  not by M8.
- **No mutation of caller input.** Mapper and orchestration leave `row` and `snapshot.supportedMarkets`
  byte-identical (tests 47).

---

## 4. Implementation defects

**None found.** No correctness, determinism, append-only, idempotency, replay, or dormancy defect was
identified. No fix is required for approval.

---

## 5. Contract deviations

**None.** M8 adds no field, type, identity, or reason code. `ValidationRecord`, `ValidationState`,
`ValidationReasonCode`, `EvidenceSnapshot`, the `validationId`/`revisionId`/`contentHash` formulas, the
append-only/chain/current-revision rules, and M7 `inputContentHash`/`evidenceInputVersion`/`modelVersion`
separation are all unmodified. Test 49 asserts the persisted record carries *exactly* the frozen 16-key set;
test 50 asserts settlement leaves the M7 `inputContentHash` unchanged.

---

## 6. Determinism findings

- Persisted record content is a pure function of `(snapshotId, market, selection, revision, outcome state,
  reason code, completionInstant)`. No clock, no randomness, no env, no `localeCompare` in identity.
- Replay reproduces byte-identical `contentHash` (test 33: two independent stores → equal hash; the
  serialization-boundary test re-settles through a fresh file-store view and asserts byte-identical hashes).
- `resolveMatchLifecycle`'s default `Date.now` is never reachable: `nowSec` is required and validated.

---

## 7. Test-quality findings

The 34 tests prove invariants rather than merely passing:

- **Lifecycle authority (test 31):** feeds `listResult:"won"` on a cancelled row and asserts the outcome is
  `cancelled` — a state `listSettleState` provably cannot emit. Genuine proof of R2.
- **Missing HT (tests 8–9):** `fh`/`sh` → `pending` while `over25` still settles on the same row — proves R3
  is period-scoped, not a blanket defer.
- **Immutable violation (tests 24, 24b):** 24 proves the store rejects same `revisionId` + different
  `contentHash`; 24b injects a fake store returning `immutable_violation` and asserts settlement surfaces it
  and sets `ok:false` — proves it is never downgraded.
- **Correction determinism (tests 25–26 + "no arbitrary default"):** reason is a function of the explicit
  cause; a correction without a cause fails closed with nothing appended.
- **Revision chain (tests 17–23):** exactly one correction appended, `revision===2`,
  `supersedesRevisionId===rev1.revisionId`, chain verifies, and rev 1's `contentHash` is unchanged after the
  correction — proves append-only immutability of the prior row.
- **Idempotency (tests 16, 18, 48):** identical re-settle is `no_change`; concurrent duplicate intent yields
  exactly one `appended` + one `no_change`, never a divergent revision.
- **Real serialization boundary:** the NDJSON file-store test performs settle → read-back through a fresh
  store → `verifyAllValidationChains` → independent re-settle (no new append, byte-identical) → correction
  (chain verifies, earlier revisions byte-identical) → repeat-correction no-op → non-scored terminal recorded
  as `postponed`, never `lost`. This is the executable form of the replay precondition (architecture O2).
- **Dormancy (tests 41–44):** importing the modules mutates no `process.env`; the activation flag is `false`
  and the predicate is pure.
- **Frozen key set (test 49)** and **M7 hash isolation (test 50)** guard the contract surface.

Minor coverage observations (not defects, optional to add):
1. Orchestration-level persistence of a `void`/`market_void` revision-1 record is not directly asserted
   (only the mapper, test 6). It shares the exact `terminal_non_scored` append path already exercised by
   `postponed`/`cancelled` at orchestration level.
2. No test directly asserts the *persisted* record's `recordedAt === settledAt === completionInstant`
   (covered indirectly by the determinism/replay tests).
3. `settleLatestSnapshotForFixture` with a non-integer `fixtureId` (the `invalid_input` guard) is untested.

---

## 8. Revision / idempotency findings

- Corrections always revise the derived current head; the two-layer protection (`reviseValidationRecord`
  requires the previous row; `decideValidationAppend` independently rejects a stale `supersedesRevisionId`)
  is intact and used correctly.
- Unchanged outcome → `no_change` (head-state diff check before build). Changed outcome → exactly one
  correction. Byte-identical rebuild → absorbed as `duplicate`/`no_change` by the store.
- A correction whose `completionInstant` precedes the prior `recordedAt` fails closed via
  `reviseValidationRecord`'s monotonicity check (`invalid_input`) — deterministic, never silently reordered.

---

## 9. Replay findings

Replay is deterministic and content-addressed. Re-running settlement on identical provider data reconstructs
byte-identical records (`duplicate`/`no_change`); a genuine result change appends exactly one correction per
market while leaving every prior revision byte-identical. The NDJSON boundary test proves this survives real
serialization + a fresh-process store view.

---

## 10. Dormancy findings

- No runtime imports `settlement.ts` or `outcomes.ts` (grep across `**/*.ts{,x}` excluding tests returns
  nothing). Only `tests/evidenceSettlement.test.ts` imports them.
- `EVIDENCE_SETTLEMENT_ENABLED` is a pure `false` constant (no env read); `isEvidenceSettlementEnabled` is a
  pure predicate over an injected value. Importing the module activates nothing.
- No cron/route/worker/UI/timer is created. Single-writer / append-mutex remains the documented pre-activation
  gate (R7 / architecture G2), unchanged.

---

## 11. M0–M7 compatibility

- **M0–M6 substrate:** untouched; M8 only *reads* the snapshot (existence + latest) and *appends* to the
  separate validation stream. Snapshot immutability preserved.
- **M7 input-identity:** orthogonal and verified — settlement never enters the `inputContentHash` basis;
  test 50 confirms the binding hash is identical before/after settlement.
- Full regression evidence: `evidenceArchive`, `evidenceArchiveFileAdapter`, `evidenceInputIdentity`,
  `evidenceCaptureMint`, `evidenceModel` (115 tests) all green alongside the full suite (1654 tests).

---

## 12. Required fixes

**None.** Approval carries no conditions on the implementation.

---

## 13. Optional improvements (non-blocking)

- **O1 — Defense-in-depth row/subject binding:** `settleSnapshot` trusts that the injected `row` corresponds
  to `snapshot.fixtureId`; there is no `row.matchId === snapshot.fixtureId` guard. The `row` is defined as the
  authoritative injected input and the mapper cannot re-derive its correctness, so this is a caller/wiring
  (M9) contract concern, not a defect. A one-line fail-closed guard would add cheap defense before activation.
- **O2 — Add the three coverage items in §7** (orchestration-level `void`; explicit
  `recordedAt===settledAt===completionInstant` assertion; non-integer `fixtureId` on the latest-snapshot
  convenience).
- These are carried as pre-activation notes only; none block M8 closure.

---

## 14. Exact verification results

All commands run in `/var/www/rankwagers` on 2026-07-29.

| Command | Result |
|---|---|
| `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceSettlement.test.ts` | **34/34 pass**, 0 fail |
| `... --test tests/evidenceArchive.test.ts tests/evidenceArchiveFileAdapter.test.ts tests/evidenceInputIdentity.test.ts tests/evidenceCaptureMint.test.ts tests/evidenceModel.test.ts` | **115/115 pass**, 0 fail |
| `npm test` (full suite) | **1654/1654 pass**, 0 fail / 0 skipped / 0 todo |
| `npm run typecheck` (`tsc --noEmit -p tsconfig.typecheck.json`) | **clean**, no errors |
| `npm run lint` (`next lint`) | **✔ No ESLint warnings or errors** |

No host limit prevented any command from running.

---

## 15. Final verdict

The implementation faithfully realizes the approved architecture and every frozen contract. It is correct,
deterministic, append-only, revision-safe, idempotent, replay-safe, fail-closed, dormant, and M0–M7
compatible. All architecture conditions R1–R7 are satisfied in code and proven by tests. No runtime code was
modified by this review.

### M8 IMPLEMENTATION APPROVED

Pre-activation gates (unchanged, deferred to M9/production, not blocking M8 closure): deterministic instant
source wired to real provider data (G1); single-writer/append-mutex/Postgres-unique before any concurrent
settlement (G2/R7); flag-gated default-off execution (G3); input-identity retention (G4). Optional hardening
O1–O2 above.
