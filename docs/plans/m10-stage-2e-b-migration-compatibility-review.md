# M10 Stage 2E-B — Migration & Long-Term Compatibility Review (Benchmark & Production-Readiness Gates)

**Document type:** Independent, read-only **long-term compatibility** review. Not a benchmark-quality, performance, or production-safety review. No runtime, route, cron, job, flag, test, schema, database, migration, deployment, or benchmark code was created, modified, or executed. The **only** file created is this document.
**Date:** 2026-07-30
**Subject:** M10 **Stage 2E-B — Benchmark & Production-Readiness Gates** (`docs/plans/m10-stage-2e-b-benchmark-readiness-plan.md`, planning-only).
**Governing:** the M10 spec (Rev A1), `m10-stage-2d-closure.md`, `m10-stage-2e-a-activation-design-plan.md` + its closure, the frozen `types/evidence/*` + builders + adapters.
**Method:** every repository claim the plan makes was independently verified from source (file:line). No file modified.

---

## 1. Executive Summary

**Verdict: COMPATIBLE.**

Stage 2E-B is a **measurement/evidence phase**: a synthetic-fixture benchmark harness (`scripts/bench/m10/*.ts`) that exercises the already-built, dormant M10 code paths, records durations/memory/lock/append evidence, and resolves a set of production-readiness gates. On the long-term compatibility axis it is the safest possible slice: **it builds no runtime, changes no contract, persists no new schema, touches no production archive, and can be abandoned at any point with zero durable effect.**

- **Schema change: NO.** Synthetic fixtures are minted via the *frozen* builders into temp NDJSON; artifacts are JSON/CSV under a docs/evidence path — neither is a table, column, or persistence schema.
- **Migration: NO.** No database, archive, contract, deployment, configuration, reader, or writer migration is required or implied.
- **Additive: YES.** New `scripts/bench/m10/` (absent today) + a docs artifacts path. Existing runtime/routes/archive-format/contracts/evidence are untouched.
- **Correction firewall: PRESERVED.** The plan benchmarks the existing first-settlement-only pipeline; it never implements, depends on, or requires corrections, and never mutates settlement history or immutable evidence.
- **Postgres future: COMPATIBLE.** No coupling introduced; the PG evidence adapter is explicitly deferred (F-K). Lock cells use the *existing* advisory-lock mechanism against a *disposable* local PG, never a new evidence schema, never production DB.
- **Rollback: FULL.** Every benchmark artifact is synthetic-temp and deleted; abandoning the benchmark affects no runtime, archive, evidence, database, deployment, or future milestone.

No BLOCKER exists. Four non-blocking clarifications are recorded (§12); none requires a design change.

---

## 2. Repository Validation (verified this pass — the plan's grounding is accurate)

The instruction was to distrust the plan and verify repository reality. Every load-bearing claim checks out:

| Plan claim | Verified | Anchor |
|---|---|---|
| Harness uses **frozen builders** to mint real-hash synthetic fixtures | **TRUE** — all three exist | `createEvidenceSnapshot` `lib/evidence/snapshot.ts:202`; `createValidationRecord` `lib/validation/records.ts:135`; `buildOddsRecord` `lib/evidence-capture/odds-archive/record.ts:131` |
| Metrics evidence via `metrics.snapshot()` / `publicMetricsView()` | **TRUE** | `lib/observability/metrics.ts:88,120` |
| Deadline anchored **post-discovery** (F-C target) | **TRUE** — `provideCandidateBatch()` awaited `runner.ts:381`, then `producerDeadlineBudget`→`createDeadline({startedAtMs: now()})` at `runner.ts:401,306`; discovery escapes the budget | `runner.ts:381,401,306` |
| Provisional constants are the tunables 2E-B validates | **TRUE** | `config.ts:120-122` (headroom 15000, reserves 250/120); `operational.ts` hard-max 45000; limits 100/150 |
| Source `readDailyArchive` is **fail-open** → strict variant benchmarked (not built here) | **TRUE** | `dailyArchive.ts:71-77` (`catch → null`) |
| Evidence store = NDJSON strict whole-archive reads; `fs.readFile(utf8)` string wall | **TRUE** | `readAllSnapshotsStrict`/`readAllValidationsStrict`/`readAllOddsRecordsStrict` |
| Lock = PG advisory bound to `EVIDENCE_DATABASE_URL`, prod fail-closed | **TRUE** | `locks.ts:tryAcquireJobLock` |
| Harness convention = `scripts/*.{mjs,ts}` via tsx; **no bench dir yet** | **TRUE** — `scripts/bench` absent; many `scripts/*.mjs` present | `ls scripts/` |
| No Postgres evidence adapter exists | **TRUE** | grep `createPostgres*` → none |

