# M9 — Activation & Production Wiring — Performance, Concurrency & Locking Review

**Reviewer:** Claude 4 (performance & concurrency)
**Latest pass:** 2026-07-30 — **FINAL re-review** against the now-**built** M9 wiring.
**Prior pass:** 2026-07-29 — reviewed the *substrate* while the M9 wiring was still unbuilt; fixed two runner defects (F-1, F-2). That pass is superseded below where the code has since changed; its two fixes are re-confirmed in current code.
**Scope:** Sprint 23B Milestone M9 *activation* — job runner, durable lock substrate, cron routes/diagnostics, and the NDJSON archive access pattern under production volume. Business settlement/capture semantics reviewed **only** where they affect concurrency or performance. No archive redesign; no Postgres migration; no feature activation; no contract change. **Review only — no runtime code was modified in this pass.**
**Method:** repository read directly (`file:line` anchors below); one bounded, deterministic scratch benchmark run against the **real** file adapters (deleted after recording — no probe left in the repo or tree). Full suite + typecheck + lint re-run.

**VERDICT: M9 PERFORMANCE CONDITIONALLY APPROVED** — see §13. M9 is now built and is concurrency-correct and effectively **zero-cost in its current activated posture** (a bare cron fire runs an *empty* candidate list — measured 0.04 ms/pass). The prior cross-process single-writer gap (old P1) is **resolved in code** (durable lock binds `EVIDENCE_DATABASE_URL`, fails closed in production). The remaining items are **pre-activation gates that only bite once the live candidate pipeline (M10) is wired**: the O(F²) NDJSON batch cost versus the 60 s route/event-loop budget (P2), now **sharpened** by a newly-measured capture-side amplification (mandatory-odds writes re-scan a hash-verified odds file per market), and one low-severity PG-only unlock-error surfacing bug (L-2). None is a merge blocker for the current dormant/flags-off, single-instance posture.

---

## 1. Executive summary

**Build state (verified — changed since the 2026-07-29 pass).** M9 is **built and wired**, dormant behind two flags:
- `JobType` now includes `evidence_capture` + `prediction_settlement` (`lib/jobs/types.ts:5-6`).
- Runners `runEvidenceCaptureJob` / `runPredictionSettlementJob` exist (`lib/jobs/runner.ts:282-346`), each flag-gated and lock-gated.
- Cron routes exist: `app/api/internal/cron/evidence-capture/route.ts`, `.../prediction-settlement/route.ts` (both `maxDuration = 60`, `runtime nodejs`).
- Batch orchestrators: `lib/evidence-capture/jobs/capture-run.ts`, `.../settlement-run.ts`; mandatory-odds C5 wiring `.../capture/mandatory-odds.ts`.
- Diagnostics: `lib/jobs/diagnostics.ts` (`getEvidenceJobDiagnostics`).
- Tests: `tests/m9Activation.test.ts` (C1–C7), `tests/m9Concurrency.test.ts` (lock matrix + F-1/F-2 + prod fail-closed).

**Concurrency.** Correct for the intended single-instance (`instances:1, fork`) deployment (`deploy/ecosystem.rankwagers.cjs:35-40`). Distinct lock keys per job type; `finally`-release on every path; cron overlap → `skipped`/409 (never 500); no queue, no retry amplification. The former systemic risk (*false single-writer confidence*) is now **closed in code**: capture/settlement request a **durable** lock that keys off `EVIDENCE_DATABASE_URL` and, in `NODE_ENV=production`, **fails closed** (returns `null` → `skipped`) rather than degrading to a per-process memory `Set` when the DB URL is missing/unreachable or `JOB_LOCK_ADAPTER=memory` (`lib/jobs/locks.ts:22-61`). Proven by three `Blocker 1` tests.

**Prior fixes re-confirmed present.**
- **F-1 (identity tracking):** `runWithLock` records completion via `Object.assign(running, result)` on the record returned by `trackJob(...)` — never `jobLog[jobLog.length - 1]` (`runner.ts:90-100,125`). Two concurrent distinct-lock jobs each land their own terminal record.
- **F-2 (bounded log):** `jobLog` head-trimmed to `JOB_LOG_MAX = 500` in `trackJob` (`runner.ts:31,39-45`); `listRecentJobs` exposes only the tail.

