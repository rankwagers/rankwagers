# RankWagers — Search Quality Review

> **Type:** Adversarial review from a Google Search Quality perspective (YMYL rater lens + spam-policy
> lens). **Review only — no architecture change proposed, no programmatic content proposed.**
> **Date:** 2026-08-01. **Method:** the shipped surface only (`app/[locale]/**`, `lib/**`,
> registries, structured data). Plans were deliberately ignored — raters see pages, not roadmaps.
> **Scope note:** every finding below cites shipped code. Nothing is inferred from intent.

---

## Verdict

**The rigor is inverted.** RankWagers has built extraordinary evidential machinery — immutable
content-hashed archives, server-authoritative settlement, published losses, "what we do not assess" —
and applied almost all of it to the content that *doesn't* earn money. The content that *does* earn
money (operator ratings, "best betting sites", brand reviews) rests on hardcoded editorial numbers
with no author, no date, no evidence, no test, and no link to the methodology page that explains
them.

Google's YMYL scrutiny falls hardest exactly where the rigor stops. A rater assessing this site opens
`/reviews/1xbet`, sees a 4.9-star rating authored by an organization, an auto-updating year in the
title, and four FAQ answers identical to every other brand — and never reaches the evidence archive.
The site's best work is invisible from its most-scrutinized page.

**Second structural problem:** 30 locales multiply every page — including trust pages whose body copy
is hardcoded English — into ~30 near-duplicate URLs, each declared a legitimate hreflang alternate.
That is a self-inflicted scaled-content pattern on a site that otherwise refuses programmatic spam.

**Third:** the transparency claim rests on **23 non-contiguous days** of archive.

---

## Scorecard

| Dimension | Grade | One line |
|---|---|---|
| EEAT | **Weak** | Zero `Person` schema, zero bylines, zero credentials, ratings with no evidence or date |
| Helpful Content | **Mixed** | Genuinely people-first honesty patterns undercut by 30× duplication and fabricated freshness |
| Entity Authority | **Weak** | 42 teams / 14 competitions / 3 operators; **zero `sameAs`**; no entity reconciliation |
| Topical Authority | **Weak-Mixed** | Hubs exist but the corpus is shallow; no encyclopedic depth on any entity |
| Internal Linking | **Weak** | Money pages orphaned from methodology; no `/reviews` hub; key pages unlinked from footer |
| Information Gain | **Strong (latent)** | Real unique data exists — it just isn't on the pages that need it |
| Originality | **Mixed** | Archive/settlement genuinely original; brand FAQs are literal templates |
| Freshness | **Weak** | Auto-year in titles, no `dateModified` on reviews, 23 sparse archive days |
| Historical Content | **Weak** | The signature asset is 23 days deep and non-contiguous |
| Research Value | **Mixed** | Methodology is good; entity pages carry one day of data |
| Citation Value | **Weak** | Nothing on the site is citable in a stable, quotable form today |
| User Intent | **Weak-Mixed** | Comparison, "is X safe", and payout intents are unserved or served by templates |
| Content Depth | **Weak** | 60–83-line entity pages rendering mostly registry constants |
| Search Journey | **Weak** | No path from a commercial query to the evidence that would justify trusting it |
| Return Visits | **Weak** | Nothing is savable, subscribable, or personal; saved state is `localStorage` only |

---

## 1. The inverted-rigor problem (highest severity)

**Evidence:**

- Ratings are hardcoded constants: `lib/brands.ts:49,120,130,141,152,163,174,185,196` → `4.9, 4.8,
  4.7, 4.7, 4.6, 4.6, 4.5, 4.5, 4.4`. Sub-scores (`bonus`, `odds`, `payments`, `app`, `support`,
  `lib/brands.ts:29-35`) are likewise hand-set.
- **Every rated operator scores between 4.4 and 4.9.** No operator is ever rated poorly. To a quality
  rater this compressed, uniformly-positive range across commercial partners is the single clearest
  affiliate-bias signal there is — and it is visible without reading a word of copy.
