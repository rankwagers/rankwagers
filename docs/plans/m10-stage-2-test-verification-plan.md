# M10 Stage 2 — Test & Verification Plan (Orchestration / Live Wiring)

**Document type:** Test-planning deliverable only. **No test, runtime code, contract, flag, schedule, or existing document is created or modified by this plan** — it specifies the tests Stage 2 must ship.
**Date:** 2026-07-30
**Author role:** Test Architecture Reviewer, Sprint 23B / M10 Stage 2 preparation.
**Governing inputs (read for this plan):** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1); `docs/plans/m10-live-candidate-pipeline-architecture-review.md` (BF-1…BF-4, C1–C15); `docs/plans/m10-stage-1-candidate-provider-foundation.md` (+ §13 BF-S1 resolution); `docs/plans/m10-stage-1-candidate-provider-implementation-review.md` (I1–I15, §18/§19); `docs/plans/sprint-23b-m9-closure.md`; `docs/plans/sprint-23b-m10-closure.md` (stub); `docs/architecture/phase-2-7-definition-of-done.md`.
**Code inspected to ground every test:** `lib/evidence-capture/candidates/{types,limits,ordering,diagnostics,eligibility,capture-provider,settlement-provider,index}.ts`; `lib/jobs/{runner,locks,cronHandler,diagnostics,types}.ts`; `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts`; `lib/evidence-capture/{config,source}.ts`; `lib/evidence-capture/capture/{capture,mandatory-odds}.ts`; `lib/evidence-capture/jobs/{capture-run,settlement-run}.ts`; `lib/evidence-capture/settlement.ts`, `outcomes.ts`, `markets.ts`; `lib/archive/evidence/file.ts`; `lib/evidence-capture/odds-archive/file.ts`; and the existing suites (`tests/evidenceCandidateProvider.test.ts` 48, `m9Activation` 18, `m9Concurrency` 11, `evidenceSettlement` 34, `evidenceCaptureMint` 14, `evidenceArchiveFileAdapter` 9, `oddsArchive` 15, …).

---

## 1. Executive Summary

Stage 1 (pure candidate-provider foundation) is built, dormant, unwired, and green (documented full suite **1735/1735**, targeted 48/48, typecheck exit 0, lint clean), with its one blocker **BF-S1 resolved**. What Stage 1 delivered is a **pure** producer: `planCaptureCandidates` / `buildCaptureCandidates(deps)` / `buildSettlementCandidates` operating over injected `(sourceRows, evaluationInstant, leadMinutes, archiveState, config, deps)` — **no store read, no lock, no fetch, no clock, no route**.

**Stage 2 is the orchestration/wiring stage.** It must, *inside the durable job lock* (`runWithLock`), (a) derive `CaptureArchiveState` / `SettlementArchiveState` from the immutable archive via strict reads, (b) discover + classify + order + bound-select candidates, (c) back `deriveCaptureInput` with real M4 fetch/admission + M5 derivation and `deriveCompletionInstant` with a source-derived instant, (d) enforce the ceilings (INV-C) and the sub-route deadline (INV-D), and (e) pass the bounded arrays into the already-built `runEvidenceCaptureJob({candidates,deps})` / `runPredictionSettlementJob({candidates,deps})`. Everything downstream of the injection seam is frozen M6/M8 and must not change.

Because Stage 2 introduces the **first stateful, concurrent, deadline-bounded, archive-reading** surface of M10, its verification burden is dominated by properties that Stage 1's pure tests *cannot* reach: discovery-under-lock (INV-L / BF-2 / Gate B6), archive-derived progress with strict reads and no cursor (INV-A / Gate B7), the deadline-below-budget guard (INV-D / BF-1 / Gate B5), semantic-free wiring of provider output into the frozen consumers, and crash/replay with no candidate loss.

**Verdict (test-readiness):** **NOT READY to implement Stage 2 settlement/capture wiring without the test scaffolding below first agreed.** The Stage-1 *capture* foundation is a sound base and Stage-2 capture wiring may begin **once the Gate C (concurrency) and Gate D (failure-injection) harnesses in §7/§9 are in place** — these are the tests that catch the class of defect wiring introduces. This plan is the exact scaffolding. It defines 11 unit groups, 20 capture-integration cases, 18 settlement-integration cases, 9 concurrency cases, 8 deadline cases, a failure matrix, the diagnostic reconciliation identities, a dormancy/scope suite, the regression anchor set, reusable fixtures/builders (injected fake clock, no wall-clock), and the A–G gate matrix with binary pass criteria.

---

## 2. Existing Test Coverage

| Area | Suite (tests/) | Count | Proves (relevant to M10) |
|---|---|---|---|
| **Stage-1 provider (pure)** | `evidenceCandidateProvider.test.ts` | 48 | classifier totality, deterministic capture/settlement assembly from shuffled input, missing/invalid kickoff → no identity mint, cap default/clamp/fail-safe, ordering totality, partial-pair healing flag, terminal-lifecycle eligibility (BF-S1), corrupt settlement state fail-closed, bounded reason-key cardinality, `candidatesProcessed=0` at provider stage |
| **M9 activation** | `m9Activation.test.ts` | 18 | C1 distinct lock keys, C2 dual-flag default-off skip, C3 fixture-correspondence, C4 score sanity, C5 mandatory odds + healing, C6 error classification, C7 diagnostics, frozen-invariance (odds write never mutates snapshot id/hash) |
| **M9 concurrency / locks** | `m9Concurrency.test.ts` | 11 | same-key serialize, distinct-key parallel, release-in-finally (throw + write_failed), cron-overlap→409/no-queue, 1000-cycle no-growth, no jobLog clobber, durable-lock prod fail-closed ×3 |
| **M8 settlement** | `evidenceSettlement.test.ts` | 34 | pending-not-lost (R3), terminal non-scored (postponed/cancelled/abandoned) written records, corrections/revisions, no-change idempotency, C3/C4 |
| **M6 capture mint** | `evidenceCaptureMint.test.ts` | 14 | full-stream idempotency (`already_exists`), `evidenceSnapshotId` sequence, fail-closed admission |
| **Archive strict reads** | `evidenceArchiveFileAdapter.test.ts`, `evidenceArchive.test.ts` | 9 + | ENOENT→empty; EACCES/EPERM/EIO/EBUSY/malformed → throw (never empty) |
| **Odds archive** | `oddsArchive.test.ts` | 15 | append idempotency (id,contentHash), immutable_violation, strict reads, in-process serialize |
| **M7 identity/replay** | `evidenceInputIdentity.test.ts` | 10 | `inputContentHash` excludes modelVersion; serialization-boundary replay |
| **M4 routing / M5 derive / config** | `evidenceRouting`, `evidenceModel`, `evidenceCaptureConfig`, `evidenceUpstreamConfig`, `evidenceCaptureSource` | 54 | injected-clock fetch plan/orchestration, pure derivation (omitted markets dropped), flag/limit normalization, `loadPublishedDailyPredictions` |

