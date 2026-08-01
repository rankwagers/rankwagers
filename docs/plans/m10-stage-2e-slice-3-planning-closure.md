# M10 Stage 2E — Slice 3 Planning Closure (Strict Daily-Archive Reader)

**Document type:** Planning closure. Documentation-only. No runtime, test, flag, route, cron, scheduler, schema, archive-format, evidence-contract, migration, or deployment file was created or modified. Only two files changed: `docs/plans/m10-stage-2e-slice-3-planning.md` (dated amendment) and this closure.
**Sprint / Milestone / Stage / Slice:** Sprint 23B · M10 · Stage 2E · Slice 3.
**Author:** Claude 1.
**Date:** 2026-07-31.
**Method:** every load-bearing claim re-verified against current repository source (`file:line`); **all five** independent review documents read and their verdicts + blocker counts confirmed directly; corrections mapped to the amended plan.

> **Audit-Trail Amendment (2026-07-31).** All five independent Slice-3 planning reviews are **now persisted in the repository** and were verified directly this pass. The earlier statement that only the Test Strategy review was repository-persisted is **superseded** below. Verified verdicts (all **0 blockers**): Architecture **APPROVED**, Production Safety **PASSED**, Performance **PASSED**, Test Strategy **CONDITIONALLY APPROVED** (its conditions already incorporated into the frozen planning amendment), Compatibility **COMPATIBLE**. The prior review-persistence carry-forward is **discharged**. Technical scope, non-authorizations, and the final decision are **unchanged**. Only this closure document was modified by this amendment.

---

# Executive Summary

Slice 3's proposed architecture — **one additive, dormant strict daily-archive reader `readDailyArchiveStrict`** beside the untouched fail-open `readDailyArchive` — is **accepted**. All five independent reviews are now persisted in the repository and report **zero blockers** (Architecture **APPROVED**, Production Safety **PASSED**, Performance **PASSED**, Test Strategy **CONDITIONALLY APPROVED** with its conditions already incorporated into the frozen planning amendment, Compatibility **COMPATIBLE**). All required planning corrections (A–L) have been incorporated into the amended planning document and re-verified against source, including the two substantive source corrections: the caller count is **6 external callers** (not 7 — the defining module is not a caller) and the strict reader is **not directly injectable** into `createCompletedRowLoader` (type + `null`-semantics mismatch → a Slice-4 adapter is required, out of scope).

The slice remains **additive, dormant, independently testable, and reversible**: it changes no existing function, has no runtime caller, performs no import-time IO, and touches no flag/route/cron/schema/archive/contract. Implementation authorization is limited **strictly** to the frozen Slice-3 scope.

**Decision: SLICE 3 PLANNING FROZEN — IMPLEMENTATION AUTHORIZED** (for the additive dormant `readDailyArchiveStrict` primitive + its dedicated hermetic tests only).

---

# Repository Verification

Re-verified this pass (source, not trusted from reviews):

| Claim | Evidence | Result |
|---|---|---|
| Fail-open reader collapses absent vs fault | `lib/footystats/dailyArchive.ts:71-79` — `JSON.parse(...) as DailyArchive` in `try { … } catch { return null }`; ENOENT + malformed + IO all → `null` | ✓ |
| **6 external callers** (not 7) | 7 files reference `readDailyArchive`; 6 external (`admin-dashboard/queries`, `calibration-intelligence/queries`, `footystats/client`, `homepage/trustPerformance`, `evidence-capture/source`, `archive/load`) + the **defining module** `footystats/dailyArchive.ts` (not a caller) | ✓ corrected |
| Loader seam is fail-closed + typed for rows | `completed-rows.ts:132` `readRows: (date)=>Promise<readonly FootyMatchRow[] \| null>`; `:145-168` throw/`null` → `ProducerError("source_load_failed")` | ✓ |
| Strict reader **not** directly injectable | returns `DailyArchive \| null` ≠ seam `FootyMatchRow[] \| null`; strict `null`=absent vs loader `null`=fail-closed | ✓ correction I |
| `DailyArchive` is a plain non-array object | `dailyArchive.ts:13` object type → the reject-array predicate is correct | ✓ |
| No import-time IO | module top-level = imports + `const ARCHIVE_DIR = path.join(process.cwd(),"data","daily-archives")` (pure) | ✓ correction K |
| Strict reader genuinely absent | grep `readDailyArchiveStrict` across `lib/ app/ tests/` → none | ✓ dormancy baseline |
| Slice-1/2 frozen, green baseline | Slice-2 closure: 1837/1837, typecheck 0, lint clean | ✓ |

---

# Proposed Slice

**One new pure function** in `lib/footystats/dailyArchive.ts` (additive sibling, no existing line changed):

```
readDailyArchiveStrict(date: string, archiveDir?: string): Promise<DailyArchive | null>
```

`archiveDir?` defaults to the current production archive directory and exists solely for hermetic testing / future controlled composition. Contract: **absent → `null`; fault → throw; valid non-array object → return.** No deep schema validation. No runtime caller (dormant). Nothing else.

