# M10 Stage 2E — Slice 3 Implementation Record: Strict Daily-Archive Reader

**Document type:** Implementation record. Authorized by `docs/plans/m10-stage-2e-slice-3-planning.md` + `…-planning-closure.md` (verdict: SLICE 3 PLANNING FROZEN — IMPLEMENTATION AUTHORIZED).
**Sprint / Milestone / Stage / Slice:** Sprint 23B · M10 · Stage 2E · Slice 3.
**Author:** Claude 1.
**Date:** 2026-07-31.

---

# Executive Summary

Implemented exactly the frozen Slice-3 scope: **one additive, dormant strict daily-archive reader** `readDailyArchiveStrict(date, archiveDir?)` beside the untouched fail-open `readDailyArchive`, plus a dedicated hermetic test file (17 tests) that proves the frozen contract, the dual-reader semantic contrast, error-cause preservation, and **zero production callers** via a deterministic static assertion. The fail-open reader and its **6 external callers are byte-unchanged**. No adapter, wiring, activation, flag, route, cron, schema, archive-format, evidence-contract, migration, or deployment change. Validation: dedicated **17/17**, full suite **1854/1854**, typecheck exit 0, lint clean.

---

# Authorized Scope

Per the frozen plan + closure, authorized work was strictly: (1) the additive dormant `readDailyArchiveStrict` primitive; (2) dedicated hermetic Slice-3 tests; (3) a static dormancy proof of zero production callers; (4) this record + the implementation closure. Everything else (rows-projection adapter, loader/producer/evidence wiring, route-entry capture, cron/scheduler/flags, dry-run/canary/FULL_WRITE, activation, benchmark execution, Postgres/db, migrations, archive/schema/contract changes, `readDailyArchive` deprecation, unrelated refactoring) was **not authorized** and was **not touched**.

---

# Repository Verification

Verified against source before and after editing:

| Fact | Evidence |
|---|---|
| Fail-open reader collapses absent vs fault | `lib/footystats/dailyArchive.ts` `readDailyArchive` — `JSON.parse(...)` in `try { … } catch { return null }`; ENOENT + malformed + IO all → `null` (unchanged). |
| `DailyArchive` is a plain non-array object | `dailyArchive.ts:13` type → reject-array predicate is correct. |
| `ARCHIVE_DIR` default | `dailyArchive.ts:7` `path.join(process.cwd(),"data","daily-archives")` (pure; no import-time IO). |
| 6 external callers | `admin-dashboard/queries.ts`, `calibration-intelligence/queries.ts`, `footystats/client.ts`, `homepage/trustPerformance.ts`, `evidence-capture/source.ts`, `archive/load.ts` — all untouched. |
| Loader seam is fail-closed + typed for rows | `completed-rows.ts:132` `readRows: (date)=>Promise<readonly FootyMatchRow[] \| null>`; not directly injectable (adapter = Slice 4, deferred). |
| Test idioms | `tests/evidenceArchiveFileAdapter.test.ts` — `mkdtempSync` + ENOENT/malformed/EISDIR/`rmSync` patterns reused. |

---

# Runtime Changes

**One runtime file: `lib/footystats/dailyArchive.ts` (additive).**

- Added `export async function readDailyArchiveStrict(date: string, archiveDir: string = ARCHIVE_DIR): Promise<DailyArchive | null>`.
- Added a **comment-only** JSDoc above `readDailyArchive` documenting its fail-open nature (bilateral dual-reader documentation, authorized by frozen plan §E). The `readDailyArchive` **implementation body is byte-unchanged**.
- No other export, type, or line changed.

Signature and behaviour of `readDailyArchive` are preserved; `archiveDir` defaults to the production archive directory and adds no production or import-time IO.

---

# Reader Contract

Storage-independent: `absent → null` · `fault → throw` · `valid non-array object → return`.

Filesystem implementation (as shipped):
- **ENOENT** (`err.code === "ENOENT"`) → resolve `null` (sole meaning of `null`).
- **Malformed JSON** → throw. **Empty file** → throw (empty string fails `JSON.parse`).
- **Parsed `null` / primitive / array** → throw, via the exact predicate `parsed === null || typeof parsed !== "object" || Array.isArray(parsed)`.
- **Non-ENOENT filesystem error** (EISDIR/EACCES/…) → throw.
- **Parsed non-null, non-array object** → return as `DailyArchive`.
- **No deep schema validation** — "valid" = parsed to a non-null, non-array object only. No schema library or validator introduced.

---

# Error Contract

- Every fault throw is a plain `Error` with the original error preserved as **`cause`** (`new Error(msg, { cause: err })`): read faults preserve the fs `ErrnoException` (so `code` — e.g. `EISDIR` — is recoverable via `err.cause.code`); parse faults preserve the `JSON.parse` `SyntaxError`.
- ENOENT is **not** wrapped (it returns `null`, per contract).
- Shape failures (null/primitive/array) throw a plain `Error` with no fabricated cause (no underlying error exists — the parse succeeded).
- **No custom public error class.** **No logging** inside the primitive. Tests assert semantic classification + `cause` + fs `code`, not incidental message text.

---

# Test Implementation

`tests/m10Slice3StrictDailyArchiveReader.test.ts` — 17 tests, `node:test` + `node:assert/strict`, fully hermetic: each writes static fixtures into a fresh `mkdtempSync` dir under `os.tmpdir()` and cleans up with `rmSync` in `finally`. Never touches `data/daily-archives`, never `process.chdir`, never mutates process-wide paths, never uses `saveDailyArchive`, no network/db, no `chmod`.