- The `Review` JSON-LD (`app/[locale]/reviews/[brand]/page.tsx:72-83`) carries
  `author: { "@type": "Organization" }`, **no `datePublished`, no `dateModified`**, and a
  `reviewRating` with no stated basis.
- `payoutTime`, `minDeposit`, `licenses` (`lib/brands.ts:19-22`) are free-text strings with no
  verification date and no source.
- There is **no evidence of first-hand experience anywhere** — no account-opening walkthrough, no
  screenshots, no withdrawal test, no dated "last verified". The second E of E-E-A-T is absent.

**Why this is severe:** gambling is YMYL. Under the rater guidelines, a page that recommends where to
deposit money, authored by nobody, dated never, and evidenced not at all, is Low quality regardless of
the site's other virtues. The evidence architecture does not transfer to it, because a rater cannot
see a connection that the internal linking does not make.

**The cruel irony:** `/how-we-rank` (`app/[locale]/how-we-rank/page.tsx:60-120`) is genuinely
excellent — it discloses commission, states criteria, derives the ordering basis rather than asserting
it, and has a "What we do not assess" section that most publishers would never ship. It is exactly
what a rater wants. **It is linked from nowhere in the footer or nav, and not from
`/reviews/[brand]` where the rating actually appears.** The only inbound links are via
`components/trust/OrderingDisclosure.tsx` on `/operators` and brand-list sections.

---

## 2. The 30-locale multiplication (second-highest severity)

`lib/i18n.ts:1-32` defines **30 locales**. `lib/seo.ts:29-38` emits hreflang alternates for **all 30
on every path unconditionally**, plus `x-default`.

Several of the most important pages hold their body copy as **hardcoded English constants** and
statically generate all 30 locales anyway:

| Page | Evidence |
|---|---|
| `/methodology` | `TITLE`/`DESCRIPTION` consts at `:14-17`; body headings and paragraphs hardcoded English `:75-130`; `generateStaticParams` returns all locales `:18-20` |
| `/how-we-rank` | same pattern, hardcoded English body `:60-120` |
| `/archive`, `/acca`, `/acca/builder`, `/combo` | hardcoded `TITLE`/`DESCRIPTION` consts |

So `/ja/methodology`, `/ar/methodology` and `/de/methodology` serve identical English text, each
declaring the other 29 as valid language alternates. That is ~30 near-duplicate URLs per affected
page, and hreflang actively asserts they are *not* duplicates.

**Rater/spam read:** this is the shape of scaled content abuse — mass URL generation without
per-URL value. It is more damaging here than on a typical site because the duplicated pages are the
*trust* pages: the ones a rater reads to assess EEAT. Finding the same untranslated English
methodology at 30 URLs reads as automation, not as a global mission.

**Compounding:** RTL locales (`ar`), CJK (`ja`, `ko`, `zh`), and Indic (`hi`, `bn`, `ta`, `te`, `mr`)
are declared. Serving English into `/ar/` while claiming `hreflang="ar"` is a mismatch a rater will
mark as unhelpful for the stated audience.

---

## 3. EEAT — Weak

Beyond §1:

- **`grep '"Person"'` across `lib/`, `components/`, `app/` returns 0.** No author entity exists
  anywhere on the site. Not on reviews, not on methodology, not on the archive.
- No `/about`, `/editorial-policy`, `/corrections`, or `/contact` page exists (verified against the
  34-page inventory). For a YMYL site this is a hard EEAT ceiling — there is no "who" to assess.
- The manifesto commits to "corrections are additions to the record, never erasures" — **there is no
  public corrections page** where a rater could see that commitment honoured.
- No license/regulator verification surface for operators; `licenses` is an unverified string array.
- Positive and worth preserving: `/responsible-gambling` exists and is footer-linked; ordering
  disclosure is derived rather than asserted; the archive shows losses.

---

## 4. Helpful Content — Mixed

