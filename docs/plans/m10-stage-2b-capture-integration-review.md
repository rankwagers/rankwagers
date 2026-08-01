# M10 Stage 2B — Capture Integration Review (M6/M9 Capture Runner Insertion Analysis)

**Document type:** Pre-implementation integration review (Stage 2B of M10). **REVIEW ONLY — no code written.**
**Date:** 2026-07-30
**Milestone:** Sprint 23B — M10 (Live Candidate Pipeline), **Stage 2B** (wire the Stage-1 capture provider + Stage-2A archive-state builders into the live M9 capture runner, inside the durable lock).
**Type:** Read-only analysis of the existing M6 capture service + M9 capture runner to determine the correct insertion point, adapter boundary, files to change, abstraction risks, and reusable helpers. **No runtime code, test, flag, cron, config, or deployment was modified.** The only file created is this document.

**Inspected (file:line):**
`lib/jobs/runner.ts` (`runEvidenceCaptureJob`, `runWithLock`); `lib/evidence-capture/jobs/capture-run.ts` (`runCaptureBatch`); `app/api/internal/cron/evidence-capture/route.ts`; `lib/evidence-capture/candidates/capture-provider.ts` (`buildCaptureCandidates`/`planCaptureCandidates`); `lib/evidence-capture/candidates/archive-state/{builders,normalize,types}.ts` (Stage 2A); `lib/archive/evidence/{store,file,service}.ts` + `memory.ts`; `lib/evidence-capture/odds-archive/{store,file,service}.ts` + `memory.ts`; `lib/evidence-capture/capture/{capture,mandatory-odds}.ts`; `lib/evidence-capture/source.ts`; `lib/evidence-capture/routing/*`; `lib/evidence-capture/model/derive.ts`.

---

## 1. Executive Summary

The M9 capture pipeline is already fully built and dormant. The frozen chain is:

```
cron route ──► runEvidenceCaptureJob (runner.ts:282)
                 │  flag gate (C2) → durable lock (C1) via runWithLock
                 ▼
              runCaptureBatch(deps, candidates)   ← candidates = options?.candidates ?? []   (runner.ts:296)
                 │  per candidate: captureEvidenceSnapshot (M6, frozen)
                 ▼  then ensureMandatoryCaptureOdds (C5, frozen)
              CaptureBatchResult { counts, failures }
```

**The entire Stage-2B integration is a single, precise seam: replace the empty `?? []` candidate source at `runner.ts:296` with live candidates produced — inside the already-held durable lock — by the Stage-1 provider fed by Stage-2A archive state and the daily-list source.** Nothing downstream of `runCaptureBatch` changes; the batch sequencer, M6 capture service, C5 mandatory-odds, and every frozen contract stay untouched.

**The one real structural gap is the adapter boundary:** Stage-2A's read port needs *whole-archive* reads (`readAllSnapshots()`, `readAllOddsRecords()`), but neither the `EvidenceArchiveStore` nor the `OddsArchiveStore` **interface** exposes a whole-archive read — they offer only per-fixture/per-capture reads. The strict whole-file readers **already exist** inside both file adapters (`readNdjson` in `evidence/file.ts`, `readAll` in `odds-archive/file.ts`) but are **private closures**. The correct, minimal, adapter-neutral fix is to **surface those existing readers as one new interface method per store** — not to re-implement NDJSON parsing at the orchestration layer, and not to build a factory/registry abstraction.

No blocker; the wiring is small and every hard part (strict reads, fail-closed, determinism, pair-completeness, ceilings, lock) is already solved in code and only needs connecting.

---

## 2. Most Accurate Insertion Point

**Primary seam — `lib/jobs/runner.ts:296`, inside `runEvidenceCaptureJob`'s `runWithLock` closure:**

```
// current (dormant): empty pass
const { counts, failures } = await runCaptureBatch(deps, options?.candidates ?? []);
```

Stage 2B produces live candidates **exactly here** and only when none are injected (the injectable `options.candidates` seam must be preserved for tests). This location is correct because:

1. **It is already inside the durable lock (INV-L).** `runWithLock("evidence_capture", …)` holds `job:evidence_capture` bound to `EVIDENCE_DATABASE_URL`, fail-closed in production (`runner.ts:72-86`). Discovery + archive read + classification + selection + processing therefore all run under one held lock — no second seam, no lock re-acquisition (MC-2 / spec §7.1).
2. **It is behind the flag gate (C2).** `isCaptureEnabled` short-circuits to `flagSkippedJob` *before* the lock (`runner.ts:288-290`), so a disabled fire never reads an archive or fetches a source — the dormant/empty-pass posture is preserved until activation.
3. **`deps` (the two stores) are already resolved here** (`runner.ts:292-295`) — the concrete read port is built from the same `deps.evidenceStore` / `deps.oddsStore`, so discovery reads and capture writes share one store instance under one lock.
4. **`runCaptureBatch` stays frozen.** It already accepts `readonly CaptureRequest[]` and is a pure sequencer; feeding it live candidates instead of `[]` requires **zero change to `capture-run.ts`**.

