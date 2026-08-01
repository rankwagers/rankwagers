# M10 Stage 2B — Capture Pipeline Wiring — Implementation Performance & Scalability Review

**Document type:** Performance & scalability review (review-only). No runtime code, test, contract, feature flag, cron route, runner, schedule, environment, database, archive, config, or existing document was modified. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer:** Performance & Scalability Reviewer, Sprint 23B / M10 Stage 2B.
**Under review (built, verified this pass):** `lib/evidence-capture/candidates/capture-pipeline.ts`; the new strict whole-archive readers `readAllSnapshotsStrict` (`lib/archive/evidence/file.ts:147-151`) and `readAllOddsRecordsStrict` (`lib/evidence-capture/odds-archive/file.ts:74-116`); the Stage-2A builders/normalizers (`candidates/archive-state/*`); the runner `provideCandidates` seam (`lib/jobs/runner.ts:288-321`); `tests/evidenceCapturePipeline.test.ts`.
**Governing:** the Stage-2 prep review (`m10-stage-2-performance-scalability-review.md`), the Stage-2B forward review (`m10-stage-2b-performance-review.md`), the wiring record (`m10-stage-2b-capture-pipeline-wiring.md`), the Stage-2A record (`m10-stage-2a-archive-normalization.md`), and the spec (Rev A1).
**Method:** every `file:line` read this pass; a **bounded scratch benchmark** was run against the *actual* built readers/normalizers over synthetic temp data (deleted after; **no repo fixture created, no runtime/test file modified**). Numbers are **[measured]** (this pass) or **[measured-M9]** (M9 scratch benchmark) or **[derived]**.

**VERDICT: PERFORMANCE REVIEW CONDITIONALLY PASSED** — the prior single-read-vs-per-fixture conflict is **resolved correctly** (single bounded read, verified 1+1 reads); Stage 2B adds **no per-fixture discovery amplification** and **no regression** to the M9 posture. The conditions are later-stage benchmark gates for the *whole-route* cost (dominated by the frozen M6 per-fixture scans, which Stage 2B does not and cannot change) and the file-adapter depth wall. See §7/§9.

---

## 0. Resolution of the prior conflict (explicit)

The Stage-2B forward review raised **PB2B-1**: the locked-discovery plan (§13/§16/§156) leaned toward a **per-fixture** `deriveCaptureArchiveState(...fixtureIds)` (O(F·A)), contradicting the Stage-2A **single-bounded-read** builders (O(A)).

**Resolved — the implementation uses the single-bounded-read path.** Verified in code and by instrumentation:
- `produceCaptureRequests` builds archive state via `buildCaptureArchiveState(readPort)` (`capture-pipeline.ts:124`), **not** any per-fixture loop.
- `buildCaptureArchiveState` = `Promise.all([port.readAllSnapshots(), port.readAllOddsRecords()])` → normalize (`archive-state/builders.ts:41-45`) — **each store read once**.
- The concrete port `createFileCaptureReadPort` maps `readAllSnapshots → readAllSnapshotsStrict(env)` and `readAllOddsRecords → readAllOddsRecordsStrict(oddsFile)` (`capture-pipeline.ts:67-70`) — both whole-archive single reads.
- **No `listSnapshots(fixtureId)` fixture loop exists in the discovery path** (grep of `capture-pipeline.ts` + `capture-provider.ts` + `archive-state/*`: the per-fixture `listSnapshots`/`latestSnapshot` calls appear **only** inside the frozen M6 store closure, not in discovery).
- **[measured] Part A:** a counting port through `buildCaptureArchiveState` records `readAllSnapshots calls=1, readAllOddsRecords calls=1`. Single read confirmed.

The §16 per-fixture sketch was **not** implemented; the plan wording is now superseded by the built code. PB2B-1 is **closed**.

---

## 1. Complexity Model

Variables: **A** = accumulated global NDJSON rows (snapshots `A_s`, odds `A_o`, grows across days); **D** = discovered source rows (grouped to fixtures); **F** = selected ≤ ceiling (default 100, hard 150); **M** ≤ 32 markets/fixture (~4 in daily-list).

| Stage | Time | Notes |
|---|---|---|
| source load (`loadPublishedDailyPredictions`) | O(D·M) pure map + **1** daily-archive read | `source.ts:65-103`; malformed dropped upstream |
| **archive-state read (Stage 2B)** | **O(A_s + A_o)** — **2** strict whole-archive reads, concurrent | `builders.ts:41-45`; single bounded read (PB-1) |
| normalize (capture) | O(A_s + A_o) reduce to Sets | `normalize.ts:74-116` |
| provider classify (`buildCaptureCandidates`) | O(D·M) group + O(D) classify + **O(E log E)** sort, E≤D | `capture-provider.ts:94-194` |
| bounded select | O(F) slice | `capture-provider.ts:181-183` |
| candidate mapping + derivation | O(F) × `deriveCaptureInput` (injected M4+M5; dormant this stage) | `capture-provider.ts:211-239` |
| **M6 downstream (frozen)** | **O(F·(3·A_s + M·A_o·hash))** | `capture-run.ts` → 3 evidence scans + M hash-verified odds scans / fixture |

