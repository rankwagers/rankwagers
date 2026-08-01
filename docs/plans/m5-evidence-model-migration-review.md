# M5 — Evidence-Model Derivation: Migration & Long-Term Compatibility Review

**Status:** RECORDED — documentation-only, non-binding. Review date 2026-07-29.
**Scope:** Milestone M5 ONLY (`lib/evidence-capture/model/{derive,constants,index}.ts`, ~430 LOC; the frozen
Sprint-23 primitives it reuses in `lib/evidence/{score,qualification,constants}.ts`; `tests/evidenceModel.test.ts`).
**Governed by:** `sprint-23b-implementation-contract.md` (§2.A, §4.4, §4.5, §4.6, §4.9-R1/R3/G, §5.10/§5.13, §6.8),
`phase-2-7-implementation-plan.md` (M5). Companions: the M2/M3/M4 migration reviews, `sprint-23b-future-migration-risk-register.md`.
**Constraints honored:** no runtime change, no contract change, no Postgres implemented, review confined to M5.

## What M5 actually is (from the code)
A **pure, dormant, unwired** derivation function. `deriveEvidenceModel(FixtureModelInput)` maps interpreted
provider stats → the deterministic evidence inputs: `signals[]` (baseline-relative, sample-discounted
residuals + CS/FTS counters), `evidenceScore` (frozen `scoreFromSignals`), per-market and fixture-level
`qualification` (frozen `deriveQualification` + conservative §4.5 binding), `sampleSize`, `supportedMarkets[]`,
plus **ephemeral** `diagnostics`/`qualificationReasons`/`evidenceStrength`/`confidenceBand`. It reads no
clock/fs/network, **uses no `modelVersion`** (plain compile-time constants), mints no snapshot, writes no
archive, and is **not consumed anywhere yet** (no M6 glue). Fail-closed: `invalid_fixture_id`,
`no_markets_with_data`, `no_scored_markets`, and per-market `non_canonical_market`/`baseline_unavailable`/`no_venue_data`.

## Headline verdict — the load-bearing derivation, correctly built, but frozen surface is large and implicit
M5 persists nothing and has no store/identity/hash/schema of its own → no *independent* migration surface.
**But its outputs are exactly the frozen, content-hashed `EvidenceSnapshot` body fields** (`evidenceScore`,
`qualification`, `supportedMarkets[]`, `signals[]`), so M5 **is the function under `modelVersion`** and the
determinism §4.9-G rests on. That makes three things the whole review turns on:

1. **No in-code `modelVersion` mechanism exists.** `derive.ts` embodies exactly one model's logic + `constants.ts`
   holds exactly one constant set, tied to `23B.daily-evidence.v1` **by comment only**. §4.9-R3 requires *permanent
   retention* of every historical model's constants+logic; the current single-inline design does not provide it.
2. **The frozen surface at first write is much larger than `constants.ts`** — it includes the signal **key
   formats** (`season_<mkt>_<venue>`, `counter_<mkt>_<venue>_<i>`), the `source` string `"footystats:team"`, the
   **M1 registry labels**, the pct→fraction rounding (`1e6`), and the **input array ordering** — all of which land
   in the hashed snapshot body.
3. **Qualification depends on SHARED constants** (`EVIDENCE_QUALIFICATION_THRESHOLDS`, `EVIDENCE_MIN_SAMPLE_SIZE`,
   score precision) that live outside M5 and are reused by the Sprint-23 domain — a cross-cutting edit there
   silently invalidates replay under the *same* `modelVersion`.

None of these is a current correctness defect (one model exists; the code is pure, fail-closed, and range-correct).
**No objective M5 closure blocker exists** (see the closure statement at the end).

Legend — **M5✓** blocks M5 closure · **Prod** blocks production activation · **PG** gates Postgres migration · **Frozen** frozen after first production write. (Y / N / Y-if-…)

---

## Migration risk register

### 1. Evidence-model evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-MODEL-1** No in-code `modelVersion` registry | Any future edit to `derive.ts` logic or a `constants.ts` value | §4.9-R3 requires the superseding change to be a **new** `modelVersion` with the old logic+constants **permanently retained**; the single-inline design retains nothing but git history → old snapshots become non-replayable from the codebase | M5 (latent) / M7 | Introduce a `modelVersion → {constants, logic}` registry (M7's remit) so every historical model derives forever; until then, a constant change is a coordinated new-version release, never an in-place edit | N | N | N | Y (v1 logic+constants) |
| **M5-MODEL-2** Provider-specific model | Second data provider / provider stat-shape change | The model is FootyStats-specific (`source:"footystats:team"`, venue rates, CS/FTS counters, league baseline) → a provider change needs a new `modelVersion` and input mapping | Long-term | New provider ⇒ new model version + new input interpretation; register-wide provider-identity bind applies | N | N | N | Y (source string) |