**Recommended shape (do NOT inline it all into the runner):** introduce one new orchestration module — e.g. `lib/evidence-capture/jobs/capture-candidates.ts` exporting `async function discoverCaptureCandidates(deps, { evaluationInstant, config }) → { candidates, diagnostics }`. `runEvidenceCaptureJob` calls it inside the lock:

```
const injected = options?.candidates;
const { candidates, diagnostics } =
  injected !== undefined
    ? { candidates: injected, diagnostics: undefined }
    : await discoverCaptureCandidates(deps, { evaluationInstant, config });
const { counts, failures } = await runCaptureBatch(deps, candidates);
```

This keeps the runner a thin lifecycle/flag/lock/metrics shell (its current role) and puts discovery in a testable, provider-facing unit — mirroring how `runCaptureBatch` is already a separate unit from the runner.

**Rejected alternatives:**
- *Producing candidates in the cron route* (`app/api/internal/cron/evidence-capture/route.ts`) — WRONG: outside the lock, outside the flag gate; the route must stay a one-line `handleCronPost` delegate.
- *A new cron route / new JobType* — unnecessary; the `evidence_capture` job + lock + flag + route already exist. Stage 2B adds no route and no scheduler change.
- *Producing candidates inside `runCaptureBatch`* — WRONG: would fuse discovery into the frozen sequencer and couple it to the source/provider.

---

## 3. Adapter Boundary (the central finding)

### 3.1 The mismatch
Stage-2A builders require a port with whole-archive reads (`archive-state/types.ts:31-47`):

```
SnapshotReader.readAllSnapshots(): Promise<readonly EvidenceSnapshot[]>
OddsReader.readAllOddsRecords(): Promise<readonly OddsArchiveRecord[]>
CaptureArchiveReadPort = SnapshotReader & OddsReader
```

But the **store interfaces expose no whole-archive read**:
- `EvidenceArchiveStore` (`lib/archive/evidence/store.ts:38-66`): `appendSnapshot`, `appendValidation`, `listSnapshots(fixtureId)`, `listValidations(fixtureId)`, `latestSnapshot(fixtureId)`, `nextSequence(fixtureId)` — all **per-fixture**.
- `OddsArchiveStore` (`lib/evidence-capture/odds-archive/store.ts:24-33`): `append`, `get(id)`, `listByCapture(captureId)`, `listByFixture(fixtureId)` — all **per-key**.

Building the port by looping `listSnapshots(fixtureId)` over every fixture would be **O(F²)** and violate Stage-2A's PB-1 single-bounded-read invariant. So per-fixture reads are the wrong seam.

### 3.2 The reusable readers already exist (private)
- **Evidence:** `readNdjson<T>(file)` (`evidence/file.ts:76-127`) is a strict whole-file reader — ENOENT→`[]`, malformed/EACCES/EPERM/EIO/other→throw. It is the *exact* SC-1/AR-0 semantic Stage-2A's port contract mandates. It is **module-private**; the store closure calls it via `snapshotsFor`/`validationsFor` (which filter by fixture). Note it does **not** dedup/verify — which is precisely why Stage-2A's normalizer carries the `assertNoHashConflict` backstop (`normalize.ts:41-54`, documented `types.ts:57-71`). Faithful.
- **Odds:** `readAll()` (`odds-archive/file.ts:70-116`) is already a strict whole-archive reader that dedups on `id`, runs `verifyOddsRecord`, and throws on a conflicting-hash duplicate. It is **closure-private** but already backs `get`/`listByCapture`/`listByFixture`/`append`.

### 3.3 Correct boundary — surface one whole-archive read per store interface
Add a whole-archive strict read to each **store interface** and implement it in **both** adapters (file + memory), backed by the existing private readers:

| Interface | New method | File adapter impl | Memory adapter impl |
|---|---|---|---|
| `EvidenceArchiveStore` | `readAllSnapshots(): Promise<EvidenceSnapshot[]>` and `readAllValidations(): Promise<ValidationRecord[]>` | expose `readNdjson<…>(SNAPSHOTS_FILE)` / `(VALIDATIONS_FILE)` | flatten the per-fixture streams |
| `OddsArchiveStore` | `readAllRecords(): Promise<OddsArchiveRecord[]>` | expose existing `readAll()` (return `cloneOddsRecord` copies) | flatten the in-memory map |

