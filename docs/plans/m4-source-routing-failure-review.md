# M4 — Upstream Source Routing & Fetch Orchestration: Failure-Mode Review

**Status:** RECORDED — documentation-only, non-binding analysis. Review date 2026-07-28. **No runtime code changed; no frozen contract or type changed; no M5+ milestone reviewed.**
**Scope:** Milestone M4 ONLY — `lib/evidence-capture/routing/{sources,orchestrator,admission,index}.ts`, exercised by `tests/evidenceRouting.test.ts`. M4 consumes the M0 upstream config (`resolveEvidenceUpstreamConfig`) and writes through the M2 provider archive / M3 odds archive admission helpers. It **mints no snapshot, derives no score/qualification/markets, performs no real network I/O, and wires no cron/route/flag** (`index.ts` header; test asserts no evidence fields and no import side effects).
**Governing documents:** implementation-contract (Rev 2 §2.E/§4.3/§4.9/§5.7/§5.13/§6.3), phase-2.7 DoD, phase-2.7 implementation-plan (M4 line), phase3 safety addendum, future-migration-risk-register, m2/m3 failure & migration reviews.
**Dependency facts confirmed:** the M2 provider file adapter now has the same in-process per-path append mutex as M3 (single-process append serialization; multi-process/host still unsafe). M4 owns no archive I/O of its own — all persistence is delegated to M2/M3 admission.

## What M4 is (as built)
Three pure, side-effect-free, injectable units — **dormant** (injected `SourceFetcher` + injected `Clock`, no real clients, no flags):
1. `buildFetchPlan` (sources.ts) — deterministic routing plan: fail-closed on unknown kind / blank / duplicate sourceKey / invalid `observedAt`; stable sort by `(kind, sourceKey)`; per-source TTL freshness → `fetch` | `skip_fresh` using an **injected** `nowMs`; `skip_fresh` only when `0 ≤ age ≤ ttl` **and** `age ≤ maxSourceAgeMs`; `matchDetailTtlMs === 0` = cache bypass.
2. `orchestrateFetches` (orchestrator.ts) — round-based retry against the injected fetcher: concurrency cap `max(1, min(global, footystats))`, `retryLimit` rounds, `requestBudget` (attempts) consumed in `(round, plan-order)`, `runDeadlineMs` gate (injected clock — never `Date.now`), `maxFailureRatio` post-hoc run verdict. Categorized per-source status; **never fabricates, never converts failure to empty success, never falls back to stale**.
3. `admitProviderArchive` / `admitOddsArchive` (admission.ts) — build (M2/M3) then append; a build failure surfaces as `invalid_record`; `duplicate`/`immutable_violation`/`write_failed` pass through **verbatim**; fabricates nothing.

**Objective current M4 correctness defect: NONE.** Determinism (test "repeat-run determinism"), fail-closed planning, config enforcement (budget/deadline/ratio/retry/concurrency), no-fabrication, and no-evidence-leak are all green. Everything below is dormant-acceptable, a downstream (M6) contract, an activation gate, a sustained/Postgres gate, or a recovery requirement. Nothing is "blocking now."

---

## Failure-mode analysis by category

### 1. Provider archive failures (M4 → M2 via `admitProviderArchive`)
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-P1 | build fails (malformed/normalizer-rejected payload) | `buildProviderArchiveRecord.ok=false` | returns `invalid_record`; **never appended/fabricated** (test) | none | passed (A) |
| MF-P2 | duplicate re-admit (retry / overlapping run) | M2 deterministic id | `duplicate` no-op pass-through | none | passed (A) |
| MF-P3 | same window re-fetched with drifted data | M2 hash compare | `immutable_violation` pass-through — first-write-wins (§4.3/§4.9) | none | passed (A) |
| MF-P4 | archive `write_failed` (IO/corruption/torn-line poison in M2) | M2 append | passed through verbatim; **M4 does not retry archive writes** (retry is fetch-only) → no hot-loop in M4 | low | recovery/runbook-only |
| MF-P5 | transient provider failure persisted as evidence (§5.13) | orchestrator status | impossible in M4: `payload` is set **only** on `ok`; failed/timeout/unavailable carry no payload → admission has nothing to persist. A caller that hand-feeds a placeholder payload for a failed source is an **M6 discipline** breach M4 cannot prevent | low | production-activation-only (M6) |

