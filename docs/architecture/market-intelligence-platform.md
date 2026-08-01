# RankWagers — Permanent Historical Market Intelligence Platform

**Type:** Architecture. **No implementation.** No code, schema, migration, or route.
**Domain:** Betting markets as markets. Football result data is out of scope except as the settlement
event that terminates an instrument's life.
**Date:** 2026-08-01.
**Status:** Design proposal. Nothing here is built or authorised to be built.

---

## 0. Thesis

**The asset is not a feed. It is a reference-grade permanent record of a market that nobody
archives.**

Betting markets are the largest continuously-priced forecasting markets on earth, and the only major
class of markets with **no public price history, no reference rate, no benchmark, and no audit
trail**. Equities have TAQ and CRSP. Rates have published benchmarks. Crypto has full public order
books. Betting markets have a live screen that overwrites itself every few minutes and is gone
forever.

That gap is the entire opportunity, and it has a hard deadline property: **price history cannot be
purchased retroactively at any price.** Every day without capture is permanently lost inventory.

The strategic target is therefore not "an odds page with a chart". It is:

> **The reference data layer for betting markets** — the thing traders benchmark against,
> journalists cite by name, regulators reference, academics use as a dataset, and language models
> quote because it is the only unambiguous source.

Benchmarks get cited because they are documented, versioned, permanent, and boring. That is the
design target: **become the boring authority.**

### 0.1 What is actually being sold

| Layer | Value | Defensibility |
|---|---|---|
| Live odds | Commodity | None — dozens of aggregators |
| Historical prices | Scarce | High — nobody kept them |
| **Derived, versioned, documented measures** | **Scarce and hard** | **Very high — requires the history plus the method plus the discipline** |
| **Named benchmarks and indices** | **Citation-generating** | **Highest — a benchmark's value compounds with the length of its unbroken series** |

An index that has run unbroken for five years, with published methodology and no restatements, is
worth vastly more than the same index computed today over five years of backfill. **The archive's
value is superlinear in its age and its unbrokenness.** This single property should dominate every
prioritisation decision below.

---

## 1. First principles — challenging the object itself

Almost all published "odds analysis" is wrong at the definitional layer. Fixing that layer is the
architecture.

### 1.1 A bookmaker quote is not a price

A price implies a transaction at a size. A bookmaker quote is a **firm offer of unknown size to an
unknown subset of customers, with a unilateral right of refusal.**

Consequences that must be architecturally explicit:

- **Size is unobserved.** Without stake limits, an odds series is a *quote series*, not a price
  series. Every measure derived from it inherits that limitation.
- **The offer is customer-conditional.** The same screen price is not available to all customers.
  Winning accounts are limited or closed. The "price" is a function of who is asking.
- **Quotes can be non-transactable.** Stale, erroneous, or displayed but not honoured.

**Design rule:** the platform never calls a quote a price. Every published measure carries the
`quote` qualifier in its definition, and every dataset states the transactability limitation in its
metadata. This is not pedantry — it is the difference between a source a professional will cite and
one they will dismiss in a sentence.

**The corollary opportunity:** a betting exchange is a genuine market — real orders, real sizes, real
depth, public volume. If exchange data is licensable, it becomes the **anchor asset**: the only
series in the corpus with observable liquidity, and therefore the calibration reference against
which every bookmaker-quote-derived proxy is validated. This should be treated as the single highest
-value data acquisition decision on the roadmap.

### 1.2 Implied probability is a derivation, not a datum

`1 / decimal_odds` is not a probability. It is a margin-inclusive quantity that sums to more than
one. Extracting probability requires choosing a **devigging method**, and the choice materially
changes the answer — most severely at long odds, exactly where the interesting effects live.

| Method | Assumption | Behaviour |
|---|---|---|
| Multiplicative / proportional | Margin is proportional to implied probability | Simplest; overstates favourites |
| Additive | Margin is spread equally across outcomes | Distorts long-shots badly |
| Power | Margin scales as a power of probability | Fits observed bias better |
| Shin | Margin reflects insider-trading risk | Theoretically motivated; asymmetric |
| Logarithmic / odds-ratio | Margin is uniform in log-odds | Well-behaved, scale-free |
| Balanced-book | Margin reflects liability, not belief | Requires unobservable data |

