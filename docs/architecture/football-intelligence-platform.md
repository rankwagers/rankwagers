# RankWagers — Football Intelligence Platform

**Type:** Architecture. **No implementation.** No code, no schema DDL, no migration, no route added.
**Date:** 2026-08-01.
**Status:** Design proposal for review. Nothing here is built or authorised to be built.

---

## 0. The thesis

**RankWagers is the permanent public record of what the football market believed, and what actually
happened.**

Football entities — clubs, competitions, seasons, players, matches — are the **index** into that
record. They are not the product. The product is the record.

This is the only defensible position available, and it is available because of a structural gap:

| Who owns what | Asset | Can RankWagers win it? |
|---|---|---|
| FBref / StatsBomb | Match performance data (xG, shot maps, possession chains) | **No.** Licensed proprietary collection. Competing here is renting someone's asset and reselling it worse. |
| Transfermarkt | Squad histories, transfers, crowd-sourced market values | **No.** Twenty years of community labour. Unbuyable. |
| Wikipedia | Canonical narrative + neutrality | **No,** and shouldn't try. |
| Opta / Sofascore | Live event feeds | **No.** Latency and licensing war. |
| **Nobody** | **A permanent, public, verifiable time-series of market prices, the reasoning attached to them, and their falsified outcomes** | **Yes.** |

Bookmakers delete their own price history. Odds-comparison sites show *current* prices and discard
yesterday's. Tipster sites publish wins and quietly bury losses. Academic work on market efficiency
uses closed datasets. **There is no public, citable, permanent archive of football market belief
over time.** That is the asset. The repository already contains its foundations: a hash-sealed
evidence pipeline (`lib/evidence-capture`, M2–M10), an odds-history service with movement and
closing-line-value analysis (`lib/odds-history`), a typed entity graph (`lib/knowledge-graph`), and
a settlement engine that records outcomes without permitting retroactive edit.

**Consequence for every decision below:** where a feature strengthens the record's completeness,
permanence, or verifiability, it is core. Where it merely presents third-party stats more
attractively, it is decoration and must justify itself against a competitor who owns that data.

### 0.1 What this platform is not

Stated as hard architectural constraints, not marketing copy:

- **Not a prediction site.** The platform never claims to know a future result. It publishes
  probability estimates *with* their method version, *with* their inputs frozen, and *with* their
  subsequent falsification. A probability with no published error record is a tip; a probability
  with one is a measurement.
- **Not a tipster site.** No "banker of the day", no confidence stars, no streak marketing. The
  track record is a dataset, not a sales asset — and it is architecturally impossible to filter it
  to the winners (see §9).
- **Not an odds-comparison site.** Current best price is a commodity feature and a race to the
  bottom. *Price history* is the asset. Comparison exists as a by-product of the archive.
- **Not a content farm.** No page exists because a keyword exists. See the irreducible-question rule
  (§4.0).

### 0.2 The survival test

> Users should visit RankWagers even if affiliate links disappear.

The architectural translation: **affiliate is a rendering layer, never a data layer.** Operator
identity may appear as a *dimension* of the market record (this price came from this book at this
time), but no fact, ranking, chart, export, or API response may vary based on commercial
relationship. Formally:

- The research corpus and the commercial corpus are separate stores with a one-way dependency:
  commercial may read research; research may never read commercial.
- Removing the entire affiliate subsystem must leave every research URL, dataset, chart, and export
  byte-identical. This is testable and should be an enforced invariant (§10.5), not a promise.

---

## 1. The four questions, applied as an architectural filter

Every page archetype must pass **at least three of four**. Pages that pass fewer are not built.

| Question | What it actually demands | Architectural implication |
|---|---|---|
| **Why would Google rank this?** | The page is the best answer to a question that has demand and no better answer. Not "contains keywords". | Each page owns an *irreducible question*. Two pages may never answer the same question. Enforced by the URL algebra (§3.4) and an indexability verdict (`lib/knowledge-graph/contracts.ts` already models `IndexabilityVerdict`). |
| **Why would Reddit link it?** | It settles an argument, or it is surprising and checkable within 10 seconds. | Every claim is deep-linkable to a fragment with a visible as-of timestamp and a one-click verification path. Arguments are settled by evidence, not by assertion. |
| **Why would journalists cite it?** | The number exists nowhere else, is attributable, is stable, and will still resolve in three years. | Permanent identifiers, immutable snapshots, an explicit citation block, a corrections log, and a URL that never 404s or silently changes meaning (§3.5, §9.4). |
| **Why would ChatGPT reference it?** | The fact is atomic, unambiguous, machine-parseable, and attributed to a named method. | Every rendered fact has a machine twin: typed JSON at a parallel URL, JSON-LD in page, and a plain-language sentence containing the entity, the number, the unit, the period, and the source (§8). |

