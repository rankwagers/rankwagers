# RankWagers — Long-Term Product Vision (Post-Roadmap Extension)

> **Mission (north star, governs all prioritization):** RankWagers exists to become the most
> trusted source of explainable football intelligence on the internet. Every prediction,
> recommendation, and insight should be reproducible, evidence-backed, historically measurable, and
> transparently evaluated. **Affiliate revenue is an outcome of user trust — not the primary
> objective of the product.** When trust and monetization conflict, trust wins.

> **Status: VISION ONLY — NOT STARTED. NOT AUTHORIZED FOR IMPLEMENTATION.**
> **Authored:** 2026-07-31
> **Nature:** Strategy / architecture document. No code, no contract changes, no milestones scheduled.

> ⚠️ **AMENDED — read the architecture review first.** This is the v1 vision. A code-grounded CPO
> review (`docs/plans/long-term-product-vision-architecture-review.md`) supersedes several
> assumptions here. Key corrections, which take precedence over the text below:
> - **A new Phase 0 (Foundational Integrity)** comes first: append-only **odds log** (K0-1, gates all
>   ROI/CLV/value), **publication-snapshot immutability** (K0-2, gates all permanent public pages),
>   and a **provenance/lineage ledger** (K0-3).
> - **Phases 2 (SEO) and 5 (Knowledge Graph)** are RE-SCOPED from "build" to "extend" — the
>   `lib/seo-intelligence/*` engine (32 page-type contracts, indexability + uniqueness gate) and
>   `lib/knowledge-graph/graph.ts` already exist. Phase 2's "programmatic clusters" must respect the
>   standing **"no mass PSEO"** decision.
> - **Phases 3 (Affiliate) and 6 (Transparency)** are RE-SCOPED to "publicize/activate" — operator
>   registry, availability engine, attribution, and the calibration engine (Brier/ECE/sample-gates)
>   already exist in admin/dormant form.
> - **Promoted to flagships:** Verification Portal (N5), CLV as north-star (N2), GEO/grounded-answer
>   (N3), provenance (N1), EEAT authors (N6), RG-as-compliance (N7). **Cut:** FX-6 community.
>   **Deferred:** FX-7 multi-sport. See the review for the full challenge, cuts, and revised graph.

---

## 0. The Firewall (read first)

This document extends the roadmap **beyond** the current one. It does not touch it.

The following remain the **absolute priority**, **unchanged**, **unreordered**, and **undelayed** by anything below:

- M10 completion and production activation
- Evidence Capture, Settlement, Accuracy, ROI pipelines
- Prediction Archive, Acca Studio, the SEO roadmap
- Every currently planned milestone

Everything in this document is **downstream** of `[[sprint-23b-m10-closure]]` and the completion of the existing roadmap. Every milestone here carries an explicit "position: after X" that never precedes an existing milestone. If any item below appears to compete with current work, the current work wins — always.

Milestone IDs here use fresh namespaces (`RP-`, `SE-`, `AF-`, `AIX-`, `KG-`, `TP-`, `LI-`, `FX-`) so they can never be confused with or reorder `M1–M10` or the existing `AI-1…AI-10`.

---

## 1. Positioning & Operating Thesis

RankWagers is not a tips site. The long-term product is the **global reference platform for football betting intelligence** — the "Bloomberg Terminal + Wikipedia + The Athletic" of football evidence, where every claim is reproducible from immutable, content-hashed evidence and measurable over time.

**The durable moat is not predictions. It is the evidence substrate.**

Competitors can copy a UI in a sprint. They cannot copy:

1. **A multi-year immutable evidence archive** (M2–M8) that lets us publish *"here is exactly what we knew, when we knew it, and how it turned out."*
2. **Reproducibility** — every page is regenerable from hashed inputs, so our transparency claims are verifiable, not marketing.
3. **A knowledge graph** built on that archive, which turns isolated pages into a defensible topical-authority web.

The entire extension optimizes for one compounding loop:

```
Evidence archive → unique programmatic pages → topical authority + backlinks
   → organic traffic of high-intent users → transparent affiliate handoff → FTDs
   → revenue funds deeper evidence coverage → larger archive → (loop)
```

Every phase below is judged by how much it strengthens that loop. We optimize for **compounding authority**, never short-term clicks.

**Non-negotiable invariants inherited from the current architecture** (apply to *every* milestone below):

- **Evidence decides, AI explains.** No LLM ever selects, invents, or overrides a pick.
- **Deterministic selection stays authoritative** (Qualification → Evidence Ranking → Selection → Explanation).
- **Nothing enters evidence identity casually.** Any new derived score that feeds a hashed snapshot must go through `modelVersion` + frozen-at-first-mint discipline (see `[[m5-evidence-model-migration-review]]`, `[[m6-evidence-capture-migration-review]]`). Explanation-layer outputs stay *out* of identity.
- **Fail-closed, reversible, dormant-first.** Every new surface ships behind flags, defaults off, and degrades to "no claim" rather than a fabricated claim.
- **No thin pages, no duplicate content, no hallucinated analysis.**

---

## 2. Per-Milestone Profile Format

Every milestone below is specified with the same ten fields:

- **Purpose** · **Dependencies** · **SEO impact** · **Affiliate impact** · **User value** · **Technical complexity** (S/M/L/XL) · **Future extensibility** · **Moat (why hard to copy)** · **Risks** · **Roadmap position**

Complexity is relative effort, not calendar time.

---

# PHASE 1 — Research Platform

**Thesis:** Turn the evidence archive into a *research surface*. Today the platform produces predictions; the Research Platform lets a high-intent user (and Google) explore the *why* behind every fixture, team, league, and market. This is the top of the funnel and the primary EEAT engine.

## 1.1 Architecture

The Research Platform is a **read-only projection layer** over the frozen archives. It introduces **no new authoritative data** — it reads Evidence Capture (M6), Validation, Settlement (M8), Odds (M3), and Historical Input Identity (M7), and renders them as navigable research objects.

