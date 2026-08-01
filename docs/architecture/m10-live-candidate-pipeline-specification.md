# M10 — Live Candidate Pipeline — Milestone Specification

### Authoritative milestone specification for Sprint 23B, Milestone M10. Governed by `sprint-23b-implementation-contract.md` (Rev 2), `phase-2-7-definition-of-done.md`, and continuing the milestone series defined in `phase-2-7-implementation-plan.md` (which formally enumerates M0–M9). This document promotes the informal "M10" forward-reference used across the M9 reviews and `sprint-23b-m9-closure.md` into a fully specified milestone of equal rigor to M1–M9.

**Status:** SPECIFICATION ONLY — no implementation code written. Awaiting explicit approval.
**Date:** 2026-07-30
**Revision:** A1 (2026-07-30) — amended to close architecture-review findings BF-1…BF-4 and the additional requirements in `docs/plans/m10-live-candidate-pipeline-architecture-review.md`. See §16 (Amendment record). No implementation, test, benchmark, or review is claimed as passed by this revision; it defines binding requirements only.

> **Binding invariants added in Rev A1** (each is a MUST; each is gated in §12 and traced in §16):
> **INV-D** — the authoritative end-to-end job deadline is strictly below the cron route budget (§7.3, BF-1).
> **INV-L** — authoritative candidate discovery/classification/ordering/selection/processing happens only inside the durable job lock (§7.1, BF-2).
> **INV-C** — capture and settlement each have a mandatory, fail-safe, observable batch ceiling; no unbounded candidate array (§7.2, BF-3).
> **INV-S** — deterministic forward-only anti-starvation ordering with archive-derived pending state and a capacity activation gate (§7.4, BF-4).
> **INV-A** — the immutable archive is the sole authoritative progress/checkpoint source; no process-local, filesystem-offset, or request-supplied cursor (§7.5).
**Predecessors:** M0–M9 (all COMPLETE, code-complete, dormant, 1687/1687 green). Repository blockers: NONE.
**Precedence:** The frozen Sprint 23 contracts (`types/evidence/*`, `lib/archive/evidence/store.ts`) and the Rev 2 implementation contract rank above this document. Nothing here amends a frozen contract; M10 is purely additive and default-off, exactly like M1–M9.

---

## 1. Purpose

M9 wired runnable capture and settlement **orchestration** (`runEvidenceCaptureJob` / `runPredictionSettlementJob`, two cron routes, diagnostics, durable locks) but deliberately left the **producer** unbuilt: both cron routes call the runners with **no candidates**, so `options?.candidates ?? []` is an empty batch (`lib/jobs/runner.ts:296,332`). A bare cron fire today is *correct but inert* — it acquires the lock, processes zero candidates, and returns `succeeded` with zero counts (measured 0.04 ms/pass, perf review §29).

**M10 exists to build the live candidate producer** — the deterministic pipeline that turns the authoritative published daily-list prediction source into the two typed candidate collections the M9 runners already accept:

- `readonly CaptureRequest[]` (`lib/evidence-capture/capture/capture.ts:36`) for `runEvidenceCaptureJob`, and
- `readonly SettlementCandidate[]` (`lib/evidence-capture/jobs/settlement-run.ts:34`) for `runPredictionSettlementJob`.

M10 is **DONE** when a scheduled, flag-gated cron fire performs a *production-useful* pass — capturing evidence for genuinely selected, eligible fixtures inside their pre-kickoff window and settling completed fixtures — under a bounded per-run work budget that provably cannot exceed the 60 s route/event-loop budget, with every M1–M9 invariant (identity, append-only, idempotency, mandatory-odds, replay determinism, axis separation) preserved and no frozen contract touched.

M10 owns the two arrows the earlier milestones left dangling: **source → eligibility → CaptureRequest** (via M4 fetch + M5 derivation) and **source → completion → SettlementCandidate**.

---

## 2. Scope

### 2.1 Inside M10

1. **Candidate discovery.** Read the authoritative published daily-list prediction source via the already-built `loadPublishedDailyPredictions` (`lib/evidence-capture/source.ts:97`, returning `PublishedDailyPrediction[]`). Enumerate selected fixtures per §1's "Selected fixture" definition (contract §1). No other source is admitted; Acca/combo selections are never captured (contract §5.5).
2. **Eligibility gate.** Decide, per fixture, whether it is a *capture* candidate now (inside its pre-kickoff window), a *settlement* candidate now (completed), or neither (§6). This is the "upstream selection gate" the contract already references.
3. **Live M4 fetch orchestration.** For capture candidates, drive the built M4 routing (`buildFetchPlan` → `orchestrateFetches`, `lib/evidence-capture/routing/`) under the M0 upstream config (concurrency, TTLs, `retryLimit`, `runDeadlineMs`, `requestBudget`, `maxFailureRatio`) to obtain normalized inputs, and admit them to the provider archive via `admitProviderArchive` (`routing/admission.ts:31`).
4. **Live M5 derivation.** Transform admitted normalized inputs into `FixtureModelInput` (`lib/evidence-capture/model/derive.ts:70`) and run the pure M5 model to obtain the per-fixture `markets[]`, `signals[]`, `evidenceScore`, `qualification`, `sampleSize`, and `supportedMarkets[]` that a `CaptureRequest.modelInput` carries.
5. **CaptureRequest assembly.** Build validated `CaptureRequest` objects (`admitted`, `fixtureId`, `capturedAt` window anchor, `modelInput`, and the optional provenance fields: `providerRecord`, `competitionId`, `seasonId`, `operatorAvailability`, `bestOddsSnapshot`, `modelVersion`).
6. **SettlementCandidate assembly.** For completed fixtures, build `SettlementCandidate` objects (`fixtureId`, `row: FootyMatchRow`, deterministic `completionInstant`, deterministic `nowSec`, optional `correctionCause`/`recordedBy`) from the source's finished rows.
7. **Bounded batching / pagination / cursoring** of both candidate sets so a single run's work stays inside the route budget (§7), including the H-2 capture ceiling (≈100–150 on the file adapter) and the new H-3 symmetric settlement ceiling.
8. **Wiring the producer into the two cron routes** (`app/api/internal/cron/evidence-capture/route.ts`, `.../prediction-settlement/route.ts`) so they pass the produced candidate arrays into the runners — replacing today's zero-argument calls. Default-off.
9. **Observability for the producer stage** (candidates discovered / eligible / rejected-by-reason / fetched / derived / omitted), feeding the existing job diagnostics and metrics surface (§10).
10. **M10 tests, benchmarks, runbook, and the six-reviewer closure** (§12, §14).

### 2.2 Explicitly outside M10

- **Any change to a frozen contract or to the M1–M9 capture/settlement/odds/identity/derivation internals.** M10 is a *producer* that feeds their existing typed inputs; it never edits `types/evidence/*`, `EvidenceArchiveStore`, `createEvidenceSnapshot`, `runCaptureBatch`, `runSettlementBatch`, the M5 model math, or the odds resolver.
- **Enabling feature flags** (`EVIDENCE_CAPTURE_ENABLED`, `EVIDENCE_SETTLEMENT_ENABLED`). They remain default-off; enabling is an out-of-repo operational action (contract §6.3).
- **Configuring external cron scheduling.** Routes live in-repo; the schedule is an operational action (contract §6.4). M10 may *recommend* a cadence but never authors a scheduler.
- **Activating a Postgres store or performing a cutover.** Postgres adapters remain selectable-but-inactive; the file NDJSON adapter is the initial store (perf/failure/migration reviews). Cutover is a later reversible env flip, not M10.
- **Deployment/ops gates:** external alerting, provisioning `EVIDENCE_DATABASE_URL`, the scheduled `verifyEvidenceChain` sweep, backup, retention operations, archive ownership (M9 closure H-4).
- **Historical backfill** of past days' fixtures (a separate, explicitly-scoped operation; M10 captures forward from activation).
- **Acca/combo evidence**, `market_void` synthesis, or `excluded` derivation (contract §5.5/§5.9/§5.10).

---

## 3. Dependencies

Every prerequisite below is already built and green except where marked operational.

