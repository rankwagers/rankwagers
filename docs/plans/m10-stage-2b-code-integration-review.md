# M10 Stage 2B — Code-Level Integration Review (Capture Pipeline Wiring)

**Reviewer:** Code-Level Integration Reviewer (Stage 2B)
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2B — Capture Pipeline Wiring**.
**Type:** Read-only code integration review. **No runtime code, no test, no flag, no cron route, no config, no deployment was modified.** The only file created is this document.

**Docs read:** `docs/architecture/m10-live-candidate-pipeline-specification.md`; `docs/plans/m10-stage-2a-implementation-review.md`; `docs/plans/m10-stage-2b-capture-integration-review.md`; `docs/plans/m10-stage-2b-capture-pipeline-wiring.md`; `docs/plans/m10-stage-2b-test-plan.md`.

**Code inspected (file:line):** `lib/evidence-capture/candidates/capture-pipeline.ts`; `lib/evidence-capture/candidates/archive-state/{builders,normalize,types,index}.ts`; `lib/evidence-capture/candidates/capture-provider.ts`; `lib/archive/evidence/file.ts` (`readNdjson`, `readAllSnapshotsStrict`, `evidenceArchivePaths`); `lib/evidence-capture/odds-archive/file.ts` (`readAllOddsRecordsStrict`, `createFileOddsArchive`); `lib/jobs/runner.ts` (`runEvidenceCaptureJob`, `runWithLock`); `lib/evidence-capture/{source,config}.ts`; `lib/evidence-capture/candidates/index.ts`; `tests/evidenceCapturePipeline.test.ts`.

---

## 1. Call-Chain Map

Verified end-to-end against source:

```
POST /api/internal/cron/evidence-capture     (UNCHANGED — one-line handleCronPost delegate)
  └─ runEvidenceCaptureJob(options?)                                        runner.ts:288
       ├─ env = options.env ?? process.env
       ├─ isCaptureEnabled(env) === false ─────────► flagSkippedJob (409, NO lock, NO discovery)   :295
       └─ runWithLock("evidence_capture", fn)                               runner.ts:298
            │   (fn runs ONLY after tryAcquireJobLock succeeds; lock-fail ⇒ skipped, fn never called)
            ├─ deps = options.deps ?? { getEvidenceArchiveStore(), getOddsArchiveStore() }   :299
            ├─ candidates =                                                  runner.ts:304-306
            │     options.provideCandidates ? await options.provideCandidates()   ← INSIDE the lock (INV-L)
            │                                : (options.candidates ?? [])          ← M9 static path / empty pass
            └─ runCaptureBatch(deps, candidates)                            runner.ts:307
                 └─ per candidate: captureEvidenceSnapshot (M6, frozen) → ensureMandatoryCaptureOdds (C5)

provideCandidates is composed by the CALLER from the Stage-2B producer:
  produceCaptureRequests(deps, config)                          capture-pipeline.ts:114
    ├─ loadSource   = deps.loadSource ?? loadPublishedDailyPredictions
    ├─ readPort     = deps.readPort  ?? createFileCaptureReadPort()      :119
    │     └─ { readAllSnapshots:  () => readAllSnapshotsStrict(env)                (evidence/file.ts)
    │        readAllOddsRecords: () => readAllOddsRecordsStrict(<dir>/odds-archive/records.ndjson) }
    ├─ Promise.all([ loadSource(date), buildCaptureArchiveState(readPort) ])   :122  (Stage 2A, strict single read)
    └─ buildCaptureCandidates({ sourceRows, evaluationInstant, leadMinutes, archiveState, config },
                              { deriveCaptureInput })                        :127  (Stage 1, pure)
           → CaptureProviderResult { candidates: CaptureRequest[], diagnostics }
```

**Note — the derivation seam is dormant.** `deriveCaptureInput` is a *required injected* dependency; no live async M4-fetch + M5-derive implementation is wired (explicitly deferred, wiring-doc §1/§3). The cron route is **unchanged** and still runs the M9 empty-safe pass — nothing composes `provideCandidates` in production yet. This slice is reusable/tested library code, not a live activation.

---

## 2. Integration Boundary Assessment

Every requested boundary property was verified precisely:

