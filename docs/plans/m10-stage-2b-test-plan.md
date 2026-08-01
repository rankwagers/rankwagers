# M10 Stage 2B — Test Plan (Locked-Discovery Orchestration & Live Wiring)

**Document type:** Test-planning deliverable (review-only). **No runtime code, test, contract, flag, cron route, schedule, environment, database, archive, deployment configuration, or existing document is created or modified by this plan.** It specifies the `unit`, `integration`, `failure`, `replay`, and `deadline` tests Stage 2B must ship.
**Date:** 2026-07-30
**Author role:** Test Architecture Reviewer, Sprint 23B / M10 Stage 2B.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1); `docs/plans/m10-stage-2-locked-discovery-architecture-plan.md` (§5/§16 module map, §6 INV-L, §13 INV-D, §17 required tests); `docs/plans/m10-stage-2a-archive-normalization.md` + `…-2a-implementation-review.md` (APPROVED; §9 asymmetries, §recs 1–4 carry-forward); `docs/plans/m10-stage-2-test-verification-plan.md` (the broad Stage-2 plan this refines for 2B); `docs/plans/m10-stage-1-candidate-provider-{foundation,implementation-review}.md` (Stage 1 APPROVED); the Phase 2.7 DoD.
**Code inspected to ground the plan:** `lib/evidence-capture/candidates/{capture-provider,settlement-provider,eligibility,limits,ordering,diagnostics,types,index}.ts`; `lib/evidence-capture/candidates/archive-state/{types,normalize,builders,index}.ts`; `lib/jobs/{runner,locks,cronHandler,diagnostics,types}.ts`; `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts`; `lib/evidence-capture/{config,source}.ts`; `lib/evidence-capture/routing/*`; `lib/evidence-capture/model/derive.ts`; `lib/evidence-capture/capture/{capture,mandatory-odds}.ts`; `lib/evidence-capture/jobs/{capture-run,settlement-run}.ts`; `lib/archive/evidence/file.ts`; `lib/evidence-capture/odds-archive/file.ts`.

---

## 1. Executive Summary & Verdict

**Stage 2A is built, dormant, and green** (25 unit tests; full suite **1760/1760**; typecheck/lint clean; STAGE 2A IMPLEMENTATION APPROVED). It delivered the pure, injected-port archive-state layer (`buildCaptureArchiveState`/`buildSettlementArchiveState` + normalizers + `ArchiveStateConflictError`). **Stage 2B is the remaining, unbuilt orchestration/wiring** — verified absent (`discovery.ts`, `derive-adapter.ts`, `deadline.ts`, `wiring.ts` MISSING; no `discover`/`deadline`/`runLive*` symbols in runner/batch/routes).

Stage 2B is where M10 first becomes **live**: it reads source + archive **inside the durable lock**, runs real M4 fetch + M5 derivation behind Stage 1's injected `deriveCaptureInput`, enforces the sub-route deadline (INV-D), and feeds the frozen M6/M8 batches — with flags still default-off. That makes Stage 2B's verification burden dominated by exactly the five axes requested: **unit** (pure new modules: deadline math, derive-adapter, concrete strict port, discovery composition), **integration** (discovery-under-lock → runner → archive), **failure** (fail-closed on corrupt reads / fetch faults / lock loss), **replay** (determinism, idempotency, crash-recovery, no-cursor), and **deadline** (300 s clamped below the 60 s route; defer-not-overrun).

**Test-readiness verdict:** **Stage 2B implementation may begin (Stage 2A APPROVED, entry conditions met), but is NOT signable without the five suites below authored test-first.** The properties Stage 2B introduces — discovery-inside-lock, strict-read-or-defer through a *concrete* port, deadline-below-budget, and byte-stable replay over live-derived candidates — cannot be reached by Stage 1/2A pure tests and are the exact defect classes wiring introduces. This plan is that scaffolding.

---

## 2. Stage 2B Scope Under Test (built vs. unbuilt)

