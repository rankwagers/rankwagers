# M10 — Live Candidate Pipeline — Independent Architecture Review

**Review type:** Architecture review only (no implementation, no runtime/test/contract/flag/schedule/deploy change).
**Date:** 2026-07-30
**Reviewer:** Independent Architecture Reviewer, Sprint 23B / M10.
**Specification under review:** `docs/architecture/m10-live-candidate-pipeline-specification.md`
**Closure template:** `docs/plans/sprint-23b-m10-closure.md`
**Upstream closure:** `docs/plans/sprint-23b-m9-closure.md`
**Method:** Every claim below was verified directly against the current repository (file:line cited). Prior conversational summaries and the specification's own claims were treated as unverified until checked in source.

---

## 1. Executive Verdict

**M10 ARCHITECTURE CONDITIONALLY APPROVED.**

The specification proposes the correct shape — a **producer-only** layer that turns the published daily-list into the two typed candidate collections the M9 runners already accept, routing into the already-built, already-safe M4→M8 consumers without touching a single frozen contract. I verified the consumer safety net M10 depends on is real and present in code: the mandatory snapshot+odds pairing (C5), the pre-settlement fixture-correspondence (C3) and score-sanity (C4) gates, full-stream capture idempotency, revision-aware settlement idempotency, strict fail-loud archive reads, and cross-process fail-closed durable locks. Because M10 routes into these, **no proposed transition can, by construction, produce candidate loss, a false settlement, a duplicate identity mint, or a frozen-contract violation** — provided the conditions below are bound.

It is **not** APPROVED outright because the specification leaves four architecturally load-bearing decisions underspecified, one of which is a concrete numeric contradiction in the current repository:

- **The default run deadline (300 000 ms) exceeds the cron route budget (`maxDuration = 60`).** Left unbound, a live-fetch producer run can exceed the 60 s route/event-loop budget. (Blocking finding **BF-1**.)
- The spec never states **on which side of the durable lock candidate discovery executes** (BF-2).
- The spec treats the **batch ceilings (≤~150) as recommendations, not binding config**, while the live default is `DEFAULT_CAPTURE_MAX_FIXTURES = 500` and settlement has no bound at all (BF-3).
- The spec's anti-starvation story (**`expired_window`** ordering + cadence capacity) is prose, not a binding invariant (BF-4).

None of these is unresolvable and none requires touching a frozen contract; all are specification amendments plus test/config bindings. Hence **CONDITIONALLY APPROVED**, with implementation permitted to begin against the amended spec.

---

## 2. Files Inspected

**Specification / plans**
- `docs/architecture/m10-live-candidate-pipeline-specification.md`
- `docs/plans/sprint-23b-m10-closure.md`
- `docs/plans/sprint-23b-m9-closure.md`
- `docs/architecture/sprint-23b-implementation-contract.md`, `phase-2-7-definition-of-done.md`, `phase-2-7-implementation-plan.md`, `m0-configuration-decisions.md` (scope/contract cross-check)
- M9 review corpus referenced from the closure matrix (`m9-activation-{architecture,implementation,production,performance,failure,migration}-review.md`)

**Runtime source (verified)**
- `lib/jobs/runner.ts` — `runEvidenceCaptureJob`/`runPredictionSettlementJob`, `runWithLock`, `flagSkippedJob`, `emitOutcomeMetrics`
- `lib/jobs/cronHandler.ts` — access → rate-limit → run → status-code mapping
- `lib/jobs/locks.ts` — `tryAcquireJobLock`, durable/`EVIDENCE_DATABASE_URL` binding, fail-closed
- `app/api/internal/cron/evidence-capture/route.ts`, `app/api/internal/cron/prediction-settlement/route.ts` (`maxDuration = 60`)
- `lib/evidence-capture/config.ts` — flags, `DEFAULT_CAPTURE_MAX_FIXTURES = 500`, M0 upstream config (`runDeadlineMs`, TTLs, `retryLimit`, `requestBudget`, `maxFailureRatio`, `maxSourceAgeMs`, `staleFallbackAllowed`)
- `lib/evidence-capture/source.ts` — `PublishedDailyPrediction`, `loadPublishedDailyPredictions`, `normalizeDailyArchive`
- `lib/evidence-capture/routing/{sources.ts,orchestrator.ts,admission.ts,index.ts}` — `buildFetchPlan`, `orchestrateFetches`, `admitProviderArchive` (injected `nowMs`, no `Date.now`)
- `lib/evidence-capture/model/derive.ts` — `FixtureModelInput`, `MarketInput`, `deriveEvidenceModel`
- `lib/evidence-capture/capture/capture.ts` — `CaptureRequest`, `captureEvidenceSnapshot` (full-stream idempotency, fail-closed validation)
- `lib/evidence-capture/capture/canonical.ts` — `normalizeInstant`, order-independent sorts
- `lib/evidence-capture/capture/mandatory-odds.ts` — `captureIdentityFromSnapshot`, `ensureMandatoryCaptureOdds`
- `lib/evidence-capture/jobs/capture-run.ts` — `runCaptureBatch` (C5 healing, fail vocabulary)
- `lib/evidence-capture/jobs/settlement-run.ts` — `SettlementCandidate`, `runSettlementBatch`, C3/C4 gates, `hasValidCompletedScores`
- `lib/evidence-capture/settlement.ts` — `settleSnapshot`/`settleLatestSnapshotForFixture`, R1–R7
- `lib/evidence-capture/input-identity/{identity.ts,version.ts,index.ts}` — `inputContentHash`, `evidenceInputVersion`
- `lib/evidence/integrity.ts` (`verifyEvidenceChain`), `lib/validation/integrity.ts` (`verifyValidationChain`), `lib/evidence/identifiers.ts` (`evidenceSnapshotId`)
- `lib/archive/evidence/file.ts` — strict NDJSON reads (ENOENT→empty; malformed/I/O→throw)

