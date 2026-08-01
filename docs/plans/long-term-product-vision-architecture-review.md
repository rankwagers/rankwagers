# Long-Term Product Vision — Architecture Review & Strengthened Strategy

> **Status: VISION / STRATEGY REVIEW ONLY — NOT STARTED, NOT AUTHORIZED FOR IMPLEMENTATION.**
> **Authored:** 2026-07-31
> **Reviews:** `docs/plans/long-term-product-vision.md` (v1)
> **Nature:** CPO-level architecture review. Challenges, cuts, strengthens, resequences the v1 roadmap and adds acquisition-grade capabilities. No code, no contract changes, no modification to the current roadmap.

---

## 0. The Firewall (unchanged)

The current roadmap remains the absolute priority, unchanged and unreordered: M1–M10 → production activation → Evidence Capture / Settlement / Accuracy / ROI → Prediction Archive → Acca Studio → SEO roadmap. Everything below is downstream of `[[sprint-23b-m10-closure]]` + explicit authorization. This document only strengthens the *post-roadmap* vision.

This review was grounded in a read-only audit of the actual codebase (three parallel explorations of persistence/retention, SEO infrastructure, and affiliate/transparency data models). Findings are cited with file paths so nobody re-derives them.

---

## 1. Executive Summary — the central reframe

**v1's implicit premise was wrong in a way that makes the real opportunity bigger.** v1 read like a greenfield build: "build a Research Platform, build a programmatic SEO system, build a knowledge graph, build a transparency platform." The audit shows that **RankWagers has already built 60–70% of that substrate internally** — it is mature, principled, and quality-gated. The three things that are actually missing are small, specific, and high-leverage.

> **The decade-defining strategy is not "build new intelligence." It is: (a) fix three keystone integrity gaps, then (b) safely publish the intelligence that already exists, at scale, with reproducibility guarantees no competitor can fake.**

This reframe is *stronger* than v1, not weaker: it means the moat is closer than assumed, the work is more defensible (publishing verifiable existing data beats generating new claims), and the sequencing risk drops dramatically.

Three consequences drive the whole revised roadmap:

1. **A new Phase 0 (Foundational Integrity) is mandatory and must come first.** Three keystones — the append-only **odds log**, **publication-snapshot immutability**, and a **provenance/lineage ledger** — gate almost every public-facing milestone. v1 buried these; they are the critical path.
2. **Phase 2 (SEO) and Phase 5 (Knowledge Graph) as written are largely redundant with shipped systems** (`lib/seo-intelligence/*`, `lib/knowledge-graph/graph.ts`) and Phase 2 partially *contradicts* a standing architectural decision ("no mass PSEO"). Both are re-scoped to *extend*, not *rebuild*.
3. **The single most defensible capability in the entire vision — a public "verify this prediction from its hashed inputs" portal — was hidden at the bottom of Phase 8.** It is promoted to a flagship, because the immutable content-hashed evidence architecture (M6/M8) is precisely what makes it possible and un-copyable. This is the capability a Bloomberg/OpenAI acquirer would expect to already exist.

---

## 2. Ground Truth — what is already built (the surprise)