**Coverage strength:** the *consumer* safety net and the *pure producer* are both well-covered. **Coverage void:** everything that only exists once the producer is **wired** — see §3.

---

## 3. Coverage Gaps (what Stage 2 introduces and no test yet touches)

| # | Gap | Why Stage 1 can't cover it | Invariant / Gate |
|---|---|---|---|
| G-1 | **Archive-state normalizers** — deriving `CaptureArchiveState{capturedWindowKeys, partialWindowKeys}` / `SettlementArchiveState{capturedFixtureIds, settledFixtureIds}` from the store via strict reads | Stage 1 receives archiveState *pre-built*; no code builds it yet | INV-A, A8, B7 |
| G-2 | **Discovery/classification/selection executing inside the held durable lock** | Stage 1 is lockless & pure | INV-L, BF-2, B6 |
| G-3 | **Deadline budget helper** — `effectiveJobDeadlineMs = min(configured, ROUTE_BUDGET − HEADROOM) ≤ 45 s`, remaining-deadline guard that defers before starting work | No deadline logic exists anywhere (`grep` for `effectiveJobDeadline`/`ROUTE_BUDGET`/`remainingDeadline` = none) | INV-D, BF-1, A9, B5 |
| G-4 | **`deriveCaptureInput` adapter** — M4 fetch/admission + M5 derive behind the injected seam, reusing `capturedAt` verbatim, mapping failures to exact reason keys | Stub in Stage 1 | A2–A4, B1, B4 |
| G-5 | **`deriveCompletionInstant`** wiring + `correctionCause` selection (impl-review §16 / R6) | Stage 1 uses kickoff default; never sets `correctionCause` | B2, correction cases |
| G-6 | **Provider→runner wiring (no semantic translation)** — the produced arrays flow verbatim into `runCaptureBatch`/`runSettlementBatch` | routes still call runners with `()` | B1–B3, frozen |
| G-7 | **Diagnostic reconciliation end-to-end** incl. the two Stage-2-new counters `candidatesDeferredByDeadline` and `candidatesProcessed` (from the batch result) | Stage 1 leaves `candidatesProcessed=0`; no deadline defer counter | A11, §10 |
| G-8 | **Config→ceiling/deadline binding** — `DEFAULT_CAPTURE_MAX_FIXTURES=500` and `DEFAULT_RUN_DEADLINE_MS=300000` must be **clamped, never honoured** | Stage 1 has `normalizeBatchLimit` but nothing binds the raw config | INV-C/INV-D, A6/A9, H-2/H-3 |
| G-9 | **Route-level status mapping under the producer** (skipped→409, failed→500, else 200; overlap never 500) | routes untested with a real candidate producer | B6, dormancy |
| G-10 | **Reconciliation grain (impl-review R3)** — capture `discovered` counts rows, `eligible` counts grouped fixtures | needs a grouped-fixtures counter to reconcile | A11 |

---

## 4. Unit-Test Plan (Gate A — offline, deterministic, no I/O)

All unit tests: pure functions, **injected `evalInstant`/`nowSec`/`nowMs`**, no `Date.now`/`Math.random`/`process.env`/`fs`/`fetch`. Repeat-run determinism asserted (run each assertion twice, `deepEqual`). New file suggestion: `tests/m10CandidateOrchestration.test.ts` for the Stage-2 units that are still pure (normalizers, deadline math, adapters), keeping `evidenceCandidateProvider.test.ts` for the provider foundation.

### U-1 — Archive-state normalizers (G-1)
The Stage-2 normalizer under test builds `CaptureArchiveState`/`SettlementArchiveState` from lists of snapshots/odds/validations (fed from a seeded in-memory store, but the pure normalizer itself is unit-level).
- U-1.1 complete pair (snapshot + its mandatory `evidence_capture` odds for every `supportedMarkets` slot) → window key in `capturedWindowKeys`, **not** in `partialWindowKeys`.
- U-1.2 snapshot present, ≥1 mandatory odds slot missing → window key in `partialWindowKeys` only (drives healing).
- U-1.3 odds present but no snapshot (impossible-forward, but defensively) → not counted as captured; does not fabricate a window key.
- U-1.4 window-key shape is exactly the frozen `"<fixtureId>|<capturedAt>"` (equal to `captureIdentityFromSnapshot(snapshot).captureWindowKey`), so Stage-1 lookups match by construction.
- U-1.5 settlement: fixture with ≥1 snapshot → `capturedFixtureIds`; fixture whose current terminal outcome is already the head revision → `settledFixtureIds`; a fixture settled to `postponed` (terminal non-scored) is in `settledFixtureIds` (guards BF-S1 double-settle).
- U-1.6 **corrupt/unreadable archive → normalizer throws or returns a fail-closed sentinel** the caller maps to defer (never returns an empty "no history" state — that would risk a duplicate mint). Ties to strict-read policy.

### U-2 — Complete / partial / corrupt capture pairs (feeds classifier)
- U-2.1 complete pair → `classifyCaptureFixture` yields `already_captured` (skip).
- U-2.2 partial pair → `healing:true` re-emit (not rejected), matching Stage-1 §5 and C5 semantics.
- U-2.3 corrupt normalized capture state → fail-closed (no candidate; counted).

