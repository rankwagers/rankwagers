# M10 Stage 1 — Pure Candidate-Provider Foundation — Independent Implementation Review

**Review type:** Implementation review only (review-only). No runtime code, tests, contracts, feature flags, cron routes, runners, schedules, environment, database, archive, or deployment configuration was modified. The only file created/modified is this document.
**Date:** 2026-07-30 (BF-S1 focused re-review after the fix — see the Re-Review Addendum).
**Reviewer:** Independent Implementation Reviewer, Sprint 23B / M10 Stage 1.
**Under review:** `lib/evidence-capture/candidates/*` + `tests/evidenceCandidateProvider.test.ts`.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1), `docs/plans/m10-live-candidate-pipeline-architecture-review.md`, `docs/plans/m10-stage-1-candidate-provider-foundation.md`, the Rev 2 contract, the Phase 2.7 DoD, the M9/M10 closures.
**Method:** Every Stage 1 file read line by line; every frozen downstream interface verified in source; the postponed/cancelled/abandoned question resolved **against the M8 implementation and the existing M8 tests, not by assumption**. Test/typecheck/lint re-run (not trusted from any report).

---

## 0. Re-Review Addendum (BF-S1 resolution)

**BF-S1 is RESOLVED. No regression. New verdict: STAGE 1 IMPLEMENTATION APPROVED.**

The settlement classifier now decides eligibility from the **authoritative, status-driven `resolveMatchLifecycle`** — the exact resolver and arguments M8 uses (`settlement.ts:222-227`) — instead of the coarse `isFinished` flag. Verified in `lib/evidence-capture/candidates/eligibility.ts:168-235` (+ `nowSec` threaded through `SettlementClassifyContext:108-117` and `settlement-provider.ts:101`):

1. **postponed / cancelled / abandoned → `eligible`** with **no score/`isFinished` requirement** — exactly the set for which M8 writes a `terminal_non_scored` record (`outcomes.ts:186-205`). ✓
2. **live / half_time / scheduled / pre_match / suspended → deferred** (`fixture_not_complete`) — M8 would `PENDING` (no write). ✓
3. **unknown/unresolvable lifecycle (`unavailable`/default) → fail-closed reject** (`unsupported_outcome_state`), never emits. ✓
4. **`finished` scored path unchanged** — still requires `isFinished` + present, non-negative-integer FT/HT (`hasValidCompletedScores`). ✓
5. **Candidate identity, ordering, diagnostics cardinality, replay semantics, purity — all unchanged** (assembly/`ordering.ts`/reason-vocabularies untouched; `completionInstant` still deterministic kickoff; no clock). ✓
6. **No frozen contract changed** — `outcomes.ts` and `settlement.ts` re-read in full and confirmed **byte-identical** to the reviewed M8 baseline (their recent mtimes reflect a content-neutral re-save; the M8 settlement suite passes **34/34**). The switch is exhaustive over all ten `MatchLifecycleStatus` values + default. ✓
7. **No Stage 2 behaviour introduced** — the provider still performs no archive I/O, fetch, or lock; `resolveMatchLifecycle` is a pure status→lifecycle function. ✓

**Validation (re-run this pass):** targeted provider tests **48/48** (+6 lifecycle tests), M8 settlement suite **34/34**, full suite **1735/1735**, typecheck **exit 0**, lint **clean**.

The sections below are retained for evidence; §1/§10/§18/§21/§22/§23 are updated to the resolved state. Only this review document was modified.

---

## 1. Executive Verdict

### STAGE 1 IMPLEMENTATION APPROVED

Stage 1's **capture** provider was already sound — pure, deterministic, adapter-neutral, identity-faithful, bounded, well-tested. The one blocking defect (**BF-S1** — the settlement classifier permanently excluding lifecycle-terminal postponed/cancelled/abandoned fixtures that M8 settles to *written* terminal records) has been **fixed and independently verified resolved** (§0, §10). The classifier now reproduces the frozen M8 eligibility boundary via `resolveMatchLifecycle`, emitting terminal settlements exactly where M8 writes them and deferring/failing-closed everywhere else — with no change to candidate identity, ordering, diagnostics, replay, purity, or any frozen contract.