**Tests (present, relevant)**
- `tests/evidenceCaptureMint.test.ts`, `evidenceSettlement.test.ts`, `evidenceRouting.test.ts`, `evidenceModel.test.ts`, `evidenceCaptureSource.test.ts`, `evidenceInputIdentity.test.ts`, `evidenceArchiveFileAdapter.test.ts`, `evidenceArchive.test.ts`, `evidenceCaptureConfig.test.ts`, `evidenceUpstreamConfig.test.ts`, `evidenceCaptureM1.test.ts`, `sprint18aIntegrity.test.ts`

---

## 3. Authoritative Scope

Confirmed against `phase-2-7-implementation-plan.md` (formally enumerates M0–M9) and the M9 closure §9 (explicit M10 boundary). M10's authoritative charter:

**Inside M10:** discovery from `loadPublishedDailyPredictions`; a pure eligibility classifier; live M4 fetch/admission for capture candidates; live M5 derivation; `CaptureRequest[]`/`SettlementCandidate[]` assembly; bounded batching; wiring the producer into the two existing cron routes (replacing the empty `?? []` calls); producer-stage observability; the M10 tests/benchmarks/reviews.

**Outside M10 (verified as correctly excluded by the spec §2.2):** any frozen-contract change; enabling flags; authoring an external scheduler; Postgres activation/cutover; ops gates (alerting, `EVIDENCE_DATABASE_URL` provisioning, scheduled `verifyEvidenceChain` sweep, backup, retention, ownership); historical backfill; Acca/combo evidence, `market_void`/`excluded` synthesis. No scope leakage of ops or Postgres work into M10 was found (see §15).

---

## 4. Current Repository Boundary

Verified inert boundary:

- Both runners accept an optional injected candidate array and default to empty: `runCaptureBatch(deps, options?.candidates ?? [])` (`runner.ts:296`) and `runSettlementBatch(deps, options?.candidates ?? [])` (`runner.ts:332`).
- Both cron routes call the runner with **no argument** (`route.ts` → `runEvidenceCaptureJob()` / `runPredictionSettlementJob()`), so a bare fire is a correct empty pass.
- Flags are read fail-closed and default off (`config.ts` `readFlag` → "true"/"1" only; `isCaptureEnabled`/`isSettlementEnabled`). A disabled job returns `flagSkippedJob(...)` → `skipped` → HTTP 409, acquiring no lock and touching no store (`runner.ts` `flagSkippedJob`).
- Routes carry `export const maxDuration = 60` — the binding route budget.
- **No cursor/checkpoint/pagination/offset state exists anywhere** under `lib/evidence-capture`, `lib/jobs`, or `lib/archive/evidence` (grep returned nothing). M10 therefore starts from a clean slate on state — and must keep it that way (§14).

M10's job is exactly to replace the two `()` call-sites with bounded, deterministic candidate arrays produced by a new provider — nothing else changes at this boundary.

---

## 5. Recommended Architecture

**Question 1 (ownership boundary): Option C — a dedicated candidate-provider layer injected into the job runners — is the correct and recommended architecture.** The other two options fail on verifiable grounds:

- **A (derivation inside cron routes):** the route is HTTP glue (`handleCronPost`); putting M4 fetch + M5 derivation there couples business logic to the request surface, defeats offline/replay invocation, and would run discovery *outside* the durable lock (the lock is acquired inside `runWithLock`), inviting duplicate provider fetches between overlapping fires. Rejected.
- **B (derivation inside the existing runners):** `runCaptureBatch`/`runSettlementBatch` are deliberately pure sequencers over injected candidates (`capture-run.ts` header: "Candidates are INJECTED … this orchestrator stays a pure sequencer"). Folding discovery into them destroys their unit-testability and blurs producer/consumer failure isolation. Rejected.
- **C (injected provider):** a `CandidateProvider` module (e.g. `lib/evidence-capture/candidates/`) exposing pure/deterministic `buildCaptureCandidates(...)` and `buildSettlementCandidates(...)`, invoked by `runEvidenceCaptureJob`/`runPredictionSettlementJob` **after lock acquisition** and passed into the existing runner batch. This preserves separation of concerns, keeps the classifier a pure total function (unit-testable without I/O), keeps routes trivial, isolates producer failures from consumer failures, and is Postgres-neutral (it consumes typed inputs, embeds no storage identity). **Recommended.**

**Evaluation summary (Option C):** separation ✓ · deterministic replay ✓ (classifier + assembly pure; consumers already replay-stable) · unit-testability ✓ (pure functions) · integration-testability ✓ (inject provider + stubbed fetch into runner) · cron-route simplicity ✓ (unchanged one-liners) · Postgres compatibility ✓ (typed-input coupling only) · failure isolation ✓ (provider defers; consumer reports) · observability ✓ (producer feeds the same counter) · offline/replay ✓ (provider callable with injected `evalInstant`).