**Performance — the decisive fact is the *candidate question*.** The cron routes call `runEvidenceCaptureJob()` / `runPredictionSettlementJob()` **with no arguments**, so `candidates ?? []` is **empty** (`runner.ts:296,332`; routes). A bare production cron fire therefore does flag-check → lock → **empty batch loop** → release: **measured 0.04 ms/pass**. **Current activated compute cost ≈ zero.** The O(F²) NDJSON cost is entirely *latent* until M10 wires live candidate derivation. When it is wired, the file adapter's O(A) global scan per store call dominates: capture = **3 evidence scans + M hash-verified odds-file scans per fixture**; settlement = **2 + 2·T scans per fixture**. A whole-day run over F fixtures against one growing file is **O(F·A) ≈ O(F²)**; capture is now the *steeper* curve (§5, §6).

---

## 2. Repository evidence

| Fact | Anchor |
|---|---|
| M9 job types present | `lib/jobs/types.ts:5-6` |
| capture/settlement runners, flag-gated + lock-gated | `lib/jobs/runner.ts:282-310, 319-346` |
| bare cron fire → empty candidate list | `runner.ts:296,332` (`candidates ?? []`) + both route files (`() => runEvidence…Job()`) |
| durable lock keys off `EVIDENCE_DATABASE_URL` | `lib/jobs/locks.ts:27-28` |
| production fail-closed (no memory fallback for durable) | `lib/jobs/locks.ts:39-41` |
| DB-connect failure fails closed (no memory fallback) | `lib/jobs/locks.ts:56-61` |
| `advisoryLockKey` = 31-bit sha256 slice, `||1` | `lib/jobs/locks.ts:10-14` |
| lock key = `job:${jobType}` (distinct per type) | `runner.ts:66` |
| `finally { await lock.release() }` on every path | `runner.ts:135-137` |
| F-1 identity tracking (`Object.assign`, not positional) | `runner.ts:90-100,125` |
| F-2 bounded jobLog (`JOB_LOG_MAX=500`, head-trim) | `runner.ts:31,39-45` |
| cron skipped→409, failed→500, else 200 | `lib/jobs/cronHandler.ts:71` |
| cron rate limit 6 / 60 s → 429 | `cronHandler.ts:10-11,26-44` |
| routes `maxDuration=60`, `runtime nodejs` | both cron route files |
| deploy single-instance fork, kill_timeout 10 s | `deploy/ecosystem.rankwagers.cjs:35-40` |
| capture scans = listSnapshots + latestSnapshot + appendSnapshot | `capture/capture.ts:92,110,141` |
| mandatory odds = M appends, each a hash-verified `readAll` | `capture/mandatory-odds.ts:134-137` → `odds-archive/file.ts:128-168,70-116` |
| evidence file adapter reads whole file per call, throws on corruption, ENOENT-only empty | `archive/evidence/file.ts:76-127` |
| odds file adapter `serializeAppend` in-proc mutex + per-line `verifyOddsRecord` | `odds-archive/file.ts:41-59,69-116` |
| `appendFile`, no fsync | `archive/evidence/file.ts:129-136` |
| diagnostics = job-log projection, `listRecentJobs(500)`, no archive scan/verify | `lib/jobs/diagnostics.ts:59-67` |
| metrics counters bounded, labels sanitized + 64-char capped | `lib/observability/metrics.ts:18-53` |
| `DEFAULT_CAPTURE_MAX_FIXTURES = 500`, lead 60 min | `lib/evidence-capture/config.ts:39-40` |
| strict flags (`true`/`1` only) | `config.ts:44-47` |
| no AbortSignal anywhere in jobs/capture/settlement | grep: 0 hits |

---

## 3. Current architecture

Cron route (`POST`) → `handleCronPost` (access → rate-limit → run) → `runEvidence{Capture,Settlement}Job` (flag gate → `runWithLock`) → `runWithLock` (durable lock acquire → `trackJob` running record → batch fn → `Object.assign` terminal state → `finally` release) → batch orchestrator (`runCaptureBatch` / `runSettlementBatch`) over **injected** candidates → frozen M6 capture / M8 settlement services → NDJSON file adapters.

