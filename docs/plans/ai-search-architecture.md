# RankWagers — AI Search Era Architecture

**Type:** Architecture design. **No implementation.** No code, no migrations, no route creation, no
schema emission, no flag changes. Contracts, boundaries, identifiers, and decisions only.
**Date:** 2026-08-01.
**Scope:** Citation architecture, knowledge graph, schema, entities, evidence snippets, LLM
grounding, semantic linking, AEO, entity relationships, historical citations, canonical URLs,
programmatic SEO, freshness, versioning, historical publishing, research pages, internal linking,
authority graph, EEAT.
**Targets:** Google (AI Overviews / AI Mode), ChatGPT Search, Gemini, Perplexity, Claude, Microsoft
Copilot, Brave Search, You.com — and classic organic, which remains the substrate all of them index.

---

## 0. Thesis

Classic SEO optimises a **page** to win a **position**. Answer engines do not return positions. They
assemble an answer from **claims**, and they attach a citation to the source that made a claim
*checkable*. The unit of optimisation therefore moves from the page to the **claim**, and the
competitive asset moves from copy to **provenance**.

RankWagers is unusually well positioned for this, for a reason that has nothing to do with content
marketing: the platform already mints **immutable, content-hashed, timestamped evidence snapshots**
and **settled outcome records** (the M1–M9 evidence-capture and settlement layer). Almost nothing in
the betting-affiliate vertical can say "this claim was recorded at this instant, under this model
version, and here is the hash that proves it was not edited afterwards."

Three consequences drive everything below:

1. **Provenance is the moat, not volume.** In a YMYL-adjacent vertical (gambling), every answer
   engine is conservative. They suppress promissory sources and prefer sources that read as
   *reference material*. The existing `lib/trust/claims.ts` rule set — which bans "guaranteed win",
   "sure bet", "AI says", "betting tips" — is not a compliance nuisance. It is the single strongest
   AI-citability asset the product owns. Architecture must amplify it.
2. **Position the product as a measurement source, not a tipster.** A tipster is uncitable by
   construction: its claims are unverifiable predictions. A *measurement source* publishes what was
   recorded, what was priced, what happened, and how often it was right. That is citable, and it is
   what RankWagers already computes internally.
3. **The most citable asset in the codebase is currently invisible.** Calibration — Brier scores,
   cohorts, confidence bands, per-league and per-market accuracy — exists **only under `/admin`**
   (`app/admin/calibration/*`, `lib/calibration-intelligence/`). A public, permanent, versioned
   accuracy record is the highest-leverage single decision in this document.

> **Design rule that governs the whole document:** the frozen evidence contracts (hashed snapshot
> bodies, `inputContentHash`, `modelVersion`, `23B.daily-evidence.v1`) are **read-only inputs** to
> everything here. The citation layer is a *projection* of the ledger. It never mutates identity,
> never re-derives a hash, and never becomes a reason to change a frozen contract.

---

## 1. Coverage map

| # | Requested area | Section |
|---|---|---|
| 1 | Citation architecture | §4 |
| 2 | Knowledge Graph | §3, §7 |
| 3 | Schema strategy | §6 |
| 4 | Entity strategy | §3 |
| 5 | Evidence snippets | §4.3 |
| 6 | LLM grounding | §5 |
| 7 | Semantic linking | §7.2 |
| 8 | Answer engine optimization | §8 |
| 9 | Entity relationships | §3.3 |
| 10 | Historical citations | §4.4 |
| 11 | Canonical URLs | §2 |
| 12 | Programmatic SEO | §9 |
| 13 | Content freshness | §10 |
| 14 | Content versioning | §10.2 |
| 15 | Historical publishing | §10.3 |
| 16 | Research pages | §11 |
| 17 | Internal linking | §7.2 |
| 18 | Authority graph | §7.3 |
| — | EEAT | §12 |
| — | Per-engine considerations | §13 |
| — | Measurement, risks, sequencing | §14–16 |

---

## 2. Current state, assessed

Grounded in the repository, not assumed.

### 2.1 Assets already built

| Asset | Where | Why it matters for AI search |
|---|---|---|
| Immutable hashed evidence snapshots | `lib/evidence/`, `lib/evidence-capture/` | Verifiable provenance — the rarest citable property on the web |
| Settlement / outcome records | `lib/validation/`, settlement pipeline | Converts predictions into an auditable track record |
| Odds history archive | `lib/odds-history/` | Time-series price claims — inherently citable, inherently unique |
| Daily archive + `/archive/[date]` | `lib/archive/`, `app/[locale]/archive/[date]` | Historical publishing surface already exists |
| Knowledge graph primitives | `lib/knowledge-graph/` — 12 entity types, 9 relation kinds | Entity substrate exists; it is not yet an addressable graph |
| Claim-integrity rule set | `lib/trust/claims.ts` | Machine-enforced anti-hype — a genuine EEAT and AI-safety moat |
| No-fabricated-signals rule | `lib/acca-publication/schema.ts:22` | Explicitly refuses fake `aggregateRating` / `reviewCount` |
| Calibration intelligence | `lib/calibration-intelligence/` | The accuracy record — **admin-only today** |
| SEO governance infrastructure | `lib/seo-intelligence/`, `lib/crawl-quality/`, `lib/seo/indexability.ts` | Canonical/sitemap/indexability audit already systematised |
| ~30 locales | `lib/i18n.ts` | Reach — and a duplication risk that must be governed |
| Methodology / how-we-rank pages | `app/[locale]/methodology`, `/how-we-rank` | EEAT scaffolding exists |

