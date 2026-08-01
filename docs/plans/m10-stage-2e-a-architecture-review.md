# M10 Stage 2E-A — Activation Design — Architecture & Implementation-Readiness Review

**Reviewer:** Independent architecture / implementation-readiness reviewer (Stage 2E-A).
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2E-A — Activation Design**.
**Type:** Read-only design review. **No runtime code, test, route, flag, config, reader, cron, migration, or deployment was created or modified. No flag was enabled, no production reader wired, no activation performed.** The only file created/updated is this document.
**Subject:** `docs/plans/m10-stage-2e-a-activation-design-plan.md`.
**Inputs read completely:** the spec (`m10-live-candidate-pipeline-specification.md`), `m10-stage-2d-closure.md`, the Stage 2E-A plan.
**Source independently verified (file:line):** `lib/footystats/dailyArchive.ts` (`readDailyArchive` fail-open, `DailyArchive`/`ArchivedRow` shapes, `savedAt`, `ARCHIVE_DIR=process.cwd()/data/daily-archives`); `lib/footystats/types.ts` (`FootyMatchRow` fields); `lib/fixtures/status.ts:12` (`resolveMatchLifecycle`); `lib/jobs/runner.ts:297-306,381,401,478,498` (deadline anchored **after** discovery); `lib/jobs/locks.ts` (prod fail-closed durable lock); `lib/jobs/cronHandler.ts` (`started=Date.now()` logging-only; `failed→500/skipped→409/else 200`); `lib/evidence-capture/config.ts` (`readFlag`, `resolveEvidenceOperationalConfig`, `runDeadlineMs=300_000`); `app/api/internal/cron/prediction-settlement/route.ts` (bare delegate); `candidates/{settlement-pipeline,capture-pipeline,completed-rows}.ts`; existing `readDailyArchive` consumers.

---

## 1. Review Summary

The Stage 2E-A activation design is **repository-grounded, internally consistent, implementable without any frozen-contract change, safely sliced, dormant-by-default, fail-closed, and reversible.** Every current-state fact the plan asserts was verified true against source: the two routes are bare dormant delegates; the durable lock is prod fail-closed on `EVIDENCE_DATABASE_URL`; `readDailyArchive` is genuinely fail-open (a single `catch → null` that cannot distinguish ENOENT from corruption); `DailyArchive.{fh,over15,over25,sh}` are `ArchivedRow = FootyMatchRow & {listResult}` carrying exactly the status/score/kickoff fields `filterCompletedRows`+`resolveMatchLifecycle` consume; settlement's `loadCompletedRows` is a required-injected seam with no live default while capture's `deriveCaptureInput` is an unbuilt seam; and — critically — the Stage-2D deadline is anchored **after** discovery (`producerDeadlineBudget` at `runner.ts:401/498`, post-`provideCandidateBatch()`), so source-load+discovery are uncharged today. The plan identifies this and specifies a bounded, additive route/job-entry anchor. All three named design dependencies (strict daily-archive reader, entry-anchored deadline, dry-run composition) are real, correctly scoped, additive, and have defined interfaces/owners/acceptance.

There are **no true blockers.** Three **required clarifications** remain — all resolvable in the implementation spec / acceptance criteria **without any architecture change**: (RC-1) the missing-expected-partition observability given the `process.cwd()`-relative source path (the crux of the ENOENT question); (RC-2) the source-freshness classification threshold (a present-but-stale partition must be an observable `run_degraded`, not a silent under-count); (RC-3) a single entry anchor point + a structural dry-run no-write acceptance test.

**Verdict: CONDITIONALLY APPROVED** — Stage 2E implementation is design-authorized, subject to resolving RC-1/RC-2/RC-3 in the implementation spec and meeting the gates. Not APPROVED outright only because those three clarifications should be pinned before Slice-2/Slice-3 code; not BLOCKED because nothing in the design is unsafe, incomplete, or requires a frozen-contract/schema change.

---

## 2. Repository-Grounding Verification