**The discipline this imposes:** a page that cannot state its irreducible question in one sentence
does not get built. A page whose question is already answered by an existing page gets merged into
it, not published alongside it.

---

## 2. Data architecture

### 2.1 The central decision: bitemporality

Today the site reads a live provider and renders it. A research platform cannot do this, because a
research platform must be able to answer:

> *What did we believe on 4 March 2026, and why?*

That requires two independent time axes on every fact:

| Axis | Meaning | Why it is non-negotiable |
|---|---|---|
| **Valid time** | When the fact was true in the world (kickoff, the minute a price was offered, the date a transfer completed) | Historical filtering, season boundaries, form windows |
| **Observation time** | When *we* recorded it | Reproducibility. Providers restate. Scores get corrected. Squads get backfilled. Without this axis, every historical claim silently rewrites itself and every citation rots. |

Plus a third, non-temporal axis that behaves like time:

| Axis | Meaning |
|---|---|
| **Method version** | Which version of which derivation produced a computed number |

**Rule:** no derived number is ever published without its method version, and no method version is
ever mutated in place. A chart from 2026 must still render in 2029 exactly as it did — including
its errors. This is the difference between a research platform and a dashboard.

The existing evidence model already enforces exactly this for snapshots (`modelVersion`,
content-hash identity, frozen inputs). The architecture generalises that discipline to **all**
data, rather than confining it to the evidence subsystem.

### 2.2 Layered store model

Five layers, strictly one-directional. No layer may read downward.

```
L0  RAW          Provider payloads, byte-preserved, content-hashed, never edited.
                 Append-only. The provenance root. (lib/providers/raw-archive is the seed.)
       │
L1  OBSERVATIONS Normalised, entity-resolved, bitemporal facts.
                 One row = one observed fact + provenance pointer into L0.
       │
L2  ENTITIES     Canonical entities and their identity history.
                 Clubs, competitions, seasons, players, venues, operators, markets.
       │
L3  DERIVATIONS  Computed measures, versioned and reproducible.
                 Form, streaks, movement, CLV, calibration, ratings, aggregates.
       │
L4  PUBLICATIONS Frozen, hash-sealed, citable artefacts.
                 Evidence snapshots, prediction records, settlement records, datasets, studies.
```

**Why L0 must exist even though it is expensive:** every citation-worthy claim eventually gets
challenged. Without byte-preserved provider payloads you cannot prove what you were told, only what
you concluded. L0 is the difference between "we stand by our number" and "here is the input,
verify it yourself." It also makes every derivation re-runnable after a bug is found — the single
most valuable property a research corpus can have.

**Why L4 is separate from L3:** derivations improve; publications must not. A published artefact is
a promise. Re-deriving it produces a *new* artefact with a new identity, and the old one remains
resolvable forever with a visible supersession pointer.

### 2.3 Ingestion architecture

```
Provider  →  Fetch (budgeted, retried, categorised)
          →  L0 archive write (content-hash, dedupe, immutable)
          →  Parse + validate against a declared contract
          →  Entity resolution (§2.4)
          →  L1 observation write (bitemporal, provenance-linked)
          →  Derivation invalidation (mark dependent L3 measures stale)
          →  Derivation recompute (versioned, idempotent)
```

Design commitments:

1. **Ingestion is idempotent and replayable.** Re-running any window produces identical L1 rows.
   The existing evidence pipeline's content-hash identity is the correct precedent.
2. **Parsing failures are data, not exceptions.** A payload that fails its contract is archived,
   flagged, counted, and surfaced in a public data-quality report (§9.3). Silent drops are how
   research corpora quietly become wrong.
3. **Providers are pluggable and *attributed*.** Multi-source is a requirement, not an optimisation:
   the moment two sources disagree, the disagreement itself becomes a publishable fact and a
   trust signal. Single-source is a correctness risk *and* a lost differentiator.
4. **Backfill and live ingest share one path.** Two code paths means two truths.
5. **Ingest is decoupled from serving.** No user request ever triggers a provider fetch. The read
   path touches only L1–L4. This is also what makes the site fast enough to be a research tool.

### 2.4 Entity resolution — the unglamorous core

This is where platforms of this type live or die, and it deserves the most architectural attention.

The problem: providers identify "Manchester United" as an integer that changes between feeds,
spells it four ways, merges the women's team, and renames the club mid-season.

