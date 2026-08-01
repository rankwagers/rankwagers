# M10 Stage 2E — Slice 3 (Strict Daily-Archive Reader) — Architecture Review

**Reviewer:** Claude 2 — independent Architecture Reviewer (Stage 2E, Slice 3).
**Date:** 2026-07-31.
**Type:** Persisted architecture review (documentation-only). **No runtime, test, script, configuration, schema, migration, route, cron, flag, or other planning/closure document was modified.** The only file created is this document.
**Subject:** `docs/plans/m10-stage-2e-slice-3-planning.md` (amended 2026-07-31) + `docs/plans/m10-stage-2e-slice-3-planning-closure.md`.
**Method:** this persists the previously-completed independent review; every material claim was re-verified against current repository source (`file:line`) this pass, and the verdict is updated only where the planning amendment has already corrected the conditions I raised.

**Source re-verified this pass:**
- `lib/footystats/dailyArchive.ts:71-79` — fail-open `readDailyArchive` (`JSON.parse(...) as DailyArchive` inside bare `try/catch { return null }`); unchanged.
- `lib/footystats/dailyArchive.ts:7` — module top-level is pure (`const ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives")`); `fs.readFile` occurs only inside the function body (`:74`), so there is no import-time IO.
- `lib/footystats/dailyArchive.ts:13-21` — `DailyArchive` is a plain non-array object type.
- **6 external callers** of `readDailyArchive` (definer excluded): `admin-dashboard/queries.ts`, `archive/load.ts`, `calibration-intelligence/queries.ts`, `evidence-capture/source.ts`, `footystats/client.ts`, `homepage/trustPerformance.ts`.
- `lib/evidence-capture/candidates/completed-rows.ts:132` — `readRows: (date) => Promise<readonly FootyMatchRow[] | null>`; `:145-168` — throw **or** `null` → `ProducerError("source_load_failed")` (fail-closed).
- `grep readDailyArchiveStrict` across `lib/ app/ tests/` → **absent** (dormancy baseline).
- Slice 1/2 frozen docs present (`m10-stage-2e-slice-1-testability-review.md`, `m10-stage-2e-slice-2-*`).

---

# Architecture Findings

Slice 3 proposes exactly one additive, dormant pure function — `readDailyArchiveStrict(date: string, archiveDir?: string): Promise<DailyArchive | null>` in `lib/footystats/dailyArchive.ts` — that disambiguates *absent* (ENOENT → `null`) from *faulted* (malformed / non-array / IO → throw) from *valid* (→ archive). This is the correct smallest architectural Slice 3, and the repository proves it is a **hard prerequisite** for correct activation:

- The production completed-rows loader is deliberately **fail-closed** on *both* a reader throw *and* a `null` result (`completed-rows.ts:145-168`).
- The only existing reader is **fail-open** — a bare `catch { return null }` (`dailyArchive.ts:76-77`) that collapses ENOENT, malformed JSON, and IO faults into one indistinguishable `null`.
- Therefore, today, a no-data day (absent partition) is indistinguishable from a corrupt partition. Wiring the fail-open reader would either fail-close every empty day or silently swallow corruption. The strict reader is the minimal primitive that resolves this, and it activates nothing.

The boundary is right: the reader disambiguates at the **archive** level (`DailyArchive | null`) and defers rows-projection to a separate Slice-4 adapter — useful enough to unblock the loader semantics, small enough to remain dormant.

**Primary question: YES** — an additive dormant strict daily-archive reader is the correct smallest architectural Slice 3.

---

# Repository Verification

