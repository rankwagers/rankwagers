# M10 Stage 2E — Slice 3 (Strict Daily-Archive Reader) — Migration & Long-Term Compatibility Review

**Document type:** Independent Migration & Long-Term Compatibility Review — persisted. Read-only: no runtime, test, planning, or closure document was modified. The only file created is this review.
**Sprint / Milestone / Stage / Slice:** Sprint 23B · M10 · Stage 2E · Slice 3 (planning).
**Author:** Claude 6.
**Date:** 2026-07-31.
**Inputs:** `docs/plans/m10-stage-2e-slice-3-planning.md` (amended 2026-07-31) + `docs/plans/m10-stage-2e-slice-3-planning-closure.md`.
**Method:** the prior review's conclusions are persisted, with every material claim **re-verified against current source** (`file:line`) and reconciled to the amended plan + closure. Two closure refinements are adopted: **6 external callers** (the defining module is not a caller) and the strict reader is **not directly injectable** into `createCompletedRowLoader` (a Slice-4 rows-projection adapter is required).

---

## Primary Question

*Does adding a dormant strict reader preserve backward compatibility while providing a clean path for later activation?* **Yes — unconditionally on the migration/compatibility axis.** The slice adds one additive, dormant, reversible library primitive that resolves the absent-vs-fault ambiguity the fail-closed completed-rows loader requires, without changing any existing function, contract, schema, archive format, or caller.

## Repository Re-Verification (this pass)

| Claim | Evidence | Result |
|---|---|---|
| Strict reader genuinely absent (dormancy baseline) | grep `readDailyArchiveStrict` across `lib/ app/ tests/` → none | ✓ not yet implemented |
| Fail-open reader unchanged (collapses absent+fault) | `lib/footystats/dailyArchive.ts:71-79` — `JSON.parse(...) as DailyArchive` in `try{…}catch{return null}` | ✓ |
| **6 external callers** + defining module | `admin-dashboard/queries`, `archive/load`, `calibration-intelligence/queries`, `evidence-capture/source`, `footystats/client`, `homepage/trustPerformance` + defining `footystats/dailyArchive.ts` | ✓ (corrected from 7) |
| Loader seam typed + fail-closed on throw **and** null | `completed-rows.ts:132` `readRows:(date)=>Promise<readonly FootyMatchRow[]\|null>`; `:141,154,159-161` throw/`null` → `ProducerError("source_load_failed")` | ✓ |
| Strict reader **not** directly injectable | returns `DailyArchive\|null` ≠ seam `FootyMatchRow[]\|null`; strict `null`=absent vs loader `null`=fail-closed → Slice-4 adapter required | ✓ |
| Writer atomic (external corruption, not writer-induced) | `dailyArchive.ts:66-68` tmp+rename | ✓ |
| `DailyArchive` shape unchanged | `dailyArchive.ts:13-21` (`date/savedAt/summary/fh/over15/over25/sh`) | ✓ |
| No PostgreSQL adapter for the daily-archive source or the evidence store | grep `createPostgres` hits only unrelated subsystems (acca/builder-approval/combo/snapshots), none in the evidence/daily-archive path | ✓ |
| Evidence/validation contracts untouched (source-side slice) | `types/evidence/validation.ts` Jul 28, `dailyArchive.ts` Jul 1 — both unchanged | ✓ |

The plan's central correctness argument holds against source: the loader fail-closes on `null`, so wiring the fail-open reader would either error on every legitimately-absent day or force `null→[]` and silently swallow a corrupt partition. Only an absent→`null` / fault→throw reader resolves this; Slice 3 supplies exactly that primitive and nothing more.

---

# Compatibility Findings

