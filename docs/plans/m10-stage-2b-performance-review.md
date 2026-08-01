# M10 Stage 2B — Performance Review (Locked-Discovery Wiring)

**Document type:** Performance analysis (review-only). No runtime code, tests, contracts, feature flags, cron routes, runners, schedules, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance Reviewer, Sprint 23B / M10 Stage 2B.
**Under analysis:** the *planned* Stage 2B wiring — a `discover(...)` producer inserted inside the durable job lock that loads the source, derives archive-state, runs the Stage-1 provider (with M4 fetch + M5 derive behind `deriveCaptureInput`), and feeds the bounded candidate arrays into the frozen M6/M8 batches.
**Build state (verified this pass):** Stage 2B is **NOT built**. The Stage-1 provider (`lib/evidence-capture/candidates/*`) and the Stage-2A archive-state layer (`candidates/archive-state/*`) are built and dormant; the `readAll*` port is **unbacked** (grep: no concrete `readAllSnapshots`/`readAllValidations`/`readAllOddsRecords` implementation), the file adapter still exposes **only per-fixture reads** (`file.ts:233-247`), and the runner still passes `options?.candidates ?? []` (empty — `runner.ts:296,332`). This review therefore constrains the wiring before it is written.
**Governing:** `m10-live-candidate-pipeline-specification.md` (Rev A1), `m10-stage-2-locked-discovery-architecture-plan.md`, `m10-stage-2a-archive-normalization.md`, `m10-stage-2a-implementation-review.md`, `m10-stage-2-performance-scalability-review.md` (Stage-2 prep), and the M9 performance review (measured numbers).
**Method:** every `file:line` read this pass; numbers labelled **[measured]** (M9 scratch benchmark) or **[estimate]** (modelled from measured per-scan cost + current reader shape). No benchmark of modified code was run (forbidden); §12 of the Stage-2 prep review defines the Gate-B5 benchmarks Stage 2B must run.

**VERDICT: CONDITIONALLY READY** — one architectural contradiction must be resolved before wiring, and one frozen cost must be accepted/bounded. See §9.

---

## 0. Executive summary

Stage 2B adds a producer in front of the frozen consumers; it changes **no** frozen per-fixture cost. Its performance is decided by two things:

1. **Which archive-read strategy it wires.** The two governing artifacts **disagree**:
   - **Stage 2A built** `buildCaptureArchiveState` / `buildSettlementArchiveState` — a **single bounded read** (`Promise.all([readAllSnapshots(), readAllOddsRecords()])`, `builders.ts:41-45`) that reduces the whole archive **once** to Sets → **O(A) per run** (PB-1-compliant; the Stage-2A review §148-149 says the O(F²) "collapses to O(A)").
   - **The locked-discovery plan** (§13 budget map: "archive read: **O(F) per-fixture strict reads**"; §16 file plan: create a *new* `candidates/archive-state.ts` with `deriveCaptureArchiveState(evidenceStore, oddsStore, fixtureIds)`; §156: "single-bounded-read helper … is an optimization, **not required** for Stage 2") specifies a **per-fixture** derivation → **O(D·A) ≈ O(F²)**.

   **Finding PB2B-1 (blocking): Stage 2B MUST back the Stage-2A `readAll*` port with a concrete single-read reader and call `build{Capture,Settlement}ArchiveState`. It MUST NOT wire the §16 per-fixture `deriveCaptureArchiveState(...fixtureIds)` sketch** — doing so re-creates the exact amplification Stage 2A was built to remove, and orphans the built, reviewed layer.

2. **The frozen M6/M8 per-fixture scan cost, which Stage 2B cannot change.** Even with the single-bounded-read for *discovery*, the frozen consumer **processing** re-scans the whole archive **3 + M times per captured fixture** (capture) / **2 + 2·T times** (settlement). At F=100, M=4 that is ~**700 whole-file reads per capture run** — the dominant term. The cap (≤150) bounds F; **accumulated archive depth A is unbounded across days and is the real wall** (`fs.readFile` string limit ~512 MB → unreadable at ≈350 k snapshots).

Net: at the expected tens–low-hundreds-of-fixtures/day load **and a shallow archive**, Stage 2B fits the ≤45 s effective deadline and throughput is ample. It degrades to infeasible as A grows; the file adapter is a bounded-depth regime, Postgres the out-of-scope escape hatch.

---

## 1. Current repository evidence

