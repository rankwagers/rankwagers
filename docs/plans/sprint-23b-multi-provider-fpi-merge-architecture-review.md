# Sprint 23B — Multi-Provider Evidence (Remove Single-Provider Dependency; Merge FPI) — Architecture Review

**Document type:** Architecture review & design (design-only). **No runtime code, test, contract, flag, route, schema, archive-format, or migration was created or modified.** The only file created is this document.
**Mission:** remove the single-provider (FootyStats) dependency; merge a second provider (**FPI** — Football Prediction Index / power-rating source) into the evidence pipeline.
**Date:** 2026-07-31.
**Method:** grounded in current repository source (`file:line`); every design choice is checked against the **frozen** Sprint 23B M1–M10 contracts (identity/hash/revision/replay). No implementation is proposed here — this fixes the architecture and its boundaries only.

---

## 1. Executive Summary

**The pivotal finding: the evidence substrate is already provider-aware, so multi-provider is *additive*, not a rewrite.** Two of the three frozen identity contracts already carry a `source` dimension:

- `ProviderArchiveRecord` identity is `(source, fixtureId, captureWindowKey)` — `provider-archive/record.ts:10,24-28,201-207`; `source: string` ("footystats") is a first-class identity field, and `providerArchiveId` uses a delimiter-joined seed so **distinct sources can never collide**.
- `OddsArchiveRecord` identity is `(captureId, marketKey, selectionKey, source)` — `odds-archive/record.ts:18-19,44-55` — explicitly "multiple markets/sources coexist per capture."
- The M4 fetch layer is already an **injectable seam**: `SourceFetcher = (PlannedFetch) => Promise<FetchResult>` (`routing/orchestrator.ts:30`), with `orchestrateFetches` categorizing `ok|timeout|failed|unavailable|skipped_*` and enforcing `maxFailureRatio`.

The **only** place that hard-codes single-provider is a *policy assumption*, not a data-model constraint: `routing/sources.ts:6-8` — *"There is a single provider (FootyStats), so there is NO primary/fallback chain."* `SourceKind` there is `team_stats | league_baseline | match_detail` — a **data-kind** axis, orthogonal to provider. Adding a provider axis beside it is additive.

**The one hard constraint that shapes everything: replay determinism.** M7's replay basis is `inputContentHash = "iih_" + hash({ evidenceInputVersion, providerContentHash, oddsContentHashes[] })` (`input-identity/identity.ts:9-10,35-45`). It hashes **one** `providerContentHash` (singular) plus a canonically-sorted **multi-source** `oddsContentHashes[]`. Therefore:

- **Odds are already multi-source** — FPI odds admitted as `source:"fpi"` simply add entries to `oddsContentHashes[]`. **Zero contract change.**
- **The model basis is single-hash** — M5 derives from **one** `FixtureModelInput` (`model/derive.ts:70`) and M7 hashes **one** `providerContentHash`. So **the merge of provider *model inputs* must collapse to a single, deterministic, content-hashable artifact** *before* M5. That artifact is a new **synthetic "merge" provider-archive record** whose `contentHash` becomes the `providerContentHash` — while the individual `footystats`/`fpi` records are retained (immutable) as provenance and audit.

**Recommended architecture (binding shape): a merge stage that sits between the per-provider archive and M5 derivation, emitting one immutable `source:"merge:…@policyVersion"` provider-archive record.** This preserves every frozen guarantee (append-only, content-addressed, replayable) and confines all provider-specific code to adapters.

---

## 2. Current State (verified)