**No blocking finding remains.** Every I1–I15 condition is now PASS or an explicitly-Stage-2 integration condition / acceptable Stage 1 limitation that does not gate Stage 1 sign-off (§21). The remaining work (corrections + richer settlement archive state, more-precise `completionInstant`, the deadline/lock/discovery-under-lock wiring, and the A4 replay test) belongs to **Stage 2** and is recorded as such (§22) — none is a defect in the Stage 1 code.

Full suite **1735/1735**, typecheck exit 0, lint clean; the frozen M8 settlement suite is green (34/34), confirming the fix introduced no regression.

*(History: the immediately-prior pass returned BLOCKED on BF-S1 after conclusively proving postponed/cancelled/abandoned are legitimate written M8 settlements that Stage 1 excluded. That evidence stands; BF-S1 has since been corrected at the settlement-classifier boundary and is removed from the blocking findings. The review was continued, not restarted.)*

---

## 2. Files Inspected

**Stage 1 source (line by line):** `candidates/{types.ts, limits.ts, ordering.ts, diagnostics.ts, eligibility.ts, capture-provider.ts, settlement-provider.ts, index.ts}`; `tests/evidenceCandidateProvider.test.ts`.
**Frozen downstream verified in source:** `CaptureRequest` (`capture/capture.ts:36`), `SettlementCandidate` (`jobs/settlement-run.ts:34`), `captureWindowKey`/`captureId`/`isValidFixtureId`/`isValidInstant` (`identity.ts`), `PublishedDailyPrediction` (`source.ts:35`), `MARKET_SELECTION_BY_KIND`/`kindForMarketKey` (`markets.ts`), `MatchListKind`/`FootyMatchRow` (`footystats/types.ts`), `FixtureModelInput` (`model/derive.ts`), **`resolveValidationOutcome` (`outcomes.ts` — full)**, **`settleSnapshot`/`settleLatestSnapshotForFixture` (`settlement.ts:218-367`)**, `resolveMatchLifecycle` (`fixtures/status.ts`), `runCaptureBatch`/`ensureMandatoryCaptureOdds`, `runSettlementBatch` (C3/C4).
**Frozen tests read:** `tests/evidenceSettlement.test.ts` (postponed/cancelled/abandoned terminal + correction cases).

---

## 3. Validation Results (re-run this pass)

| Check | Command | Result (BF-S1 re-review) |
|---|---|---|
| Targeted Stage 1 | `node --test tests/evidenceCandidateProvider.test.ts` | **48/48 pass** (+6 lifecycle tests) |
| Frozen M8 settlement | `node --test tests/evidenceSettlement.test.ts` | **34/34 pass** (no regression) |
| M9 activation | `node --test tests/m9Activation.test.ts` | **18/18 pass** |
| Full suite | `npm test` | **1735/1735 pass**, 0 fail, 0 skipped (exit 0) |
| Typecheck | `tsc --noEmit -p tsconfig.typecheck.json` | **exit 0** |
| Lint | `next lint` | **✔ no warnings or errors** |
| Purity | grep `Date.now`/`Math.random`/`process.env`/`fs`/`fetch` in `candidates/` | **none** (comment only; `nowSec` injected) |

*(Historical note from the BLOCKED pass: the old 42-test suite encoded the wrong expectation — `postponed → unsupported_outcome_state (deferred)`. That assertion was replaced by lifecycle-terminal-eligibility tests as part of the BF-S1 fix; the current 48-test suite asserts the correct behaviour. Prior baseline was 1729/1729; the +6 BF-S1 tests bring it to 1735/1735.)*

---

## 4. Module Boundary

