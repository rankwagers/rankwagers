# M10 Stage 2E — Implementation Slice 2 (Measurement Layer & Route-Entry Timing) — Official Closure

**Document type:** Official closure / consolidation. Read-only. No runtime, route, cron, job, flag, test, schema, migration, deployment, or benchmark code was created or modified. The **only** file created is this closure. Suites/typecheck/lint were *executed read-only* to independently verify the green state.
**Sprint / Milestone / Stage / Work:** Sprint 23B · M10 · Stage 2E · Implementation · Slice 2.
**Date:** 2026-07-31.
**Method:** every load-bearing claim re-verified against repository source (`file:line`); **all five** mandated Slice-2 reviews consolidated (this amendment adds the now-present Architecture and Production-Safety reviews, verified with zero blockers); full suite + typecheck + lint verified green.
**Amendment note (2026-07-31):** the two reviews previously recorded as absent — Architecture and Production-Safety — now exist and approve (APPROVED / PASSED, zero blockers). This amendment discharges the prior administrative condition and upgrades the decision from CONDITIONALLY FROZEN to **FROZEN**. Only this closure document was changed.

---

# Executive Summary

Slice 2 delivers the **route-entry timing + measurement layer** for the M10 live-candidate pipeline and closes Stage-2E-B finding **F-C** (the effective deadline was anchored *after* discovery, so source-load + discovery escaped the budget). It does so with **one additive, dormant runtime seam** (`lib/jobs/runner.ts`: an optional `deadlineAnchorMs`) plus a **non-runtime, synthetic, CLI-only benchmark measurement layer** under `scripts/bench/m10/`.

The implementation is **verifiably complete and safe**: the seam is byte-for-byte back-compatible when unsupplied (every current caller), no schema/archive/evidence-contract changed, production stays dormant (no flag, no cron, no production benchmark/archive/DB), and the harness is isolation-guarded and synthetic-only. Independent re-run this pass: **1837/1837 tests, typecheck exit 0, lint clean, repo artifact dirs empty.**

**All five mandated independent reviews now exist and approve with zero blockers** — Architecture (**APPROVED**), Production-Safety (**PASSED**), Compatibility (**COMPATIBLE**), Performance (**PASSED**), Test Strategy (**APPROVED**). The two reviews that were absent at the previous closure pass — Architecture and Production-Safety — have since been authored, independently verified against source (Architecture zero blockers; Production-Safety zero blockers, production dormant, rollback trivial), and consolidated here. The prior administrative condition is therefore discharged; no code, correctness, safety, or documentary condition remains.

**Decision: SLICE 2 FROZEN** — zero blockers across all five reviews; zero conditions. All carry-forward items are non-blocking and owned by later slices.

---

# Repository Verification

Every claim below was read from current source, not trusted from documentation.

| Claim | Verification | Result |
|---|---|---|
| Additive anchor seam | `lib/jobs/runner.ts:308` `anchorMs?: number`; `:314-315` `startedAtMs = typeof anchorMs === "number" && Number.isFinite(anchorMs) ? anchorMs : now()` | ✓ fail-safe to `now()` |
| `deadlineAnchorMs` on both jobs | `runner.ts:377` (capture) + `:481` (settlement); threaded at `:420` + `:523` | ✓ symmetric |
| Production clock domain (CF-1) | `runner.ts:388` + `:491` `const now = options?.now ?? Date.now` | ✓ prod default = wall-clock |
| BC-1 builders exist | `createEvidenceSnapshot` `lib/evidence/snapshot.ts:202`; `createValidationRecord` `lib/validation/records.ts:135` | ✓ resolved |
| Strict reader NOT built | grep `readDailyArchiveStrict` in `lib/` → none; fail-open `readDailyArchive` untouched | ✓ deferred, as claimed |
| Bench layer present | `scripts/bench/m10/{phases,measure,fixtures,cells,cli}.ts` new; `types.ts`/`report.ts` extended | ✓ |
| Regression floor + green | `npm test` → **1837/1837/0** (= 1824 floor + 13) | ✓ re-verified |
| Typecheck / lint | `npm run typecheck` exit 0; `next lint` "No ESLint warnings or errors" | ✓ re-verified |
| Artifact isolation | `scripts/bench/m10/artifacts/` holds only `.gitkeep`/`.gitignore` | ✓ clean |

