# M10 Stage 2B — Capture Pipeline Wiring — Closure Record

**Document type:** Formal milestone closure (documentation-only). **No runtime code, test, route, flag, configuration, archive, database, scheduler, environment, or deployment was modified.** The only file created is this document.
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2B — Capture Pipeline Wiring**.
**Date:** 2026-07-30
**Governing spec:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1).

**Reviews reconciled (six independent implementation reviews + pre-implementation corpus):**
- `m10-stage-2b-implementation-review.md` — Implementation correctness → CONDITIONALLY APPROVED, no blocker.
- `m10-stage-2b-code-integration-review.md` — Code-level integration → CODE INTEGRATION APPROVED, no blocker.
- `m10-stage-2b-production-safety-review.md` — Production-safety / failure-mode → CONDITIONALLY PASSED, no blocker.
- `m10-stage-2b-implementation-performance-review.md` — Performance / scalability → CONDITIONALLY PASSED, no blocker.
- `m10-stage-2b-test-coverage-review.md` — Test & coverage → CONDITIONALLY APPROVED, no blocker.
- `m10-stage-2b-migration-compatibility-review.md` — Migration / frozen-contract → COMPATIBLE, no blocker.
- Pre-implementation inputs also read: `m10-stage-2b-capture-integration-review.md`, `m10-stage-2b-capture-failure-review.md`, `m10-stage-2b-performance-review.md`, `m10-stage-2b-test-plan.md`, `m10-stage-2b-architecture-review.md`, `m10-stage-2b-capture-pipeline-wiring.md`, `m10-stage-2a-implementation-review.md` (`m10-stage-2a-closure.md` does not exist).

---

## 1. Closure Summary

Stage 2B wires the **capture** producer into the live capture runner behind an injectable, dormant seam:

```
Archive State (Stage 2A strict single read) → Stage 1 Capture Provider → CaptureRequest[] → M6 Capture Runner
```

The change-set is **five files** (2 created, 3 modified additively) and is confirmed by all six reviewers to touch **no frozen contract, no archive format, no identity/hash/revision formula, no route, no flag, no lock, and no settlement code**. Discovery executes **inside the durable job lock** (INV-L); strict archive reads are **fail-closed** (a corrupt read → `failed`, never an empty success); the **single-bounded-read Stage-2A builders are reused** (verified 1 snapshot + 1 odds read/run, no O(F²)); the M9 empty-safe default and flag short-circuit are preserved; the cron route is unchanged and remains a dormant M9 empty pass. The M4→M5 derivation is left as a **required injected seam** — no live activation.

**Six-way reviewer consensus: no Stage 2B blocker; the dormant slice is safe to merge and close.** Every conditional verdict is conditioned only on later-stage activation gates, none on a Stage-2B defect. Validation is green on every axis (full suite **1769/1769**, typecheck exit 0, lint clean).

**Final status:**

# STAGE 2B COMPLETE — DORMANT CAPTURE WIRING

This closure explicitly does **not** claim production-activation readiness, complete M10 readiness, a complete live candidate pipeline, settlement support, correction support, deadline enforcement, or capacity readiness.

---

## 2. Implemented Scope

Verified present and correct across all six reviews:

1. **Concrete strict read port** — `createFileCaptureReadPort(env?)` (`lib/evidence-capture/candidates/capture-pipeline.ts`): returns a `CaptureArchiveReadPort` backed by the durable NDJSON adapters, resolving snapshots and `<evidenceDir>/odds-archive/records.ndjson` from the same `resolveEvidenceArchiveDir(env)`.
2. **Capture producer** — `produceCaptureRequests(deps, config)`: loads the daily-list source and builds capture archive state via the Stage-2A `buildCaptureArchiveState` (both concurrently), then runs the pure Stage-1 `buildCaptureCandidates` to classify → order → cap → assemble `CaptureRequest[]` through the injected `deriveCaptureInput`.
3. **Two additive strict whole-archive readers** — `readAllSnapshotsStrict(env?)` (`lib/archive/evidence/file.ts`, reuses `readNdjson`) and `readAllOddsRecordsStrict(recordsFile)` (`lib/evidence-capture/odds-archive/file.ts`, the store's `readAll` extracted to module scope; the closure now delegates — byte-identical behaviour).
4. **Runner seam** — optional `provideCandidates?: () => Promise<readonly CaptureRequest[]>` on `runEvidenceCaptureJob`, invoked **inside** `runWithLock`'s held-lock callback; absent ⇒ the M9 `candidates ?? []` empty-safe path is preserved verbatim.
5. **Tests** — `tests/evidenceCapturePipeline.test.ts` (9): producer (empty→admitted request with correct `capturedAt`; complete pair→`already_captured`; snapshot-only→heal; `leadMinutes` default; strict-read throw→reject) and runner seam (invoked once + threaded; static-candidates back-compat; rejecting producer→`failed`; disabled flag→no discovery).

---

## 3. Explicitly Excluded Scope

Confirmed absent by all reviewers (route dormant, no leakage):

- **Settlement wiring** — `runPredictionSettlementJob` untouched; no `SettlementCandidate` assembly; no `readAllValidations` reader added.
- **Live activation** — the cron route is unchanged; nothing composes `provideCandidates` in production; the async M4→M5 derivation is an injected seam only.
- **Deadline enforcement (INV-D)** — no effective-deadline clamp, no mid-batch remaining-time guard, no `AbortSignal` into M4.
- **Diagnostics aggregation** — the provider's `CandidateDiagnostics` are returned but not merged into `resultCounts`/metrics; no `backlog`/`oldest_pending_age`/`rejected_<reason>` counters wired.
- **Replay / concurrency machinery** — no replay harness; no new overlap/multi-worker handling (the durable lock is the pre-existing M9 mechanism, reused).
- **Cron / feature-flag / scheduler / configuration / deployment changes** — none.

---

## 4. Review Verdict Reconciliation

| Review | Verdict | Blocker? | Basis (independently re-verified this pass) |
|---|---|---|---|
| Implementation | CONDITIONALLY APPROVED | No | 4-box wiring correct; INV-L + strict reads + PB-1 reuse demonstrated; conditions are activation-gated design/coverage items. |
| Code integration | APPROVED | No | Call-chain traced; seam inside lock; strict readers not fail-soft-wrapped; adapter extraction byte-faithful; barrel stays client-safe. |
| Production safety | CONDITIONALLY PASSED | No | All 26 evaluated failure modes → `failed`/`deferred`/`safe no-op`/`retryable partial`; never corruption/false-success/duplicate/starvation. |
| Performance | CONDITIONALLY PASSED | No | Prior single-read-vs-per-fixture conflict (PB2B-1) **resolved** — instrumented 1+1 reads; no regression; whole-route benchmark deferred. |
| Test coverage | CONDITIONALLY APPROVED | No | Safety-critical behaviours directly proven; two in-scope regression gaps (concrete port, in-lock ordering) are conditions, not blockers. |
| Migration / contract | COMPATIBLE | No | Five-file additive diff (mtime-confirmed); zero frozen-contract change; no migration; reversible; Postgres-forward port. |

**Reconciliation (not a copy of verdicts):**
- **Unanimous on the load-bearing invariants** — INV-L (discovery in-lock), fail-closed strict reads, single-bounded-read reuse, INV-A no-cursor, additive/back-compat, frozen contracts unchanged — each is demonstrated by **code + test**, not comment. This is the decisive evidence for closure.
- **The five "CONDITIONALLY" qualifiers do not overlap on any Stage-2B defect.** They point exclusively at *later-stage activation gates* (deadline, live derivation, benchmark, diagnostics, overlap/replay) and at *in-scope test-coverage completions* (concrete-port test, in-lock ordering test). None is a runtime defect in the dormant slice.
- **One nuance requiring explicit reconciliation — partial-pair completeness granularity.** The implementation review raised that Stage-2A completeness is keyed **per-window** (`≥1` mandatory `evidence_capture` odds row), whereas the pre-implementation *capture-failure* review (PP-2) argued for **per-market** completeness. The production-safety review inspected the actual code this pass and rated partial-pair recovery **PASS** (a snapshot with *no* mandatory odds → `partialWindowKeys` → heal; the PP-4 "complete-as-partial" trap for the zero-odds case is closed). The residual per-market question (a snapshot committed with *some but not all* markets' odds — only reachable via a crash mid-C5 loop + re-fire) is **not a consensus blocker**; it is recorded as a pre-live-activation verification item (§10, CF-S2), not a Stage-2B blocker. The dominant view (5 of 6 reviewers, and the reviewer who ran the actual code) is that partial-pair handling is correct for the dormant stage.
- **No dissent on closure:** all six reviewers independently state "Stage 2B may close: YES" (or the equivalent "no runtime remediation required / no blocker").

---

## 5. Invariant Evidence

| Invariant | Evidence (code + test) | Status |
|---|---|---|
| **INV-L — discovery inside the durable lock** | `provideCandidates()` is awaited inside `runWithLock`'s callback (`runner.ts:298,304-306`), which runs only after `tryAcquireJobLock` returns held; flag check precedes the lock. Test: *disabled flag short-circuits before discovery* (`calls===0`); structural anchor: M9 held-lock-forces-skip (`m9Activation.test.ts`). | **Honoured** (direct in-lock ordering test is a §7 non-blocking condition) |
| **Strict, fail-closed reads** | Port reuses `readNdjson` / extracted `readAll` (ENOENT→[]; malformed/EACCES/EPERM/EIO/other/conflict→throw); Stage-2A builders never catch; `produceCaptureRequests` never catches; runner maps a rejection to `failed`. Test: *strict archive-read throw propagates (fail-closed, never empty)* + *rejecting provideCandidates fails the run*. | **Honoured** |
| **ENOENT-only empties; everything else throws** | Verified in `readAllSnapshotsStrict`→`readNdjson` and `readAllOddsRecordsStrict` (incl. `verifyOddsRecord` + same-id/different-hash conflict throw). | **Honoured** |
| **Single-bounded-read Stage-2A path** | `produceCaptureRequests` → `buildCaptureArchiveState` (`Promise.all([readAllSnapshots, readAllOddsRecords])`); no `listSnapshots` fixture loop in discovery. Performance review instrumented **1 + 1** reads. | **Honoured** |
| **M9 empty-safe behaviour** | `options?.provideCandidates ? … : (options?.candidates ?? [])`; bare fire → `[]`. Test: *static candidates path still works*; full M9 suite (18+11) green. | **Preserved** |
| **Route dormant** | `app/api/internal/cron/evidence-capture/route.ts` byte-unchanged (`handleCronPost(req, () => runEvidenceCaptureJob())`). | **Preserved** |
| **No settlement wiring** | `runPredictionSettlementJob` untouched; no validations reader. | **Confirmed** |
| **No deadline/activation leaked** | No deadline math, no `AbortSignal`, no route/flag/scheduler change. | **Confirmed** |
| **Frozen contracts + archive formats unchanged** | mtime-confirmed five-file diff; `types/evidence/*`, store interfaces, identity/hash formulas, NDJSON format byte-unchanged; typecheck exit 0. | **Confirmed** |
| **INV-A — archive is the sole checkpoint** | No cursor/offset/cache added; progress rebuilt each pass from the archive (grep-clean). | **Honoured** |

---

## 6. Validation Results

Re-run this pass (2026-07-30); exact commands and totals:

| Check | Command | Result |
|---|---|---|
| Stage-2B pipeline | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceCapturePipeline.test.ts` | **9 pass / 0 fail / 0 skip** |
| Stage-2A archive-state | `… --test tests/evidenceArchiveStateBuilders.test.ts` | **25 pass / 0 fail / 0 skip** |
| Stage-1 capture provider | `… --test tests/evidenceCandidateProvider.test.ts` | **48 pass / 0 fail / 0 skip** |
| M6 capture mint | `… --test tests/evidenceCaptureMint.test.ts` | **14 pass / 0 fail / 0 skip** |
| M9 activation (C1–C7) | `… --test tests/m9Activation.test.ts` | **18 pass / 0 fail / 0 skip** |
| M9 concurrency / lock | `… --test tests/m9Concurrency.test.ts` | **11 pass / 0 fail / 0 skip** |
| Full suite | `npm test` | **1769 pass / 0 fail / 0 skip** |
| Typecheck | `npm run typecheck` (`tsc --noEmit -p tsconfig.typecheck.json`) | **clean — exit 0** |
| Lint | `npm run lint` (`next lint`) | **clean — no ESLint warnings or errors** |

Baseline continuity: Stage 2A closed at 1760/1760; Stage 2B adds +9 → **1769/1769**. No flakiness observed.

---

## 7. Stage 2B Non-blocking Cleanup

*Optional; may land now or in the next sub-stage. None blocks closure.*

| # | Item | Source | Classification |
|---|---|---|---|
| CL-1 | Dead/ineffective `void evidenceArchivePaths(env)` "defensive touch" — the resolver never throws, so it cannot "fail fast"; remove or correct the comment. | code-integration NB-1 | Stage 2B optional cleanup |
| CL-2 | Eager/lazy path-resolution asymmetry in `createFileCaptureReadPort` (odds eager, snapshots lazy); resolve both symmetrically to make the single-archive guarantee structural. | code-integration NB-2 | Stage 2B optional cleanup |
| CL-3 | Document/assert `candidates` vs `provideCandidates` precedence (producer wins; static ignored) and the contract that live discovery must pass *through* `provideCandidates` (not be pre-invoked outside the lock). | code-integration NB-3; impl-review | Stage 2B optional cleanup |
| CL-4 | Relocate the impure, server-only `capture-pipeline.ts` (`fs`/`process.env`) out of the pure `candidates/` layer (e.g. to `lib/evidence-capture/jobs/`) so the determinism static rule can stay clean. | impl-review NB-2 | Stage 2B optional cleanup |
| CL-5 | Guard the exported `readAll*Strict` readers against per-fixture misuse (JSDoc contract present; consider surfacing only via the port). | performance R1 | Stage 2B optional cleanup |
| CL-6 | Add a concrete `createFileCaptureReadPort` test over a temp NDJSON dir (ENOENT→empty; malformed/EACCES/EIO/snapshot-hash-conflict/odds-hash-conflict → throw *through the port*). | test-coverage A-1/M-2; impl-review NB-4 | Stage 2B optional cleanup (test) |
| CL-7 | Add an explicit held-lock ordering/contention test (held `job:evidence_capture` → concurrent run `skipped` **and** `provideCandidates` never called). | test-coverage A-2/M-1 | Stage 2B optional cleanup (test) |
| CL-8 | Add source-load-failure and (once live) derivation-failure tests (`loadSource` rejection → producer reject → runner `failed`). | test-coverage B-3/M-3 | Stage 2B optional cleanup (test) |
| CL-9 | Add a deterministic repeated-production test at pipeline grain (call twice → byte-identical `candidates`). | test-coverage B-6/M-6 | Stage 2B optional cleanup (test) |
| CL-10 | Add a concrete producer-as-callback integration test (compose `produceCaptureRequests` as `provideCandidates` → strict-throw→reject→`failed` end-to-end). | test-coverage B-7 | Stage 2B optional cleanup (test) |
| CL-11 | Provider diagnostics are dropped at the seam (only the candidate array is threaded). Documentation/observation now; the *reconnection* (aggregation) is Stage 2D. | code-integration NB-4; safety CF-6 | Stage 2B optional cleanup (note) → aggregation is Stage 2D |
| CL-12 | A rejecting producer surfaces the generic `errorCode:"unhandled"`; a specific `archive_read_failed`/`source_load_failed` classification is deferred with diagnostics. | code-integration NB-4; safety §7 | Stage 2B optional cleanup (note) → specific codes are Stage 2D |

---

## 8. Stage 2C Carry-forward (Settlement Pipeline Wiring — the next authorized milestone)

*These are Stage 2C requirements. They mirror the capture wiring for the settlement path.*

| # | Requirement | Source |
|---|---|---|
| C-1 | Settlement producer wiring — a `produceSettlementCandidates` + a symmetric `provideCandidates` seam on `runPredictionSettlementJob`, inside the durable `job:prediction_settlement` lock. | migration §7; safety; impl-review |
| C-2 | Consume Stage-2A `currentValidationHeads` (the MC-1 enrichment) for current-outcome-per-(fixture, market) state. | migration §7/§11 (MC-1) |
| C-3 | Genuine correction detection — set `correctionCause` **only** when `head.state !== outcome.state`. | migration §7; MC-1 |
| C-4 | No false `correctionCause` — an unchanged terminal outcome must be `already_settled`/`no_change` (never `invalid_input`, never a gratuitous revision). | migration §7; forward-compat FC/CF-5 |
| C-5 | Derive settlement state from **existing `ValidationRecord` fields only** — no new column. | migration §4/§11 (MC-1) |
| C-6 | **No archive-format evolution** — settlement wiring writes only frozen M8 records. | migration §7/§9 |
| C-7 | First-settle completeness preserved — lifecycle terminals (`postponed`/`cancelled`/`abandoned`) must be fed through (BF-S1 regression guard). | test-plan IN-9; migration §7 |

---

## 9. Stage 2D Carry-forward (Operational Controls)

*These gate a *useful* live run and must land with (or before) live activation.*

| # | Requirement | Source |
|---|---|---|
| D-1 | **INV-D effective deadline ≤ 45 s** — `min(configured, 60_000 − HEADROOM)`; never the 300 s `runDeadlineMs`; pass the clamped deadline into `orchestrateFetches`. | safety G-1; performance §6; CF-1 |
| D-2 | **Mid-batch remaining-time guard** — start no candidate without sufficient remaining budget; overflow → `deferred_by_deadline` (counted). | safety G-1; test-plan DL-4 |
| D-3 | **Ceilings: default 100 / max 150** — already fail-safe in the Stage-1 provider (`normalizeBatchLimit`); wire the configured value at the call site and confirm it can never reach 500/unbounded writes. | INV-C; performance |
| D-4 | **Bounded source classification** — `loadPublishedDailyPredictions`/grouping is O(D) unbounded by the ceiling; bound or budget the classification compute. | performance R6; safety CF-7 |
| D-5 | **Diagnostics aggregation** — merge the provider's `CandidateDiagnostics` into `resultCounts`/metrics (closed, low-cardinality; no entity id as a label). | safety G-6; CF-6 |
| D-6 | **Specific failure codes** — replace the generic `unhandled` discovery-failure code with `archive_read_failed`/`source_load_failed`, etc. | safety G-6 |
| D-7 | **Backlog + oldest-pending observability** — surface `backlog_size` and `oldest_pending_candidate_age` so the INV-S capacity gate is checkable. | spec §10; safety G-6 |
| D-8 | **Live async M4→M5 derivation behind `deriveCaptureInput`**, with **per-fixture fault isolation** (map every fault to `{ok:false, reason}` — never throw, else it aborts the batch). *(Live-derivation wiring; scheduled with the operational controls as a pre-activation prerequisite.)* | safety G-2; CF-2; performance §6 |

---

## 10. Stage 2E Activation Gates (Safety & Verification)

*These MUST be closed before any caller wires `provideCandidates` into the live cron route with flags on.*

| # | Gate | Source |
|---|---|---|
| E-1 | **Unlock-throw false-500 remediation (H-1)** — swallow/log `pg_advisory_unlock` throw so a successful idempotent run is not reported as 500. | safety G-4/CF-4; carried from M9 |
| E-2 | **Concurrency / overlap verification** — two concurrent fires → one runs, the other `skipped`/`lock_unavailable`/**409 (never 500)**, loser does no discovery/read; no duplicate mint. | safety G-3; test-plan IN-16/B6 |
| E-3 | **Crash / replay testing** — interrupt after N of M → N committed (each with mandatory odds), re-fire completes M−N with no loss/duplicate; no cursor. | safety G-7; test-plan RE-5/B7 |
| E-4 | **Route wiring tests** — when the route calls a live job: auth/rate-limit/status-map unchanged; flag-off does no discovery; reads fire only after the lock. | safety G-8; test-plan IN-12/IN-13 |
| E-5 | **Representative-depth benchmark (Gate B5)** — capture at the ceiling against representative accumulated archive depth completes < 45 s (hence < 60 s route budget); document per-fixture cost + sub-budget. | performance §6; safety G-1; test-plan DL-8 |
| E-6 | **RSS / event-loop-delay benchmarks** — quantify the synchronous whole-file parse (measured ~6 s/100 k snapshots) and GB-scale RSS on the single fork; (recommended) stream the discovery read. | performance §3–§6 (R2/R3) |
| E-7 | **Large-archive capacity gate** — enforce/observe a depth ceiling below the ~357 k-record / ~512 MB `fs.readFile` string wall (measured 500 k → unreadable), with a ~50 k-line / ~10 MB warn threshold. | performance §6; migration §9 (MC-4) |
| E-8 | **Torn-write / fsync / quarantine strategy** — the whole-file read means one torn/malformed line fails all fixtures (fail-closed availability event); fsync-on-append (or documented acceptance) + scheduled `verifyEvidenceChain` sweep + line-level quarantine. | safety G-5/CF-5 |
| CF-S2 | **Partial-pair completeness granularity** — confirm/resolve per-window (`≥1` mandatory odds) vs per-market completeness before live capture; only reachable via a crash mid-C5 + re-fire; **not a consensus blocker** (production-safety rated partial-pair recovery PASS). | impl-review NB-3 vs capture-failure PP-2 (reconciled §4) |

---

## 11. Future Adapter and Migration Concerns

*Out of M10; forward obligations of the eventual reversible Postgres cutover. Non-format-changing.*

| # | Concern | Source |
|---|---|---|
| FA-1 | `createFileCaptureReadPort` **bypasses the `EVIDENCE_ARCHIVE_ADAPTER` choke-point** that the write stores honor. Today production is file-only for both, so they agree; the M6 full-stream pre-check backstops correctness even under a mismatch (e.g. `memory` in tests → discovery under-reports, never a duplicate mint). | migration SC-1 |
| FA-2 | The future Postgres (and memory) cutover **must resolve the read port and write store through the same adapter** — inject a matching read port via the existing `readPort` seam, or add a `getCaptureReadPort()` resolver keyed on the same env — so read/write cannot diverge. The port abstraction (`CaptureArchiveReadPort`, typed domain objects, no NDJSON/offset in the signature) is already the correct forward seam; a `createPostgresCaptureReadPort` implements it with no contract change. | migration SC-1; §6 |
| FA-3 | **Shared archive-path resolution** — the port recomputes `<evidenceDir>/odds-archive/records.ndjson` rather than reusing the store's resolver (equal today; two copies of the convention). Consolidate behind one resolver at the cutover so a path change cannot desync read/write. | migration SC-2 |
| FA-4 | Retention/compaction must remain **append-only-safe** (cold-archive only, never prune within the replay/checkpoint horizon); Stage 2B assumes no pruning. Hash-faithful TEXT timestamps in the PG map (carried G5). | migration §9 (MC-4); §6 |

---

## 12. Final Closure Decision

**STAGE 2B COMPLETE — DORMANT CAPTURE WIRING.**

The evidence supports every closure criterion:
- capture pipeline wiring implemented ✅
- discovery executes inside the durable lock (INV-L) ✅
- strict reads are fail-closed (ENOENT-only empty; else throw → `failed`, never empty success) ✅
- single-bounded-read Stage-2A path is used (instrumented 1+1) ✅
- M9 empty-safe behaviour remains ✅
- route remains dormant ✅
- no settlement wiring exists ✅
- no deadline/activation work leaked in ✅
- frozen contracts and archive formats are unchanged (mtime-confirmed additive diff) ✅
- tests (1769/1769), typecheck (exit 0), and lint (clean) are green ✅

**Blockers remaining: none.** All six independent reviews concur that no Stage-2B blocker exists and no runtime remediation is required to merge and close the dormant slice. The carry-forward register (§7–§11) is normalized and each item is classified as Stage 2B optional cleanup, a Stage 2C requirement, a Stage 2D requirement, a Stage 2E activation gate, or a future adapter/migration concern — with the explicit understanding that **not every reviewer recommendation is a blocker**.

This closure makes **no** claim of production-activation readiness, complete M10 readiness, a complete live candidate pipeline, settlement support, correction support, deadline enforcement, or capacity readiness.

---

## 13. Next Authorized Milestone

**M10 Stage 2C — Settlement Pipeline Wiring.**

Stage 2C mirrors Stage 2B on the settlement axis: a strict `SettlementArchiveReadPort`, a `produceSettlementCandidates` producer consuming the Stage-2A `currentValidationHeads` enrichment (MC-1), and a symmetric `provideCandidates` seam on `runPredictionSettlementJob` inside the `job:prediction_settlement` durable lock — first-settle plus genuine-correction detection, from existing `ValidationRecord` fields only, with no archive-format evolution (§8, C-1…C-7).

**Stage 2C implementation MUST NOT start** until its own preparation reviews — architecture, integration, safety, performance, test, and compatibility — are authored and reconciled, exactly as Stage 2B was prepared before implementation. The Stage 2D operational controls (§9) and the Stage 2E activation gates (§10) remain prerequisites to any *live* activation of either the capture or settlement path and are not unlocked by this closure.

---

### Statement

Documentation-only closure. The single file created is this document. **No runtime code, no test, no route, no feature flag, no configuration, no archive, no database, no scheduler, no environment, and no deployment was modified.** All cited results (targeted suites, full suite 1769/1769, typecheck exit 0, lint clean) were re-run against the current repository this pass; the six reviewer verdicts were read in full and reconciled rather than copied.