- **Existing archives remain readable.** The strict reader parses the identical `DailyArchive` JSON via the same `JSON.parse`; a valid partition returns a structurally-equal object. No field added, removed, or renamed.
- **Existing fail-open callers remain unchanged.** `readDailyArchive` and all **6 external callers** are byte-unchanged; the new function has zero callers (dormant). Zero behavioural blast radius.
- **No public API break.** Purely additive new export. The amended signature `readDailyArchiveStrict(date, archiveDir?)` uses an **optional** second parameter defaulting to the production archive dir (for hermetic testing) — additive, no existing signature altered.
- **Strict adoption can occur per caller later.** Because both readers coexist on the same return type, each of the 6 external callers may migrate independently, on its own schedule, or never — no flag-day, no forced cutover.
- **Future rows-projection adapter can consume it (Slice 4).** The reader is **not** directly injectable (type + null-semantics mismatch); the Slice-4 adapter bridges `strict null (absent) → []` and `strict throw (fault) → propagate → source_load_failed`, matching the loader's existing fail-closed contract (`completed-rows.ts:151-168`). No Slice-3 rework is implied.
- **Freshness policy remains separable.** F-B (`savedAt`/date threshold → `run_degraded`/defer) layers above the read; the strict reader supplies the parsed `savedAt`, adds no freshness logic, forecloses nothing.
- **dry-run / canary / FULL_WRITE remain separable.** None is touched or enabled; no write path is exercised; the reader is read-only.
- **Correction and retention models remain unchanged.** Those are evidence/validation-side; the daily source archive is a distinct subsystem the slice only reads. No correction field, revision, or retention behaviour is touched.

# Migration Risk

**None. Zero blockers.**

- **No historical archive rewrite** — existing files are read as-is by both readers.
- **No migration** — one additive function; no DB, archive, config, reader, or writer migration.
- **No schema-version change** — no version field introduced or required; `DailyArchive` is structurally identical.
- **No archive-format change** — same on-disk `<date>.json`, same JSON encoding.
- **No evidence-contract change** — `types/evidence/*` untouched; the slice is source-side.
- **No historical reprocessing** — nothing consumes the reader in this slice; later consumption re-reads the same partitions with no re-derivation.
- **Reversible** — deleting the function + its test fully reverts the slice (no data, config, or state).

# Dual-Reader Contract

Coexistence of `readDailyArchive` and `readDailyArchiveStrict` is the one long-term surface warranting attention; the amended plan handles it adequately.

- **The real risk is a divergent-`null`-on-a-shared-type fork.** Both return `DailyArchive | null`, but `null` means opposite things — fail-open `null` = "absent OR faulted"; strict `null` = "absent only." The safe misuse direction (copying a fail-open idiom onto the strict reader) merely makes faults louder (throw). The unsafe direction — wrapping the strict reader in `try/catch → null` and re-collapsing the distinction — is a coding-review concern, not a contract defect.
- **Naming + bilateral documentation are sufficient for Slice 3.** It is a single dormant function with zero callers; there is no live misuse surface. The amended plan (Correction **E**) mandates **bilateral** docs — a cross-reference at *both* reader sites so the fork is discoverable from `readDailyArchive` as well — which is the correct mitigation. Type-level branding or a lint rule would be premature.
- **No deprecation is authorized in Slice 3.** The amended plan explicitly keeps `readDailyArchive` un-deprecated and defers any per-caller deprecation *evaluation* to a carry-forward. This correctly avoids premature migration work.

# Error Contract

Frozen now vs deferred, as reconciled with the amended plan (Correction **D**):

**Frozen now (load-bearing):**
- **The throw-vs-null semantic** — ENOENT (and only ENOENT) → `null`; every other errno / non-JSON / empty / parsed-`null` / parsed-primitive / parsed-array → **throw**; parsed non-array object → return. This is the entire purpose of the slice.
- **Original fault preserved as `cause`, with errno/`code` recoverable** — the amended plan freezes "always preserve the original error as `cause`; keep errno." This is the critical freeze: it lets future freshness/observability (F-A/F-B) recover the filesystem `code` via `err.cause` without ever changing the strict reader's throw shape (closing an otherwise-real future-migration trap).

**Deferred (additive later, no contract break):**
- **No custom public error class is frozen** — the plan deliberately throws the original error (cause-preserving) rather than committing to a bespoke class. A structured error class / `{code, date, path}` context may be layered later *around* the throw without breaking the throw-vs-null contract, precisely because `cause` is guaranteed.
- **Deep `DailyArchive` schema validation** — correctly excluded; "parsed to a non-null, non-array object" is the right fault boundary.

# Future Extensibility

