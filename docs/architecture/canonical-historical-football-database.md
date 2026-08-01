# Canonical Historical Football Database — Architecture

**Document type:** Architecture design (design-only). **No implementation, no roadmap/sequence change, no frozen-contract change, no code.** Consumes and preserves the M1–M10 evidence pipeline as a downstream layer.
**Sprint / scope:** Sprint 23B · Architecture.
**Date:** 2026-07-31.
**Mission under design:** *RankWagers must permanently own football history.*
**Grounding:** every existing asset referenced below was read from current repository source (`lib/footystats/*`, `lib/archive/evidence/*`, `lib/evidence-capture/{provider-archive,odds-archive}/*`, `lib/evidence/{identifiers,hash}.ts`, `lib/{teams,competitions,seasons,fixtures}`, `docs/architecture/*`).

---

## 0. What "permanently own history" actually means (mission, challenged)

The mission is easy to mis-scope into "mirror everything a provider gives us, forever." That is the **wrong** target and is not even ownership — it is a licensing liability. This document takes a sharper definition and designs to it:

> **Ownership = the ability to reconstruct, byte-for-byte and provider-independently, both *what was true in the world* and *what RankWagers knew*, at any past instant — using only data RankWagers has independently recorded, under the exact logic version in force at that instant.**

Three things follow immediately, and they are the design's spine:

1. **The owned asset is the *canonical fact layer + our derived IP + provenance ledger* — not the vendor's payloads.** Fixtures, dates, scores, and competitions are largely non-copyrightable facts; once independently recorded and reconciled under our own identifiers, they are ours to keep even if every provider relationship ends. The raw vendor payload is licensed, bounded, and disposable.
2. **History is bi-temporal, not a single timeline.** Results get corrected (VAR, administrative overturns, provider fixes, late abandonments). "What did we believe was true at the moment we settled a prediction" is a *different* question from "what is now known to have been true," and RankWagers' integrity depends on answering both.
3. **Replay is the acceptance test, not a feature.** If any past state cannot be reconstructed deterministically from our own ledger, we did not own that history — we borrowed it.

---

## 1. Assumptions challenged (do this first, forcefully)

| # | Common assumption | Verdict | Why |
|---|---|---|---|
| **A1** | "Own history = keep all provider data forever." | **Reject** | Ownership is the canonical + derived + provenance triad. Raw payloads are licensed and belong in a bounded cold tier, not the permanent store. |
| **A2** | "It's one database." | **Reject** | Three layers with different mutability, growth, and query profiles (§3). Conflating them is precisely the current defect: four accidentally-separate append-only NDJSON stores with overlapping identity. |
| **A3** | "Append-only NDJSON scales." | **Reject for the query path** | Measured ceilings in the M10 benchmark reviews: O(F²) whole-file scans and the ~512 MB `fs.readFile` string wall. Append-only is correct for the *ledger*, wrong for the *queryable canon*. |
| **A4** | "The provider `matchId` is the fixture's identity." | **Reject — the sharpest finding** | Today identity is provider-anchored: `FootyMatchRow.matchId: number` + denormalized string `homeTeam`/`competition` (`lib/footystats/types.ts`). A provider renumber or off-board strands the entire archive. Canonical entities need RankWagers-minted, provider-independent IDs + a crosswalk (§4/§7). **Until this exists, "owning history" is an illusion.** |
| **A5** | "Results are immutable facts; one value each." | **Reject** | Scores are corrected; lifecycles change (`resolveMatchLifecycle`). Single-value canon destroys the "what we knew at settlement" audit trail. Bi-temporal versioning (§5) is mandatory, not optional. |
| **A6** | "Replay = re-fetch from the provider." | **Reject** | Providers mutate their own history; a re-fetch is *not* a replay. Replay must be reconstruction from our retained ledger under the pinned logic version — the guarantee M7 already enforces for evidence (§6/§11). |
| **A7** | "We must build the whole warehouse before anything works." | **Reject — scope discipline** | The minimum canonical core is small: Competition, Season, Team (as a continuity), Fixture, Result/lifecycle, + the crosswalk + bi-temporal versioning. Players, lineups, rich statistics are *extensions*, not the core. Do not boil the ocean. |
| **A8** | "More storage is the prerequisite." | **Reject** | The prerequisite is the **provider-neutral canonical identity layer** (A4), not more disk. Storage tiering (§9) is a consequence, not the gate. |

---

## 2. Current reality (what exists, and why it is not yet ownership)

