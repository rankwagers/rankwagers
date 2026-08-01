# M10 Stage 2E — Slice 3 Planning (Strict Daily-Archive Reader) — Independent Test Strategy Review

**Review type:** Read-only test-strategy review of a **planning** document. **No runtime, test, schema, archive, or deployment file was created or modified.** The only file created is this review.
**Date:** 2026-07-31
**Reviewer:** Independent Test Strategy Reviewer, Sprint 23B / M10 Stage 2E, Slice 3.
**Under review:** `docs/plans/m10-stage-2e-slice-3-planning.md` — solely its **Test Strategy** (§Test Strategy + §Success Criteria + §Stop Conditions), against the 15 required cases and the LOOK-FOR list.
**Substrate inspected (verified, not trusted from the plan):** `lib/footystats/dailyArchive.ts` (reader/writer/type), its 7 callers, `lib/evidence-capture/candidates/completed-rows.ts` (loader), `tests/sprint18gArchive.test.ts` (the only `DailyArchive`-shaped test), temp-fs patterns across `tests/`, and `package.json`/`tsconfig.typecheck.json` runner config.

---

## Verdict (up front)

### CONDITIONALLY APPROVED — blocker count: **0**

The **contract** the slice defines (ENOENT→`null`; malformed/non-object/IO→throw; valid→archive) is correct and is exactly the disambiguation activation needs, and the **design is genuinely production-safe**: additive sibling, the fail-open `readDailyArchive` and its **7 callers are byte-untouched** (verified: `admin-dashboard/queries`, `archive/load`, `calibration-intelligence/queries`, `footystats/client`, `homepage/trustPerformance`, `footystats/dailyArchive`, `evidence-capture/source`), no flag/route/cron/schema/contract, dormant, reversible.

But the **test strategy as written is not yet sufficient to prove that contract without touching the shared archive directory**, because of one structural fact the plan omitted and several enumerated-case gaps. None is a correctness/safety blocker — each is a bounded, additive correction — so the verdict is CONDITIONALLY APPROVED, and **implementation is not authorized** (nor does this review authorize it) until the §Required Plan Corrections land.

---

# Test Findings

**TF-1 (isolation — the pivotal one). The plan's "mkdtemp … never `data/daily-archives`" promise is not achievable with the signature it fixes.** `ARCHIVE_DIR = path.join(process.cwd(), "data", "daily-archives")` is hardcoded (`dailyArchive.ts:7`) with **no env override and no dir parameter**; `readDailyArchive`/`saveDailyArchive` resolve the file purely from it. The plan fixes the new signature as `readDailyArchiveStrict(date: string)` and says "No signature change" — so, exactly like the existing reader, it will read `process.cwd()/data/daily-archives/<date>.json`. Verified: **no test in the repo uses `chdir`**, and the only `DailyArchive` test (`sprint18gArchive`) uses an in-memory fixture and never invokes the filesystem reader. Therefore, as written, the tests could only reach the strict reader by (a) `chdir` (process-global shared state → a LOOK-FOR OS/global hazard), (b) writing fixtures into the **real** `data/daily-archives/<date>.json` and cleaning up (**mutation of a shared archive directory** — a LOOK-FOR violation and a direct contradiction of the plan's own "never `data/daily-archives`" + required case 13), or (c) mocking `fs` (which defeats the fidelity of the ENOENT-vs-EISDIR-vs-parse distinction the slice exists to prove). **Resolution:** give the *new* function an optional injected base dir (e.g. `readDailyArchiveStrict(date, dir = ARCHIVE_DIR)`) — additive, no production caller passes it, fully within the plan's "new export / no existing-signature change" constraint — so tests use real `mkdtemp` + real `fs` at full fidelity. This is the top required correction.

