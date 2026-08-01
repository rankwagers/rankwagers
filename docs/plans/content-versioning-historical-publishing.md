# Content Versioning & Historical Publishing (CVHP)

> **Status: VISION / ROADMAP AMENDMENT ONLY — NOT STARTED, NOT AUTHORIZED FOR IMPLEMENTATION.**
> **Authored:** 2026-07-31 · **Nature:** long-term architecture amendment. No code, no contracts, no milestone reordering.
> **Namespace:** `CVHP-*` (fresh — can never be confused with or reorder `M1–M10`, `AI-*`, `RP/SE/AF/AIX/KG/TP/LI/FX-*`, `K0-*`, `N1–N7`, or `FPI/L*`).
> **Supersedes the working name "Content Change Detection."**

---

## 0. The Firewall (read first)

The current roadmap and both preservation tracks remain the **absolute, unchanged, unreordered, undelayed** priority:
- M10 completion · Production stabilization · **PostgreSQL persistence** · **FPI** · Canonical Historical Football Database · Provider Independence · Verification Platform.

CVHP is **downstream of all of them**. It never pulls resources from, gates, or precedes M10, PostgreSQL persistence, or FPI. If it ever appears to compete, the above win — always. This document only *adds* one dependent, off-critical-path initiative and *merges* it into existing plans.

---

## 1. What CVHP is — and the one distinction that makes it not a duplicate

**CVHP preserves the complete editorial history of RankWagers' OWN CONTENT** — the human-authored pages: methodology, operator, competition, market, comparison, responsible-gambling, bonus, transparency, educational, and future editorial articles.

**This is a new *artifact class*, not a new *system*.** The platform already versions, or plans to version, three other artifact classes with one shared pattern (append-only, content-hashed, immutable, lineage-tracked):

| Artifact class | Owner | Status |
|---|---|---|
| **Evidence snapshots** | M2–M6 evidence archive | Built (NDJSON, sha256, deep-frozen) |
| **Prediction publications** | K0-2 Publication-Snapshot Immutability | Planned (Phase 0 keystone) |
| **Provider/football data** | FPI (raw archive, canonical temporal entities) | Planned (FPI Phases 2–3, L2) |
| **Editorial content ← CVHP** | this initiative | Proposed |

CVHP is the **fourth artifact class under the same immutability + provenance substrate** — *not* a parallel content-history engine. Reuse K0-2's append-only content-hash pattern, index into the K0-3/FPI-4 provenance ledger, and let N6 govern the human/editorial layer on top. Building a bespoke versioning DB would violate "avoid duplicate systems."

### 1.1 The critical scope line: content-as-data vs content-in-code

RankWagers content lives in two places, and CVHP only owns one of them:

- **Content defined in code** (React/TSX pages, MDX baked into the build, hard-coded copy). Its correct version-control tool is **source control (git)** — *and the production tree is currently NOT a git repository* (`fatal: not a git repository`, verified 2026-07-31). CVHP must **not** reimplement git for code. Instead it **surfaces a hard prerequisite finding**: code-defined editorial content has *no* history today; the right fix is putting the release tree under source control, not a content DB. (Recorded here; a separate ops decision, not a CVHP milestone.)
- **Content authored/published as data** (CMS entries, editorial records in the persistence DB, structured page bodies). This is CVHP's domain — versioned as an immutable artifact class.

CVHP therefore also implies a **migration direction**: editorial content that deserves audited history should live *as data*, so it can be versioned; content that stays in code relies on source control. Drawing this line early prevents a half-system that versions some pages and silently loses others.

---

## 2. Challenge (the proposal, stress-tested)

Required by the brief; each challenge shapes the scope below.

1. **"Isn't this just a CMS / just git?"** Partly — and that is the point of §1.1. For code, use git. For data-backed editorial content, a plain CMS gives *editable* history (mutable rows), which **violates Manifesto Art. VI** ("nothing we published can be quietly changed"). CVHP's differentiator vs. a generic CMS is **immutability + content-hash + lineage**, the same properties evidence already has. So: not a new CMS, an *immutability layer* over whichever CMS/data store holds editorial content.
2. **"Doesn't K0-2 already cover this?"** No — K0-2 freezes *prediction publications*. Editorial prose is a different body with different authorship and cadence. But they share 90% of the mechanism → **merge the mechanism, keep the artifact classes distinct.**
3. **"Scope-creep risk (diff engines, replay, public portals)."** Real. Constrain: CVHP's **primary purpose is integrity/audit (internal)**. Human/machine diff and historical rendering are **derivations** (read-only projections over two immutable revisions), never new authoritative stores. Public exposure is **secondary and gated** (§4).
4. **"Biggest risk = SEO duplicate content."** Correct and non-negotiable. Historical versions must **never** be independently indexed (would create near-duplicate pages → Manifesto Art. XI + the standing "no mass PSEO" decision). Firewall in §4.
5. **"'AI explanation lineage' — does AI write content?"** No. Manifesto Art. XII holds: AI explains, evidence decides. CVHP only *links* editorial revisions to the provenance/AI-explanation lineage they cite; it never authorizes AI-generated editorial content.
6. **"Urgency?"** Low relative to the firewall. We lose irreplaceable *provider* data every day (FPI) and can silently mutate *prediction* history today (K0-2) — those are the emergencies. Editorial content changes rarely and is low-volume. CVHP is important for the trust brand but is correctly **downstream**.