| Plan claim | Source | Verdict |
|---|---|---|
| Routes are bare dormant delegates; `maxDuration=60` | `prediction-settlement/route.ts:7,13` | ✅ exact |
| `readDailyArchive` fail-open (`catch→null`), no ENOENT/corruption distinction | `dailyArchive.ts:71-79` | ✅ exact |
| `DailyArchive` = `{date,savedAt,summary,fh,over15,over25,sh}`, arrays `ArchivedRow[]` | `dailyArchive.ts:9-21` | ✅ exact |
| `FootyMatchRow` carries matchId/status/isFinished/isLive/homeScore/awayScore/htHome/htAway/kickoff/kickoffTime/minute | `footystats/types.ts:4-28` | ✅ all present |
| `resolveMatchLifecycle({status,kickoffUnix,minute,nowSec})` authoritative terminal classifier | `fixtures/status.ts:12-17` | ✅ |
| Durable lock prod fail-closed; memory fallback only non-prod | `locks.ts:34-50` | ✅ exact |
| `readFlag` = "true"/"1" case-insensitive; `isCaptureEnabled`/`isSettlementEnabled` | `config.ts:44-47,97-108` | ✅ |
| `runDeadlineMs` default 300 000 (clamped by `resolveEffectiveJobDeadlineMs`) | `config.ts:202,290` | ✅ |
| Deadline anchored **after** discovery (uncharged source+discovery) | `runner.ts:306,381,401` (and 478/498) | ✅ **plan's central design finding is correct** |
| Settlement `loadCompletedRows` required-injected, no default | `settlement-pipeline.ts:68` | ✅ |
| Capture `loadSource` defaults live; `deriveCaptureInput` unbuilt seam | `capture-pipeline.ts:79-81,118` | ✅ |
| `cronHandler` `started` is logging-only, not threaded into the job | `cronHandler.ts:46-55` | ✅ (see §7/RC-3) |
| No `readDailyArchiveStrict`/`activation/`/M10 flags exist yet | grep clean | ✅ additive |
| `readDailyArchive` has 6 fail-open consumers | grep (admin-dashboard, archive/load, footystats/client, homepage, calibration, evidence-capture/source) | ✅ (Special Q C) |

**No plan claim was found to overstate or misdescribe the repository.** The design does not trust itself blindly; every dependency is a verified surface.

---

## 3. Activation Topology

**Correct and overlap-safe.** Two routes → two runner jobs → two distinct durable lock keys (`job:evidence_capture`, `job:prediction_settlement`) → disjoint write targets (capture: `snapshots.ndjson` + `odds-archive/records.ndjson`; settlement: `validations.ndjson`). Settlement only *reads* snapshots, re-reading the head under its own lock at settle time (no TOCTOU — verified against M8/Stage-2C). Distinct keys ⇒ no cross-path contention (matches `m9Concurrency`). The **settlement-lags-capture** relationship is correctly characterized as a *data* dependency (settlement can only settle fixtures that have snapshots), **not** a code coupling — neither route imports the other. Independent activation and rollback per path is sound. **No topology defect.**

One point worth stating (NON-BLOCKING OBSERVATION OB-4): DRY_RUN runs *under* the durable lock, so in production it requires `EVIDENCE_DATABASE_URL` (Gate D) even though discovery is read-only. This is a deliberate path-fidelity choice (dry-run exercises the exact production composition, including lock acquisition) and is acceptable; it means source/discovery validation in prod is gated on DB provisioning, which the go/no-go matrix already reflects.

---

## 4. Feature-Flag Design

**Bounded, hierarchical, all default OFF, fail-closed.** The master (`EVIDENCE_M10_LIVE_ENABLED`) → per-path enable (existing `EVIDENCE_{CAPTURE,SETTLEMENT}_ENABLED`) → per-path mode enum → source flag → bounded canary knobs hierarchy is explicit and each knob is enumerated with a default. Precedence rules are binding and correct: master-off disables everything; write requires master ∧ enable ∧ mode∈{canary,full}; settlement write additionally requires the source flag; contradictions and invalid enums/ints fail closed (to `off`/mode-derived, never unbounded). Crucially, the plan states — and source confirms — that **no flag can bypass the lock** (unconditional inside `runWithLock`), **widen the ceiling** (`normalizeBatchLimit` clamps ≤150), **widen the deadline** (`resolveEffectiveJobDeadlineMs` clamps ≤45 s), or **enable corrections** (no correction flag exists). Request-time evaluation into an **immutable per-run snapshot** (`resolveM10ActivationConfig`, additive) with no mid-run re-read is the right model and matches the existing `readFlag` semantics. **No flag-design defect.**

---

## 5. Activation Modes & Dry-Run Zero-Write

**OFF/DRY_RUN/CANARY_WRITE/FULL_WRITE** are precisely specified; CANARY differs from FULL only by ceiling value + promotion criteria (identical code path) — minimal and safe.