Two analysts using different methods on identical quotes will disagree on whether a market was
efficient, whether a move was significant, and whether a bet had value.

**Design rule:** *never store a derived probability as if it were data.* Store raw quotes. Derive
probability under **all** supported methods, each versioned and named. Every published probability
states its method. Every dataset ships method-parallel columns so a user can choose — and can
reproduce a competitor's number and see where the difference came from.

This alone would make the corpus more rigorous than any public source in the vertical.

### 1.3 A line move and a price move are different events

An Asian handicap moving from −0.5 to −0.75, or a total from 2.5 to 2.75, is **not a price change**.
It is the retirement of one instrument and the creation of another with different settlement rules.
Recording it as a price move on a single series produces a corrupted, discontinuous, and
economically meaningless series.

**Design rule:** the line is part of **instrument identity**, never a mutable attribute of a quote.
Line movement is a distinct, first-class event class with its own analysis — and "which books move
the line versus which books move the price at a fixed line" is a genuinely novel, publishable
distinction that no public source makes.

*This is a defect in the current model:* `OddsHistoryRecord` (`lib/odds-history/types.ts:1-9`)
carries `line: string` as a field of the price record, sitting alongside `odd`, keyed only by
`operatorId:market` in `detectOddsMovements` (`movement.ts:24-28`). A handicap shift and a price
shift are currently indistinguishable in the movement series.

### 1.4 Movement must be measured in probability space, not odds percentage

The current model classifies movement by percentage change in decimal odds
(`movement.ts:4-6`, `thresholds.ts:37-45`). Percentage change in decimal odds is not a meaningful
unit of information, because it is wildly non-linear in probability:

| Move | Odds % change | Probability change | Information content |
|---|---|---|---|
| 1.10 → 1.20 | +9.1% | 90.9% → 83.3% (**−7.6pp**) | Large |
| 10.00 → 10.90 | +9.0% | 10.0% → 9.2% (**−0.8pp**) | Small |

Both trip an identical threshold. One is a major repricing; the other is noise. A fixed percentage
threshold therefore applies a moving, uncontrolled significance bar across the price range — and
systematically over-detects "steam" on long-shots while under-detecting it on favourites.

**Design rule:** the canonical movement metric is the change in **log-odds (logit) of the devigged
probability.** It is additive, symmetric between the two sides of a binary market, scale-free, and
approximately homoscedastic across the price range. Decimal-odds percentage may be *displayed* for
familiarity; it is never the analytical unit.

### 1.5 Absence of a quote is the most informative observation in the dataset

Books suspend markets precisely when information arrives: team news, injury, suspicious action, a
correlated event elsewhere. **Missing data here is emphatically not missing at random.** Treating a
gap as "no data" discards the highest-signal events in the corpus and biases every volatility and
efficiency estimate toward calm.

**Design rule:** the market's *state* is a modelled, recorded time series independent of price:
`open`, `suspended`, `limited`, `withdrawn`, `settled`, `voided`, `unobserved-by-us`. The last is
critical and must be distinguishable from all the others — a gap caused by our own polling failure
is a completely different fact from a gap caused by a book suspending the market, and conflating
them corrupts every downstream inference.

### 1.6 The observation process is part of the data

Every measure computed from a sampled series is an artifact of the sampling regime. A five-minute
poll cannot observe a forty-second steam move; it observes a step. Realised volatility scales with
sampling frequency. Movement counts scale with polling density. Two leagues polled at different
rates are not comparable, and a change in polling cadence silently creates a false structural break
in every historical series.

**Design rule:** the sampling regime is a **first-class, versioned, queryable object** attached to
every observation window: intended cadence, achieved cadence, gap distribution, failure counts,
coverage. Every derived measure is published with the sampling regime that produced it, and
cross-sectional comparisons are only permitted — programmatically, not by convention — between
windows with compatible regimes. Where a measure is not sampling-invariant, it is flagged as such
in its own definition.

This is the single most common flaw in published betting-market research, and making it structurally
impossible is a genuine differentiator.

### 1.7 Time is three axes, not one