Verified from source — RankWagers already has the *primitives* of ownership, scattered and provider-coupled:

- **Four disjoint append-only stores**, each with its own identity and file:
  - **Daily archive** — `lib/footystats/dailyArchive.ts` → `data/daily-archives/<date>.json`, `DailyArchive { date, savedAt, summary, fh/over15/over25/sh: ArchivedRow[] }`; rows are provider-shaped `FootyMatchRow & { listResult }`.
  - **Provider archive** — `lib/evidence-capture/provider-archive/*` → content-hashed normalized-input retention.
  - **Odds archive** — `lib/evidence-capture/odds-archive/*` → `OddsArchiveRecord` keyed by `captureId`.
  - **Evidence archive** — `lib/archive/evidence/*` → `snapshots.ndjson` + `validations.ndjson`, revision- and sequence-aware, content-hashed.
- **A real identity/hashing discipline already exists** — `evidenceContentHash` (sha256, `lib/evidence/hash.ts`), `evidenceSnapshotId`/`validationId`/`validationRevisionId` (`lib/evidence/identifiers.ts`), `captureWindowKey`/`captureId` (`lib/evidence-capture/identity.ts`). All deterministic, content/coordinate-derived. This is the seed of canonical identity — but it currently keys off the **provider `fixtureId`**.
- **Temporal seeds already exist** — `capturedAt` (observation window), `recordedAt`/`settledAt` (transaction/valid instants), `revision`/`supersedesRevisionId` (revision chains), `previousSnapshotId`/`sequence` (append chains), M7 `inputContentHash`/`evidenceInputVersion` (input identity, model-version-independent).
- **Entity modules exist but are provider-shaped** — `lib/{teams,competitions,seasons,fixtures}` — names/strings and provider IDs, **no canonical ID space, no crosswalk, no cross-time continuity model**.

**Diagnosis:** RankWagers has an excellent immutable, content-hashed, revision-aware *evidence* substrate — but it is (a) fragmented into four stores, (b) anchored to a single provider's IDs and denormalized strings, (c) missing a provider-neutral canonical entity layer, and (d) missing an indexed query/replay engine. The canonical database is therefore **not a greenfield build — it is the unification and re-anchoring of what already exists**, plus the two missing pieces (canonical identity + indexed bi-temporal query).

---

## 3. The spine — a three-layer architecture

Ownership requires separating three concerns that today bleed together. Each layer has a distinct mutability, growth class, legal status, and query profile.

```
   PROVIDERS (FootyStats today; others later)
        │  raw payloads (licensed)
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ L1 — OBSERVATION LEDGER            append-only · immutable · hashed   │
│  "what a provider told us, verbatim + normalized, and when"          │
│  subsumes: daily-archive · provider-archive · odds-archive (raw)     │
│  legal: LICENSED · retention: bounded/cold · deletion: per-provider  │
└─────────────────────────────────────────────────────────────────────┘
        │  reconcile (provider→canonical, precedence, conflict rules)
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ L2 — CANONICAL FACT STORE          bi-temporal · our IDs · indexed    │
│  "the reconciled truth, versioned across valid-time & observation"   │
│  entities: Competition · Season · Team(continuity) · Fixture ·       │
│            Result/Lifecycle · Market/Selection · Canonical Odds       │
│  legal: OWNED · retention: PERMANENT · engine: indexed (Postgres…)   │
└─────────────────────────────────────────────────────────────────────┘
        │  as-of reads (T, V)
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ L3 — DERIVED / EVIDENCE            already built (M1–M10) · unchanged │
│  snapshots · validations · calibration · predictions · settlements   │
│  legal: OWNED IP · consumes L2 as-of · frozen contracts preserved    │
└─────────────────────────────────────────────────────────────────────┘
```

- **L1 is the write-ahead of history**: every provider read is recorded verbatim + normalized, content-hashed, timestamped, provider-tagged — never overwritten. This is where the existing `provider-archive`, `daily-archive`, and raw `odds-archive` records belong. It is the *legal boundary*: if a provider off-boards, L1 payloads are purged under license; L2/L3 survive.
- **L2 is the owned canon**: provider-neutral entities, our IDs, bi-temporal versions, reconciled by explicit and auditable policy. This is the piece that does not exist yet and is the heart of the mission.
- **L3 is the existing evidence pipeline**, re-pointed to read canonical facts *as-of* rather than provider rows directly. Its frozen contracts (identity/hash/revision/settledAt) are untouched; it simply gains a stable, provider-independent, replayable substrate underneath.