### U-3 — Settled / unsettled / correction settlement state
- U-3.1 unsettled captured fixture, terminal → eligible.
- U-3.2 already-settled (head outcome equals resolved outcome) → `already_settled` (no candidate).
- U-3.3 **correction**: captured, previously settled to state X, source now resolves to Y → candidate emitted **with `correctionCause` set** (the Stage-2 enrichment, impl-review §16). Requires the enriched `SettlementArchiveState` (current-outcome-per-fixture) — assert the classifier can only set `correctionCause` when it knows the prior outcome differs.

### U-4 — Strict rejection of malformed normalized state
- U-4.1 malformed source row (bad/absent identity) → `malformed_source_row`/`missing_fixture_identity`, counted, never emitted.
- U-4.2 malformed archive record in settlement state → `corrupt_archive_state`, all rows rejected (fail-closed; already covered at provider grain — extend to the normalizer boundary).
- U-4.3 unknown/unresolvable lifecycle → `unsupported_outcome_state`, never emits (BF-S1 fixed behaviour).

### U-5 — Diagnostic aggregation (`diagnostics.ts`)
- U-5.1 `emptyCaptureDiagnostics()` / `emptySettlementDiagnostics()` seed **every** bounded reason key to 0 (closed `as const` vocab).
- U-5.2 `bumpReason` ignores an unknown key (no arbitrary-key injection → cardinality bound).
- U-5.3 no `fixtureId`/`matchId`/`captureId`/`predictionId`/URL/raw-error appears as a key or value.
- U-5.4 Stage-2 additions: `candidatesDeferredByDeadline` and `candidatesProcessed` are present, seeded 0, and low-cardinality.

### U-6 — Deadline budget helpers (G-3, INV-D)
- U-6.1 `effectiveJobDeadlineMs(configured=300_000)` → clamped to `ROUTE_BUDGET(60_000) − HEADROOM(~15_000)` ⇒ **≤ 45_000** (300 s never honoured).
- U-6.2 `effectiveJobDeadlineMs(configured=20_000)` → 20_000 (honours a smaller configured value).
- U-6.3 invalid/zero/negative configured → fail-safe to the bounded target (never unbounded, never 300 s).
- U-6.4 **remaining-deadline guard**: given `(startMs, nowMs, worstCasePerCandidateMs)`, returns `proceed` when `remaining ≥ worstCase`, else `defer` — pure function of injected clock values.
- U-6.5 the guard reserves headroom for **response serialization + diagnostics emission** (a candidate is not started if only serialization headroom remains).

### U-7 — Configuration limit normalization (`limits.ts`, INV-C)
- U-7.1 `normalizeBatchLimit`: `undefined/NaN/0/-5/"x"/1.5` → `100` (default, never unbounded, never 500).
- U-7.2 `200` → `150` (clamp to `CANDIDATE_LIMIT_MAX`); `1` → `1`; `150` → `150`.
- U-7.3 **binding test that the raw `DEFAULT_CAPTURE_MAX_FIXTURES=500` can never become the effective ceiling** — the Stage-2 resolver passes config through `normalizeBatchLimit`, so 500 → 150. Symmetric settlement resolver test (settlement had no cap before).

### U-8 — completionInstant selection (G-5)
- U-8.1 default `deriveCompletionInstant(row)` = `ISO(row.kickoff)` (deterministic, source-stable) — identical row → identical instant across two calls.
- U-8.2 injected override deterministic; asserted no clock read.
- U-8.3 chain-safety: emitted `completionInstant` satisfies `settledAt > capturedAt` for the fixture's snapshot (so `verifyValidationChain` monotonic check holds); never `invalid_timestamp` at M8.

### U-9 — correctionCause selection (G-5, impl-review §16)
- U-9.1 first settle → `correctionCause` **undefined** (M8 requires it only on state change).
- U-9.2 genuine change (X→Y) with enriched prior-outcome state → a valid `CorrectionCause` (`result_reinterpreted` | `source_lineage_changed`) chosen deterministically from the transition, never guessed.
- U-9.3 no prior-outcome knowledge (state not enriched) → the classifier must **not** emit a correction candidate (fail-closed; avoids an unexplained correction).

### U-10 — Adapter mapping to `CaptureRequest` (G-4, A2/A3/A5)
- U-10.1 `capturedAt = ISO(kickoffMs − leadMinutes·60000)` exactly; downstream `captureWindowKey`/`captureId` equal the M1 formula for those coordinates (re-derive with `captureIdentityFromSnapshot`).
- U-10.2 `admitted:true` only when the derivation dep returned `ok:true`; a `deriveCaptureInput` failure maps to the exact reason key (`not_admitted`/`no_scorable_markets`/`missing_odds`/`invalid_odds`) and is **counted, not emitted**.
- U-10.3 `modelInput.fixtureId === request.fixtureId` (else `source_correspondence_failure`); `modelVersion` omitted unless configured (never invented).
- U-10.4 every produced `marketKey`/`selectionKey` is a §2.B registry member + valid pairing; `selectionKey==="over"`; no `market_void`/`excluded` synthesis (A5).
- U-10.5 identical `(row, evalInstant, leadMinutes)` → **byte-identical** `CaptureRequest` (JSON.stringify equality), independent of batch order/ceiling (retry-stable identity).

### U-11 — Adapter mapping to `SettlementCandidate` (A2, C3/C4 pre-satisfaction)
- U-11.1 `{fixtureId, row, completionInstant, nowSec}` present; **no outcome field** (exact key-set assertion — WIN/LOSS/VOID/PUSH stays with M8).
- U-11.2 `row.matchId === fixtureId` true by construction (so downstream C3 always passes) — assert on a per-fixture candidate.
- U-11.3 `nowSec` is an integer derived deterministically from `evaluationInstant`; no clock.
- U-11.4 identical `(row, evalInstant)` → byte-identical `SettlementCandidate`.

---

## 5. Capture Integration Plan (Gate B — wired runner + seeded stores, stubbed fetch)

Harness: seed an in-memory `EvidenceArchiveStore` + `OddsArchiveStore`; inject a **stubbed `deriveCaptureInput`** (deterministic, no network) into `runEvidenceCaptureJob({candidates, deps})`; drive the producer inside the runner's lock. `JOB_LOCK_ADAPTER=memory` for determinism (matching `m9Activation.test.ts`). Assertions read back the archive, the returned `RefreshJobRecord`, and the diagnostics.