---

## 3. Architecture (reuse, don't rebuild)

```
   Editorial content authored/published as DATA
                    │  (publish event = a meaningful revision)
                    ▼
   ┌─────────────────────────────────────────────────────────┐
   │ CVHP Immutable Revision Store (append-only, content-hashed)│  ← SAME pattern as K0-2 /
   │  per revision: content_id · revision_seq · prev_hash ·     │    evidence archive; lives in
   │  body · body_content_hash · author · published_at ·        │    the PostgreSQL persistence
   │  change_summary · lineage_refs · schema_version            │    substrate (post-FPI PG)
   └───────────────┬───────────────────────────┬───────────────┘
                   │ (derivation-only, read)   │ (index, not a new hashed field)
                   ▼                           ▼
        Diff / History projections     K0-3 / FPI-4 Provenance Ledger
        (human + machine diff,          (editorial content = a 4th
         as-published rendering)          indexed artifact class)
                   │
                   ▼  (gated, latest-only for SEO)
        Public "page history" surface via N5 Verification Portal pattern
```

**Rules (inherited invariants):**
- **Append-only, never mutate.** A "rollback" is publishing a *new* revision whose body equals a prior one — the reverted revision remains in the record (Manifesto Art. VI). No `UPDATE`/`DELETE` of historical revisions.
- **Content-hash the exact stored body** (freeze canonical form; test round-trip) — mirrors M6/K0-2 discipline.
- **Lineage refs, not hashed identity.** Editorial revisions may *reference* evidence snapshots / predictions / AI-explanation outputs they cite; those refs live in the provenance ledger index, never inside a frozen evidence/prediction hash (respects the M5/M6 identity firewall).
- **Storage = the existing persistence substrate.** Once PostgreSQL persistence lands (current work), CVHP is additive tables there — **no new datastore technology**.
- **Fail-closed, dormant-first, reversible.** Ships behind flags; degrades to "no history shown," never to a fabricated/edited page.

---

## 4. SEO firewall (hard constraints — from the brief, made into gates)

- **Canonical always points to the latest published version.** Historical versions are `noindex` + `canonical → latest` and are **excluded from every sitemap**. No historical version is ever an independently indexable URL.
- **Existing URLs are unchanged.** Content IDs *map onto* current URLs; CVHP introduces no new public route for live content.
- **Existing SEO architecture unchanged** (`lib/seo-intelligence/*`, indexability engine, uniqueness gate). History surfaces (if/when public) are a distinct, non-indexed view — like a Wikipedia "history" tab, not new pages.
- **Existing Evidence architecture unchanged.** CVHP reads/links evidence; it never writes to or alters evidence identity/format.
- Public history is **transparency where appropriate**, and integrity/audit everywhere else — the default is internal.

---

## 5. Milestones (`CVHP-*`, all downstream)

- **CVHP-1 · Editorial Content Model & Content-ID registry.** Enumerate which pages are editorial content-as-data; assign canonical `content_id`s mapped to existing URLs (no URL change). Draw the code-vs-data line (§1.1). *Dep:* PostgreSQL persistence. *Position:* after Phase 0 keystones.
- **CVHP-2 · Immutable Revision Store.** Append-only, content-hashed revision table in the persistence substrate; author + `published_at` + `change_summary` + `prev_hash`. *Dep:* CVHP-1; K0-2 pattern. *Complexity:* M.
- **CVHP-3 · Editorial Governance & Author Attribution → MERGE into N6.** CVHP supplies the immutable substrate; **N6 (EEAT authors & editorial governance) supplies the human layer**. Do not build a second editorial-governance system.
- **CVHP-4 · Human + Machine Diff (derivation-only).** Read-only diff projections between any two revisions (human-readable + structured/JSON). No new authoritative data. *Complexity:* M.
- **CVHP-5 · Append-only Rollback / Restore.** "Restore vX" = publish a new revision equal to vX; never erases. *Complexity:* S.
- **CVHP-6 · Provenance & Evidence/AI-Lineage Linkage → MERGE into K0-3/FPI-4.** Editorial revisions become a 4th indexed artifact class in the provenance ledger; link to cited evidence snapshots, predictions, and AI-explanation lineage. *Dep:* K0-3.
- **CVHP-7 · Public Content History (gated) → via N5 Verification Portal.** Optional, non-indexed "page history / as-published" surface using the N5 pattern; obeys §4 firewall. *Dep:* N5, CVHP-2/4.
- **CVHP-8 · As-Published Historical Rendering / Replay.** Render a page exactly as published at date D (integrity/audit; complements L2 temporal + N5 replay). *Dep:* CVHP-2; L3/N5. *Complexity:* M.

