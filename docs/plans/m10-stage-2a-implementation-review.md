# M10 Stage 2A — Implementation Review (Strict Archive Discovery & Archive-State Normalization)

**Reviewer:** Independent Implementation Reviewer (Stage 2A)
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2A**.
**Type:** Read-only implementation review. **No runtime code, no test, no deployment, no configuration, no archive format, no flag, no cron, no runner was modified in producing this review.** The only file created is this document.

**Inputs read (complete):**
`docs/architecture/m10-live-candidate-pipeline-specification.md`;
`docs/plans/m10-stage-2a-archive-normalization.md`;
`docs/plans/m10-stage-2-migration-compatibility-review.md`;
`docs/plans/m10-stage-1-candidate-provider-foundation.md`;
`docs/plans/m10-stage-1-candidate-provider-implementation-review.md`;
and the Stage-2 production-safety / performance-scalability / test-verification review docs.

**Implementation inspected (file:line):**
`lib/evidence-capture/candidates/archive-state/{types,normalize,builders,index}.ts`;
`lib/evidence-capture/candidates/types.ts`; `lib/evidence-capture/candidates/index.ts`;
`tests/evidenceArchiveStateBuilders.test.ts`; plus the Stage-1 consumers
`candidates/{eligibility,capture-provider,settlement-provider}.ts` (to confirm the classifier
reads only pre-existing fields).

---

## 1. Executive Summary

# STAGE 2A IMPLEMENTATION APPROVED

Stage 2A delivers exactly what the approved architecture specifies and **nothing else**: a pure,
dependency-injected, **dormant** archive-state layer of three small modules (strict read-port
interfaces + a fail-closed conflict error; two pure normalizers; two thin async builders) plus a
barrel and a 25-test unit suite. It is **invoked by nothing** — the builders and normalizers are
re-exported from the candidates barrel and imported only by their own test. No cron, runner,
provider invocation, M6/M8 integration, feature-flag wiring, scheduler change, lock, or archive I/O
was added. The layer is deterministic (no `Date.now`, no `Math.random`, no `process.env`, no clock,
no hidden mutable state), order-independent (reduces into Sets/Maps, sorts head lists by
`validationId`), strict-read fail-closed (the port contract mandates throw-on-corruption; the
builders never catch; the normalizers add a second fail-closed conflict guard), and archive-format
neutral (it mints no identity and joins on the frozen window-key shape). The archive remains the
sole checkpoint — no cursor, offset, cache, or process-local progress is created or read.

The two public-surface changes (`CaptureArchiveState.orphanOddsWindowKeys?` and
`SettlementArchiveState.currentValidationHeads?` + the `ValidationHead` type) are **additive,
optional, and backward-compatible**: the Stage-1 classifier and the settlement-provider validity
guard read only the pre-existing required fields, so behaviour is unchanged. `currentValidationHeads`
is the migration-review-mandated **MC-1** enrichment (correction detection from existing
`ValidationRecord` fields — no new archive column). This is acceptable additive evolution of an
**M10-internal, not-yet-activated** type, not a frozen-contract regression.

**Validation (re-run this pass):** Stage-2A targeted **25/25**, full suite **1760/1760**, typecheck
**exit 0**, lint **clean**. No blocking findings. Two minor, non-blocking test-coverage asymmetries
noted (§9). **Stage 2B may begin.**

---

## 2. Scope Verification

Stage 2A contains **only** archive-state normalization. Verified against the plan (§2 of
`m10-stage-2a-archive-normalization.md`) and the tree:

**Created (new files only):**
- `archive-state/types.ts` — `SnapshotReader` / `OddsReader` / `ValidationReader` and the
  `Capture` / `Settlement` / combined `EvidenceArchiveReadPort` compositions; `ArchiveStateConflictError`.
- `archive-state/normalize.ts` — `normalizeCaptureArchiveState`, `normalizeSettlementArchiveState`.
- `archive-state/builders.ts` — `buildCaptureArchiveState`, `buildSettlementArchiveState`.
- `archive-state/index.ts` — barrel.
- `tests/evidenceArchiveStateBuilders.test.ts` — 25 tests.

**Modified (additive only):** `candidates/types.ts` (two optional fields + `ValidationHead`);
`candidates/index.ts` (re-exports). Both confirmed additive by diff-of-shape against the Stage-1
record (Stage-1 doc §8 documents the original `{capturedWindowKeys, partialWindowKeys}` and
`{capturedFixtureIds, settledFixtureIds}` shapes).