### 2.2 Structural gaps

| Gap | Evidence | Consequence |
|---|---|---|
| Accuracy record not public | calibration exists only under `app/admin/` | The most citable asset cannot be cited |
| No `@id` entity graph | `@id` appears once, as `mainEntityOfPage` | Engines cannot resolve the same entity across pages; no graph is inferable |
| Thin schema vocabulary | emitted types are dominated by `ListItem`, `BreadcrumbList`, `WebPage`, `ItemList` | Nothing expresses *data*, *provenance*, or *authorship* |
| No author / reviewer entities | no `Person`, no credential modelling | EEAT is asserted in prose, not in structure |
| No AI-agent policy | `app/robots.ts` has one `*` rule | Training, search, and user-fetch agents are treated identically — a coarse and risky default |
| Machine-readable surface is blocked | `robots.ts` disallows `/api/` | Any evidence endpoint under `/api` is unreachable by design |
| No corpus manifest | none | Nothing tells an agent what the authoritative, stable, citable set is |
| Provenance not exposed | hashes exist internally; nothing surfaces them | The verifiability that exists is invisible to a crawler |
| Research surface absent | `lib/research/` is internal only | No original-research citation target |

Two things that are **already correct** and must not be "fixed": `noarchive` is scoped to `/admin`
only (`middleware.ts`) and does not touch public pages; and the refusal to emit fabricated ratings is
a deliberate integrity rule, not an oversight.

---

## 3. Entity strategy

### 3.1 Principle

An entity is a **thing with a stable URI**, not a page. Pages are views of entities. Locales are
views of pages. The identifier must survive redesigns, locale changes, slug changes, and template
changes — because a citation acquired in 2026 must still resolve in 2029.

### 3.2 Identifier architecture

Three distinct identifier spaces, deliberately separated:

| Space | Form | Stability | Purpose |
|---|---|---|---|
| **Entity URI** (`@id`) | `https://<site>/id/<type>/<stable-key>` | Permanent, never reused, never localised | The canonical name of the thing across the entire graph |
| **Canonical page URL** | `https://<site>/<locale>/<path>` | Stable, may be redirected | The human-addressable document |
| **Record URI** | `https://<site>/id/record/<recordId>` | Immutable — content-addressed | A specific frozen observation |

The `/id/` namespace is a **naming space, not a route family**. Its job is to be a globally unique,
dereferenceable name. Dereferencing may resolve (via redirect or content negotiation) to the current
canonical page for a human agent, and to a structured representation for a machine agent. Keeping
`@id` separate from the page URL is what allows the page to move without breaking every citation and
every cross-page entity relationship.

`lib/knowledge-graph/entity.ts` already computes `${type}:${slug}` — the internal identity model is
correct. The architectural change is **promoting it to a URI** and using that URI as `@id` everywhere
the entity appears, on every page, in every locale.

**Stable-key rule.** The stable key must not be the marketing slug. Slugs change for SEO reasons; a
citation must not. Where an entity has an upstream identifier (fixture id, competition id, team id),
the stable key derives from it. Slug changes then become presentation changes, resolved by redirect,
with `@id` untouched.

### 3.3 Entity classes and relationships

The existing taxonomy (`competition`, `fixture`, `market`, `operator`, `country`, `evidence`, `odds`,
`league`, `team`, `player`, `season`, `venue`) is sound and should be treated as the closed set.
Additions proposed here are those an answer engine needs in order to attribute and to date a claim:

| New class | Role |
|---|---|
| `method` | A named, versioned methodology (how a probability is derived, how a market is qualified, how settlement resolves) |
| `metric` | A named measurable (Brier score, hit rate, closing-line value, sample size) |
| `observation` | A single dated measurement of a `metric`, scoped to a subject |
| `record` | An immutable frozen artifact — an evidence snapshot or a settlement record |
| `agent` | A named author, reviewer, or the organisation itself — the EEAT actor |

Relationship kinds extend the existing set (`part_of`, `has_market`, `supported_by`, `related`,
`evidenced_by`, `priced_by`, `available_in`, `hosts`, `future`) with the relations that make
provenance traversable:

| Relation | From → To | Meaning |
|---|---|---|
| `measured_by` | entity → metric | This entity has this measurable property |
| `observed_as` | metric → observation | This measurement, on this date, at this value |
| `derived_from` | observation → record | This number came from these frozen records |
| `computed_by` | observation → method | Under this named, versioned method |
| `settled_as` | fixture/market → record | The outcome record that closed this prediction |
| `superseded_by` | record → record | Version chain (never deletion) |
| `reviewed_by` | entity → agent | EEAT attribution |
| `about` | document → entity | This page is *about* this thing |