| Surface | Today | Provider-readiness |
|---|---|---|
| Fetch seam | `SourceFetcher` injectable; `orchestrateFetches` categorizes + `maxFailureRatio` (`routing/orchestrator.ts`) | ✅ seam exists |
| Routing | `SourceKind = team_stats\|league_baseline\|match_detail`; *"single provider … no fallback"* (`sources.ts:6-8,17`) | ⚠️ provider axis absent (the gap) |
| Provider archive | immutable, content-hashed, identity `(source, fixtureId, captureWindowKey)` (`provider-archive/record.ts`) | ✅ source-keyed |
| Odds archive | immutable, identity includes `source`; `EVIDENCE_CAPTURE_SOURCE` reserved fallback (`odds-archive/record.ts`) | ✅ multi-source |
| Model input | `FixtureModelInput{ markets: MarketInput[] }`, `MarketInput{ home/away: VenueStat{pct,played,hits}, leagueBaseline, counters }` (`model/derive.ts:52-70`) | single-basis (merge target) |
| Replay identity | `inputContentHash` over `{version, providerContentHash, oddsContentHashes[]}` (`input-identity/identity.ts`) | one model hash + N odds hashes |
| Provider client | FootyStats `getDailyMatchListsForDate`, matchDetail, teamStats, halfScores (`lib/footystats/*`) | to be wrapped by an adapter |
| Existing abstraction | **none** — no provider registry / adapter / merge / scoring / failover exists (greenfield) | build on the source-keyed substrate |

The daily prediction row `FootyMatchRow` (`footystats/types.ts:3-30`) carries the per-market percentages (`over15Pct/over25Pct/fhOver05Pct/shOver05Pct`), scores, and status — the fields a second provider must map onto.

---

## 3. Design Principle — where merge sits vs the frozen boundary

Three placements were considered; only one preserves the frozen contracts:

- **(A) Merge before M5, as its own immutable provider-archive source — CHOSEN.** The merge engine reads the retained per-provider records for one `(fixtureId, captureWindowKey)`, produces a merged normalized payload, and admits it via the existing `admitProviderArchive` as `source:"merge:<providerset>@<policyVersion>"`. M5 derives from the merged record; M7 hashes its `contentHash`. Individual provider records persist for provenance/replay/audit. **Additive; no frozen change.**
- (B) Merge inside M5 (M5 consumes N records). **Rejected** — changes the frozen `FixtureModelInput` (single-basis) and M5 purity contract.
- (C) Merge at read/query time (no persisted merged record). **Rejected** — non-deterministic replay (scores/policy would be recomputed live) and no stable `providerContentHash`.

**Consequence (the spine of the whole design):** the merged record is the replay basis, so **the merge must be a pure, versioned, deterministic function of `(retained per-provider records + a pinned policy snapshot)`.** Provider *scores* and *tolerances* must be **frozen into the policy version at mint time**, never recomputed at replay — otherwise `providerContentHash` drifts and replay breaks (this is the single most important correctness rule in this document).

---

## 4. Provider Abstraction

A provider is a registered plugin behind one interface (conceptual; names non-binding):

```
EvidenceProvider {
  id: string                     // stable, e.g. "footystats" | "fpi"  → the archive `source`
  version: string                // adapter/schema version (in the policy snapshot, not identity)
  capabilities: {                // what this provider can supply
    markets: MarketKey[]         // subset of the §2.B closed registry
    sourceKinds: SourceKind[]    // team_stats | league_baseline | match_detail (+ future: model_prob)
    supplies: ("predictions" | "venue_stats" | "league_baseline" | "odds" | "results")[]
  }
  fetch(request): Promise<RawProviderResult>     // native call; injectable (the SourceFetcher seam)
  normalize(raw): NormalizedProviderData         // native shape → canonical shape (adapter, §5)
  health(): ProviderHealth                        // uptime/latency/last-success (for scoring/failover)
}
```

- **Registry:** a pure, ordered `ProviderRegistry` keyed by `id`; providers register capabilities. Discovery, planning, and merge iterate the registry — no provider is named in the pipeline core.
- **Provider id == archive `source`** — reuses the existing identity dimension; no new field.
- **Capability-scoped:** a provider that supplies only `odds` (e.g. an odds feed) never participates in the model merge; one that supplies only `predictions`/`venue_stats` never emits odds. The merge engine iterates only capability-matching providers per market.
- Removing the single-provider dependency = the pipeline reads the **registry**, not `lib/footystats/*`; FootyStats becomes *one registered provider*.

