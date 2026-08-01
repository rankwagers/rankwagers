# FPI — Canonical Intelligence Extension (first-principles review)

> **Status: STRATEGY / DESIGN REVIEW ONLY — NOT STARTED, NOT AUTHORIZED FOR IMPLEMENTATION.**
> **Authored:** 2026-07-31 · **Extends:** `[[foundational-preservation-initiative]]` ·
> **Merges with:** `[[long-term-product-vision-architecture-review]]` · **Governed by:** `[[rankwagers-manifesto]]`.
> Completely additive. No implementation, no milestone reorder, no production-activation delay, no
> contract / evidence-identity / settlement / prediction / runtime / API / storage-format change.

---

## 0. The reframe — from *not losing data* to *owning the interpretation*

FPI today answers a defensive question: *how do we stop losing football data and stop depending on one provider?* This review asks the offensive one: *if the goal were to become the world's canonical football-intelligence database over a decade, what would the architecture have to be?*

The shift is not "store more." It is **from preservation to interpretation**: the durable, ownable, un-copyable asset is not the raw provider bytes (those are legally encumbered — FPI §9, category C) but **RankWagers' own canonical, temporal, reproducible, higher-order interpretation** of football (category B — the owned layer). The canonical-database ambition is realized through the *derived* layer, which is also the safest commercial asset. That single insight reconciles the ambition with both the manifesto and the licensing constraints.

**The compounding flywheel this architecture builds:**

```
raw preservation (FPI-2)
   → canonical temporal model (L1+L2)
   → reproducible replay / verifiability (L3)
   → deterministic higher-order knowledge (L5)
   → SEO authority + AI-citation grounding + licensable derived data (Vision N3/N4)
   → high-intent traffic + trust → affiliate FTDs → funds deeper coverage
   → more raw → (loop)
        ▲                                             │
        └──── Provider Reliability Intelligence (L4) ──┘
              (feedback controller: sources each fact from the
               historically-most-reliable provider → the model
               gets *more accurate* the longer it runs)
```

Every layer below is judged by how much it strengthens this loop **without adding a parallel system**.

---

## 1. The meta-challenge — four of the five already exist; merge, don't multiply

Before designing anything, the honest finding: the five "new layers" are mostly unions of things already planned or shipped. Building them as five independent systems would duplicate stores, duplicate lineage, and multiply complexity. The strongest architecture **absorbs** them into the existing two documents and the existing code.

| Proposed layer | Already lives in… | Genuinely-new core (the only thing to build) | Verdict |
|---|---|---|---|
| **1. Canonical Football Database** | FPI Phase 3 (canonical model) + existing `lib/knowledge-graph/graph.ts` + FPI Phase 6 (data lake) + Vision Phase 5 (KG) + entity registries | *Promote* the canonical model to the single authoritative entity **system-of-record** and unify the three under one name | **MERGE / RE-SCOPE** — no new system |
| **2. Temporal Versioning** | Evidence snapshots already version *evidence* (`sequence`/`previousSnapshotId`); FPI-2 raw is timestamped; K0-2 publication immutability | **Bitemporal versioning of canonical *entities*** (valid-time vs transaction-time) — entities are *not* versioned today | **EXTEND** — new core is entity bitemporality, *derived*, not a new DB engine |
| **3. Historical Replay** | M6/M8 settlement + evidence replay ("rebuild-from-rows"); Vision **N5 Verification Portal**; FPI-2 raw | **Full-stack replay from RAW** — re-derive canonical + evidence + prediction from archived raw, end-to-end | **MERGE into N5** — new core is raw→everything reproducibility |
| **4. Provider Reliability Intelligence** | reliability wrapper (circuit/quota), freshness states, FPI-9 independence score, Vision AF-3 operator comparison | **Longitudinal provider accuracy / disagreement / retroactive-change intelligence** | **GENUINELY NEW** (mostly) — feeds FPI-4 + FPI-9 |
| **5. Knowledge Extraction Engine** | Vision RP-6 (similar matches), KG derived edges, N3 GEO, N4 licensing, the AI layer (AIX) | **Deterministic, lineage-tracked derivation** of higher-order owned facts | **CONSTRAIN + MERGE** — feeds the AI layer, is *not* the AI layer |

**Net honest complexity added:** not five systems — **three read-only derived projection layers** over the immutable archives (a canonical temporal entity layer, a provider-reliability metrics layer, a derived-knowledge layer). Everything else is re-scoping and renaming of what already exists. That is the whole point of this review.

---

## 2. The Five Layers (challenged, merged, and placed)

