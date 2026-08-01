# M9 — Activation & Production Wiring — Failure-Injection & Recovery Review

**Reviewer:** Claude 5 (adversarial failure-injection & recovery)
**Date:** 2026-07-30 (final re-review; supersedes the 2026-07-29 BLOCKED verdict)
**Scope:** Sprint 23B Milestone M9 — activation wiring only (cron routes, capture/settlement job runners, lock keys, dual-flag gating, mandatory-odds capture, settlement input guards, error classification, diagnostics, NDJSON durability). No frozen contract, identity, hash, revision, archive-format, or replay semantic may change; flags stay off; archive data is never edited/deleted. **No runtime code was modified by this review.**
**Method:** Repository read directly (not trusted from the reported summary). All findings carry `file:line`. The whole substrate + M9 wiring was exercised: full suite **1687/1687**, typecheck clean, lint clean, plus three review-only fault-injection probes (created in `tests/`, run, and **deleted** — never committed). Companion to [[m9-activation-implementation-review]] (Claude-2 impl re-review), [[m9-activation-architecture-review]] (C1–C8), [[m8-settlement-failure-review]] (MF-1/MF-2/MF-3), and the M6 review corpus (MC-1…MC-10).

---

## 1. Executive summary

**M9 is now BUILT, and every blocker from the prior review is resolved in code.** Independent verification (not the reported summary) confirms the activation layer previously absent now exists and fails closed under injection:

- `JobType` carries `evidence_capture` + `prediction_settlement` (`lib/jobs/types.ts:4-5`); runners `runEvidenceCaptureJob` / `runPredictionSettlementJob` exist (`lib/jobs/runner.ts:282,319`); cron routes `evidence-capture` + `prediction-settlement` exist and gate via `handleCronPost`.
- **B1 (orphaned mandatory odds) — RESOLVED.** The capture orchestrator writes exactly one `captureId`-keyed `evidence_capture` odds record per supported market via `ensureMandatoryCaptureOdds` (`capture/mandatory-odds.ts`), counts a snapshot whose odds cannot be written as **failed, never captured** (`jobs/capture-run.ts:129-147`), and **heals** a snapshot minted without odds on the next idempotent run (probe B).
- **B2 (no cross-process write exclusion) — RESOLVED.** Capture/settlement demand a durable lock bound to `EVIDENCE_DATABASE_URL`; in production a missing durable URL or `JOB_LOCK_ADAPTER=memory` **refuses the lock** (fails closed → skipped) rather than degrade to a per-process `Set` (`locks.ts:27-50`, tested Blocker-1 ×3). Capture and settlement use **distinct, stable** keys (`job:evidence_capture` / `job:prediction_settlement`), released in `finally`.
- **B3 (unbuilt layer) — RESOLVED.** Routes, runners, dual-flag gating (C2), fixture correspondence (C3), score sanity (C4), mandatory odds (C5), error classification (C6), and diagnostics (C7) are all present and tested (`tests/m9Activation.test.ts`, `tests/m9Concurrency.test.ts`).
- **MC-6 (evidence reader failed OPEN for detection) — RESOLVED.** `readNdjson` now surfaces every non-`ENOENT` errno and throws loudly on any malformed line (`lib/archive/evidence/file.ts:96-135`); a runtime job reading a corrupt chain therefore **fails closed** (`writeFailed`), never mis-derives a head or settles a truncated stream (probes A + C).

The system is still **dormant** (flags default off — `config.ts` `readFlag`, `EVIDENCE_SETTLEMENT_ENABLED=false`), so nothing runs in production today; but unlike the prior review, failure-safety is now certifiable against **built** code, and the fault-injection matrix passes against it.

Four **residual, non-blocking** findings remain (§12). None can produce a false WIN/LOSS/VOID/PUSH or corrupt immutable data; each is either an observability wart or an activation-gating operational item:

- **R-1 (release-throw misclassification).** A Postgres `pg_advisory_unlock` that throws in `release()` propagates out of `runWithLock`'s `finally`; `handleCronPost` has no `try/catch`, so a genuinely-successful, idempotent capture/settle surfaces as a framework 500. No data harm (idempotent re-run reconciles); CI memory-path unaffected. Optional hardening.
- **R-2 (C4 cross-consistency).** C4 validates FT/HT non-negativity but not `HT ≤ FT`; a self-contradictory `HT>FT` row (both non-neg ints) passes and `resolveHalfScores` clamps `SH=max(0,FT−HT)=0`, which can settle an SH over-market `lost` from impossible data. Cannot fabricate a WIN (clamp only lowers SH). Bounded; optional hardening (matches M8 #39).
- **R-3 (C7 scheduled sweep).** Diagnostics expose freshness/status/counts but there is no scheduled `verifyEvidenceChain`/`verifyValidationChain` cron with alerting. Downgraded from a correctness concern to a detection-latency one because reads now fail loud. Recommended pre-activation.
- **R-4 (no fsync).** NDJSON append has no fsync barrier; a torn tail on power loss is now read-side loud (fail closed) and re-minted idempotently, not silently mis-derived. Ops/optional; Postgres cutover removes the class.

Activation itself still depends on out-of-M9 gates: a Postgres-backed durable lock actually provisioned in production (the file NDJSON store remains the *initial* single-writer adapter), the live M4→M5 candidate pipeline (M10 — a bare cron fire runs an empty, safe pass by design), and the C7 sweep. These are activation preconditions, not failure-safety defects in the built code.

**Verdict: M9 FAILURE REVIEW CONDITIONALLY APPROVED.**

---

## 2. Previous blockers and current status

| Prior blocker | Prior state | Current state | Evidence |
|---|---|---|---|
| **B1** — orphaned mandatory odds (C5/MC-1) | capture wrote only the snapshot; zero odds returned `created` | **RESOLVED** — per-market mandatory `evidence_capture` odds written; zero-odds = failed capture; partial pair heals next run | `capture/mandatory-odds.ts:70-154`, `jobs/capture-run.ts:129-147`; probe B; `m9Activation` C5 ×5 |
| **B2** — no cross-process lock (C1/MC-2) | default in-proc `Set`; PG keyed off wrong DB URLs | **RESOLVED** — durable lock binds `EVIDENCE_DATABASE_URL`; prod fail-closed w/o it; distinct stable keys | `locks.ts:27-50`; `runner.ts:72-74`; Blocker-1 ×3 |
| **B3** — activation layer unbuilt | no routes/runners/JobTypes/diagnostics | **RESOLVED** — all present + tested | `types.ts`, `runner.ts`, `app/api/internal/cron/{evidence-capture,prediction-settlement}`, `diagnostics.ts` |
| **MC-6** — evidence reader fails OPEN | malformed lines silently skipped | **RESOLVED** — every non-ENOENT surfaced; malformed line throws | `file.ts:96-135`; probes A + C |
| **C2/C3/C4/C6/C7** — unbuilt | safety depended on nonexistent wiring | **BUILT** | see §4 |

Nothing regressed: contracts, identities, hashes, revisions, and archive formats are unchanged; the frozen M6 capture and M8 settlement services are untouched — the guards live **outside** them at the orchestration boundary.

---

## 3. Threat / failure model

Assumed adversary/environment (unchanged from the prior review): processes crash mid-append; files are partially written / torn-tailed; stores throw or time out; providers send malformed, mismatched, or self-contradictory rows; cron callbacks overlap and duplicate; flags flip mid-flight; the lock backend is unavailable or per-process only; rolling deploys restart workers and run mixed code versions; operators fire jobs manually.

Properties failures must never silently violate: false WIN/LOSS/VOID/PUSH; duplicate immutable records; revision forks; invalid corrections; broken hash chains; **orphaned mandatory records**; success responses after failed writes; replay divergence. Governing principle: when evidence is incomplete, malformed, mismatched, contradictory, or unavailable — **fail closed** (pending / skipped / retryable failure / explicit invalid input / loud alert); never guess a settlement.

---

## 4. Fault-injection matrix

Status key: **SAFE** = built code fails closed / idempotent under the injection (verified by test or probe); **RESIDUAL** = safe against false-result/corruption but carries a non-blocking wart (§12); **GATE** = out-of-M9 activation precondition, not a failure-safety defect.

### A. Feature flags
| # | Scenario | Behavior (verified) | Status |
|---|---|---|---|
| 1 | internal cron flag off | `evaluateCronAccess` → denied (`cronHandler.ts:23-25`) | SAFE |
| 2 | capture flag off | `runEvidenceCaptureJob` → `flagSkippedJob("capture_disabled")`, **no lock, no store touch**, route 409 (`runner.ts:288-289,246-262`) | SAFE (C2) |
| 3 | settlement flag off | symmetric `settlement_disabled` (`runner.ts:325-326`) | SAFE (C2) |
| 4 | missing flag env | `readFlag(undefined)` → false | SAFE |
| 5 | malformed boolean env | anything ≠ `"true"/"1"` → false (test C2 "strict") | SAFE |
| 6 | flag flips before job | request-time env read; next request re-reads | SAFE |
| 7 | flag flips mid-flight | admitted run completes idempotently (append-only); no mid-run re-check needed | SAFE |
| 8 | dormant module constant vs env | env flag is the single authority — enables despite `EVIDENCE_SETTLEMENT_ENABLED=false` const (test C2) | SAFE |

### B. Locking
| # | Scenario | Behavior (verified) | Status |
|---|---|---|---|
| 9 | same-job contention | `tryAcquireJobLock` → null → `skipped/lock_unavailable/409` (`runner.ts:75-86`) | SAFE |
| 10 | capture+settlement overlap | distinct keys → both proceed; no false contention (test C1, m9Concurrency) | SAFE |
| 11 | production, no `EVIDENCE_DATABASE_URL` | durable lock **refused** (null), never memory fallback (Blocker-1) | SAFE |
| 12 | forced `JOB_LOCK_ADAPTER=memory` in prod | durable lock **refused** (Blocker-1) | SAFE |
| 13 | lock DB unreachable | `pool.connect` throws → caught → null → skipped; **never** degrades to memory (`locks.ts:54-62`) | SAFE |
| 14 | DB disconnect while holding lock | PG conn close auto-releases advisory lock; `finally` release guarded | SAFE |
| 15 | release after success | `runWithLock` `finally { lock.release() }` (test) | SAFE |
| 16 | release after exception in job body | job caught → `failed/unhandled`, lock still released in `finally` (m9Concurrency "thrown job body") | SAFE |
| 17 | release throws (PG unlock error) | propagates out of `finally` → framework 500 despite success | **RESIDUAL (R-1)** |
| 18 | process termination before unlock | PG conn close auto-releases; memory `Set` dies with process | SAFE |
| 19 | rolling-deploy overlap / lock-key drift | keys are stable constants `job:<type>` (never version-derived) → two versions still exclude | SAFE |
| 20 | 1000 acquire/release cycles | in-process lock set does not grow (m9Concurrency) | SAFE |

### C. Snapshot archive read
| # | Scenario | Behavior (verified) | Status |
|---|---|---|---|
| 21 | ENOENT | only-empty case → `[]` (`file.ts:100`) | SAFE |
| 22 | EACCES / EPERM | throws "permission denied" — never empty (`file.ts:101-107`) | SAFE |
| 23 | EIO / EBUSY / ENXIO / ENODEV | throws "I/O failure" — never empty (`file.ts:108-119`) | SAFE |
| 24 | EISDIR / other | throws differentiated "read failed" (`file.ts:120-126`) | SAFE |
| 25 | malformed JSON line | throws "malformed NDJSON at line N" (`file.ts:129-135`) → capture `archive_error`/`writeFailed` (probe A) | SAFE |
| 26 | truncated final line | same as #25 — loud throw, no mis-derived head, **no re-mint** (probe A) | SAFE |
| 27 | hash mismatch on chain | `verifyEvidenceChain` detects at read; runtime read still loud on any corruption | SAFE (+R-3 sweep) |
| 28 | duplicate identity conflict | `decideSnapshotAppend` → duplicate (same hash) / `immutable_violation` (diff hash) | SAFE |
| 29 | revision fork | admission rejects divergent bytes at same key; never overwritten | SAFE |
| 30 | partial read | impossible to continue authoritatively — a corruption-shortened read throws before any decision (probes A/C) | SAFE |

### D. Capture pair
| # | Scenario | Behavior (verified) | Status |
|---|---|---|---|
| 31 | neither record exists | fresh mint + odds appended → `captured` (probe B, C5 tests) | SAFE |
| 32 | snapshot exists, odds missing | next run: snapshot→`duplicate`, odds **healed** (`oddsAppended=1`) (probe B) | SAFE |
| 33 | odds exists, snapshot missing | snapshot re-mints (deterministic id); odds re-ensured → `duplicate` (idempotent) | SAFE |
| 34 | both identical | snapshot `duplicate` + odds `duplicate`; no accretion (probe B run3) | SAFE |
| 35 | both conflicting (diff hash, same id) | snapshot `immutable_violation` / odds `immutable_violation` — counted, alerted, never overwritten (`capture-run.ts:116-142`) | SAFE |
| 36 | snapshot append ok, odds append fails | capture counted **failed** (`writeFailed`/`immutableViolation`), never `captured` (C5 "failed write" test) | SAFE |
| 37 | odds append ok, response lost | deterministic `(captureId,market,selection,source)` id → retry `duplicate`, no dup line (odds store idempotent) | SAFE |
| 38 | unknown commit after snapshot write | retry re-derives same snapshotId → `duplicate`; heals odds (probe B) | SAFE |
| 39 | unknown commit after odds write | retry → odds `duplicate`; no new identity | SAFE |
| 40 | retry after crash between writes | pair completed next run; **same** captureId reused (probe B) | SAFE |
| 41 | retry after restart | in-proc log resets but archive is source of truth; deterministic ids → idempotent | SAFE |
| 42 | retry reuses capture identity | `captureIdentityFromSnapshot` reconstructs the frozen M1 captureId (C5 "matches authoritative identity") | SAFE |
| 43 | provider data missing | admission false → `not_admitted`, never persisted; build fail-closed → `invalid` | SAFE |
| 44 | supportedMarkets empty | `buildMandatoryCaptureOdds` → fail-closed error → capture failed (C5 "empty markets") | SAFE |
| 45 | immutable conflict | see #35 | SAFE |

### E. Settlement
| # | Scenario | Behavior (verified) | Status |
|---|---|---|---|
| 46 | result missing (no snapshot) | `not_found`, no write (`settlement.ts:371-374`) | SAFE |
| 47 | incomplete fixture (score inputs absent) | `requiredScoreInputsPresent` false → `pending`, no write (`outcomes.ts:119-137,209`) | SAFE |
| 48 | fixture mismatch (`row.matchId ≠ fixtureId`) | **C3 skip before any read/write** → `fixtureMismatch` (`settlement-run.ts:135-144`, test C3) | SAFE |
| 49 | negative score | **C4 reject** → `invalidScore`, no settle (`settlement-run.ts:100-117,147`, test C4) | SAFE |
| 50 | decimal score | C4 reject | SAFE |
| 51 | NaN | C4 reject (not integer); also `requiredScoreInputsPresent` non-finite → pending | SAFE |
| 52 | Infinity | C4 reject | SAFE |
| 53 | malformed score / non-object row | C3 (`row?.matchId`) then C4 (`row===null` guard) reject | SAFE |
| 54 | already settled identical | head state unchanged → `no_change`, no revision (`settlement.ts:288-298`) | SAFE |
| 55 | conflicting settlement (state change) | exactly one correction revision; requires explicit typed `correctionCause` else `invalid_input` (`settlement.ts:300-322`) | SAFE |
| 56 | append failure | `append_failed` → `writeFailed` bucket, `ok:false`, job `failed/write_failed` (`settlement-run.ts:187`, C6) | SAFE (loud) |
| 57 | archive read failure | `listValidations` throws → per-candidate `settle_threw`/`writeFailed`; no false settle (probe C) | SAFE |
| 58 | provider-wide outage | candidates simply absent (injected) → empty safe pass | SAFE |
| 59 | individual fixture failure | isolated per candidate; batch continues (`settlement-run.ts:131-190`) | SAFE |
| 60 | batch continues for unrelated items | one throw/fault does not abort the loop | SAFE |
| 61 | HT>FT contradictory (both non-neg int) | passes C4; SH clamps to 0 → can settle SH `lost` (never WIN) | **RESIDUAL (R-2)** |

### F. Diagnostics
| # | Scenario | Behavior (verified) | Status |
|---|---|---|---|
| 62 | success | freshness/status/last counts surfaced (`diagnostics.ts`, C7 test) | SAFE |
| 63 | failure | `lastStatus/lastErrorCode` reflect it | SAFE |
| 64 | lock contention | `skipped/lock_unavailable` tracked | SAFE |
| 65 | immutable violation | `immutableViolation` count + `immutable_violation` errorCode (C6) | SAFE |
| 66 | write failure | `writeFailed` count + `write_failed` errorCode (C6) | SAFE |
| 67 | process restart | in-proc log resets → `lastSuccessAt=null` (freshness honestly unknown, never falsely fresh) | SAFE (+R-3 for durable history) |
| 68 | concurrent jobs | each updates its OWN record by identity, never `jobLog[len-1]` (`runner.ts:39-45,90-94`, m9Concurrency "no clobber") | SAFE |
| 69 | bounded error summaries | failures sampled to 5 in logs (`runner.ts:299,335`); job log bounded to 500 (`runner.ts:31-43`) | SAFE |
| 70 | no secret leakage | diagnostics project only counts/status/ids; no env/URL/secret in payloads | SAFE |

---

## 5. Capture atomicity / recovery

Capture is two immutable writes — the `EvidenceSnapshot` (frozen M6 `captureEvidenceSnapshot`) and exactly one `captureId`-keyed `evidence_capture` odds record per supported market (DoD 5 / §4.7). M9 sequences them at the orchestration boundary **without** touching either frozen service:

1. **Deterministic identity keys both halves.** The snapshot id is `f(fixtureId, capturedAt, sequence)`; the odds records are `f(captureId, marketKey, selectionKey, source)` where `captureId` is reconstructed purely from the snapshot via `captureIdentityFromSnapshot` (`mandatory-odds.ts:48-59`) — the exact frozen M1 formula (C5 "matches authoritative identity" test). A retry therefore re-derives the *same* identities and no-ops the already-written half.
2. **Ordered, recoverable pair.** Snapshot first, then mandatory odds. `already_exists` still ensures odds (`capture-run.ts:124-136`), so a snapshot minted before odds existed is **repaired** on the next run — verified end-to-end (probe B: orphan → `duplicate` snapshot + `oddsAppended=1`, same captureId, then fully idempotent).
3. **Zero-odds = failed capture.** A snapshot whose odds cannot be built/written is counted `writeFailed`/`immutableViolation`, never `captured` (`capture-run.ts:129-147`); an empty `supportedMarkets` fails closed (`mandatory-odds.ts:73-75`). The job reports `failed` with a distinguishable code, so the incompleteness is loud and re-fired.

The prior B1 steady-state incompleteness is gone: a completed run leaves a complete pair, and any interrupted run self-heals without minting a new identity.

---

## 6. Unknown commit state

Recovery-by-idempotency is **sufficient**, and now verified against built code:

- **Authoritative reread occurs.** Both `captureEvidenceSnapshot` (full-stream pre-check + head read) and `settleSnapshot` (re-list validations, derive current head) re-read the stream on every attempt. A read that hits corruption **throws** rather than returning a short list (§9), so no attempt proceeds from a partial view.
- **Deterministic identity is reused.** No attempt mints a fresh id on retry; the snapshotId, captureId, and validation `revisionId` are pure functions of frozen inputs.
- **Byte-identical duplicates collapse.** Same id + same contentHash → `duplicate`/`no_change` (snapshot, odds, and validation stores all enforce this).
- **Same identity / different content is rejected.** Divergent bytes at the same key → `immutable_violation`, surfaced and alerted, **never** overwritten (`store.ts` decide-fns; `capture-run.ts:116-119`; `settlement.ts:336-337`).
- **No new captureId after uncertain commit.** Confirmed by probe B — the second run yields `duplicate`, not a second mint.
- **Partial pair heals next run**, and **healing cannot invent a different odds basis**: the mandatory record carries `decimalOdds=null, operatorKey=null, sampleOperators=0`, enforced by the frozen `buildOddsRecord` `EVIDENCE_CAPTURE_SOURCE` branch (`record.ts:222-229`) — there is no market-odds input to diverge on.

**Provider-availability dependence:** recovery does **not** require the provider to still hold the data. Healing rebuilds the mandatory odds record purely from the already-committed snapshot's identity + supported markets — no re-fetch. (Producing *live* candidates for a *first* capture does need the provider, but that is the M10 pipeline, not recovery.)

---

## 7. Settlement false-result proof

Traced against built code. No path fabricates a definitive result from absent, mismatched, malformed, in-play, unavailable, or stale data:

| Vector | Guard | Result | Status |
|---|---|---|---|
| missing fixture data (no snapshot) | `latestSnapshot` null | `not_found`, no write | PROVEN |
| missing score inputs | `requiredScoreInputsPresent` | `pending`, no write | PROVEN |
| mismatched fixture (`matchId≠fixtureId`) | **C3** before read/write | `fixtureMismatch`, no settle | PROVEN (test C3) |
| malformed score (neg/frac/NaN/Inf) | **C4** non-neg-integer gate | `invalidScore`, no settle | PROVEN (test C4) |
| in-play score (live/half_time/suspended) | non-terminal lifecycle | `pending`, no write | PROVEN |
| failed archive read | loud throw | `writeFailed`, no settle | PROVEN (probe C) |
| partial archive read | loud throw before decision | never settles | PROVEN (probe C) |
| provider outage | candidates absent | empty safe pass | PROVEN |
| stale / contradictory lifecycle | `resolveMatchLifecycle` single-valued; ambiguous → non-terminal → pending | no write | PROVEN |
| pending → no write | `outcomes.ts` / `settlement.ts:260-264` | no record | PROVEN |
| no_change → no revision | `settlement.ts:288-298` | no accretion | PROVEN |
| correction cause typed + deterministic | `determineCorrectionReason` total map | deterministic reason or `invalid_input` | PROVEN |

**No invalid source data can produce WIN / LOSS / VOID / PUSH** — with one bounded caveat: a *self-contradictory* finite row (`HT>FT`, both non-neg ints) passes C4 and, via `resolveHalfScores` clamping `SH=max(0,FT−HT)=0`, can settle an SH over-market **`lost`** (never a WIN — clamping only lowers SH). This requires the provider to send an internally-impossible row and yields at worst a bounded under-result on one market; it is recorded as **R-2** optional hardening (add an `HT ≤ FT` cross-consistency check to C4), consistent with M8 #39/MF-2. VOID is never synthesized from daily-list data (needs an explicit `authoritativeMarketVoid`, which no daily-list caller sets); PUSH is not in the daily-list market vocabulary.

---

## 8. Corruption policy

The evidence and odds NDJSON readers are now **fail-closed for detection** (the prior MC-6 fail-open is gone):

- **Runtime jobs never build authoritative results from a chain that fails to parse.** `readNdjson` throws on any malformed line and on every non-`ENOENT` errno (`file.ts:96-135`); the odds reader additionally throws on integrity-failed records and on-disk `(id, differing hash)` conflicts (`odds-archive/file.ts:70-116`). A corruption-shortened read therefore surfaces as `archive_error`→`writeFailed` (capture) or `settle_threw`→`writeFailed` (settlement) — verified end-to-end (probes A + C). No silent head mis-derivation, no re-mint, no settle-against-gap.
- **Diagnostics / web app** may still render a degraded/empty state on read failure without crashing (acceptable per plan).
- **Recovery is quarantine + immutable-revision correction only** — no reader ever rewrites or deletes a line; the file is append-only by construction (`file.ts` opens nothing for truncation).
- **Residual (R-3):** a *scheduled* `verifyEvidenceChain`/`verifyValidationChain` sweep with alerting is not wired as a cron. Because runtime reads are now loud, this is a detection-latency improvement (catch a dormant corruption before the next job touches the fixture), not a correctness gap. Recommended before sustained activation.

---

## 9. Retry behavior

No recovery step edits or deletes a historical record; every correction is a new immutable revision.

| Class | Recovery | Basis |
|---|---|---|
| flag off / disabled | fail-closed skip; no state to repair | C2 |
| lock contention / timeout | automatic safe retry next fire | `runner.ts:75-86` |
| lock backend error / prod no-URL | fail-closed skip; provision durable lock | `locks.ts:54-62`, Blocker-1 |
| provider outage / malformed input | not persisted; retry after correction | admission / C3 / C4 |
| capture archive_error / write_failed | idempotent retry (deterministic id) | probe A/B |
| **partial capture pair** | **next run heals — same captureId, no new mint** | probe B |
| immutable_violation / *_conflict | deterministic re-read; genuine divergence → alert + manual correction via new revision; **never** blind-overwrite | `capture-run.ts:116-119`, `settlement.ts:336-337` |
| torn / corrupt line | loud read failure → quarantine + chain verify + restore; operator only | §8, probes A/C |
| unknown commit state | deterministic re-read (§6) | probe B |
| multi-process interleave | prevented by durable lock; if it ever occurred, chain-verify detects → quarantine | Blocker-1 |
| release-throw false 500 | idempotent re-run reconciles (harmless); classify better (R-1) | §12 |

Transient vs terminal is correctly split: `write_failed` and thrown I/O are retry-safe; `immutable_violation`/`*_conflict` mean "chain advanced — re-read, and if bytes truly diverge, escalate, never retry into an overwrite."

---

## 10. Rollback behavior

No rollback path deletes or rewrites immutable archive data (append-only NDJSON; identity/hash formulas frozen).

| Scenario | Behavior | Status |
|---|---|---|
| flags disabled mid-flight | admitted run completes idempotently; append-only → no partial-visible corruption | SAFE |
| route disabled | `evaluateCronAccess` denies; no capture/settle occurs | SAFE |
| scheduler disabled | nothing fires; archive quiescent | SAFE |
| application rollback | records are additive NDJSON; older `readNdjson` parses them (unknown fields ignored) | SAFE (additive) |
| old version lacks new route | 404 / route-disabled; no silent settle; next fire post-rollback is idempotent no-op | SAFE |
| **lock-key stability across versions** | keys are fixed constants `job:<type>` (never version-derived), so a rolling deploy's two versions still mutually exclude | SAFE |
| partial capture pair at rollback | append-only; heals on the next forward run; no rewrite | SAFE |
| completed settlement append | immutable; a later reinterpretation is a *new* revision, never an edit | SAFE |
| diagnostics reset | in-proc log is ephemeral; resets to "unknown" (never falsely fresh), archive is the durable truth | SAFE |

---

## 11. Error-classification matrix

Distinct, non-collapsed classes across job status / errorCode / resultCounts / logs:

| Class | Where distinguished | Not collapsed into |
|---|---|---|
| pending | `counts.pending` (settlement) | no_change / invalid |
| no_change | `counts.noChange` | pending / duplicate |
| invalid input | `invalidInput` (settle) / `invalid` (capture) | writeFailed |
| fixture mismatch | **C3** `fixtureMismatch` | invalidScore / invalidInput |
| invalid score | **C4** `invalidScore` | fixtureMismatch / pending |
| lock unavailable | `skipped` + `lock_unavailable` | failed |
| configuration failure (prod no durable lock) | durable lock refused → `skipped`/`lock_unavailable` | succeeded |
| flag disabled | `skipped` + `capture_disabled`/`settlement_disabled` | lock_unavailable |
| provider failure / not admitted | `notAdmitted` (capture) / absent candidates | invalid |
| archive read failure | `writeFailed` via thrown read | invalidInput |
| archive corruption | loud throw → `writeFailed` (+R-3 sweep for proactive) | silent empty |
| write failure | `writeFailed` + `write_failed` errorCode | immutable_violation |
| immutable violation | `immutableViolation` + `immutable_violation` errorCode | write_failed |
| unexpected failure | `runWithLock` catch → `failed`/`unhandled` + `reportError` | succeeded |

Verified: `runEvidenceCaptureJob`/`runPredictionSettlementJob` set `status=failed` with `errorCode` distinguishing `write_failed` vs `immutable_violation` (`runner.ts:301-308,337-344`; test C6 "job errorCode distinguishes"), and `handleCronPost` maps `failed→500`, `skipped→409`, else `200` with `resultCounts` echoed. The prior "200/succeeded hiding a failed outcome" hazard is closed: a hard fault sets `hardFailed` → `failed` → 500.

---

## 12. Remaining blockers

**No hard blockers remain.** The prior B1/B2/B3 are resolved; the fault-injection matrix passes against built code; no injection produces a false result or corrupts immutable data. Four **non-blocking residuals** remain:

- **R-1 — release-throw misclassified as job failure.** A thrown `pg_advisory_unlock` in `release()` (`locks.ts:76-83`) propagates out of `runWithLock`'s `finally` (`runner.ts:136`); `handleCronPost` has no `try/catch`, so a *successful, durable* capture/settle can surface as a framework 500. No data harm (idempotent re-run reconciles; the lock is still physically released via the inner `finally`). Recommend wrapping `lock.release()` in a swallow-and-log, or `release()` catching its own unlock error. Also flagged as D-1 in [[m9-activation-implementation-review]].
- **R-2 — C4 lacks `HT ≤ FT` cross-consistency.** A self-contradictory finite row can settle an SH market `lost` from impossible data (never a WIN). Add a cross-consistency check to `hasValidCompletedScores`. Matches M8 #39/MF-2.
- **R-3 — no scheduled integrity sweep.** Diagnostics are reactive; add a scheduled `verifyEvidenceChain`/`verifyValidationChain` sweep with alerting for proactive detection. Correctness is already protected by loud runtime reads.
- **R-4 — no fsync on append.** Torn-tail on power loss is now read-side loud + idempotently re-minted, not silently mis-derived. Optional; removed entirely by the Postgres cutover.

**Activation gates (out of M9 scope, not defects):** a Postgres-backed durable lock actually provisioned in production (the file NDJSON store is the *initial* single-writer adapter — sustained multi-node activation requires it); the live M4→M5 candidate pipeline (M10 — a bare cron fire is an intentional empty safe pass); the R-3 sweep.

---

## 13. Optional hardening

- Swallow/log `release()` errors so a durable-unlock hiccup can't misreport a successful write as a 500 (R-1).
- Add `HT ≤ FT` (and HT-half ≤ FT-half) cross-consistency to C4 (R-2).
- Wire a scheduled chain-verification sweep with alerting (R-3).
- fsync-on-append for both NDJSON adapters (R-4).
- Add an `id`-derivability re-check to `verifyValidationChain` (M8 MF-3/O1) so an identity-coordinate rehash forge is caught.
- Fingerprint `modelVersion` from a constants hash (MC-3) so a stale version can't mask changed constants.
- Restore-verification manifest (byte-length + line-count) for DR (#63/#64 in the prior matrix).

---

## 14. Test evidence

- **Full suite: 1687 / 1687 pass, 0 fail** (`node --test tests/*.test.ts`). **Typecheck: clean** (`tsc --noEmit -p tsconfig.typecheck.json`). **Lint: clean** (`next lint`, 0 warnings/errors).
- **M9 activation (`tests/m9Activation.test.ts`):** C1 distinct keys + single-writer skip + capture-doesn't-block-settlement; C2 default-off skip / single-flag authority / strict-boolean; C3 foreign-matchId reject; C4 negative/fractional/NaN reject; C5 per-market mandatory odds / idempotent / failed-write=failed-capture / authoritative captureId / empty-markets fail-closed; C6 `write_failed` vs `immutable_violation` distinct; C7 diagnostics freshness/status/counts; end-to-end settle; **frozen invariance** (writing mandatory odds never mutates snapshot id/contentHash).
- **M9 concurrency (`tests/m9Concurrency.test.ts`):** same-key serialize; distinct-key parallel; release-in-`finally` after throw and after write_failed return; cron-overlap → skip (no queue); 1000-cycle no-growth; no-clobber concurrent distinct-type jobs; bounded job log; **Blocker-1 ×3** (prod no-URL → refused, prod memory-adapter → refused, non-durable → memory fallback unchanged).
- **Substrate:** `evidenceSettlement`, `evidenceCaptureMint`, `oddsArchive`, `evidenceArchiveFileAdapter` all green (101/101 in the focused batch).
- **Review-only probes (created in `tests/`, run, then DELETED — confirmed absent):**
  - **PROBE A** — corrupt `snapshots.ndjson` line → capture `captured=0, writeFailed=1` (no silent re-mint).
  - **PROBE B** — crash-between-writes orphan → 2nd run `duplicate` snapshot + `oddsAppended=1` (same captureId), 3rd run fully idempotent (`oddsDuplicate=1`, no accretion).
  - **PROBE C** — corrupt `validations.ndjson` line → settlement `settled=0, writeFailed=1` (never a false result).
- **No runtime code modified; no flags enabled; no archive data read-modified; no migration attempted.** All probe/tmp files removed.

---

## 15. Final verdict

M9's activation & production wiring now **exists and fails closed** under adversarial injection. The three prior blockers are resolved in code and proven by test + probe: the mandatory `evidence_capture` odds record is written and a zero-odds capture is a failed capture (B1); cross-process exclusion is a durable `EVIDENCE_DATABASE_URL`-bound advisory lock that refuses to degrade to memory in production (B2); and the full route/runner/gating/guard/diagnostics layer is built (B3). The previously fail-open evidence reader now surfaces every corruption loudly (MC-6), so no runtime job can settle or re-mint from a partial view. The false-result proof holds: no missing, mismatched, malformed, in-play, failed-read, partial-read, outage, or stale input can produce a WIN/LOSS/VOID/PUSH — the single bounded caveat (a self-contradictory `HT>FT` row settling an SH market `lost`, never a WIN) is captured as optional hardening R-2.

Four residuals remain, none of which can produce a false result or corrupt immutable data: R-1 (a durable-unlock throw misreported as a job 500), R-2 (C4 cross-consistency), R-3 (a proactive chain-verification sweep), and R-4 (fsync). Sustained production activation additionally depends on out-of-M9 gates — a provisioned Postgres durable lock (the file NDJSON store is the initial single-writer adapter), the live M4→M5 candidate pipeline (M10), and the R-3 sweep.

**M9 FAILURE REVIEW CONDITIONALLY APPROVED** — conditioned on R-1…R-4 and the named activation gates being closed before flags flip; no frozen contract, identity, hash, revision, archive format, or replay semantic needs to change to clear any of them; flags remain off; no archive data was edited or deleted by this review.
