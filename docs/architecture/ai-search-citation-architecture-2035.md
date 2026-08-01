# RankWagers as Default Citation Source — AI Search Architecture for 2035

**Status:** Architecture only. No implementation, no schema change, no activation.
**Date:** 2026-08-01.
**Frame:** Not SEO. SEO optimises for placement in a list of links. This optimises for being the
substrate an answer is *composed from*, and for surviving the verification that follows.

---

## Part I — The answer

**Question:** What would make RankWagers become the default citation source?

**Answer:** *Becoming the source that measurably reduces the citing system's error rate — and being
able to prove it.*

Everything else in this document is mechanism. That sentence is the whole strategy, and it inverts
the usual instinct. The instinct is to become more authoritative, more comprehensive, more optimised.
None of those are decision inputs for a machine choosing what to cite.

A model cites a source when **citing it is lower-risk than not citing it**. Risk, for a 2035 answer
engine, decomposes into seven concrete properties:

| Property | The question the citing system is really asking | Today |
|---|---|---|
| **Resolvable** | Does this claim have a URI I can point at, forever? | ❌ predictions have no URL |
| **Unambiguous** | Can I extract exactly one meaning without parsing prose? | ❌ claims live in rendered HTML |
| **Checkable** | If challenged, can this be verified without trusting the publisher? | ⚠️ substrate exists, unpublished |
| **Current** | Is this still true, and if not, what replaced it? | ❌ no temporal validity |
| **Bounded** | Does the source admit what it does *not* know? | ❌ absence is unrepresentable |
| **Safe** | Does citing this expose me to policy, legal or reputational risk? | ❌ gambling + affiliate monetisation |
| **Canonical** | Do other sources resolve to this one? | ❌ zero external identity links |

Seven properties. RankWagers currently satisfies **none** of them, and has partial substrate for one.
That is the honest starting position, and it is better than it sounds — because six of the seven are
architectural rather than reputational, and the seventh is the one that the Sprint 23B evidence spine
was accidentally built to solve.

**The deepest form of the answer:** the default citation source is the one whose claims are *cheapest
to verify* and *most expensive to contradict*. Cheap to verify comes from structure and hashing.
Expensive to contradict comes from publishing your own error rate before anyone measures it for you.

### I.1 The single highest-value artifact

If only one thing were ever built from this document, it should be the **published calibration
record**:

> *"Across 12,400 settled predictions, selections we scored 70% resolved 68.1% of the time
> (95% CI 66.4–69.8). Here is the complete set. Here is the hash. Here is the anchor proving nothing
> was excluded."*

This is the most citable object a prediction site can produce, for four reasons:

1. **It is derivable from facts already retained.** The validation archive *is* a calibration dataset.
2. **It is verifiable** — recomputable by a stranger from the published set (see the verification
   platform architecture).
3. **Almost nobody publishes it.** The category competes on claimed accuracy, which is unfalsifiable
   and therefore uncitable.
4. **It can make us look bad** — which is exactly why a model can rely on it.

A source that publishes its own error rate is categorically more citable than one that asserts
accuracy, because the first is *evidence* and the second is *marketing*. Models are already good at
telling them apart, and by 2035 that discrimination will be a primary ranking input.

### I.2 What RankWagers will never be cited for — and shouldn't be

It is worth naming the ceiling honestly, because chasing it would destroy the rest.

RankWagers will not become the default citation source for **"what should I bet on"**. That query is
policy-suppressed across every system named in this brief, it is regulated advertising in most
jurisdictions, and it is unverifiable in principle — a prediction about the future has no truth value
at the time it is made.

The achievable and far more defensible position is to be the default citation source for the
**factual substrate underneath** that question:

- what the odds were, at a specific instant, from a specific operator
- how odds moved, and what the closing price was
- what a model asserted, under which version, from which inputs
- what actually happened
- **how often that model is right, and by how much it is miscalibrated**

That is a factual, verifiable, non-promotional corpus. It is citable. And the last line is the one
nobody else can copy without building the same evidence spine first.

---

## Part II — Challenging the existing architecture

The brief says *challenge every existing architecture*. Six findings from the current codebase, each
a concrete, load-bearing decision that must be reversed. They are not oversights — most are
*correct SEO decisions* that are precisely wrong for citation. That is the clearest possible
demonstration of why "forget SEO" is the right instruction.