```
                 ┌─────────────────────────────────────────┐
                 │  Frozen archives (M2–M8) — READ ONLY     │
                 │  evidence · validation · settlement ·    │
                 │  odds · input-identity                   │
                 └───────────────────┬─────────────────────┘
                                     │  strict fail-closed readers
                                     ▼
        ┌────────────────────────────────────────────────────────┐
        │  Research Projection Service (new, stateless, cached)   │
        │  - normalizes archive rows → research view models       │
        │  - joins across entities (fixture↔team↔league↔market)   │
        │  - NEVER writes back into evidence identity             │
        └───────────────┬───────────────────────┬────────────────┘
                        ▼                       ▼
              ┌──────────────────┐    ┌──────────────────────┐
              │ Research Hub UI  │    │ Programmatic SEO      │
              │ (interactive)    │    │ page generators (P2)  │
              └──────────────────┘    └──────────────────────┘
```

**Key architectural rules:**

- The projection service is **derivation-only** and versioned (`researchViewVersion`) so a projection change never mutates evidence.
- All joins are **entity-keyed** (the same keys the future Knowledge Graph in Phase 5 will formalize) — Phase 1 seeds the entity model, Phase 5 makes it a graph.
- Every research object is **archived by URL** — a fixture research page for a past match remains valid forever (feeds Phase 2 historical archives and Phase 6 transparency).

## 1.2 Milestones

