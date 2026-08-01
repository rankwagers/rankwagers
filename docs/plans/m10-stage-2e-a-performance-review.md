# M10 Stage 2E-A — Activation Design — Performance & Benchmark-Contract Review

**Document type:** Independent performance & benchmark-contract review (review-only). No runtime code, test, route, flag, config, reader, cron, or deployment was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Performance & Benchmark-Contract Reviewer, Sprint 23B / M10 Stage 2E-A.
**Under review:** `docs/plans/m10-stage-2e-a-activation-design-plan.md` (design-only; no code).
**Inputs read:** the 2E-A plan; `m10-stage-2d-closure.md`; the 2B/2C/2D performance reviews.
**Code inspected this pass:** `lib/footystats/dailyArchive.ts`; `lib/evidence-capture/candidates/{completed-rows,operational,capture-pipeline,settlement-pipeline}.ts`; `lib/evidence-capture/candidates/archive-state/{builders,normalize}.ts`; `lib/archive/evidence/{file,service,store}.ts`; `lib/jobs/runner.ts`; `lib/observability/metrics.ts`; `lib/evidence-capture/config.ts`.
**Method:** direct `file:line` verification + one **bounded source-load sanity probe** (design-review only — **NOT** the Stage-2E-B benchmark; no 2E-B results fabricated), run over synthetic temp data (deleted; no repo fixture). Numbers: **[measured-2E-A]** (this pass), **[measured-2B/2C/2D]** (prior), **[derived]**.

**VERDICT: CONDITIONALLY PASSED** — the design avoids obvious regressions and contains **no known unbounded production path**; it can produce trustworthy performance evidence via a near-complete 2E-B contract. Conditions: the plan's own route-start deadline anchor (a **verified** current gap where discovery escapes the budget) must ship before any write mode, and five benchmark-contract refinements (§Required 2E-B gates). Blocker count: **0**.

---

## 1. Verification of the plan's performance claims (against code)

| Plan claim | Verified? | Evidence |
|---|---|---|
| Discovery = **single bounded read/store** (PB-1), under lock | ✅ | `capture-pipeline.ts:122-125`, `settlement-pipeline.ts:107-110` → `builders.ts:41-45,56-60` (`Promise.all` of one read each) |
| `readDailyArchive` is **fail-open** → strict reader (Gate C) required | ✅ | `dailyArchive.ts:71-79` (`catch → null`); **[measured-2E-A]** malformed doc → `JSON.parse` **throws**, currently swallowed to `null` |
| Source is one bounded JSON file/date, **single parse**, O(D) | ✅ | `dailyArchive.ts:74-75`; **[measured-2E-A]** 1.62 MB / 4000 rows → readParse 27 ms |
| Four tabs overlap → **dedup by matchId** needed | ✅ | `dailyArchive.ts:17-20` (fh/over15/over25/sh separate `ArchivedRow[]`); plan §9 dedups in the adapter |
| **Budget gap:** discovery currently **not charged** to the deadline | ✅ **(critical)** | `runner.ts:381` (`await provideCandidateBatch()` = discovery) precedes `runner.ts:399` (`producerDeadlineBudget` anchors `startedAtMs=now()`) → the 45 s clock starts **after** source-load+discovery |
| **No metrics-only archive scan** | ✅ | `operational.ts:310-311,354-356` read `d.backlogSize`/`d.oldestPendingAgeMs` (in-memory diagnostics); no `readAll`/`readNdjson`/`readFile` in metrics/flatten/emit |
| **No Postgres evidence adapter** exists (file-only) | ✅ | `service.ts:35` branches `EVIDENCE_ARCHIVE_ADAPTER==="memory"` else file; no `postgres` branch |
| Frozen M6/M8 per-fixture scans unchanged (dominant O(F·A)) | ✅ | plan touches no M6/M8; `runner.ts` batch path unchanged; §30 boundary |

---

## 2. Audit

### 2.1 Source loading
- **File size / parse:** one `readFile` + one `JSON.parse` per run (`dailyArchive.ts:74-75`). **[measured-2E-A]** 0.40 MB/1000-row day → readParse 7 ms; 1.62 MB/4000-row day → 27 ms. **Bounded, single parse, no repeated parse.**
- **Date partitions:** one file per UTC date; run date derived from the injected instant (plan §9). No multi-partition scan.
- **Duplicate arrays across fh/over15/over25/sh:** a fixture appears in ≤4 tabs → the plan dedups by `matchId` in the adapter (§9). **[measured-2E-A]** flatten+dedup of 4000 rows → 1–2 ms; `filterCompletedRows` → 3–6 ms. Negligible.
- **Malformed-row-heavy:** per-row isolation (`filterCompletedRows` drop+count, `completed-rows.ts:62-123`) — O(D), never throws; a malformed **document** throws in `JSON.parse` → the strict reader must surface it (Gate C).
- **Maximum bounded scope:** O(D), D = day's terminal set (tens–low-hundreds; worst-case low-thousands across tabs). **No archive scan in source-load.** ✓