### 2. Odds archive failures (M4 → M3 via `admitOddsArchive`)
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-O1 | build fails / conflict / duplicate | M3 | `invalid_record` / `immutable_violation` / `duplicate` pass-through (test) | none | passed (A) |
| MF-O2 | odds admission unused at M4 | — | M4 fetches team/match/league only; `admitOddsArchive` is a provided-but-unexercised helper (the §4.7 mandatory `evidence_capture` record is minted at **M6**). Reserved-source/fabrication guards live in M3 and hold | none | dormant-acceptable (boundary) |

### 3. Snapshot failures (downstream — M4 mints nothing)
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-S1 | evidence/score leaked from M4 | test asserts absence | results carry no `evidenceScore`/`qualification`/`supportedMarkets`/`signals`/`modelVersion` (§5.2) | none | passed (A) |
| MF-S2 | stale input frozen as fresh | plan `skip_fresh` gate | `skip_fresh` requires age ≤ TTL **and** ≤ `maxSourceAgeMs`; a future-dated `observedAt` (`age<0`) forces `fetch` (clock-skew safe). No stale-on-failure fallback exists | low | production-activation-only (M6 consumes provenance) |
| MF-S3 | partial success → snapshot scores unfetched markets | per-source status | M4 reports per-source `failed/timeout/unavailable/skipped_*`; **M6 must omit markets whose inputs were not retrieved** (§4.4/§5.13). M4 discharges its half by surfacing status | med (downstream) | production-activation-only (M6) |
| MF-S4 | `run.status = "ok"` misread as "capture complete" | run/counts | the failure-ratio **denominator excludes** `skip_fresh`/`skipped_budget`/`skipped_deadline`; a **resource-starved run can report `ok`** with most sources skipped. `run.status ok ≠ all sources retrieved` — M6 MUST inspect per-source status, not just `run.status` | med (downstream) | production-activation-only (M6 contract) |

### 4. Replay failures (downstream §4.9)
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-R1 | M4 injects volatile data into the retained payload | — | M4 passes `outcome.payload` through unchanged; `retrievedAt` is provider-observed provenance and is **excluded from the M2 hash** → replay-clean. **But** M4/M2 enforce no payload field-whitelist: a wired fetcher (M6) that embeds request-id/fetch-time INTO the payload would poison dedupe/replay | med | production-activation-only (M6 fetcher must emit replay-clean payloads) |
| MF-R2 | M4 orchestration result replayed | — | the run/counts object is ephemeral bookkeeping, never persisted → not on the §4.9 path | none | passed (A) |

### 5. Corruption
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-C1 | M2/M3 archive corrupt (torn/malformed/conflicting line) | store read throws → `write_failed` | pass-through; M4 holds no archive of its own to corrupt (pure) | low | recovery/runbook-only |
| MF-C2 | `write_failed` conflates corruption vs transient IO | store code | inherited M2/M3 F9: identical `write_failed` code. M4 does not auto-retry admission, so no M4 hot-loop; the M6 caller must not auto-retry a corruption-class `write_failed` | low | production-activation-only (M6 retry rule) + recovery |