---

# Review Consolidation

All five independent review documents are **now persisted in the repository** and were verified directly this pass:

| # | Review | Path | Verdict | Blockers |
|---|---|---|---|---|
| 1 | Architecture | `docs/plans/m10-stage-2e-slice-3-architecture-review.md` | **APPROVED** | 0 |
| 2 | Production Safety | `docs/plans/m10-stage-2e-slice-3-production-safety-review.md` | **PASSED** | 0 |
| 3 | Performance & Scalability | `docs/plans/m10-stage-2e-slice-3-performance-review.md` | **PASSED** | 0 |
| 4 | Test Strategy | `docs/plans/m10-stage-2e-slice-3-test-strategy-review.md` | **CONDITIONALLY APPROVED** | 0 |
| 5 | Migration & Long-Term Compatibility | `docs/plans/m10-stage-2e-slice-3-compatibility-review.md` | **COMPATIBLE** | 0 |

**Aggregate: 5 reviews, all present, 0 blockers.** The Architecture review upgraded from its prior CONDITIONALLY APPROVED to **APPROVED** once the conditions were incorporated; Production Safety is **PASSED**. The only remaining "CONDITIONALLY" qualifier — Test Strategy — attaches solely to test-plan corrections (C-1…C-8 / TF-1…TF-7), **all of which are already incorporated into the frozen planning amendment** (§B/§C/§F/§G/§H/§I; mapped in *Frozen Test Contract* below); it is not a design or safety defect.

**Audit-trail status (superseding the prior closure pass):** the earlier statement that only the Test Strategy review was repository-persisted is **superseded** — all five standalone review documents now exist in `docs/plans/` and were read and confirmed this pass (paths above). Every substantive review claim was independently re-verified against source; one review's "7 callers" figure was found inaccurate and remains **corrected to 6 external callers** in the frozen plan (Amendment §A) per the "do not blindly copy" mandate. The previous review-persistence carry-forward is therefore **discharged** (see *Carry-forward*).

---

# Planning Corrections Applied

Every consolidated correction is mapped to the amended planning document (`…-slice-3-planning.md`, "Planning Amendment (2026-07-31)"):

| Correction | Where in amended plan | Status |
|---|---|---|
| **A** Caller count → 6 external (defining module excluded) | Amendment §A + Exec Summary + Repository State table + all body occurrences | ✓ applied + source-verified |
| **B** Signature `readDailyArchiveStrict(date, archiveDir?)`, default = prod dir, `readDailyArchive` unchanged | Amendment §B | ✓ frozen |
| **C** Failure contract (ENOENT→null; malformed/empty/null/primitive/array/non-ENOENT→throw; non-array object→return); reject-array predicate; no deep validation | Amendment §C | ✓ frozen |
| **D** Preserve original error as `cause`; keep errno; no custom public error class | Amendment §D | ✓ frozen |
| **E** Bilateral dual-reader docs; no deprecation of `readDailyArchive` (deprecation = carry-forward) | Amendment §E | ✓ frozen |
| **F** Hermetic test design (mkdtemp, injected dir, direct writes, no chdir, no `saveDailyArchive`, no net/db, deterministic cleanup, static fixtures) | Amendment §F | ✓ frozen |
| **G** 17-case required test matrix; assert semantics/cause/code, not incidental message text | Amendment §G | ✓ frozen |
| **H** Dormancy repository-verifiable + test-enforced; symbol only in module/tests/docs | Amendment §H | ✓ frozen |
| **I** Loader-seam correction (not directly injectable; Slice-4 adapter obligation) | Amendment §I + Out-of-Scope | ✓ applied + source-verified |
| **J** Performance invariants (single read/parse; no pre-stat/access/retry/copy/cache/log; no benchmark while dormant) | Amendment §J | ✓ frozen |
| **K** Production dormancy clarification (bundle-present but behaviourally dormant; no import-time IO) | Amendment §K | ✓ applied + source-verified |
| **L** Out-of-scope list (incl. deep schema validation) | Amendment §L + Out of Scope | ✓ frozen |

---

# Frozen Reader Contract

**Storage-independent:** `absent → null` · `fault → throw` · `valid primitive-level (non-array) archive object → return`.

**Filesystem implementation:**
- **ENOENT** → return `null` (the sole meaning of `null` for the strict reader).
- **Malformed JSON** → throw. **Empty file** → throw (empty string fails `JSON.parse`).
- **Parsed `null`** → throw. **Parsed primitive** → throw. **Parsed array** → throw.
- **Parsed non-array object** → return as `DailyArchive`.
- **Any non-ENOENT filesystem error** (EISDIR/EACCES/…) → throw.
- **Predicate:** `parsed === null || typeof parsed !== "object" || Array.isArray(parsed)` → throw.
- **Every throw preserves the original error as `cause`** (errno/`code` preserved); **no custom error class**.
- **"Valid" = parsed to a non-null, non-array object.** Deep field validation **deferred**.

`readDailyArchive` (fail-open, `null` = absent OR faulted) is **unchanged and not deprecated**.