| Module (planned `lib/evidence-capture/candidates/…` unless noted) | State | Test axis owner |
|---|---|---|
| `archive-state/{builders,normalize,types}.ts` (Stage 2A) | **BUILT** — consumed as-is | regression only |
| **Concrete strict read-port** (backs `EvidenceArchiveReadPort`: `readAllSnapshots/readAllOddsRecords/readAllValidations`, over the frozen file adapters) | **unbuilt** | unit + failure |
| `deadline.ts` (`effectiveJobDeadlineMs(config, evalMs)`, `remainingMs(...)`) | **unbuilt** | unit + deadline |
| `derive-adapter.ts` (`createCaptureDeriveInput(deps, config)` = M4 fetch/admission + M5 derive behind Stage 1 `deriveCaptureInput`) | **unbuilt** | unit + failure + replay |
| `discovery.ts` (`discoverCaptureCandidates`, `discoverSettlementCandidates`: source → 2A archive-state → Stage 1 provider → bounded `{candidates, diagnostics}`) | **unbuilt** | unit + integration |
| `wiring.ts` (`runLiveCaptureJob`, `runLiveSettlementJob`) | **unbuilt** | integration |
| `lib/jobs/runner.ts` — optional `discover?` seam inside `runWithLock`, single `evalInstant` read, merged diagnostics | **unbuilt (modify)** | integration + replay |
| `lib/evidence-capture/jobs/{capture-run,settlement-run}.ts` — optional `deadline` guard + `deferredByDeadline` count (additive; frozen M6/M8 core untouched) | **unbuilt (modify)** | unit + deadline |
| `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts` — one-line `runLive*Job()` | **unbuilt (modify)** | integration |

**Frozen, must remain unmodified (assert in Gate/regression):** `types/evidence/*`, `EvidenceArchiveStore`/`OddsArchiveStore` interfaces, `captureEvidenceSnapshot`/`ensureMandatoryCaptureOdds`/`settleSnapshot`/`settleLatestSnapshotForFixture`/`outcomes.ts`, identity/hash/revision formulas, archive formats, `config.ts` defaults (500/300000 are **clamped at the call site**, never edited), `locks.ts`, `cronHandler.ts`, flag defaults.

---

## 3. Carry-forward Test Obligations (from Stage 2A review + locked-discovery plan)

These are **binding** for Stage 2B's test pass:

- **CF-1 (2A rec 4 / INV-L):** the concrete strict port must reuse the already-strict frozen adapter reads, keep **one bounded read per store per run**, and be invoked **inside the durable lock**. → unit (single-read call-count, strict throw) + integration (inside-lock probe).
- **CF-2 (2A rec 2 / §9 asymmetries):** close the Stage 2A coverage asymmetries — add the settlement-path **snapshot-only** (captured-but-unsettled) end-to-end case and the capture-path partial/orphan pairing that 2A unit tests only touched at the normalizer grain. → integration.
- **CF-3 (2A rec 3 / spec R1):** a **determinism static rule/test** — no `Date.now`/`Math.random`/`new Date()`/`process.env`/`fs`/`fetch` under `candidates/` (incl. `derive-adapter.ts`) except the single `evalInstant` clock read taken in the runner. → failure/static.
- **CF-4 (2A rec 1):** `orphanOddsWindowKeys` stays **observability-only** — discovery's skip/heal decision must ignore it (a test proves an orphan-odds window is treated as "no snapshot" → capture proceeds idempotently, never skipped/healed off it).
- **CF-5 (locked-discovery §12 / R5):** corrections are **Stage 3-deferred**; Stage 2B is **first-settle only**. Tests must assert Stage 2B never sets `correctionCause` and an already-terminal fixture is `already_settled`/`no_change` (no false correction, no `invalid_input`).

---

## 4. Unit-Test Plan (Gate A — offline, pure, injected clock)

New suite suggestion: `tests/evidenceCandidateDiscovery.test.ts` (matches locked-discovery §16). All units: no wall clock, injected `evalInstant`/`nowMs`, repeat-run determinism (`deepEqual` twice).

