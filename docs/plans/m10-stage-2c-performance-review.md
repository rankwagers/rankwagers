# M10 Stage 2C — Settlement Pipeline Wiring — Performance & Scalability Review

**Document type:** Performance & scalability review / plan (review-only). No runtime code, test, contract, feature flag, cron route, runner, schedule, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance & Scalability Planner, Sprint 23B / M10 Stage 2C.
**Build state (verified this pass):** Stage 2C is **NOT built** — there is no `settlement-pipeline.ts` (only `capture-pipeline.ts`), and there is **no `readAllValidationsStrict`** exported (the evidence adapter has only the private `readNdjson<ValidationRecord>` and per-fixture `listValidations`). The settlement **normalizer + builder are already built** in Stage 2A (`normalizeSettlementArchiveState`, `buildSettlementArchiveState`) and the Stage-1 settlement **provider** exists (`settlement-provider.ts`). This review models the *proposed* Stage 2C wiring before it is written.
**Governing:** M10 spec Rev A1; Stage 2A record/review; Stage 2B implementation performance review (`m10-stage-2b-implementation-performance-review.md`); the general Stage-2 perf/scalability review; M8 settlement implementation (`settlement.ts`).
**Method:** every `file:line` read this pass; a **bounded scratch benchmark** ran the *actual* built `normalizeSettlementArchiveState` (correction-state build) + a validations-sized whole-file read over synthetic temp data (deleted; **no repo fixture, no runtime/test change**). Numbers: **[measured-2C]** (this pass), **[measured-2B]** (Stage-2B pass, snapshot read shared), **[derived]**.

**VERDICT: STAGE 2C PERFORMANCE CONDITIONALLY READY** — the single-bounded-read foundation (`buildSettlementArchiveState`) already exists and the design is a direct parallel of the passed Stage 2B; discovery is O(A), 2 reads/run, no per-fixture scan. Conditions: add `readAllValidationsStrict` (strict/fail-closed), the frozen M8 `F·(2+2T)` scans remain the dominant depth-bound cost, the **validations file adds a new >512 MB string-wall exposure**, and INV-D + a whole-route benchmark are pre-activation gates. See §7–§9.

---

## 1. Complexity Model

Proposed path: **strict archive reads → `buildSettlementArchiveState` → settlement source loading → Stage-1 settlement provider → M8 batch runner.**

Variables: **A** = accumulated NDJSON rows (snapshots `A_s`, validations `A_v`); **F** = captured/selected fixtures ≤ ceiling; **T** = terminal-and-changed markets/fixture that append (≤ M); **V** = total validation revisions; **M** ≤ 32 markets/fixture (~4); **C** = corrections/run.

| Stage | Time | Anchor |
|---|---|---|
| source load (completed rows) | O(D·?) + **1** daily-archive read | `settlement-provider.ts:89,112`; `source.ts` |
| **archive-state read (2C)** | **O(A_s + A_v)** — **2** strict whole-archive reads, concurrent | `builders.ts:56-60` |
| normalize settlement (+ correction-state) | O(A_s) + O(A_v) reduce; head resolution O(V); per-fixture head sort O(Σ heads_f log heads_f) | `normalize.ts:136-212` |
| Stage-1 provider classify | O(D) (`resolveMatchLifecycle` + Set.has/row) | `settlement-provider.ts:110-126`; `eligibility.ts:176-185` |
| dedup (sort + seen-Set) | O(D log D) | `settlement-provider.ts:128-139` |
| order + bounded select | O(E log E) + O(F) | `settlement-provider.ts:143-146` |
| **M8 downstream (frozen)** | **O(F·(2 + 2T)·A)** | `settlement.ts:230,326,371` + `file.ts:appendValidation` (2 scans) |

