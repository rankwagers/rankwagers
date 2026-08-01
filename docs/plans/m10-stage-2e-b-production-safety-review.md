# M10 Stage 2E-B — Benchmark & Production-Readiness Gates — Independent Production-Safety Review

**Review type:** Read-only production-safety review of the **Stage 2E-B benchmark methodology & readiness plan** (evidence-only; activates nothing). **No runtime, routes, cron, jobs, flags, tests, schemas, database, migrations, deployment, or benchmark code was created, modified, or executed.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Production-Safety Reviewer, Sprint 23B / M10 Stage 2E-B.
**Governing/read completely:** `m10-live-candidate-pipeline-specification.md` (Rev A1); `m10-stage-2d-closure.md`; `m10-stage-2e-a-activation-design-plan.md`; `m10-stage-2e-a-closure.md`; `m10-stage-2e-b-benchmark-readiness-plan.md`.
**Repository verified this pass (file:line):** `lib/jobs/runner.ts:297,306,378-401` (deadline built **post-discovery**); `lib/evidence-capture/config.ts:120,130-152` (constants); `lib/evidence-capture/candidates/operational.ts:29,44,49-63` (≤45 s clamp); `lib/evidence-capture/candidates/limits.ts:10-25` (100/150); `lib/observability/metrics.ts:18,39,88,120` (`snapshot`/`publicMetricsView`/`sanitizeLabels`/`safeRun`); `lib/archive/evidence/file.ts:54-59` (`EVIDENCE_ARCHIVE_DIR`-redirectable); `lib/footystats/dailyArchive.ts:7,71-79` (source path **not** env-configurable + **fail-open** reader); `lib/jobs/locks.ts` (durable prod fail-closed); `deploy/ecosystem.rankwagers.cjs` (`instances:1`, `kill_timeout:10000`).

---

## 1. Executive Summary

# CONDITIONALLY PASSED

Stage 2E-B is an **evidence-only** benchmark methodology: it builds a synthetic-fixture harness (`scripts/bench/m10/`, tsx), runs the **existing** frozen code paths against **temporary** archives, and produces audit artifacts + resolves a GO/NO-GO/DEFER matrix. It **activates nothing** — no route, cron, flag, schema, migration, or production write is authorized, and its own §17/§23 make explicit that benchmark completion authorizes only *Stage 2E implementation* (default-OFF), never production activation.

**The methodology, as designed, does not introduce an unsafe production write path.** Its two central isolation mechanisms are sound and verified: the evidence archive is redirected by `EVIDENCE_ARCHIVE_DIR=<tmp>` (honored first by `resolveEvidenceArchiveDir`, `file.ts:57`), so every full-write cell writes to a temp dir; and mode flags are set in the ephemeral bench process env, not the shared `.env`/PM2 env, so no production flag is touched. The route-entry measurement contract correctly quantifies the verified post-discovery deadline-anchor gap (`runner.ts:306`), the dry-run zero-write proof is rigorous (pre/post byte-identical archive manifest + `writes_committed==0`, even under injected failure), the string-wall depth ceiling is a **fail-closed hard gate**, and FULL_WRITE remains correctly gated behind evidence + review + deployment + phased human go/no-go.

**Why CONDITIONALLY (not PASSED):** the plan pins the evidence-dir isolation (`EVIDENCE_ARCHIVE_DIR`) but is **silent on isolating the non-env-configurable daily-archive source path** (`dailyArchive.ts:7` hardcodes `process.cwd()/data/daily-archives`), and it does not require an explicit **pre-flight assertion** that write cells target a temp evidence dir (not the prod `/opt/rankwagers/shared/evidence-archive` default that `NODE_ENV=production` selects when `EVIDENCE_ARCHIVE_DIR` is unset, `file.ts:59`). These are safety-critical harness guards that must be pinned before B-1/B-2 execution. They are **Implementation clarifications**, not blockers — the isolation seams exist (injectable `readRows`; `EVIDENCE_ARCHIVE_DIR`), the plan's stated intent and B-1/B-2 stop conditions already forbid touching prod data, and per the blocking rule an unfinished harness is not a design defect.