**Binding placement decision (answers Q8): discovery and eligibility classification MUST run *inside* the durable lock**, within `runWithLock`, before the batch — so archive-derived classification (`already_captured`/`already_settled`) is consistent with the writes the same run will make, and two workers cannot both fetch/derive the same window. This is safe even though idempotency would tolerate the alternative; running under the lock removes wasted provider spend and TOCTOU classification drift. This must become an explicit spec invariant (BF-2 / C14).

---

## 6. Capture Candidate Lifecycle

Trace verified end-to-end; ownership / determinism / rejection / error / no-silent-drop / no-duplicate-mint annotated.

| Transition | Owner | Deterministic identity | Rejection (observable) | Error behaviour | Silent drop? | Dup mint? |
|---|---|---|---|---|---|---|
| source → predictions | `loadPublishedDailyPredictions` (`source.ts`) | fixtureId = numeric matchId; pure `normalizeDailyArchive` | malformed rows already dropped upstream in `mapDailyListsToQualifiedFixtures` | missing date → `[]` | **Gap:** upstream drops are not counted here → must be surfaced by producer (see §9) | n/a |
| predictions → fetch plan | M4 `buildFetchPlan` (`routing/sources.ts:73`) | TTL decision from injected `nowMs` (no `Date.now`) | `skip_fresh` within TTL | — | no | n/a |
| fetch plan → fetched rows | M4 `orchestrateFetches` (`routing/orchestrator.ts:79`) | injected monotonic clock | transient fail → retry ≤ `retryLimit` | deferred, not persisted | no (counted `not_admitted`) | n/a |
| rows → admission | `admitProviderArchive` (`routing/admission.ts:31`) | content-hash provenance | integrity failure rejects | returns fail-closed | no | n/a |
| admission → eligibility | **M10 (new)** classifier | pure fn of (fixture, evalInstant, lead, archiveState) | every §9 reason counted | — | **must not** | n/a |
| eligibility → M5 derivation | `deriveEvidenceModel` (`derive.ts:293`) | pure; omitted markets dropped (no fabricated baseline) | all-omitted → `no_scorable_markets` | — | no | n/a |
| derivation → `CaptureRequest` | **M10 (new)** assembly | `capturedAt = ISO(kickoff − lead·60000)`, computed once | invalid fixtureId/instant re-validated by capture | — | no | n/a |
| `CaptureRequest[]` → runner | `runCaptureBatch` (`capture-run.ts`) | — | frozen result vocabulary → counts | never throws; per-candidate isolation | no | **no** |
| runner → snapshot | `captureEvidenceSnapshot` (`capture.ts`) | `evidenceSnapshotId(fixtureId,capturedAt,sequence)`; full-stream pre-check finds existing by `(capturedAt, capturedBy)` | `not_admitted`/`invalid_input`/`derivation_failed` | `archive_error` on read/append throw | no | **no** — existing window returns `already_exists` |
| snapshot → mandatory odds | `ensureMandatoryCaptureOdds` (`mandatory-odds.ts`) | `captureId = cap_+hash(fixtureId‖"fixtureId|capturedAt")` | zero-odds ⇒ failed capture (DoD 5) | odds write fail ⇒ `writeFailed`/`immutable_violation` | no | **no** — unique per `(captureId,market,selection,source)` |
| → diagnostics | `emitOutcomeMetrics` (`runner.ts`) | — | per-outcome counters | — | no | n/a |

**Findings:** every consumer transition has defined ownership, deterministic identity, explicit rejection and error behaviour, and is duplicate-safe. The only producer-owned obligations are (a) the pure classifier, (b) the deterministic `capturedAt`, and (c) **counting the upstream/eligibility drops so nothing is silently lost** (observability gap, §9/§15). `capturedAt` computation does not yet exist in the repo — it is new M10 code and is the single most identity-critical line (feeds `evidenceSnapshotId` and `captureId`); it must be a pure function of `(kickoff, leadMinutes)` with no clock (A2/A3).

---

## 7. Settlement Candidate Lifecycle

Trace verified; the "no false result" property is the strongest part of the existing substrate.

| Transition | Owner | Guard verified |
|---|---|---|
| captured evidence → completed fixture | **M10** classifier | snapshot must exist (else `notFound` downstream) |
| completed fixture → final score | source `FootyMatchRow` | — |
| final score → fixture correspondence | `runSettlementBatch` **C3** (`settlement-run.ts`) | `row.matchId !== fixtureId` ⇒ `fixtureMismatch`, **before any store touch** |
| → score sanity | **C4** `hasValidCompletedScores` | FT (and HT when present) must be non-negative integers, else `invalidScore`, **before settlement** |
| → `SettlementCandidate` | **M10** assembly | `completionInstant`/`nowSec` must be source-derived, never a clock |
| → bounded batch → runner | `runSettlementBatch` | never throws; per-candidate isolation |
| → WIN/LOSS/VOID/PUSH or non-settlement | `settleSnapshot`/`resolveMatchLifecycle`/`outcomes.ts` | **R3: missing HT/FT ⇒ pending (no write), never `lost`**; `resolveMatchLifecycle` always called with explicit `nowSec` (R1) |
| → validation archive | frozen validation store | revision-aware idempotent append; unchanged outcome ⇒ `no_change`; `immutable_violation` surfaced, never swallowed |
| → diagnostics | `emitOutcomeMetrics` | per-outcome counts |

