# RankWagers — Editorial Copy Standard

**Type:** Final copy standard and master deck. **No implementation.**
**Authority:** Editorial. Every string below is the approved English source text.
**Date:** 2026-08-01.
**Supersedes:** the direction given in `institutional-voice-and-copy-standard.md`. Where the two
differ, this document governs — see §1.2.

**Scope and its limits, stated plainly.** This deck covers the complete English source copy for the
user-visible product: site identity, navigation, page titles and descriptions, headlines, section
titles, buttons, table labels, microcopy and disclosure. It does **not** cover: (a) legally mandated
compliance wording, which is marked **[LEGAL]** and must not be changed on editorial grounds alone;
(b) translation — the five other localised languages require re-translation *from the approved English
below*, not amendment of the existing translations, which were translated from promotional source
text and therefore carry the promotional register into every locale.

---

## 1. Editorial position

### 1.1 The standard

> **Research reports what was measured. Advertising promises what will happen. Every sentence in this
> product must be of the first kind.**

The test applied to every string in this deck: *could this sentence appear above a table of data
without the table contradicting it?* If the sentence makes a claim the page cannot evidence, it is
advertising, and it has been rewritten or removed.

The current copy fails this comprehensively in one place and passes it comprehensively in another. The
`cta`, `telegram`, `home` and `meta` namespaces of `lib/dictionaries.ts` — which is to say the site's
title, tagline, hero, buttons and every translated string — are a textbook affiliate deck: *best,
top-rated, hand-picked, exclusive, free, claim, verdict, pick, this month, Copied!*. The component
vocabulary is the opposite: *Evidence strength. Qualification. Provenance. Coverage. Threshold.
Excluded. Market odds snapshot. Kick-off (UTC).*

The product's problem is not that it lacks an institutional voice. It is that the institutional voice
was never given the strings a reader actually sees.

### 1.2 One correction to the previous standard

The previous document recommended adopting **"evidence-first"** — the product's own coinage — as the
brand line. Against affiliate copy, that was the right direction. Against this standard it does not
pass: *evidence-first* is a hyphenated claim adjective doing the work a stated method should do. It
asserts a quality rather than naming a practice.

The stronger form always names the method: not *"Operators — evidence-first sportsbook intelligence"*
but **"Operators — assessed against published criteria"**. The second is shorter, checkable, and makes
a harder commitment. The standard has been tightened; the direction has not reversed.

---

## 2. House style

Mechanical rules. These resolve every string not enumerated in §3.

### 2.1 Typography and punctuation

| Rule | Application |
|---|---|
| **Sentence case everywhere** | Headings, titles, buttons, labels, navigation. Never Title Case. *"Responsible gambling"*, not *"Responsible Gambling"* |
| **No exclamation marks** | Anywhere, in any language. *"Copied!"* → *"Copied"* |
| **"and", not "&"** | In all prose and titles. "&" survives only in code identifiers |
| **One em dash maximum per title** | The dash separates subject from statement. A second dash means the sentence needs a full stop |
| **No ellipses** | They imply withheld information |
| **Serial comma** | Use where it removes ambiguity, not by default |
| **Quotation marks** | Only for quoted speech or a term being defined. Never for emphasis |

### 2.2 Numbers, dates and units

| Rule | Application |
|---|---|
| **Figures for all data** | Always. *38 of 412 fixtures qualified* |
| **Words for one to nine in prose only** | *three competitions*, but *3 of 12 markets* |
| **Dates: 1 August 2026** | Never "01/08/26". Never "this month", "recently", "updated regularly" |
| **Times carry a zone** | *Kick-off (UTC)*. The product already does this — protect it |
| **`%` with a figure** | *54%*, never *fifty-four per cent*, never *over half* |
| **State the sample** | Any rate, percentage or average is accompanied by n |
| **Round honestly** | Do not present a precision the method does not support |

### 2.3 Person and attribution

| Rule | Application |
|---|---|
| **No possessive first person for product objects** | *"our rating"*, *"our verdict"*, *"our criteria"*, *"our team"* → *the assessment*, *the criteria*. The product does not have opinions; it has methods |
| **First person reserved for accountability** | Use "we" only for how money is earned, what is not assessed, and what was got wrong. This is the only self-reference an institution makes |
| **Never assert your own character** | Banned as self-description: *independent, honest, transparent, trusted, unbiased, expert*. A publication that says it is independent is asking for belief; one that publishes its incentives is offering proof |
| **Attribute and date every figure** | Source and date travel with the number |

