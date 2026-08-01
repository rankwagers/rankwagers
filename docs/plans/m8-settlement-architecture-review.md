# Sprint 23B — Milestone M8 (Settlement & Validation Revisions) — Architecture Review

**Reviewer:** Claude 1 (architecture & contract review)
**Scope:** Architecture review ONLY. M8 is unimplemented and remains unimplemented after this review.
**Date:** 2026-07-29
**Status of M8 in tree:** NOT STARTED — `lib/evidence-capture/outcomes.ts` and `lib/evidence-capture/settlement.ts` do **not** exist (verified absent). M0–M7 complete and green (1620/1620).

> This review reads the *code* the plan builds on, not just the plan. Where the two committed
> plan documents disagree, the code is authoritative and the discrepancy is called out.

---

## 1. Architecture summary

M8 adds **post-completion settlement** of published `EvidenceSnapshot`s. It is a thin, pure,
deterministic layer over an already-frozen Sprint-23 substrate:

- **Frozen record contract** — `types/evidence/validation.ts` (`ValidationRecord`, `ValidationState`, `ValidationReasonCode`).
- **Frozen mint/revise builders** — `lib/validation/records.ts` (`createValidationRecord`, `reviseValidationRecord`, `currentValidationRevisions`, `revisionsOf`).
- **Frozen state machine** — `lib/validation/states.ts` (`canTransition`, `defaultReasonCodeFor`, `isCorrectionReasonCode`, `isTerminalValidationState`, `isScoredValidationState`).
- **Frozen append admission** — `lib/archive/evidence/rules.ts` (`decideValidationAppend`) + store adapters (`memory.ts`, `file.ts`, `service.ts`).
- **Frozen integrity** — `lib/validation/integrity.ts` (`verifyValidationChain`).

M8's *net new* surface is exactly two pure modules:

1. `lib/evidence-capture/outcomes.ts` — pure `(terminal fixture row, market/selection) → { state, reasonCode, settledAt }`.
2. `lib/evidence-capture/settlement.ts` — `settleFixture(...)` orchestration: load latest snapshot, derive per-market outcomes, mint/revise `ValidationRecord`s via the frozen builders, append idempotently.

**Verdict up front:** the substrate is well-designed and M8 is architecturally sound *provided* a small set
of determinism and semantic rules are frozen before any code is written. See §5.

---

## 2. Reviewed components

| Component | Location | Status |
|---|---|---|
| `ValidationRecord` shape | `types/evidence/validation.ts` | Frozen — verified |
| `ValidationState` / `ValidationReasonCode` | same | Frozen — verified |
| `createValidationRecord` / `reviseValidationRecord` | `lib/validation/records.ts` | Frozen — verified |
| `canTransition` / `defaultReasonCodeFor` | `lib/validation/states.ts` | Frozen — verified |
| `decideValidationAppend` | `lib/archive/evidence/rules.ts` | Frozen — verified |
| `appendValidation` (file adapter) | `lib/archive/evidence/file.ts:162` | Frozen — verified; **no append mutex** (§4.6) |
| `verifyValidationChain` | `lib/validation/integrity.ts` | Frozen — verified |
| `resolveMatchLifecycle` | `lib/fixtures/status.ts` | Reused — **reads `Date.now()` by default** (§4.1) |
| `listSettleState` | `lib/footystats/listSettle.ts` | Reused — **insufficient for terminal states** (§4.2) |
| `isPredictionWin` | `lib/footystats/predictionWin.ts` | Reused — **false-on-missing-HT hazard** (§4.3) |
| `marketSelectionForKind` / `kindForMarketKey` | `lib/evidence-capture/markets.ts` | Frozen — verified |
| `outcomes.ts` | (absent) | To be built — governed by §5 |
| `settlement.ts` | (absent) | To be built — governed by §5 |

---

## 3. Architectural strengths

1. **Append-only + immutable revisions are enforced in the substrate, not in M8.** `createValidationRecord`
   deep-freezes; there is no `updateValidationRecord`; corrections mint a NEW row (`reviseValidationRecord`)
   with `revision+1` and `supersedesRevisionId = previous.revisionId`. M8 cannot violate immutability even
   by mistake as long as it only calls these builders.