The value of this is not tidiness. It is that a chain `claim → observation → record → method` is
exactly the chain an answer engine (and a human fact-checker) needs to traverse to decide whether a
claim is trustworthy. A graph that stops at "page links to page" cannot support that.

### 3.4 Entity disambiguation

Every entity carries external anchors (`sameAs`) where an authoritative external identifier exists —
Wikipedia/Wikidata for competitions, teams, countries, venues; official sites for operators. This is
how an engine resolves *our* "Arsenal" to *the* Arsenal. Without it, entity claims are
unattributable, and the graph is an island. Where no authoritative anchor exists, no anchor is
invented.

---

## 4. Citation architecture

### 4.1 The citable unit

A citation is earned by a **claim**, which is: a *subject*, a *predicate*, a *value*, a *timestamp*,
a *method*, and a *provenance pointer*. Anything missing one of these is decoration.

```
CLAIM
  subject      → entity URI
  predicate    → metric URI
  value        → scalar + unit + interval/uncertainty
  observedAt   → instant (and the window it summarises)
  method       → method URI + version
  derivedFrom  → one or more record URIs (content-hashed)
  scope        → sample size, filters, exclusions
```

Every public number on the site should be traceable to one of these. Numbers that cannot be
expressed this way should not be presented as facts.

### 4.2 The three-tier citation surface

| Tier | Addressability | Mutability | Purpose |
|---|---|---|---|
| **Tier 1 — Living entity page** | `/(locale)/<entity path>` | Updates continuously | Wins the "what is X" query; always current |
| **Tier 2 — Dated observation page** | `/(locale)/<entity path>/as-of/<date>` (conceptual) | Frozen once published | The citable, permanently-true statement |
| **Tier 3 — Record** | `/id/record/<recordId>` | Immutable, hash-addressed | The proof a fact-checker or agent can verify |

The reason for three tiers rather than one: **a living page is unciteable in a durable way**. If an
engine cites "RankWagers says X's hit rate is 54%" and the page later says 51%, the citation becomes
a liability and the engine learns not to trust the source. A dated tier lets the answer engine cite a
statement that will *remain true forever*, while the living tier keeps winning current queries. This
is the same reason scientific literature cites a version, not a working document.

### 4.3 Evidence snippets

An **evidence snippet** is the smallest self-contained, quotable, verifiable unit — designed so that
a model extracting it out of context still produces a correct, attributable sentence.

Design contract for a snippet:

- **Self-contained.** Carries its own subject, value, date, sample size, and method. No pronouns, no
  "as shown above", no dependency on surrounding copy.
- **Bounded.** One claim. A paragraph containing three claims will be extracted as one and mangled.
- **Qualified in-line.** The uncertainty travels *inside* the sentence, not in a footnote. A model
  will drop the footnote and keep the number.
- **Attributed in-line.** The source and date belong in the sentence, because the sentence is what
  gets quoted.
- **Non-promissory.** Governed by `lib/trust/claims.ts`. A snippet that predicts an outcome is a
  liability; a snippet that reports a measurement is an asset.
- **Stable-worded.** Snippet phrasing should change only when the underlying number changes.
  Rewriting copy for style resets the model's confidence in a source it has already learned.
- **Mirrored in structure.** The same claim appears in the visible text and in structured data, with
  the same value. Divergence between the two is the fastest way to be classified as untrustworthy.

Anti-pattern to avoid explicitly: hiding the number in a chart or a table cell with no textual
statement. Charts are not extractable. Every chart needs a stated claim beside it.

### 4.4 Historical citations

Historical citations are the compounding asset. A dated page acquires citations slowly and then
keeps them, because it can never be contradicted by its own future.

Architecture:

- **Immutability by contract.** A dated observation page, once published, changes only through an
  explicit correction, which is *additive* — the original assertion remains, annotated, with the
  correction linked. Silent edits destroy exactly the property that makes the page citable.
- **Correction as a first-class object.** A correction carries: what changed, when, why, and which
  records now support the value. `superseded_by` links the chain. This mirrors the settlement layer's
  existing correction discipline rather than inventing a second philosophy.
- **Permanence policy.** Dated pages are never deleted, never redirected to a hub, never consolidated
  into a "best of" page. Retention of the underlying records is an operational constraint that must
  be aligned with this promise — a citation that outlives its evidence is worse than no citation.
  (Note the known tension: archive retention policies elsewhere in the platform are time-bounded.
  Publishing a permanent citation surface constrains those policies and must be reconciled before
  anything is promised publicly.)
- **Backfill honesty.** Historical pages generated retroactively must be marked as computed
  retrospectively, with the computation date distinct from the observation date. Presenting a
  backfilled analysis as a contemporaneous record is the one failure mode that would justly destroy
  the source's credibility.

### 4.5 What makes a citation *stick*

Ranked by leverage in this vertical:

1. **A number nobody else has.** Odds-movement and settled-accuracy data are proprietary by
   construction. Restating public information competes with everyone; publishing measurements
   competes with nobody.
2. **A stated method.** Engines cite sources that explain how a number was produced, because that is
   what makes the number defensible in an answer.