| # | Case | Assertion |
|---|---|---|
| CI-1 | **Source discovery inside lock** | Discovery/classification callback observes the lock held; a probe proves no discovery ran before `tryAcquireJobLock` returned (INV-L). |
| CI-2 | **Archive read inside lock** | The archive-state normalizer read executes after lock acquisition, once per run (single bounded read — no per-fixture re-scan). |
| CI-3 | **Complete pair skipped** | Seed a complete snapshot+odds pair; fire → `already_captured`, zero new writes, `succeeded`. |
| CI-4 | **Snapshot-only pair reprocessed for healing** | Seed snapshot without mandatory odds; fire → snapshot `already_exists`, `ensureMandatoryCaptureOdds` appends the missing odds, `oddsAppended≥1`, no new snapshot identity. |
| CI-5 | **Odds-only pair** (defensive) | Seed odds without snapshot; fire mints the snapshot deterministically then ensures odds → one complete pair, no duplicate. |
| CI-6 | **Malformed archive fails entire job closed** | Corrupt a snapshots NDJSON line; the normalizer read throws; run defers affected fixtures / reports failure — **never** proceeds on empty history (no duplicate mint). Extends `evidenceArchiveFileAdapter` strict-read to the job boundary. |
| CI-7 | **Duplicate source rows** | Two identical rows for one fixture → deduped to one candidate → one snapshot. |
| CI-8 | **Multiple markets per fixture** | Rows for `over25`+`sh` same fixture → one `CaptureRequest`, one snapshot, one mandatory odds record **per supported market**. |
| CI-9 | **Cap 100** | 130 eligible fixtures, default config → 100 selected + 30 `candidatesDeferredByCap`; 100 snapshots written. |
| CI-10 | **Clamp 150** | config `maxCandidates=500` → effective 150 (never 500); 150 selected, remainder deferred. |
| CI-11 | **Invalid cap fallback** | config `maxCandidates=0/-1/NaN` → effective **100** (fail-safe), never unbounded. |
| CI-12 | **Backlog rediscovery** | Fire 1 selects 100 of 130 (30 deferred, no state persisted); Fire 2 over the same source+updated archive re-derives and selects the remaining 30 — no candidate lost, none double-minted. |
| CI-13 | **Late-arriving older candidate** | Add a fixture with an *earlier* `capturedAt` between fires → it sorts first (INV-S `capturedAt` asc) and is served next fire; ordering independent of arrival order. |
| CI-14 | **Derivation failure** | Stub returns `ok:false, reason:"not_admitted"` for one fixture → counted `not_admitted`, **no snapshot**, run still `succeeded`; other fixtures captured. |
| CI-15 | **Candidate processing failure** | `captureEvidenceSnapshot` returns `archive_error`/throws for one fixture → `writeFailed`, run `failed` with `write_failed` code, other fixtures unaffected (per-candidate isolation). |
| CI-16 | **Deadline before next candidate** | Injected clock advances so remaining < worst-case before candidate k → k..N deferred `candidatesDeferredByDeadline`, 1..k-1 committed; run `succeeded`. |
| CI-17 | **Replay after partial write** | Simulate crash after N of M (only N snapshots+odds committed); re-fire re-derives eligibility from the archive and completes M−N with **no duplicates** (full-stream `already_exists`). |
| CI-18 | **Process restart behavior** | New store/provider instances (no in-memory carryover) recompute identical pending work from the durable archive alone (INV-A). |
| CI-19 | **No cursor state** | Static assertion: after any fire, no cursor/offset/checkpoint file or process-local authoritative progress exists; a fresh process reproduces the same selection (grep-guard + behavioural). |
| CI-20 | **Idempotent re-fire (B3)** | Fire twice with identical inputs → second fire writes nothing new (`already_captured`), `succeeded` zero new-count; matches the M9 empty-pass baseline. |

---

## 6. Settlement Integration Plan (Gate B)

Harness: seed snapshots (so there is something to settle) + validations; inject completed `FootyMatchRow`s; drive `runPredictionSettlementJob({candidates, deps})`. Assert written `ValidationRecord`s, terminal states, revisions, and diagnostics. **No false WIN/LOSS/VOID/PUSH** is the dominant property.

| # | Case | Assertion |
|---|---|---|
| SI-1 | **Captured pending prediction** | Captured, fixture not terminal → `fixture_not_complete` defer, no write. |
| SI-2 | **Already-settled prediction** | Head outcome equals resolved outcome → `already_settled` / M8 `no_change`, no new revision. |
| SI-3 | **Finished scored fixture** | `finished` + valid FT scores → won/lost written per `resolveMatchLifecycle`+`outcomes.ts`; re-fire → `no_change`. |
| SI-4 | **Postponed terminal** | `status:"postponed", isFinished:false` → **written** `fixture_postponed` record (BF-S1 regression guard). |
| SI-5 | **Cancelled terminal** | → written `fixture_cancelled`; re-fire `no_change`. |
| SI-6 | **Abandoned terminal** | → written `fixture_abandoned`. |
| SI-7 | **Live deferred** | `live` → `fixture_not_complete`, no write; re-classified next fire. |
| SI-8 | **Suspended deferred** | `suspended` → deferred, no write. |
| SI-9 | **Missing score** | `finished` + absent FT/HT → M8 `pending` (R3), **never `lost`**, no write. |
| SI-10 | **Corrupt score** | negative/fractional/NaN/Infinity → C4 `invalidScore` (Stage-1 `hasValidCompletedScores`), rejected before settle, no write. |
| SI-11 | **Fixture mismatch** | `row.matchId≠fixtureId` (forced) → C3 `fixtureMismatch` before any store touch — no settle. |
| SI-12 | **Duplicate fixture row** | two completed rows same `matchId` → deduped to one candidate settling all markets. |
| SI-13 | **Correction/revision state** | previously won, source now resolves lost (or scored→terminal) → **one** new revision with a valid `correctionCause`; re-fire `no_change` (U-9, impl-review §16). |
| SI-14 | **Cap / backlog** | >150 eligible → 100 (default) selected, remainder `candidatesDeferredByCap`, re-discovered next fire; symmetric settlement ceiling enforced (H-3). |
| SI-15 | **completionInstant** | emitted `completionInstant` deterministic (kickoff default) → byte-identical re-fire → `no_change`; `settledAt > capturedAt`. |
| SI-16 | **Replay after append failure** | inject `write_failed` on a validation append → run `failed` with code; re-fire (store healthy) settles it once, no duplicate revision. |
| SI-17 | **Archive read failure** | corrupt validations NDJSON line → read throws → fixture deferred, run surfaces failure, no false settle. |
| SI-18 | **No false result (sweep)** | property test over {missing, mismatched, malformed, in-play, corrupt-read, partial-read, outage, stale} inputs → **never** WIN/LOSS/VOID/PUSH; only `pending`/defer/reject/`fixtureMismatch`/`invalidScore`. |