**Working with the system:**
- Empty-state honesty (missing data stays unavailable rather than being filled with estimates,
  `/methodology` §evidence).
- Losses are never filtered from archive views (`/methodology` §settlement).
- "What we do not assess" (`/how-we-rank`) is a rare, strongly people-first pattern.

**Working against it:**
- `app/[locale]/reviews/[brand]/page.tsx:39` — `${new Date().getFullYear()}` in the title produces
  "1xBet Review (2026)" while the content is static. **This is fabricated freshness**: the signal
  updates, the substance does not. It also contradicts the site's own Art. VIII.
- `lib/brandDetails.ts:32-49` — `FTD_FAQ(name, bonusHint)` emits **four identical Q&As per brand with
  the name substituted**, published as `FAQPage` structured data. This is "a template with swapped
  nouns" — the exact pattern the project's own governance forbids — shipped today.
- Those templated answers also make **unverified per-operator claims**: "operates under international
  gaming licences", "uses SSL encryption", "supports cryptocurrency deposits… in most supported
  regions" — asserted identically for every brand, on YMYL pages.

---

## 5. Entity Authority — Weak

- **Zero `sameAs` anywhere** (verified across `lib/`, `components/`, `app/`). No entity on this site
  is reconciled to Wikipedia, Wikidata, an official club site, or a regulator registry. Entity
  authority is largely *established* through `sameAs` reconciliation; its total absence means Google
  has no way to connect "Arsenal" here with the Arsenal it knows.
- `SportsTeam` LD (`lib/teams/schema.ts:9-15`) emits only `name`, `alternateName`, `sport`,
  `addressCountry`, `logo` — while `TeamEntity` (`lib/teams/types.ts`) already holds `foundedYear`,
  `venueName`, `aliases`, and `competitionSlugs` that are never expressed as `foundingDate`,
  `location`, `alternateName[]`, or `memberOf`. Available data is left off the entity.
- Corpus size: **42 teams, 14 competitions, 9 markets, 3 operators**. Three operators cannot support
  "best betting sites" as a category claim.
- `lib/search/types.ts:2-12` types `player`, `venue`, `referee` as entity types but
  `INDEXED_ENTITY_TYPES` excludes them — **no player entities exist at all.** Football entity
  authority without players is structurally incomplete; players are the highest-volume entity class in
  the sport and the one users search most.

---

## 6. Topical Authority — Weak-Mixed

Hub pages exist (`/teams`, `/competitions`, `/markets`, `/countries`, `/operators`, `/seasons`) and
the hub/spoke intent is visible. But topical authority is depth × coverage × interlinking, and:

- Depth per spoke is thin (§13).
- Coverage is 42 teams across 14 competitions — a fraction of any single major league's entity space.
- The market vocabulary is four list markets (first-half over 0.5, over 1.5, over 2.5, second-half
  over 0.5) per `/methodology`. The site does not cover 1X2, Asian handicap, correct score, cards, or
  corners — the markets carrying the most search demand — so it cannot be topically authoritative on
  "football betting markets" as a topic.