**Design:**

- **Canonical entity IDs are internal, opaque, permanent, and provider-independent.** Never a
  provider ID. Never a slug. Slugs and provider IDs are *attributes* that change; the ID does not.
- **An alias table maps every external identifier and name form → canonical ID,** with validity
  ranges. Renames and re-brandings are recorded as identity events, not overwrites.
- **Resolution is deterministic and auditable.** Every resolution records its rule and confidence.
- **Unresolved is a first-class state.** An entity that cannot be confidently resolved is quarantined
  and reported, never guessed into the corpus. A wrong merge is far more expensive than a gap: it
  corrupts every downstream aggregate silently and is nearly impossible to detect later.
- **Merges and splits are versioned events with a reversal path.** Clubs merge. Leagues restructure.
  Nations dissolve. The identity layer must model this or the historical corpus becomes a lie.

The existing hand-curated registries (`lib/teams/registry.ts`, `lib/competitions/registry.ts`,
~100–450 lines each) are the *editorial* seed of this layer, not its replacement. The architecture
keeps curation for entities that need judgement (which competitions are covered, which are the
same competition across a rename) and automates resolution for the long tail.

### 2.5 Provenance

Every published number carries, retrievably:

`source → payload hash → observation time → transformation chain → method version → publication ID`

Not necessarily rendered on screen — but always one click away, and always in the machine
representation. **A number without a retrievable provenance chain does not get published.** This is
the single rule that separates a research platform from a content site, and it is the rule that
makes citation safe for a journalist.

---

## 3. Entity model and URL architecture

### 3.1 Entity types

The existing `GraphEntityType` is the right seam. Target set:

| Entity | Status | Notes |
|---|---|---|
| Competition | exists | Includes the competition's own identity history across renames |
| Season | exists | The join of competition × time; the primary research unit |
| Club | exists (`teams`) | Distinct from squad; identity survives renames and relegation |
| Match | exists (`fixtures`) | The atomic event; both a page and a data point |
| Market | exists | 1X2, O/U, BTTS, AH — a first-class entity, not a filter |
| Operator | exists | A market participant, *not* a commercial partner, in the research corpus |
| **Player** | **new** | See §3.2 — scope carefully |
| **Venue** | new | Weak page potential; strong dimension for home/away analysis |
| **Manager** | new, later | Genuine research value (tenure effects); genuine data-sourcing cost |
| **Study** | **new, central** | A saved query. See §5.3. The most under-exploited entity type in this vertical. |
| **Publication** | new | Evidence snapshot, prediction record, dataset release |

### 3.2 The player question — challenge the assumption

The brief asks for player pages. Built naively, they are the weakest surface in the plan:
Transfermarkt, FBref, Wikipedia, and Sofascore all outrank them, and the data is licensed rather
than owned. A player page that lists appearances and goals is a page that will never rank, never be
linked, and never be cited.

**Recommendation: build player pages, but only along the axis nobody else covers — the market
axis.** The irreducible question becomes:

> *How does the market price matches involving this player, and does his presence or absence move
> the line?*

That yields genuinely novel, defensible, and highly linkable material: line movement on confirmed
absence, price differential with and without a player, market reaction to injury news timing,
and — critically — a measurable, falsifiable answer to a question every fan argues about.

**Architectural consequence:** player entities require *lineup and availability observations*
joined to *timestamped odds*. If that join cannot be sourced reliably, player pages should be
deferred rather than shipped thin. A thin player page is a liability: it dilutes crawl budget,
weakens sitewide quality signals, and invites the exact "content farm" classification the mission
rejects. **Ship no entity type whose distinctive axis is unsourced.**

### 3.3 The graph

Typed edges (the existing `GraphEdge` / `GraphRelationKind` model generalises cleanly):

```
Club        --competed_in-->     Season
Season      --instance_of-->     Competition
Match       --in-->              Season
Match       --home/away-->       Club
Match       --at-->              Venue
Player      --appeared_for-->    Club          (validity range)
Market      --priced_on-->       Match
Operator    --quoted-->          Price          (Match × Market × time)
Publication --about-->           Match | Season | Club
Study       --queries-->         [entities]
Entity      --same_as-->         Wikidata | Wikipedia | official
```

The graph is the **single source of truth for navigation, internal linking, breadcrumbs,
structured data, and related-content selection**. One traversal model, four consumers. This
prevents the classic failure where nav, breadcrumbs, sitemap, and schema.org disagree about how the
site is shaped — a disagreement search engines read as low quality.

### 3.4 URL algebra