No discrepancy. The benchmark's repository assumptions are real and read-only.

---

## 3. Compatibility Assessment

Stage 2E-B interacts with the codebase in exactly three ways, all compatibility-neutral:
1. **Reads/executes** the built dormant code paths (producer, `buildXArchiveState`, `runXBatch`, strict readers, lock) — no modification.
2. **Consumes** the frozen builders to generate synthetic fixtures — a read-only *use* of exported functions (identical to how tests use them), producing valid-hash records in a temp dir.
3. **Emits** JSON/CSV artifacts to a docs/evidence path + a `metrics.snapshot()` capture — plain files, no schema.

None of these establishes a durable dependency on the pipeline's internals: the harness observes behavior and timings, not private structure. A future refactor of the pipeline would require re-pointing the harness, not a contract migration — the harness is downstream evidence tooling, not an upstream consumer of a contract.

---

## 4. Schema Review

**No schema change of any kind is required.** Examining each category the question names:

- **Schema / table / column / new persistence:** none. The only "persistence" is temp NDJSON files (deleted on completion) and out-of-tree JSON/CSV artifacts. No SQL DDL, no table, no column.
- **New metadata:** the per-cell artifact JSON and the "benchmark history append-only index" are *documentation/evidence files*, not a runtime-loaded metadata store. They carry synthetic machine-spec/seed/timing data, never a record schema and never entity ids.
- **New archive / evidence / correction format:** none. Fixtures are minted through the frozen `createEvidenceSnapshot`/`createValidationRecord`/`buildOddsRecord` at the *current* format and hashed identically to production records; the harness reads them with the *existing* strict readers. There is no new or versioned format, and no correction format (corrections are out of scope entirely).

Because the fixtures are produced by the frozen builders, they are format-faithful by construction — the benchmark cannot silently introduce a divergent evidence shape.

---

## 5. Migration Review (why none is required — proof)

- **Database migration:** the only DB touched is a **disposable local PostgreSQL** used solely for the *existing* advisory-lock cells (`tryAcquireJobLock`), which already binds `EVIDENCE_DATABASE_URL`. The advisory lock is a session primitive (`pg_advisory_lock`), **not a table** — it needs no schema and creates no row. No evidence data is written to PG (no PG evidence adapter exists). ⇒ no database migration.
- **Archive migration:** fixtures are written to an isolated `mkdtemp` evidence dir and a temp `data/daily-archives/<date>.json`, then deleted; the production archive is never read or written. ⇒ no archive migration.
- **Contract migration:** the harness uses frozen contracts as-is; it changes none. ⇒ none.
- **Deployment migration:** the harness is a `scripts/` tsx tool run manually/CI, not a deployed route/cron/PM2 process. ⇒ none.
- **Configuration migration:** benchmark cells pin a *bench env profile* (`EVIDENCE_ARCHIVE_DIR=<tmp>`, `JOB_LOCK_ADAPTER=memory` or disposable PG, flags OFF) in-process for the run only; no production config is changed and no new production knob is introduced by 2E-B (the constants it validates already exist). ⇒ none.
- **Reader / writer migration:** the harness invokes the *existing* strict readers and the *existing* frozen writers; it neither adds nor alters a reader/writer. The strict daily-archive reader (F-D) is a Stage-2E *implementation* item that 2E-B only measures — it is not built here. ⇒ none.