### 2. evidenceScore evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-SCORE-1** Weight/scale constant change | Editing `BASELINE_SCALE`/`W_PRIMARY_MAX`/`W_COUNTER_MAX`/`NEUTRAL_EPS_PP`/`COUNTER_MIN_PCT`/`SAMPLE_TARGET` | Changes `evidenceScore` → changes the hashed snapshot body → new `modelVersion` mandatory (§4.4) | M5 | New `modelVersion`; retain old constants (M5-MODEL-1). Output domain `[0,100]/2dp` is contract-frozen so it stays stable across versions | N | N | N | Y |
| **M5-SCORE-2** Cross-version comparability | Calibration/accuracy aggregates `evidenceScore` across `modelVersion`s | The number's *meaning/scale* changes per model; "never reused" (`EVIDENCE_MODEL_VERSION` note) → cross-version aggregation is invalid unless segmented by `modelVersion` | M8+ (analytics) | Always segment `evidenceScore` analytics by `modelVersion`; never compare across versions | N | N | N | N |

### 3. Qualification evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-QUAL-1** Shared-threshold coupling | Editing `EVIDENCE_QUALIFICATION_THRESHOLDS`/`EVIDENCE_MIN_SAMPLE_SIZE`/score precision in the **shared** `lib/evidence/constants.ts` | Changes M5 qualification **without** touching `model/constants.ts` → same `modelVersion` yields different outputs → §4.9-G replay break + potential immutable_violation; also perturbs the Sprint-23 domain | M5 | Treat the shared evidence constants as **model-version-bound too**; any edit is a coordinated new `modelVersion`. Document the coupling in `model/constants.ts` (currently notes reuse but not the version tie) | N | N | N | Y (threshold values) |
| **M5-QUAL-2** `excluded` never derived | A future model needs a hard-filter exclusion | M5 only emits `{qualified,provisional,unqualified}`; `excluded` is caller-set (§5.10) — compatible with the 4-value frozen enum, but the exclusion path must be authored upstream (M6) | M6 | Keep `excluded` a caller decision; M5 stays exclusion-free | N | N | N | N |

### 4. supportedMarkets evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-MKT-1** Registry **label** edit | Changing a `marketLabel`/`selectionLabel` in the M1 registry | Labels flow into `supportedMarkets[]` which is in the **hashed** snapshot body → a label text edit forks the contentHash / needs a new `modelVersion` (easily overlooked — labels feel cosmetic) | M5/M6 | Treat registry labels as frozen after first write; a label change is a model-version event, not a cosmetic edit | N | N | N | Y |
| **M5-MKT-2** modelProbability rounding | Changing `toModelProbabilityFraction` (`1e6` rounding) or the 0–100→0–1 convention | `modelProbability` is in the hashed snapshot body → change forks the hash → new `modelVersion`; independent of `evidenceScore` (§4.6, tested) | M5 | Freeze the rounding; new version if it must change | N | N | N | Y |
| **M5-MKT-3** Market taxonomy growth | Adding/renaming a §2.B market/selection | `marketKey`/`selectionKey` are registry-closed and hashed; rename breaks joins + forks hashes (M3-ID-4 class) | M5+ | §2.B additive + immutable; deprecate by marking, never rename | N | N | N | Y |

### 5. Diagnostics evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-DIAG-1** Diagnostics are **ephemeral** | Evolving `EvidenceModelDiagnostics`/`MarketDiagnostic`/`qualificationReasons`/`evidenceStrength`/`confidenceBand` | **None persisted** — no `diagnostics`/`reasons`/`strength`/`band`/`sampleSize` field exists on `EvidenceSnapshot` → free to evolve, no hash/replay impact (positive, mirrors M4 ephemeral types) | M5 | Evolve freely; keep any consumer additive-tolerant | N | N | N | N |
| **M5-DIAG-2** A diagnostic leaks into the snapshot | M6 persists a diagnostic/reason/strength into the snapshot body | It would become frozen + hashed, permanently coupling a derivation aid to identity | M6 | Bind M6 to persist **only** the frozen subset (`evidenceScore`, `qualification`, `supportedMarkets`, `signals`); keep diagnostics out of the snapshot | N | N | N | N |