- No concept/explainer layer exists ("what is xG", "what is closing line value", "how Asian handicap
  works"). `lib/odds-history/closingLineValue.ts` computes CLV, but no page explains it.

---

## 7. Internal Linking — Weak

Footer (`components/Footer.tsx:17-36`) links: home, competitions, markets, teams, countries,
operators, search, best-betting-sites, bonuses, acca, acca/builder, methodology, archive, verified
performance, responsible gambling, terms, privacy, availability.

**Not linked from the footer or nav:**

| Page | Consequence |
|---|---|
| `/how-we-rank` | the commercial-transparency page is effectively orphaned |
| `/reviews/[brand]` | **no `/reviews` hub page exists at all** — review pages are orphan leaves |
| `/today` | a live-intent page with no persistent entry point |
| `/seasons` | orphaned entity hub |
| `/accas`, `/compare/[slug]` | orphaned surfaces |
| `/best-crypto-betting-sites` | in nav dict but absent from footer |

**The critical broken path:** a rating is displayed on `/reviews/[brand]` with no link to the page
explaining how ratings are produced. The claim and its justification are one click apart in the
information architecture and zero clicks apart in the user's mind — and the link does not exist.

`/archive/[date]` similarly has no sibling navigation to adjacent dates visible in the page shell,
which strands the only historical surface.

---

## 8. Information Gain — Strong, but stranded

This is the site's best latent asset and its most wasted one. Genuinely non-derivable information
exists: settled outcomes with server-authoritative settlement, model probability at qualification
time, evidence summaries recorded at archive time, odds movement and CLV primitives.

**But:** it lives at `/archive` and `/archive/[date]`, which are reachable from the footer and
nowhere near the commercial pages, and it is not exposed as citable, quotable, or comparative
content. A page that could say "this operator's price on this market was X when we published, Y at
kickoff" — genuinely new information no competitor has — does not exist.

---

## 9. Originality — Mixed

- **Original:** settlement transparency, published losses, hit-rate arithmetic that excludes
  pending/void, the ordering-basis derivation.
- **Not original:** brand FAQ blocks (literal template, §4), brand `pros`/`cons` and `description`
  (hand-written but generic — "Strong sports & casino mix", "Crypto deposits", "24/7 live chat" at
  `lib/brandDetails.ts:95`), bonus copy.
- The originality distribution is exactly backwards relative to competitive difficulty: unique where
  competition is low (archive), generic where competition is fiercest (brand reviews).

---

## 10. Freshness — Weak

- `data/daily-archives` contains **23 files** spanning `2026-03-02` → `2026-08-01`, with visible gaps
  (Mar 2, Mar 6, Apr 1, … Jul 30, Jul 31, Aug 1). The archive is not daily.
- Review pages carry **no `dateModified`/`datePublished`** at all, so there is no honest freshness
  signal — only the fabricated year in the title.
- Only `accaDetailLd` (`lib/acca-publication/schema.ts:63`) emits real `datePublished`/`dateModified`,
  and it correctly sources them from a guarded lifecycle transition. That pattern exists and is simply
  not applied anywhere else.
- Entity hubs have no "last updated" surface, so a rater cannot distinguish maintained from abandoned.

---

## 11. Historical Content — Weak (and this is the strategic wound)

Everything the platform claims — transparency, track record, "we have nothing to hide" — rests on
**23 non-contiguous days**. A rater checking the record finds five months of calendar with three days
in March and April.

There is also no historical *content* beyond prediction rows: no season retrospectives, no "how this
market behaved across the season", no dated methodology changelog (despite Art. XIV committing to
"every change disclosed and dated"). The `/methodology` page states current process with no version
history, so a reader cannot tell whether the method that produced a March result is the method
described today.

---

## 12. Research Value — Mixed

`/methodology` is solid and honest. But the research surfaces themselves carry one day of data
(§13), there is no way to filter or compare across history beyond the archive's flat filters
(`lib/archive/query.ts:9-35`: market, status, competition, team, free text), and no result of any
research action is addressable or shareable.

---

## 13. Content Depth — Weak (the thinnest layer)

`app/[locale]/teams/[slug]/page.tsx:50-56` is the clearest example:

```
const selectedDate = rawDate ?? today;
const result   = await getDailyMatchListsSafe(selectedDate);   // ONE day
const fixtures = mapDailyListsToQualifiedFixtures(lists);
const intelligence = buildTeamIntelligence(team, fixtures);
```

A team page's entire "intelligence" is computed from **a single day's qualified-fixture list**. If the
team is not playing today, `matchesInSample` is 0 and `sampleQuality` resolves to `"none"`
(`lib/teams/intelligence.ts:26-33,93-102`). `hasGoalEnrichment` is **hardcoded `false`**
(`:104`) — so no team page ever shows goal data.

