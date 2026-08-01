# M10 Stage 2E — Slice 3 Planning: Strict Daily-Archive Reader

**Document type:** Planning only. Repository-grounded. No runtime, tests, production behaviour, schema, archive, evidence contract, or deployment changed or proposed-for-change in this document. The only file created is this plan.
**Sprint / Milestone / Stage / Work:** Sprint 23B · M10 · Stage 2E · Planning · Slice 3.
**Author:** Claude 1.
**Date:** 2026-07-31.
**Method:** every claim below was read from current repository source (`file:line`); candidate slices were derived from the Slice-2 closure carry-forward and the 2E-A closure deferral buckets, not assumed.

---

# Executive Summary

Slices 1 and 2 are **FROZEN**: the benchmark framework, measurement layer, route-entry deadline composition (F-C closed), raw-sample collection, CLI-only synthetic benchmark execution, and the additive `deadlineAnchorMs` runtime seam are all in place with zero blockers (1837/1837, typecheck/lint clean).

Deriving the next increment from the repository, the **smallest production-safe additive slice is the strict daily-archive reader** — `readDailyArchiveStrict(date)` — a new, dormant, independently-testable sibling to the existing fail-open `readDailyArchive`. It is named directly by three consolidated carry-forwards (Slice-2 **CF-B**, 2E-A **F-D**, and the 2E-A activation plan's own **Gate C**), and the repository proves *why it is the correct next step*: the production completed-rows loader (`createCompletedRowLoader`) is **fail-closed** (a `null` reader result raises `ProducerError("source_load_failed")`), but the only available reader (`readDailyArchive`) is **fail-open** — it returns `null` for **both** a legitimately-missing partition (ENOENT) **and** a corrupt/IO fault, collapsing the two cases. Until a reader can distinguish "partition absent → empty/skip" from "partition faulted → fail closed," no activation path can behave correctly. Slice 3 supplies exactly that primitive and nothing more.

The slice adds one pure function, changes no existing function (the fail-open reader and its **6 external callers** are untouched → zero blast radius), touches no flag/route/cron/schema/archive/contract, activates nothing, and is provable in isolation (ENOENT → absent; malformed/IO → throw; valid → archive). *(See the 2026-07-31 Planning Amendment §A: the caller count is 6 external callers; the defining module `dailyArchive.ts` is not a caller.)*

**Verdict: Slice 3 Ready.**

---

# Repository State

Verified from source this pass:

| Fact | Evidence |
|---|---|
| Fail-open reader collapses absent vs faulted | `lib/footystats/dailyArchive.ts:71-79` — `readDailyArchive` does `JSON.parse(...) as DailyArchive` inside a bare `try { … } catch { return null }`; ENOENT, malformed JSON, and IO error all return `null`. |
| No strict variant / no ENOENT handling exists | grep `readDailyArchiveStrict` / `ENOENT` / `.code ===` across `lib/footystats/` + `completed-rows.ts` → none. |
| Consumer seam is fail-closed on `null` | `lib/evidence-capture/candidates/completed-rows.ts:145-168` — `createCompletedRowLoader` raises `ProducerError("source_load_failed")` on a reader **throw OR `null`** result; never a silent empty `[]`. |
| Loader is dormant (injected reader, no route) | `completed-rows.ts:130` — "injected by the caller, never wired into a route by this stage"; `readRows: (date) => Promise<readonly FootyMatchRow[] | null>`. |
| Archive location + shape | `dailyArchive.ts:7` `ARCHIVE_DIR = data/daily-archives`; `:13` `DailyArchive` type (has `savedAt`, `summary`, `fh/over15/over25/sh`). |
| Fail-open reader has broad blast radius | `readDailyArchive` referenced in 7 files: **6 external callers** (`admin-dashboard/queries.ts`, `archive/load.ts`, `calibration-intelligence/queries.ts`, `homepage/trustPerformance.ts`, `evidence-capture/source.ts`, `footystats/client.ts`) + the **defining module** `footystats/dailyArchive.ts` (not a caller). All external callers rely on fail-open null. *(Amendment §A, 2026-07-31.)* |
| Runtime seam from Slice 2 (frozen) | `lib/jobs/runner.ts:314-315` fail-safe anchor; `:388,:491` `now = options?.now ?? Date.now` (the CF-1 wall-clock domain the *future* activation anchor must honour). |
| Green baseline | Slice-2 closure: 1837/1837, typecheck exit 0, lint clean, repo artifacts clean. |

---

# Why Slice 3 Exists

Three consolidated carry-forwards name the same primitive, and the repository shows it is a *hard prerequisite* for any correct activation:

- **Slice-2 closure CF-B** — "Strict daily reader (`readDailyArchiveStrict`, additive sibling to the untouched fail-open `readDailyArchive`)."
- **2E-A closure F-D** — "Migration + the plan's own Gate C: `readDailyArchiveStrict` (ENOENT→empty; malformed/IO→throw), additive → 2E-B implementation."
- **2E-A activation plan Gate C** — a strict reader is a named activation gate.

**The correctness argument (from source, not assumption):** activation will inject a production reader into `createCompletedRowLoader`. That loader is deliberately fail-closed: a `null` from the reader becomes `source_load_failed`. With today's fail-open `readDailyArchive`, a **legitimately-empty day** (no partition written yet → ENOENT → `null`) is **indistinguishable** from a **corrupt partition** (malformed JSON → `null`). Wiring the fail-open reader would therefore either (a) fail-close on every legitimately-absent partition (wrong — a no-data day must skip, not error), or (b) force the loader to treat `null` as empty (wrong — a corrupt partition would then silently produce an empty success, defeating fail-closed). The **only** correct resolution is a reader that returns a distinct "absent" signal for ENOENT and **throws** for a genuine fault. That reader does not exist yet; Slice 3 builds it. It is the smallest unit that unblocks activation without performing any activation.

Choosing this over the alternatives is deliberate (see Out of Scope): every other remaining item either touches production routes (not dormant), depends on this reader, or is benchmark-execution/deployment work outside an additive code slice.

---

# Scope

**Slice 3 = one new pure function: `readDailyArchiveStrict(date: string): Promise<DailyArchive | null>`** in `lib/footystats/dailyArchive.ts`, beside (not replacing) `readDailyArchive`.

Contract (the whole point of the slice — the disambiguation):
- **Partition absent (ENOENT only)** ⇒ resolves `null`. This is the *sole* meaning of `null` for the strict reader (documented divergence from the fail-open reader, whose `null` means "anything went wrong").
- **Partition present but faulted** — malformed JSON, IO/permission error, or a parsed value that is not a non-null object ⇒ **throws** (the original error preserved as `cause` where applicable).
- **Partition present and valid** ⇒ resolves the parsed `DailyArchive`.

Design notes bounding the slice:
- **Additive sibling, never a modification.** `readDailyArchive` and its 6 external callers are byte-unchanged → zero behavioural blast radius, fully dormant.
- **Minimal validation only.** The fault path throws on `JSON.parse` failure and on a non-object parse result. It does **not** perform deep schema validation of `DailyArchive` fields — that would edge toward evidence-contract validation and is explicitly deferred. "Malformed" = un-parseable or not-an-object, nothing more.
- **ENOENT detection** via the Node error `code === "ENOENT"`; any other `code` (EACCES, EISDIR, …) is a fault → throw.
- **No new type, no signature change** to any existing export. Returns the existing `DailyArchive | null` shape.
- **Dormant:** the function has **no caller** in this slice — no route, cron, job, flag, or existing function invokes it. It is a library primitive that a later activation slice will inject into `createCompletedRowLoader` via a thin rows-projection adapter (that adapter is *not* in this slice).

That is the entire runtime surface of Slice 3.

---

# Out of Scope (explicitly deferred, with owner)

Derived from the carry-forward; each is deferred because it violates a Slice rule (activation / route / deployment / benchmark-execution) or depends on this reader:

- **Rows-projection adapter** for the completed-rows seam (`FootyMatchRow[]` from the strict archive, ENOENT→`[]`). Natural *next* consumer of this reader; it reaches into the evidence-source projection and is activation-prep → **Slice 4 / activation**.
- **CF-A / route-entry capture** — wiring `deadlineAnchorMs` from a real handler. Touches production routes and needs the **CF-1 wall-clock** (`Date.now`) domain guard → **not dormant → activation slice**.
- **F-B source-freshness policy** — `savedAt`/date threshold → `run_degraded`/defer on stale partitions. Needs `run_degraded` plumbing + a policy decision → **activation slice (+ test)**.
- **F-A missing-partition observability & prepare↔reader path parity** → **activation implementation**.
- **CF-C dry-run / CF-D canary** cells and paths → **later slices** (no write path exercised here).
- **CF-E FULL_WRITE** — remains unauthorized → **activation + evidence gate**.
- **CF-F ≥100-sample tail-confident runs**, **CF-I benchmark contract refinements** → **Stage-2E-B benchmark execution** (execution work, not an additive code slice).
- **CF-G production readiness gates** (lock-contention/production-depth cells, Postgres evidence adapter + read-port resolver, durable job-run store, correction pipeline) → **later stages**.
- **CF-H test hardening** (capture-anchor assertion, raw-CSV parity, subprocess timeout), **CF-I cosmetic** — opportunistic; may ride a later slice, **not pulled into Slice 3**.
- **F-F PM2/emergency-stop, F-H multi-instance contention** → **deployment**.
- **F-J capture full-write** — gated on the unbuilt M4→M5 `deriveCaptureInput` → **future stage**.

---

# Runtime Changes

**Files modified (runtime): one — `lib/footystats/dailyArchive.ts` — add `readDailyArchiveStrict` (additive; no existing line changed).**

- Runtime impact: none until a caller injects it. The function is pure IO + parse; it holds no state, no clock, no flag.
- Production impact: **none.** No flag, cron, route, schema, archive format, or evidence contract changes; the fail-open reader and all 6 external callers are untouched; production stays dormant.
- Operational impact: none.
- Compatibility impact: none — purely additive new export; no public API break; no migration; no archive conversion; PostgreSQL/activation futures preserved (a Postgres archive backend can offer the same ENOENT-vs-fault contract later).

No other runtime file changes. No `scripts/bench/m10/*` change is required (the strict reader is not a benchmark concern; its correctness is a unit-test concern).

---

# Test Strategy

New unit test (e.g. `tests/dailyArchiveStrictReader.test.ts`), synthetic + hermetic, over a `mkdtemp` archive dir (never `data/daily-archives`):

1. **Absent partition ⇒ `null`.** Read a date with no file → resolves `null` (ENOENT path). Distinguishes from fault.
2. **Malformed JSON ⇒ throws.** Write a truncated/garbage file → `readDailyArchiveStrict` rejects (not `null`).
3. **Non-object JSON ⇒ throws.** Write `"null"`/`"42"`/`"[]"`-style valid-JSON-but-not-an-object → rejects.
4. **Valid archive ⇒ archive.** Write a real `DailyArchive` (via `saveDailyArchive` or a fixture) → resolves the parsed object, structurally equal.
5. **Fail-open contrast (regression guard).** The same corrupt file yields `null` from `readDailyArchive` but a **throw** from `readDailyArchiveStrict` — proves the disambiguation and that the fail-open reader is unchanged.
6. **Non-ENOENT IO fault ⇒ throws** (best-effort; e.g. path is a directory / EISDIR) — a fault code other than ENOENT propagates.
7. **Composition intent (documentation test, no wiring):** feeding the strict reader's outputs to the *existing* `createCompletedRowLoader` contract — `null`→ (adapter would map to `[]`), throw→`source_load_failed` — asserted at the seam level without wiring a route.

Determinism: no wall-clock value assertions, no network, no `data/` access, temp-dir only. Regression floor preserved and raised: **≥ 1837 + new tests, zero regressions**; typecheck + lint green. (These are the *targets* for the implementation slice; this planning document runs nothing.)

---

# Operational Safety

- **Dormant:** no production code path reaches `readDailyArchiveStrict`; app startup and every current caller are unaffected.
- **Fail-closed-preserving:** the new reader makes the *future* activation path *more* correct (absent≠faulted) without itself enabling anything.
- **No activation, no flag, no cron, no route, no deployment.** Nothing is turned on.
- **No schema / archive / evidence-contract evolution.** Same `DailyArchive` shape; no new field; no file-format change; no migration.
- **Zero blast radius:** additive-only; the 6 external fail-open callers are byte-unchanged.
- **Reversible:** deleting the new function and its test fully reverts the slice (no data, no config, no state).

---

# Carry-forward (after Slice 3)

Unchanged and still owned by later slices: CF-A route-entry capture (with CF-1 wall-clock guard), the rows-projection adapter, F-B freshness policy, F-A partition observability/path-parity, CF-C dry-run, CF-D canary, CF-E FULL_WRITE, CF-F/CF-I benchmark execution, CF-G production readiness gates, CF-H test hardening, F-F/F-H deployment, F-J capture full-write. Slice 3 removes **only** the "strict reader" item (CF-B / F-D / Gate C) from the list.

---

# Success Criteria

Slice 3 is complete when:

1. `readDailyArchiveStrict` exists in `lib/footystats/dailyArchive.ts`, additive, with the ENOENT⇒`null` / fault⇒throw / valid⇒archive contract.
2. `readDailyArchive` and its 6 external callers are byte-unchanged (verified).
3. The new unit test covers all cases above and passes; full suite green with zero regressions (≥ current 1837 + new).
4. Typecheck exit 0; lint clean.
5. No flag/route/cron/schema/archive/contract/deployment change; the function has no runtime caller (dormant, verified by grep).
6. The reader is confirmed injectable into the *existing* `createCompletedRowLoader` seam contract (documented, not wired).

---

# Stop Conditions

Do **not**, within Slice 3:

- Wire the strict reader into any route, cron, job, `createCompletedRowLoader`, or `source.ts` production path (that is activation → later slice).
- Build the rows-projection adapter, freshness policy, dry-run, canary, or any write path.
- Modify `readDailyArchive` or any of its 6 external callers.
- Add or change any flag, schema, archive format, evidence field, or deployment file.
- Perform deep `DailyArchive` schema validation beyond "parses to a non-null object."
- Execute any benchmark or draw any GO/NO-GO conclusion.

If any of the above appears necessary to make the slice "useful," it is a signal that the work belongs to a later slice — defer it, do not absorb it.

---

# Authorization Gates

- **Authorized by this plan (on approval):** implement Slice 3 exactly as scoped — the additive dormant `readDailyArchiveStrict` + its unit test.
- **NOT authorized:** production activation, route-entry handler wiring, rows-adapter, freshness policy, dry-run, canary, FULL_WRITE, benchmark execution, deployment, capture activation, schema/archive/contract change.
- **Downstream gate:** completing Slice 3 unblocks (but does not authorize) the activation slice's rows-projection adapter + reader wiring, which remains gated on its own plan + 2E-B benchmark evidence.

---

# Planning Amendment (2026-07-31)

This dated amendment incorporates the five-review consolidation corrections and **freezes** the items below. Where an earlier body statement conflicts, this amendment governs. All corrections were re-verified against current repository source before freezing.

## A. Caller count — FROZEN: 6 external callers
`readDailyArchive` is referenced in **7 files**, of which **6 are external callers** — `admin-dashboard/queries.ts`, `calibration-intelligence/queries.ts`, `footystats/client.ts`, `homepage/trustPerformance.ts`, `evidence-capture/source.ts`, `archive/load.ts` — and the **7th is the defining module `lib/footystats/dailyArchive.ts`, which is not a caller.** The correct figure is **6 external callers**. (The Test Strategy review's "7 callers" conflated the defining module; corrected here per the "do not blindly copy" mandate.) All 6 external callers remain byte-unchanged.

## B. Strict reader signature — FROZEN
Conceptually equivalent to:
```
readDailyArchiveStrict(date: string, archiveDir?: string): Promise<DailyArchive | null>
```
- `archiveDir?` exists **solely** for hermetic testing and future controlled composition; its **default preserves the current production archive directory** (`ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives")`, `dailyArchive.ts:7`).
- The existing `readDailyArchive(date)` signature and behaviour remain **unchanged**.

## C. Frozen failure contract
**Storage-independent semantics:** `absent → null` · `fault → throw` · `valid primitive-level archive object → return`.

**Filesystem implementation (frozen):**
| Case | Result |
|---|---|
| ENOENT (file absent) | `null` |
| Malformed JSON | throw |
| Empty file | throw (empty string fails `JSON.parse`) |
| Parsed `null` | throw |
| Parsed primitive (number/string/boolean) | throw |
| Parsed array | throw |
| Parsed non-array object | **return it as `DailyArchive`** |
| Any non-ENOENT filesystem error (EISDIR, EACCES, …) | throw |

**Object predicate (frozen — must explicitly reject arrays):**
```
parsed === null || typeof parsed !== "object" || Array.isArray(parsed)   // → throw
```
**No deep schema validation.** For this primitive reader, **"valid" means: JSON parsed successfully to a non-null, non-array object.** Deep `DailyArchive` field validation remains **deferred** (carry-forward). Verified: `DailyArchive` is a plain non-array object type (`dailyArchive.ts:13`), so the predicate is correct.

## D. Error cause — FROZEN
Every fault throw **must preserve the original error as `cause`** (e.g. `throw new Error(msg, { cause: err })`), preserving the filesystem `errno`/`code` through `cause` where available. **No custom public error class is frozen for Slice 3** (a bare `Error` with `cause` suffices).

## E. Dual-reader documentation — FROZEN (bilateral)
Both functions must be documented as a pair:
- `readDailyArchive` — **fail-open**: `null` may mean **absent OR faulted** (unchanged).
- `readDailyArchiveStrict` — **strict**: `null` means **absent only**; faults **throw**.

`readDailyArchive` is **not deprecated** in Slice 3. Any future deprecation evaluation is **carry-forward** (per-caller).

## F. Hermetic test design — FROZEN
- Use `mkdtemp`; **inject** the temporary archive directory via `archiveDir`.
- Write synthetic files **directly**; never touch production `data/daily-archives`.
- **Never** `process.chdir`; **never** mutate process-wide archive paths.
- **Do not** use `saveDailyArchive` for strict-reader fixtures (its `savedAt` uses `Date.now`; write static fixtures directly instead).
- No network, no database. Clean up temp dirs deterministically.
- Static deterministic fixture content only; do not inject `Date.now`-generated values unless the assertion explicitly normalizes them.

## G. Required test matrix — FROZEN (≥ these cases)
1. Valid synthetic archive object → returns the expected object. 2. Missing file / ENOENT → `null`. 3. Malformed JSON → throws. 4. Empty file → throws. 5. JSON `null` → throws. 6. JSON primitive → throws. 7. JSON array → throws. 8. Non-array object → returns even when not deeply schema-valid (explicitly document deep validation deferred). 9. Portable non-ENOENT fault → throws (prefer **EISDIR** by reading a directory as a file; **do not** depend on `chmod`/permission tests). 10. Parse-fault and IO-fault paths independently proven. 11. Existing fail-open `readDailyArchive` unchanged. 12. Same malformed fixture: fail-open → `null`, strict → throws (exercised without touching production paths). 13. Original error preserved as `cause` where applicable. 14. Strict reader has **zero production callers**. 15. No artifact leaks outside temp dirs. 16. Deterministic and platform-safe. 17. Full regression **≥ 1837** passing tests.
Assert **semantic classification**, **error `cause`**, and **filesystem `code`** where stable; **do not** over-specify incidental error message text.

## H. Dormancy enforcement — FROZEN
Dormancy must be **repository-verifiable and test-enforced**: a static source assertion (or equivalent deterministic check) proving **zero production callers** of `readDailyArchiveStrict`. The symbol may appear **only** in (a) its defining module, (b) its dedicated Slice-3 tests, (c) documentation. **No runtime caller is authorized.**

## I. Loader-seam correction — FROZEN
**Correction:** the strict reader is **NOT directly injectable** into `createCompletedRowLoader`. Verified (`completed-rows.ts:132`): `readRows: (date) => Promise<readonly FootyMatchRow[] | null>`, whereas `readDailyArchiveStrict` returns `DailyArchive | null`; and the two `null`s mean **opposite** things — strict `null` = benign **absent**, loader `null` = **source unavailable → fail-closed**. A **Slice-4 adapter** (out of scope here) must therefore: `strict null/absent → []` · `strict throw/fault → propagate` · project archive tabs → `FootyMatchRow[]` · dedupe `matchId` as required · read the date partition **once per run**. This adapter is **OUT OF SCOPE for Slice 3**. (Supersedes any earlier "injectable into the existing seam" phrasing; Slice-3 confirms only *contract compatibility with a future adapter*, not direct injection.)

## J. Performance — FROZEN
The primitive reader must preserve: **one** async read · **one** JSON parse · **no** pre-stat · **no** access check · **no** retry · **no** object copy · **no** cache · **no** logging in the primitive · **no** benchmark requirement while dormant. A benchmark is **deferred** until the reader + adapter are wired into the settlement source-load path.

## K. Production dormancy — FROZEN (clarification)
The function is added to a **production-imported module** (`lib/footystats/dailyArchive.ts`) and therefore **may appear in the production bundle**. It remains **behaviourally dormant** because it: has **zero callers**; performs **no import-time IO**; performs **no import-time parsing**; changes **no existing reader behaviour**; and changes **no route, cron, scheduler, or flag**. Verified: module top-level is imports + `const ARCHIVE_DIR = path.join(...)` only (pure; no IO at import).

## L. Out of scope — FROZEN
Explicitly out of scope for Slice 3: rows-projection adapter · route-entry deadline capture · wall-clock anchor wiring · freshness policy · partition observability · path-parity gate · dry-run · canary · FULL_WRITE · benchmark execution · production database work · PostgreSQL adapter · migrations · deployment · capture activation · historical rewrite · archive-format evolution · evidence-contract evolution · deep `DailyArchive` schema validation.

---

Slice 3 Ready