| Property | Verdict | Evidence |
|---|---|---|
| `provideCandidates` called only after lock acquisition | **PASS** | It is awaited inside the `fn` passed to `runWithLock` (`runner.ts:304-306`); `fn` runs only after `tryAcquireJobLock` returns a held lock (`runner.ts:74-99`). Lock-fail ⇒ `skipped`, `fn` never invoked. |
| Cannot run before/outside the lock via another runner path | **PASS** | The runner has exactly one call site, inside the lock. `produceCaptureRequests` is a standalone producer with no runner-side invocation outside the seam. The route is unchanged. |
| Flag-skip precedes lock+discovery | **PASS** | `isCaptureEnabled` short-circuits to `flagSkippedJob` before `runWithLock` (`runner.ts:295`). Test `runner: disabled capture flag short-circuits before discovery` asserts `calls === 0`. |
| Static `candidates` vs `provideCandidates` precedence unambiguous | **PASS** | Ternary `provideCandidates ? await … : (candidates ?? [])` (`runner.ts:304`): producer wins deterministically; neither ⇒ `[]` (M9 empty pass). See NB-3 on the silent both-provided case. |
| Provider rejection cannot become an empty successful job | **PASS** | A rejected `provideCandidates()` throws inside `fn` → caught by `runWithLock`'s `catch` → `status:"failed"`, `errorCode:"unhandled"`, lock released in `finally` (`runner.ts:123-137`). Test `a rejecting provideCandidates fails the run (not an empty success)` confirms `failed`/`unhandled`. |
| Strict readers not wrapped by fail-soft service helpers | **PASS** | `createFileCaptureReadPort` imports `readAllSnapshotsStrict`/`readAllOddsRecordsStrict` **directly** from the `file.ts` adapters — NOT `getEvidenceArchiveStore()`/`service.ts`, whose fail-soft `archive_unavailable` empty view is deliberately bypassed. A throw propagates. |
| Stage 2A builders reused, not reimplemented | **PASS** | `capture-pipeline.ts:44` imports `buildCaptureArchiveState` from `./archive-state`; no normalization is re-implemented. |
| Runner DI backward-compatible | **PASS** | New param is `provideCandidates?` (optional); `candidates?` unchanged; both absent ⇒ `[]`. Test `static candidates path still works (M9 backward-compat)` green; the full M9 suite (`m9Activation`, `m9Concurrency`) is green. |
| No unnecessary factory/class/DI abstraction | **PASS** | `createFileCaptureReadPort` is a plain factory *function* returning an object literal (mirrors existing `createFileEvidenceArchive`/`createFileOddsArchive`); `produceCaptureRequests` is a plain async function. No class, no container. |
| No Stage 2C settlement leak | **PASS** | `capture-pipeline.ts` is capture-only; no settlement provider, no `readAllValidations`, no deadline (INV-D) code. `evidence/file.ts` added only `readAllSnapshotsStrict` (no validations reader). |

**INV-L / INV-A:** discovery is inside the held lock and derives progress from a fresh archive read each pass — no cursor/offset/cache is introduced anywhere in the wiring (grep-clean; the port constructs fresh per `produceCaptureRequests` call).

---

## 3. Adapter Refactor Assessment

The refactor exposed the two whole-archive readers as **module-level functions** (rather than adding methods to the store *interfaces*). This is a legitimate and slightly cleaner alternative to the interface-extension I sketched in the pre-impl review: it avoids changing `EvidenceArchiveStore`/`OddsArchiveStore`, so no memory adapter / test double breaks.

