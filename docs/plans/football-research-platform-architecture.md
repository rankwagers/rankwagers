# The Football Research System — Architecture

> **Status: ARCHITECTURE ONLY — NO IMPLEMENTATION, NOT AUTHORIZED.**
> **Authored:** 2026-08-01 · **Governed by:** `[[rankwagers-manifesto]]`
> (Art. IV Reproducibility, Art. VII The courage to say nothing, Art. VIII Respect for the user,
> Art. XI Earned authority, Art. XII AI explains / evidence decides).
> **Merges:** Vision RP-6/RP-8/RP-10, SE-9/SE-10 + §2.4 governance, KG-4, FX-1/FX-2/FX-3/FX-4 —
> which today are ten scattered milestones with no shared primitive.
> **Consumes:** `[[canonical-football-database-architecture]]` (CFD) for point-in-time data.
> **Duplicates:** nothing. No new hashing, no new archive, no new indexability engine.

---

## 0. The one idea

**A query is not a page.** Every research platform in this industry conflates the two, and that single
conflation causes both failure modes simultaneously:

- treat every query as a page → **doorway spam** (infinite parameter permutations, all indexable);
- treat every page as a live query → **irreproducibility** (the page shows different numbers next
  year, so the citation you made is worthless).

The architecture separates three object types that everyone else fuses into one:

| | **View** | **Study** | **Canonical Research Page** |
|---|---|---|---|
| What | live, parameterized exploration | a View **pinned** to an immutable data state | a Study **promoted** through an admission gate |
| Identity | none (URL is scratch) | content hash of `(question, params, pins)` | curated topical path |
| Lifetime | the session | **forever** | forever, until demoted |
| Reproducible | no | **byte-identical, forever** | yes |
| Citable | no | **yes** | yes |
| Indexable | **never** | **no, by default** | yes — and rarely |
| Count | unbounded | large | deliberately scarce |

**The decoupling that makes the whole thing work: permanence ≠ indexability.** Every Study gets a
permanent URL and a citation. Almost none get indexed. Search engines see a small, dense, earned
corpus; researchers get an unlimited, permanently-addressable one. This is the structural answer to
"advanced filtering + permanent URLs + no SEO spam", which otherwise are in direct contradiction.

---

## 1. Challenging the brief

**1.1 — "Research platform rather than betting website" is a framing the architecture must *enforce*,
not assert.** Affiliate revenue funds this (it is the flywheel in `[[foundational-preservation-initiative-canonical-extension]]`),
and pretending otherwise would be its own dishonesty. The honest architectural resolution is
**decision-neutrality as a data property**: a Study's result set may contain operator availability as
a *fact*, but a Study can never contain an operator *placement*, and no monetization surface may be a
function of a study's conclusion. If the same query can produce a different operator module depending
on the answer, the research layer has been captured. That is a testable invariant, not a value
statement.

**1.2 — A statistical explorer is a p-hacking machine unless it is designed against itself.** This is
the single greatest risk in the brief and it is not mentioned in it. Let users mine 10,000
market/league/condition combinations and ~500 will clear p<0.05 by pure chance. Publish those and we
become a spam factory with mathematics — worse than the tipsters, because we look rigorous. Any
system that offers unlimited slicing **must** carry, structurally: mandatory sample size, effect size
with confidence interval, family-wise error accounting across the study family, and **"insufficient
evidence" as a first-class, publishable, permanently-addressable result** (Art. VII). A research
platform whose explorer cannot return "we looked; there is nothing here" is a marketing tool.

**1.3 — "Historical queries" over current data are lies.** Two biases destroy every retrospective
football study, and both are invisible in the output:
- **Look-ahead bias** — running today's revised data over a past window. Provider corrections,
  re-assigned goals and re-stated xG all leak the future into the past.
- **Survivorship** — filtering by entities that exist *now* silently drops relegated, renamed, merged
  and defunct clubs.

CFD's bitemporality is the only defence, and it is the reason this system is worth building at all:
every historical query executes at `knownAt = T`, seeing **exactly what we knew then, including what
was wrong**. Any study that cannot pin `knownAt` must be refused, not approximated.