- **Candidates are injected, and the route injects none** → the wired production path runs an empty batch. Producing live candidates is the M4→M5 derivation pipeline, explicitly out of M9 (M10).
- **Guards live outside the frozen services:** C3 fixture-correspondence + C4 score-sanity in `settlement-run.ts:135-151`; C5 mandatory odds in `capture-run.ts:129-142`; C6 result classification into counts in both orchestrators; C7 diagnostics over the job log.
- **Two backends per lock:** durable PG advisory (`pg_try_advisory_lock`, session-level, private `Pool({max:1})`) or an in-process `Set` — but for capture/settlement the memory backend is **forbidden in production** (fail-closed).
- **Deployment:** single PM2 fork (`instances:1`), `kill_timeout 10 s`; cron handlers share the one Node event loop with user traffic.

---

## 4. Prior defects and confirmation of fixes

| ID | Defect (2026-07-29) | Fix | Re-confirmed in current code |
|---|---|---|---|
| **F-1** | `runWithLock` recorded completion at `jobLog[jobLog.length-1]` → wrong slot when two distinct-lock jobs overlap (settlement record dropped; phantom `running` stuck) | Track each record **by object identity**; update with `Object.assign(running, result)` | ✅ `runner.ts:90-100,125`. Test: *"concurrent distinct-type jobs each record their own terminal state"* (`m9Concurrency.test.ts:114-137`) |
| **F-2** | `jobLog` unbounded (one entry/invocation forever) — slow heap leak M9's two new job types accelerate | Head-trim to `JOB_LOG_MAX=500`; `listRecentJobs` = tail | ✅ `runner.ts:31,39-45`. Test: *"job log stays bounded"* (`m9Concurrency.test.ts:139-152`) |
| **P1→resolved** | (old gate) lock decoupled from evidence store; silently memory-backed → false single-writer under rolling deploy / multi-host / `instances>1` | Durable lock binds `EVIDENCE_DATABASE_URL`; **production fail-closed** when absent/unreachable or `JOB_LOCK_ADAPTER=memory` | ✅ `locks.ts:27-28,39-41,56-61`. Tests: three `Blocker 1` cases (`m9Concurrency.test.ts:184-220`) |

All three are green. F-1/F-2 also verified against `tests/sprint17Reliability.test.ts` (exercises the runner).

---

## 5. Complexity analysis (current, wired M9 paths)

Variables: **F** = fixtures/run; **M** ≤ 32 markets/snapshot (`MAX_SUPPORTED_MARKETS`, ~2–4 in practice); **T** ≤ M terminal-and-changed markets that append; **A** = **global** archive lines the file adapter scans (per file); **A_odds** = odds-records file lines. `EVIDENCE_HISTORY_MAX_LIMIT` clamps *output* rows, not the input scan.

**Empty pass (the current wired cost):** flag check O(1) → lock O(1) → `for..of []` → release. **O(1). Measured 0.04 ms.**

**Capture per fixture (once candidates wired):** `listSnapshots` (1 scan, `capture.ts:92`) → same-window `find` O(S) → `latestSnapshot` (1 scan, `:110`) → pure build O(M) → `appendSnapshot` (1 scan for admission, `:141`). **3 evidence scans.** Then C5 mandatory odds: **M** `store.append` calls (`mandatory-odds.ts:134`), **each** a `readAll` of the odds file that re-parses **and re-runs `verifyOddsRecord` (a hash recompute) per line** (`odds-archive/file.ts:69-116`) under an in-proc append mutex (`serializeAppend`). So capture ≈ **3·A_snap + M·(A_odds · hashcost)** per fixture — the odds term is the new, hash-heavy amplifier introduced by M9's C5 wiring (not present in the 2026-07-29 substrate estimate).

**Settlement per fixture:** `latestSnapshot` (1 scan, `settlement.ts:371`) → `listValidations` (1 scan, `:230`) → loop M markets; each terminal-and-changed market = `appendValidation` = **2 scans** (validations + snapshots via `Promise.all`, `evidence/file.ts:201-204`). **(2 + 2·T) scans/fixture.**