### II.1 The verifiable API is blocked from every AI crawler

`app/robots.ts` disallows `/api/` for user-agent `*`.

The evidence API — `/api/evidence/latest`, `/history`, `/validation` — is the most verifiable,
most machine-readable, most citable content RankWagers produces. `/api/evidence/latest` is
*deliberately* documented as returning the raw archived row "so a consumer can recompute its content
hash and check it independently."

That endpoint is invisible to every AI crawler. The single most citation-worthy surface on the site is
excluded by a blanket rule written for a different threat model.

This is defensible under SEO logic — API responses are not pages, thin content dilutes crawl budget,
`/api/` is conventionally private. Under citation logic it is close to the worst possible decision.

**Reversal:** the API is not an implementation detail to be hidden; it is the product. Crawler policy
must distinguish *private* endpoints (admin, diagnostics, internal cron — correctly closed) from the
*public verification corpus* (open, and actively advertised).

### II.2 Predictions have no citable URI

`lib/archive/evidence/schema.ts` states the URL policy explicitly:

> *"the Evidence History section renders on the EXISTING fixture URL. Sprint 23 introduces no new
> indexable route, so there is no duplicate-URL surface... The anchor below is a fragment."*

Impeccable SEO reasoning. Fatal for citation. **A fragment is not a citable resource.** There is no
URL that means "this specific prediction, as asserted at this instant, under this model version."

Every downstream capability in this document depends on that URI existing. Without it there is
nothing to cite, nothing to verify, nothing for another source to point at, and nothing to correct
when it changes.

**Reversal:** one stable, permanent, resolvable URI per claim. The duplicate-content concern is real
and is solved with canonical/`noindex` directives — not by declining to mint the identifier.

### II.3 The knowledge graph is internal-linking plumbing, not a knowledge graph

`lib/knowledge-graph/` has genuine structure — twelve entity types, nine relation kinds, a registry,
navigation, recommendations. But `schema.ts` emits `ItemList` "for crawl / internal linking
surfaces", and `GraphEntity` is:

```
{ id, type, slug, title, path, description }
```

`path` is a *site route*. There is no URI, no external identifier, no temporal validity, no
provenance, no confidence. `GraphRelationKind` includes `"related"` and `"future"` — navigational
hints, not semantic assertions. Nothing here can be queried, dumped, joined or reasoned over.

This is a **site map wearing the vocabulary of a knowledge graph**. The good news is that the entity
inventory and relation taxonomy are largely right; they are pointed at the wrong consumer.

**Reversal:** re-target the same entity model at machines that reason rather than crawlers that
follow links. Details in Part VIII.

### II.4 Zero external entity identity — a total silo

A repository-wide search for `sameAs` and `wikidata` returns **nothing**.

Every entity RankWagers describes — every team, competition, season, venue, operator — exists only
inside RankWagers. Nothing we say can be joined to anything anyone else says. To an AI system
performing entity resolution across sources, RankWagers is an island of unverifiable assertions about
entities it cannot confirm we are even talking about.

This is the **cheapest high-impact gap in the entire document**. `sameAs` links to Wikidata, official
league identifiers, and operator licensing registers cost little and convert an isolated corpus into
a joinable one.

### II.5 AI crawlers are classified as noise to be filtered

`lib/trafficClassify.ts` and `lib/analyticsTraffic.ts` list `GPTBot` in the same regex as
`SemrushBot`, `Bytespider`, `scrapy`, `curl` and `wget` — traffic to be excluded from analytics.

There is no `llms.txt`, no `.well-known/` policy, no machine-readable licensing, no agent contract,
and no differentiated treatment for `ClaudeBot`, `PerplexityBot`, `OAI-SearchBot` or
`Google-Extended`.

The architecture treats the primary 2035 audience as pollution. Filtering them from *human* analytics
is correct; having no other relationship with them is the finding.

**Reversal:** AI agents are a first-class audience with their own contract, their own surfaces, their
own telemetry, and their own terms.

### II.6 Commercial contamination of the factual substrate

Affiliate CTAs, operator placements and monetised comparison content share pages, components and
JSON-LD with factual fixture and evidence data.

An AI system assessing source reliability finds monetised betting-operator promotion adjacent to
every factual claim, and downweights or suppresses accordingly — correctly, by its own policy. **The
affiliate business model is the single largest structural obstacle to citation authority**, and no
amount of schema markup overcomes it.