**No hidden Stage 2B work.** There is no concrete port implementation backed by the file adapters,
no lock acquisition, no fetch, no runner call, no cron route, no diagnostics aggregation, no
Postgres — i.e., none of the orchestration-wiring surface that Stage 2B owns. `grep` for the
builders/normalizers across `lib app pages tests scripts` returns **only** the barrel re-export and
the Stage-2A test (no runtime consumer). The new optional fields (`orphanOddsWindowKeys`,
`currentValidationHeads`, `ValidationHead`) have **zero consumers** anywhere in `lib`/`app`/`tests`
— confirming they are produced-but-not-yet-consumed (dormant, reserved for a later stage). **PASS.**

---

## 3. Architecture Compliance

### 3.1 No runtime wiring (VERIFY #1) — PASS
`grep` over `lib app pages tests scripts` for `buildCaptureArchiveState|buildSettlementArchiveState|
normalize*ArchiveState|ArchiveStateConflictError|archive-state` returns only:
- `candidates/index.ts:37-50` — barrel re-export (no invocation);
- `tests/evidenceArchiveStateBuilders.test.ts` — the unit test.

No cron route, no runner, no provider invocation, no M6 integration, no M8 integration, no
feature-flag wiring, no activation, no scheduler change. The builders are pure library functions
reachable only by an explicit future caller. **PASS.**

### 3.2 Builders are reusable-only, no side effects (VERIFY #2) — PASS
`buildCaptureArchiveState` / `buildSettlementArchiveState` (`builders.ts:38-61`) take an injected
port, `await Promise.all([...reads])`, and return the normalizer output. They perform no I/O, mutate
no module-level state, write nothing, and are invoked nowhere. The only observable effect is the
returned value. **PASS.**

### 3.3 Adapter-neutral seam — PASS
The builders depend only on the abstract `CaptureArchiveReadPort` / `SettlementArchiveReadPort`
(`types.ts:47-50`), never on a file adapter — Postgres-safe by construction (spec §4.0). The
concrete strict reader is explicitly deferred to the orchestration stage (`types.ts:6-9`,
`builders.ts:17-19`). **PASS.**

---

## 4. Determinism (VERIFY #5) — PASS

- **No clock / randomness / env:** `grep` for `Date.now|Math.random|process.env|new Date|require(|
  fs|appendFile|readFile` over `archive-state/` finds only a **comment** in `normalize.ts:6`
  documenting their deliberate absence. No such call exists in any of the four modules.
- **No hidden mutable state:** all state is function-local (`Map`/`Set` built per call);
  `normalize.ts:33` `hashSeed`-style module state is confined to the *test* file, not the library.
- **Order-independent output:** both normalizers reduce inputs into Sets/Maps keyed by content
  fields; the per-fixture head list is sorted by `validationId` (`normalize.ts:201-205`), so membership
  and per-fixture head order are independent of record/array order. Two order-independence tests
  (capture line 162, settlement line 276) assert shuffled input → identical output.
- **Replay-safe:** the module mints no identity and re-hashes nothing (joins on the frozen
  `"<fixtureId>|<capturedAt>"` window-key and on `ValidationRecord.id`), so it cannot perturb any
  hashed body. Output is a pure function of retained record fields → byte-stable across re-runs
  (MC-3, A2/A4). **PASS.**

---

## 5. Archive-State Correctness

### 5.1 Strict-read semantics (VERIFY #3) — PASS
The port contract (`types.ts:11-25`) binds every `readAll*` to strict, fail-closed behaviour:
ENOENT ⇒ empty array; malformed line / integrity-hash conflict / EACCES-EPERM / EIO-EBUSY / any
other errno ⇒ **throw**, never masked as empty. The builders **never catch** (`builders.ts:41-45,
56-60`): `Promise.all` short-circuits to the first rejection, so a corrupt/unreadable archive
rejects the whole build and can never be misreported as "no history / zero candidates" (DR-6). There
is **no silent fallback and no empty-state conversion** anywhere in the module. Tests at lines
346-364 prove an I/O throw and a malformed-line throw each propagate (`assert.rejects`, never an
empty state). **PASS.**

### 5.2 Archive checkpoint (VERIFY #4) — PASS
No cursor, offset, cache, or process-local progress is created or read. Progress is derived purely
from the whole-archive record arrays handed in through the port; joins use record fields
(`snapshot.fixtureId|capturedAt`, `OddsArchiveRecord.captureWindowKey`, `ValidationRecord.id/
revision`), never NDJSON line position. The archive remains the sole checkpoint (INV-A). **PASS.**

