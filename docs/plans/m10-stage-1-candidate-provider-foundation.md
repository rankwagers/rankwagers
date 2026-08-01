# M10 Stage 1 — Pure Candidate-Provider Foundation

**Document type:** Implementation-stage record (Stage 1 of M10).
**Date:** 2026-07-30
**Status:** Stage 1 implemented, dormant, unwired. **M10 is NOT complete.**
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1)
**Architecture review:** `docs/plans/m10-live-candidate-pipeline-architecture-review.md`
**Implementation review:** `docs/plans/m10-stage-1-candidate-provider-implementation-review.md` — raised **BF-S1** (blocking). **BF-S1 resolved** 2026-07-30 (§13); closure status unchanged (Stage 1 still dormant/unwired, M10 still NOT complete).

---

## 1. Scope

Stage 1 builds the **pure, adapter-neutral candidate-provider foundation** (spec §4.0 Option C):
deterministic discovery / classification / ordering / bounded selection for both capture and
settlement candidates, plus tests. It performs **no** cron wiring, **no** lock integration,
**no** archive I/O, **no** live fetch, **no** flag/env/schedule/deployment change, and does not
mark M10 complete. Archive-derived progress and the derivation dependency are **injected**; a
later orchestration stage will perform the archive reads and live fetch **inside the durable
lock** (spec §7.1 INV-L) and pass normalized state into this provider.

## 2. Files changed

**Created (all new, no existing file modified):**

- `lib/evidence-capture/candidates/types.ts` — internal provider types; re-exports the frozen
  `CaptureRequest` / `SettlementCandidate` (type-only); bounded rejection-reason vocabularies;
  diagnostics + archive-derived-state shapes.
- `lib/evidence-capture/candidates/limits.ts` — fail-safe batch-limit normalizer (INV-C).
- `lib/evidence-capture/candidates/ordering.ts` — deterministic comparators (INV-S).
- `lib/evidence-capture/candidates/diagnostics.ts` — seeded, bounded-key diagnostics builders.
- `lib/evidence-capture/candidates/eligibility.ts` — pure capture/settlement classifiers.
- `lib/evidence-capture/candidates/capture-provider.ts` — `planCaptureCandidates` (pure, dep-free)
  + `buildCaptureCandidates` (adds the injected derivation dependency).
- `lib/evidence-capture/candidates/settlement-provider.ts` — `buildSettlementCandidates` (pure).
- `lib/evidence-capture/candidates/index.ts` — barrel export.
- `tests/evidenceCandidateProvider.test.ts` — 42 unit tests.
- `docs/plans/m10-stage-1-candidate-provider-foundation.md` — this record.

**No change** to: frozen evidence contracts (`types/evidence/*`), M6 capture / M8 settlement
semantics, archive formats, cron routes, job runners, locks, feature flags, config, environment,
or deployment. No existing test was modified.

## 3. Architecture implemented

Option C: a dedicated layer under `lib/evidence-capture/candidates/`, dependency-injected, no
hidden global state, no clock (evaluation instant injected), no `process.env`, no I/O. The pure
plan step is fully dep-free; the only injected dependency is the capture derivation function
(`deriveCaptureInput`), which the orchestration stage will back with M4 fetch/admission + M5
`deriveEvidenceModel`. The provider mints no identity and never reads a store.

## 4. Candidate contracts reused (frozen, unchanged)

- Capture → `CaptureRequest` (`lib/evidence-capture/capture/capture.ts`): `{ admitted:true,
  fixtureId, capturedAt, modelInput }` + optional provenance passed through from derivation.
  `capturedAt` is the frozen window anchor from `captureWindowKey` (`lib/evidence-capture/identity.ts`);
  the provider computes coordinates only — M1/M6 derive identity. `modelVersion` is omitted unless
  explicitly configured (never invented, spec §5.1).
- Settlement → `SettlementCandidate` (`lib/evidence-capture/jobs/settlement-run.ts`): `{ fixtureId,
  row, completionInstant, nowSec }` (+ optional `recordedBy`). No result field is produced; WIN/
  LOSS/VOID/PUSH stays with M8.

## 5. Rejection / defer model