| Capability | v1 assumed | Reality (audited) | Verdict |
|---|---|---|---|
| Immutable evidence archive | to be leveraged | **Built** — NDJSON append-only, sha256 content-hashed, deep-frozen, no TTL, `immutable_violation` admission rule (`lib/archive/evidence/file.ts`, `store.ts`) | ✅ safe to publish permanently |
| Public evidence rendering | Phase 1 (RP-1/RP-7) | **Partly built** — fixture pages render evidence history; read-only evidence API (`noindex`) + `Dataset` JSON-LD (`lib/archive/evidence/api.ts`) | Reframe: *extend*, not build |
| Prediction archive (public) | Phase 2 (SE-10) | **Built** — `/{locale}/archive` + `/archive/{date}`, indexable at settled≥3 (`app/[locale]/archive/*`) | Reframe: *harden + enrich* |
| Programmatic SEO engine | Phase 2 (build new) | **Built & mature** — 32 page-type contracts, deterministic indexability engine w/ reason codes, 100-pt content-quality scorer, thin-content gates (`lib/seo-intelligence/*`, Sprint 22) | ⚠️ Re-scope; do NOT rebuild |
| "No mass PSEO" governance | (unaware) | **Explicit standing decision** — mass template PSEO is out-of-scope by design (`docs/search-discovery.md`, `seo-discovery.md`) | ❗ Phase 2 must respect this |
| Hub-and-spoke internal linking | Phase 2 (build new) | **Built** — data-driven, graph+discovery sourced, orphan detection, `balanceSurfaces` (`lib/crawl-quality/links.ts`, `lib/seo-intelligence/internal-links.ts`) | ✅ extend only |
| Knowledge graph | Phase 5 (build new) | **Partly built** — `lib/knowledge-graph/graph.ts` drives linking + discovery; 11 Schema.org types emitted | Re-scope to graph *enrichment* + public surface |
| 31-locale i18n + hreflang | Phase 8 (FX-7) | **Built** — 31 locales, x-default rules, per-locale canonical (`lib/i18n.ts`, `lib/crawl-quality/hreflang.ts`) | International scale mostly solved |
| Operator registry + country ordering | Phase 3 (build new) | **Built** — brand/operator models w/ country, payments, licenses, bonuses; country-driven ordering (`lib/operators/*`, `lib/brands.ts`, `lib/personalization/ranking.ts`) | Reframe: *publicize + time-series* |
| Availability decision engine | Phase 3 (AF-4) | **Built (observation-only)** — 6-state matrix, freshness states (`lib/affiliate-intelligence/*`, `lib/combo/operator-availability.ts`) | Gap = *time-series capture* |
| Affiliate attribution + deeplinks + postbacks | Phase 3 | **Built (dormant)** — signed-context attribution, deeplink registry, 13 postback adapters all `not_configured` (`lib/affiliate/postbacks/*`) | Gap = *activate*, not build |
| Calibration/accuracy engine | Phase 6 (build new) | **Built (admin-only)** — Brier/log-loss/ECE/MCE, confidence bands, sample gates INSUFFICIENT→RELIABLE (`lib/calibration-intelligence/*`, `docs/calibration-*.md`) | Reframe: *make public, gated* |
| Public transparency pages | Phase 6 | **Partly built** — archive hub + methodology page live; honesty contracts enforced (`docs/transparency.md`) | Extend |
| ROI / yield / CLV | Phase 6 (TP-2) | **Blocked** — `originalOdds`/`unitProfit` are `null` platform-wide; **no append-only odds log exists** | ❗ Keystone gap (Phase 0) |
| Daily-archive immutability | (unaware) | **Broken** — daily-archive JSON is overwrite-mutable; calibration flags `PUBLICATION_SNAPSHOT_MUTABLE` | ❗ Keystone gap (Phase 0) |

**Strategic implication:** the platform is much closer to the moat than v1 implied, but it is gated by three integrity keystones and a governance philosophy that forbids the naïve version of Phase 2.

---

## 3. Phase 0 — Foundational Integrity (NEW, mandatory, critical path)

These are not features; they are the load-bearing pre-conditions for *every* public-facing claim in Phases 2, 3, 6, and 8. v1 scattered them as sub-bullets or omitted them. They are now their own phase and come first.

### K0-1 · Append-only Odds Log (keystone)
- **Purpose:** Durable, immutable, timestamped odds capture per fixture/market/operator, joined to predictions at publication time.
- **Why critical:** Unlocks **ROI, yield, CLV, unit P/L, Acca ROI, value scoring** — all currently `null` platform-wide. Without it, half of Phase 6 and AIX value scoring literally cannot exist without fabrication (which the honesty contracts forbid).
- **Grounding:** `odds_history` Postgres table exists (`db/migrations/20260724_create_odds_history.sql`) but is not joined to `daily-archives`; M3 odds-archive exists in the evidence pipeline. **Reconcile these two odds surfaces** — this is a real, undecided architectural fork (evidence-pipeline M3 odds-archive vs. `odds_history` table). Pick one system of record; do not maintain two divergent odds truths.
- **Dependencies:** Current roadmap (M3 odds-archive activation).
- **Complexity:** L. **Moat:** CLV history is the metric sharp users and acquirers respect most; needs years of it. **Risk:** dual-odds-source divergence → resolve before publishing any ROI number.
- **Position:** Phase 0, first. Gates TP-2, AIX value scoring, N2 (CLV), AF CLV story.