**Whole-day batch:** F fixtures, each re-scanning a global file whose size A grows *within* the run and *across* days → **O(F·A) ≈ O(F²)**, confirmed by rising per-fixture ms (§6). Capture's curve is steeper because of the per-line hash verification on the growing odds file.

---

## 6. Benchmark evidence

Deterministic scratch probe against the **real** file adapters (`createFileEvidenceArchive` + `createFileOddsArchive`), one growing dir, warm cache; F fed one-at-a-time to model per-fixture store calls; probe deleted after the run. Indicative, not precise.

**(0) Empty pass (bare cron fire):** `100 × (capture+settlement empty batch) = 4 ms → 0.040 ms/pass`. The wired production path is effectively free until candidates exist.

**(1) Capture incl. mandatory odds — cumulative into one growing pair of files:**

| batch | cumulative fixtures | total | per-fixture | snapshots | odds |
|---|---|---|---|---|---|
| +50 | 50 | 3.0 s | 60.1 ms | 76 KB | 42 KB |
| +200 | 250 | 18.4 s | 91.8 ms | 378 KB | 208 KB |
| +500 | 750 | **99.6 s** | **199.1 ms** | 1.1 MB | 625 KB |

**(2) Settlement — cumulative into one growing validations file:**

| batch | cumulative fixtures | total | per-fixture | validations |
|---|---|---|---|---|
| +50 | 50 | 4.2 s | 83.4 ms | 49 KB |
| +200 | 250 | 17.3 s | 86.3 ms | 246 KB |
| +500 | 750 | **48.6 s** | 97.1 ms | 738 KB |

**Reading.** Per-fixture cost **rises with accumulated volume** for both → **O(F²)** confirmed. Settlement (~48.6 s for a 500-batch at ~0.7 MB) corroborates the prior "~59 s @ 500" figure in order of magnitude. **Capture is now the worse curve** — a 500-batch at cumulative 750 takes **99.6 s (199 ms/fixture)**, well past the 60 s route budget — because each fixture's M odds appends each re-hash-verify the whole growing odds file. **This capture-side amplification is new since the pre-wiring review and is the sharper of the two Postgres triggers.**

---

## 7. Lock concurrency matrix

Keys: capture = `job:evidence_capture`, settlement = `job:prediction_settlement` (distinct — `advisoryLockKey` differ, asserted in tests). "Durable" = PG advisory bound to `EVIDENCE_DATABASE_URL`.