**Verified: no incomplete / stale / in-play / malformed / mismatched / corrupt / partially-read input can yield a false result.** In-play or missing scores resolve to `pending` (no write); a mismatched row is rejected by C3; garbage scores by C4; a corrupt archive line throws in `file.ts` (surfaced, not read as empty); a partial prior write is absorbed by revision idempotency. The one **producer** obligation is that M10 must derive `completionInstant`/`nowSec` deterministically from the terminal source (not a clock) so re-fires are byte-stable and only genuine corrections append (C3-producer / C8).

---

## 8. Identity and Replay Model

Full chain verified in code:

```
provider/source identity   → content-hash provenance (admission), inputContentHash (M7)
fixture/match identity      → fixtureId = numeric matchId (source.ts)
input identity              → inputContentHash = "iih_"+hash({evidenceInputVersion, providerContentHash, sorted odds}) (input-identity/identity.ts) — EXCLUDES modelVersion
input version               → evidenceInputVersion (version.ts), fail-closed on unsupported
captureId                   → "cap_"+hash(fixtureId ‖ "fixtureId|capturedAt") (mandatory-odds.ts + identity)
snapshot identity           → evidenceSnapshotId(fixtureId, capturedAt, sequence) (identifiers.ts:27)
odds-record identity        → unique (captureId, marketKey, selectionKey, source)
prediction identity         → the snapshot subject (per market/selection)
settlement/validation id    → validationId(snapshotId, marketKey, selectionKey) + validationRevisionId(validationId, revision)
```

- **Deterministic reconstruction:** ✓ — `captureId` and `inputContentHash` are pure re-derivations (`verifyBinding` recomputes and compares, `identity.ts:141+`); `verifyEvidenceChain`/`verifyValidationChain` re-derive ids and hashes to *state, not assume* integrity.
- **Replay stability:** ✓ — `inputContentHash` excludes `modelVersion`, so model evolution does not disturb input identity; `canonical.ts` imposes order-independent sorts + normalized instants so equivalent inputs hash identically.
- **Collision behaviour:** distinct windows → distinct `capturedAt` → distinct `captureId` and `snapshotId`; snapshot id additionally binds `sequence`.
- **Duplicates / partial prior writes / crash-retry:** full-stream pre-check (`capture.ts`) returns `already_exists` for a re-captured window; settlement re-append of an unchanged outcome ⇒ `no_change`; both are idempotent across batching and pagination because identity is content/coordinate-derived, **not** batch-position-derived.
- **Missing identity boundary:** none blocking. One **nuance to pin in the spec**: `snapshotId` binds `sequence = latest.sequence + 1` (archive-state-dependent), whereas `captureId` is window-keyed (sequence-free). Both are deterministic *given the fixture's archive history*; M10 must therefore **capture strictly forward** (spec already forbids back-dating, §6.3), so sequence assignment stays monotonic with `capturedAt` and replay reproduces identical sequences. This is satisfied by the forward-only design but should be stated as an explicit invariant.

**Producer replay obligation:** A4 — the M7 serialization-boundary replay test must be extended to run over M10-produced captures. This is a required test, not yet present.

---

## 9. Eligibility and Rejection Rules

The spec's classifier (§6) is architecturally sound: a pure total function `classify(fixture, evalInstant, leadMinutes, archiveState) → decision`. Each rule maps to a real, verified downstream behaviour:

| Rule | Verified basis | Determinism / observability requirement |
|---|---|---|
| supported competitions / markets | daily-list `marketKey`/`selectionKey` are closed-set (`markets.ts`) | A5 registry-safety test |
| pre-match-only capture | `capturedAt ≤ evalInstant < kickoff` | pure; counted `not_yet` before, `expired_window` after |
| stale fixtures | M0 `maxSourceAgeMs` (24 h), `staleFallbackAllowed=false` | deferred `not_admitted`, never captured on stale data |
| missing kickoff | must be an invalid/absent `kickoffAt` | **spec must define** → reject `ineligible` (currently implicit) |
| missing provider row | M4 admission fails | `not_admitted`, deferred |
| missing/invalid odds | mandatory odds still written with null values (`buildOddsRecord` EVIDENCE_CAPTURE branch) | capture succeeds with null-valued record; **zero markets ⇒ no odds ⇒ failed capture** |
| malformed source data | dropped in `mapDailyListsToQualifiedFixtures` | **must be counted** by producer (currently invisible) |
| fixture correspondence | settlement C3 (`settlement-run.ts`) | `fixtureMismatch` |
| completed-match detection | `resolveMatchLifecycle` terminal | pure with injected `nowSec` |
| postponed/cancelled/abandoned | lifecycle-terminal states | VOID/appropriate state, not false loss |
| duplicate candidates | full-stream pre-check / revision idempotency | no-op; producer SHOULD also de-dup in-batch |
| already-captured / already-settled | archive-derived | pre-filtered to avoid guaranteed no-ops |
| partial snapshot/odds pair | C5 healing re-ensures odds even on `already_exists` (`capture-run.ts`) | self-healing |
| corrupt archive read | `file.ts` throws on malformed NDJSON | **must defer + alert, never treat as empty history** (else risk duplicate mint) |