URLs are a public API. They must be predictable, guessable, permanent, and free of duplication.

```
/{locale}/competitions/{competition}
/{locale}/competitions/{competition}/{season}
/{locale}/competitions/{competition}/{season}/table
/{locale}/competitions/{competition}/{season}/matches
/{locale}/clubs/{club}
/{locale}/clubs/{club}/{season}
/{locale}/clubs/{club}/history
/{locale}/clubs/{club}/odds
/{locale}/matches/{match}
/{locale}/matches/{match}/odds
/{locale}/matches/{match}/evidence
/{locale}/players/{player}
/{locale}/markets/{market}
/{locale}/operators/{operator}
/{locale}/research/{tool}
/{locale}/studies/{study}
/{locale}/data/{dataset}
```

Rules:

1. **One question, one URL.** A fact lives at exactly one canonical address.
2. **Hierarchy mirrors the graph.** No orphan paths.
3. **Query parameters never create indexable pages.** Filter state is a *view*; a filter worth
   indexing is promoted to a Study with its own canonical URL and its own written interpretation.
   This is the single most important defence against the doorway-page failure mode that kills sites
   in this vertical.
4. **Slugs are permanent.** Renames add an alias and a redirect; they never repoint an existing URL
   to different subject matter. A URL that changes meaning silently is worse than a 404 — it poisons
   every existing citation.
5. **The current `teams` path becomes `clubs`** (with permanent redirects). "Team" is ambiguous
   across club/national/squad; the corpus needs the precision, and it must be fixed before the
   historical corpus makes it expensive.

### 3.5 Permanence contract

Published as a stated policy, because it is the precondition for citation:

- Canonical URLs and publication identifiers are permanent.
- Superseded artefacts remain resolvable, marked superseded, and point forward.
- Corrections are additive and logged, never silent edits (§9.4).
- The machine representation of any page is available at a parallel, equally permanent address.

---

## 4. Page architecture

### 4.0 The irreducible-question rule

Every archetype below declares the one question it exists to answer. If two archetypes answer the
same question, one is deleted. If an archetype cannot answer its question with owned or licensed
data, it is not built.

### 4.1 Club page

**Question:** *What is this club's complete record, and how has the market valued it over time?*

| Layer | Content |
|---|---|
| Identity | Names and identity events, founding, venue, competitions, external `sameAs` links |
| Record | All-time and per-competition results; the complete season index |
| Market | **Distinctive.** Long-run price history: average implied win probability by season, home/away price differential, over/under-pricing versus realised results |
| Form | Current form, in-context with historical distribution — "unusual" defined against the club's own history, not a global constant |
| Streaks | Active and historical, with the historical rank of the current streak |
| Evidence | Every published prediction and evidence snapshot involving the club, with its outcome |
| Graph | Rivals, competitions, seasons, players, venues |

**Why it ranks:** it is the only club page with a longitudinal market dimension. Everything else on
it is table stakes that must be *correct*, not distinctive.

### 4.2 Competition page

**Question:** *What is this competition, across its whole history, and how does it behave?*

Identity and format history (including renames and restructures), the full season index, all-time
records, and — distinctively — **competition-level market behaviour**: home advantage over time,
draw frequency versus market expectation, favourite reliability, and how efficiently the
competition is priced relative to others. That last measure is a genuinely novel, citable,
sport-wide comparison that nobody publishes.

### 4.3 Season page

**Question:** *What happened in this season, and what did the market expect before it happened?*

The primary research unit. Final table, full match index, progression, champion, records — plus the
**pre-season versus outcome** comparison: which clubs the market misjudged, and by how much. This is
the archetype most likely to be linked in retrospectives and cited in journalism, because it is a
fact-dense, permanently-relevant page with an angle nobody else has.

Season pages also carry the **historical timeline** view (§4.6) scoped to their year.

### 4.4 Match page

**Question:** *Everything that was known, believed, priced, and predicted about this match — and
what actually happened.*

The atomic unit of the archive and the highest-value permanent artefact:

- Result, lineups, timeline
- **Complete price history across operators**, from opening to close, as a chart, with the visible
  drift and the closing line
- Evidence snapshot: the frozen inputs and the published probability, hash-sealed
- Settlement: the outcome, mechanically derived, immutable
- Post-match: closing-line value, whether the market moved toward the truth, whether our estimate beat it

**This page is the product.** Every other page is an index into it. It is what a journalist links,
what a Redditor screenshots, and what an LLM quotes — because it answers "what did people think
before they knew" with receipts.

### 4.5 Player page

