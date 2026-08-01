# M10 Stage 2B — Capture Pipeline Wiring — Implementation Review

**Reviewer:** Primary Independent Implementation Reviewer (Stage 2B).
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2B — Capture Pipeline Wiring**.
**Type:** Read-only implementation review. **No runtime code, test, contract, route, flag, configuration, archive, environment, or deployment was modified.** The only file created is this document.

**Charter (verbatim scope for this stage):** Stage 2B must correctly implement **ONLY** `Archive State → Stage 1 Capture Provider → CaptureRequest[] → M6 Capture Runner`, and must **remain dormant at the route** — it must NOT implement settlement wiring, live activation, cron changes, feature-flag changes, deadline enforcement, diagnostics aggregation, replay machinery, concurrency machinery, scheduler changes, or deployment changes.

**Inputs read (complete):** the M10 spec (Rev A1); the Stage-2A archive-normalization record + its implementation review; the Stage-2B capture-integration, capture-failure, performance, test-plan, and architecture/forward-compat reviews; the Stage-2B capture-pipeline-wiring record; and the Stage-2 production-safety / performance-scalability / migration-compatibility reviews.

**Code inspected (on-disk, this pass):** `lib/evidence-capture/candidates/capture-pipeline.ts`; `lib/archive/evidence/file.ts`; `lib/evidence-capture/odds-archive/file.ts`; `lib/jobs/runner.ts`; `lib/evidence-capture/candidates/archive-state/{types,normalize,builders,index}.ts`; `lib/evidence-capture/candidates/capture-provider.ts`; `lib/evidence-capture/candidates/{eligibility,types,index}.ts`; `lib/evidence-capture/jobs/capture-run.ts`; `lib/evidence-capture/capture/mandatory-odds.ts`; `lib/evidence-capture/source.ts`; `app/api/internal/cron/evidence-capture/route.ts`; `tests/evidenceCapturePipeline.test.ts`; `tests/evidenceArchiveStateBuilders.test.ts`.

---

## 1. Executive Summary

# STAGE 2B IMPLEMENTATION CONDITIONALLY APPROVED

Stage 2B ships a small, dormant, correct **capture-only** wiring layer that connects the four charter boxes and nothing else. It is green on every axis (targeted 9/9; full suite **1769/1769**; typecheck exit 0; lint clean) and every load-bearing invariant that applies to a *dormant structural wiring stage* is demonstrated by code and/or test rather than asserted by comment:

- **INV-L** — the producer is invoked through a `provideCandidates` callback that runs **inside** `runWithLock`'s held-lock closure (`runner.ts:298,304`); the flag check still precedes the lock; a disabled fire never discovers (test: *disabled capture flag short-circuits before discovery*).
- **Strict, fail-closed reads** — the concrete port reuses the frozen adapters' strict readers verbatim (`readNdjson` / the extracted odds `readAll`); a read throw propagates through `buildCaptureArchiveState` → `produceCaptureRequests` → the runner, which reports `failed` (test: *a rejecting provideCandidates fails the run*).
- **Single bounded read (PB-1)** — discovery calls the Stage-2A `buildCaptureArchiveState` (two whole-archive reads, classify in memory); **no** per-fixture loop, **no** O(F²) path — the single most important performance decision, made correctly.
- **Archive is the sole checkpoint** — no cursor/offset/cache/process-local progress added (grep-clean).
- **Additive & backward-compatible** — `provideCandidates` preserves the M9 `candidates ?? []` default (test: *static candidates path still works*); the route is untouched and a bare fire remains an empty, safe pass; M6 (`runCaptureBatch`/`captureEvidenceSnapshot`/`ensureMandatoryCaptureOdds`) and every frozen contract are unmodified.
- **Honest scoping** — the M4→M5 derivation is presented as an **injected seam**, never as live wiring; the doc and code are accurate about what is and is not built.

