# Sprint 23B — Milestone M9 (Activation & Production Wiring) — Production Readiness Review

**Reviewer:** Claude 3 (production readiness / activation gates). **Date:** 2026-07-30 (FINAL RE-REVIEW; supersedes the 2026-07-29 pre-build review).
**Status:** RECORDED — production-readiness review only. **No runtime code changed; no flag enabled; no external scheduler created; no Postgres activated; no deployment config touched; no frozen contract touched.**
**Method:** Repository read directly and verified against source (`file:line` anchors), not trusted from the implementation summary. Every prior blocker gate (G1–G9) re-checked in code and against its test. Substrate + M9 wiring exercised via focused tests, full suite, typecheck, and lint.

**VERDICT: M9 PRODUCTION CONDITIONALLY APPROVED** — **the repository implementation is production-ready and carries NO repository blocker.** All nine 2026-07-29 gates (G1–G9) are now closed in code and verified green (1687/1687 suite, typecheck exit 0, lint clean). Activation remains gated on out-of-repository operational actions (§15) and one scope acknowledgement: a bare cron fires an **empty, safe** pass — the live candidate pipeline (M4→M5 derivation) is explicitly out of M9 (M10, §13). None of the closed gates required a frozen-contract, identity, hash, revision, archive-format, or replay-semantic change; the frozen-invariance test passes.

---

## 0. What changed since the 2026-07-29 review (verified re-read)

The prior review recorded the M9 wiring as **unbuilt** and listed nine gates (G1–G9). Re-reading the repository at 2026-07-30, **the wiring now exists and every gate is closed in code**:

| 2026-07-29 gate | Closure (verified `file:line`) | Status |
|---|---|---|
| **G1** cross-process single-writer | `locks.ts:27-41` — durable evidence locks bind `EVIDENCE_DATABASE_URL`; in production, absence **or** `JOB_LOCK_ADAPTER=memory` **or** unreachable DB returns `null` (fail-closed, never a memory lock). `runner.ts:72-74` sets `requireDurable` for both evidence job types. | **CLOSED** |
| **G2** dual-flag reconciliation | `runner.ts:288,325` gate on env `isCaptureEnabled`/`isSettlementEnabled` (`config.ts:97-108`), independent of the dormant `settlement.ts:49` constant; disabled → `flagSkippedJob` (`runner.ts:246-262`) → 409, no lock, no work. | **CLOSED** |
| **G3** fixture correspondence | `settlement-run.ts:186-195` — `row.matchId === fixtureId` enforced before any store read/write. | **CLOSED** |
| **G4** score sanity | `settlement-run.ts:141-155,198-201` — `hasValidCompletedScores` requires non-negative-integer FT (and present HT) scores. | **CLOSED** |
| **G5** mandatory odds pair | `capture-run.ts:127-146` + `mandatory-odds.ts:110-160` — one `evidence_capture` odds record per supported market; zero markets / failed write ⇒ **failed capture** (DoD 5), never a silent zero-odds success. | **CLOSED** |
| **G6** adapter read-fail-to-empty | `file.ts:98-135` — **only `ENOENT` reads as empty**; `EACCES/EPERM`, `EIO/EBUSY/ENXIO/ENODEV`, malformed NDJSON, and any other error **throw**. | **CLOSED** |
| **G7** observability | `runner.ts:264-273` per-outcome counters; `diagnostics.ts` per-job freshness (`lastSuccessAgeSec`), last status/error/counts; access-gated route `app/api/internal/jobs/diagnostics`. Scheduled `verifyEvidenceChain` sweep + external alert routing remain **operational** (§8, §15). | **CLOSED in-repo (alerting/sweep = operational)** |
| **G8** store-outcome classification + bound | `runner.ts:301-308,337-343` classify `write_failed` vs `immutable_violation`; orchestrators isolate throws per candidate; `JOB_LOG_MAX=500` bounds the log; route `maxDuration=60`. | **CLOSED** |
| **G9** M9 tests | `tests/m9Activation.test.ts` (18), `tests/m9Concurrency.test.ts` (11) + substrate. | **CLOSED** |

## 1. Executive summary