Then the concrete Stage-2B port is a **trivial object literal** in the orchestration module — no new class, no factory:

```
const capturePort: CaptureArchiveReadPort = {
  readAllSnapshots: () => deps.evidenceStore.readAllSnapshots(),
  readAllOddsRecords: () => deps.oddsStore.readAllRecords(),
};
const archiveState = await buildCaptureArchiveState(capturePort);
```

Why this is the right boundary:
- **Adapter-neutral (spec §4.0, Postgres-forward):** the future PG adapter implements `readAllSnapshots` as `SELECT … FROM evidence_snapshots` (streamed/indexed) — the orchestrator is unchanged. Reaching into the NDJSON file module directly would fork the seam and break the cutover.
- **Reuses the existing strict readers verbatim** — the fail-closed SC-1/AR-0 semantics are not re-implemented, so there is exactly one place that decides "ENOENT→empty, everything else→throw."
- **Satisfies PB-1** — one whole read per store per run, classify in memory (O(A), not O(F²)).

### 3.4 Interface-change scope note
These new methods change **internal adapter-seam interfaces** (`lib/archive/evidence/store.ts`, `odds-archive/store.ts`), **not** a frozen evidence contract (`types/evidence/*`, identity/hash/record shapes). The evidence store's own doc states "nothing outside `lib/archive/evidence/` should talk to a store adapter directly" — it is an internal port, so additive interface evolution is in-scope and safe. It is nonetheless a **breaking interface change for every implementer**: the file adapter, the memory adapter, and any test double that constructs an `EvidenceArchiveStore`/`OddsArchiveStore` must implement the new method or typecheck fails (see §4 completeness).

---

## 4. Files That Must Change (Stage 2B)

**Adapter boundary (required for the port):**
1. `lib/archive/evidence/store.ts` — add `readAllSnapshots()` + `readAllValidations()` to `EvidenceArchiveStore`. *(Settlement Stage will need `readAllValidations`; adding both now keeps the seam symmetric — acceptable, or defer `readAllValidations` to the settlement stage if strict minimalism is preferred.)*
2. `lib/archive/evidence/file.ts` — return the two new methods from `createFileEvidenceArchive`, delegating to the existing private `readNdjson`.
3. `lib/archive/evidence/memory.ts` — implement the two methods over the per-fixture streams (flatten + concat).
4. `lib/evidence-capture/odds-archive/store.ts` — add `readAllRecords()` to `OddsArchiveStore`.
5. `lib/evidence-capture/odds-archive/file.ts` — expose the existing private `readAll()` as `readAllRecords()` (defensive `cloneOddsRecord`).
6. `lib/evidence-capture/odds-archive/memory.ts` — implement `readAllRecords()` over the map.

**Orchestration (the actual wiring):**
7. **NEW** `lib/evidence-capture/jobs/capture-candidates.ts` — the Stage-2B capture discovery orchestrator: build the concrete `CaptureArchiveReadPort` from `deps`; `buildCaptureArchiveState(port)` (Stage 2A); load daily-list `sourceRows` via `loadPublishedDailyPredictions(date)` (source.ts); assemble `CaptureProviderInput { sourceRows, evaluationInstant, leadMinutes, archiveState, config }`; call `buildCaptureCandidates(input, { deriveCaptureInput })` (Stage 1); return `{ candidates, diagnostics }`. Env/config (date, leadMinutes, supportedCompetitions, maxSourceAgeMs, modelVersion) are read **here**, not in the pure provider.
8. `lib/jobs/runner.ts` — in `runEvidenceCaptureJob`, capture one deterministic `evaluationInstant` at run start and, when `options.candidates` is undefined, call `discoverCaptureCandidates(deps, …)` inside the lock instead of `?? []`; fold the provider `diagnostics` into `resultCounts`/`emitOutcomeMetrics` (C7).

**Derivation dependency (`deriveCaptureInput`) — wires M4 + M5 behind the provider's single injected seam:**
9. **NEW** a derivation module (e.g. `lib/evidence-capture/jobs/derive-capture-input.ts`) implementing `CaptureProviderDeps.deriveCaptureInput(request) → CaptureDeriveResult`: run the M4 fetch plan (`routing` `orchestrateFetches` + `admitProviderArchive`/`admitOddsArchive`) and M5 `deriveEvidenceModel(FixtureModelInput)`, returning `{ ok:true, modelInput, …provenance }` or `{ ok:false, reason }`. *(This is the largest new surface and may itself be split into its own sub-stage; it is where `missing_odds`/`invalid_odds`/`not_admitted`/`no_scorable_markets` are decided — faithfully surfaced, per Stage-1 §11.)*