### 6. IO failures
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-I1 | provider network timeout/error/unavailable | injected `FetchResult` | `timeout`/`failed` → retried up to `retryLimit`; `unavailable` → **terminal, not retried**, and **not** converted to empty ok (test) | none | passed (A) |
| MF-I2 | fetcher error→category misclassification | — | correctness of retry depends on the **wired M6 fetcher** mapping network errors to the right category (a transient blip mislabeled `unavailable` gives up early; a permanent 404 mislabeled `failed` burns retries/budget). M4 trusts the categorization | med | production-activation-only (M6 fetcher mapping) |
| MF-I3 | cache adapter IO | — | M4 implements no cache store; freshness is a pure decision from an injected `observedAt`. `cacheVersion`/`cacheAdapter`/`staleFallbackAllowed` are M0 knobs **not wired** in M4 (safe: M4 never serves stale) | low | production-activation-only (wire cache decision) |
| MF-I4 | run wall-clock / attempt ceiling | injected clock / budget | `runDeadlineMs` gate + `requestBudget` enforced (tests: `skipped_deadline`, `skipped_budget`) | none | passed (A) |

### 7. Duplicate ids
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-D1 | duplicate sourceKey in a request | `buildFetchPlan` | fail-closed rejection (test) | none | passed (A) |
| MF-D2 | duplicate admission (retry/overlap) | M2/M3 deterministic id | idempotent `duplicate` no-op | none | passed (A) |
| MF-D3 | M4 mints an id | — | M4 mints no ids; all identity is delegated to M1/M2/M3 | none | passed (A) |

### 8. Immutable conflicts
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-M1 | same slot, different content | M2/M3 hash | `immutable_violation` pass-through; M4 never overwrites (test) | none | passed (A) |
| MF-M2 | two plan sources map to one archive slot | — | plan dedups sourceKeys; the source→`(source,fixtureId,captureWindowKey)` slot **binding is not in M4** (deferred to M6) → cannot arise in M4 today | none | dormant-acceptable (boundary) |

### 9. Concurrency
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-N1 | async scheduling changes the result | test "repeat-run determinism" | per-slot state is independent; budget consumed synchronously in `(round, plan-order)` before any `await`; retry set re-derived by plan-order filter → deterministic for a given `(plan, fetcher, config, clock)` | none | passed (A) |
| MF-N2 | concurrency cap breach | `inFlight.size >= cap` gate | in-flight bounded by `max(1, min(global, footystats))` | none | passed (A) |
| MF-N3 | two concurrent runs share a budget counter | — | `budget`/`attemptsUsed` are per-invocation locals → no cross-run race | none | passed (A) |
| MF-N4 | concurrent runs write one archive file | M2/M3 in-process mutex | serialized within one Node process; **multi-process/host is NOT safe** — external single-writer required at activation | med | production-activation-only |

### 10. Crash recovery
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-X1 | crash mid-run | — | M4 holds only ephemeral in-memory run state → nothing to recover; restart re-runs and admission dedupes (idempotent). **No fsync/durability is claimed** by M4 (inherited); a crash mid-append is an M2/M3 torn-line recovery concern | low | recovery/runbook-only |
| MF-X2 | budget/deadline non-durable across restart | — | `requestBudget`/`runDeadlineMs` are per-invocation; repeated crash+restart can **multiply** provider load (each run re-spends the budget). Correctness-safe, cost-unsafe | low | production-activation-only (ops: durable run ledger / idempotent scheduler) |

### 11. Resource exhaustion
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| MF-E1 | `requestBudget` default is `null` (no ceiling) | config | by default only concurrency + `retryLimit` + `runDeadlineMs` bound provider calls; **no explicit request ceiling** unless configured | med | production-activation-only (set a budget) |
| MF-E2 | unbounded plan size | `buildFetchPlan` has no max-sources cap | a large `RoutingRequest` → large plan → up to `N × retryLimit` attempts (bounded by deadline). No cap on `N` | med | production-activation-only (bound plan / set budget) |
| MF-E3 | oversized / deep / DAG provider payload | M2/M3 normalizer | inherits M2/M3 F8: deep nesting → categorized error, but **no hard size/breadth/DAG-expansion cap**; a hostile payload can stress the normalizer at admission | med | production-activation-only (payload hard bound) |
| MF-E4 | `maxFailureRatio` is post-hoc, not a circuit-breaker | run verdict | a doomed run (e.g. 90% failing) still executes **all** retries/budget before being marked `failed` — governs run *status*, not resource conservation | low | production-activation-only (optional early-abort) |
| MF-E5 | orchestrator memory | — | `slots`/`results` are O(N sources); in-flight bounded by cap | none | passed (A) |