M9 wires the already-built, dormant capture (M6), settlement (M8), input-identity (M7), mandatory-odds (C5), and archives (M2/M3) into two internal cron routes + a job runner + operational diagnostics, behind default-off flags, with a fail-closed durable lock. **All of it is now present and green.** The guards the frozen algorithms deliberately leave to their caller (fixture correspondence C3, score sanity C4, mandatory odds C5, error classification C6, observability C7) live **outside** the frozen services — the frozen identity/hash/revision surface is untouched (verified by the `frozen: writing mandatory odds never mutates the snapshot's id or contentHash` test).

The system is safe to activate in a **staged** rollout once the operational gates in §15 are satisfied. The single most important operational fact: **cross-process single-writer now depends on `EVIDENCE_DATABASE_URL` + a reachable advisory-lock DB** — in production, if that is absent or the DB is unreachable, the evidence jobs **fail closed (skip)** rather than admit a second writer. Setting that URL and provisioning advisory-lock permission is the top activation gate.

## 2. Scope boundary

**In M9 repository scope (all built):** two internal cron routes (auth + rate-limit + durable lock, fail-closed when off); `JobType` members + runners; distinct per-pipeline lock keys; fail-closed durable-lock policy bound to `EVIDENCE_DATABASE_URL`; C3/C4/C5/C6 data guards; strict archive reads (G6); NDJSON shared-dir durability; per-job operational diagnostics; bounded, concurrency-safe job log.
**Out of repository (operational gates, defined not authored here):** setting `EVIDENCE_DATABASE_URL`; provisioning DB permission for `pg_advisory_lock`; setting the cron secret; enabling flags; external scheduler creation/cadence; archive-dir ownership; external monitoring/alert routing; the scheduled `verifyEvidenceChain` sweep cadence; Postgres cutover.
**Explicitly out of M9 (later milestone):** the live candidate-derivation pipeline (M4→M5) that supplies real `CaptureRequest`/`SettlementCandidate` inputs — candidates are **injected** (`runner.ts:283-286,319-323`). See §13.

## 3. Actual runtime topology (verified)

| Property | Reality | Anchor |
|---|---|---|
| PM2 mode | `exec_mode:"fork"`, `instances:1`, `autorestart:true`, `max_restarts:10`, `min_uptime:"10s"`, `kill_timeout:10000`, `listen_timeout:10000` | `deploy/ecosystem.rankwagers.cjs:35-42` |
| Single-instance | **Current config, not an enforced invariant** — but single-writer no longer *rests* on it: the durable lock is the guarantee (§7) | same + `locks.ts:27-41` |
| App root | `AFF_SITE_ROOT \|\| /opt/rankwagers/current` (release-symlinked) | `ecosystem…cjs:3-5` |
| Shared dir convention | `/opt/rankwagers/shared` (`.env.local -> /opt/rankwagers/shared/.env`) | filesystem |
| Archive backend | file-NDJSON default; `EVIDENCE_ARCHIVE_ADAPTER=memory` opt-in; **no Postgres adapter exists** | `config.ts:19-63`, no `postgres.ts` |
| Evidence archive dir (prod) | `/opt/rankwagers/shared/evidence-archive` unless `EVIDENCE_ARCHIVE_DIR` set — **survives release swap**; whitespace override treated as unset | `file.ts:45-71` |
| Lock backend (evidence jobs) | PG advisory **iff** `EVIDENCE_DATABASE_URL` set + reachable; else in production → **fail-closed null (skip)**; in dev/test → in-process `Set` | `locks.ts:27-49` |
| Route timeout / kill timeout | route `maxDuration=60`; PM2 `kill_timeout=10000` (10s SIGKILL grace) | `route.ts:7`, `ecosystem…cjs:41` |
| Event-loop impact | job body is `await`ed inside the request; NDJSON scan is O(A) per fixture (gated by empty candidate list today) | `runner.ts:99`, `file.ts` |
| Restart / diagnostics reset | in-process `Map` counters + bounded `jobLog` — **process-local, reset on restart, not shared across instances, not durable** | `metrics.ts:11-13`, `runner.ts:23-31` |