**1.4 — "Reproducible forever" collides with data retention, and the promise must degrade honestly.**
FPI §9 may cap raw retention per provider. A study's lineage can outlive the raw it cites. So a Study
carries a **reproducibility class**, and the class is displayed, never hidden:
- `replayable` — every cited input is present; anyone can re-derive it end to end;
- `attested` — inputs are hash-verified against the record but the raw has aged out; the result is
  tamper-evident but no longer re-derivable from source.
A study never silently downgrades: the transition is itself a dated, appended fact.

**1.5 — Do not build a query language.** A DSL is unversionable, unhashable, an injection surface, and
it makes "the same study" undecidable. Use a **bounded, versioned facet grammar** (§3.2): a closed set
of dimensions × operators, serializable to canonical JSON, hashable. Extend it by adding *facets*
(versioned, dated), never by adding *syntax*.

**1.6 — Saved studies are an unbounded URL space pointed at our own crawl budget.** Private by
default, `noindex` unconditionally, never in a sitemap. Promotion is a separate, deliberate,
audited event — not a consequence of a user clicking "save".

---

## 2. What already exists (merge targets, not rebuild targets)

| Asset | Path | Role in this architecture |
|---|---|---|
| Page-type quality contracts | `lib/seo-intelligence/page-types.ts:23` | research page types are **added here**, not to a parallel system |
| Doorway/thin verdicts | `lib/seo/indexability.ts:17` (`doorway_risk`, `thin_content`, `missing_unique_value`) | the admission gate (R7) **extends** these verdicts |
| Thin-content signals | `lib/seo-intelligence/content-quality.ts:5` (`excessive_overlap`, `unsupported_statistics`, `placeholder_values`) | reused verbatim as study-admission signals |
| Search results are already noindex | `lib/seo/indexability.ts:8` | Views inherit exactly this policy |
| Canonical hashing | `lib/evidence/hash.ts:15,32` | study identity hashing — **no second discipline** |
| Append-only store pattern | `lib/archive/evidence/store.ts:38` | the study store (R6) inherits it |
| Entity/edge contracts | `lib/knowledge-graph/entity.ts:24` | entity explorer is a KG projection, not a new graph |
| Search index + entity types | `lib/search/types.ts:2` | already types `player`/`venue`/`referee` as *not yet indexed* — the research corpus is what makes them real |
| Existing filter parsing | `lib/archive/query.ts:9` | the prototype the facet grammar generalizes and replaces |
| CLV / odds movement primitives | `lib/odds-history/closingLineValue.ts`, `movement.ts` | market studies **call** these, never reimplement them |
| Client-only saved fixtures | `lib/research/savedFixtures.ts:6` | today's "saved studies" is a `localStorage` array — the honest starting point, and it is not durable, not shareable, not citable |

**Existing routes that fold in rather than compete:** `/archive`, `/archive/[date]`, `/compare`,
`/compare/[slug]`, `/markets/[slug]`, `/teams/[slug]`, `/competitions/[slug]`, `/seasons`,
`/countries/[code]`. These become **entity hubs that link into the research corpus**; they are not
replaced.

---

## 3. Architecture