3. **A date and a sample size.** An unqualified number is a liability an engine will avoid.
4. **A refusal to overclaim.** In gambling specifically, hedged and bounded language *increases*
   citation probability, because it lowers the engine's risk of emitting a harmful claim.
5. **Consistency over time.** The same claim, phrased the same way, across the living page, the dated
   page, the structured data, and the machine surface.

---

## 5. LLM grounding

Grounding is the retrieval contract: what an agent can fetch, how it verifies it, and how it decides
we are authoritative. Four components.

### 5.1 Agent access policy

The single `User-agent: *` rule in `app/robots.ts` is the most consequential gap in the current
setup, because it collapses three fundamentally different agent classes:

| Class | Examples | What allowing it buys | What blocking it costs |
|---|---|---|---|
| **Retrieval / citation** | `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Bingbot`, `Googlebot`, `Bravebot`, `YouBot` | Inclusion in AI answers **with attribution** | Total invisibility in that engine's answers |
| **User-initiated fetch** | `ChatGPT-User`, `Claude-User`, `Perplexity-User` | The page loads when a user explicitly asks about it | The user is told the site cannot be read |
| **Training** | `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `Bytespider`, `meta-externalagent` | Model-weight familiarity, no attribution, no traffic | Nothing immediate; content is not memorised |

The architectural decision is that these classes get **separate, explicit policies**, and the default
is: retrieval and user-fetch **allowed**, training **a deliberate business decision** rather than an
accident of a wildcard rule.

Two traps worth naming precisely, because both are commonly inverted:

- **`Google-Extended` does not affect Google Search or AI Overviews.** It governs Gemini grounding.
  Blocking it is a Gemini opt-out with no SEO upside.
- **AI Overviews are governed by snippet directives, not by an AI-specific agent.** `nosnippet`, or a
  restrictive `max-snippet`, removes eligibility. The current scoping of `noarchive` to `/admin` is
  correct and must stay that way; public pages must retain full snippet eligibility, and this should
  be an enforced invariant rather than a convention.

### 5.2 Machine-readable corpus

`robots.ts` currently disallows `/api/`, which means any machine-readable evidence surface placed
there is unreachable. The architecture therefore requires a **public data namespace distinct from the
private application API** — one that is crawlable, cacheable, versioned, and contains no
authentication surface and no personal data.

Its contract:

- Stable representations of entities, claims, observations, and records.
- Content-addressed record retrieval, so a verifier can confirm a hash independently.
- Explicit versioning in the response, never implicit "latest".
- Documented, stable field names — treated as a published interface with the same discipline as the
  frozen evidence contracts.
- No behavioural difference between what a human sees and what a machine is served. Serving different
  facts to crawlers is cloaking; serving the *same* facts in a different *format* is not.

### 5.3 Corpus manifest

A single machine-readable entry point (the `llms.txt` convention, plus a structured equivalent)
declaring: what this site is, what it measures, what it explicitly does not claim, where the
methodology lives, where the accuracy record lives, which surfaces are stable and citable, and where
the machine-readable corpus begins.

Its most valuable content is the **negative space** — an explicit statement that the platform does
not sell picks, does not guarantee outcomes, and does not publish tips. In a vertical where engines
are actively filtering for exactly those signals, declaring the boundary is a ranking input.

### 5.4 Verifiability surface

The differentiator. For any published claim, an agent can retrieve the record it derives from and
confirm the content hash. This turns "trust us" into "check it", and it is the property that
distinguishes RankWagers from every affiliate site restating the same bonus terms.

Architecturally this requires only a **projection** of the existing frozen ledger — the identifiers,
hashes, and timestamps already exist. It requires no change to any frozen contract, which is
precisely why it is achievable.

---

## 6. Schema strategy

### 6.1 Principles

1. **Schema describes; it does not assert.** Every structured value must be present in the visible
   page. Structured-only claims are a manipulation signal.
2. **No fabricated signals.** Extend `lib/acca-publication/schema.ts:22` sitewide: no invented
   `aggregateRating`, no `reviewCount` without real reviews, no `Review` without a real reviewer, no
   `priceValidUntil` that is a guess. In an AI-mediated world this rule *gains* value: a single
   detected fabrication is a source-level penalty, not a page-level one.
3. **One graph, not per-page fragments.** Emissions across the site should be nodes in a single graph
   joined by `@id`, not disconnected islands. This is the largest available structured-data
   improvement given the current state.
4. **Model the data, not just the document.** The current vocabulary describes pages. It needs to
   describe measurements.

### 6.2 Vocabulary by surface

| Surface | Core types | Notes |
|---|---|---|
| Organisation / site | `Organization`, `WebSite` | Add `sameAs`, `foundingDate`, editorial policy, contact — the publisher identity every engine resolves first |
| Entity pages (team, competition, operator, market, country) | `SportsTeam`, `SportsOrganization`, `Organization`, `Place`, `DefinedTerm` | Every one carries `@id`; `DefinedTerm` (in a `DefinedTermSet`) is the right model for markets and betting concepts |
| Fixture pages | `SportsEvent` | With competitors, start time, competition, venue — all as `@id` references, not repeated literals |
| Research / analysis pages | `Article` / `ScholarlyArticle`, `Dataset` | `Dataset` is the underused, high-value type here: it is how a measurement corpus becomes discoverable and citable |
| Observations | `Observation`, `StatisticalVariable`, `QuantitativeValue`, `PropertyValue` | The vocabulary for "this metric, this value, this date, this margin" |
| Methodology pages | `HowTo` or `Article` + `DefinedTermSet` | Versioned; every claim links to the method version that produced it |
| Accuracy record | `Dataset` + `Observation` series | The flagship citable object |
| Archive pages | `CollectionPage`, `ItemList` | Already present; needs `@id` linkage and dates |
| FAQ / answer blocks | `FAQPage`, `QAPage` | Only where a genuine question is genuinely answered on-page |
| Corrections | `CorrectionComment` | Makes the correction policy machine-visible — a strong EEAT signal |

Deliberately **excluded**: `ClaimReview` (it is for fact-checking third-party claims, not one's own —
misapplying it is a credibility risk), `Review`/`AggregateRating` on operators unless real, verified,
first-party reviews exist, and any type used to imply endorsement the platform has not earned.

### 6.3 Provenance in structured data

The mechanism that carries verifiability into schema:

- `isBasedOn` → record URIs the claim derives from.
- `citation` → the method version and the dated observation page.
- `dateCreated` / `dateModified` / `temporalCoverage` → distinct, honest, never cosmetically refreshed.
- `identifier` (as `PropertyValue`) → the content hash. This is what makes the record independently
  checkable and is the single most differentiating field the site can emit.
- `variableMeasured`, `measurementTechnique`, `observationDate` → on datasets and observations.
- `provider` / `publisher` / `creator` → resolved to the organisation `@id`, and to `Person` `@id`s
  where a real, named human is accountable.

### 6.4 Locale and schema

With ~30 locales, entity identity must **not** fork per locale. One entity `@id`; the localised page
is `about` it. `inLanguage` marks the document, `@id` marks the thing. Getting this wrong creates 30
competing "entities" for one team and dissolves the graph.

---

## 7. Knowledge graph, semantic linking, authority graph

### 7.1 Graph as the source of truth

`lib/knowledge-graph/` already holds entities, edges, registry, navigation, and recommendations. The
architectural shift is to treat the graph as the **authority** from which navigation, internal links,
breadcrumbs, structured data, sitemaps, and the machine corpus are all *derived views* — rather than
as one feature among several that each maintain their own idea of what relates to what.

Consequence: a relationship is declared once and appears consistently in the UI, in the JSON-LD, in
the internal link graph, and in the machine surface. Engines weight consistency heavily; inconsistent
signals across those four surfaces read as noise.

### 7.2 Semantic and internal linking

**Semantic linking** means a link asserts a *typed relationship*, not merely a path. `Arsenal → Premier
League` is `part_of`; `Arsenal → Arsenal 2025/26 form` is `measured_by`. When the relationship type is
expressible in structured data, it should be, so the link carries meaning and not just equity.

Internal linking architecture:

- **Derived, not hand-authored.** Links come from graph edges. Hand-authored cross-links drift.
- **Typed anchors.** Anchor text describes the target entity and the relationship, not "click here"
  and not keyword-stuffed variants of the same phrase.
- **Bounded fan-out.** A page linking to 200 siblings distributes nothing. Depth of relationship
  beats breadth of enumeration.
- **Reciprocity where the relationship is reciprocal**, asymmetry where it is not. `part_of` is not
  symmetric and should not be rendered as if it were.
- **Hub-and-spoke per entity cluster**, with the hub being the entity page and spokes being dated
  observations, research, and related entities.
- **Every dated page links up** to its living entity page, and the living entity page links down to
  its most significant dated observations. This is what makes historical pages discoverable rather
  than orphaned — the most common failure of archive architectures.

### 7.3 Authority graph

Authority in an AI-mediated web is **corroboration**, not backlink count. The architecture should
optimise for being the source that *other* sources point at when a claim needs support.

Layers:

1. **Internal authority** — a coherent internal graph in which methodology and accuracy pages are the
   most-linked-to nodes. If methodology is a footer link, the site is claiming its own method is
   unimportant.
2. **Anchored authority** — `sameAs` links to authoritative external identifiers, which is how an
   engine ties our entities into its own graph.
3. **Corroborated authority** — publishing measurements that others cite. This is the only durable
   form and the only one that compounds. Uniquely for this platform, it is achievable: nobody else
   has the settled-outcome ledger.
4. **Consistency authority** — the same entity facts stated identically across every surface,
   including off-site profiles. Contradiction between our own surfaces is the cheapest way to lose
   authority and the easiest to prevent.

Explicitly rejected: link schemes, paid placements framed as citations, syndication of near-duplicate
content across domains. In an AI-mediated ranking system these are increasingly detectable and
source-level punitive.

---

## 8. Answer engine optimization

### 8.1 The retrieval reality

Answer engines do not read pages the way crawlers do. Typically: the user's question is decomposed
into sub-queries; candidate passages are retrieved; passages are re-ranked for relevance *and
extractability*; an answer is synthesised; citations are attached to the passages that carried the
load. Optimisation therefore targets the **passage**, not the document.

### 8.2 Passage-level design contract

- **Answer-first.** The direct answer appears in the first passage, in one or two sentences, before
  context. Buried answers lose to a competitor's lead paragraph.
- **Question-shaped headings.** Headings that mirror real question phrasing retrieve better than
  keyword-shaped ones, because embeddings match intent.
- **One idea per passage**, self-contained, with subject and qualifiers restated. Redundancy that
  reads slightly repetitive to a human is *correct* for extraction.
- **Comparisons as tables with a stated summary sentence.** Tables are structured but rarely quoted;
  the summary sentence is what gets cited.
- **Definitions before analysis.** A defined term establishes topical authority and is a common
  citation target for "what is X" queries.
- **Recency stated in text.** "As of <date>" inside the sentence, not only in metadata.

### 8.3 Query-class map

| Query class | Target surface | Citable asset |
|---|---|---|
| "What is <market/term>?" | Market entity page (`DefinedTerm`) | Definition + worked example |
| "How accurate is <source>?" | Public accuracy record | Settled outcome ledger — **unmatched by competitors** |
| "Is <operator> available in <country>?" | Operator × country availability | Dated availability observation |
| "What are the odds for <fixture>?" | Fixture page | Odds snapshot with capture instant |
| "Did <prediction> win?" | Dated archive page | Settlement record |
| "How does <platform> calculate X?" | Methodology, versioned | Method definition |
| "Best sites for X" | Ranked list with stated criteria | `how-we-rank` criteria + evidence per criterion |
| "<Team> form / record" | Team entity + observations | Observation series |

The third and fifth rows are where the platform can win outright, because no competitor can produce a
verifiable answer at all.

### 8.4 The gambling-vertical constraint

Every engine applies elevated caution here. Some suppress commercial gambling content in generated
answers entirely; most demand strong signals before citing. Architectural responses:

- **Lead with the reference layer, not the commercial layer.** Definitions, methodology, measurement,
  and outcomes are citable; affiliate comparison pages generally are not, and should not be the
  primary AEO target.
- **Keep commercial intent structurally separated** from the reference and evidence layers, with
  transparent disclosure. Blending them contaminates the citability of both.
- **Make responsible-gambling context machine-visible**, not merely a footer link — engines look for
  it as a safety signal before citing gambling content.
- **Never phrase a measurement as advice.** `lib/trust/claims.ts` already enforces this; it should
  gate every AEO surface, including generated programmatic copy.

---

## 9. Programmatic SEO

### 9.1 The trap

Programmatic SEO built by templating a database into pages produces exactly what AI search destroys:
thin, near-duplicate pages restating retrievable facts. If a model can answer the question from its
own weights, the page has no reason to be cited or to exist.

### 9.2 The qualifying rule

**A programmatic page is justified only if it contains a fact that does not exist elsewhere.**

For RankWagers that fact is the measurement: what was priced, what was recorded, what happened, how
often the method was right. A `team × competition × season` page templated from public statistics is
worthless. The same page carrying settled outcomes, price movement, and calibration for that cohort is
citable.

Every programmatic template must therefore declare, at design time, the unique data it carries and
the minimum data volume below which the page is **not generated**. Sparse pages are the primary risk
to site-level quality assessment, and the gate belongs in the architecture, not in a later cleanup.

### 9.3 Page-type architecture

The existing `SeoPageType` contract system (`lib/seo-intelligence/contracts.ts`) is the correct
mechanism. Each type should declare: purpose, unique data guaranteed, minimum-viability threshold,
canonical policy, indexability policy, freshness expectation, schema profile, internal-link position,
and citability tier.

Candidate families, ordered by citation value rather than by volume:

| Family | Uniqueness | Citation value |
|---|---|---|
| Accuracy / calibration by cohort | Proprietary ledger | **Highest** |
| Dated archive observations | Proprietary + permanent | **Highest** |
| Market definitions | Editorial + worked examples | High (definitional queries) |
| Operator × country availability | Dated, changing, verifiable | High |
| Fixture pages | Odds-history uniqueness | Medium-high |
| Team / competition entity pages | Mostly public facts | Medium — only with measurement layered on |
| Compare pages | Editorial criteria | Medium — commercial, weakly citable |

### 9.4 Scale discipline

Combinatorial expansion (`locale × entity × season × market`) is where programmatic SEO becomes
liability. Governing constraints: generate a locale only where content is genuinely localised, not
machine-translated boilerplate; expand a dimension only when the cell carries unique data; treat
crawl budget and index bloat as first-class design constraints; and prefer **fewer, deeper, dated**
pages to many shallow ones. With ~30 locales, this constraint is the difference between an asset and a
quality problem.

---

## 10. Freshness, versioning, historical publishing

### 10.1 Freshness

Freshness is a property of **claims**, not pages. Different claim classes have genuinely different
half-lives — odds are minutes, availability is weeks, methodology is quarters, settled history is
permanent. The architecture should therefore attach an explicit freshness class to each claim class,
and state observation time in the visible text.

Rules:

- **Never touch `dateModified` without a substantive change.** Cosmetic refreshing is detectable and
  corrosive.
- **Distinguish "verified current" from "changed".** Re-verification without change is honest and
  useful; representing it as an update is not.
- **Stale claims degrade visibly** rather than silently persisting. A number with an old observation
  date and no re-verification should present as historical, not current.
- **Freshness must never be achieved by mutating history.** The living tier updates; the dated tier
  never does.

### 10.2 Content versioning

A published claim is versioned like a record, not like a document:

- Versions are additive; the prior version remains addressable.
- Each version carries what changed, when, why, and under which method version.
- The method itself is versioned, and every observation names the method version that produced it —
  which is precisely what the `modelVersion` discipline in the evidence layer already establishes.
  Extending that discipline to public content is a continuation, not an invention.
- A change in method that alters historical values must **not** silently rewrite published history.
  It publishes a new series alongside, with the relationship stated. This is the difference between a
  measurement source and a marketing site.

### 10.3 Historical publishing

`/archive/[date]` already exists and is the right foundation. Architecturally it should become the
**permanent citation layer**:

- Every archive day is a permanent, immutable document with its own `@id`.
- Each carries the settled outcomes for that day, with record URIs and hashes.
- Days link forward and backward, and up to the entities they concern, so the archive is a traversable
  series rather than a set of orphans.
- Aggregate series (weekly, monthly, per-competition, per-market) are **derived** from days and state
  their derivation, never replacing the days.
- Retention of underlying records must match the permanence promised publicly. This is the one hard
  dependency between this architecture and the existing platform: a permanent citation surface cannot
  sit on a time-bounded archive without an explicit reconciliation.

---

## 11. Research pages

Research pages are the highest-authority, lowest-volume surface, and the primary mechanism for
earning corroborated authority. `lib/research/` exists internally; nothing is published.

Architecture:

- **Original measurement only.** A research page publishes something the platform measured. It is not
  a listicle, not a roundup, not a restatement.
- **Standard structure**, because consistency is what makes a source citable: question → method →
  data → results → limitations → reproduction pointer. The limitations section is not an apology; it
  is a credibility signal, and models reliably prefer sources that state boundaries.
- **Dataset-backed.** Each research page has an associated dataset with a stable identifier, so the
  data is citable independently of the prose.
- **Versioned and dated**, with corrections additive.
- **Named human accountability** — a real author and, where applicable, a reviewer, both modelled as
  entities.
- **Reproducibility pointer.** Method version plus the record URIs the analysis consumed. Full
  reproducibility is not required; *traceability* is.

Natural subjects, all uniquely available to this platform: calibration of predicted probability
against realised outcomes; closing-line value as an accuracy measure; how odds move before kick-off
across competitions; how frequently market qualification excludes fixtures and why; operator
availability drift by country over time.

The strategic point: these are questions the vertical's audience genuinely asks and for which no
verifiable published answer currently exists. That is the definition of a citation opportunity.

---

## 12. EEAT

EEAT is not a checklist; for AI-mediated retrieval it is the set of signals that determine whether a
source is safe to quote. Mapped to architecture:

| Signal | Architectural expression |
|---|---|
| **Experience** | Settled outcome ledger — direct evidence the platform has actually run the method over real events, not commentary about it |
| **Expertise** | Named authors and reviewers as entities with stated credentials; versioned, public methodology |
| **Authoritativeness** | Corroborated authority (§7.3); `sameAs` anchoring; consistent entity facts everywhere |
| **Trustworthiness** | Verifiable provenance; additive corrections; enforced anti-hype language; transparent affiliate disclosure; responsible-gambling context |

Trust-specific architecture, in the order it matters for this vertical:

1. **Verifiability over assertion.** Every number traceable to a record. This is the strongest trust
   signal available and the platform is nearly alone in being able to offer it.
2. **Corrections that are visible.** A public correction log is counter-intuitively one of the
   strongest trust signals — sites that never correct anything either never measure anything or hide
   their errors.
3. **Disclosure as structure.** Affiliate relationships declared machine-readably, not only in prose.
   Concealment, once detected, is source-level fatal in a YMYL-adjacent vertical.
4. **Accountability.** A real organisation, real people, real contact path. Anonymous gambling content
   is heavily discounted by every engine.
5. **Refusal to overclaim.** Already enforced in code. It should be stated *publicly and explicitly*
   — a page that documents what the platform will not claim is itself a trust artifact, and is
   directly useful to a model deciding whether citing this source is safe.

---

## 13. Per-engine considerations

Shared substrate first: all of these consume a crawled index and reward extractable, well-structured,
verifiable passages. There is no engine-specific content strategy — only engine-specific *access* and
*emphasis*.

| Engine | Grounding path | Architectural emphasis |
|---|---|---|
| **Google** (AI Overviews / AI Mode) | Googlebot index; snippet directives govern eligibility | Full snippet eligibility; strong entity graph; `sameAs`; classic technical SEO remains the entry price. `Google-Extended` affects Gemini, **not** Search |
| **ChatGPT Search** | `OAI-SearchBot` index + `ChatGPT-User` live fetch | Allow both explicitly; answer-first passages; clean, fast, JS-light rendering for live fetch |
| **Gemini** | Google index + `Google-Extended` policy | Do not block `Google-Extended` unless training exposure is a deliberate business decision; strong `Dataset` and entity markup |
| **Perplexity** | `PerplexityBot` index + `Perplexity-User` | Rewards recency, explicit dates, and citation-dense pages; dated observation tier maps directly onto its behaviour |
| **Claude** | `Claude-SearchBot` / `Claude-User` | Rewards explicit sourcing, stated uncertainty, and non-promissory framing — the strongest fit for this platform's existing claim discipline |
| **Copilot** | Bing index | Bing indexing hygiene (IndexNow, Bing Webmaster) is a separate, concrete dependency from Google's |
| **Brave** | Independent index (`Bravebot`) | Must be explicitly permitted; independent index means separate verification; privacy-respecting framing aligns well |
| **You.com** | `YouBot` + partner indexes | Structured data and clean extraction carry disproportionate weight |

The recurring architectural conclusion: **the differentiator is access policy plus verifiable
structure, not per-engine content variants.** Producing engine-specific content would be cloaking and
is explicitly rejected.

---

## 14. Measurement

An AEO architecture that cannot tell whether it is working will be abandoned before it compounds.
Measurement is itself an architectural requirement.

- **Citation telemetry.** AI-agent referrers and user-agent classes are distinguishable in server
  logs. The existing traffic-classification layer (`lib/trafficClassify.ts`, `lib/analyticsTraffic.ts`)
  is the natural home for an AI-source dimension, kept separate from organic.
- **Crawl coverage by agent class.** Which agents fetch what, how often, and where they fail. A
  retrieval agent that never fetches the accuracy record is a discoverability defect.
- **Claim-level attribution.** Which dated pages and which claims accumulate citations over time.
- **Answer presence auditing.** Periodic checking of whether the platform is cited for its target
  query classes, per engine — accepting that this is sampled and noisy, not a metric to over-tune.
- **Zero-click reality.** AI citations often produce attribution without a session. Success metrics
  must include *presence and correctness of attribution*, not only referred traffic. Optimising for
  clicks alone will produce the wrong architecture.

---

## 15. Risks and non-goals

| Risk | Mitigation |
|---|---|
| Permanence promise collides with archive retention | Reconcile retention policy **before** publishing any permanent citation surface; do not promise what the ledger will not retain |
| Programmatic expansion produces thin pages | Minimum-viability data gate per page type, enforced at design time |
| Locale expansion multiplies near-duplicates | One entity `@id` across locales; generate a locale only where content is genuinely localised |
| Structured data drifts from visible content | Both derived from one claim model; divergence treated as a defect, not a discrepancy |
| Publishing an accuracy record that is unflattering | Publish it anyway. A source that publishes only favourable results is not a measurement source, and the credibility gain from honesty exceeds the cost of a mediocre number |
| Commercial layer contaminates reference layer | Structural separation and machine-readable disclosure |
| Frozen evidence contracts pressured by the citation layer | Citation layer is strictly a projection; a required change to a frozen contract is a design failure to be resolved in the projection |
| Over-indexing on one engine | Shared substrate; engine-specific work confined to access and verification |

**Non-goals.** Engine-specific content variants. Cloaking of any kind. Fabricated structured data.
Link schemes. Publishing predictions as advice. Chasing volume over verifiability. Treating AI search
as a replacement for classic SEO — the crawled index remains the substrate for every engine listed.

---

## 16. Architectural sequencing

Ordered by leverage, not by effort. Each is a design commitment, not an implementation plan.

1. **Make provenance public.** Expose the accuracy/calibration record and record-level verifiability.
   This is the asset nobody else has, and everything below compounds on it.
2. **Establish the entity URI space.** `@id` everywhere, one entity across all locales. Without this
   there is no graph and no durable citation target.
3. **Define the agent access policy.** Separate retrieval, user-fetch, and training. Currently a
   single wildcard rule governs all three — the cheapest high-impact decision available.
4. **Open a public machine-readable namespace** outside the robots-blocked `/api/`, plus a corpus
   manifest.
5. **Introduce the dated observation tier.** Convert the archive from a browsing feature into the
   permanent citation layer.
6. **Deepen the schema vocabulary** from document types to data types, joined into one graph.
7. **Derive internal linking from the knowledge graph** so navigation, structured data, and the
   machine corpus cannot disagree.
8. **Publish research pages** on questions only this platform's ledger can answer.
9. **Formalise EEAT structurally** — named accountability, versioned methodology, visible corrections,
   machine-readable disclosure.
10. **Instrument AI-source telemetry**, including zero-click attribution.

---

## 17. The one-sentence architecture

**Turn the evidence ledger into a public, permanently-addressable, independently-verifiable claim
graph — and let every page, every locale, every schema emission, and every machine surface be a
derived view of it — so that when an answer engine needs a checkable number about football betting,
RankWagers is the only source that can supply one.**