**Conclusion:** single-instance PM2 is still the deployed shape, but production single-writer no longer *depends* on it — it depends on the durable advisory lock (§7). Raising `instances` would be **safe for correctness** (the lock serializes across processes) though wasteful; without `EVIDENCE_DATABASE_URL` the jobs simply skip. **Release/restart overlap:** a rolling release with two live processes is now correctness-safe via the shared advisory lock; diagnostics freshness, however, is lost on restart and fragmented across instances (§8).

## 4. Activation flow (verified transition-by-transition)

```
external scheduler → POST /api/internal/cron/{evidence-capture|prediction-settlement}   [route.ts]
  → handleCronPost → evaluateCronAccess
        POST-only 405 / internalCronEnabled 404 / secret <16 or "change-me" in prod 403 /
        missing x-cron-secret 403 / mismatch (timing-safe) 403                          [cronAccess.ts:32-67 ✓]
  → rate limit 6/60s → 429 + Retry-After                                                [cronHandler.ts:26-44 ✓]
  → run{Capture|Settlement}Job():
        env flag gate — OFF → flagSkippedJob → 409, NO lock, NO work                    [runner.ts:288,325 ✓]
        → runWithLock(job:<type>, requireDurable=true):
             durable lock via EVIDENCE_DATABASE_URL; prod-absent/unreachable/memory → null → skipped/409  [locks.ts:27-62 ✓]
        → runCaptureBatch|runSettlementBatch over INJECTED candidates (bare cron ⇒ [] ⇒ empty safe pass)  [runner.ts:296,332 ✓]
             capture: C5 mandatory odds per market; settlement: C3 fixture + C4 score guards
        → archive append (write_failed surfaced; strict reads throw on real errors)     [file.ts ✓]
        → classify outcome (C6): writeFailed/immutableViolation → failed(+code); else succeeded  [runner.ts:301-308 ✓]
        → metrics evidence_job_outcome_total + refresh_job_* ; trackJob (bounded, identity-safe)  [runner.ts:264-273 ✓]
  → HTTP 200 succeeded / 409 skipped / 500 failed ; no-store ; noindex                  [cronHandler.ts:60-78 ✓]
```

**No fail-open point remains.** The three the prior review flagged are closed: the pipeline flag gate exists (`runner.ts:288,325`), the lock is durable + fail-closed in prod (`locks.ts:39`), and `readNdjson` no longer returns `[]` on real read errors (`file.ts:104-134`).

## 5. Flag matrix (authoritative)

| Flag / symbol | Source | Default | Malformed/missing | Role |
|---|---|---|---|---|
| `internalCronEnabled` | `featureFlags.ts:44,75` (`ENABLE_CRON`/`FF_INTERNAL_CRON_ENABLED`) | **OFF** | `parseBool` → OFF | Route auth gate (404 when off), `cronAccess.ts:40` |
| `isCaptureEnabled(env)` | `config.ts:97-101` (`EVIDENCE_CAPTURE_ENABLED`) | **OFF** | `readFlag` → OFF (only `"true"`/`"1"`) | Capture job gate — **before** lock (`runner.ts:288`) |
| `isSettlementEnabled(env)` | `config.ts:104-108` (`EVIDENCE_SETTLEMENT_ENABLED`) | **OFF** | → OFF | Settlement job gate — **before** lock (`runner.ts:325`) |
| `EVIDENCE_SETTLEMENT_ENABLED` (const) | `settlement.ts:49` hardcoded `false` | **OFF** | env cannot flip | Dormancy guard inside frozen module — **not** the activation flag; runner does not rely on it |
| `JOB_LOCK_ADAPTER=memory` | `locks.ts:34` | unset | — | In production forces durable evidence locks to **fail closed** (§7) |

All flags default OFF and fail safe on unknown/blank input (verified `m9Activation` `C2: flags are strict`). Capture and settlement are independently gateable; the env predicate — not the module constant — is the single authority (verified `C2: single flag authority`). Routes are `force-dynamic` with no top-level job calls, so import/build execute no work.

## 6. Cron readiness

