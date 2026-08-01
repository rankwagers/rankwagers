# M10 Stage 2E-A — Activation Design — Independent Production-Safety Review

**Review type:** Read-only production-safety review of the **Stage 2E-A activation design** (design/plan, not code). **No runtime code, tests, routes, flags, config, deployment, or the activation plan were modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Production-Safety Reviewer, Sprint 23B / M10 Stage 2E-A.
**Governing:** `m10-live-candidate-pipeline-specification.md` (Rev A1, INV-A/C/D/L/S); `m10-stage-2d-closure.md`; `m10-stage-2e-a-activation-design-plan.md`.
**Code inspected to ground the review (file:line):** `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts` (dormant); `lib/jobs/runner.ts` (producer seams, deadline anchor, flag gates); `lib/jobs/locks.ts` (durable fail-closed lock); `lib/evidence-capture/config.ts` (flags, operational config); `lib/footystats/dailyArchive.ts:71-79` (**fail-open** `readDailyArchive`); `lib/footystats/dailyArchive.ts:7,54-69` (path + atomic save); `lib/evidence-capture/candidates/{operational,completed-rows,settlement-pipeline,capture-pipeline}.ts`; `lib/observability/metrics.ts`; `deploy/ecosystem.rankwagers.cjs`; `instrumentation.ts`.
**Validation baseline (from the 2D closure, not re-run — no code changed):** full suite 1824/1824, typecheck clean, lint clean; dormant routes confirmed by a scope-guard test.

---

## 1. Executive Verdict

# CONDITIONALLY PASSED

The Stage 2E-A design describes a **fail-closed, reversible, frozen-preserving** path from the dormant Stage-2D pipeline to production writes. It is **repository-grounded** — the settlement source (`readDailyArchive` → `data/daily-archives/<date>.json`) and its format exist and are correctly characterised, so no frozen-contract, schema, or migration change is required — and it correctly identifies and specifies the three real dependencies it depends on rather than hand-waving them:

1. a **strict** daily-archive reader (the current `readDailyArchive` **is** fail-open — verified `dailyArchive.ts:76-78` — and would convert source corruption into an empty success if used as-is);
2. **route-start deadline anchoring** (the current `producerDeadlineBudget` anchors the ≤45 s clock **after** discovery — verified `runner.ts` — so source-load+discovery are uncharged today);
3. a **dry-run composition** that runs discovery but never invokes the sole write path (`runCaptureBatch`/`runSettlementBatch`).

**No design defect creates an unsafe live write path.** Every failure mode is fail-closed or bounded; the lock is a durable PG advisory lock (not process-local) that fails closed in production; dry-run is structurally zero-write; canary is bounded by the same `normalizeBatchLimit` clamp as full; kill switches never interrupt an in-flight atomic append; rollback correctly separates stop-writes / code-revert / immutable-data / corruption-response; and the correction firewall is preserved by static + runtime + test + review guards. Corrections and live capture-derivation are correctly scoped **out**, making settlement the near-term activatable path.

The verdict is **CONDITIONALLY PASSED** — appropriate for the Stage-2E-B benchmark and activation-gate dependencies the plan itself gates (Gates C–F, I, K). Three items require production clarification before canary (they are **safe-of-writes** today but affect stall-detection, emergency-stop latency, and multi-instance safety); none is a design blocker. See §3.

---

## 2. Verified Against Source (design accuracy)

| Plan claim | Source verification | Verdict |
|---|---|---|
| Routes dormant, `maxDuration=60` | both `route.ts` call the bare job; no producer wired | ✅ accurate |
| `readDailyArchive` is fail-open | `dailyArchive.ts:76-78` `catch { return null }` — swallows ENOENT/EACCES/EIO/malformed | ✅ accurate — strict variant genuinely required (Gate C) |
| Source format carries status/scores/savedAt | `DailyArchive`+`ArchivedRow` (`dailyArchive.ts:9-21`); `savedAt`/`date`/`summary` present | ✅ accurate; freshness inputs exist |
| Source path is release-local `process.cwd()` | `ARCHIVE_DIR = path.join(process.cwd(),"data","daily-archives")` (`:7`); save+read share it; save is atomic tmp+rename (`:66-68`) | ✅ accurate — R-3 real; save is torn-proof |
| Deadline anchored **after** discovery today | `runner.ts` builds `producerDeadlineBudget` after `await provideCandidateBatch()` | ✅ accurate — route-start anchor genuinely required (§12/R-2) |
| Durable lock fail-closed in prod, no memory degrade | `locks.ts` `requireDurable && NODE_ENV==="production"` + no URL → `null`; memory fallback only non-prod/`JOB_LOCK_ADAPTER=memory` | ✅ accurate |
| Ceiling/deadline clamps (100/150, ≤45 s) | `operational.ts` `resolveEffectiveCeiling`/`resolveEffectiveJobDeadlineMs` | ✅ accurate |
| Loader whole-source fail-closed + per-row isolation | `completed-rows.ts` `createCompletedRowLoader` → `ProducerError("source_load_failed")` on throw/`null`; `filterCompletedRows` per-row drop | ✅ accurate |
| Metrics bounded, sanitized | `metrics.ts` `sanitizeLabels` (64-char cap, sensitive drop), `safeRun` | ✅ accurate |
| Deployment `instances:1` fork, no SIGTERM drain | `ecosystem.rankwagers.cjs`; `instrumentation.ts` | ✅ accurate |