**The invariant that makes ownership real:** *L2 must remain fully operable and reconstructable with any single provider deleted.* No canonical fact may be defined solely by a provider's opaque ID or payload — every fact must reduce to natural-key facts we independently hold. That invariant is the acceptance test for "permanent."

---

## 4. Canonical entities

The **core** (build this; it is small and high-leverage) and the **extensions** (defer; they are not the mission).

### Core entities
- **Competition** — a durable competition continuity (e.g. "English second tier"), distinct from its *branding* over time (Division One → Championship). Branding is a versioned attribute (§5), not the identity.
- **Season / CompetitionEdition** — one running of a competition (`2025/26`), with start/end and status. Natural key: `(competitionCanonicalId, seasonLabel)`.
- **Stage / Round** — group/knockout/matchday structure within an edition (extension-lite; core-optional).
- **Team** — a **continuity**, not a name. A team survives renames, relocations, and (hard) mergers/splits. `TeamName`/`TeamVenue`/`TeamAffiliation` are versioned attributes; the canonical `teamId` persists. This is the genuinely hard entity (§7 entity resolution).
- **Venue** — stadium continuity (optional core).
- **Fixture (Match)** — the central canonical entity. Natural key candidate: `(competitionEditionId, canonicalDate, homeTeamId, awayTeamId)` — provider-independent. Carries scheduling, relocation, and replay lineage (an abandoned-and-replayed match is two fixtures linked by a `replaces` edge, not a mutation).
- **Result / Scoreline** — FT/HT (and, as extension, per-period) scores, **versioned bi-temporally** (corrections are new versions).
- **MatchLifecycle** — scheduled/live/HT/finished/postponed/cancelled/abandoned/suspended (already modelled by `resolveMatchLifecycle`), versioned by observation.
- **Market / Selection** — already a closed registry (`lib/evidence-capture/markets.ts`, canonical `over` selection); folds into L2 as a controlled vocabulary.
- **Canonical Odds Fact** — *not* every tick, but the durable odds facts worth keeping forever: opening, closing, best-observed, and any RankWagers-published price — each provenance-linked to L1 tick observations.

### Extensions (explicitly out of the core; not this design's build)
Person/Player, Appearance/Lineup, granular event feeds (shots, cards, xG), referee, transfer history, detailed team statistics. Each is an additive canonical entity with the same bi-temporal + crosswalk discipline; none is required to own the *result/prediction/settlement* history that is the mission.

### Identity discipline (the non-negotiable rule)
- **Canonical IDs are RankWagers-minted and provider-independent.** Prefer *content-derived deterministic* IDs from the natural key (reusing the existing `evidenceContentHash` discipline) so the same real-world entity resolves to the same canonical ID on independent recomputation — the property that makes replay and dedup total.
- **Crosswalk (`ProviderEntityMap`)** — the only place provider IDs live in L2's vicinity: `(providerKey, entityType, providerId) → canonicalId`, itself **bi-temporal** (a provider can remap its own IDs; that remap is a versioned observation, never a silent overwrite). This table is the seam that lets a provider be added or removed without touching a single canonical fact.

---

## 5. Temporal versioning (bi-temporal, generalized from the evidence slice)

Two independent time axes plus a total order — this generalizes the revision/sequence chains M8 already uses.

- **`valid_time` [valid_from, valid_to)** — when the fact holds *in the world* (e.g. "this was the final score").
- **`observation_time`** — when *RankWagers recorded* it (transaction time).
- **`observation_seq`** — a monotonic ledger sequence giving a total, replayable order (the generalization of `sequence`/`revision`).

Every canonical fact is an **immutable version row**:

```
(canonicalId, attributes…, valid_from, valid_to,
 observed_at, observation_seq, source_observation_ids[], reconciliation_reason,
 content_hash, supersedes_version_id)
```

- **Corrections create a new version; nothing is ever mutated or deleted** — identical to the evidence archive's append-only immutability (`decideValidationAppend` → `immutable_violation` on hash conflict). A VAR-corrected score is a *new* result version with `valid_time` overlapping the old and a later `observation_seq`.
- **"Current" is derived, never stored as truth** — `MAX(observation_seq)` per valid interval — matching the existing `currentValidationRevisions` head-derivation. A materialized current-view projection exists for performance but is a cache of a derivation, not the source of truth.
- **Content hashing** on each version gives idempotent re-ingest (a re-observation of the same fact collapses to a duplicate no-op, exactly as the odds/snapshot stores already do).