---

## A/B/C/D/E acceptance matrix

Binary gates. No gate adds a field or alters a frozen type. "Green" = provable against `tests/evidenceRouting.test.ts`.

### A. Passed requirements for M4 closure (green now)
- **A1** `buildFetchPlan` is deterministic, stable-sorted `(kind, sourceKey)`, and fails closed on unknown kind / blank / duplicate sourceKey / invalid `observedAt`. *(test 1)*
- **A2** Freshness: `skip_fresh` iff `0 ≤ age ≤ ttl` **and** `age ≤ maxSourceAgeMs`; `matchDetailTtlMs=0` bypass; future-dated `observedAt` forces `fetch`; over-maxAge forces `fetch`. *(test 2)*
- **A3** No fallback chain — multiple sources of a kind are a flat ordered set. *(test 3)*
- **A4** Orchestrator happy path, retry-until-success, retry-exhaustion, terminal `unavailable` (not converted to empty ok). *(tests 4–5)*
- **A5** `maxFailureRatio` governs run status; `requestBudget` caps attempts (`skipped_budget`); `runDeadlineMs` skips later sources (`skipped_deadline`). *(tests 6–8)*
- **A6** Repeat-run determinism for a fixed `(plan, fetcher, config, clock)`. *(test 9)*
- **A7** Admission: build→append with `invalid_record` on build failure; `duplicate`/`immutable_violation` pass-through; per-instance isolation. *(tests 10–11)*
- **A8** No evidence/scoring/qualification leak; importing the barrel has no side effects (dormant). *(tests 12–13)*
- **A9** Concurrency bounded by `max(1, min(global, footystats))`; budget/attempts are per-invocation locals (no cross-run race); result independent of async scheduling. *(orchestrator.ts + A6)*

**No objective M4 closure blocker found.** *(Confirm against the M4 Gate A/B DoD line whether the orchestrator→admission end-to-end binding and the source→`(source,fixtureId,captureWindowKey)` mapping are in-scope for M4 or deferred to M6 — the code comments defer real-client wiring to M6; treat as a scope-confirmation item, not a defect.)*

### B. Dormant-acceptable limitations (safe only because M4 is dormant/injectable)
- **B1** `admitOddsArchive` is provided but unexercised at M4 (odds minted at M6) (MF-O2).
- **B2** source→archive-slot binding and orchestrator→admission driver are not assembled in M4 (deferred to M6) (MF-M2).
- **B3** `staleFallbackAllowed` / `cacheVersion` / `cacheAdapter` M0 knobs are not wired in M4 — safe (M4 never serves stale) (MF-I3).
- **B4** No payload field-whitelist / size-depth-DAG cap (inherited M2/M3) — no hostile caller wired (MF-R1/MF-E3).
- **B5** No fsync / durability claim; no cross-restart budget ledger — nothing runs while dormant (MF-X1/MF-X2).