### 2.4 Banned vocabulary

Never appears in user-visible copy.

**Promotional:** best · top · top-rated · leading · premier · ultimate · hand-picked · expert ·
exclusive · amazing · must-have · unmissable · boost · unlock · supercharge
**Urgency:** now · today (as urgency) · this month · limited time · don't miss · hurry · act fast
**Free as a value claim:** *free bonus*, *free spins* — permitted only inside a quoted operator offer,
never in RankWagers' own voice
**Tipster register:** tip · pick · verdict · signal · banker · lock · insider · sure · guaranteed
**Self-assurance:** independent · honest · transparent · trusted · reliable · accurate — when used
about RankWagers
**SEO churn:** updated monthly · latest · fresh · comprehensive · complete guide · everything you need
**Weak link text:** click here · read more · learn more · find out more

### 2.5 Required constructions

These carry the institutional register and should be used wherever the underlying fact exists.

- **"Assessed 1 August 2026"** — replaces every "last updated" and "this month"
- **"What this does not cover"** — the strongest authority signal available; extend to every surface
  with limits
- **"Sample: 412 settled predictions"** — a rate without n is not a finding
- **"Recorded before kick-off"** — the pre-commitment claim, stated plainly
- **"Not in the current dataset"** — replaces "unavailable" and "not found" for data absences
- **"Stated so you can check it rather than trust it"** — the house sentence, reserved for disclosure

---

## 3. Master copy deck

Approved English source text. Left column is current; right column is final.

### 3.1 Site identity

| Key | Current | **Final** |
|---|---|---|
| `tagline` | "Compare betting & crypto betting sites by published criteria" | **"Football match evidence, model probability and settled results."** |
| `homeTitle` | "Best Crypto Betting Sites — Reviews, Bonuses & Comparison" | **"RankWagers — football research and settled prediction records"** |
| `homeDescription` | "Independent comparison of the best betting and crypto betting sites, ranked by published criteria. Updated bonuses, expert reviews and side-by-side data." | **"Football markets assessed before kick-off, with model probability, supporting evidence, and the settled result of every prediction published."** |
| `bestBettingTitle` | "Best Betting Sites — Independent Reviews & Bonuses" | **"Sportsbook operators — assessed against published criteria"** |
| `bestBettingDescription` | "Compare top-rated betting sites using our published criteria: honest reviews, welcome bonuses and payout speed. Updated monthly by our team." | **"Operators assessed against criteria published in full: licensing, settlement terms, payout times and market coverage. The criteria state what they do not cover."** |

The homepage title is the single highest-value string in the product. It is currently an affiliate
category page title and is read first by every human, every crawler and every answer engine.

### 3.2 Navigation — primary

| Current | **Final** |
|---|---|
| Research *(group)* | **Research** |
| Bookmakers *(group)* | **Operators** |
| Browse *(group)* | **Reference** |
| Today | **Today's fixtures** |
| Acca Studio | **Accumulators** |
| Published Accas | **Published accumulators** |
| Acca Builder | **Build accumulator** |
| Combo (→ Builder) | **[remove]** |
| Qualified Fixtures | **Qualified fixtures** |
| Live Signals | **Live matches** |
| Saved | **Shortlist** |
| Archive | **Archive** |
| Methodology | **Methodology** |
| Best Betting Sites | **Operators** |
| Best Crypto Betting Sites | **Crypto operators** |
| Bonuses | **Promotions** |
| Operators | **Operators** |
| Markets | **Markets** |
| Competitions | **Competitions** |
| Teams | **Teams** |
| Seasons | **Seasons** |
| Search | **Search** |

`Reviews` → **Assessments**. `Guides` → **Reference**, or remove if unused.

### 3.3 Navigation — footer

One destination, one label. The footer currently disagrees with the primary navigation on three
destinations.

| Current | **Final** |
|---|---|
| Explore *(heading)* | **Research** |
| Trust & legal *(heading)* | **Method and legal** |
| Today's research | **Today's fixtures** |
| Bookmakers | **Operators** |
| Best betting sites | **Operators** *(consolidate — one entry)* |
| Prediction archive | **Archive** |
| Verified performance | **Settled record** |
| Responsible Gambling | **Responsible gambling** |
| Terms | **Terms** |
| Privacy | **Privacy** |
| Availability | **Availability** |

### 3.4 Page titles and descriptions