| Fact | Anchor | Class |
|---|---|---|
| Stage 2B unbuilt: runner still empty-candidate | `lib/jobs/runner.ts:296,332` (`candidates ?? []`) | measured |
| `readAll*` port **unbacked** (no concrete reader anywhere) | grep `lib app` → 0 hits outside `candidates/archive-state/` | measured |
| Stage-2A builder = single bounded read, concurrent | `candidates/archive-state/builders.ts:41-45,56-60` | measured |
| Stage-2A normalizers = O(A) reduce to Sets/Maps, order-independent, fail-closed | `archive-state/normalize.ts:74-116,136-212` | measured |
| Locked-discovery plan: "archive read: **O(F) per-fixture** strict reads" | `m10-stage-2-locked-discovery-architecture-plan.md:239` | measured |
| Plan §16 creates per-fixture `deriveCaptureArchiveState(store, oddsStore, fixtureIds)` | plan §16 file table | measured |
| Plan §156: single-bounded-read is "an optimization, not required" | plan line 156 | measured |
| File adapter: per-fixture reads only; `readNdjson` reads whole file per call | `lib/archive/evidence/file.ts:76-127,233-247` | measured |
| `fs.readFile(utf8)` → one string; Node `MAX_STRING_LENGTH` ≈ 512 MB | `file.ts:79`; host `buffer.constants` | measured |
| Odds `readAll` re-runs `verifyOddsRecord` (hash) per line | `odds-archive/file.ts:87-116` | measured |
| M6 capture = 3 evidence scans + M hash-verified odds scans / fixture | `capture/capture.ts:92,110,141` + `mandatory-odds.ts:134` | measured |
| M8 settlement = 2 + 2·T scans / fixture | `settlement.ts:230,371` + `evidence/file.ts:201-204` | measured |
| Provider (`deriveCaptureInput`) called once per **selected** capture candidate | `capture-provider.ts:211-239` | measured |
| Healing candidates also invoke `deriveCaptureInput` (wasteful) | `capture-provider.ts:211` (loops `plan.selected` incl. `healing:true`) | measured |
| M4 concurrency cap = min(global 4, footystats 2) = **2** | `routing/orchestrator.ts:85-88`; `config.ts:146-147` | measured |
| M4 retry 3; `runDeadlineMs` 300 000 (must be clamped to ≤45 s) | `config.ts:152-153,241-244`; plan §13 | measured |
| TTLs: teamStats 6 h, leagueBaseline 24 h, matchDetail 5 m | `config.ts:148-150` | measured |
| M5 `deriveEvidenceModel` pure, O(M) map/filter | `model/derive.ts:293-372` | measured |
| **[measured]** capture ~60→199 ms/fixture (IO) rising with depth; settle ~83→97 ms | M9 perf review §6 | measured |
| Cap: default 100, hard 150, fail-safe | `candidates/limits.ts:10-27` | measured |

---

## 2. Capture throughput

**Definition.** `throughput/run = min(effectiveCeiling, deadlineBoundCount)`; `throughput/hour = runs/hr × throughput/run × successRate`.

**Per new-fixture cost under Stage 2B** = M4 fetch (network) + M5 derive (cheap CPU) + M6 processing (O(A) IO). The IO term is the M9-measured **[measured] ~60–199 ms/fixture** (rising with accumulated depth); the fetch term is **new in 2B** (M9 had no fetch) and is TTL-gated (near-zero when caches are fresh; hundreds of ms when cold).

| Regime | Per-fixture | Fixtures fitting ≤45 s (after ~1 s lock + ~2–8 s state read + fetch) | Throughput/run |
|---|---|---|---|
| shallow archive (< ~10 k lines), warm cache | ~60–120 ms | deadline not binding | **= ceiling (100)** |
| shallow archive, cold cache | ~120 ms + fetch (concurrency 2) | fetch wall-clock dominates | ceiling if fetch fits budget, else deadline-bound |
| deep archive (~100 k lines) | ~1–3 s (O(A) scans) | **≪ ceiling** | **deadline-bound (tens)** → `deferred_by_deadline` |
| ≥ ~350 k snapshots | read **throws** (512 MB wall) | 0 | **run fails closed** |