**Question:** *How does this player's presence change how matches are priced?* (See §3.2 — build
only if the availability × odds join is sourceable.)

### 4.6 Historical timelines

**Question:** *What happened, in order, and what changed?*

A timeline is a **rendering of the graph filtered by validity range**, not a separate data structure.
Available as a view on any entity: club (identity events, competitions, notable results, record
market movements), competition (format changes), season (matchday progression), player (clubs,
availability). Because timelines are graph views, they cost one component and produce a view on
every entity type — and they are inherently machine-readable.

### 4.7 Odds history

**Question:** *What did this cost, when, where, and how did it move?*

Available at every granularity: match, club, competition, season, market, operator. Primitives:
the price series, the movement decomposition (drift versus jump), the consensus versus the outlier,
the closing line, and the divergence between operators. Much of this exists already
(`lib/odds-history`: `movement`, `closingLineValue`, `comparison`, `timeline`, `chartSeries`); the
architecture's contribution is **permanence, coverage, and citability** — the analysis is largely
built, the archive is not.

### 4.8 Prediction history

**Question:** *Was this platform right, and how often, and where is it wrong?*

Every published probability, its inputs, its method version, its outcome, and its error. Aggregate
calibration is a first-class public page: reliability curves, Brier score and log loss by market, by
competition, by confidence band, over time — **including every losing period, with equal
prominence**.

**Architecturally enforced, not editorially promised:** the record is generated from the immutable
publication store; there is no filter parameter that can exclude losses, because the aggregation
reads the whole store by construction and any exclusion would break its own hash. This is the
single most link-worthy asset the platform can own, precisely because no competitor can copy it
without also publishing their failures.

### 4.9 Evidence history

**Question:** *What exactly was known at the moment of publication?*

The frozen input bundle, hash-verifiable, with an independent verification path a third party can
run. Already the strongest existing subsystem (M2–M10). The architecture's addition is to make it
**public, permanent, indexable, and explained** rather than an internal integrity mechanism.

---

## 5. Research tools

### 5.1 The core assumption to challenge

The brief lists eight explorers: trend, streak, form, operator comparison, probability, home/away,
historical filters, advanced search. Built as eight features, they become eight half-maintained
tools with inconsistent semantics, eight sets of bugs, and eight different answers to the same
question.

**They are one engine with eight entry points.**

Every one of them is: *select a population → filter by conditions → compute a measure → group →
compare → visualise*. The differences are presets, defaults, and language — not architecture.

### 5.2 The query engine

```
Population   which matches/clubs/seasons/players are in scope
Conditions   filters over entity attributes, temporal windows, and match state
Measure      the computed quantity, versioned (form, streak, price movement, CLV, calibration)
Grouping     the comparison axis (season, club, operator, venue, month, market)
Comparison   against baseline, expectation, or another population
Presentation the visual form
```

One semantic layer means: one definition of "form" sitewide, one definition of "streak", one
definition of "home advantage" — each versioned, documented, and referenced by every page that uses
it. When a definition improves, every consumer improves together, and every existing publication
keeps its old version. **A research platform whose terms mean different things on different pages is
not a research platform.**

Each explorer is then a thin preset:

| Explorer | Preset |
|---|---|
| Trend | Measure over time, grouped by period |
| Streak | Consecutive-run measure with an active/historical split |
| Form | Windowed measure with a historical-distribution baseline |
| Home vs Away | Grouping fixed to venue role, comparison to overall |
| Probability | Measure = implied/estimated probability, comparison to realised frequency |
| Operator comparison | Grouping fixed to operator, measure = price/movement/settlement behaviour |
| Historical filters | The condition layer exposed directly |
| Advanced search | The population layer exposed directly |

### 5.3 Studies — the most valuable idea in this document

**Every query state is addressable, saveable, and citable as a first-class entity.**

A Study is: a frozen query + a frozen result + a timestamp + a permanent URL + a citation block +
an export + an embed.

This is the TradingView insight applied to football research, and it changes the platform's
economics:

- **Users** get shareable analysis instead of ephemeral filter state.
- **Reddit** gets a link that reproduces the exact argument, verifiably.
- **Journalists** get a citable, permanent, dated artefact.
- **Google** gets a growing corpus of genuinely distinct pages that were *not* generated by a
  template — each with real demonstrated demand.
- **LLMs** get atomic, well-labelled, machine-readable findings.

Governance is what keeps this from becoming the doorway-page disaster it superficially resembles:

1. Studies are **noindex by default**.
2. A study becomes indexable only on **demonstrated demand plus editorial interpretation** — a
   human-written answer to "so what?". The interpretation is the content; the query is the evidence.