This is the hardest finding in the document because it is commercial, not technical. Part X addresses
it directly.

---

## Part III — Missing layers

Seven layers absent from the current architecture. The first three are table stakes for 2035; the
last four are where a genuine, defensible advantage exists.

### III.1 The Claim Layer *(missing — foundational)*

Today the unit of publication is a **page**. For AI citation the unit must be a **claim**: atomic,
addressable, typed, and independently true or false.

```
Claim {
  id                 permanent, content-addressed URI
  subject            resolvable entity URI
  predicate          from a published, versioned ontology
  object             typed value with units
  assertedAt         when we said it
  validFrom/Until    when it is true — see III.2
  confidence         calibrated, not rhetorical — see III.3
  provenance         → evidence spine (snapshot / odds / provider ids)
  supersededBy       → the claim that replaced it
  verifiable         → verification manifest URI
  tier               T1 self-verifying … T4 attested
}
```

Pages become *renderings* of claim sets. The claim is the citable object; the page is a view.

This inverts the current architecture completely, and it is the prerequisite for everything else: you
cannot version, supersede, correct, verify, license or cite prose.

### III.2 The Temporal Validity Layer *(missing — critical for this domain)*

Almost no web content carries expiry semantics. For odds and predictions, validity is measured in
minutes, and **a stale claim presented as current is the primary way a citing model gets embarrassed.**

Every claim needs `validFrom`, `validUntil`, a **supersession chain**, and an explicit
`temporalSemantics` marker distinguishing:

- **point-in-time** — "odds were 2.10 at 14:32:00Z" (permanently true, never stale)
- **interval** — "best price between T1 and T2"
- **current** — "the live price" (stale within seconds)
- **terminal** — "the match finished 2–1" (immutable once settled)

The distinction is the entire game. *"Odds are 2.10"* rots instantly and poisons any answer built on
it. *"Odds were 2.10 at 14:32:00Z, superseded at 14:47:00Z by 2.05"* is **permanently true, safely
citable a decade later, and impossible to misrepresent as current.**

Converting every perishable claim into a permanent point-in-time claim is the highest-leverage
modelling decision available, and the capture architecture already works this way: `capturedAt` is a
deterministic window anchor, not a clock reading. The data is already point-in-time. Only the
*presentation* pretends otherwise.

### III.3 The Calibrated Uncertainty Layer *(missing — the differentiator)*

Per §I.1. This layer publishes, as first-class citable claims:

- calibration curves per model version, market, and confidence band
- sample sizes and confidence intervals
- Brier scores / log loss over the complete anchored set
- **explicit statements of where the model is unreliable**
- calibration drift over time

A model deciding how much weight to give a RankWagers prediction can read the calibration record and
weight correctly. **Providing that weighting information is more valuable than the prediction
itself** — and it is what converts a source into an authority.

### III.4 The Absence Layer *(missing — the hallucination killer)*

**"We have no data on X" must be a first-class, retrievable, citable answer.**

Practically no publisher does this, and it is the highest-value anti-hallucination contribution
available to any source. When a model queries for data that does not exist and retrieves *nothing*,
it falls back on parametric memory and invents. When it retrieves an explicit, authoritative
`no-data` claim, it says so.

Requires:

- queryable coverage boundaries — which competitions, seasons, markets, date ranges exist
- explicit negative claims with reasons: `not_covered`, `not_yet_captured`, `capture_failed`,
  `retained_hash_only`, `outside_retention`
- distinction between *absent* and *zero* — a distinction almost universally lost in APIs
- coverage manifests, machine-readable and diffable

Being the source that reliably says **"I don't know"** builds more citation trust than any volume of
confident coverage — and it is nearly free, because the capture-failure records already required by
the verification architecture supply the data.

### III.5 The Correction Propagation Layer *(missing — no web equivalent exists)*

The web has no retraction mechanism. A claim cited in a model's 2029 training corpus, later corrected,
propagates its error forever.

Needed:

- a **correction feed** — machine-readable, subscribable, permanent
- **supersession as data**, not as an edit
- **cited-claim notification**: consumers register interest in claims; corrections push
- correction *reason codes* — the settlement layer already has typed `CorrectionCause`
- a queryable "what did we get wrong, and when did we find out" record