| # | Claim | Evidence | Result |
|---|---|---|---|
| 1 | Fail-open reader collapses absent / malformed / IO | `dailyArchive.ts:71-79` bare `catch { return null }` | ✅ confirmed, unchanged |
| 2 | **6 external callers, not 7** | definer `footystats/dailyArchive.ts` excluded; 6 external files enumerated above | ✅ corrected + confirmed |
| 3 | Loader fail-closed when reader can't provide a valid result | `completed-rows.ts:145-168` throw/`null` → `source_load_failed` | ✅ confirmed |
| 4 | Strict reader can be additive | new export beside existing; no existing line changed | ✅ |
| 5 | Existing reader + 6 callers can remain unchanged | additive sibling; zero blast radius | ✅ |
| 6 | New reader can be dormant, zero callers | `readDailyArchiveStrict` absent from `lib/app/tests` | ✅ |
| 7 | No schema evolution | same `DailyArchive` shape | ✅ |
| 8 | No archive-format evolution | reads existing `<date>.json` | ✅ |
| 9 | No evidence-contract evolution | no `types/evidence` touch | ✅ |
| 10 | No migration / historical rewrite | reads only; writes nothing | ✅ |
| 11 | Function boundary appropriate | returns `DailyArchive \| null`; rows-projection deferred | ✅ |
| 12 | Does not pull in rows-projection / freshness / activation / route-entry / canary / FULL_WRITE / deployment | Out-of-Scope + Stop Conditions explicit | ✅ |
| 13 | Preserves frozen Slice 1 (bench framework) and Slice 2 (`runner.ts` `deadlineAnchorMs`) | Slice-3 touches neither | ✅ |
| — | No import-time IO | module top-level = imports + one pure `const`; `fs.readFile` inside function only | ✅ (correction K) |
| — | Optional `archiveDir?` for hermetic tests | frozen contract §B/§F: optional param, defaults to production dir | ✅ (plan-frozen) |

**Archive validation duplication:** none. No `isDailyArchive` / `validateDailyArchive` / `parseDailyArchive` type-guard exists anywhere — every consumer uses an unchecked `as DailyArchive` cast. The strict reader's minimal "parse + reject non-array-object" check duplicates nothing and matches the codebase's existing (non-)validation posture; deep schema validation is correctly deferred.

---

# Frozen Reader Contract

Storage-independent: **absent → `null`** · **fault → throw** · **valid (non-array object) → return.**

Filesystem realization (per amended plan §C / closure):
- **ENOENT** → return `null` (the *sole* meaning of `null` for the strict reader).
- **Malformed JSON** → throw. **Empty file** → throw (empty string fails `JSON.parse`).
- **Parsed `null`** → throw. **Parsed primitive** → throw. **Parsed array** → throw.
- **Parsed non-array object** → return as `DailyArchive`.
- **Any non-ENOENT filesystem error** (EISDIR / EACCES / …) → throw.
- **Reject predicate:** `parsed === null || typeof parsed !== "object" || Array.isArray(parsed)` → throw. This is the precise fix for the earlier imprecision (a literal "non-null object" test would wrongly accept `[]`, since `typeof [] === "object"`); the amendment now explicitly rejects arrays.
- **Every throw preserves the original error as `cause`** (errno/`code` preserved); **no custom error class**.
- **"Valid" = parsed to a non-null, non-array object** — *not* structurally validated as a `DailyArchive`; consistent with the fail-open reader and the rest of the codebase.

`readDailyArchive` (fail-open; `null` = absent OR faulted) is **unchanged and not deprecated**. The two readers' `null` semantics deliberately diverge, and the divergence is documented bilaterally.

---

# Architectural Risks

- **Type-contract safety (positive):** the strict reader returns `DailyArchive | null`, whereas `createCompletedRowLoader.readRows` expects `FootyMatchRow[] | null`. The types differ, so the strict reader **cannot be wired directly** as `readRows` — TypeScript blocks the naive misuse. The strict `null` (absent) also carries the *opposite* intent to the loader's `null` (fail-closed), reinforcing that a mediating adapter is mandatory.
- **Future-caller misuse (deferred; Slice-4 obligation):** the strict reader's `null` (ENOENT) must **never** reach the loader's `readRows`; the Slice-4 rows-projection adapter must map absent/`null` → `[]` (empty success / skip) and propagate throws → `source_load_failed`. Not a Slice-3 defect; recorded as a Slice-4 acceptance criterion.
- **Dual-reader ambiguity:** `null` means different things across the two readers; a live footgun mitigated by (a) the type mismatch, (b) bilateral documentation, and (c) the amendment's non-deprecation decision. Non-blocking.
- **Scope:** neither too small (removes a real activation blocker) nor too broad (single pure function, zero callers, dormant, reversible). Correct.