| Route | **Final title** | **Final description** |
|---|---|---|
| `/` | RankWagers — football research and settled prediction records | *§3.1* |
| `/acca` | Accumulator research — combined selections and evidence | Build a combined selection from published RankWagers research. Combined odds, risk classification and the evidence behind each leg. |
| `/acca/builder` | Accumulator construction — evidence-weighted selections | Generate combined selections from published list predictions, with the supporting evidence and recorded odds for each leg. |
| `/accas` | Published accumulators | Combined selections published by RankWagers, with their settled results. |
| `/archive` | Prediction archive — every published prediction and its settled result | Settled prediction history, wins and losses included. Filter by market, competition, team and settlement status. |
| `/archive/[date]` | Predictions published 1 August 2026 | Every prediction recorded on this date, with its settled result. |
| `/methodology` | Methodology — qualification, probability derivation and settlement | How markets are qualified, how model probability is derived, how outcomes are settled, and how daily archives are preserved. |
| `/how-we-rank` | How we rank operators — criteria, limits and commercial disclosure | *(keep current — the strongest description in the product)* |
| `/operators` | Operators — assessed against published criteria | Sportsbook operators assessed against published criteria, with market coverage and availability by country. |
| `/operators/[slug]` | {Operator} — assessment, coverage and availability | {Operator} assessed against published criteria. Market coverage, settlement terms and country availability, dated. |
| `/reviews/[brand]` | {Operator} assessment | {Operator} assessed against published criteria, including what the criteria do not cover. |
| `/compare/[slug]` | {A} and {B} — compared against published criteria | Two operators assessed against the same published criteria, side by side. |
| `/best-betting-sites` | Sportsbook operators — assessed against published criteria | *§3.1* |
| `/best-crypto-betting-sites` | Crypto-accepting operators — assessed against published criteria | Operators accepting cryptocurrency, assessed against the same published criteria as all others. |
| `/bonuses` | Operator promotions — terms and stated limits | Promotional offers advertised by listed operators, with their stated terms, qualifying conditions and limits. |
| `/markets` | Betting markets — definitions, qualification and coverage | What each market means, how RankWagers qualifies it, and where it is covered. |
| `/markets/[slug]` | {Market} — definition, qualification and settled record | How {Market} is defined, the conditions under which it qualifies, and its settled prediction record. |
| `/competitions` | Competitions — coverage and settled records | Competitions covered by RankWagers, with fixture coverage and settled prediction records. |
| `/competitions/[slug]` | {Competition} — coverage and settled record | |
| `/teams` | Teams — coverage and settled records | |
| `/teams/[slug]` | {Team} — fixtures, evidence and settled record | |
| `/seasons` | Seasons — coverage and settled records | |
| `/countries` | Countries — research and operator availability | Football research by country, with operator availability by jurisdiction. |
| `/countries/[code]` | {Country} — research and operator availability | |
| `/fixtures/[matchId]` | {Home} v {Away} — evidence and settlement | Match evidence, model probability and settlement record for {Home} v {Away}, {competition}, {date}. |
| `/availability` | Operator availability by country | Which operators are available in which jurisdictions, and when this was last confirmed. |
| `/search` | Search | Search fixtures, teams, competitions, markets and operators. |
| `/responsible-gambling` | Responsible gambling | **[LEGAL]** |
| `/terms` | Terms | **[LEGAL]** |
| `/privacy` | Privacy | **[LEGAL]** |

**Title pattern for all generated pages:** `{Subject} — {what is stated about it}`. No superlative, no
year, no month, no question mark, no brand suffix beyond what the template applies.

**Removed:** *"Evidence Combo → Acca Builder"*. An arrow is an internal note, not a title.

### 3.5 Headlines and hero

| Key | Current | **Final** |
|---|---|---|
| `heroTitle` | "The best crypto betting sites, ranked by our published criteria" | **"Crypto-accepting operators, assessed against published criteria"** |
| `heroSubtitle` | "Hand-picked, independently reviewed and ranked. Compare bonuses, payouts and features in one place." | **"Each operator is assessed against the same criteria, published in full — including what those criteria do not cover."** |
| `bettingHeroTitle` | "The best betting sites, ranked by our published criteria" | **"Sportsbook operators, assessed against published criteria"** |
| `bettingHeroSubtitle` | "Licensed bookmakers compared side by side — welcome bonuses, payout speed and our independent ratings." | **"Licensing, settlement terms, payout times and market coverage, recorded per operator and dated."** |
| Homepage hero | *(component)* | **"Football markets, assessed before kick-off."** |
| Homepage sub | *(component)* | **"Every prediction is recorded before the match and scored against the result — including the ones that lose."** |