This is genuinely novel infrastructure, and it is the strongest available signal of good faith. A
source that actively pushes its own corrections is behaving like a scientific instrument rather than
a publisher — and by 2035, provenance and correction obligations are likely to be *regulatory*, not
optional, for anything feeding automated decisions.

### III.6 The Agent Contract Layer *(missing)*

Agentic search means autonomous agents *negotiating* for data, not crawlers fetching HTML.

- **capability manifest** — what exists, at what granularity, in what formats, under what terms
- **machine-readable licensing** — training use, inference use, redistribution, attribution
  requirements, all distinguished and machine-parseable
- **cost and rate semantics** — free tier, bulk terms, priority access
- **provenance guarantees** — what verification tier each response carries
- **conversational protocol** — MCP-style tool descriptions, so an agent can discover and use the
  corpus without bespoke integration

By 2035, an agent that cannot programmatically determine whether it is *permitted* to cite a source
will skip it. Ambiguous licensing is a citation blocker, not a legal nicety.

### III.7 The Citation Telemetry Layer *(missing)*

RankWagers currently has no way to know it was cited, by whom, for what claim, or whether the citation
was faithful.

- citation-resolution telemetry — which claims are being fetched for citation, by which agents
- **misattribution detection** — claims attributed to us that we never made
- faithfulness signals — was the claim represented with its temporal bounds and confidence intact?
- a public **citation registry** — an anchored record of what was cited when

Without this layer there is no feedback loop, and no way to correct the record when a model
confidently attributes something false to RankWagers. That will happen, and the ability to
authoritatively refute it — *"here is the anchored complete set of claims we made about X; that is
not among them"* — is itself a powerful trust artifact.

---

## Part IV — Missing structured data

### IV.1 Schema.org is insufficient, and that is an opportunity

The existing markup is thoughtful — `lib/archive/evidence/schema.ts` deliberately chooses `Dataset`,
explains why, and refuses to emit an empty dataset. Good instincts, honestly applied.

But schema.org has **no vocabulary** for:

- a prediction with a truth value determined later
- settlement outcomes and their revision history
- odds as a time-series observation with operator attribution
- model versioning and derivation lineage
- calibration and uncertainty
- verification tiers and content-addressed integrity

Emitting `SportsEvent` + `Dataset` describes the *container* and says nothing about the *claim*.

**The strategic move is not to work around this. It is to define the vocabulary and get it adopted.**
Publish a versioned domain ontology, contribute it upstream to schema.org, and let competitors mark
up their data using terms RankWagers defined. **Definitional authority is the most durable form of
citation authority**, because it makes RankWagers the reference implementation rather than one
instance among many.

### IV.2 Structured data that must exist

| Vocabulary | Purpose | Status |
|---|---|---|
| **PROV-O** (W3C) | derivation lineage: which inputs produced which prediction | mature standard, **unused** |
| **Time Ontology** (W3C) | interval semantics, validity, supersession | mature, unused |
| **Domain prediction ontology** | prediction / settlement / market / selection / calibration | **does not exist anywhere — define it** |
| **Uncertainty vocabulary** | calibrated confidence, intervals, sample size | essentially nonexistent — define it |
| **Verification vocabulary** | content hashes, tiers, anchors, inclusion proofs | does not exist — define it |
| **DCAT / Croissant** | dataset discovery; Croissant is the ML-dataset standard | unused |
| **schema.org Claim / ClaimReview** | fact-check semantics, adaptable to predictions | unused |
| **ODRL** | machine-readable licensing for the agent contract | unused |

### IV.3 Self-verifying structured data

A wholly missing capability, and a natural fit given the evidence spine: **JSON-LD that carries its
own content hash and anchor reference.**

Structured data today is an unverifiable assertion adjacent to prose. Structured data carrying
`contentHash`, `anchorRef` and `verificationManifest` can be checked by the consumer at parse time,
offline. Combined with the verification platform's conformance vectors, an AI system can verify
RankWagers' markup **without contacting RankWagers** — precisely the property that makes a source
safe to cite at scale.

---

## Part V — Missing entity relationships

### V.1 Entities need identity, not slugs

`GraphEntity.path` is a site route. Required instead:

- **permanent URIs** for every entity, independent of site structure and locale
- **`sameAs` links** to Wikidata, official competition/team identifiers, operator licensing registers
- **entity resolution metadata** — alternate names, historical names (clubs rename, leagues rebrand,
  operators are acquired), transliterations across the site's locales