The design's repository grounding is faithful; the three dependencies are real and correctly specified with interfaces/owners/acceptance.

---

## 3. Immediate Blockers & Required Clarifications

### Immediate blockers
**NONE.** No design element could create an unsafe production write. The three dependencies are specified design work (interfaces, owners, acceptance), gated before their phases — not blockers.

### Required production clarifications (activation-gate items; safe-of-writes, must be pinned before canary)

- **PC-1 — Missing-partition semantics (stall vs expected).** The strict reader maps ENOENT → empty for **both** a legitimately-absent today-partition (prepare job not yet run) **and** an unexpectedly-absent partition (the R-3 release-local `process.cwd()` path bug, or a lost historical file). Both are **safe for writes** (empty ⇒ no settlement), but the second is a **silent zero-settlement stall** with no alert. Require: the run must distinguish "expected-missing" from "unexpectedly-missing-for-a-date-that-should-have-data" (via `savedAt`/`summary` freshness + an expected-date signal) and **alert on a stall**, so a path/orphan bug cannot present as an indefinite silent success. (Ties to Gate C/K and R-3.)
- **PC-2 — Kill-switch propagation requires a process restart.** The plan states flags are request-time with "no restart required" (§7/§15). But `process.env` is fixed at Node process start; an external `.env`/OS-env change does **not** reach a running PM2 process without `pm2 reload/restart --update-env`. So the true emergency-stop latency = **in-flight bounded run completion (≤45 s) + process restart (≤ `kill_timeout` 10 s)**, not instantaneous config. This is **acceptable** (bounded run + bounded restart), but the "no restart required" claim is inaccurate and must be corrected in the runbook, and the env-propagation mechanism (PM2 `--update-env`, or a runtime flag source) must be pinned as the documented kill procedure. (Ties to Gate J/K.)
- **PC-3 — `NODE_ENV=production` is the load-bearing multi-instance assertion.** Accidental multi-instance is safe **only** because `locks.ts` fails closed *when `NODE_ENV==="production"`*. If `NODE_ENV` is anything else in a multi-instance deployment, the lock **degrades to a per-process memory Set** → split-brain multi-writer → concurrent appends. Require Gate D/K to **assert `NODE_ENV=production` AND (`EVIDENCE_DATABASE_URL` provisioned OR `instances:1`)** as an explicit, checked precondition — not an implicit property. (Ties to Gate D/K and R-5.)
- **PC-4 — Verify the route-start deadline anchor at implementation review.** The design closes the R-2 gap, but the *safety* depends on the implementation actually anchoring the effective deadline at route/job entry and adding the pre-batch remaining-time check. If an implementer left the Stage-2D post-discovery anchor, source-load+discovery would be uncharged and a slow discovery could push a batch write past the 60 s platform kill (torn line). Make "anchor at entry + pre-batch defer" a **blocking impl-review + Gate E** check.
- **PC-5 — Settlement first-settlement accuracy boundary (freshness policy).** First-settlement is irreversible until the Stage-3 correction stage. A partition row marked `isFinished` with a **provisional** score would be first-settled and **stand** until corrections exist. This is **not an unsafe write** (C4 rejects non-integer/negative scores; the outcome is deterministic and immutable; late *pending→finished* is a clean first settlement), but the **freshness/completeness policy** (e.g. `savedAt` recency, `summary.pending==0` gating, or a settle-only-after-N-hours rule) should be pinned before canary so settlement does not commit against a materially-incomplete/provisional partition. (Ties to Gate C, §22/§23.)