2. **"Current" is derived, never stored.** No `supersededBy`/`isCurrent` field ⇒ no written row is ever
   mutated ⇒ every persisted byte is stable forever. This is exactly the property replay and archive-rebuild need.
3. **Content-addressed idempotency.** `decideValidationAppend` keys on `revisionId` + `contentHash`:
   identical bytes → `duplicate` (no-op); same `revisionId` + different bytes → `immutable_violation`.
   This makes safe idempotency *achievable* — subject to the determinism condition in §4.1.
4. **Scored vs unscored terminal states are first-class.** `isScoredValidationState` (won/lost only) and
   `isUnscoredTerminalState` (void/cancelled/postponed/abandoned) already exist, so downstream Accuracy/ROI
   have the exact predicate to exclude non-result terminals without counting them as losses.
5. **Snapshot-existence guard.** `decideValidationAppend` refuses a validation whose `snapshotId` is not
   already archived — history can never contain a settlement for evidence that was never recorded.
6. **Integrity checker already models the full chain** (hash, revisionId derivability, contiguity, chain
   linkage, legal transitions, timestamp monotonicity, correction-note presence) — replay/rebuild has a
   ready-made verifier.
7. **Clean Postgres shape.** Immutable rows, unique `revisionId`, `(id, revision)` unique, FK `snapshotId`,
   "current" as a `max(revision) GROUP BY id` window — no mutable columns. Migration-ready (§12).

---

## 4. Architectural weaknesses / hazards (the substance of this review)

### 4.1 — REQUIRED: `recordedAt`/`settledAt` must be DETERMINISTIC, or idempotency & replay break

`recordedAt` and `settledAt` are in the **hashed body** (`validationRecordBody` excludes only `contentHash`)
but are **not** part of `revisionId` (`revisionId = validationRevisionId({validationId, revision})`).

Therefore, for a fixed `(snapshotId, marketKey, selectionKey, revision)` the `revisionId` is fixed, but the
`contentHash` varies with the timestamps. Combined with `decideValidationAppend`:

- **Wall-clock timestamps** ⇒ re-running settlement on the *same* outcome mints the same `revisionId` with a
  *different* `contentHash` ⇒ `immutable_violation`. The Phase-4 acceptance criterion "re-settling an
  unchanged result is a no-op" **fails**, and archive rebuild/replay becomes impossible (rebuilt rows would
  not match persisted hashes).

**Required rule (freeze before implementation):** settlement MUST derive `recordedAt` and `settledAt`
deterministically from provider/fixture data — never `Date.now()`/`new Date()`. Recommended:
`settledAt = deterministic fixture-completion instant` (from the terminal provider row / daily archive), and
`recordedAt = settledAt` (or a deterministic settlement-window–quantized instant, mirroring M6's `capturedAt`
quantization). This is the single most important M8 invariant. It also satisfies:
- `reviseValidationRecord` monotonicity (`recordedAt >= previous.recordedAt`; the check is strict `<`, so an
  equal deterministic instant across a correction is legal — `records.ts:227`, `integrity.ts:104`).

Additionally, `resolveMatchLifecycle` **defaults `now` to `Math.floor(Date.now()/1000)`** (`status.ts:19`).
Settlement MUST pass an explicit, deterministic `nowSec` (e.g. derived from kickoff/provider snapshot time) so
no clock is read. This is safe because M8 acts only on `now`-independent terminal branches (see §4.2).

### 4.2 — REQUIRED: reconcile the primitive — `listSettleState` is insufficient; use `resolveMatchLifecycle` + score

The two governing docs disagree:
- `docs/architecture/phase-2-7-implementation-plan.md` §M8 says settlement is "via `resolveMatchLifecycle`".
- `docs/plans/sprint-23b-evidence-capture-settlement.md` Phase 4 describes `listSettleState`.

`listSettleState` returns only `won | lost | pending | postponed` (`listSettle.ts:5`). It **cannot** emit
`cancelled` or `abandoned`: a cancelled/abandoned fixture that is not `isFinished` collapses to `pending`
(stuck forever), and one reported `isFinished` would be mis-scored won/lost. That contradicts the frozen
`ValidationState` set and the plan's own terminal-state list.