The replacements make a harder commitment than the originals while sounding calmer. That is the
mechanism: authority comes from voluntary exposure to being checked, not from emphasis.

### 3.6 Section titles

| Current | **Final** |
|---|---|
| "Top rated sites this month, by our published criteria" | **"Operators, ordered by published criteria"** + a separate line: **"Assessed 1 August 2026"** |
| "Verified performance" | **"Settled record"** |
| "Qualified markets" | **keep** |
| "Market odds snapshot" | **keep** |
| "Recent history" | **keep** |
| "Live Signals" | **"Live matches"** |
| "Saved" | **"Shortlist"** |
| "Frequently asked questions" | **"Common questions"** |
| "How to claim your bonus in 3 steps" | **"How the advertised offer is applied"** |
| "Our verdict" | **"Assessment summary"** |
| "Explore" | **"Research"** |
| "Trust & legal" | **"Method and legal"** |

### 3.7 Buttons and calls to action

Every button states the action and its destination. No benefit, no urgency, no first-person possessive.

| Key | Current | **Final** |
|---|---|---|
| `home.visit` | "Visit site" | **"Open operator site"** |
| `cta.visitNow` | "Visit" | **"Open operator site"** *(consolidate with above)* |
| `home.review` | "Read review" | **"Read assessment"** |
| `home.topPick` | "Top pick" | **[remove — no replacement]** |
| `home.ratingLabel` | "Our rating" | **"Assessment score"** |
| `home.bonusLabel` | "Welcome bonus" | **"Advertised offer"** |
| `cta.claimBonus` | "Claim bonus" | **"View offer terms"** |
| `cta.getBonus` | "Get bonus" | **"View offer terms"** *(consolidate — one key)* |
| `cta.promoCode` | "Bonus code" | **"Offer code"** |
| `cta.copy` | "Copy" | **keep** |
| `cta.copied` | "Copied!" | **"Copied"** |
| `cta.noCodeNeeded` | "No code needed — bonus applied automatically" | **"No code required. The operator applies the offer at account opening."** |
| `cta.ourVerdict` | "Our verdict" | **"Assessment summary"** |
| `cta.lastUpdated` | "Last updated" | **"Assessed"** |
| `cta.newPlayers` | "New players only" | **"New accounts only"** |
| Post-build continue | "Continue" | **"Continue to operator"** |

**"Claim" is the most important single deletion in this table.** It is the defining verb of affiliate
marketing: it frames the reader as a claimant and the offer as owed. *View offer terms* describes the
same action accurately and asks nothing.

### 3.8 Table and data labels

| Key | Current | **Final** |
|---|---|---|
| `table.rank` | "#" | **keep** |
| `table.brand` | "Brand" | **"Operator"** |
| `table.bonus` | "Bonus" | **"Advertised offer"** |
| `table.rating` | "Rating" | **"Assessment"** |
| `cta.scoreBonus` | "Bonus" | **"Offer terms"** |
| `cta.scoreOdds` | "Odds" | **keep** |
| `cta.scorePayments` | "Payments" | **keep** |
| `cta.scoreApp` | "Mobile app" | **keep** |
| `cta.scoreSupport` | "Support" | **keep** |

The score categories are already neutral and specific. They should not be made friendlier.

### 3.9 The three-step offer sequence

Currently framed as an instruction to the reader, which is the structure of a conversion funnel.
Reframed as a description of what the operator does.

| Key | Current | **Final** |
|---|---|---|
| `howToClaim` | "How to claim your bonus in 3 steps" | **"How the advertised offer is applied"** |
| `step1Title` | "Sign up" | **"Account opening"** |
| `step1Body` | "Sign up through our link. Opt in to the welcome offer if the site asks." | **"An account is opened with the operator through a RankWagers link. Some operators require the reader to opt in to the offer."** |
| `step2Title` | "First deposit" | **"Qualifying deposit"** |
| `step2Body` | "Make a qualifying first deposit (FTD) with crypto, card or e-wallet." | **"The operator requires a qualifying first deposit, by card, e-wallet or cryptocurrency."** |
| `step3Title` | "Bonus applied" | **"Offer credited"** |
| `step3Body` | "Your welcome bonus is credited per the operator's rules for your country." | **"The operator credits the offer under its own terms for the reader's country."** |