**Discovery subtotal (2C's own contribution):** `O(A_s + A_v) + O(D log D)` — linear in archive size, once per run. **Whole-run subtotal:** dominated by the frozen `O(F·(2+2T)·A)` M8 term (lighter than capture — no odds hash tax). **Corrections:** minimal (first-settle) path C = 0; when wired, correction detection reads `currentValidationHeads` (already built, O(V)) and each correction is +1 `appendValidation` = +2 scans in M8 → `O(C·A)` added.

---

## 2. Read Amplification

**Required whole-archive reads per settlement discovery run:**

| Read | Count | Notes |
|---|---|---|
| snapshots (`readAllSnapshots`) | **1** | shared with capture — `readAllSnapshotsStrict` already exists (`file.ts:147`) |
| validations (`readAllValidations`) | **1** | **`readAllValidationsStrict` MUST be added** (analogous strict/fail-closed reader) |
| **discovery total** | **2**, concurrent, once/run — even if 0 eligible | `builders.ts:56-60` (`Promise.all`) |

**Reuse of one normalized state:** `buildSettlementArchiveState` reads snapshots + validations **once** and `normalizeSettlementArchiveState` reduces them to a **single** `SettlementArchiveState { capturedFixtureIds, settledFixtureIds, currentValidationHeads }` reused across all fixtures — no per-fixture re-derivation.

**Per-fixture full archive scan in discovery: NONE** (verified) — the settlement provider consumes the pre-built Sets (`settlement-provider.ts:100-104`); the only per-fixture `listValidations`/`latestSnapshot` calls live inside the **frozen M8** store path, not discovery.

**M8 downstream read amplification (frozen, unchanged by 2C):** per selected fixture, `settleLatestSnapshotForFixture` → `latestSnapshot` (1 scan) + `listValidations` (1 scan) + per terminal-changed market `appendValidation` = `Promise.all([validationsFor, snapshotsFor])` (2 scans). So **M8 = F·(2 + 2T) whole-file reads/run**. At F=100, T≈4 → **~1000 reads/run** → **M8 is ~500× the discovery scan cost and remains the dominant archive-scan cost** (parallel to capture's M6, but no odds hash tax → ~half the per-read CPU). Discovery's 2 reads also pre-filter `already_settled` fixtures so M8 is not invoked on them — net-positive.

---

## 3. Correction-State Cost

- **`currentValidationHeads` is built unconditionally** by `normalizeSettlementArchiveState` (resolve MAX-revision head per `validationId` via a `Map<validationId, ValidationRecord>`, project to `Map<fixtureId, ValidationHead[]>`, sort each fixture's list by `validationId` — `normalize.ts:153-211`). Cost: **O(V) time + O(#heads) retained memory + O(Σ heads_f log heads_f) sort**.
- **[measured-2C]** V=100 k validations → normalize (incl. the full correction-state build) = **653 ms**, heads = 100 000 resolved; V=10 k → 55 ms. So building the correction state is **cheap relative to the read** (1.56 s for the 94 MB validations read at 100 k) and O(V)-linear.
- **The minimal (first-settle) provider does not consume `currentValidationHeads`** — it uses only `capturedFixtureIds`/`settledFixtureIds` (`settlement-provider.ts:100-104`). So Stage 2C **pays to build and retain** the per-fixture head map it does not yet use. Head resolution is *required anyway* to compute `settledFixtureIds` (terminal-vs-pending), so the **incremental** correction-state cost is only the `headsByFixture` projection + sort + retention (O(#heads) memory) — modest, and it is the enabler for the deferred Stage-3 correction path.
- **Correction lookup cost (when wired, Stage 3):** detecting a changed outcome is an **O(1) map lookup** per fixture into `currentValidationHeads` (already built) → no extra scan for detection; each *applied* correction is +1 `appendValidation` (2 scans) in frozen M8 → `O(C·A)`. Corrections do not add discovery reads.
- **Recommendation:** an optional flag to skip the `headsByFixture` projection/sort while corrections are unwired would save the retention, but the saving is small (O(#heads) transient) and would fork the normalizer — **not worth the complexity now** (§8-R2).

---

## 4. Memory and Event-Loop Risk

**[measured-2C] settlement discovery (validations read + `normalizeSettlementArchiveState`, ~1 KB/line):**

| V | validations file | read | normalize(+corr-state) | peak RSS |
|---|---|---|---|---|
| 10 k | 9 MB | 127 ms | 55 ms | 121 MB |
| 100 k | 94 MB | 1 560 ms | 653 ms | 425 MB |

Plus the **shared snapshot read** — **[measured-2B]** 100 k snapshots (139 MB) = **~4 770 ms read + ~445 MB RSS**. Settlement reads snapshots ∥ validations concurrently (`Promise.all`), so:

- **Peak in-memory duplication:** each `readNdjson` holds raw string + `split` substrings + parsed array (~4–5× file). Concurrent snapshots + validations reads → **both materializations coexist** → peak RSS ≈ snapshot-side + validation-side simultaneously (GB-scale on a deep archive).
- **Event-loop block:** the reads are synchronous `split`+`JSON.parse` loops. **[derived]** at 100 k snapshots + 100 k validations, discovery blocks the single `instances:1` fork for ~5–6 s (snapshot read dominates; validation read ~1.6 s; normalize ~0.65 s), **every run**, before any M8 processing. M8 then does F·(2+2T) such scans → the whole route is M8-dominated and blows the 60 s budget at any non-trivial depth long before discovery does.
- **>512 MB string wall — YES, it also affects settlement, on two files.** `fs.readFile(utf8)` throws above `MAX_STRING_LENGTH` (536 870 888 ≈ 512 MB). Snapshots (~1.5 KB/line) → unreadable at **~357 k records**; **validations (~1 KB/line) → unreadable at ~524 k records** (**[measured-2C]** wall confirmed). Because **V grows ~M× faster than snapshots** (≈M validations per settled fixture, more with corrections), the **validations file can reach its wall in a mature archive** — a *new* Stage-2C exposure that Stage 2B (snapshots + odds only) did not have. Beyond the wall the strict read throws → the run **fails closed** (safe: no false settlement), but the pipeline stops until retention/partition/Postgres.

---

## 5. Candidate Ceiling Recommendation

- **Settlement default 100, hard cap 150** — symmetric with capture; `normalizeBatchLimit` already enforces `clamp(configured, 1, 150)` with fail-safe to 100 (`limits.ts:10-27`). Overflow is deferred + counted (`candidatesDeferredByCap`), never dropped.
- **Rationale:** M8 is **[measured-M9] ~85–97 ms/fixture** (no odds hash tax → ~half capture), so at a **shallow** archive 150 settlements fit comfortably inside the ≤45 s effective deadline. The cap bounds F; it does **not** bound accumulated depth A — at deep archive per-fixture O(A) forces fewer than the ceiling (metered `deferred_by_deadline`).
- **Do not** ship any 500-style default; the effective ceiling must be the clamped value, never a raw config max.
- **Corrections** (Stage 3) count against the same ceiling — a correction is a settlement candidate; the 150 cap covers first-settle + corrections together.

---

## 6. Required Benchmarks (pre-activation, Gate B5-settlement)

Run against a seeded archive with a stubbed source, settlement path only:

| Case | Threshold |
|---|---|
| empty archive | ≈ M9 baseline; `succeeded` zero-count |
| 10 k / 100 k snapshots + validations depth, F at ceiling | whole route (discovery + M8) **< 45 s**; record per-fixture ms |
| ~357 k snapshots / ~524 k validations | **document** the string-wall fail-closed (both files) |
| backlog > cap | overflow `deferred_by_cap`; deterministic drain on re-fire |
| malformed final validation line | strict read surfaces error; fixture deferred; no false settle |
| correction burst (Stage 3) | `currentValidationHeads` lookup O(1); C corrections = +2C scans; still < 45 s |

**Must measure:** total time, **discovery read time (snapshots + validations, separately)**, **normalize/correction-state time**, M8 processing time, **peak RSS**, **event-loop delay**, lock-hold, oldest-pending age. Accept only if the whole route < 45 s at representative depth; document the depth ceiling + ~50 k-line / ~10 MB warn threshold **per file** (snapshots and validations).

---

## 7. Blocking Performance Findings

**None.** The single-bounded-read settlement builder already exists and is proven order-independent/fail-closed (Stage 2A); the proposed 2C wiring is a direct parallel of the **PASSED** Stage 2B, with 2 discovery reads/run and no per-fixture discovery scan. The dominant frozen M8 `O(F·A)` cost is pre-existing and bounded by the ceiling; the validations string wall is a documented file-adapter limit (fail-closed), not a 2C defect. Nothing blocks Stage 2C's design/merge.

---

## 8. Later Capacity Gates

1. **Add `readAllValidationsStrict`** (strict/fail-closed, ENOENT→empty, malformed/IO/conflict→throw) reusing `readNdjson`; a thin `createFileSettlementReadPort` that **reuses the shared `readAllSnapshotsStrict`** + the new validations reader. *(Port sharing — see below.)*
2. **INV-D deadline enforcement** — clamp effective deadline ≤45 s (never 300 s `runDeadlineMs`); mid-batch remaining-time guard on the M8 orchestrator (`deferred_by_deadline`). Settlement has none today.
3. **Whole-route Gate-B5-settlement benchmark** (§6) at representative depth before activation.
4. **Depth ceiling + warn per file** below the ~357 k-snapshot / ~524 k-validation walls; retention keeps A bounded.
5. **Streaming discovery read** (recommended) to remove the multi-second synchronous event-loop block and dodge both string walls on the discovery path.
6. **Correction path (Stage 3)** — wire `currentValidationHeads` into the provider + set `correctionCause`; benchmark the correction burst.

**Port decision — share the file-backed reader functions; do NOT build a new abstraction.** The adapter-neutral port **types already exist** (Stage 2A: `SnapshotReader`, `ValidationReader`, `OddsReader`, and the compositions `CaptureArchiveReadPort` / `SettlementArchiveReadPort` / `EvidenceArchiveReadPort` — `archive-state/types.ts:32-55`). Stage 2B's `createFileCaptureReadPort` already wires `readAllSnapshots → readAllSnapshotsStrict`. Stage 2C should:
- **reuse the exact `readAllSnapshotsStrict` function** for the shared `SnapshotReader` half (no duplication, no divergence), and
- add **one** new `readAllValidationsStrict` for the `ValidationReader` half, exposed via a thin `createFileSettlementReadPort` (parallel to `createFileCaptureReadPort`).

This is **not** a premature abstraction — it is the minimal parallel of the passed 2B, and the unifying types are already present. A *combined* `createFileEvidenceReadPort` returning `EvidenceArchiveReadPort` (snapshots + odds + validations) is a reasonable **optional** consolidation once both pipelines are wired, but building a generic "archive service" layer now would be premature; keep two thin composed ports sharing the snapshot reader.

---

## 9. Verdict

### STAGE 2C PERFORMANCE CONDITIONALLY READY

The settlement pipeline's performance foundation is already in place and sound: `buildSettlementArchiveState` performs a **single bounded read per store** (snapshots + validations, concurrent, once/run — `builders.ts:56-60`), reduces them to **one reusable `SettlementArchiveState`**, and has **no per-fixture full archive scan in discovery** (the per-fixture reads live only in frozen M8). The correction-state (`currentValidationHeads`) is built O(V)-linearly and cheaply (**[measured-2C]** 653 ms at 100 k), enabling O(1) correction lookup later; the minimal first-settle path pays only a modest retention overhead for it. **[measured-2C]** discovery is 10 k → ~0.18 s / 121 MB, 100 k validations → ~2.2 s / 425 MB (plus the shared ~4.8 s snapshot read), and the **validations file introduces a second >512 MB string wall (~524 k records)** on top of the shared snapshots wall (~357 k) — both fail-closed. The dominant cost is the **frozen M8 `F·(2+2T) ≈ 1000` scans/run** (~500× discovery), bounded by the ceiling but not by depth.

It is **CONDITIONALLY** ready, not fully, because the wiring itself is unbuilt and depends on: adding a strict `readAllValidationsStrict` + a thin settlement read-port that **reuses** the shared snapshot reader (no new abstraction); INV-D deadline enforcement; and a whole-route Gate-B5-settlement benchmark at representative depth proving < 45 s. No frozen contract, identity, hash, revision, ordering, or replay semantic is affected.

**Required ceilings:** settlement default **100**, hard cap **150** (symmetric with capture; `normalizeBatchLimit`); corrections count against the same cap.
**Benchmark gates before activation:** whole-route < 45 s at 10 k/100 k depth; document the ~357 k-snapshot / ~524 k-validation string walls; correction-burst; malformed-final-line fail-closed; measuring discovery read time (both files), normalize/correction-state time, M8 time, peak RSS, event-loop delay, lock-hold, oldest-pending age.
**Port decision:** share Stage 2B's file-backed `readAllSnapshotsStrict` and the existing adapter-neutral port *types*; add only `readAllValidationsStrict` + a thin composed settlement port — no premature abstraction.

**Confirmation:** the only file created is `docs/plans/m10-stage-2c-performance-review.md`. **No runtime or test file was modified**; the bounded benchmark ran against built code over a temporary scratch directory (deleted; no repo fixture added).