**42 teams × 30 locales = 1,260 team URLs**, the large majority of which, on any given day, render a
registry constant, an empty sample, and an operator module. The quality gate does not catch this:
`assertPublicEntity` (`lib/data-quality/pipeline.ts:27-52`) checks only **existence in the registry**,
never data sufficiency.

Page implementation sizes corroborate the shallowness: `operators/[slug]` 60 lines,
`markets/[slug]` 69, `teams/[slug]` 70, `competitions/[slug]` 83 — versus `reviews/[brand]` at 310.
**The commercial page is 4× the depth of the entity pages**, which inverts the stated positioning.

---

## 14. Citation Value — Weak

Nothing on this site is citable today. There is no stable, quotable reference unit: no permanent
identifier surfaced to a reader, no "as of" statement, no dataset, no versioned figure. A journalist
who wanted to cite a hit rate would have to link a filtered archive URL whose contents change.

`Dataset` schema appears exactly once in the codebase; there is no dataset page behind it that a
reader can act on.

---

## 15. User Intent — Weak-Mixed

Mapping real query intents against shipped surfaces:

| Intent | Served? |
|---|---|
| "arsenal vs chelsea prediction" | Partially — `/fixtures/[matchId]`, conditionally indexable (`:51`) |
| "is 1xbet safe / legit" | **Template FAQ answer only**, identical across brands |
| "1xbet withdrawal time" | Unverified string field, no evidence, no date |
| "best betting sites" | 3 operators, all rated 4.4–4.9 |
| "over 2.5 goals strategy" | No explainer content exists |
| "what is xG" | Nothing |
| "premier league table" | Nothing — standings don't exist |
| "arsenal injury news" | Nothing |
| "arsenal squad / players" | Nothing — no player entities |
| "compare bet365 vs 1xbet" | `/compare/[slug]` exists but is unlinked from footer/nav |

Informational football intent — the largest volume and the stated positioning — is the least served.

---

## 16. Search Journey & Return Visits — Weak

- **Journey:** there is no path from a commercial query to the evidence that would justify trusting
  the recommendation. Someone landing on `/reviews/1xbet` cannot reach `/how-we-rank` or `/archive`
  from the page. The trust assets do not participate in the conversion journey at all.
- **Return visits:** nothing is savable server-side. `lib/research/savedFixtures.ts:6-19` is a
  `localStorage` array — device-bound, unshareable, lost on cache clear. No alerts, no follow, no
  newsletter, no account. A user who found value has no mechanism to come back to it, and Google sees
  no returning-user signal.

---

## 17. Weak page types (ranked)

| Page type | Why it is weak | Severity |
|---|---|---|
| `/reviews/[brand]` | unauthored, undated ratings; templated FAQ; fabricated year; no methodology link; no `/reviews` hub | **Critical** |
| `/teams/[slug]` | one-day sample; `hasGoalEnrichment` hardcoded false; ×30 locales | **Critical** |
| `/methodology`, `/how-we-rank` | best content on the site, English-only ×30, and `/how-we-rank` is orphaned | **High** |
| `/markets/[slug]` | 69 lines; 9 markets; no explainer or historical behaviour | **High** |
| `/operators/[slug]` | 60 lines; 3 operators; no verification evidence | **High** |
| `/competitions/[slug]` | 83 lines; no standings, no season structure, no squad | **High** |
| `/countries/[code]` | already carries a `doorway_risk` guard (`lib/seo/indexability.ts:52-62`) — the guard's existence concedes the type is doorway-shaped | **Medium** |
| `/archive` | the signature asset, 23 sparse days, footer-linked only | **Medium** |
| `/seasons`, `/accas`, `/compare/[slug]`, `/today` | orphaned from primary navigation | **Medium** |

---

## 18. Thin experiences