| # | Case | Result |
|---|---|---|
| 1 | Valid archive object → returns it | ✓ |
| 2 | ENOENT (missing file) → `null` | ✓ |
| 3 | Malformed JSON → throws | ✓ |
| 4 | Empty file → throws | ✓ |
| 5 | JSON `null` → throws | ✓ |
| 6 | JSON primitives (number, string, boolean) → throw (full predicate coverage) | ✓ |
| 7 | JSON array (`[]`, `[1,2,3]`) → throws | ✓ |
| 8 | Non-array object returns even when not deeply valid (proves no deep validation) | ✓ |
| 9 | EISDIR (dir at file path) → throws | ✓ |
| 10 | Parse-fault vs IO-fault independent (distinct causes: `SyntaxError` vs `code EISDIR`) | ✓ |
| 11 | Fail-open `readDailyArchive` body byte-unchanged (static source regression; no `ENOENT`/`archiveDir`) | ✓ |
| 12 | Same malformed content: strict throws (real); fail-open → `null` proven via case-11 static regression | ✓ |
| 13 | Parse-fault throw preserves original error as `cause` | ✓ |
| 14 | EISDIR fault exposes fs `code` through `cause` | ✓ |
| 15 | Zero production callers (static dormancy walk of `lib/`+`app/`) | ✓ |
| 16 | No artifact leaks (temp-only; dir removed on cleanup) | ✓ |
| 17 | Deterministic (repeated reads identical; no clock/random) | ✓ |

**Case-12 note (authorized fallback):** the fail-open `readDailyArchive` uses the module-level `ARCHIVE_DIR` and cannot accept an injected dir; the frozen plan forbids widening its signature and forbids `process.chdir`. The strict side of the contrast is exercised for real hermetically; the fail-open side is proven by the case-11 static source regression (its bare `catch { return null }` collapses the same fault class to `null`). This is exactly the plan's authorized fallback — no production path touched, no signature widened.

---

# Dormancy Proof

Test 15 is a **deterministic static assertion**: it recursively walks `lib/` and `app/` (`readdirSync({recursive:true})`), reads every `.ts`/`.tsx` (excluding `.d.ts`), **excludes the defining module** `lib/footystats/dailyArchive.ts`, and asserts **zero** files reference `readDailyArchiveStrict`. It ignores documentation (`docs/`) and its own test source (in `tests/`, not walked). Independently corroborated by grep: `readDailyArchiveStrict` appears only in `lib/footystats/dailyArchive.ts` (definition) and `tests/m10Slice3StrictDailyArchiveReader.test.ts`. **Zero production callers.**

---

# Performance Invariants

As shipped, the primitive performs exactly **one async read** (`fs.readFile`) + **one `JSON.parse`** + an **O(1)** top-level shape check. No pre-stat, no `fs.access`, no retry, no object copy, no cache, no logging. The optional `archiveDir` is a defaulted parameter — no added production or import-time IO. No benchmark is required while dormant (deferred until reader + adapter are wired into the settlement source-load path).

---

# Files Changed

| File | Type | Change |
|---|---|---|
| `lib/footystats/dailyArchive.ts` | runtime (additive) | +`readDailyArchiveStrict`; comment-only JSDoc above `readDailyArchive` (body byte-unchanged) |
| `tests/m10Slice3StrictDailyArchiveReader.test.ts` | test (new) | 17 hermetic tests + static dormancy + fail-open regression |
| `docs/plans/m10-stage-2e-slice-3-implementation.md` | doc (this record) | — |
| `docs/plans/m10-stage-2e-slice-3-implementation-closure.md` | doc (closure) | — |

No other file changed. No narrowly-scoped test helper was needed (existing repo idioms sufficed).

---

# Validation Results

- Dedicated Slice-3 suite: **17 / 17 pass**.
- Full repository suite (`npm test`): **1854 / 0 / 0** (prior floor 1837 + 17 new = 1854 — the exact expected delta; no baseline drift).
- Typecheck (`npm run typecheck`): **exit 0**.
- Lint (`next lint`): **clean** — no warnings/errors.

---

# Deferred Work (carry-forward, unchanged)

Slice-4 rows-projection adapter (`strict null/absent → []`; `throw/fault → propagate`; archive tabs → `FootyMatchRow[]`; dedupe `matchId`; read partition once/run) · `createCompletedRowLoader` wiring · route-entry capture + wall-clock (CF-1) guard · freshness policy · partition observability / path-parity gate · dry-run · canary · FULL_WRITE · benchmark execution · production readiness gates · Postgres adapter · deployment · capture full-write · future per-caller dual-reader deprecation evaluation · deep `DailyArchive` schema validation.

---

# Scope Compliance

Explicitly:
- **Six existing external callers unchanged** — verified (grep + no edits).
- **Existing fail-open `readDailyArchive` behaviour unchanged** — body byte-unchanged (static regression test 11; only a comment-only JSDoc added above it).
- **Strict reader has zero production callers** — proven (static dormancy test 15 + grep).
- **No adapter or activation implemented.**
- **No route, cron, flag, schema, archive-format, evidence-contract, validation-contract, migration, or deployment change.**
- **No scope deviation.** Only the four authorized files were touched.