### 2.2 Discovery / archive cost
- **Full archive reads per run:** capture = 2 (snapshots + odds); settlement = 2 (snapshots + validations) — one bounded read each, concurrent, once/run (verified §1). **No per-fixture rescan** in discovery (the per-fixture reads live only in frozen M6/M8).
- **File adapter scaling:** each read = whole-file `readFile`+`split`+`JSON.parse`; **[measured-2C]** ~4.8 s/100 k snapshots, GB-scale RSS; **hard `MAX_STRING_LENGTH` wall** ~357 k snapshots / ~524 k validations (unreadable → fail-closed). Odds read additionally hash-verifies per line.
- **Postgres scaling:** **not benchmarkable — no PG evidence adapter is built** (§1). Correctly out of scope; the file adapter is the only production adapter.
- **Capture vs settlement amplification (frozen, dominant):** capture M6 = `F·(3+M)` scans/run; settlement M8 = `F·(2+2T)` scans/run — both **O(F·A)**, capture steeper (odds hash tax). Bounded by ceiling F, **unbounded in depth A**. Inherited; plan gates it (R-6, §25, Gate E/F).

### 2.3 Route budget
- **Clock start (gap):** `handleCronPost` records `started` but the **producer deadline** anchors `startedAtMs` **after** discovery (`runner.ts:399`), so **source-load + discovery escape the ≤45 s budget today.** The plan §12 identifies this and requires a **route-start anchor + pre-batch remaining-time check** — a real, verified, correctly-specified fix (Slice-2, Gate E).
- **Phase reserves (plan §12, illustrative, 2E-B-tuned):** source-read ≤8 s, discovery ≤5 s, batch ≤30 s, cleanup/serialize in the 15 s reserve. **[measured-2E-A]** source-read is ~tens of ms (≪ 8 s); the real consumers are discovery (seconds at depth) + batch (O(F·A)).
- **Lock-hold:** ≈ whole locked body (discovery + batch), so lock-hold ≈ route wall-time; the ≤45 s anchor bounds it. Distinct keys → capture/settlement never contend.
- **Worst-case response timing:** with the route-start anchor + pre-batch defer + between-candidate guard, the run defers rather than overruns → bounded < 60 s. **Without** the anchor, a deep-archive discovery (e.g. 10–20 s) + a fresh 45 s batch clock could exceed 60 s → the anchor is a **binding pre-activation requirement**.

### 2.4 Benchmark matrix (contract §25) — assessment
Covered well: depth (small/medium/current/high-water), source size (normal/high/malformed/duplicate), candidate volume (0/1/10/50/100/150/over), all 6 modes, phase-separated timings (source-load / source-parse / archive-read / discovery / provider / candidate-loop / append / total / lock-hold / cleanup), resource metrics, p50/p95/p99/worst, sample count, machine spec, fixture descriptions, reproducible commands, raw-artifact location, tuning recs, go/no-go. **Gaps (refinements, §Required gates):** (i) no **cold- vs warm-cache** distinction (production first-read of a 100+ MB NDJSON off cold disk ≫ warm); (ii) no **concurrent capture+settlement** event-loop-contention case (both on the single fork); (iii) the **string-wall high-water** (~357 k/~524 k) is not pinned as an explicit hard go/no-go; (iv) **file-only adapter** not stated (PG unbuilt); (v) scheduler-interval derivation needs an **arrival-rate** input the benchmark alone cannot produce.

### 2.5 Resource metrics
Contract §25 lists RSS/heap/event-loop-delay/CPU/bytes-parsed/files-opened/archive-reads/lock-hold/write-counts/duplicate-avoidance. **Complete** for the file adapter. Add: **peak string-allocation size** (proximity to the 512 MB wall) and **GC pause time** (heavy at deep archive), which the 2B/2C reviews showed dominate memory behaviour.