### RP-1 · Match Research Hub
- **Purpose:** Canonical per-fixture research page: evidence summary, signals, odds context, historical comparables, prediction (if qualified) or an explicit "no qualified prediction."
- **Dependencies:** Full current roadmap (esp. Evidence Capture, Prediction Archive); Research Projection Service.
- **SEO impact:** Very high — one high-value page per fixture, the hub that all other research spokes link into.
- **Affiliate impact:** High — natural, evidence-justified odds/operator CTA at decision point.
- **User value:** The "should I care about this match, and why" answer in one place.
- **Complexity:** L
- **Future extensibility:** Becomes the anchor node for the Knowledge Graph (Phase 5) and Live Intelligence overlay (Phase 7).
- **Moat:** Requires the immutable archive to show *what we knew pre-match*; competitors have no historical evidence to render.
- **Risks:** Thin pages for low-data fixtures → mitigate with coverage thresholds (render "insufficient evidence" state, don't publish a hollow page).
- **Roadmap position:** First milestone after the current roadmap; gates the rest of Phase 1.

### RP-2 · Fixture Intelligence
- **Purpose:** Pre-match analytical breakdown (form, context, matchup shape) derived from FootyStats + evidence signals.
- **Dependencies:** RP-1.
- **SEO impact:** High — "team A vs team B prediction/analysis" is a top query class.
- **Affiliate impact:** High — the pre-match decision page.
- **User value:** Structured, skimmable pre-match read.
- **Complexity:** M
- **Future extensibility:** Feeds AI Match Insights (Phase 4) and market pages (Phase 2).
- **Moat:** Evidence-backed, not opinion; every claim traces to a signal.
- **Risks:** Overlap with RP-1 → keep RP-1 = *summary + decision*, RP-2 = *deep analysis*; enforce distinct templates.
- **Roadmap position:** After RP-1.

### RP-3 · Team Intelligence
- **Purpose:** Per-team evergreen hub: historical prediction accuracy *for this team*, evidence trends, upcoming fixtures.
- **Dependencies:** RP-1; Prediction Archive.
- **SEO impact:** Very high — evergreen entity page, strong internal-link hub for all that team's fixtures.
- **Affiliate impact:** Medium (indirect, funnels to fixture pages).
- **User value:** "How reliable have predictions been for this team?"
- **Complexity:** M
- **Future extensibility:** Anchor for League Models (Phase 4), Team entity in Knowledge Graph (Phase 5).
- **Moat:** Requires longitudinal validated history.
- **Risks:** Needs enough settled predictions to be non-thin → gate on sample size (ties to Phase 6 calibration gates).
- **Roadmap position:** After RP-1, parallel-eligible with RP-2.

### RP-4 · League Intelligence
- **Purpose:** Per-competition hub: league-level accuracy, market tendencies, best-covered fixtures.
- **Dependencies:** RP-3.
- **SEO impact:** Very high — league is a top-of-cluster hub page (Phase 2).
- **Affiliate impact:** Medium.
- **User value:** Orientation layer for a competition.
- **Complexity:** M
- **Future extensibility:** Directly becomes a Phase 2 topical-cluster hub and Phase 4 League Model home.
- **Moat:** Cross-season validated performance.
- **Risks:** Duplicate-content risk across similar leagues → enforce data-driven uniqueness (real numbers per league).
- **Roadmap position:** After RP-3.

### RP-5 · Market Intelligence
- **Purpose:** Per-market hub (BTTS, O/U, 1X2, corners, cards…): where the evidence engine performs best/worst, sample sizes, calibration.
- **Dependencies:** RP-4; Settlement history.
- **SEO impact:** High — "over 2.5 goals prediction," "BTTS tips" query classes.
- **Affiliate impact:** Medium-High.
- **User value:** Honest "which markets we're actually good at."
- **Complexity:** M
- **Future extensibility:** Phase 4 Market Models, Phase 6 Market Performance transparency.
- **Moat:** Publishing *where we're weak* is only credible with real settled data — competitors won't/can't.
- **Risks:** Reveals weak markets → reframe as trust asset (Phase 6 does this deliberately).
- **Roadmap position:** After RP-4.

### RP-6 · Historical Similar Matches
- **Purpose:** "This fixture resembles these N past validated fixtures; here's how they resolved." Deterministic similarity over evidence features.
- **Dependencies:** RP-1; M7 input identity; enough settled history.
- **SEO impact:** High — unique, un-copyable comparison content; strong internal linking (each similar match links out).
- **Affiliate impact:** Medium.
- **User value:** Evidence-based analogy, the single most persuasive trust device.
- **Complexity:** L
- **Future extensibility:** Feeds AI Historical Similarity (Phase 4) and is a precursor to ML feature engineering.
- **Moat:** Requires a large *validated* corpus + deterministic feature vectors; nearly impossible to replicate cold.
- **Risks:** Similarity must be deterministic + explainable (no black box) → publish the match features used.
- **Roadmap position:** After RP-1–RP-5 (needs the entity hubs).

### RP-7 · Evidence Timeline
- **Purpose:** Chronological view of *how evidence for a fixture evolved* pre-match (odds moves, signal changes, freshness).
- **Dependencies:** M3 odds archive, M6 evidence snapshots (multiple over time).
- **SEO impact:** Medium-High — unique content type nobody has.
- **Affiliate impact:** Medium (CLV story supports "bet early" CTA).
- **User value:** See the market and evidence move; understand timing.
- **Complexity:** L
- **Future extensibility:** Direct precursor to Phase 7 Live Intelligence timeline.
- **Moat:** Requires time-series immutable snapshots — a byproduct of our architecture, not easily bolted on.
- **Risks:** Storage/retention interplay (see `[[m3-odds-archive-failure-review]]` retention gate) — read-only, so no new risk, but respects retention windows.
- **Roadmap position:** After RP-1; benefits from RP-6.

### RP-8 · Interactive Match Comparison
- **Purpose:** Side-by-side comparison of two fixtures/teams across evidence dimensions.
- **Dependencies:** RP-2, RP-3.
- **SEO impact:** Medium (interactive, less indexable) but high engagement/retention.
- **Affiliate impact:** Low-Medium.
- **User value:** Power-user research tool → retention + returning visitors.
- **Complexity:** M
- **Future extensibility:** Comparison primitive reused for operators (Phase 3) and leagues.
- **Moat:** Depth of comparable evidence dimensions.
- **Risks:** Interactivity vs indexability → pair with static "compare A vs B" pages for SEO.
- **Roadmap position:** After RP-2/RP-3; non-blocking.

### RP-9 · "Why This Match" / "Why Not Selected" (Research edition)
- **Purpose:** Human-readable, deterministic rationale for selection or rejection, sourced from the qualification engine — *before* the AI explanation layer (Phase 4) enriches it.
- **Dependencies:** Qualification engine, candidate-pipeline diagnostics (M10 producer diagnostics).
- **SEO impact:** Very high — "why not" pages are near-unique in the industry and inexhaustible programmatic content.
- **Affiliate impact:** Medium (trust → downstream conversion).
- **User value:** Radical transparency; the anti-tipster differentiator.
- **Complexity:** M (reuses existing rejection reasons — *no new ML*).
- **Future extensibility:** Phase 4 AI "Why Not" narrates on top; Phase 6 aggregates rejected predictions.
- **Moat:** Only credible if you *have* a deterministic selection engine that logs reasons — we do.
- **Risks:** Volume of rejected candidates → cluster and template, don't publish one flimsy page each.
- **Roadmap position:** Early in Phase 1 (cheap, high-trust) — after RP-1.

### RP-10 · Historical Match Explorer
- **Purpose:** Browse/filter the entire archive of past fixtures + their evidence + outcomes.
- **Dependencies:** RP-1–RP-7; Prediction Archive.
- **SEO impact:** High — deep archive discovery + internal-link distribution engine.
- **Affiliate impact:** Low (evergreen, low intent) but authority-building.
- **User value:** The "we have nothing to hide" archive.
- **Complexity:** M
- **Future extensibility:** UI surface for the Knowledge Graph (Phase 5).
- **Roadmap position:** Late Phase 1 (aggregates everything prior).

## 1.3 Phase 1 SEO & Internal Linking

- **Hub/spoke seeded here:** League (RP-4) → Team (RP-3) → Fixture (RP-1/RP-2) → Market (RP-5). Every spoke links up to its hub and across to siblings (similar matches RP-6).
- **Internal-link graph:** each fixture page links to both teams, the league, the relevant market pages, its similar matches, and its "why not" siblings — a dense, natural mesh (not a footer link farm).
- **Evergreen vs. dated:** entity hubs (team/league/market) are evergreen and accrue authority; fixture pages are dated and flow authority up to hubs after the match, then live forever in the archive.

## 1.4 Phase 1 Future Expansion

Seeds the entity/relationship model that Phase 5 formalizes; provides the surfaces that Phase 4 (AI) narrates and Phase 7 (Live) overlays. Nothing here is a dead-end page type.

---

# PHASE 2 — SEO Expansion (Programmatic)

**Thesis:** Convert the Research Platform's data into a governed, at-scale programmatic SEO system built as **topical clusters with hub-and-spoke internal linking**, where every generated page has unique, data-derived value — never a template with swapped nouns.

## 2.1 Architecture

```
   Entity registry (from Phase 1 / Phase 5)
        │
        ▼
   Page-type contracts ──► uniqueness gate ──► render ──► indexability policy
   (defines required        (min data /        (static)     (sitemaps, canon,
    unique fields per        min sample or                    noindex thin)
    page type)               NO PUBLISH)
```

- **Page-type contracts** (extends existing `docs/seo-page-type-contracts.md`): every programmatic page type declares the *minimum unique data* it must contain to be published. Below threshold → `noindex` or not generated. This is the anti-thin-content firewall.
- **Cluster model:** one **hub** per top entity, **supporting/spoke** pages beneath, bidirectional links, a single canonical per intent.
- **URL lifecycle governance** (extends `docs/seo-url-lifecycle.md`): archived pages get durable URLs; superseded pages redirect, never 404.

## 2.2 Clusters & Milestones

Each cluster = hub page + governed spokes. All share the same per-milestone treatment; summarized in the cluster table, with the distinctive ones profiled.

| Cluster | Hub | Spokes | Uniqueness source | Complexity |
|---|---|---|---|---|
| **SE-1 Countries** | Country intelligence hub | operator-availability, legal, market prefs per country | regional operator + licensing data | M |
| **SE-2 Operators** | Operator hub | operator×country, comparisons, availability history | operator registry + availability archive | M |
| **SE-3 Markets** | Market hub (from RP-5) | market×league, market×team performance | settled market performance | M |
| **SE-4 Competitions** | League hub (from RP-4) | season, matchday, league×market | validated league history | M |
| **SE-5 Teams** | Team hub (from RP-3) | team×market, team form, team fixtures | validated team history | M |
| **SE-6 Fixtures** | Fixture (from RP-1) | pre-match, result, post-mortem | per-fixture evidence | L (volume) |
| **SE-7 Statistics** | Stat concept hubs | stat×league, stat×team, glossary | FootyStats + evidence | M |
| **SE-8 Historical Archives** | Archive index (RP-10) | season/month/competition archives | immutable history | M |
| **SE-9 Evidence Archives** | Evidence index | per-snapshot evidence report pages | hashed evidence snapshots | L |
| **SE-10 Prediction Archives** | Prediction index | per-prediction + outcome pages | validated + settled predictions | M |

### SE-9 · Evidence Archives (the signature cluster)
- **Purpose:** A public, permanent, per-snapshot "here is exactly the evidence, hashed, at time T" page.
- **Dependencies:** M6/M7 snapshots; Phase 1 projection.
- **SEO impact:** Very high + **backlink magnet** — journalists/analysts cite verifiable evidence.
- **Affiliate impact:** Low direct, very high authority.
- **User value / EEAT:** Proof of reproducibility — the trust cornerstone.
- **Complexity:** L
- **Moat:** Impossible without an immutable content-hashed archive; this is the single least-copyable page type on the platform.
- **Risks:** Retention windows (M3/M7 gates) — publish within retained window, archive summaries beyond it.
- **Roadmap position:** After Phase 1 + SE-8.

### SE-10 · Prediction Archives
- **Purpose:** Every prediction ever made, with its pre-match evidence and its settled outcome — win or lose, all public.
- **Dependencies:** Prediction Archive, Settlement.
- **SEO impact:** Very high (evergreen, unique).
- **Affiliate impact:** Medium.
- **EEAT:** Publishing losses = the strongest trust signal in the industry.
- **Complexity:** M
- **Moat:** Requires you to have been transparently recording predictions for a long time; late entrants can't fabricate history.
- **Roadmap position:** After Phase 1.

## 2.3 Internal-Link Graph & Topical Clusters

- **Every page belongs to exactly one canonical cluster** and links: **up** (to its hub), **across** (to 3–8 relevant siblings, data-selected not random), and **down** (hubs to their best spokes).
- **Country ↔ Operator ↔ Market ↔ League ↔ Team ↔ Fixture** form a **six-dimensional mesh** — the same fixture is reachable from a country page (operators available there), an operator page (fixtures they price), a market page, etc. This multi-entry topology is what builds *topical authority*, not raw page count.
- **Hub pages** consolidate authority and are the primary ranking targets; **spokes** capture long-tail and pass authority up.

## 2.4 Anti-Thin / Anti-Duplicate Governance

- Uniqueness gate per page-type contract (min unique data fields / min sample size).
- Canonical + `noindex` policy for near-duplicates.
- Programmatic diff check: two pages of the same type must differ beyond entity name in ≥ N data fields or the lower-value one is suppressed.
- Ties into existing `docs/seo-content-quality.md` and `docs/seo-indexability-rules.md`.

## 2.5 Future Expansion

International/country/operator scalability is *built into the cluster model* — adding a country or operator instantiates a governed sub-tree, not bespoke pages. This is the primary international-scale lever.

---

# PHASE 3 — Affiliate Intelligence

**Thesis:** Build the world's best affiliate layer by making the affiliate handoff a *consequence of evidence*, not an interruption of it. Conversion is maximized by trust, not by pressure.

## 3.1 Architecture

Affiliate Intelligence is a **decision-support + routing layer** that reads the operator registry, availability archive, and country context, and surfaces the *right operator at the right moment* with full transparency. It never biases the evidence or the prediction.

- Strict separation: **evidence/prediction layer** (unbiased) ⟂ **operator layer** (commercial). The operator layer consumes predictions; it never influences them.
- Builds on existing `docs/affiliate-*.md`, `operator-*.md`.

## 3.2 Milestones

### AF-1 · Operator Intelligence Hub
- **Purpose:** Evidence-style, honest operator profiles (availability quality, pricing competitiveness, payment methods, licensing).
- **Dependencies:** Operator registry, availability archive; Phase 2 SE-2.
- **SEO impact:** Very high — "best betting sites for X" is the highest-commercial-intent query class.
- **Affiliate impact:** Very high (primary conversion surface).
- **User value:** Trustworthy operator selection.
- **Complexity:** M
- **Moat:** Availability *history* + evidence-linked context, not paid rankings.
- **Risks:** Must resist pay-for-placement bias → publish ranking methodology (transparency).
- **Roadmap position:** After Phase 2 SE-2.

### AF-2 · Country Intelligence
- **Purpose:** Per-country legal status, available operators, payment norms, regional market preferences, responsible-gambling resources.
- **Dependencies:** SE-1; geo/country detection.
- **SEO impact:** Very high (localized commercial intent) + international scalability.
- **Affiliate impact:** Very high (regionally-correct operators convert far better).
- **User value:** "What's legal and available *here*."
- **Complexity:** M
- **Moat:** Depth of per-country operator + regulatory data.
- **Risks:** Regulatory accuracy/liability → sourced, dated, reviewed; responsible-gambling first.
- **Roadmap position:** After SE-1; pairs with AF-1.

### AF-3 · Operator Comparison Engine
- **Purpose:** Deterministic, transparent operator comparisons (by market, country, feature).
- **Dependencies:** AF-1; RP-8 comparison primitive.
- **SEO impact:** High ("operator A vs operator B").
- **Affiliate impact:** Very high (comparison = high purchase intent).
- **Complexity:** M
- **Moat:** Methodology transparency + availability history.
- **Roadmap position:** After AF-1.

### AF-4 · Availability & Freshness Intelligence
- **Purpose:** Which operators actually offer a given market/fixture, how fresh their pricing is.
- **Dependencies:** Availability archive, odds freshness.
- **SEO impact:** Medium.
- **Affiliate impact:** Very high — never send a user to an operator lacking the market (protects conversion + trust).
- **Complexity:** M
- **Moat:** Requires the availability time-series.
- **Roadmap position:** After AF-1.

### AF-5 · Bonuses & Payment Methods
- **Purpose:** Structured, dated bonus/payment data per operator×country.
- **Dependencies:** AF-1/AF-2.
- **SEO impact:** High (commercial intent).
- **Affiliate impact:** Very high.
- **Complexity:** M
- **Risks:** Data freshness + compliance → dated, sourced, expiry-aware.
- **Roadmap position:** After AF-1/AF-2.

### AF-6 · Responsible Gambling Layer
- **Purpose:** Prominent, genuine responsible-gambling tooling and content woven throughout.
- **Dependencies:** None hard; policy-level.
- **SEO impact:** Medium but **major EEAT/trust signal** (and often required for compliance/indexing in regulated markets).
- **Affiliate impact:** Neutral-to-positive (trust; regulatory durability).
- **Complexity:** S-M
- **Moat:** Cultural — genuine RG posture is rare among affiliates and protects long-term domain trust.
- **Roadmap position:** Should accompany AF-1 from the start (non-negotiable framing).

### AF-7 · Conversion Optimization (trust-preserving)
- **Purpose:** Natural CTA positioning at evidence-justified decision points; A/B via the existing experimentation platform.
- **Dependencies:** All AF-*; experimentation platform.
- **SEO impact:** Neutral.
- **Affiliate impact:** Very high (the direct FTD lever).
- **Complexity:** M
- **Risks:** Over-optimization erodes trust → hard guardrails: CTAs only where evidence supports them; measure trust metrics alongside conversion.
- **Roadmap position:** After AF-1…AF-5.

## 3.3 Why hard to copy
The affiliate layer's power comes from being *fed by* the evidence + availability + country archives. A pure affiliate site has the CTAs but not the substrate that makes them credible and correctly targeted.

---

# PHASE 4 — AI Intelligence Layer (extends existing AI-1…AI-10)

**Thesis:** This phase *extends* the already-recorded `[[ai-intelligence-layer-roadmap]]`. It does not replace or reorder it. The governing law is unchanged: **LLM never creates picks; evidence is authoritative; AI explains; evidence decides.**

> This phase inherits every principle from the existing AI roadmap. `AIX-` items are extensions/clarifications layered on the Research + SEO + Knowledge-Graph substrate built in Phases 1–3/5.

### AIX-1 · AI Ranking Engine (extends AI-1)
- **Purpose:** Deterministic, explainable ranking of qualified candidates (prediction/confidence/risk/value/reliability scores).
- **Dependencies:** Phase 1 projection; qualification engine.
- **Complexity:** L
- **Moat:** Deterministic + reproducible ranking, not vibes.
- **Risk (critical):** Scores stay **explanation-layer only** — never in evidence identity unless versioned per M5/M6. **Guardrail carried from `[[ai-intelligence-layer-roadmap]]`.**
- **Roadmap position:** Entry of Phase 4; after Phase 1.

### AIX-2 · Bet of the Day (extends AI-2)
- **Purpose:** ≤1 daily pick; emits **"No qualified Bet of the Day"** when confidence is insufficient.
- **SEO impact:** Very high (daily fresh, high-intent).
- **Affiliate impact:** Very high.
- **Moat:** Willingness to say "none today" — un-copyable trust posture.
- **Roadmap position:** After AIX-1.

### AIX-3 · AI Acca (extends AI-4)
- **Purpose:** Safe + Balanced accumulators, correlation-aware, evidence- and odds-bounded, operator-availability-aware.
- **Dependencies:** Acca Studio (current roadmap), AIX-1, AF-4.
- **Affiliate impact:** Very high (accas convert strongly).
- **Moat:** Correlation avoidance + evidence thresholds + availability = quality no tipster matches.
- **Roadmap position:** After AIX-1 + Acca Studio.

### AIX-4 · Match Insights & Explainability (extends AI-3/AI-5)
- **Purpose:** Natural-language explanation generated **after** deterministic selection; every claim cites a signal.
- **Dependencies:** RP-1/RP-2; AIX-1.
- **SEO impact:** High (readable analysis at scale) — *if* uniqueness-gated to avoid duplicate explanations.
- **Moat:** Grounded in reproducible evidence; refuses to explain what it can't source.
- **Risk:** Hallucination / duplicate explanations → strict grounding + uniqueness gate + human-review sampling.
- **Roadmap position:** After AIX-1 + Phase 1.

### AIX-5 · Confidence & Historical Similarity (extends AI-5)
- **Purpose:** Surface confidence + "resembles these past validated matches" (from RP-6).
- **Dependencies:** RP-6; calibration data (Phase 6).
- **Moat:** Needs validated corpus + calibration.
- **Roadmap position:** After RP-6.

### AIX-6 · "Why Not" (AI narration; extends AI-7)
- **Purpose:** AI narrates the deterministic rejection reasons from RP-9.
- **Dependencies:** RP-9.
- **SEO impact:** Very high (inexhaustible unique content).
- **Moat:** Requires deterministic rejection logging underneath.
- **Roadmap position:** After RP-9 + AIX-4.

### AIX-7 · Performance Dashboard (AI; extends AI-6)
- **Purpose:** Measurable AI performance (accuracy, ROI, calibration, drift). **Overlaps Phase 6** — implement the AI-specific slice on Phase 6's transparency substrate.
- **Dependencies:** Phase 6 transparency platform.
- **Roadmap position:** After Phase 6 TP-1..TP-4.

### AIX-8 · League Models / AIX-9 · Market Models (extends AI-8/AI-9)
- **Purpose:** Per-league and per-market specialized ranking models.
- **Dependencies:** RP-4/RP-5; large validated per-segment history; ML readiness.
- **Complexity:** XL
- **Moat:** Segment-specific validated data + calibration; deepest part of the moat.
- **Roadmap position:** Late Phase 4; after AIX-1 and Phase 6.

### AIX-10 · Operator Intelligence (AI; extends AI-10)
- **Purpose:** AI-assisted operator value/availability insights — **without introducing bookmaker bias**.
- **Dependencies:** Phase 3 (AF-*).
- **Roadmap position:** After Phase 3 + AIX-1.

### AIX-11 · Future ML Evolution
- **Purpose:** The documented progression: weighted deterministic scoring → historical calibration → feature engineering → offline model training → league/market models → continuous evaluation. **LLMs remain explanation layers; prediction authority stays measurable and reproducible.**
- **Dependencies:** Everything; Phase 6 calibration is the training-label source.
- **Complexity:** XL
- **Roadmap position:** Continuous, latest phase; never gates earlier work.

---

# PHASE 5 — Knowledge Graph

**Thesis:** Formalize the entity/relationship model seeded in Phase 1 into a complete football knowledge graph. This is the structural backbone that makes the whole platform machine-readable, internally coherent, and **AI-ready** (grounding source for the AI layer) — and it is a massive SEO structured-data play.

## 5.1 Entity & Relationship Model

**Entities:** Competition, Season, Fixture, Team, Player, Operator, Country, Market, Prediction, Evidence, Validation, Settlement, Archive, Statistic.

**Core relationships (illustrative):**

```
Country ──hosts──► Competition ──has──► Season ──contains──► Fixture
   │                                                          │
   │                                            plays─────────┤
   ▼                                                          ▼
 Operator ──prices──► Market ◄──applies_to── Fixture ──has──► Evidence
   │                    │                       │              │
 available_in        predicted_by            resolved_by    derived_from
   ▼                    ▼                       ▼              ▼
 Country            Prediction ──validated_by──► Validation ─settled_by─► Settlement
                        │                                                    │
                    explained_by (AI)                                   archived_in
                        ▼                                                    ▼
                    Statistic ◄──describes── Team/Player                 Archive
```

## 5.2 Milestones

### KG-1 · Entity Registry & Canonical IDs
- **Purpose:** Single source of canonical entity IDs + URLs (dedupes Phase 1's implicit keys).
- **Dependencies:** Phase 1.
- **SEO impact:** High (canonicalization, disambiguation).
- **Complexity:** L
- **Moat:** Clean entity resolution over years of data.
- **Roadmap position:** Phase 5 entry; can begin conceptually alongside late Phase 1.

### KG-2 · Relationship Graph & Structured Data (Schema.org)
- **Purpose:** Emit structured data (JSON-LD) for every entity/relationship; internal links follow graph edges.
- **Dependencies:** KG-1; Phase 2 pages.
- **SEO impact:** Very high — rich results, entity recognition by search engines, knowledge-panel eligibility.
- **Complexity:** L
- **Moat:** Depth + correctness of relationships grounded in real data.
- **Roadmap position:** After KG-1.

### KG-3 · Graph-Driven Internal Linking
- **Purpose:** Replace heuristic linking (Phase 2) with graph-edge-driven links (provably relevant, no orphan pages).
- **Dependencies:** KG-2.
- **SEO impact:** Very high (authority flow, crawl efficiency, zero orphans).
- **Complexity:** M
- **Roadmap position:** After KG-2.

### KG-4 · Public Knowledge Graph Surface / API
- **Purpose:** Browsable graph + (later) a queryable API — a Transfermarkt-/Wikipedia-like reference surface.
- **Dependencies:** KG-1..KG-3.
- **SEO impact:** High + **major backlink magnet** (developers, researchers cite it).
- **Affiliate impact:** Low direct, high authority.
- **Complexity:** L
- **Moat:** The only football graph grounded in reproducible betting evidence.
- **Roadmap position:** Late Phase 5.

## 5.3 Why it improves SEO
Structured data + a coherent internal graph is how search engines build *entity understanding*. It turns a large site into a recognized *authority on a topic* rather than a pile of pages, and makes RankWagers a candidate for knowledge panels and AI-answer citations.

---

# PHASE 6 — Transparency Platform

**Thesis:** Build the pages that almost no betting site dares to: public, measurable, honest performance. Transparency is simultaneously the top EEAT signal, the biggest trust/retention driver, and a unique programmatic-SEO surface. This phase is also the **calibration/label source** that feeds Phase 4 ML.

## 6.1 Milestones (shared profile; distinctive ones noted)

| ID | Page | SEO | Affiliate | EEAT | Complexity |
|---|---|---|---|---|---|
| **TP-1** | Historical Accuracy | High | Med | Very high | M |
| **TP-2** | ROI / Yield | High | Med | Very high | M |
| **TP-3** | Confidence Calibration | Med | Low | Very high | L |
| **TP-4** | Prediction Distribution | Med | Low | High | M |
| **TP-5** | Market Performance | High | Med | Very high | M |
| **TP-6** | League Performance | High | Med | Very high | M |
| **TP-7** | Rejected Predictions (aggregate) | Very high | Low | Very high | M |
| **TP-8** | Evidence History | Med | Low | Very high | M |
| **TP-9** | Model Drift | Med | Low | Very high | L |
| **TP-10** | Operator Availability History | Med | High | High | M |

### TP-1/TP-2 · Historical Accuracy & ROI (foundation)
- **Purpose:** Public, always-current accuracy/ROI/yield, sliceable by league/market/time.
- **Dependencies:** Settlement history, Prediction Archive (current roadmap Accuracy/ROI dashboards are the *internal* version; TP-1/2 are the *public, SEO-optimized* version).
- **SEO impact:** High + **backlink magnet** (cited as evidence).
- **Affiliate impact:** Medium (trust → conversion).
- **EEAT:** The single strongest trust asset.
- **Moat:** Requires real, long, immutable settled history — impossible to fake, impossible for new entrants.
- **Risks:** Publishing bad periods → that's the point; framing + methodology transparency.
- **Roadmap position:** Phase 6 entry; after current Accuracy/ROI internal dashboards.

### TP-3 · Confidence Calibration
- **Purpose:** "When we say 70%, does it happen ~70% of the time?" — reliability diagrams.
- **Dependencies:** Large settled sample (ties to calibration sample gates in `docs/calibration-sample-gates.md`).
- **Moat:** Statistically serious; essentially unheard-of in the affiliate space.
- **Extensibility:** Direct feedback signal into AIX-1 scoring and AIX-11 ML.
- **Roadmap position:** After TP-1/TP-2.

### TP-7 · Rejected Predictions (aggregate)
- **Purpose:** Site-wide view of what we *declined* and why — the aggregate of RP-9/AIX-6.
- **SEO impact:** Very high (unique, inexhaustible).
- **Moat:** Requires deterministic rejection logging + the willingness to publish restraint.
- **Roadmap position:** After RP-9 + TP-1.

### TP-9 · Model Drift
- **Purpose:** Track performance drift over time per model/segment.
- **Dependencies:** TP-3; AIX-8/9.
- **Extensibility:** Operational signal for ML retraining (AIX-11).
- **Roadmap position:** Late Phase 6; pairs with Phase 4 models.

## 6.2 Principle
**Everything measurable, everything reproducible from the archive.** No transparency page may show a number that can't be regenerated from hashed evidence + settlement. This is what separates us from "we won 90% last week" tipsters.

---

# PHASE 7 — Live Intelligence (architecture only)

**Thesis:** Extend the evidence philosophy into the live match. **Architecture only — no implementation, ever, in this document.** Builds on `docs/live-match-architecture.md`.

## 7.1 Architecture sketch

```
 Live data feed ──► Live Evidence Snapshotter (append-only, hashed like M6)
                         │
                         ▼
             Live signal derivation (deterministic)
              momentum · pressure · xG · dangerous attacks
                         │
                         ▼
        Live Evidence Timeline (extends RP-7)  ──► Live Explanation (AI, post-derivation)
                         │
                         ▼
          Signal-change / evidence-change events (immutable log)
```

## 7.2 Milestones (architecture placeholders)

| ID | Item | Note |
|---|---|---|
| **LI-1** | Live Momentum / Pressure | Deterministic signals from live feed |
| **LI-2** | Live xG / Dangerous Attacks | Feed-derived, hashed snapshots |
| **LI-3** | Live Evidence Timeline | Extends RP-7 into in-play |
| **LI-4** | Live Evidence/Signal Change Log | Immutable, replayable |
| **LI-5** | Live Explanation | AI narrates *after* deterministic derivation |

- **Purpose:** In-play version of the whole evidence philosophy.
- **Dependencies:** Phases 1, 4, 5, 6; live data infrastructure; mature evidence pipeline.
- **SEO impact:** Medium (live is engagement/retention, less indexable).
- **Affiliate impact:** Very high (in-play betting converts strongly) — but only with trust-preserving, non-manipulative framing.
- **User value / retention:** Highest retention driver — reason to return during matches.
- **Complexity:** XL
- **Moat:** Live *immutable, hashed, replayable* evidence is extraordinarily hard to build correctly.
- **Risks:** Latency, cost, responsible-gambling sensitivity of in-play → strongest RG guardrails apply; architecture only for now.
- **Roadmap position:** Latest concrete phase; after 1/4/5/6.

---

# PHASE 8 — Future Expansion (blue-sky, evidence-driven)

**Thesis:** Ideas from outside the betting-affiliate frame — think Bloomberg/Stripe/Athletic/Transfermarkt/Wikipedia/GitHub/OpenAI. Prioritized for backlinks, organic traffic, EEAT, authority, returning visitors, difficulty-to-copy, evidence-grounding, and international scale.

Each is a seed, not a commitment. Profiles kept tight.

### FX-1 · Public Evidence API / Data Platform (the "Stripe/GitHub" move)
- **Purpose:** Documented, versioned API over the knowledge graph + evidence archive; embeddable widgets.
- **SEO/authority:** Massive **backlink + citation** engine; developers integrate and link back.
- **Affiliate:** Indirect (reach).
- **Moat:** Only possible atop a clean graph + reproducible archive.
- **Risks:** Abuse/scraping, cost → rate-limits, tiers.
- **Position:** After Phase 5 (KG-4).

### FX-2 · Football Intelligence Encyclopedia (the "Wikipedia/Transfermarkt" move)
- **Purpose:** Definitive, evidence-linked reference entries for entities (teams, competitions, concepts, metrics).
- **SEO/authority:** Enormous evergreen topical authority + backlinks.
- **Moat:** Grounded in our data, cross-linked to live evidence — richer than static references.
- **Position:** After Phase 5.

### FX-3 · Methodology & Research Publications (the "Athletic/arXiv" move)
- **Purpose:** Long-form, dated, authored methodology and retrospective studies ("how our BTTS model performed across 3 seasons").
- **SEO/EEAT:** Top-tier EEAT (named authors, methodology, citations); backlink magnet.
- **Moat:** Requires real data + real results to be credible.
- **Position:** After Phase 6 (needs measurable history).

### FX-4 · Prediction Reproducibility / Verification Portal (the "trust ledger")
- **Purpose:** Anyone can independently verify a past prediction from its hashed inputs — a public "audit this pick" tool.
- **EEAT:** Unmatched — verifiable, not asserted, transparency.
- **Moat:** Only possible with content-hashed reproducible evidence (our core architecture).
- **Position:** After Phase 5/6.

### FX-5 · Personalized Research Workspace (the "Bloomberg Terminal" move)
- **Purpose:** Logged-in power-user workspace: watchlists, saved comparisons, alerts, personal accuracy tracking.
- **Retention:** Highest returning-visitor driver.
- **Affiliate:** High (engaged users convert).
- **Moat:** Depth of underlying data.
- **Risks:** Auth/privacy scope; keep evidence public, personalize the *view*.
- **Position:** After Phases 1–3.

### FX-6 · Community Evidence Layer (moderated, the "GitHub/Stack Overflow" move)
- **Purpose:** Let expert users annotate/discuss evidence (moderated, reputation-gated) — user-generated but *evidence-anchored*.
- **SEO:** High (fresh, long-tail, UGC scale).
- **Moat:** Community + evidence substrate.
- **Risks:** Moderation, quality, spam → reputation gates, evidence-anchored only, no free-form tips.
- **Position:** Later; after strong core authority.

### FX-7 · Multi-Sport / Multi-Language Expansion Framework
- **Purpose:** Generalize the evidence+graph+SEO engine to new languages/regions and (eventually) sports.
- **Scale:** The primary international/country-scalability lever at platform level.
- **Moat:** The engine, once general, is a repeatable authority machine.
- **Position:** After the football platform is dominant; latest.

### FX-8 · AI Answer / Assistant Grounded in the Graph
- **Purpose:** A conversational research assistant that answers *only* from the knowledge graph + evidence, always citing sources, never inventing picks.
- **AI readiness:** This is the payoff of Phases 4 + 5 — the graph is the grounding store.
- **Moat:** Grounded, citable, reproducible answers vs. generic LLM hallucination.
- **Position:** After Phases 4 + 5.

---

# 9. Cross-Cutting Concerns (apply to all phases)

- **International/country/operator scalability:** built into the Phase 2 cluster model + Phase 5 entity registry; adding a country/operator/language instantiates governed sub-trees, not bespoke work.
- **AI/ML readiness:** Phase 5 graph = grounding store; Phase 6 calibration = training labels; Phase 1 similarity = feature vectors. The platform becomes ML-ready as a *byproduct* of doing transparency well.
- **EEAT:** authored methodology (FX-3), transparency (Phase 6), responsible gambling (AF-6), reproducibility (FX-4) — layered, not bolted on.
- **Responsible gambling:** first-class throughout, especially Phases 3 and 7; a durability and trust requirement, not a footer.
- **Governance:** every programmatic surface obeys the uniqueness gate; every derived score obeys the evidence-identity firewall.

---

# 10. Dependency Graph

The current roadmap is a **locked prefix**. Nothing below begins until it fully completes. Arrows = "must come after."

```
════════════════════════ LOCKED — CURRENT ROADMAP (UNCHANGED) ════════════════════════
 M1 … M10  →  Production Activation  →  Evidence Capture · Settlement · Accuracy · ROI
          →  Prediction Archive  →  Acca Studio  →  SEO roadmap
═══════════════════════════════════════ ▼ ════════════════════════════════════════════
                        [ current roadmap COMPLETE + explicit authorization ]
                                          │
        ┌─────────────────────────────────┴───────────────────────────────┐
        ▼                                                                   
   PHASE 1 — Research Platform                                              
     RP-1 ─┬─► RP-2 ─┐                                                      
           ├─► RP-3 ─┼─► RP-4 ─► RP-5                                       
           ├─► RP-9 (early, cheap, high-trust)                             
           ├─► RP-7                                                         
           └─► RP-6 ─► RP-8 ─► RP-10                                        
        │        │                                                         
        │        └──────────────► seeds entity keys ──────────┐           
        ▼                                                      ▼           
   PHASE 2 — SEO Expansion                              PHASE 5 — Knowledge Graph
     SE-1..SE-10 (hub/spoke clusters)                    KG-1 ─► KG-2 ─► KG-3 ─► KG-4
        │        │                                            │        │
        ▼        └──────────────► KG-3 supersedes SE heuristic linking
   PHASE 3 — Affiliate Intelligence                          │
     AF-6 (from start) · AF-1 ─► AF-3                        │
     AF-1 ─► AF-4/AF-5 ;  AF-2 ◄─ SE-1 ;  AF-* ─► AF-7      │
        │                                                    │
        ▼                                                    ▼
   PHASE 4 — AI Intelligence Layer (extends AI-1…AI-10)      │
     AIX-1 ─┬─► AIX-2                                        │
            ├─► AIX-3 (needs Acca Studio)                    │
            ├─► AIX-4 ─► AIX-6 (needs RP-9)                  │
            ├─► AIX-5 (needs RP-6)                           │
            ├─► AIX-10 (needs Phase 3)                       │
            └─► AIX-8/AIX-9 ─► AIX-11 (needs Phase 6) ◄──────┤
        │                                                    │
        ▼                                                    │
   PHASE 6 — Transparency Platform  ◄── feeds AIX-7, AIX-11, TP-3 calibration
     TP-1/TP-2 ─► TP-3 ─► TP-9 ; TP-7 (needs RP-9) ; TP-5/6 (needs RP-4/5)
        │
        ▼
   PHASE 7 — Live Intelligence (architecture only)  ◄── needs Phases 1,4,5,6
     LI-1..LI-5
        │
        ▼
   PHASE 8 — Future Expansion (blue-sky)
     FX-1/FX-2/FX-4 (need Phase 5) · FX-3 (needs Phase 6) · FX-8 (needs Phases 4+5)
     FX-5 (needs Phases 1–3) · FX-6 (later) · FX-7 (latest, multi-region/sport)
```

## 10.1 Suggested sequencing summary

| Order | Block | Gated by | Rationale |
|---|---|---|---|
| 0 | **Current roadmap** | — | Absolute priority; unchanged |
| 1 | Phase 1 Research | roadmap complete | Substrate + EEAT engine; cheap trust wins (RP-9) first |
| 2 | Phase 2 SEO + Phase 5 KG-1/2 (parallel-eligible) | Phase 1 | Scale + structure the substrate |
| 3 | Phase 3 Affiliate | Phase 2 (SE-1/2) | Monetize the traffic, trust-first |
| 4 | Phase 5 KG-3/4 | Phase 2 | Graph-driven linking + public graph |
| 5 | Phase 4 AI (extends existing AI roadmap) | Phases 1,3,5 + Acca Studio | Narrate + rank on top of substrate |
| 6 | Phase 6 Transparency | Accuracy/ROI + settled history | Trust peak + ML label source |
| 7 | Phase 7 Live (arch only) | Phases 1,4,5,6 | Extend evidence to in-play |
| 8 | Phase 8 Future | varies | Blue-sky, authority/backlink moats |

**Note on parallelism:** Phases can overlap where dependencies allow (e.g., Phase 2 and KG-1/KG-2), but *none* may pull resources from the current roadmap, and *none* may start before it completes.

---

# 11. What this document does NOT do

- Does **not** modify, reorder, or delay the current roadmap or any existing milestone.
- Does **not** implement, spec-for-build, or schedule anything.
- Does **not** change any contract, identity, hash, format, or frozen boundary.
- Does **not** authorize coding.

It is a decade-horizon strategy for becoming **the global reference platform for football intelligence** — evidence-first, transparent, reproducible, and monetized through trust rather than pressure.

> **Amendment (2026-07-31):** A new dependent, off-critical-path initiative — **Content Versioning & Historical Publishing (CVHP)** — is added in `docs/plans/content-versioning-historical-publishing.md`. It immutably versions RankWagers' *own editorial content* as a fourth artifact class under the existing immutability/provenance substrate (merged with K0-2, K0-3/N1, N5, N6, FX-3 — not a new system). It sits after Phase 0 + PostgreSQL persistence, pairs with N6, and **does not reorder or delay any existing milestone, M10, PostgreSQL persistence, or FPI**. See the architecture review §10 for the merge map.

_Related: `docs/plans/content-versioning-historical-publishing.md`, `docs/plans/long-term-product-vision-architecture-review.md`, `docs/plans/ai-intelligence-layer-roadmap.md`, `docs/next-sprints.md`, `docs/seo-page-type-contracts.md`, `docs/seo-url-lifecycle.md`, `[[sprint-23b-m10-closure]]`._