Each carries: the challenge, the genuinely-new core, then the six requested dimensions (compounding value · SEO defensibility · affiliate trust · un-copyable asset · additive proof · dependency position).

### L1 · Canonical Football Database — *merge & promote, do not build new*

**Challenge:** "Database" is the wrong frame and a trap. The pieces already exist: a canonical model is partially in place (the product already maps providers into RankWagers entities), a knowledge graph already ships (`lib/knowledge-graph/graph.ts`, 11 Schema.org types), and FPI Phase 3 + Phase 6 already plan the canonical model and data lake. A *new* "canonical database" would be a parallel system — pure complexity.

**Genuinely-new core:** *promote* the canonical model from "internal abstraction for provider independence" to **the single authoritative entity system-of-record** that every product read routes through, fed only by provider adapters, versioned by L2, reproducible by L3. Unify FPI-3 + the knowledge graph + FPI-6 under one name; add a canonical schema version. This is a *designation and unification*, not a build.

- **Compounds:** every provider added and every season passed enriches **one** owned, deduplicated, cross-reconciled model — the entity graph gains value superlinearly as edges multiply.
- **SEO defensibility:** stable canonical entities → stable canonical URLs + consistent structured data → topical authority and knowledge-panel eligibility. A provider-coupled competitor cannot emit coherent, contradiction-free entities across a whole site.
- **Affiliate trust:** provider-neutral, internally-consistent facts mean no contradictions between pages — "our model, not a reseller's feed." Consistency *is* credibility.
- **Un-copyable:** a decade of unified, cross-provider-reconciled entities is not scrapable; it is an accretion, not a snapshot.
- **Additive proof:** read-only projection; the product already partially reads canonical shapes; no contract change, provider identity moves *out* of product-visible shapes into lineage.
- **Dependency position:** the foundation of the knowledge layer — FPI Phase 3 slot, unified with Vision Phase 5 (KG); after FPI Phase 2 (raw capture) so it can be re-derived.

### L2 · Temporal Versioning — *extend; new core is entity bitemporality*

**Challenge:** we already version the things that matter most *immutably* — evidence snapshots chain by `sequence`/`previousSnapshotId`, predictions freeze at publish (K0-2), raw is timestamped. Do **not** re-version those. And do **not** build a full bitemporal database engine — that is heavy complexity for a derived need. The gap is narrower and sharper: **canonical entities** (team form, league tables, standings, stats) are *not* versioned — we cannot answer "what did we believe this entity was, as of date D."

**Genuinely-new core:** **bitemporal canonical-entity versioning** — *valid-time* (when a fact was true in the world) vs *transaction-time* (when we learned it) — **derived as-of reconstructions from the timestamped raw archive (FPI-2)**, not a new mutable store. Minimal, derived, additive.

- **Compounds:** each day adds a permanent new time-slice; "as-of any past date" questions become answerable forever — value grows with age, the opposite of most data.
- **SEO defensibility:** point-in-time pages ("the table on this date," "form entering that match") are unique, evergreen, and impossible for anyone who wasn't capturing time-series from day one.
- **Affiliate trust:** we can show data **as it was at prediction time**, not retrospectively edited — direct proof we don't move goalposts (reinforces K0-2, Manifesto Art. VI Integrity of the Record).
- **Un-copyable:** the past cannot be back-filled; a late entrant can never reconstruct time-series it never observed. This is the purest time-moat in the whole platform.
- **Additive proof:** derived read-only over immutable timestamped raw + snapshots; nothing mutates.
- **Dependency position:** after FPI Phase 2 (timestamped raw) + Phase 3 (canonical model); it is the precondition for L3 (replay) and L4 (judging a provider against later-known truth).

### L3 · Historical Replay — *merge into N5 Verification Portal; new core is raw→everything*

**Challenge:** replay already exists at the evidence/settlement layer (M6/M8 "rebuild-from-rows, not re-derive") and is already promoted to a flagship public product in the Vision as **N5, the Verification Portal**. A parallel "replay engine" duplicates both.