The verdict is **conditional, not unconditional**, because of design-boundary deviations from the pre-implementation reviews and coverage gaps that are non-blocking for the dormant stage but **must be resolved before activation** (Stage 2C): (i) the concrete read port reaches into the file-adapter *module* rather than a store *interface* method, which is not Postgres-forward and decouples the read port from the write store instance (latent DB-2); (ii) the impure `capture-pipeline.ts` (fs + `process.env`, server-only) is placed under the *pure* `candidates/` layer, weakening the determinism-guard boundary; (iii) partial-pair completeness is window-level (`≥1` mandatory odds row), not per-market, so a crash-produced partial-markets snapshot could be mis-classified complete and never healed (a DoD-5 gap inherited from approved Stage 2A, with a documented cross-review conflict); (iv) test gaps: no composed end-to-end `produceCaptureRequests → runEvidenceCaptureJob` test, and the concrete `createFileCaptureReadPort` is never exercised against real files.

None of these breaks the dormant stage at rest; all are activation-gated or quality conditions. **No blocking finding.**

---

## 2. Exact Change-Set Review

No git is available (`not a git repository`); the change-set was reconstructed from the Stage-2B record and confirmed by on-disk inspection against the Stage-2A/M9 baselines.

**Created:**
| File | Purpose | Assessment |
|---|---|---|
| `lib/evidence-capture/candidates/capture-pipeline.ts` | `createFileCaptureReadPort` (concrete strict port) + `produceCaptureRequests` (producer) + `CapturePipelineDeps`/`CapturePipelineConfig` | Correct wiring; two design notes (§9, §12) |
| `tests/evidenceCapturePipeline.test.ts` | 9 unit tests (producer + runner seam) | Real seams exercised; two coverage gaps (§10) |
| `docs/plans/m10-stage-2b-capture-pipeline-wiring.md` | Stage-2B implementation record | Accurate (§ Documentation) |

**Modified (additive, behaviour-preserving):**
| File | Change | Assessment |
|---|---|---|
| `lib/archive/evidence/file.ts` | +`readAllSnapshotsStrict(env?)` delegating to the existing private `readNdjson` | Additive; no existing function changed |
| `lib/evidence-capture/odds-archive/file.ts` | Extracted the closure `readAll` body to module-level `readAllOddsRecordsStrict(recordsFile)`; the closure now delegates `readAll = () => readAllOddsRecordsStrict(RECORDS_FILE)` | **Verified byte-faithful** — identical logic, parameterized by `recordsFile`; every branch (ENOENT→[], errno→throw, malformed→throw, `verifyOddsRecord`→throw, conflict→throw, dedup) preserved |
| `lib/jobs/runner.ts` | +optional `provideCandidates?` on `runEvidenceCaptureJob`, invoked inside `runWithLock`; `candidates ?? []` fallback preserved | Additive; M9 path unchanged |

**Unchanged and verified untouched:** `capture-provider.ts`, `archive-state/**`, `capture-run.ts` and the frozen M6 core, `mandatory-odds.ts`, the cron route (`route.ts` still `handleCronPost(req, () => runEvidenceCaptureJob())`), `config.ts` (flag/ceiling defaults), `locks.ts`, `cronHandler.ts`, and every `types/evidence/*` / store-interface / identity / hash / revision / archive-format surface. The `prediction_settlement` path is entirely untouched.

---

## 3. Scope Compliance

**PASS — the deliverable implements only the four charter boxes and nothing excluded.**

- Capture-only: `capture-pipeline.ts` and the runner change touch only the capture job. `runPredictionSettlementJob` and all settlement code are unmodified. ✅ *(no settlement wiring)*
- Route/flags/scheduler/deployment untouched: the cron route is byte-identical; `EVIDENCE_CAPTURE_ENABLED` authority and default-off are unchanged; no scheduler/deploy artifact added. ✅ *(no live activation, no cron/flag/scheduler/deployment change)*
- No deadline enforcement: `produceCaptureRequests` computes no `effectiveJobDeadlineMs`, passes no `AbortSignal`, and adds no `deadline?` guard to `runCaptureBatch`. ✅ *(no deadline enforcement — correctly deferred)*
- No diagnostics aggregation: the producer returns the provider's own `CandidateDiagnostics` verbatim; the runner still emits only the pre-existing `emitOutcomeMetrics("capture", counts)`; no `rejected_<reason>`/`backlog`/`oldest_pending_age` merge was added. ✅ *(no diagnostics aggregation)*
- No replay/concurrency machinery: no replay harness, no multi-worker/overlap handling added (the durable lock is the pre-existing M9 mechanism, reused, not extended). ✅