## 5. Adapter System

**One adapter per provider — the ONLY place provider-specific code exists.** Downstream (archive, merge, M5–M10) sees the canonical shape only.

- **FootyStats adapter:** wraps the existing `lib/footystats/*` (`getDailyMatchListsForDate`, matchDetail, teamStats, halfScores) → canonical `NormalizedProviderData` (per-market `VenueStat{pct,played,hits}`, `leagueBaseline{pct,played}`, odds, `FootyMatchRow`-shaped results). This is a *pure re-expression* of today's `source.ts`/`qualifiedFixture` mapping behind the adapter boundary — no behaviour change to FootyStats.
- **FPI adapter:** wraps the FPI API → the same canonical shape. FPI typically supplies **model probabilities / power ratings** rather than empirical venue percentages, so its adapter maps FPI's probability into the `VenueStat.pct` slot with an FPI-appropriate `played`/confidence proxy (see §8) and, if FPI exposes prices, into odds records (`source:"fpi"`).
- **Adapter obligations (binding):**
  1. Deterministic + pure over `(raw payload)` — no clock, no ambient config in the normalized output (replay).
  2. Emit an immutable per-source `ProviderArchiveRecord` via `admitProviderArchive` (`source = provider.id`) — the retained raw-normalized basis.
  3. Map only into the **closed** market/selection registry (§2.B); unknown markets are **dropped + counted**, never invented (mirrors M4/M5 fail-closed).
  4. Classify a fetch fault into the existing `FetchResult` vocabulary (`ok|timeout|failed|unavailable`) — never fabricate on failure (`contract §5.13`).
  5. Never touch identity/hash formulas — it produces `payload` + `source`; the frozen `providerArchiveContentHash` hashes it.

## 6. Merge Engine

**Pure, deterministic, versioned; field-level, not record-level.** Input: the set of retained per-provider normalized records for one `(fixtureId, captureWindowKey)` + a pinned policy snapshot. Output: one merged `NormalizedProviderData` → one `source:"merge:…@policyVersion"` provider-archive record → M5.