1. **Team page on a non-match day** — registry constants + "very-limited/none" sample + operators.
2. **Any trust page in 29 non-English locales** — English body under a localized URL and hreflang.
3. **Brand FAQ** — four templated Q&As with unverified claims, duplicated across every brand.
4. **`/markets/[slug]`** — a market definition with no historical behaviour, no example, no explainer.
5. **`/operators/[slug]`** — a rating and a bonus, no evidence.
6. **`/archive/[date]` for a sparse date** — a page for a day that may hold almost nothing.
7. **`/search`** — correctly `noindex` (`lib/seo/indexability.ts:8`), but there is no curated
   discovery surface behind it, so internal search is a dead end rather than a journey.

---

## 19. Missing content that deserves to exist

Stated as content types that require genuine per-page work — **not** programmatic expansion. Each
would have to pass the existing thin-content and doorway gates on its own merits.

**EEAT-critical (unblocks the YMYL ceiling):**
1. `/about` with named humans, roles, and relevant credentials — plus `Person` schema, currently
   absent site-wide.
2. `/editorial-policy` — how operators are selected, who can overrule a score, what triggers a
   re-review.
3. `/corrections` — the manifesto commits to corrections-as-additions; nothing public honours it.
4. **Dated, evidenced operator verification** — per operator: when it was last checked, by whom, what
   was tested (deposit, withdrawal timing, KYC, support response), with artefacts. This is the single
   highest-value gap on the site: it converts nine hardcoded numbers into first-hand experience.
5. A methodology **changelog** with dated entries (Art. XIV is currently unevidenced).

**Topical-authority gaps:**
6. Concept explainers for the metrics already computed in code — closing line value, model
   probability, settlement rules, void/push handling. The code exists; the explanation does not.
7. Standings and league structure — absent entirely, and one of the highest-volume football intents.
8. Player entities — `lib/search/types.ts` already reserves the type.

**Research/citation gaps:**
9. Season and market retrospectives grounded in the archive ("how the over-2.5 list performed across
   the season") — one page per genuine study, not per permutation.
10. A stable, quotable reference unit so that any published figure can be cited with an "as of" date.

---

## 20. What is genuinely strong (do not lose this)

A fair review must say what a rater would reward:

- **`/how-we-rank`** — commission disclosed up front, criteria enumerated, ordering *derived* from
  scores rather than asserted, and an explicit "what we do not assess". Better than almost anything
  in this vertical.
- **Losses published, void/pending excluded from hit rate** — the arithmetic is honest and stated.
- **Empty states are honest** — missing data stays missing rather than being estimated.
- **`noindex` discipline already exists** — search results, conditional fixture indexability,
  `doorway_risk` and `thin_content` verdicts (`lib/seo/indexability.ts`,
  `lib/seo-intelligence/content-quality.ts`). The governance machinery is real; it is simply not
  applied to the entity and review page types.
- **`accaDetailLd`** demonstrates the correct pattern — real `datePublished`/`dateModified` from a
  guarded lifecycle transition. It is the model the rest of the site should follow.

---

## 21. If only five things were fixed

Ordered by rater impact per unit of effort:

1. **Give the commercial pages an author, a date, and evidence** — or stop displaying a rating. A
   number no one signed and no one dated is the site's largest YMYL liability.
2. **Link `/how-we-rank` from every page that shows a rating**, and add a `/reviews` hub. The best
   content on the site is currently unreachable from where it matters.
3. **Stop generating untranslated locale variants of trust pages.** Serving 30 hreflang-declared
   copies of one English page is the clearest scaled-content signal on the domain.
4. **Fix the team-page sample window.** A page whose entire value is computed from one day, ×1,260
   URLs, with `hasGoalEnrichment` hardcoded false, is the largest thin-content surface.
5. **Replace the templated brand FAQ.** Four identical answers with unverified safety and licensing
   claims, emitted as structured data across every brand, is both duplicate content and an
   unsubstantiated YMYL claim.

---

_Reviewed against shipped code only. Related: `[[rankwagers-manifesto]]`,
`[[long-term-product-vision]]`, `[[football-research-platform-architecture]]`._