| Axis | Meaning | Purpose |
|---|---|---|
| **Effective time** | When the quote was live at the operator | Economic truth |
| **Observation time** | When we recorded it | Reproducibility, staleness, no-lookahead guarantees |
| **Event time** | Time relative to kickoff (t-minus) | **The only axis on which matches are comparable** |

Wall-clock time is nearly useless for cross-sectional analysis: a Tuesday 19:45 match and a Saturday
15:00 match share no meaningful calendar structure. **The canonical analytical axis is time-to-event**
— t−7d, t−24h, t−1h, t−5m, t−0. Every series is indexed on it; every cross-match aggregate is
computed on it.

Clock discipline is a hard requirement: provider timestamps are untrusted and skewed. All three axes
are stored; provider-supplied effective time is preserved as claimed, our observation clock is
authoritative and monotonic, and measured skew per provider is itself a published data-quality
series.

*Current gap:* `OddsHistoryRecord` carries a single `timestamp` with no distinction between
effective and observation time, which makes point-in-time reconstruction and staleness bounds
impossible.

### 1.8 "Steam" as currently defined is not steam

This is the sharpest available critique of the existing model, and it is verifiable in the source.

Today: `classifySeverity(absPercent)` returns `"steam"` when a **single operator's** price moves
≥ 8% between two consecutive observations (`thresholds.ts:14-19, 36-45`), and
`isSteam: severity === "steam"` (`movement.ts:50`).

**Steam is, by definition, a cross-operator, correlated, near-simultaneous move.** A single book
moving 8% in isolation is more likely to be a stale-price correction, a limit adjustment, an error,
or a copy of someone else's move. Classifying it as steam mislabels the single most citable event
class in the entire domain.

Two further defects compound it:

1. **The thresholds are environment variables** (`ODDS_MOVE_STEAM_PCT`, `thresholds.ts:28-34`).
   Changing an env var silently reclassifies **all of history**. In a permanent archive whose value
   depends on citations remaining valid, an unversioned mutable classification parameter is
   disqualifying.
2. **The metric is odds-percentage**, with the non-linearity problem of §1.4.

**Design rule — a formal, falsifiable definition:**

> A steam event is a set of moves in the same instrument and direction, across **≥ K distinct
> operators**, within window **W**, whose aggregate magnitude in logit space exceeds **Z** standard
> deviations of that instrument's own historical movement distribution *at the same time-to-event
> bucket*, and which does **not** revert within horizon **H**.

Every parameter (K, W, Z, H) is a **versioned, published constant bound into the detection method's
identity** — never an environment variable. The definition carries a null model, so "was this
steam?" becomes a testable claim rather than a marketing adjective. Non-reverting is what separates
information from noise, and it is what makes the classification defensible under challenge.

And the genuinely novel part: **origination versus propagation.** Who moved first, who followed, and
with what lag, is the most commercially valuable and most citable fact the platform can produce.
Current architecture cannot express it at all.

### 1.9 Closing line is an estimator, not an observation

"The closing line" is universally quoted and almost never defined. Closing *when*? Last observed
quote? Last quote before suspension? Price at kickoff? With gapped sampling, the true final quote is
frequently unobserved.

**Design rule:** the closing line is a named **estimator** with a declared observation window, a
staleness bound, an interpolation policy, and a published uncertainty. Multiple estimators may
coexist (last-observed, kickoff-anchored, suspension-anchored, consensus-close); each is versioned
and each publishes its own coverage statistics. A closing line whose staleness exceeds the bound is
marked low-confidence rather than silently used.

### 1.10 CLV is confounded unless both sides are devigged

Current CLV compares raw decimal odds: `percentChange(current, closing)`
(`closingLineValue.ts:44`). Bookmaker margin is not constant through an instrument's life — it
characteristically widens early and tightens toward close as confidence rises. Comparing raw prices
therefore measures **margin drift plus true-probability drift, confounded**, and systematically
misattributes margin compression as forecasting skill.

**Design rule:** CLV is computed in devigged probability space, against a **named closing estimator**
and a **named devig method**, and is decomposed into its components:

```
raw price change  =  true probability drift  +  margin change  +  line change
```

Additionally, **realised CLV and synthetic CLV must never be conflated.** Realised CLV requires a
recorded decision at a timestamp — an actual position taken at an actual quote. Synthetic CLV is a
backtest of a rule against history. The first is evidence; the second is a simulation, and is
subject to every backtest bias in §11. Separate types, separate storage, separate presentation.

