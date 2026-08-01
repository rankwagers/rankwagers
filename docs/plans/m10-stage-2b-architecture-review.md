# M10 Stage 2B — Compatibility & Forward-Compatibility Review (M7 · M8 · M9 · M10 spec)

**Document type:** Review only — read-only forward-compatibility assessment. No runtime code, test, contract, flag, cron, schema, environment, archive, or deployment changed. The **only** file created is this document.
**Date:** 2026-07-30
**Reviewer axis:** Compatibility & forward-compatibility (future settlement, future Postgres, future activation).
**Subject:** M10 **Stage 2B** — the *orchestration & wiring* stage that runs discovery inside the durable lock and feeds the Stage-1 provider's bounded output into the frozen M6/M8 batches. **Stage 2B is UNBUILT** (planned surface; not yet in the tree).
**Governing:**
`docs/architecture/m10-live-candidate-pipeline-specification.md` (Rev A1),
`docs/plans/m10-stage-2-locked-discovery-architecture-plan.md` (defines the Stage 2B file plan, §16),
`docs/plans/m10-stage-2a-archive-normalization.md` (Stage 2A shipped, dormant),
`docs/plans/m10-stage-2a-implementation-review.md` ("Stage 2B may begin"),
`docs/plans/m10-stage-2-migration-compatibility-review.md` (MC-1…MC-5),
the Rev 2 implementation contract, the Phase 2.7 DoD, and the M7/M8/M9 closures.
**Method:** current call graph, seams, and frozen surfaces read directly from source (file:line cited). No file modified.

---

## 0. Verdict

**FORWARD-COMPATIBLE — CONDITIONALLY (no blocker; no frozen-contract change required).**

Stage 2B, *as specified by the Stage-2 locked-discovery plan §16*, is a purely **additive producer-injection** layer. It touches no frozen identity/hash/revision formula, no archive record shape, no store interface, and no M6/M8 internal. Every seam it needs already exists and is green (M9 built: 1687/1687; Stage 2A built: 1760/1760). On the three forward axes:

- **Future settlement:** compatible. Stage 2B's minimum (first-settle only) is fail-safe; the correction path is *reachable without format change* because Stage 2A already exposes the enriched `currentValidationHeads` (MC-1). The one binding forward obligation is **freezing the `completionInstant` derivation** at activation (MC-3 corollary) so already-settled records replay byte-identically across code versions.
- **Future Postgres:** compatible by construction. Stage 2B flows only through the `EvidenceArchiveStore`/`OddsArchiveStore` interfaces and the M4 entry points — no file-adapter assumption. The bounded ceilings + single-bounded-read discipline (MC-5) are exactly what keeps the file adapter viable until the reversible cutover. No evidence Postgres adapter/importer exists yet (grep-clean); building one is out of Stage 2B scope and is not blocked by it.
- **Future activation:** compatible. Flags stay default-off; a bare cron fire remains a correct empty no-op (M9 baseline). Stage 2B introduces no new activation coupling beyond the two documented operational gates it *must not* silently absorb: the **scheduler-capacity gate** (INV-S, §7.4) and the **chain-verify out-of-band sweep** (H-4). The pre-existing H-1/L-2 unlock→500 is a carry-forward, not introduced here.

Conditions are carried forward verbatim as **MC-1…MC-5** plus five Stage-2B-specific forward-compat gates (**FC-1…FC-5**, §11). None requires touching a frozen contract; all are already mandated by the spec or the migration review. **Stage 2B may proceed.**

---

## 1. What Stage 2B Is (and Is Not)

Stage 2 was split: **Stage 2A** (shipped, dormant) built the pure strict-read archive-state *normalizers/builders* (`lib/evidence-capture/candidates/archive-state/*`) that reduce the durable archives to the Stage-1 `CaptureArchiveState`/`SettlementArchiveState`. **Stage 2B** is the *remaining orchestration/wiring* the locked-discovery plan §16 enumerates and that Stage 2A explicitly deferred ("Supplying a concrete strict read port … and calling these builders inside the durable job lock is a subsequent M10 stage", 2A §8).