**PASS. Option C implemented faithfully.** Isolated under `candidates/`; imports only type-only frozen contracts + pure helpers (`identity.ts`, `markets.ts`); no route/runner/cron/lock/archive/`process.env`/network. The only injected non-pure dep is `deriveCaptureInput` (+ optional `deriveCompletionInstant`); the evaluation instant is injected. No global mutable state, no authoritative cursor/checkpoint, no identity/ordering from line/offset/array position (verified `ordering.ts`; comparators key only on `capturedAt`/`completionInstant`/`fixtureId`). Minimal exports; unit-testable with no cron/network/fs. Option C is honoured.

---

## 5. Contract Compatibility

**PASS (both paths structurally; typecheck exit 0).**
- **Capture → `CaptureRequest`:** `{ admitted:true, fixtureId, capturedAt (frozen window anchor), modelInput, ...frozen provenance, modelVersion? }`; `modelVersion` omitted unless configured (never invented); `modelInput.fixtureId` mismatch → `source_correspondence_failure`. No required field omitted, no unsupported field added. ✓
- **Settlement → `SettlementCandidate`:** `{ fixtureId, row, completionInstant, nowSec, recordedBy? }`; no outcome field (test asserts exact key set); C3 true by construction; C4 fields validated. ✓

No structural mismatch would fail Stage 2 wiring. The block is **semantic** (which fixtures the settlement classifier admits), not structural.

---

## 6. Capture Grouping Semantics

**PASS — grouping is at the correct M6 grain; does not alter frozen derivation or identity.** (Not blocking.)
- Multiple rows per fixture permitted (one per tab); grouped by `fixtureId`; markets are separate derivation inputs combined into one snapshot = the M6 grain. One fixture → one window → one `CaptureRequest`.
- `capturedAt = f(kickoff, lead)` via the frozen `captureWindowKey` — grouping changes no identity.
- Markets explicitly `sortDeterministic` by `marketKey` → derivation input byte-equivalent under shuffled rows.
- Invalid one-market rows are rejected individually (per-row `continue`); a fixture's other valid markets still form the group — no contamination.
- Header fields (`kickoffAt`/`leagueCode`/`competitionLabel`) use first-seen; deterministic for well-formed source (all tabs of a fixture share them). Recommend a Stage-2 defensive assertion for conflicting headers (non-blocking, §20-R2).

---

## 7. Capture Eligibility

**PASS.** Every rule deterministic, bounded reason key, correctly counted, defer-vs-reject split (`captureReasonKind`), no silent drop (`bumpReason` ignores unknown keys). `missing_kickoff`/`invalid_kickoff` are checked **before** window/identity computation (`eligibility.ts:61-66` precede `captureWindowKey` at `:75`) → **no identity minted** (gate A10, tests confirm). Already-captured skip and partial-pair heal are archive-derived. If upstream data later completes in-window, the fixture is naturally re-classified next fire (INV-A). No capture-side blocker.

---

## 8. Partial-Pair Healing

**PASS.** Complete pair (`capturedWindowKeys`) → `already_captured`; partial pair (`partialWindowKeys`) → re-emitted `healing:true`, regardless of timing (matches C5 heal on `already_exists`). Same coordinates → capture returns `already_exists` → `ensureMandatoryCaptureOdds` appends missing odds → **no new identity, no duplicate**. `capturedWindowKeys` checked first, so a complete pair never heals. Deterministic retry. Non-blocking note: healing still invokes the derivation dep (wasted fetch; a failed fetch needlessly defers heal — Stage 2 may short-circuit).

---

## 9. Derivation Boundary

**PASS.** `planCaptureCandidates` is dependency-free; `buildCaptureCandidates` adds the single injected `deriveCaptureInput`. `CaptureDeriveResult.modelInput: FixtureModelInput` matches M5 (`derive.ts`); the seam hands M5 the market slots + the authoritative `capturedAt` (which the dep must reuse verbatim). Derivation failure counted, not emitted; fixtureId mismatch fail-closed; `modelVersion` never invented; no clock in identity; batching order-independent (test: identical candidate at ceilings 100 vs 5). This is a genuine integration seam, not an underspecified algorithm. **Stage 2 adapter contract:** `deriveCaptureInput` runs M4 fetch/admission + M5 derive inside the durable lock, returns `modelInput.fixtureId === request.fixtureId`, reuses `request.capturedAt`, maps failures to the exact reason keys, attaches provenance.

