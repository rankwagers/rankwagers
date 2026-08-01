# M4 — Source Routing & Fetch Orchestration: Migration & Long-Term Compatibility Review (IMPLEMENTED)

**Status:** RECORDED — documentation-only, non-binding. Review date 2026-07-29.
**Supersedes** the 2026-07-28 revision of this file, which was written when M4 was *pending* and assumed
a stateless orchestrator with a disposable Postgres cache. **That revision is retracted** (see "Retractions"
below); this one reviews the **implemented** `lib/evidence-capture/routing/` layer.
**Scope:** Milestone M4 ONLY (`routing/{sources,orchestrator,admission,index}.ts`, 417 LOC; `tests/evidenceRouting.test.ts`).
**Governed by:** `sprint-23b-implementation-contract.md` (§2.E/§4.9/§5.7/§5.13), `phase-2-7-implementation-plan.md` (M4).
**Constraints honored:** no code/contract change, no Postgres implemented, review confined to M4.

## What M4 actually is (from the code)
A **pure, dormant, injectable, stateless** coordination layer with three parts:
- **`sources.ts` — routing plan.** `buildFetchPlan(request, config, nowMs)`: deterministic, fail-closed
  (unknown kind / blank / duplicate key / bad `observedAt` → errors), TTL freshness as a **pure decision**
  (`fetch` | `skip_fresh`) using injected `nowMs` (never `Date.now`), stable sort by `(kind, sourceKey)`.
  Single provider → **no primary/fallback chain** (explicit); `SourceKind` is a closed union
  `team_stats | league_baseline | match_detail`.
- **`orchestrator.ts` — fetch orchestration.** `orchestrateFetches(plan, fetcher, config, clock)` against an
  **injectable** `SourceFetcher` (real clients wired later at M6 — no real network in M4). Enforces the M0
  config (concurrency `min(global, footystats)`, `retryLimit` rounds, `runDeadlineMs`, `requestBudget`,
  `maxFailureRatio`) and returns a **categorized** `FetchRunResult`. Deterministic for the same
  `(plan, fetcher, config, clock)`: rounds, plan-order gating, budget consumed in `(round, plan-order)`,
  retry set re-derived by plan-order filter; no `Date.now`/random/pid/global state. Never fabricates data,
  never converts a failure into empty success, never silently falls back (tests 136–234).
- **`admission.ts` — archive admission.** `admitProviderArchive`/`admitOddsArchive`: build via the M2/M3
  builders then `store.append` through the **store interfaces**; a build failure → `invalid_record`, and the
  archives' `duplicate`/`immutable_violation`/`write_failed` outcomes **pass through verbatim** (tests 242–263).

**It still persists nothing of its own, mints no snapshot, derives no evidence, wires no cron/flag, and is
not yet consumed anywhere** (no M6 glue exists). Freshness is stateless — **no cache is implemented**; the M0
`cacheAdapter`/`cacheVersion` are unused by routing.