**Verify-implementation checklist (all confirmed against source):** ✓ Route-entry anchor implemented · ✓ Deadline composition corrected · ✓ F-C closed · ✓ Additive runtime seam · ✓ Backward compatibility · ✓ No schema evolution · ✓ No archive evolution · ✓ No evidence contract evolution · ✓ Benchmark framework isolated · ✓ CLI-only execution · ✓ Production dormant · ✓ Flags unchanged · ✓ No cron activation · ✓ No production benchmark · ✓ No production archive access · ✓ Synthetic fixtures only · ✓ Isolation guards verified · ✓ Raw-sample measurement · ✓ Route-entry accounting · ✓ Artifact isolation · ✓ Regression suite green · ✓ Typecheck green · ✓ Lint green.

---

# Slice 2 Scope

Slice 2 ships exactly two things:

1. **One runtime change** — an additive, dormant optional route-entry anchor on the two job orchestrators and their shared deadline-budget helper, enabling the benchmark to charge source-load + discovery to the effective deadline (closing F-C).
2. **A non-runtime measurement layer** — synthetic, in-process, CLI-only benchmark cells under `scripts/bench/m10/` that measure the settlement path from route entry, with a phase model, raw-sample percentiles, and isolation guards.

**In scope and delivered:** route-entry monotonic anchor; deadline composition correction; three settlement cells (`route_entry_phase_split`, `runner_entry_comparison`, `deadline_gap`); explicit non-overlapping phase model with reasoned skips; raw per-sample CSV; synthetic fixtures via the real frozen builders; isolation guards (flag/DB-URL refusal, forced memory lock, temp dirs); 13-test suite.

**Explicitly out of scope (deferred, correctly absent):** production route-entry handler capture; strict daily reader; dry-run / canary / full-write / lock-contention / production-depth cells; ≥100-sample tail-confident runs; Postgres evidence adapter; correction pipeline.

---

# Runtime Changes

**Files modified (runtime): one — `lib/jobs/runner.ts`.**

- `producerDeadlineBudget(env, now, reserve, anchorMs?)` — new optional 4th param. When a finite anchor is supplied, `startedAtMs = anchorMs` (route entry); otherwise `startedAtMs = now()` — pre-Slice-2 behaviour, byte-for-byte. The deadline is computed **once** and never reset.
- `runEvidenceCaptureJob` / `runPredictionSettlementJob` — each gained an optional `deadlineAnchorMs?: number`, threaded into `producerDeadlineBudget`.

**Files created (non-runtime):** `scripts/bench/m10/{phases,measure,fixtures,cells,cli}.ts`; **extended:** `scripts/bench/m10/{types,report}.ts`. **Test created:** `tests/m10Slice2Measurement.test.ts` (13 tests). **Docs:** the impl record + the three reviews + this closure. The framework barrel `index.ts` was deliberately **not** extended (stays runtime-free).

**Impact:**
- **Runtime impact:** one guarded ternary per producer run, only when an anchor is supplied; no current caller supplies one → dormant. No state added.
- **Production impact:** none. No flag, cron, route behaviour, schema, archive format, or evidence contract changed. Production stays dormant.
- **Operational impact:** none in production. Benchmarking is CLI-only, synthetic, temp-dir isolated; no production archive/DB access.
- **Testing impact:** +13 tests; floor raised 1824 → 1837; zero regressions; deterministic (fake-clock/structural, stable ×3).
- **Compatibility impact:** none. Additive optional params; no migration, no archive conversion, no public API break; PostgreSQL/activation/strict-reader/dry-run/canary/FULL_WRITE futures all preserved.

---

# Review Consolidation

| Review | Exists | Verdict | Blockers | Conditions |
|---|---|---|---|---|
| **Architecture** (`…-slice-2-architecture-review.md`) | ✓ | **APPROVED** | 0 | 0 |
| **Production Safety** (`…-slice-2-production-safety-review.md`) | ✓ | **PASSED** | 0 | 0 |
| **Compatibility / Migration** (`…-slice-2-migration-compatibility-review.md`) | ✓ | **COMPATIBLE** | 0 | 0 |
| **Performance** (`…-slice-2-performance-review.md`) | ✓ | **PASSED** | 0 | 0 |
| **Test Strategy** (`…-slice-2-test-strategy-review.md`) | ✓ | **APPROVED** | 0 | 0 |

**Consolidated determination:**
- **All five mandated reviews are present** in the repository and independently verified this pass. Architecture (`…-architecture-review.md:84` **APPROVED**, `:80` Blockers 0) confirms the slice is additive/dormant/backward-compatible, F-C closure implemented and proven, BC-1 resolved. Production-Safety (`…-production-safety-review.md:83` **PASSED**, `:55` zero blockers) confirms no runtime behaviour change, no operational risk, trivial rollback, all isolation properties fail-closed and source-verified.
- **Blockers:** **NONE** across all five reviews and independent source verification.
- **Conditions:** **NONE.** The previous administrative condition — that the Architecture and Production-Safety reviews be produced or waived — is **discharged**: both now exist and approve with zero blockers. No code, correctness, safety, or documentary condition remains.
- **Resolved vs outstanding:** see the next two sections. No outstanding *blocking* finding exists.