---

## 7. Concurrency Plan (Gate C)

Lock semantics live in `lib/jobs/locks.ts` (`tryAcquireJobLock`, `requireDurable`, `advisoryLockKey`, `resetMemoryJobLocks`, `JOB_LOCK_ADAPTER`). Classify each test by tier.

| # | Case | Assertion | Tier |
|---|---|---|---|
| CC-1 | **Capture vs capture** | two concurrent `runEvidenceCaptureJob` fires: one runs, the other `skipped/lock_unavailable`; **discovery of the loser never executes** (INV-L); no duplicate mint. | Integration (memory lock) |
| CC-2 | **Settlement vs settlement** | symmetric; single writer; no duplicate revision. | Integration |
| CC-3 | **Capture vs settlement** | distinct keys `job:evidence_capture` / `job:prediction_settlement` → both proceed concurrently, no false contention (extends `m9Concurrency` distinct-key test to real producers). | Integration |
| CC-4 | **Lock unavailable** | held lock → job returns `skipped` + `lock_unavailable`; route maps to **409, never 500**; producer did no archive read/fetch. | Integration |
| CC-5 | **One job times out** | job A holds lock and hits the effective deadline → defers remaining, releases lock in `finally`; job B then acquires and proceeds. | Integration |
| CC-6 | **Unlock warning (H-1/L-2)** | on the PG path a `pg_advisory_unlock` throw must **not** turn a successful idempotent run into a 500 (swallow/log fix); assert `succeeded` survives an unlock rejection. | **DB-backed** (or a mocked pool that throws on unlock) |
| CC-7 | **Database connection loss** | durable lock DB unreachable in production (`NODE_ENV=production`, `EVIDENCE_DATABASE_URL` set but pool `connect` throws) → `tryAcquireJobLock` returns null → `skipped` fail-closed, **no memory fallback** for evidence jobs. | **DB-backed** (mock pool) + unit (memory-adapter branch) |
| CC-8 | **Job crash simulation** | throw inside the batch body → `runWithLock` `finally` releases the lock; a subsequent fire reacquires (extends `m9Concurrency` "released in finally"). | Integration |
| CC-9 | **Retry after lock release** | after CC-4/CC-8, the next fire acquires cleanly and completes the deferred work; no candidate lost. | Integration |

**Prod-fail-closed durable-lock cases (CC-7 and the `advisoryLockKey` determinism) mirror the three existing `m9Concurrency` "Blocker 1" tests** and must be re-asserted with the producer wired in (so wiring cannot silently reintroduce a memory fallback).

---

## 8. Deadline Plan (Gate B5 / INV-D / BF-1)

Route budget is `maxDuration = 60` (both routes); `DEFAULT_RUN_DEADLINE_MS = 300_000`. The deadline helper (G-3) and its integration are new.

| # | Case | Assertion | Tier |
|---|---|---|---|
| DL-1 | **Route budget clamp** | `effectiveJobDeadlineMs = min(configured, 60_000 − ~15_000) ≤ 45_000`. | Unit (U-6.1) |
| DL-2 | **Configured 300 s never honored on 60 s route** | configured 300_000 → clamped ≤45_000; the raw value is never used on the web-cron path. | Unit + integration |
| DL-3 | **Insufficient time prevents starting next candidate** | remaining < worst-case per-candidate → defer, do not start. | Unit (U-6.4) + integration (CI-16) |
| DL-4 | **Selected-but-not-started remains deferred/re-discoverable** | a candidate selected then deadline-deferred carries no state; next fire re-derives and processes it (INV-A/INV-S). | Integration |
| DL-5 | **Diagnostics serialization headroom** | the guard reserves headroom so response serialization + diagnostics emission always complete within budget. | Unit (U-6.5) |
| DL-6 | **Lock wait consumes budget** | the ≤1 s lock try-window is charged against the budget; the remaining budget passed to the producer already nets it out. | Integration |
| DL-7 | **Source fetch consumes budget** | M4 fetch time (bounded by concurrency/`requestBudget`) is charged; a slow-fetch stub advances the injected clock and forces deadline defer of later fixtures. | Integration |
| DL-8 | **Archive scan consumes budget** | the single bounded archive read is charged; benchmark B5 at the ceilings against representative accumulated history proves the whole route < effective deadline < 60 s. | **Performance benchmark** (Gate E) |

---

## 9. Failure-Injection Plan (Gate D)

Every §8-spec failure row → one test; each must preserve "no false result, no immutable-data corruption."

| Injection | Expected | Trace |
|---|---|---|
| Provider fetch transient failure/timeout | fixture `not_admitted`, deferred, **no evidence written**; re-classified next fire | CI-14 |
| `maxFailureRatio` exceeded | run flagged/aborted (not a silent partial day); alertable; skips excluded from ratio | new FI case |
| Missing odds (no price data) | mandatory `evidence_capture` odds record **still written** with null values; zero markets ⇒ failed capture | CI-8 variant |
| Partial write mid-batch (crash after N of M) | N committed (each with odds); re-fire completes remainder, no duplicate | CI-17 |
| Duplicate candidate (same fixture twice / re-fire) | idempotent no-op (`already_exists` / `no_change`); in-batch de-dup | CI-7, SI-12, CI-20 |
| Corrupt archive line (snapshot/odds/validation) | strict read throws → defer + surface; **never** treated as empty history | CI-6, SI-17, U-1.6 |
| `immutable_violation` (same id, diff hash) | run `failed` + `immutable_violation`; never blind-retried; flagged P0 (signals a determinism bug in production) | CI-15 variant |
| `write_failed` (transient store error) | run `failed` + `write_failed`; idempotent re-fire | CI-15, SI-16 |
| Durable lock unavailable (no `EVIDENCE_DATABASE_URL` in prod) | `skipped` fail-closed (activation gate, not a defect) | CC-7 |
| `pg_advisory_unlock` rejection | successful run not misreported as 500 (H-1 fix) | CC-6 |
| Settlement of an unrelated fixture | C3 `fixtureMismatch`, rejected | SI-11 |
| Clock/nondeterminism leak into a candidate | forbidden — determinism tests + a static `Date.now`/`Math.random` guard under `lib/evidence-capture/candidates/` and the Stage-2 adapter | U-10.5/U-11.4 + static rule |

