# M10 Stage 2 — Performance & Scalability Review

**Document type:** Performance & scalability analysis (review-only). No runtime code, tests, contracts, feature flags, cron routes, runners, schedules, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance & Scalability Reviewer, Sprint 23B / M10 Stage 2 preparation.
**Under analysis:** the *planned* Stage 2 orchestration (wiring the Stage-1 pure candidate provider into the M9 runners inside the durable lock) against the current repository. Stage 2 is **not built**; this constrains it before it is.
**Governing:** `docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1), `docs/plans/m10-live-candidate-pipeline-architecture-review.md`, `docs/plans/m10-stage-1-candidate-provider-foundation.md`, `docs/plans/m10-stage-1-candidate-provider-implementation-review.md`, `docs/plans/sprint-23b-m9-closure.md`, and the M9 performance review (`docs/plans/m9-activation-performance-review.md`).
**Method:** every file:line cited was read directly this pass. Measured numbers are labelled **[measured]** (from the M9 perf-review scratch benchmark) or **[estimate]** (modelled from measured per-scan cost + the current reader shape). No new benchmark was run (the task forbids benchmarking modified code); §12 defines the benchmarks Stage 2 MUST run.

**Invariants held throughout (verified present):** discovery inside lock (INV-L), archive as sole checkpoint (INV-A), deterministic ordering (INV-S), batch cap ≤150 (INV-C), route-compatible deadline (INV-D), no persistent cursor.

---

## 1. Executive Verdict

### PERFORMANCE CONDITIONALLY READY FOR STAGE 2

The Stage-1 provider (`lib/evidence-capture/candidates/*`) is the right performance shape: **pure, allocation-lean, O(n log n) at worst, bounded to ≤150, deterministic, and archive-read-free** (it *consumes* pre-built `Set`s, it does not scan). It introduces no new bottleneck. Stage 2's performance is therefore decided almost entirely by **one design choice that does not yet exist in code**: how the orchestration builds the archive-derived state (`capturedWindowKeys`, `partialWindowKeys`, `capturedFixtureIds`, `settledFixtureIds`) that Stage 1 consumes, and how the frozen M6/M8 consumer batch scans the NDJSON files.

Two hard facts constrain that choice:

1. **The `EvidenceArchiveStore` interface exposes only per-fixture reads** — `listSnapshots(fixtureId)`, `listValidations(fixtureId)`, `latestSnapshot(fixtureId)`, `nextSequence(fixtureId)` (`lib/archive/evidence/store.ts:38-66`). There is **no whole-archive read**. If Stage 2 builds the state Sets by looping those per-fixture calls over the *D* discovered fixtures, each call is a full O(A) NDJSON scan → **O(D·A) ≈ the O(F²) amplification the M9 review already flagged**. The single-bounded-read requirement (spec §7.2) is therefore an *unbuilt* obligation, not a satisfied one.

2. **The current reader is `fs.readFile(file, "utf8")`** (`lib/archive/evidence/file.ts:79`) → a single string. Node's `MAX_STRING_LENGTH = 536,870,888` chars (~512 MB) is a **hard wall**: at ~1.5 KB/snapshot line the snapshots file becomes **unreadable at ≈350 k records** (throws, and by the strict-read policy that fail-closes the whole run). The odds `readAll` additionally re-runs `verifyOddsRecord` (a hash recompute) **per line** (`odds-archive/file.ts:100-105`), so a full odds scan is hash-heavy.

None of this is a Stage-1 defect and none requires a frozen-contract change. But Stage 2 **must not begin wiring without** (a) a single bounded/streamed whole-archive state build (PB-1), (b) a mandatory representative-depth benchmark proving the whole route fits the ≤45 s effective deadline (PB-2/B5), (c) the INV-D remaining-time guard (PB-3), and (d) a streaming reader or an equivalent depth ceiling to stay clear of the 512 MB string wall (PB-4). With those four bound, the design provably stays inside the 60 s route budget at the expected tens–low-hundreds-of-fixtures/day load. Hence **CONDITIONALLY READY** — see §13/§14.

---

## 2. Current Repository Evidence

| Fact | Anchor | Class |
|---|---|---|
| Runners accept injected candidates, default empty | `lib/jobs/runner.ts:296,332` (`candidates ?? []`) | measured (read) |
| Both cron routes call runner with **no** candidates; `maxDuration = 60` | `app/api/internal/cron/{evidence-capture,prediction-settlement}/route.ts` | measured |
| Bare cron fire (empty batch) ≈ **0.04 ms/pass** | M9 perf review §benchmark | measured |
| `EvidenceArchiveStore` = **per-fixture reads only**, no whole-archive read | `lib/archive/evidence/store.ts:38-66` | measured |
| Reader = `fs.readFile(file,"utf8")` → one string; ENOENT→empty, else throw | `lib/archive/evidence/file.ts:79-110` | measured |
| Node `MAX_STRING_LENGTH` = 536,870,888 chars (~512 MB) | `buffer.constants` (this host) | measured |
| Odds `readAll` re-verifies each line (`verifyOddsRecord`, hash) | `lib/evidence-capture/odds-archive/file.ts:87-116` | measured |
| Odds append serialized by in-proc mutex per file | `odds-archive/file.ts:41-59,128` | measured |
| Capture consumer = 3 evidence scans + M hash-verified odds scans / fixture | `capture/capture.ts:92,110,141` + `mandatory-odds.ts:134` | measured |
| Settlement consumer = 2 + 2·T scans / fixture | `settlement.ts:230,371` + `evidence/file.ts:201-204` | measured |
| **[measured]** capture 500-batch @ cum-750 (~1.1 MB snap + 0.6 MB odds) ≈ **99.6 s**, ~199 ms/fixture | M9 perf review §6 | measured |
| **[measured]** settlement 500-batch @ cum-750 (~0.7 MB val) ≈ **48.6 s**, ~97 ms/fixture | M9 perf review §6 | measured |
| Stage-1 provider is pure: no `fs`/`fetch`/`Date.now`/`process.env` | `candidates/*` (impl-review §3 grep) | measured |
| Stage-1 limit: default 100, hard cap 150, fail-safe | `candidates/limits.ts:10-27` | measured |
| Stage-1 ordering: `(capturedAt asc, fixtureId asc)` / `(completionInstant asc, fixtureId asc)` | `candidates/ordering.ts:23-39` | measured |
| Eligibility classify = O(1)/fixture (Set.has + pure `resolveMatchLifecycle`) | `candidates/eligibility.ts:70,84,87,176,179,185` | measured |
| M4 concurrency cap = min(global 4, footystats 2) = **2** in-flight | `routing/orchestrator.ts:85-88`; `config.ts:146-147` | measured |
| M4 retry 3, `runDeadlineMs` **300 000** (5 m, > route 60 s) | `config.ts:152-153,241-244` | measured |
| TTLs: teamStats 6 h, leagueBaseline 24 h, matchDetail 5 m | `config.ts:148-150` | measured |
| No archive-state builder exists (`capturedWindowKeys` etc. only in `candidates/`) | grep `lib/` (§preparation) | measured |
| No benchmark/perf test or script exists | `ls tests/ scripts/` | measured |

---

## 3. Capture Complexity

Variables: **D** = discovered fixtures (source rows grouped by fixture); **F** = selected ≤ ceiling (≤150); **M** ≤ 32 markets/fixture (~2–4 in daily-list practice, exactly the 4 tabs); **A** = accumulated **global** lines in the scanned NDJSON file (grows across days); **A_odds** = odds-records lines.

| Sub-path | Time | Memory | Notes |
|---|---|---|---|
| source fetch/normalization (`loadPublishedDailyPredictions` → `normalizeDailyArchive`) | O(D·M) pure map, plus **one** daily-archive file read | O(D·M) | `source.ts:65-103`; deterministic; malformed rows dropped upstream (must be counted — arch §9 N-1) |
| **archive-state scan** (Stage-2, unbuilt) | **O(A) if one bounded read; O(D·A) if per-fixture loop** | O(A) transient (Sets: O(#snapshots+#fixtures)) | *the* decision point (§6, PB-1). Store interface offers only per-fixture reads → naïve build is O(D·A) |
| archive-state indexing (reduce rows → Sets) | O(A) | O(distinct windowKeys + fixtureIds) | build `capturedWindowKeys`/`partialWindowKeys` (needs snapshots ∪ odds), `capturedFixtureIds` |
| fixture grouping | O(D·M) into `Map<fixtureId,Group>` | O(D·M) | `capture-provider.ts:94-137`; Set-dedup of repeat marketKeys |
| eligibility | O(D) — O(1)/fixture (Set.has + pure lifecycle/window) | O(1) | `eligibility.ts:70-115` |
| deduplication (per-fixture group, per-market Set) | O(D·M) | O(D·M) | in grouping; no extra scan |
| ordering (`sortDeterministic`) | O(E log E), E = eligible ≤ D | O(E) copy (spread) | `ordering.ts:42-47` |
| limit selection (`slice(0,ceiling)`) | O(F) | O(F) | `capture-provider.ts:181-183` |
| M5 derivation (`deriveEvidenceModel`, per selected fixture) | O(F·M) pure CPU | O(F·M) | `model/derive.ts:293-372`; map/filter over ≤M markets |
| **M4 live fetch** (per selected fixture, inside lock) | **network-bound**, ≤ `retryLimit`(3) rounds, concurrency 2, TTL-gated `skip_fresh` | O(payload) transient | `routing/orchestrator.ts:79-146`; dominant wall-clock when caches cold |
| M6 processing (frozen `runCaptureBatch`) | **O(F·(3·A + M·A_odds))** — the amplifier | O(A) transient/scan | `capture-run.ts`; 3 evidence scans + M hash-verified odds scans per fixture |

**Dominant terms.** Two independent bottlenecks: (1) **network** — M4 fetch wall-clock at concurrency 2 for cold-cache fixtures; (2) **CPU/IO** — the O(F·A) consumer scan, with capture the *steeper* curve because the odds `readAll` re-hashes every line. Everything Stage 2 *adds* (discovery/classify/order/select) is ≤ O(D log D) and negligible next to those two. **The whole-day batch is O(F·A) ≈ O(F²) within a run and grows with accumulated A across days** — the ceiling bounds F, not A.

---

## 4. Settlement Complexity

| Sub-path | Time | Memory | Notes |
|---|---|---|---|
| prediction (snapshot) archive scan — for `capturedFixtureIds` | O(A) once (or O(D·A) naïve) | O(#fixtures) | same PB-1 decision as capture |
| validation archive scan — for `settledFixtureIds` | O(A_val) once (or O(D·A_val) naïve) | O(#settled fixtures) | validations file |
| state joining (captured ∩ ¬settled) | O(D) Set ops | O(D) | `settlement-provider.ts:100-104` |
| fixture-status fetch (completed rows) | source-bound (daily-list/finished rows) | O(D) | injected; no per-fixture network in Stage-1 shape |
| lifecycle classification (`resolveMatchLifecycle`) | O(D) — O(1)/row, pure switch | O(1) | `eligibility.ts:185`; `fixtures/status.ts:12,84` |
| deduplication (per-fixture, sort+seen-Set) | O(D log D) | O(D) | `settlement-provider.ts:128-139` |
| ordering | O(E log E) | O(E) | `ordering.ts:32-39` |
| limit selection | O(F) | O(F) | `settlement-provider.ts:144-146` |
| M8 processing (frozen `runSettlementBatch`) | **O(F·(2 + 2·T)·A)** | O(A) transient/scan | `settlement.ts`; T ≤ M terminal-changed markets that append; `appendValidation` = 2 scans (val+snap) |

**Dominant term.** The O(F·A) consumer scan, ~half capture's per-fixture cost **[measured 97 ms vs 199 ms @ cum-750]** because settlement touches no hash-verified odds file. Settlement’s producer stage adds only O(D log D). Same accumulated-A growth risk.

---

## 5. Archive Scale Scenarios

Per-scan cost = `fs.readFile` (whole file) + `split('\n')` + `JSON.parse` per line (+ `verifyOddsRecord` hash per line for odds). Anchors: **[measured]** ~1.5 KB/snapshot, ~1 KB/validation, ~0.5 KB/odds; at ~750 snapshot lines (1.1 MB) a capture fixture ≈ 199 ms (3 evidence + M odds scans + writes). One evidence scan at that size ≈ tens of ms. Estimates below scale linearly per-scan and multiply by the per-fixture scan count at a ceiling of F=150.

| Archive depth (snapshots) | Approx file size | **[est]** one full scan | **[est]** peak transient memory / scan | **[est]** lock-hold for F=150 capture run | Route-budget (≤45 s) risk | GC pressure |
|---|---|---|---|---|---|---|
| **10 k** | ~15 MB | ~50–120 ms | ~40–120 MB (string + parsed array) | 150 × (3+M) scans × ~80 ms ≈ **80–150 s** ⚠ | **exceeds** budget at F=150 | high (≈1 000 full-file allocs/run) |
| **100 k** | ~150 MB | ~0.6–1.5 s | ~400–600 MB | ≫ budget (minutes) | **infeasible in-request** | severe |
| **1 M** | ~1.5 GB | **read THROWS** (string > 512 MB wall) | allocation failure | **run fail-closed** (strict read → error) | **impossible** (hard wall) | n/a — throws |
| **5 M** | ~7.5 GB | **read THROWS** | — | **run fail-closed** | **impossible** | n/a |

**Three findings that dominate the scale story:**

- **The ceiling bounds F, not A.** Even at F=150 the per-fixture consumer cost is O(A), so a *deep* archive blows the budget at a *small* fixture count. The M9 numbers (99.6 s already at cum-750 / ~1 MB) show the wall is near: **an accumulated archive of even ~10 k lines makes an F=150 capture run exceed 45 s** on the file adapter. This is the decisive scalability constraint.
- **Hard string wall at ~350 k snapshots / ~512 k validations / ~1 M odds** (record-size dependent). Beyond it, `fs.readFile(utf8)` throws `Cannot create a string longer than 0x1fffffe8 characters`; the strict reader surfaces it (fail-closed — *safe*, no false data), but the pipeline **stops** until the store is migrated or partitioned. So "1 M / 5 M records" are not "slow", they are **outside the file adapter's operating envelope**.
- **Odds hash-verification tax.** The odds `readAll` re-hashes every record, so capture's odds-side scans cost more per line than evidence scans — capture is the steeper curve at every depth (matches the measured 199 vs 97 ms).

**Consequence for Stage 2:** the file adapter is viable only in a **bounded-depth** regime (retention/partitioning keep A small) **and** with a single archive read per run. Postgres (indexed O(log A) lookups) is the documented escape hatch and is out of M10 scope — but Stage 2 must define the depth ceiling and warn threshold now (§12), not discover the wall in production.

---

## 6. Lock-Hold Analysis

INV-L requires discovery + classification + archive-derived progress + ordering + selection + processing **all inside** the durable lock (`job:evidence_capture` / `job:prediction_settlement`, bound to `EVIDENCE_DATABASE_URL`, fail-closed). So lock-hold ≈ whole-job wall-clock. Cost of each phase *under the lock*:

| Phase under lock | Cost | Reducible before lock? |
|---|---|---|
| **archive-state scan** | O(A) (must be one bounded read) or O(D·A) naïve | **No** — INV-A: progress must be read from the archive *under the lock* so it is consistent with the writes this run makes. A pre-lock read could be stale/divergent between overlapping workers. Keep inside. |
| **source fetch (M4)** | network-bound, ≤3 rounds × concurrency 2 | **No** for authoritative admission (must reflect the same run’s decisions). The *inexpensive daily-list read* that yields `PublishedDailyPrediction[]` could technically precede the lock, but it feeds discovery which must be lock-consistent → keep inside. |
| **M5 derivation** | O(F·M) CPU | No — depends on the fetched/admitted basis discovered under lock. |
| **archive writes (M6/M8 incl. mandatory odds)** | O(F·A) — the amplifier | No — the whole point of the lock (single writer). |
| **diagnostics build/serialize** | O(1) bounded counters | Partially — emission is cheap; keep inside but make best-effort (never fail the job). |

**What may safely precede the lock (INV-L-compatible):** only the **cheap, side-effect-free gates** the spec already permits — `evaluateCronAccess` (cron auth), rate-limit, and the `isCaptureEnabled`/`isSettlementEnabled` flag check (`runner.ts:288,325`). These read no archive and touch no store; a denied/disabled fire short-circuits to `skipped`/409 **without acquiring the lock**. **Do not** move discovery, the archive-state scan, fetch admission, or ordering before the lock — the spec forbids it and it would reintroduce the TOCTOU/starvation-drift hazards (spec §7.1). *Assume only cheap auth/flag checks pre-lock unless the spec is later amended.*

**Lock-hold budget implication.** Because lock-hold ≈ job wall-clock and the job must fit ≤45 s (INV-D), the single largest reducible cost under the lock is the **archive-state scan and the consumer per-fixture scans** — both attacked by PB-1 (read once) and by bounded depth. Lock acquisition itself is bounded (≤1 s PG try-window; a second fire 409s, never blocks — `locks.ts`).

---

## 7. Capacity and Cadence Model

`capacity/hour = runs/hour × effective ceiling × successful-completion-rate`.

| Path | Cadence (recommended) | runs/hr | Ceiling (default) | Success rate [est] | **Capacity/hr** |
|---|---|---|---|---|---|
| Capture | every 10–15 min | 4–6 | 100 | ~0.95 | **~380–570 captures/hr** |
| Settlement | every 15–20 min (lagged/staggered) | 3–4 | 100 | ~0.97 | **~290–390 settlements/hr** |

**Plausible arrival rate.** Daily-list selection is tens–low-hundreds of fixtures/**day** (spec §9.2); capture demand concentrates in the pre-kickoff windows (`capturedAt = kickoff − lead`), settlement after completion. Even a bursty ~50–100 fixtures clustered in one hour sits **well under** the ~380–570/hr capture capacity. **Capacity ≫ arrival by ~4–10×** at the default ceiling and recommended cadence.

**INV-S capacity activation gate (binding).** Sustained safety requires, per path:
```
cadence(runs/hr) × effectiveCeiling × successRate  ≥  sustained arrival rate
```
Activation MUST fail/alert-and-block if the measured or estimated sustained arrival exceeds this. With the numbers above the gate passes comfortably; it only binds if (a) cadence is set sparser than the capture window width (risking `expired_window`), (b) the daily list balloons, or (c) the ceiling is forced below 100 to fit a deep archive. The gate must be checked against the §10-mandated `backlog_size` and `oldest_pending_candidate_age` metrics, not assumed.

**Window-coverage sub-constraint (capture only).** Independent of throughput: cadence must be **finer than the capture-window width** so every window is hit before kickoff, else fixtures expire (`expired_window`) despite spare capacity. With `lead = 60 min`, a 10–15 min cadence gives 4–6 chances per window — safe. This is a scheduling (operational) recommendation, not an in-repo change.

---

## 8. Anti-Starvation Analysis

Can *full scan + deterministic sort + capped selection + no cursor + archive-derived rediscovery* starve recent or old work under sustained backlog?

- **Ordering verified.** `compareCaptureCandidates` = `capturedAt` asc then `fixtureId` asc; `compareSettlementCandidates` = `completionInstant` asc then `fixtureId` asc (`ordering.ts:23-39`). Total over post-dedup inputs (fixtureId unique) → **output order independent of input/scan/batch order** (impl-review §12, shuffle tests). Earliest-opening window is served first — the fixture closest to expiring is highest priority.
- **No starvation of *old* work.** Because selection is `slice(0, ceiling)` of the **ascending** order, the *oldest* eligible candidates are always at the head and selected first; deferred overflow is the *newest*. A backlog therefore drains oldest-first — the opposite of starvation for old work. Consumed fixtures leave the eligible set (`already_captured`/`already_settled` via archive-derived Sets), so the set **monotonically drains** and re-discovery re-derives the exact remainder (INV-A). No cursor → nothing to lose or skip.
- **Can *recent* work starve?** Only if sustained arrival > capacity for long enough that new items never reach the head before their window expires. That is exactly the **capacity gate** (§7) plus **`expired_window`** accounting — a metered, bounded outcome, not silent loss. For capture specifically, a permanently over-capacity backlog means the newest windows expire (`expired_window`, counted) while old ones drain; the gate is the required control.
- **Deterministic re-discovery cannot “advance” past unprocessed work.** Consumed-ness is defined solely by archive presence; there is no advancement step that could mark a candidate done without processing it (spec §7.4, verified — no cursor in `candidates/` or elsewhere).

**Required backlog metrics (must exist for the gate to be enforceable):** `backlog_size` and `oldest_pending_candidate_age` — both already computed by the Stage-1 providers (`capture-provider.ts:187-191`, `settlement-provider.ts:150-154`) as `deferred.length` and `oldestAge(...)`. Stage 2 must **surface** them (low-cardinality, §11) and wire the capacity/`expired_window` alert. **No starvation defect exists in the algorithm; starvation is possible only via metered `expired_window` under a capacity breach the gate must block.**

---

## 9. Deadline Sub-Budget

Route budget = 60 s (`maxDuration = 60`). INV-D effective job deadline = `min(configured, ROUTE_BUDGET − HEADROOM)` with initial target **≤ 45 s** (spec §7.3). The 300 s `runDeadlineMs` (`config.ts:153`) **must be clamped, never honoured** on this path. Proposed conservative sub-budgets within the 45 s (the remaining 15 s of the 60 s route is reserved headroom for cold-start, GC, and response flush):

| Phase | Budget | Basis |
|---|---|---|
| lock acquisition | **1.0 s** | PG `pg_try_advisory_lock` ≤1 s try-window (`locks.ts`); 409 on contention, never blocks |
| archive-state read (single bounded/streamed scan) | **8 s** | one O(A) read of snapshots+validations(+odds for partial pairs); bounded by the depth ceiling (§12); PB-1 |
| source fetch (M4, live) | **15 s** | network-bound, concurrency 2, ≤3 retry rounds; TTL `skip_fresh` avoids most; the largest variable term |
| normalization / indexing (pure) | **2 s** | O(D·M) grouping + Set reduction |
| provider derivation (M5, pure CPU) | **3 s** | O(F·M) at F≤150, M≤4 |
| processing / archive writes (M6/M8 incl. mandatory odds) | **13 s** | O(F·(scans+writes)); the amplifier; bounded by F≤150 **and** the depth ceiling |
| diagnostics + response serialization | **1 s** | bounded counters (§11); best-effort |
| **Sum (must fit effective deadline)** | **≤ 43 s** | leaves ~2 s slack inside 45 s; ~17 s inside 60 s route |
| route headroom (reserved) | **15 s** | cold start, GC pauses, event-loop tail, TLS/flush |

**Fail-closed remaining-time guard (binding, INV-D).** Before starting each candidate's fetch/derive/write, Stage 2 MUST check `remaining = deadline − elapsed` against a conservative worst-case per-candidate cost; if insufficient, **stop and defer** the rest (counted `candidates_deferred_by_deadline`), never start work it cannot finish. Deferring is safe/deterministic (INV-A/INV-S). The **fetch** and **processing** rows are the two that most need this guard because both are variable (network / accumulated A). These sub-budgets are the *target*; Gate B5 (§12) must confirm them against representative depth and, if it can’t, the ceiling or depth must drop until it does.

---

## 10. Recommended Data Structures

For the normalized archive state Stage 2 must build (consumed by the Stage-1 classifiers), without changing the archive format:

| State | Structure | Why | Build cost |
|---|---|---|---|
| `capturedWindowKeys` | **`Set<string>`** keyed `"<fixtureId>|<capturedAt>"` (frozen shape, `mandatory-odds.ts:51`) | O(1) `has` in classifier (`eligibility.ts:84`); membership-only | one snapshot scan → reduce |
| `partialWindowKeys` | **`Set<string>`** (snapshot window keys whose mandatory odds are incomplete) | drives C5 heal re-emit; O(1) `has` (`eligibility.ts:87`) | needs snapshots **and** odds — join two scans (hash-heavy odds side) |
| `capturedFixtureIds` | **`Set<number>`** | O(1) settlement gate (`eligibility.ts:176`) | reuse the snapshot scan |
| `settledFixtureIds` | **`Set<number>`** (fixtures with a terminal validation) | O(1) already-settled gate (`eligibility.ts:179`) | one validation scan → reduce |
| source rows → fixtures | **`Map<number, Group>`** (already) | O(1) grouping/dedup; per-market `Set<string>` | `capture-provider.ts:94` |
| eligible → selection | **sorted array** + `slice` (already) | O(E log E) once; deterministic comparator; no per-item scan | `ordering.ts` |
| **archive reader** | **streaming index** (`readline`/async-iterator over the file), reduce line-by-line into the Sets above | avoids materializing the whole file as one string (the 512 MB wall, §5); bounds peak memory to O(distinct keys) not O(A); parse-once | replaces `fs.readFile(utf8)` for the *state build* only — a Stage-2 read path, **not** an archive-format change |

**Trade-offs.** `Set`/`Map` give O(1) membership at O(distinct-keys) memory — ideal for the classifier's hot path. A **sorted array** for the eligible set is correct (deterministic order + `slice` cap) and cheaper than a heap at E≤ a few hundred. The **streaming index** is the one non-trivial recommendation: it is the difference between an O(A)-memory transient string (which hits the 512 MB wall and drives severe GC) and an O(distinct-keys) reducer that scales far further on the same NDJSON format. **Build each Set once per run (PB-1); never per fixture.** None of these changes the on-disk format, identity, ordering, or hashes.

---

## 11. Safe and Unsafe Optimizations

**Safe (preserve semantics — determinism, append-only, idempotency, replay, frozen hashes, ordering):**
- **Read each store at most once per run** and classify in memory (PB-1; spec §7.2). Collapses O(D·A) → O(A + D log D).
- **Build the state indexes once**, before the classify/derive loop; reuse across all fixtures.
- **Parse once** — reduce NDJSON line-by-line into Sets; do not re-`JSON.parse` per fixture.
- **Bounded candidate arrays** — Stage-1 already caps at ≤150 (`limits.ts`); never assemble an unbounded array.
- **Preallocate/`Set`-reuse** where practical (single `Map<fixtureId,Group>`, single dedup `Set`).
- **Deterministic comparator** — keep the total `(capturedAt|completionInstant, fixtureId)` order (`ordering.ts`); it is order-independent and replay-stable.
- **Avoid deep copies** — pass `row`/`modelInput` by reference into candidates (Stage-1 already does; no structuredClone).
- **Aggregate counters during the scan** — accumulate `discovered/eligible/rejected/deferred` inline (Stage-1 pattern) rather than a second pass.
- **Stream the read** (readline) to dodge the 512 MB string wall and cut GC churn.
- **TTL `skip_fresh`** (M4 already) to avoid redundant provider fetches within TTL.

**Unsafe (forbidden — break an invariant or a safety property):**
- **Persistent cursor / filesystem offset / request-supplied cursor** — violates INV-A; adds a divergent failure surface; forbidden (spec §7.5).
- **Skipping strict validation** (e.g. treating a read error or malformed line as empty history) — risks a duplicate mint / false progress; the strict reader must stay fail-loud (`file.ts:106-124`).
- **Reading the archive outside the lock** — violates INV-L; TOCTOU/starvation drift between overlapping workers.
- **Sampling / partial scans** for progress — would under-count `already_captured`/`already_settled` → duplicate work or missed settlements.
- **Non-deterministic parallel processing** of candidates that reorders identity/sequence — `snapshotId` binds `sequence = latest+1`; concurrent unordered mints could diverge sequences. Keep the single-writer, ordered batch.
- **Silently truncating discovery** at the cap — overflow must be **deferred + counted** (`candidates_deferred_by_cap`), never dropped (INV-C).
- **Process-local cache as authority** — a cached archive-state Set reused across runs would go stale and diverge across workers/restarts; the archive is the sole authority (INV-A). Ephemeral within-run reuse only.

**Cardinality (observability) constraints.** Extend `evidence_job_outcome_total{job,outcome}` (`runner.ts:271`) with the §10-spec producer counters (`source_rows_discovered/malformed`, `candidates_eligible/rejected-by-reason/selected/deferred_by_cap/deferred_by_deadline/processed`, `backlog_size`, `oldest_pending_candidate_age`). **No `fixtureId`/`matchId`/`captureId`/`validationId`/payload id as a label** — aggregate counts only; per-entity detail → structured logs. Diagnostics payload stays bounded (fixed-key counters); a diagnostics failure must never fail the job.

---

## 12. Mandatory Benchmarks (Gate B5 acceptance)

Stage 2 is **not accepted** until these are recorded. Each runs the **whole route path** (producer inside lock → M6/M8 batch) against a seeded archive, with a **stubbed/deterministic** M4 fetcher (so provider latency is modelled, not real-network flaky), capture and settlement **separately**.

| # | Case | Setup | Acceptance threshold |
|---|---|---|---|
| B5-a | **empty archive** | 0 records, 0 eligible | ≈ M9 baseline (~ms); `succeeded` zero-count |
| B5-b | **10 k depth** | 10 k accumulated records, F at ceiling | whole route **< 45 s** effective (< 60 s route); record per-fixture ms |
| B5-c | **100 k depth** | 100 k records | **document** it exceeds budget → establishes the file-adapter operating ceiling / warn threshold |
| B5-d | **1 M depth** | 1 M records | **document** the `fs.readFile` string-wall failure mode → confirms fail-closed, not false data |
| B5-e | **150 selected candidates** | exactly the ceiling eligible | confirm ≤150 enforced; whole route < 45 s at the chosen depth ceiling |
| B5-f | **backlog > cap** | eligible ≫ 150 | overflow **deferred + counted** (`_by_cap`), `backlog_size`/`oldest_pending_age` correct; deterministic drain on re-fire |
| B5-g | **malformed final line** | torn last NDJSON line | strict read surfaces the error (fail-closed); fixture deferred; **no duplicate mint**; measured cost of the failed read |
| B5-h | **capture vs settlement separately** | each path at its ceiling | both < 45 s at the depth ceiling; capture confirmed as the steeper curve |

**Must be measured for each case (record in the closure):**
- **total wall time** (whole route) and **lock-hold duration** (≈ job time; already timed by `refresh_job_duration_ms`);
- **archive-read time** (state build + consumer scans) as a distinct line;
- **provider (M4 fetch) time** (stubbed latency model);
- **processing (M6/M8) time**;
- **peak RSS** (`process.memoryUsage().rss` sampled) — to locate the string-wall / GC cliff;
- **event-loop delay** (`perf_hooks.monitorEventLoopDelay`) — the single-fork user-latency risk;
- **oldest backlog age** at end of run.

**Threshold rule (INV-D):** the effective deadline + ceiling + **representative accumulated depth** combination is accepted only if B5-b/e/h show the whole route inside 45 s with the remaining-time guard never tripping under normal depth. If not, **lower the ceiling or cap the depth** (retention) until it passes — do not raise the deadline toward 60 s.

---

## 13. Performance Blocking Conditions

Binding for Stage 2 (each is a build-or-prove obligation; none is a Stage-1 defect; none needs a frozen-contract change):

- **PB-1 — Single bounded archive read per run.** Build `capturedWindowKeys`/`partialWindowKeys`/`capturedFixtureIds`/`settledFixtureIds` from **one** whole-archive read (per store), reduced to Sets — **never** a per-discovered-fixture loop over the per-fixture store API (which is O(D·A) ≈ O(F²)). The store interface has no whole-archive reader today, so Stage 2 must add a bounded/streamed read path. **Blocking**: without it, Stage 2 re-creates the amplification the ceiling was meant to bound.
- **PB-2 — Representative-depth benchmark (Gate B5) before activation.** Prove the whole route at the ceiling stays < 45 s against a representative accumulated depth, and **document** the depth at which it exceeds budget (the file-adapter operating ceiling) plus a warn threshold (~50 k lines / ~10 MB). **Blocking** for closure.
- **PB-3 — INV-D deadline clamp + remaining-time guard.** Clamp the effective job deadline to ≤45 s (never the 300 s `runDeadlineMs`) and defer (fail-closed, counted) before starting any candidate that cannot finish in the remaining budget. **Blocking**.
- **PB-4 — Depth safety vs the 512 MB string wall.** Either stream the read (§10) or enforce a hard archive-depth operating ceiling (via retention/partition) that keeps every scanned file well under ~512 MB, so the reader never hits `MAX_STRING_LENGTH`. Emit the archive-size warning. **Blocking** for any deployment expected to accumulate beyond a bounded window.

**Non-blocking carry-forwards (from M9, restated):** H-1 unlock-500 (land the swallow/log); H-2 capture ceiling ≤100–150 (Stage-1 enforces via `limits.ts` — verify wired in Stage 2); H-3 symmetric settlement ceiling (Stage-1 enforces — verify wired). Stagger capture/settlement cadence to avoid 409 churn (distinct locks already prevent corruption).

---

## 14. Final Readiness Verdict

### PERFORMANCE CONDITIONALLY READY FOR STAGE 2

The Stage-1 candidate provider is performance-clean: pure, O(D log D), bounded to ≤150, deterministic, order-independent, archive-read-free, and it already computes the backlog/oldest-age signals the anti-starvation gate needs. It adds **no** new bottleneck. The whole of Stage 2's performance and scalability rides on the **archive-state build and the frozen O(F·A) consumer scans on the NDJSON file adapter** — and on the fact that the ceiling bounds **F but not A**. At the expected tens–low-hundreds-of-fixtures/day load, with the four conditions bound, a single route fire provably stays inside the 60 s budget; capacity (~380–570 captures/hr) exceeds arrival by ~4–10×; and no algorithmic starvation exists (only metered `expired_window` under a capacity breach the gate must block).

Stage 2 wiring may proceed **conditional on PB-1…PB-4**: build the archive state with a single bounded/streamed read (PB-1/PB-4), clamp the deadline with a remaining-time guard (PB-3), and record the representative-depth Gate B5 benchmark before activation (PB-2). The file adapter is viable only in a **bounded-depth** regime — the O(A) per-scan cost and the 512 MB `fs.readFile` string wall make deep archives (≳100 k lines) infeasible in-request and ≳350 k lines unreadable; Postgres (indexed O(log A)) is the documented, out-of-M10 escape hatch, and Stage 2 must bake in no assumption that blocks that reversible cutover. No frozen contract, identity, hash, ordering, or replay semantic is affected by anything recommended here.

**Main bottlenecks:** (1) O(F·A) frozen consumer scans on the NDJSON file adapter, capture steepest (odds hash-verify tax); (2) the archive-state build if done per-fixture (PB-1); (3) M4 live-fetch network wall-clock at concurrency 2; (4) the 512 MB `fs.readFile` string wall at deep archives.

**Proposed deadline sub-budget (≤45 s effective, 15 s route headroom):** lock 1 s · archive read 8 s · source fetch 15 s · normalize/index 2 s · derivation 3 s · processing/writes 13 s · diagnostics/serialize 1 s (= ≤43 s), with a fail-closed remaining-time guard before each candidate.

**Recommended default ceilings:** capture 100 (hard cap 150), settlement 100 (hard cap 150) — as `limits.ts` already enforces; verify Stage 2 wires them and never the 500 default. Depth warn threshold ~50 k lines / ~10 MB per file; operating ceiling below the string wall.

**Benchmark requirements:** Gate B5 cases empty/10 k/100 k/1 M/150-selected/backlog>cap/malformed-final-line, capture & settlement separately, measuring total time, archive-read time, provider time, processing time, peak RSS, event-loop delay, lock-hold, and oldest backlog age — with the < 45 s acceptance rule at representative depth.

**Blocking performance conditions:** PB-1 (single bounded read), PB-2 (B5 benchmark), PB-3 (deadline clamp + guard), PB-4 (streaming/depth vs 512 MB wall).

**Confirmation:** the **only** file created by this review is `docs/plans/m10-stage-2-performance-scalability-review.md`. No runtime code, tests, contracts, feature flags, cron routes, runners, schedules, environment, database, archive, configuration, or existing document was modified; no benchmark of modified code was run.

---

## 15. Stage 2 File Recommendations (instrumentation & benchmark helpers — not implemented here)

Where the future work should live (recommendation only; nothing created):

- **Archive-state builder (PB-1):** a new Stage-2 orchestration module, e.g. `lib/evidence-capture/candidates/archive-state.ts` (or `.../orchestration/`), exposing a bounded/streamed reader that reduces the NDJSON stores into the four `Set`s. It reads through the `EvidenceArchiveStore`/`OddsArchiveStore` **interfaces** (adapter-neutral) — if a whole-archive read must be added, add it to the store interface + file adapter as a **new read method** (never a format change), so Postgres can later implement it as an indexed query.
- **Timing instrumentation:** reuse the existing `metrics.timing(...)` surface (`lib/observability/metrics.ts`) for `archive_read_ms`, `provider_fetch_ms`, `processing_ms`, and the producer counters — bounded labels only. Lock-hold is already captured by `refresh_job_duration_ms` (`runner.ts:109`).
- **Event-loop / RSS instrumentation:** a small ops helper (e.g. `lib/observability/eventLoop.ts`) wrapping `perf_hooks.monitorEventLoopDelay` and `process.memoryUsage()`, sampled around the batch — used by the benchmark and optionally by diagnostics; must be best-effort and never fail the job.
- **Benchmark harness (Gate B5):** a **non-runtime** benchmark under `tests/` (e.g. `tests/m10Stage2Benchmark.test.ts`, node:test, seeded temp archive) or `scripts/` (e.g. `scripts/m10-pipeline-bench.mjs`) — kept out of the production bundle (as the M9 perf probe was, then deleted). It seeds archives at the B5 depths, injects a deterministic stub fetcher, and records the §12 metrics.
- **Do not** place benchmark or instrumentation-only code inside the frozen M6/M8 batch or the pure Stage-1 provider; keep it in the orchestration/observability layers so the pure/frozen surfaces stay untouched.