This is the single mechanism behind results corrections, provider disagreements, late abandonments, and schedule changes — one uniform, auditable, append-only versioning model across all canonical entities.

---

## 6. Historical replay & as-of queries

Bi-temporality yields three query classes; the third is the moat.

1. **As-of-observation** — *"what did we believe at instant T?"* → filter `observation_time ≤ T`, take latest version per fact. (Reproduce a past dashboard / published prediction / trust page.)
2. **As-of-valid** — *"what is now known to have been true at world-instant V?"* → the version whose `[valid_from, valid_to)` contains V, latest observation. (Best current knowledge of a historical result.)
3. **Bi-temporal slice `(T, V)`** — *"what did we, at T, believe was true at V?"* → filter `observation_time ≤ T` **and** valid-interval ∋ V, latest per fact. **This is the exact reconstruction required to audit a settlement or a published price** — reproduce the state of the world *as we knew it* at the moment we acted. Nothing else can answer a dispute honestly.

**Replay contract (generalizes M7/DoD-1):**
- Reconstruction uses **only** L1 + L2 versions + the **pinned logic version** (`modelVersion`, `evidenceInputVersion`) in force at the replay instant. **Never a re-fetch** (providers mutate; re-fetch is not replay).
- L3 derived artefacts (snapshots/validations) reproduce **byte-identically** under their original version — the existing content-hash guarantee, now resting on a stable canonical substrate instead of volatile provider rows.
- Reconciliation decisions are themselves recorded versions (§7) so the *canon* is replayable, not just the raw observations — you can reconstruct *why* a value was canonical at T, not merely what it was.

Replay is therefore total and auditable: raw observations (L1) + reconciled versions (L2, incl. the decision records) + pinned logic (L3) ⇒ any past state, deterministically.

---

## 7. Provider reconciliation

Designed for **multiple providers over time** (FootyStats today; the crosswalk makes others additive), and for the fact that providers *disagree, correct, and retract*.