## Headline verdict
M4-as-built **confirms in code** the prior conclusion: it has **no independent migration surface** — no
persistence, no identity, no content hash, no on-disk schema, no cache. What is now concrete and reviewable:
its rich type surface is **all ephemeral** (a discarded return value), its admission is a **transparent conduit**
that preserves M2/M3 immutability/idempotency exactly, and its store-interface coupling makes it
**Postgres-transparent**. The residual risks are **downstream binds** (things the M6 fetcher/caller must do,
because M4 deliberately doesn't) and **long-term code-evolution** (multi-provider), none of which are
data-migration risks and none of which block M4 closure.

Legend — **M4✓** blocks M4 closure · **Prod** blocks production activation · **PG** gates Postgres migration · **Frozen** frozen after first production write. (Y / N / Y-if-…)

---

## Migration risk register

### 1. Identity stability
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-ID-1** Admission is a verbatim pass-through — it does **not** canonicalize `source` | `admit*` receives an un-normalized `source`/`operatorKey` slug from the caller | Feeds M2/M3 identity directly; M3 doesn't trim → a drifting slug forks identity or triggers immutable_violation. **M4 code is confirmed transparent — the bind is on the caller (M6), not M4.** | M6 | Bind the M6 caller to emit one frozen canonical slug (trim + case-fold + NFC) before `admit*`; M4 needs no change | N | N | N | N (M4 owns none) |
| **M4-ID-2** Routing `sourceKey` mistaken for archive identity | Assuming the routing `sourceKey`/`SourceKind` enters an archive id | **They don't** — routing keys are ephemeral run-state, never persisted (positive; prevents identity welding from routing) | M4 | None; keep routing keys out of archive inputs (already so) | N | N | N | N |
| **M4-ID-3** Fixture/competition handle authored upstream | M4 carries fixtureId/handles opaquely to `admit*` | Identity welding to `matchId` is a register-wide risk owned upstream (`numericFixtureId` choke-point), not M4 | Long-term | Inherit the register bind; M4 adds nothing | N | N | N | N |

### 2. Content-hash compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-HASH-1** M4 transports payloads opaquely; **semantic normalization is not in M4** | The `FetchResult.payload` (`JsonValue`) is carried to `admit*`, which hands it to M2's JSON-safety builder — no field mapping/rounding happens in M4 | Payload-determinism / numeric-unit / Unicode risks (prior M4-HASH-1/2/3) belong to the **M6 fetcher** that produces the payload, **not** M4 code. M4 doesn't mutate the payload → introduces no drift | M6 | Bind the M6 fetcher to deterministic, canonical-numeric, NFC normalization; M4 needs no change (it must keep *not* transforming payloads) | N | Y (at M6) | N | N |
| **M4-HASH-2** `retrievedAt` carried from the fetcher, not stamped by M4 | Fetcher supplies `retrievedAt` | Excluded from the M2 content hash → provenance only, replay-safe; faithfulness depends on the fetcher | M6 | Fetcher supplies a truthful instant; no hash impact | N | N | N | N |

### 3. Schema evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-SCHEMA-1** M4's own types are **ephemeral** | Evolving `SourceKind`, `SourceFetchStatus`, `FetchResult`, `FetchRunResult` | **No data-compat impact** — none is persisted; the `FetchRunResult` is a discarded return value (positive). Adding a `SourceKind` is additive + touches `ttlForKind`/`SOURCE_KINDS` only | M4 | Evolve freely; keep `ttlForKind` exhaustive | N | N | N | N |
| **M4-SCHEMA-2** Normalized-payload schema/units | Defined by the M6 fetcher, retained in M2 unversioned | Frozen at first M6 write; raw not retained (§5.7); version via `evidenceInputVersion` at M7 (absent⇒v1) — an M6/M7 bind, not M4 | M6/M7 | Additive normalized schema; freeze units; M7 discriminator | N | N | N | Y (at M6) |

### 4. Replay compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-REPLAY-1** M4 on the replay path | A future replay flow invokes `orchestrateFetches`/`admit*` | Destroys §4.9-G determinism (live fetch, clock, config leak in). M4 provides **no** replay affordance; the bind is a wiring rule | M6/M7 | Replay reads retained M2 only; never enter M4. Enforce via the M7 serialization-boundary test | N | N | N | N |
| **M4-REPLAY-2** Degraded fetch persisted as evidence | A failure/timeout/unavailable is admitted | **Structurally prevented in M4**: failures are categorized and never converted to `ok`/payload (tests 151–171); only `status:"ok"` carries a payload, and `admit*` only appends what it's given → the M6 caller must admit **only** ok results | M6 | Bind M6 to admit only `status:"ok"` results; M4's categorization makes this clean | N | Y (at M6) | N | N |
| **M4-REPLAY-3** Coverage nondeterminism | Real clock/budget at M6 → some sources `skipped_deadline`/`skipped_budget` | The **set** of captured inputs becomes timing/budget-dependent, but **each captured record stays deterministic + idempotent**, and replay (from retained M2) is unaffected. Coverage ≠ integrity | M6 | Accept; surface skip counts in diagnostics; see M4-LT-1 | N | N | N | N |

### 5. Postgres mapping
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-PG-1** No store, no cache | — | M4 has **no PK/UNIQUE/index/permission surface and no cache** to migrate. `admit*` calls only `store.append` through the interfaces → works unchanged when M2/M3 gain a Postgres adapter (positive; Postgres-transparent) | Postgres cutover | Inherit M2/M3 PG gates; add nothing in M4 | N | N | N (excluded) | N |

### 6. Snapshot migration
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-SNAP-1** No snapshot surface | — | M4 mints no snapshot (M6). Its admission is the write path into M2/M3 at capture, preserving append-only/idempotent semantics verbatim | M6 | None | N | N | N | N |

### 7. Archive migration
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-ARCH-1** Owns no archive | — | Writes via M2/M3 interfaces; inherits all their NDJSON→Postgres gates (growth, single-writer, hash faithfulness, quarantine, retention) and adds no new archive; introduces **no bypass** of append rules | M9/prod | Honor inherited M2/M3 gates; never open a side-channel file in M4 (currently it doesn't) | N | Inherited | Inherited | N |

### 8. Backup/restore
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-BAK-1** Stateless | — | Nothing in M4 is a backup target (no cache, no store). Durable assets are the M2/M3 archives | prod | Exclude M4 from backup/DR planning | N | N | N | N |

### 9. Long-term risks
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M4✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M4-LT-1** `run.status:"ok"` ≠ completeness | `maxFailureRatio` is computed over **attempted** sources; `skipped_*` are excluded (orchestrator.ts:165–170) | A run can be `ok` while sources were skipped (budget/deadline/fresh) → downstream must not read `ok` as "all inputs present" | M6 | Bind M6 to consume `counts.skipped`/per-source status, not just `run.status`; a capture with missing critical inputs omits the market (§5.13), never fabricates | N | Y (at M6) | N | N |
| **M4-LT-2** Single-provider architecture baked in | `sources.ts` states single provider, no primary/fallback; `SourceKind` closed; `sourceKey` has no provider dimension | Adding a 2nd provider / fallback chain is a **code re-architecture** of routing (provider dimension, ordering) — but **not a data migration** (nothing persisted) | Long-term | Re-architect routing when a 2nd provider lands; ephemeral types make it low-risk; guard the `numericFixtureId` choke-point for cross-provider identity | N | N | N | N |
| **M4-LT-3** Concurrency/budget/deadline/TTL knob evolution | Retuning M0 config | Pure runtime/coverage; no data/identity/hash/schema impact (positive — freely tunable). Changing TTLs changes *which* data is fresh-skipped, not its integrity | Ongoing | Evolve freely; M0 already validates with deterministic fallbacks | N | N | N | N |
| **M4-LT-4** Dead cache config | `cacheAdapter`/`cacheVersion` exist in M0 but are unused by routing | Harmless now; a future cache must be **disposable, cacheVersion-keyed, never a source of truth**, and excluded from migration/backup | Long-term | If a cache is added, keep it out of the replay/identity path (rebuildable from providers/M2) | N | N | N | N |

---

## Retractions (prior 2026-07-28 revision, written pre-implementation)
- **M4-PG-1 "disposable Postgres cache" — WITHDRAWN.** M4 implements no cache; `cacheAdapter`/`cacheVersion`
  are unused by routing. Freshness is a stateless pure decision (`buildFetchPlan`).
- **M4-ID-1 / M4-HASH-1/2/3 "M4 must canonicalize slug / normalize deterministically" — REASSIGNED to M6.**
  The implemented admission is a verbatim pass-through and does not transform payloads or slugs; those binds
  belong to the M6 fetcher/caller, not M4 code.
- The prior "design-binding on a future implementation" framing is replaced by code-level findings.

## Correctness scan (why no contract change)
Read `orchestrateFetches` end-to-end: concurrency cap `max(1,min(...))` with `Promise.race` back-pressure,
budget consumed in `(round, plan-order)`, deadline gate, retry rounds (`round < retryLimit ? retry : status`),
plan-order retry re-derivation, and `maxFailureRatio` over attempted sources — all deterministic and
matching the tests (136–234). Admission appends nothing on build failure and propagates archive outcomes
verbatim (242–263). **No objective current correctness defect → no M4 contract change recommended.**

## Positive findings (preserve as design intent)
- Persists nothing; smallest possible migration surface — all durability risk stays in M2/M3.
- All M4 types are **ephemeral** → schema evolution is free (no historical-data compat).
- Admission is a **transparent conduit** — no bypass of M2/M3 append-only/idempotent/immutable semantics.
- **Store-interface coupling → Postgres-transparent**; M4 needs no change at cutover.
- Determinism is explicit and tested (injected clock/fetcher, plan-order, no `Date.now`/random).
- Failures are categorized and **never** converted to empty success (no §5.13 poisoning inside M4).
- Routing keys never enter archive identity → no identity welding from run-state.

## Gating summary
- **Blocks M4 closure:** none. M4 is pure, dormant, deterministic, defect-free, and its tests are green.
- **Blocks production activation (all at M6, where M4 is wired):** M6 must author a canonical `source` slug (M4-ID-1), produce deterministic normalized payloads/units (M4-HASH-1/M4-SCHEMA-2), admit **only** `status:"ok"` results (M4-REPLAY-2), treat `run.status` as *not* completeness (M4-LT-1), and keep M4 off the replay path (M4-REPLAY-1). Plus the inherited M2/M3 activation gates (retention, single-writer, Postgres readiness).
- **Gates Postgres migration:** none new — Postgres-transparent; inherits M2/M3.
- **Frozen after first production write:** nothing in M4 (it persists nothing). What freezes is authored downstream at M6 (payload schema/units, `source` slug); M4's own surface stays freely evolvable.

M4 MIGRATION REVIEW COMPLETE