Routes enforce: POST-only (405), `internalCronEnabled` (404), header-only timing-safe secret ≥16 chars, `"change-me"` rejected in prod (403), missing/mismatched secret (403), rate limit 6/60s (429 + `Retry-After`), `skipped→409`, `failed→500`, `succeeded→200`, `Cache-Control:no-store`, `x-robots-tag:noindex`, structured `cron_executed` log. No public data leakage; no secrets echoed. Both routes set `maxDuration=60`. Idempotency is inherent (capture full-stream idempotent; settlement revision-aware; both lock-serialized). **Operational scheduling (out-of-repo):** capture before settlement per window; no same-pipeline overlap (lock makes overlap safe but wasteful); catch-up after downtime safe (idempotent); scheduler clock is the source of `nowSec`/`completionInstant`, must be UTC + source-derived — today supplied via injected candidates only.

## 7. Single-writer gate (CLOSED in code; operational config required)

**Cross-process single-writer is now guaranteed by the durable advisory lock — conditional on operational config.** `tryAcquireJobLock(key, {requireDurable:true})` (`locks.ts:18-49`), invoked for both evidence job types (`runner.ts:72-74`), binds to `EVIDENCE_DATABASE_URL` (`locks.ts:27-28`) — the canonical evidence DB, not the unrelated snapshot/attribution/odds URLs the prior code keyed off. Fail-closed policy (`locks.ts:34-41,54-62`):

- **Production + no `EVIDENCE_DATABASE_URL`** → `null` → job `skipped`/409. **Never** a memory lock. (verified `m9Concurrency` "Blocker 1: … no EVIDENCE_DATABASE_URL fails closed".)
- **Production + `JOB_LOCK_ADAPTER=memory`** → `null`. (verified "Blocker 1: … JOB_LOCK_ADAPTER=memory fails closed".)
- **DB unreachable** (`pool.connect()` throws) → `null`, `pool.end()`, no fallback. (`locks.ts:54-62`.)
- **Dev/test** retain the in-process `Set` (verified "non-durable lock … still uses the in-process fallback").

Distinct keys per pipeline are free (`job:evidence_capture` vs `job:prediction_settlement`, `runner.ts:66`), so a held capture lock never blocks settlement (verified `m9Activation` C1 tests). No deadlock (single non-nested lock, released in `finally` — `runner.ts:135-137`; PG conn drop / process exit auto-releases). Lock contention performs **no writes**: `runWithLock` returns `skipped` before `fn` runs (`runner.ts:75-86`) — Q9 satisfied. Lock release is guaranteed by the `finally` (Q10).

**Activation gate O1:** set `EVIDENCE_DATABASE_URL` to a reachable Postgres shared by all app processes; grant `pg_advisory_lock`/`pg_advisory_unlock`. Until then the jobs **cannot run** in production (they skip) — itself fail-safe.

**Residual robustness note (D-1, non-blocking):** on the PG path, `release()` (`locks.ts:76-83`) awaits `pg_advisory_unlock`; if that query throws (connection died at unlock time), the throw propagates out of `release()` and, via the `finally` in `runWithLock`, converts an otherwise-**succeeded** job into a thrown 500. The append is already durable and idempotent and the advisory lock auto-releases on connection drop, so the next cron re-fire recovers. Recommend swallowing the unlock query error (mirroring `pool.end().catch`). **Not a data-safety blocker; not a merge blocker.**

## 8. Observability (C7 — in-repo surface present; alerting/sweep operational)

| Signal | Source | Status |
|---|---|---|
| last capture/settlement run, last status, last errorCode | `diagnostics.ts:45-56` | **present** |
| last-success timestamp + **age** (stale detection) | `diagnostics.ts:41-53` (`lastSuccessAgeSec`) | **present** |
| per-run result counts (capture: captured/duplicate/invalid/notAdmitted/immutableViolation/writeFailed/oddsAppended; settlement: settled/noChange/pending/unsupported/fixtureMismatch/invalidScore) | `capture-run.ts`, `settlement-run.ts` → `resultCounts` | **present** |
| per-outcome counters | `runner.ts:264-273` `evidence_job_outcome_total{job,outcome}` | **present** |
| lock contention | `runner.ts:83` `refresh_job_total{status:"skipped"}` + `job_skipped_lock` | **present** |
| write-failure / immutable-violation counts | `resultCounts` + job `errorCode` + `refresh_job_failure_total{code}` | **present** |
| flag-disabled skips | `runner.ts:259` `refresh_job_total{status:"skipped"}` + `job_skipped_flag` | **present** |
| immutable-violation / write-failure **alert routing** | — | **operational (scrape `/api/internal/metrics`)** |
| scheduled `verifyEvidenceChain` sweep | primitive `integrity.ts`; **not wired to a cron** | **operational gate** |