### 6. Deterministic compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-DET-1** Output arrays preserve **input order** | M6 feeds markets/signals in a different order across runs/replay | `supportedMarkets[]` and `signals[]` are emitted in input order (not canonically sorted); the snapshot hash is **array-order-sensitive** (canonicalization keeps array order) → different order = different contentHash → immutable_violation / replay mismatch. Float summation in `scoreFromSignals` is also order-dependent at ULP (usually absorbed by 2dp rounding, but a boundary value can flip) | M6 | Bind M6 (and the retained-input basis) to a **canonical, stable market/signal order**; replay must feed the identically-ordered inputs. M5 is pure *given* order — the bind is on the caller/retention, not M5 | N | Y (at M6) | N | Y (order convention) |
| **M5-DET-2** IEEE-754 op determinism | Cross-platform derivation | Only +/−/×/÷/`Math.round` are used (no transcendentals) → bit-reproducible across platforms; strong (positive) | M5 | None | N | N | N | N |

### 7. Replay compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-REPLAY-1** Retained input must be a **superset** of the `MarketInput` basis | Retained M2 payload omits a field M5 consumes (`counters`, `hits`, `played`, `leagueBaseline`, `modelProbabilityPct`) | Replay cannot reconstruct `FixtureModelInput` → cannot reproduce the snapshot body/hash (§4.9-G fails) | M4/M6/M7 | Bind the retained normalized input to capture the **full** M5 input surface; M5 defines that required surface (see `MarketInput`) | N | Y (at M6) | N | N |
| **M5-REPLAY-2** Purity holds; version+constants must be recoverable | Replay under the snapshot's original `modelVersion` | Byte-identical outputs require the exact v1 logic+constants (M5-MODEL-1) and undrifted shared constants (M5-QUAL-1) | M7 | Version registry (M5-MODEL-1) + shared-constant version-binding (M5-QUAL-1) | N | N | N | Y |

### 8. Archive compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-ARCH-1** Frozen-shape conformance | M5 populates `SupportedMarket`/`EvidenceSignal`/score/qualification | **Conforms** to the frozen §2.A constraints: `evidenceScore∈[0,100]/2dp`, each signal `weight≤45≤100`, `sampleSize` int ≥0, `direction` in enum, `modelProbability∈[0,1]|null`, qualification enum (positive) | M5 | None; keep within the frozen ranges | N | N | N | N |

### 9. M6 compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-M6-1** Boundary contract | M6 consumes `deriveEvidenceModel` | M6 must: map retained input→`FixtureModelInput`, feed canonical order (M5-DET-1), persist only the frozen subset (M5-DIAG-2), stamp the correct `modelVersion` string (M5-VER-1), honor `{ok:false}` fail-closed (omit, never fabricate — §5.13) | M6 | Encode these as the M5→M6 boundary contract; M5 is unwired today so this is forward | N | Y (at M6) | N | N |

### 10. Future Postgres compatibility
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-PG-1** No store; inherits snapshot hash-faithfulness | M5 outputs land in the M2 evidence archive via M6 | M5 adds **no** PG surface (Postgres-transparent). The numeric fields it produces (score 2dp, weight 2dp, modelProbability 6dp, `value`, `sampleSize`) must round-trip byte-identically in the archive's hash basis (M3-PG-1 class) — an evidence-archive/M6 concern, not M5 | Postgres cutover | Inherit the evidence-archive PG hash-faithfulness gate (store the serialized body, not typed-column reconstruction) | N | N | Inherited | N |

### 11. Version evolution
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-VER-1** Stale shared `EVIDENCE_MODEL_VERSION="23.0.0"` vs contract `"23B.daily-evidence.v1"` | M6 stamps the wrong constant | Two model-version strings exist; the shared `EVIDENCE_MODEL_VERSION` (23.0.0) is the older Sprint-23 domain value, **not** the contract's `23B.daily-evidence.v1`. M5 stamps neither (correct); if M6 stamps the stale shared one, snapshots carry the wrong version → mis-segmented calibration, broken replay sourcing | M6 | Bind M6 to stamp the contract string `23B.daily-evidence.v1`; do not reuse `EVIDENCE_MODEL_VERSION`. Not an M5 defect (M5 stamps nothing) | N | Y (at M6) | N | N |
| **M5-VER-2** Version↔constants tie is comment-only | A constant changes without a version bump | Nothing in code enforces "these constants ⇒ this version" → drift risk (the root of M5-MODEL-1/M5-QUAL-1) | M5/M7 | Code registry binding version→constants (M7); process discipline until then | N | N | N | N |

### 12. Rollback strategy
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-ROLL-1** Model rollback | Revert a deployed model change | **Clean**: derivation is pure (revert code) and snapshots are immutable+append-only (old-version snapshots stay valid, segmented by `modelVersion`). Safe **iff** version strings are never reused (§4.9-R3) — a rolled-back `v2` must not be re-shipped later under the same string | M6+ | Monotonic, never-reused version strings; retain every version's constants (M5-MODEL-1) | N | N | N | N |