The derivation (M4 fetch + M5 derive) is left as the required injected `deriveCaptureInput` seam — consistent with the charter and with the fact that the frozen M4 fetchers are dormant and the Stage-1 derivation dependency is synchronous. This is **not** a scope violation; it is the honest boundary. **PASS.**

---

## 4. INV-L and Lock-Boundary Review

**PASS (demonstrated by code structure + tests), with one explicit-ordering test gap.**

- `runEvidenceCaptureJob` performs the cheap flag check *before* the lock (`runner.ts:295`), then `return runWithLock("evidence_capture", async (job) => {…})`. `runWithLock` acquires the durable lock (`tryAcquireJobLock`, `requireDurable:true`, prod-fail-closed) **before** invoking the callback (`runner.ts:74,99`). Inside the callback, `const candidates = options?.provideCandidates ? await options.provideCandidates() : (options?.candidates ?? [])` (`runner.ts:304-306`). Therefore any discovery performed by the injected callback runs strictly **inside the held lock** — INV-L is satisfied by construction, not by comment.
- Because discovery is composed by the *caller* (the callback), the runner itself neither reads the source nor builds the port; the whole producer (`produceCaptureRequests`) executes within the callback when a caller passes it. This is a valid, minimal realisation of INV-L that keeps the runner a thin lifecycle/flag/lock shell.
- Tests demonstrate the seam: *disabled flag short-circuits before discovery* (callback never called when disabled → discovery cannot precede the flag/lock), and *provideCandidates invoked once and threaded to the batch* (callback runs and its output reaches `runCaptureBatch`).
- **Gap (non-blocking):** there is no dedicated spy test proving lock-acquired-**then**-discover ordering with the *real* `produceCaptureRequests`, nor an inside-lock probe (the test-plan's IN-1/IN-2). The ordering is guaranteed by `runWithLock`'s structure, but the end-to-end "real producer inside the lock" is asserted from code shape, not a test. Recommended to add in Stage 2C.

The pre-implementation integration review recommended a runner-owned `discover?` seam that builds the port from `deps` and captures one `evalInstant`; the implementation instead uses a caller-composed `provideCandidates`. This is a defensible, thinner alternative for a dormant stage, but it pushes the "same store instance for read and write" (DB-2) binding to the (as-yet-unwritten) composition site — see §7/§9.

---

## 5. Strict Archive-Read Review

**PASS.**

- **ENOENT → empty; everything else → throw.** `readAllSnapshotsStrict` (`evidence/file.ts`) delegates to the unchanged `readNdjson`: ENOENT→`[]`; `EACCES/EPERM`→throw; `EIO/EBUSY/ENXIO/ENODEV`→throw; any other errno→throw; malformed NDJSON line→throw. `readAllOddsRecordsStrict` (`odds/file.ts:74-122`, extracted verbatim): ENOENT→`[]`; other errno→throw; malformed line→throw; `verifyOddsRecord` failure→throw; same-id/different-hash on-disk conflict→throw; byte-identical duplicates collapse. **Requirement #4 satisfied.**
- **No fail-soft path is used.** The port does **not** route through the fail-soft service view (`getEvidenceHistoryView`/`loadEvidenceHistory`, which catch→empty). It reuses the strict adapter reads directly, so a corrupt/unreadable archive can never be masked as "no history / zero candidates" (SC-1/AR-0/DR-6).
- **Never-catch propagation.** `buildCaptureArchiveState` (`archive-state/builders.ts`) is `Promise.all([readAllSnapshots(), readAllOddsRecords()])` → normalize, with no `try/catch`; `produceCaptureRequests` does not catch; the runner's `runWithLock` catch converts a throw to `status:"failed"`. Proven end-to-end by the pipeline test *strict archive-read throw propagates (fail-closed, never empty)* and the runner test *a rejecting provideCandidates fails the run* (status `failed`, not empty success).
- **Conflict fail-closed.** `normalizeCaptureArchiveState` additionally throws `ArchiveStateConflictError` on a same-id/different-hash snapshot (the snapshot whole-file read does not itself dedup) — the fail-closed backstop, exercised via the builder in the Stage-2A suite. **Requirement #3 satisfied.**

---

## 6. Capture Pipeline Correctness

**PASS for the wiring; one inherited heal-granularity gap (§ Non-blocking).**

- **Composition.** `produceCaptureRequests` loads the source (default `loadPublishedDailyPredictions`), builds capture archive state via the Stage-2A `buildCaptureArchiveState` (both concurrently), then runs the pure Stage-1 `buildCaptureCandidates(input, { deriveCaptureInput })`, returning `{ candidates, diagnostics }` verbatim. The `leadMinutes` default (`DEFAULT_CAPTURE_LEAD_MINUTES=60`) and injected `evaluationInstant` are threaded correctly. Tests confirm: empty archive → 1 admitted `CaptureRequest` with `capturedAt = kickoff − lead`; complete pair → `already_captured`, 0 candidates; snapshot-only → healing candidate.
- **Stage-2A single-bounded-read reused (requirement #7/#8).** ✅ `buildCaptureArchiveState` is used directly; `createFileCaptureReadPort` backs it with two whole-file strict reads (`readAllSnapshots`/`readAllOddsRecords`), classified in memory. No per-fixture `listSnapshots` loop; no O(F²). This resolves the performance review's #1 blocking concern (PB2B-1) correctly.
- **`orphanOddsWindowKeys` observability-only (requirement #17).** ✅ The provider's `classifyCaptureFixture` reads only `capturedWindowKeys`/`partialWindowKeys` (`capture-provider.ts:152-154`, `eligibility.ts:84-89`); `orphanOddsWindowKeys` is computed by the normalizer but consumed by nothing in the skip/heal decision. An odds-only window (no snapshot) is therefore treated as never-captured → capture proceeds idempotently, exactly as required.
- **Determinism (requirements #14/#15).** ✅ `capture-pipeline.ts` contains no `Date.now`/`Math.random`; `evaluationInstant` is injected; `capturedAt` is the kickoff-anchored window key; identity is minted downstream in M6, not here. Given fixed inputs the producer is byte-deterministic (transitively covered by the Stage-1 determinism suite and the fixed-input pipeline tests).
- **Heal semantics (requirement #16) — inherited gap.** Partial-pair completeness is **window-level**: a window is `capturedWindowKeys` if `≥1` `evidence_capture` odds row exists (`normalize.ts:96,104-106`). The capture-failure review (PP-2/PP-4/B-2) requires **per-market** completeness (complete iff *every* supported market has its odds record); otherwise a snapshot with N markets but M<N odds rows (a crash mid-C5-loop) is mis-classified complete → rejected `already_captured` → the C5 heal never runs → a permanent zero/partial-odds capture (DoD-5). The zero-odds partial path *is* correct and tested (*snapshot-only → healing candidate*); the some-but-not-all-markets path is not. This is inherited from the **approved** Stage 2A normalizer and endorsed by the migration review's own "≥1 odds row" wording — a genuine cross-review conflict. It is latent (dormant stage; C5 writes all-or-`failed`, so partial-markets requires a crash + re-fire) and must be resolved before activation (§13).

---

## 7. M6 and M9 Compatibility

**PASS.**

- **M6 frozen behaviour unchanged (requirement #11).** `runCaptureBatch`, `captureEvidenceSnapshot`, `ensureMandatoryCaptureOdds`, identity/hash formulas, and all `types/evidence/*` are untouched. Stage 2B only *feeds* the batch; it changes no downstream behaviour. The full-stream idempotency pre-check and `immutable_violation` backstop remain the real duplicate/poison guarantees (the Stage-2B `capturedWindowKeys` pre-filter is an optimization, not the guarantee — correctly, since the frozen pre-check is unchanged).
- **M9 compatibility (requirement #9/#10/#12).** `provideCandidates` is a new *optional* option; when absent, `options?.candidates ?? []` is preserved verbatim → bare cron and M9 injected-candidate tests are unaffected (`m9Activation.test.ts` 18/18 green; pipeline test *static candidates path still works*). The lock key, `requireDurable`, flag authority, `emitOutcomeMetrics`, `resultCounts`, and status→HTTP mapping are unchanged. The disabled-flag short-circuit still precedes the lock and does no work.
- **Adapter refactors behaviour-preserving (requirement #12).** The odds `readAll` extraction is byte-faithful (verified line-by-line); the evidence addition is a new function over the unchanged `readNdjson`. `oddsArchive.test.ts` (15) and `evidenceArchiveFileAdapter.test.ts` (strict reads) remain green in the full run.
- **DB-2 caveat (latent).** `createFileCaptureReadPort` reads the **file** adapter regardless of `EVIDENCE_ARCHIVE_ADAPTER`; the runner's write `deps` default to the *resolved* store. In file mode both target the same directory (consistent under one lock). In memory mode they would diverge (port reads files, writes go to memory) — inefficient, not corrupting (the frozen M6 pre-check still prevents duplicates), and not on any live path (dormant). Flagged for the activation stage.

---

## 8. Determinism and Idempotency

**PASS.**

- No `Date.now`/`Math.random`/environment-dependent ordering enters candidate content: the producer injects `evaluationInstant`; the provider sorts deterministically (`capturedAt` asc, `fixtureId` tie-break); `capturedAt` is kickoff-anchored. The only `process.env` read in the new code is **path resolution** in `createFileCaptureReadPort` (archive dir), which affects *which store* is read, never candidate identity or ordering.
- Idempotency is preserved end-to-end: re-firing a fully-captured day yields `already_captured` → 0 candidates (test) → M6 empty pass; the frozen full-stream pre-check + `immutable_violation` remain the substrate guarantees. No identity is minted in Stage 2B.
- The runner's `new Date().toISOString()` calls are pre-existing M9 *job-record* timestamps (lifecycle metadata), not candidate/identity clocks — unchanged and out of the determinism-critical path.

---

## 9. Public API and Contract Review

**PASS on frozen contracts; two design-boundary deviations (non-blocking).**

- **No frozen contract touched (requirement #11).** `types/evidence/*`, `EvidenceArchiveStore`/`OddsArchiveStore` interfaces, identity/hash/revision formulas, and archive record shapes are unchanged (typecheck exit 0 confirms).
- **New public surface (requirement #13):** `readAllSnapshotsStrict`, `readAllOddsRecordsStrict`, `createFileCaptureReadPort`, `produceCaptureRequests` (+ `CapturePipelineDeps`/`CapturePipelineConfig`), and the runner's `provideCandidates?` param. This is a *moderate, additive* expansion — acceptable, but it **deviates from the pre-implementation integration review's recommended boundary** (§3.3–3.4 of that review), which called for surfacing the whole-archive read as a **method on the two store interfaces** (implemented by both file *and* memory adapters), so the concrete port is adapter-neutral and a future Postgres adapter implements it as an indexed query. The implementation instead exposes module-level *file-adapter* functions and binds `createFileCaptureReadPort` to the file module. Consequences: (a) not Postgres-forward (a new factory is needed at cutover — acceptable, but the seam is forked); (b) the DB-2 read/write store decoupling (§7). The Stage-2A implementation review's recommendation #4 ("reuse the already-strict frozen adapter reads verbatim") **is** honoured — the strict semantics are reused, not re-implemented — so there is no fail-open risk; only the neutrality/instance-binding property is weaker.
- **Layering deviation:** `capture-pipeline.ts` is an impure, server-only module (`fs` via the file adapters, `process.env` via `resolveEvidenceArchiveDir`) placed under `lib/evidence-capture/candidates/` — the layer the architecture keeps *pure* (the Stage-2A/2A-review CF-3 determinism guard bans `Date.now`/`Math.random`/`fs`/`process.env` under `candidates/`). The integration review placed the impure orchestrator under `lib/evidence-capture/jobs/`. Locating it under `candidates/` weakens that boundary and would force the future determinism static rule to carve out an exception. Non-blocking, but recommend relocating before Stage 2C.

---

## 10. Test Coverage Assessment

**Adequate for a dormant stage; two gaps to close in Stage 2C.**

`tests/evidenceCapturePipeline.test.ts` (9/9) exercises **real** seams, not bypassing mocks (requirement #19):
- **Producer** (fake source + fake read port + stub derivation, but **real** `buildCaptureArchiveState` and **real** `buildCaptureCandidates`): empty→1 admitted request with correct `capturedAt`; complete pair→`already_captured` 0; snapshot-only→healing; `leadMinutes` default; strict-read throw→reject (fail-closed).
- **Runner seam** (real `runCaptureBatch` + memory stores): `provideCandidates` invoked once and threaded (considered=1, not_admitted path); static-candidates back-compat; rejecting producer→run `failed`; disabled flag→no discovery, `skipped`.

Regression anchors all green: Stage 2A 25/25, Stage 1 48/48, M9 18/18.

**Gaps (non-blocking, activation-relevant):**
1. **No composed end-to-end test** driving `runEvidenceCaptureJob({ provideCandidates: () => produceCaptureRequests(...).then(r => r.candidates) })` — the producer and the runner seam are tested separately, so the full `Archive State → Provider → CaptureRequest → M6 runner` chain as one flow (and "real producer inside the lock", IN-1) is not demonstrated.
2. **`createFileCaptureReadPort` is never exercised** against real NDJSON (ENOENT→empty / malformed→throw at the concrete-port level, the test-plan's CF-1/IN-15/U-C2). The underlying `readNdjson`/`readAll` are covered transitively, and the odds extraction is byte-faithful, so risk is low — but the new concrete port has no direct test.

Neither gap affects the dormant behaviour; both are cheap and should land with the activation wiring.

---

## 11. Blocking Findings

**None.** For the dormant, capture-only structural wiring under review, no load-bearing invariant is violated and none is inferred solely from comments:
- INV-L (discovery inside the lock) — demonstrated by `runWithLock` structure + flag-precedence test.
- Strict fail-closed reads — demonstrated by reused adapter semantics + propagation tests.
- Single bounded read / no O(F²) — demonstrated by reuse of the Stage-2A builder.
- Archive-as-sole-checkpoint / no cursor — demonstrated (grep-clean).
- Additive/back-compat/dormant route — demonstrated by tests + unchanged route.
- Frozen M6/contracts unchanged — demonstrated by inspection + typecheck.

---

## 12. Non-blocking Findings

- **NB-1 (adapter boundary / Postgres-forward + DB-2).** Concrete port reaches into the file-adapter module rather than a store-interface method; not adapter-neutral, and the read port is not bound to the runner's write-store instance (divergence only in memory/PG modes; dormant). *Remediation:* add `readAllSnapshots()`/`readAllRecords()` to the store interfaces (both adapters) and build the port from the runner's `deps`, per the integration review §3–4.
- **NB-2 (layering / determinism guard).** Impure `capture-pipeline.ts` (`fs`, `process.env`, `server-only`) lives under the pure `candidates/` layer. *Remediation:* relocate to `lib/evidence-capture/jobs/` and keep `candidates/` pure for the CF-3 static rule.
- **NB-3 (partial-pair completeness, inherited).** Window-level `≥1`-odds completeness vs the failure review's per-market requirement (PP-4/B-2). Latent DoD-5 gap on a crash-produced partial-markets snapshot; documented cross-review conflict (migration "≥1" vs failure "per-market"). *Remediation:* resolve the conflict and, if per-market is chosen, classify a snapshot with fewer odds rows than `supportedMarkets` as `partialWindowKeys` — before activation.
- **NB-4 (test gaps).** Composed producer→runner end-to-end test and a concrete-`createFileCaptureReadPort` strict/round-trip test (§10).
- **NB-5 (carry-forward, not introduced here).** The activation obligations the pre-implementation reviews list — INV-D deadline clamp + remaining-time guard, ceiling clamp wired at the call site, diagnostics merge/backlog/oldest-age, healing-candidate fetch short-circuit, H-1 unlock-500 swallow, and the Gate-B5 benchmark — are correctly **out of this stage** and remain owed by the live-activation stage.

---

## 13. Required Remediation

**Before Stage 2B is treated as activation-ready (i.e. as pre-conditions for Stage 2C / live wiring), not as blockers to the dormant merge:**

1. **Resolve NB-3 (partial-pair per-market completeness)** — reconcile the migration/failure review conflict and make the heal fail *toward* healing; add the per-market partial + mis-derivation tests (CT-6/CT-7).
2. **Address NB-1** — surface the whole-archive read on the store interfaces and bind the port to the write-store instance (DB-2), so discovery and writes observe one store under one lock and the seam is Postgres-forward.
3. **Address NB-2** — relocate the impure orchestrator out of `candidates/`.
4. **Close NB-4** — composed end-to-end + concrete-port strict tests; add the explicit inside-lock ordering probe (IN-1).
5. **Track NB-5** — the deadline/diagnostics/benchmark/H-1 obligations belong to the activation stage and must be gated there.

**No remediation is required to keep the current dormant stage merged and green.**

---

## 14. Final Verdict

# STAGE 2B IMPLEMENTATION CONDITIONALLY APPROVED

Stage 2B correctly implements **only** the chartered capture wiring `Archive State → Stage 1 Provider → CaptureRequest[] → M6 Capture Runner`, remains **dormant at the route**, and implements none of the excluded surfaces (settlement, activation, cron, flags, deadline, diagnostics aggregation, replay, concurrency, scheduler, deployment). It reuses the Stage-2A single-bounded-read builders, keeps reads strict and fail-closed, runs discovery inside the durable lock, preserves the M9 empty-safe default and every frozen M6/contract, and is honest that the M4→M5 derivation is an injected seam. It is green on all axes. The verdict is *conditional* solely on the non-blocking design-boundary and coverage items in §12–§13, all of which are activation-gated and none of which break the dormant stage.

- **Verdict:** STAGE 2B IMPLEMENTATION CONDITIONALLY APPROVED.
- **Blockers:** none.
- **Stage 2B may close:** **YES** — conditions tracked, none block the dormant merge (recommend landing NB-2 relocation and documenting NB-3 before closing).
- **Stage 2C may begin:** **YES** — and must address NB-1…NB-4 plus the carried NB-5 activation obligations as part of live wiring.

---

### Validation Results (re-run this pass, 2026-07-30, read-only)

| Check | Command | Result |
|---|---|---|
| Stage-2B targeted | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceCapturePipeline.test.ts` | **9 pass / 0 fail / 0 skip** |
| Stage-2A archive-state | `… --test tests/evidenceArchiveStateBuilders.test.ts` | **25 pass / 0 fail / 0 skip** |
| Stage-1 capture provider | `… --test tests/evidenceCandidateProvider.test.ts` | **48 pass / 0 fail / 0 skip** |
| M9 runner/lock (incl. C1–C7) | `… --test tests/m9Activation.test.ts` | **18 pass / 0 fail / 0 skip** |
| Full suite | `npm test` | **1769 pass / 0 fail / 0 skip** |
| Typecheck | `npm run typecheck` | **clean (exit 0)** |
| Lint | `npm run lint` | **clean — no ESLint warnings or errors** |

**Independently verified from source:** `provideCandidates` invoked inside `runWithLock` with `candidates ?? []` fallback (`runner.ts:298-306`); concrete port reuses `readNdjson` / extracted `readAll` strict semantics (`file.ts`); odds extraction byte-faithful; `orphanOddsWindowKeys` consumed by nothing in the skip/heal decision; cron route unchanged; no `Date.now`/`Math.random`/identity mint in `capture-pipeline.ts`; frozen `types/evidence/*` / store interfaces / M6 untouched.

**Confirmation:** the only file created or modified by this review is `docs/plans/m10-stage-2b-implementation-review.md`. **NO runtime code modified · NO tests modified · NO configuration modified · NO deployment modified** (and no contract, route, flag, archive, or environment modified).
