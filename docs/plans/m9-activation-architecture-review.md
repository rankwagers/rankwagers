# M9 — Activation & Production Cutover — Architecture Review

**Reviewer:** Claude 1 (architecture)
**Date:** 2026-07-29
**Scope:** Sprint 23B Milestone M9 — *activation* milestone only. Wires the already-built, dormant capture (M6), settlement (M8), input-identity (M7), and provider/odds/evidence archives (M2/M3) into runnable cron routes + diagnostics, behind default-off flags. **No frozen contract, identity formula, hash, revision semantic, archive format, or replay semantic may change.**
**Governing sources:** `phase-2-7-implementation-plan.md` (§M9), `phase-2-7-definition-of-done.md`, `sprint-23b-implementation-contract.md` (Rev 2, items 4 & 12), the M2/M3/M6/M7/M8 review corpus.
**Method:** Repository was read directly (not trusted from docs). All findings carry `file:line` anchors. Four parallel code-mapping passes over `lib/jobs`, `lib/archive`, `lib/evidence-capture`, `app/api/internal/cron`, `lib/config`, `lib/security`, `deploy`.

**VERDICT: M9 ARCHITECTURE CONDITIONALLY APPROVED** (conditions C1–C7 below; C8 is a boundary/production-checklist item). No blocker; no contract change required; the proposed architecture is additive and rests on mature substrate.

---

## 1. Architecture summary

M9's **authoritative** scope (plan §M9, contract items 4 & 12) is narrower than the informal "activation program":

> *In-repo cron **routes** (access + rate-limit + advisory lock, fail-closed when flags off), diagnostics/health counts, and NDJSON shared-dir durability wiring. External **scheduling** is an out-of-repo operational action and is never authored in code.*

DoD non-goals reinforce this: M9 does **not** authorize enabling flags, configuring external scheduling, or activating any Postgres store — those are out-of-repo operational actions.

**Repository reality vs. the plan's state table.** The plan table lists M1–M9 as "pending," but the repo shows **M2–M8 are implemented and dormant**; only the M9 wiring layer is unbuilt. This doc/repo divergence is a documentation-staleness finding (§17), not a defect. What is *actually* missing for M9:

- `JobType` has no `"evidence_capture"` / `"prediction_settlement"` members (`lib/jobs/types.ts:1-8`).
- No `runEvidenceCaptureJob` / `runPredictionSettlementJob` (`lib/jobs/runner.ts`).
- No `app/api/internal/cron/evidence-capture` or `.../prediction-settlement` routes.
- No capture/settlement diagnostics surface.
- Postgres evidence adapter + migrations are **absent** (correctly future, not M9).

Everything M9 needs to build on **exists and is tested**: `cronHandler`/`cronAccess`, `tryAcquireJobLock` (PG advisory + in-proc fallback), `FeatureFlags`, `EvidenceArchiveStore` (memory + file adapters), dormant `captureEvidenceSnapshot` and `settleSnapshot`.

---

## 2. Activation flow (proposed, verified transition-by-transition)

```
Feature Flag ──▶ Cron Route ──▶ Job Runner ──▶ runWithLock ──▶ Capture/Settle ──▶ Archive Append ──▶ Observability
```

| Transition | Substrate that exists | Verified | Condition |
|---|---|---|---|
| Flag → Route | `internalCronEnabled` (`featureFlags.ts:75`, default false) gates all cron; capture/settlement flags in `evidence-capture/config.ts:80-81` | ✓ but **dual flag authority** | **C2** |
| Route → Runner | `handleCronPost` (`cronHandler.ts:13-79`): POST-only, `x-cron-secret` timing-safe, rate-limit 6/60s, skipped→409, failed→500 | ✓ | — |
| Runner → Lock | `runWithLock` (`runner.ts:20-99`) always releases in `finally`; contention → `skipped/lock_unavailable` | ✓ | **C1** |
| Lock → Mint/Settle | `captureEvidenceSnapshot` (`capture/capture.ts:70`), `settleSnapshot` (`settlement.ts:191`) — both dormant, lock-free read-modify-write | ✓ dormant | **C1,C3,C4,C5** |
| Mint → Input-Identity | M7 pure, **unwired**, not persisted | ✗ dormant | **C8** |
| Settle → Archive Append | `EvidenceArchiveStore` append-only; `immutable_violation` surfaced | ✓ | **C6** |
| Append → Observability | `refresh_job_*` counters exist; no capture/settlement counters or freshness | partial | **C7** |