**Special Question D — DRY_RUN zero-write is STRUCTURALLY sound, not a late flag.** Verified: the producers (`produceCaptureRequests`/`produceSettlementRequests`) only *read* (live source + strict archive-state) and classify; they mint no identity and perform no store write. The **sole** write path is the frozen batch (`runCaptureBatch`→`captureEvidenceSnapshot`+`ensureMandatoryCaptureOdds`; `runSettlementBatch`→`settleLatestSnapshotForFixture`). DRY_RUN's composition simply **never invokes the batch function**, so zero-write is a structural property (the write-capable code is not on the call graph), not a guard checked too late. This is the correct design. → **RC-3** adds the acceptance test that makes it auditable: assert the three frozen write functions are never called on the DRY_RUN path.

---

## 6. Source-Reader Design

**Special Question A — `readDailyArchive` IS authoritative enough for live *first-settlement* discovery.** The daily archive is written from the same daily-list universe that drives capture, so its fixture set is a superset of the captured set for a date; its rows carry `isFinished`/scores/`status`/`kickoff` — exactly what `filterCompletedRows` needs to select terminal fixtures with valid scores. Settlement needs no unbuilt derivation. The one inherent property (not a defect): settlement **completeness tracks the daily-archive refresh cadence** — a fixture finished in reality but not yet re-saved as `isFinished` in the archive is classified non-terminal and **safely deferred** (no false settlement; re-discovered next fire). This is correctness-safe but must be *observable* → RC-2.

**Strict-reader (Special Question C) — acceptable and additive.** The plan requires a new `readDailyArchiveStrict(date)` mirroring `readNdjson` (ENOENT→null/empty; other errno / malformed JSON → throw), added **beside** the fail-open `readDailyArchive`. Verified: the 6 existing consumers (admin-dashboard/queries, archive/load, footystats/client, homepage/trustPerformance, calibration-intelligence/queries, evidence-capture/source) keep the fail-open reader untouched (§30 pins this). So the strict variant changes no existing consumer's behaviour. **Design acceptable.**

**ENOENT (Special Question B) — safe for correctness, but a missing *expected* partition must be surfaced.** ENOENT→empty→`succeeded` zero-count→re-fire is structurally safe (it never converts source corruption into an empty success — corruption throws under the strict reader; only a genuinely-absent file is empty). **However**, `ARCHIVE_DIR = process.cwd()/data/daily-archives` is **release-local** (plan R-3, verified `dailyArchive.ts:7`). A deploy/release swap that resolves `process.cwd()` to a fresh release dir would make an *expected* partition ENOENT → silent zero-count settlement → settlement stalls invisibly. This is not a data-corruption risk, but it is an availability/visibility risk. → **RC-1**: (a) Gate C/K must verify the prepare job (`saveDailyArchive`) and the reader resolve the **identical absolute path** across releases (a shared/stable dir, not release-local); and (b) a bounded observability signal (`source_partition_missing{job}` counter and/or `run_degraded`) must distinguish a genuinely-absent-but-not-yet-expected partition from a missing-but-expected one, so a silent zero-count cannot mask a broken partition path. This is the correct treatment of the ENOENT question and is resolvable without architecture change.

Duplicate/late-arrival semantics are correct: cross-tab dedup by `matchId` in the adapter (fixture-level scores/status are identical across tabs; only tab-specific `listResult` differs and settlement ignores it), leaving `filterCompletedRows`'s `duplicate_row` for genuine intra-tab dups; late completion updates stand as first-settlement with correction deferred to Stage 3. **No source-design defect.**

---

## 7. Deadline / Route-Budget Model

**The plan's central budget finding is correct and its fix is sound.** Verified: `producerDeadlineBudget` calls `createDeadline({startedAtMs: now()})` at `runner.ts:401/498` — **after** the `provideCandidateBatch()` discovery at `:381/478` — so today's ≤45 s budget covers only the batch, not source-load+discovery. `cronHandler`'s `started` (`:46`) is logging-only and not threaded into the job. The plan's §12 requires anchoring the deadline at **route/job entry** (before discovery) so source-load+discovery+batch+cleanup are all charged — an injected-clock/composition change, additive, no frozen change. **Correct.**

NON-BLOCKING OBSERVATION OB-2: the plan's explicit "pre-batch remaining-time check" is largely **subsumed** by the existing top-of-loop `shouldStartNext` guard in both batches — once the anchor moves to job entry, the first loop iteration already defers the entire batch if the budget is exhausted (`deferredByDeadline += all`). The essential change is therefore the **single anchor move**, not a second guard. → **RC-3** asks the implementation to pin *one* anchor point (job entry, top of `runWithLock` body, before discovery) rather than two overlapping mechanisms, and to keep the sub-budget split (source/discovery/batch/cleanup) explicitly provisional pending the 2E-B benchmark (§25) — no production numbers finalized without evidence, which the plan already states.

---

## 8. Lock / Single-Writer, Kill Switches, Rollback