```
   CFD projections (bitemporal, as-of)      Evidence archive (frozen decisions)
                │                                        │
                │  read-only, pinned at knownAt          │  link targets only
                ▼                                        ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ R0 QUESTION REGISTRY — the closed set of answerable questions    │
   │ R1 FACET GRAMMAR — bounded, versioned filtering vocabulary       │
   └───────────────────────────────┬──────────────────────────────────┘
                                   ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ R2 PLANNER / EXECUTOR — pure, deterministic, as-of enforced      │
   └───────────────────────────────┬──────────────────────────────────┘
                                   ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ R4 STATISTICAL DISCIPLINE — power, effect size, CI, family-wise  │
   │    error, "insufficient evidence" as a result                    │
   └───────────────────────────────┬──────────────────────────────────┘
                                   ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ R3 STUDY MINT — pin(knownAt, datasetV, methodV, policyV, params) │
   │                 → content hash → immutable Study                 │
   └───────┬──────────────────────────────┬───────────────────────────┘
           ▼                              ▼
   ┌───────────────────┐        ┌──────────────────────────────────────┐
   │ R6 STUDY STORE    │        │ R5 CITATION ENGINE (fail-closed)     │
   │ append-only       │        │ every number → assertion ids+hashes  │
   └───────┬───────────┘        └──────────────────────────────────────┘
           ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ R7 ADMISSION GATE — scarce; extends existing indexability code   │
   └───────┬───────────────────────┬──────────────────────────────────┘
           ▼                       ▼
   R9 PERMANENT RESOLVER    CANONICAL RESEARCH PAGES (indexed, few)
   /research/s/<id> forever        │
           │                       ▼
           ▼                 R8 DATASETS (category-B exports, versioned)
   R10 COMPOSITION (comparison / trend = studies over studies)
```

### 3.1 R0 — Question Registry

Research questions are a **closed, versioned set**, not free text. Each `QuestionType` declares its
subject arity, required facets, minimum sample, output shape, applicable statistics, and comparability
rules. This is what makes every study machine-checkable, hashable, and reproducible.

The brief's five "engines" are **not five systems** — they are question families in one registry:

| Brief item | Realized as | Merges with |
|---|---|---|
| Advanced filtering | R1 facet grammar (every question takes facets) | `lib/archive/query.ts` |
| Historical queries | every question carries a mandatory `knownAt` pin | CFD C5 as-of API |
| Comparison engine | `QuestionType` with subject arity ≥ 2 + comparability contract (§3.6) | Vision RP-8, AF-3 |
| Market studies | question family over odds/CLV/movement facets | Vision RP-5, `lib/odds-history/*` |
| Trend studies | R10 composition: the same question over an ordered `knownAt` series | Vision TP-9 model drift |
| Statistical explorer | the registry's open surface, hard-gated by R4 | — |
| Entity explorer | KG projection (CFD C6) + existing search | Vision KG-4, FX-2 |

Adding a question type is a dated, versioned, reviewed event. There is no "custom SQL" surface, ever
— not as a limitation, but because an unversioned question cannot be reproduced.

### 3.2 R1 — Facet Grammar

```
Facet   := (dimension, operator, value[])          // all three from closed sets
Filter  := Facet[]                                 // AND at top level; OR only within a facet
Grammar := { version, dimensions[], operators[] }  // versioned, dated, append-only
```

Dimensions are CFD aspects (`competition`, `season`, `team`, `venue`, `market`, `stat.xg.home`,
`odds.*`, `standing.position`, `weather.*`, `operator.availability`…). Operators are a closed set
(`eq`, `in`, `between`, `gte`, `lte`, `exists`, `changed_between`). **`changed_between` is the
bitemporal operator** and it is what no competitor can offer: *"fixtures where the provider revised
the score after kickoff"* is a question only a bitemporal store can answer.

Canonical serialization → `evidenceContentHash` → the filter hash is part of study identity.
Grammar versions are frozen: a study minted under grammar v3 replays under v3 forever.

### 3.3 R2 — Planner / Executor

Pure and deterministic: no clock, no randomness, no env (the same rules CFD reducers obey). Reads
**only** CFD projections at the pinned `knownAt`. Bounded by construction — every question declares
its cost class; unbounded scans are a planning error, not a runtime surprise.

**The executor cannot see the present.** Given `knownAt = T`, assertions recorded after `T` are
invisible to it. Look-ahead bias becomes structurally impossible rather than a discipline someone has
to remember.

### 3.4 R4 — Statistical Discipline (the layer that makes this a research system)

Every quantitative study result must carry, or it is not minted:

1. **Sample size** and the population definition (including what was excluded and why).
2. **Effect size with a confidence interval** — never a bare p-value, never a bare percentage.
3. **Power / minimum detectable effect** — if the sample cannot detect the effect claimed, the study
   returns `insufficient_evidence` and says so on its permanent page.