Every transition is structurally sound. The conditions attach to *specific* transitions, not the shape of the flow.

---

## 3. Capture activation review (M6)

Entry point `captureEvidenceSnapshot(store: EvidenceArchiveStore, request)` (`capture/capture.ts:70`). Flow: admission gate → full-stream idempotency pre-check → derive sequence/previous from head → pure build → append (`capture.ts:92-141`). Snapshot id = `f(fixtureId, capturedAt, sequence)` (`lib/evidence/identifiers.ts:27-36`) — **correctly excludes `modelVersion`** (identity is window-anchored).

| Gate | State in repo | Disposition for M9 |
|---|---|---|
| **MC-1** mandatory `evidence_capture` odds record per capture (§4.7 / DoD-5) | **Not written.** Service takes only `EvidenceArchiveStore`; `providerRecord` is integrity-checked, not persisted (`capture.ts:83`). `EVIDENCE_CAPTURE_SOURCE` slot exists (`odds-archive/record.ts:39`) but no mint path. | **M9 BLOCKER-CLASS CONDITION (C5).** DoD-5 is a binary gate: a capture with zero odds records is a *failed capture*. M9's capture job must write exactly one `captureId`-keyed odds record per event, or M6 must resolve it first. The capture route may not ship producing DoD-failing captures. |
| **MC-2** no in-process append mutex; lock-free RMW | Confirmed (`file.ts:9-13, 93-100`). | **Must remain activation gate → C1.** Resolved operationally by single-writer, not by M9 code. |
| **MC-3** `modelVersion` not fingerprinted to constants | `SNAPSHOT_MODEL_VERSION="23B.daily-evidence.v1"` hardcoded (`capture/build.ts:35`); constants in `model/constants.ts` independent. | **Remains gate (ops/M6), not M9-fixable without touching build.** Version-bump discipline on any constant change; scheduled chain verify catches divergence. |
| **MC-5** no fsync / durability barrier | `fs.appendFile` returns before flush (`file.ts:99`). | **Production checklist (§11), not M9 blocker.** M9's "NDJSON shared-dir durability wiring" addresses *orphaning*, not fsync. Backup + post-crash idempotent re-run cover it. |
| **MC-6** corrupt/torn line silently skipped (fail-open for detection) | `readNdjson` drops unparseable lines per-line (`file.ts:73-91`). Note: this is the evidence adapter specifically; M2/M3 provider/odds adapters fail *closed*. | **Partially resolvable in M9:** scheduled `verifyEvidenceChain` sweep + freshness is in M9's diagnostics scope (§10). Quarantine/repair tooling remains ops. |
| **MC-10** a window's snapshot is permanent | By design (pre-check + `immutable_violation`). | Correct; correction path = new `modelVersion` + new window. No M9 action. |

**Capture verdict:** activatable, but **C5 (MC-1)** must be satisfied and **C1 (MC-2)** enforced before the capture flag is turned on.

---

## 4. Settlement activation review (M8)

`settleSnapshot(store, input)` (`settlement.ts:191-357`), dormant behind `EVIDENCE_SETTLEMENT_ENABLED=false` (a hardcoded constant, `settlement.ts:49`), **zero non-test callers** (grep-verified). Revision semantics are complete and immutable: first write → revision 1 (`createValidationRecord`, `settlement.ts:271`); correction → `reviseValidationRecord` with `supersedesRevisionId` chaining (`settlement.ts:310`); store admission enforces revisionId uniqueness, snapshot existence, revision continuity, supersedes chain (`rules.ts:76-130`). `nowSec`/`completionInstant` are **required inputs — no `Date.now()`** (deterministic).

