# M10 Stage 2E-A — Activation Design — Independent Test-Strategy Review

**Review type:** Test-strategy review of a **design/plan** document (review-only). **No runtime code or test was modified.** The only file created is this document.
**Date:** 2026-07-30
**Reviewer:** Independent Test-Strategy Reviewer, Sprint 23B / M10 Stage 2E-A.
**Under review:** `docs/plans/m10-stage-2e-a-activation-design-plan.md` — specifically its §28 test plan, §26 gates, §27 go/no-go, and §29 implementation slices, judged for sufficiency to authorize (a) implementation and (b) later activation.
**Read:** the 2E-A design plan; `m10-live-candidate-pipeline-specification.md` (Rev A1); `m10-stage-2d-closure.md`; Stage 2A–2D test suites + coverage reviews; `m9Activation`/`m9Concurrency`; the cron-auth (`sprint17Reliability`) and flag (`evidenceCaptureConfig`) tests; `dailyArchive.ts`.
**Substrate verified by inspection (not trusted from the plan):** `readDailyArchive` **is fail-open** (`catch → return null`, `dailyArchive.ts:71-77`) → the plan's strict-reader requirement (§9/Gate C) is real; `readDailyArchive` has **no dedicated M10-suite test** (only indirect `sprint18cHomepage`); existing flag coverage (`evidenceCaptureConfig`, `m9Activation` C2, `sprint17Reliability` cron auth) covers the **existing two flags only**, not the new master/mode/canary hierarchy. Current regression floor: **1824/1824** (Stage-2D closure; unchanged this session).

---

## 0. Executive Verdict

### STAGE 2E-A TEST STRATEGY CONDITIONALLY APPROVED

The §28 test plan is comprehensive, correctly structured (unit · integration · failure-injection · static guards · **an explicit capture-specific block**), injected-clock throughout (no sleeps), and — crucially — **each implementation slice (§29) has an independently testable acceptance boundary with a defined stop condition**. It closes the Stage-2D C-1 capture-asymmetry head-on, preserves every frozen boundary, and requires no schema/migration/frozen change. It is **sufficient to authorize implementation**.

It is **not** clean-APPROVED because four coverage items the mandatory questionnaire demands are **asserted as design properties but not enumerated as tests, or are semantically under-specified**, and must be resolved in the per-slice implementation test spec **before the corresponding activation phase**:

- **A-1 — Dry-run zero-write *under failure paths*.** §28 tests "dry-run zero-write," but not "zero durable writes when discovery/source/archive fails mid-run." This is the safety keystone of DRY_RUN and must be an explicit failure-injected test.
- **A-2 — Stale-partition detection is under-grounded.** Failure-matrix #5 cites "freshness check on `savedAt`/date," but the plan does not ground a `savedAt` field on `DailyArchive` or pin the stale-vs-fresh boundary. The detection mechanism (and its test) must be specified before the source-reader slice.
- **A-3 — Kill-switch mid-run semantics are inconsistent.** §28 lists a "kill-switch mid-run between candidates" test, but §15 defines kill switches as **next-fire only** (a running fire completes; true mid-run abort = the deferred SIGTERM drain). The mandatory "in-flight append finishes / no next candidate begins" behavior is delivered by the **deadline guard**, not the kill switch. This conflation must be reconciled and the mid-run-operator-abort limitation documented, or an implementer/operator will assume a capability that does not exist.
- **A-4 — Multi-instance durable-lock contention test mechanism is unspecified.** §28 lists "multi-instance lock behaviour (durable-lock contention)" but not *how* (a real PG advisory lock, a faithful two-holder pool double, or an explicit "structural only, gated by `instances:1`" statement). In-process/memory-lock harnesses cannot demonstrate cross-process mutual exclusion; the mechanism must be pinned so multi-instance safety is *proven*, not assumed.