None of PC-1…PC-5 is a write-safety defect; each is a stall-detection / operability / precondition clarification owned by an activation gate.

---

## 4. Failure-Mode Audit (plan §17 matrix, assessed)

The plan's 27-row matrix covers every requested mode; each has explicit detection / class / write / HTTP / retry, with alerting conditions in §18 and rollback in §16. Assessment of the requested set:

| Mode | Detection | Class / write | Response | Safe? |
|---|---|---|---|---|
| source missing | strict ENOENT | empty, no write | 200 zero-count; re-fire | ✅ (but PC-1: distinguish stall) |
| source stale | freshness on `savedAt`/date | deferred/skip | 200; re-fire | ⚠ PC-5 freshness policy underspecified |
| source unreadable (EACCES/EIO) | strict throw | `source_load_failed` | 500; alert | ✅ (requires strict reader, Gate C) |
| malformed archive (JSON) | strict `JSON.parse` throw | `source_load_failed` | 500; quarantine | ✅ |
| malformed row | per-row drop+count | isolated, valid rows continue | 200 | ✅ |
| duplicate row | adapter dedup + `duplicate_row` | isolated | 200 | ✅ (across-tab dedup expected) |
| late-arriving score | next fire re-reads | first-settle stands; correction deferred | 200 | ✅ write-safe; PC-5 accuracy boundary |
| archive read failure | strict whole-archive throw | `archive_read_failed` | 500; never empty | ✅ |
| archive append failure | batch `writeFailed` | hard-fail | 500 `write_failed`; idempotent re-fire | ✅ |
| DB unavailable (prod) | `requireDurable`+no URL → null | fail-closed skip | 409 | ✅ (PC-3 `NODE_ENV`) |
| lock unavailable | `tryAcquireJobLock` null | skip, no work/discovery | 409 | ✅ |
| lock lost (session drop) | PG auto-release | committed persists | re-fire re-acquires | ✅ (H-1 misreport carry-forward) |
| process crash | — | committed prefix persists | re-fire re-derives (INV-A) | ✅ |
| PM2 restart | jobLog reset (non-authoritative) | no cursor | re-derive from archive | ✅ |
| route timeout | deadline defer before start | bounded, no overrun | 200 partial; re-fire | ✅ **iff** PC-4 (route-start anchor) |
| scheduler retry overlap | lock loser | no double-write | 409 | ✅ |
| metrics failure | `safeRun`/try-catch | best-effort swallowed | unchanged | ✅ never fails job |
| invalid flag combination | `resolveM10ActivationConfig` fail-safe | fail-closed off | 409/200 | ✅ |
| non-finite clock | `remainingMs=0` | defer everything | 200 zero | ✅ |
| deadline defer before 1st candidate | pre-batch remaining check | all `deferred_by_deadline` | 200 zero; re-fire | ✅ **iff** PC-4 implemented |
| partial completion | between-candidate guard | committed prefix + deferred tail | 200; re-fire remainder | ✅ |
| kill switch during a run | per-run immutable snapshot | running fire completes; next fire skips | — | ✅ (PC-2 restart latency) |
| accidental multi-instance | durable lock loser | no double-write | 409 | ✅ **iff** PC-3 (`NODE_ENV=production`) |

**Not-explicit but covered:** a concurrent capture-append during a settlement snapshot read is subsumed by "archive read failure" (a torn tail → strict throw → settlement fail-closed 500, no corruption); recommend the runbook **stagger capture/settlement schedules** to avoid spurious concurrent-append read failures (fail-closed, but noisy). Disjoint write targets (snapshots+odds vs validations) mean no two writers ever touch the same file, so the overlap-safety claim (§6) is correct.

**Conclusion:** every mode is fail-closed or bounded; none converts a source failure into an empty success except a genuinely-missing partition (correctly distinguished by the strict reader — subject to PC-1 stall-detection).

---

## 5. Special-Attention Verdicts

### 5.1 Source-freshness verdict — CONDITIONAL
The strict-reader requirement is correct and necessary (verified fail-open `dailyArchive.ts:76-78`): ENOENT→empty is **write-safe** (no false settlement), and malformed/IO must throw. The design can establish freshness (`savedAt`) and completeness (`summary`), and stale/incomplete data **cannot produce an unsafe write** (C4 score sanity + first-settlement-only + deterministic `settledAt` + idempotent re-fire). **Conditional on:** PC-1 (distinguish expected-missing from stall + alert) and PC-5 (pin the freshness/completeness policy so settlement does not first-settle a materially-provisional/incomplete partition, given first-settlement is irreversible until Stage-3). Both are stall/accuracy items, not write-safety defects.