| Gate | State in repo | Disposition for M9 |
|---|---|---|
| **PA-1** fixture correspondence `row.matchId === snapshot.fixtureId` | **ABSENT.** No cross-check; a mismatched row settles silently and all integrity checks still pass. | **CONDITION C3 (must).** M9 settlement job must pass the authoritative provider row for exactly `snapshot.fixtureId` and reject/skip on mismatch (caller-level guard). |
| **PA-2** score sanity (non-negative integers) | **INCOMPLETE.** Only `Number.isFinite()` (`outcomes.ts:129`); negative/fractional scores settle (e.g. negative total → `over25 = lost`). `halfScores.ts:59` clamps 2nd-half but trusts FT. | **CONDITION C4 (must).** M9 job must validate FT/HT as non-negative integers before settlement. |
| **G2 / R7** single-writer for validation appends | No in-process mutex; conditionally safe only under a single serialized writer. | **CONDITION C1.** Same lock discipline as capture. |
| Store-error handling at caller | `settleSnapshot` lets store I/O throw across the boundary (`settlement.ts:230/326/371`) — fail-loud, never false success. | **CONDITION C6.** M9 job must catch and classify (retryable vs escalate), never treat a throw as "settled." |

**Settlement verdict:** logic is correct and fail-closed; activation safety depends entirely on the M9 orchestrator supplying C1/C3/C4/C6. No settlement path can *bypass* these once they are placed at the job boundary — because settlement has no other caller.

---

## 5. Input-identity review (M7)

`input-identity/` computes `inputContentHash = "iih_" + hash(evidenceInputVersion, providerContentHash, sortedOddsContentHashes)` (`identity.ts:9-12`). Pure, defensively-copied, canonically code-point sorted, strictly validated; **`modelVersion` excluded** from the basis (correct per contract). **F-1: dormant** — only test callers; `captureEvidenceSnapshot` does not invoke it; there is **no `inputContentHash` field persisted** on `EvidenceSnapshot`.

**Disposition — C8 (boundary / production checklist, NOT an M9 blocker):** The mandatory DoD-1 serialization-boundary replay **re-derives** identity and passes *without* a persisted `inputContentHash`, so M7 wiring is not required for M9 activation correctness. However, the M7 implementation's retention rule stands: first durable production must guarantee permanent retention of every input `contentHash` in the replay basis (provider/odds records are the sole non-reconstructable basis — M2-PROD-6). M9 need not compute/persist `inputContentHash` to activate; it **must not** prune the provider/odds basis. Wiring M7 into the mint is a separate future milestone.

---

## 6. Feature flag review

- **Default OFF, deterministic, no env ambiguity.** `internalCronEnabled` defaults false (`featureFlags.ts:75`); `parseBool` (`featureFlags.ts:48-55`) and `readFlag` (`config.ts:44-47`) both reject unknown strings to the safe default; `"false"`-string is handled correctly. Import has no side effects; startup unaffected; tests deterministic.
- **Independent gateability:** capture and settlement are separate flags (`config.ts:80-81`), satisfying independent activation.
- **FINDING → C2 (dual flag authority).** Three symbols overlap on the `EVIDENCE_SETTLEMENT_ENABLED` name: (a) the shared `FeatureFlags` (no capture/settlement members at all), (b) env-driven `settlementEnabled`/`isSettlementEnabled(env)` in `config.ts`, and (c) a **hardcoded `EVIDENCE_SETTLEMENT_ENABLED=false` constant** in `settlement.ts:49` that `settlement.ts`'s own predicate reads. The hardcoded constant **cannot be flipped by env** and is the intentional dormancy guard. M9 must gate the route+job on the **env-driven** `isCaptureEnabled(env)`/`isSettlementEnabled(env)` **and** the global `internalCronEnabled`, returning a fail-closed `skipped/disabled` when off — and must not rely on (or be silently defeated by) the `settlement.ts` constant. Pick one authoritative env path; document that route/job gating supersedes the module constant at the wiring layer (no contract edit).

---

## 7. Cron review

`handleCronPost` (`cronHandler.ts:13-79`) + `evaluateCronAccess` (`cronAccess.ts:32-67`) already enforce: POST-only (405 otherwise); `internalCronEnabled` gate (404 when off); `x-cron-secret` header only, timing-safe, ≥16 chars in prod; rate limit 6/60s → 429 + `retryAfterSec`; **skipped → 409** with `errorCode:"lock_unavailable"`; failed → 500; `Cache-Control:no-store`, `x-robots-tag:noindex`. Structured `cron_executed` log with duration.