### U-A `deadline.ts` (INV-D)
- U-A1 `effectiveJobDeadlineMs(configured=300_000)` → `min(300_000, 60_000 − 15_000)` = **≤45_000** (300 s clamped, never honoured on web-cron).
- U-A2 `effectiveJobDeadlineMs(configured=20_000)` → 20_000 (honours a smaller configured value).
- U-A3 invalid/zero/negative/`NaN`/non-number configured → fail-safe bounded target (never unbounded, never 300 s).
- U-A4 `remainingMs(startMs, nowMs, deadlineMs)` is a pure function of injected values; monotone; ≥0 clamp.
- U-A5 guard `shouldStartNext(remaining, worstCasePerCandidate)` → `proceed`/`defer`; reserves explicit headroom for **diagnostics emission + response serialization** (a candidate is not started if only serialization headroom remains).

### U-B `derive-adapter.ts` — `createCaptureDeriveInput` (stubbed M4 fetcher + real/pure M5)
- U-B1 **`capturedAt` reused verbatim** — output derivation reuses `request.capturedAt`; never recomputes/clocks it (feeds `evidenceSnapshotId`/`captureId`).
- U-B2 `modelInput.fixtureId === request.fixtureId` on success; a mismatch is impossible-by-construction or maps to `source_correspondence_failure`.
- U-B3 M4 admission failure (transient/timeout/integrity) → `{ok:false, reason:"not_admitted"}` (deferred, not persisted).
- U-B4 M5 omits all markets (no baseline) → `{ok:false, reason:"no_scorable_markets"}`.
- U-B5 missing/invalid odds → `missing_odds`/`invalid_odds` (faithfully surfaced from the dep, per Stage 1 §11).
- U-B6 provenance (`providerRecord`/`competitionId`/`seasonId`/`operatorAvailability`/`bestOddsSnapshot`) attached when present; `modelVersion` omitted unless configured (never invented).
- U-B7 **no clock / no random** in the adapter path (CF-3); given fixed stub outputs, output is byte-identical across calls.
- U-B8 registry safety: produced markets are §2.B members, `selectionKey==="over"`; no `market_void`/`excluded` synthesis.

### U-C Concrete strict read-port (CF-1)
- U-C1 `readAllSnapshots/readAllOddsRecords/readAllValidations` return the **whole** archive (not per-fixture filtered); shape matches the frozen record types.
- U-C2 **strict reads**: `ENOENT` → `[]`; malformed NDJSON line / `EACCES`/`EPERM`/`EIO`/`EBUSY` → **throw** (never empty). Mirrors `lib/archive/evidence/file.ts` semantics at the port boundary.
- U-C3 **single bounded read per store per run** — spy asserts each `readAll*` invokes the underlying file read exactly once; no per-fixture rescan (PB-1 / no O(F²)).
- U-C4 adapter-neutral: the port depends only on injected readers, embeds no file-path/offset identity (Postgres-safe).

### U-D `discovery.ts` composition (pure over injected source + 2A builders + Stage 1 provider)
- U-D1 `dateFrom(evalInstant)` deterministic (UTC date from the single evalInstant); documented midnight-boundary behaviour (Q1) asserted, not special-cased.
- U-D2 source rows + `buildCaptureArchiveState(port)` → `buildCaptureCandidates(input, deps)` wiring produces `{candidates: CaptureRequest[], diagnostics}`; symmetric for settlement.
- U-D3 **bounded selection** = `normalizeBatchLimit(config.maxCandidates)` (default **100**, clamp **150**, invalid→100); the raw `DEFAULT_CAPTURE_MAX_FIXTURES=500` can **never** be the effective ceiling.
- U-D4 deterministic: same `(seeded source, seeded stores/port, evalInstant, config)` → byte-identical candidate arrays; **shuffled source rows → identical output** (INV-S ordering: `capturedAt` asc / `completionInstant` asc, tie-break `fixtureId`).
- U-D5 **CF-4**: an `orphanOddsWindowKeys` window is treated as "no snapshot" → capture proceeds (idempotent), never skipped/healed off the orphan.
- U-D6 **CF-5**: a fixture in `settledFixtureIds` → `already_settled`, no candidate, `correctionCause` never set.