**Why not BLOCKED:** no element of the methodology *itself* introduces an unsafe production path. Every risk is closable by a harness guard the plan already gestures at (synthetic-only, temp fixtures, R-5 prod-URL refusal, "writes to prod archive" stop conditions).

---

## 2. Repository Validation (do-not-trust-the-plan — verified from source)

| Plan claim | Source verification | Verdict |
|---|---|---|
| Deadline anchored **post-discovery** (escapes budget) | `runner.ts:306` `createDeadline({startedAtMs: now()})` inside `producerDeadlineBudget`, called at `:401` **after** `await provideCandidateBatch()` (`:381`) | ✅ accurate — F-C measurement is warranted |
| Provisional constants | `config.ts:120` headroom 15000; `:148-152` reserves 250/120; `operational.ts:29` hard-max 45000; `limits.ts:11-12` 150/100 | ✅ accurate |
| Route budget = handler entry; `maxDuration=60` | both routes `:7`; `cronHandler.ts` `started = Date.now()` | ✅ accurate |
| Source reader **fail-open** | `dailyArchive.ts:76-78` `catch { return null }` | ✅ accurate — strict variant genuinely required (F-D) |
| **Source path not env-configurable** | `dailyArchive.ts:7` `ARCHIVE_DIR = path.join(process.cwd(),"data","daily-archives")` — no env override | ⚠️ **isolation gap** (F-1) — plan silent on mechanism |
| Evidence archive **env-redirectable** | `file.ts:57` `EVIDENCE_ARCHIVE_DIR` authoritative; `:59` prod default when unset | ✅ redirect works; ⚠️ write-cell must assert temp dir (F-2) |
| Strict whole-archive readers; `fs.readFile` string wall | `readAllSnapshotsStrict`/`…ValidationsStrict`/`…OddsRecordsStrict` (verified prior stages) | ✅ accurate |
| Metrics evidence source | `metrics.ts:88` `snapshot()`, `:120` `publicMetricsView()`, `:18` `sanitizeLabels`, `:39` `safeRun` | ✅ accurate — bounded, no entity id |
| Lock durable, prod fail-closed | `locks.ts` `requireDurable && NODE_ENV==="production"` + no URL → `null`; memory fallback only non-prod/`JOB_LOCK_ADAPTER=memory` | ✅ accurate |
| Harness convention scripts/tsx + `mock-server-only.cjs` | `scripts/*.{mjs,ts}` + `--require ./scripts/mock-server-only.cjs` | ✅ accurate |
| Deployment `instances:1`, fork, `kill_timeout:10000`, no SIGTERM drain | `ecosystem.rankwagers.cjs`; `instrumentation.ts` | ✅ accurate |

All grounding claims are accurate. The one material omission is the source-path isolation mechanism (F-1); the evidence-dir handling is correct but needs an explicit write-cell assertion (F-2).

---

## 3. Production-Safety Assessment (could the methodology…?)

| Could the benchmark accidentally… | Assessment |
|---|---|
| **write evidence** | **No, by design** — full-write cells write to `EVIDENCE_ARCHIVE_DIR=<tmp>` (env redirect verified). **Residual (F-2):** a write cell that omits `EVIDENCE_ARCHIVE_DIR` under `NODE_ENV=production` would fall back to the prod dir (`file.ts:59`) → require a pre-flight temp-dir assertion. |
| **modify archives** | **No** — the real archive dir is never resolved when `EVIDENCE_ARCHIVE_DIR` is a temp path; temp archives are `mkdtemp`-created and deleted. |
| **change immutable evidence** | **No** — append-only, content-addressed; the harness runs unchanged frozen store code; the real files are outside the temp dir. |
| **change settlement behaviour** | **No** — the harness runs the *existing* `runSettlementBatch`/`settleLatestSnapshotForFixture`; it builds no runtime code (scripts-only). |
| **change capture behaviour** | **No** — same; capture writes are additionally blocked on the unbuilt M4→M5 derivation. |
| **change correction behaviour** | **No** — settlement is first-settle-only (frozen 2C firewall); the benchmark reads `currentValidationHeads`/sets `correctionCause` nowhere. |
| **change production routing** | **No** — the harness calls code paths directly; it never hits the HTTP routes or the cron handler. |
| **change scheduling** | **No** — scheduler cadence is an *input* (arrival-rate) to the INV-S capacity check, not a real scheduler run. |
| **change persistence / contracts** | **No** — no schema, no migration, no `types/evidence` change; artifacts live under a docs/evidence path, not runtime. |