4. **Family-wise error accounting** — the registry knows how many comparisons a question family
   spans; the correction is applied and *disclosed* (the count itself is published).
5. **Pre-registration for promotion** — a study may only become a Canonical Research Page if its
   question and method were registered **before** the result was computed. This is the structural
   defence against publishing whatever the data happened to say. The registration is timestamped and
   permanently addressable, exactly like an evidence snapshot.
6. **Negative results are first-class.** `insufficient_evidence` and `no_effect_detected` are mintable,
   citable, permanent, and promotable. Art. VII, made into a data type. In practice these will become
   some of the most-cited pages we have, because nobody else publishes them.

**Explicitly forbidden by architecture:** significance-only claims, cherry-picked windows (the window
is a pinned facet, visible in the identity), retro-fitted hypotheses (pre-registration), and any
AI-authored finding (Art. XII — AI may narrate a study, never produce one).

### 3.5 R3 — Study identity and the reproducibility contract

```ts
type StudyPin = {
  knownAt: string;        // CFD transaction-time — what we knew, when
  validRange: [string, string] | null;  // the world-time window under study
  datasetVersion: string; // CFD assertion-log version
  grammarVersion: number; // R1
  methodVersion: number;  // R0 question implementation
  policyVersion: number;  // CFD C3 reconciliation policy
};

studyId = "std_" + sha256(canonicalize({ questionType, subjects, filter, pin })).slice(0,32)
```

**The contract, stated as a testable invariant:** re-executing `methodVersion` over `datasetVersion`
at `knownAt` with that filter yields a **byte-identical** result set — today, and in twenty years.
Anything that cannot be pinned cannot enter a study. A study over a live feed is refusable, and is
refused.

Because the id is a hash of the pinned question, **identical research is identical URL**. Two users
who ask the same question of the same data get the same permanent page — deduplication is a property
of identity, not a cleanup job. This is also the anti-doorway mechanism at the identity layer: you
cannot generate a million distinct URLs for the same study by shuffling parameters that don't change
the question.

### 3.6 Comparability (the comparison engine's real problem)

A comparison engine's hard part is not layout — it is **refusing invalid comparisons**. Each
`QuestionType` declares a comparability contract, and R2 refuses when it fails:

- **Provenance-incompatible:** FootyStats xG vs API-Football xG are different models. CFD stores
  `xgModel` with every xG assertion precisely so this refusal is possible. We show both, labelled,
  and refuse to difference them.
- **Sample-incompatible:** 6 matches vs 300 matches is not a comparison; it is a chart that lies.
- **Era-incompatible:** rule changes (VAR introduction, back-pass rule) partition history; the
  registry holds these boundaries as data and warns across them.
- **Unit-incompatible:** per-match vs per-90 vs per-possession.

**Refusals are results.** "These cannot be validly compared, and here is why" is a mintable,
permanent, citable study — and it is more useful than the comparison would have been.

### 3.7 R5 — Citations (fail-closed)

Every number on every research surface resolves to CFD assertion ids + content hashes. Two rules:

1. **A number without a resolvable citation is not rendered.** Not rendered with a warning — not
   rendered. The UI shows the gap honestly. This makes fabricated statistics structurally impossible
   (Art. VIII) rather than a policy someone must uphold.
2. **A citation whose hash no longer verifies raises an integrity alarm** and the surface degrades to
   the `attested` class or refuses. CFD can detect tampering it must never repair.

**External citation format** — designed to be quotable by journalists and machines, the SE-9 backlink
thesis generalized from evidence snapshots to all research:

```
RankWagers Study std_9f3c… "Home xG advantage in the Süper Lig, 2024–2026"
as of 2026-08-01T00:00Z · dataset d41…  · method v3 · replayable
https://rankwagers.com/research/s/std_9f3c…
```

### 3.8 R6 — Study store

Append-only, content-hashed, immutable — reusing the evidence archive's proven store discipline
(`lib/archive/evidence/store.ts:38`), not a new one. A study is never edited. A superseding study is a
new study that *cites* its predecessor (`supersedes`), and the predecessor's URL keeps working and
keeps showing what it always showed, with a forward pointer. Art. VI applied to research output.