**Discovery subtotal (Stage 2B's own contribution):** `O(A) + O(D log D)` — **linear in archive size, once per run**. **Whole-run subtotal:** dominated by the frozen `O(F·A)` M6 term.

---

## 2. Actual Read Amplification

**Strict archive reads per discovery run (Stage 2B):**

| Path | Reads | Verified |
|---|---|---|
| snapshots | **1** (`readAllSnapshotsStrict`) | `builders.ts:42`; Part A count=1 |
| odds | **1** (`readAllOddsRecordsStrict`) | `builders.ts:43`; Part A count=1 |
| **discovery total** | **2**, concurrent, once/run — **even if 0 eligible** | — |

**File parses per discovery run:** 2 whole-file `JSON.parse` loops (snapshots + odds); the odds loop additionally runs `verifyOddsRecord` (hash) per line. No per-fixture reparse.

**M6 downstream read amplification (frozen, unchanged by 2B):** per selected new fixture, M6 does `listSnapshots` + `latestSnapshot` + `appendSnapshot`'s admission read = **3 evidence scans**, plus `ensureMandatoryCaptureOdds` = **M** odds `append`s each calling `readAll()` → `readAllOddsRecordsStrict` (**M hash-verified odds scans**). So **M6 = F·(3 + M) whole-file reads/run**.

**Ratio (the headline):** at F=100, M=4 → discovery **2** reads vs M6 **~700** reads → **M6 is ~350× the discovery scan cost and remains the dominant archive-scan cost.** ✅ (checklist "M6 remains the dominant archive-scan cost" — confirmed.) Stage 2B's single-read discovery is a correct, small optimization on top of an unchanged, dominant frozen cost.

**Net-positive side effect:** the 2 discovery reads let the provider pre-filter `already_captured`/complete-pair windows (`eligibility.ts:84`), so M6 is **not** invoked on them — saving ~(3+M) scans per already-done fixture. Discovery pays for itself.

---

## 3. Memory Model

**[measured] this pass (realistic ~1.5 KB/snapshot line, `readAllSnapshotsStrict` + `normalizeCaptureArchiveState`, snapshots only):**

| Rows | File | read time | normalize | peak RSS (base→afterRead→afterNorm) |
|---|---|---|---|---|
| 10 k | 14 MB | 347 ms | 157 ms | 118 → 132 → **149 MB** |
| 100 k | 139 MB | 4 770 ms | 1 147 ms | 210 → 411 → **445 MB** |
| 500 k | ~715 MB | **THROWS** | — | `fs.readFile(utf8)` > `MAX_STRING_LENGTH` (536 870 888 ≈ 512 MB) → unreadable |

**Peak in-memory duplication per whole-file read (`readNdjson`):** raw string (≈file size) + `split('\n')` substring array (≈file size) + parsed object array (~2–3×) ⇒ transient **~4–5× the file** on the heap; measured 139 MB file → +235 MB heap. The odds reader (`readAllOddsRecordsStrict`) additionally holds a `Map<id,record>` + an `order[]` id array + the returned array → **more** duplication than snapshots, plus per-line hash verification.

**Concurrency doubles the transient peak.** `produceCaptureRequests` runs `loadSource ∥ buildCaptureArchiveState`, and `buildCaptureArchiveState` runs `readAllSnapshots ∥ readAllOddsRecords` (`Promise.all`). So at peak the **snapshots and odds materializations coexist** — real discovery peak ≈ snapshot-side + odds-side simultaneously (my 445 MB is snapshots-only, so understates it). The per-file 512 MB string wall is per-`readFile`, so concurrency does not change the wall, but it does roughly **double heap RSS** at the peak instant.

**Sets/Maps retention (checklist):** the normalizer builds `snapshotHashById: Map<id,contentHash>` and `oddsHashById: Map<id,contentHash>` purely for the fail-closed conflict check — **O(A) strings retained transiently, coexisting with the O(A) input arrays** (a ~2× record footprint during normalize). It is **not a leak** (dropped on return; only the small window-key `Set`s are returned), and the conflict check is a required safety property (SC-4). But it is a legitimate "retains more than strictly necessary" note (§8-R2): a streaming reducer could fold hash-conflict detection into the parse pass without a second full O(A) Map. `capturedWindowKeys`/`partialWindowKeys` are O(distinct windows) — appropriately small and correctly the only retained output.

**RSS risk:** a single deep-archive discovery read pushes RSS to GB-scale before the string wall throws; concurrent snapshot+odds reads compound it on the single `instances:1` fork. Bounded only by archive depth, not by the candidate ceiling.

---

## 4. Event-Loop and Wall-Time Risk

- **Discovery is a synchronous parse loop.** `readNdjson`/`readAllOddsRecordsStrict` do a blocking `split` + `JSON.parse`(+hash) over the whole file. **[measured]** 100 k snapshots = **~4.8 s read + ~1.1 s normalize ≈ 6 s of event-loop-blocking work for the snapshot side alone** (odds side adds more, hash-heavy). On the single fork this stalls **all** user request latency for that window — and it happens **every** run (no cursor), regardless of yield.
- **Wall-time / route-timeout risk.** Discovery alone at 100 k lines (~6 s snapshots + odds) already consumes a meaningful slice of the ≤45 s effective deadline **before any fetch/derive/M6 processing**. Because M6 then does F·(3+M) such scans, the **whole route** at any non-trivial depth is dominated by M6 and blows the 60 s route budget long before discovery does. Stage 2B correctly leaves INV-D deadline enforcement to a later stage (wiring doc §1) — **but that stage is now mandatory before live activation** (§6/§7).
- **Route-timeout today:** none — the cron route is unchanged (M9 empty pass); the pipeline fires only under an injected producer (tests). Risk is latent until live M4→M5 derivation + route wiring land.
- **Mitigations available (later stage, semantics-preserving):** streamed NDJSON parse for discovery (cuts the 6 s block and dodges the string wall); the plan's optional mid-batch `deadline` guard on the M9 orchestrators (`deferred_by_deadline`); bounded depth via retention. None changes frozen identity/hash/ordering.

---

## 5. Stage 2B Regression Assessment

**No performance regression versus the M9 posture.**
- **Bare cron fire unchanged:** the route still calls the runner with no producer → `candidates ?? []` empty pass (`runner.ts:304-306`); the M9 **[measured-M9] 0.04 ms/pass** baseline is preserved. A disabled flag still short-circuits **before** the lock (`runner.ts:295`) — no discovery, no read.
- **Producer path is additive and gated:** discovery runs only when `provideCandidates` is supplied, **inside** the lock (INV-L), and only in tests until the async M4→M5 seam is wired.
- **The single-read discovery is strictly cheaper than the per-fixture alternative** it replaced (2 reads vs O(D) reads) — a forward improvement, not a regression.
- **No frozen cost changed:** M6/M8 per-fixture scan counts, identity, hash, ordering, and the odds hash-verify tax are untouched; the new `readAllOddsRecordsStrict` is an **extraction** of the store's pre-existing `readAll` (odds store now delegates to it — `odds-archive/file.ts:127-128`), so store behaviour is byte-identical.
- **Tests green:** `tests/evidenceCapturePipeline.test.ts` **9/9 [measured]**; wiring record reports full suite 1769/1769, typecheck/lint clean (not re-run in full this pass; the targeted 9/9 and typecheck-relevant surfaces were exercised).

**One latent, non-regressive exposure introduced:** the newly **exported** `readAllSnapshotsStrict`/`readAllOddsRecordsStrict` are whole-archive O(A) reads. Their JSDoc states the single-bounded-read intent, but nothing prevents a future caller from invoking them in a per-fixture loop (re-creating O(F·A)) or on a hot path. This is a **future-safety** note, not a current defect (§8-R1).

---

## 6. Later-Stage Capacity Gates

These are the costs Stage 2B deliberately deferred; each is a **mandatory gate before live capture activation**:

1. **INV-D deadline enforcement.** Clamp the effective job deadline to ≤45 s (never the 300 s `runDeadlineMs`), pass it into `orchestrateFetches`, and add the mid-batch remaining-time guard. Stage 2B has **none** (wiring doc §1).
2. **Whole-route benchmark (Gate B5).** Prove capture at the ceiling, against representative accumulated depth, completes < 45 s — the frozen M6 F·(3+M) scans dominate and must be measured end-to-end (this review measured only the 2-read discovery slice).
3. **Depth ceiling + warn.** Enforce/observe an archive-depth operating ceiling below the ~357 k-record / ~512 MB string wall (measured 500 k → unreadable), with a ~50 k-line / ~10 MB warn threshold; retention keeps A bounded.
4. **Live async M4→M5 derivation** behind `deriveCaptureInput` — its network wall-clock (concurrency 2, cold-cache) is the other unmeasured term and must fit the fetch sub-budget.
5. **Streaming discovery read** (recommended) to remove the measured ~6 s/100 k event-loop block and the string wall from the discovery path.

---

## 7. Blocking Findings

**None.** Stage 2B is a bounded, additive, dormant-at-the-route producer with the archive-read conflict resolved correctly (single bounded read, verified). It introduces no regression and no unbounded discovery cost. The dominant frozen M6 O(F·A) cost is pre-existing and bounded by the ceiling; the depth wall is a documented file-adapter limit, not a 2B defect. Nothing blocks this stage's merge.

---

## 8. Non-blocking Recommendations

- **R1 — Guard the exported readers against misuse.** The whole-archive `readAllSnapshotsStrict`/`readAllOddsRecordsStrict` should keep an explicit "call once per run; O(A); never per-fixture" contract in the JSDoc (partly present) and, ideally, be surfaced only through the `CaptureArchiveReadPort` rather than as broadly-importable module functions, to prevent a future O(F·A) loop.
- **R2 — Fold conflict detection into the parse pass.** The normalizer's `snapshotHashById`/`oddsHashById` O(A) Maps coexist with the O(A) input arrays; a streaming reducer (R3) could detect id/hash conflicts during the single parse without a second full Map, cutting discovery peak memory.
- **R3 — Stream the discovery read** (`readline`/async-iterator, reduce line-by-line into Sets) to remove the ~6 s/100 k synchronous event-loop block and to dodge the 512 MB string wall on the discovery path (M6's frozen reads remain, but discovery would no longer be a second wall).
- **R4 — Short-circuit derivation for `healing:true` candidates** (`capture-provider.ts:211`): healing needs only odds repair, not a fresh M4 fetch + M5 derive — a wasted provider invocation on re-fires with partial pairs (Stage-1 impl-review R4).
- **R5 — Sequential (not concurrent) big reads** if RSS becomes a concern: reading snapshots then odds sequentially halves the transient heap peak versus the current `Promise.all`, at the cost of wall-time — a knob for the deep-archive regime.
- **R6 — Bound source size too:** `loadPublishedDailyPredictions` is O(D) unbounded by the ceiling; a pathological daily list would inflate grouping/sort before the cap. Low risk at current scale; note for the capacity gate.

---

## 9. Verdict

### PERFORMANCE REVIEW CONDITIONALLY PASSED

Stage 2B wires the capture pipeline correctly and efficiently for what it owns: **the prior per-fixture-vs-single-read conflict is resolved in favour of the single bounded read** — `buildCaptureArchiveState` invokes `readAllSnapshotsStrict` and `readAllOddsRecordsStrict` **exactly once each** per run (verified by instrumentation: 1 + 1), with **no `listSnapshots` fixture loop in discovery** and no repeated whole-archive copy. Discovery is `O(A) + O(D log D)`, once per run; the extraction of the odds `readAll` into `readAllOddsRecordsStrict` is byte-identical (no store regression). **[measured]** discovery cost is 10 k → ~0.5 s / 149 MB RSS, 100 k → ~6 s / 445 MB RSS (snapshots side), and 500 k → **unreadable** (512 MB `fs.readFile` string wall, fail-closed). There is **no Stage 2B performance regression**: the M9 empty-pass baseline and flag short-circuit are preserved, and the producer is dormant at the route.

It is **CONDITIONALLY** passed, not unconditionally, because the dominant cost — the **frozen M6 `F·(3+M) ≈ 700` whole-file scans per run** (~350× the discovery cost, confirmed dominant) — is unbounded in accumulated depth A and is **not measured end-to-end here**, and Stage 2B deliberately defers INV-D deadline enforcement and live derivation. Those become **mandatory later-stage gates** (§6): the whole-route Gate-B5 benchmark at representative depth, the ≤45 s deadline clamp + mid-batch guard, a depth ceiling below the ~357 k-record string wall, and (recommended) a streaming discovery read to remove the measured ~6 s/100 k event-loop block. No frozen contract, identity, hash, ordering, or replay semantic is affected.

**Main bottleneck ranking:** (1) frozen M6 per-fixture O(A) scans — accumulated depth is the wall; (2) discovery's synchronous ~6 s/100 k parse + GB-scale RSS + 512 MB string wall; (3) cold-cache M4 fetch (later stage). Discovery *read count* and M5 derive are non-issues.

**Confirmation:** the only file created is `docs/plans/m10-stage-2b-implementation-performance-review.md`. **No runtime or test file was modified**; the bounded benchmark ran against the built code over a temporary scratch directory (deleted; no repo fixture), and no persistent fixture was added.