Bounded, low-cardinality reason keys (seeded to 0). Capture reasons: `malformed_source_row,
missing_fixture_identity, missing_kickoff, invalid_kickoff, unsupported_competition,
unsupported_market, not_yet, non_prematch, stale_fixture, missing_odds, invalid_odds,
no_scorable_markets, not_admitted, already_captured, incomplete_prior_pair, duplicate_candidate,
source_correspondence_failure`. Settlement reasons: `malformed_archive_record,
missing_prediction_identity, already_settled, fixture_not_complete, missing_final_score,
invalid_final_score, fixture_correspondence_failure, unsupported_outcome_state, corrupt_archive_state,
duplicate_candidate`. Retryable **defers** are separated from permanent **rejects** via
`captureReasonKind` / `settlementReasonKind` (deferrable capture: `not_yet, stale_fixture,
not_admitted, invalid_odds`; deferrable settlement: `fixture_not_complete, unsupported_outcome_state`).
A partial prior snapshot/odds pair is **re-emitted for healing** (not rejected), matching frozen
M6/C5 semantics. Missing/invalid kickoff is rejected **before** any window/identity is computed —
no identity minted.

## 6. Ordering rule (INV-S)

Capture: primary `capturedAt` ascending (earliest-opening window first), tie-break `fixtureId`
ascending. Settlement: primary `completionInstant` ascending, tie-break `fixtureId` ascending
(per-fixture grain → tie-break fully determines order). Comparators are total over post-dedup
inputs, so output order is independent of input array order (tested with shuffled inputs).

## 7. Limit behaviour (INV-C)

`normalizeBatchLimit`: absolute max 150, default 100, valid range 1–150. Missing / NaN /
non-integer / zero / negative / non-number ⇒ fail safe to 100 (never unbounded); > 150 clamps to
150. Overflow is **deferred and counted** (`candidatesDeferredByCap`, `backlogSize`,
`oldestPendingAgeMs`), never silently dropped. Distinct counts are reported: discovered, malformed,
eligible, selected, deferred-by-cap, backlog, oldest-pending-age, emitted; `candidatesProcessed`
stays 0 (owned by the M9 runner).

## 8. Archive-derived state boundary (INV-A)

The provider is pure and reads no store. Archive-derived progress is passed in as normalized
read-only state: capture `{ capturedWindowKeys, partialWindowKeys }` (window keys use the frozen
`"<fixtureId>|<capturedAt>"` shape); settlement `{ capturedFixtureIds, settledFixtureIds }`. No
process-local / filesystem-offset / request-supplied cursor exists; no identity derives from line
position. A corrupt normalized settlement state fails closed (every row rejected
`corrupt_archive_state`, no candidates).

## 9. Tests added

48 unit tests in `tests/evidenceCandidateProvider.test.ts` covering: capture determinism from
shuffled input; missing/invalid kickoff (no identity minted); unsupported competition/market;
non-prematch; not-yet; stale; already-captured; partial-pair healing; duplicate market; multi-tab
collapse; malformed row; missing identity; stable identity across retry and across ceilings;
cap default/clamp/fail-safe; deferred count + backlog + oldest-pending-age; derivation rejection;
source-correspondence failure; modelVersion omission; large-input bounding. Settlement: scored
eligible emit; shuffled determinism; **postponed/cancelled/abandoned terminal-eligible (no score
requirement, BF-S1)**; **live/half-time/scheduled/suspended deferred (`fixture_not_complete`)**;
**unknown/unresolvable lifecycle deterministic rejection (`unsupported_outcome_state`, never
emits)**; **mixed terminal+finished+deferred shuffled → byte-identical eligible set**;
missing/invalid final score (scored path unchanged); no captured snapshot; already-settled;
duplicate collapse; malformed record; corrupt state fail-closed; no premature outcome field; cap
deferral + stable replay. Shared: empty input; bounded reason-key set; no high-cardinality id as a
label key; `candidatesProcessed`=0; total comparator.

## 10. Validation results

- Targeted M10 provider tests: **48/48 pass** (post-BF-S1; was 42/42).
- Full suite (`npm test`): **1735/1735 pass** (post-BF-S1; was 1729/1729). No frozen contract,
  identity, hash, archive-format, capture-provider, or M8 semantics changed.
- Typecheck (`npm run typecheck`): **clean (exit 0)**.
- Lint (`npm run lint`): **clean — no ESLint warnings or errors**.

## 11. Known limitations (for later stages)

- **`completionInstant` default** uses the fixture's canonical kickoff instant (a stable,
  source-derived, idempotent field) because `FootyMatchRow` carries no explicit terminal
  timestamp. It is injectable via `deps.deriveCompletionInstant`; the orchestration stage may
  supply a more precise terminal instant. Determinism/idempotency (the property M8 requires) holds
  regardless.
