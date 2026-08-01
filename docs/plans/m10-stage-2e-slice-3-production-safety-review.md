# M10 Stage 2E — Slice 3 Planning (Strict Daily-Archive Reader) — Independent Production-Safety Review

**Document type:** Independent production-safety review (documentation-only, persisted record). **No runtime, tests, scripts, configuration, schemas, migrations, routes, cron, flags, deployment files, the planning document, the closure document, or any other file were modified in producing this record.** The only file created is this document.
**Sprint / Milestone / Stage / Slice:** Sprint 23B · M10 · Stage 2E · Slice 3 (planning).
**Reviewer:** Claude 3 (independent production safety).
**Date:** 2026-07-31.
**Method:** the previously-completed review is persisted here; every material claim was **re-verified against current repository source** (`file:line`) this pass, and reconciled with `docs/plans/m10-stage-2e-slice-3-planning.md` and its `…-planning-closure.md`. This document performs no new review from scratch and authorizes no implementation.
**Re-inspected this pass:** `lib/footystats/dailyArchive.ts` (reader + `ARCHIVE_DIR`), all `readDailyArchive` callers, `lib/evidence-capture/candidates/completed-rows.ts` (settlement loader), both cron routes, `lib/evidence-capture/config.ts` (flags), the planned hermetic test contract.

---

# Production Findings

- **Primary question — Can Slice 3 be implemented with zero production behaviour change? YES.** Slice 3 is a single **additive, dormant** pure function `readDailyArchiveStrict(date, archiveDir?)` placed beside the untouched fail-open `readDailyArchive` (`dailyArchive.ts:71-79`). It has no runtime caller, no import-time execution, no route/cron/flag/schema/archive-format change, and is trivially reversible. Every production behaviour is preserved.
- **`dailyArchive.ts` is a production-bundled module** — imported by six production modules (`homepage/trustPerformance.ts`, `admin-dashboard/queries.ts`, `calibration-intelligence/queries.ts`, `footystats/client.ts`, `archive/load.ts`, `evidence-capture/source.ts`). The new function therefore **ships in the production bundle** but is **behaviourally dormant** (no caller; the module's only top-level statement is a pure `const ARCHIVE_DIR = path.join(process.cwd(),"data","daily-archives")`, `:7`). **Bundle presence ≠ activation.** (Directly analogous to Slice 2's additive-dormant `runner.ts` seam.)
- **Caller count is 6 external callers** (re-verified by grep), not 7 — the seventh "file" is `dailyArchive.ts` itself, the *defining* module, which does **not** call the reader (`:71` is the definition only). The plan/closure corrected this (Correction A). All six use `await readDailyArchive(...)` and rely on the fail-open `null`.
- **The strict reader cannot be accidentally wired into the settlement loader.** `createCompletedRowLoader`'s injected reader is typed `readRows: (date) => Promise<readonly FootyMatchRow[] | null>` (`completed-rows.ts:132`), whereas the strict reader returns `Promise<DailyArchive | null>` (`dailyArchive.ts:13` type). The types are incompatible **and** the `null` semantics diverge (strict `null` = *absent*; loader `null` = *fail-closed* `source_load_failed`). A naive direct injection would both fail typecheck and, if forced, fail-close every legitimately-absent day — so a Slice-4 rows-projection adapter is required and is correctly deferred (Correction I). This reinforces zero-production-caller safety.
- **Correctness rationale is real and source-grounded.** The loader seam is genuinely fail-closed (`completed-rows.ts:150-168`: reader throw **or** `null` → `ProducerError("source_load_failed")`, never a silent `[]`), while the only reader collapses absent-vs-faulted (`readDailyArchive` bare `catch { return null }`). A reader that distinguishes ENOENT (absent) from a fault (throw) is a genuine prerequisite for any correct activation; Slice 3 supplies exactly that primitive and nothing more.

# Failure Classification

The frozen classification is **fail-closed and complete**; **no error can be silently interpreted as "no data"** — the strict reader returns `null` **only** for ENOENT, and every other condition throws (verified against the frozen contract §C and the current fail-open reader it must diverge from):