**Nature of the surface (Q19–20 + directive):** metrics and `jobLog` are **in-process Maps / a bounded array** — **process-local, reset on restart, not shared across instances, not durable.** No secrets are exposed (job diagnostics return only job type, timestamps, status, error codes, numeric counts — `diagnostics.ts:13-22`). For single-instance PM2 this is an adequate scrape target, but freshness/last-success is **lost on every restart** and would **fragment** if `instances` rose. **External alerting is REQUIRED before flip** — the repo emits the signals; routing violation/failure/staleness to a pager is operational. A scheduled `verifyEvidenceChain` sweep (thin cron over `integrity.ts`) is the required torn/duplicate-line detector and should be scheduled before soak.

## 9. Health and diagnostics access

`/api/internal/jobs/diagnostics`, `/api/evidence/diagnostics`, `/api/internal/metrics` are access-gated (`requireDiagnosticsAccess` → `evaluateDiagnosticsAccess`), `no-store`, `noindex`, expose **no secrets**, make no provider calls, do not scan NDJSON per request, and do not mutate/activate jobs. **Gap (non-blocking):** no dedicated readiness/liveness surface (archive-dir writability, lock-backend presence). Recommended future: `disabled|dormant|ready|degraded|unhealthy`.

## 10. NDJSON durability

- **Shared-dir orphan fix present:** `resolveEvidenceArchiveDir` (`file.ts:52-59`) → `/opt/rankwagers/shared/evidence-archive` in production, overridable by `EVIDENCE_ARCHIVE_DIR` (whitespace treated as unset). Survives release swaps (Q21).
- **Path pinned** once at store construction (`file.ts:145-152`).
- **Append surfaces failure (Q22):** `appendFile`/`mkdir` errors caught → `write_failed`, never swallowed (`file.ts:180-193` + wrappers). Directory creation is `mkdir(recursive)` before each append; failure → `write_failed`. Disk-full (`ENOSPC`) → `write_failed`.
- **Strict reads (G6 closed; Q11–14):** `readNdjson` (`file.ts:97-137`) — **only `ENOENT` → empty**; `EACCES/EPERM`, `EIO/EBUSY/ENXIO/ENODEV`, malformed NDJSON (per-line), and any other code **throw** with a differentiated message; the file is never rewritten. A malformed line **stops** authoritative processing: capture's stream read → `archive_error` → orchestrator `writeFailed` → job `failed`; settlement's `latestSnapshot` throw → orchestrator `writeFailed` → job `failed`. (verified `evidenceArchiveFileAdapter` tests.)
- **Known limits (ops-hardening, not blockers):** `appendFile` is not fsync'd (power-loss tail risk); corrupt lines are now **loud on read** (throw), so the sweep + a failed job are the detectors.
- **Backup/retention (out-of-repo gate):** the evidence/provider/odds NDJSON is the sole non-reconstructable replay basis. Backup, byte-exact + ordered restore verification, and retention must be operationally defined; **M9 must not prune the provider/odds basis** (protects M7 replay).

## 11. Rollback behavior

Rollback is by **flag flip** (env → `readFlag`, read fresh per call — no cached flag). No rollback deletes or rewrites history (append-only; no update/delete in the store contract; Q23).

| # | Scenario | Behavior |
|---|---|---|
| 1 | Disable capture, no job running | Next call → `capture_disabled`/skipped/409; clean, no lock. |
| 2 | Disable capture mid-job | In-flight job finishes (flag re-checked at next route entry); append completes or `write_failed`. No partial record. |
| 3 | Disable settlement, no job running | Clean (`settlement_disabled`). |
| 4 | Disable settlement mid-job | In-flight settlement finishes current snapshot; each market append is one atomic line. No half-revision. |
| 5 | Deploy previous version after new records appended | Old readers tolerate `schemaVersion`-stamped additive records; replay preserved. |
| 6 | Request during rolling rollback | Whichever code answers gates on the live flag; disabled → 404/skipped. |
| 7 | Archive unavailable during rollback | Reads throw / `archive_unavailable`; writes → `write_failed`; no false success. |
| 8 | Scheduler keeps calling disabled routes | Deterministic 404/`skipped`; no work, no lock. |