### K0-2 · Publication-Snapshot Immutability (keystone)
- **Purpose:** Freeze prediction publication state at publish time; settlements append, never overwrite. Fix the `PUBLICATION_SNAPSHOT_MUTABLE` defect.
- **Why critical:** Today `data/daily-archives/*.json` is **overwrite-mutable on re-save**. Any permanent public page citing "we predicted X on date D" can be silently, retroactively changed. That destroys the entire transparency/EEAT thesis and makes calibration cohorts unreliable. This is the highest-leverage integrity fix in the roadmap.
- **Grounding:** `docs/archive.md` (mutable-on-re-save), calibration `PUBLICATION_SNAPSHOT_MUTABLE` issue, evidence archive already proves the correct pattern (append-only + content-hash).
- **Dependencies:** None hard — apply the evidence-archive immutability pattern to the prediction archive.
- **Complexity:** M. **Moat:** verifiable, tamper-evident prediction history — impossible for late entrants to fabricate. **Risk:** must preserve backward compatibility with existing archive readers.
- **Position:** Phase 0, first. Gates *all* permanent public archive/transparency pages (SE-10, RP-10, TP-*, N5, FX-4).

### K0-3 · Provenance / Lineage Ledger (NEW — acquisition-grade)
- **Purpose:** Every published number (a prediction, a ROI figure, an accuracy stat) carries a lineage: which hashed evidence snapshot, which `modelVersion`, which odds records, which settlement produced it — reproducibly.
- **Why critical:** This is what a Bloomberg/Google/OpenAI due-diligence team would demand on day one: "prove any number on your site traces to immutable inputs." It also makes the whole platform **AI-grounding-ready** and is the substrate for the Verification Portal (N5) and provenance-based Schema.org.
- **Grounding:** M5/M7 already model `inputContentHash` + `modelVersion` identity (`[[m5-evidence-model-migration-review]]`, `[[m7-historical-input-identity-failure-review-v2]]`). This extends that identity into a *published-artifact* lineage, without changing frozen identity.
- **Dependencies:** K0-1, K0-2; M5/M7 identity.
- **Complexity:** L. **Moat:** the deepest one — reproducible lineage over years of immutable data cannot be retrofitted by a competitor. **Risk:** must stay *out* of evidence identity (a lineage index over hashes, not a new hashed field) — respects the M5/M6 firewall.
- **Position:** Phase 0, after K0-1/K0-2; foundational to N5/FX-4 and AI grounding.

---

## 4. Per-Phase Challenge & Verdict

Legend: **KEEP** / **STRENGTHEN** / **RESEQUENCE** / **MERGE** / **CUT** / **RE-SCOPE**.

### Phase 1 — Research Platform → **KEEP, but RE-SCOPE to "extend existing public surfaces"**
- The read-only projection architecture is sound and correct. But RP-1 (fixture research) and RP-7 (evidence timeline) **partly exist already** (fixture pages render evidence history + odds timelines + `Dataset` JSON-LD). Re-scope RP-1/RP-7 from "build" to "consolidate + deepen the existing fixture surface."
- **RP-8 Interactive Match Comparison → MERGE / mostly CUT.** Compare pages already exist (`/compare/{slug}`, allowlist-gated). Do not build a parallel comparison engine; extend the allowlist + templates. Low marginal value as a standalone milestone.
- **RP-9 "Why Not" → STRENGTHEN + RESEQUENCE earlier.** This is the single highest-trust, lowest-cost, most-unique item and it reuses existing rejection-reason diagnostics. Promote it to the *first* Phase 1 deliverable after RP-1. It is inexhaustible unique content that no tipster can produce.
- **RP-6 Historical Similar Matches → KEEP, flag dependency.** Genuinely strong and un-copyable, but depends on a large *validated* corpus and deterministic feature vectors — gate on sample-size (ties to calibration gates) or it produces thin/misleading analogies early.
- **Net:** Phase 1 stays, minus RP-8, with RP-9 promoted and RP-1/RP-7 re-scoped to "extend."

### Phase 2 — SEO Expansion → **RE-SCOPE HARD (partially contradicts standing architecture)**
- **The problem:** v1 says "expand programmatic SEO into clusters" with "SE-1..SE-10." The codebase has an **explicit standing decision against mass PSEO** and a mature indexability/quality-gate engine designed to *prevent* exactly the thin-cluster pattern v1 gestures at. Implementing v1's Phase 2 naïvely would fight the platform's own governance.
- **Verdict:** RE-SCOPE from "build a programmatic SEO system" to **"add new *evidence-backed* page-type contracts to the existing `lib/seo-intelligence` engine, each passing the existing 100-point uniqueness gate."** The unit of work is *a new page-type contract with a proven unique-data source*, not *a template that stamps entities into pages*.
- **CUT** any cluster whose uniqueness can't clear the existing gate. Country/operator/market/competition/team/fixture hubs **already exist** — SE-1..SE-6 are mostly redundant. The genuinely new, defensible page types are:
  - **SE-9 Evidence Archive pages** (per-snapshot, hashed) — *the signature asset*, gated on K0-2. **KEEP, STRENGTHEN.**
  - **SE-10 Prediction Archive enrichment** — exists; enrich with odds/ROI once K0-1 lands. **KEEP as "enrich," not "build."**
  - **"Why Not" archive pages** (from RP-9) — new, unique, inexhaustible. **KEEP.**