**Tests (new only — do not modify existing):**
10. **NEW** `tests/*.test.ts` for: the two adapters' `readAll*` (strict fail-closed parity with the private readers; ENOENT→empty, corrupt→throw); the concrete port + `discoverCaptureCandidates` (archive-state → provider → candidates, determinism, ceilings, empty-source pass); the runner wiring (injected-candidates path unchanged; disabled-flag no-read).

**Explicitly NOT changed:** `capture-run.ts` (`runCaptureBatch`), `capture/capture.ts`, `capture/mandatory-odds.ts`, `archive-state/{normalize,builders,types}.ts`, `candidates/{eligibility,ordering,limits,capture-provider}.ts`, the cron route, `config.ts` flag authority, `lib/jobs/locks.ts`, and every frozen `types/evidence/*` contract/identity/hash/format.

---

## 5. Unnecessary Abstraction to Avoid

- **No read-port factory / registry / class.** The concrete port is a 3-line object literal binding two store methods (§3.3). A `ReadPortFactory`, a `class FileCaptureReadPort implements CaptureArchiveReadPort`, or a DI container is pure over-engineering for two closures.
- **Do not re-implement NDJSON parsing / fail-closed logic in the orchestrator.** Reuse `readNdjson` / `readAll` by exposing them on the interface. A second copy of "ENOENT→empty, else throw" would fork the SC-1 semantics and is the one thing most likely to introduce a fail-open regression.
- **Do not build the combined `EvidenceArchiveReadPort` (snapshots+odds+validations) for capture.** Capture needs only `CaptureArchiveReadPort` (snapshots+odds). The combined port is a reasonable convenience only if one concrete adapter later serves *both* capture and settlement from a single object — defer it to the settlement stage; don't force it now.
- **Do not add a persisted cursor / progress cache / "last processed" marker.** INV-A: the archive is the sole checkpoint; `already_captured` is recomputed each fire from `buildCaptureArchiveState`. A cursor would create divergent, non-importable state (MC-2).
- **Do not thread a new "capture context" god-object through the provider.** The provider's I/O types (`CaptureProviderInput`, `CaptureProviderDeps`) are already the complete injection surface — assemble them at the orchestrator and pass them; don't wrap them.
- **Do not add a new JobType, cron route, or flag.** `evidence_capture` + `job:evidence_capture` + `EVIDENCE_CAPTURE_ENABLED` + the route already exist and are correct.

---

## 6. Helpers That Must Be Reused (do not rebuild)

| Concern | Reuse (existing) | Location |
|---|---|---|
| Whole-archive strict read (snapshots/validations) | `readNdjson<T>` (expose it) | `lib/archive/evidence/file.ts:76` |
| Whole-archive strict read (odds, dedup+verify) | `readAll` (expose as `readAllRecords`) | `lib/evidence-capture/odds-archive/file.ts:70` |
| Archive-state normalization | `buildCaptureArchiveState` / `normalizeCaptureArchiveState` | Stage 2A `archive-state/{builders,normalize}.ts` |
| Discovery / classify / order / cap → `CaptureRequest[]` | `buildCaptureCandidates` / `planCaptureCandidates` | Stage 1 `candidates/capture-provider.ts` |
| Ceilings ≤150, fail-safe 100 | `normalizeBatchLimit` (already inside the provider) | `candidates/limits.ts` |
| Daily-list source rows (`PublishedDailyPrediction[]`) | `loadPublishedDailyPredictions` / `normalizeDailyArchive` | `lib/evidence-capture/source.ts` |
| Batch sequencing + result classification (frozen) | `runCaptureBatch` (unchanged) | `lib/evidence-capture/jobs/capture-run.ts` |
| C5 mandatory odds (frozen, already in the batch) | `ensureMandatoryCaptureOdds` | `capture/mandatory-odds.ts` |
| M6 capture (frozen) | `captureEvidenceSnapshot` | `capture/capture.ts:70` |
| M4 fetch + admission (behind `deriveCaptureInput`) | `orchestrateFetches`, `admitProviderArchive`, `admitOddsArchive` | `routing/*` |
| M5 derivation (behind `deriveCaptureInput`) | `deriveEvidenceModel(FixtureModelInput)` | `model/derive.ts:293` |
| Store resolution (adapter selection) | `getEvidenceArchiveStore` / `getOddsArchiveStore` | the two `service.ts` |
| Durable lock + flag gate + metrics shell | `runWithLock` / `isCaptureEnabled` / `emitOutcomeMetrics` | `lib/jobs/runner.ts` |