| Case | Classification | Assessment |
|---|---|---|
| Legitimately absent partition (ENOENT) | return `null` | ✅ the **sole** meaning of `null` |
| Malformed archive (JSON.parse fails) / empty file | throw | ✅ not `null` |
| Filesystem error (EIO/EBUSY/EISDIR) | throw | ✅ any non-ENOENT `code` throws |
| Permission error (EACCES/EPERM) | throw | ✅ throws |
| Unexpected shape — parsed `null` / primitive / **array** | throw | ✅ predicate `parsed===null \|\| typeof!=="object" \|\| Array.isArray(parsed)` rejects arrays (Correction C; `DailyArchive` is a plain non-array object, `:13`) |
| Valid non-array archive object | return value | ✅ |

**Residual-risk determination:** the only way an error could still become a silent "no data" is if the implementation copied the fail-open bare-`catch { return null }` pattern instead of inspecting `error.code`. The frozen contract mandates the `code === "ENOENT"` check with **original error preserved as `cause`** (Correction D), and the frozen test matrix includes the exact regression guard (same malformed fixture → fail-open `null` vs strict **throw**). With that check, **no non-ENOENT fault is ever swallowed to `null`.** Verdict: fail-closed semantics are sound.

# Dormancy Verification (re-verified from source)

| Explicit item | Result | Evidence |
|---|---|---|
| Production behaviour remains unchanged | ✅ | `readDailyArchive:71-79` unchanged; the 6 callers byte-unchanged; additive-only |
| Strict reader has zero production callers | ✅ | `grep readDailyArchiveStrict` over `lib/ app/` → **none**; type-incompatible with the only would-be seam |
| Existing production reader untouched | ✅ | `dailyArchive.ts:71-79` |
| All existing reader callers untouched | ✅ | 6 external callers import the same symbol; a sibling export changes none |
| Production bundle presence ≠ activation | ✅ | bundled (module is prod-imported) but uncalled + no import-time execution → inert |
| No import-time IO or parsing | ✅ | module top-level = imports + one pure `const path.join` (`:7`); reader/saver are definitions, not invocations |
| No cron / scheduler / route change | ✅ | routes bare — `runEvidenceCaptureJob()` / `runPredictionSettlementJob()` (`route.ts:13`) |
| No feature-flag change | ✅ | `config.ts:80-81,100,107` `readFlag(EVIDENCE_*_ENABLED)` unchanged |
| No production archive reads introduced | ✅ | dormant; reader touches FS only when called (no caller) |
| No production archive writes introduced | ✅ | read-only primitive; no `save`/append added |
| No database access | ✅ | pure FS read + `JSON.parse` |
| No FULL_WRITE / canary / activation / deployment | ✅ | plan/closure §Non-Authorizations; none exercised |
| No schema / migration / archive-format change | ✅ | same `DailyArchive` shape (`:13`); no new field/DDL |
| Rollback trivial | ✅ | delete the function + test; no data/config/state |

# Test Isolation

The frozen test contract (planning §F / closure §Frozen Test Contract) is **hermetic and satisfies every isolation requirement** — which is achievable **only because** the strict reader takes an optional injectable directory:

- **Optional directory injection enables `mkdtemp` tests** — ✅ the frozen signature `readDailyArchiveStrict(date, archiveDir?)` (default = production `ARCHIVE_DIR`) lets tests point the reader at a `mkdtemp` dir. This is the pivotal correction (raised in the review, incorporated as Correction B/F): without it, `ARCHIVE_DIR` (`:7`, a module-load `process.cwd()`-bound const) would be non-injectable and hermetic testing impossible.
- **Tests never touch `data/daily-archives`** — ✅ synthetic archive files are written **directly** into the temp dir; the contract explicitly forbids the production path.
- **Tests never use `process.chdir`** — ✅ explicitly forbidden (and it would be ineffective anyway, since `ARCHIVE_DIR` is captured at module load); injection replaces it.
- **No `saveDailyArchive` for fixtures** — ✅ correctly excluded (it writes to the hardcoded `ARCHIVE_DIR` and stamps a non-deterministic `Date.now` `savedAt`); tests write static synthetic JSON instead.
- **No network / database; deterministic cleanup; static deterministic fixtures** — ✅ pure FS over a temp dir, removed on completion.
- **Required guard identified:** the injectable `archiveDir?` is the required guard that makes all of the above true; the ≥17-case matrix (incl. non-ENOENT fault via reading a directory / EISDIR, `cause`/`code` assertions, and the dormancy/zero-caller check) enforces the contract without over-specifying incidental message text.