### 5.3 Builder behaviour (VERIFY #6) — PASS
- **Single bounded read:** each builder reads each store it needs **exactly once** per call
  (`Promise.all` of `readAllSnapshots` + one sibling reader). No per-fixture loop over a per-fixture
  store API, so the O(D·A) ≈ O(F²) NDJSON amplification collapses to O(A) (PB-1). The
  counting-port tests (lines 328-344) assert `calls.snap === 1` and `calls.odds/val === 1`.
- **Promise handling is safe:** `Promise.all` runs the two reads concurrently and rejects on the
  first failure; no partial state is returned after a throw; no unhandled-rejection path (the single
  awaited `Promise.all` owns both).
- **No duplicate archive reads.** **PASS.**

### 5.4 Capture normalization (VERIFY #7) — PASS
`normalizeCaptureArchiveState` (`normalize.ts:74-116`) distinguishes all six states correctly:
- **never captured** — window absent from all three sets (derived later by the provider vs source);
- **complete pair** — snapshot + a `source === EVIDENCE_CAPTURE_SOURCE` mandatory odds row for the
  window → `capturedWindowKeys` (lines 104-106);
- **snapshot only** — snapshot, no mandatory odds → `partialWindowKeys` (heal, never skip; line 106);
- **odds only (orphan)** — mandatory odds, no snapshot → `orphanOddsWindowKeys` (lines 110-113);
- **duplicate pair** — identical id+hash collapses in the Sets (idempotent);
- **conflicting** — same id, different `contentHash` → `ArchiveStateConflictError` (lines 41-54).

Correctly, a **real operator quote alone does not complete** a window — completeness keys on the
reserved mandatory `evidence_capture` observation (`normalize.ts:96`, DoD-5). Two snapshots sharing a
window key but differing in `id` (distinct `sequence`) collapse to one window without a false
conflict — the hash-conflict guard keys on `id`, and the window Set dedups on the window key. All
seven behaviours are covered by tests (lines 82-172). **PASS.**

### 5.5 Settlement normalization (VERIFY #8) — PASS
`normalizeSettlementArchiveState` (`normalize.ts:136-212`) distinguishes:
- **pending** — captured snapshot, no terminal head (`capturedFixtureIds \ settledFixtureIds`);
- **settled** — current head `state !== "pending"` → `settledFixtureIds` (line 185);
- **duplicate** — identical `revisionId`+hash collapses; `MAX(revision)` wins (lines 175-178);
- **revision / correction-capable** — current outcome per `(fixture, market)` via
  `currentValidationHeads` (MC-1), so a genuine change is detectable;
- **current validation head** — `MAX(revision)` per `validationId`, derived at read time (there is no
  stored `isCurrent`/`supersededBy`), matching the frozen adapters;
- **conflicting** — same `revisionId` different hash **or** two `revisionId`s at one
  `(validationId, revision)` → `ArchiveStateConflictError` (lines 159-172).

The projected `ValidationHead` carries `validationId/revisionId/revision/snapshotId/marketKey/
selectionKey/state` (lines 187-195) — all from existing `ValidationRecord` fields, no new column.
Covered by tests (lines 176-288). **PASS.**

---

## 6. Public Contract Review (VERIFY #9)

**What changed:** two **optional** fields were added to the M10-internal state types
(`candidates/types.ts`):
- `CaptureArchiveState.orphanOddsWindowKeys?: ReadonlySet<string>` (types.ts:147-155);
- `SettlementArchiveState.currentValidationHeads?: ReadonlyMap<number, readonly ValidationHead[]>`
  (types.ts:189-197), plus the new exported `ValidationHead` type (types.ts:166-179).

**Frozen contracts untouched.** No change to `types/evidence/*`, `EvidenceArchiveStore` /
`OddsArchiveStore` interfaces, identity/hash/revision formulas, or any archive record shape
(snapshot / odds / provider / validation). Verified by inspection and by typecheck exit 0.

**Verdict on the two additions: (A) acceptable additive evolution — not (B) an unnecessary public
expansion.** Reasoning, precisely:

1. **These are not frozen contracts.** `CaptureArchiveState` / `SettlementArchiveState` are the
   *internal* M10 candidate-provider surface (`candidates/types.ts:1-16` — "the *internal* M10
   candidate-provider surface (Option C)"), a not-yet-activated code projection, not a persisted
   format or a cross-milestone frozen contract. Evolving it additively is in-scope for M10.
2. **Backward-compatible by construction.** Both fields are optional. The Stage-1 classifier reads
   only `capturedWindowKeys` / `partialWindowKeys` (`eligibility.ts:84,87`;
   `capture-provider.ts:152-154`) and `capturedFixtureIds` / `settledFixtureIds`
   (`eligibility.ts:176,179`; `settlement-provider.ts:102-103`); the settlement validity guard
   `isReadonlySet(state.capturedFixtureIds) && isReadonlySet(state.settledFixtureIds)`
   (`settlement-provider.ts:50-51`) does not require the new fields. Existing consumers are unaffected;
   full suite 1760/1760 confirms.
3. **`currentValidationHeads` is required, not gratuitous.** It is the migration-review-mandated
   **MC-1** enrichment: correction detection needs *current-outcome-per-(fixture,market)*, which a
   bare `settledFixtureIds` binary cannot express. It is derived entirely from existing
   `ValidationRecord` fields — **no new archive column** — which is precisely the property that lets
   M10 avoid a future format evolution. Landing it now (produced, not yet consumed) is the correct
   place per MC-1.
4. **`orphanOddsWindowKeys` is descriptive and harmless.** It cannot arise from the frozen capture
   path (odds are written per minted snapshot); it exists to let the orchestration stage *observe*
   the odds-only corruption/partial-import state distinctly (spec §5 duplicate/orphan model). The
   classifier ignores it. This one is the weaker justification — it is an observability convenience
   rather than a hard requirement — but as an optional, ignored field on an internal type it is
   acceptable additive evolution, not a regression. (Non-blocking note in §11 on keeping it minimal.)

No required field was added, no field type was narrowed/changed, no field was removed. **No public
contract regression. PASS.**

---

## 7. Performance Review (VERIFY #12) — PASS

- **Single archive read:** one `readAll*` per store per builder call; no repeated parsing, no
  per-fixture rescan → O(A) not O(F²) (PB-1). Asserted by the counting-port tests.
- **Bounded memory:** the normalizers allocate a fixed handful of `Map`/`Set` structures whose size
  is bounded by the number of distinct ids/windows/fixtures in the single read — no quadratic
  materialization, no cross-product.
- **No unnecessary allocations:** each record is visited a constant number of times; projections are
  built once; the only sort is the per-fixture head list (small, bounded by markets/selections).
- **No architectural regression.** The single-read discipline is exactly what the perf/scalability
  review requires to keep the file-adapter O(F²) cost from forcing a premature Postgres cutover
  (MC-5). The remaining O(A) whole-archive scan cost lives in the *future* concrete port, not here.
  **PASS.**

---

## 8. Migration Compatibility (VERIFY #13) — PASS

- **Identity / hashes / revisions preserved:** the module mints no id and re-hashes nothing; it
  joins on the frozen window-key `"<fixtureId>|<capturedAt>"` (identical to `captureWindowKey().key`
  and `OddsArchiveRecord.captureWindowKey`) and on `ValidationRecord.id` + `revision`. It reads
  `contentHash` only to *detect* on-disk conflicts, never to recompute one.
- **Archive format unchanged:** no record shape, no new field, no format flag. All normalized state
  is a pure projection of fields the current NDJSON records already carry (migration review §4:
  "SUFFICIENT from current records, no new field").
- **Fail-closed conflict surfacing** mirrors the frozen adapters' `immutable_violation` semantics —
  the normalizer is the fail-closed backstop for the snapshot store (which does not itself dedup on
  read), exactly as `types.ts:57-71` documents.
- **Postgres-forward:** every state maps to `DISTINCT ON (id) ORDER BY revision DESC` (current head)
  and content-key joins — the same mapping the M8/M9 migration reviews approved. Stage 2A blocks
  none of it. **PASS.**

---

## 9. Test Coverage Review (VERIFY #11)

`tests/evidenceArchiveStateBuilders.test.ts` — **25 tests, all passing.** The mandated cases are all
present:

| Required case | Present | Location |
|---|---|---|
| duplicate archive rows | ✅ capture + settlement | lines 121-126, 242-246 |
| conflicting revisions | ✅ hash-conflict + ambiguous `(id,revision)` | lines 248-260, 262-274 |
| corrupt archive | ✅ conflict throw + strict-read throw | lines 140-160, 346-364 |
| deterministic replay | ✅ order-independence (capture + settlement) | lines 162-172, 276-288 |
| builder failure propagation | ✅ never returns empty | lines 346-364 |
| Promise rejection | ✅ `assert.rejects` on both readers | lines 346-364 |
| complete / snapshot-only / orphan / real-operator-not-complete | ✅ | lines 89-119 |
| pending / settled / correction MAX(rev) / multi-market / pending-head | ✅ | lines 183-240 |
| single bounded read (call counts) | ✅ | lines 328-344 |
| normalizer conflict surfaces via builder | ✅ (capture) | lines 366-372 |

**Non-blocking coverage asymmetries (not gaps in behaviour — the shared code paths are exercised):**
1. The settlement normalizer's **snapshot** hash-conflict guard (`normalize.ts:143-149`) is not
   directly exercised — the `id:"dup"/h1/h2` snapshot-conflict test drives the *capture* path only.
   It is the same `assertNoHashConflict` helper, already proven via capture, so risk is negligible.
2. Only `buildCaptureArchiveState` has a normalizer-conflict-propagation test (line 366); the
   symmetric `buildSettlementArchiveState` normalizer-conflict-propagation case is absent. Again the
   propagation path is identical (both `await` the normalizer after `Promise.all`).

Neither omission affects correctness or the verdict; both are cheap to add in Stage 2B's test pass.
**Coverage is strong. PASS.**

---

## 10. Blocking Findings

**None.** No runtime wiring exists; no public-contract regression exists; no hidden side effect
exists; strict-read is honoured; determinism is honoured; the archive-as-sole-checkpoint invariant is
honoured; and no Stage 2B orchestration leaked into Stage 2A.

---

## 11. Non-blocking Recommendations

1. **(Stage 2B) Keep `orphanOddsWindowKeys` observability-only.** It is descriptive and ignored by
   the classifier; ensure the orchestration stage uses it only for metrics/alerting and never as a
   skip/heal signal, so it does not silently acquire semantics. If Stage 2B ends up not consuming it
   at all, consider demoting it to an internal diagnostic rather than a field on the exported state
   type.
2. **(Stage 2B tests) Close the two coverage asymmetries** in §9: a settlement-path **snapshot**
   hash-conflict test, and a `buildSettlementArchiveState` normalizer-conflict propagation test.
3. **(Stage 2B) Add the determinism static rule** (spec R1 / migration §14.6): a lint/static guard
   forbidding `Date.now`/`Math.random` under `lib/evidence-capture/` so the purity Stage 2A relies on
   is enforced, not just observed.
4. **(Stage 2B) The concrete strict port** must reuse the already-strict frozen adapter reads
   (`lib/archive/evidence/file.ts`, `lib/evidence-capture/odds-archive/file.ts`) verbatim and run
   inside the durable job lock (INV-L), exactly as `types.ts:6-9` and the migration review MC-2
   require — no fail-open reader, no persisted cursor.

---

## 12. Final Verdict

# STAGE 2A IMPLEMENTATION APPROVED

Stage 2A is fully compliant with the approved architecture. It is **dormant, unwired,
deterministic, pure, and reusable — and nothing else.** It adds no cron/runner/provider/M6/M8/flag
wiring, mints no identity, changes no frozen contract or archive format, creates no cursor, and
fails closed on both I/O/parse errors (via the strict port + never-catch builders) and internal
record conflicts (via the normalizers' `ArchiveStateConflictError`). The two additive optional
fields are backward-compatible internal evolution — `currentValidationHeads` mandated by MC-1;
`orphanOddsWindowKeys` a harmless descriptive addition — with zero current consumers. Validation is
green on every axis.

**Stage 2B may begin: YES.**

---

### Validation results (re-run this pass, 2026-07-30, read-only)

| Check | Command | Result |
|---|---|---|
| Stage-2A targeted tests | `node --require ./scripts/mock-server-only.cjs --import tsx --test tests/evidenceArchiveStateBuilders.test.ts` | **25 pass / 0 fail / 0 skip** |
| Full suite | `npm test` | **1760 pass / 0 fail / 0 skip** |
| Typecheck | `npm run typecheck` | **clean (exit 0)** |
| Lint | `npm run lint` | **clean — no ESLint warnings or errors** |

**Independently verified from source:** no runtime consumer of the builders/normalizers outside the
barrel re-export and the Stage-2A test (grep-clean); no `Date.now`/`Math.random`/`process.env`/`fs`
in `archive-state/` (comment-only mention); the Stage-1 classifier reads only pre-existing required
state fields (`eligibility.ts`, `capture-provider.ts`, `settlement-provider.ts`); the two new state
fields have zero consumers anywhere; frozen record shapes unchanged (typecheck exit 0).

**Files modified during this review:** only this document
(`docs/plans/m10-stage-2a-implementation-review.md`). **No runtime code, no tests, no deployment, no
configuration were modified.**
