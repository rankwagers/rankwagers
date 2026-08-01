# Sprint 23B — Evidence Capture Implementation Contract
### Authoritative constitution for Phase 2.7 · Phases 2.6A/2.6B/2.6C and the Product-Owner decisions are frozen · Revision 2 (adds §4.9 deterministic-replay invariants)

**§0 Precedence.** This contract governs all Phase 2.7 work. Where any code, comment, or prior note conflicts with it, this contract wins. The frozen Sprint 23 contracts (`types/evidence/*`, `lib/archive/evidence/store.ts`) are incorporated by reference and rank above this document; nothing here may be read as amending them.

---

## §1 Required terminology
Engineers MUST use these terms with exactly these meanings.

- **Selected fixture** — a fixture admitted into the evidence pipeline by the upstream selection gate. Only selected fixtures are eligible for capture.
- **Provider archive** — the normalized-provider-input store. Distinct storage from the evidence archive.
- **Evidence archive** — the immutable append-only `EvidenceArchiveStore` of `EvidenceSnapshot` and `ValidationRecord`.
- **Odds archive** — the separate, bounded, append-only store of capture-time odds records.
- **Capture event** — one execution of `evidence_capture` for one selected fixture in one capture window.
- **Historical Capture replay** — deterministic re-derivation of a past capture event's Evidence Inputs from retained data under the snapshot's original `modelVersion`.
- **fixtureId** — the canonical numeric fixture identity; it **is** the FootyStats `matchId` (positive integer).
- **captureWindowKey** — the deterministic pre-kickoff window handle for a fixture.
- **capturedAt** — the quantized capture instant (canonical ISO-8601 UTC); equal to the window anchor.
- **captureId** — the deterministic identity of a capture event.
- **modelProbability** — the provider forward-looking potential, `0–1`. A likelihood axis.
- **evidenceScore** — the baseline-relative, sample-discounted deviation strength, `0–100`. A strength axis. Never a probability, never a label, never an optimizer score.
- **qualification** — publication-eligibility state (`qualified|provisional|unqualified|excluded`).
- **sampleSize** — a real provider denominator (`played`). Never a proxy or constant.
- **model constants** — the fixed numeric parameters of the evidence model, bound permanently to a single `modelVersion`.

---

## §2 Immutable data contracts

**§2.A Frozen record shapes.** `EvidenceSnapshot`, `SupportedMarket`, `EvidenceSignal`, `OperatorAvailabilitySnapshot`, `BestOddsSnapshot`, `ValidationRecord`, and the `EvidenceArchiveStore` interface are used **byte-for-byte as defined in Sprint 23**. Field sets, types, ranges, and enums are fixed:
- `EvidenceSnapshot.evidenceScore ∈ [0,100]` (2 dp); `qualification ∈ {qualified,provisional,unqualified,excluded}`; `sequence` 1-based monotonic per fixture; `capturedBy` = `"evidence_capture"`; `modelVersion` = `"23B.daily-evidence.v1"`; `schemaVersion` = `"23.0.0"`.
- `SupportedMarket.modelProbability ∈ [0,1] | null`; carries `qualification` but **no** score field.
- `EvidenceSignal.weight ∈ [0,100]` non-negative; `direction ∈ {supporting,opposing,neutral}`; `sampleSize` integer `≥ 0` or `null`; `value` = observed raw rate or `null`.
- `ValidationState ∈ {pending,won,lost,void,cancelled,postponed,abandoned}`; `ValidationReasonCode ∈ {settled_result,market_void,fixture_cancelled,fixture_postponed,fixture_abandoned,data_correction,settlement_correction,awaiting_result}`.

**§2.B Canonical key registries (closed sets).**
- `marketKey ∈ { over15, over25, fh, sh, 1x2, btts }` — no others.
- `selectionKey ∈ { over, under, home, draw, away, yes, no }` — no others.
- Canonical market→selection binding (the only valid pairings):
  `over15,over25,fh,sh → {over, under}` · `1x2 → {home, draw, away}` · `btts → {yes, no}`.
- Every `marketKey`/`selectionKey` written anywhere (snapshot, supported market, validation, odds archive) MUST be a member of these sets and a valid pairing. `marketLabel`/`selectionLabel` are the sole human strings; keys are never rendered.

**§2.C Capture-identity record (deterministic quad).** Every capture event is identified by the immutable quad `{ captureId, fixtureId, captureWindowKey, capturedAt }`. This quad is stable across re-runs of the same fixture-window and is fully recoverable from a retained snapshot's `(fixtureId, capturedAt)`.

**§2.D Odds archive record.** An odds-archive record is append-only and immutable, keyed by `captureId`, containing `{ captureId, fixtureId, captureWindowKey, capturedAt, marketKey, selectionKey, decimalOdds|null, operatorKey|null, impliedProbability|null, sampleOperators, source }`. The odds archive is **bounded** (retention-limited) and physically separate from the evidence and provider archives.