### 5.2 Lock-safety verdict — PASS (Gate D precondition)
The durable PG advisory lock (`locks.ts`, keyed per job, bound to `EVIDENCE_DATABASE_URL`, held across the whole locked body, released in `finally`) is the correct multi-instance single-writer mechanism; it fails **closed** in production with **no memory degrade**. The design **does not accept a process-local lock for durable append protection** and requires `EVIDENCE_DATABASE_URL` provisioning (Gate D) before any scale-out, keeping `instances:1` otherwise. **Load-bearing precondition (PC-3):** `NODE_ENV=production` must be asserted, else the fail-closed branch is bypassed. Carry-forward H-1 (unlock-throw → 500 misreport) is a reporting bug, not a lock-safety defect.

### 5.3 Dry-run-safety verdict — PASS (verify at impl / Gate H)
Zero-write is **structural**: DRY_RUN runs discovery + the producer but never invokes `runCaptureBatch`/`runSettlementBatch` — the sole durable-write path — with suppression at the composition layer, no frozen M6/M8 change. Gate H makes "any write in dry-run" a blocking failure. Sound as designed; the impl must be tested for it.

### 5.4 Canary-safety verdict — PASS
Bounded-write is enforced by the **same** `normalizeBatchLimit` clamp as full (`EVIDENCE_CANARY_CEILING`, default 10, hard ≤150 — no widening path), deterministic first-N selection (no randomness, no entity-id labels), independently killable, with defined abort/promotion criteria and a required out-of-band chain-verify. Safe.

### 5.5 Kill-switch verdict — CONDITIONAL (PC-2)
Semantics are write-safe: the per-run **immutable flag snapshot** prevents split-brain inside a run; an in-flight run completes its current atomic append (the between-candidate guard is the only stop, RC-2); the next fire skips. **Conditional on PC-2:** the "no restart required" claim is inaccurate — `process.env` flags need a PM2 restart (`--update-env`) to change in a running process, so document the true kill latency (≤45 s run + ≤10 s restart) and the env-propagation procedure. Not a defect (bounded run + bounded restart), but must be corrected. A true mid-run emergency abort is **not** provided (by design — RC-2); the bounded ≤45 s run is the substitute.

### 5.6 Rollback verdict — PASS
The plan correctly and explicitly separates the four concerns (§16): **stop future writes** (flag off — reversible config, restart-gated per PC-2); **code rollback** (revert the additive composition + one-line route swap; runner/config/loader changes are dormant with flags off); **immutable already-written data** (append-only, valid, **never deleted**; re-fire idempotent); and **corruption response** (a **separate** quarantine-file/line + P0 escalate via the out-of-band `verifyEvidenceChain`/`verifyValidationChain` sweep — not a rollback, never a delete of valid records). Correct.

