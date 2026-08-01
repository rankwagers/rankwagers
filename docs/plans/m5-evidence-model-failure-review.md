# M5 — Evidence-Model Derivation (2.6B): Failure-Mode Review

**Status:** RECORDED — documentation-only, non-binding analysis. Review date 2026-07-29. **No runtime code changed; no frozen contract or type changed; no M6+ milestone reviewed.**
**Scope:** Milestone M5 ONLY — `lib/evidence-capture/model/{derive,constants,index}.ts`, exercised by `tests/evidenceModel.test.ts`. M5 is the **pure derivation** of `signals[]`, `evidenceScore`, per-market & fixture `qualification`, `sampleSize`, and `supportedMarkets[]` from interpreted provider stats + `modelVersion`-bound constants (Contract §4.4/§4.5, §4.9-R1). It **mints no snapshot, writes/reads no archive, reads no clock/fs/network/env, and never reads `modelVersion`** (module + test "no side effects"/"deterministic").
**Governing documents:** implementation-contract (Rev 2 §4.4/§4.5/§4.6/§4.9-R1/-R3/-G/§5.3/§5.13/§5.2), phase-2.7 DoD, phase-2.7 implementation-plan (M5 line, "Gate A: determinism + purity"), future-migration-risk-register (R4), m2/m3/m4 failure reviews.
**Frozen primitives reused (not redefined):** `scoreFromSignals`/`normalizeEvidenceScore`/`evidenceScoreBand` (`lib/evidence/score.ts`), `deriveQualification`/`qualificationRank` (`lib/evidence/qualification.ts`), `resolveEvidenceStrength` (`lib/evidence-ui/strength.ts`), M1 key registry, `EVIDENCE_MIN_SAMPLE_SIZE`/qualification thresholds.

## What M5 is (as built)
`deriveEvidenceModel(input)` → per-market `deriveMarket` → conservative-binding rollup, or a fail-closed `{ ok:false, reason, diagnostics }`. Each market: canonical-pairing check → league-baseline validity (`played ≥ LEAGUE_MIN_SAMPLE=20`) → per-venue residual signal (`weight = W_PRIMARY_MAX·|clamp(residual/BASELINE_SCALE,−1,1)|·sampleConfidence(played)`, neutral band `< NEUTRAL_EPS_PP`) → optional counter signals (over15/over25) → `marketScore = scoreFromSignals` → `marketSample = min(present venue played)` → `deriveQualification`. Fixture rollup binds the **weakest scored** market (§4.5). Constants are compile-time (the derivation never reads `modelVersion`).

**Objective current M5 correctness defect:** **one robustness gap** (MM-1: a `null`/`undefined` element inside `markets[]` throws rather than failing closed — the sole non-fail-closed path; not reachable from validated retained inputs, so §4.9-R1 totality holds over the real input domain, but the module is otherwise defensively typed and this spot is not). Everything else is green, a documented semantic limitation, a downstream M6 contract, an activation gate, or a sustained/migration gate. Scoring, qualification, binding, axis-separation, determinism, and purity are all correct and tested.

---

## Failure-mode analysis by category

### 1. Malformed provider data
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | venue/counter/baseline `pct` non-finite / <0 / >100; `played` non-integer / negative | `isPct`/`isPlayed` guards | signal → `null`; market omitted (`baseline_unavailable`/`no_venue_data`) — fail-closed | none | passed (A) |
| — | non-canonical `marketKey`/`selectionKey` (incl. `1x2/over`) | `isCanonicalPairing` | omitted `non_canonical_market` (test) | none | passed (A) |
| — | `markets` not an array; `input` null; `fixtureId` invalid | `Array.isArray`/optional-chain/`isValidFixtureId` | `[]` → `no_markets_with_data`, or `invalid_fixture_id` — no throw | none | passed (A) |
| **MM-1** | a **`null`/`undefined` element inside `markets[]`** | none | `deriveMarket(null)` → `typeof m.marketKey` → **TypeError thrown out of `deriveEvidenceModel`** (breaks the fail-closed posture; primitives like `[42]`/`["x"]` do NOT throw — only null/undefined) | med (robustness) | **production-activation gate (C1)** / recovery |
| **MM-8** | `stat.hits` out of range (e.g. `hits > played`, negative) | none (display-only) | used only in `displayValue` string; **not scored** → misleading diagnostic display, no score impact | low | dormant-acceptable (B) |

