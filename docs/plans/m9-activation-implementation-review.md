# M9 — Activation & Production Wiring — Implementation Correctness Review

**Reviewer:** Claude 2 (implementation correctness)
**Date (this re-review):** 2026-07-30
**Predecessor verdict:** *M9 IMPLEMENTATION BLOCKED* (2026-07-29) — M9 was unbuilt. **Superseded by this document.**
**Governing sources:** `m9-activation-architecture-review.md` (Claude 1, C1–C7), the M9 production/performance/failure/migration reviews, and the M6/M7/M8 review corpus.
**Method:** Repository read directly (not trusted from the hand-off summary). Every claim carries a `file:line`/command anchor. No runtime code modified. No frozen contract touched. No flag enabled. No temporary probe left behind. Tests, typecheck, and lint were run this review and are quoted verbatim (§9).

## Verdict up front

### M9 IMPLEMENTATION CONDITIONALLY APPROVED

M9 **now exists and is correct at the job/route boundary.** All seven architecture conditions (C1–C7) are implemented, and each is exercised by a passing, non-wall-clock test. The build is additive: two `JobType` members, two runner functions, two batch orchestrators, one mandatory-odds module, two cron routes, one diagnostics surface — and it modifies only *substrate* (`runner.ts`, `locks.ts`) with the durable-lock and concurrency fixes the performance/failure reviews prescribed. **No frozen contract, identity/hash formula, snapshot/validation/odds schema, revision semantic, or replay semantic changed** — proven by an in-suite invariance test and by the frozen builders being reused verbatim. Full suite **1687/1687 pass**, typecheck **exit 0**, lint **clean**.

The verdict is *conditional*, not clean-approved, for three reasons — none of which is a merge blocker for the dormant, flags-off tree, and none of which is a correctness defect in what M9 was scoped to build:

1. **One low-severity built-code defect (D-1, the performance review's L-2, now on the production-mandatory path):** on the durable Postgres advisory-lock path that C1 makes the *only* production lock path, a transient failure of the `pg_advisory_unlock` query propagates out of `release()` through `runWithLock`'s `finally`, converting a **successful** job into an HTTP 500. Archive correctness is intact (PG auto-releases on session end; the next cron fire is idempotent), but the HTTP/alerting outcome is wrong. Recommended fix before activation; not a merge blocker.
2. **Implementation correctness ≠ end-to-end functionality.** A bare cron fire runs an **empty candidate pass** (`candidates ?? []`). The live candidate pipeline (M4→M5 derivation feeding real `CaptureRequest`/`SettlementCandidate`s) is *intentionally out of M9 scope* — a separate milestone. M9's wiring is correct; the system does not yet capture/settle real fixtures from a plain cron call. These must not be conflated (§5, §10).
3. **Two C7 items are activation/ops gates, not built code:** the scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep and durable (cross-restart) cumulative violation/failure **alert routing**. The emitting substrate exists (metrics counters + per-run diagnostics); the scheduled sweep and alert wiring are operational, owned by the production/failure reviews' gates.

The BLOCKED verdict is **not** carried over; it was a not-yet-built disposition and the code is now built. This verdict is based exclusively on the current tree.

---

## 1. Executive summary

The previous review returned BLOCKED because the activation layer did not exist. It now does. Independent inspection confirms every artifact the predecessor listed as ABSENT is present, wired, dormant behind default-off flags, and green:

- `JobType += "evidence_capture" | "prediction_settlement"` — `lib/jobs/types.ts:5-6`.
- `runEvidenceCaptureJob` / `runPredictionSettlementJob` — `lib/jobs/runner.ts:282-346`.
- Batch orchestrators (the guard/classification layer) — `lib/evidence-capture/jobs/capture-run.ts`, `.../settlement-run.ts`.
- Mandatory `evidence_capture` odds record (C5) — `lib/evidence-capture/capture/mandatory-odds.ts`.
- Cron routes — `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts`.
- Operational diagnostics (C7) — `lib/jobs/diagnostics.ts` + `app/api/internal/jobs/diagnostics/route.ts`.
- Substrate fixes — durable lock keyed on `EVIDENCE_DATABASE_URL` with production fail-closed (`locks.ts:18-96`); jobLog tracked by identity + bounded (`runner.ts:31-45,90-100`).

The design honours the review corpus's central constraint: **all seven guards live OUTSIDE the frozen capture/settlement services.** The orchestrators sequence the frozen entry points and classify their frozen result vocabularies; they never reach inside them. The only substrate edits are the two the performance review prescribed (F-1/F-2) plus the durable-lock binding the production/failure reviews demanded (C1/B2/G1/P1).

---

## 2. Previous BLOCKED finding and what changed

| Predecessor finding (2026-07-29) | Current state (2026-07-30) | Anchor |
|---|---|---|
| `JobType` lacked both members | **Present** | `types.ts:5-6` |
| No `run*Job` functions | **Present**, flag-gated, distinct locks | `runner.ts:282-346` |
| No cron routes | **Present**, both delegate to `handleCronPost` | `cron/*/route.ts` |
| No diagnostics surface | **Present**, access-guarded, read-only | `diagnostics.ts`, `jobs/diagnostics/route.ts` |
| MC-1 odds record written nowhere (C5/B1) | **Written** per supported market, idempotent, fail-closed | `mandatory-odds.ts` |
| No cross-process lock (C1/B2) | **Durable lock bound to `EVIDENCE_DATABASE_URL`; prod fail-closed** | `locks.ts:27-41` |
| PA-1 fixture cross-check absent (C3) | **Enforced before any read/write** | `settlement-run.ts:135-144` |
| PA-2 score sanity incomplete (C4) | **Non-negative-integer FT/HT guard** | `settlement-run.ts:100-117` |
| No error classification (C6) | **Per-outcome counts + distinct errorCodes** | both orchestrators + `runner.ts:301-306,337-342` |
| Read-fail-to-empty (G6) | **Strict differentiated NDJSON read** | `file.ts:76-127` |
| F-1 jobLog clobber / F-2 unbounded | **Identity-tracked + bounded 500** | `runner.ts:31-45,90-100` |
| No M9 tests | **`m9Activation.test.ts` (18) + `m9Concurrency.test.ts` (11)** | `tests/` |

---

## 3. Current repository evidence

Commands run in `/var/www/rankwagers`:

- Job wiring reachable **only** through the two flag-gated cron routes: `grep -rln 'runEvidenceCaptureJob|runPredictionSettlementJob' app lib` → `cron/evidence-capture/route.ts`, `cron/prediction-settlement/route.ts`, and `runner.ts` itself. No other runtime caller.
- Entry-point callers (`captureEvidenceSnapshot`/`settleLatestSnapshotForFixture`/`runCaptureBatch`/`runSettlementBatch`, non-test) are exactly the M9 wiring chain (runner → `*-run.ts` → capture/settlement/mandatory-odds) — no foreign subsystem invokes them.
- No in-repo scheduler references the new routes (`deploy/`, `.github/`, `scripts/` — empty) — external scheduling correctly remains out-of-repo.
- Flags default OFF: `isCaptureEnabled`/`isSettlementEnabled` read `EVIDENCE_CAPTURE_ENABLED`/`EVIDENCE_SETTLEMENT_ENABLED` via `readFlag` (`config.ts:44-47,97-108`); unset/junk ⇒ OFF; `.env.example:81-82` ships them commented. Import side-effect-free.
- Frozen services unchanged: `captureEvidenceSnapshot` (`capture/capture.ts:70`), `settleSnapshot`/`settleLatestSnapshotForFixture` (`settlement.ts:191,364`), `buildOddsRecord`/`oddsRecordId` (`odds-archive/record.ts`), `captureId`/`captureWindowKey` (`identity.ts`) reused verbatim; M9 adds no field and mints no new identity.
- No stray probe files (`*.mjs`, `*bench*`, `tests/_m9*`) — the perf/failure reviewers' probes were removed.

---

## 4. C1–C7 verification matrix

Each condition is verified in code **and** by a named test.

| # | Condition | Verified behaviour | Anchor | Test |
|---|---|---|---|---|
| **C1** | Single writer | Distinct keys `job:evidence_capture` ≠ `job:prediction_settlement` (`runner.ts:66`); capture/settlement pass `requireDurable:true` (`runner.ts:72-74`); durable lock binds to **`EVIDENCE_DATABASE_URL`** (`locks.ts:27-28`); in **production**, a missing URL *or* `JOB_LOCK_ADAPTER=memory` → **`return null`** (fail-closed, never a memory lock) (`locks.ts:34-41`); unreachable lock DB → `null` (`locks.ts:56-62`); release always in `finally` (`runner.ts:135-137`); contention → `skipped/lock_unavailable`, no store touch, no side effect (`runner.ts:75-86`). | `locks.ts`, `runner.ts` | m9Activation C1 (3); m9Concurrency (incl. 3 prod fail-closed) |
| **C2** | Feature flags | Single authority: job reads `isCaptureEnabled`/`isSettlementEnabled` over env (`runner.ts:288,325`); default OFF; only `"true"`/`"1"` enable; the dormant module constant `EVIDENCE_SETTLEMENT_ENABLED=false` (`settlement.ts:49`) and `isEvidenceSettlementEnabled` have **zero wiring callers** (grep) — the env flag is the sole authority; disabled → `flagSkippedJob` (no lock, no store) (`runner.ts:246-262`); route and job both safe. | `runner.ts:241-262,288,325` | m9Activation C2 (3) |
| **C3** | Fixture identity | `row.matchId !== fixtureId` (or non-integer/absent) → `fixtureMismatch`, **before any read/write**; settlement then targets `latestSnapshot(fixtureId)` whose `fixtureId` equals the target by the store's per-fixture contract ⇒ transitively `row.matchId === snapshot.fixtureId`; mismatch produces **no** validation record. | `settlement-run.ts:135-144` | m9Activation C3 |
| **C4** | Score validation | `hasValidCompletedScores`: FT `homeScore`/`awayScore` and any present `htHome`/`htAway` must be **non-negative integers** (`Number.isInteger && >= 0`); rejects negative, fractional, NaN, Infinity, missing/incomplete, non-object; failure → `invalidScore`, no settlement. These are exactly the fields settlement trusts (`footystats/types.ts:23-26`, `outcomes.ts:129`). None can reach WIN/LOSS/VOID/PUSH. | `settlement-run.ts:100-117,146-151` | m9Activation C4 |
| **C5** | Mandatory capture odds | Snapshot persisted by frozen capture; then `ensureMandatoryCaptureOdds` appends one `captureId`-keyed `evidence_capture` record **per supported market** (identity per `(captureId,marketKey,selectionKey,source)` — DoD-7 direct-join); **captureId reconstructed faithfully** — `captureWindowKey = "<fixtureId>|<capturedAt>"`, `capturedAt` is the window start, `normalizeInstant` idempotent on canonical ISO ⇒ reproduces the exact M1 `captureId`; capture **not** reported captured unless odds exist; zero supported markets → fail-closed (`mandatory-odds.ts:73-75`); retry heals a partial pair (`already_exists` still re-ensures odds); duplicate append → `duplicate` (no accretion, no new identity); odds conflict → `immutable_violation` surfaced. | `capture-run.ts:124-147`, `mandatory-odds.ts` | m9Activation C5 (5) |
| **C6** | Classification | Capture distinguishes `notAdmitted / invalid / immutableViolation / writeFailed / captured / duplicate` (+`oddsAppended/oddsDuplicate`); settlement distinguishes `settled / noChange / pending / unsupported / notFound / fixtureMismatch / invalidScore / invalidInput / immutableViolation / writeFailed`; the job maps only `writeFailed>0` or `immutableViolation>0` to `failed` with distinct `errorCode`s, else `succeeded`; `archive_error` incl. read failure → `writeFailed` (transient/retryable); disabled vs contention distinguished by `errorCode`. Never "settled/empty" on a fault. | `capture-run.ts:107-147`, `settlement-run.ts:169-190`, `runner.ts:301-306,337-342` | m9Activation C6 (2) |
| **C7** | Observability | `getEvidenceJobDiagnostics` exposes per-job `lastRunAt`, `lastStatus`, `lastErrorCode`, `lastSuccessAt`, **`lastSuccessAgeSec` (freshness)**, `lastResultCounts` (incl. `writeFailed`/`immutableViolation`), `runsTracked`; access-guarded route; `emitOutcomeMetrics` emits `evidence_job_outcome_total{job,outcome}` per non-zero outcome and `refresh_job_*` carries duration + failure codes. **Process-local** (in-process `jobLog`), pure over injected `nowMs`. | `diagnostics.ts`, `runner.ts:264-273` | m9Activation C7 |

**Diagnostics durability:** *process-local, not durable.* The surface is a projection over the bounded in-process `jobLog` (last ≤500 runs); freshness/counts reset on restart and are per-process. Cumulative violation/failure signal for **alert routing** is the metrics counters (also process-local until scraped). Acceptable under the single-writer posture C1 enforces; cross-restart history + alert wiring are operational (§10).

---

## 5. Job and route correctness

**Routes** (`cron/{evidence-capture,prediction-settlement}/route.ts`): POST-only, `force-dynamic`, `runtime nodejs`, `maxDuration 60`; each delegates to `handleCronPost(req, () => run*Job())`. `handleCronPost` (`cronHandler.ts:13-79`) enforces `evaluateCronAccess` (POST/405, `internalCronEnabled`/404, timing-safe `x-cron-secret`/403), rate-limit 6/60s→429, then maps job status → **`failed`→500, `skipped`→409, else 200**, with `no-store`/`noindex` and `resultCounts` in the body. Correct and unchanged.

- **Auth:** unchanged substrate; both new routes inherit it. ✓
- **Status mapping:** disabled and lock-contention both surface as `skipped`→**409**, distinguished only by `errorCode` (`{capture,settlement}_disabled` vs `lock_unavailable`). Internally consistent and C6-distinguishable, but 409 for a *disabled* pipeline is slightly unconventional (the production/failure reviews sketched 200/404). **Observation R-2**, not a defect — a scheduler sees a non-5xx and the `errorCode` disambiguates.
- **Dependency injection:** jobs accept `{env, candidates, deps}`; production defaults resolve `getEvidenceArchiveStore()`/`getOddsArchiveStore()` (`runner.ts:292-295,329-331`); tests inject memory stores. Clean seam; no env/clock read inside the frozen services.
- **Runner contracts:** `runWithLock` tracks each record **by object identity** (`Object.assign(running, result)`, `runner.ts:100`) — the F-1 fix — and head-trims `jobLog` to 500 (F-2). Release in `finally` on throw *and* on returned-failure paths. ✓
- **Candidate pipeline (scope boundary):** both routes call `run*Job()` with **no candidates**, so `options?.candidates ?? []` yields an **empty batch** (`runner.ts:296,332`). This is by design — producing live candidates is the M4→M5 derivation (out of M9). A bare cron fire with flags on therefore **succeeds with zero counts and writes nothing**: the wiring is correct, but end-to-end capture/settlement of real fixtures awaits the future candidate producer (§10).

**Idempotency / determinism / ordering:** capture is full-stream idempotent (deterministic snapshot id; `already_exists` pre-check); settlement is revision-aware (`no_change` when head unchanged); both are lock-serialized on distinct keys; the mandatory-odds append is `(id,contentHash)`-idempotent. Settlement candidates carry source-derived `completionInstant`/`nowSec` — **no clock in any hashed record path** (`settlement-run.ts:34-43`; job-log timestamps are non-hashed metadata). Frozen `sequence`/`revision` comparators preserve deterministic ordering; M9 adds none of its own.

---

## 6. Idempotency and recovery

| Scenario | Behaviour | Anchor |
|---|---|---|
| Duplicate capture (same window) | full-stream pre-check → `already_exists`; odds re-ensured (duplicate) | `capture.ts:101-106`, m9Activation C5-idempotent |
| Concurrent capture vs capture | same key → 2nd `skipped/409` | m9Activation C1, m9Concurrency |
| Concurrent capture vs settlement | distinct keys → both run (append-atomic, safe) | m9Activation C1 |
| Snapshot written, odds write fails | counted `writeFailed`, **not** captured; job `failed`; orphaned snapshot healed next run (`already_exists` → odds appended) | `capture-run.ts:136-142` |
| Unknown commit state (retry after crash) | deterministic identity → re-read → `duplicate`/`no_change`; never a new identity or fork | `capture.ts`, `settlement.ts:325-340` |
| Store `write_failed` / thrown I/O | surfaced `failed`, retryable; next idempotent cron recovers | `capture-run.ts:101-105,120-122`; `settlement-run.ts:163-167,187` |
| `immutable_violation` | surfaced `failed/immutable_violation`; never blind-overwritten | both orchestrators |
| Disabled/contention rollback | flag re-read per call; in-flight job completes; append-only, no partial record | `runner.ts:246-262` |

Recovery semantics match the failure review's required invariants (ordered recoverable pair, deterministic re-read, no fork). No path fabricates a result from absent data.

---

## 7. Error-classification matrix (as built)

| Outcome | Capture count | Settlement count | Job status | errorCode | HTTP |
|---|---|---|---|---|---|
| flag disabled | — | — | skipped | `*_disabled` | 409 |
| lock contention | — | — | skipped | `lock_unavailable` | 409 |
| success (new) | `captured` | `settled` | succeeded | — | 200 |
| no-op idempotent | `duplicate` | `noChange` | succeeded | — | 200 |
| pending (no write) | — | `pending` | succeeded | — | 200 |
| not admitted / not found | `notAdmitted` | `notFound` | succeeded | — | 200 |
| invalid input (C3/C4/build reject) | `invalid` | `fixtureMismatch`/`invalidScore`/`invalidInput` | succeeded (item skipped, logged) | — | 200 |
| write_failed / thrown I/O | `writeFailed` | `writeFailed` | **failed** | `write_failed` | 500 |
| immutable_violation | `immutableViolation` | `immutableViolation` | **failed** | `immutable_violation` | 500 |

Consistent across HTTP, `resultCounts`, and metrics. A 200/`succeeded` never hides a `writeFailed`/`immutableViolation` (those force `failed`). Per-item invalid rejections are surfaced in `failures[]` and logged (`logWarn`), not masked. **Minor granularity note (R-3):** a *permanent* mandatory-odds `invalid_record` (e.g. a `created`/`already_exists` snapshot with empty `supportedMarkets`) is bucketed under `writeFailed` (transient) rather than a distinct `invalid` counter (`capture-run.ts:138-139`); still fail-closed (job `failed`, `failures[]` preserves `odds_invalid_record`), only the aggregate conflates a permanent fault with a retryable one.

---

## 8. Frozen-contract verification

- **No frozen file modified.** `capture.ts`, `settlement.ts`, `outcomes.ts`, `record.ts`, `identity.ts`, `config.ts` are unchanged in contract; the C4 guard lives in the orchestrator (`outcomes.ts:129` still `Number.isFinite`), the C3 guard at the job boundary, the C5 odds path reuses `buildOddsRecord` verbatim.
- **No new persisted field / identity.** Mandatory odds uses the frozen `oddsRecordId`/`oddsContentHash`; `inputContentHash` remains unpersisted (correct — DoD-1 re-derives). `JobType` gained two additive dispatch members — not a frozen record contract.
- **Invariance test:** *"writing mandatory odds never mutates the snapshot's id or contentHash"* passes (`m9Activation.test.ts:296-307`) — the odds write is physically separate from the evidence archive.
- **Identity faithfulness (C5):** verified against the frozen `captureWindowKey`/`captureId` (`m9Activation.test.ts:228-235`): the derived window key and captureId equal the authoritative M1 values.
- **Strict NDJSON read (G6):** changes read *error handling* only (ENOENT⇒empty; EACCES/EPERM, EIO/EBUSY/…, malformed line all thrown/differentiated, `file.ts:80-124`); byte format, ordering reconstruction, append-only semantics, `(id,contentHash)` idempotency untouched.

No frozen contract, identity formula, hash, revision semantic, archive format, or replay semantic was modified.

---

## 9. Test evidence

All run in `/var/www/rankwagers`, this review, no runtime code changed:

- **M9 targeted (per file):** `tests/m9Activation.test.ts` → **18/18 pass**; `tests/m9Concurrency.test.ts` → **11/11 pass** (**29 total**, 0 fail). Covers C1–C7, the production fail-closed durable-lock blockers, F-1 non-clobber, F-2 bound, distinct keys, idempotent heal, end-to-end capture→settle, and frozen invariance.
- **Substrate (archive/file/config/mint/settlement/odds/provider):** **178/178 pass.**
- **Full suite:** `npm test` (`tests/*.test.ts`) → **1687 / 1687 pass, 0 fail, 0 skipped** (exit 0).
- **Typecheck:** `tsc --noEmit -p tsconfig.typecheck.json` → **exit 0.**
- **Lint:** `next lint` over the nine M9 files → **✔ no warnings or errors.**

**Coverage assessment (adversarial).** The tests assert *postconditions*, not just green: C3 asserts **zero** validations written on mismatch; C4 asserts zero settled across four malformed classes and checks `hasValidCompletedScores` directly; C5 asserts one record per market, idempotent duplicate, failed-odds ⇒ failed capture, empty-markets fail-closed, and captureId parity with the M1 primitive; C6 asserts distinct counters *and* distinct job `errorCode`; C1 asserts distinct keys, same-key skip, cross-key non-blocking, and **production fail-closed with no memory fallback**; C7 asserts freshness + counts. **Gaps (not blockers):** (a) no test exercises the **PG advisory-lock release path** — the suite forces `JOB_LOCK_ADAPTER=memory`, so **D-1 is untested**; (b) no **cron-route HTTP-layer** test for capture/settlement (auth/429/409/500 mapping is covered transitively by the pre-existing `cronHandler` substrate tests, not a route-specific test); (c) there is correctly no live-candidate-pipeline test (out of scope).

---

## 10. Remaining defects and items

**D-1 (low severity, built code — recommended before activation).** On the durable PG advisory-lock path (which C1 makes the *only* production lock path), `release()` awaits `pg_advisory_unlock` and lets a rejection propagate; `runWithLock`'s `finally { await lock.release() }` then throws over a successful `return running`, and `handleCronPost` does not wrap `run()` in try/catch (`cronHandler.ts:48`), so a **successful** job surfaces as HTTP 500 (`locks.ts:76-83`, `runner.ts:135-137`). Archive correctness is intact (PG auto-releases on session end; retry is idempotent), but the wrong status can trigger spurious alerts/retries. This is the performance review's **L-2**, still open and now on the production-critical path. Fix: wrap the unlock query in `try/catch` (swallow) — the connection close already releases the lock. **No contract impact.**

**R-1 (optional hardening, pre-existing).** C4 enforces non-negative-integer FT/HT but not the cross-field `HT ≤ FT` consistency; a self-inconsistent-but-integer row (e.g. HT 3–0, FT 1–1) yields a clamped second half (`Math.max(0, FT−HT)`), which could mis-settle a second-half market. This is the failure review's **#39 (C4-adjacent)** — accepted, not an M9 blocker, requires internally-corrupt provider data.

**R-2 (observation).** Disabled-flag response is `skipped`→HTTP 409 (not 200/404). Internally consistent and disambiguated by `errorCode`; consider 200 for cleaner scheduler semantics.

**R-3 (observation).** Mandatory-odds `invalid_record` bucketed under `writeFailed` (§7) — cosmetic classification refinement.

**Activation/ops gates (not built code, owned by other reviews):** scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep (C7/G7/MC-6); durable cross-restart diagnostics + alert routing; provisioning `EVIDENCE_DATABASE_URL` as a real shared Postgres advisory backend (the C1 precondition — the code fails closed without it, correctly); the **live candidate pipeline** (M4→M5 derivation) a bare cron currently substitutes with an empty pass (§5).

**Implementation correctness vs end-to-end production functionality — kept separate:**
- *M9 implementation correctness:* **PASS** — the wiring, guards, classification, locking, and diagnostics are correct for their scope, verified in code and tests.
- *End-to-end production capture/settlement:* **not yet functional from a plain cron call** — it requires the out-of-scope candidate pipeline plus the activation gates above. This is by design, not a defect.

---

## 11. Required fixes

**Before merge:** none. The dormant, flags-off tree is safe and green.

**Before activation (in priority order):**
1. **D-1** — swallow the `pg_advisory_unlock` rejection so a successful job cannot surface a 500 on the mandatory production lock path (`locks.ts`). *(low-severity code fix)*
2. **C1 provisioning** — set `EVIDENCE_DATABASE_URL` to a shared Postgres advisory backend, or assert single-instance/single-host; the code already fails closed without it. *(ops)*
3. **C7 completion** — scheduled chain-verify sweep + alert routing wired to the emitted counters; durable last-success/freshness if cross-restart visibility is needed. *(ops + minor code)*
4. **Candidate pipeline** — wire real `CaptureRequest`/`SettlementCandidate` production (separate milestone). *(future)*

Optional: R-1 (`HT ≤ FT`), R-2 (disabled→200), R-3 (invalid-odds bucket).

None requires a frozen-contract, identity, hash, revision, archive-format, or replay-semantic change.

---

## 12. Final verdict

The M9 activation & production-wiring implementation **exists, is correct at the job/route boundary, and is fully green.** All seven architecture conditions are implemented and independently verified in code and by dedicated non-wall-clock tests; the frozen capture/settlement/odds/identity contracts are untouched and provably unmutated; the durable single-writer lock now binds to `EVIDENCE_DATABASE_URL` and fails closed in production; the mandatory `evidence_capture` odds record (the long-standing MC-1/B1 gap) is written with a faithfully-reconstructed `captureId` and healed idempotently; error classification never masks a failed or violating write as success; and the archive read is strict. The remaining items are one low-severity HTTP-status defect on the production lock-release path (D-1), a set of activation/ops gates owned by the production/failure/perf reviews, and the explicit separation that end-to-end capture/settlement of *real* fixtures awaits the out-of-scope candidate pipeline.

### M9 IMPLEMENTATION CONDITIONALLY APPROVED

Conditions are the activation-gating items in §11 (chiefly D-1, the C1 `EVIDENCE_DATABASE_URL` provisioning, and the C7 scheduled sweep/alert wiring). No condition blocks merging the dormant, flags-off code. No flag was enabled, no external schedule authored, no Postgres activated, and no frozen contract, identity, hash, revision, archive format, or replay semantic was changed by this review. The verdict is derived solely from the current tree and is not a carry-over of the prior BLOCKED disposition.

---

## 13. Appendix — superseded 2026-07-29 review (BLOCKED, M9 unbuilt)

The original pass found *"the M9 implementation does not exist in the repository … conditions C1–C7 are Not Implemented."* That was accurate **as of 2026-07-29** and mirrored the project's M7-v1 precedent (BLOCKED-because-unbuilt → superseded once built). It is **superseded in full** by this 2026-07-30 re-review: every artifact it enumerated as absent (the two `JobType` members, `runEvidenceCaptureJob`/`runPredictionSettlementJob`, the two cron routes, the capture/settlement diagnostics, the mandatory-odds writer, the durable lock, the C3/C4 guards, the strict NDJSON read) is now present, correct, and tested per §3–§9. The BLOCKED verdict is not retained.