**Source-path residual (F-1):** because `readDailyArchive`/the strict variant resolve `process.cwd()/data/daily-archives` (non-env-configurable), a benchmark that materialises a synthetic `<date>.json` in the production cwd could **overwrite or read a real daily-archive source file**. This corrupts *source* data (not immutable evidence) and is contained to the bench runtime, but must be prevented — cleanly achievable via the injectable `readRows` seam (candidate cells never call `readDailyArchive`) and a temp `cwd` for the reader-parse-cost cell, plus a guard refusing to write a non-temp `data/daily-archives`.

---

## 4. Deadline Safety

- **Route-entry timing (correct):** the measurement contract (§5) starts the clock at `handleCronPost` entry (`started = Date.now()`), so source-load + discovery are charged — precisely quantifying the verified post-discovery anchor gap (`runner.ts:306`). The benchmark **measures** the gap so the Stage-2E entry-anchor can be sized; it does **not** itself move the anchor (that is Stage-2E implementation, F-C).
- **Deadline accounting / headroom / reserve:** the plan validates the provisional constants (headroom 15 s, reserves 250/120, hard-max 45 s — all verified in source) with measured p95/p99 and retunes or DEFERs on breach. Deterministic via an **injected fake clock** for the deadline decision + wall-clock (`hrtime.bigint`) for durations — the clock never enters evidence data (unchanged Stage-2D guarantee).
- **Benchmark timing boundaries / failure-on-timeout / partial-run / cleanup / lock-release:** §5 End = response serialization complete + lock released (`runWithLock` `finally`); §13 benchmarks deadline-exceeded → `deferred_by_deadline`, bounded, no overrun; §9 asserts lock release in `finally` (normal + thrown-body) and reacquirability. Partial-run defers the remainder and returns `succeeded` bounded. **Safe.**
- **Verdict:** deadline-safety of the methodology is sound; the entry-anchor itself is a Stage-2E implementation carry-forward (F-C), which the benchmark correctly sizes rather than assumes.

---

## 5. Archive Safety

- **Depth / growth (fail-closed hard gate):** synthetic depths up to near the `fs.readFile` string wall (~512 MB `MAX_STRING_LENGTH`); the plan makes the **string-wall depth ceiling a hard gate** — a read that would exceed the wall must be **prevented by the depth ceiling, not attempted** (§7). This is the correct fail-closed posture; the benchmark must not itself attempt an over-wall read (which would throw). **Safe.**
- **Corruption / missing / stale handling:** §13 injects corrupt (→ `archive_read_failed`/`failed`, never empty), missing partition (ENOENT → empty `succeeded`, distinguished from fault), and stale (freshness threshold → `run_degraded`/defer). Asserts fail-closed classification + no false-empty. **Safe.**
- **Strict-reader assumptions:** the benchmark exercises the *strict* variant (F-D, to be built): ENOENT→empty, malformed/IO→throw, deterministic. Correct.
- **Path assumptions:** evidence dir via `EVIDENCE_ARCHIVE_DIR` (verified redirect); daily-archive source via process.cwd (F-1 gap). **Clarification (F-1/F-2).**
- **Rollback:** §11/§12 record flags-off → zero next-fire writes; re-fire idempotent (`already_exists`/`already_settled`/`no_change`); already-written records immutable, never deleted. **Safe.**

---

## 6. Lock Safety