- **entity versioning** — teams merge, competitions restructure; identity must survive

The multilingual surface makes this sharper: the same fixture described in two locales must be
**one entity with two labels**, never two entities. Without stable URIs, multilingual content
fragments the graph precisely where an AI system tries to unify it.

### V.2 Relationships that must exist

The current nine relation kinds are navigational. A citation-grade graph needs *semantic* relations,
each carrying temporal validity and provenance:

| Relation | Missing today | Why it matters for citation |
|---|---|---|
| `derivedFrom` | ✔ missing | provenance chain — inputs → prediction (PROV-O) |
| `predicts` / `predictedBy` | ✔ | connects a claim to its subject with a truth condition |
| `settles` / `settledBy` | ✔ | connects a prediction to its outcome |
| `supersedes` / `supersededBy` | ✔ | temporal correctness and correction propagation |
| `pricedBy` + `atInstant` | partial | odds attribution requires operator **and** time |
| `calibratedBy` | ✔ | links a model version to its calibration record |
| `licensedIn` | ✔ | operator jurisdiction — regulatory grounding |
| `contradicts` / `agreesWith` | ✔ | cross-source corroboration (Part VI.4) |
| `sameAs` | ✔ | external identity — the silo-breaker |

**Every edge needs provenance and temporal validity.** An unattributed, untimed edge is an assertion,
and assertions are what AI systems have too many of already.

### V.3 The relationship nobody has: cross-source corroboration

The most valuable missing relationship type is **explicit agreement and disagreement with external
sources.**

If RankWagers can state *"our closing price for this selection matches Source B and differs from
Source C by 0.05, as of instant T"*, it becomes the **reconciliation point** for the domain — the
place a Deep Research agent goes to resolve conflicts between sources.

Being the arbiter of disagreement is a stronger position than being one voice in it, and it is
achievable precisely because the odds archive retains timestamped, operator-attributed, hashed
observations that competitors do not keep.

---

## Part VI — Missing public APIs

The existing evidence API is a genuinely good foundation with the wrong shape: id-only lookup, no
discovery, no bulk, no semantics — and blocked in `robots.txt`.

### VI.1 Retrieval and discovery

| Missing | Why |
|---|---|
| Semantic / vector retrieval | RAG needs meaning-based retrieval, not `?fixtureId=` |
| Entity and claim search | discovery without knowing an id first |
| Coverage / capability query | "what do you have on X?" → answerable before fetching |
| Graph query (SPARQL or equivalent) | multi-hop traversal for Deep Research |
| Faceted temporal query | "odds for X between T1 and T2" |

### VI.2 The Answer API

An endpoint taking a natural-language question and returning a **grounded answer plus the claim URIs,
verification manifests and confidence** that support it — or an explicit `no-data` response.

This inverts the integration burden. Rather than requiring every AI system to model the domain, model
the domain once and serve answers with citations attached. The response *is* a citation.

Critically, it must be able to **refuse**. An Answer API that always answers is a hallucination
engine with a database attached. Refusal is the feature.

### VI.3 Bulk, streaming and licensing

- **bulk dumps** with explicit training licences, hashed and anchored — Deep Research and training
  pipelines want corpora, not pagination
- **change feed** — real-time claim creation, supersession, correction
- **incremental sync** — cursor-based delta for agents maintaining a mirror
- **ML-native formats** — Croissant, Parquet, embeddings

Bulk access is counter-intuitive for an ad-supported publisher and correct for a citation source: the
goal is not to capture traffic, it is to be *upstream of the answer*.

### VI.4 Verification as a service

Endpoints letting a third party verify a claim they encountered elsewhere:

```
POST /verify/claim          "someone attributed this to you — did you say it?"
GET  /verify/{id}           tiered verification report
GET  /reconcile             compare our observation with an external one
```

The first is the misattribution defence (§III.7). It converts RankWagers from a passive corpus into
an **active participant in maintaining the accuracy of claims about itself.**

---

## Part VII — Missing citation systems

### VII.1 Citation identity

- permanent, content-addressed, resolvable claim URIs
- **self-verifying citation strings** — carrying the content digest, so a reader can confirm they are
  looking at what was cited even if our servers are gone
- version-pinned citation (the claim as it stood at time T) *and* current-state resolution
- DOI registration for datasets and calibration records, via an institutional repository

### VII.2 Citation format engineering