**Requirement:** every rejection must be deterministic and counted. Two rules need explicit spec text: **missing/invalid kickoff** (reject class) and **counting upstream-dropped malformed rows** so "discovered vs eligible vs rejected" reconciles with no silent loss.

---

## 10. Pagination, Cursoring, and Checkpointing

This is the axis the task flags hardest, and my finding diverges from a naive reading in M10's favour — with one binding condition.

- **There is no cursor to lose.** Grep confirms zero cursor/checkpoint/offset state in the codebase. The spec (§7.2) proposes **no durable cursor**: the immutable archive itself is the checkpoint — `already_captured`/`already_settled` are *derived* from it each run, and idempotency makes any re-fire safe. This is the **archive-derived / stateless-recomputed** state model, which is exactly what a correct production design should use; it is strictly stronger than a process-local cursor (the thing the task forbids).
- **Stable sort key / tie-break:** the spec names `(capturedAt, fixtureId)`. This must be made a **binding invariant with ascending `capturedAt`** — earliest-opening window first — because that is precisely the ordering that minimises `expired_window` loss under a backlog (BF-4 / C15).
- **Crash between page processing and "cursor advancement":** not applicable — there is no advancement step to be lost. A crash after N of M captures leaves N committed (each with mandatory odds); the next fire re-derives eligibility and completes the rest. Verified idempotent (`capture.ts` full-stream pre-check; `settlement.ts` revision idempotency).
- **No starvation:** captured fixtures leave the eligible set (become `already_captured`), so the set drains; ascending-`capturedAt` ordering guarantees the soonest-to-expire are served first. **Permanent loss is possible only via `expired_window`** if `cadence × ceiling < arrival_rate` — a capacity-planning constraint, not a design flaw. Must be stated as a binding capacity invariant (C15).
- **Late-arriving candidates / fixture updates during pagination:** handled by re-derivation next fire; no stale cursor to invalidate.
- **Backlog larger than one run:** drained across successive fires deterministically.

**Verdict on this axis:** the design **cannot skip a candidate permanently** except via the explicitly-modelled `expired_window`, which is bounded by cadence and made visible by a counter. Acceptable, conditional on C15 (ordering + capacity as binding invariants and an `oldest-pending-age` metric). **Reject any future drift toward a process-local authoritative cursor** (§14).

---

## 11. Batching and Timeout Budget

Verified numbers and one contradiction:

- Route budget: `maxDuration = 60` (both routes).
- `DEFAULT_CAPTURE_MAX_FIXTURES = 500` (`config.ts:40`) — the M9 perf review measured this as **exceeding** the 60 s budget against ~1 MB history (capture ≈100 s at 500). Settlement ≈49 s at 500; ~85–97 ms/fixture.
- **`DEFAULT_RUN_DEADLINE_MS = 300_000` (5 min) > route `maxDuration` (60 s).** If the producer's live M4 fetch is allowed to run to `runDeadlineMs` under the lock inside the route, the route blows its budget. This is the concrete **BF-1** contradiction.
- No settlement maximum exists (capture has `maxFixtures`; settlement has none) — **BF-3**.

**Required design (binding):** capture ceiling ≤ ~150 and a **symmetric settlement ceiling ≤ ~150**, both as enforced config (not prose); one bounded archive read per run (classify in memory, avoiding the O(F²) NDJSON amplification); and an **effective per-run deadline bound below the route budget** for the web-cron path (or an explicit decision to move cron off the web process). Static caps are acceptable initially; adaptive caps are future work. With these bounds, a single fire provably stays inside 60 s under the expected tens–low-hundreds/day load. **Lock-wait** already returns 409 within a 1 s try-window (`locks.ts`), so overlap never blocks the budget.

---

## 12. Concurrency and Locking

Verified against `locks.ts` / `runner.ts`:

- **Distinct durable lock keys:** `job:evidence_capture` vs `job:prediction_settlement` (`runWithLock` composes `job:${jobType}`) — never shared.
- **Durable binding:** capture/settlement set `requireDurable`, binding the advisory lock to `EVIDENCE_DATABASE_URL` (`locks.ts`).
- **Fail-closed:** no URL / `JOB_LOCK_ADAPTER=memory` / unreachable pool **in production ⇒ returns `null` ⇒ skipped run** — never a per-process memory fallback for evidence jobs. Verified.
- **Cursor advancement race:** none — no cursor (see §10); two workers cannot diverge cursor/archive/diagnostics because progress is archive-derived and writes are idempotent.
- **Overlapping pages:** a second fire hits the lock and 409s; even if discovery ran unlocked, idempotency prevents double mint.
- **Unlock failure:** `release()` awaits `pg_advisory_unlock` in `runWithLock`'s `finally`; a throw there can surface a successful idempotent job as HTTP 500 (**H-1 carry-forward, low severity**) — it cannot corrupt state (the lock auto-releases on connection close).

**Answer to Q8 (which side of the lock):** discovery + classification **inside** the lock (see §5). This is a required spec amendment (**C14 / BF-2**); today's routes call the runner with no candidates, so the question is unanswered in-repo and must be pinned before implementation.

---

## 13. Failure and Recovery Matrix