**No rollback path deletes, rewrites, or migrates archive data.**

## 12. Failure policy matrix (verified against wiring)

| Event | Policy | Wiring |
|---|---|---|
| Lock unavailable / durable lock unobtainable in prod | **skip** (409, `lock_unavailable`); retry next cron | `runner.ts:75-85`, `locks.ts:39` |
| Flag disabled | **skip** (409, `*_disabled`); no lock, no work | `runner.ts:246-262` |
| Provider not admitted | `not_admitted` count; never persisted | `capture-run.ts:110-112` |
| No candidates (bare cron) | success, zero counts (empty pass) | `runner.ts:296,332` |
| Missing snapshot at settle | `not_found`; skip (safe no-op) | `settlement-run.ts:214-217` |
| Fixture mismatch | **reject before read/write** (`fixtureMismatch`), never settles | `settlement-run.ts:186-195` |
| Malformed score | **reject before settle** (`invalidScore`) | `settlement-run.ts:141-155,198-201` |
| Mandatory odds missing/failed | **failed capture**, never a captured success | `capture-run.ts:127-146` |
| `write_failed` | **retry** (transient); job `failed`+code; idempotent re-fire | `runner.ts:301-306` |
| `immutable_violation` | job `failed`+code — **do not blind-retry**; investigate | `runner.ts:306` |
| Malformed / torn NDJSON line | read **throws** → job `failed`; sweep detects | `file.ts:125-134` |
| Permission / I/O read failure | read **throws** (differentiated) → job `failed` | `file.ts:110-123` |
| Disk full | `write_failed`; alert | `file.ts:186-193` |
| DB lock backend unavailable | lock `null` → skip; sustained → single-writer unprotected → alert, do not force-run | `locks.ts:54-62` |
| Job timeout | route `maxDuration=60` bounds it; append either durable or idempotent re-fire | `route.ts:7` |

## 13. LIVE FUNCTIONALITY — does a bare cron do real work?

**No — a bare cron fires an empty, safe pass.** `runEvidenceCaptureJob()`/`runPredictionSettlementJob()` run over `options?.candidates ?? []` (`runner.ts:296,332`); the routes call them with no candidates (`route.ts:13`). Therefore:

- **Candidate derivation is outside M9.** Producing live `CaptureRequest` (M4→M5 fixture/model pipeline) and `SettlementCandidate` (live provider completion instant) is explicitly deferred (`runner.ts:275-281,312-317`; orchestrator headers). This is the **M10** live-pipeline milestone.
- **M9 is technically complete** as the *activation & wiring* milestone: routes, auth, locks, flags, guards, orchestrators, diagnostics, durability are built, correct, and green. Candidates are injected by design so entry points are unit-testable end-to-end (verified `m9Activation` "settlement job settles a captured fixture end-to-end").
- **Production activation of a bare cron would be SAFE but not USEFUL:** it acquires the lock, processes zero candidates, returns `succeeded` with zero counts. **Do not describe capture/settlement as end-to-end functional in production until a candidate source (M10) is supplied.** Enabling the flags before M10 is harmless (idempotent empty passes) but produces no evidence/settlements.

## 14. Repository blockers

**NONE.** Every 2026-07-29 gate (G1–G9) is closed in code and verified. The repository implementation is production-ready. Remaining items are operational (§15) or explicitly a later milestone (M10 candidate pipeline, §13). The lone code-level follow-up is the non-blocking D-1 PG-unlock swallow (§7).

## 15. Required out-of-repository operational activation gates (not code)