**Static determinism guard (required):** a test (or lint rule) asserting **no `Date.now` / `Math.random` / `new Date()` / `process.env` / `fs` / `fetch`** appears in the pure candidate layer and that the Stage-2 adapter reads the clock only via injected values — this is the single highest-leverage guard against R1 (idempotency/replay break at the boundary M10 owns).

---

## 10. Diagnostic Reconciliation Plan (Gate A11 / §10)

The `CandidateDiagnostics` fields exist today (`types.ts:104-130`): `sourceRowsDiscovered`, `sourceRowsMalformed`, `candidatesEligible`, `candidatesRejectedByReason{}`, `candidatesSelected`, `candidatesDeferredByCap`, `candidatesHealing`, `candidatesProcessed` (0 at provider stage), `backlogSize`, `oldestPendingAgeMs`, `emittedCandidates`. Stage 2 **adds** `candidatesDeferredByDeadline` and fills `candidatesProcessed` from the batch result.

**Reconciliation identities to assert (capture):**
```
sourceRowsDiscovered  = sourceRowsMalformed
                      + Σ candidatesRejectedByReason(row-grain)
                      + rowsGroupedIntoEligibleFixtures            // R3: rows→fixtures grain fix
candidatesEligible    = candidatesSelected + candidatesDeferredByCap
candidatesSelected    = emittedCandidates + derivationRejected(within selected)
candidatesSelected    = candidatesProcessed
                      + candidatesFailed
                      + candidatesDeferredByDeadline               // Stage-2 counters
backlogSize           = candidatesDeferredByCap
oldestPendingAgeMs    = age of earliest-capturedAt deferred candidate, or null when none
```
**Settlement (equivalent):**
```
sourceRowsDiscovered  = sourceRowsMalformed + Σ candidatesRejectedByReason + candidatesEligible
candidatesEligible    = candidatesSelected + candidatesDeferredByCap
candidatesSelected    = candidatesProcessed + candidatesFailed + candidatesDeferredByDeadline
backlogSize           = candidatesDeferredByCap
```
Assertions:
- DR-1 the two identities hold on every integration fire (capture + settlement) — cross-check by summing diagnostics after CI-9/CI-16, SI-14.
- DR-2 **no entity id is a metric label/reason key** (re-assert `evidence_job_outcome_total{job,outcome}` cardinality is unchanged; producer counters carry only bounded keys).
- DR-3 **R3 grain fix**: because capture `discovered` counts rows and `eligible` counts grouped fixtures, a `rowsGroupedIntoEligibleFixtures` (or per-fixture) counter must exist so the identity reconciles with **no silent loss** — a test proves `discovered` fully accounts (malformed + rejected + grouped) with zero unaccounted rows.
- DR-4 `candidatesProcessed` reconciles with the runner's `RefreshJobRecord.resultCounts` (captured+duplicate+… ) — the producer's `selected` minus deadline/derivation defers equals what the batch actually processed.

> **Exact numeric formulas are pinned once the Stage-2 shape (the two new counters + the grain counter) is implemented.** This plan fixes the *identities*; the concrete field names/values become assertions in code at implementation, per the spec's "require exact implementation-specific formulas after Stage 2 shape is known."

---

## 11. Dormancy and Activation Tests (Gate G)

| # | Case | Assertion |
|---|---|---|
| DM-1 | **Flags default off** | `isCaptureEnabled`/`isSettlementEnabled` false on unset/`""`/`"no"`/`"0"`; only `"true"`/`"1"` enable (extends `evidenceCaptureConfig`). |
| DM-2 | **Disabled job touches nothing** | flags off → `flagSkippedJob` → `skipped`/409, **no lock acquired, no archive read, no fetch, no producer run**. |
| DM-3 | **No scheduler change** | no new cron schedule authored in-repo; routes remain the only entry; `maxDuration=60` unchanged. |
| DM-4 | **No route behaviour enabled accidentally** | with flags off a bare fire is the M9 empty-pass (`succeeded`, zero counts) — identical to the pre-M10 baseline. |
| DM-5 | **Production source paths not invoked while disabled** | with flags off, `deriveCaptureInput`/M4 fetch is never called (spy asserts 0 invocations). |
| DM-6 | **Existing M9 auth behaviour unchanged** | `evaluateCronAccess` (`x-cron-secret`/`CRON_SECRET`/`ENABLE_CRON`) + rate-limit unchanged; denied → `cronDeniedResponse`; no new public surface. |
| DM-7 | **Staged activation** | capture-flag-on / settlement-flag-off runs capture only; the two independent flags + distinct locks allow empty → capture-only → capture+settlement. |
| DM-8 | **Rollback = config** | flags off / cron unscheduled reverts to dormant with no data cleanup (append-only; no delete path). |

---

## 12. Regression Suite (must stay green in the Stage-2 gate)

Run the **full suite** (`npm test`) — but the following are the **named must-not-regress anchors**, run explicitly in the Gate F step:

| Suite | Why it is a Stage-2 regression anchor |
|---|---|
| `tests/evidenceCandidateProvider.test.ts` (48) | the pure foundation Stage 2 wires; **including** the BF-S1 terminal-lifecycle cases (postponed/cancelled/abandoned eligible) — wiring must not re-exclude them |
| `tests/m9Activation.test.ts` (18) | C1–C7 (locks, dual-flag, C3/C4, C5 mandatory-odds+heal, C6, C7, frozen-invariance) — the injection seam Stage 2 fills |
| `tests/m9Concurrency.test.ts` (11) | lock serialize/distinct-key/finally-release/overlap-409/1000-cycle/no-clobber + **Blocker-1 durable-lock prod fail-closed ×3** |
| `tests/evidenceSettlement.test.ts` (34) | M8 frozen: pending-not-lost, terminal non-scored written records, corrections, no-change idempotency, C3/C4 |
| `tests/evidenceCaptureMint.test.ts` (14) | M6 full-stream idempotency + `evidenceSnapshotId` sequence |
| `tests/evidenceArchiveFileAdapter.test.ts` (9), `tests/evidenceArchive.test.ts` | strict reads (ENOENT→empty; else throw) — the property CI-6/SI-17/U-1.6 depend on |
| `tests/oddsArchive.test.ts` (15) | odds append idempotency + immutable_violation (mandatory-odds path) |
| `tests/evidenceInputIdentity.test.ts` (10) | M7 `inputContentHash`/replay — extended by A4 over M10 output |
| `tests/evidenceRouting.test.ts` (13), `tests/evidenceModel.test.ts` (15) | M4/M5 that `deriveCaptureInput` will drive |
| `tests/evidenceCaptureConfig.test.ts` (5), `tests/evidenceUpstreamConfig.test.ts` (13) | flag/limit/deadline config source of truth |

**Baseline to re-establish before the gate:** the documented full suite is **1735/1735** (post-BF-S1). Stage 2 must record a fresh baseline; the gate requires *new total = old total + new Stage-2 tests, 0 failures*, typecheck exit 0, lint clean, **and no frozen contract modified** (a diff check over `types/evidence/*`, `EvidenceArchiveStore`, `capture.ts`, `settlement.ts`, `capture-run.ts`, `settlement-run.ts`, identity/hash formulas).

---

## 13. Fixtures and Test Utilities (reusable, deterministic)

All builders live in a shared helper (e.g. `tests/_m10fixtures.ts`, non-`.test.ts` so the runner ignores it, following the existing `accaFixtures.ts` pattern). **Injected fake clock only — no wall-clock, no `Date.now`.**

| Builder | Produces | Notes |
|---|---|---|
| `fakeClock(startMs)` | `{ nowMs(), advance(ms) }` | the only time source; passed as `evaluationInstant`/`nowSec`/`nowMs`; **never** reads the system clock |
| `publishedPrediction(overrides)` | `PublishedDailyPrediction` | valid `fixtureId`/`kickoffAt`/`marketKey`/`selectionKey:"over"`/`modelProbabilityPct`; used for discovery |
| `completedRow(overrides)` | `FootyMatchRow` | `status`/`isFinished`/`listResult`/scores; variants: finished-scored, postponed, cancelled, abandoned, live, suspended, missing-score, negative-score |
| `snapshotFixture(fixtureId, capturedAt)` | archived `EvidenceSnapshot` | seed capture history; deterministic id via frozen `evidenceSnapshotId` |
| `mandatoryOddsFor(snapshot)` | `evidence_capture` odds record(s) | complete-pair seeding; omit to build a **partial pair** |
| `captureArchiveState({captured, partial})` | `CaptureArchiveState` | window keys in frozen `"<fixtureId>|<capturedAt>"` shape |
| `settlementArchiveState({captured, settled, currentOutcome})` | enriched `SettlementArchiveState` | includes current-outcome-per-fixture for correction cases (§9/U-3.3) |
| `stubDeriveCaptureInput(map)` | `CaptureProviderDeps.deriveCaptureInput` | deterministic ok/`{ok:false,reason}` per fixture; reuses `request.capturedAt` verbatim |
| `seedStore({snapshots, odds, validations})` | in-memory `EvidenceArchiveStore`+`OddsArchiveStore` | integration seeding; also a **corrupt** variant that throws on read |
| `mockPgPool({throwOnConnect?, throwOnUnlock?})` | pool double | CC-6/CC-7 DB-backed lock behaviour without a real DB |
| `lockContention(key)` | pre-acquires a lock via `tryAcquireJobLock` | CC-1/CC-2/CC-4 (`resetMemoryJobLocks` in teardown) |

Determinism rules for all fixtures: pure data, no randomness (vary by explicit index), stable ISO instants, `JOB_LOCK_ADAPTER=memory` set at suite top (as `m9Activation.test.ts` does), `resetJobLog()`/`resetMemoryJobLocks()` between cases.

---

## 14. Gate A–G Matrix

| Gate | Scope | Contents | Pass criteria |
|---|---|---|---|
| **A — Static/Unit** | offline, pure, injected clock | §4 U-1…U-11; A1–A11 spec traces; static determinism guard (no `Date.now`/`Math.random`/`fetch`/`fs`/`env` in the pure layer) | every unit deterministic on repeated runs; A1–A11 each mapped to a green test; typecheck exit 0; lint clean |
| **B — Integration** | wired runner + seeded stores + stubbed fetch | §5 CI-1…CI-20, §6 SI-1…SI-18; B1–B7 traces | discovery/read inside lock (CI-1/CI-2); N snapshots each with 1 mandatory odds record, idempotent re-fire (CI-8/CI-20); correct terminal settlements incl. postponed/cancelled/abandoned + corrections (SI-3…SI-6/SI-13); empty/again-safe = M9 baseline (CI-20) |
| **C — Concurrency** | lock contention, multi-worker | §7 CC-1…CC-9 | single-writer per key; distinct keys parallel; loser 409 never 500; loser did no discovery; finally-release; durable-lock prod fail-closed (no memory fallback) |
| **D — Failure injection** | §9 matrix | transient/corrupt/write_failed/immutable_violation/mismatch/missing-odds/crash-replay | every injection → defined recovery; **no false WIN/LOSS/VOID/PUSH**; no duplicate mint; no immutable-data corruption; corrupt read → defer, never empty history |
| **E — Performance benchmark** | ceiling-sized run vs representative archive depth | capture at effective ceiling + settlement at effective ceiling against ~representative accumulated NDJSON | whole route completes within **effective job deadline ≤ 45 s** (hence < 60 s); per-fixture cost + deadline sub-budget documented; file-adapter boundary + Postgres escape-hatch restated |
| **F — Full regression** | whole suite | §12 anchors + `npm test` | new total = baseline + new tests, **0 failures**; typecheck exit 0; lint clean; **no frozen contract modified** (diff gate) |
| **G — Dormancy/scope** | flags-off posture | §11 DM-1…DM-8 | flags default-off; disabled job acquires no lock / reads nothing / fetches nothing; M9 auth+empty-pass unchanged; rollback = config; no scheduler authored |