### U-E Diagnostics merge helper (locked-discovery §14)
- U-E1 flattens the nested `candidatesRejectedByReason` to `rejected_<reason>` over the **closed** `CAPTURE_REJECTION_REASONS`/`SETTLEMENT_REJECTION_REASONS` (fixed cardinality).
- U-E2 adds `deferred_by_deadline` (batch guard) and `processed` (batch result); `candidatesProcessed` no longer forced 0 once merged.
- U-E3 **no entity id** (`fixtureId`/`matchId`/`captureId`/`predictionId`) appears as a key/label.
- U-E4 reconciliation identities hold (see §8): `eligible = selected + deferred_by_cap`; `selected = processed + failed + deferred_by_deadline`; `backlog = deferred_by_cap`.

### U-F Batch `deadline` guard (additive to `capture-run.ts`/`settlement-run.ts`)
- U-F1 with a `deadline: () => remainingMs` that returns < per-candidate estimate before candidate k → loop **breaks**, candidates k..N counted `deferredByDeadline`, 1..k-1 processed.
- U-F2 frozen `captureEvidenceSnapshot`/`settleSnapshot` are **not** called for deferred candidates (guard sits in the M9 orchestrator, not the frozen core).
- U-F3 no `deadline` param (undefined) → behaviour identical to today (empty-pass preserved; back-compat).
- U-F4 empty candidate array → guard never trips; `succeeded` zero-count.

---

## 5. Integration-Test Plan (Gate B — wired runner + seeded stores + stubbed fetch)

Harness: seed in-memory `EvidenceArchiveStore`+`OddsArchiveStore` (or the concrete port over a temp NDJSON dir for CF-1/round-trip), inject a deterministic stubbed `deriveCaptureInput`, `JOB_LOCK_ADAPTER=memory`, flags on **in-test only**. Drive `runLiveCaptureJob()`/`runLiveSettlementJob()` (or the runner with the `discover` seam). Assert archive contents, `RefreshJobRecord`, merged `resultCounts`, HTTP status.