### 13. Mixed-version deployment
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-MIX-1** Two instances, different constants, same window | Rolling deploy of a model change with concurrent capture | The snapshot id **excludes** `modelVersion` (`id=f(fixtureId,capturedAt,sequence)`) → two instances deriving the same window with different constants collide on id with different contentHash → **immutable_violation** (regardless of whether the version string was bumped) | M6/M9 | **Single-writer capture** (the M6/M9 advisory lock already required by M2/M3) removes the concurrent race; deploy model changes as a coordinated version bump, ideally quiescing capture across the cutover | N | Y-unless single-writer | N | N |

### 14. Frozen-first-production-write implications
| Risk id | Trigger | Impact | Earliest MS | Mitigation | M5✓ | Prod | PG | Frozen |
|---|---|---|---|---|---|---|---|---|
| **M5-FROZEN-1** Large implicit frozen surface | First M6 mint under `23B.daily-evidence.v1` | Frozen forever for v1: all 8 model constants **+** reused shared constants (thresholds/precision/min-sample) **+** signal **key formats** (`season_*`,`counter_*`) **+** `source:"footystats:team"` **+** registry labels **+** pct→fraction rounding **+** input array order. Much of this is string/format/order, not obviously "a constant" | M6 | Enumerate this frozen surface in the model-version record; any change to *any* of it is a new `modelVersion` | N | N | N | Y |

---

## Correctness scan (why no closure blocker)
Read `deriveEvidenceModel` end-to-end against `tests/evidenceModel.test.ts` (worked examples 90 / 62.31 / 0,
conservative binding, neutral/counter, fail-closed reasons, axis separation, determinism):
- Pure/deterministic; no clock/random/env; only bit-reproducible float ops.
- Fail-closed on invalid fixture / no data / no scored markets / non-canonical / baseline-unavailable / no-venue.
- Frozen-range conformance: `evidenceScore∈[0,100]/2dp`, per-signal `weight≤45`, `sampleSize` int ≥0, enum
  `direction`, `modelProbability∈[0,1]|null`, qualification enum — all satisfied.
- `marketSample = min(venue played)` (venue-only, per §4.5); `scored = sample≥6` consistent with `deriveQualification`.
- Conservative binding = lowest rank then lowest score (§4.5), deterministic given input order.
The one order-sensitivity (M5-DET-1) is a caller/retention bind, not an M5 defect (M5 is pure *given* its inputs).
**No objective current correctness defect in M5.**

## Positive findings (preserve as design intent)
- Persists nothing, uses no `modelVersion`, reads no clock/fs/network → derivation purity is structural (§4.9-R1).
- Reuses the frozen Sprint-23 primitives rather than re-implementing them → one scoring/qualification semantics.
- Diagnostics/reasons/strength/band are **ephemeral** (not on the snapshot) → free to evolve.
- Fully fail-closed with categorized reasons; never fabricates a score/sample/qualification/baseline (§5.3/§5.13).
- Axis separation enforced and tested: `evidenceScore` is independent of `modelProbability` (§4.6).
- Rollback is clean and immutable-safe given never-reused version strings.

## Gating summary
- **Blocks M5 closure:** **none.** M5 is pure, dormant, deterministic, fail-closed, range-correct, and its tests are green.
- **Blocks production activation (all at M6, where M5 is wired):** canonical market/signal input order (M5-DET-1), full retained-input basis (M5-REPLAY-1), persist only the frozen subset (M5-DIAG-2), stamp the correct `modelVersion` (M5-VER-1), single-writer capture (M5-MIX-1), fail-closed omission (M5-M6-1). Plus inherited M2/M3 gates.
- **Gates Postgres migration:** none new — Postgres-transparent; inherits the evidence-archive hash-faithfulness gate.
- **Frozen after first production write (under `23B.daily-evidence.v1`):** the 8 model constants + reused shared thresholds/precision + signal key formats + `source:"footystats:team"` + registry labels + pct→fraction rounding + input array order. Any change to *any* of these is a new `modelVersion` with permanent retention of v1 (M5-MODEL-1, §4.9-R3).

## Objective M5 closure blocker: **NONE.**
No runtime change is required or recommended. The migration risks above are forward binds on M6/M7 and on
model-version discipline — not defects in the M5 code, which correctly implements a pure, deterministic,
fail-closed §4.4/§4.5 derivation within the frozen contract shapes.

M5 MIGRATION REVIEW COMPLETE