**Stage 2B surface (planned, verified absent from the tree):**

| Planned file | Role | Status |
|---|---|---|
| `lib/evidence-capture/candidates/discovery.ts` | Locked-discovery orchestration: source load → archive-state derive → Stage-1 provider → bounded `{candidates, diagnostics}` | absent |
| `lib/evidence-capture/candidates/derive-adapter.ts` | Concrete impl of Stage-1's injected `deriveCaptureInput` = M4 fetch/admission + M5 derive | absent |
| `lib/evidence-capture/candidates/deadline.ts` | INV-D effective-deadline clamp + remaining-ms checker | absent |
| `lib/evidence-capture/candidates/wiring.ts` | Pre-wired `runLive{Capture,Settlement}Job()` so routes stay one-liners | absent |
| `lib/jobs/runner.ts` (modify) | Add optional `discover?` seam inside `runWithLock`; one `evalInstant` read; merge provider diag | seam absent (`grep discover` → none) |
| `lib/evidence-capture/jobs/{capture,settlement}-run.ts` (modify) | Optional `deadline?` guard param → `deferred_by_deadline` count | absent |
| the two cron routes (modify) | One-line swap to the pre-wired live job | unchanged |

Verified absent: `ls candidates/{discovery,derive-adapter,deadline,wiring}.ts` → none; `grep -n discover lib/jobs/runner.ts` → none. The runner today calls `runCaptureBatch(deps, options?.candidates ?? [])` (`runner.ts:296`) and `runSettlementBatch(deps, options?.candidates ?? [])` (`runner.ts:332`) — the empty-pass default.