Every category resolves to "not required," and the reason is structural: 2E-B is an observer of already-built code over synthetic data.

---

## 6. Additive Review

- **Existing runtime continues unchanged:** the harness imports and runs the dormant code paths without modifying them; the two cron routes remain bare M9 delegates.
- **Existing routes unchanged:** no route file is touched (verified: only a new `scripts/bench/` tree is proposed).
- **Existing archive format unchanged:** fixtures are minted at the current format via frozen builders.
- **Existing contracts unchanged:** `types/evidence/*`, store interfaces, identity/hash/`settledAt` untouched.
- **Existing evidence unchanged:** the production archive is never touched; all benchmark evidence is synthetic-temp.

Stage 2E-B is **completely additive** — a new evidence-tooling directory plus out-of-tree artifacts.

---

## 7. PostgreSQL Compatibility

- **PostgreSQL evidence adapter:** not built, not assumed. The plan explicitly defers it to F-K/future. 2E-B introduces **no coupling** that would complicate the future file→Postgres cutover; if anything, it *supplies* the depth/throughput evidence that will justify and size that cutover.
- **Shared reader / writer abstraction:** 2E-B benchmarks the existing strict readers + frozen writers through their current interfaces. It does not embed a file-only assumption into any *runtime* composition (the harness itself is file-based by nature, but it is tooling, not the pipeline). The carry-forward CS-4/SC-1 shared read-port resolver remains a Stage-2E/cutover item — 2E-B neither introduces nor blocks it.
- **Future storage evolution / benchmark reruns / production rollout:** the harness is parameterized by an env profile + fixture generators, so a future Postgres adapter is benchmarked by adding cells (a disposable PG evidence store) — additive, no rework of the contract. The benchmark-history index is designed append-only precisely so future reruns compare against past baselines.

**No difficult-migration coupling is introduced.**

---

## 8. Correction Firewall Review

The plan **never**: changes correction behavior; implements corrections; depends on or requires corrections; changes settlement history; or changes immutable evidence.

- Settlement cells exercise the existing **first-settlement-only** pipeline (Stage 2C + frozen M8); the producer never sets `correctionCause` and never reads `currentValidationHeads` (structurally, as verified in prior stage reviews).
- Canary/full-write cells append **new** first-settle records to a **temp** archive via the frozen writers; they never revise or mutate an existing record. Re-fire is idempotent (`already_settled`/`no_change`).
- Chain-verify (`verifyEvidenceChain`/`verifyValidationChain`) is used as a *read-only* integrity check over synthetic records, not a correction path.
- Corrections are explicitly out of scope (§20/§22/Out-of-Scope) and deferred to the separate Stage-3 correction pipeline.

**The correction firewall is fully preserved.**

---

## 9. Rollback Compatibility

Benchmark execution is **unconditionally abandonable**:
- **Runtime:** untouched — abandoning the benchmark leaves the dormant pipeline exactly as-is.
- **Archives / evidence:** synthetic-temp only, deleted on completion; the production archive is never opened for write.
- **Database:** only a disposable local PG advisory lock (session-scoped, auto-released on disconnect); nothing persists.
- **Deployment:** no deployment artifact is produced or changed.
- **Future milestones:** none is blocked or pre-committed; a discarded benchmark simply means the readiness gates lack evidence (activation stays refused — the safe default).

There is nothing to "roll back" because nothing durable is created. This is the strongest rollback posture in the series.

---

## 10. Future-Stage Compatibility

| Future stage | 2E-B relationship | Compatible? |
|---|---|---|
| **Stage 2E implementation** (build the 2E-A composition, default-OFF) | 2E-B produces the evidence its gates consume; it measures the entry-anchor (F-C) and strict reader (F-D) it does not build | YES — 2E-B is a prerequisite evidence phase, not a competing change |
| **Stage 3 correction pipeline** | untouched; corrections out of scope | YES — no correction surface created |
| **Future capture activation** | capture full-write cells are dry-only (M4→M5 derivation unbuilt); benchmarked without writing | YES — correctly deferred |
| **Future settlement activation** | settlement is the near-term path; 2E-B supplies its gate evidence | YES |
| **Future benchmark reruns** | append-only history index + pinned seeds/commands enable comparison | YES — designed for it |
| **Future storage adapters (Postgres)** | additive cells; no coupling; supplies cutover-sizing evidence | YES |