### 2. Missing provider fields
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | `leagueBaseline` null / `played < 20` | guard | omit `baseline_unavailable` — **never scored on a fabricated baseline** (§4.4/§5.3) | none | passed (A) |
| — | both venues null | guard | omit `no_venue_data` | none | passed (A) |
| — | all markets missing data | count | `no_markets_with_data` fail-closed | none | passed (A) |
| — | one venue present, other missing | `venues` filter | scores on the present venue; `marketSample = its played` — single-venue evidence permitted | none | passed (A) |
| — | `modelProbabilityPct` absent/out-of-range | `toModelProbabilityFraction` | `supportedMarket.modelProbability = null`; never affects score (§4.6) | none | passed (A) |

### 3. Conflicting provider evidence
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | home supports, away opposes | `scoreFromSignals` nets weights | residual netting (may approach 0) — intended | none | passed (A) |
| — | counters oppose a supported over-market | counter signals | net down (test 90→80.77) | none | passed (A) |
| — | one market strong, another weak (multi-market) | conservative binding | weakest **scored** market binds; fixture qualification = its qualification (test) | none | passed (A) |
| **MM-2** | strongly-**opposing** well-sampled market | `normalizeEvidenceScore` clamps ≥0 | `evidenceScore = 0` — **indistinguishable from "no edge" (all-neutral) also 0**; `evidenceScoreBand(0) = "insufficient"` which does **not** mean "no data" here. Contract-mandated (frozen `scoreFromSignals`/`normalizeEvidenceScore`). `diagnostics.scored=true` + omission reasons preserve the distinction | low (semantic) | dormant-acceptable (B) / downstream (C5) |

### 4. Qualification edge cases
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | score ≥70 but sample <6 | `deriveQualification` | `provisional` (not `qualified`) | none | passed (A) |
| — | score in [45,70) but sample <6 | `deriveQualification` | falls through to `unqualified` | none | passed (A) |
| — | boundary scores 70 / 45, sample 6 | inclusive thresholds | qualified / provisional (consistent) | none | passed (A) |
| — | fixture-level sample always ≥6 | binding is a scored market | fixture qualification is score-driven given sufficient sample; **==** binding market qualification | none | passed (A) |
| **MM-3** | `supportedMarkets` carries **unscored / lower-rank** with-data markets | — | `supportedMarkets = all derived` (scored **and** unscored-with-data). The §4.5 invariant `fixtureRank ≤ marketRank` is guaranteed **only over SCORED markets**; an unscored with-data market can rank BELOW the fixture qualification. M6 must not assume `fixture ≤ every supportedMarket`, and must decide whether §4.2 wants `supportedMarkets` filtered to qualified-only | med (downstream) | production-activation contract (C4) |

### 5. Scoring edge cases
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | residual ≥ `BASELINE_SCALE` (15pp) | `clamp(...,−1,1)` | saturates at norm 1 (design) | none | passed (A) |
| — | `sampleConfidence` below 6 / at/above 19 | pure ramp | 0 below `SAMPLE_MIN`, linear to 1 at `SAMPLE_TARGET=19`; sub-6 sample ⇒ weight 0 ⇒ score 0 ⇒ `scored=false` (double-guarded) | none | passed (A) |
| — | near-baseline (`\|residual\| < 2pp`) | neutral band | `neutral`, weight 0 (test) | none | passed (A) |
| — | counter at/below `COUNTER_MIN_PCT=50` | filter + `clamp(...,0,1)` | no/zero contribution | none | passed (A) |
| **MM-7** | maximum achievable score | 2 venues × `W_PRIMARY_MAX=45` | **`evidenceScore` ceiling ≈ 90**; the 90–100 range is unreachable with two venue signals (counters only subtract). Thresholds/UX must not assume 100 | low | dormant-acceptable (B) |

### 6. Deterministic failures
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | repeat run, order/host/tz variation | test "deterministic" / "no side effects" | identical output; no `Date.now`/random/env/IO/`modelVersion` (§4.9-R1) | none | passed (A) |
| **MM-4** | market **input order** varies; exact `(rank, score)` binding tie | none (no internal sort) | `supportedMarkets`/`signals` order follow input order, and on an exact `(rank, score)` tie the **`bindingMarketKey`** (hence `qualificationReasons`) depends on input order. `evidenceScore`/`qualification` are order-stable, but M6 must present markets in a **canonical order** for §4.9 replay-hash stability | med (replay) | production-activation gate (C3) |

### 7. Archive corruption interaction
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| **MM-9** | provider/odds archive corrupt | n/a to M5 | M5 performs **no archive I/O** → zero direct corruption surface. Corruption is contained upstream (M2/M3 fail-closed); M5 sees valid interpreted input or the market is absent → fail-closed omission. Determinism means archive hash-integrity (M2/M3) **is** the replay-fidelity guarantee for M5 | none | passed (A) |