| Failure | Job status | Cursor advances | Retry safe | Duplicate work OK | Operator action |
|---|---|---|---|---|---|
| source provider unavailable | succeeded (fewer eligible) | n/a | yes | yes (idempotent) | none |
| source timeout | succeeded/deferred | n/a | yes | yes | none |
| malformed provider response | `not_admitted` (deferred) | n/a | yes | yes | none |
| partial source response | `not_admitted` for missing | n/a | yes | yes | none |
| archive read permission failure | `archive_error` → run continues per-candidate; **must defer fixture** | n/a | yes | no dup mint | investigate perms |
| malformed NDJSON | throws in `file.ts` → surfaced | n/a | after repair | no | **investigate corruption** |
| lock DB unavailable | `skipped` (fail-closed, 409) | n/a | yes | none | provision `EVIDENCE_DATABASE_URL` |
| lock contention | `skipped` (409) | n/a | yes | none | none (staggered cadence) |
| crash before processing | nothing written | n/a | yes | yes | none |
| crash during processing | N committed, rest deferred | n/a (re-derive) | yes | yes | none |
| crash after append, before "commit" | **N/A — no commit step**; archive is the record | n/a | yes | **no dup** (pre-check) | none |
| "cursor write failure" | **N/A — no cursor** | n/a | yes | yes | none |
| partial snapshot/odds pair | C5 healing re-ensures odds next run | n/a | yes | no | none |
| settlement write failure | `writeFailed` → run `failed` | n/a | yes (idempotent) | no | alert + re-fire |
| diagnostics failure | must not fail the job (best-effort) | n/a | yes | yes | none |
| unlock failure | possible false 500 (H-1) | n/a | yes | no | swallow/log fix |
| scheduler retry / repeated identical invocation | idempotent no-op / `already_exists`/`no_change` | n/a | yes | yes | none |

**Conclusion:** every failure has a defined, state-preserving recovery; none produces a false result or corrupts immutable data. The matrix is materially simplified by the **no-cursor** design — several "crash between X and cursor commit" rows collapse to N/A. Two producer obligations: treat an archive **read error as defer** (never empty history), and keep diagnostics best-effort.

---

## 14. State Management

**M10 must be stateless with respect to progress; the immutable archive is the sole authoritative checkpoint.** Verified there is no existing cursor state to build on, and the consumers make progress *derivable* (full-stream pre-check, latest-snapshot, current-revision reads). Ranking of the options for candidate progress:

- process-local — **rejected** (task constraint; would diverge across workers/restarts).
- filesystem cursor / DB-backed cursor — unnecessary and a new failure surface; would also introduce a Postgres-coupling temptation. Avoid.
- **archive-derived / recomputed — recommended and sufficient.** Survives process restart and multiple workers by construction: any worker re-derives the same eligibility from the same immutable archive, and idempotency makes concurrent/repeated work safe.

The only permissible process-local state is **ephemeral last-run diagnostics counts** (already the pattern in `getEvidenceJobDiagnostics`), explicitly non-authoritative and reset on restart.

---

## 15. Observability

Verified baseline: `emitOutcomeMetrics` emits `evidence_job_outcome_total{job,outcome}` with **no per-entity labels** (`runner.ts`) — correct cardinality discipline. M10 must extend this without regressing it. Coverage assessment against the task list:

- Covered by extending the existing counter with producer outcomes: candidates eligible (capture/settle), rejected-by-reason (each §9 reason), truncated-by-cap, capture/settlement outcomes, lock skips, source/archive failures, job duration (`refresh_job_duration_ms`).
- **Currently missing / must be added by M10:** **source rows discovered vs eligible** (so upstream drops reconcile — the §6/§9 silent-loss gap), **backlog count**, **oldest-pending-candidate age** (the `expired_window` early-warning for C15), **cursor position/freshness** → reframed as **archive-derived progress freshness** (no cursor).
- **Cardinality rule (binding):** never label with `fixtureId`/`matchId`/`captureId`/`predictionId`/provider payload ids — aggregate counts only.
- **Process-local vs durable:** last-run counts may stay process-local (diagnostics surface); **failure/alerting signals and the `verifyEvidenceChain`/`verifyValidationChain` sweep require durable/external monitoring** (out-of-repo H-4). M10 emits the signals; routing them is operational. The integrity verifiers must run as a **scheduled out-of-band sweep**, never on a per-request path.

---

## 16. Security and Activation

Verified:

- **Cron access fail-closed:** `evaluateCronAccess` gates every fire; denied → `cronDeniedResponse` (`cronHandler.ts`). M10 adds no public surface; the producer runs only inside the authenticated cron route.
- **Flags default-off, invalid ⇒ disabled:** `readFlag` accepts only "true"/"1"; anything else off (`config.ts`).
- **No auth bypass:** the producer cannot execute outside the cron route (no other caller); no public route gains pipeline access.
- **Secrets:** provider creds come from existing provider config; diagnostics are behind `requireDiagnosticsAccess`; no secret logging. M10 must preserve this.
- **Path/URL injection:** archive/cursor paths are config-derived, not request-derived; source fetches go through M4's fixed provider clients, not arbitrary URLs — M10 must not introduce a request-influenced fetch target.
- **Staged activation:** empty → capture-only (flag) → capture+settlement is supported by the two independent flags and lock keys.
- **Rollback:** flag flip; append-only archive means **no rewrite/delete** — verified (config defaults off; no delete path in the capture/settlement write path).

---

## 17. Frozen-contract Analysis