Note the person shift: from *you do this* to *the operator does this*. The product stops instructing
the reader and starts describing a commercial process — which is what a research publication does with
someone else's offer.

### 3.10 Microcopy — empty, absent and error states

| Current | **Final** |
|---|---|
| "Live scores and prediction states appear only when provider data supports them. Nothing is fabricated." | **"No live data for this match yet. Scores appear once the provider reports them."** |
| "Market trends will appear when qualifying data is available." | **"Not enough settled results to report a trend. Minimum sample: {n}."** |
| "No results for this filter" | **"No fixtures match these filters."** + **"Clear filters"** |
| "No matching entities" | **"No matches for this search."** |
| "No data yet." | **"Not yet recorded."** |
| "No candidates" | **"None recorded."** |
| "Acca not found" | **"This accumulator is not published."** |
| "Could not load Acca" | **"This accumulator could not be loaded. Try again."** |
| "Fixture unavailable" | **"This fixture is not in the current dataset."** |
| "Country hub unavailable" | **"This country is not in the current dataset."** |
| "Locale not supported" | **"This language is not available."** |
| "Not found" | **"Page not found."** |
| "Start a search" | **"Search fixtures, teams, competitions and operators."** |
| Loading | **"Loading"** — no ellipsis, no "please wait" |

**The empty-state rule.** Name what is missing, state the condition under which it appears, and offer
the next action. Never apologise. Never explain the provider architecture. Never reassure.

**The threshold rule.** Where a stated minimum caused the absence, publish the number. *"Minimum
sample: 30"* converts a limitation into a standard, and the thresholds already exist in the product.

### 3.11 Disclosure and commercial content

| Key | Current | **Final** |
|---|---|---|
| `footer.disclaimer` | "We may earn a commission when you sign up through links on this site. This does not affect our independent ratings." | **"RankWagers earns a commission when a reader opens an account with an operator through a link on this site. The criteria used to order operators are published in full, including what they do not assess."** |
| `footer.affiliateNotice` | *(label)* | **"Commercial disclosure"** |
| `blocked.title` | "Not available in your region" | **keep** |
| `blocked.body` | "This website is not accessible from your location." | **keep** |

The current disclaimer's second sentence — *"This does not affect our independent ratings"* — is an
unverifiable assurance about the product's own character, and it is the one place where such a claim
does most damage, because it appears immediately after admitting a financial interest. The replacement
substitutes a pointer the reader can check. **The disclosure is stronger for making no promise.**

**Telegram surfaces.** These cannot be rewritten into research language, because the underlying offer
is promotional. The honest treatment is accurate labelling, not softer wording.

| Key | Current | **Final** |
|---|---|---|
| `telegram.title` | "Free daily bonuses on Telegram" | **"Operator promotions on Telegram"** |
| `telegram.body` | "Exclusive promo codes, free spins and reload offers — delivered daily to our channel." | **"Promotional offers from listed operators, published as they are announced. Commercial content."** |
| `telegram.button` | "Open Telegram channel" | **keep** |
| `home.ctaTelegram` | "Join our free bonus channel" | **"Operator promotions on Telegram"** |

The words **"Commercial content"** are load-bearing. A research publication may carry advertising; it
may not carry advertising that is indistinguishable from its research. Labelling costs nothing and is
the difference between a publication with a commercial section and a commercial site with a research
section.

### 3.12 Compliance strings — **[LEGAL]**

These are not editorial property. The wording below is a *recommendation for legal review*, not an
approved change. Editorial's only requirement is that each appears **once per page**, not six times.

| Key | Current | Editorial note |
|---|---|---|
| `footer.ageWarning` | "18+ only. Gamble responsibly." | Retain function. "Gamble responsibly" is contested by harm-reduction bodies; ask legal whether a jurisdiction-specific alternative is required |
| `cta.termsApply` | "18+. New players only. T&Cs apply. Gamble responsibly." | Expand "T&Cs" to "Terms and conditions apply" — abbreviation in compliance text is a dark-pattern signal |
| `ageGate.title` | "Are you 18 years of age or older?" | **"Are you 18 or older?"** — shorter, same legal function |
| `ageGate.yes` | "Yes, I am 18 or older" | keep |
| `ageGate.no` | "No, exit site" | **"No, leave this site"** |
| `ageGate.body` | "This website contains gambling-related content and is intended for adults only…" | keep |