| # | Gate | Why |
|---|---|---|
| **O1** | Set `EVIDENCE_DATABASE_URL` to a reachable Postgres shared by all app processes; grant `pg_advisory_lock`/`pg_advisory_unlock`. | Without it, evidence jobs **skip** in production (fail-safe but non-functional) — the single-writer guarantee (§7). |
| **O2** | Set the cron secret (`CRON_SECRET`/`INTERNAL_CRON_SECRET`) ≥16 chars, not `"change-me"`; enable `ENABLE_CRON`. | Route auth (403 otherwise). |
| **O3** | Create `/opt/rankwagers/shared/evidence-archive` (or `EVIDENCE_ARCHIVE_DIR`) with correct app-user ownership/permissions. | Append/read must not fail; strict reads throw on `EACCES`. |
| **O4** | Register external scheduler: capture **before** settlement per window; no same-pipeline overlap; **UTC**, source-derived instants. | Ordering + no wasteful contention. |
| **O5** | Wire external alerting off `/api/internal/metrics` (`evidence_job_outcome_total`, `refresh_job_failure_total{code}`, `lock_unavailable`, last-success staleness). | Diagnostics are process-local + reset on restart (§8). |
| **O6** | Schedule a `verifyEvidenceChain` sweep (thin cron over `integrity.ts`) with alerting. | Detects torn/duplicate/forked lines the append path can't prevent. |
| **O7** | Backup/DR of the NDJSON basis; retention defined; byte-exact + ordered restore verification; **never prune the provider/odds basis**. | Sole non-reconstructable replay basis (M7). |
| **O8** | Supply the **M10 live candidate pipeline** before expecting real captures/settlements. | A bare cron is an empty pass (§13). |
| **O9** | Flip `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED` by explicit operator opt-in only, staged per §16. | Default-off; independent. |

Per the review directive: **the repository is NOT blocked merely because O1/O2/O9 secrets/flags are intentionally unset before activation.** They are gates, not repository defects.

## 16. Staged activation plan (with pass/fail gates)

**Stage 0 — flags off (deploy dormant).** Deploy current build; confirm `ENABLE_CRON`, `EVIDENCE_CAPTURE_ENABLED`, `EVIDENCE_SETTLEMENT_ENABLED` unset/false.
- **PASS:** routes return `404 route_disabled`; jobs diagnostics reachable (access-gated), no runs. **FAIL:** any route executes work.

**Stage 1 — config validation.** Set `EVIDENCE_DATABASE_URL` (reachable, advisory-lock grant), cron secret ≥16, archive dir created + writable, `ENABLE_CRON=true`; flags still off.
- **PASS:** cron POST with valid secret → `409` (`*_disabled`); wrong/absent secret → 403; GET → 405; archive dir writable. **FAIL:** 500, or a durable lock cannot be obtained (indicates `EVIDENCE_DATABASE_URL`/grant problem).

**Stage 2 — dry / empty-safe invocation.** Enable `EVIDENCE_CAPTURE_ENABLED` with no candidate source (bare cron), single fire.
- **PASS:** `200 succeeded`, zero counts; diagnostics show a fresh success; lock acquired + released (a concurrent 2nd fire → `409 lock_unavailable`). **FAIL:** any non-empty write, any 500.

**Stage 3 — capture-only limited activation.** Wire a **bounded** candidate source (M10 or a controlled seed batch); settlement off; low cadence.
- **PASS:** one `captureId`-keyed mandatory odds record per supported market; sane `captured`/`duplicate`; no `writeFailed`/`immutableViolation`. **FAIL:** any zero-odds capture (counts as failed), any immutable violation.

**Stage 4 — verify archives and diagnostics.** Run `verifyEvidenceChain` sweep; inspect NDJSON + diagnostics; confirm alert routing fires on a synthetic failure.
- **PASS:** chain clean; `lastSuccessAgeSec` fresh; alerts observed end-to-end. **FAIL:** any chain violation, any silent failure.

**Stage 5 — settlement limited activation.** Enable `EVIDENCE_SETTLEMENT_ENABLED`; supply candidates with deterministic UTC `completionInstant`/`nowSec`; capture before settlement.
- **PASS:** sane `settled`/`noChange`/`pending`; `fixtureMismatch`/`invalidScore` reject foreign/garbage rows; corrections carry explicit cause. **FAIL:** any settlement of a mismatched fixture/malformed score, any half-revision.