**§2.E Retained provider inputs.** Only **normalized** provider inputs are persisted (from the first production capture onward). The retained normalized set is the fixed input basis for evidence derivation and for Historical Capture replay.

---

## §3 Required identities (deterministic, content-derived)
All ids are pure functions of their coordinates; identical coordinates MUST yield identical ids. **These formulas govern ORIGINAL minting only; replay obeys §4.9.**

- `fixtureId := numericFixtureId(source) = source.matchId` — MUST be a positive integer; the single choke-point.
- `captureWindowKey := \`${fixtureId}|${capturedAt}\`` where `capturedAt := ISO( kickoffMs − leadMinutes·60000 )` (canonical ISO). `leadMinutes` is a positive integer from config.
- `captureId := "cap_" + evidenceContentHash(fixtureId ‖ captureWindowKey)[0:24]`.
- `EvidenceSnapshot.id := evidenceSnapshotId(fixtureId, capturedAt, sequence)` — frozen; `captureId` is a **separate** capture-layer identity and is never written into `EvidenceSnapshot.id`.
- `ValidationRecord.id := validationId(snapshotId, marketKey, selectionKey)`; `revisionId := validationRevisionId(validationId, revision)` — frozen.

---

## §4 Invariants (always true)

**§4.1 Append-only.** Snapshots and validation revisions are only ever appended. Admission is governed solely by `decideSnapshotAppend`/`decideValidationAppend`: same id + same `contentHash` → duplicate (success); same id + different hash → `immutable_violation`. `sequence` is contiguous per fixture; `previousSnapshotId` references the prior head.

**§4.2 One snapshot per fixture per window.** A capture event produces **exactly one** `EvidenceSnapshot` per selected fixture, carrying **all** of that fixture's qualified markets in `supportedMarkets[]`. `marketKey`/`selectionKey` never participate in snapshot identity.

**§4.3 Idempotency.** Before minting a sequence, capture searches the fixture's **entire** snapshot stream; if any snapshot has `capturedAt == the window anchor` and `capturedBy == "evidence_capture"`, the event is a no-op. A change in kickoff or `leadMinutes` yields a new window → a new snapshot; the prior snapshot is never rewritten.

**§4.4 Evidence-model invariants (frozen 2.6B, bound to `modelVersion`).**
- `evidenceScore := scoreFromSignals(fixtureSignals-of-binding-market)` = `normalizeEvidenceScore( Σ supporting.weight − Σ opposing.weight )`.
- Per signal: `value` = observed venue rate; `sampleSize` = provider `played`; `direction` = sign of `(teamRate − leagueBaseline)`; `weight = W_MAX · |clamp((teamRate − leagueBaseline)/BASELINE_SCALE, −1, 1)| · sampleConfidence(played)`, bounded to `[0, W_MAX] ⊆ [0,100]`.
- `sampleConfidence(played) = 0` for `played < EVIDENCE_MIN_SAMPLE_SIZE (6)`.
- Model constants (`BASELINE_SCALE`, `W_MAX`, sample target, neutral epsilon, counter/league minimums) are fixed at build time and immutable within a `modelVersion`; changing any value requires a new `modelVersion`.
- Baseline is the same-competition, same-season, completed-before-kickoff league rate; when unavailable per policy the market is omitted, never scored on a fabricated baseline.

**§4.5 Qualification derivation & consistency.** Per-market `qualification := deriveQualification({ evidenceScore: marketScore, sampleSize: marketSample })`, `marketSample = min(present venue played)`. Fixture qualification is the **conservative binding**: `∀ scored market m: qualificationRank(fixtureQualification) ≤ qualificationRank(m.qualification)`, with equality at the binding (weakest adequately-sampled) market, and `fixtureScore`/`fixtureSample` are that binding market's. `excluded` is only ever set by an explicit hard filter.

**§4.6 Axis separation.** `evidenceScore` and `modelProbability` are independent fields; neither is derived from, equal to, or an alias of the other.

**§4.7 Mandatory initial odds.** Each capture event MUST write exactly one initial (`evidence_capture`) odds-archive record keyed by its `captureId`. Odds **values** may be `null`; the odds-archive **record** is mandatory.

**§4.8 Persistence durability.** Evidence NDJSON writes resolve through `EVIDENCE_ARCHIVE_DIR` (authoritative when set); in production the resolved directory is never `process.cwd()`-relative. Paths are resolved deterministically; a blank/whitespace value is treated as unset.

**§4.9 Deterministic replay & reproducibility.** The goal is deterministic Historical Capture replay years later under the same `modelVersion`.