- **Lock:** verified prod fail-closed (`requireDurable && NODE_ENV==="production"` + no/unreachable URL → `null` → skipped/409; never a memory degrade). Held across the whole locked body; released in `finally`; session-scoped (no stale-lock reaper needed); distinct keys prevent all overlap classes. `instances:1` holds single-writer structurally today; the durable lock makes scale-out safe (Gate D). **No bypass path exists.** Carry-forward H-1 (unlock-throw false-500) correctly deferred to hardening.
- **Kill switches:** request-time, next-fire semantics, never interrupt an in-flight append (the between-candidate guard is the only stop) — correct and consistent with Stage-2D RC-2.
- **Rollback:** flag-off stops future writes; append-only immutable/idempotent records are never deleted; corruption response (quarantine + chain-verify) correctly separated from rollback. **Reversible by config, no restart.** Sound.

---

## 9. Frozen Boundaries & Correction Firewall

**Preserved.** §30's file-change boundary is precise and matches the verified surfaces: additive-only (`config.ts`, new `activation/*`, new `dailyArchiveStrict.ts`, additive runner anchor, one-line route swaps, emit-only metrics, new tests/docs); untouched (M6 `capture.ts`/`mandatory-odds.ts`, M8 `settlement.ts`/`outcomes.ts`/`validation/*`, `types/evidence/*`, `ValidationRecord`/`EvidenceSnapshot`, identity/hash/revision/`settledAt`, NDJSON format, `locks.ts`/`metrics.ts` semantics, existing `readDailyArchive`). No schema, no migration. The **correction firewall** (§23) is enforced four ways (source static guard, composition never setting `correctionCause`, test group, review checklist), preserving the first-settlement-only invariant via M8's causeless-change→`invalid_input` backstop. Durable-diagnostics decision (§19: ephemeral sufficient for initial dry-run/canary; a durable store is a *separate* migration that would block full-write only if canary proves it necessary) is the correct, non-over-building call. **No frozen-boundary defect.**

---

## 10. Canary, Slicing, Capture Deferral