- **Grain:** merge **per market, per venue** (`home`/`away`) and **per league-baseline** — the units M5 consumes. Categorical fields (final scores, status, kickoff) are **not** averaged — they resolve by a precedence/quorum rule (§7), since averaging a score is meaningless.
- **Numeric merge (the pct/confidence path):** weighted combination (§8): `pct_merged = Σ(w_i · pct_i) / Σ w_i`; effective `played_merged` = a bounded function of the contributing samples (e.g. `Σ played_i` capped, or a reliability-discounted sum) so the merged confidence never exceeds what the inputs justify.
- **Provenance in the merged payload:** the merged record's payload carries a **contributions manifest** — which provider ids/versions contributed each market, their weights, and the policy version — so the merged record is self-describing for audit and so a reviewer can reconstruct the merge. (Provenance is *in the hashed payload* → part of `providerContentHash` → replay-stable.)
- **Determinism guardrails:** stable ordering (provider id, then market key), no `Date.now`, no map-iteration-order dependence, no float non-determinism (round pct to the frozen 1e-6 grid already used in `derive.ts:122-128`). Same inputs + same policy snapshot ⇒ byte-identical merged record ⇒ identical `providerContentHash` ⇒ replay holds.
- **Coverage rule:** a market with only one contributing provider is passed through weighted-by-one (graceful single-provider operation — the design degrades cleanly to today's behaviour when only FootyStats is present). A market with **zero** admitted providers is omitted (M5 already drops baseline-less markets → `no_scorable_markets`), never fabricated.

## 7. Conflict Resolution

Deterministic, versioned policy for provider disagreement — **numeric** vs **categorical** handled differently:

- **Numeric disagreement (pcts):** compute a divergence metric (e.g. max pairwise |Δpct| or weighted variance). Within tolerance → weighted-average (§6/§8). **Beyond tolerance → policy strategy**, one of (pinned per policy version):
  - `weighted_average` (default — trust the confidence weights even under disagreement),
  - `max_confidence_wins` (take the highest-weighted provider, discard outliers),
  - `fail_closed` (mark the market **unscored/omitted** rather than emit a merged pct the providers don't agree on — the safest; maps to M5's existing omit path). Never silently pick one.
- **Categorical disagreement (final score / status / kickoff):** resolve by **provider precedence for results** (a settled result should come from the authoritative results provider, configured per policy) or **quorum** (agree-or-defer). A genuine results conflict → **defer** (do not settle on contested data) — this composes with M8's fail-closed settlement (`invalid_input` on a causeless/ambiguous change) and the C3/C4 gates.
- **Every conflict is counted** in bounded, low-cardinality diagnostics (`merge_conflict_total{market,strategy}` — never a fixture/provider payload as a label, per the M10 §10 cardinality rule). A resolved-by-`fail_closed` conflict surfaces as an omitted market with a reason, not a hidden drop.
- **Frozen-safe:** conflict resolution runs *inside* the merge stage (pre-derivation); M5/M8 semantics are untouched — they simply receive a merged basis or an omitted market.

## 8. Confidence Weighting

The weight of provider `p` on market `m` in league `L`:

```
w(p,m,L) = f( providerScore(p,m,L)   // §9 reliability (pinned in the policy snapshot)
            , sampleConfidence(played) // empirical sample size — the frozen `played` field
            , freshness(observedAt)    // TTL-relative recency (routing already tracks this)
            , coverage )               // does p actually cover (m,L)?
```

- **Sample confidence** reuses the existing signal: `MarketInput.VenueStat.played` (`derive.ts:52`) is already the sample size M5 uses; a Bayesian/shrinkage weight (e.g. `played/(played+k)`) prevents a tiny-sample provider from dominating.
- **Provider score** (§9) is the cross-provider reliability multiplier — an empirical, out-of-band-computed accuracy, **pinned into the policy version** so it is constant for a given merged record (replay).
- **FPI vs FootyStats blend:** FootyStats brings empirical venue history (high `played`); FPI brings a model probability (calibrated, possibly higher accuracy but no "sample" in the frequentist sense) — FPI's weight leans on its `providerScore` (calibration) while FootyStats' leans on `played`. The weighting formula unifies both onto one scale.
- **Output to M5:** the merged `VenueStat.pct` + a merged `played` (effective confidence). The merged confidence also feeds the snapshot's `evidenceScore`/`qualification` through M5 unchanged — a low-agreement or low-coverage market naturally yields lower evidence strength.
- **Determinism:** weights are a pure function of the pinned policy snapshot + the retained records; no live recomputation at replay.

## 9. Provider Scoring

An **out-of-band, scheduled** reliability score per `(provider, market, league)` — never computed inline in a capture run.

- **Signal:** historical accuracy of each provider's predictions vs **realized settled outcomes** — the `validations.ndjson` archive already holds the settled truth (won/lost/void per market). A scheduled sweep computes a proper scoring rule (Brier / log-loss / calibration) per provider over a rolling window, plus uptime/freshness from `health()`.
- **Storage:** a small, versioned **provider-score table/snapshot** (its own append-only artifact), keyed `(provider, market, league, windowEnd)`. Scores are inputs to weighting; **they are NOT identity** and **NOT recomputed at replay** — the merge pins the *score-snapshot version* it used into the policy version.
- **Cold-start:** a new provider (FPI at launch) has no history → a conservative prior weight (config default), promoted as its settled sample accrues — mirrors the canary posture (start low, earn trust on evidence).
- **Cardinality/observability:** scores are aggregate per (provider,market,league) — bounded; exposed via the existing metrics surface, no entity ids.

## 10. Failover (graceful degradation, not hard swap)

Failover is **operate on whoever is fresh/admitted**, bounded by a coverage policy — it reuses the existing fetch categorization:

- At fetch time, `orchestrateFetches` already yields per-source `ok|timeout|failed|unavailable|skipped_fresh` + `maxFailureRatio`. A provider that fails/times-out simply **contributes no record** for that fixture this run.
- The merge engine merges the **survivors**. If only FootyStats is fresh → weighted-by-one (today's behaviour). If only FPI is fresh → FPI-only. If **neither** meets the policy's **minimum coverage** for a market → the market is **omitted** (`not_admitted`/`no_scorable_markets`), never fabricated.
- **No hard primary/fallback chain is invented** (the thing `sources.ts:8` currently forbids) — instead a *coverage/quorum policy* per market: `min_providers`, optional `required_provider_for_results`. This is deterministic and auditable, and degrades to single-provider automatically.
- **Idempotent recovery:** because capture is idempotent and progress is archive-derived (INV-A), a fixture deferred by a provider outage is simply re-merged on the next run once the provider returns — no dead-letter state.
- Composes with the existing `run.status ≠ completeness` rule (M4 review): a degraded run is flagged (`run_degraded`), not silently partial.

## 11. Replacement Strategy

Providers are **swapped by policy version, never by mutation** (immutability is the enabler):

- A merged record's `source` embeds the **provider set + policy version** (`merge:footystats+fpi@v3`). Adding/removing/upgrading a provider, or changing weights/tolerances, mints a **new policy version** → new `source` → new merged records **going forward**. Historical merged records and their `providerContentHash` are **never rewritten** (replay of past days stays byte-stable).
- **Rollout mirrors M10's staged activation:** a new policy runs **dry-run** (compute merged records, compare against the current policy's, no snapshot mint), then **canary** (a bounded fixture subset), then **full** — behind flags, human go/no-go, reversible by flag flip.
- **Deprecating FootyStats-only** (the mission's end state) = a policy version whose provider set no longer requires FootyStats as the sole source; the single-provider assumption in `sources.ts` is replaced by the registry + coverage policy. The 7 existing fail-open `readDailyArchive` consumers and non-evidence surfaces are a separate, per-caller migration (out of the evidence-merge scope).
- **A/B & regression:** because every provider's raw record and every policy's merged record are retained, a new policy can be **back-tested** against settled outcomes offline before promotion — no production risk.

## 12. Replay & Frozen-Contract Preservation (the spine)

Every design element above is chosen to keep M1–M10 frozen. The invariants and how they hold:

| Frozen invariant | How multi-provider preserves it |
|---|---|
| Provider identity `(source, fixtureId, window)` | FPI = a new `source`; merged = a synthetic `source`. No formula change (`provider-archive/record.ts:201`). |
| Odds identity incl. `source` | FPI odds = `source:"fpi"` add to the sorted `oddsContentHashes[]`. Already multi-source (`input-identity/identity.ts:44`). |
| `inputContentHash` = f(version, **providerContentHash**, oddsHashes[]) | The **merged** record's contentHash is the single `providerContentHash`. Merge must be pure over pinned inputs. |
| M5 single-basis, pure derivation | M5 unchanged — it derives from the one merged `FixtureModelInput`. |
| Append-only, immutable, no rewrite | Merge **adds** a record; per-provider records retained; policy change = new source, never mutation. |
| Deterministic replay | **Provider scores + tolerances pinned into the policy version**; merge is pure; rounding on the frozen 1e-6 grid. **(The single hardest requirement.)** |
| Fail-closed | Zero-coverage market → omitted; conflict-beyond-tolerance → `fail_closed`; provider fault → survivor-merge or defer; never fabricate. |
| Bounded observability | Aggregate `{provider,market,league,strategy}` labels; no entity/payload id. |

**Non-negotiable determinism rule:** the merged `providerContentHash` must be reconstructable at replay from `(retained per-provider records + the pinned policy/score snapshot)` alone. Any live recomputation (scores, weights, `Date.now`, registry order) at replay time is a defect that breaks M7 — it is the #1 review checkpoint for the implementation stage.

## 13. Data Flow

```
 Registry(footystats, fpi, …)
    │  per provider (capability-matched), under the existing fetch seam + TTL/budget/maxFailureRatio
    ▼
 Adapter.fetch → Adapter.normalize → admitProviderArchive(source=provider.id)   [immutable, per-source]
    │                                        (footystats record) (fpi record) …  ← RETAINED (provenance/replay/scoring)
    ▼
 MERGE ENGINE (pure, policy-pinned)
    • capability + coverage/quorum (failover)              §6/§10
    • confidence weights = score ⊗ sample ⊗ freshness      §8/§9
    • conflict resolution (numeric weighted / fail_closed; categorical precedence/quorum)  §7
    ▼
 admitProviderArchive(source="merge:<set>@<policyVersion>")   [immutable merged basis + contributions manifest]
    │  contentHash = providerContentHash
    ▼
 M5 deriveEvidenceModel(FixtureModelInput)  →  M6 capture snapshot  →  M7 inputContentHash(version, providerContentHash, oddsHashes[])
    │                                                                            ▲
    └───────────── FPI/other odds records (source:"fpi") join oddsContentHashes[] ┘
    ▼
 M8 settlement (results via §7 precedence/quorum) …  (frozen, unchanged)

 Out-of-band: scheduled provider-scoring sweep over validations.ndjson → versioned score snapshot (feeds a FUTURE policy version)
```

## 14. Risks, Non-Goals, Open Questions

**Risks**
- **R-1 (determinism, highest):** provider scores/weights leaking into the replay path un-pinned → `providerContentHash` drift. Mitigation: pin score-snapshot version into the policy version; a replay test over a two-provider fixture must be byte-stable (extend the M7 serialization-boundary test).
- **R-2 (FPI semantic mismatch):** FPI supplies model probabilities, not empirical venue samples — mapping onto `VenueStat{pct,played}` needs a principled `played`/confidence proxy (calibration-derived), else weighting is skewed. Needs an FPI-adapter calibration decision.
- **R-3 (cost/scale):** N providers × the frozen O(F·A) archive scans and per-fixture fetch — multi-provider multiplies fetch and provider-record volume. Governed by the existing TTL/`requestBudget`/ceiling; a performance benchmark (Stage-2E-B style) is required before activation.
- **R-4 (conflict masking):** a `weighted_average` under high disagreement can emit a plausible-but-wrong pct. Mitigation: divergence metric + `fail_closed` option + conflict metrics + offline back-test vs settled outcomes.
- **R-5 (cold-start bias):** FPI with no history gets a prior weight that could over- or under-trust it. Mitigation: canary + score-earned promotion.

**Non-goals (this review):** any code; changing a frozen identity/hash/revision formula; the FPI API contract itself; enabling any flag; the per-caller migration of the 7 non-evidence `readDailyArchive` consumers; correction-stage interactions; Postgres/adapter storage choices (orthogonal — the source-keyed model is storage-independent).

**Open questions for the implementation spec:** (a) FPI confidence proxy / calibration mapping; (b) numeric divergence tolerance + default conflict strategy per market; (c) results-authority precedence for settlement; (d) score-window length + cold-start prior; (e) merge-policy version naming + the score-snapshot pinning mechanism.

## 15. Recommendation

**Adopt Option A: a pure, versioned merge stage that emits one immutable `source:"merge:…@policyVersion"` provider-archive record between the per-provider archive and M5.** It removes the single-provider dependency by making FootyStats one registered provider behind an adapter, merges FPI as a second provider (model inputs via the merge stage; odds via the already-multi-source odds archive), and preserves **every** frozen M1–M10 contract because the substrate is already `source`-keyed and the merged record is a legitimate, content-addressed, replayable artifact. The design degrades cleanly to today's single-provider behaviour, stages activation exactly like M10 (dry-run → canary → full, flag-gated, reversible), and gates replacement/rollout on immutability + offline back-testing.

**The one architectural rule the implementation must not violate:** the merged `providerContentHash` must be a pure function of retained per-provider records + a *pinned* policy/score snapshot — no live recomputation at replay. Everything else is additive.

This is an architecture design only. It authorizes no implementation, changes no frozen contract, and enables no provider.