---

# Planning Corrections Verification

The two conditions from my prior (CONDITIONALLY APPROVED) review are now incorporated in the amended plan + closure and re-verified against source:

| Condition raised | Resolution in amendment | Source re-verification |
|---|---|---|
| Caller count was stated as 7 | §A → **6 external callers**, defining module excluded | ✅ grep confirms exactly 6 external files |
| "Non-object → throw" must exclude arrays (`[]` is `typeof "object"`) | §C → predicate `parsed === null || typeof parsed !== "object" || Array.isArray(parsed)`; array is an explicit throw case in the ≥17-case matrix | ✅ contract now array-safe; matches `DailyArchive` being a non-array object type |

Additional amendment items independently confirmed against source: **§K** (no import-time IO — module top-level is a single pure `const`), **§I** (not directly injectable — loader seam type `FootyMatchRow[] | null` ≠ strict `DailyArchive | null`), **§B/§F** (optional `archiveDir?` param for hermetic testing, default = production dir). Corrections D/E/G/H/J/L are frozen-plan/test-contract items with no source contradiction.

---

# Carry-forward

Owned by later slices (unchanged):
- **Slice-4 rows-projection adapter** — map strict `null`/absent → `[]`; propagate strict throw/fault; archive tabs → `FootyMatchRow[]`; dedupe `matchId`; read the partition once per run. The direct consumer that makes the reader usable by `createCompletedRowLoader`.
- Route-entry capture + CF-1 wall-clock guard for a production `deadlineAnchorMs`.
- Freshness policy (`savedAt`/date → `run_degraded`/defer); partition observability / path-parity gate.
- Dry-run · canary · FULL_WRITE · benchmark execution · production readiness gates · PostgreSQL evidence adapter · deployment · capture full-write (gated on unbuilt M4→M5).
- Recommend the implementation reuse the ENOENT idiom already used by the strict NDJSON readers (`lib/archive/evidence/file.ts`, `odds-archive/file.ts`) for repo consistency. Non-blocking.
- Per-caller dual-reader deprecation evaluation for `readDailyArchive`; audit-trail persistence of the four consolidation-provided reviews. Non-blocking.

---

# Verdict

Explicitly confirmed:
- **6 external callers, not 7** — verified (definer excluded).
- **Strict reader is additive and dormant** — new export, zero callers, verified absent today.
- **Existing fail-open reader remains unchanged** — `dailyArchive.ts:71-79` byte-unchanged; not deprecated.
- **Arrays are explicitly rejected** — predicate `… || Array.isArray(parsed)` → throw.
- **No deep schema validation** — "valid" = parses to a non-null, non-array object; field validation deferred.
- **Optional archive directory exists for hermetic tests** — frozen contract adds `archiveDir?`, defaulting to the production dir.
- **Strict reader is not directly injectable into `createCompletedRowLoader`** — type mismatch (`DailyArchive | null` vs `FootyMatchRow[] | null`) and opposite `null` semantics.
- **Future Slice-4 adapter maps absent/`null` → `[]` and propagates faults** — recorded as a Slice-4 obligation.
- **No schema, archive-format, evidence-contract, migration, or activation change** — verified.
- **Zero blockers.**

The strict daily-archive reader is the correct, minimal, additive, dormant Slice 3; it is source-grounded, preserves every frozen Slice 1/2 contract, requires no schema/archive/evidence/migration change, and unblocks activation without performing any activation. Both conditions from the prior review are resolved in the amendment; no blocker remains.

**Confirmed:** NO runtime code modified · NO tests modified · NO scripts modified · NO configuration/schema/migration modified · NO routes/cron/flags modified · NO planning or closure document modified. The only file created is `docs/plans/m10-stage-2e-slice-3-architecture-review.md`.

APPROVED