**Special Question E — deterministic first-N is safe against *permanent* ordering bias/starvation.** Selection is first-N under the provider's total order (settlement: `completionInstant` asc, tie `fixtureId`; capture: `capturedAt` asc). Because settled/captured fixtures are *excluded from the next discovery* (`settledFixtureIds`/`already_captured`), the window **advances FIFO-by-instant** — there is no fixed favoured subset, so no permanent bias and no steady-state starvation. Residual (NON-BLOCKING OB-3): a *tiny* canary ceiling under high arrival can throttle throughput during the bounded canary, so some fixtures' windows (esp. capture's pre-kickoff) could age out *during the canary* — inherent to any throttled canary, acceptable because canary is explicitly time-boxed (≥3 clean runs) and gated to FULL via the INV-S capacity check; recommend canary success criteria monitor `oldest_pending_age` against window expiry. No randomness, no entity-id labels — correct.

**Special Question F — capture full-write correctly deferred.** Verified: capture's source is `loadPublishedDailyPredictions` (daily-list predictions) and its `deriveCaptureInput` (M4-fetch+M5-derive) is an **unbuilt injected seam** — so capture DRY_RUN loads source but emits zero candidates and writes nothing until derivation exists. The completed-rows daily-archive reader is **settlement-only**; no capture write behaviour is implied by it. Settlement is correctly the near-term activatable path.

**Special Question G — five slices are small and independently reviewable**, each default OFF: (1) activation model — pure/dormant; (2) strict reader + adapter + settlement dry-run + entry anchor; (3) settlement canary/full + one-line route swap + reconciliation wiring; (4) capture dry-run; (5) runbook + gates. NON-BLOCKING OB-1: Slice 2 is the densest (it bundles the strict reader, the adapter, the dry-run composition, **and** the runner deadline-anchor); splitting the deadline-anchor into its own sub-slice would sharpen independent review, but bundling is acceptable since all four parts are additive and dormant.

---

## 11. Findings

**BLOCKER — none.**

**REQUIRED CLARIFICATION (3) — resolvable in the impl spec / acceptance criteria, no architecture change:**
- **RC-1 — Missing-expected-partition observability + path parity (ENOENT, Special Q B).** ENOENT→empty is correctness-safe, but the `process.cwd()`-relative `ARCHIVE_DIR` (R-3) means a release swap could silently ENOENT an *expected* partition → silent zero-count settlement. Pin: (a) Gate C/K verifies `saveDailyArchive` (writer) and the strict reader resolve the **identical absolute, release-stable path**; (b) add a bounded `source_partition_missing{job}` / `run_degraded` signal so a missing *expected* partition is observable, not a silent success.
- **RC-2 — Source-freshness classification.** §17 #5 references a `savedAt`/date freshness check but §9 does not pin the threshold or the classification of a *present-but-stale* archive. Pin the freshness threshold (relative to run date / scheduler cadence) and require a stale archive to raise an observable `run_degraded` (not a silent under-count), given settlement completeness tracks the archive refresh cadence.
- **RC-3 — Single entry anchor + structural dry-run no-write test.** Pin: (a) the deadline is anchored **once** at job entry (top of `runWithLock` body, before discovery) — the existing top-of-loop guard subsumes the separate "pre-batch check" (OB-2); (b) an acceptance test asserts `captureEvidenceSnapshot`/`ensureMandatoryCaptureOdds`/`settleLatestSnapshotForFixture` are **never invoked** on the DRY_RUN path (structural zero-write proof).

**NON-BLOCKING OBSERVATIONS (4):** OB-1 Slice-2 density (optional sub-split of the deadline anchor); OB-2 the "pre-batch check" is subsumed by the existing guard; OB-3 tiny-ceiling canary throughput throttling (monitor oldest-pending vs window expiry); OB-4 DRY_RUN under the durable lock requires prod DB provisioning (deliberate path-fidelity).

**STAGE 2E-B GATES (correctly deferred, not blocking 2E-A):** the §25 benchmark contract; FULL_WRITE ceiling-run < ≤45 s at representative depth; validation/retune of `reservePerCandidateMs`(250/120)/headroom(15 s); RSS/event-loop bounds (E/F).

**FUTURE-STAGE ITEMS:** live M4→M5 `deriveCaptureInput` (blocks capture writes); the correction stage (`currentValidationHeads`/`correctionCause`); H-1 unlock-500; fsync/chain-verify sweep; hung-reader timeout (RC-2 residual); durable job-run store *only if* canary proves ephemeral diagnostics insufficient; single-writer scale-out.

---

## 12. Validation Performed

This is a design review; no code or test was modified. I performed focused repository inspection (all `file:line` anchors in §2 read from the current tree) to verify — not assume — every current-state claim, the additive-surface non-existence, the six existing fail-open consumers, and the post-discovery deadline anchor. **No test suite, typecheck, or lint was run this session** (the plan changes nothing, so there is nothing new to validate at runtime); the Stage-2D-closure baseline (full suite green + typecheck 0 + lint clean) is the standing pre-activation state and is not re-asserted here as a fresh result. No numbers were fabricated.

---

## 13. Verdict

# STAGE 2E-A — CONDITIONALLY APPROVED

The activation design is repository-grounded, internally consistent, implementable with additive-only changes, dormant by default, fail-closed, reversible, and compatible with the current M9/M10 architecture. It correctly identifies its own three bounded dependencies (strict reader, entry-anchored deadline, dry-run composition), each with a real interface/owner/acceptance, and it preserves every frozen boundary and the first-settlement correction firewall. The three required clarifications (RC-1 missing-partition observability + path parity; RC-2 freshness classification; RC-3 single anchor + structural dry-run no-write test) are all resolvable in the implementation spec and acceptance criteria without changing the architecture; none is a blocker. Settlement is the correct near-term activatable path; capture full-write is correctly deferred to the unbuilt M4→M5 derivation stage; FULL_WRITE remains gated on the Stage-2E-B benchmark.

- **Verdict:** CONDITIONALLY APPROVED
- **Blocker count:** 0
- **Required clarification count:** 3 (RC-1, RC-2, RC-3)
- **Source-reader authority confirmed:** YES (authoritative for first-settlement; completeness tracks archive cadence with safe deferral, pin RC-1/RC-2 for visibility)
- **Strict-reader design acceptable:** YES (additive beside the fail-open reader; existing consumers untouched)
- **Dry-run zero-write structurally sound:** YES (write-capable batch never invoked; discovery is read-only; RC-3 adds the audit test)
- **Capture full-write deferral correct:** YES (settlement-only reader; capture derivation unbuilt)
- **Frozen boundaries preserved:** YES (additive-only; no M6/M8/schema/format/identity change)
- **Implementation slicing acceptable:** YES (five small default-OFF slices; OB-1 optional sub-split)
- **Stage 2E implementation design-authorized:** YES (conditionally — resolve RC-1/RC-2/RC-3 in the impl spec/acceptance criteria; no architecture change required)

**Confirmed:** NO runtime code modified · NO test modified · NO route modified · NO flag enabled · NO production reader wired · NO activation performed. The only file created is `docs/plans/m10-stage-2e-a-architecture-review.md`.