---

## 2. The core data model

### 2.1 Atomic record

The atom is a **quote observation**:

```
instrument_id        canonical, includes line and settlement rules
operator_id          the quoting firm
price                as quoted, in the operator's native format, plus normalised decimal
market_state         open | suspended | limited | withdrawn | settled | voided
effective_time       claimed by provider (untrusted, preserved)
observation_time     our authoritative clock
event_time_offset    derived: time to kickoff
source_ref           pointer into the raw payload archive (content-hashed)
sampling_context     which regime produced this observation
```

Append-only. Immutable. Content-addressed. Never updated, never deduplicated destructively — a
repeated identical quote is itself information about quote stability, and discarding it destroys the
update-intensity series that liquidity proxies depend on (§5.6).

### 2.2 Instrument identity

```
instrument = event × market_type × line/handicap × selection × settlement_rules × period
```

Identity is permanent and **includes the settlement rules**, because rule differences (dead-heat
handling, void policy, extra-time inclusion) make otherwise identical-looking markets economically
different instruments. Two operators quoting "the same" market under different rules are quoting
**different instruments**, and comparing them as though they were the same is a category error that
silently pollutes dispersion, consensus, and arbitrage measures.

This is the layer where most competitors' data is quietly wrong, and where being right is invisible
until someone checks — which is exactly the property that produces citations from professionals.

### 2.3 The five-layer store

```
L0  RAW           provider payloads, byte-preserved, content-hashed, immutable
L1  QUOTES        normalised quote observations + market state series
L2  INSTRUMENTS   canonical instruments, operators, events, settlement rules
L3  MEASURES      versioned derivations (devig, consensus, movement, volatility, efficiency)
L4  PUBLICATIONS  frozen, hash-sealed, citable artefacts: indices, datasets, studies
```

Strictly one-directional. L3 is fully recomputable from L1 + a method version; L4 is never
recomputed — a re-derivation produces a **new** publication with a supersession pointer, and the old
one remains permanently resolvable.

**Why L0 is non-negotiable:** every citation eventually gets challenged. Without byte-preserved
payloads you can prove what you concluded but not what you were told. L0 also makes every
derivation re-runnable after a method bug — which, over a decade-long archive, will happen many
times and is the difference between a corpus that improves and one that rots.

---

## 3. The derivation layer

Every measure below is a **named, versioned, documented function** with declared inputs, declared
sampling requirements, and a declared validity domain. No measure is ever mutated in place. A
measure's identity includes every constant it uses.

### 3.1 Probability extraction

Devig under all supported methods (§1.2), producing method-parallel probability series with the
implied margin isolated as its own series. **Margin becomes a first-class research object**, not a
nuisance parameter to be removed and forgotten — margin behaviour over time, by operator, by
league, by time-to-event is one of the most under-researched and most publishable areas in the
domain, and one of the few where a bookmaker's commercial behaviour is directly observable.

### 3.2 Consensus construction

A consensus is a **constructed benchmark**, and its construction is the product.

| Decision | Options | Note |
|---|---|---|
| Space | Devigged probability (never raw odds) | Arithmetic mean of decimal odds is upward-biased and economically meaningless |
| Weighting | Equal, sharp-weighted, liquidity-weighted, precision-weighted | Sharp-weighted is the most useful and the most contentious; must be documented and versioned |
| Outliers | Trimmed, winsorised, robust | Stale quotes otherwise dominate |
| Staleness | Age-decay or exclusion | A quote unchanged for six hours is not a current opinion |
| Composition | Fixed panel vs all-available | **Fixed panel is required for a benchmark** — a changing panel creates false structural breaks |

**A benchmark must have a fixed, published panel and a published rebalancing policy.** This is the
single most important methodological decision in the document: it is what separates an index that
can be cited for years from an average that silently changes meaning whenever coverage changes.

*Current gap:* `BestOddsSnapshot.average` and `spread` average raw decimal odds across whatever
operators happen to be present — an unweighted mean in the wrong space over an unstable panel.

### 3.3 Movement decomposition

Every price path decomposes into:

```
drift        slow, continuous revision
jumps        discrete repricing events
reversion    moves that undo
line moves   instrument changes (§1.3)
margin moves changes in the book's take, not its opinion
```

Measured in logit space. The decomposition is the analytical product: "the market moved 6%" is
worthless; "the market's true-probability estimate drifted 1.2pp over six hours, then jumped 3.4pp
in four minutes across nine books and did not revert" is citable.

### 3.4 Steam detection

Per §1.8: formal, versioned, cross-operator, non-reverting, with a null model. Outputs:

- Event identification with confidence
- **Origination attribution** — first mover, with lag distribution across followers
- Propagation topology — who follows whom, at what latency, in which markets
- Persistence — did it hold to close

**The lead-lag matrix across operators is the single most valuable derived artefact in the platform**
for a professional audience, and it is impossible to construct without exactly the archive being
proposed. It is also inherently newsworthy: "these books lead, these books copy, with this latency"
is a story no one can currently tell with evidence.

### 3.5 Volatility

Realised volatility of the logit-probability path, computed on the event-time axis, **explicitly
annotated with its sampling regime** and reported per time-to-event bucket. Volatility rises
predictably toward kickoff as information arrives; a term structure of betting-market volatility
does not currently exist publicly and is a genuinely novel, publishable construct.

Sampling-frequency dependence must be corrected for where possible and declared where not.

### 3.6 Dispersion — bookmaker disagreement

Dispersion must be computed **after** devigging and decomposed:

```
observed price dispersion  =  opinion dispersion  +  margin dispersion  +  rule/line dispersion
```

Undecomposed dispersion mostly measures who charges more, not who disagrees. Opinion dispersion is
the interesting quantity, and separating it is what makes the measure defensible.

### 3.7 Efficiency battery

Efficiency is a family of testable claims, never a single score:

| Test | Question |
|---|---|
| Closing-line unbiasedness | Do devigged closing probabilities match realised frequencies? |
| Favourite–longshot bias | Is the bias present, and how does it vary by league, market, operator? |
| Calibration | Reliability curves, Brier decomposition, log loss, by segment |
| Information incorporation | How fast does a shock get priced? Half-life in event time |
| Arbitrage persistence | How long do cross-book inconsistencies survive? |
| Opening vs closing informativeness | How much does the market learn during an instrument's life? |

Published per league, per market, per operator, per time-to-event bucket. **"Which leagues are
efficiently priced" is a question with obvious demand, obvious citation value, and no current public
answer.**

### 3.8 Market confidence

The brief's "market confidence" needs a real definition rather than a vibe. Proposed composite,
versioned and published with its weights:

```
confidence ↑ with:  tighter margin, lower cross-book dispersion,
                    lower recent volatility, larger stake limits,
                    higher quote-update stability
```

Published as an index with full component breakdown, so a user can reject the weighting and
reconstruct their own from the components. **A composite that cannot be decomposed is not a
research instrument.**

### 3.9 Liquidity proxies — with an honesty constraint

Liquidity is **not observable** from bookmaker quotes. Every measure here is a proxy with a validity
domain, and the platform must say so at every point of publication:

| Proxy | Signal | Failure mode |
|---|---|---|
| Published stake limits | Most direct | Rarely published; customer-conditional |
| Quote update intensity | Attention and flow | Confounded by polling regime |
| Margin width | Confidence and competition | Also a pricing-policy decision |
| Cross-book dispersion | Uncertainty | Confounded by stale quotes |
| Price impact / impulse response | Depth | Requires identified shocks |
| Reversion half-life | Absorption capacity | Requires dense sampling |
| **Exchange depth and volume** | **Actual liquidity** | **Only if licensable — the anchor** |

**Design rule:** no proxy is ever published as "liquidity". Each is published under its own name,
with its construction, its validity domain, and its known confounders. Where exchange data exists,
proxies are **calibrated and validated against it**, and the calibration residuals are themselves
published. Overclaiming here would destroy credibility with the exact professional audience the
platform is built for — and that audience is the citation engine.

### 3.10 Operator behaviour — the operator as research subject

The most under-served analytical surface in the domain, and the one with the most obvious demand:

- Margin policy over time, by league, by market, by time-to-event
- Speed of reaction: lead or follow, with measured latency distributions
- Origination share — how often this book moves first, and is subsequently confirmed
- Line-move versus price-move behaviour
- Quote stability and staleness profile
- Suspension behaviour — how early and how often, and what it predicts
- Limit and availability behaviour where observable
- Closing accuracy — whose close best predicts outcomes, the definitive skill ranking

**This produces the first evidence-based, methodologically-documented answer to "which bookmakers
are actually sharp".** That question is asked constantly, answered only by folklore, and would be
cited immediately and permanently. It requires nothing but the archive and the discipline.

Non-negotiable constraint: this analysis is **commercially blind**. Operator rankings derived from
market behaviour may never be influenced by, or influence, commercial relationships — and the
separation must be architecturally enforced and externally testable, not merely stated. The moment
that boundary is suspected, the entire corpus loses its citation value.

### 3.11 League and segment behaviour

Every measure above, aggregated by competition, tier, region, market type, and time-to-event bucket.
The cross-sectional comparison — which leagues are efficient, volatile, contested, expensive — is
where journalism and academia will draw most heavily, because it is the level at which the findings
are legible to non-specialists.

*Current gap:* the schema has no league dimension at all (`OddsHistoryQuery.league` is explicitly
marked "reserved… no league column yet", `types.ts:15-16`), so none of this is queryable today.

---

## 4. Reference products — the citation engine

Raw data gets used. **Named benchmarks get cited.** The distinction is worth a great deal, and it is
almost entirely a matter of discipline rather than technology.

Proposed reference series, each with published methodology, fixed panel, versioned construction,
permanent identifier, daily publication, and a **no-silent-restatement policy**:

| Reference series | Measures |
|---|---|
| **Consensus Probability Benchmark** | The reference devigged price per instrument per time-to-event bucket |
| **Margin Index** | Market-wide and per-operator overround over time |
| **Dispersion Index** | Opinion disagreement, margin-adjusted |
| **Steam Index** | Frequency and magnitude of qualifying cross-book events |
| **Efficiency Index** | Closing-line calibration by league and market |
| **Volatility Term Structure** | Realised volatility by time-to-event |
| **Origination League Table** | Which operators lead, with latency distributions |

Each publishes: a value, a vintage, a method version, a coverage statistic, and a confidence
qualifier.

**Why this works.** A journalist cannot cite "our analysis of odds data" — it is unverifiable and
unattributable. They can cite "the RankWagers Margin Index rose 8% across the Premier League this
season", because it has a name, a number, a date, a documented method, and a permanent URL. The same
property makes it quotable by a language model and benchmarkable by a trader. **One artefact serves
all three audiences, because all three need the same thing: an unambiguous, attributable,
permanently-resolvable number.**

---

## 5. Research surface

Everything researchable means one query engine over the measure layer, not a menu of dashboards:

```
Universe     instruments, operators, leagues, time ranges, event-time buckets
Conditions   filters on state, price, movement, dispersion, liquidity proxies
Measure      any versioned derivation from §3
Grouping     operator, league, market, time-to-event, vintage
Comparison   against benchmark, against another universe, against a null model
Output       chart, table, dataset, export, permanent citable study
```

Design commitments:

1. **Every query is point-in-time correct** — see §6.1. A research tool that permits lookahead is
   worse than useless to a professional; it manufactures false conclusions with confidence.
2. **Every result is permalinked, exportable, and versioned** as a Study with a permanent identifier.
3. **Every result states its sampling regime, coverage, and method versions** on the artefact itself,
   so a screenshot remains self-describing when it is shared without context.
4. **Every result exposes its own null model** where it makes a significance claim.

---

## 6. Access architecture

### 6.1 The point-in-time guarantee

The most valuable single property for a professional audience, and the hardest to retrofit:

> **Any query may be evaluated as-of any past observation timestamp, returning exactly what was
> knowable at that instant — no restatements, no backfilled corrections, no lookahead.**

This requires bitemporality end to end (§1.7), immutable observations, versioned methods, and
vintage-addressable derivations. It is the difference between a dataset a quantitative researcher
will build on and one they will glance at and discard, because without it every backtest is silently
contaminated.

### 6.2 Restatement policy