- **Absent-vs-fault is the storage-independent contract; ENOENT is only the filesystem implementation of "absent."** The portable semantics (`absent → null` / `fault → throw` / `valid → return`) are what activation and the Slice-4 adapter depend on. A future PostgreSQL or other source backend implements the same semantics (no-row → null, query/connection error → throw) as a *different* function — it need not reuse `readDailyArchiveStrict`.
- **Strict reader coupled to the filesystem is appropriate, not a trap.** It is a concrete reader; the reusable abstraction is the semantic contract plus the storage-agnostic `readRows` seam, not this function. No `fs` assumption leaks into the seam.
- **PostgreSQL and future source adapters remain unobstructed.** The daily source archive is orthogonal to any future PG evidence adapter; neither is built, and Slice 3 forecloses neither. The Slice-4 adapter bridges to the fail-closed loader with no contract change here.
- **Everything downstream stays separately layerable** — rows-projection adapter, freshness, partition observability, route-entry capture, dry-run/canary/FULL_WRITE. Slice 3 depends on none and blocks none.

# Planning Corrections Verification

The prior review raised three corrections (RPC-1 bilateral dual-reader docs; RPC-2 unconditional `cause`/errno freeze; RPC-3 portable "absent-vs-fault" phrasing). All are incorporated in the amended plan + closure and re-verified this pass:

| Prior correction | Landed as | Status |
|---|---|---|
| RPC-1 bilateral dual-reader documentation | Amendment **E** (bilateral docs; `readDailyArchive` not deprecated) | ✓ incorporated |
| RPC-2 freeze `cause` unconditionally + keep errno; no custom error class | Amendment **D** + Frozen Reader Contract ("every throw preserves original error as `cause`; errno preserved; no custom error class") | ✓ incorporated |
| RPC-3 portable "absent-vs-fault" contract phrasing | Frozen Reader Contract ("Storage-independent: absent→null · fault→throw"; ENOENT = the filesystem implementation) | ✓ incorporated |

Additionally, two closure source-refinements are adopted here: caller count **6 external** (not 7), and the strict reader is **not directly injectable** (Slice-4 adapter obligation). Both were re-verified against source this pass. No correction remains open.

# Carry-forward

Owned by later slices, unchanged by this review: the **Slice-4 rows-projection adapter** (`null/absent→[]`, `throw/fault→propagate`, archive tabs → `FootyMatchRow[]`, dedupe `matchId`, single read/run); route-entry `deadlineAnchorMs` capture + CF-1 wall-clock guard; F-B freshness policy; F-A partition observability / path-parity; dry-run; canary; FULL_WRITE; benchmark execution (≥100-sample tail-confident, wired source-load measurement); production-readiness gates; PostgreSQL evidence adapter + read-port resolver; durable job-run store; capture full-write (gated on unbuilt M4→M5); deployment (F-F/F-H). **New:** a *deferred, per-caller* dual-reader deprecation evaluation for `readDailyArchive` (not started, not authorized). **Audit-trail (non-blocking):** persist the four consolidation-provided review documents as standalone files.

# Verdict

Adding the dormant `readDailyArchiveStrict` preserves backward compatibility completely and provides a clean, correctly-sequenced path to later activation. Every required confirmation holds:

- **Existing archives remain readable** — ✓
- **No historical rewrite** — ✓
- **No migration** — ✓
- **No schema-version change** — ✓
- **No archive-format change** — ✓
- **No evidence-contract change** — ✓
- **No public API break** — ✓
- **Existing fail-open callers remain unchanged** (6 external) — ✓
- **Strict adoption can occur per caller later** — ✓
- **Absent-versus-fault is the storage-independent contract** — ✓
- **ENOENT is only the filesystem implementation of absent** — ✓
- **Original fault is preserved as `cause`** — ✓
- **No custom public error class is frozen** — ✓
- **No deprecation is authorized in Slice 3** — ✓
- **PostgreSQL and future source adapters remain unobstructed** — ✓
- **Zero blockers** — ✓ (blocker count: 0)

This review persists a compatibility assessment only; it does not authorize implementation, which remains governed by the Slice-3 planning closure (implementation limited strictly to the additive dormant primitive + its hermetic tests).

COMPATIBLE