- **Capture derivation** (odds/model) is an injected dependency stubbed in tests; wiring it to real
  M4 fetch + M5 derivation is a later stage. `missing_odds`/`invalid_odds`/`not_admitted`/
  `no_scorable_markets` are recorded faithfully from the dependency, not decided by this layer.
- **`fixture_correspondence_failure`** (settlement) is a reserved bounded reason key; per-fixture
  candidates make `row.matchId === fixtureId` true by construction, so downstream M8 C3 always
  passes. The key exists for completeness.

## 12. Activation status — explicit

**Cron wiring and production activation remain absent.** No cron route, runner, lock, flag,
schedule, environment, database, archive format, or deployment configuration was changed. The
provider is dormant library code, invoked by nothing yet. Wiring it into the M9 runners inside the
durable lock, bounded by the INV-C/INV-D budget, is a subsequent M10 stage. This document does not
mark M10 complete and does not update the M10 closure stub's evidence sections.

## 13. BF-S1 resolved (2026-07-30)

**Blocker (from the implementation review §10/§18):** the Stage 1 settlement classifier gated
eligibility on `row.isFinished === true` (and routed `listResult === "postponed"` to
`unsupported_outcome_state`), so it **permanently excluded every lifecycle-terminal
(postponed / cancelled / abandoned) fixture** — fixtures the frozen M8 engine settles to a
**written** `terminal_non_scored` `ValidationRecord` (`outcomes.ts:186-205`, `settlement.ts:266-287`).
Those captured predictions could never receive their `fixture_postponed`/`fixture_cancelled`/
`fixture_abandoned` terminal and stayed `pending` forever, under-settling the archive.

**Fix (settlement classifier + provider + its tests only; no frozen change):**

1. **Threaded the lifecycle input into the classifier.** `SettlementClassifyContext`
   (`eligibility.ts`) now carries the deterministic evaluation `nowSec` (already computed in
   `settlement-provider.ts`), so the classifier can resolve the lifecycle without a clock.
2. **Reused the repository's authoritative resolver.** `classifySettlementRow` now calls
   `resolveMatchLifecycle({ status: row.status, kickoffUnix: row.kickoffTime, minute: row.minute,
   nowSec })` — the **exact** call M8 makes (`settlement.ts:222-227`). No lifecycle logic is
   duplicated; the coarse `isFinished` gate and the wrong-field/wrong-scope `listResult ===
   "postponed"` branch (and its mislabelled "M8 R6" comment) were removed.
3. **Faithful eligibility boundary** (emits exactly what M8 would write a record for):
   - `finished` → **eligible scored** settlement — still requires `isFinished` + present, valid
     FT/HT scores (C4/R3 **unchanged, not weakened**); a finished-lifecycle row lacking that is
     `fixture_not_complete` (M8 PENDING).
   - `postponed | cancelled | abandoned` → **eligible terminal non-scored** settlement — **no**
     score requirement; the deterministic kickoff `completionInstant` satisfies M8's instant check.
   - `live | half_time | scheduled | pre_match | suspended` → **defer** `fixture_not_complete`
     (M8 PENDING; re-classified next fire).
   - `unavailable` (unknown / unresolvable status) → **deterministic rejection**
     `unsupported_outcome_state`; fail-closed, never emits.
4. **Fail-closed preserved.** A malformed row (`malformed_archive_record`), an unknown lifecycle
   (`unsupported_outcome_state`), or missing/invalid scores on the scored path can never emit a
   candidate.
5. **No change to** candidate identity, deterministic ordering, diagnostics cardinality (the
   bounded reason-key set is unchanged), the frozen `SettlementCandidate` shape, capture-provider
   behaviour, frozen contracts, identity formulas, archive formats, feature flags, cron wiring, or
   deployment.

**Tests updated** (`tests/evidenceCandidateProvider.test.ts`): removed the incorrect
`postponed → unsupported_outcome_state (deferred)` expectation; added **postponed / cancelled /
abandoned terminal-eligible** (proven eligible even with `null` final scores), **live / half-time /
scheduled / suspended deferred**, **unknown-lifecycle deterministic rejection**, and a **mixed
terminal+finished+deferred shuffled-determinism** case. Scored-eligibility, invalid/missing-score
rejection, duplicate prevention, ordering, replay, and cap behaviour all re-verified unchanged.

**Re-verification:** targeted **48/48**, full suite **1735/1735**, typecheck exit 0, lint clean.

**Scope note:** this is a Stage 1 correctness fix only. No Stage 2 orchestration, cron/runner
wiring, or archive read/lock integration was implemented; the provider remains dormant and unwired,
and **M10 is still NOT complete**.