---

# Findings Resolved

**1. Stage 2E-B finding F-C — FULLY CLOSED.**
F-C was: `producerDeadlineBudget` anchored `startedAtMs = now()` *after* discovery, so source-load + discovery escaped the effective deadline. Slice 2 adds an optional route-entry anchor so `startedAtMs = anchorMs` when supplied (`runner.ts:314-315`), charging source-load + discovery to the budget. Proven end-to-end: the `deadline_gap` cell **deferred the batch 8/8 with the anchor and proceeded without it** (fake-clock, deterministic); the deadline is computed once and never reset. Closure is on an **additive foundation** — production wiring of the anchor from a real request boundary is the deferred extension (below), but the *mechanism* that closes F-C is present, correct, and tested. **Status: FULLY CLOSED** (mechanism); production wiring is a separate, non-F-C activation task.

**2. BC-1 — RESOLVED.**
The Stage-2E-B architecture review's BC-1 asserted the fixture builders `createEvidenceSnapshot` / `createValidationRecord` did not exist (suggesting `buildCaptureSnapshot` + "no standalone validation builder"). Repository verification contradicts that as of Slice 2: **both builders exist and are used** — `createEvidenceSnapshot` (`lib/evidence/snapshot.ts:202`) and `createValidationRecord` (`lib/validation/records.ts:135`) — and the Slice-2 fixtures mint contract-valid, hash-faithful records through them (13/13 green, `fixtureId ≥ 700000`, real `contentHash`). BC-1 is resolved: the real frozen builders were located and used; no runtime builder was invented. **Status: RESOLVED.**

---

# Remaining Carry-forward

Consolidated and de-duplicated across all three reviews (all **non-blocking**, owned by later slices):

- **CF-A — Production route-entry capture (deferred; why below).** Wire the anchor from a real request/handler boundary. **MUST** obey the clock-domain constraint from the Performance review **CF-1**: production `now` defaults to wall-clock `Date.now` (`runner.ts:388,491`), so a production `deadlineAnchorMs` must be a `Date.now()` captured at handler entry — **never** an `hrtime` value — or `remainingMs = deadlineAtMs − now()` mixes epochs. Document/guard at wiring time.
- **CF-B — Strict daily reader** (`readDailyArchiveStrict`, additive sibling to the untouched fail-open `readDailyArchive`).
- **CF-C — Dry-run cell/path** (no write batch exercised in Slice 2).
- **CF-D — Canary cell/path** (2E-A design untouched, unblocked).
- **CF-E — FULL_WRITE** — remains unauthorized; gated on 2E-B evidence + activation slices; no durable write exercised.
- **CF-F — ≥100-sample tail-confident critical runs + deep-archive extrapolation** — the layer correctly refuses GO/NO-GO at n<100.
- **CF-G — Production readiness gates** (lock-contention + production-depth cells; Postgres evidence adapter + shared read-port resolver; durable job-run store only-if-canary-insufficient; Stage-3 correction pipeline).
- **CF-H — Test hardening (minor):** capture-path anchor assertion (Test-Strategy F-1); independently assert `<cell>.raw.csv` parity with JSON samples (F-2); add a timeout to the spawned import-safety subprocess (F-3).
- **CF-I — Cosmetic:** collapse the per-warm-sample double object creation in `measure.ts` if a later slice touches it (Performance N-1/CF-3).

**Administrative carry-forward:** NONE. The prior item — produce or waive the absent Architecture and Production-Safety reviews — is **discharged**; both reviews now exist and approve with zero blockers.

---

# Frozen Scope

The following are now **frozen** (change requires a new slice + re-review):

- **Benchmark framework** (Slice-1 base + Slice-2 measurement layer): `scripts/bench/m10/*`.
- **Measurement layer**: monotonic `hrtime` timing, `runMeasurableCell` warmup/warm sampling, raw-sample percentile methodology (never a runtime aggregate).
- **Deadline composition**: route-entry-anchored effective deadline that charges source-load + discovery (F-C mechanism), computed once, never reset.
- **Route-entry seam**: the additive optional `deadlineAnchorMs` on `runEvidenceCaptureJob` / `runPredictionSettlementJob` and the `anchorMs?` on `producerDeadlineBudget`, with fail-safe `now()` default.
- **Artifact schema**: `BenchArtifact` envelope + JSON / stats CSV / **raw per-sample CSV** / summary families; `Sample` shape (`runId`, `success`, `deadlineOutcome`, `phaseRecords`).
- **Phase model**: the canonical non-overlapping phase set with explicit reasoned skips (no fabricated zero-duration success).
- **Isolation model**: guards-before-cell (`assertBenchmarkSafeEnv` + `assertDisposableDatabaseUrl`), forced `JOB_LOCK_ADAPTER=memory`, temp-dir fixtures, output-dir-only artifacts, runtime-free barrel.
- **Synthetic benchmark execution**: CLI-only (direct-invocation gated); importing executes nothing; app startup executes nothing.