**Genuinely-new core:** **full-stack replay from RAW** — re-derive the canonical model *and* evidence *and* prediction from the archived raw responses, proving reproducibility end-to-end (today's replay rebuilds from stored *rows*; this proves the rows themselves were faithfully derived from source). This is the ultimate integrity guarantee and the engine behind N5.

- **Compounds:** reproducibility becomes a permanent, growing proof asset — every past decision stays auditable forever.
- **SEO defensibility:** "audit any pick / reproduce any table" pages (N5) are near-unique trust content that competitors structurally cannot offer.
- **Affiliate trust:** the trust *capstone* — verifiable, not asserted. Users, partners, even regulators can independently reproduce our history. This is the strongest possible answer to "why trust you."
- **Un-copyable:** requires immutable raw + lineage from day one; cannot be retrofitted.
- **Additive proof:** read-only re-derivation in a sandbox; never writes to production archives; never touches runtime.
- **Dependency position:** merges with Vision **N5**; after L1 + L2 + FPI Phase 2/lineage (FPI-4 = Vision K0-3).

### L4 · Provider Reliability Intelligence — *the genuinely-new layer; gate it honestly*

**Challenge:** reliability *infrastructure* exists (circuit breaker, quota, freshness states), but **longitudinal accuracy intelligence** does not — and it has a hard precondition the proposal ignores: to judge "which provider was right," you need either **multi-provider overlap** (FPI Phase 8, a second source) or **temporal ground-truth** (L2 — compare what a provider said *then* against what proved true *later*). Without one of those, a reliability score is unfounded. So this layer is real, but **gated**, not immediate.

**Genuinely-new core:** a derived metrics layer tracking, per provider and per data category: accuracy vs later-known truth, freshness/latency, **disagreement rate** between providers, and **retroactive-change rate** (a provider silently editing history is a critical trust signal) → a **provider trust score per data category**.

- **Compounds:** the flywheel's feedback controller — the canonical model sources each fact from the historically-most-reliable provider, so **data quality improves the longer the system runs**. Self-improving accuracy is a rare, durable advantage.
- **SEO defensibility:** unique "data quality / methodology" transparency content; directly feeds Vision AF-3 operator/provider comparison pages with *earned* rather than editorial rankings.
- **Affiliate trust:** meta-transparency — "we measure our own sources and tell you which are reliable" — extends the honesty brand one level deeper than any competitor.
- **Un-copyable:** requires years of multi-source observation; a moat literally made of elapsed time.
- **Additive proof:** pure measurement over immutable archives; no runtime or fetch-behaviour change.
- **Dependency position:** feeds FPI Phase 4 (independence — informs cutover decisions) and FPI-9 (independence score); **gated on L2 (temporal ground-truth) and/or FPI Phase 8 (second provider)** — design early, activate when overlap exists.

### L5 · Knowledge Extraction Engine — *constrain hard, or it becomes the thing we forbid*

**Challenge (the sharpest):** as named, this risks becoming an "AI generates insights" engine — which would violate the Manifesto (Art. II evidence before opinion, Art. XII AI explains/evidence decides, Art. VIII never fabricate statistics), duplicate the AI Intelligence layer, and inject hallucination risk into the owned data. It must be **deterministic, reproducible, and lineage-tracked**, or it does not ship. It is a *derivation* layer, not an *invention* layer.

**Genuinely-new core:** a versioned, deterministic derivation pipeline that turns the canonical temporal archive into higher-order **owned facts** — head-to-head records, form trends, streaks, home/away splits, similarity features (Vision RP-6), calibration truths — where **every derived fact is itself archived with lineage**, as reproducible as the raw it came from. It **feeds** the AI layer (as grounding) and the SEO layer (as content substrate); it is not either of them.

- **Compounds:** higher-order facts multiply combinatorially as coverage grows — the most SEO-valuable, most AI-groundable, and most licensable layer, all derived from owned data.
- **SEO defensibility:** an inexhaustible supply of unique, evidence-backed derived statistics — passed through the *existing* uniqueness gate (not mass-PSEO, per the standing decision) — and the substrate for GEO / AI-citation (Vision N3).
- **Affiliate trust:** every derived stat is reproducible and sourced → literally cannot be a fabricated statistic (Manifesto Art. VIII); trust through verifiability.
- **Un-copyable:** derived from the owned temporal archive; reproducibility + lineage make it defensible; legally it is **category B (owned interpretation)** — the *safest* commercial/licensable asset, safer than raw.
- **Additive proof:** deterministic read-only derivation; outputs to a derived-knowledge store; never mutates source, never changes runtime.
- **Dependency position:** latest of the five — after L1 + L2 (and L3 for the reproducibility guarantee); feeds Vision KG / RP-6 / N3 (GEO) / N4 (licensing) / the AI layer. **Never gates the AI layer; the AI layer never gates it.**

---

## 3. Unified Dependency Graph (merged — no parallel systems)

```
════════ FROZEN — CURRENT ROADMAP (untouched) ════════
 M10 → Production Activation → Evidence · Settlement · Accuracy · ROI → Prediction Archive → SEO
═══════════════════════════════════════════════════════
        │  (nothing below delays/reorders/modifies the above)
        ▼
 FPI Phase 0 audit · Backup/DR · Licensing (§9) · Coverage      [MUST start now — zero code]
        │
        ▼
 FPI Phase 2 — Raw Immutable Archive (dormant-build → activate after production)
        │
        ├───────────────► L1 Canonical Model = system-of-record
        │                    (merges FPI-3 + knowledge graph + FPI-6 + Vision Phase 5)
        │                        │
        │                        ▼
        │                    L2 Temporal Versioning (bitemporal ENTITIES, derived as-of)
        │                        │
        │              ┌─────────┼───────────────────────────┐
        │              ▼         ▼                           ▼
        │        L3 Replay    L4 Provider Reliability     (feeds) FPI-4 Independence
        │        = Vision N5   Intelligence  ◄─ gated on    + FPI-9 Independence Score
        │        (raw→all)     L2 and/or FPI-8 (2nd source)
        │              │         │
        │              └────┬────┘
        │                   ▼
        │            L5 Knowledge Extraction (deterministic, lineage-tracked)
        │                   │
        │   ┌───────────────┼───────────────────────────────┐
        │   ▼               ▼                 ▼              ▼
        │  Vision KG   Vision RP-6      Vision N3 (GEO)  Vision N4 (licensable
        │  (evidence   (similar          / AI-citation    derived dataset —
        │   nodes)      matches)          grounding)       category B, owned)
        │                                     │
        └──────── FPI-4 lineage = Vision K0-3 provenance (build once, serve both)
                                              ▼
                                   AI Intelligence layer (latest;
                                   consumes L5, never gates it)
```

**Placement rules:** roadmap untouched; the whole extension is downstream of FPI Phase 2 and the Vision's Phase 0 keystones; L1–L5 are **read-only derived projections**; L3 = N5, FPI-4 = K0-3 — the same systems, named once.

---

## 4. Complexity budget — what we are explicitly NOT building

To honour "strengthen without increasing unnecessary complexity," the things this review **refuses** to create:

- ❌ A new "canonical database" product — L1 *promotes and unifies* existing pieces.
- ❌ A full bitemporal database engine — L2 is *derived as-of reconstruction* over immutable raw.
- ❌ A parallel replay engine — L3 *is* the Vision's N5.
- ❌ A parallel lineage/provenance system — FPI-4 *is* the Vision's K0-3.
- ❌ An AI insight generator — L5 is *deterministic derivation* that *feeds* the AI layer.
- ❌ Any re-versioning of evidence/predictions — already immutable; untouched.

**Honest net addition: three read-only derived projection layers** (canonical temporal entities, provider-reliability metrics, derived-knowledge), all over the same immutable archives, all additive, all reversible.

---

## 5. Legal reconciliation (ties to FPI §9)

The canonical-intelligence-database ambition is realized through the **owned derived layer (category B)** — canonical model (L1), temporal versioning (L2), reproducible derivations (L3/L5) — which is the *safest* commercial and licensable asset. Raw provider responses (category C) remain a **quarantined, legally-gated reproducibility reserve**, never the redistributed product. This is the crucial move: **we become "the world's canonical football database" by owning the interpretation, not by reselling providers' bytes** — maximum independence and maximum commercial optionality with zero contractual conflict, and full alignment with the Manifesto.

---

## 6. Summary of changes

- **Reframed FPI's ceiling** from provider-independence to an owned canonical-intelligence asset, via one insight: the durable value is the *derived interpretation* (category B), not the raw (category C).
- **Merged 4 of 5 proposed layers** into existing homes (L1→FPI-3/KG/FPI-6/Vision P5; L3→Vision N5; parts of L4→FPI-4/9; L5→Vision KG/RP-6/N3/N4/AI) — refusing five parallel systems.
- **Isolated the genuinely-new cores:** bitemporal *entity* versioning (L2), longitudinal provider *accuracy* intelligence (L4), deterministic lineage-tracked *knowledge derivation* (L5) — three derived projection layers, nothing more.
- **Gated L4** honestly on multi-source overlap or temporal ground-truth (a precondition the proposal omitted).
- **Constrained L5** to deterministic, reproducible derivation so it cannot violate the Manifesto or duplicate the AI layer.
- **Kept everything additive, read-only, reversible, and off the frozen roadmap's critical path.**

Nothing here implies implementation, milestone change, contract change, or runtime-behaviour change.

_Related: `[[foundational-preservation-initiative]]`, `[[long-term-product-vision-architecture-review]]`, `[[rankwagers-manifesto]]`, `[[m6-evidence-capture-migration-review]]`, `[[m7-historical-input-identity-failure-review-v2]]`._