3. Near-duplicate queries are collapsed into a canonical study.
4. Every indexable study is reviewed against the four questions of §1.

Without rule 1 this is a content farm. With it, it is a compounding, demand-driven research corpus
where quality control is a promotion gate rather than a cleanup task.

### 5.4 Interactive statistics and visualisation

Visualisation is a **system**, not a set of charts. The house style (from `.claude` design guidance
and the existing design system) should be centralised as a small, opinionated chart grammar:

| Principle | Consequence |
|---|---|
| The chart is a *view of a query* | Every chart is exportable, permalinkable, and has a data table equivalent |
| Uncertainty is always shown | A probability without an interval is a lie; error bands are default, not optional |
| Baselines are always visible | A number without a comparison is not information |
| No chart requires JavaScript to convey its headline | Server-rendered figure and caption; interactivity is enhancement (SEO *and* accessibility *and* GEO) |
| One palette, sequential/diverging/categorical, accessible in both themes | Charts read as one system; also the only way multi-year visual consistency survives |
| Every chart has a text alternative | Screen readers, LLMs, and crawlers are the same audience with different clients |

Interaction primitives: brush and zoom over time, hover with precise values, filter chips that
mutate the query (and therefore the URL), comparison overlay, and "explain this" surfacing the
method version and provenance.

---

## 6. Search and discovery

Existing (`lib/search`: engine, indexer, ranking, fuzzy, normalizer; `lib/discovery`) is a solid
seam. Architectural direction:

- **Entity-first search.** Queries resolve to entities, then to studies, then to text.
- **Question-shaped queries are first-class.** "Arsenal home form", "biggest odds drift 2026",
  "leagues with most draws" resolve to a *configured study*, not a list of blue links. This is the
  single biggest differentiator available in on-site search in this vertical, and it doubles as
  GEO-optimised content generation from real demand.
- **Advanced search is the query engine's population layer** (§5.2), not a separate index.
- **Search demand is an input to the study-promotion gate** (§5.3). The corpus grows toward
  demonstrated demand rather than keyword speculation.

---

## 7. Internal linking

Internal linking is generated **from the graph**, never from templates, and is subject to a budget.

| Rule | Rationale |
|---|---|
| Links are graph edges, rendered | Nav, breadcrumbs, related content, and schema all derive from one traversal — they cannot disagree |
| Link budget per page | Unbounded "related" blocks dilute every link on the page and read as spam |
| Relevance is ranked, not enumerated | Rank by graph distance, temporal proximity, and demand; show the top N |
| Reciprocity is intentional | Hub → spoke always; spoke → hub always; spoke ↔ spoke only when the edge is semantically real |
| Anchor text is the entity's canonical name | Not keyword-stuffed variants |
| Orphans are a monitored defect | Every entity reachable from a hub within three clicks; this is measurable and should be reported |

The existing `IndexabilityVerdict` and discovery-graph vocabulary are the right place to enforce
this: a page that fails its indexability verdict is excluded from link generation *and* the sitemap,
automatically and consistently.

---

## 8. Knowledge Graph, GEO, and machine consumption

### 8.1 Structured data

| Entity | Type | Note |
|---|---|---|
| Club | `SportsTeam` | With `sameAs` → Wikidata, Wikipedia, official site |
| Competition | `SportsOrganization` / `EventSeries` | |
| Season | `SportsEvent` | Sub-events = matches |
| Match | `SportsEvent` | With competitor, location, date, result |
| Player | `Person` / `Athlete` | Only with sourced identity |
| **Dataset** | **`Dataset` + `DataDownload`** | **The underexploited move** |
| Study | `Dataset` or `Article` + `Claim` | Depending on interpretation weight |
| Method | `Article` / `TechArticle` | Versioned, permanently addressed |

**`Dataset` markup on the odds-history and prediction-history archives is the highest-leverage
structured-data decision available.** It targets Google Dataset Search — a surface with essentially
no competition in football betting data, an audience of researchers and journalists, and exactly the
citation behaviour the mission wants. No competitor in this vertical does it.

### 8.2 Wikidata alignment

Every canonical entity carries a Wikidata QID where one exists. This is not decoration:

- It resolves entity ambiguity for search engines definitively.
- It is the join key for LLMs already grounded in Wikidata.
- It makes RankWagers *linkable from* the open knowledge graph — a durable, compounding backlink
  and authority path that competitors cannot buy.

### 8.3 GEO — being referenced by language models

LLMs cite what is unambiguous, atomic, attributed, and parseable. Concretely:

| Requirement | Design |
|---|---|
| Atomic facts | Each fact is a self-contained sentence: entity + measure + value + unit + period + source. Never "as shown above" |
| Machine twin | Every page has a typed JSON representation at a parallel permanent URL |
| Deep addressability | Stable heading and fact fragment IDs so a specific claim is linkable |
| Explicit as-of | Every number states its observation date inline, not in a footer |
| Named method | Every derived number names its method and version, linked to the method page |
| No JS-gated facts | Headline facts server-rendered as text; interactivity is enhancement only |
| Corpus manifest | A published index of datasets, methods, entity types, and update cadence at a well-known path (`llms.txt` and a machine-readable catalogue) |
| Stated licence | Explicit reuse terms with an attribution requirement — removes the legal hesitation that suppresses citation |

**The insight:** GEO and citability are the same problem. A page structured so a journalist can
quote it correctly is a page a model can quote correctly. Optimise once.

### 8.4 EEAT as architecture, not copy

Trust signals in this vertical are cheap to fake and therefore heavily discounted. Only *structural*
signals carry weight:

| Signal | Structural implementation |
|---|---|
| Expertise | Published, versioned methodology per measure; every number links to its method |
| Experience | A public, complete, falsifiable track record including losses (§4.8) |
| Authoritativeness | Cited by others because the data exists nowhere else; Wikidata alignment; Dataset publication |
| Trustworthiness | Immutable archive, hash verification, public corrections log, explicit uncertainty, visible commercial-boundary policy |
| Accountability | Named authorship on interpretation; named ownership of methods; contactable corrections channel |
| Independence | Architecturally enforced separation of research and commercial corpora (§0.2), stated publicly and testable |

The strongest EEAT asset available is the one nobody else will build: **an error record you cannot
edit.**

---

## 9. Integrity architecture

### 9.1 Immutability

Publications are content-addressed and append-only. Republication creates a new identity and a
supersession edge. This exists today for evidence snapshots; it generalises to prediction records,
settlements, datasets, and promoted studies.

### 9.2 Verifiability

A third party must be able to verify a claim without trusting the platform: published hashes, a
documented canonicalisation, an independent verification path, and downloadable frozen inputs. This
converts "trust us" into "check us" — the only trust claim that survives contact with a skeptical
reader.

### 9.3 Data quality as a public artefact

Coverage, completeness, provider disagreement rates, unresolved-entity counts, and correction
frequency are **published**, not hidden in an admin panel (`lib/data-quality` and
`lib/crawl-quality` already exist as internal seams). Publishing your own gaps is the strongest
possible quality signal, and it pre-empts the criticism that a hidden dashboard invites.

### 9.4 Corrections

A public, append-only corrections log: what changed, when, why, which publications are affected,
and what the value was before. Silent edits destroy citability permanently; a visible corrections
log is the mechanism by which serious publications *earn* citability.

---

## 10. Platform and serving architecture

### 10.1 Rendering strategy

| Content class | Strategy | Rationale |
|---|---|---|
| Historical entity pages | Static, revalidated on data change | Immutable, high volume, must be instant and crawlable |
| Current season / live | Server-rendered, short cache | Freshness bounded and explicit |
| Studies and explorers | Server-rendered shell + client interaction | Headline facts crawlable; exploration enhanced |
| Machine representations | Static, aggressively cached | Cheap, and the LLM/citation path |

**Constraint:** the read path never touches a provider (§2.3). This is what makes a research tool
feel like a tool rather than a website.

### 10.2 Scale shape

The corpus is dominated by matches, and matches grow linearly and permanently. The architecture
must assume hundreds of thousands to millions of match pages and price series over time. Consequences:

- Pre-computation over query-time computation for anything on a page.
- Aggregates are materialised and versioned, not derived per request.
- Sitemap and crawl management is an engineered subsystem with a budget, not a generated file
  (`lib/sitemapIndex.ts` and the SEO admin surface are the existing seam).
- Storage: append-only file archives are correct for the evidence layer's immutability guarantees;
  the analytical corpus (L1/L3) needs a relational store with real indexing. This is already the
  identified gating condition throughout the M2–M10 work, and it is the correct point to resolve it.

### 10.3 API and exports

A public read API and bulk exports are **not** a nice-to-have; they are the citation mechanism.
Researchers cite what they can download; LLMs reference what they can parse; journalists trust what
they can check. CSV and JSON per study, per dataset, per entity — each with the licence, the
as-of timestamp, and the provenance manifest embedded.

### 10.4 Internationalisation