- **§4.9-R1 (derivation purity).** Evidence-input derivation (`evidenceScore`, `qualification`, `signals[]`, per-market `qualification`, `sampleSize`, `supportedMarkets[]`) is a pure, total function of the retained normalized inputs and the snapshot's `modelVersion`-bound model constants. It MUST NOT read wall-clock, ambient config, `leadMinutes`, live provider data, or any state outside those inputs.
- **§4.9-R2 (replay sourcing).** The §3 identity formulas govern ORIGINAL minting only. Any re-run or Historical Capture replay MUST source `capturedAt` from the retained snapshot and normalized inputs from the provider archive, and MUST derive the rest of the capture-identity quad from `(fixtureId, capturedAt)`. It MUST NOT recompute identity from live `kickoff`/`leadMinutes` or re-fetch live provider data.
- **§4.9-R3 (historical constant retention).** The complete model-constant set of every `modelVersion` that has ever produced an archived snapshot MUST be permanently retained and recoverable. A `modelVersion` string is never reused, and its constants are never redefined; superseding constants require a new `modelVersion`.
- **§4.9-A (replay MUST always use):** retained normalized provider inputs; retained `capturedAt`; retained historical model constants of the snapshot's original `modelVersion`.
- **§4.9-N (replay MUST never depend on):** any live provider response; the current `kickoff` value; current configuration; or the current environment.
- **§4.9-G (guarantee).** Given the same `modelVersion` and identical retained normalized inputs, Historical Capture replay MUST deterministically reproduce identical Evidence Inputs, and therefore the identical `EvidenceSnapshot` body and `contentHash`, at any future time.

---

## §5 Prohibited behaviours
1. MUST NOT alter, extend, or reinterpret any frozen contract (`types/evidence/*`, `EvidenceArchiveStore`), including adding fields.
2. MUST NOT use `modelProbability`, any `*_potential`/`potential` alias, or an optimizer/combo score as `evidenceScore`.
3. MUST NOT fabricate `sampleSize`, `qualification`, signal `weight`, or a baseline; MUST NOT emit `LIST_EVIDENCE_SAMPLE_PROXY` or any constant as a genuine sample.
4. MUST NOT edit, delete, overwrite, or re-sequence any archived snapshot or validation revision.
5. MUST NOT capture unselected fixtures, Acca/combo selections, or any fixture absent from the selection gate.
6. MUST NOT write any `marketKey`/`selectionKey` outside §2.B, nor any invalid pairing.
7. MUST NOT retain raw provider JSON, nor retain provider inputs unboundedly; only §2.E normalized inputs persist.
8. MUST NOT let the odds archive grow unbounded; retention limits are mandatory.
9. MUST NOT synthesize `market_void` from daily-list data; non-scored outcomes derive only from `resolveMatchLifecycle` (`postponed→fixture_postponed`, `cancelled→fixture_cancelled`, `abandoned→fixture_abandoned`).
10. MUST NOT derive `excluded`; it is caller-set only.
11. MUST NOT rely on `getLatestEvidenceSnapshot` alone for idempotency; the full stream is authoritative.
12. MUST NOT enable capture/settlement feature flags by default; MUST NOT configure external cron scheduling from within the repository.
13. MUST NOT freeze a transient provider failure, timeout, or stale/missing statistic as `unqualified` evidence; the affected market/fixture is omitted or retried.
14. MUST NOT recompute a historical `capturedAt`/identity from live `kickoff`/`leadMinutes` during replay, re-fetch live provider data during replay, or discard/redefine/reuse any historical `modelVersion` or its constants (see §4.9).

---

## §6 Non-negotiable assumptions
1. `matchId` is the sole canonical numeric fixture identity across daily-list source, fixture URLs, and the evidence archive.
2. The immutable evidence archive, the provider archive, and the bounded odds archive are three physically separate stores.
3. Feature flags (`EVIDENCE_CAPTURE_ENABLED`, `EVIDENCE_SETTLEMENT_ENABLED`) default OFF; the pipeline is dormant until explicitly enabled.
4. Cron **routes** live in the repository; cron **scheduling** is an out-of-repo operational concern and is never invented in code.
5. Capture is deterministic: identical `(fixtureId, kickoff, leadMinutes)` produce identical `captureId`, `captureWindowKey`, `capturedAt`, and snapshot id at original minting; replay reproduces these from retained data per §4.9.
6. `capturedBy` for this pipeline is the fixed engine constant `"evidence_capture"`.
7. Evidence inputs (team venue rates, real `played` denominators, league baselines) originate from the provider's already-defined normalized structures; `evidenceScore` is a residual-vs-baseline quantity distinct from `modelProbability`.
8. `EVIDENCE_MIN_SAMPLE_SIZE = 6` and the qualification thresholds (`qualified=70`, `provisional=45`) are the fixed Sprint 23 constants; the daily-list evidence model runs under the distinct, non-reused `modelVersion = "23B.daily-evidence.v1"` with `schemaVersion = "23.0.0"` unchanged.
9. Deterministic replay under a frozen `modelVersion` depends only on retained data (§2.C, §2.E, §4.9); it is independent of any live provider response, current kickoff value, current configuration, or current environment.

*End of contract — Revision 2.*
