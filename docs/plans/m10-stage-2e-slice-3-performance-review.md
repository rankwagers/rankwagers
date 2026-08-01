# M10 Stage 2E — Slice 3 (Strict Daily-Archive Reader) — Independent Performance & Scalability Review

**Document type:** Independent performance & scalability review — **persistence of the previously-completed Slice-3 review, re-verified** against current repository source and the amended plan + closure. Read-only: no runtime, test, planning, closure, flag, route, cron, schema, archive, or deployment file was modified. The **only** file created is this document.
**Sprint / Milestone / Stage / Slice:** Sprint 23B · M10 · Stage 2E · Slice 3.
**Reviewer:** Claude 4 (independent performance & scalability).
**Date:** 2026-07-31.
**Inputs re-read:** `docs/plans/m10-stage-2e-slice-3-planning.md` (amended), `docs/plans/m10-stage-2e-slice-3-planning-closure.md`.
**Source re-inspected:** `lib/footystats/dailyArchive.ts` (reader + archive layout), `lib/evidence-capture/candidates/completed-rows.ts` (completed-row source-loading seam), the Stage-2E-B / measurement-layer benchmark planning.
**Method:** every load-bearing claim re-checked against current source (`file:line`); the persisted verdict is the same PASSED reached previously — this pass confirms it still holds against the amended, frozen plan.

**Primary question — answered YES.** The proposed `readDailyArchiveStrict` **preserves the current performance characteristics exactly** while adding correct absent-vs-fault failure semantics, at negligible O(1) marginal cost. It is I/O-and-parse-identical to `readDailyArchive` (`dailyArchive.ts:71-79` — one async `fs.readFile` + one `JSON.parse`), diverging only in the `catch` handling (ENOENT→`null`; any other fault→throw) plus one O(1) parsed-object-shape predicate. The amended signature `readDailyArchiveStrict(date, archiveDir?)` adds only an optional test-injection directory (default = production dir) — performance-neutral.

---

# Performance Findings

Re-verified against current source; unchanged from the prior review and consistent with the frozen contract (closure §Frozen Reader Contract):

| Dimension | `readDailyArchive` (today) | `readDailyArchiveStrict` (frozen plan) | Delta |
|---|---|---|---|
| Filesystem read count | 1 async `fs.readFile` | 1 async `fs.readFile` | **0** |
| JSON parse count | 1 | 1 | **0** |
| Validation cost | `as DailyArchive` (none) | + `parsed===null \|\| typeof!=="object" \|\| Array.isArray(parsed)` | **O(1), negligible** |
| Memory allocation | read string + parsed graph | identical | **0** |
| Archive object copying | none (returns parsed object) | none | **0** |
| Sync vs async IO | async (`fs/promises`) | async | **same — non-blocking** |
| Duplicate parsing | none | none | **0** |
| Duplicate validation | none | none | **0** |
| Unbounded reads | no (per-date file) | no | **0** |
| Concurrency | stateless | stateless | **same** |
| Error-path overhead | bare `catch → null` | `code` check + (fault) `new Error(..., { cause })` | **negligible, rare** |

The frozen contract preserves the original error as `cause` (errno/`code` retained) with **no custom error class** — an O(1), rarely-taken path with no amplification. The optional `archiveDir?` param is a default-valued argument with zero runtime cost.

# IO Behaviour

- **Single asynchronous read per call**, identical to the fail-open reader; no synchronous/blocking IO.
- **No pre-stat / no `fs.access` call** — ENOENT is detected from the `fs.readFile` rejection's `.code === "ENOENT"`, not a separate syscall. Read count stays exactly 1.
- **No retry loop** — one attempt; a genuine fault throws immediately.
- **Called at most once per run** in the intended (deferred) consumer path: `produceSettlementRequests` runs `Promise.all([loadCompletedRows(date), buildSettlementArchiveState(port)])` — the source is loaded once, concurrently with the archive-state read, never per-candidate.
- **No logging inside the primitive** — it throws; classification/logging happens once downstream at `createCompletedRowLoader` (`completed-rows.ts:145-168` → `ProducerError("source_load_failed")`). No per-caller or per-row log storm.

# Memory Behaviour

- Allocation profile **identical** to `readDailyArchive`: one whole-file UTF-8 string + the `JSON.parse` object graph, returned directly with **no defensive copy and no re-serialization**.
- **No cache** — stateless module-level; the top level is pure (`const ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives")`), so mere bundle presence performs no import-time IO.
- **Bounded per date.** The daily archive is a **per-date file** `data/daily-archives/<date>.json` whose shape (`DailyArchive` = `date`, `savedAt`, `summary`, `fh/over15/over25/sh: ArchivedRow[]`) is one day's prediction set — **not** the accumulating evidence NDJSON. It is therefore **not** subject to the `MAX_STRING_LENGTH` (~512 MB) wall governing `readAllSnapshotsStrict`/`readAllValidationsStrict`. Peak memory ≈ one day's file (~1–2 MB, measured earlier this stage: ~7 ms @ 0.40 MB / ~27 ms @ 1.62 MB) + parsed graph — small and bounded.

# Scalability Risks