**Pipeline (all decisions recorded, none silent):**
1. **Entity resolution → crosswalk.** Map each incoming provider entity/fixture to a canonical ID. Exact match via existing crosswalk; new/ambiguous entities generate *candidate* matches on natural keys (competition + date + team names, normalized) with a confidence score; low-confidence matches are **quarantined for human confirmation**, never auto-merged. Team renames/mergers are the hard case and are explicitly a human-in-the-loop continuity decision, not an algorithm's silent guess.
2. **Attribute reconciliation → canonical version.** For each attribute (score, lifecycle, kickoff), resolve the canonical value by a **deterministic, explainable precedence policy**: provider trust rank, recency, corroboration (agreement across providers raises confidence), and lifecycle rules (a trusted `finished` supersedes another's `live`; a later corrected score supersedes an earlier one). The winning value becomes a new L2 version carrying `source_observation_ids` and a `reconciliation_reason`.
3. **Conflict handling (fail-closed).** A conflicting observation never overwrites — it creates a new version with a reason, or, if it *contradicts* a trusted terminal fact without sufficient authority, is **quarantined + flagged**, never silently canonicalized. This mirrors the evidence archive's loud `immutable_violation` posture: a genuine contradiction is escalated, not averaged.
4. **Provider retraction ≠ history loss.** If a provider *changes or deletes* a past value, the original observation remains in L1 and the prior canonical version remains in L2; the change is a *new* version. Our history cannot be edited from outside. This is the core of "permanent ownership."

**Trust is versioned too.** Provider precedence is itself a temporal fact (a provider's reliability may change; we may re-rank). Because reconciliation decisions are recorded with the policy inputs, re-ranking is transparent and replayable.

---

## 8. Ownership boundaries

The three-layer split *is* the ownership/legal boundary.

| Concern | Owned outright (permanent) | Licensed / bounded (disposable) |
|---|---|---|
| **Identifiers** | Canonical ID space, crosswalk, entity continuities | Provider IDs (only inside the crosswalk) |
| **Facts** | Reconciled canonical facts (score, date, lifecycle) as natural-key facts we independently recorded | Provider's *compiled database* rights / opaque payloads |
| **Decisions** | Reconciliation logic + recorded decisions; trust policy | — |
| **Derived IP** | All L3 evidence, predictions, settlements, calibration | — |
| **Provenance** | Hashes, timestamps, our normalization, the ledger metadata | Raw provider payload bytes (cold, time-bounded) |

**Operating rules:**
- **The permanence test:** L2/L3 must be fully operable with any one provider — and its L1 payloads — deleted. If deleting a provider breaks a canonical fact, that fact was not owned; fix the model (reduce it to natural-key facts), do not add more mirroring.
- **The legal boundary = the deletion boundary.** Provider off-boarding purges L1 raw payloads under the license; the canonical facts (independently recorded, largely non-copyrightable) and all derived IP remain. Confirm the actual license terms for L1 retention windows and any database-right constraints — this is a *product/legal* input to the retention policy, not an engineering guess.
- **Raw payload minimization.** Keep verbatim payloads only as long as the license and audit needs require; canonicalize the *facts* immediately. Long-term ownership lives in L2, not in a growing pile of vendor JSON.

---

## 9. Storage growth

Different entities have radically different growth classes; forcing them into one store (today's failure) guarantees the O(F²)/string-wall ceiling.

| Class | Volume | Store / tier |
|---|---|---|
| Canonical entities (competitions, teams, seasons) | Small, slow | L2 hot, indexed |
| Fixtures + result/lifecycle versions | Hundreds of thousands/season globally; modest correction fan-out | L2, **partitioned by season × competition** |
| Canonical odds facts (open/close/best/published) | Bounded per fixture×market | L2, permanent |
| **Raw odds ticks / live updates** | **Steepest growth by far** | **L1, bounded retention → cold/drop past a window** |
| Raw provider payloads | High | L1, licensed, bounded/cold |

**Principles:**
- **Partition by `season × competition`** — it aligns with query locality, retention, and the natural archival unit (a completed season is immutable and can be sealed).
- **Hot / cold tiering** — current + recent seasons hot (transactional, indexed); historical seasons **sealed, compressed, columnar** for backtesting and audit (range-scan workloads, not point lookups).
- **Retire the NDJSON string wall from the query path.** Append-only NDJSON is retained only as L1's immutable export/write-ahead format (streaming reads, never whole-file `readFile`). The queryable canon is an indexed engine (Postgres bi-temporal now; a columnar/OLAP mirror for cold history + model backtesting later). This directly resolves the measured M10 ceilings — they were an artefact of using the *ledger* format as the *query* path.
- **Keep the canonical facts forever; do not keep every tick forever.** The permanent asset is the reconciled fact, not the raw stream that produced it.

---

## 10. Indexing

As-of bi-temporal queries are index-sensitive; a naïve design is O(history).

- **L2 canonical:**
  - PK `canonicalId`; unique **natural-key** index (e.g. fixture `(competitionEditionId, canonicalDate, homeTeamId, awayTeamId)`) for dedup and reconciliation.
  - Crosswalk index `(providerKey, entityType, providerId)`.
  - **Current-view:** B-tree on `(canonicalId, observation_seq DESC)` — head derivation in O(log n).
  - **As-of-observation:** BRIN/range on `observation_time` (append-ordered → BRIN is cheap and tiny).
  - **As-of-valid & bi-temporal slice:** range/GiST index on `(valid_from, valid_to)` per `canonicalId` so the `(T, V)` slice is a range probe, not a scan.
  - **Settlement hot path:** partial index on open/unsettled fixtures only (the working set is tiny vs history).
- **L1 ledger:** `(canonicalId, observed_at)` + `content_hash` (idempotent dedup) + `observation_seq` (total order). Append-only ⇒ index maintenance is cheap.
- **Cold tier:** columnar with per-partition (season) **zone maps / min-max** — as-of and backtest queries become partition-pruned range scans.

The guiding rule: **the settlement/prediction hot path touches a tiny indexed working set; full history is reached only by explicit, partition-pruned as-of/backtest queries** — never by scanning the ledger, which is what today's whole-file NDJSON reads do.

---

## 11. Replay (re-emphasised — it is the whole point)

The user listed replay twice; it is the design's success criterion, not a section.

**Replay must be a first-class, tested capability with three guarantees:**
1. **Canonical replay** — reconstruct any L2 current-view as-of any `(T, V)` from versions alone. Deterministic; index-supported (§10).
2. **Derived replay** — reproduce any L3 snapshot/validation/settlement **byte-identically** under its pinned logic version (the existing M7 serialization-boundary + content-hash guarantee, now standing on a stable canonical substrate).
3. **Decision replay** — reconstruct *why* a value was canonical at T (the reconciliation decision records), so an audit can reproduce the reasoning, not just the outcome.

**What replay is not:** it is never a provider re-fetch, never an approximation, never "close enough." If a past state is not reconstructable from L1 + L2 versions + pinned logic, the history was not owned — and that is a design defect to be fixed at the model, not patched at query time.

This capability is the moat: dispute resolution, regulatory audit, honest "what we knew when," and rigorous model backtesting all reduce to a replay query.

---

## 12. Merge of existing plans (concrete unification — no new greenfield)

The canonical database is the **unification and re-anchoring** of assets that already exist. Explicit mapping:

| Existing asset (verified) | Lands in | Change of role |
|---|---|---|
| `dailyArchive.ts` / `data/daily-archives/*.json` | **L1** observation (per-date provider snapshot) → feeds **L2** fixture/result canon | Becomes a provider observation, not a query source; the (deferred) strict reader (Slice-3) is its fail-closed ingest edge |
| `provider-archive/*` (`ProviderArchiveRecord`, content-hashed) | **L1** normalized observation | Already the right shape; gains a canonical-entity link |
| `odds-archive/*` (`OddsArchiveRecord`, captureId-keyed) | **L1** ticks + **L2** canonical odds facts | Split raw ticks (bounded) from durable odds facts (permanent) |
| `lib/archive/evidence/*` (snapshots/validations) | **L3** derived (unchanged) | Re-points to read **L2 as-of** instead of provider rows; frozen contracts preserved |
| `lib/{teams,competitions,seasons,fixtures}` registries | **L2** canonical entities | Gain canonical IDs + crosswalk + continuity model (today: provider strings/IDs) |
| `evidenceContentHash`, `evidenceSnapshotId`, `validationId`, `captureId` | **L2/L3** identity discipline | The content-hash/deterministic-ID discipline extended to canonical entities |
| M7 `inputContentHash`/`evidenceInputVersion`; `revision`/`sequence` chains | **L2** temporal-versioning discipline | Generalized from the evidence slice to all canonical facts (§5) |
| M10 live-candidate pipeline (capture/settlement) | **L3** consumer | Consumes canonical as-of reads; its INV-A/append-only/replay invariants are the same discipline L2 formalizes |

**The insight:** there is no greenfield warehouse to build. There is (a) **one canonical identity/entity layer to introduce** (L2 core + crosswalk — the piece genuinely missing), (b) **four accidentally-separate append-only stores to reclassify** into L1/L3 under one bi-temporal model, and (c) **one query/replay engine to stand up** so history stops being read by whole-file scans. The frozen M1–M10 contracts are preserved throughout; L3 does not change shape, it gains a stable floor.

---

## 13. What NOT to build (scope guardrails)

- **Not** a full stats/player/event warehouse — extension, not the mission core (§4).
- **Not** a multi-provider federation before the two-layer canon (crosswalk + bi-temporal L2) is proven with the single current provider.
- **Not** a bespoke temporal database engine — use established bi-temporal patterns on the existing/selectable Postgres, plus a columnar cold mirror; do not invent a datastore.
- **Not** a change to any frozen evidence contract, identity/hash/revision formula, or archive format — L3 is preserved; L2 is additive underneath it.
- **Not** "keep every provider byte forever" — the permanent asset is the reconciled canon, not the vendor stream.

---

## 14. Open questions / genuine risks (surface, don't hide)

1. **Entity resolution for teams** (renames, relocations, mergers/splits) is genuinely hard and product-sensitive — requires a human-in-the-loop continuity model; do not automate the merge decision.
2. **Reconciliation precedence policy** is a *product* decision (which provider/rule wins) as much as an engineering one; it must be explicit, versioned, and auditable — never implicit in code.
3. **Legal retention of L1 payloads** depends on the actual provider license and any database-right constraints — a required product/legal input to the retention/ownership boundary (§8), not an engineering assumption.
4. **Cold-tier / backtesting OLAP** is a distinct concern from the transactional canon and should not be conflated with it (different engine, different index strategy).
5. **The true prerequisite is A4** — provider-neutral canonical identity. Every "permanent ownership" claim is contingent on it; storage, tiering, and indexing are downstream of getting identity provider-independent first.

---

## 15. Statement on this document

Architecture design only. No runtime code, test, route, cron, flag, schema, migration, archive format, evidence contract, or deployment was created or modified; no roadmap or milestone sequence was reordered; the M1–M10 evidence pipeline is consumed and preserved as L3. All referenced repository assets were read from current source. This document defines the *shape* of permanent ownership; it authorizes no implementation.