**M10 can be implemented with zero frozen-contract change.** Verified that the producer only *supplies* the existing `CaptureRequest` (`capture.ts:36`) and `SettlementCandidate` (`settlement-run.ts:34`) shapes; it needs no new field on any `types/evidence/*` record, no change to `evidenceSnapshotId`/`captureId`/`validationId` formulas, no archive-format change, no hash-input change, and no change to any M4–M9 public interface. The runners already expose an injection seam (`options.candidates`). **No proposed change violates a frozen boundary.** The A5 registry-safety gate + the "no frozen contract modified" baseline gate must guard against drift under implementation pressure (R8).

---

## 18. Future Postgres Compatibility

The candidate-provider + archive-derived-progress design is Postgres-safe:

- **No file offsets in identity** — identity is content/coordinate-derived (`evidenceSnapshotId`, `captureId`, `inputContentHash`).
- **No dependence on NDJSON line order as business identity** — `canonical.ts` imposes order-independent hashing; chain order is `sequence`, not file order.
- **No dual-write for correctness** — single append per record; idempotent.
- **No adapter coupling** — the provider consumes typed inputs and writes through the `EvidenceArchiveStore`/`OddsArchiveStore` interfaces, not the file adapter directly.
- **Rollback stays possible** — flags off; append-only.

The only Postgres-relevant caveat is performance (§11): the file adapter's O(F²) scan is why the ceilings exist; Postgres (indexed lookups) is the documented escape hatch and is correctly **out of M10 scope**. M10 must bake in no assumption that blocks the reversible cutover — satisfied by the above.

---

## 19. C1–C12 Gate Matrix

| # | Condition | Verdict | Evidence | Required correction |
|---|---|---|---|---|
| **C1** | Dedicated candidate-provider boundary | **PASS (design)** | Runners expose injection seam (`runner.ts:288,326`); `capture-run.ts` header mandates injected candidates | Implement as injected provider module (Option C), not in route/runner internals |
| **C2** | Deterministic capture candidate production | **PARTIAL** | M4/M5 inject clocks (no `Date.now`); but `capturedAt` computation is new, unwritten | Bind A2/A3: `capturedAt = ISO(kickoff − lead·60000)`, pure; determinism test |
| **C3** | Deterministic settlement candidate production | **PARTIAL** | `settlement-run.ts` requires `completionInstant`/`nowSec`; C3/C4 gates present | Producer must derive both deterministically from terminal source (no clock); test |
| **C4** | Stable identity and replay | **PASS** | `evidenceSnapshotId`/`captureId`/`inputContentHash` pure & re-derived; `verifyEvidenceChain`/`verifyValidationChain` present | Extend M7 serialization-boundary replay test over M10 output (A4) |
| **C5** | Durable cursor/checkpoint semantics | **PARTIAL** | No cursor state in repo (grep empty); archive-derived progress is the checkpoint | Spec must state: archive IS the checkpoint; no process-local authoritative cursor; ascending-`capturedAt` ordering |
| **C6** | Bounded capture & settlement batches | **FAIL (as-configured)** | `DEFAULT_CAPTURE_MAX_FIXTURES = 500` (`config.ts:40`) exceeds budget; **no** settlement bound; `runDeadlineMs 300000 > maxDuration 60000` | Bind capture & settlement ceilings ≤ ~150; bound effective deadline below route budget (BF-1/BF-3) |
| **C7** | Fail-closed source/archive/lock | **PASS** | Locks fail-closed (`locks.ts`); malformed NDJSON throws (`file.ts`); M4 defers on failure | Producer must treat archive read-error as *defer*, never empty history |
| **C8** | No false settlement result | **PASS** | C3 (`fixtureMismatch`) + C4 (`hasValidCompletedScores`) before any settle; R3 pending-not-lost; immutable violations surfaced | Preserve; failure-review B4 tests |
| **C9** | Concurrency-safe cursor advancement | **PASS (by construction)** | Distinct durable locks; no cursor; idempotent re-derivation | Discovery must run inside the lock (C14) |
| **C10** | Bounded observability cardinality | **PASS (design)** | `emitOutcomeMetrics` labels only `{job,outcome}` | Producer metrics must follow; add discovered/backlog/oldest-age counters |
| **C11** | Frozen-contract preservation | **PASS** | Producer supplies existing typed inputs; no type/identity/hash/format edit needed | A5 + "no frozen contract modified" baseline gate |
| **C12** | Reversible activation and rollback | **PASS** | Flags default-off (`config.ts`); append-only; rollback = flag flip | Preserve; production-review verifies staged activation |

**Added conditions:**

| # | Condition | Verdict | Required correction |
|---|---|---|---|
| **C13** | Effective run deadline < route budget | **FAIL (as-configured)** | Reconcile `runDeadlineMs` (300 s) with `maxDuration` (60 s) for the web-cron path; benchmark B5 proves it |
| **C14** | Discovery executes inside the durable lock | **PARTIAL (unspecified)** | Spec must pin discovery+classification inside `runWithLock`, before the batch |
| **C15** | Anti-starvation ordering + capacity | **PARTIAL (prose only)** | Make ascending-`capturedAt` ordering + `cadence×ceiling ≥ arrival` binding; add `oldest-pending-age` metric |

---

## 20. Blocking Findings

*Blocking for closure of the architecture (i.e., must be resolved in the spec before implementation is approved to proceed). None requires a frozen-contract change; none is a code defect in the existing substrate.*