---

# Frozen Test Contract

**Hermetic:** `mkdtemp` + injected `archiveDir`; synthetic files written directly; never production `data/daily-archives`; never `process.chdir` or process-wide path mutation; not `saveDailyArchive` (its `Date.now` `savedAt`); no network/db; deterministic cleanup; static deterministic fixtures.

**Required matrix (≥17):** valid object returns; ENOENT→null; malformed→throw; empty→throw; JSON null→throw; primitive→throw; array→throw; non-array object returns (deep validation deferred, documented); portable non-ENOENT fault→throw (prefer EISDIR via reading a directory, no chmod); parse-fault and IO-fault independently proven; fail-open reader unchanged; same malformed fixture → fail-open null vs strict throw; original error preserved as `cause`; strict reader zero production callers (static/deterministic dormancy check); no artifact leaks outside temp dirs; deterministic + platform-safe; **full regression ≥ 1837**. Assert semantic classification + `cause` + filesystem `code`; do not over-specify incidental message text.

---

# Dormancy and Production Safety

- **Zero runtime callers** — verified absent today; frozen requirement H mandates a repository-verifiable/test-enforced zero-caller check; the symbol may appear only in its module, its tests, and docs.
- **Zero production behaviour change** — no existing function altered; the 6 external fail-open callers are byte-unchanged; no flag/route/cron/scheduler/schema/archive/contract change.
- **Bundle-present but behaviourally dormant** — added to a production-imported module, but performs no import-time IO or parsing (module top-level is pure), so mere presence changes nothing.
- **Reversible** — deleting the function + its test fully reverts the slice (no data/config/state).

---

# Compatibility and Migration

- **No schema change** · **No archive-format change** · **No migration** · **No historical rewrite.**
- **No public API break** — purely additive new export; existing signatures unchanged.
- **Existing fail-open callers unchanged** — all 6 external callers untouched (verified).
- Forward-compatible: a future PostgreSQL/other archive backend can offer the same absent-vs-fault contract; the Slice-4 adapter bridges to the fail-closed loader without any contract change here.

---

# Performance Decision

**Unit testing is sufficient for this dormant slice; benchmarks are deferred.** The primitive is a single async read + single JSON parse with no pre-stat/access/retry/copy/cache/log; while dormant it is on no production path, so there is nothing to benchmark. A benchmark is warranted only once the reader + Slice-4 adapter are wired into the settlement source-load path (measured there, per the frozen 2E measurement layer). Consolidated Performance verdict: **PASSED, 0 blockers.**

---

# Carry-forward

Owned by later slices (unchanged by this closure):

- **Slice-4 rows-projection adapter** (`strict null/absent → []`; `strict throw/fault → propagate`; archive tabs → `FootyMatchRow[]`; dedupe `matchId`; read partition once/run) — the direct consumer that makes the reader usable by `createCompletedRowLoader`.
- **Route-entry capture** + **wall-clock (CF-1) guard** for a production `deadlineAnchorMs`.
- **Freshness policy** (`savedAt`/date threshold → `run_degraded`/defer) · **partition observability / path-parity gate**.
- **Dry-run** · **canary** · **FULL_WRITE**.
- **Benchmark execution** (≥100-sample tail-confident runs; wired source-load measurement) · **production readiness gates**.
- **PostgreSQL evidence adapter** · **deployment** · **capture full-write** (gated on unbuilt M4→M5).
- **Future per-caller dual-reader deprecation evaluation** for `readDailyArchive` (not started; each of the 6 callers assessed individually).
- **Audit-trail — DISCHARGED (2026-07-31):** the four previously non-persisted review documents (Architecture, Production Safety, Performance, Migration/Compatibility) are **now persisted** in `docs/plans/` alongside the Test Strategy review; all five were verified directly this pass. No audit-trail follow-up remains.

---

# Explicit Non-Authorizations

This closure does **NOT** authorize: production activation · route or cron wiring · feature-flag enablement · canary · FULL_WRITE · deployment · migrations · archive rewrites · evidence-contract changes · the rows-projection adapter · benchmark execution · PostgreSQL/database work · deep `DailyArchive` schema validation · capture activation.

---

# Final Decision

**Gate check:**
- All five review documents **persisted in the repository** and verified directly, with **0 blockers** — ✓ (Architecture APPROVED, Production Safety PASSED, Performance PASSED, Test Strategy CONDITIONALLY APPROVED [conditions incorporated], Compatibility COMPATIBLE).
- Every required planning correction (A–L) incorporated into the amended plan and re-verified against source — ✓.
- Proposed slice remains **additive, dormant, independently testable, reversible** — ✓ (source-verified).
- Implementation authorization limited strictly to the frozen Slice-3 scope — ✓.

**Authorized (and only this):** implementation of the additive, dormant `readDailyArchiveStrict` primitive (per the frozen contract §Frozen Reader Contract) and its dedicated hermetic tests (per §Frozen Test Contract). **No other work is authorized.**

---

SLICE 3 PLANNING FROZEN — IMPLEMENTATION AUTHORIZED