---

## 6. Merge map (avoid duplicate systems)

| CVHP goal | Satisfied by / merged into | CVHP's net-new contribution |
|---|---|---|
| Immutable, content-hashed revisions | K0-2 pattern + evidence-archive pattern | Applies it to the **editorial** artifact class |
| Author attribution, change summaries, editorial standards | **N6** EEAT/editorial governance | The versioned substrate N6 writes into |
| Evidence linkage, machine-readable lineage, AI-explanation lineage | **K0-3 / FPI-4** provenance ledger | Editorial revision as a 4th ledger artifact class |
| Public transparency of history / "audit this page" | **N5** Verification Portal | Editorial-content view under the same portal |
| Historical replay / as-of rendering | **L3/N5** replay, **L2** temporal | Page-body replay (vs. data/prediction replay) |
| Methodology/editorial publishing | **FX-3** methodology publications | CVHP is the integrity layer beneath FX-3 |
| Durable storage | **PostgreSQL persistence** (current work) | Additive tables; no new datastore |

**Nothing here is a new parallel engine.** CVHP = one new artifact class + a small set of derivations, threaded through systems that already exist or are already planned.

---

## 7. Roadmap position (no reordering)

CVHP sits **after Phase 0 keystones (K0-1/2/3) and PostgreSQL persistence**, **pairs with N6 (EEAT/editorial governance)**, and **underpins FX-3 (methodology publications)**. It is **not** on the critical path and **never** precedes an existing milestone.

```
… FROZEN: M10 → Activation → PostgreSQL persistence → FPI → Phase 0 (K0-1/2/3) …
                                                        │
                              (N6 EEAT/editorial governance, early+continuous)
                                                        │
                                                        ▼
                                   CVHP-1 → CVHP-2 → CVHP-4 → CVHP-5
                                             │           │
                              CVHP-3⇒N6   CVHP-6⇒K0-3   CVHP-7⇒N5 → CVHP-8⇒L3/N5
```

Suggested band: same era as **N6 / FX-3 (the editorial/EEAT layer)** — after the integrity keystones make immutability + provenance available to reuse. It gates nothing above it.

---

## 8. Manifesto & mission linkage

CVHP is the operationalization, for our *own content*, of principles the platform already commits to:
- **Art. VI — Integrity of the record:** "nothing we ever published can be quietly changed; corrections are additions, never erasures." CVHP is literally this, for editorial pages.
- **Art. XIV — Constant method, evolving models:** "every change to how we work is disclosed and dated, so the evolution itself is part of the public record." CVHP dates and preserves every editorial evolution.
- **Art. IV — Reproducibility** & **Art. III — Explain everything:** a reader can retrace what a page said at any past date and why it changed.
- **Art. XII — AI explains, evidence decides:** CVHP links to AI-explanation lineage but never authorizes AI-authored editorial content.
- **Decision filter:** increases trust, transparency, reproducibility; would still be built if affiliate revenue disappeared (it is a pure integrity asset).

---

## 9. What CVHP does NOT do

- Does **not** modify, reorder, or delay M10, PostgreSQL persistence, FPI, or any existing milestone.
- Does **not** change any evidence/settlement/prediction contract, identity, hash, or format.
- Does **not** change existing URLs, SEO routing, sitemaps, or the indexability engine.
- Does **not** create indexable historical/duplicate pages (canonical → latest, history is `noindex`).
- Does **not** build a new CMS, a new datastore, a parallel provenance ledger, or a git replacement for code.
- Does **not** authorize AI-generated editorial content.
- Does **not** authorize implementation — this is a roadmap amendment only.

_Related: `docs/plans/long-term-product-vision.md`, `docs/plans/long-term-product-vision-architecture-review.md` (K0-2, K0-3/N1, N5, N6, FX-3), `docs/plans/foundational-preservation-initiative.md`, `docs/plans/foundational-preservation-initiative-canonical-extension.md` (L2/L3), `docs/plans/rankwagers-manifesto.md` (Art. VI, XIV, IV, XII)._