**Required rule:** `outcomes.ts` derives state as a *composition*, terminal-first:
1. `resolveMatchLifecycle(...)` →
   - `abandoned` → `{ abandoned, fixture_abandoned }`
   - `cancelled` → `{ cancelled, fixture_cancelled }`
   - `postponed` → `{ postponed, fixture_postponed }`
   - `suspended` / `live` / `half_time` / `pre_match` / `scheduled` / `unavailable` → **pending, not persisted** (§4.4)
   - `finished` → step 2.
2. When `finished`: compute won/lost via the frozen scoring (`isPredictionWin(row, kindForMarketKey(marketKey))`)
   → `{ won|lost, settled_result }`.

`resolveMatchLifecycle` is the authoritative primitive (matches §M8 and distinguishes the non-scored
terminals). The committed plan is correct; **the Phase-4 doc is stale on this point and must be corrected**
(doc-only change permitted by this review's scope).

### 4.3 — REQUIRED: missing half-time data must not settle `fh`/`sh` as a loss

`isPredictionWin` returns `false` when HT data is absent — `fh` returns `false` if `htTotal(row)` is null;
`sh` returns `false` if `shTotal(row)` is null (`predictionWin.ts:19-28`). `FootyMatchRow.htHome/htAway` are
**optional** (`types.ts`). For *live display* an optimistic `false` is fine; for **permanent settlement** it
fabricates a `lost` outcome for a match whose first/second-half result is simply unknown.

**Required rule:** settlement must treat "terminal fixture but required period score unavailable" as
**not settleable yet** (leave `fh`/`sh` pending — no record written), or as an explicit data-incomplete
deferral — never as `lost`. `over15`/`over25` (which need only FT `homeScore+awayScore`) are unaffected.
`outcomes.ts` must gate on HT availability before trusting `isPredictionWin` for `fh`/`sh`.

### 4.4 — REQUIRED: freeze the "pending is never persisted" policy

Phase 4 states not-finished ⇒ pending, "no record written." This is the right call: it makes revision 1 the
*terminal* settlement, avoiding a mandatory pending→terminal 2-revision chain on every fixture. It is
contract-compatible: `createValidationRecord` accepts a terminal state at revision 1 (requires `settledAt`,
forbids correction reason codes). **Freeze it explicitly:** absence of a `ValidationRecord` for a
`(snapshot, market, selection)` *is* the pending state; settlement writes only terminal revisions.

Consequence to document: `canTransition`'s `pending → *` edge is never exercised by M8; M8 only ever produces
revision-1 terminals and terminal→terminal corrections.

### 4.5 — REQUIRED: define `data_correction` vs `settlement_correction`

Both docs mention corrections but neither states *which* reason code applies *when*. `reviseValidationRecord`
requires one of the two (`isCorrectionReasonCode`) but does not choose. Undefined ⇒ non-deterministic
`contentHash` for the same real-world correction ⇒ replay divergence.

**Required rule (freeze):** e.g. *provider revised the underlying score/lifecycle* → `settlement_correction`;
*our mapping/data-ingestion fix with the provider unchanged* → `data_correction`. The chosen mapping must be a
pure function of inputs so replay reproduces the identical reason code (and thus hash).

### 4.6 — CONDITION (pre-activation): the frozen `appendValidation` has no append mutex

Unlike the M2/M3 provider/odds file adapters (which added `serializeAppend`), the Sprint-23 `appendValidation`
(`file.ts:162`) does **read-decide-append with no per-file lock**. Two concurrent settlers reading the same
head both decide `revision N+1`:
- deterministic timestamps ⇒ identical bytes ⇒ the archive is *safe* (second write is a duplicate line of the
  same content, or is caught as `immutable_violation`), but
- the losing writer receives `immutable_violation`/`revision_conflict` it must treat as "chain advanced —
  re-read head and retry," not as fatal; and a genuine TOCTOU could append two byte-different lines for the
  same `revisionId` if timestamps ever diverge.

M8 is dormant/single-threaded, so this is **not a blocker now**, but any future cron/worker activation MUST
gate on either single-writer settlement or an append mutex on the validation store. Record as a pre-activation
concurrency gate. (Also note `validationsFor` sorts with `localeCompare` at `file.ts:130`; that is read-time
ordering only, never part of identity/hash — acceptable, but worth noting it is not a code-point sort.)

### 4.7 — CONDITION: settlement subject is the SNAPSHOT, not the fixture

`validationId = f(snapshotId, marketKey, selectionKey)`. If a fixture has multiple snapshots (re-capture), each
snapshot is an independent validation chain. Phase 4 settles "the latest snapshot." **Freeze the policy:**
settlement runs *after the capture window is closed / fixture is terminal*, so "latest snapshot" is final and
stable; only that snapshot is settled. Document that Accuracy/ROI consume validations keyed by snapshot and
must not double-count multiple snapshots of one fixture. (If a re-capture ever occurred *after* settlement, the
new latest snapshot would be unsettled — the closed-window precondition prevents this.)

### 4.8 — REQUIRED: `outcomes.ts` must never synthesize `void`/`market_void`

`defaultReasonCodeFor("void") = "market_void"`, but no daily-list signal produces a void. Freeze: `outcomes.ts`
never returns state `void`; `market_void` is reachable **only** via an explicit human/data correction, never
from daily-list settlement. (Matches both docs.)

---

## 5. Required changes (must land before M8 implementation)

R1. **Deterministic timestamps.** `recordedAt`/`settledAt` derive from provider/fixture data, never a clock;
    recommend `recordedAt = settledAt = deterministic fixture-completion instant` (or settlement-window
    quantized). Pass explicit `nowSec` to `resolveMatchLifecycle`. (§4.1)

R2. **Primitive reconciliation.** `outcomes.ts` = `resolveMatchLifecycle` (terminal branch) **+**
    `isPredictionWin` (score, finished only). Correct the stale `listSettleState` reference in the Phase-4 doc.
    (§4.2)

R3. **Missing-HT safety.** `fh`/`sh` with unavailable half score → pending (unsettleable), never `lost`. (§4.3)

R4. **"Pending is never persisted"** frozen as the settlement policy; revision 1 is terminal. (§4.4)

R5. **Correction-code rule** (`data_correction` vs `settlement_correction`) defined as a pure function of
    inputs. (§4.5)

R6. **No synthetic `void`** — `outcomes.ts` cannot emit `void`. (§4.8)

R7. **Determinism guardrails**: `outcomes.ts` and `settlement.ts` are pure/dormant/injectable — no
    `Date.now`/`Math.random`/`localeCompare`/env/network/fs of their own; the store, clock-free instants, and
    fixture rows are injected. (Consistent with M0–M7.)

---

## 6. Optional improvements

- O1. A pure `settlementReasonForCorrection(prev, next, cause)` helper so R5's mapping is unit-testable in
  isolation.
- O2. Add an M8 unit test that asserts **replay determinism**: settle → re-settle from re-read records →
  `duplicate` (no new row, byte-identical). This is the executable form of R1.
- O3. A doc note in the Phase-4 file pointing to this review as the authoritative reconciliation of the
  `resolveMatchLifecycle` vs `listSettleState` question.
- O4. Consider extracting the "terminal lifecycle → ValidationState/reasonCode" table into a single frozen
  constant map so `outcomes.ts` and any future admin/correction UI share one source of truth.

---

## 7. Replay analysis

- **Deterministic given R1.** Every field of a `ValidationRecord` is a pure function of (snapshot id, market,
  selection, revision, deterministic outcome, deterministic instants, reason code). With R1+R5 the
  `contentHash` is reproducible, so a full archive rebuild reproduces byte-identical rows and
  `verifyValidationChain` passes.
- **Without R1, replay is impossible** (wall-clock hashes never reproduce). R1 is therefore a replay
  precondition, not a nicety.
- **Idempotent replay is content-addressed:** re-emitting a settled revision yields `duplicate` via
  `decideValidationAppend`. Interrupted settlement is resumable (§10).

## 8. Revision model analysis

- Revision numbering is 1-based and contiguous, enforced twice: at append (`decideValidationAppend`
  `expectedRevision = head.revision + 1`) and at read (`integrity` `revision === index+1`, `revision_gap`).
- `revisionId` is *derivable* (`f(id, revision)`), so it cannot be forged independently of `revision`
  (`revision_id_mismatch` guards this).
- `supersedesRevisionId` must equal the current head's `revisionId` at append time — no forking, no orphan
  edges (`chain_broken` guards read-time).
- **M8 responsibility:** always revise the *current* head (`currentValidationRevisions` / `head` from the
  store), never a superseded row. `reviseValidationRecord` enforces `previous` is passed; `decideValidationAppend`
  independently rejects a stale `supersedesRevisionId`. Two-layer protection is adequate.

## 9. Settlement lifecycle analysis

State/reason derivation (frozen mapping M8 must implement):

| Lifecycle (`resolveMatchLifecycle`) | Score check | ValidationState | ReasonCode | Persisted? |
|---|---|---|---|---|
| `finished` | `isPredictionWin` true | `won` | `settled_result` | yes (rev 1) |
| `finished` | `isPredictionWin` false | `lost` | `settled_result` | yes (rev 1) |
| `finished` (fh/sh, HT missing) | — | (pending) | — | **no** (§4.3) |
| `postponed` | — | `postponed` | `fixture_postponed` | yes (rev 1) |
| `cancelled` | — | `cancelled` | `fixture_cancelled` | yes (rev 1) |
| `abandoned` | — | `abandoned` | `fixture_abandoned` | yes (rev 1) |
| `suspended`/`live`/`half_time`/`pre_match`/`scheduled`/`unavailable` | — | (pending) | — | **no** (§4.4) |
| (any later provider change of the above) | — | corrected terminal | `settlement_correction`/`data_correction` | yes (rev N+1) |

`void`/`market_void` intentionally has **no** row in this table (§4.8). Transitions among terminals are legal
(`canTransition`: terminal→terminal allowed, terminal→pending forbidden), and same→same is rejected — so a
re-settle producing the *same* terminal state does not spawn a correction.

## 10. Idempotency analysis

- **Boundary:** per `(snapshotId, marketKey, selectionKey, revision)` via `revisionId`, plus `contentHash`.
- **Repeated settlement, unchanged result:** same `revisionId` + same bytes (given R1) → `duplicate` → no-op. ✅
- **Partial settlement:** each market is an independent append; a crash after k of n markets leaves k rows;
  re-run appends the remaining n−k and no-ops the k. No batch atomicity required and none should be assumed. ✅
- **Changed result:** settlement must detect the head's terminal state and only revise when the new state
  differs (canTransition rejects same→same). "Append only if changed" logic lives in `settlement.ts`, above
  the builders. ✅
- **Failure to hold R1 turns idempotency into `immutable_violation`** — the whole idempotency guarantee is
  downstream of R1.

## 11. Correction-chain analysis

- Corrections are appended, never mutating (`reviseValidationRecord`); the old row is byte-preserved.
- Chain integrity: `revision+1`, `supersedesRevisionId = prev.revisionId`, monotonic `recordedAt`, mandatory
  note, legal transition — all enforced at both write and read.
- **Undefined today (R5):** *which* correction code applies. Must be a pure function of inputs or replay
  diverges. Correction `note` is required and free-text; for replay determinism the note content should also
  be a pure function of inputs (or excluded from the reproducibility claim — recommend deterministic note
  templating).
- Multi-correction chains (rev 3, 4, …) are supported and verified; each must revise the then-current head.

## 12. Migration readiness (Postgres/distributed)

- **Schema:** append-only table; PK `revisionId`; unique `(id, revision)`; FK `snapshotId` → snapshots;
  "current" = window over `max(revision) PARTITION BY id`. No mutable columns → clean fit.
- **Hash fidelity:** NDJSON→Postgres migration must preserve `contentHash` exactly; the frozen
  `evidenceContentHash`/`canonicalizeEvidence` guarantee canonical bytes independent of column/insertion order.
- **Concurrency:** Postgres gives the missing atomicity for free via a unique constraint on `revisionId` +
  transactional insert — resolves §4.6 at the DB tier. Until then, single-writer settlement.
- **No blockers.** M8 introduces no field, type, or identity that impedes migration.

## 13. Production readiness

M8 as scoped is **dormant** (pure modules, no cron/route/worker/UI/flag activation). Pre-activation gates to
carry into M9/production:
- G1 (R1): deterministic instant source wired to real provider data.
- G2 (§4.6): single-writer or mutex/Postgres-unique before any concurrent settlement.
- G3: flag-gated, default-off execution (unchanged Sprint-23B constraint).
- G4 (M7 tie-in): retention of the input-identity binding basis remains an activation gate (M7 §Deferred) —
  independent of M8 but co-required for a defensible settled history.

## 14. Frozen-contract verification

- ✅ `ValidationRecord` shape unchanged — M8 constructs only via frozen builders; **no new fields** added to
  `ValidationRecord`, `EvidenceSnapshot`, provider record, or odds record.
- ✅ Settlement is a **separate archive stream** (validations), not a mutation of snapshots — snapshot
  immutability preserved (`decideSnapshotAppend` untouched; snapshot only *read* for existence + latest).
- ✅ `ValidationState`/`ValidationReasonCode` used as-is (additive enums; M8 adds no code).
- ✅ Identity formulas (`validationId`, `validationRevisionId`), `canonicalizeEvidence`, sha-256 primitive —
  untouched.
- ✅ M0–M7 modules untouched (outcomes/settlement are new files; no edits to keys/identity/archives/model/
  capture/input-identity).
- ✅ `modelVersion` remains excluded from all identities; settlement introduces no new identity input.

## 15. Future-milestone compatibility

- **Accuracy / ROI (future):** gate on `isScoredValidationState` (won/lost) and read `currentValidationRevisions`;
  unscored terminals excluded by construction. Compatible. Must consume per-snapshot (not per-fixture) — §4.7.
- **M7 input-identity:** orthogonal — settlement never enters the `inputContentHash` basis (M7 excludes
  settlement/result state explicitly). A settled snapshot's `inputContentHash` is unchanged by settlement. ✅
- **Replay milestone (future):** depends on R1; with it, settlement replays deterministically alongside capture.
- **Distributed workers / retries / double-execution:** safe archive outcome (append-only + immutable_violation),
  but requires the §4.6 gate + treating conflict codes as retry signals.
- **Model evolution (future modelVersion):** a new model mints a new snapshot (new `snapshotId`) ⇒ a new,
  independent validation chain. No collision with prior settlements. ✅

## 16. Risk assessment

| # | Risk | Severity | Likelihood if unaddressed | Mitigation |
|---|---|---|---|---|
| 1 | Wall-clock `recordedAt`/`settledAt` breaks idempotency + replay | **High** | Certain | R1 (deterministic instants) |
| 2 | `listSettleState` can't emit cancelled/abandoned → mis-settlement | **High** | Certain (if followed) | R2 (`resolveMatchLifecycle`+score) |
| 3 | Missing HT settles fh/sh as fabricated `lost` | **High** | Likely | R3 (defer fh/sh on missing HT) |
| 4 | Undefined correction-code rule → replay divergence | Medium | Likely | R5 |
| 5 | No append mutex on frozen validation store | Medium | Only under concurrency | G2 (single-writer / Postgres) |
| 6 | Snapshot-vs-fixture subject ambiguity → double counting | Medium | Possible downstream | §4.7 freeze + closed-window precond. |
| 7 | `resolveMatchLifecycle` default `Date.now()` leaks a clock | Medium | Certain if nowSec omitted | R1 (explicit nowSec) |
| 8 | Synthetic `void` emitted from daily data | Low | Unlikely | R6 (outcomes never emits void) |

No risk is architecture-breaking; all are addressable by freezing rules R1–R7 + gates G1–G4 before code.

## 17. Architecture verdict

The frozen substrate (immutable revisions, derived-current, content-addressed idempotency, snapshot-existence
guard, scored/unscored predicates, integrity checker, Postgres-clean shape) is sound and directly supports the
planned M8 settlement. M8 is a thin, pure layer over it. However, the plan-of-record is **internally
inconsistent** (§M8 says `resolveMatchLifecycle`; Phase 4 says `listSettleState`, which is provably unable to
emit cancelled/abandoned), and three correctness invariants are **not yet stated**: deterministic timestamps
(R1), missing-HT safety (R3), and the correction-code rule (R5). None require changing a frozen contract; all
are resolvable as documentation/spec freezes before implementation.

**M8 ARCHITECTURE CONDITIONALLY APPROVED**

Conditions to clear before implementation: **R1–R7** (§5). Pre-activation gates for M9/production: **G1–G4**
(§13). No runtime code changed; M8 not implemented; no route/cron/worker/flag activated by this review.