Locale is a presentation layer over locale-independent entities and measures. Facts and identifiers
never vary by locale; only language does. Translated pages must add genuine value (localised
competition context) or they are noindex — a translated shell of the same numbers is duplicate
content with extra steps.

### 10.5 The independence invariant

Stated as an enforceable architectural test rather than a policy:

> Removing every commercial module must leave every research URL, dataset, chart, export, and
> machine representation byte-identical.

If that test is hard to write, the boundary has already been violated.

---

## 11. What we deliberately do not build

Saying no is architecture:

| Not built | Why |
|---|---|
| Player market values | Transfermarkt's proprietary crowd-sourced asset. Unwinnable, and copying it is both legally and reputationally poor |
| Detailed event data (shot maps, passing networks) | Licensed at a cost the model does not support; FBref/StatsBomb own the surface |
| Live scores as a destination | Commodity, latency war, zero citation value |
| Tips, banker picks, confidence stars | Directly contradicts the positioning and poisons EEAT |
| Social/community features | Enormous moderation cost, no compounding data asset, regulatory exposure |
| AI-generated match previews | The exact content class search engines are actively suppressing, and it devalues everything around it |
| Auto-generated per-filter landing pages | The doorway-page failure mode; replaced by the study promotion gate (§5.3) |

---

## 12. Sequencing

Each phase must be independently valuable and independently abandonable. No phase depends on a
later phase's success.

| Phase | Delivers | Unlocks |
|---|---|---|
| **1. Foundation** | Bitemporal L0/L1, entity resolution, provenance, canonical IDs | Everything. Nothing durable can be built before this |
| **2. The archive** | Continuous odds capture and permanent match records; match pages as permanent artefacts | The unique asset begins compounding immediately — it cannot be backfilled later, which makes this the most time-critical phase |
| **3. Entity surface** | Club, competition, season pages over the corpus; graph-driven linking; structured data | Rankable, crawlable, citable surface area |
| **4. Track record** | Public prediction history, calibration, evidence publication | The EEAT and link-acquisition engine |
| **5. Research tools** | Query engine, explorers as presets, studies | The reason to return; the compounding corpus |
| **6. Machine surface** | API, exports, Dataset publication, Wikidata alignment, corpus manifest | Citation and GEO at scale |
| **7. Selective depth** | Players (if sourceable), managers, venues | Depth only where the distinctive axis is sourced |

**The ordering argument:** phase 2 is time-critical in a way nothing else is. Historical performance
data can be licensed at any point; **odds history cannot be bought retroactively at any price.**
Every day without capture is a permanent hole in the only asset that is genuinely ours. If only one
phase ships, it should be that one.

---

## 13. Assumptions and open questions

Flagged rather than silently assumed — each materially affects the design:

1. **Data rights.** Whether the current provider licence permits permanent archival, redistribution,
   bulk export, and public API exposure is the single largest unknown. The entire citation and GEO
   strategy depends on it. *This should be resolved before phase 2, not during it.*
2. **Odds capture coverage.** Sampling frequency, operator breadth, and market depth determine
   whether the archive is authoritative or anecdotal. Under-sampling produces a corpus that looks
   complete and is not — the worst outcome.
3. **Player data sourcing.** Determines whether §3.2 ships or defers. Defer rather than ship thin.
4. **Storage platform.** The relational cutover for L1/L3 is already the recurring gating condition
   in the existing evidence work; the analytical corpus makes it unavoidable.
5. **Editorial capacity.** The study-promotion gate (§5.3) and interpretation layer require human
   judgement. Without committed editorial capacity, phase 5 degrades into the content farm the
   mission explicitly rejects, and should be descoped rather than automated.
6. **Regulatory surface.** Publishing a verifiable prediction record in a gambling-adjacent context
   has jurisdictional implications that should be reviewed before publication, not after.

---

## 14. The summary judgement

The platform's defensible asset is **not** football statistics — those are owned by others and
rented by everyone. It is **the timestamped, immutable, publicly verifiable record of market belief
and its falsification**, indexed by football entities.

Three structural commitments follow, and everything else in this document is downstream of them:

1. **Capture the market record continuously and permanently, starting as early as possible** — it
   is the only asset that cannot be acquired later.
2. **Publish the error record with the same prominence as the success record** — it is the only
   trust signal in this vertical that cannot be faked, and therefore the only one that compounds.
3. **Make every fact atomic, attributed, addressable, and downloadable** — because ranking,
   linking, citation, and model reference are one problem with one solution.

A platform built this way is worth visiting with no affiliate links on it, because the record is
worth having and exists nowhere else. That is the whole test.