| # | Case | Assertion |
|---|---|---|
| IN-1 | **Discovery inside the lock (INV-L)** | a probe/spy proves `loadPublishedDailyPredictions` and the archive `readAll*` fire **only after** `tryAcquireJobLock` returns held; nothing reads source/archive before the lock. |
| IN-2 | **Single bounded read under lock** | each store read once per run (CF-1/PB-1), inside the lock. |
| IN-3 | **End-to-end capture (B1)** | N eligible → N snapshots, each with exactly one mandatory `evidence_capture` odds record; idempotent re-fire (no duplicates). |
| IN-4 | **Complete pair skipped** | seeded complete pair → `already_captured`, zero new writes. |
| IN-5 | **Partial pair healed** | seeded snapshot w/o mandatory odds → `already_exists` + odds appended (`oddsAppended≥1`), no new snapshot id. |
| IN-6 | **Orphan-odds window (CF-4)** | seeded odds-only window → snapshot minted deterministically, odds idempotent `duplicate`, one complete pair, no dup. |
| IN-7 | **End-to-end settlement — scored (B2)** | finished+valid scores → won/lost written; re-fire `no_change`. |
| IN-8 | **Settlement — snapshot-only pending (CF-2)** | captured, not terminal → `fixture_not_complete`, no write. |
| IN-9 | **Settlement — lifecycle terminals** | postponed/cancelled/abandoned → **written** `fixture_postponed`/`_cancelled`/`_abandoned` records (BF-S1 regression guard, end-to-end). |
| IN-10 | **Empty/again-safe (B3)** | no eligible → `succeeded` zero-count = M9 baseline; all-already-captured → no writes. |
| IN-11 | **Cap wired** | 130 eligible, default → 100 selected + 30 `deferred_by_cap`, 100 snapshots; config 500 → effective 150; config 0/NaN → 100. |
| IN-12 | **Route wiring unchanged shape** | `POST` route calls `runLive*Job()`; `evaluateCronAccess` (x-cron-secret/ENABLE_CRON) + rate-limit + status map (failed→500, skipped→409, else 200) unchanged. |
| IN-13 | **Disabled flag = no work** | flag off → `flagSkippedJob` → 409, **no lock, no discovery, no fetch, no read** (spies at 0). |
| IN-14 | **Merged diagnostics** | provider `CandidateDiagnostics` + batch counts merged into one flat low-cardinality `resultCounts`; `getEvidenceJobDiagnostics` surfaces it; reason map flattened to closed keys. |
| IN-15 | **Concrete port round-trip (CF-1)** | port backed by a real temp NDJSON dir → archive-state derived correctly end-to-end, strict reads honoured. |
| IN-16 | **Multi-worker overlap (B6)** | two concurrent fires → one runs, other `skipped/lock_unavailable`/**409 (never 500)**; loser did **no** discovery/fetch; no duplicate mint / no divergent backlog. |

---

## 6. Failure-Test Plan (Gate D — injection; preserve "no false result, no corruption")

| # | Injection | Expected | Anchor |
|---|---|---|---|
| FA-1 | Transient M4 fetch failure/timeout | fixture `not_admitted`, deferred, **no evidence written**; other fixtures captured; re-classified next fire | U-B3, IN-3 |
| FA-2 | `maxFailureRatio` exceeded | run flagged/aborted (not a silent partial day); alertable; skips excluded from ratio | new |
| FA-3 | **Corrupt archive line** (snapshots/odds/validations) | concrete port **throws** → 2A builder rejects (never empty) → run `failed`/fixture deferred + alert; **no duplicate mint, no false pending** | U-C2, CF-1 |
| FA-4 | `ArchiveStateConflictError` (same id, divergent hash on disk) | surfaces through the builder → run `failed`/alert, **never swallowed/collapsed** | 2A normalize |
| FA-5 | Batch `write_failed` (transient store error) | run `failed` + `write_failed`; idempotent re-fire settles/captures once | capture-run/settlement-run |
| FA-6 | `immutable_violation` (same id, diff hash at append) | run `failed` + `immutable_violation`; never blind-retried; flagged P0 (signals a producer determinism bug) | frozen mapping |
| FA-7 | `deriveCaptureInput` throws for one fixture | isolated per-fixture (counted `writeFailed`/reason), batch continues | U-B, per-candidate isolation |
| FA-8 | Durable lock DB unreachable in prod (`NODE_ENV=production`, no/`memory` `EVIDENCE_DATABASE_URL`) | `tryAcquireJobLock`→null → `skipped` fail-closed, **no memory fallback** for evidence jobs | locks.ts, m9Concurrency Blocker-1 |
| FA-9 | Discovery/source load throws | run `failed`, **no partial writes**, lock released in `finally`; next fire clean | runner seam |
| FA-10 | Diagnostics emission throws | **must NOT fail the job** (best-effort wrap; log + continue) | locked-discovery §14 |
| FA-11 | Settlement fixture mismatch (C3) / bad score (C4) via wiring | still rejected (`fixtureMismatch`/`invalidScore`) before any settle — guards intact through the new wiring | settlement-run |
| FA-12 | **Determinism static guard (CF-3)** | no `Date.now`/`Math.random`/`new Date()`/`process.env`/`fs`/`fetch` under `candidates/` (incl. `derive-adapter.ts`) except the single runner `evalInstant` read | static test/lint |

**Dominant failure property (assert as a sweep):** across {corrupt read, conflict, transient fetch, missing score, mismatch, in-play, stale, partial-pair} — the pipeline yields only defer/reject/`pending`/`failed`, **never** a false WIN/LOSS/VOID/PUSH and **never** a duplicate immutable record.

---

## 7. Replay-Test Plan (Gate A4 + determinism/idempotency/no-cursor)

| # | Case | Assertion |
|---|---|---|
| RE-1 | **A4 serialization-boundary replay over M10 output** | extend the M7 replay test (`evidenceInputIdentity.test.ts`) across M10-discovered captures: serialize → re-read → re-derive under the **original `modelVersion`** → byte-identical Evidence Inputs + `contentHash`. |
| RE-2 | **Identity independent of `evalInstant`** | two runs at different `evalInstant` but same kickoff → identical `capturedAt`/`captureId`/`snapshotId` (identity derives from kickoff, not the decision clock — locked-discovery §6). |
| RE-3 | **Discovery determinism** | same `(seeded source, seeded stores, evalInstant, config)` → byte-identical candidate arrays; shuffled source → identical. |
| RE-4 | **Idempotent re-fire** | full-success run re-fired → all `already_captured`/`already_settled`, zero new writes (= M9 empty-pass). |
| RE-5 | **Crash/replay, no candidate loss (B7)** | interrupt after N of M candidates → N committed (each with mandatory odds); re-fire re-derives pending from the archive and completes M−N with **no duplicates, no permanent skip**. |
| RE-6 | **Process restart (INV-A)** | fresh store + provider + port instances (no in-memory carryover) recompute identical pending work from the durable archive alone. |
| RE-7 | **Settlement byte-stability** | `completionInstant = ISO(row.kickoff)` deterministic → re-fire → M8 `no_change` (no gratuitous revision). |
| RE-8 | **No-cursor static assertion (INV-A)** | after any run, no cursor/offset/checkpoint file or process-local authoritative progress exists; grep-guard + behavioural (a second fresh process reproduces the same selection). |

---

## 8. Deadline-Test Plan (Gate B5 / INV-D)

Route budget `maxDuration = 60` (both routes); `DEFAULT_RUN_DEADLINE_MS = 300_000` (`config.ts`) — 5× the route, must be clamped.

| # | Case | Assertion | Tier |
|---|---|---|---|
| DL-1 | Route-budget clamp | `effectiveJobDeadlineMs = min(configured, 60_000 − ~15_000) ≤ 45_000` | Unit (U-A1) |
| DL-2 | 300 s never honoured on the 60 s route | configured 300_000 → clamped ≤45_000; raw value never used on web-cron | Unit + integration |
| DL-3 | Clamped deadline flows into M4 | the **clamped** deadline (not 300 s) is passed into `orchestrateFetches` budget/clock; a slow-fetch stub advancing the injected clock defers later fixtures | Integration |
| DL-4 | Mid-batch defer, not overrun | injected clock advances so remaining < per-candidate estimate before candidate k → k..N `deferred_by_deadline`, 1..k-1 committed, run `succeeded` | Integration (U-F1) |
| DL-5 | Selected-but-not-started re-discoverable | a deadline-deferred candidate carries no state → next fire re-derives and processes it (INV-A/INV-S) | Integration + replay |
| DL-6 | Serialization/diagnostics headroom | guard reserves headroom so response serialization + diagnostics always complete within budget | Unit (U-A5) |
| DL-7 | Phase charging | lock-wait (≤1 s try-window), source fetch, single archive scan each charged against the effective deadline | Integration |
| DL-8 | **B5 benchmark** | capture at the effective cap **and** settlement at the effective cap, against representative accumulated NDJSON depth, each complete within **≤45 s** (hence < 60 s); per-fixture cost + sub-budget documented; file-adapter boundary + Postgres escape-hatch restated | **Performance benchmark** |

---

## 9. Fixtures & Test Utilities (deterministic; injected fake clock, no wall-clock)

Shared helper (non-`.test.ts`, e.g. `tests/_m10stage2bFixtures.ts`, following `accaFixtures.ts`):

| Builder | Produces | Notes |
|---|---|---|
| `fakeClock(startMs)` | `{ nowMs(), advance(ms) }` | the **only** time source; feeds `evalInstant`/`nowSec`/deadline `remainingMs`; never reads the system clock |
| `publishedPrediction(overrides)` | `PublishedDailyPrediction` | valid `fixtureId`/`kickoffAt`/`marketKey`/`selectionKey:"over"`; discovery input |
| `completedRow(overrides)` | `FootyMatchRow` | variants: finished-scored, postponed, cancelled, abandoned, live, suspended, missing-score, negative/fractional score |
| `stubDeriveCaptureInput(map)` | `CaptureProviderDeps["deriveCaptureInput"]` | deterministic ok/`{ok:false,reason}` per fixture; reuses `request.capturedAt` verbatim; no clock |
| `stubFetcher(map)` + `stubModel` | M4/M5 doubles behind `createCaptureDeriveInput` | inject transient-failure / all-omitted-markets / missing-odds cases |
| `memoryReadPort({snapshots,odds,validations})` | `EvidenceArchiveReadPort` | whole-archive doubles for unit; `throwOn:"snapshots"|"odds"|"validations"` variant for FA-3/FA-4 |
| `fileReadPort(tempDir)` | concrete strict port over real NDJSON | CF-1/IN-15 round-trip; corrupt-line variant for FA-3 |
| `seedStore(...)` | in-memory `EvidenceArchiveStore`+`OddsArchiveStore` | integration seeding; complete/partial/orphan pair variants |
| `mockPgPool({throwOnConnect?, throwOnUnlock?})` | pool double | FA-8 fail-closed + H-1 unlock-not-500 |
| `lockContention(key)` | pre-acquire via `tryAcquireJobLock` | IN-16 overlap (`resetMemoryJobLocks` teardown) |

Rules for every fixture: pure data, no randomness (vary by explicit index), stable ISO instants, `JOB_LOCK_ADAPTER=memory` at suite top, `resetJobLog()`/`resetMemoryJobLocks()` between cases.

---

## 10. Gate / Exit Criteria (binary, per requested axis)

| Axis | Contents | Pass criteria |
|---|---|---|
| **Unit** | §4 U-A…U-F | every unit deterministic on repeat; `deadline`/`derive-adapter`/port/discovery/merge/guard each green; CF-3 static guard green; typecheck exit 0; lint clean |
| **Integration** | §5 IN-1…IN-16 | discovery+reads **inside the lock** (IN-1/IN-2); N snapshots each with one mandatory odds, idempotent (IN-3); terminals written (IN-9); empty-pass = M9 baseline (IN-10); routes/auth/status unchanged (IN-12/IN-13); overlap 409-not-500 (IN-16) |
| **Failure** | §6 FA-1…FA-12 | each injection → defined fail-closed recovery; corrupt read → defer/`failed`, **never empty, never dup mint**; lock loss → `skipped` fail-closed no memory fallback; diagnostics best-effort; **no false WIN/LOSS/VOID/PUSH** |
| **Replay** | §7 RE-1…RE-8 | A4 byte-identical over M10 output; identity independent of `evalInstant`; crash/replay no loss; restart recomputes from archive; no cursor artifact |
| **Deadline** | §8 DL-1…DL-8 | 300 s clamped ≤45 s; clamped deadline flows to M4; mid-batch **defers, never overruns**; B5 benchmark recorded within budget |

**Stage 2B is signable only when Unit + Integration + Failure + Replay are green, Deadline (incl. the B5 benchmark) is recorded within budget, the full suite is `baseline(1760)+new, 0 failures`, typecheck exit 0, lint clean, and the frozen-contract diff gate is clean.** BF-1…BF-4 must be closed by trace (INV-D deadline, INV-C ceilings, INV-L discovery-in-lock, INV-S ordering + `backlog`/`oldest_pending_age`), and INV-A (archive-derived, no cursor) proven.

---

## 11. Blocking Test Requirements (no sign-off without these)

1. **B-T1 — Discovery + reads inside the durable lock** (IN-1/IN-2/CF-1): the core INV-L guarantee wiring can silently break.
2. **B-T2 — Strict-read-or-defer through the concrete port** (U-C2/FA-3/FA-4): corrupt read → throw → defer/`failed`, **never empty history** (the duplicate-mint / false-pending trap).
3. **B-T3 — Deadline clamp + defer, not overrun** (U-A1/DL-1…DL-4/B5): 300 s never honoured on the 60 s route; insufficient remaining defers before starting.
4. **B-T4 — Multi-worker overlap 409-not-500** (IN-16): loser does no discovery; no duplicate mint.
5. **B-T5 — Crash/replay + A4 replay** (RE-1/RE-5/RE-6): byte-identical live output; no candidate loss; no cursor.
6. **B-T6 — derive-adapter fidelity** (U-B1…U-B8): `capturedAt` reuse, fixtureId match, failure→reason mapping, no clock — the seam that most endangers identity/replay.
7. **B-T7 — Ceiling fail-safe wired** (U-D3/IN-11): 500/invalid config can never produce an effective ceiling above 150 or unbounded work.
8. **B-T8 — Dormancy** (IN-13): flags-off does no work; M9 auth + empty-pass preserved.
9. **B-T9 — Determinism static guard (CF-3)** and **BF-S1 terminal-settlement regression (IN-9)**.

---

## 12. Regression Anchors (must stay green in the Stage 2B gate)

Full `npm test`, with these named must-not-regress suites run explicitly: `tests/evidenceArchiveStateBuilders.test.ts` (25, Stage 2A), `tests/evidenceCandidateProvider.test.ts` (48, incl. BF-S1 terminals), `tests/m9Activation.test.ts` (18, C1–C7), `tests/m9Concurrency.test.ts` (11, incl. Blocker-1 fail-closed ×3), `tests/evidenceSettlement.test.ts` (34), `tests/evidenceCaptureMint.test.ts` (14), `tests/evidenceArchiveFileAdapter.test.ts` (9, strict reads), `tests/oddsArchive.test.ts` (15), `tests/evidenceInputIdentity.test.ts` (10, M7 replay — extended by RE-1), `tests/evidenceRouting.test.ts` (13) + `tests/evidenceModel.test.ts` (15) (M4/M5 behind the adapter), `tests/evidenceCaptureConfig.test.ts` (5) + `tests/evidenceUpstreamConfig.test.ts` (13). **Baseline to re-establish:** full suite **1760/1760**; gate requires `new total = 1760 + new Stage-2B tests, 0 failures`, typecheck exit 0, lint clean, **no frozen contract modified** (diff gate over the §2 frozen list).

---

## 13. Final Recommendation & Scope Confirmation

**Test-readiness:** Stage 2B may be implemented (Stage 2A APPROVED; entry conditions and the pure substrate are green), **but must be built test-first for the concurrency/lock, strict-read, deadline, and replay properties** — these are the ones live wiring endangers and that Stage 1/2A pure suites cannot reach. Author the **Unit** (§4) and **Deadline** (§8 unit rows) suites alongside `deadline.ts`/`derive-adapter.ts`/port/`discovery.ts`; then the **Integration** (§5), **Failure** (§6), and **Replay** (§7) suites as the runner `discover` seam, `wiring.ts`, and the two route edits land. Do not sign Stage 2B until the §10 gate is fully green and the §11 blocking tests exist. No frozen contract, identity, hash, revision, archive format, flag default, or schedule may change to pass a gate — escalate instead.

**Confirmation:** the **only** file created by this task is `docs/plans/m10-stage-2b-test-plan.md`. No runtime code, test, contract, feature flag, cron route, schedule, environment, database, archive, deployment configuration, or existing document was created or modified. All cited types, functions, fields, counts, and `file:line`/config references were read from the current repository.
