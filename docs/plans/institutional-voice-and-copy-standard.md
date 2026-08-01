# RankWagers — Institutional Voice and Copy Standard

**Type:** Brand voice and copy standard. **No implementation, no code, no roadmap.**
**Constraint:** engineering, product and roadmap are frozen. Only words change.
**Date:** 2026-08-01.
**Objective:** make RankWagers read as an institution rather than an affiliate, using subtraction
rather than elevation.

---

## 1. The diagnosis

**RankWagers already contains two brands, and they live in different files.**

Reading the product's own copy, the split is exact:

**Voice A — the institution.** Lives in page titles for research surfaces and, most of all, in the
component vocabulary.

> "Operators — evidence-first sportsbook intelligence"
> "Teams — evidence-first football research"
> "Football betting markets — evidence-first intelligence"
> Column and label vocabulary: *Evidence strength. Model confidence. Qualification. Provenance.
> Coverage. Threshold. Excluded. Supported markets. Kick-off (UTC). Created (UTC).*
> And the single best sentence in the product, from `/how-we-rank`:
> **"…and how we earn money. Stated so you can check it rather than trust it."**

**Voice B — the affiliate.** Lives in `lib/dictionaries.ts` — the translated, user-facing layer.

> `homeTitle: "Best Crypto Betting Sites — Reviews, Bonuses & Comparison"`
> `tagline: "Compare betting & crypto betting sites by published criteria"`
> `heroSubtitle: "Hand-picked, independently reviewed and ranked. Compare bonuses, payouts and features in one place."`
> `ctaTelegram: "Join our free bonus channel"` · `"Free daily bonuses on Telegram"`
> `topListTitle: "Top rated sites this month"` · `ratingLabel: "Our rating"` · `topPick: "Top pick"`
> `"Updated monthly by our team"` · `"expert reviews"` · `"Sign up → First deposit → Bonus applied"`

Three consequences follow, and they decide the entire brief:

1. **The affiliate voice occupies the front door.** `meta.homeTitle` — the site's homepage title, the
   first thing any human or machine reads — is an affiliate category page title. The institution is in
   the interior; the affiliate is at the entrance.
2. **The affiliate voice is the translated one.** Dictionary strings are the copy that exists in
   French, Spanish, Portuguese, German and Arabic. The institutional page titles are hardcoded
   English. **Every non-English visitor gets a disproportionately affiliate product**, because the
   affiliate layer is the layer that was worth translating.
3. **The brand line already exists and is not used.** The product coined **"evidence-first"** and
   applies it to Teams, Seasons, Markets, Operators and Competitions. It is absent from the homepage,
   the tagline and every commercial page.

> **The institution is already inside the building. The work is to move it to the front — not to
> invent a new voice.**

---

## 2. The governing principle: authority is subtraction

The failure mode of this exercise is replacing affiliate hype with institutional cosplay: longer
words, Latinate constructions, "leveraging proprietary methodologies", a mission statement. That reads
as a small company dressing up, which is a worse tell than the affiliate voice it replaced.

**Real institutional voice is quieter, shorter and more concrete than promotional voice.**

| Promotional | Institutional cosplay | Institutional |
|---|---|---|
| "The best betting sites, hand-picked by our experts" | "A rigorous, proprietary evaluation framework for sportsbook operators" | "Operators, ordered by published criteria" |
| "Amazing insights into today's matches" | "Actionable intelligence derived from advanced analytics" | "412 fixtures assessed. 38 qualified." |
| "Our top pick this month" | "Our flagship recommendation" | *(delete — an institution has no picks)* |

The three rules that produce it:

- **State, don't sell.** Say what the thing is. Let the reader conclude it is good.
- **Number, don't adjective.** "Comprehensive coverage" is a claim. "38 of 412 fixtures qualified" is
  a fact, and it is more impressive.
- **Show, don't assure.** Never write that you are honest, transparent, independent or accurate.
  Publish the record and let it carry the claim. *(See §7 — this is the product's largest single copy
  defect.)*

---

## 3. The voice, defined

**RankWagers sounds like a research desk publishing its working, not a service selling an outcome.**