### 3.9 R7 — Admission gate (the anti-spam architecture)

**Validity is necessary and not sufficient.** A study is indexable only if it clears all five:

1. **Evidence sufficiency** — passes R4 (power, sample, effect size). Most explorer output dies here.
2. **Corpus uniqueness** — semantic diff against the **already-indexed** corpus on the *result*, not
   the parameters. Two studies with different filters and the same conclusion collapse to one page.
   This directly extends the existing `excessive_overlap` signal
   (`lib/seo-intelligence/content-quality.ts:5`) and the Vision's §2.4 "must differ in ≥ N data
   fields" rule.
3. **Demand or notability** — the question was actually asked (internal search demand, inbound
   citation, entity prominence). A valid study nobody asked is permanent and unindexed. This is
   Art. XI made mechanical: *a page exists because it deserves to exist, not because a keyword does.*
4. **Stability** — the underlying data is settled enough that the conclusion is not an artefact of a
   half-complete season.
5. **Editorial admission against a budget** — indexed research pages are a **scarce, capped resource
   per topical cluster**, not a threshold everyone passes. A gate that admits everything is not a gate.

Everything failing admission remains **permanent, citable, and `noindex`**. Nothing is deleted; the
corpus is complete, and the *indexed* corpus is small. Doorway pages become impossible because the
generator of infinite pages (parameter permutation) is severed from the indexer by identity hashing
(§3.5) and by a capped, demand-driven gate.

**Page-type contracts to add** to `PAGE_TYPE_CONTRACTS` (`lib/seo-intelligence/page-types.ts:23`):

| Page type | Route | Default indexability | Sitemap |
|---|---|---|---|
| `research_explore` | `/{locale}/research/explore` | **NOINDEX** (same policy as search) | no |
| `research_study` | `/research/s/{studyId}` | **NOINDEX** (permanent + citable) | no |
| `research_canonical` | `/{locale}/research/{cluster}/{slug}` | **CONDITIONAL** (R7 verdict) | yes |
| `research_dataset` | `/research/d/{datasetId}` | CONDITIONAL | yes, if promoted |
| `research_collection` | `/research/c/{collectionId}` | **NOINDEX** always (user-generated) | no |

### 3.10 R9 — Permanent URLs

- **Identity URL:** `/research/s/{studyId}` — locale-independent, immutable, resolves forever. Study
  ids are hashes, so they never collide and never need renaming.
- **Human URL:** `/{locale}/research/{cluster}/{slug}` — only for promoted studies. Slugs may change;
  the identity URL never does; the resolver maps both directions permanently.
- **Canonical policy:** promoted → canonical is the human URL, identity URL self-references it.
  Unpromoted → the identity URL is canonical and `noindex`.
- **View URLs** (`/research/explore?…`) carry no canonical, are never in a sitemap, and are `noindex`
  — inheriting the existing search-results policy verbatim.
- **A resolvable id is a permanent obligation.** Retiring a study means marking it superseded, never
  404. This is the same guarantee the evidence archive already makes about snapshots.

### 3.11 R10 — Composition

- **Trend study** = one question, an ordered series of `knownAt` pins → a *belief trajectory*. This is
  the uniquely ownable question type: not "how did Arsenal's xG change" (anyone can compute that from
  current data) but **"how did our knowledge of Arsenal's xG change, and when did the provider revise
  it"**.
- **Comparison study** = one question, subject arity ≥ 2, gated by §3.6.
- **Meta-study** = a study whose inputs are other studies (e.g. calibration of our own published
  predictions across three seasons — Vision FX-3's "research publications" as a *computed* object
  rather than an essay).

Composition is closed: a composed study is itself a Study, with the same identity, citation,
admission and permanence rules. There is no second class of object.

### 3.12 R8 — Datasets

A dataset is the **export of a Study's result set plus its lineage manifest**, versioned and hashed,
addressable at `/research/d/{datasetId}`.