Assessed against the checklist — **none present in Slice 3**:
- **Unbounded archive into memory:** NO — per-date file, inherently bounded (unlike the evidence archive).
- **Accidental repeated reads:** NO — one read/call; consumer reads once/run.
- **Additional stat/access calls:** NO — ENOENT from the read rejection, no pre-stat.
- **Retry loops:** NO.
- **Expensive validation on every caller:** NO — dormant (no caller); when wired, one O(1) shape check, no deep schema walk (explicitly deferred).
- **Error-logging amplification:** NO — the primitive throws, does not log.
- **Future N× archive loading:** not in this slice; pinned as a Slice-4 adapter obligation (read the partition **once per run**).

# Planning Corrections Verification

The prior review raised one correction (Success Criterion 6 wording: the strict reader is *not* directly injectable into the fail-closed loader seam). Re-verified against source and confirmed **incorporated** into the amended plan and closure:

- **Correction I (not directly injectable) — APPLIED + source-verified.** `readDailyArchiveStrict` returns `DailyArchive | null`, whereas the seam contract is `readRows: (date) => Promise<readonly FootyMatchRow[] | null>` (`completed-rows.ts:132`); and the strict reader's `null` means **absent (benign skip)** whereas the loader's `null` means **unavailable → fail-closed `source_load_failed`** (`completed-rows.ts:159-164`) — the opposite semantics. The closure records this as Correction I and mandates a **Slice-4 rows-projection adapter** that translates strict-`null`→`[]` and propagates a strict throw → `source_load_failed`. Correct.
- **Correction A (caller count) — APPLIED.** Re-verified: **6 external callers** (`admin-dashboard/queries`, `calibration-intelligence/queries`, `footystats/client`, `homepage/trustPerformance`, `evidence-capture/source`, `archive/load`) + the defining module `footystats/dailyArchive.ts` (not a caller). All 6 rely on fail-open `null` and are byte-unchanged → **zero blast radius**.
- **Performance invariants (Correction J) — verified frozen:** single read/parse; no pre-stat/access/retry/copy/cache/log; no benchmark while dormant. Consistent with this review.
- **Import-time dormancy (Correction K) — verified:** module top level is pure; no import-time IO. Bundle-present but behaviourally dormant.
- **Reject-array predicate (Correction C) — verified sound and O(1)** against the `DailyArchive` plain-object shape (`dailyArchive.ts:13`).

No performance-relevant correction remains open; the prior review's single clarity item is resolved in the frozen plan.

# Benchmark Decision

**Unit tests are sufficient for this dormant slice; no benchmark is required now.** The primitive is I/O-and-parse-identical to the already-characterized `readDailyArchive` (adds only an O(1) shape check) and is dormant (no consumer), so there is no distinct performance profile to measure and nothing on a production path to exercise. The frozen ≥17-case hermetic test matrix (mkdtemp + injected `archiveDir`, static fixtures, semantic + `cause` + errno assertions) fully verifies the branch behaviour. **A benchmark is deferred until the reader plus the Slice-4 rows-projection adapter are wired into the live settlement source-load path**, where it is measured as the Stage-2E-B source-load category over synthetic per-date fixtures — the correct, non-premature place to characterize it.

# Carry-forward

Owned by later slices (unchanged by this review):
- **Slice-4 rows-projection adapter** — MUST: translate strict-`null` (ENOENT/absent) → `[]` (benign skip); propagate strict-throw → `source_load_failed`; project the four tabs (`fh/over15/over25/sh`) → `FootyMatchRow[]` with `matchId` dedup; **read the partition once per run** (no N× re-read); preserve the single-async-read profile.
- **Benchmark execution** — measure the wired reader+adapter as the Stage-2E-B source-load cell (≥100-sample tail-confident runs).
- Unchanged deferrals: route-entry capture (with CF-1 wall-clock guard), freshness policy, partition observability/path-parity, dry-run/canary/FULL_WRITE, production readiness gates, PostgreSQL evidence adapter, deployment, capture full-write (gated on unbuilt M4→M5), per-caller dual-reader deprecation evaluation.

# Verdict

The proposed strict daily-archive reader **preserves current performance characteristics** (identical single async read / single parse, async non-blocking, per-date-bounded, stateless, no extra syscall, no copy, no cache, no logging) **while adding correct absent-vs-fault failure semantics** at negligible O(1) cost. It is additive, dormant, minimal, and zero-blast-radius. Unit tests are sufficient; the benchmark is correctly deferred to when the reader plus the Slice-4 adapter are wired into the live source path.

**Explicit confirmations (re-verified against current source):**
- one asynchronous filesystem read — ✓
- one JSON parse — ✓
- no pre-stat or access call — ✓
- no retries — ✓
- no object copy — ✓
- no cache — ✓
- no logging in the primitive reader — ✓
- O(1) primitive object-shape check — ✓
- archive remains bounded per date — ✓
- no benchmark is required while dormant — ✓
- benchmark is deferred until reader plus adapter are wired — ✓
- future adapter must read the partition once per run — ✓
- strict reader is not directly injectable into the row-loader seam — ✓
- zero blockers — ✓ (blocker count: 0)

This is a documentation-persistence review; it authorizes no implementation and modifies no runtime, test, planning, or closure file.

PASSED