---

## 10. Settlement Eligibility — CONCLUSIVE VERIFICATION (BF-S1 found here; now RESOLVED — §10.4)

The classifier `classifySettlementRow` fail-closes malformed/missing-snapshot/already-settled/in-play/missing-score/invalid-score, so no false result can reach M8. §10.1–10.3 **preserve the original conclusive proof** that the *prior* classifier was **wrong** for lifecycle terminals (the BF-S1 defect); §10.4 records the **verified fix** that resolves it. Retained as the historical record.

### 10.1 Are postponed/cancelled/abandoned valid terminal M8 settlements? — **YES (conclusive).**
| Evidence | Location | Shows |
|---|---|---|
| Outcome mapper returns `terminal_non_scored` for `abandoned/cancelled/postponed` | `outcomes.ts:186-205` | first-class terminal states + reason codes |
| Lifecycle from `resolveMatchLifecycle(row.status,…)` — **not** `isFinished`/`listResult` | `settlement.ts:222-227` | detection is `status`-driven |
| `isFinished` required **only** for the won/lost score path | `outcomes.ts:118-137` (`requiredScoreInputsPresent`) | terminals bypass it |
| Terminal outcome **builds + appends** a `ValidationRecord` | `settlement.ts:266-287,326` | a **written** record, not a no-op |
| Frozen test: `status:"cancelled", isFinished:false` → `cancelled` terminal | `evidenceSettlement.test.ts:219-222` | isFinished:false settles |
| Frozen test: end-to-end writes `state:"postponed"` from `isFinished:false` | `evidenceSettlement.test.ts:559-567` | written terminal record |
| Frozen tests: postponed/cancelled corrections | `evidenceSettlement.test.ts:373-391` | full correction lifecycle |
| M10 spec lists them as settlement candidates | spec §6.2 | in-scope by the authoritative spec |

### 10.2 Does Stage 1 prevent these valid candidates from reaching M8? — **YES (conclusive).**
`eligibility.ts:154`: `if (row.isLive === true || row.isFinished !== true) return { reject, "fixture_not_complete" }`. Postponed/cancelled/abandoned rows carry `isFinished === false` → **rejected here, on every fire**. (`:157` additionally routes `listResult==="postponed"` to `unsupported_outcome_state`; both `fixture_not_complete` and `unsupported_outcome_state` are *deferrable*, so no candidate is ever emitted.) The classifier context `SettlementClassifyContext` (`:107-110`) carries only `capturedFixtureIds`/`settledFixtureIds` — it has **no `status`/`nowSec`/lifecycle input**, so it is structurally incapable of detecting a lifecycle terminal. The comment at `:158` misattributes the exclusion to "M8 R6" (which is `market_void` only).

### 10.3 Permanent starvation / legitimate settlement loss? — **YES.**
Cancelled/abandoned fixtures never become `isFinished`, so they are deferred **forever** → their captured predictions never receive `fixture_cancelled`/`fixture_abandoned` and stay `pending` permanently — a legitimate, written M8 settlement that Stage 1 can never produce. Postponed fixtures are likewise never settled to `fixture_postponed` (and even if later replayed-and-finished, the postponement terminal is lost). This is precisely "permanently exclude a legitimate M8 settlement."

### 10.4 Original classification (BLOCKER) — now **RESOLVED**.
The defect (§10.1–10.3) was a genuine Stage 1 blocker: the classifier *is* Stage 1's deliverable (DoD A1: "covering every §6 outcome"), spec §6.2 defines these as candidates, M8 writes real records for them, and the omission caused permanent loss.