No future stage is foreclosed or made harder by 2E-B.

---

## 11. Findings

| # | Finding | Class |
|---|---|---|
| F-1 | The harness lives in a new `scripts/bench/m10/` tree (absent today) and produces out-of-tree JSON/CSV artifacts — additive, not runtime/routes/tests/jobs. | Compatibility clarification |
| F-2 | Disposable-PG lock cells use the *existing* advisory-lock primitive (no table, no evidence schema); R-5 harness guard must refuse prod-looking URLs (mirroring `rehearse-migrations.mjs`). | Migration clarification |
| F-3 | Fixtures are minted by the frozen builders (`createEvidenceSnapshot`/`createValidationRecord`/`buildOddsRecord`, all verified present), guaranteeing format/hash fidelity; the generators must supply valid builder inputs (an execution detail, not a contract change). | Implementation clarification |
| F-4 | The F-C entry-anchor and F-D strict reader that 2E-B measures are **Stage-2E implementation** items (already 2E-A-reviewed as additive); 2E-B must only measure, never build them. | Future-stage item |
| F-5 | The artifact/"benchmark history" store must remain plain evidence files under a docs/evidence path — it must **not** evolve into a runtime-loaded or DB-backed store (which would introduce persistence coupling). | Compatibility clarification |

**No finding is a BLOCKER.** Per the blocking rule, none introduces an unavoidable long-term compatibility problem; unfinished implementation, unexecuted benchmarks, remaining milestones, and incomplete deployment are explicitly **not** blocking reasons.

---

## 12. Carry-forward

- **To Stage 2E implementation:** the Bucket-2 items 2E-B measures/gates but does not build — `readDailyArchiveStrict` (F-D), route-entry deadline anchor + structural dry-run no-write test (F-C), missing-partition observability + path parity, freshness detection, `NODE_ENV`/durable-lock assertion, correction-firewall guards.
- **To deployment (separate authorization):** `EVIDENCE_DATABASE_URL`/secret provisioning, `instances:1`/durable-lock, scheduler cadence, kill-latency.
- **To future stages:** capture M4→M5 derivation (blocks capture write); Postgres evidence adapter + shared read-port resolver (CS-4/SC-1); durable job-run store only-if-canary-insufficient; the Stage-3 correction pipeline. **None is pulled into Stage 2E-B.**

---

## 13. Final Verdict

**COMPATIBLE.**

Stage 2E-B preserves every frozen architectural contract (evidence, archive, immutable revisions, capture/settlement pipelines, correction isolation, metrics API, adapter boundaries) and remains fully compatible with every future implementation stage. It requires **no** schema change, **no** migration, **no** new persistence or archive/evidence/correction format; it is **completely additive** (a new `scripts/bench/` evidence-tooling tree over synthetic temp fixtures); it introduces **no** Postgres-cutover coupling; it never touches immutable evidence or settlement history; and it is **fully rollback-abandonable** with zero durable effect. The four clarifications and one future-stage item (§11) are advisory and require no design change.

---

## 14. Explicit Confirmations

- **NO runtime code modified** ✅
- **NO benchmark executed** ✅ (the harness is not even built; this is a plan review)
- **NO routes modified** ✅
- **NO tests modified** ✅
- **NO feature flags enabled** ✅
- **NO deployment modified** ✅
- **NO schema modified** ✅
- **NO migration created** ✅
- **NO archive format changed** ✅
- **NO evidence contract changed** ✅
- **NO production activation performed** ✅

The only file created by this review is `docs/plans/m10-stage-2e-b-migration-compatibility-review.md`. All cited `file:line` anchors were read from the current repository so an implementer can verify them.