**Stage 6 — full scheduled activation.** Register production cron cadence (capture-before-settlement, no overlap, UTC); full candidate volume.
- **PASS:** sustained clean sweeps; freshness within SLO; failure/violation alerts quiet; contention only on intentional overlap. **FAIL:** sustained `write_failed`, staleness, or contention → roll back.

**Stage 7 — rollback.** Set the offending flag(s) false (per-pipeline, independent). No data touched.
- **PASS:** next call → `skipped`/`disabled`; in-flight job finishes atomically; NDJSON intact; re-enabling resumes idempotently. **No rewrite/deletion of archive data.**

## 17. Repository and test evidence

- **M9 wiring present:** `lib/jobs/types.ts:5-6` (JobTypes); `lib/jobs/runner.ts:282-346` (runners); `lib/jobs/locks.ts:18-49` (durable fail-closed lock); `lib/jobs/diagnostics.ts` (freshness); `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts`; `app/api/internal/jobs/diagnostics/route.ts`; `lib/evidence-capture/jobs/{capture-run,settlement-run}.ts`; `lib/evidence-capture/capture/mandatory-odds.ts`.
- **Guards outside frozen services:** C3/C4 `settlement-run.ts:141-201`; C5 `capture-run.ts:127-146` + `mandatory-odds.ts`; C6 `runner.ts:301-308,337-343`; frozen invariance test `m9Activation` `frozen: writing mandatory odds never mutates the snapshot's id or contentHash`.
- **Fail-closed lock:** `locks.ts:39,34,54-62`; tests `m9Concurrency` "Blocker 1" (2) + "non-durable fallback".
- **Strict reads:** `file.ts:104-134`; tests in `evidenceArchiveFileAdapter.test.ts`.
- **Verification (this re-review, 2026-07-30, no runtime code changed):**
  - Focused M9 + substrate (`m9Activation`, `m9Concurrency`, `evidenceArchiveFileAdapter`, `evidenceSettlement`, `evidenceCaptureConfig`, `evidenceCaptureMint`, `sprint17Reliability`): **113/113 pass.**
  - **Full suite** (`tests/*.test.ts`, 98 files): **1687/1687 pass, 0 fail** (exit 0).
  - **Typecheck** (`tsc --noEmit -p tsconfig.typecheck.json`): **clean, exit 0.**
  - **Lint** (M9 files `runner.ts`, `locks.ts`, `cronHandler.ts`, `diagnostics.ts`, `capture-run.ts`, `settlement-run.ts`, `mandatory-odds.ts`, `file.ts`): **no ESLint warnings or errors.**
  - Production `next build` not run — out of the "no deployment config" boundary and not required for this readiness axis (substrate is pure server/TS and typecheck-clean).

## 18. Final production decision

**M9 PRODUCTION CONDITIONALLY APPROVED.**

The M9 activation wiring is **built, correct, and fully green** — every 2026-07-29 gate (G1–G9) is closed in code, the durable single-writer lock is bound to `EVIDENCE_DATABASE_URL` and fails closed in production, the C3/C4/C5/C6 data guards live outside the provably-unmodified frozen services, archive reads are strict (only `ENOENT` is empty), the mandatory snapshot+odds pair is enforced, diagnostics expose operational freshness without leaking secrets, and rollback is a pure flag flip that neither rewrites nor deletes archive data. **There are NO repository blockers.**

Activation is **CONDITIONAL** on the out-of-repository operational gates in §15 — chiefly O1 (`EVIDENCE_DATABASE_URL` + advisory-lock grant, without which jobs safely skip), O5/O6 (external alerting + scheduled `verifyEvidenceChain` sweep, since in-repo diagnostics are process-local and reset on restart), and O8 (the **M10 live candidate pipeline**: a bare cron today runs an empty, safe pass, so activation before M10 is harmless but not useful). The lone code-level follow-up is the non-blocking D-1 PG-unlock swallow (§7). Proceed through the staged plan in §16, honoring the pass/fail gates.

No flags were enabled, no scheduler was created, no Postgres was activated, no deployment config was changed, and no frozen contract was touched by this review.