**M9 must add** two routes mirroring `evidence-prepare/route.ts`, each additionally gating on its capture/settlement flag (existing routes gate only on `internalCronEnabled`; the new ones must *also* fail-closed on the capture/settlement flag — C2). **Idempotency** is inherent: capture is full-stream idempotent, settlement is revision-aware, both lock-serialized — a duplicate callback is safe. **External scheduling / cron ordering / deploy registration are explicitly out-of-repo** (contract item 4); the repo authors routes, not schedules. The "cron schedule file location" open question (plan Blocker #4) is therefore **not an M9 code deliverable** — it is an ops action (§14).

---

## 8. Job runner review

`JobType` must gain `"evidence_capture" | "prediction_settlement"` (`types.ts:1-8`). New `runEvidenceCaptureJob`/`runPredictionSettlementJob` mirror `runEvidencePrepareJob` (`runner.ts:101-130`): wrap `runWithLock`, return `RefreshJobRecord` with `resultCounts` + `errorCode`. `runWithLock` (`runner.ts:20-99`) already: emits `refresh_job_success_total`/`refresh_job_failure_total`/`refresh_job_duration_ms`, logs `job_finished`, `reportError` on throw, releases lock in `finally`.

**Gap → C6.** The runner classifies any thrown error as `failed/unhandled` generically; it has **no retry loop** (`attempt` is always 1 — retry is the next idempotent cron fire). So the *job body* must classify store outcomes: `write_failed` → transient (surface failed; next cron retries safely), `immutable_violation`/`sequence_conflict`/`revision_conflict` → "chain advanced, re-read" + escalate/alert (never blind-retry), thrown store I/O → retryable failure (never "settled/empty"). Structured `resultCounts` per plan: `captured/duplicate/invalid/failed` and `settled/corrected/pending/skipped`.

---

## 9. Locking review (highest priority)

`tryAcquireJobLock(lockName, {timeoutMs})` (`lib/jobs/locks.ts`):

- **Two backends.** PostgreSQL advisory lock (`pg_try_advisory_lock`, key = `sha256(lockName)` → 31-bit int, `locks.ts:9-14`) **iff** `SNAPSHOT_DATABASE_URL | ATTRIBUTION_DATABASE_URL | ODDS_HISTORY_DATABASE_URL` is set; otherwise an **in-process `Set`** (`locks.ts:28-36`). Busy-wait 50 ms up to `timeoutMs` (default 1000); contention → returns `null` (→ `skipped`, never throws). `finally` always releases; PG unlock closes the connection.
- **Cross-process safety is conditional.** The in-process backend protects **one Node process only**. The PG backend is cross-process — but keys off the *attribution/odds/snapshot* DB URLs, **not** `EVIDENCE_DATABASE_URL`. So in the default file-NDJSON evidence deployment, the lock is PG-backed only if one of those other DB URLs happens to be set; otherwise it is memory-backed.
- **Current single-writer rests on `deploy/ecosystem.rankwagers.cjs` `instances:1, fork`** — a *process-level* single-writer. That is sufficient **only while the app is never horizontally scaled and cron fan-in hits one process.**

**CONDITION C1 (must, resolves MC-2 / R7 / G2):** M9 must (a) give capture and settlement **distinct `runWithLock` keys**; and (b) **guarantee the lock is cross-process for evidence** — either bind the evidence lock to a PG advisory lock whose backing DB URL is asserted present at activation, **or** make single-instance deployment a hard, documented activation precondition (assert `instances:1` and single-host cron). Fail-closed if the guarantee is absent. Without C1, duplicate cron / parallel deploy / multi-node can produce duplicate appends, forked revisions, or conflicting hashes — the exact failures the archive only *detects* at read time via `verifyEvidenceChain`, never prevents. (Minor: the 31-bit advisory key space makes cross-lock-name collision negligible but non-zero; keep lock names stable and few.) No deadlock risk: single non-nested lock per job, always released; worker restart drops the PG connection (lock auto-released) or clears on process exit (memory).

---

## 10. Observability review

Substrate: `metrics.increment/timing` + `refresh_job_*` counters (`runner.ts`), `logInfo/logWarn/reportError`. Diagnostics/health counts are **in M9 scope** (plan §M9).

| Metric | Class |
|---|---|
| capture success / failure / duplicate / invalid | **mandatory** |
| settlement success / pending / no_change (duplicate) / corrected | **mandatory** |
| immutable-violation count | **mandatory** (alert) |
| archive-failure (`write_failed`) count | **mandatory** (alert) |
| last-successful-run timestamp / freshness age | **mandatory** (per plan diagnostics) |
| cron skipped (`lock_unavailable`) count | mandatory (already emitted) |
| capture / settlement latency | optional (timing already generic) |
| lock-contention rate | optional |

**CONDITION C7 (must):** immutable-violation + archive-failure alerting and per-pipeline last-success freshness must exist before either flag is turned on (M8 production review §11.4). The rest are optional/future.

---

## 11. Backup / DR review — **OUT OF M9 (production checklist)**

The evidence/provider/odds NDJSON archives are the sole non-reconstructable replay basis (M2-PROD-6). Backup schedule, restore verification (full re-scan / byte-length manifest), post-crash `verifyEvidenceChain` sweep, and retention are **operational actions**, not M9 code — except that M9's **"NDJSON shared-dir durability wiring"** (the orphaning fix, writing to the shared dir rather than a release-local path) *is* in scope and must be delivered. fsync (MC-5) and quarantine tooling are ops hardening. **M9 must not prune the provider/odds basis** (protects M7 replay/C8).

---

## 12. Postgres cutover review — **OUT OF M9 (future milestone)**

No evidence Postgres adapter and no migration exist (`service.ts:33-44` selects memory|file only; `createPostgres*` absent; no `db/migrations/*evidence*`). The contract states cutover is *"a single reversible env flip after verification"* and DoD non-goals forbid activating any Postgres store in this plan. Therefore cutover is **explicitly not an M9 deliverable**. When built (future): additive tables with `UNIQUE(id)` + `UNIQUE(fixture_id, sequence)` + `UNIQUE(revision_id)`, `ON CONFLICT` mapped to `duplicate`/`immutable_violation` (pattern: `lib/acca-publication/adapters/postgres.ts:111,221-230`), hash-faithful TEXT timestamps (G5), byte-preserving + order-independent rebuild-from-rows (not re-derive). Reversibility = env flip; atomicity per-row via constraints. Verifiable, but out of this milestone.

---

## 13. Failure matrix

| Failure | Behavior | Fail-open / closed | M9 obligation |
|---|---|---|---|
| Cron overlap / duplicate callback | Lock → one runs, other `skipped/409`; jobs idempotent | closed | C1 |
| Two nodes / parallel deploy | **Safe only under cross-process lock or single-instance** | *conditionally closed* | **C1** |
| Store I/O failure | `settleSnapshot`/append throw; runner → `failed` | closed (loud) | C6 (classify retryable) |
| Lock timeout | returns `null` → `skipped`; next cron retries | closed | — |
| Process restart mid-run | lock released (conn drop / exit); idempotent re-fire | closed | — |
| Power loss mid-append | `fs.appendFile` no fsync → possible lost tail / torn line | **open (MC-5/MC-6)** | ops + C7 sweep |
| Partial/torn line | silently skipped on read | **open (MC-6)** | C7 scheduled `verifyEvidenceChain` |
| Provider outage | transient; never persisted as evidence (M4) | closed | — |
| Garbage provider scores (negative/fractional) | **currently settles** | **open (PA-2)** | **C4** |
| `row.matchId ≠ snapshot.fixtureId` | **currently settles silently** | **open (PA-1)** | **C3** |
| Missing snapshot at settle | no head → nothing settled | closed | — |
| Zero odds records at capture | capture "succeeds" but is a DoD-5 failed capture | **open (MC-1)** | **C5** |

Net: every fail-*open* cell is either an accepted ops/production item (MC-5/MC-6, with C7 detection) or a hard M9 condition (C3/C4/C5). M8/M6 logic never fabricates loss from *absent* data; the open cells are *mis-trust of malformed input* (C3/C4) and *missing wiring* (C1/C5) — all closable at the M9 job boundary without a contract change.

---

## 14. Production gates (what must be true before flags flip — ops, not code)

1. Cross-process single-writer guaranteed (C1) — PG advisory lock backing asserted, or `instances:1` single-host cron documented.
2. Backup/DR of NDJSON basis in place; retention defined (M2-PROD-6, M3-PROD-1).
3. Scheduled `verifyEvidenceChain` sweep + alerting live (C7 / MC-6).
4. `modelVersion` bump discipline documented (MC-3).
5. External cron schedules registered out-of-repo (contract item 4).
6. Flags flipped by explicit operator opt-in only (contract item 12; DoD non-goal).

---

## 15. Required architecture corrections (conditions on M9)

| # | Condition | Resolves |
|---|---|---|
| **C1** | Capture & settlement each on a distinct `runWithLock` key; evidence lock guaranteed cross-process (PG advisory w/ asserted DB URL) **or** single-instance made a hard precondition; fail-closed. | MC-2, R7/G2, PROD single-writer |
| **C2** | Route+job gate on env-driven `isCaptureEnabled`/`isSettlementEnabled` **and** `internalCronEnabled`, default-off, fail-closed; reconcile the dual `EVIDENCE_SETTLEMENT_ENABLED` symbols (module constant vs env). | flag ambiguity |
| **C3** | Enforce `row.matchId === snapshot.fixtureId` at the settlement job (reject/skip on mismatch). | PA-1 / MF-1 |
| **C4** | Validate FT/HT as non-negative integers before settlement. | PA-2 / MF-2 |
| **C5** | Capture job writes exactly one `captureId`-keyed `evidence_capture` odds record per event; zero-odds = failed capture. (Or resolve in M6 first.) | MC-1 / DoD-5 |
| **C6** | Job body catches & classifies store outcomes: `write_failed`→transient, `immutable_violation`/`*_conflict`→re-read+escalate, thrown I/O→retryable; never "settled/empty" on error. | store-error gate |
| **C7** | Ship immutable-violation + archive-failure alerting, per-pipeline success/failure/pending/skipped counts, and last-success freshness before activation. | observability gate |

All seven are additive wiring/guards at the job/route boundary. **None touches a frozen contract, identity formula, hash, revision semantic, archive format, or replay semantic.**

## 16. Optional improvements

- Persist `inputContentHash` + wire M7 into the mint (C8) — future traceability milestone, not required for DoD-1 replay.
- fsync-on-append hardening for the evidence file adapter (MC-5).
- Line-level quarantine/repair tooling for MC-6.
- Fingerprint `modelVersion` from a constants hash so a stale version string cannot mask changed constants (MC-3, D-side).

## 17. Repository verification

- `lib/jobs/types.ts:1-8` — `JobType` lacks capture/settlement members (also has phantom `conversion_reconciliation`/`sitemap_refresh` with no runners).
- `lib/jobs/runner.ts:101-130`, `lib/jobs/locks.ts:9-74`, `lib/jobs/cronHandler.ts:13-79`, `lib/security/cronAccess.ts:32-67` — substrate present & tested.
- `lib/config/featureFlags.ts:48-176`, `lib/evidence-capture/config.ts:44-108`, `lib/evidence-capture/settlement.ts:49` — flags; dual-authority finding (C2).
- `lib/evidence-capture/capture/capture.ts:70-161`, `capture/build.ts:35`, `odds-archive/record.ts:39` — capture dormant; MC-1 unwired; MC-3 hardcoded.
- `lib/evidence-capture/input-identity/identity.ts:9-138` — M7 pure, unwired (F-1).
- `lib/archive/evidence/{store.ts:38-66,memory.ts,file.ts:73-100}` — store contract + memory/file adapters; **no `postgres.ts`**.
- `lib/evidence-capture/settlement.ts:191-357`, `outcomes.ts:129`, `rules.ts:76-130` — settlement dormant; PA-1 absent, PA-2 incomplete.
- `deploy/ecosystem.rankwagers.cjs` — `instances:1, fork`; no in-repo cron schedules (by design).
- **No `db/migrations/*evidence*`; no evidence Postgres adapter** — Postgres cutover correctly future.
- **Doc/repo divergence:** `phase-2-7-implementation-plan.md` state table lists M2–M8 "pending" while the repo shows them built-and-dormant. Recommend correcting the table on M9 completion.

## 18. Final verdict

**M9 ARCHITECTURE CONDITIONALLY APPROVED.**

The proposed activation architecture (flag → route → runner → `runWithLock` → dormant capture/settlement → append-only archive → diagnostics) is additive, rests on mature and tested substrate, and violates none of M2/M3/M6/M7/M8, immutability, determinism, replay, append-only history, or production safety **provided conditions C1–C7 are met at the M9 job/route boundary**. C8 (input-identity wiring) and the Backup/DR and Postgres-cutover sections are explicitly **outside M9** — future milestones and the production checklist — and must not be pulled in as scope creep. No frozen contract may change to satisfy any condition; each is satisfiable by wiring and guards alone.