| Concern | Verdict | Evidence |
|---|---|---|
| `readAllSnapshotsStrict` preserves adapter invariants | **PASS** | `= readNdjson<EvidenceSnapshot>(evidenceArchivePaths(env).snapshots)` (`file.ts:147`). It reuses the *exact same* private strict reader the store closure uses — ENOENT⇒`[]`, malformed/EACCES/EPERM/EIO/other⇒throw. No dedup/verify (unchanged; Stage 2A's `assertNoHashConflict` is the documented backstop). |
| `readAllOddsRecordsStrict` preserves adapter invariants | **PASS** | It is the **extracted body** of the former private `readAll` (`odds-archive/file.ts:74-122`): dedup on `id`, `verifyOddsRecord`, throw on same-id/different-hash conflict, ENOENT⇒`[]`. Behaviour byte-identical to before. |
| Existing store APIs unchanged | **PASS** | `createFileOddsArchive` still returns `{ append, get, listByCapture, listByFixture }` (`file.ts:210`); its `readAll` closure now *delegates* to `readAllOddsRecordsStrict` (`file.ts:127-129`) and still backs `append`/`get`/`listBy*`. `createFileEvidenceArchive` return shape unchanged; store interfaces untouched. Regression suites `evidenceArchiveFileAdapter` (9) + `oddsArchive` (15) green. |
| `createFileCaptureReadPort` resolves the correct paths | **PASS** | snapshots ⇒ `evidenceArchivePaths(env).snapshots` = `<dir>/snapshots.ndjson`; odds ⇒ `oddsArchivePaths(<dir>/odds-archive).records` = `<dir>/odds-archive/records.ndjson`, where `<dir> = resolveEvidenceArchiveDir(env)` — identical to how the real stores resolve their files. |
| Env/base-dir cannot split snapshot vs odds across different archives | **PASS (with NB-2)** | Both paths derive from the **same** `resolveEvidenceArchiveDir(env)` and the **same** captured `env`. Under a stable env they always target one archive dir. The only asymmetry is timing (odds path resolved eagerly at construction; snapshot path resolved lazily per read) — no divergence unless `env.EVIDENCE_ARCHIVE_DIR` is mutated mid-run, which does not happen in the request lifecycle. See NB-2. |
| No duplicate parsing/read path introduced | **PASS** | `readAllOddsRecordsStrict` is an *extraction* (single source of truth; the store delegates). `readAllSnapshotsStrict` reuses `readNdjson`. There is no second NDJSON parser. |

---

## 4. Error Propagation

- **Strict-read throw → fail-closed, never empty.** `buildCaptureArchiveState` never catches (Stage 2A); `produceCaptureRequests` does not wrap it; a throw rejects the producer. Test `strict archive-read throw propagates (fail-closed, never empty)` proves `/I\/O failure/` rejection with a seeded throwing port.
- **Producer rejection → job `failed`.** Propagates through the `provideCandidates` seam to `runWithLock`'s catch → `failed`/`unhandled` (route maps `failed`→500). Never an empty `succeeded`. Confirmed by test + the batch's own hard-fail path (`writeFailed`/`immutableViolation`⇒`failed`) is unchanged.
- **Legitimate empty ≠ masked error.** A producer that *resolves* to `[]` (no eligible fixtures) yields a genuine zero-count `succeeded` (M9 empty-pass semantics) — correct, because strict reads *throw* rather than return empty, so "empty" only ever means "no work," never "read failed."
- **`error-cause` compatibility.** `new Error(msg, { cause })` in the readers is pre-existing (readNdjson) / extracted (odds) and typechecks clean under the project target — no regression.
- **Per-fixture derivation isolation** is preserved in the pure provider (`buildCaptureCandidates` counts `{ok:false}` reasons and continues); a throwing seam is the caller's contract to isolate — acceptable at this stage since the seam is a stub (NB-4).

---

## 5. Type and API Compatibility

Subtle-TypeScript checklist — all clear:

| Check | Verdict | Note |
|---|---|---|
| Optional callback ambiguity | **PASS** | `provideCandidates?: () => Promise<readonly CaptureRequest[]>` — truthy-function check drives an unambiguous ternary; no narrowing hazard. |
| Readonly array mutation | **PASS** | Port readers return `readonly …[]`; strict readers return mutable arrays (assignable-widening OK); `runCaptureBatch` takes `readonly CaptureRequest[]`; the provider pushes to a *local* mutable array. No readonly array is mutated. |
| Environment capture at module init | **PASS** | `env` is a **call-time default parameter** (`createFileCaptureReadPort(env = process.env)`), not read at module load; `produceCaptureRequests` constructs the port per call. `DEFAULT_CAPTURE_LEAD_MINUTES = 60` is a plain literal const (no import-time env read). |
| Stale singleton stores | **PASS** | The read port does **not** use the `getEvidenceArchiveStore()`/`getOddsArchiveStore()` singletons; it reads files directly, fresh per pass. Write deps still use the M9 singletons; both resolve the same paths from the same env, so reads see appended writes. No staleness. |
| Incorrect type narrowing | **PASS** | `verifyOddsRecord(parsed)` is a type guard; `order.map(id => byId.get(id) as OddsArchiveRecord)` is sound (every id was set). Runner ternary types resolve cleanly (typecheck exit 0). |
| Accidental public export expansion | **PASS** | `capture-pipeline.ts` is **not** re-exported by the client-safe `candidates/index.ts` barrel (grep-confirmed). New exports are reachable only by direct import. The barrel's public surface is unchanged. |
| Cyclic imports | **PASS** | `capture-pipeline` → {source, config, capture-provider, archive-state, types, file adapters}; none import back into `capture-pipeline`. No cycle. |
| Server/client boundary | **PASS** | `capture-pipeline.ts` declares `import "server-only"` and pulls server-only `file.ts`/`source.ts`. Because it is **absent from the barrel**, a client importing `candidates/index.ts` cannot transitively pull server-only code; `capture-provider`/`archive-state`/`types` remain client-safe (none are server-only). |

**API compatibility:** additive only — one optional runner param, two module-level reader exports, one new server-only module. No frozen `types/evidence/*`, identity/hash/format, or store-interface change. Full suite **1769/1769**, typecheck exit 0, lint clean.

---

## 6. Blocking Findings

**None.** No wiring bypasses the lock; no public-contract regression; no fail-soft wrap of the strict readers; no hidden side effect; no duplicate read path; no Stage 2C leak. The BLOCK conditions are not met.

---

## 7. Non-blocking Recommendations

- **NB-1 — Dead "defensive touch."** `void evidenceArchivePaths(env)` (`capture-pipeline.ts:66`) is a no-op: `evidenceArchivePaths`/`resolveEvidenceArchiveDir` never throw (they return a default), so it cannot "fail fast on a bad env" as its comment claims. Remove it, or replace with a real validation, or correct the comment.
- **NB-2 — Eager/lazy path-resolution asymmetry.** In `createFileCaptureReadPort`, the odds records path is resolved **eagerly** at construction while the snapshots path is resolved **lazily** per read. Both use the same `env`, so there is no real divergence today; resolving both symmetrically (both eager, capturing `evidenceArchivePaths(env).snapshots` once) would remove a latent footgun and make the single-archive guarantee structural rather than incidental.
- **NB-3 — Silent both-provided precedence.** If a caller passes *both* `candidates` and `provideCandidates`, the static array is silently ignored. Precedence is deterministic, but consider asserting mutual-exclusivity (or documenting) to avoid a surprising drop. Relatedly, the **usage contract** — that live discovery must be passed *through* `provideCandidates` (not pre-invoked and passed as static `candidates`, which would run discovery outside the lock) — should be documented at the runner seam so a future caller cannot accidentally hoist discovery out of the lock.
- **NB-4 — Generic failure code + dropped provider diagnostics.** A rejecting producer surfaces as `errorCode:"unhandled"` rather than a distinguishable capture code (C6 spirit); and because the seam passes only the candidate **array**, the provider's `CandidateDiagnostics` (rejection/defer/healing counts) are discarded — the runner's `resultCounts` carry only batch counts. Both are explicitly deferred (wiring-doc §1: no diagnostics aggregation), but they are the first things the diagnostics-aggregation stage must reconnect.
- **NB-5 — Concrete port is unit-untested end-to-end.** `createFileCaptureReadPort` over a real NDJSON dir (test-plan CF-1/IN-15 "temp-dir round-trip") is not yet exercised; the pipeline tests use injected fakes and the constituent strict readers are covered only by the adapter suites. Add the temp-dir round-trip when the derivation/live path lands.
- **NB-6 — Scope vs. the Stage-2B test plan.** This slice is the *capture-wiring* subset; the test plan's blocking items **B-T3 (deadline/INV-D), B-T4 (multi-worker overlap 409-not-500), B-T5 (crash/replay + A4), B-T6 (derive-adapter fidelity), B-T9 (determinism static guard)** and the live async M4→M5 derivation, route wiring, and diagnostics merge remain **open**. They are correctly deferred (the route is dormant, so they are not yet reachable), but they gate the eventual **live activation**, not this dormant merge. Track them as activation blockers.

---

## 8. Verdict

# CODE INTEGRATION APPROVED

The Stage-2B capture-pipeline wiring is correct, fail-closed, dormant, and backward-compatible. Discovery runs strictly inside the durable lock via an optional `provideCandidates` seam (INV-L); a strict-read throw propagates to a `failed` job and can never become an empty success; the concrete read port reads the durable NDJSON adapters directly (bypassing the fail-soft service) and resolves snapshot + odds against one archive directory; the adapter refactor is a behaviour-preserving extraction that reuses the existing strict readers with no duplicate parser and no store-interface change; Stage 2A builders are reused; the barrel stays client-safe (the server-only module is not re-exported); and no settlement/Stage-2C work leaked in. Validation is green on every axis.

- **Exact blockers:** none.
- **Runtime remediation required:** **No.** All findings are non-blocking (NB-1…NB-6); the pipeline is dormant (route unchanged) and safe to merge as-is. NB-1/NB-2/NB-3 are cheap code-clarity fixes; NB-4…NB-6 are deferred-scope items that gate **live activation**, not this merge.
- **Files modified by this review:** only `docs/plans/m10-stage-2b-code-integration-review.md`.

### Validation results (re-run this pass, 2026-07-30, read-only)

| Check | Command | Result |
|---|---|---|
| Stage-2B pipeline tests | `… --test tests/evidenceCapturePipeline.test.ts` | **9 pass / 0 fail** |
| Runner/adapter regression | `… --test m9Activation, m9Concurrency, evidenceArchiveFileAdapter, oddsArchive, evidenceArchiveStateBuilders, evidenceCandidateProvider` | **126 pass / 0 fail** |
| Full suite | `npm test` | **1769 pass / 0 fail / 0 skip** |
| Typecheck | `npm run typecheck` | **clean (exit 0)** |
| Lint | `npm run lint` | **clean** |

**Confirmed:** only the review document was created. No runtime code, no tests, no deployment, no configuration were modified during this review.