- **BF-1 — Deadline exceeds route budget.** `DEFAULT_RUN_DEADLINE_MS = 300_000` vs route `maxDuration = 60`. A live-fetch producer run under the lock can exceed the 60 s route/event-loop budget. The spec must make the effective per-run deadline bind below the route budget (or move cron off the web process) and prove it with benchmark B5. (C6/C13)
- **BF-2 — Lock-side of discovery unspecified.** The spec never states whether candidate discovery runs before or after the durable lock. It must mandate **inside** the lock. (C14)
- **BF-3 — Ceilings not binding.** Capture default is 500 (over budget); settlement has no bound. Both must be bound to ≤ ~150 as enforced config, with silent-truncation forbidden (count + log). (C6)
- **BF-4 — Starvation invariant is prose.** Ascending-`capturedAt` ordering and the cadence×ceiling capacity relationship must be binding invariants with an `oldest-pending-age` metric, else a sustained backlog can permanently lose captures via `expired_window`. (C15)

---

## 21. Non-blocking Recommendations

- **N-1 — Count upstream/eligibility drops.** Surface "discovered vs eligible vs rejected-by-reason" so malformed rows dropped in `mapDailyListsToQualifiedFixtures` are not silently invisible.
- **N-2 — H-1 unlock-500.** Land the `pg_advisory_unlock` swallow/log fix so a successful idempotent job is never misreported as 500 (low severity).
- **N-3 — In-batch de-dup.** Producer should de-dup within a batch (belt-and-suspenders over consumer idempotency).
- **N-4 — Missing-kickoff rule.** Add an explicit `ineligible` classification for absent/invalid `kickoffAt`.
- **N-5 — Diagnostics best-effort.** A diagnostics failure must never fail the job.
- **N-6 — Stagger capture/settlement cadence** to avoid needless 409 churn (distinct locks already prevent corruption).

---

## 22. Required Specification Amendments

1. **State the run-deadline/route-budget binding** (BF-1/C13): effective per-run deadline < 60 s on the web-cron path; B5 benchmark mandatory.
2. **Pin discovery inside the durable lock** (BF-2/C14).
3. **Make the two ceilings binding config ≤ ~150 with no silent truncation** (BF-3/C6); add a settlement maximum symmetric to `maxFixtures`.
4. **Promote ordering + capacity to binding invariants** (BF-4/C15): ascending `capturedAt`, `(capturedAt, fixtureId)` tie-break, `oldest-pending-age` metric.
5. **Declare the archive the sole authoritative checkpoint** (C5/§14); forbid any process-local authoritative cursor.
6. **Add the discovered-vs-eligible reconciliation counters** and the missing-kickoff reject rule (N-1/N-4).
7. **Clarify the identity nuance** (§8): `snapshotId` binds `sequence` (archive-state-dependent); forward-only capture keeps it deterministic — state as an invariant.

None amends a frozen contract; all are within `docs/architecture/m10-live-candidate-pipeline-specification.md`.

---

## 23. Implementation Stage Recommendation

Staged, each stage independently green and default-off:

1. **Stage 0 — spec amendments** (§22). No code.
2. **Stage 1 — pure classifier + candidate assembly** (`lib/evidence-capture/candidates/`), fully unit-tested (A1–A3, A5–A6), zero I/O, injected `evalInstant`. No wiring.
3. **Stage 2 — provider wiring into the runners inside the lock**, bounded ceilings + deadline; integration tests B1–B4 with stubbed fetch; replay test A4.
4. **Stage 3 — observability** counters (discovered/eligible/rejected/backlog/oldest-age) at bounded cardinality.
5. **Stage 4 — benchmark B5** at the ceilings against representative history; document the file-adapter boundary.
6. **Stage 5 — six-reviewer closure**; convert `sprint-23b-m10-closure.md` from stub to record.

Flags remain default-off throughout; activation stays operational.

---

## 24. Final Verdict

**M10 ARCHITECTURE CONDITIONALLY APPROVED.**

The producer-only architecture is correct, the recommended shape (dedicated candidate-provider injected into the runners, discovery inside the durable lock) is sound, and the safety substrate it routes into (C3/C4/C5 gates, idempotency, strict reads, fail-closed locks, deterministic identity, replay verifiers) is verified present in the current repository. No transition can — by construction and by verified consumer behaviour — cause candidate loss (except explicitly-modelled, metered `expired_window`), permanent starvation (given C15), nondeterministic replay, duplicate identity minting, a false settlement result, cross-process inconsistency, unbounded work (given C6/C13), a frozen-contract violation, or irreversible activation.

Approval is **conditional on** resolving blocking findings **BF-1…BF-4** (all specification amendments, no frozen-contract change) and satisfying conditions **C1–C15** through the staged implementation and its mandatory tests/benchmarks/reviews. **Implementation may begin** at Stage 0/1 (spec amendments + the pure classifier/assembly), which carry no wiring risk; Stage 2 wiring may proceed once BF-1…BF-4 are amended into the spec.

---

## 25. Statement on this review

This is an architecture review only. The **only** file created or modified is this document (`docs/plans/m10-live-candidate-pipeline-architecture-review.md`). No runtime code, tests, contracts, feature flags, cron schedules, environment, database, archive, or deployment configuration was changed. All cited types, functions, config values, and file:line references were read from the current repository so a subsequent reviewer can independently verify them. M10 remains unbuilt and NOT eligible for closure.