- **Category B only** (FPI §9): our derived interpretation. **Never** raw provider bytes, never a
  reconstruction of a provider's product. This keeps the most valuable commercial surface in the
  legally safest category, which is the same conclusion CFD reached independently.
- Each dataset carries: the study id, the pin, the citation string, a licence, and a hash manifest so
  a downloader can verify integrity years later.
- Datasets are the substrate for Vision FX-1 (public API) and the licensing thesis in N4 — and they
  are *derived from studies*, so an exported dataset is reproducible by definition.

---

## 4. Saved studies

Three tiers, deliberately distinct, because conflating them is how research platforms become spam:

| Tier | Object | Visibility | Indexable | Citable |
|---|---|---|---|---|
| **Workspace** | pinned Views, notes, drafts | private | never | no |
| **Collection** | an ordered, titled set of Study ids | private → optionally unlisted-shareable | **never** | yes (the studies are; the collection is not) |
| **Promoted** | a Collection admitted through R7 | public | conditional | yes |

Today's `SavedFixtureRecord` (`lib/research/savedFixtures.ts:6`) is a client-only `localStorage`
array: not durable, not shareable, not citable. It becomes the Workspace tier — honest about what it
is — and Collections are the durable server-side successor. Critically, **saving is not publishing**:
no user action can create an indexable URL.

---

## 5. Milestones

R-series, to avoid collision with CDB / FPI / RP / SE / KG / FX numbering. Each is independently
revertible and none blocks the frozen roadmap.

| # | Milestone | Exit criteria |
|---|---|---|
| **R-M0** | Contract freeze | study identity, pin set, reproducibility classes, admission gate ratified by independent review |
| **R-M1** | Question Registry + Facet Grammar v1 | grammar serializes → hashes → round-trips; adding a facet is versioned and dated |
| **R-M2** | Planner/executor over CFD projections | executor provably cannot read assertions recorded after `knownAt` |
| **R-M3** | Statistical discipline layer | `insufficient_evidence` is mintable and renders as a first-class result; family-wise counts published |
| **R-M4** | Study mint + store | re-execution yields byte-identical results; store rejects mutation |
| **R-M5** | Citation engine | a number with an unresolvable citation is provably not rendered |
| **R-M6** | Permanent resolver | every minted id resolves forever; supersession never 404s |
| **R-M7** | Admission gate | extends existing indexability/thin-content verdicts; index budget enforced per cluster |
| **R-M8** | Explorer UI (Views) | noindex, no canonical, never in sitemap — verified by the existing SEO audit |
| **R-M9** | Comparison + comparability refusals | incomparable metrics are refused with a citable explanation |
| **R-M10** | Trend / belief-trajectory studies | provider-revision trajectories reproduce from CFD bitemporal history |
| **R-M11** | Collections (saved studies) | no user action can produce an indexable URL |
| **R-M12** | Datasets + export manifests | third party can verify a downloaded dataset against its hashes |
| **R-M13** | Canonical research pages | first promoted studies pass pre-registration + admission; cluster budget respected |

---

## 6. Dependencies

**Hard:**
- **CFD C4/C5** (bitemporal projections + as-of API). Without point-in-time correctness there is no
  honest historical query, and R-M2 onward cannot start. **This is the gating dependency for the
  entire system.**
- **CFD C3 `policyVersion`** — pinned in every study; a reconciliation policy change must not silently
  alter a published result.
- **Evidence archive** — link targets for prediction/settlement citations. Read-only, untouched.
- **Existing SEO gate code** — R7 extends it; if it is bypassed, the anti-spam guarantee is void.

**Soft:**
- FPI §9 licensing → dataset licensing (R8) and reproducibility-class expiry.
- FPI L4 provider reliability → a rich question family (provider revision rates) that only this system
  can express.
- Vision N5 / FX-4 Verification Portal → the public face of the reproducibility contract; R3's
  invariant is what it verifies.

**Explicit non-dependency:** the AI layer. AI may narrate a study; it may never author, rank, or
promote one. Removing AI entirely must leave the research system fully functional.

---

## 7. Migration path