### 8. Replay interaction (§4.9)
| id | Scenario | Detection | Current behavior | Severity | Class |
|---|---|---|---|---|---|
| — | re-derive from retained normalized inputs | pure function of args | re-invoke ⇒ identical model (no live data/clock/config) — §4.9-R1/-A/-N satisfied | none | passed (A) |
| **MM-4** | market order not canonical (see §6) | — | replay-hash stability requires canonical input order from M6 | med | production-activation (C3) |
| **MM-5** | model **constants** change after first mint | none (no `modelVersion` dispatch) | constants are compile-time and **frozen the instant the first snapshot is minted** (§4.4 immutable-within-modelVersion). M5 has no version dispatch, so a constant change would silently re-derive **old** inputs differently ⇒ replay mismatch unless the old derivation code/version is retained (§4.9-R3, R4). Single-model today ⇒ latent | med (sustained) | sustained/Postgres gate (D1) + activation (C2) |

### 9. Downstream M6 assumptions (contracts M6 must honor)
- **C4/MM-3** `supportedMarkets` includes unscored/unqualified with-data markets; the §4.5 conservative-binding invariant holds **only over scored markets**. Decide §4.2 filtering; do not assume `fixture ≤ every supportedMarket`.
- **C3/MM-4** supply markets in a canonical stable order (replay-hash stability; tie-broken `bindingMarketKey`).
- **C5** `ok:false` (`no_scored_markets`/`no_markets_with_data`/`invalid_fixture_id`) means **omit the fixture, never mint a placeholder**; carry per-market omissions through (§5.13 — never fabricate a missing/omitted market).
- **C5/MM-2/MM-6** read data-presence from `diagnostics.scored` + `marketsOmitted`, **not** from `evidenceScore`/`confidenceBand`/`evidenceStrength` (a 0 score / "insufficient" band / "limited" strength can reflect strong-opposing evidence, not missing data).
- **MM-6** `resolveEvidenceStrength` is called with `providerComplete: true` **unconditionally** → `evidenceStrength` never downgrades for omitted/missing markets; completeness lives only in diagnostics.
- **§4.6** keep `evidenceScore` and `modelProbability` separate (M5 already isolates probability to `supportedMarket.modelProbability`).

### 10. Activation risks
- **C1/MM-1** guarantee non-null well-formed `MarketInput` elements (or add a guard) before wiring M6 — the one path that throws.
- **C2/MM-5** the 2.6B constants are explicitly "**pending empirical calibration**" (constants.ts header). Minting the first production snapshot **freezes them permanently** under `modelVersion = 23B.daily-evidence.v1` (editable only via a new `modelVersion`). Calibrate/approve before first production mint, or consciously accept an un-calibrated initial `modelVersion`.
- **C3** canonical market order from M6 (replay).
- **MM-6** decide whether `evidenceStrength` should reflect provider incompleteness before relying on it in UI.

### 11. Recovery procedures
- **E1** M5 is pure/stateless — nothing to repair. A suspected derivation error is diagnosed by **deterministic re-derivation** from retained inputs under the pinned `modelVersion` constants, and corrected only by issuing a **new `modelVersion` + re-capture in a new window** — never by rewriting archived snapshots (§4.9/§5.4).
- **E2** If MM-1 fires in the wired M6 path, M6 isolates the fixture (one malformed input never aborts the run) and quarantines/logs the input; M5 needs no repair.
- **E3** Constant-change replay: retain the old M5 code/version keyed to `modelVersion` so historical snapshots re-derive under their original constants (E1 + D1).

---

## A/B/C/D/E acceptance matrix
Binary gates. No gate adds a field or alters a frozen type. "Green" = provable against `tests/evidenceModel.test.ts`.

### A. Passed requirements for M5 closure (green now)
- **A1** Malformed fields fail closed (`isPct`/`isPlayed` reject non-finite / out-of-range / non-integer) → signal null / market omitted. *(tests: omission, no-scored)*
- **A2** Missing fields → omission with diagnostic reason; **no fabricated baseline** (§4.4/§5.3). *(test "markets omitted…")*
- **A3** No-data / no-scored / invalid-fixture → `ok:false` fail-closed (never a placeholder model). *(test "no scored… invalid fixture")*
- **A4** Conservative binding (§4.5) over scored markets — fixture qualification == weakest scored market's; invariant `fixtureRank ≤ scoredMarketRank` holds by construction. *(test "multi-market…")*
- **A5** Axis separation (§4.6) — `evidenceScore` from signals only; `modelProbability` isolated and conversion clamps/rejects. *(tests "independent…", "conversion clamps")*
- **A6** Determinism + purity (§4.9-R1) — no clock/random/env/IO/`modelVersion`; repeat-run `deepEqual`; import has no side effects. *(tests "deterministic", "no side effects")*
- **A7** `qualificationReasons` mirror `deriveQualification` branches. *(test)*
- **A8** No archive I/O ⇒ no direct corruption surface; deterministic re-derivation from retained inputs is the replay/integrity guarantee (MM-9).