- **STRENGTHEN with a net-new SEO frontier (see N3): Generative Engine Optimization (GEO)** — structuring content to be *cited by* ChatGPT/Gemini/Perplexity/Google AI Overviews, not just ranked. This is the decade's real SEO shift and directly leverages the graph + evidence. Materially stronger than "more clusters."

### Phase 3 — Affiliate Intelligence → **KEEP, RE-SCOPE to "publicize + activate + time-series"**
- Most of Phase 3 **already exists in admin/dormant form**: operator registry with country/payments/licenses/bonuses, 6-state availability engine, signed-context attribution, deeplink registry, admin affiliate dashboard (10 sections), RG page. v1 framed these as new.
- **Re-scoped milestones:**
  - **AF-1 Operator Intelligence → "publish the admin operator intelligence as gated public pages."** Build-on, not build.
  - **AF-4 Availability → the one genuinely missing piece: time-series availability *capture*** (today it's observation-only). **STRENGTHEN** — this is the real new work and it's the substrate for honest "which operators actually had this market" pages.
  - **Postback activation → PROMOTE to a named milestone (AF-8).** 13 adapters are built but `not_configured`; **real FTD/revenue data cannot exist until they're enabled.** This gates AIX-10 and all affiliate-performance transparency. Without it, "affiliate intelligence" has no ground-truth outcome signal.
  - **AF-6 Responsible Gambling → PROMOTE to foundational compliance pillar (see N7).** Not a footer; a durability/indexability moat in regulated markets. Currently only a static page — real tooling is absent.
- **Guardrail preserved:** experiments must never override availability/allowlist/signed-redirect/UNKNOWN≠AVAILABLE rules (existing Sprint 25 constraint).

### Phase 4 — AI Intelligence Layer → **KEEP (already well-governed), tighten dependencies**
- Correctly extends the recorded `[[ai-intelligence-layer-roadmap]]` with the right invariant (LLM never picks). No re-scope needed.
- **Tighten:** AIX value/ROI scoring is **hard-blocked on K0-1** (odds log) — make that dependency explicit. AIX-7 (performance dashboard) is redundant with Phase 6 + the existing calibration engine — **MERGE into Phase 6**, don't build twice.
- **STRENGTHEN with N-items:** AIX gains a *grounding contract* against the provenance ledger (K0-3) so every AI explanation cites reproducible lineage — this is what makes AIX-4/AIX-6 defensible vs. generic LLM output, and is the precondition for the AI-answer assistant (FX-8/N3).

### Phase 5 — Knowledge Graph → **RE-SCOPE (partly built) to "enrich + publicize"**
- KG-1/KG-2 ("build entity registry + emit Schema.org") **substantially exist** (`lib/knowledge-graph/graph.ts`, 11 JSON-LD types, entity registries, graph-driven linking). Do **not** rebuild.
- **Re-scoped, genuinely new value:**
  - **KG-2′ Promote Prediction/Evidence/Validation/Settlement to first-class graph nodes** (today the graph is football-entity-centric; the *evidence* entities aren't first-class). This is what turns the graph into a defensible reasoning substrate.
  - **KG-4 Public Knowledge Graph surface / API → KEEP, STRENGTHEN** (backlink magnet, AI-grounding store). Overlaps N4 (data licensing).
- **STRENGTHEN:** the graph becomes the **grounding store for the AI answer layer (N3/FX-8)** and the join key for the provenance ledger (K0-3).

### Phase 6 — Transparency Platform → **KEEP, RESEQUENCE, RE-SCOPE to "publish the existing calibration engine"**
- The engine v1 wants to build **already exists internally**: Brier/log-loss/ECE/MCE, confidence bands, sample gates, per-market/league/cohort breakdowns (`lib/calibration-intelligence/*`, `/admin/calibration/*`). The gap is that it's **admin-only**.
- **Re-scoped verdict:** Phase 6 = **"expose the admin calibration intelligence as public, sample-gated, immutable-sourced pages."** This is cheaper, faster, and more defensible than v1 implied.
- **Hard dependencies made explicit:** TP-2 (ROI/yield) → K0-1; *all* TP pages → K0-2 (immutability) or they publish numbers that can silently change.
- **STRENGTHEN — elevate CLV to the north-star metric (N2).** CLV is the one number sharp bettors and any serious acquirer treat as proof of edge. v1 buried it; it becomes a first-class transparency pillar (gated on K0-1).
- **TP-7 Rejected Predictions → KEEP** (aggregate of RP-9; unique + inexhaustible).

### Phase 7 — Live Intelligence → **KEEP as architecture-only, but flag realism**
- Correctly architecture-only. The append-only-hashed-live-snapshot idea is elegant but **XL and expensive**; it also carries the strongest responsible-gambling sensitivity (in-play). **Verdict:** keep as a *latest-phase architecture sketch*, gate hard behind Phase 0/4/5/6 maturity and N7 (RG), and do not let it pull focus. Live is a retention play, not an authority/SEO play — sequence accordingly.

### Phase 8 — Future Expansion → **PRUNE aggressively; promote the one killer idea**
- **FX-4 Verification Portal → PROMOTE to flagship (renamed N5).** "Independently verify any past prediction from its hashed inputs." This is the *most defensible capability in the entire vision* and the immutable content-hashed architecture is exactly what makes it real and un-copyable. It belongs near the front once Phase 0 lands — not buried in blue-sky.
- **FX-1 Public Evidence API / FX-2 Encyclopedia → KEEP, MERGE with KG-4 + N4** (one coherent public-data/graph surface, not three).
- **FX-3 Methodology Publications → KEEP, STRENGTHEN as the EEAT author layer (N6).**
- **FX-5 Personalized Workspace → KEEP** (retention play; sequence after core authority).
- **FX-6 Community Evidence Layer → CUT (or defer indefinitely).** Moderation cost, spam surface, and — most importantly — it **dilutes the evidence-purity moat**. User-generated tips are precisely what the platform's positioning rejects ("not a tipster site"). The risk/reward is poor. If ever revived, it must be *annotation-only, reputation-gated, evidence-anchored, non-predictive*.
- **FX-7 Multi-sport → DOWNGRADE / re-scope.** Multi-*language* is largely solved (31 locales). Multi-*sport* is a **topical-authority dilution risk** — football depth is the moat; spreading to other sports early trades a defensible #1 position for a shallow presence in many. Defer to "only after undisputed football dominance," and even then treat as a separate brand/surface decision, not a milestone.
- **FX-8 Grounded AI Assistant → KEEP, STRENGTHEN as N3/N-anchor** (grounded, citable, never invents picks). This is the OpenAI-acquirer expectation.

---

## 5. Net-New Acquisition-Grade Capabilities (N1–N7)

The test: *if RankWagers were acquired by Google, Bloomberg, The Athletic, or OpenAI in five years, what would they expect to already exist?* These materially increase long-term defensibility and are not in v1 (or are buried).

### N1 · Model & Data Lineage / Provenance Ledger — *(delivered as K0-3; listed here as the strategic capability)*
- Every public number traces to hashed inputs + `modelVersion` + odds + settlement. **What every acquirer's due-diligence demands.** The defensibility keystone.

### N2 · Closing Line Value (CLV) as the North-Star Metric
- **Why:** CLV is the metric that *proves* predictive edge to sharp users, sportsbooks, and financial acquirers (it's the football analogue of alpha vs. a benchmark). Publishing honest, sample-gated CLV over years is a claim almost no public site can make.
- **Depends on:** K0-1 (odds log). **Moat:** requires years of immutable pre-close odds + outcomes. **Position:** Phase 6 pillar.

### N3 · Generative Engine Optimization (GEO) + Grounded AI Answer Layer
- **Why:** The next decade's discovery shift is from "rank in blue links" to "be *cited by* ChatGPT/Gemini/Perplexity/Google AI Overviews." RankWagers' graph + evidence + provenance is ideal citable, licensable, structured content. This is materially stronger than "more programmatic clusters" and is the capability an OpenAI/Google acquirer assumes exists.
- **Includes:** citation-optimized structured content, an evidence-grounded public Q&A/assistant that *only* answers from the graph and always cites lineage (never invents picks), and licensing hooks for AI-answer attribution.
- **Depends on:** KG (graph), K0-3 (provenance), Phase 4 (AI). **Moat:** grounded + reproducible answers vs. hallucination; being the *cited source* compounds authority. **Position:** after Phase 0 + KG enrichment.

### N4 · Licensable Football-Evidence Dataset / Data Partnership Surface
- **Why:** Bloomberg and The Athletic monetize *data and reference*, not just ads/affiliate. A clean, versioned, licensable evidence/odds/accuracy dataset (from the immutable archive) is a **second business model** *and* a backlink/citation engine (researchers, media, model-builders link back).
- **Depends on:** K0-1/K0-2/K0-3, KG-4. **Moat:** only possible atop reproducible immutable data. **Position:** merges FX-1/FX-2/KG-4 into one public-data surface.

### N5 · Public Prediction Verification Portal (promoted FX-4)
- **Why:** "Audit any pick" — independently reproduce a historical prediction from its hashed evidence + odds + `modelVersion`. Verifiable transparency, not asserted. **The most un-copyable trust asset the architecture enables.** Flagship.
- **Depends on:** K0-1/K0-2/K0-3. **Position:** early public milestone, right after Phase 0.

### N6 · EEAT Author & Editorial Governance Layer
- **Why:** Google's EEAT increasingly rewards *identifiable* expertise — named authors, credentials, editorial standards, dated methodology (Athletic-grade). Currently absent; the methodology page is unauthored. Cheap, high-impact, and a durable ranking/trust signal that compounds.
- **Depends on:** none hard. **Position:** early and continuous; pairs with FX-3 methodology publications.

### N7 · Responsible-Gambling as a Compliance & Durability Moat (promoted AF-6)
- **Why:** Real RG tooling (self-exclusion guidance, deposit-limit education, affiliate RG-compliance, jurisdiction-aware disclaimers) is increasingly **regulatory-mandatory** and directly affects indexability/partnership eligibility in regulated markets. It protects long-term domain trust and is table-stakes for any acquirer in the space. Today only a static page exists.
- **Depends on:** none hard; interacts with country intelligence (AF-2) and licensing data. **Position:** foundational, pairs with Phase 3; hard gate for Phase 7 (in-play).

---

## 6. Cuts & Downgrades (removing weak ideas)

| Item | Action | Reason |
|---|---|---|
| SE-1..SE-6 (country/operator/market/competition/team/fixture clusters) | **CUT as new work** | Hubs already exist; re-scope to "new page-type contracts only where a unique-data source clears the existing gate" |
| Phase 2 "programmatic SEO system" (as framed) | **RE-SCOPE** | Contradicts standing "no mass PSEO" decision + duplicates `lib/seo-intelligence` |
| RP-8 Interactive Match Comparison | **MERGE / mostly CUT** | `/compare/{slug}` exists; extend allowlist instead |
| KG-1/KG-2 "build graph + Schema.org" | **RE-SCOPE** | `lib/knowledge-graph/graph.ts` + 11 JSON-LD types already shipped |
| AIX-7 AI Performance Dashboard | **MERGE into Phase 6** | Calibration engine already computes this |
| FX-6 Community Evidence Layer | **CUT / defer indefinitely** | Dilutes evidence-purity moat; moderation cost; contradicts "not a tipster site" |
| FX-7 Multi-sport | **DOWNGRADE / defer** | Topical-authority dilution; football depth is the moat; multi-language already solved |
| Phase 7 Live Intelligence | **KEEP arch-only, de-prioritize** | XL cost, RG-sensitive, retention (not authority) play |

---

## 7. Revised Sequencing & Dependency Graph

The current roadmap is a locked prefix. **Phase 0 is new and first.** Public-facing scale-out follows the keystones.

```
════════════ LOCKED — CURRENT ROADMAP (UNCHANGED) ════════════
 M1…M10 → Activation → Evidence·Settlement·Accuracy·ROI → Prediction Archive → Acca Studio → SEO
══════════════════════════ ▼ ══════════════════════════════════
        [ current roadmap COMPLETE + explicit authorization ]
                              │
              ┌───────────────▼────────────────┐
              │  PHASE 0 — Foundational Integrity │   ◄── NEW, critical path
              │  K0-1 Odds Log ─┐                 │
              │  K0-2 Publication Immutability ─┤  │
              │  K0-3 Provenance/Lineage (N1) ◄─┘  │
              └───────┬───────────────┬───────────┘
                      │               │
        ┌─────────────▼──┐     ┌──────▼─────────────────────┐
        │ N5 Verification │     │ Phase 6 Transparency        │  (publish existing
        │ Portal (flagship)│    │  TP-1 accuracy · TP-2 ROI◄K0-1│  calibration engine,
        └────────┬─────────┘    │  N2 CLV (north-star)◄K0-1    │  gated + immutable)
                 │              │  TP-7 rejected ◄ RP-9        │
                 │              └──────┬──────────────────────┘
                 │                     │
   ┌─────────────▼─────────────┐       │
   │ Phase 1 Research (extend) │       │
   │  RP-1/RP-7 extend · RP-9  │───────┤ (RP-9 feeds TP-7)
   │  RP-6 (gate on sample)    │       │
   └─────────────┬─────────────┘       │
                 │                     │
   ┌─────────────▼──────────────────┐  │
   │ Phase 5 KG (enrich + publicize)│  │
   │  KG-2′ evidence nodes · KG-4   │──┴──► N4 Data/API surface (merges FX-1/2)
   └─────────────┬──────────────────┘
                 │
   ┌─────────────▼───────────────┐
   │ Phase 2 (RE-SCOPED SEO)     │  new page-type contracts ONLY where unique-data clears gate
   │  SE-9 evidence pages ◄K0-2  │  + N3 GEO / grounded-answer optimization
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐        ┌──────────────────────────┐
   │ Phase 3 Affiliate (publicize)│       │ N6 EEAT authors (early+cont.)│
   │  AF-1 publish · AF-4 capture │       │ N7 RG compliance (foundational)│
   │  AF-8 postback activation    │       └──────────────────────────┘
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐
   │ Phase 4 AI (grounded on K0-3)│  AIX-1..6, AIX-8/9; AIX value ◄K0-1; AIX-7→Phase6
   └─────────────┬───────────────┘
                 │
   ┌─────────────▼───────────────┐   ┌────────────────────────────┐
   │ N3 Grounded AI Answer/GEO   │   │ Phase 7 Live (arch-only, late)│ ◄ needs N7
   └─────────────┬───────────────┘   └────────────────────────────┘
                 │
   ┌─────────────▼───────────────┐
   │ Phase 8 (pruned): FX-5 workspace; FX-6 CUT; FX-7 deferred │
   └──────────────────────────────┘
```

### Sequencing summary

| Order | Block | Gated by | Why here |
|---|---|---|---|
| 0 | Current roadmap | — | Absolute priority, unchanged |
| 1 | **Phase 0 keystones** (K0-1/2/3) | roadmap complete | Everything public depends on these; critical path |
| 2 | N5 Verification Portal + Phase 6 (publish calibration) | Phase 0 | Flagship trust + already-built engine; fastest defensibility |
| 3 | Phase 1 Research (extend) + N6 EEAT + N7 RG | Phase 0 | Cheap high-trust wins (RP-9), EEAT/RG foundational |
| 4 | Phase 5 KG enrich + KG-4/N4 data surface | Phase 1 | Graph → grounding + backlink/data moat |
| 5 | Phase 2 (re-scoped) + N3 GEO | KG + K0-2 | Evidence pages + AI-citation frontier |
| 6 | Phase 3 Affiliate (publicize/capture/activate) | Phase 2 | Monetize trusted traffic; AF-8 unlocks outcome data |
| 7 | Phase 4 AI (grounded) | Phases 1,3,5 + K0-1/3 | Narrate/rank on reproducible substrate |
| 8 | N3 grounded answer layer | Phase 4 + KG | Be the cited AI source |
| 9 | Phase 7 Live (arch-only) | 1/4/5/6 + N7 | Retention; latest |
| 10 | Phase 8 (pruned) | varies | Workspace; rest cut/deferred |

**Parallelism:** Phase 0 keystones can proceed in parallel with each other; N6 (EEAT authors) and N7 (RG) run early and continuously. Nothing may pull resources from, or start before, the current roadmap completes.

---

## 8. Risk Register (new/updated)

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Dual odds sources** (M3 evidence odds-archive vs `odds_history` table) diverge | High | K0-1: pick one system of record before publishing any ROI/CLV number |
| R2 | **Publication mutability** → retroactively changed public claims destroy EEAT | High | K0-2 before any permanent public archive page |
| R3 | Phase 2 fights the **"no mass PSEO"** governance → thin-content penalties | High | Re-scope to page-type contracts through the existing uniqueness gate |
| R4 | New derived scores (AIX value, ranking) leak into **evidence identity** | High | Keep explanation-layer scores out of hashed identity (M5/M6 firewall); provenance ledger indexes hashes, never adds hashed fields |
| R5 | **Postbacks never activated** → affiliate "intelligence" has no outcome truth | Med | AF-8 postback activation as explicit gated milestone |
| R6 | **Community/multi-sport** dilute the evidence/football moat | Med | Cut FX-6; defer FX-7 until football dominance |
| R7 | Live in-play **RG/regulatory exposure** | Med | Gate Phase 7 behind N7; architecture-only until then |
| R8 | Building duplicates of **already-shipped systems** (SEO engine, graph, calibration) | Med | This review's re-scopes; audit-before-build rule for every milestone |
| R9 | Odds-log **retention** later prunes data under public pages | Med | Codify explicit no-delete policy for published-cited odds (extends `[[m3-odds-archive-failure-review]]` retention gate) |

---

## 9. What Changed vs. v1 (summary for the record)

- **Added Phase 0** (odds log, publication immutability, provenance ledger) as the mandatory critical path.
- **Re-scoped Phases 2 & 5** from "build" to "extend" (SEO engine + knowledge graph already shipped); Phase 2 realigned to the standing "no mass PSEO" decision.
- **Re-scoped Phases 3 & 6** from "build" to "publicize/activate" (operator + calibration intelligence already exist in admin form).
- **Promoted** the Verification Portal (N5), CLV (N2), GEO/grounded-answer (N3), provenance (N1), EEAT authors (N6), and RG-as-compliance (N7) to first-class, defensibility-driving capabilities.
- **Added N4** licensable data/API surface (second business model, Bloomberg/Athletic-grade).
- **Cut** FX-6 (community) and **deferred** FX-7 (multi-sport) as moat-diluting; **merged** AIX-7 into Phase 6, RP-8 into existing compare, FX-1/2 into N4.
- **Made explicit** the keystone dependencies (K0-1 gates all ROI/CLV/value; K0-2 gates all permanent public pages) that v1 left implicit.

This is a stronger strategy than v1 because it (a) is closer to shipped reality, (b) publishes *verifiable* existing intelligence instead of generating new claims, (c) front-loads the integrity keystones that make transparency defensible, and (d) leans into the two moats no competitor can copy without our years of immutable, content-hashed, reproducible evidence: **verification** and **AI-grounded citation**.

---

## 10. Amendment — 2026-07-31: Content Versioning & Historical Publishing (CVHP)

A new **dependent, off-critical-path** initiative is added: **CVHP** (`docs/plans/content-versioning-historical-publishing.md`) — immutable versioning of RankWagers' *own editorial content* (methodology, operator, competition, market, comparison, RG, bonus, transparency, educational, articles). It is a **fourth artifact class** under the *same* immutability + provenance substrate as evidence (M6), prediction publications (**K0-2**), and provider/football data (FPI) — **not** a new system.

- **Merged, not duplicated:** reuses the K0-2 content-hash/append-only pattern; **author attribution/editorial governance → N6**; **evidence/AI-lineage → K0-3/FPI-4 provenance ledger**; **public history/audit → N5 Verification Portal**; **as-published replay → L3/N5**; underpins **FX-3** methodology; stored in the **PostgreSQL persistence** substrate (no new datastore).
- **Position (no reordering):** after Phase 0 keystones + PostgreSQL persistence; pairs with N6; underpins FX-3. Gates nothing above it and **never delays M10, PostgreSQL persistence, or FPI**.
- **Hard constraints:** SEO exposes only the latest canonical (history is `noindex`, canonical→latest, no sitemap entries, existing URLs/SEO/Evidence unchanged); primary purpose is integrity/audit; no AI-authored content.
- **Prerequisite finding surfaced:** code-defined content has no history today (the release tree is **not** under git); the fix for *code* is source control, and CVHP scopes strictly to editorial content-as-data.

_Related: `docs/plans/long-term-product-vision.md`, `docs/plans/content-versioning-historical-publishing.md`, `docs/plans/ai-intelligence-layer-roadmap.md`, `[[sprint-23b-m10-closure]]`, `[[m5-evidence-model-migration-review]]`, `[[m7-historical-input-identity-failure-review-v2]]`, `[[m3-odds-archive-failure-review]]`._