---

## 7. Determinism, Lock, Pair-Completeness, Performance, Migration

- **Determinism (MC-3):** the provider is pure and forbids `Date.now`/`Math.random`; the orchestrator must capture **one** `evaluationInstant` (an ISO string) at run start and inject it — never let the provider read a clock. `capturedAt` is the frozen window anchor; `modelVersion` omitted unless configured (never invented). Env/config reads happen only at the orchestration boundary.
- **Lock (INV-L / MC-2):** all discovery reads + writes stay inside the single held `runWithLock` scope; no cursor is persisted between fires.
- **Pair-completeness (DoD-5):** `capturedWindowKeys` (skip) vs `partialWindowKeys` (re-emit healing) are already derived by Stage 2A keyed on the mandatory `evidence_capture` odds row; a corrupt/unreadable odds file **throws** through `buildCaptureArchiveState` (never "no odds → falsely complete/heal"). The orchestrator must let that throw fail the run (alert + retry), never catch-to-empty.
- **Performance:** one whole-archive read per store per run (O(A)), bounded by ceilings ≤150. This is consistent with the *existing* cost — the odds adapter already calls `readAll()` on every `append` (so C5 already pays O(A) per mandatory-odds write); adding one upfront discovery read is not a new architectural regression. The perf review's O(F²)/steeper-capture-curve concern is the pre-existing file-adapter scan cost, gated on the Postgres cutover, not introduced by Stage 2B.
- **Migration:** the new `readAll*` interface methods map cleanly to `SELECT *` in a future PG adapter; they touch no identity/hash/record format. Stage 2B writes nothing of a new shape (all writes remain frozen M6 snapshot + C5 odds). Fully consistent with the approved Stage-2 migration review (MC-1…MC-5).

---

## 8. Findings Summary

**Blocking:** none (this is a pre-implementation review; nothing is built yet).

**Key structural requirement:** the whole-archive read must be surfaced on the two **store interfaces** and implemented in **both** adapters (§3, §4 items 1–6) — this is the single item most likely to be done wrong (either by O(F²) per-fixture looping, by re-implementing fail-closed parsing at the orchestration layer, or by an over-built factory).

**Recommended sequencing:** (a) adapter `readAll*` methods + parity tests; (b) `discoverCaptureCandidates` orchestrator + concrete port over Stage-1/Stage-2A helpers, with a stub `deriveCaptureInput`, wired into `runEvidenceCaptureJob` behind the injectable-candidates seam; (c) the real `deriveCaptureInput` (M4 fetch/admission + M5 derive) as its own sub-stage — it is the largest surface and where `missing_odds`/`not_admitted`/`invalid_odds`/`no_scorable_markets` are decided.

**Insertion point:** `lib/jobs/runner.ts:296`, inside `runEvidenceCaptureJob`'s `runWithLock` closure, replacing `options?.candidates ?? []` with orchestrator-produced candidates when none are injected.

**Adapter boundary:** one new whole-archive strict read per store interface, backed by the existing private `readNdjson` / `readAll`; concrete port = a 3-line object literal.

---

### Verification basis (read-only, this pass)

Traced from source: the capture runner delegates to `runCaptureBatch` with `options?.candidates ?? []` (`runner.ts:296`) inside `runWithLock` under `job:evidence_capture` (durable, prod-fail-closed); the cron route is a one-line `handleCronPost` delegate; Stage-2A's `CaptureArchiveReadPort` needs whole-archive reads (`archive-state/types.ts:31-47`) that neither store interface exposes (`evidence/store.ts:38-66`, `odds-archive/store.ts:24-33`), while both file adapters already contain the strict whole-file readers privately (`evidence/file.ts:76`, `odds-archive/file.ts:70`); the Stage-1 provider consumes `CaptureArchiveState` + injected `deriveCaptureInput` (`capture-provider.ts:201`); daily-list rows come from `loadPublishedDailyPredictions` (`source.ts:97`); M5 entry is `deriveEvidenceModel(FixtureModelInput)` (`derive.ts:293`).

**No runtime code, no tests, no deployment, no configuration were modified in producing this review.** The only file created is `docs/plans/m10-stage-2b-capture-integration-review.md`.