---

## 4. Sentence patterns

For every string not enumerated above.

| Situation | Pattern | Example |
|---|---|---|
| Page title | `{Subject} — {what is stated}` | Arsenal — fixtures, evidence and settled record |
| Section title | Noun phrase, no verb, no claim | Settled record · Qualified markets |
| Data label | Shortest accurate noun | Assessment · Advertised offer · Kick-off (UTC) |
| Button | `{Verb} {object}` naming destination | Open operator site · Read assessment |
| Empty state | `{What is absent}. {Condition for appearance}.` | No live data yet. Scores appear once the provider reports them. |
| Absence of data | `{Object} is not in the current dataset.` | This fixture is not in the current dataset. |
| Freshness | `Assessed {date}` | Assessed 1 August 2026 |
| A rate | `{figure}% ({n} settled)` | 54% (412 settled) |
| A limit | `What this does not cover: {list}` | |
| Commercial content | `{Description}. Commercial content.` | |

---

## 5. Protected copy

Do not amend. These already meet the standard and several are better than anything proposed above.

- **"…and how we earn money. Stated so you can check it rather than trust it."** The best sentence in
  the product. It should be quoted on the disclosure page and echoed nowhere else, so it retains force.
- **"what we deliberately do not assess"** — extend this construction; do not dilute it.
- **"Kick-off (UTC)", "Created (UTC)"** — explicit time zones are the mark of a serious publication.
- The component vocabulary: **Evidence strength · Model confidence · Qualification · Provenance ·
  Coverage · Threshold · Excluded · Supported markets · Settled · Lead time · Closing line · Market
  odds snapshot · Overall cohort · By market.** Precision that needs a glossary is an asset. Publish
  the glossary; do not simplify the terms.
- **"How we rank operators — criteria, limits and commercial disclosure"** — the model title.

---

## 6. Priority

**Critical — these determine the category the product is read into**

1. `homeTitle`, `tagline`, `homeDescription` (§3.1). The front door currently reads as an affiliate.
2. Delete all self-assurance copy: *"Nothing is fabricated"*, *"independent ratings"*, *"honest
   reviews"*, *"transparent settled results"*, *"not tipster claims"* — approximately 29 sentences.
3. `cta.claimBonus` / `getBonus` → **"View offer terms"** (§3.7).
4. "Live Signals" → **"Live matches"** (§3.2). One word, maximum category damage.
5. Telegram strings labelled **"Commercial content"** (§3.11).

**High**

6. All hero copy — "hand-picked" must not survive in any language (§3.5).
7. "Acca" removed from every title, navigation label and heading (§3.2, §3.4).
8. `footer.disclaimer` rewritten to remove the unverifiable assurance (§3.11).
9. One label per destination across navigation and footer (§3.2, §3.3).
10. "Top rated sites this month" → ordering statement plus a date (§3.6).
11. The three-step sequence reframed from instruction to description (§3.9).

**Medium**

12. Empty states and absence states (§3.10).
13. Table and score labels (§3.8).
14. Sentence case and exclamation removal sitewide (§2.1).
15. Compliance strings consolidated to one per page and referred to legal (§3.12).

---

## 7. Governance

**Six tests. A string ships only if it passes all six.**

1. **Superlative.** No *best, top, leading, expert, hand-picked, exclusive*.
2. **Urgency.** No *now, today, this month, free, limited, don't miss*.
3. **Self-assurance.** Makes no claim about RankWagers' own honesty, independence or accuracy.
4. **Evidence.** Any claim that could be a number is a number, with its sample.
5. **Check.** A sceptical reader could verify the sentence from the page it appears on.
6. **Register.** Uses RankWagers' technical vocabulary, not the audience's slang.

**Translation rule.** The five localised languages must be re-translated from the approved English in
§3, not amended. The existing translations were made from promotional source text and carry
*"meilleurs sites de paris"*, *"Rejoignez notre canal de bonus gratuit"*, *"Notre note"* — the same
affiliate register, faithfully rendered. Correcting the English alone leaves every non-English reader
with the old brand.

---

## 8. The standard in one line

**Delete every sentence that asks to be believed. Replace it with a number, a date, or a stated
limit.** The product already writes like a research desk in its columns and labels; it writes like an
affiliate in its titles, headlines and buttons. This deck moves the first register into the second's
positions — and removes, rather than rewrites, the sentences that exist only to sell.