### 2.6 Canary
- **First-N skew:** canary = first-N under the provider's total order (`capturedAt`/`completionInstant` asc). **Performance-wise it generalizes** — per-candidate cost is ≈ uniform (dominated by the same O(A) archive scans for all candidates), so cost ≈ N × per-candidate regardless of *which* N. **Coverage-wise it is skewed** — earliest-window/earliest-completion fixtures first (timezone/league bias). For a *performance* canary this is acceptable; for *correctness/coverage* the optional `EVIDENCE_CANARY_LEAGUE_ALLOWLIST` (partitioning) is preferable and should be recommended when coverage representativeness matters.
- **Generalization limit:** a ceiling-10 canary **does not** validate full-write per-run wall-time (that needs the full-ceiling benchmark) — canary proves correctness/idempotency/chain-integrity at low volume, **not** the ≤45 s full-write budget. The plan correctly separates these (canary = phase 2; full = phase 3 gated on 2E-B full).
- **Starvation:** INV-S oldest-first ordering drains old work first (deferred tail = newest), so no old-work starvation. A ceiling-10 canary under high arrival grows the deferred backlog — but canary is a bounded diagnostic window, not steady-state; real starvation is a **full-write capacity** concern (cadence × ceiling ≥ arrival) gated by `oldest_pending_age`/`backlog` metrics.

### 2.7 Scheduler interval
- The plan (§7.1, §25) treats cadence as **benchmark-derived** (a §25 tuning output). Correct direction. **Overlap margin:** interval should be ≥ p99 run duration + margin so same-path fires don't churn 409s (distinct-key capture+settlement may overlap safely). **Backpressure/backlog:** deadline-defer + archive-derived re-discovery is the backpressure; `backlog`/`oldest_pending_age` are the signals. **Gap:** interval derivation needs **both** p99 run-duration (2E-B) **and** arrival rate (dry-run/canary observation) — the benchmark supplies only the former; the plan should state the interval is fixed after canary arrival-rate is observed.

---

## 3. Required Questions (explicit answers)

**A. Is the 2E-B benchmark contract complete enough for a credible go/no-go?** **Mostly YES — conditionally.** §25 is comprehensive (depth × source × volume × mode × phase-separated timings × resource metrics × percentiles × reproducibility × go/no-go). It is credible after five refinements: cold-vs-warm cache, concurrent capture+settlement, the string-wall high-water as an explicit hard gate, an explicit file-only-adapter statement, and the scheduler-interval arrival-rate input. None is fatal.

**B. Does it distinguish source-load/discovery time from candidate-loop time?** **YES.** §25 lists `source-load, source-parse, archive-read, discovery, provider, candidate-loop, append, total-route, lock-hold, cleanup` as **separate** timings. This is the single most important contract property and it is present.

**C. Does it test current production depth AND projected high-water depth?** **YES, with a caveat.** §25 depth = small / medium / current-production-representative / projected high-water-mark. Caveat: "current-representative" and "high-water" are **not numerically pinned** — the high-water MUST be set at/above the string walls (~357 k snapshots / ~524 k validations) with a hard go/no-go, and "current" must be a stated line/byte count.

**D. Does it include both file and Postgres-relevant adapter behavior?** **PARTIAL — and correctly so.** Only the **file** adapter is built (`service.ts:35` → memory-or-file; no PG). The benchmark can and should cover the file adapter (the production adapter). Postgres is unbuilt and out of scope; the contract should **explicitly state file-only** and record PG as a **separate future adapter benchmark** (not a 2E-A/2E-B gap).

**E. Are reservePerCandidateMs, headroom, canary ceiling, full ceiling, route timeout, and scheduler interval all benchmark-derived?** **YES (named) — one input caveat.** §25 outputs explicitly list tuning recommendations for **all six** plus source-read/discovery budgets, and §25's binding gate ties FULL to validating `reservePerCandidateMs`(250/120)/headroom(15 s). Caveat: **scheduler interval** additionally needs an arrival-rate input (production/canary), not derivable from the benchmark alone — state this dependency.

**F. Does the plan prevent another full archive scan solely for metrics?** **YES — verified.** `backlog`/`oldest_pending_age` are read from the in-memory `CandidateDiagnostics` the provider already computed (`operational.ts:310-311,354-356`); no metrics/flatten/emit path performs an archive read. §18 reuses the existing metrics with no new scan.

**G. Is the source reader bounded enough for a 60-second route?** **YES — measured.** A 1.62 MB / 4000-row day reads+parses+dedups+filters in **~35 ms** (**[measured-2E-A]**); O(D), single parse. The strict wrapper (Gate C) adds no cost. Residual: a **hung** read is bounded only by the 60 s platform kill (RC-2) — read-only and safe; a deadline-bounded read wrapper is a recommended §L hardening, not a blocker.

---

## 4. Findings summary

**Likely dominant costs (ranked):**
1. **Frozen M6/M8 whole-archive per-fixture scans** — `F·(3+M)` / `F·(2+2T)`, O(F·A); bounded by ceiling, unbounded in depth. Inherited; gated E-1/E-2/F.
2. **Discovery archive-state reads** — 2 whole-archive reads, ~4–6 s/100 k, GB-scale RSS, ~357 k/~524 k string walls — **and currently uncharged to the deadline** (the §12 gap).
3. **Source-load** — ~tens of ms (**[measured-2E-A]**); negligible.
4. **Deadline/guard/diagnostics/metrics** — ≪ 1 ms/run (**[measured-2D]**); negligible.