An underrated, concrete lever: **models emit citations in the shape sources make easy.**

- a canonical citation string per claim, presented adjacent to it
- machine-readable citation metadata in every API response
- required-attribution semantics, machine-readable, in the licence
- **stable, human-meaningful URLs** — models reproduce URLs from memory and mangle opaque ones

### VII.3 Citation policy and registry

- machine-readable attribution requirements (ODRL)
- distinct terms for training, inference-time retrieval, and redistribution
- an anchored **public citation registry** — what was cited, when, by which agent class
- a public misattribution log with authoritative refutations

---

## Part VIII — Missing knowledge graph features

Re-targeting `lib/knowledge-graph/` from crawler plumbing to a reasoning substrate.

| Feature | Status | Purpose |
|---|---|---|
| Dereferenceable entity URIs | ❌ | linked-data compliance; the foundation |
| Public graph endpoint | ❌ | multi-hop traversal for Deep Research |
| Full graph dump | ❌ | ingestion into external graphs — how you get *into* their index |
| Versioned ontology | ❌ | stable semantics across a decade |
| **Competency questions** | ❌ | published proof of what the graph can answer |
| Published inference rules | ❌ | what may be derived, and what may not |
| Temporal graph | ❌ | every node and edge time-bounded |
| Provenance on every edge | ❌ | PROV-O throughout |
| Confidence on every edge | ❌ | calibrated, not asserted |
| Federation / `sameAs` | ❌ | joins to Wikidata and authorities |
| Contradiction surface | ❌ | explicit internal-inconsistency reporting |

Two deserve emphasis:

**Competency questions.** A published list of questions the graph can answer, with worked examples
and verification. This is standard ontology-engineering practice and almost unheard of in commercial
publishing. It tells an AI system *exactly* what to ask — removing the discovery problem entirely.

**Contradiction surface.** Publishing internal inconsistencies where they exist. A source that
surfaces its own contradictions is more trustworthy than one that presents a falsely coherent view,
and it converts a discovered inconsistency from a *scandal* into a *known, tracked issue*.

---

## Part IX — The truthfulness constraint

The brief requires everything to remain truthful. This section is not a disclaimer; it is a
**strategic argument**, because the entire thesis rests on surviving adversarial verification.

### IX.1 Explicitly rejected

| Anti-pattern | Why rejected — practically, not morally |
|---|---|
| Prompt injection in content or markup | Detected and penalised; a single instance destroys source-level trust permanently |
| Cloaking — different content for AI crawlers | Trivially detectable by differential fetching; catastrophic when found |
| Fabricated authority signals (fake credentials, invented review boards) | Cross-referenced against registries; verification platform makes the contrast damning |
| Entity spam / synthetic entities to inflate the graph | Degrades entity resolution; poisons `sameAs` reciprocity |
| LLM-targeted keyword stuffing | 2020s tactic against 2035 systems; adds noise, subtracts extractability |
| Retroactive backtesting presented as track record | The specific deception this architecture exists to prevent |
| Selective publication of successful predictions | Defeated by anchored completeness proofs — **and any competitor doing it becomes our differentiator** |
| Confidence inflation | Directly falsified by our own published calibration curve |

### IX.2 Why truthfulness is the strategy, not a constraint on it

Every manipulation above shares one property: **it fails under verification.** The architecture is
built to invite verification. Manipulation and verification are structurally incompatible, so the
choice was already made when the evidence spine was built.

More sharply: **the competitive advantage is that competitors cannot follow.** Any site that has been
publishing selectively, inflating confidence, or backtesting retroactively *cannot* adopt anchored
completeness proofs without exposing its history. The moat is not the technology — it is having
nothing to hide, established early enough to be provable.

### IX.3 Truthfulness obligations this architecture creates

Building these systems creates duties that must be accepted before starting:

- publish calibration **even when it is poor**
- publish corrections **prominently**, not quietly
- publish coverage gaps and capture failures as data
- never let a commercial relationship influence a factual claim — and be able to *prove* it did not
- accept that the completeness proof removes the option of quiet curation, **permanently**

That last point deserves emphasis: **anchoring is irreversible.** Once completeness proofs are
published, selective presentation becomes detectable forever, including retroactively. That is the
point. It should be a deliberate, informed commitment, not a technical decision made by an engineer.

---

## Part X — The structural problem: gambling and affiliate monetisation