Published, and binding:

- Observations are never edited. Corrections are **new observations** with a correction pointer.
- Derived series may be **re-versioned**, never overwritten. Every vintage remains queryable.
- Every restatement appears in a public, append-only log with its cause and its magnitude.
- Benchmarks state, in advance, the conditions under which they may be revised.

A benchmark that silently restates is not a benchmark. **The corrections log is not an admission of
weakness; it is the artefact that makes the numbers usable.**

### 6.3 Distribution

| Channel | Audience |
|---|---|
| Point-in-time query API | Traders, quants, researchers |
| Bulk historical datasets, versioned, with DOI-style permanent IDs | Academics, journalists |
| Benchmark series endpoints | Anyone citing an index |
| Machine-readable catalogue: instruments, methods, versions, coverage, licence | AI systems |
| Human research surface with permanent studies | Everyone |

Every artefact ships: licence, attribution requirement, method version, coverage statistic, sampling
regime, and known-limitations statement. **Removing legal and epistemic ambiguity is what converts a
reader into a citer** — most potential citations are lost not to doubt about the number but to doubt
about whether it is safe to quote.

---

## 7. What each audience actually cites

| Audience | Cites | Requires |
|---|---|---|
| **Traders** | Benchmarks, lead-lag matrices, efficiency by segment, closing accuracy rankings | Point-in-time correctness, no lookahead, documented panels, known gaps |
| **Journalists** | Named indices, records, steam forensics with named origination, margin trends | A name, a number, a date, a permanent URL, a plain-language method |
| **Academics** | Bulk datasets, devig-agnostic raw quotes, documented sampling | Permanence, versioning, citable identifiers, stated limitations |
| **Regulators** | Operator behaviour, margin practice, suspension patterns | Neutrality, methodology, demonstrable commercial independence |
| **AI systems** | Atomic, unit-stated, method-named facts | Machine-readable, unambiguous, stable IDs, explicit as-of, clear licence |

The striking convergence: **all five want the same underlying property — an unambiguous number with
a stated method, a stated time, a stated limitation, and a permanent address.** Optimise once and
serve all five. Every design rule in this document reduces to that sentence.

---

## 8. Defects in the current model, consolidated

Evidence-based, from source. Each is a design constraint on the target architecture rather than a
criticism of what was built for a different purpose.

| # | Defect | Where | Impact |
|---|---|---|---|
| 1 | Steam defined as single-operator percentage threshold | `thresholds.ts:14-19,36-45`; `movement.ts:50` | Mislabels the highest-value event class; not steam by any accepted definition |
| 2 | Classification thresholds are mutable env vars | `thresholds.ts:28-34` | Changing one silently reclassifies all history; disqualifying for a citable archive |
| 3 | Movement measured in decimal-odds percentage | `movement.ts:4-6` | Non-linear in probability; systematically over-detects on long-shots, under-detects on favourites |
| 4 | Line is an attribute of the quote, not of instrument identity | `types.ts:1-9`; `movement.ts:24-28` | Line moves and price moves are indistinguishable; series economically invalid |
| 5 | Single time axis | `types.ts:8` | No point-in-time reconstruction, no staleness bound, no lookahead guarantee |
| 6 | CLV computed on raw odds | `closingLineValue.ts:44` | Confounds margin drift with forecasting skill |
| 7 | Consensus averages raw decimal odds over an unstable panel | `types.ts:53-60` | Biased estimator; no benchmark stability |
| 8 | No market-state series | absent | Suspension and withdrawal — the highest-signal events — are invisible; gaps ambiguous |
| 9 | No league dimension | `types.ts:15-16` (explicitly reserved) | Segment-level research impossible |
| 10 | No sampling-regime metadata | absent | Every derived measure is uninterpretable and non-comparable across periods |

---

## 9. Bias and failure register

Published, permanently, as part of the platform — because a research source that documents its own
weaknesses is trusted, and one that does not is checked once and abandoned.