### 5.7 Route-budget verdict — CONDITIONAL (PC-4 + Gate E/F/2E-B)
The design closes the verified R-2 gap (today's post-discovery anchor) by mandating a **route-start-anchored effective deadline (≤45 s) + a pre-batch remaining-time check**, so source-load + discovery + batch + cleanup are charged and the platform 60 s kill is never the enforcement mechanism. **Conditional on:** PC-4 (verify the anchor is actually moved to entry at impl review — else the batch clock begins too late and a slow discovery risks a mid-write kill) and the **Stage-2E-B benchmark** (Gate E/F) proving a ceiling-sized run + discovery + cleanup < 60 s at representative archive depth, plus validating/retuning the provisional `reservePerCandidateMs` (250/120) and 15 s headroom. The hung-`fs.readFile` residual (RC-2) is bounded only by the 60 s platform kill (read-only, no torn write) — a deadline-bounded reader timeout is recommended before full-write (§L).

### 5.8 Correction-firewall verdict — PASS
Stage 2E reads no `currentValidationHeads`, infers no changed outcome, emits no `correctionCause`, writes no correction revision — enforced by source static guards (comment-stripped scan of the activation/composition modules), the route-composition guard (never sets `correctionCause` on a `SettlementCandidate`), the frozen M8 causeless-change → `invalid_input` backstop (verified in Stage 2C), a dedicated test group, and a review-checklist item. Corrections remain a fully separate later stage. Solid, defense-in-depth.

### 5.9 Single-writer verdict — PASS (with PC-3)
Covered by 5.2: durable advisory lock is the multi-instance guarantee; `instances:1` holds structurally today; scale-out requires the provisioned lock (Gate D) and `NODE_ENV=production` (PC-3). No flag bypasses the lock (unconditional inside `runWithLock`).

---

## 6. Activation-Gate Carry-Forward (owned by later gates; not Stage-2E-A design blockers)

- **G-C — Strict daily-archive reader** (`readDailyArchiveStrict`): ENOENT→empty, malformed/IO→throw; ENOENT-vs-throw parity + determinism + fixture tests. Required before Slice-2 dry-run.
- **G-E/PC-4 — Route-start deadline anchor + pre-batch defer**, verified at impl review.
- **G-E/F — Stage-2E-B benchmark:** ceiling-run + discovery + cleanup < 60 s at representative depth; validate/retune reserves + headroom; **binding gate for FULL_WRITE**.
- **G-D/PC-3 — `EVIDENCE_DATABASE_URL` provisioned + reachable AND `NODE_ENV=production`** (or `instances:1`) asserted before any scale-out.
- **Capture live derivation (M4→M5 behind `deriveCaptureInput`)** — unbuilt; blocks capture writes; capture is deferred, settlement is near-term.
- **PC-1 stall detection / PC-5 freshness policy / PC-2 kill-switch restart documentation** — pin in the runbook (Gate J/K).
- **Durable job-run store** — only if canary proves ephemeral diagnostics insufficient (§19); would be a separate migration that blocks full-write.
- **Hardening:** H-1 unlock-500 swallow; fsync-on-append + scheduled `verify*Chain` sweep + quarantine tooling; hung-reader timeout (RC-2 residual); durable metrics/alerting routing; schedule-stagger recommendation.
- **Correction stage** — entirely separate; no item pulled into Stage 2E.

---

## 7. Final Report

- **Verdict:** **CONDITIONALLY PASSED** — the activation design can be implemented and later activated without creating an unsafe live write path; the conditions are the Stage-2E-B benchmark and activation-gate dependencies the plan itself gates.
- **Immediate blockers:** NONE (no frozen/schema/migration change; authoritative source exists; the three dependencies are specified design work with owners/acceptance).
- **Required production clarifications:** PC-1 missing-partition stall detection + alert; PC-2 kill-switch requires PM2 restart/`--update-env` (correct the "no restart required" claim + document true latency); PC-3 assert `NODE_ENV=production` as the multi-instance single-writer precondition; PC-4 verify the route-start deadline anchor at impl review; PC-5 pin the settlement freshness/completeness policy (first-settlement is irreversible until Stage-3).
- **Activation-gate carry-forward:** strict reader (Gate C); route-start anchor + pre-batch defer (Gate E); Stage-2E-B benchmark (Gate E/F, binding for FULL); `EVIDENCE_DATABASE_URL` + `NODE_ENV=production` (Gate D/K); capture M4→M5 derivation (capture writes); durable job-run store if canary demands (§19); H-1/fsync/sweep/hung-reader/alerting/scale-out hardening.
- **Source-freshness verdict:** CONDITIONAL (strict reader required & correct; ENOENT→empty write-safe; malformed→throw; pin PC-1 stall detection + PC-5 freshness policy).
- **Lock-safety verdict:** PASS (durable advisory lock, prod fail-closed, no process-local acceptance; Gate D provisioning + PC-3 `NODE_ENV`).
- **Dry-run-safety verdict:** PASS (structural zero-write; Gate H blocks any dry-run write).
- **Canary-safety verdict:** PASS (bounded by `normalizeBatchLimit`, deterministic, no entity-id labels).
- **Kill-switch verdict:** CONDITIONAL (safe semantics + immutable per-run snapshot; correct PC-2 restart requirement).
- **Rollback verdict:** PASS (correctly separates stop-writes / code-revert / immutable-data / corruption-response; never deletes valid evidence).
- **Route-budget verdict:** CONDITIONAL (design closes the R-2 anchor gap; verify PC-4 at impl + Stage-2E-B benchmark; hung-reader residual bounded by platform kill, read-only).
- **Correction-firewall verdict:** PASS (no correction symbols/paths; static + runtime + test + review guards; corrections fully out of scope).

**Confirmation:** review-document-only change. No runtime code, tests, routes, flags, config, deployment, or the activation plan were modified; the only file created is `docs/plans/m10-stage-2e-a-production-safety-review.md`.