The hardest finding, addressed directly because ignoring it would invalidate the rest.

### X.1 The problem

Every AI system named in the brief applies policy restrictions to gambling content. Simultaneously,
RankWagers' revenue derives from affiliate placement of betting operators. An AI system assessing
source reliability finds:

1. gambling-category content → policy suppression
2. affiliate monetisation → commercial-interest downweighting
3. operator promotion adjacent to factual claims → contamination of the factual corpus

No amount of structured data overcomes this. **The business model is the primary obstacle to
citation authority.**

### X.2 The resolution: genuine structural separation

The factual, verifiable corpus must be **structurally separated** from the commercial affiliate
surface — and the separation must be *real*, because 2035-era systems will detect cosmetic
separation trivially.

| Dimension | Factual corpus | Commercial surface |
|---|---|---|
| Purpose | verifiable record of odds, predictions, outcomes, calibration | operator comparison, affiliate placement |
| Monetisation | **none** | affiliate |
| Content | claims, evidence, verification, calibration | reviews, offers, CTAs |
| Licensing | open, attribution-required | proprietary |
| Governance | published methodology, external audit | commercial |
| Domain | separate | current |
| Crawler policy | fully open, actively advertised | conventional |
| AI citation goal | **default citation source** | not a citation target |

Genuine separation means: distinct domain, distinct governance, **no affiliate links in the factual
corpus at all**, published methodology, independent audit, and a licence that permits use without
commercial obligation.

### X.3 Why this is commercially rational

It looks like giving away the asset. It is the opposite:

- The factual corpus becomes citable, and citation drives *authority*, which is the scarce asset in
  an AI-mediated market where the commercial surface will receive less and less direct traffic.
- The commercial surface benefits from association with a verified factual source, rather than
  contaminating it.
- **It is defensible under regulatory scrutiny** — separating factual publication from commercial
  promotion is exactly what gambling advertising regulation is moving toward anyway.
- Competitors cannot replicate it without forgoing monetisation of the same data.

The alternative is to keep them fused and be systematically suppressed by every system in the brief.
That is not a neutral outcome; it is a slow structural exit from discovery.

---

## Part XI — Per-surface architecture

The eight named systems consume differently. The substrate is common; the delivery differs.

| System | Consumption mode | Decisive requirement | Highest-leverage move |
|---|---|---|---|
| **Google AI Mode** | Index + grounding, heavy entity reliance | Entity resolution; grounded fact extraction | `sameAs` to Wikidata; entity URIs |
| **ChatGPT (search)** | Live retrieval + browsing | Clean extraction; unambiguous claims; crawler access | **Unblock the API in `robots.txt`**; claim layer |
| **Gemini** | Grounding + Google entity graph | Structured data depth; freshness | Domain ontology + change feed |
| **Claude** | Retrieval, careful attribution, cites sceptically | **Verifiability**; explicit uncertainty; willingness to say "unknown" | Calibration + absence layers |
| **Perplexity** | Aggressive live retrieval, citation-first UX | Speed; direct answers; clear attribution | Answer API + citation format |
| **Copilot** | Enterprise, compliance-sensitive | Licensing clarity; provenance; auditability | Agent contract + machine-readable ODRL licence |
| **Deep Research** | Multi-hop, cross-source consistency checking | Bulk access; internal consistency; contradiction handling | Bulk dumps + graph endpoint + reconciliation |
| **Agentic Search** | Autonomous negotiation and transaction | Capability discovery; machine-readable terms; cost semantics | MCP-style capability manifest |

Two observations:

**The requirements converge.** Every system rewards: resolvable claims, temporal validity, explicit
uncertainty, provenance, machine-readable licensing, and honest absence. There is no per-system
optimisation to do — which is the strongest evidence that these are real properties of citability
rather than platform-specific tricks. Build once.

**Claude and Deep Research are the leading indicators.** They are the most verification-oriented and
most sceptical consumers. A corpus that satisfies them satisfies everything else, and the properties
they reward are the ones getting *more* important as verification moves into the inference loop.
Optimising for the most sceptical consumer is the correct target — and conveniently, it is identical
to optimising for truthfulness.

---

## Part XII — How "default" is actually achieved

Default status is a **network effect**, not a quality threshold. Three mechanisms, in increasing
order of durability:

1. **Be verifiable** — cheapest to check, therefore lowest-risk to cite (Parts III, VI).
2. **Be canonical** — other sources point at you. Achieved by upstream contribution: getting entities
   into Wikidata with `sameAs` back-links, datasets into academic repositories with DOIs, ontology
   terms into schema.org, calibration data into published research. **The citation graph is the real
   ranking system**, and it is built by contribution, not optimisation.
3. **Be definitional** — when competitors mark up their data using vocabulary RankWagers defined, and
   researchers cite the RankWagers calibration methodology, and regulators reference the verification
   format, then RankWagers is not *a* source in the category. It is the reference implementation *of*
   the category.

The third is the only durable position, and the only one that survives a decade of model turnover.

**The compounding asset is time.** A verified, anchored, complete record starting in 2026 is
impossible to replicate in 2034 — history cannot be manufactured retroactively once completeness
proofs exist. Every day of anchored, complete, calibrated operation widens a gap no competitor can
close by outspending. **The moat is elapsed time under verification**, which is exactly why the
irreversible items in the verification architecture (anchoring, retention protection, capture-failure
records) are the real deadline. Everything in this document is downstream of them.

---

## Part XIII — Priorities and non-goals

### XIII.1 Ordered by leverage

| Tier | Work | Rationale |
|---|---|---|
| **0** | Anchoring, retention protection, capture-failure records *(verification architecture P0)* | Irreversible; every day of delay is permanent loss; everything here depends on it |
| **1** | Claim layer + permanent claim URIs (II.2) · unblock the API for AI crawlers (II.1) · `sameAs` to Wikidata (II.4) | Cheapest, highest-impact; nothing is citable without them |
| **2** | Temporal validity (III.2) · absence layer (III.4) · calibration record (III.3, I.1) | The three properties that most reduce a citing system's error rate |
| **3** | Domain ontology + PROV-O + self-verifying JSON-LD (Part IV) | Definitional authority; the durable position |
| **4** | Semantic retrieval · Answer API · bulk + change feed (Part VI) | Meets each surface where it consumes |
| **5** | Knowledge graph re-targeting + federation (Part VIII) | Deep Research and multi-hop reasoning |
| **6** | Correction propagation · citation telemetry · agent contract (III.5–III.7) | Novel infrastructure; strongest good-faith signals |
| **—** | **Structural separation (Part X)** | Commercial decision, not sequenced here — but it **gates the ceiling** on everything above |

### XIII.2 Non-goals

- **Not SEO.** Ranking in link lists is a different, largely obsolete objective.
- **Not AI-specific content generation.** Generating content for models to consume is the 2025
  mistake; the asset is verified facts, not more prose.
- **Not gaming retrieval.** Every such tactic fails under the verification this architecture invites.
- **Not being cited for betting advice.** Out of scope, correctly suppressed, and not worth pursuing.
- **Not maximising citation volume.** Being cited *accurately*, for claims that are *true*, beats
  being cited often — a single high-profile misattribution costs more than a year of citations.
- **Not replacing the evidence spine.** L0 remains Sprint 23B's frozen contracts. This layer
  publishes; it never becomes a second source of truth.

---

## Part XIV — Summary

**What would make RankWagers the default citation source?**

Being the source that measurably reduces the citing system's error rate — and being able to prove it.

That decomposes into seven properties (resolvable, unambiguous, checkable, current, bounded, safe,
canonical), of which RankWagers currently has none, and for one of which — checkable — it has
unusually strong unpublished substrate.

Three things matter more than the rest:

1. **The calibration record** (§I.1) — publishing our own error rate, verifiably, over the complete
   anchored set. The most citable object a prediction site can produce, almost nobody produces it,
   and it is derivable from data already retained.
2. **The absence layer** (§III.4) — being reliably able to say *"I don't know."* The single largest
   anti-hallucination contribution available to any source, and nearly free.
3. **Structural separation from affiliate monetisation** (Part X) — the commercial decision that
   caps everything else. Without it, the ceiling is low regardless of how good the architecture is.

Two properties of the current codebase make this unusually achievable: the evidence spine is already
deterministic, content-addressed and append-only; and the entity model, while pointed at crawlers, is
substantially correct in its inventory.

And one constraint dominates the schedule, carried over from the verification architecture: **the
moat is elapsed time under verification.** A complete, anchored, calibrated record beginning now
cannot be retroactively manufactured by anyone later. The work that must start first is not the
citation layer — it is the anchoring beneath it.