A milestone-stage is **DONE for Stage 2** only when **A, B, C, D, F, G are green and E is recorded** with numbers inside budget.

---

## 15. Blocking Test Requirements (must exist before Stage 2 is signable)

These are the tests without which a Stage-2 sign-off is **not** defensible — each guards a defect class that wiring specifically introduces and that Stage-1 pure tests cannot reach:

1. **B-T1 — Discovery/read/selection inside the durable lock** (CI-1/CI-2, CC-1): proves INV-L; without it, two workers can double-fetch and drift accounting.
2. **B-T2 — Multi-worker overlap safe** (CC-1…CC-4): loser returns 409 (never 500), does no discovery, no duplicate mint/revision (Gate B6).
3. **B-T3 — Crash/replay without candidate loss** (CI-17/CI-18/CI-12): N committed, remainder re-derived from the archive, no duplicate, no permanent skip (Gate B7 / INV-A/INV-S).
4. **B-T4 — Strict-read-or-defer** (CI-6/SI-17/U-1.6): a corrupt archive line **fails the read**, the job defers, and **never** proceeds on empty history (the duplicate-mint trap).
5. **B-T5 — Ceiling fail-safe binding** (U-7.3/CI-9…CI-11/SI-14): `500`/invalid config can **never** produce an effective ceiling above 150 or unbounded work (INV-C / H-2 / H-3).
6. **B-T6 — Deadline below route budget + defer guard** (U-6/DL-1…DL-4/CI-16): 300 s never honoured; insufficient-remaining defers before starting; benchmark E proves fit (INV-D / BF-1).
7. **B-T7 — No false settlement result** (SI-9…SI-11/SI-18): missing/mismatched/malformed/in-play/corrupt inputs never settle.
8. **B-T8 — Determinism/no-clock static guard + byte-identical assembly** (U-10.5/U-11.4): idempotency/replay integrity at the producer boundary (R1).
9. **B-T9 — BF-S1 regression** (SI-4…SI-6 + provider cases): postponed/cancelled/abandoned remain settleable end-to-end after wiring.
10. **B-T10 — Diagnostic reconciliation with no silent loss** (DR-1…DR-4): `discovered` fully accounts for malformed + rejected + grouped + selected/deferred/processed.
11. **B-T11 — Dormancy** (DM-1…DM-6): flags-off does no work and preserves M9 auth/empty-pass.
12. **B-T12 — Frozen-contract diff gate** (Gate F): mechanical proof M10 modified no frozen surface.

---

## 16. Final Recommendation

**Test-readiness verdict:** the Stage-1 foundation is correct, pure, and green, and its one blocker (BF-S1) is resolved — but **Stage 2 is a materially different (stateful, concurrent, deadline-bounded, archive-reading) surface whose dominant risks are entirely unverified today.** Stage 2 must not be signed off against Stage-1's pure tests; it needs the concurrency (Gate C), failure-injection (Gate D), deadline/benchmark (B5/Gate E), and archive-state/replay (B-T3/B-T4) suites specified here.

**Critical missing tests (highest leverage):** discovery-inside-lock (B-T1), multi-worker overlap 409-not-500 (B-T2), crash/replay-no-loss (B-T3), strict-read-or-defer (B-T4), ceiling fail-safe (B-T5), deadline-below-budget + defer guard (B-T6), no-false-result sweep (B-T7), determinism/no-clock guard (B-T8).

**Concurrency/failure tests required (non-negotiable):** CC-1…CC-9 (single-writer, distinct-key parallel, fail-closed durable lock incl. the three Blocker-1 prod cases, unlock-500 H-1 fix, crash-in-finally, retry-after-release) and the full §9 failure matrix (transient fetch → deferred; corrupt line → defer never empty; write_failed/immutable_violation → failed; mismatch → C3; missing odds → null-valued mandatory record; crash → idempotent completion).

**Exact validation gate proposal:** a Stage-2 build is accepted only when **Gate A + B + C + D + F + G are green and Gate E is recorded within budget**, i.e.: all A1–A11 unit traces green; B1–B7 integration traces green (incl. B6 overlap, B7 crash/replay); CC-1…CC-9 green; the §9 failure matrix green with no false result; the B5 benchmark shows a ceiling-sized capture run **and** a ceiling-sized settlement run completing within the **≤45 s effective deadline** against representative archive depth; the full suite green at `baseline(1735)+new, 0 failures`; typecheck exit 0; lint clean; the frozen-contract diff gate clean; and dormancy (flags-off) preserved. BF-1…BF-4 must be explicitly closed by their traces (INV-D deadline, INV-C ceilings, INV-L discovery-in-lock, INV-S ordering + `oldest_pending_age`/`backlog` counters + capacity activation gate) and INV-A proven (archive-derived progress, no cursor).

**May Stage 2 implementation begin after Stage 1 approval?** **Yes, in the staged manner the architecture review §23 prescribes — with a test-first condition.** Stage-1 approval (BF-S1 resolved, suite green) unblocks Stage-2 **capture** wiring provided the Gate C (concurrency) and Gate D (failure-injection) harnesses in §7/§9 and the archive-state/deadline unit scaffolding (U-1, U-6) are authored alongside the wiring (test-first for the concurrency/lock/deadline/strict-read properties, which are the ones wiring endangers). **Stage-2 settlement wiring may proceed on the same test-first basis** now that BF-S1 is resolved; the correction path (U-3.3/U-9/SI-13) additionally requires the enriched `SettlementArchiveState` (impl-review §16/R6) and must not ship without SI-13. No frozen contract, identity, hash, revision, archive format, flag default, or schedule may change to make any gate pass — a gate that cannot be met without such a change is escalated, not worked around.

**Confirmation:** the **only** file created by this task is `docs/plans/m10-stage-2-test-verification-plan.md`. No test, runtime code, contract, feature flag, cron schedule, environment, database, archive, deployment configuration, or existing document was created or modified. All cited types, functions, fields, counts, and `file:line`/config references were read from the current repository.