**Phase A — Read-only shadow.** Build registry, grammar and executor; run questions against CFD in
shadow. No public surface. Compare outputs against existing `/archive` filters
(`lib/archive/query.ts:9`) to prove equivalence before replacing anything.

**Phase B — Explorer as a View surface.** Ship `/research/explore` as noindex, no minting. Users
explore; nothing is permanent yet. This is where the facet grammar earns or loses its design.

**Phase C — Minting.** Enable Study minting and permanent URLs. Citations become possible. Still
zero indexed research pages.

**Phase D — Admission.** Turn on R7 with a deliberately tiny cluster budget. Promote the first
studies. Measure whether they earn links and demand before raising the budget — never the reverse.

**Phase E — Absorption.** Existing surfaces fold in: `/archive` becomes a study family, `/compare`
becomes comparison studies, RP-6 similar matches becomes a question type, SE-9/SE-10 become promoted
study clusters. **They are not deleted** — their URLs remain and gain reproducibility.

**Rollback:** flags off. Views vanish, Studies remain permanent (they are immutable and citable
regardless of surface), indexed pages revert to `noindex`. Nothing is lost, because nothing was ever
mutable.

---

## 8. What this architecture refuses to build

- ❌ **A query language.** Bounded, versioned facet grammar only.
- ❌ **User-generated indexable pages.** Saving is not publishing.
- ❌ **A page per parameter permutation.** Identity is a hash of the *question*, so equivalent
  questions collapse to one URL.
- ❌ **Bare p-values or significance-only claims.** Effect size + CI + power, or `insufficient_evidence`.
- ❌ **Post-hoc promoted findings.** Pre-registration precedes promotion.
- ❌ **AI-generated research.** AI narrates; evidence decides (Art. XII).
- ❌ **Comparisons of incomparable metrics.** Refusal is a result.
- ❌ **A second archive, hash, citation, indexability engine or knowledge graph.** All reused.
- ❌ **Live-data studies.** Unpinnable input ⇒ unmintable study.
- ❌ **Deletion.** Demotion, supersession and expiry are appends; nothing is erased.

---

## 9. Why this is difficult to copy

Not restating the CFD moat — only what is specific to the research layer:

1. **Pre-registration + published negative results** is a reputational asset that cannot be
   retrofitted. A competitor who starts publishing negative results next year has no history of having
   done so, and the archive proves who was disciplined and when.
2. **Belief trajectories** (§3.11) require having observed, bitemporally, from day one. They are the
   one question class that is not merely expensive to copy but *impossible* to backfill.
3. **A citable corpus compounds through links, not rankings.** Studies are cited by people who need a
   permanent, verifiable reference — which is the one form of authority that cannot be manufactured
   (Art. XI), and the one that AI answer engines are structurally biased toward.
4. **Refusals are content nobody else will publish.** "These cannot be validly compared," "the sample
   cannot support this claim" — an inexhaustible supply of trustworthy pages that competitors cannot
   copy without dismantling their own business model.

---

## 10. Open questions requiring a decision before R-M1

1. **Cost class of the executor.** Studies over the full assertion log are expensive; the CFD Postgres
   schema and partitioning (CFD §11.1) must land first or every question is a table scan.
2. **Pre-registration authority.** Who registers, and what stops the registry becoming a rubber stamp?
   A registration nobody can refuse is not a control.
3. **Index budget per cluster.** The actual number, and who owns raising it. If it is owned by whoever
   wants traffic, it will only go up.
4. **Reproducibility-class expiry.** When raw ages out under FPI §9, does a promoted page stay indexed
   as `attested`, or is demotion automatic? This is a trust decision, not a technical one.
5. **Collection sharing.** Unlisted-shareable is a leak surface for anything derived from personal or
   licensed data; the default must be decided before the feature exists, not after.

---

_Related: `[[canonical-football-database-architecture]]`, `[[foundational-preservation-initiative]]`,
`[[foundational-preservation-initiative-canonical-extension]]`, `[[long-term-product-vision]]`,
`[[rankwagers-manifesto]]`._