| Dep | What M10 consumes from it | Location / status |
|---|---|---|
| **Source (M-source)** | `PublishedDailyPrediction[]` + `loadPublishedDailyPredictions()`; the authoritative daily-list selection set | `lib/evidence-capture/source.ts` — built |
| **M4 — source routing & fetch orchestration** | `buildFetchPlan`, `orchestrateFetches`, `SourceFetcher`, `admitProviderArchive`, per-source TTLs, `SourceRequest`/`FetchPlan` | `lib/evidence-capture/routing/` — built, dormant/pure |
| **M5 — evidence-model derivation** | `FixtureModelInput`/`MarketInput` inputs; pure derivation → `signals[]`, `evidenceScore`, per-market + fixture `qualification`, `sampleSize`, `supportedMarkets[]` | `lib/evidence-capture/model/derive.ts` — built, pure |
| **M1 — key registry + capture identity** | `marketKey`/`selectionKey` closed sets & pairings; `captureWindowKey`, `captureId` primitives | built |
| **M2 — provider archive** | append-only normalized-input retention + content-hash integrity; `ProviderArchiveRecord` | built |
| **M3 — bounded odds archive** | mandatory odds record store keyed by `captureId`; retention bound | built |
| **M6 — evidence capture** | `runCaptureBatch` + `CaptureRequest`/`CaptureResult`/`CaptureStatus`; snapshot mint; mandatory-odds record | built |
| **M7 — historical-input identity** | `inputContentHash` (excludes `modelVersion`); `evidenceInputVersion` separation; serialization-boundary replay | built |
| **M8 — settlement & validation revisions** | `runSettlementBatch` + `SettlementCandidate`/`SettlementBatchDeps`; `resolveMatchLifecycle`; revision-aware idempotent appends | built |
| **M9 — cron routes · diagnostics · locks** | `runEvidenceCaptureJob`/`runPredictionSettlementJob`; two cron routes; advisory locks (`job:evidence_capture`, `job:prediction_settlement`); `getEvidenceJobDiagnostics`; `evidence_job_outcome_total` metric | built, dormant |
| **M0 — upstream config** | `resolveEvidenceUpstreamConfig`: `globalConcurrency`, `footystatsConcurrency`, TTLs, `retryLimit`, `runDeadlineMs`, `requestBudget`, `maxFailureRatio`, `maxSourceAgeMs`, `staleFallbackAllowed` | built |
| **Operational activation** | flags flipped on, cron scheduled, `EVIDENCE_DATABASE_URL` provisioned, `verifyEvidenceChain` sweep + alerting | out-of-repo gate (not built by M10) |
| **Postgres** | selectable adapter; NOT a prerequisite for M10 merge; the file adapter is the initial store | later reversible cutover |

**Ordering rule (inherited from `phase-2-7-implementation-plan.md`):** milestones are sequential; M10 MUST NOT be started before M0–M9 are DONE — satisfied as of the M9 closure.

---

## 4. Architecture — end-to-end candidate lifecycle

M10 introduces a **producer** stage in front of the existing M9 runners. It has no persistence surface of its own beyond what M2/M3/M6/M8 already own — it *routes into* them.

### 4.0 Authoritative architecture choice — Option C (dedicated candidate-provider layer)

The architecture review evaluated three placements for candidate production and rejected (A) derivation inside cron routes and (B) derivation inside the existing job runners. **Option C is authoritative and binding for M10:**