- **Single / multi-instance:** §9 proves single-writer via the durable PG advisory lock (disposable local PG), and that `instances:1` **or** the provisioned durable lock is the guarantee (Gate D). Memory-adapter cells are explicitly **timing-only, never a single-writer claim** — correct.
- **Contention / starvation / recovery / release / crash / fail-closed:** §9 cells cover same-key contention (loser → `null`/409 within the ≤1 s try-window), lock wait (bounded try-window, never indefinite), release in `finally` (normal + thrown), session-drop auto-release (reacquirable, committed appends persist), stale-lock (session-scoped, no reaper), and cross-process single-writer. **No process-local lock is accepted for durable protection** (verified `locks.ts` prod fail-closed). **Safe.**
- **Residual (F-3):** the disposable-PG cells must enforce the R-5 guard **refusing prod-looking `EVIDENCE_DATABASE_URL`** (advisory locks don't write data, but connecting to prod DB must be prevented). Implementation clarification — already in the plan (R-5), must be enforced in the harness.

---

## 7. Dry-Run Safety

**Exemplary and rigorous.** §10 proves zero-write **structurally** (the sole write path — `runCaptureBatch`/`runSettlementBatch` — is not invoked, per 2E-A §13) **and empirically**: a pre-run archive manifest (file list + sizes + mtimes + per-file sha256) is compared to a post-run manifest and must be **byte-identical**, plus `writes_committed == 0` in the metrics snapshot. Critically, the proof is repeated **under every injected failure** (missing/corrupt/stale source, archive-read throw, deadline exceeded, invalid config) — a failure in dry-run must **still** leave a byte-identical manifest. **Any write in dry-run = NO-GO (design-defect escalation).**

This satisfies zero writes / zero persistence / zero mutation / zero append / zero archive-modification / zero evidence-modification **even under injected failures**. The only precondition is F-2 (the dry-run archive manifest must be captured over the *temp* evidence dir, guaranteed by the write-cell temp-dir assertion). **Safe.**

---

## 8. Canary Safety

§11 records: **selection determinism** (same seed → byte-equal selected set; first-N under the total order `capturedAt`/`completionInstant` asc, tie `fixtureId`); **ordering stability** (shuffled source → identical selection, order-independent producer); **fairness/drain** (eligible > ceiling → deterministic backlog drain across fires, `oldest_pending_age` bounded under INV-S — no permanent starvation); **repeatability** (≥3 consecutive runs; writes == preceding dry-run counts; chain-verify clean; no duplicate/immutable-violation); **rollback** (flags-off → zero next-fire writes; canary records remain valid/immutable); bounded by `normalizeBatchLimit` (verified `[1,150]`, default 100, `>150→150` — no widening path). Deterministic, no randomness, no entity-id in labels. **Safe.**

---

## 9. Failure-Injection Review

| Injection | Plan classification | Assessment |
|---|---|---|
| Missing archive | ENOENT → empty `succeeded` zero | ✅ distinguished from fault; zero write |
| Corrupt archive | strict throw → `archive_read_failed`/`failed` | ✅ never empty; fast fail |
| Stale archive | freshness → `run_degraded`/defer | ✅ detected (F-B, to be built) |
| Lock unavailable | `null` → `skipped`/409 | ✅ no discovery, bounded |
| Deadline exceeded | pre-batch/between-candidate defer | ✅ `deferred_by_deadline`, no overrun |
| Metrics failure | `safeRun`/try-catch swallowed | ✅ never fails job (verified `metrics.ts:39`) |
| Configuration failure | fail-safe to OFF/bounded default | ✅ never unbounded, never widens ceiling/deadline |
| Benchmark interruption | §22 stop-conditions: halt + escalate | ✅ no work-around; declares BLOCKED on genuine gaps |
| Scheduler interruption | cadence is an input, not a live run | ✅ N/A to the harness (no real scheduler) |

Every mode resolves to a documented fail-closed/bounded outcome; none converts a source failure into an empty success (except a genuinely-missing partition, correctly distinguished). **Safe.**

---

## 10. Deployment Review

The benchmark changes **no** deployment; deployment properties are captured as **gates/carry-forward**, correctly:
- **NODE_ENV:** Environment gate requires `NODE_ENV=production` (the load-bearing multi-instance fail-closed precondition, `locks.ts`).
- **EVIDENCE_DATABASE_URL / durable locking / instances:** Secrets + Concurrency + Deployment gates require provisioning + `instances:1`-or-durable-lock (Gate D). Disposable-PG only in the harness (R-5).
- **Scheduler cadence:** Scheduler gate (`cadence × ceiling ≥ arrival`, INV-S).
- **PM2 restart semantics / secret provisioning:** F-F (request-time flag re-read vs `pm2 restart --update-env`; kill-latency) + Secrets gate.
- **Rollback:** Rollback gate (flags-off stops writes; no data delete).
- **`kill_timeout` (10 s) > effective deadline (≤45 s):** Deployment gate — **note:** the plan's phrasing "kill_timeout > effective deadline" is inverted relative to the current `kill_timeout:10000` (10 s < 45 s). The *intended* guarantee is that the **effective deadline (≤45 s) < route budget (60 s)** so the job self-bounds before the platform kill; `kill_timeout` governs SIGTERM→SIGKILL grace, not the run length. This wording should be corrected in the deployment gate (Deployment clarification) — not a methodology defect.

---

## 11. Go / No-Go Review

The §16 matrix resolves every criterion to exactly one of GO/NO-GO/DEFER with a binding rule (any NO-GO on a blocking gate ⇒ activation refused; DEFER ⇒ wait on named remediation; **no auto-promotion; every production step requires human go/no-go**). It correctly prevents:
- **unsafe deployment** — Environment/Secrets/Concurrency/Deployment NO-GOs;
- **unsafe activation** — Benchmark/Performance/Rollback/Canary/Dry-run NO-GOs; capture full = permanent DEFER (needs M4→M5);
- **unsafe benchmark execution** — §22 stop conditions (no prod data/secret/archive; any dry-run write; unfittable 60 s budget → back to 2E-A; unprovable single-writer; string wall reachable; any frozen change) + R-5 prod-URL guard.

**FULL_WRITE gating is airtight:** §12/§16/§17/§23 make benchmark completion authorize only *Stage 2E implementation* (default-OFF), never activation — activation additionally needs the built+reviewed composition, deployment provisioning, and phased human go/no-go (capture also M4→M5). **Benchmark completion alone never authorizes production activation.** ✅

---

## 12. Findings (classified)

| # | Finding | Class |
|---|---|---|
| **F-1** | The daily-archive **source path is not env-configurable** (`dailyArchive.ts:7`, `process.cwd()/data/daily-archives`); the plan pins the evidence-dir isolation (`EVIDENCE_ARCHIVE_DIR`) but is **silent on isolating the source path**. The harness must isolate it via the injectable `readRows` seam (candidate cells) and/or a temp `cwd` for the reader-parse-cost cell, plus a guard refusing to write a non-temp `data/daily-archives`, so no real source file can be read/overwritten. | **Implementation clarification** |
| **F-2** | Write cells must **assert `EVIDENCE_ARCHIVE_DIR` is a temp/non-prod dir** (and/or `NODE_ENV != production`) before any write, so a misconfigured cell cannot fall back to the prod evidence dir (`file.ts:59`). Strengthens the existing §4 commitment with an enforced pre-flight guard. | **Implementation clarification** |
| **F-3** | The disposable-PG lock cells must **enforce the R-5 guard refusing prod-looking `EVIDENCE_DATABASE_URL`** (advisory locks don't write, but prod-DB connection must be prevented). Already in the plan; must be a hard harness assertion. | **Implementation clarification** |
| **F-4** | Deployment-gate wording "`kill_timeout` > effective deadline" is inverted; the intended invariant is **effective deadline (≤45 s) < route budget (60 s)** so the job self-bounds before any platform kill. Correct the phrasing. | **Deployment clarification** |
| **F-5** | Current-representative + high-water depths depend on **Ops-provided prod line counts** (never by reading prod); if unavailable the depth gate DEFERs on conservative estimates. | **Production clarification** |
| **F-6** | Route-entry deadline anchor + structural dry-run no-write test (F-C), strict reader (F-D), freshness/stale detection (F-B), missing-partition observability + path parity (F-A), `NODE_ENV`/durable-lock assertion (F-E), correction-firewall guards (F-L) — **built in Stage 2E implementation** (measured/gated here, not built). | **Future-stage item** |
| **F-7** | Synchronous whole-file parse event-loop stall may **DEFER FULL_WRITE** at deep archives → streaming-read hardening (later); frozen O(F·A) M6/M8 cost is measured, not changeable → remediation is retention/Postgres (future). Capture full write needs the M4→M5 derivation stage. | **Future-stage item** |

**No BLOCKER.** No finding shows the methodology *itself* introducing an unsafe production path; F-1/F-2/F-3 are safety-critical harness guards to pin before B-1/B-2 execution, all achievable with existing seams.

---

## 13. Carry-Forward

- **Stage 2E-B harness (pin before B-1/B-2):** F-1 source-path isolation (injected `readRows` + temp `cwd` + non-temp-source-write guard); F-2 write-cell temp-evidence-dir assertion; F-3 R-5 prod-URL guard enforcement.
- **Stage 2E implementation (after 2E-B evidence + review):** F-C route-entry anchor + structural dry-run test; F-D `readDailyArchiveStrict`; F-A/F-B partition observability + freshness; F-E `NODE_ENV`/durable-lock assertion; F-G/F-H/F-L tests + firewall guards.
- **Deployment:** F-4 kill-timeout wording; F-E provisioning (Gate D); F-F PM2/update-env restart & kill-latency; secret/scheduler provisioning.
- **Future stages:** capture M4→M5 derivation (F-J, blocks capture write); Postgres evidence adapter + read-port parity (F-K); durable job-run store only-if-canary-insufficient; correction stage. **None pulled into Stage 2E-B.**

---

## 14. Final Verdict

# CONDITIONALLY PASSED

The Stage 2E-B benchmark methodology is a repository-grounded, evidence-only design that **does not introduce an unsafe production write path**. It runs the existing frozen code against synthetic temporary archives redirected by the verified `EVIDENCE_ARCHIVE_DIR` seam, sets mode flags only in ephemeral bench processes, measures the route from entry (correctly quantifying the post-discovery anchor gap without changing it), proves dry-run zero-write structurally **and** empirically (byte-identical manifest under injected failure), treats the string wall as a fail-closed hard gate, and keeps FULL_WRITE gated behind evidence + review + deployment + phased human go/no-go — with benchmark completion explicitly insufficient to authorize activation.

The verdict is **CONDITIONALLY PASSED**, conditional on pinning three safety-critical harness guards before execution (F-1 daily-archive source-path isolation; F-2 write-cell temp-evidence-dir assertion; F-3 disposable-PG prod-URL refusal) and the Stage-2E-implementation / deployment / future carry-forward. These are **Implementation/Deployment clarifications and future-stage dependencies** — exactly the kind for which the task reserves a conditional verdict — **not blockers**: the isolation seams exist, the plan's stated intent and stop conditions already forbid touching production, and per the blocking rule an unfinished harness is not a design defect.

**Classification of the block decision:** **NOT BLOCKED** — no benchmark-methodology element could create an unsafe production path once F-1/F-2/F-3 are enforced (and all three are closable with existing seams the plan commits to in principle).

---

## 15. Explicit Confirmations

- **NO runtime code modified** ✅
- **NO benchmark executed** ✅
- **NO route modified** ✅
- **NO cron enabled** ✅
- **NO feature flag enabled** ✅
- **NO deployment modified** ✅
- **NO schema modified** ✅
- **NO migration created** ✅
- **NO production activation performed** ✅

The only file created by this review is `docs/plans/m10-stage-2e-b-production-safety-review.md`. No routes, cron, jobs, flags, tests, schemas, database, migrations, deployment, or benchmark/harness code were created, modified, or executed; no production archive, secret, or database was read.