**Missing measurements (must be added to 2E-B):** cold- vs warm-cache whole-archive read; concurrent capture+settlement event-loop delay; **end-to-end** route timing with the route-start anchor (source+discovery+batch+cleanup as one number); peak string-allocation size vs the 512 MB wall; GC pause time at deep archive; the string-wall high-water as an explicit go/no-go.

**Canary representativeness risks:** first-N is **performance-representative** (cost ≈ N × ~uniform per-candidate) but **coverage-skewed** (earliest-window bias) → prefer the league allowlist/partitioning when coverage matters; a ceiling-10 canary does **not** validate the full-write ≤45 s budget (needs the full-ceiling benchmark).

**Required Stage-2E-B gates (sharpened):**
- **G-1** Route-start deadline anchor + pre-batch remaining-time defer implemented and **benchmarked end-to-end** (source+discovery+batch+cleanup ≤ 60 s, effective ≤45 s). *(Closes the verified §12 gap; a hard pre-activation gate.)*
- **G-2** Ceiling-sized full-write run < effective ≤45 s at **current-representative AND high-water** depth; validate/retune `reservePerCandidateMs`(250/120)/headroom(15 s).
- **G-3** String-wall high-water pinned (~357 k snapshots / ~524 k validations) with a hard go/no-go + archive-size warn threshold.
- **G-4** Cold-cache and concurrent capture+settlement cases measured (event-loop delay, RSS, GC).
- **G-5** Scheduler interval fixed from p99 run-duration (2E-B) + observed arrival rate (dry-run/canary), with overlap margin.

---

## 5. Safety determinations

- **Implementation-safe before benchmark: YES.** Slices 1–2 (activation config/modes, strict `readDailyArchiveStrict`, route-start deadline anchor, settlement dry-run) are additive, default-OFF, and dry-run performs **zero durable writes** — buildable and unit/integration-testable without 2E-B. No frozen/schema/migration change. (Capture writes are additionally gated on the unbuilt M4→M5 derivation.)
- **Activation-safe before benchmark: NO.** Production CANARY requires 2E-B canary evidence and FULL_WRITE requires 2E-B full (E/F) per the plan's own go/no-go matrix (§27) and binding gate (§25). The route-start anchor (G-1) must also ship first. Dry-run (zero-write) is the only pre-benchmark production-observable step, and even it is gated on partial-E.

---

## 6. Verdict

### CONDITIONALLY PASSED

**Blocker count: 0.** The Stage-2E-A design avoids obvious performance regressions (additive, dormant, flags-OFF; single-bounded-read discovery preserved; no new metrics-path archive scan; frozen M6/M8 untouched), and it contains **no known unbounded production path** — source-load is O(D)/~tens-of-ms (measured), discovery is O(A) but bounded by the ≤45 s deadline once anchored at route-start, and the dominant O(F·A) batch cost is bounded by the ceiling and gated for depth. Critically, the design **itself identifies** the one real gap this review verified in code — that source-load + discovery currently escape the deadline (`runner.ts:399` anchors after `provideCandidateBatch`) — and specifies the correct fix (route-start anchor + pre-batch defer) as a binding Slice-2/Gate-E requirement.

**Benchmark-contract completeness:** near-complete and credible — it correctly separates source-load/discovery from candidate-loop time (Q-B), covers current and high-water depth (Q-C), names all six benchmark-derived knobs (Q-E), and prevents a metrics-only archive scan (Q-F). It is **conditional** on five refinements (cold-cache, concurrent-path, string-wall hard gate, explicit file-only-adapter statement, scheduler-interval arrival-rate input) and on numerically pinning "current" and "high-water" depth.

**Route-budget completeness:** complete **once G-1 lands** — the route-start anchor + pre-batch remaining-time check + between-candidate guard together guarantee source+discovery+batch+cleanup ≤ 60 s; today, without the anchor, discovery is uncharged (the verified gap). This is the single hardest pre-activation gate and the plan owns it.

The design is BLOCKED for **activation** only in the sense that FULL/canary await 2E-B evidence and G-1 — which is the plan's own intent. It is APPROVED to **implement** (default-off, dry-run zero-write) and to proceed to Stage-2E-B under the sharpened gates.

**Confirmation:** the only file created is `docs/plans/m10-stage-2e-a-performance-review.md`. **No runtime code, test, route, flag, config, or deployment was modified**; the source-load sanity probe ran against built code over a temporary scratch directory (deleted; no repo fixture; **not** the Stage-2E-B benchmark, whose results are not fabricated here).