**TF-2 (array predicate ambiguity → risk of a false-negative test).** The plan's fault rule is prose: "not a non-null object." In JS `typeof [] === "object" && [] !== null` is **true**, so a naive object check would **accept** `[]` — yet the plan lists `"[]"` as a throw case and required case 6 demands arrays throw. The contract must be specified as `typeof x === "object" && x !== null && !Array.isArray(x)` (throw otherwise), or required case 6 will silently fail (the reader would resolve `[]` as a cast `DailyArchive`).

**TF-3 (parse-vs-IO distinction not asserted → LOOK-FOR "insufficient distinction / only-throws").** The plan's fault cases assert "rejects (not `null`)", which correctly separates fault from ENOENT-null, but does **not** distinguish a **parse** fault (garbage/empty JSON) from a **read/IO** fault (EISDIR/permission). The LOOK-FOR explicitly flags this. Since the contract promises "the original error preserved as `cause` where applicable," the tests should assert the discriminator (parse fault surfaces a `SyntaxError`-shaped cause; IO fault surfaces an errno `code`/`cause.code` such as `EISDIR`) — not merely that both "throw." This avoids false-positive tests that pass for the wrong reason.

**TF-4 (structurally-invalid object — required case 7 conflicts with the plan's scope).** The plan **deliberately** scopes validation to "un-parseable or not-an-object, nothing more" and defers deep `DailyArchive` field validation. Required case 7 ("structurally invalid archive **object** throws") therefore does **not** hold under the plan's contract — a parseable object like `{"foo":1}` will **resolve** (cast), not throw. This is a defensible slice boundary (row-level validation lives downstream in `filterCompletedRows`), but the plan neither covers case 7 nor **pins the opposite**. The correction is to add an explicit test asserting that a valid-JSON **object of the wrong shape resolves (does not throw)**, documenting that structural validation is downstream — so the boundary is intentional and a future edit cannot silently start throwing (or silently start deep-validating).

**TF-5 (dormancy is grep-only, not test-enforced).** "Zero production callers" (required case 11) is asserted only by a one-time grep in §Success Criteria #5. The repo has an established, CI-enforced pattern of **scope-guard tests** (Stage-2C/2D read source and assert absence of a symbol). A one-time grep proves the moment, not the future. Recommend a test-enforced dormancy guard (assert no `readDailyArchiveStrict` import/caller under `lib/`+`app/`) consistent with that pattern.

**TF-6 (case 7 seam test is mis-specified against the real loader).** Verified: `createCompletedRowLoader` maps a reader `null` → `ProducerError("source_load_failed")` (`completed-rows.ts:158-167`) — **not** `[]`. The plan's case 7 ("feed the strict reader's outputs to the existing `createCompletedRowLoader` contract — null→(adapter would map to `[]`)") conflates the **future Slice-4 rows-projection adapter** (which maps ENOENT-null→`[]`) with the **existing** loader (which fail-closes on null). Feeding strict-`null` into the real loader would produce `source_load_failed`, not `[]` — so this "documentation test," if written literally, is misleading. Either drop case 7 from Slice 3 (it belongs to the Slice-4 adapter test) or reframe it as a pure **contract-doc assertion** (strict-`null` ≠ strict-throw; the null→`[]` mapping is the adapter's Slice-4 job) that does **not** wire the real loader.

**TF-7 (valid-archive determinism).** The plan offers the valid fixture "via `saveDailyArchive` or a fixture." `saveDailyArchive` stamps `savedAt: new Date().toISOString()` (wall-clock, `dailyArchive.ts:59`). Prefer writing a static in-memory `DailyArchive` fixture (the `sprint18gArchive` `sampleArchive()` shape is reusable) directly, and assert a **targeted `deepEqual`** against it — not a wall-clock round-trip and not a broad snapshot of a large object (LOOK-FOR "broad snapshots").

---

# Required Test Matrix

| # | Required case | Plan coverage | Assessment |
|---|---|---|---|
| 1 | Valid archive → expected archive | §Test Strategy #4 | Covered (fix TF-7: deterministic fixture, targeted deepEqual) |
| 2 | Missing partition / ENOENT → `null` | #1 | Covered |
| 3 | Malformed JSON → throws | #2 | Covered (add parse-cause assertion, TF-3) |
| 4 | **Empty file → throws** | — | **Missing** — not enumerated; `JSON.parse("")` throws, but the 0-byte boundary must be an explicit case |
| 5 | Valid JSON primitive → throws | #3 (`"42"`/`"null"`) | Covered |
| 6 | Valid JSON array → throws | #3 (`"[]"`) | **At risk** — contract prose accepts arrays; require `!Array.isArray` (TF-2) |
| 7 | Structurally-invalid object → throws | — | **Conflicts with scope** — plan defers deep validation; pin "wrong-shape object **resolves**, validation downstream" (TF-4) |
| 8 | FS permission/read error → throws (reliably testable) | #6 (EISDIR) | Covered — **commit to EISDIR** (dir at the file path); explicitly avoid chmod/EACCES (TF-3 portability) |
| 9 | Fail-open reader still returns `null` for malformed | #5 (contrast) | Covered |
| 10 | Strict vs fail-open deliberately different | #5 | Covered |
| 11 | Strict reader has zero production callers | §Success #5 (grep) | Weak — make **test-enforced** (TF-5) |
| 12 | Existing reader behaviour unchanged | #5 + full regression | Covered (null-path via contrast + suite; add a valid-path unchanged assertion is optional) |
| 13 | No artifact leaks outside temp dirs | §Test Strategy (promise) | **Not achievable as written** — blocked by TF-1 until the injectable dir lands |
| 14 | Deterministic & platform-safe | §Test Strategy (claim) | Conditionally — fix TF-7 (wall-clock), TF-1 (no chdir/real-dir), EISDIR-not-chmod |
| 15 | Regression floor ≥ 1837 | §Test Strategy ("≥1837 + new") | Stated target — acceptable |

**Score: 10/15 cleanly covered; 2 missing (4, 7); 3 at-risk/weak (6, 11, 13).**

---

# Determinism and Isolation

- **Isolation is the primary weakness (TF-1).** The plan's isolation promise cannot be met with a bare `readDailyArchiveStrict(date)` over a hardcoded cwd-relative dir; the only paths available today are chdir (global hazard), real-dir mutation (LOOK-FOR violation), or fs-mock (fidelity loss). The injectable-dir correction makes real-`mkdtemp` isolation trivially achievable and is the established repo pattern for adapters that take a base dir (provider/odds archives) or an env dir (evidence archive) — the daily-archive reader is the outlier with neither.
- **Determinism is achievable** once TF-7 is applied: no wall-clock **value** assertions (write a static fixture, not `saveDailyArchive`), no network, no `data/` access. Node's `--test` runs each file in its own process, so a dedicated `dailyArchiveStrictReader.test.ts` is process-isolated — but that does **not** license `chdir` (still an intra-file async hazard). Prefer the injected dir.
- **Platform-safety:** EISDIR (create a directory at the archive-file path, then read) is portable across Linux/macOS/Windows/CI; the plan's "best-effort … path is a directory" instinct is right but must **commit** to EISDIR and **explicitly exclude** chmod/`EACCES` (root bypasses perms; Windows differs) to avoid a flaky-permission test.
- **Error-contract stability:** a bespoke error class is **not** required (the downstream loader collapses every throw to `source_load_failed`), so do not over-specify one; but if the contract advertises "cause preserved," the tests should assert `cause`/`code` presence to make the parse-vs-IO distinction real (TF-3) — without pinning exact message strings.

---

# Missing Cases

1. **Empty file (0 bytes)** → throws (required #4) — add explicitly; distinct boundary from "garbage".
2. **Array-rejection** with the `!Array.isArray` predicate made explicit in the contract (required #6 depends on it).
3. **Wrong-shape object resolves (not throws)** — pin the minimal-validation boundary so required #7's *absence* is intentional and documented, not accidental.
4. **Test-enforced dormancy guard** — zero `readDailyArchiveStrict` callers under `lib/`+`app/`, CI-checked (required #11), matching the repo's scope-guard pattern.
5. **Parse-vs-IO discriminator assertion** on the two throw paths (LOOK-FOR), rather than a bare "rejects".

---

# Required Plan Corrections

1. **(C-1, top) Specify an injectable archive dir on the new function** (optional param defaulting to `ARCHIVE_DIR`), so tests use real `mkdtemp` at full fidelity and the "never `data/daily-archives`" / no-artifact-leak promise (case 13) is actually met. Without this, the test strategy cannot prove the contract without touching the shared archive dir.
2. **(C-2) Fix the object predicate** to `typeof x === "object" && x !== null && !Array.isArray(x)` (throw otherwise), so array/primitive rejection (cases 5–6) is real.
3. **(C-3) Enumerate the empty-file case** (0 bytes → throws) as distinct from garbage.
4. **(C-4) Pin the minimal-validation boundary** with an explicit "wrong-shape object → resolves" test; reconcile required case 7 by documenting deep validation as downstream (loader/`filterCompletedRows`), not this slice.
5. **(C-5) Assert the parse-vs-IO distinction** (SyntaxError-shaped cause vs errno `code`/`cause.code`), and **commit to EISDIR**, explicitly excluding chmod/EACCES.
6. **(C-6) Make dormancy test-enforced**, not grep-only.
7. **(C-7) Reframe or drop the seam "case 7"** so it never feeds strict-`null` into the real `createCompletedRowLoader` (which fail-closes on null); the null→`[]` mapping is the Slice-4 adapter's contract, not Slice 3's.
8. **(C-8) Use a static deterministic fixture** for the valid case (reuse the `sampleArchive()` shape), avoid `saveDailyArchive` wall-clock and broad snapshots.

None requires touching production code beyond the additive new function, the frozen contract, any flag/route/schema, or any existing caller.

---

# Carry-forward

- Unchanged and still owned by later slices exactly as the plan lists them (rows-projection adapter → Slice 4; CF-A route-entry capture; F-B freshness; F-A observability/path-parity; CF-C dry-run; CF-D canary; CF-E FULL_WRITE; CF-F/CF-I benchmark execution; CF-G production gates; CF-H test hardening; F-F/F-H deployment; F-J capture full-write).
- **New for the implementer:** C-1…C-8 above must be folded into the Slice-3 implementation-test file before it is written.
- The `ARCHIVE_DIR`-is-hardcoded observation (TF-1) is a latent testability debt on the *existing* reader too; the injectable dir on the new function is the minimal fix and need not disturb the fail-open reader.

---

# Verdict

## CONDITIONALLY APPROVED

**Blocker count: 0.** The strict-reader contract is correct and the slice is genuinely additive, dormant, and reversible with zero production blast radius (7 fail-open callers verified untouched). However, the **test strategy as written is not yet sufficient** to prove that contract *without changing production behaviour / mutating the shared archive directory*: it promises `mkdtemp`/no-leak isolation that the fixed signature cannot deliver (TF-1/case 13), leaves the array predicate ambiguous (TF-2/case 6), omits the empty-file case (case 4), conflicts with itself on structurally-invalid objects (TF-4/case 7), asserts throws without the required parse-vs-IO distinction (TF-3), relies on grep-only dormancy (TF-5/case 11), and mis-specifies the loader seam test (TF-6). All are bounded, additive corrections (C-1…C-8) — hence conditional, not blocked.

**This review does not authorize implementation.** Implementation of Slice 3 remains gated on the plan being corrected per C-1…C-8 and re-confirmed. No runtime, test, schema, archive, or deployment file was created or modified by this review; the only file created is `docs/plans/m10-stage-2e-slice-3-test-strategy-review.md`.