| Attribute | Meaning in practice |
|---|---|
| **Precise** | Exact numbers, named units, stated dates. "Kick-off (UTC)" not "kick-off time" |
| **Unexcited** | No superlatives, no exclamation, no urgency, no "this month" |
| **Declarative** | Short sentences in the indicative. Statements, not persuasion |
| **Bounded** | States limits and exclusions as readily as results. Confidence intervals, sample sizes, what was not assessed |
| **Impersonal about itself, direct with the reader** | "We" only when accountability requires it — how money is earned, what we do not assess. Never "we're excited", never "our experts" |
| **Non-promissory** | Reports what was measured. Never what will happen |

**The house benchmark sentence**, already in the product:

> **"Stated so you can check it rather than trust it."**

Every sentence should be answerable to it. If a sentence asks for trust rather than offering
verification, it is the wrong sentence.

**The five-word test.** Every sentence must serve at least one of: **Football Intelligence · Evidence ·
Research · Verification · Professionalism.** A sentence serving only *conversion* is either rewritten
or removed.

---

## 4. Terminology — the deepest tell

Vocabulary betrays category faster than any headline. Three words currently place RankWagers in the
punter/affiliate category regardless of what the sentences around them say.

### 4.1 "Acca" — Critical

**Problem.** British punter slang, used 291 times, including in navigation ("Acca Studio", "Acca
Builder", "Published Accas") and page titles ("Acca Studio — build and review football accumulators").

**Why it matters.** No institution uses the audience's slang for its own product objects. Bloomberg
does not say "punt". Slang signals *we are one of the lads*, which is warm, and warmth is precisely
what an institution trades away for authority. It is also untranslatable, so it survives as English
inside every localised experience.

**Direction.** Retire "Acca" from all page titles, navigation labels and section headings. The formal
noun is **accumulator**, or better, **multiple selection** where precision matters. Slang may survive
in body copy that quotes the user's own framing; it may not appear in the product's chrome.

### 4.2 "Signals" — Critical

**Problem.** "Live Signals" is a primary navigation item.

**Why it matters.** "Signals" is the defining word of the tipster and paid-group economy — betting
signals, trading signals, signal channels. It is the exact category RankWagers has spent its entire
architecture escaping, and it sits in the main menu. This single word does more brand damage than any
sentence in the product.

**Direction.** Replace with what the surface actually shows: **Live matches**, or **In-play evidence**.

### 4.3 Three nouns for one object — High

**Problem.** *Operator* (140 uses), *Brand* (57), *Bookmaker* (5) — while the footer's visible label is
"Bookmakers", the rarest of the three.

**Direction.** **Operator** is the institutional register and already dominant; adopt it everywhere the
user can see, including the footer. Retire "Brand" to the data layer where it belongs. Retire
"Bookmakers" as a label.

### 4.4 "Combo" — High

**Problem.** 112 uses of a second name for the accumulator concept.

**Direction.** Retire from all user-visible copy. One concept, one noun.

### 4.5 The vocabulary that is already right — protect it

*Evidence strength. Model confidence. Qualification. Provenance. Coverage. Threshold. Excluded.
Supported markets. Settled. Lead time. Closing line. Kick-off (UTC).*

This is the institutional register, and it is already the product's native language in its interior.
The (UTC) suffixes in particular are the mark of a serious publication. **Nothing here should be
simplified for friendliness.** Precision that requires a glossary is an asset; a glossary is not a
weakness.

---

## 5. Page titles

Titles are the highest-leverage copy in the product: they are the brand's front door in search
results, browser tabs, shared links and answer engines.

| Surface | Current | Direction | Why |
|---|---|---|---|
| **Homepage** | "Best Crypto Betting Sites — Reviews, Bonuses & Comparison" | **"RankWagers — Evidence-first football research"** | The brand's front door currently announces an affiliate category. Adopt the line the product already coined |
| **Tagline** | "Compare betting & crypto betting sites by published criteria" | **"Football match evidence, model probability, and the settled result of every published prediction."** | States the work. No comparative, no superlative |
| `/acca` | "Acca Studio — build and review football accumulators" | **"Accumulator research — combined selections and evidence"** | Removes slang, removes "Studio", states the object |
| `/acca/builder` | "Evidence-Based Acca Builder — automatic accumulator suggestions" | **"Accumulator construction — evidence-weighted selections"** | "automatic suggestions" reads as a tips engine; "Evidence-Based" as a hyphenated adjective is a marketing tic |
| `/archive` | "Prediction archive — transparent settled results" | **"Prediction archive — every published prediction and its settled result"** | "Transparent" is a claim. The replacement demonstrates the same thing without asserting it |
| `/methodology` | "Methodology — how RankWagers predictions work" | **"Methodology — qualification, probability derivation and settlement"** | Names the three processes. More specific, more authoritative, same length |
| `/how-we-rank` | "How we rank operators — criteria, limits and commercial disclosure" | **keep unchanged** | The best title in the product. Leads with criteria, names its limits, discloses commercially |
| `/best-betting-sites` | "Best Betting Sites — Independent Reviews & Bonuses" | **"Sportsbook operators — assessed against published criteria"** | "Best" and "Independent" are both unverifiable claims. The replacement states the method |
| `/best-crypto-betting-sites` | "Best Crypto Betting Sites — Reviews, Bonuses & Comparison" | **"Crypto-accepting operators — assessed against published criteria"** | As above |
| `/bonuses` | *(via dictionary)* | **"Operator promotions — terms, conditions and stated limits"** | "Bonuses" sells; "terms and stated limits" reports |
| `/combo` | "Evidence Combo → Acca Builder" | **remove from titles entirely** | An arrow in a title is an internal note |

**Rule for all titles.** *Subject — what is stated about it.* No superlative, no "best", no "top", no
year, no month, no exclamation. If a title could sit above a table without lying, it is correct.

---

## 6. Headlines, hero and section titles

### 6.1 Hero

| Current | Direction |
|---|---|
| "The best crypto betting sites, ranked by our published criteria" | **"Football markets, assessed before kick-off. Results published after."** |
| "Hand-picked, independently reviewed and ranked. Compare bonuses, payouts and features in one place." | **"Every prediction we publish is recorded before the match and scored against the result — including the ones that lose."** |
| "The best betting sites, ranked by our published criteria" | **"Operators ordered by published criteria. The criteria, and what they exclude, are stated in full."** |

Note what the replacements do: they make a *harder* claim than the originals ("including the ones that
lose") while sounding calmer. That is the mechanism of institutional authority — voluntary exposure to
being checked.

"Hand-picked" must go in every language. It is the single most affiliate word in the dictionary: it
means *chosen by us, for reasons we will not state*.

### 6.2 Section titles

| Current | Direction | Why |
|---|---|---|
| "Top rated sites this month, by our published criteria" | **"Operators, ordered by published criteria"** + an explicit "Assessed [date]" line | "This month" is churn marketing. A precise date is both more useful and more authoritative |
| "Verified performance" | **keep** | Strong, accurate, institutional |
| "Qualified Fixtures" | **keep** | Excellent — a technical term used correctly |
| "Live Signals" | **"Live matches"** | §4.2 |
| "Saved" | **"Research shortlist"** | "Saved" describes a mechanism; "shortlist" describes a research act |
| "Frequently asked questions" | **"Common questions"** or the question itself as the heading | "FAQ" is a web-1.0 SEO artefact |
| "Sign up → First deposit → Bonus applied" | **remove, or restate as terms** | A conversion funnel presented as a three-step guide is the most affiliate structure in the product |

---

## 7. The largest copy defect: assured honesty

**Problem.** Roughly 29 instances of self-assurance: *"Nothing is fabricated"* on the homepage, seven
"never fabricat…", seven "no fabricat…", eleven "we do not / we never", plus *"Factual process notes —
not tipster claims"* and *"Research slip only — we never place bets"* inside meta descriptions.

**Why it matters more than anything else in this document.** No visitor arrives suspecting
fabrication. Raising it introduces the doubt and then asks to be believed about it — the structure of
"trust me", which reliably produces the opposite. It also positions the product as defending itself on
its own homepage, before any accusation exists. An institution never announces its integrity; it
publishes in a way that makes integrity checkable and says nothing about it.

**Direction — delete, and let the mechanism speak.**

| Delete | Because the page already shows |
|---|---|
| "Nothing is fabricated." | Observation dates, sample sizes, provenance |
| "…not tipster claims." | The methodology itself |
| "Research slip only — we never place bets." | The absence of any betting function |
| "No fabricated data." | The settled record, wins and losses included |
| "Independent reviews" | The published criteria |

**The one place where "we" belongs** is commercial disclosure. *"…and how we earn money. Stated so you
can check it rather than trust it."* Keep that sentence, and elevate it — it is the product's voice at
its best, and it is the only kind of self-reference an institution makes: not *we are honest*, but
*here is our incentive, check us*.

---

## 8. CTA language

CTAs are where an affiliate is most exposed, because a CTA has to ask for an action.

| Current | Direction | Why |
|---|---|---|
| "Join our free bonus channel" | **See §8.1** | Cannot be fixed by rewriting |
| "Free daily bonuses on Telegram" | **See §8.1** | As above |
| "Visit site" | **"Open operator site"** | Names the destination and signals leaving |
| "Read review" | **"Read assessment"** | "Review" is an opinion; "assessment" is a process against criteria |
| "Top pick" | **delete** | An institution has no picks |
| "Our rating" | **"RankWagers assessment"** | "Rating" implies taste; "assessment" implies method |
| "Welcome bonus" | **"Advertised bonus"** or **"Stated offer"** | "Welcome" is the operator's marketing word, adopted uncritically |
| "Continue" *(post-build)* | **"Continue to operator"** | Never let the user cross the commercial boundary without being told |

**The CTA rule.** A CTA states the action and its destination. It never states a benefit, never
implies urgency, never uses "free", "now", "today" or "exclusive". Institutional CTAs are boring on
purpose — the boringness is the signal that nothing is being extracted from the reader.

### 8.1 The copy that cannot be rewritten

*"Join our free bonus channel"* and *"Free daily bonuses on Telegram"* cannot be made institutional by
word choice, because the underlying offer is promotional. Renaming a bonus channel does not change
what it is, and dressing it in research language would be the one genuinely dishonest move available
in this document.

Three honest options, in order of brand coherence:

1. **Rename to what it actually delivers.** If the channel carries match analysis, call it *"Match
   analysis on Telegram"*. Only valid if true.
2. **Quarantine it.** Confine promotional language to explicitly commercial surfaces, visually and
   verbally distinct from research surfaces, and remove it from research pages entirely.
3. **Retire it.** Accept the revenue cost.

**What is not an option** is leaving a "free bonus channel" CTA on research pages. That is the sentence
that tells a sceptical reader the research was a funnel, and it currently appears in every translated
locale.

---

## 9. Navigation copy

Navigation is read on every page view and is currently the least institutional text in the product.

| Current | Direction |
|---|---|
| "Acca Studio" | **"Accumulators"** |
| "Acca Builder" | **"Build accumulator"** |
| "Published Accas" | **"Published accumulators"** |
| "Combo (→ Builder)" | **remove** |
| "Live Signals" | **"Live matches"** |
| "Saved" | **"Shortlist"** |
| "Today" | **"Today's fixtures"** |
| "Best Betting Sites" | **"Operators"** |
| "Best Crypto Betting Sites" | **"Crypto operators"** |
| "Bonuses" | **"Promotions"** |
| "Bookmakers" *(footer)* | **"Operators"** |
| "Prediction archive" *(footer)* | **"Archive"** — one label per destination |
| "Today's research" *(footer)* | **"Today's fixtures"** — match the nav |
| Group: "Research / Bookmakers / Browse" | **"Research / Operators / Reference"** |

**Rule.** One destination, one label, everywhere. A navigation label is a name, not a description, and
never a sales line.

---

## 10. Microcopy and empty states

Empty states are where a product's character is most visible, because nothing else is competing for
attention.

| Current | Direction | Why |
|---|---|---|
| "Live scores and prediction states appear only when provider data supports them. Nothing is fabricated." | **"No live data for this match yet. Scores appear once the provider reports them."** | Answers the user's question — is it broken, when do I come back — instead of the team's |
| "Market trends will appear when qualifying data is available." | **"Not enough settled results yet to report a trend. Minimum sample: [n]."** | Turns an absence into a stated standard. The threshold is more authoritative than the apology |
| "No results for this filter" | **"No fixtures match these filters."** + a one-click reset | Names the object; offers the exit |
| "No data yet." | **"Not yet recorded."** | "No data" sounds broken; "not yet recorded" sounds procedural |
| "Acca not found" | **"This accumulator is not published."** | States the reason, not the lookup failure |
| "Fixture unavailable" | **"This fixture is not in the current dataset."** | Locates the absence in the data, precisely |

**The empty-state rule.** Name what is missing, state the condition under which it appears, and offer
the next action. Never apologise, never explain the provider architecture, never reassure.

**The microcopy rule.** Where a threshold, sample size or cut-off caused an outcome, state the number.
A stated threshold converts a limitation into a standard — the single cheapest authority move
available in this document, and one the product can make everywhere because the thresholds already
exist in the code.

---

## 11. Disclosure language

Compliance copy currently appears up to six times per commercial page. Repetition reads as legal fear;
one well-made disclosure reads as care.

**Direction.** One authoritative compliance moment per page. Where the affiliate relationship is
disclosed, use the plainest possible construction — and note that the product's existing disclosure is
already close to correct:

> "The criteria RankWagers uses to order sportsbook operators, what we deliberately do not assess, and
> how we earn money. Stated so you can check it rather than trust it."

**"What we deliberately do not assess"** is the most institutional phrase in the entire product. Stating
your own limits is the strongest possible authority signal, because only a party confident in its
method volunteers its boundaries. This construction should be extended everywhere the product has
limits: excluded markets, unqualified fixtures, unsupported competitions, insufficient samples.

---

## 12. The standard, as tests

Any sentence in the product must pass all six.

1. **Superlative test.** Contains no *best, top, leading, ultimate, premier, expert, hand-picked,
   exclusive, amazing*. → *Fails: homepage title, both hero titles, "Top pick", "Top rated".*
2. **Urgency test.** Contains no *now, today, this month, don't miss, limited, free*. → *Fails: "Top
   rated sites this month", "Free daily bonuses".*
3. **Assurance test.** Does not assert its own honesty, independence, accuracy or transparency. →
   *Fails: "Nothing is fabricated", "Independent reviews", "transparent settled results".*
4. **Number test.** Where a claim could be a number, it is a number. → *Fails: "comprehensive
   coverage" class of phrasing.*
5. **Check test.** Could a sceptical reader verify this sentence from the page it appears on? →
   *The benchmark: "Stated so you can check it rather than trust it."*
6. **Register test.** Uses the product's own technical vocabulary rather than the audience's slang. →
   *Fails: every use of "Acca" and "Signals".*

---

## 13. Priority

**Critical — these decide the category the brand is read into**

1. Homepage title and tagline (§5) — the front door currently announces an affiliate.
2. Delete all assured-honesty copy (§7) — 29 sentences, highest trust cost per word.
3. Retire "Signals" from navigation (§4.2) — one word, maximum damage.
4. Retire "Acca" from titles, navigation and headings (§4.1).
5. Resolve the bonus-channel CTA (§8.1) — the sentence that reveals the funnel.

**High**

6. Hero copy on all commercial surfaces (§6.1) — "hand-picked" must go in every language.
7. CTA language, especially the crossing of the commercial boundary (§8).
8. One noun per concept: Operator, accumulator (§4.3, §4.4).
9. Navigation labels, and one label per destination (§9).
10. Section titles: remove "this month", restore precise dates (§6.2).

**Medium**

11. Empty states rewritten to state condition and next action (§10).
12. Disclosure consolidated to one moment per page (§11).
13. Disclaimers removed from titles and meta descriptions (§7).
14. "What we deliberately do not assess" extended across limit-bearing surfaces (§11).

---

## 14. The one-line brief

**Delete every sentence that asks to be believed, and replace it with a number, a date, or a stated
limit.** The institution is already written into the interior of this product — in *Evidence strength*,
*Qualification*, *Provenance*, *Kick-off (UTC)*, and in one sentence about how the money is earned. The
work is not to invent a voice. It is to stop apologising, stop selling, and let the vocabulary that
already exists reach the front page.