None of these blocks *starting* implementation (each is resolvable as the slice's test spec is authored); all are **REQUIRED BEFORE ACTIVATION** of their respective phase. **Blocker count (blocking-before-implementation): 0.**

---

## 1. Audit — coverage dimension by dimension

| Dimension | Where the plan covers it | Assessment |
|---|---|---|
| **unit coverage** | §28 unit (mode resolution, flag precedence + invalid combos, kill-switch eval, source-reader composition, budget/deadline route-start anchor, canary ceiling clamp, dry-run no-write, reconciliation-severity, firewall scan) | **Strong** — all pure surfaces enumerated |
| **route-composition coverage** | §10 (composition in a testable module, not the handler) + §28 integration (capture/settlement route composition) + §28 static ("routes contain no business logic") | **Strong** — the "logic out of the handler" design makes it testable |
| **flag/mode coverage** | §7 hierarchy + §8 modes + §28 unit (precedence/invalid) + §28 static (default OFF) | **Good**, but see A-3 (kill semantics) and B-1/B-2 (immutable snapshot, per-rule enumeration) |
| **dry-run coverage** | §13 + §28 (dry-run zero-write) + Gate H | **Good**, but **A-1** (failure-path zero-write) missing |
| **canary coverage** | §14 + §28 (canary bounded-write + chain-verify) + Gate I + §24 phase-2 | **Good**; ordering-stability-on-refire should be explicit (B-3) |
| **full-write coverage** | §28 (full write) + gated on §25 benchmark (Gate E/F) | **Adequate**; correctly benchmark-gated |
| **capture-specific coverage** | **§28 "Capture-specific (C-1, required)"** — provideCandidateBatch, runCaptureBatch deadline-defer, retry-after-defer, ceiling truncation+rediscovery, dry-run no-write, canary bounded-write, flag-off, lock-unavailable, whole-source failure, accounting reconciliation | **Excellent** — explicitly closes the Stage-2D C-1 gap; note writes need a stubbed `deriveCaptureInput` (§21) |
| **settlement-specific coverage** | §22 firewall + §23 correction firewall + §28 (dry-run/canary/retry idempotent) + Stage-2C regression (26) | **Strong** — near-term activatable path |
| **source-reader coverage** | §9 + §17 (#1–6,18,25) + Gate C + existing 2D `filterCompletedRows` tests | **Good**, but **A-2** (stale), B-4 (missing-optional-tab), B-5 (legacy-reader isolation) |
| **lock/concurrency coverage** | §11 + §28 integration (lock unavailable, concurrent distinct locks, multi-instance) + §28 failure (crash, scheduler overlap) + `m9Concurrency` regression | **Good**, but **A-4** (multi-instance mechanism unspecified) |
| **retry/idempotency coverage** | §28 (retry-after-defer idempotent) + §16/§17 (idempotent re-fire) + frozen `already_exists`/`no_change` | **Strong** — rides proven idempotency |
| **timeout/deadline coverage** | §12 route-start anchor + §28 unit (route-start anchor) + integration (partial-deadline, route-timeout boundary) | **Strong**; exact-boundary + cleanup-reserve should be explicit (B-6) |
| **kill-switch coverage** | §15 + §28 (before-run, mid-run) | **Conflated — A-3**; before/next-fire covered, mid-run abort deferred but implied covered |
| **rollback coverage** | §16 + §28 (rollback-to-OFF) + Gate J drill | **Strong** — flag-off + immutability |
| **failure-injection coverage** | §17 (27-row matrix) + §28 failure (crash/append/DB/hang/malformed/metrics/PM2/overlap) | **Strong** — thorough matrix |
| **correction-firewall coverage** | §23 (static + runtime + test + review) + §28 static + Stage-2C firewall regression | **Strong** — quadruple-guarded |
| **static guards** | §28 static (no corrections; no schema; M6/M8 untouched; routes no logic; flags default OFF; reader not default-on) | **Complete** — every mandatory static guard named |
| **frozen-contract regression** | Gate A + §28 static + full-suite 1824 floor + typecheck diff | **Strong** |
| **benchmark validation** | §25 contract (complete) — **STAGE 2E-B**, not produced here | **Correctly deferred + gated** (Gate E/F) |

---

## 2. Mandatory Coverage Questions — verification

**Legend:** ✅ enumerated as a test; �small⚠ property asserted but test not enumerated / under-specified; 🔻 semantic gap; ⏭ deferred by design.

**Flags & modes:** all-default-OFF ✅ · OFF/DRY_RUN/CANARY/FULL ✅ · contradictions-fail-closed ✅ · immutable per-run snapshot ⚠(B-1) · master-off precedence ⚠(bundled) · source-off precedence ⚠(bundled) · write-off precedence ⚠(bundled, B-2).
**Dry-run:** source loads ✅ · strict archive reads ✅ · discovery ✅ · diagnostics ✅ · zero append methods reachable ⚠(assert via spy = 0, B-7) · **zero writes under failure paths 🔻 A-1**.
**Canary:** deterministic first-N/allowlist ✅ · exact ceiling ✅ · retry ✅ · duplicate prevention ✅ · ordering stability ⚠(refire, B-3) · no-starvation/documented-limitation ✅(doc) · promotion evidence ✅(Gate I).
**Source reader:** valid partition ⚠(implicit) · missing expected ✅ · **missing optional (tab) ⚠ B-4** · malformed JSON ✅ · IO failure ✅ · malformed rows ✅ · duplicate rows ✅ · **stale partition 🔻 A-2** · incomplete ✅ · late-arriving ✅(⏭ correction Stage-3) · deterministic ordering ✅ · **strict-vs-legacy isolation ⚠ B-5**.
**Capture:** provideCandidateBatch ✅ · runCaptureBatch deadline-defer ✅ · retry-after-defer ✅ · ceiling truncation+rediscovery ✅ · dry-run no-write ✅ · canary bounded-write ✅(stub derivation) · flag-off ✅ · lock-unavailable ✅ · source failure ✅ · accounting reconciliation ✅. **(Complete.)**
**Settlement:** firewall ✅ · no corrections ✅ · no currentValidationHeads ✅ · no correctionCause ✅ · dry-run ✅ · canary ✅ · retry ✅ · duplicate prevention ✅ · settledAt determinism ✅. **(Complete.)**
**Concurrency:** same-route overlap ✅ · capture/settlement overlap ✅ · **multi-instance 🔻 A-4 (mechanism)** · lock unavailable ✅ · lock release on throw ✅(regression) · process crash ✅(where feasible) · scheduler retry overlap ✅.
**Kill switches:** before source load ✅ · **after source load / between candidates 🔻 A-3 (next-fire vs mid-run)** · **in-flight append finishes ✅ (via deadline guard, not kill)** · no next candidate begins ✅(deadline) · diagnostics behavior ✅.
**Route budget:** source-load charged ✅ · discovery charged ✅ · partial deadline ✅ · exact boundary ⚠(B-6) · cleanup reserve ⏭(2E-B) · no sleep-based tests ✅.
**Rollback:** mode→OFF ✅ · future writes stop ✅ · existing writes retained ✅ · code-rollback compat ✅(Gate J drill).
**Static guards:** flags default OFF ✅ · no corrections ✅ · no schema migration ✅ · M6/M8 untouched ✅ · route logic absent ✅ · production reader not default-on ✅. **(Complete.)**

---

## 3. Gap Classification

### BLOCKING BEFORE IMPLEMENTATION — **none**
The design is repository-grounded (authoritative source exists; format known; fail-open reader confirmed), requires no frozen/schema/migration change, and every slice is independently testable. Nothing prevents safely starting Slice 1.

### REQUIRED BEFORE ACTIVATION (of the named phase)
- **A-1** Dry-run zero-write under injected source/archive/discovery failure — explicit failure-injected test (before Settlement DRY_RUN, phase 1). *Safety-critical.*
- **A-2** Stale-partition detection: ground/define the mechanism (a `savedAt`/date freshness boundary) and test it — or document "stale not detected" with the accepted risk (before the source-reader slice / phase 1).
- **A-3** Reconcile kill-switch semantics: state that kills are **next-fire**, that mid-run stop is the **deadline guard only**, and that operator mid-run abort (SIGTERM drain) is **deferred**; fix §28's "kill-switch mid-run" test to assert *completion*, not abort (before canary, phase 2).
- **A-4** Specify the multi-instance durable-lock contention test mechanism (real PG in CI **or** a faithful two-holder pool double **or** an explicit "structural-only, gated by `instances:1`+Gate D") — before any scale-out (Gate D / phase ≥2).
- **A-5** Capture FULL/CANARY *writes* are gated on the unbuilt M4→M5 `deriveCaptureInput` derivation stage (§21) — the capture-specific tests run with a stubbed seam; live capture activation is a separate stage. (Design-acknowledged; restated as an activation gate.)

### NON-BLOCKING TEST IMPROVEMENT
- **B-1** Enumerate an "immutable per-run flag snapshot / no mid-run env re-read" unit test.
- **B-2** Enumerate each precedence rule (master-off, source-off, write-off, contradiction) as a discrete case, not bundled under "invalid combinations."
- **B-3** Canary ordering-stability-on-refire test (first-N stable across fires).
- **B-4** Missing-optional-tab (one of fh/over15/over25/sh absent) source-reader case.
- **B-5** Legacy-reader-isolation regression (`readDailyArchive` stays fail-open, unchanged by the additive strict variant).
- **B-6** Route-budget exact-boundary unit test (`remaining == reserve` → defer) and a cleanup-reserve assertion.
- **B-7** Assert dry-run "zero append methods reachable" via a spy (batch/store-append call count == 0), not only "no new records."
- (Fold in the Stage-2D C-3 error-code asserts and C-4 entity-id heuristic per §33.)

### STAGE 2E-B BENCHMARK EVIDENCE (out of 2E-A; gated)
- The entire §25 contract (ceiling-run < ≤45 s at representative depth; validate/retune `reservePerCandidateMs` 250/120 + 15 s headroom; RSS/event-loop/read-amplification). FULL_WRITE is correctly gated on it (Gate E/F). Cleanup-reserve empirical validation lives here.

---

## 4. Slice Acceptance-Boundary Assessment

Each implementation slice (§29) has an **independently testable acceptance boundary + stop condition** — a genuine strength:

| Slice | Independently testable boundary | Stop condition | Verdict |
|---|---|---|---|
| 1 — Activation model | Unit: mode/flag/precedence resolution over `env`; immutable snapshot (add B-1) | any flag defaults ON | **YES** |
| 2 — Strict reader + dry-run | Reader ENOENT-vs-throw parity + determinism; dry-run zero-write **incl. failure paths (add A-1)** + spy (B-7) | fail-open reader / any dry-run write | **YES (add A-1/A-2)** |
| 3 — Settlement canary/full | Integration: bounded-write count == ceiling; reconciliation wired; chain-verify | writes default ON / lock bypass | **YES** |
| 4 — Capture dry-run | Capture C-1 suite (stubbed derivation) | requires unbuilt derivation for writes | **YES (writes gated, A-5)** |
| 5 — Runbook + gates | Gate artifacts + observability gauges (process/gate, not unit) | missing gate artifact | **Partial (process)** |

The slicing is safe (each default-OFF, additive, reversible) and lets a reviewer certify a boundary before the next slice — this materially de-risks activation.

---

## 5. Strengths (recorded)

- **Capture-specific test block (§28) is explicit and complete** — directly retires the Stage-2D C-1 asymmetry rather than relying on settlement symmetry.
- **Composition-out-of-the-handler (§10)** makes route logic unit-testable and keeps the handler a one-line swap — a testability win.
- **Static-guard set is complete** and matches every mandatory static item (corrections, schema, M6/M8, route-logic, default-OFF, reader-not-default-on).
- **Failure matrix (§17, 27 rows)** is thorough and every row is fail-closed or bounded, with the source-failure→empty-success trap explicitly excluded (distinguished by the strict reader).
- **Benchmark evidence is contracted, not fabricated**, and FULL_WRITE is hard-gated on it.
- **Frozen boundary is exact** (§30 file-change boundary; additive-only), and the design requires no schema/migration.

---

## 6. Report

- **Blocker count (blocking before implementation):** **0.**
- **Implementation-test readiness:** **READY** — the §28 plan + independently-testable slices are sufficient to authorize implementation; resolve B-items opportunistically and A-items per-slice.
- **Activation-test readiness:** **CONDITIONAL** — gated on A-1…A-4 (per phase) + the Gate A–L artifacts + Stage-2E-B benchmark; capture activation additionally gated on the M4→M5 derivation stage (A-5).
- **Capture coverage completeness:** **COMPLETE (test-level)** — the C-1 block covers all mandatory capture items; *write activation* deferred to derivation (A-5).
- **Settlement coverage completeness:** **COMPLETE** — firewall + dry-run/canary/retry/idempotency/settledAt all specified; nearest-term activatable path.
- **Strict-reader coverage completeness:** **NEAR-COMPLETE** — strong on ENOENT/malformed/IO/dedup/order; gaps A-2 (stale), B-4 (missing tab), B-5 (legacy isolation).
- **Concurrency coverage completeness:** **NEAR-COMPLETE** — same-route/cross-path/lock-unavailable/crash/scheduler covered; A-4 (multi-instance mechanism) must be pinned.
- **Kill-switch coverage completeness:** **CONDITIONAL** — next-fire kills covered; A-3 semantic reconciliation required (mid-run abort is deferred, not covered).
- **Rollback coverage completeness:** **COMPLETE** — flag-off + immutability + Gate J drill.
- **Benchmark evidence coverage completeness:** **CONTRACTED, NOT PRODUCED (2E-B)** — complete contract; FULL_WRITE correctly gated; no fabricated numbers.
- **Required additions before implementation:** none blocking. Recommended to fold in now: B-1 (immutable snapshot), B-2 (precedence enumeration), B-7 (dry-run append-spy) — cheap and clarify Slice 1/2 boundaries.
- **Required additions before activation:** **A-1** dry-run-zero-write-under-failure; **A-2** stale-partition mechanism+test (or documented risk); **A-3** kill-switch next-fire-vs-mid-run reconciliation + limitation doc; **A-4** multi-instance lock-contention test mechanism; **A-5** capture live-derivation gate; plus B-3/B-4/B-5/B-6 and the Gate A–L artifacts + Stage-2E-B benchmark.

---

## 7. Verdict

### STAGE 2E-A TEST STRATEGY CONDITIONALLY APPROVED

The activation design's test strategy is comprehensive, repository-grounded, and structurally sound: it enumerates unit, integration, failure-injection, static-guard, and — decisively — capture-specific coverage; it keeps route logic out of the handler for testability; it slices implementation so each boundary is independently verifiable with a stop condition; it preserves every frozen contract and requires no schema or migration; and it correctly contracts (never fabricates) the Stage-2E-B benchmark on which FULL_WRITE is hard-gated. **It is sufficient to authorize implementation** (blocker count 0).

It is conditional because four mandatory coverage items are asserted-but-not-enumerated or semantically under-specified — **A-1** dry-run zero-write *under failure*, **A-2** stale-partition detection mechanism, **A-3** kill-switch mid-run-vs-next-fire semantics, **A-4** multi-instance durable-lock contention test mechanism — each of which is **REQUIRED BEFORE ACTIVATION** of its phase (not before starting implementation). Capture write activation remains separately gated on the unbuilt M4→M5 derivation stage (A-5). With these resolved in the per-slice implementation test spec, and the Gate A–L artifacts + Stage-2E-B benchmark produced, the path to activation is clear and safe.

---

**Confirmation:** the only file created by this task is `docs/plans/m10-stage-2e-a-test-strategy-review.md`. **No runtime code or test was modified.** All cited behaviours (fail-open `readDailyArchive`, existing flag/auth coverage, the 1824 baseline) were verified against the current repository by inspection.