**Explicitly NOT Stage 2B (deferred, and this review does not require them):** corrections *propagation* (Stage 3, §7.1 below), single-bounded-read *optimization* of the derivation join (the 2A builders already read once per store; the derive-adapter's per-fixture M4 fetch is a separate cost), a precise terminal `completionInstant` (needs a new upstream field), the Postgres adapter/importer, retention/cold-storage, and any operational activation.

---

## 2. Compatibility with M9 (the seam Stage 2B modifies)

M9 is the runnable orchestration Stage 2B extends. The compatibility question is: **does the `discover?` seam preserve every M9 invariant?**

| M9 property | Anchor | Stage 2B effect | Verdict |
|---|---|---|---|
| Injection seam `options?.candidates` defaults empty → bare cron = no-op | `runner.ts:296,332` | `discover?` is an *additional* optional option; when absent, `candidates ?? []` path is preserved verbatim | **Preserved** — B3 empty-pass baseline holds |
| Durable lock in `runWithLock`, `requireDurable:true`, fail-closed in prod | `runner.ts:291,328`; `locks.ts` | `discover(...)` is inserted as the *first statement inside* the callback — strictly under the held lock (INV-L) | **Preserved** — discovery cannot run lock-free |
| Guards live **outside** frozen capture/settlement | M9 C1–C7 | Discovery/derive/deadline all live in `candidates/` + runner, never inside `capture.ts`/`settlement.ts` | **Preserved** — frozen core untouched |
| Batch orchestrators enforce no ceiling (bounding is producer's job, INV-C) | `capture-run.ts`, `settlement-run.ts` iterate `for … of candidates` | Stage 2B clamps at the producer (`clamp(configured,1,150)`); adds only an *optional* `deadline?` param to the orchestrators (M9 code, not frozen M6/M8) | **Preserved** — additive, backward-compatible |
| `resultCounts` + `emitOutcomeMetrics{job,outcome}` low-cardinality | `runner.ts:265` | Stage 2B *merges* provider `CandidateDiagnostics` into `resultCounts` using closed reason vocabularies (`rejected_<reason>`); never emits `fixtureId`/`captureId` as a label | **Preserved** — bounded cardinality (FC-4) |
| Status→HTTP mapping (failed→500, skipped→409, else 200) | `cronHandler.ts:71` | Unchanged; lock contention still → `null` → skipped/409; discovery throw → failed/500 | **Preserved** |

**One M9 carry-forward, not introduced by Stage 2B:** H-1/L-2 — a successful idempotent job can surface as HTTP 500 if `pg_advisory_unlock` throws on release (spec §7.5 table; M9 residual R-1). Stage 2B *should* land the swallow/log fix opportunistically (low severity) but does not create the defect. **Not a Stage 2B blocker.**

**Conclusion:** the `discover?` seam is additive and backward-compatible. The only behavioural change on a *flags-on* fire is that candidates are computed inside the lock instead of injected empty — which is precisely the intended activation. R1 (runner option change touches M9 code) is covered by the empty-pass regression test (Gate B3).

---

## 3. Compatibility with M8 (settlement)

M8 (`settlement.ts` + `outcomes.ts`) is frozen and dormant. Stage 2B is a *producer* that assembles `SettlementCandidate` objects and hands them to the existing `runSettlementBatch → settleLatestSnapshotForFixture` path. Compatibility hinges on three frozen M8 facts:

1. **Corrections require an explicit typed `correctionCause`, and only when the head changes.** `settleSnapshot` writes a correction **only** when `head.state !== outcome.state` **and** a typed `correctionCause` is supplied; a change without cause → `invalid_input` (no write); unchanged → `no_change` (`settlement.ts:299-323`, migration review §10). **Stage 2B minimum never supplies `correctionCause`** → M8 never sees a change it must action → no `invalid_input`, no false correction. **Compatible and fail-safe.**

2. **`archiveStateOk` reads only pre-existing fields and rejects fail-closed.** The Stage-1 settlement provider rejects every row `corrupt_archive_state` when the derived state is not OK (`settlement-provider.ts:46,93`). Stage 2A's enrichment (`currentValidationHeads`, `types.ts:197`) is an *additive optional* field; the guard and classifier read only the pre-existing `capturedFixtureIds`/`settledFixtureIds`. **Stage 2B changes neither.** Compatible.

3. **The archive has no update path — corrections are appended revisions; "current" = MAX(revision) at read.** (`reviseValidationRecord`; `UNIQUE(id,revision)` in the future PG map; migration review §9.) Stage 2B's settlement candidate carries no result/outcome field; it never mutates a row. **Compatible.**

**Forward-settlement completeness (BF-S1, resolved):** Stage-1 now settles lifecycle terminals (`postponed`/`cancelled`/`abandoned` → written `terminal_non_scored`) via `resolveMatchLifecycle` (`eligibility.ts:185`; migration review §10). Stage 2B must feed those candidates through unchanged so the archive does not permanently under-settle. This is *first-settlement*, which Stage 2B's minimum already covers. **Compatible.**

---

## 4. Compatibility with M7 (historical-input identity)

M7 (`input-identity/`, built) freezes `inputContentHash` (excludes `modelVersion`), separates `evidenceInputVersion`, and guarantees a serialization-boundary replay. Stage 2B is the code that *produces the capture inputs M7 hashes*, so it is the boundary that can break M7 if it is non-deterministic.

| M7 guarantee | Spec anchor | Stage 2B obligation | Verdict |
|---|---|---|---|
| `inputContentHash` excludes `modelVersion`; version participates separately | spec §4 (M7 row), §163 | Stage 2B's derive-adapter defaults `modelVersion` to the frozen `"23B.daily-evidence.v1"`; **MUST NOT invent a new version string** (contract §2.A/§6.8, §4.9-R3) | **Compatible** iff FC-2 honoured |
| Every body-influencing `CaptureRequest` field reconstructable from retained data under original `modelVersion` | spec §165, DoD A4 | The derive-adapter runs M4 fetch/admission + M5 derive from the retained provider archive; introduces **no** live-only input; **reuses `request.capturedAt` verbatim** (never re-clocks) | **Compatible** iff FC-1 honoured |
| Serialization-boundary replay test passes over M10-produced captures | spec A4, §322 | Determinism at the producer boundary: no `Date.now`/`Math.random`/ambient-config leak in `candidates/`; the single permitted `evalInstant` read stays a *decision* input, never an identity/hash input | **Compatible** iff FC-3 honoured |

**Identity forward-only invariant (spec §155-160):** `snapshotId` binds `sequence = (latest?.sequence ?? 0)+1` (archive-state-dependent), `captureId` is window-keyed and sequence-free; `capturedAt = kickoff − leadMinutes` (kickoff-anchored, *not* `evalInstant`). Stage 2B captures strictly forward from activation (`expired_window` for passed windows), so `sequence` stays monotonic with `capturedAt` and a re-derivation reproduces identical `snapshotId`. The full-stream pre-check returns `already_exists` rather than minting a duplicate on retry. **Compatible** — Stage 2B changes no identity formula and anchors on kickoff, verified `eligibility.ts` (capturedAt derives from `(kickoffAt, leadMinutes)` only; a missing/invalid kickoff is rejected *before* any coordinate is computed, `eligibility.ts:62-66`).

**Net M7 risk:** the whole M7 axis is safe **iff** the producer boundary is deterministic (FC-1/2/3). This is the single most load-bearing forward obligation and is why MC-3 is a hard condition.

---

## 5. Compatibility with the M10 Spec (Rev A1 invariants)

| Invariant | Requirement | Stage 2B disposition | Verdict |
|---|---|---|---|
| **INV-L** discovery only inside the durable lock | §7.1 | `discover(...)` is the first statement inside `runWithLock`'s callback; only auth + rate-limit + flag checks precede it (cheap, no archive/network) | **Honoured** |
| **INV-C** mandatory fail-safe observable batch ceiling | §7.2 | `effective{Capture,Settlement}Ceiling = clamp(configured,1,150)`, default 100; never the 500 default; overflow deterministically `deferred_by_cap` (counted) | **Honoured** (FC-5) |
| **INV-D** job deadline strictly below route budget | §7.3 | `effectiveJobDeadlineMs = min(configured, 60_000 − 15_000) ≤ 45_000`; the 300 s default is clamped, not honoured; remaining-deadline guard defers before starting unaffordable work | **Honoured** (FC-5) |
| **INV-S** deterministic forward-only anti-starvation ordering | §7.4 | Stage-1 total order (primary `capturedAt` asc, tie-break `fixtureId` asc); consumed fixtures leave the eligible set; deferred = re-discoverable, carries no state | **Honoured** |
| **INV-A** archive is sole checkpoint; no cursor | §7.5 | Progress re-derived every fire from the immutable stores (Stage 2A builders); **no** process-local/filesystem/request/db cursor; grep-clean under `lib/evidence-capture`/`lib/jobs`/`lib/archive/evidence` | **Honoured** (FC — no-cursor proof, plan §15) |
| **Option C** dedicated provider layer, adapter-neutral, injected | §4.0 | Provider stays pure; discovery reads source+archive only through interfaces + M4 entry points; routes stay one-liners; frozen consumer surface unmodified | **Honoured** |
| **A4** replay preserved over M10 output | §12 A4 | The M7 serialization-boundary replay test extended over M10-discovered captures is a required Gate-A test (plan §17) | **Honoured** iff FC-3 |

No invariant is violated by the specified Stage 2B. Each is a MUST that the plan §16 wiring satisfies by construction; the review's role is to ensure the *implementation* does not silently weaken one (the FC gates below).

---

## 6. Forward Compatibility — Future Settlement

**Where Stage 2B lands settlement:** first-settle only. `settledFixtureIds` marks any fixture with a current terminal validation as settled → Stage-1 skips it (`already_settled`) → Stage 2B never supplies `correctionCause` → M8 never sees a change. Correct and idempotent (`no_change` on re-fire).

**Is the correction path reachable later without rework or format change? YES.**
- Stage 2A already exposes `currentValidationHeads` (`types.ts:197`, MC-1 enrichment) — *current-outcome-per-(fixture, market)* derived purely from existing `ValidationRecord` fields (`state`, `revision`, `marketKey`, `selectionKey`, `snapshotId`). This is exactly the state M8's correction path needs (`head.state !== outcome.state`). **No new archive field is ever forced** — the coarse `settledFixtureIds` binary is *not* the persisted state, merely the current classifier input. **Format-evolution-free forward path confirmed** (migration review §4/§10, MC-1).
- The Stage-3 correction increment therefore only has to: (a) read `currentValidationHeads` instead of `settledFixtureIds` for the changed-outcome decision, (b) emit an `already_settled`-but-changed candidate, (c) set the typed `correctionCause` (`result_reinterpreted` → `settlement_correction`, `source_lineage_changed` → `data_correction`). All additive.

**Binding forward obligation — freeze the `completionInstant` derivation (FC-1, MC-3 corollary).** `completionInstant` defaults to `ISO(row.kickoff)` (the only deterministic source; ranks above `fetchedAt`/wall-clock which are FORBIDDEN, plan §11). It is hashed into `ValidationRecord.contentHash` via `recordedAt`/`settledAt` but is **excluded from identity** (`validationId`/`revisionId`). Consequence: if the derivation *changes across code versions*, a replay of an already-settled record re-derives a *different* `contentHash` — a **replay divergence, not a stored rewrite** (the record stands). Therefore the derivation must be **frozen/versioned once settlement is activated** (migration review §12, row "Deterministic timestamp fallback"). A precise terminal instant is impossible without a new upstream field (`FootyMatchRow` carries no terminal/result timestamp, only `kickoff`/`kickoffTime`/`status` — plan §11) → record as a future upstream enhancement; **never introduce a current-time fallback.**

**Deferral is safe and bounded:** first-settlement is not lost (BF-S1 fixed), so deferring later-correction propagation is a *completeness gap, not data loss* — **provided it is documented and go-live is gated on unresolved corrections** (migration review §10). Recommendation stands: land correction support with the enriched state in the settlement increment, or explicitly meter + block go-live on it.

---

## 7. Forward Compatibility — Future Postgres

**Adapter-neutral by construction.** Stage 2B reads/writes only through `EvidenceArchiveStore`/`OddsArchiveStore` and the M4 source/routing entry points; it embeds no file-adapter assumption (Option C §4.0/§9.4). The Stage 2A builders already depend only on an abstract strict read port (2A §3). The concrete strict port Stage 2B supplies **must reuse the already-strict frozen adapter reads** (2A implementation review recommendation 4) — never a re-implemented reader with weaker error semantics.

**Current state (verified):** no evidence Postgres adapter, migration, or importer exists — `grep createPostgres` → none; `db/migrations` + `rehearse-migrations.mjs` target other subsystems (migration review §"Independently verified"). Building one is **out of Stage 2B scope** and is a later *reversible env cutover* (spec §9.4, §"Postgres" out-of-repo gate). Stage 2B neither needs it nor blocks it.

| Postgres-forward property | Requirement | Stage 2B disposition |
|---|---|---|
| **Bounded reads keep file adapter viable until cutover** | File store op is O(A); whole-day run O(F·A) ≈ O(F²), capture the steeper curve (per-market odds `readAll`) | Ceilings ≤150 + single bounded read/run (MC-5) — the exact discipline that defers the cutover; **Stage 2B MUST NOT ship 500 as the ceiling** |
| **No update path — append-only log** | Corrections are new rows; `UNIQUE(id,revision)`; current = MAX(revision) | Stage 2B appends only via M6/M8; adds no update path (§3) — the single most important PG-forward property, keeps the importer trivially idempotent |
| **Hash-faithful timestamps** | Hashed instants (`recordedAt`/`settledAt`/`capturedAt`) must round-trip byte-identically | Store as verbatim TEXT in the future PG map (migration review G5); Stage 2B must not reformat/normalize any hashed instant it emits |
| **Retention append-only-safe** | Deleting within the replay/checkpoint horizon breaks full-stream idempotency (re-mint at `sequence=last+1`) and turns a complete window partial (healing re-emit) | Stage 2B **must not assume pruning happens** (MC-4); retention is out of scope and may only cold-archive fully-settled past-window records |
| **Engine-independent hashing** | A one-shot offline import must reproduce identical hashes | Stage 2B changes no hash formula; content-hashing stays engine-independent → import feasible after years of data (migration review §12) |

**Conclusion:** Stage 2B is Postgres-transparent. It bakes in no assumption that blocks the cutover; its bounded design is what makes the file adapter survivable in the interim.

---

## 8. Forward Compatibility — Future Activation

Activation (flags flipped, cron scheduled, `EVIDENCE_DATABASE_URL` provisioned, chain-verify sweep + alerting) is an **out-of-repo operational gate, not built by M10** (spec §4 table, §"Operational activation").

| Activation concern | Requirement | Stage 2B disposition | Verdict |
|---|---|---|---|
| **Flags default-off** | Merge must be dormant; bare cron = no-op | Stage 2B keeps `EVIDENCE_CAPTURE_ENABLED`/settlement flags default-off; flag check stays *before* the lock (cheap, short-circuits); a disabled fire acquires no lock | **Preserved** — reversible = flags-off |
| **Durable lock provisioned** | No `EVIDENCE_DATABASE_URL` in prod → job fails closed (M9 C1) | Stage 2B changes nothing here; contention → `null` → skipped/409; this is an *activation gate*, not a Stage 2B defect | **Preserved** |
| **Scheduler-capacity gate (INV-S)** | Activation MUST fail/block if sustained arrival rate > `cadence × effectiveCeiling` | Stage 2B **must surface** `backlog_size` + `oldest_pending_age` (spec §10) so this gate is checkable; it must **not** silently absorb overflow as "done" — deferred-by-cap must be visible | **Gate FC-4** — observability must expose it |
| **Chain-verify sweep (H-4)** | `verifyEvidenceChain`/`verifyValidationChain` run as a **scheduled out-of-band sweep**, never inline per request | Stage 2B **must not** invoke chain-verify inline (perf review §188); it ensures produced data passes them and documents the sweep as an activation prerequisite | **Honoured** — keep out-of-band |
| **Unlock→500 (H-1/L-2)** | A successful idempotent run should not misreport as 500 on unlock throw | Carry-forward from M9; Stage 2B *should* land the swallow/log fix opportunistically (low severity) | **Not introduced here** |

**No new activation coupling.** Stage 2B adds discovery + derive + deadline strictly inside the existing lock/flag/route envelope. The only activation-adjacent obligations it *owns* are (a) not hiding backlog/starvation behind clean counts (FC-4) and (b) not moving chain-verify inline. Both are honoured by the plan §14/§16.

---

## 9. Determinism & No-Cursor — the load-bearing forward property

Every forward axis (M7 replay, PG import, restart-safety, anti-starvation) rests on the same two properties:

- **Determinism (MC-3):** discovery is a pure function of `(source-for-date, archive-state-from-stores, evalInstant, config)`. The only clock read is a single `evalInstant` at the top of the locked callback, threaded into eligibility timing + `nowSec` — a *decision* input, never entering `capturedAt`/`captureId`/`snapshotId`/`completionInstant` (all kickoff-anchored). A static rule (lint/guard) banning `Date.now`/`Math.random` under `candidates/` except that one read is a required Gate-A test (plan §17; 2A recommendation 3). **Determinism at this boundary is what keeps the frozen M6/M7/M8 guarantees intact** — if it breaks, `inputContentHash` and the settlement `contentHash` diverge at the one boundary M10 owns.
- **No cursor (INV-A / MC-2):** progress = what the archive already contains, recomputed every fire. No process-local/filesystem/request/db cursor. Deferred candidates carry no state; a re-fire re-derives identical remaining work; the durable lock serialises writers and idempotency makes concurrent/repeated work safe. Restart/multi-worker safe. Grep-clean (plan §15, migration review §"Independently verified").

These are not new requirements — they are the invariants Stage 2B must not weaken, and they are the reason the review is *conditional* rather than unconditional.

---

## 10. Independently Verified From Source

- Runner empty-pass default present: `runner.ts:296` `runCaptureBatch(deps, options?.candidates ?? [])`, `runner.ts:332` symmetric; `discover?` seam absent (`grep discover lib/jobs/runner.ts` → none).
- Stage 2B files absent: `discovery.ts`/`derive-adapter.ts`/`deadline.ts`/`wiring.ts` do not exist under `candidates/`.
- Stage 2A dormant enrichment present and additive: `types.ts:155` `orphanOddsWindowKeys?`, `types.ts:197` `currentValidationHeads?` (both optional).
- Settlement provider fail-closed guard reads pre-existing fields only: `settlement-provider.ts:46,93` (`archiveStateOk`).
- Capture identity kickoff-anchored, missing/invalid kickoff rejected before any coordinate: `eligibility.ts:62-66`.
- M8 correction path requires typed `correctionCause` only on head change: `settlement.ts:299-323` (per migration review §10).
- No evidence Postgres adapter/importer: `grep createPostgres` → none (migration review §"Independently verified").
- Baselines green as of the referenced closures: M9 1687/1687; Stage 2A 1760/1760; typecheck exit 0; lint clean.

*(Anchors cross-checked against the governing docs; no runtime file was opened for modification.)*

---

## 11. Conditions (carried + Stage-2B-specific)

**Carried forward verbatim (already mandated; all non-format-changing):**

- **MC-1** — correction-capable settlement state from existing `ValidationRecord` fields (Stage 2A's `currentValidationHeads`); no new archive field.
- **MC-2** — archive-as-sole-checkpoint, no persisted cursor (INV-A) + discovery-inside-lock (INV-L).
- **MC-3** — strict producer determinism (no clock/random beyond the single `evalInstant` decision read); freeze the `completionInstant` derivation once activated.
- **MC-4** — append-only-safe retention only; never prune within the replay/checkpoint horizon.
- **MC-5** — single bounded archive read per run under bounded ceilings (≤150, default 100, clamp; never 500).

**Stage-2B-specific forward-compat gates (verify at implementation):**

- **FC-1 (M7/settlement replay):** the derive-adapter reuses `request.capturedAt` verbatim and introduces no live-only capture input; `completionInstant` stays kickoff-anchored (no wall-clock/`fetchedAt` fallback). Trace: A4 replay test over M10 output; capturedAt-reuse unit test.
- **FC-2 (M7 version):** `modelVersion` defaults to the frozen `"23B.daily-evidence.v1"`; Stage 2B invents no new version string. Trace: derive-adapter unit assertion.
- **FC-3 (determinism boundary):** static/lint guard bans `Date.now`/`Math.random` under `candidates/` except the single runner `evalInstant`; shuffled-source → byte-identical candidate arrays. Trace: determinism guard + A7 ordering test.
- **FC-4 (activation observability):** merged `resultCounts` exposes `backlog`, `oldest_pending_age`, `deferred_by_cap`, `deferred_by_deadline` at bounded cardinality (no fixtureId/captureId labels), so the INV-S scheduler-capacity gate is checkable; chain-verify stays an out-of-band sweep. Trace: diagnostics unit + observability review.
- **FC-5 (bounded budget):** effective ceiling `clamp(configured,1,150)` default 100 (never 500); effective job deadline `min(configured, 60_000−15_000) ≤ 45_000` (never the raw 300 s); insufficient-remaining → defer. Trace: A6 ceiling + A9 deadline-clamp unit tests; B5 benchmark < 45 s.

None is a blocker; each is a safe default the plan already fixes.

---

## 12. Statement

Review only. The single file created is this document. No runtime code, test, existing document, frozen contract (`types/evidence/*`, `EvidenceArchiveStore`/`OddsArchiveStore`, identity/hash/revision formulas), archive format, schema, feature flag, cron route, runner, scheduler, environment, database, or deployment configuration was modified. All cited `file:line` anchors, types, and config values were read from the current repository so an implementer can verify them. **Stage 2B remains unbuilt**; this document assesses its compatibility with M7, M8, M9, and the M10 spec on the forward axes (future settlement, future Postgres, future activation) and finds it **forward-compatible, conditionally (no blocker, no frozen-contract change), subject to MC-1…MC-5 and FC-1…FC-5.**