### C. Mandatory production-activation gates (before `EVIDENCE_CAPTURE_ENABLED` drives real fetches at M6)
- **C1** Wired M6 fetcher maps network outcomes to the correct category (`ok`/`timeout`/`failed`/`unavailable`) so retry/budget behave (MF-I2).
- **C2** M6 emits **replay-clean** normalized payloads (no request-id/fetch-time/volatile fields inside `payload`) (MF-R1).
- **C3** M6 never hand-feeds a placeholder payload for a failed/timeout/unavailable/skipped source; a transient provider failure is never persisted (§5.13, MF-P5).
- **C4** M6 treats per-source status as authoritative for market inclusion — `run.status = "ok"` is **not** completeness; omit markets whose inputs were `failed`/`timeout`/`unavailable`/`skipped_*` (MF-S3/MF-S4).
- **C5** Single-writer enforcement (external advisory lock / single cron); multi-process/host admission is not safe (MF-N4).
- **C6** Set an explicit `requestBudget` and bound plan size; enforce a payload hard size/depth/DAG cap (MF-E1/E2/E3).
- **C7** M6 does not auto-retry a corruption-class `write_failed`; only transient IO is retried (MF-C2).
- **C8** Decide and wire the `staleFallbackAllowed`/cache knobs (or document them as intentionally inert) before relying on them (MF-I3).

### D. Mandatory sustained-production / Postgres gates (inherited via the archives M4 writes)
- **D1** Postgres readiness gates sustained production (register R1); NDJSON is an initial adapter (M2/M3 O(N)/O(N²), corruption blast radius).
- **D2** DB-enforced append-only + `UNIQUE` identity so admission `duplicate`/`immutable_violation` hold across processes/hosts (structurally closes MF-N4).
- **D3** Retention/bounded storage for the odds archive (M3 §5.8) and provider archive scale — partition-drop, never row-delete.
- **D4** Frozen hash/serializer/identity surface preserved across the migration (register R2); hash basis is retained serialized bytes, not reconstructed columns.

### E. Recovery & operational runbook requirements
- **E1** Archive corruption surfaced as `write_failed`/read-throw is triaged (corruption vs transient) and quarantined per the M2/M3 runbook; M4/M6 do not auto-retry corruption (MF-P4/MF-C1/MF-C2).
- **E2** Post-crash: because M4 keeps no durable state and admission is idempotent, recovery = re-run; verify M2/M3 archives for a torn tail before resuming writes (no fsync) (MF-X1).
- **E3** Guard against crash-loop provider amplification: an idempotent scheduler / durable run ledger so repeated restarts do not re-spend `requestBudget` unboundedly (MF-X2).
- **E4** Alert on `run.status = "failed"` (`failure_ratio_exceeded`) and on elevated `skipped_budget`/`skipped_deadline` counts (starvation masquerading as `ok`) (MF-S4/MF-E4).

---

## Report
1. **Documentation file written:** `docs/plans/m4-source-routing-failure-review.md` (documentation-only).
2. **Objective M4 closure blocker found:** **No.** All A-requirements pass; M4 is pure, deterministic, fail-closed, non-fabricating, and dormant, with no current identity/integrity/append/read-I/O/concurrency defect. One scope-confirmation item (orchestrator→admission binding / source→slot mapping deferred to M6) to verify against the M4 DoD.
3. **Production-activation blockers:** C1 fetcher error-categorization, C2 replay-clean payloads, C3 no-transient-persistence discipline, C4 per-source completeness contract, C5 single-writer, C6 request budget + plan/payload bounds, C7 corruption no-auto-retry, C8 stale/cache-knob decision.
4. **Sustained-production / Postgres blockers:** D1 Postgres readiness, D2 DB append-only + unique identity, D3 retention/bounded storage, D4 frozen hash/identity preservation.
5. **Required recovery procedures:** E1 corruption triage/quarantine (no auto-retry), E2 post-crash re-run + torn-tail verification, E3 crash-loop budget-amplification guard, E4 failure-ratio + skip-starvation alerting.
6. **No runtime code changed** — one documentation-only file created; no frozen contract or type altered; no M5+ milestone reviewed.

Constraints honored: no multi-process safety claimed; no crash durability claimed without fsync; no automatic archive repair claimed; transient provider failure is never persisted as evidence.

M4 FAILURE REVIEW COMPLETE