# Operational Risks (deployed tomorrow, unused)

- **Startup risk: NONE** — `dailyArchive.ts` is already production-loaded; a new function definition adds no startup execution.
- **Import-time execution risk: NONE** — only top-level statement is `const ARCHIVE_DIR = path.join(...)`; the new function is not invoked at load.
- **Filesystem access risk: NONE while unused** — the reader touches the FS only when called; it has no caller.
- **Bundle/build risk: NEGLIGIBLE** — ships as dead code in the bundle (dormant); pure TS, typechecks; no build-graph change.
- **Logging risk: NONE** — frozen §J forbids logging in the primitive (single read + single parse; no pre-stat/access/retry/copy/cache/log).
- **Production path risk: NONE** — no production code path reaches it (type-incompatible with the only seam).
- **Rollback risk: NONE (trivial)** — pure additive revert; no data/config/state to unwind.

# Planning Corrections Verification

The corrections raised in the review are confirmed **incorporated** into the amended planning document and re-verified against source this pass (via the closure's Corrections table §A–L):

| Correction | Substance | Verified |
|---|---|---|
| **A** Caller count → **6 external** (defining module excluded) | grep this pass returns exactly the 6 external files | ✅ source-verified |
| **B / F** Signature `readDailyArchiveStrict(date, archiveDir?)`, default = prod dir; hermetic tests via injected dir; never `data/daily-archives`; never `chdir`; never `saveDailyArchive` | frozen contract §Frozen Reader/Test Contract | ✅ resolves the test-hermeticity gap |
| **C** Reject-array / non-object → throw; non-array object → return; no deep validation | `Array.isArray` predicate; `DailyArchive` is a plain object (`:13`) | ✅ |
| **D** Preserve original error as `cause`; keep errno; no custom error class | frozen §C/§D | ✅ |
| **I** Strict reader **not** directly injectable into the loader (type + `null`-semantics mismatch) → Slice-4 adapter | `completed-rows.ts:132` (`FootyMatchRow[] \| null`) vs `DailyArchive \| null` | ✅ source-verified |
| **K** Bundle-present but behaviourally dormant; no import-time IO | module top-level pure | ✅ source-verified |

All five consolidated review verdicts report **0 blockers**; every "CONDITIONALLY" qualifier attaches to these planning corrections, which are now applied — none is a design defect. (Audit-trail note: only the Test-Strategy review is persisted as a standalone doc; the other four verdicts are consolidation-provided — a non-blocking audit follow-up to persist them, recorded in the closure Carry-forward.)

# Carry-forward

Owned by later slices, unchanged by this review: the **Slice-4 rows-projection adapter** (strict `null`/absent → `[]`; strict throw → propagate; tabs → `FootyMatchRow[]`; dedupe `matchId`; single read/run) — the direct consumer bridging the strict reader to the fail-closed loader; route-entry `deadlineAnchorMs` capture (with the CF-1 wall-clock guard); freshness/stale policy; partition observability / prepare↔reader path parity; dry-run; canary; FULL_WRITE; benchmark execution + production-readiness gates; PostgreSQL evidence adapter; deployment; capture full-write (gated on unbuilt M4→M5); per-caller dual-reader deprecation evaluation for `readDailyArchive`. **No activation, canary, or FULL_WRITE authorization is granted or implied.** Implementation is not authorized by this review (the planning closure authorizes only the additive dormant primitive + its hermetic tests).

# Verdict

**Zero production behaviour change is achievable and verified.** Slice 3 is purely additive, fully dormant (no caller, no import-time IO/parsing, bundle-present-but-inert), fail-closed by classification (only ENOENT → `null`; every non-ENOENT fault throws with `cause` preserved), touches no route/cron/scheduler/flag/schema/archive-format, is hermetically testable via the injected `archiveDir?` (temp dir, synthetic files, never `data/daily-archives`, never `process.chdir`, no network/db), and is trivially reversible. Every material claim was re-verified against current repository source; the review's required corrections are confirmed incorporated into the frozen plan.

**Blocker count: 0.**

Implementation is not authorized by this review.

PASSED