**No hard M5 closure blocker.** One robustness gap (MM-1) is flagged as a pre-activation guard rather than a closure blocker because it is unreachable from validated retained inputs (M5 stays a total function over its real §4.9-R1 domain) and is caller-preventable — **confirm this call against the M5 Gate-A "purity/totality" bar; if the bar requires never-throws over any array input, MM-1 becomes a closure fix.**

### B. Dormant-acceptable limitations (documented; safe while dormant / single trusted caller)
- **B1 (MM-2)** `evidenceScore = 0` conflates strong-opposing vs no-edge; band "insufficient" ≠ "no data" (frozen-primitive behavior; distinction preserved in diagnostics).
- **B2 (MM-7)** `evidenceScore` ceiling ≈ 90 (two venues × `W_PRIMARY_MAX`); 90–100 unreachable.
- **B3 (MM-8)** `stat.hits` unvalidated (display-only, non-scoring).
- **B4 (MM-6)** `providerComplete` hardcoded `true` → `evidenceStrength` ignores omitted markets.
- **B5 (MM-4 partial)** market input order not canonicalized — safe under the fixed-order test/caller today.

### C. Mandatory production-activation gates
- **C1 (MM-1)** Guard against `null`/`undefined` `markets[]` elements (or M6 guarantees non-null well-formed `MarketInput` + per-fixture error isolation) — close the one non-fail-closed throw.
- **C2 (MM-5)** Calibrate/approve the 2.6B constants **before the first production mint** — they freeze permanently under `modelVersion 23B.daily-evidence.v1`.
- **C3 (MM-4)** M6 supplies markets in a canonical, stable order so `supportedMarkets`/`signals` order and tie-broken `bindingMarketKey` are replay-hash-stable (§4.9-R1).
- **C4 (MM-3)** M6 decides §4.2 `supportedMarkets` filtering and must not assume `fixture ≤ every supportedMarket` (invariant is scored-only).
- **C5** M6/UI read data-presence from `diagnostics.scored` + `marketsOmitted`, not from `evidenceScore`/band/strength; treat `ok:false` as omit-fixture-never-mint; carry omissions through (§5.13).

### D. Mandatory sustained-production / Postgres gates
- **D1 (MM-5, R4)** No `modelVersion` dispatch in derivation → any constant change requires a **new `modelVersion`** and retention of the old derivation code/constants to replay historical snapshots (§4.9-R3). Establish version-pinned constant retention before any constant change.
- **D2 (inherited)** The retained normalized inputs M5 consumes must remain byte-faithful across the Postgres migration so re-derivation reproduces identical `evidenceScore`/`qualification` (M2/M3 hash-faithfulness; §4.9-G).

### E. Recovery & operational runbook requirements
- **E1** Diagnose a suspected derivation error by deterministic re-derivation from retained inputs under the pinned `modelVersion`; correct only via a **new `modelVersion` + re-capture in a new window** — never rewrite archived snapshots (§4.9/§5.4).
- **E2** On MM-1 in the wired path, M6 isolates and quarantines the offending fixture input; M5 requires no repair.
- **E3** Retain old M5 code/version keyed to `modelVersion` so historical snapshots re-derive under their original constants (D1).

---

## Report
1. **Documentation file written:** `docs/plans/m5-evidence-model-failure-review.md` (documentation-only).
2. **Objective M5 closure blocker:** **None hard.** One robustness gap (MM-1: null/undefined `markets[]` element throws) is flagged as a pre-activation guard / closure-confirmation item — it does not violate §4.9-R1 totality over validated retained inputs and is caller-preventable. All scoring/qualification/binding/axis-separation/determinism/purity requirements pass.
3. **Production-activation blockers:** C1 null-element guard, C2 constant calibration-before-first-mint, C3 canonical market order, C4 supportedMarkets §4.2/§4.5 contract, C5 diagnostics-for-completeness + omit-never-mint.
4. **Sustained-production / Postgres blockers:** D1 modelVersion-pinned constant retention (no dispatch today), D2 retained-input byte-faithfulness for re-derivation.
5. **Required recovery procedures:** E1 re-derive + new-modelVersion correction (never rewrite), E2 M6 fixture isolation/quarantine for MM-1, E3 version-pinned M5 code retention.
6. **No runtime code changed** — one documentation-only file created; no frozen contract or type altered; no M6+ milestone reviewed.

Constraints honored: no multi-process/durability/auto-repair claims made (M5 is pure/stateless); transient/missing provider data is omitted, never fabricated or scored on a synthesized baseline.

M5 FAILURE REVIEW COMPLETE