**Fix verified (this re-review).** `classifySettlementRow` (`eligibility.ts:168-235`) now computes the lifecycle from `resolveMatchLifecycle({ status: row.status, kickoffUnix: row.kickoffTime, minute: row.minute, nowSec })` — the exact resolver/arguments M8 uses (`settlement.ts:222-227`; `nowSec` threaded via `SettlementClassifyContext:108-117` ← `settlement-provider.ts:101`) — and branches:
- `postponed | cancelled | abandoned` → **eligible**, no `isFinished`/score requirement (matches `outcomes.ts:186-205` exactly; the captured-snapshot precondition mirrors M8's `latestSnapshot`).
- `finished` → won/lost path retained, still gated on `isFinished` + present/valid FT/HT scores.
- `live | half_time | scheduled | pre_match | suspended` → `fixture_not_complete` (M8 PENDINGs; no write).
- `unavailable`/default → `unsupported_outcome_state` fail-closed reject.
The mislabeled "M8 R6" comment and the `listResult`-driven branch are gone. New tests (`evidenceCandidateProvider.test.ts`) assert eligible terminals for postponed/cancelled/abandoned (from `isFinished:false`), deferral for live/ht/scheduled/suspended, fail-closed reject for garbage status, and a mixed shuffled set → byte-identical eligible output. Lifecycle-terminal settlements now emit **exactly where M8 produces `terminal_non_scored`** — the exclusion is gone.

---

## 11. Completion-Instant Analysis

**Acceptable Stage 1 limitation; a Stage 2 accuracy condition. Not independently blocking.** Verified: `completionInstant` → `recordedAt = settledAt` (R1, `settlement.ts:279-280`), so it participates in the record's `contentHash` but **not** its identity (`validationId`/`revisionId` exclude it) and **not** the won/lost outcome. Default = `ISO(row.kickoff)` (source-stable) → deterministic → re-fires byte-identical → M8 `no_change` (replay-safe). Ordering by kickoff and `oldest_pending_age` measured from kickoff (overstates age — conservative). It is imprecise (`settledAt = kickoff`) but never violates a chain invariant (`settledAt = kickoff > capturedAt`). Spec §5.2 requires only "deterministic, source-derived, not a clock" — kickoff satisfies it. **Note:** once BF-S1 is fixed, kickoff is also a valid deterministic `settledAt` for terminal_non_scored fixtures. Stage 2 should inject a more precise terminal instant if the source exposes one.

---

## 12. Ordering and Anti-Starvation

**PASS.** Capture `(capturedAt asc, fixtureId asc)`; settlement `(completionInstant asc, fixtureId asc)`. Total over post-dedup inputs; input-order independent (shuffle tests deepEqual); earliest-window-first (anti-starvation); forward-only drain; deferred candidates carry no state and are deterministically re-discovered (INV-A/INV-S). No cursor.

---

## 13. Settlement Candidate Grain, Dedup, and Prediction Loss

- **Grain — one candidate per fixture is correct (verified).** M8's `settleLatestSnapshotForFixture` settles the **latest snapshot** and iterates **all** its `supportedMarkets` in one call (`settlement.ts:235`). The per-market "prediction" is handled inside M8; a per-fixture `SettlementCandidate` loses no prediction-level work. Older snapshots are intentionally not settled (R6) — by design, not loss.
- **Dedup does not discard legitimate work (verified).** Settlement dedup collapses multiple `completedRows` sharing one `matchId` — genuine duplicates of the same match; the single retained candidate settles all markets. Capture dedup drops a repeated `marketKey` within a fixture (same market derives identically). Neither discards distinct legitimate work. ✓
- **Caveat tied to the blocker:** because settlement is per-fixture/latest-snapshot and the classifier over-gates on `isFinished`, the *only* prediction-level loss is the lifecycle-terminal class (§10) — captured under BF-S1, not a separate grain defect.

---

## 14. Diagnostic Cardinality

**PASS.** Closed `as const` reason vocabularies, `seededReasonMap` fixes cardinality, `bumpReason` rejects unknown keys (no arbitrary-key injection). No `fixtureId`/`matchId`/`captureId`/`predictionId`/URL/raw-error/payload appears as key or value; aggregates are pure counts; no secrets. `fixture_correspondence_failure` (settlement) is a reserved unreachable key (per-fixture ⇒ C3 always true) — acceptable. Suitable for Stage 2/3 aggregation.

---

## 15. Archive-Derived State Sufficiency

**PARTIAL (Stage 2 condition — no longer a blocker).** `CaptureArchiveState { capturedWindowKeys, partialWindowKeys? }` represents all six capture states; keys use the frozen `"<fixtureId>|<capturedAt>"` shape (identical to `captureWindowKey().key` and `captureIdentityFromSnapshot`), so Stage 2 can derive them from snapshots+odds under strict reads. **Sufficient for capture.** The lifecycle input the classifier needs is now supplied — `nowSec` is threaded through `SettlementClassifyContext` and the status arrives on the `row` (BF-S1 fix). `SettlementArchiveState { capturedFixtureIds, settledFixtureIds }` is **sufficient for the first-settle (won/lost + terminal) scope** but **cannot** represent *settled-to-what-outcome*, so it cannot yet drive corrections (§16). Stage 2 must enrich it for the correction path — an additive change, not a Stage 1 defect.

---

## 16. correctionCause Verdict

**Verified. Not the primary blocker, but a mandatory Stage 2 condition.** `settlement.ts:301` requires an explicit `correctionCause` only when an already-settled outcome **changes** (`head.state !== outcome.state`); a first settle does not need it. Stage 1 rejects every `already_settled` fixture and never sets `correctionCause`, so it **cannot drive any correction** (won↔lost, or scored↔terminal). Because the first settlement of a won/lost fixture *does* happen, this is *non-propagation of later corrections* (a completeness gap), not first-settlement loss — hence a Stage 2 condition, distinct from BF-S1 (which is total non-settlement). Fixing it requires the richer settlement archive state of §15.

---

## 17. selectionKey / Registry Verification

**PASS.** `MARKET_SELECTION_BY_KIND` (`markets.ts:20-28`) maps the four `MatchListKind` (`fh/over15/over25/sh`) each to `selectionKey:"over"`; `source.ts:77` uses `marketSelectionForKind` so every `PublishedDailyPrediction.selectionKey` is `"over"`. Stage 1 capture rejects anything else (`kindForMarketKey` null / kind-mismatch / `selectionKey !== "over"` → `unsupported_market`); M8 settlement uses the same `CANONICAL_SELECTION_KEY="over"` and `kindForMarketKey`. All produced keys are §2.B members and valid pairings; no `market_void`/`excluded` synthesis. Registry safety (A5) holds; the daily-list correctly uses 4 of the 6 registry markets.

---

## 18. Blocking Findings

**NONE.** The sole blocker, **BF-S1** (settlement classifier permanently excluding lifecycle-terminal postponed/cancelled/abandoned settlements), is **RESOLVED and verified** (§0, §10.4): the classifier now decides eligibility via the frozen `resolveMatchLifecycle` and emits terminal settlements exactly where M8 writes `terminal_non_scored` records. No regression — frozen `outcomes.ts`/`settlement.ts` byte-identical, M8 settlement suite 34/34, full suite 1735/1735, typecheck exit 0, lint clean. Capture path, ordering, limits, diagnostics, grouping, identity, purity, and contract shape remain PASS.

Residual items are **Stage 2 integration conditions** or **acceptable Stage 1 limitations**, not blockers (§16, §22): corrections + richer settlement archive state (`SettlementArchiveState` intentionally coarse for first-settle scope — Stage 2 enriches it and sets `correctionCause`), more-precise `completionInstant` (deterministic kickoff default is spec-permitted), the deadline/lock/discovery-under-lock wiring, and the A4 replay test. Non-blocking recommendations: R1 dead import (`kindForMarketKey`, `eligibility.ts:16`), R3 capture reconciliation grain.

---

## 19. Exact Tests That Must Be Added

Unit (Gate-A, in `tests/evidenceCandidateProvider.test.ts`):
1. `status:"postponed", isFinished:false`, captured, unsettled → **eligible** candidate emitted (row carried, valid `completionInstant`, `nowSec` present). *(Replaces the current `:442-448` which asserts the wrong deferral.)*
2. Same for `status:"cancelled"` and `status:"abandoned"` → eligible.
3. Genuinely non-terminal (`status:"live"`/`"ht"`/`"ns"`, `isFinished:false`) → still deferred `fixture_not_complete`.
4. `finished` + valid scores → won/lost path still eligible; `finished` + missing/invalid score → `missing_final_score`/`invalid_final_score` (unchanged).
5. Determinism: shuffled input incl. a terminal + a finished fixture → byte-identical candidates.
6. Idempotency: a fixture already in `settledFixtureIds` (settled to `postponed`) → `already_settled` (no duplicate).
Integration (Gate-B, Stage 2): a postponed candidate through `runSettlementBatch`/`settleLatestSnapshotForFixture` produces a **written** `fixture_postponed` validation record and is `no_change` on re-fire — proving end-to-end legitimacy.

---

## 20. Non-blocking Recommendations

- **R1 — Dead import:** `kindForMarketKey` imported but unused in `eligibility.ts:16` (lint doesn't flag it) — remove.
- **R2 — Defensive grouping:** assert/precondition that a fixture's rows agree on `kickoffAt`/`leagueCode` so unnormalized input can't make `capturedAt` order-dependent.
- **R3 — Reconciliation grain:** the capture `discovered` counts rows while `eligible` counts grouped fixtures, so `discovered = eligible + rejected` doesn't hold as a simple sum (no loss — every row is counted). Add a "grouped fixtures" count so the identity reconciles.
- **R4 — Heal without fetch:** short-circuit the derivation for `healing:true`.
- **R5 — completionInstant accuracy (Stage 2):** inject a precise terminal instant when the source exposes one; else document kickoff as the deterministic anchor.
- **R6 — Correction support (Stage 2, §16):** enrich `SettlementArchiveState` with current-outcome-per-market and set `correctionCause` so genuine corrections propagate.
- **R7 — A4 replay test (Stage 2):** extend the M7 serialization-boundary replay over M10-produced captures.

---

## 21. I1–I15 Condition Matrix

| # | Condition | Verdict | Evidence | Correction required |
|---|---|---|---|---|
| **I1** | Pure dedicated provider boundary | **PASS** | isolated, injected deps, no clock/env/IO/cursor (§4) | none |
| **I2** | Frozen `CaptureRequest` compatibility | **PASS** | field-valid; typecheck exit 0 (§5) | none |
| **I3** | Frozen `SettlementCandidate` compatibility | **PASS** | field-valid; no outcome field; C3/C4 (§5) | none |
| **I4** | Correct capture grouping grain | **PASS** | per-fixture/all-markets = M6 grain; no identity change (§6) | Stage 2 defensive header assert (R2) |
| **I5** | Deterministic capture eligibility | **PASS** | total classifier; kickoff-reject before identity (§7) | none |
| **I6** | Faithful M6 partial-pair healing | **PASS** | same coords → `already_exists` heal, no dup (§8) | none |
| **I7** | Valid M5/M7 derivation seam | **PASS** | pure split; fixtureId fail-closed; capturedAt reused (§9) | Stage 2: implement `deriveCaptureInput` |
| **I8** | No-false-result settlement eligibility | **PASS** | BF-S1 fixed: lifecycle-driven classifier emits terminals exactly where M8 writes them; live/scheduled/ht/suspended defer; unknown fail-closed; scored path unchanged (§0, §10.4) | none (Stage 2: corrections, §16) |
| **I9** | Semantically safe completionInstant | **PARTIAL (acceptable)** | deterministic kickoff; affects contentHash not identity/outcome (§11) | Stage 2 precise instant (R5) |
| **I10** | Total deterministic anti-starvation ordering | **PASS** | total comparators; input-order independent (§12) | none |
| **I11** | No prediction loss from settlement dedup | **PASS** | M8 settles all markets per fixture; dedup collapses same-match rows (§13) | none |
| **I12** | Fail-safe batch limits | **PASS** | 100 default / 150 cap; no unlimited path (§ prior) | none |
| **I13** | Bounded diagnostic cardinality | **PASS** | closed seeded maps; unknown keys rejected (§14) | none |
| **I14** | Sufficient archive-derived progress state | **PARTIAL** | capture sufficient; lifecycle input now comes from the *row* (`status`/`kickoffTime`/`minute`) + injected `nowSec` (BF-S1 fix), not archive state; residual gap is corrections only — `SettlementArchiveState` still lacks per-market current outcome (§15/§16) | Stage 2: enrich state + `correctionCause` (R6) |
| **I15** | Comprehensive deterministic tests | **PASS (Stage 1 unit)** | 48/48; §19 lifecycle-terminal / non-terminal-defer / unknown-fail-closed / mixed-shuffle-determinism unit tests added with the BF-S1 fix; the wrong `postponed→deferred` assertion removed | Stage 2: A4 replay + B6/B7 integration tests |

---

## 22. Whether Stage 2 May Begin

**YES — both capture and settlement Stage 2 wiring may begin.** BF-S1 is resolved, so the settlement classifier now reproduces the frozen M8 eligibility boundary and can be safely wired into the runner. The remaining **Stage 2 integration conditions** (to be delivered before M10 closure, none a Stage 1 defect): (a) implement `deriveCaptureInput` (M4 fetch/admission + M5 derive) inside the durable lock, reusing `capturedAt`; (b) enrich `SettlementArchiveState` + set `correctionCause` to drive M8 corrections (§16); (c) bound the effective job deadline `≤45 s` and thread the ceilings + discovery-under-lock (INV-C/INV-D/INV-L); (d) more-precise `completionInstant` if the source exposes one; (e) the A4 M7 serialization-boundary replay test over M10-produced captures; (f) B6 overlap + B7 crash/replay integration tests. Non-blocking: R1 dead import, R3 reconciliation grain.

---

## 23. Final Verdict

Stage 1's capture provider and shared infrastructure are correct, pure, deterministic, adapter-neutral, bounded, and green. The one blocking defect — **BF-S1**, the settlement classifier permanently excluding lifecycle-terminal (postponed/cancelled/abandoned) fixtures that the frozen M8 engine settles to **written** terminal validation records — has been **fixed and independently verified resolved**: `classifySettlementRow` now decides eligibility from the frozen `resolveMatchLifecycle` (the exact M8 call, `nowSec` threaded), emitting terminal settlements exactly where M8 writes them, deferring live/scheduled/half-time/suspended, failing closed on unknown lifecycles, and preserving the won/lost scored gate. Candidate identity, deterministic ordering, diagnostic cardinality, replay semantics, and purity are unchanged; no frozen contract changed (`outcomes.ts`/`settlement.ts` byte-identical, M8 settlement suite 34/34); and no Stage 2 behaviour was introduced. Targeted provider tests **48/48**, full suite **1735/1735**, typecheck exit 0, lint clean.

### STAGE 1 IMPLEMENTATION APPROVED

No blocking finding remains; BF-S1 is removed from the blocking findings. Every I1–I15 condition is PASS or an explicitly-Stage-2 integration condition / acceptable Stage 1 limitation. Stage 2 orchestration/wiring (capture and settlement) may begin, subject to the §22 integration conditions before M10 closure.

---

## 24. Statement on this Review

Implementation review only. The **only** file created/modified is this document. No runtime code, tests, contracts, feature flags, cron routes, runners, schedules, environment, database, archive formats, or deployment configuration were modified. All cited types, functions, and `file:line` references were read from the current repository; all test/typecheck/lint results were produced by re-running the commands this pass. Stage 1 remains dormant, unwired, and default-off; M10 remains incomplete and NOT eligible for closure.