**Throughput/hour.** At ceiling 100, cadence ~6/hr, success ~0.95 → **~570 captures/hr** *when the deadline permits the full ceiling* (shallow archive). Because arrival is tens–low-hundreds/**day**, throughput is ample in the shallow regime. **The binding limiter is not the cap — it is per-fixture O(A) once the archive deepens**: throughput/run silently drops below the ceiling (metered `deferred_by_deadline`) as A grows. Capture is the steeper curve (odds hash-verify tax), so it degrades before settlement.

---

## 3. Archive read frequency

The decisive dimension. Count of **whole-file NDJSON reads per run** (each read = `fs.readFile` + `split` + `JSON.parse`/line; odds also hash-verify/line):

**Capture run (with the mandated Stage-2A single-bounded-read):**
| Phase | Whole-file reads | Cost |
|---|---|---|
| archive-state derivation | **2** (snapshots ∥ odds, concurrent `Promise.all`) — once per run, **even if 0 eligible** | O(A) + O(A_odds·hash) |
| M4 admission (per selected new fixture) | provider-archive read/write per fixture | O(A_prov) each |
| **M6 processing (frozen, per selected new fixture)** | **3 evidence + M odds** = (3+M) reads/fixture | O(3A + M·A_odds·hash) |
| **Total** | **≈ 2 + F·(3 + M)** | at F=100, M=4 → **~702 whole-file reads/run** |

**Settlement run:** `2 (state) + F·(2 + 2·T)` reads; at F=100, T≈M=4 → ~1002 reads/run (but no hash-verify tax; ~half the per-read cost).

**Findings:**
- **Discovery is now cheap and constant (2 reads), IF PB2B-1 is honoured.** With the per-fixture alternative it would be **D reads** for state alone — up to hundreds — on top of processing. This is the single most important wiring decision.
- **Processing dominates and is frozen.** `F·(3+M)` ≈ 700 reads/run is ~350× the discovery cost and Stage 2B cannot reduce it (M6/M8 are frozen). The cap bounds F; nothing bounds A.
- **The state read partially pays for itself**: it lets the provider pre-filter `already_captured` windows (`eligibility.ts:84`) so M6 is **not** invoked on them — saving the whole (3+M) per already-done fixture. Net-positive versus invoking M6 blindly.
- **Redundancy (frozen, unavoidable):** the snapshot archive is read once for state and then 3× per new fixture inside M6 (its own full-stream idempotency pre-check + latest + append). Acceptable — it is the frozen single-writer safety path.
- **Always-pay-O(A):** because there is no cursor (INV-A), the 2 discovery reads happen every fire regardless of yield — at deep A even an all-already-done day pays O(A) twice.

---

## 4. Allocation & GC

- **Each whole-file read allocates** a single string (up to the ~512 MB wall) + a parsed array (~2–3× the string in JS heap). ~700 such alloc/free cycles per capture run → **heavy GC churn on the single `instances:1` fork event loop** (user-latency risk, §7).
- **The Stage-2A normalizers are allocation-lean** (visit each record once, build `Set`/`Map` of O(distinct keys), one small per-fixture head sort — `normalize.ts`; review §241). But they consume the `readAll*` **arrays**, which are O(A) — the reduction is lean, the input is not.
- **Peak heap** ≈ O(A) at any instant (whichever whole-file read is live), not O(A·reads) — arrays are GC'd between reads. So the wall is the **per-read** 512 MB string limit, and the **sustained** cost is GC frequency, not a single peak.
- **Provider/M5 allocations** are bounded O(F·M) (model inputs, market arrays) — negligible next to the read churn.
- **Mitigations (Stage-2B, semantics-preserving):** a streaming reader for the state build (`readline`/async-iterator, reduce line-by-line into Sets) would cut discovery peak to O(distinct keys) and dodge the string wall — but it only helps the 2 discovery reads, **not** the ~700 frozen M6 reads. The real allocation relief is retention/bounded depth (keep A small) or Postgres.

---

## 5. Provider invocation

- **`deriveCaptureInput` is invoked once per *selected* capture candidate** (`buildCaptureCandidates` loop, `capture-provider.ts:211-239`) → **≤ effectiveCeiling (≤150) invocations per capture run**; **0 per settlement run** (settlement has no derivation). Bounded and correct.
- **Waste — healing candidates fetch too.** The loop calls `deriveCaptureInput` for `plan.selected` including `healing:true` windows (`capture-provider.ts:211`), which only need **odds** healing, not a fresh M4 fetch + M5 derive. Stage-1 impl-review R4 flagged this. **[estimate]** on a re-fire with many partial pairs, this is up to F wasted full fetch/derive cycles. **Recommendation (Stage 2B):** short-circuit `deriveCaptureInput` for `healing:true` (reuse the existing snapshot's basis; M6/C5 heals odds idempotently) — no correctness change, real fetch savings.
- **Invocation is inside the lock** (INV-L) and serialized per job type; a second concurrent fire gets `null` → `skipped`/409, so provider spend is never doubled by overlap.

---

## 6. M4 fetch

- **Path per provider invocation:** `buildFetchPlan` (TTL decision) → `orchestrateFetches` (concurrency `min(4,2)=2`, `retryLimit` 3 rounds, `requestBudget`, deadline) → `admitProviderArchive` (content-hash, provider-archive write). `orchestrator.ts:79-146`.
- **Sources per fixture:** team stats (home + away, TTL 6 h), league baseline (TTL 24 h), match detail (TTL 5 m). **Warm cache → `skip_fresh` (near-zero).** Cold cache worst case ≈ ~4 source fetches × F fixtures, serialized at concurrency **2** → the **dominant wall-clock term** when caches are cold and the one most likely to blow the deadline.
- **Deadline hazard (BF-1, must fix in 2B):** `orchestrateFetches` honours `config.runDeadlineMs` = **300 000 ms** by default — **5× the route budget**. Stage 2B MUST pass the **clamped** effective deadline (≤45 s, minus already-elapsed) into the fetch clock/budget, never 300 s. `requestBudget` should be set so total provider calls/run cannot exceed the fetch sub-budget.
- **Back-pressure:** a hit `requestBudget`/deadline defers remaining fixtures (`skipped_budget`/`skipped_deadline` → `not_admitted`) — natural, no queue. `maxFailureRatio` aborts a degraded run rather than shipping a partial-day silently.
- **Determinism:** `orchestrateFetches` uses an injected clock and plan-order gating — replay-stable regardless of async scheduling (header + `:76-77`). Good; 2B must keep the injected clock (no `Date.now`).

---

## 7. M5 derive

- **`deriveEvidenceModel(FixtureModelInput)`** is pure CPU, O(M) over ≤M markets (map/filter/`Math.min` over venues) — `derive.ts:293-372`. **[estimate]** sub-millisecond per fixture; F× is negligible (< a few ms/run at F=150).
- **Not a bottleneck** on any axis (time, allocation, IO). The only requirement is determinism (no clock/random — verified pure) and that the derive-adapter **reuses `request.capturedAt` verbatim** (plan §16 rule d) so identity/replay stay byte-stable.
- Its cost is fully overlapped by the M4 fetch it depends on; it never contends for IO.

---

## 8. M6 processing

- **Frozen `runCaptureBatch` → `captureEvidenceSnapshot` + `ensureMandatoryCaptureOdds`**, per selected fixture: full-stream `listSnapshots` (1 scan) + `latestSnapshot` (1) + `appendSnapshot` (1 read for admission) + **M** mandatory-odds `append`, each a hash-verified odds `readAll`. **O(F·(3·A + M·A_odds·hash))** — `capture-run.ts`, `capture.ts:92,110,141`, `mandatory-odds.ts:134`.
- **This is the dominant cost and Stage 2B does not touch it** (M6 is frozen; the wiring only feeds it a **bounded, pre-filtered** candidate set). Two levers Stage 2B *does* control:
  1. **Bound F** to ≤ ceiling (100/150) — the primary INV-D control (plan §13).
  2. **Pre-filter** `already_captured`/`orphan`/complete-pair windows via the Stage-2A state, so M6 is invoked only on genuinely new/partial fixtures — avoiding ~(3+M) scans per already-done fixture.
- **Settlement (M8) is the lighter twin:** `2 + 2·T` scans/fixture, no odds hash tax → **[measured] ~85–97 ms/fixture**, ~half capture. Same O(F·A) shape.
- **Defence-in-depth (plan §13, additive, non-frozen):** an optional `deadline?: () => number` on the M9 **orchestrators** (`runCaptureBatch`/`runSettlementBatch`, not the frozen core) that breaks before starting a candidate it cannot finish and counts the rest `deferred_by_deadline`. This keeps `captureEvidenceSnapshot`/`settleSnapshot` frozen while bounding worst-case wall-clock. Recommended for 2B.

---

## 9. Deadline & lock-hold (roll-up)

All of §2–§8 runs **inside the durable lock** (INV-L), so **lock-hold ≈ job wall-clock**:
`lock(≤1 s) + state-read(2 scans) + Σ_F[ fetch + derive + M6(3+M scans) ] + diagnostics`.

Proposed sub-budget within the ≤45 s effective deadline (consistent with the Stage-2 prep review): lock 1 s · **state read 2–8 s** · fetch 15 s · normalize/derive 3–5 s · **M6/M8 processing 13 s** · diagnostics 1 s → ≤43 s, with the mid-batch remaining-time guard as backstop. At deep archive the state read + processing terms blow this → the cap **and** the deadline guard are the required controls, and the 512 MB wall is the hard stop (fail-closed, safe).

---

## 10. Blocking & required conditions

- **PB2B-1 (blocking).** Wire the **Stage-2A single-bounded-read** builders: back `readAllSnapshots/Odds/Validations` with a concrete strict reader (reuse `readNdjson`), call `build{Capture,Settlement}ArchiveState` **once per run**. Do **not** implement the plan-§16 per-fixture `deriveCaptureArchiveState(...fixtureIds)` (O(F·A)). Reconcile the plan §13/§16/§156 wording with the built Stage-2A layer. *(If a whole-archive read must be exposed on the store interface, add it as a new read method — never a format change — so Postgres can later implement it as an indexed query.)*
- **PB2B-2 (blocking).** Clamp the fetch/job deadline to ≤45 s (never the 300 s `runDeadlineMs`) and pass it into `orchestrateFetches`; add the mid-batch remaining-time guard (`deferred_by_deadline`).
- **PB2B-3 (blocking for closure).** Record Gate-B5 benchmarks (empty / 10 k / 100 k / ≥350 k depth; capture & settlement separately; F at ceiling; backlog>cap; malformed final line) measuring total time, **archive-read time**, provider time, processing time, **peak RSS**, **event-loop delay**, lock-hold, oldest-pending age. Accept only if the whole route < 45 s at representative depth; document the depth ceiling + ~50 k-line / ~10 MB warn threshold.
- **Recommended (non-blocking):** short-circuit `deriveCaptureInput` for `healing:true` (PB §5); stream the state read to dodge the 512 MB wall and cut GC (§4); stagger capture/settlement cadence (distinct locks already prevent corruption); land H-1 unlock-500 swallow.

---

## 11. Verdict

### CONDITIONALLY READY

The Stage-2B *shape* is performance-sound: a bounded (≤150), deterministic producer inside the lock, feeding frozen consumers, with a **single-bounded-read discovery layer already built** (Stage 2A) that collapses discovery to O(A). At the expected tens–low-hundreds-of-fixtures/day load on a **shallow archive**, one route fire fits the ≤45 s deadline, throughput equals the ceiling (~570 captures/hr capacity ≫ arrival), provider invocation is bounded to ≤F/run, M4 fetch is TTL-amortized, and M5 is free.

Readiness is **conditional** because (a) the governing wiring plan (§13/§16/§156) currently specifies a **per-fixture O(F·A)** archive derivation that contradicts and would orphan the built Stage-2A single-read layer — **PB2B-1 must pin the single-bounded-read wiring**; (b) the **frozen M6/M8 per-fixture scan cost (~700 whole-file reads/capture run) is the dominant, unchangeable term**, bounded only by the cap and by keeping accumulated depth A small — the file adapter is a **bounded-depth regime** with a hard `fs.readFile` string wall at ≈350 k snapshots; and (c) the fetch deadline must be clamped off the 300 s default (PB2B-2) and proven by the Gate-B5 benchmark (PB2B-3). No frozen contract, identity, hash, ordering, or replay semantic is affected by anything recommended here.

**Main bottleneck ranking:** (1) frozen M6/M8 per-fixture O(A) scans (accumulated depth is the wall); (2) M4 cold-cache fetch wall-clock at concurrency 2; (3) GC churn from ~700 whole-file allocations/run; (4) the state read *if* mis-wired per-fixture (PB2B-1). M5 derive and the discovery/ordering/selection algebra are negligible.

**Confirmation:** the only file created is `docs/plans/m10-stage-2b-performance-review.md`. No runtime code, tests, contracts, flags, routes, runners, schedules, environment, database, archive, configuration, or existing document was modified; no benchmark of modified code was run.