- A **dedicated, pure candidate-provider layer** at the proposed location `lib/evidence-capture/candidates/` (name/shape is implementation detail; the *layer boundary* is binding).
- It is **injected into the existing job orchestration** (`runEvidenceCaptureJob` / `runPredictionSettlementJob`), which already expose the injection seam `options?.candidates` (`lib/jobs/runner.ts:288,326`) and delegate to pure sequencers `runCaptureBatch` / `runSettlementBatch` (which enforce no ceiling themselves — verified: both iterate `for (const … of candidates)` with no `slice`/cap, so bounding is the producer's responsibility, INV-C).
- **Cron routes remain thin** (`handleCronPost(req, () => runEvidenceCaptureJob())`) — no business logic migrates into the route surface.
- The provider is **adapter-neutral**: it consumes typed inputs and reads/writes only through the `EvidenceArchiveStore` / `OddsArchiveStore` interfaces and the M4 source/routing entry points; it embeds no file-adapter assumption (Postgres-safe, §9.4/§14 migration).
- The provider **exposes deterministic discovery/classification output** — pure functions of `(source rows, injected evalInstant, leadMinutes, archive-derived state, config)` — with archive reads and live source reads as **explicit injected dependencies**, so it is **unit-testable without cron or network** (Gate A) and integration-testable by injecting a stubbed fetch + seeded archive into the runner (Gate B).

This section fixes the boundary only; it does **not** implement it. Everything downstream of the injection seam is the frozen M6/M8 consumer surface and is not modified.

```
                         PRODUCER (new in M10)                     │      CONSUMER (built: M6/M8 via M9)
                                                                   │
  ┌─────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────┐ │  ┌───────────┐   ┌────────────┐   ┌──────────┐   ┌─────────────┐
  │ SOURCE  │──▶│ ELIGIBILITY  │──▶│  CANDIDATE   │──▶│ CAPTURE  │─┼─▶│  CAPTURE  │──▶│  SETTLEMENT │──▶│ ARCHIVE  │──▶│ DIAGNOSTICS │
  │daily-   │   │  gate        │   │  assembly    │   │ request /│ │  │  batch    │   │  batch      │   │ evidence │   │  counts +   │
  │list     │   │ (window/     │   │ (M4 fetch +  │   │ settle-  │ │  │(M6 mint + │   │(M8 revision │   │ + odds + │   │  metrics +  │
  │predict. │   │  completion/ │   │  M5 derive)  │   │ cand.)   │ │  │ mandatory │   │  aware      │   │ provider │   │  verify     │
  │(M-src)  │   │  staleness)  │   │              │   │          │ │  │ odds)     │   │  append)    │   │ archives │   │  sweep)     │
  └─────────┘   └──────────────┘   └──────────────┘   └──────────┘ │  └───────────┘   └────────────┘   └──────────┘   └─────────────┘
       │              │                    │                        │        │                │                │              │
   selected       rejected            per-fixture             injected      snapshot       validation      NDJSON        process-local
   fixtures       (reason)            CaptureRequest[]        into runner    (immutable)    revision        append-only   counters +
                                      SettlementCandidate[]   (M9)                                          (3 stores)    scheduled sweep
```

### 4.1 Transitions (each is an explicit, testable step)

1. **Source → selected fixtures.** `loadPublishedDailyPredictions(date)` → `PublishedDailyPrediction[]`. Each carries `fixtureId` (= canonical `matchId`, contract §1/§6.1), `kickoffAt` (ISO UTC), `marketKind`/`marketKey`/`selectionKey` (daily-list `selectionKey` is always `"over"`), `modelProbabilityPct`, `competitionLabel`/`leagueCode`, and `home`/`away`. Only these are eligible (contract §5.5).
2. **Selected → eligibility classification.** Pure function of `(fixtureId, kickoff, now-as-injected-instant, leadMinutes, existing archive state)`. Produces one of: `capture_now`, `settle_now`, `not_yet`, `expired_window`, `already_captured`, `already_settled`, `ineligible` (§6). Classification never reads a wall clock inside the *derivation*; the run's evaluation instant is passed in deterministically.
3. **capture_now → M4 fetch.** `buildFetchPlan(RoutingRequest)` decides `fetch` vs `skip_fresh` per source using TTLs; `orchestrateFetches` executes under concurrency/retry/deadline/budget; results are normalized and admitted via `admitProviderArchive` (content-hash + `retrievedAt` provenance). A transient provider failure is surfaced/retried, **never persisted as evidence** (contract §5.13, M4 review).
4. **Admitted inputs → M5 derivation.** Build `FixtureModelInput { fixtureId, markets: MarketInput[] }` from the admitted normalized set; run pure M5 derivation. Omitted markets (missing baseline) are dropped, never scored on a fabricated baseline (contract §4.4/§4.9-R1).
5. **Derivation → CaptureRequest.** Assemble `CaptureRequest` with `admitted:true`, validated `fixtureId`, window-anchor `capturedAt` (= `ISO(kickoffMs − leadMinutes·60000)`, contract §3), `modelInput`, and provenance fields. `capturedAt` is computed **once here at original minting**; replay re-sources it (contract §4.9-R2) — M10 never recomputes it during replay.
6. **CaptureRequest[] → runner.** The capture route passes the **bounded** array to `runEvidenceCaptureJob({ candidates })`. M6/M9 mint exactly one snapshot per fixture per window (idempotent full-stream check) + the mandatory `evidence_capture` odds record keyed by `captureId` (contract §4.2/§4.3/§4.7).
7. **settle_now → SettlementCandidate.** For completed fixtures, assemble `SettlementCandidate { fixtureId, row, completionInstant, nowSec }` from the finished `FootyMatchRow`; the settlement route passes the **bounded** array to `runPredictionSettlementJob({ candidates })`. M8 resolves lifecycle and appends revision-aware, idempotent `ValidationRecord`s.
8. **Batch → archive.** Consumers write to the three physically-separate append-only stores (evidence, provider, odds) via the file NDJSON adapter (contract §6.2).
9. **Archive → diagnostics.** `emitOutcomeMetrics` emits `evidence_job_outcome_total{job,outcome}`; `getEvidenceJobDiagnostics` exposes process-local counts; a scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep audits chain integrity out-of-band (§10).

---

## 5. Candidate contracts

M10 **produces** exactly the two objects the M9 runners already accept; it MUST NOT redefine or extend them (they are consumer-owned). This section fixes the producer's obligations for each.

### 5.1 `CaptureRequest` (produced for `runEvidenceCaptureJob`)

Source of truth: `lib/evidence-capture/capture/capture.ts:36`.

| Field | Req/Opt | M10 producer obligation |
|---|---|---|
| `admitted: boolean` | **required** | `true` only when M4 admission succeeded for this fixture's upstream inputs. `false` → capture returns `not_admitted`; M10 SHOULD instead omit non-admitted fixtures and count them, rather than inject `admitted:false` noise. |
| `fixtureId: number` | **required** | The canonical `matchId` (positive integer). Validated with `isValidFixtureId` before injection (capture re-validates). |
| `capturedAt: string` | **required** | Canonical ISO window anchor `ISO(kickoffMs − leadMinutes·60000)`. Computed once at minting from *live* kickoff+leadMinutes (contract §3); this is ORIGINAL minting, permitted by §4.9-R2. |
| `modelInput: FixtureModelInput` | **required** | `{ fixtureId, markets: MarketInput[] }` from M5. `fixtureId` MUST equal the top-level `fixtureId`. |
| `providerRecord?: ProviderArchiveRecord \| null` | optional | The admitted provider-archive record (integrity-checked). |
| `competitionId?: string \| null` | optional | Provenance for baseline scoping. |
| `seasonId?: string \| null` | optional | Provenance for baseline scoping. |
| `operatorAvailability?: OperatorAvailabilitySnapshot \| null` | optional | Frozen shape; passthrough only. |
| `bestOddsSnapshot?: BestOddsSnapshot \| null` | optional | Frozen shape; feeds the mandatory odds record when present, else the record is still written with `null` values (contract §4.7, DoD 6). |
| `modelVersion?: string` | optional | Defaults to the frozen `"23B.daily-evidence.v1"`; M10 MUST NOT invent a new version string (contract §2.A/§6.8, §4.9-R3). |

**Identity rules.** M10 does not mint identity; it supplies the *coordinates* from which M1/M6 derive it deterministically: `captureWindowKey = \`${fixtureId}|${capturedAt}\``, `captureId = "cap_"+evidenceContentHash(fixtureId‖captureWindowKey)[0:24]` (contract §3, verified `lib/evidence-capture/capture/mandatory-odds.ts:48-58`). Identical `(fixtureId, capturedAt)` MUST yield an identical `CaptureRequest`-derived identity — so M10's `capturedAt` computation MUST be a pure function of `(kickoff, leadMinutes)` with no clock/jitter.

**Snapshot-identity forward-only invariant (binding, from architecture review §8).** The frozen snapshot identity `evidenceSnapshotId({ fixtureId, capturedAt, sequence })` (`lib/evidence/identifiers.ts:27`) additionally binds `sequence = (latest?.sequence ?? 0) + 1` (`lib/evidence-capture/capture/capture.ts`), which is archive-state-dependent, whereas `captureId` is window-keyed and sequence-free. Both are deterministic *given the fixture's archive history*. M10 therefore MUST honour the following, **without changing any frozen identity formula**:

- **Forward-only.** M10 captures strictly forward from activation (no back-dating, §6.3 `expired_window`), so `sequence` stays monotonic with `capturedAt` and a re-derivation reproduces identical sequences → identical `snapshotId`.
- **No reinterpretation of the past.** A later source state MUST NEVER rewrite, re-hash, or reinterpret an already-minted snapshot. A changed later result is settlement's concern (a new revision, M8), never a snapshot rewrite.
- **Retry reconstructs the same identity.** A retry of the same logical input (same `(fixtureId, capturedAt)` and same admitted normalized basis) reconstructs the same `snapshotId`/`captureId`/`inputContentHash`; the full-stream pre-check returns `already_exists` rather than minting a duplicate.
- **A genuinely newer eligible input** produces only the identity the existing frozen formula allows for its own distinct `(fixtureId, capturedAt, sequence)` — never a collision with a prior window.
- **Batching/order-independence.** The order in which candidates appear in a batch, and how they are paginated across fires, MUST NOT affect any identity (identity is content/coordinate-derived, not batch-position-derived — verified via `canonical.ts` order-independent sorts and the `sequence` pre-check).

**Versioning.** `modelVersion` is scoring/snapshot identity; `evidenceInputVersion` (M7) is input identity and participates in `inputContentHash` (which excludes `modelVersion`). M10 supplies inputs consistent with a single retained normalized basis so the M7 hash is stable across model-version evolution.

**Replay requirements.** Every field a `CaptureRequest` carries that influences the snapshot body MUST be reconstructable from retained data (provider archive + snapshot) under the original `modelVersion` — M10 MUST NOT introduce any capture input that is only knowable live (contract §4.9-A/-N/-G). The M7 serialization-boundary replay test MUST still pass over M10-produced captures.

### 5.2 `SettlementCandidate` (produced for `runPredictionSettlementJob`)

Source of truth: `lib/evidence-capture/jobs/settlement-run.ts:34`.

| Field | Req/Opt | M10 producer obligation |
|---|---|---|
| `fixtureId: number` | **required** | Canonical `matchId`; MUST correspond to an existing captured snapshot's fixture (M8 C3 fixture-correspondence is enforced downstream — MF-1). |
| `row: FootyMatchRow` | **required** | The completed fixture row (`status`, `isFinished`, `listResult`) driving `resolveMatchLifecycle`. |
| `completionInstant: string` | **required** | Deterministic source-derived terminal instant → `recordedAt = settledAt`. **Never a wall clock** (settlement-run header). |
| `nowSec: number` | **required** | Deterministic seconds for lifecycle resolution. **Never a clock.** |
| `correctionCause?: CorrectionCause` | optional | Set only for a genuine data/settlement correction (revision path). |
| `recordedBy?: string` | optional | Provenance label. |

**Identity rules.** Settlement identity is `validationId(snapshotId, marketKey, selectionKey)` + `validationRevisionId(validationId, revision)` (contract §3) — derived downstream by M8, not by M10. M10 supplies only `fixtureId` + the completed row; it MUST NOT synthesize validation ids.

**Versioning / replay.** Settlement is revision-aware and idempotent: re-injecting the same completed candidate with an unchanged outcome is a `noChange` no-op; a genuine change appends a new revision (contract §4.1, §5.9/§5.10). M10's `completionInstant`/`nowSec` MUST be deterministic so re-runs are byte-stable.

**Determinism note (both objects).** The single hardest producer obligation: every candidate field must be a pure function of retained/source data and the run's *injected* evaluation instant. No `Date.now()`, no `Math.random()`, no ambient config leak into a candidate — otherwise idempotency and replay (the M6/M7/M8 guarantees) break at the boundary M10 owns.

---

## 6. Eligibility rules

The eligibility gate is a **pure classifier** `classify(fixture, evalInstant, leadMinutes, archiveState) → EligibilityDecision`.

### 6.1 When a fixture becomes a **capture** candidate
- It is present in the current `PublishedDailyPrediction[]` (selected; contract §5.5), **and**
- `evalInstant ≥ capturedAt` where `capturedAt = kickoff − leadMinutes` (the pre-kickoff window has opened, contract §3/§4.2), **and**
- `evalInstant < kickoff` (still pre-kickoff — capture is a pre-kickoff act), **and**
- no snapshot already exists for `(fixtureId, capturedAt, capturedBy="evidence_capture")` (M6 full-stream idempotency, contract §4.3) — M10 SHOULD pre-filter already-captured windows to avoid injecting guaranteed no-ops, but correctness does not depend on it (capture is idempotent).

### 6.2 When a fixture becomes a **settlement** candidate
- A snapshot exists for the fixture (there is something to settle), **and**
- `row.isFinished` / a terminal `FootyMatchRow.status` (finished, or lifecycle-terminal: postponed/cancelled/abandoned), **and**
- either no terminal `ValidationRecord` yet, or the current terminal outcome differs (a correction). An unchanged terminal outcome → not a candidate (`noChange`).

### 6.3 When a fixture is **rejected** (with reason, counted)
- `not_selected` — absent from the daily list.
- `missing_kickoff` — the source row has a missing, unparseable, or non-finite `kickoffAt`/kickoff instant, so the pre-kickoff window (`capturedAt = kickoff − leadMinutes`) cannot be computed deterministically. **Binding behaviour:** the fixture is rejected with reason `missing_kickoff` and counted; **no identity is minted, no snapshot or odds record is written, and no M4 fetch is performed for it.** It is not an error — the run continues. **Retry:** because eligibility is re-derived every fire from the current source (INV-A), if the upstream row later carries a valid kickoff the fixture is naturally re-classified (`not_yet` → `capture_now`) on a subsequent fire, provided its window has not already passed (`expired_window`). No dead-letter state is kept.
- `not_yet` — before the capture window opens.
- `expired_window` — evalInstant ≥ kickoff and no snapshot was ever captured (the pre-kickoff opportunity was missed; M10 MUST NOT back-date a capture — replay/identity forbid recomputing a past `capturedAt` from a stale window, contract §4.9-R2/§5.14).
- `not_admitted` — M4 admission failed (transient provider failure); surfaced + retried next run, never persisted as evidence (contract §5.13).
- `no_scorable_markets` — M5 omitted all markets (no baseline); nothing to snapshot.
- `already_captured` / `already_settled` — idempotent no-op pre-filtered.
- `ineligible` — Acca/combo/non-daily-list input (never captured, contract §5.5).

### 6.4 Staleness
- A fixture whose **source inputs** exceed `maxSourceAgeMs` (M0 default 24 h) and cannot be refreshed within the run is stale → deferred (`not_admitted`/retry), never captured on stale data (contract §5.13; M0 `staleFallbackAllowed` governs whether a bounded stale read is permitted).
- A fixture whose **capture window** has passed (§6.3 `expired_window`) is permanently stale for capture — it can only ever become a settlement candidate once finished.
- Provider archive freshness is governed by per-source TTLs (`teamStatsTtlMs` 6 h, `leagueBaselineTtlMs` 24 h, `matchDetailTtlMs` 5 m); `buildFetchPlan` returns `skip_fresh` within TTL to avoid redundant fetches.

### 6.5 Retries
- **Within a run:** M4 orchestration retries transient provider failures up to `retryLimit` (M0 default 3) under `runDeadlineMs` (5 m) and `requestBudget`; a fixture exceeding these is deferred, not failed-hard.
- **Across runs:** because capture is idempotent (contract §4.3) and settlement is revision-aware/idempotent (§4.1), a fixture deferred this run is simply re-classified next run — no dead-letter state is required. A run that hard-fails a write (`write_failed`/`immutable_violation`) is reported `failed` by the runner (C6) for external alerting and re-fire.
- **`maxFailureRatio`** (M0) bounds a run: if the fraction of fixtures failing admission exceeds it, the run is aborted/flagged rather than producing a partial evidence day silently (M4 review: run status ≠ completeness — skips are excluded from the failure ratio).

---

## 7. Scheduling

### 7.1 Cron ownership and the discovery lock boundary (INV-L, BF-2)

- The two **in-repo routes** already exist (`app/api/internal/cron/evidence-capture/route.ts`, `.../prediction-settlement/route.ts`, each `export const maxDuration = 60`) and use `handleCronPost` → `evaluateCronAccess` (`x-cron-secret`/`CRON_SECRET`, `ENABLE_CRON`) + rate-limit + advisory lock (`lib/jobs/cronHandler.ts`). M10 **wires the producer into these routes**; it does **not** author an external scheduler (contract §6.4).
- Recommended cadence (operational, non-binding, but see the capacity gate §7.4): capture on a frequent pre-kickoff sweep (e.g. every 10–15 min so windows are hit); settlement on a slightly lagged sweep. **Capture and settlement schedules SHOULD be staggered** so they never contend (they already use distinct lock keys, so contention only wastes a 409, never corrupts).

**INV-L — authoritative discovery happens only inside the durable job lock (binding).** The durable per-job advisory lock (`job:evidence_capture` / `job:prediction_settlement`, bound to `EVIDENCE_DATABASE_URL`, fail-closed in production — `lib/jobs/locks.ts`, `lib/jobs/runner.ts`) is acquired inside `runWithLock`, *before* the batch runs. All of the following MUST occur **inside** that held lock, in this order:

1. live candidate discovery (`loadPublishedDailyPredictions`),
2. eligibility classification (§6),
3. archive-derived progress determination (already-captured / already-settled, INV-A),
4. deterministic ordering (§7.4),
5. bounded candidate selection (§7.2, INV-C),
6. candidate processing (the M6/M8 batch, incl. live M4 fetch + M5 derivation for capture).

**Why discovery outside the lock is not allowed:** two overlapping workers would each read the archive at a *different head* and could (a) derive the same page against divergent already-captured/already-settled state, (b) diverge on backlog/deferred accounting and the oldest-pending-age metric (§7.4/§10), and (c) violate the forward-only ordering/anti-starvation guarantee (INV-S) by selecting overlapping or reordered pages. Idempotency would still prevent a *duplicate mint* or a *false result*, but it would not prevent wasted provider spend, inconsistent metrics, or starvation drift — so discovery-under-lock is a correctness-of-progress requirement, not merely an optimization.

**Before the lock:** only the inexpensive, side-effect-free **flag check** (`isCaptureEnabled`/`isSettlementEnabled`) and **cron auth/rate-limit** (`evaluateCronAccess`) run — they read no archive and touch no store. A disabled/denied fire short-circuits (`skipped`/`denied`) without ever acquiring the lock or discovering anything. **Authoritative discovery begins only once the durable lock is held.**

### 7.2 Batch ceilings (INV-C, BF-3)

Both paths MUST enforce a mandatory, fail-safe, observable ceiling **in the producer** (verified necessary: neither `runCaptureBatch` nor `runSettlementBatch` bounds its input — both iterate the whole array). No unbounded candidate array is ever injected.

- **Capture ceiling.** Effective per-run capture ceiling MUST be `≤ 150` on the file adapter. The current `DEFAULT_CAPTURE_MAX_FIXTURES = 500` (`config.ts:40`) is **over budget** (perf review: ~100 s at 500) and MUST NOT be used as the effective ceiling; note that `readPositiveInt` fails *safe to that 500 default* for a zero/negative/malformed override, so the producer MUST additionally clamp: `effectiveCaptureCeiling = clamp(configuredValue, 1, CAPTURE_HARD_CAP=150)`. **Conservative initial default: 100.**
- **Settlement ceiling.** A **symmetric** explicit ceiling MUST exist (settlement currently has none). `effectiveSettlementCeiling = clamp(configuredValue, 1, SETTLEMENT_HARD_CAP=150)`. **Conservative initial default: 100** (perf: ~85–97 ms/fixture → well inside budget at ≤150).
- **Fail-safe config.** Invalid, zero, or negative configuration MUST fail to the conservative bounded default — **never** to unbounded behaviour and never to the 500 default. A configured value above the hard cap is clamped down to the hard cap (not honoured).
- **Explicit, observable truncation.** When the eligible set exceeds the effective ceiling, the overflow is **deferred**, not dropped: it is counted (`candidates_deferred_by_cap`, §10) and logged. Silent truncation is forbidden.
- **Distinct counts (no conflation).** The producer MUST report these as **distinct** low-cardinality counters: `discovered`, `eligible`, `selected`, `deferred`, `processed`. `discovered ≥ eligible ≥ selected ≥ processed`; `deferred = eligible − selected`. No candidate may be silently dropped anywhere in this chain (§10, and §6.3 reason counters reconcile `discovered − eligible`).
- **Deferred → deterministically re-discoverable.** A deferred candidate carries no state; because progress is archive-derived (INV-A) and ordering is deterministic (§7.4), the next fire re-derives it and, once earlier windows drain, selects it. Determinism guarantees it is reached, not lost.
- **Single bounded archive read per run (binding).** The producer MUST read each store at most once per run and classify in memory, not re-scan per fixture, to avoid the O(F²) NDJSON amplification (perf review §5/§6).

### 7.3 Deadline vs route budget (INV-D, BF-1)

The cron route budget is **60 s** (`maxDuration = 60`). The M0 `DEFAULT_RUN_DEADLINE_MS = 300_000` (5 min) is **five times the route budget** and MUST NOT be used as the authoritative deadline for the web-cron path.

- **INV-D (binding).** The authoritative **end-to-end job deadline** used by the producer+consumer on the web-cron path MUST be **strictly below** the route budget: `effectiveJobDeadlineMs = min(configuredRunDeadlineMs, ROUTE_BUDGET_MS − RESERVED_HEADROOM_MS)`. The 300 s default is thereby clamped, not honoured, on this path.
- **Explicit sub-budget allocation.** The `effectiveJobDeadlineMs` MUST explicitly account for every phase within one route invocation: lock acquisition (bounded ~1 s try-window, `locks.ts`), source fetch (M4, bounded by `globalConcurrency`/`footystatsConcurrency`/`requestBudget`), candidate derivation (M5, pure/CPU), archive writes (append + mandatory odds), diagnostics emission, and **response serialization**. The sum of the worst-case phase costs at the effective ceiling MUST fit within `effectiveJobDeadlineMs`.
- **Concrete initial production target.** Initial `ROUTE_BUDGET_MS = 60_000`, `RESERVED_HEADROOM_MS ≈ 15_000` → **initial authoritative job-deadline target `≤ 45_000 ms`**, revisited only if a benchmark (§9.3, Gate B5) proves a different value safe. (This is a target the spec fixes; the exact env/const wiring is implementation detail and MUST NOT weaken INV-D.)
- **Fail-closed on insufficient remaining deadline.** Before starting another candidate's fetch/derive/write, the producer MUST check the **remaining** deadline against a conservative worst-case per-candidate cost estimate; if insufficient, it **stops and defers** the remaining candidates (counted, §10) rather than starting work it cannot safely finish. Deferring is safe and deterministic (INV-A/INV-S); overrunning the route is not.
- **Back-pressure.** M4 concurrency (`globalConcurrency` 4 / `footystatsConcurrency` 2) and `requestBudget` cap provider calls per run; a hit budget defers remaining fixtures (`not_admitted`) — natural back-pressure, no queue.
- **Overlap.** A second concurrent fire hits the advisory lock and returns **409 `lock_unavailable`** (never 500) within the ≤1 s try-window — verified guaranteed by the runner.

### 7.4 Anti-starvation ordering and capacity (INV-S, BF-4)

Promoted from prose to binding requirements:

- **Stable deterministic ordering (binding).** The eligible set is ordered by **primary key `capturedAt` ascending** (earliest-opening window first — the fixture closest to losing its capture opportunity is served first), **tie-break `fixtureId` ascending**. This ordering is total and deterministic; it does not depend on archive read order, batch order, or any clock.
- **Archive-derived pending state.** "Pending" = eligible-and-not-yet-consumed, derived every fire from the immutable archive (already-captured / already-settled are read from the store, INV-A). There is no separately-stored pending set to drift.
- **Forward-only processing invariant.** Capture proceeds strictly forward in `capturedAt`; a passed window is `expired_window` (never back-dated, §6.3). Consumed fixtures leave the eligible set (`already_captured` / `already_settled`), so the set monotonically drains.
- **Late-arriving candidates** (a fixture appearing/becoming complete after earlier fires) are simply classified on the next fire and take their deterministic position in the ordering — no reconciliation needed.
- **Why no durable cursor is required.** Because processing is idempotent and pending state is recomputed from the archive, there is nothing to persist between fires; a re-fire re-derives the exact remaining work. A durable cursor would add a divergent failure surface for zero correctness gain (INV-A).
- **How replay avoids permanent skips.** Replaying/re-firing over the same archive yields the same ordering and the same already-consumed set, so every unconsumed eligible candidate is eventually selected once earlier ones drain. **No “advancement” concept exists that could mark a candidate consumed without it actually being processed** — consumed-ness is defined solely by its presence in the archive.
- **Minimum scheduler capacity (activation gate).** Sustained safety requires `cadence × effectiveCeiling ≥ sustained arrival rate` for each path. If sustained arrivals exceed processing capacity, backlog and oldest-pending-age grow without bound and capture windows will expire. **Activation MUST fail (or alert and block go-live) if the measured/estimated sustained arrival rate exceeds `cadence × effectiveCeiling`.** This is an activation gate, checked against the observability in §10 (`backlog`, `oldest_pending_age`).
- **Backlog growth behaviour.** Under a transient spike, backlog grows and drains deterministically across fires (bounded by the capacity relation). Under sustained over-capacity, the capacity gate above is the required control — the system does not silently shed load.
- **Required metrics (binding, low-cardinality):** `oldest_pending_candidate_age`, `candidates_deferred` (incl. `_by_cap` and `_by_deadline`), `backlog_size` — see §10.

### 7.5 State management — archive is the sole checkpoint (INV-A)

Binding, and verified against the current repository (a grep for cursor/checkpoint/offset state under `lib/evidence-capture`, `lib/jobs`, `lib/archive/evidence` returns nothing — M10 starts clean and MUST stay clean):

- The **immutable evidence/odds/validation archive is the sole authoritative progress/checkpoint source.** Progress = what the archive already contains.
- **No process-local cursor** may be authoritative (process-local last-run *diagnostics counts* are permitted, but explicitly non-authoritative and reset on restart).
- **No filesystem-offset cursor**, and **no business identity derived from NDJSON line position** (identity is content/coordinate-derived; line order is not identity — verified `canonical.ts`, `identifiers.ts`).
- **No request-supplied cursor** — a cron request carries no page/offset the producer trusts for progress.
- **Process restart and multi-worker execution MUST recompute pending work from durable archive state** — never from in-memory or local-disk progress. This is what makes crash/replay and overlap safe (§8, Gate B6/B7).

---

## 8. Failure model

Every failure below has a defined recovery that preserves the M1–M9 safety properties (no false result, no immutable-data corruption — failure review §326).

| Failure | Behaviour / recovery |
|---|---|
| **Provider fetch transient failure/timeout** | M4 retries ≤ `retryLimit`; if unresolved, fixture is `not_admitted` and **deferred**, never persisted as evidence (contract §5.13). Re-classified next run. |
| **`maxFailureRatio` exceeded** | Run flagged/aborted rather than emitting a partial-day of evidence silently; alerted; re-fired. Skips excluded from the ratio (M4 review). |
| **Missing odds (no price data)** | The mandatory `evidence_capture` odds record is **still written** with `decimalOdds`/`operatorKey`/`impliedProbability` = `null` (contract §4.7, DoD 5/6). A capture with **zero** odds records is a failed capture. |
| **Partial write mid-batch** | Each fixture's capture is independent and idempotent; a crash after N of M fixtures leaves N committed snapshots + their mandatory odds records intact; the re-fire re-derives eligibility and completes the rest — no duplicates (contract §4.1/§4.3). |
| **Duplicate candidate (same fixture twice in a batch, or re-fire)** | Idempotent no-op: identical `(fixtureId, capturedAt)` → same window → M6 detects the existing snapshot and skips; settlement re-append of an unchanged outcome → `noChange`. M10 SHOULD also de-dup within a batch. |
| **Corrupt archive line** | The strict archive read (M9 G6) surfaces a read error rather than silently returning empty history; `verifyEvidenceChain` surfaces sequence conflicts (`file.ts` header). M10 MUST NOT treat a read error as "no history" (that would risk a duplicate mint) — it defers the fixture and alerts. |
| **`immutable_violation`** (same id, different hash) | Never retried blindly; the runner reports `failed`+`immutable_violation`; escalated (contract §4.1). Indicates a determinism bug in candidate production — treated as a P0. |
| **`write_failed`** (transient store error) | Runner reports `failed`+`write_failed`; transient-retryable; re-fired (idempotent). |
| **Durable lock unavailable** (no `EVIDENCE_DATABASE_URL` in prod) | Job **fails closed** — safely skips (M9 C1). Not an M10 defect; an activation gate. |
| **`pg_advisory_unlock` rejection (PG path)** | Carry-forward **H-1/L-2**: a successful idempotent job can currently surface as HTTP 500 on unlock throw. M10 SHOULD land the swallow/log fix so a successful run is not misreported (low severity). |
| **Settlement of an unrelated fixture** | M8 enforces fixture-correspondence (C3/MF-1: `row.matchId ↔ snapshot.fixtureId`) and score sanity (C4/MF-2); a mismatched candidate is rejected, not mis-settled. |
| **Clock/nondeterminism leak into a candidate** | Forbidden by §5's determinism note; caught by the M7 serialization-boundary replay test and a new M10 determinism test (§12). |

**Idempotency (summary).** Capture: full-stream window check (contract §4.3). Settlement: revision-aware append (contract §4.1). Producer: deterministic candidate fields. Therefore **any run is safe to re-fire**.

**Replay.** M10 introduces no new replay obligation of its own beyond feeding reconstructable inputs; the M7 replay guarantee (byte-identical Evidence Inputs + `contentHash` under the original `modelVersion`) MUST continue to hold over M10-produced captures (DoD 1, contract §4.9-G).

---

## 9. Performance requirements

### 9.1 Current benchmark (baseline, M9)
- Bare cron fire, empty candidate list: **0.04 ms/pass** (perf review §29). Current activated compute cost ≈ zero.
- File adapter store call is **O(A)** (global NDJSON scan) per store operation. Capture ≈ **3 evidence scans + M hash-verified odds-file scans per fixture** (mandatory-odds amplification); settlement ≈ **2 + 2·T scans per fixture**. A whole-day run over F fixtures against one growing file is **O(F·A) ≈ O(F²)**; **capture is the steeper curve** (perf review §5/§6).
- Measured envelope: `DEFAULT_CAPTURE_MAX_FIXTURES = 500` **exceeds** the 60 s budget with ~1 MB accumulated history; settlement ~85–97 ms/fixture → ~15 s at 150.

### 9.2 Expected production load
- Daily-list selection is on the order of tens–low-hundreds of fixtures/day. The bounded-per-run design keeps each fire well inside budget.

### 9.3 Batch recommendations (binding for M10)
- **Capture ≤ 150 fixtures/run, initial default 100** on the file adapter (INV-C/§7.2). Do **not** ship 500 as the file-adapter ceiling; the effective ceiling is `clamp(configured, 1, 150)`.
- **Settlement ≤ 150 candidates/run, initial default 100** (INV-C/§7.2); symmetric hard cap.
- **One bounded archive read per run**, classify in memory (avoid per-fixture re-scan).
- **Authoritative job deadline `≤ 45 s` (INV-D/§7.3)**, strictly below the 60 s route budget with ~15 s reserved headroom; respect an AbortSignal / the *effective* (clamped) deadline — never the raw 300 s `runDeadlineMs` — and fail-closed (defer) when remaining time is insufficient to start another candidate. Emit an archive-size warning at ~50 k lines / ~10 MB.
- **Mandatory benchmark (Gate B5):** prove that a full route fire at the configured ceilings, against representative accumulated archive depth, completes within the effective job deadline (and hence the 60 s route budget). The configured deadline + workload combination is not accepted until this benchmark is recorded.

### 9.4 Scaling limits & future Postgres transition
- The file NDJSON adapter's documented boundary is roughly **a few-hundred fixtures/run** or **tens-of-thousands of accumulated lines** (perf review §246). Beyond that, the O(F²) scan dominates.
- The remedy is the **Postgres adapter** (indexed lookups replace global scans), which turns per-fixture cost from O(A) to O(log A). Postgres is a **later reversible env cutover, out of M10 scope** — but M10's bounded design is exactly what keeps the file adapter viable until then, and M10 MUST NOT bake in any assumption that blocks the cutover (migration review).

---

## 10. Observability

- **Metrics (binding counter set).** Extend the existing `evidence_job_outcome_total{job,outcome}` counter (verified low-cardinality `{ job, outcome }` labels, `runner.ts:271`) with the following **distinct producer-stage counters** (per run, per job path). This is the binding minimum:
  - `source_rows_discovered` — rows returned by `loadPublishedDailyPredictions`.
  - `source_rows_malformed` — rows dropped upstream / by the classifier as malformed (so `discovered − eligible` reconciles; no silent upstream loss).
  - `candidates_eligible` (split `eligible_capture` / `eligible_settle`).
  - `candidates_rejected` **by reason** — one counter value per §6.3 reason: `not_selected`, `missing_kickoff`, `not_yet`, `expired_window`, `not_admitted`, `no_scorable_markets`, `already_captured`, `already_settled`, `ineligible`.
  - `candidates_selected` — chosen this run within the ceiling.
  - `candidates_deferred` — split `candidates_deferred_by_cap` (INV-C truncation) and `candidates_deferred_by_deadline` (INV-D fail-closed).
  - `candidates_processed` — actually run through the M6/M8 batch.
  - `backlog_size` — eligible-and-not-yet-consumed at end of run (INV-S).
  - `oldest_pending_candidate_age` — age of the oldest still-pending eligible candidate (the `expired_window` early-warning + capacity-gate signal, §7.4).
  - Reconciliation invariant (assertable): `discovered = eligible + rejected(incl. malformed)`, and `eligible = selected + deferred`, and `selected ≥ processed`.
- **Cardinality rule (binding).** **No** `fixtureId`, `matchId`, `captureId`, `predictionId`/`validationId`, or provider-payload id may appear as a metric label — aggregate counts only (perf review §188). Per-entity detail belongs in structured logs, not metric labels.
- **Counters / diagnostics.** Feed the process-local `getEvidenceJobDiagnostics` (`lib/jobs/diagnostics.ts:59`) and `getEvidenceDiagnostics` (`lib/evidence-ui/diagnostics.ts:8`) with last-run producer counts (considered/eligible/rejected-by-reason/captured/settled/deferred). These reset on restart — durable history is an ops concern (H-4).
- **Alerts.** A run reported `failed` (`write_failed`/`immutable_violation`), or `maxFailureRatio` exceeded, MUST be alertable via the external alerting gate (out-of-repo, H-4). M10 emits the signal; routing it is operational.
- **`verifyEvidenceChain` / `verifyValidationChain` integration.** Defined in `lib/evidence/integrity.ts` (`verifyEvidenceChain` → `IntegrityReport`: per-row content-hash + identifier checks, sequence 1..N gapless, `previousSnapshotId` linkage, `capturedAt` monotonic) and `lib/validation/integrity.ts` (`verifyValidationChain` → `ValidationIntegrityReport`: content-hash, `revisionId` derivable, revision 1..N gapless, `supersedesRevisionId` linkage, legal state transitions, `recordedAt` monotonic, correction-note required). These run as a **scheduled out-of-band sweep** (never on a per-request/diagnostics path — perf review §188). M10 does not invoke them inline; it ensures its produced data passes them and documents the sweep as an activation prerequisite (H-4).

---

## 11. Security

- **Cron auth.** Unchanged: `evaluateCronAccess` requires `x-cron-secret` == `CRON_SECRET` and `ENABLE_CRON`, with rate-limiting (`cronHandler.ts`). M10 adds no new public surface; the producer runs only inside the authenticated cron route.
- **Flags.** `EVIDENCE_CAPTURE_ENABLED` / `EVIDENCE_SETTLEMENT_ENABLED` remain **default-off** (contract §6.3). A disabled job returns a flag-skip record and touches nothing (`runner.ts:288,325`). M10 changes no default.
- **Locks.** Distinct advisory locks (`job:evidence_capture`, `job:prediction_settlement`) bound to `EVIDENCE_DATABASE_URL`; **fail-closed in production** (M9 C1). M10 must not weaken this — in particular it must not fall back to a per-process in-memory lock for evidence jobs.
- **Permissions / secrets.** Provider credentials for M4 fetches come from the existing provider config; M10 introduces no new secret store and logs no secrets. Diagnostics endpoints stay behind `requireDiagnosticsAccess`.

---

## 12. Definition of Done

Same binary A/B gate model as `phase-2-7-definition-of-done.md`: each criterion is a named deterministic test (Gate A) or a wired integration test (Gate B); no partial credit; project baselines (`npm test`, `npm run typecheck`, `npm run lint`) green; no frozen contract modified.

### Gate A — offline / deterministic (pre-merge)
- **A1 — Deterministic eligibility classifier.** `classify(...)` is a pure total function of `(fixture, evalInstant, leadMinutes, archiveState)`; identical inputs → identical decision; no clock/random/config read. Trace: eligibility unit table covering every §6 outcome.
- **A2 — Deterministic candidate assembly.** Identical `(source row, evalInstant, leadMinutes)` → byte-identical `CaptureRequest` (incl. `capturedAt`) and `SettlementCandidate` (incl. `completionInstant`/`nowSec`). No `Date.now`/`Math.random`. Trace: candidate-determinism test.
- **A3 — Identity coordinates correct.** Produced `capturedAt` = `ISO(kickoff − leadMinutes·60000)`; downstream `captureWindowKey`/`captureId` match the M1 formula for the produced coordinates. Trace: identity-derivation test.
- **A4 — Replay preserved.** The M7 serialization-boundary replay test passes over M10-produced captures: re-derivation under the original `modelVersion` yields byte-identical Evidence Inputs + `contentHash` (contract §4.9-G, DoD 1).
- **A5 — Registry safety.** Every `marketKey`/`selectionKey` in every produced candidate is a §2.B member and valid pairing; no `market_void` synthesis; no `excluded` derivation.
- **A6 — Bounded per-run work (INV-C / BF-3).** The producer enforces the capture ceiling (`clamp(configured,1,150)`, default 100) and the symmetric settlement ceiling (`clamp(configured,1,150)`, default 100); a zero/negative/malformed config fails safe to the bounded default (never 500, never unbounded); a set larger than the ceiling is deterministically ordered and the overflow **deferred** (counted `_by_cap`, logged), never silently dropped. Trace: ceiling + config-fail-safe unit tests.
- **A7 — Deterministic anti-starvation ordering (INV-S / BF-4).** Ordering is total: primary `capturedAt` asc, tie-break `fixtureId` asc; independent of archive read order, batch order, and clock. Forward-only; consumed fixtures leave the eligible set; the same archive yields the same pending set and no “advancement” marks a candidate consumed without processing. Trace: ordering + drain unit table.
- **A8 — Archive-derived progress, no cursor (INV-A).** Pending work is recomputed purely from durable archive state; the producer holds no authoritative process-local/filesystem/request cursor. Trace: a test that recomputes identical pending work from archive state alone (and a static check that no cursor state is persisted).
- **A9 — Deadline math below route budget (INV-D / BF-1).** The effective job deadline is `min(configured, ROUTE_BUDGET − HEADROOM) ≤ 45 s` (never the 300 s default on the web-cron path); the remaining-deadline guard defers before starting work it cannot finish. Trace: deadline-clamp + insufficient-remaining-defer unit tests.
- **A10 — Missing-kickoff rejection.** A missing/invalid kickoff yields reason `missing_kickoff`, counted, with **no identity mint, no fetch, no write**; re-classified on a later fire if the row completes in-window. Trace: eligibility unit case.
- **A11 — Distinct, reconciling counters (bounded cardinality).** `discovered / malformed / eligible / selected / deferred / processed / backlog / oldest-age` are distinct; the §10 reconciliation identities hold; no entity id is a metric label. Trace: counter-reconciliation unit test.

### Gate B — runtime / integration
- **B1 — End-to-end capture pass.** With flags on and a seeded daily-list + stubbed provider fetch, a capture route fire produces N eligible `CaptureRequest`s, mints N snapshots each with exactly one mandatory odds record (nullable values allowed), idempotent on re-fire (no duplicates). Trace: capture integration test.
- **B2 — End-to-end settlement pass.** A completed-fixture source yields `SettlementCandidate`s that settle to correct terminal states via `resolveMatchLifecycle`; re-fire with unchanged outcome → `noChange`; a genuine change → one new revision. Trace: settlement integration test.
- **B3 — Empty/again-safe.** A fire with no eligible fixtures returns `succeeded` zero-count (the M9 baseline is preserved). A fire with all-already-captured fixtures writes nothing.
- **B4 — Failure handling.** Injected transient fetch failure → fixture deferred (`not_admitted`), no evidence written; injected `write_failed` → run reported `failed` with code; corrupt archive line → read error surfaced, fixture deferred (never a duplicate mint). Trace: failure-injection tests.
- **B5 — Budget respected (INV-D / BF-1).** A run at the configured capture ceiling and, separately, at the settlement ceiling, against a **representative accumulated archive depth**, completes inside the effective job deadline (`≤ 45 s`) and hence the 60 s route budget (mandatory benchmark, §9.3). The deadline+workload combination is not accepted without this recorded benchmark.
- **B6 — Multi-worker overlap safe (INV-L / INV-A).** Two concurrent fires of the same job: one acquires the durable lock and discovers/processes; the other returns 409 `lock_unavailable` (never 500); no duplicate mint, no divergent backlog/oldest-age accounting, no reordered/overlapping page. Trace: concurrency/overlap integration test.
- **B7 — Crash/replay without candidate loss (INV-A / INV-S).** A run interrupted after N of M candidates leaves N committed (each with its mandatory odds record); a re-fire re-derives pending work from the archive and completes the remainder with no duplicates and no permanently-skipped candidate. Trace: crash-then-replay integration test.

### Mandatory tests
A1–A11 offline tests; B1–B7 integration tests (including **B6 multi-worker overlap** and **B7 crash/replay without candidate loss**); the M7 serialization-boundary replay test extended to M10 output; a determinism test asserting no `Date.now`/`Math.random` in the producer path.

### Mandatory benchmarks
Capture at the configured ceiling and settlement at the configured ceiling against a file with **representative accumulated archive depth**, proving the whole route stays within the effective job deadline (`≤ 45 s`, INV-D) and hence < 60 s, and documenting the measured per-fixture cost, the deadline sub-budget allocation (§7.3), and the file-adapter scaling boundary.

### Required reviews
The six-reviewer closure of §14, each returning at least CONDITIONALLY APPROVED with no repository blocker.

### Exit criteria
All Gate A (A1–A11) + Gate B (B1–B7) green; baselines green; benchmarks documented. **BF-1…BF-4 must be explicitly closed**, evidenced by: the effective job deadline strictly below the route budget (INV-D); capture and settlement ceilings enforced and fail-safe (INV-C); authoritative discovery/ordering/selection/processing inside the durable lock (INV-L); archive-derived progress with **no process-local authoritative cursor** (INV-A); a deterministic anti-starvation proof (INV-S) with backlog/oldest-age observability and the capacity activation gate; a benchmark under representative archive depth; a multi-worker overlap test; and a crash/replay test showing no candidate loss. Six reviews closed; a closure document (`docs/plans/sprint-23b-m10-closure.md`) recorded with the same posture table used for M9 (Code complete / Repo blockers / Production enabled / E2E pipeline active / Ready to proceed). M10 ships **default-off**; enabling remains an operational action.

---

## 13. Risks

| Risk | Mitigation | Future work |
|---|---|---|
| **R1 — Non-determinism leaks into a candidate** (clock/random/config), breaking idempotency & replay. | A2/A4 tests + determinism lint; inject `evalInstant` explicitly; never read a clock in assembly. | Static rule forbidding `Date.now`/`Math.random` under `lib/evidence-capture/`. |
| **R2 — O(F²) file-adapter cost** exceeds the 60 s budget at scale. | Bounded ceilings (P2/P3), single bounded read/run, AbortSignal/deadline (§9.3). | Postgres adapter cutover (out of M10) removes the ceiling. |
| **R3 — Missed capture window** (`expired_window`): a fixture's pre-kickoff window passes before a fire hits it. | Frequent capture cadence (§7.1); count `expired_window`; never back-date (§6.3). | Denser scheduling / dedicated worker. |
| **R4 — Partial-day evidence** if many fetches fail. | `maxFailureRatio` aborts/flags a degraded run rather than silently shipping a partial day. | Provider-reliability improvements. |
| **R5 — Mandatory-odds amplification** makes capture the steeper curve. | Bounded ceiling accounts for it; single odds read/market where possible. | Postgres/indexed odds lookup. |
| **R6 — H-1 unlock 500** misreports a successful idempotent PG run. | Land the swallow/log fix during M10 (low severity). | — |
| **R7 — Silent truncation** if eligible set > ceiling. | A6: count + log the drop; deterministic cursor across fires. | Durable cursor if load grows. |
| **R8 — Frozen-contract drift** under pressure to "make it fit". | M10 is producer-only; A5 + baseline "no frozen contract modified" gate; escalate rather than amend (contract §5.1). | — |
| **R9 — Backfill temptation** (capturing past days). | Explicitly out of scope (§2.2); replay/identity forbid recomputed historical `capturedAt`. | Separate, explicitly-scoped backfill milestone. |

---

## 14. Reviewer plan

Six independent reviews, mirroring the M2–M9 review corpus. Each must read the code directly (not trust this spec) and return a binary-traceable verdict.

- **Architecture Review.** Verify M10 is purely additive and producer-only: it consumes `CaptureRequest`/`SettlementCandidate` unchanged, wires into the two existing routes, and touches no frozen contract or M1–M9 internal. Confirm the source → eligibility → assembly → runner boundary is clean, the eligibility classifier is pure, and the scope boundary vs M-source/M4/M5/M9 and vs Postgres/backfill/ops is exact. Deliver conditions C1…Cn.
- **Implementation Review.** Verify the producer code matches this spec field-by-field: candidate assembly populates every required field correctly, determinism (no clock/random), registry safety (A5), ceiling enforcement (A6), route wiring passes bounded arrays, flags/locks unchanged. Confirm A1–A6/B1–B5 tests exist and are green, typecheck+lint clean, no frozen contract modified.
- **Production Readiness Review.** Verify default-off posture, cron auth/rate-limit/lock unchanged, fail-closed lock, staged-activation plan (empty → bounded capture-only → capture+settlement), and that no route can exceed budget or emit a 500 on overlap. Confirm the activation gates (flags, `EVIDENCE_DATABASE_URL`, sweep, alerting) are documented, not silently assumed. Land/track H-1.
- **Performance Review.** Re-measure with M10 supplying real candidates: confirm the ceilings (≤~150 capture, ≤~150 settlement) keep a whole-route fire < 60 s against representative history; verify single-bounded-read/run; confirm capture-side amplification is bounded; restate the file-adapter scaling boundary and that Postgres is the documented escape hatch. Provide the mandatory benchmark numbers.
- **Failure Review.** Fault-inject every §8 row: transient fetch failure → deferred (no evidence); missing odds → mandatory null-valued record still written; partial write → idempotent completion on re-fire; duplicate candidate → no-op; corrupt archive line → surfaced, no duplicate mint; `immutable_violation`/`write_failed` → reported `failed`; fixture mismatch → rejected (C3/MF-1). Confirm no failure produces a false result or corrupts immutable data.
- **Migration Review.** Confirm M10 produces only reconstructable, append-only NDJSON data with stable identities and a stable `inputContentHash` (M7), preserving a safe future NDJSON→Postgres cutover; verify M10 bakes in no assumption (ordering, in-memory-only state, non-content identity) that would block the reversible cutover; confirm no backfill/retention/ownership work is smuggled in.

---

## 15. Statement on this specification

This is a **specification-only** deliverable. No runtime code, production code, test, frozen or implementation contract, feature flag, or deployment/scheduling configuration was created or modified in producing this document. All referenced types, functions, config values, and file:line locations were read from the current repository and are cited so a reviewer can verify them. M10 remains unbuilt; this document defines what "built" will mean.

---

## 16. Amendment record (Rev A1)

**Source review:** `docs/plans/m10-live-candidate-pipeline-architecture-review.md` (M10 ARCHITECTURE CONDITIONALLY APPROVED). Each cited implementation fact below was re-verified directly against the current repository for this amendment; no test, benchmark, or review is claimed as passed — these are binding requirements the future implementation must satisfy.

| Finding | Resolution in this revision | Binding invariant / gate |
|---|---|---|
| **BF-1 — Deadline vs route budget.** `DEFAULT_RUN_DEADLINE_MS = 300_000` (`config.ts:153`) exceeds the cron route `maxDuration = 60` (both routes). | §7.3 makes the effective end-to-end job deadline `min(configured, ROUTE_BUDGET − HEADROOM)`, initial target **≤ 45 s**; the 300 s default is clamped, never honoured on the web-cron path; explicit sub-budget for lock/fetch/derive/write/diagnostics/serialization; **fail-closed defer** when remaining time is insufficient; §9.3 + Gate **B5** benchmark proves fit. | **INV-D**, A9, B5 |
| **BF-2 — Discovery lock boundary.** Routes call the runner with no candidates; the side of the lock was unspecified. | §7.1 makes discovery + eligibility + archive-derived progress + ordering + bounded selection + processing occur **only inside** the durable job lock (`job:evidence_capture`/`job:prediction_settlement`, `EVIDENCE_DATABASE_URL`, fail-closed); explains overlap/accounting/starvation hazards of discovery-outside-lock; inexpensive flag/auth checks precede the lock, authoritative discovery follows it. | **INV-L**, B6 |
| **BF-3 — Binding batch ceilings.** `DEFAULT_CAPTURE_MAX_FIXTURES = 500` (over budget) and `readPositiveInt` fails safe *to that 500 default*; settlement batch has **no** cap (`for (const … of candidates)`). | §7.2 mandates producer-enforced ceilings `clamp(configured,1,150)`, initial default **100** for both paths; invalid/zero/negative fails safe to the conservative bounded default (never 500, never unbounded); explicit observable **defer** (not drop) on overflow; distinct `discovered/eligible/selected/deferred/processed` counts; deferred candidates deterministically re-discoverable. | **INV-C**, A6, A11 |
| **BF-4 — Anti-starvation invariant.** Ordering/capacity were prose. | §7.4 fixes total ordering (**primary `capturedAt` asc, tie-break `fixtureId` asc**), forward-only processing, archive-derived pending state, late-arrival handling, why no durable cursor is needed, replay-avoids-skip, and a **capacity activation gate** (`cadence × ceiling ≥ sustained arrival`); requires `oldest_pending_candidate_age`, `candidates_deferred`, `backlog_size` metrics; no advancement concept can mark a candidate consumed without processing. | **INV-S**, A7, §10 |

**Additional architecture-review requirements incorporated:**

- **Archive as sole checkpoint** (§7.5): immutable archive is the only authoritative progress source; no process-local / filesystem-offset / request-supplied cursor; no business identity from NDJSON line position; restart + multi-worker recompute pending work from durable archive state. → **INV-A**, A8, B7.
- **Missing-kickoff rule** (§6.3): deterministic `missing_kickoff` rejection — counted, no identity mint, no fetch, no write, re-classified if the row later completes in-window. → A10.
- **Discovery counters** (§10): binding low-cardinality set (`source_rows_discovered`, `source_rows_malformed`, `candidates_eligible`, `candidates_rejected` by reason, `candidates_selected`, `candidates_deferred[_by_cap/_by_deadline]`, `candidates_processed`, `backlog_size`, `oldest_pending_candidate_age`) with reconciliation identities; **no entity id may be a metric label**. → A11.
- **snapshotId forward-only invariant** (§5.1): the frozen `evidenceSnapshotId({fixtureId,capturedAt,sequence})` binds an archive-state-dependent `sequence`; M10 stays forward-only so retries reconstruct identical identity and a newer input only ever takes its own frozen-formula identity — **no frozen identity formula is changed**.
- **Option C made authoritative** (§4.0): dedicated pure candidate-provider layer at `lib/evidence-capture/candidates/`, injected into the existing orchestration, adapter-neutral, cron routes stay thin, unit-testable without cron/network. (Boundary fixed, not implemented.)
- **Gate updates** (§12): Gate A extended to A1–A11, Gate B to B1–B7 (incl. multi-worker overlap and crash/replay); exit criteria explicitly require BF-1…BF-4 closed and no process-local authoritative cursor.

**Not changed and explicitly preserved:** all frozen M4–M9 contracts, identity/hash/revision formulas, archive record formats, and public interfaces; feature-flag defaults (off); Postgres remains a later reversible cutover, out of M10. This revision is documentation-only and marks nothing complete.