Freezing is unconditional: all five mandated reviews are present with zero blockers, and the frozen surfaces above are independently source-verified with no outstanding condition.

---

# Explicit Non-Authorizations

Slice 2 does **NOT** authorize any of the following:

- ✗ Production activation of capture or settlement
- ✗ FULL_WRITE (durable evidence writes)
- ✗ Canary execution
- ✗ Production benchmark execution
- ✗ Capture activation (still gated on the unbuilt M4→M5 derivation)
- ✗ Deployment
- ✗ Production archive usage (read or write)
- ✗ Any feature-flag enablement, cron activation, schema/migration, or evidence-contract change

Production remains dormant. The route-entry seam is measured and tested in a synthetic harness only; it is not wired into any live request boundary.

---

# Validation Summary

Independently re-run this pass (read-only):

| Check | Result |
|---|---|
| Full suite (`npm test`) | **1837 / 0 / 0** (= 1824 floor + 13 Slice-2) |
| Slice-2 suite | 13 / 0 / 0 (deterministic, stable ×3 per Test-Strategy review) |
| Typecheck (`npm run typecheck`) | exit 0 |
| Lint (`next lint`) | clean — no warnings/errors |
| Isolated bench typecheck | exit 0 (per impl record; bench dir is outside project `tsconfig.typecheck.json`) |
| Repo artifact dirs | clean — only `.gitkeep`/`.gitignore`; all runs used temp dirs |
| Empirical F-C proof | `deadline_gap` cell deferred 8/8 with anchor, proceeded without; tail confidence honestly INSUFFICIENT (n<100), no GO/NO-GO |

---

# Final Decision

**SLICE 2 FROZEN.**

Rationale: the implementation is complete, additive, dormant, and independently source-verified; F-C is fully closed (mechanism) and proven; BC-1 is resolved; **all five mandated independent reviews now exist and approve with zero blockers** — Architecture (**APPROVED**), Production-Safety (**PASSED**), Compatibility (**COMPATIBLE**), Performance (**PASSED**), Test Strategy (**APPROVED**); regression, typecheck, and lint are green; production is untouched. The prior administrative condition is **discharged** — both previously-absent reviews (Architecture, Production-Safety) have been authored and verified with zero blockers. **No code, correctness, safety, or documentary condition remains.**

### Specific-findings restatement
1. **F-C:** FULLY CLOSED (route-entry anchor mechanism present, correct, tested; production wiring is a separate deferred task, not an F-C gap).
2. **BC-1:** RESOLVED (both frozen builders exist and are used; repository contradicts the earlier 2E-B assumption).
3. **Production route-entry wiring — deferred** because capturing a true route-entry timestamp in the shared cron/route handler would touch multiple entry points with incompatible contracts (a declared STOP condition), and the correct wall-clock clock-domain (CF-1) must be enforced at that boundary; Slice 2 therefore delivers the additive seam + synthetic measurement and leaves live wiring to an activation slice.
4. **Tail confidence — GO/NO-GO remains unauthorized** because the layer intentionally ran only smoke-scale samples (n<100); it explicitly refuses p99 tail-confidence and any production GO/NO-GO conclusion until ≥100-sample critical runs are executed (CF-F).

---

# Next Authorized Work

**Authorized: Stage 2E Slice 3 — Planning (only).**

Justification: with the slice fully frozen (all five reviews present, zero blockers, zero conditions), Slice 3 planning is the correctly-sequenced next step. It is documentation-only, touches no runtime, and can proceed immediately to design the next increment (candidate for: production route-entry handler capture with the CF-1 clock-domain guard, and/or the strict daily reader — to be scoped in planning). Planning must not begin implementation.

**NOT authorized** (blocked pending explicit future authorization): Stage 2E Slice 3 *implementation*, Stage 2E *production activation*, and *production deployment*. FULL_WRITE, canary, capture activation, and production benchmark/archive/DB access remain explicitly unauthorized.

---

SLICE 2 FROZEN