| Scenario | Behaviour | Disposition |
|---|---|---|
| capture vs capture (same proc) | 2nd acquire → `null` → `skipped`/409 | ✅ serialized |
| settlement vs settlement | 2nd → `skipped`/409 | ✅ serialized |
| capture vs settlement | distinct keys → both run | ✅ allowed; both touch `snapshots.ndjson` (capture W, settlement R) — relies on POSIX append atomicity + reader-side integrity; settlement may miss an in-flight append and settle the prior latest (eventual, acceptable) |
| same process | in-proc `Set` (best-effort jobs) / PG (durable) | ✅ |
| simulated separate process (memory backend) | per-process `Set` → two writers | ⚠️ **only relevant to best-effort jobs**; durable evidence jobs never use memory in prod |
| production **with** `EVIDENCE_DATABASE_URL` | PG advisory, cross-process/host safe (auto-release on session drop) | ✅ |
| production **without** `EVIDENCE_DATABASE_URL` | durable acquire returns `null` → run `skipped`/409 | ✅ **fail-closed** (test `Blocker 1` #184) |
| production `JOB_LOCK_ADAPTER=memory` | durable acquire returns `null` | ✅ **fail-closed** (test `Blocker 1` #197) |
| DB connection failure | `pool.connect()` throws → `null` → `skipped` | ✅ fail-closed (`locks.ts:56-61`) |
| lock contention (PG) | 50 ms poll up to `timeoutMs=1000` → `null` | ✅ bounded, no queue |
| release after success | `finally` → `release()` | ✅ |
| release after throw | `catch` sets failed, `finally` → `release()` | ✅ (test `m9Concurrency` #56) |
| release after `write_failed` **return** | returned record (not throw); `finally` still releases | ✅ (test #75) |
| stable advisory key derivation | `sha256`→31-bit, deterministic across procs/hosts | ✅ |
| distinct lock keys | capture ≠ settlement | ✅ (test #39; `m9Activation` C1 #102) |

**No production memory fallback exists for evidence jobs** — confirmed at `locks.ts:39-41` (flag/absent URL) and `:56-61` (connect failure). Both return `null`; the runner surfaces `skipped`.

**L-2 (low, PG path only, still present):** `release()` awaits `pg_advisory_unlock` in a `try` whose `finally` does `client.release()`+`pool.end()`, but the unlock rejection itself is **not** swallowed (`locks.ts:76-83`). A transient unlock error therefore propagates out of `release()`, and `runWithLock`'s `finally { await lock.release() }` (`runner.ts:136`) throws **over a successful return** → `handleCronPost` surfaces **500 for a job that actually succeeded**. PG still auto-releases on session end, so correctness is intact; only the HTTP/observability outcome is wrong. Same item as the implementation review's D-1. **Recommended fix (not a blocker):** wrap the unlock query in `try/catch`.

---

## 8. Event-loop impact

- **`instances:1, fork`** → cron handlers run in the **same Node process** as all user traffic. The file adapters' `fs.readFile(whole file)` → `split('\n')` → **synchronous** `JSON.parse` (and, for odds, per-line `verifyOddsRecord` hashing) **blocks the event loop** for each scan's duration. At scale a settlement run does ~9F such parses and a capture run does ~(3+M)F, in bursts → user-request latency spikes.
- **Route/PM2 budget:** `maxDuration=60`; PM2 `kill_timeout=10 s`. Capture at cumulative-750 F=500 already overruns (99.6 s). Idempotent re-fire recovers, but wasted work.
- **No AbortSignal** anywhere (grep 0) → an overrunning run cannot yield cooperatively; it runs until the platform kills the request.
- **Today this is all latent** — the empty candidate list means zero scans per fire. It becomes real at M10.

---

## 9. Batch limits

- `DEFAULT_CAPTURE_MAX_FIXTURES = 500` (`config.ts:40`) — this is the *capture candidate* ceiling once the M10 pipeline supplies candidates. Against the file adapter it maps to a run that **exceeds** the 60 s budget with even ~1 MB of accumulated history (§6). **It must not ship as the file-adapter production ceiling** (see §12).
- Settlement has no analogous injected ceiling in the runner — it settles whatever candidates are injected. M10 must cap the injected settlement set symmetrically.
- Both batches are strictly sequential `for..of` loops (no concurrency inside a run), so a run's wall-time = Σ per-fixture cost — exactly the O(F²) curve measured.

---

## 10. Scheduler overlap risk

- Same-type overlap is handled by the lock → `skipped`/409, no queue, no retry loop (`attempt` always 1), no unbounded wait (memory instant; PG bounded by `timeoutMs=1000`). ✅
- Capture and settlement have **distinct** locks → they can run **concurrently** on the single fork, contending on the shared event loop and on `snapshots.ndjson`. **Stagger their external cron schedules** (out-of-repo ops action) rather than firing simultaneously.
- Rate limit 6/60 s → 429 with `Retry-After` before any work (`cronHandler.ts:26-44`). ✅
- The F-1 fix guarantees a concurrent capture+settlement pair each record their own terminal state, so overlap never corrupts observability.

---

## 11. Metrics / log cardinality

- **Counters bounded & low-cardinality.** `metrics.increment` keys by name + sanitized, 64-char-capped labels (`metrics.ts:18-53`). M9 job bodies label only **enums**: `type` (jobType), `status`, `code` (short error codes), and `evidence_job_outcome_total{job, outcome}` where `outcome` ∈ the fixed count keys (`runner.ts:83,96,102-110,271`). **No `fixtureId`/`captureId`/`snapshotId`/`revisionId`/provider payload is ever a metric label.** ✅
- **Logs bounded.** One structured `job_finished` / `cron_executed` per run, not per archive line (`runner.ts:112-121`, `cronHandler.ts:48-58`). Failure logs cap the sample: `failures.slice(0, 5)` (`runner.ts:299,335`). ✅
- **Diagnostics payload bounded.** `getEvidenceJobDiagnostics` projects `listRecentJobs(500)` (bounded by `JOB_LOG_MAX`) into a **fixed 2-element** array (the two evidence job types), each a small fixed-key object; **no archive scan, no `verifyEvidenceChain`** (`diagnostics.ts:59-67`). ✅
- **No unbounded memory retention on errors.** `jobLog` is head-trimmed to 500; failure records carry short codes, not payloads; the odds `serializeAppend` chain map self-deletes its entry on settle (`odds-archive/file.ts:53-58`); lock pools/clients are `end()`ed on every path. ✅
- **Requirement carried to M10:** keep it this way — never label per entity, never log per fixture at scale, never add `verifyEvidenceChain` to a per-request diagnostics/health path (run it as a scheduled sweep).

---

## 12. Scale boundary & required activation limits

**Where the file adapter becomes operationally unsafe/inefficient.** When a single run's synchronous scans push wall-time toward the 60 s route budget *or* block the event loop enough to hurt user latency. Measured crossings: **capture ~500 fixtures/run at a ~0.6 MB odds file ≈ 100 s** (over budget); **settlement ~500 fixtures/run at ~0.7 MB ≈ 49 s** (at the edge). Practically the boundary is **a few hundred fixtures/run and/or low-single-digit-MB / tens-of-thousands-of-lines of accumulated archive**. Beyond ~100 k accumulated lines / ~20 MB per file, in-request runs are infeasible → that is the future-Postgres trigger (a DoD non-goal, **not** M9).

**Recommended safe initial activation limits (file adapter):**

| Knob | Recommendation | Rationale |
|---|---|---|
| max fixtures / capture run | **≤ 100–150** (lower `DEFAULT_CAPTURE_MAX_FIXTURES` from 500 for the file backend) | keeps a run well under ~20 s wall + bounded event-loop stalls even with day-over-day growth; capture is the steeper curve |
| max settlements / run | **≤ 150** (M10 injects a capped set) | ~85–97 ms/fixture → ~15 s at 150 |
| cron cadence | a few times/day; **≥ 5 min** between any two evidence fires | daily-batch work; leaves the event loop free between runs |
| overlap policy | rely on the lock (same-type → skip/409); **stagger** capture vs settlement so they don't run simultaneously on the one fork | avoids event-loop + `snapshots.ndjson` contention |
| timeout budget | keep `maxDuration=60`, but size per-run work to **≤ ~20–30 s** | headroom for the synchronous parse spikes; the true limit is event-loop blocking, not just wall-time |
| archive size warning threshold | warn at **~50 k lines / ~10 MB per file**; treat **~100 k lines / ~20 MB** as the hard "migrate/chunk" line | each scan is O(file); this is where scans start to visibly stall the loop |

Do **not** invent a Postgres migration inside M9. These limits are ops/config, plus lowering one default — not a schema change.

---

## 13. Required fixes / gates

**Already in code (verified this pass):** F-1, F-2, and the durable production-fail-closed lock (old P1). No action.

**Pre-activation gates (must hold before flags flip *and* before M10 wires real candidates — not merge blockers now):**
- **P2 — per-run work bound vs the 60 s route / event-loop budget.** With the file adapter, a whole-day run must not exceed the budget or block the shared loop. Lower the file-backend fixture ceiling (§12), chunk the day across smaller fires, or move cron to a dedicated worker process. `DEFAULT_CAPTURE_MAX_FIXTURES=500` maps to ~100 s capture at ~1 MB — it must not be the file-adapter ceiling. **Sharpened this pass:** capture's mandatory-odds hash-verified re-scan makes capture the binding constraint, not settlement.
- **P3 (guard for M10) — cap the injected settlement set** symmetrically with capture; the runner imposes no settlement ceiling of its own.

**Recommended (low severity):**
- **L-2** — wrap `pg_advisory_unlock` in `try/catch` (`locks.ts:76-83`) so a transient unlock error cannot turn a succeeded job into an HTTP 500 (PG path only).
- **Per-run single bounded archive read** — read the fixture working-set once per run under the single-writer lock instead of re-scanning the global file per store call; collapses O(F·A) toward O(A + F·Vf). Per-run only (append-only immutability + the lock keep it non-stale). Preserves identity/hash/revision/ordering.
- **AbortSignal / per-run time-or-count budget** so an overrunning run yields cleanly before the platform kill.
- **Async/streamed NDJSON parse** to avoid one synchronous parse loop blocking the loop.
- **Stagger** capture/settlement external schedules (§10).

---

## 14. Test / benchmark evidence

**Deterministic tests (all pass):**
- `tests/m9Concurrency.test.ts` — same-key serialize; distinct capture/settlement keys both acquire; release-in-`finally` after throw; release after `write_failed` return; cron overlap 2nd/3rd → `null` (no queue); 1000 acquire/release cycles → no Set growth; **F-1** concurrent distinct-type non-clobber; **F-2** bounded log; **Blocker 1** ×3 (prod fail-closed with no URL / with `JOB_LOCK_ADAPTER=memory` / non-durable still uses fallback).
- `tests/m9Activation.test.ts` — C1 distinct keys + held-lock skip + distinct-key non-block; C2 flags off/strict/single-authority; C3 fixture-mismatch; C4 score sanity; C5 mandatory odds per market + idempotent + zero-odds-fails + captureId identity + empty-markets fail-closed; C6 write_failed vs immutable_violation; C7 diagnostics freshness; end-to-end settle; frozen-invariance (odds write never mutates snapshot id/hash).

**Bounded scratch benchmark (deleted after recording, not in repo):** empty-pass 0.04 ms/pass; capture + settlement O(F²) tables (§6). No probe or benchmark file remains in the repository or working tree (verified: `find` for `*bench*`/`clobber*` → none).

**Verification (exact, this pass):**
- `tests/m9Concurrency.test.ts` + `tests/m9Activation.test.ts` + `tests/sprint17Reliability.test.ts`: **51/51 pass**.
- Full suite (`node --test tests/*.test.ts`): **1687/1687 pass**, 0 fail, 0 skipped.
- Typecheck (`tsc --noEmit -p tsconfig.typecheck.json`): **exit 0**.
- Lint (`next lint`): **✔ no warnings/errors**.

---

## 15. Final verdict

M9 is **built, dormant, and concurrency-correct** for the intended single-instance, single-writer deployment: distinct lock keys, `finally`-release on every path, no leak, cron overlap → 409 (never 500), no queue, bounded metrics/logs/diagnostics, liveness-only health. The two prior runner defects (F-1 positional clobber, F-2 unbounded log) remain fixed, and the former cross-process single-writer gap is now **closed in code** — durable evidence locks bind `EVIDENCE_DATABASE_URL` and **fail closed** in production. The wired production path is presently **near-zero cost** because cron fires an **empty** candidate list; the O(F²) NDJSON cost — with capture as the sharper curve owing to the mandatory-odds hash-verified re-scan — is **latent until M10** wires live candidate derivation. The remaining items are **pre-activation gates, not merge blockers**: bound per-run work vs the 60 s route/event-loop budget (P2), cap the injected settlement set (P3), and the low-severity PG-only unlock-error surfacing (L-2). Absence of Postgres is **not** an M9 blocker; it is the documented boundary at roughly a few-hundred-fixtures/run or tens-of-thousands of accumulated lines. No contract, identity, hash, revision, ordering, or replay semantic was changed, and **no runtime code was modified in this review**.

# M9 PERFORMANCE CONDITIONALLY APPROVED

**Conditions (all pre-activation, to hold before flags flip and before M10 supplies real candidates):** (P2) bound per-run work so a whole-day file-adapter run cannot exceed the 60 s route/event-loop budget — lower the file-backend fixture ceiling from 500 (recommend ≤ 100–150 capture, ≤ 150 settlement), chunk, or move cron off the web process; (P3) cap the injected settlement set symmetrically. **Recommended:** L-2 unlock-error swallow; per-run single bounded archive read; AbortSignal/run budget; staggered capture/settlement schedules; archive-size warning at ~50 k lines / ~10 MB. Prior fixes F-1/F-2 and the durable fail-closed lock are contract-free and verified (1687/1687 + typecheck + lint green).