| Bias | Mechanism | Mitigation |
|---|---|---|
| Sampling artifact | Measures scale with polling frequency | Regime metadata; sampling-invariant measures; comparability enforcement |
| Non-random missingness | Books suspend on information | Explicit state series; separate our-gap from their-suspension |
| Survivorship | Voided, abandoned, withdrawn markets | Retain and publish them; never filter to completed instruments |
| Stale quotes | Unchanged prices treated as current opinion | Age-decay and exclusion in consensus |
| Transactability illusion | Screen price ≠ available price | Permanent qualifier on every derived measure |
| Devig method dependence | Conclusions vary by method | Publish all methods in parallel |
| Panel drift | Coverage change creates false breaks | Fixed benchmark panels; published rebalancing |
| Backtest contamination | Lookahead in synthetic CLV | Point-in-time evaluation; realised and synthetic strictly separated |
| Clock skew | Provider timestamps unreliable | Authoritative observation clock; skew published as a data-quality series |

---

## 10. Sequencing

| Phase | Delivers | Why in this order |
|---|---|---|
| **1. Capture** | Instrument identity, three time axes, state series, raw archive, sampling metadata | Every later phase depends on it, and **only this phase is time-critical** — uncaptured history is permanently lost |
| **2. Foundation measures** | Devig family, consensus benchmark, logit movement, line/price separation | Makes the archive analytically meaningful |
| **3. Benchmarks** | Named indices with fixed panels and published methodology | Starts the citation clock; an index's value compounds with its unbroken age |
| **4. Behavioural analytics** | Steam with origination, lead-lag matrix, operator behaviour | The highest-value professional and journalistic surface |
| **5. Efficiency** | Full efficiency battery by segment | The academic and journalistic surface |
| **6. Access** | Point-in-time API, bulk datasets, catalogue, permanent studies | Converts the corpus into citations at scale |
| **7. Anchor** | Exchange data integration, proxy calibration | Validates every liquidity claim made earlier |

**The ordering argument is unusually strong here.** Phases 2–7 can be built at any future date over
whatever history exists. Phase 1 cannot. A day of uncaptured market activity is a permanent hole in
the only asset that cannot be bought, and it also delays the start of every benchmark series — whose
worth is a function of unbroken length. If exactly one thing is built, build capture, and build it
with the instrument identity, three time axes, market-state series, and sampling metadata correct
from the first record, because **those four are the only elements that cannot be retrofitted onto
history.**

---

## 11. Open questions

Material, and flagged rather than assumed:

1. **Redistribution rights.** Whether the provider licence permits permanent archival, bulk export,
   and public benchmark publication determines whether the citation strategy exists at all. This is
   the single largest unknown and should be resolved before capture design is finalised.
2. **Exchange data access.** Determines whether liquidity is ever measured rather than proxied, and
   whether every proxy in §3.9 can be validated. Highest-value acquisition on the roadmap.
3. **Sampling budget.** Cadence versus operator breadth versus market depth is a three-way trade
   under a fixed request budget. **This decision permanently bounds what is knowable** from the
   archive and deserves explicit quantitative analysis, not a default.
4. **Panel selection for benchmarks.** Which operators constitute the reference panel is a
   methodological commitment that is expensive to change later and defines the benchmark's meaning.
5. **Storage.** Tick-level, multi-operator, multi-market history over years is a serious
   time-series volume problem; the current append-only file model will not carry it.
6. **Regulatory posture.** Publishing operator-behaviour analytics and margin practice in a
   regulated vertical has consequences that should be reviewed before the first publication, not
   after the first complaint.

---

## 12. Summary judgement

The defensible asset is a **permanent, versioned, methodologically-documented record of betting
market behaviour**, and the products that make it citable are **named benchmarks**, not charts.

Three commitments dominate everything else:

1. **Capture now, and capture correctly** — instrument identity, three time axes, market state, and
   sampling metadata are the only things that cannot be retrofitted onto lost history.
2. **Never publish a number without its method version, its sampling regime, and its limitations** —
   this is what converts data into evidence, and evidence into citations.
3. **Build benchmarks and never restate them silently** — the value of a reference series compounds
   with its unbroken length, which makes starting early and never breaking the series the highest
   -leverage decision available.

Executed this way, the platform becomes the source that a trader benchmarks against, a journalist
names in a headline, an academic cites in a footnote, and a language model quotes because it is the
only unambiguous answer available. Nobody currently occupies that position in this market, and the
window to occupy it is open only for as long as nobody else starts archiving.
