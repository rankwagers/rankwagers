# RankWagers — Global Launch Product Excellence Review

**Type:** Product review. **No implementation, no code, no roadmap.**
**Date:** 2026-08-01.
**Relationship to `pre-launch-product-qa-review.md`:** that pass audited navigation, state boundaries,
duplication, tokens and performance posture. This pass goes deeper — into localisation depth, the card
system, the four core flows, copy, interaction quality and the specific moments where a user stops
believing the product. Prior findings are referenced, not re-derived. **Everything below is new unless
marked *(carried).***

**Method and limits.** Static review of the shipped surface. Not rendered, not device-tested, not
screen-reader tested. Findings requiring that pass are marked. All evidence is from the repository.

---

## 0. Verdict

The previous review concluded the product had an information-architecture problem. This deeper pass
finds something more serious underneath it.

> **RankWagers is not a 30-language product. It is a 6-language product with 24 English translations
> shipped under foreign-language URLs.**

`lib/dictionaries.ts:514` declares `Partial<Record<Locale, Dictionary>>` containing exactly six
entries — `en, fr, es, pt, de, ar` — with `es-es` aliased to `es`. The other **23 declared locales
resolve to the English dictionary by fallback**, softened only by nine partial overlays. A visitor at
`/ja`, `/ko`, `/th`, `/pl`, `/hi` or `/sw` receives an English product at a Japanese, Korean, Thai,
Polish, Hindi or Swahili URL, with `hreflang` telling search engines it is localised.

That single fact reframes the launch. This is not a polish problem. **A global launch cannot ship 23
locales that are not localised**, both because the experience is broken for those users and because
declaring language equivalence that does not exist is a credibility claim the product cannot support.

Beneath that, the second theme: **the product does not trust itself.** It tells users "nothing is
fabricated", stacks five compliance blocks on a single page, and hedges in its own page titles. The
engineering discipline is real and admirable; the copy expressing it reads as anxiety, and anxiety is
the fastest way to make a confident user suspicious.

---

## 1. Where users stop trusting the product

The most important section, taken first.

### 1.1 The product protests its own honesty — Critical

**Finding.** Roughly 29 instances of defensive self-assurance across components and pages: *"Nothing is
fabricated"* on the homepage, seven occurrences of "never fabricat…", seven of "no fabricat…", eleven
of "we do not / we never".

**Why users stop trusting.** Nobody arrives suspecting fabrication. Announcing that you do not
fabricate data introduces the possibility, then asks to be believed about it. It is the product
equivalent of "trust me" — the phrase that reliably produces the opposite. It also puts the product on
the defensive on its own homepage, before the user has formed any doubt.

The underlying discipline is genuinely rare and worth communicating. The correct expression of it is
demonstration — a visible provenance trail, a stated observation date, a sample size — not assertion.
**Show the mechanism, delete the claim about the mechanism.**

**Rank: Critical.** It affects first impression on the highest-traffic surface and it inverts the
product's greatest strength into a liability.

---

### 1.2 Compliance stacking reads as legal fear, not care — High

**Finding.** On a single commercial page a user encounters: the `18+` badge in `Header`, the
`GambleAwareNotice` (containing `18+` again), the affiliate notice box, the `EligibilityNotice`, the
footer `18+` badge, and the footer age warning. Six compliance blocks. `18+` alone appears in
`Header`, `MobileNav`, `GambleAwareNotice` and `Footer` — so at minimum three times on every page in
the product.

**Why users stop trusting.** Disclosure builds trust; *repetition* of disclosure destroys it. A page
that warns you six times reads as a product that expects to be sued, which invites the user to wonder
why. It also causes banner blindness — by the third notice the user has stopped reading, so the one
disclosure that legally matters is the one they skip.

**Rank: High.** **Direction.** One authoritative, well-designed compliance moment per page. Repetition
is not additional protection; it is diminishing signal.

---

### 1.3 An unannounced exit to a bookmaker — Medium

**Finding.** `app/go/[brand]/route.ts` issues an immediate `302` to the operator with a tracking
`subid`. No interstitial, no "you are leaving" affordance.

**Why users stop trusting.** The instant redirect is industry-standard and defensible. The trust
question is whether the user understood they were leaving a research product and entering a commercial
one at the moment they clicked. If the CTA does not say so, the transition from "measurement source"
to "affiliate hand-off" happens without consent — and that is precisely the moment a sceptical user
decides the research was a funnel all along.

**Rank: Medium** — pending a visual pass on CTA labelling. **Direction.** Make the outbound nature
explicit in the control itself, not in a footnote.

---

### 1.4 Hedging inside page titles — Medium

**Finding.** `/acca` ships the meta description: *"…Research slip only — we never place bets. 18+."*
The disclaimer is inside the description that appears in search results and social previews.

**Why users stop trusting.** A title is a promise, not a place for terms and conditions. Leading a
search snippet with a denial signals a product braced for accusation. It also consumes the limited
characters that should be establishing what the page is for.

**Rank: Medium.** **Direction.** Titles describe; disclosures live in the interface.

---

### 1.5 A menu that leads nowhere *(carried — Critical)*

"Published Accas" is in primary navigation and the documented default state guarantees the index is
empty. A menu item that lies once teaches the user to distrust the whole menu. See prior review §1.4.

---

## 2. Internationalization

### 2.1 Twenty-three locales are not localised — Critical

**Finding.** Six full dictionaries exist (`en, fr, es, pt, de, ar`); `es-es` aliases `es`; nine locales
have partial overlays. The remaining 23 — `it, nl, pl, cs, da, sv, no, fi, ro, el, hu, hi, bn, ta, te,
mr, ja, th, ko, vi, id, zh, sw` — fall back to English. Each generates the full page set through
`generateStaticParams`, so roughly 780 English pages are published under non-English URLs with
`hreflang` asserting they are localised.

**Why it matters.** Three compounding failures. The user experience is simply broken — a Thai visitor
gets English. The `hreflang` declaration is inaccurate, which is a duplicate-content and trust problem
with search engines. And for a product whose positioning is precision and verifiable accuracy,
claiming thirty languages while delivering six is the most on-brand possible credibility failure.

**Rank: Critical.** **Direction.** Ship the locales that are genuinely translated. A product with six
excellent languages is stronger than one with six real and twenty-four pretend.

---

### 2.2 RTL direction is applied; RTL layout is not — High

**Finding.** `app/layout.tsx:57-60` correctly sets `dir={dirForLocale(locale)}` on `<html>`, and
`globals.css` carries three `[dir="rtl"]` rules. But components use **171 physical direction utilities**
(`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`) against **one** logical utility (`ms-`/`me-`/`ps-`/`pe-`).

**Why it matters.** Arabic will render with correct text direction inside a layout that does not
mirror: padding, offsets, icon placement and alignment will all remain left-biased. This is worse than
no RTL support, because the page looks *almost* right, which reads as carelessness rather than absence.
Arabic is one of only six locales with a real dictionary — the effort was made on content and undone in
layout.

**Rank: High.** **Direction.** Logical properties throughout, then a rendered Arabic review.

---

### 2.3 Navigation and footer chrome are English *(carried — Critical)*

16 of 19 nav items and 16 of 21 footer labels are hardcoded English. Combined with §2.1, the practical
result is that even the six real locales have an English shell. Prior review §1.1.

---

## 3. Terminology and language

### 3.1 The most visible label is the least used word — High

**Finding.** Occurrence counts across the product: `Operator` 140, `Brand` 57, `Bookmaker` 5. The
footer's navigation label for `/operators` is **"Bookmakers"** — the rarest term in the codebase — while
primary navigation calls the same destination **"Operators"**.

**Why it matters.** The word the user sees most often in navigation is the one the product almost never
uses anywhere else, so nothing on the destination page confirms they arrived where they intended.
"Brand" appearing 57 times adds a third vocabulary for the same object.

**Rank: High.** **Direction.** One noun. "Bookmaker" is the user's word; "Operator" is the industry's;
"Brand" is the database's. Pick the user's and use it everywhere the user can see.

---

### 3.2 "Combo" is live vocabulary, not a legacy redirect — High

**Finding.** `/combo` was consolidated into the Acca Builder, yet "Combo" appears **112 times** across
components and pages, against "Acca" 291. `ComboSelectionCard`, `ComboOperatorCard`, `ComboSummary` and
`ComboStudio` are active components.

**Why it matters.** The prior review treated the "Combo (→ Builder)" menu entry as a stray label. It is
not — the product genuinely operates two names for one concept, in the interface, in components and in
the URL space. A user who learns "Combo" on one screen meets "Acca" on the next with no explanation that
they are the same thing.

**Rank: High.** **Direction.** Complete the consolidation in vocabulary, not only in routing.

---

### 3.3 Unnecessary words

**Finding.** Recurring patterns: menu labels carrying parenthetical explanations ("Combo (→ Builder)");
titles carrying disclaimers (§1.4); empty states explaining provider architecture to end users
(*"Live scores and prediction states appear only when provider data supports them. Nothing is
fabricated."*); and duplicate qualifiers across the six compliance blocks (§1.2).

**Why it matters.** Every unnecessary word costs comprehension of the necessary ones. The empty-state
example is instructive: the user wants to know *when to come back*, and is told about provider data
sufficiency and fabrication policy instead. It answers the product team's question, not the user's.

**Rank: Medium.** **Direction.** Empty states answer "what now?", not "why not".

---

## 4. Cards

### 4.1 Four evidence cards, no card system — High

**Finding.** `evidence/EvidenceSnapshotCard.tsx` (269 lines), `operators/OperatorEvidenceCard.tsx`
(296), `evidence-ui/SplitCard.tsx` (88) and `evidence-ui/EvidenceCard.tsx` (44) all present evidence.
Ten card components exist in total, spread across five directories with no shared primitive.

**Why it matters.** Evidence is the product's central concept and its most important visual object. Four
independent implementations means four sets of spacing, hierarchy, density and interaction decisions
that will drift apart on every subsequent change — and a user encountering evidence on a fixture, an
operator page and an archive day sees three different objects representing one idea. Consistency of the
core object is what makes a product feel authored rather than assembled.

**Rank: High.** **Direction.** One evidence card primitive with variants, not four cards that happen to
share a noun.

---

### 4.2 Card weight is unbounded — Medium

**Finding.** Card components range from 44 to 296 lines. The two heaviest are the two most frequently
rendered, in lists.

**Why it matters.** A 296-line card in a list is a density and performance decision made implicitly. It
also suggests the card is carrying page-level responsibilities.

**Rank: Medium — pending visual review.**

---

## 5. Homepage

### 5.1 Twelve sections, one heading — High

**Finding.** `RankWagersHome.tsx` contains 12 `<section>` elements, a single `<h1>`, and **zero
`<h2>`–`<h6>`**. All twelve sections carry `aria-label` or `aria-labelledby`.

**Why it matters.** Credit where due: twelve labelled landmarks is a deliberate accessibility decision
and better than most products manage. But heading navigation is the primary way screen reader users
traverse a page, and this page offers exactly one heading. Landmark navigation works; heading navigation
does not. For sighted users the same absence means twelve sections with no visual hierarchy telling them
what matters.

**Rank: High.** **Direction.** Visible, structural headings per section, with the aria labelling
retained.

---

### 5.2 The homepage is three destinations wearing one URL *(carried — Medium)*

`#verified-performance`, `#fixtures` and `#saved` are navigation destinations inside a 648-line page.
Prior review §1.7, §3.3.

---

## 6. The four flows

### 6.1 Research flow — the saved workspace breaks its promise *(carried — High)*

Save → device-local `localStorage` → no account → no sync → silent loss in private browsing → "Saved"
resolves to a homepage fragment. Prior review §3.1–3.2. Restated here because it is the flow a returning
researcher uses most.

### 6.2 Prediction flow — the good news — Low

**Finding.** `/fixtures/[matchId]` renders `MatchDetailView` **and** `EvidenceHistorySection` on the
same page. Evidence is not hidden behind a further click.

**Why it matters.** This is the product's best flow and worth protecting: the claim and its evidence
occupy one screen, which is exactly right. **No unnecessary click here.** Noted so it does not get
"improved" into a tabbed or progressive-disclosure pattern later.

### 6.3 Operator flow — five doors into one room — High

**Finding.** `/operators`, `/operators/[slug]`, `/best-betting-sites`, `/best-crypto-betting-sites`,
`/bonuses`, `/compare/[slug]` and `/reviews/[brand]` all present bookmaker information; `TelegramCta`
appears on `/bonuses`, `/compare/[slug]`, `/reviews/[brand]` and inside `AffiliateHomeContent`. Two of
those pages have no global entry point *(carried)*.

**Why it matters.** The user cannot form a model of where to go for what, and every one of those
surfaces offers a route off-site. The repeated Telegram CTA compounds it: the commercial funnel is
present on every page of the flow while the distinction between the pages is not.

**Rank: High.** **Direction.** One canonical role per page, stated in the first sentence of each.

### 6.4 Archive flow — over-assembled — Medium

**Finding.** `/archive/[date]` composes `ArchiveFilters`, `ArchivePagination`, `ArchiveTable`,
`TransparencyDashboard`, `ArchiveViewTracker` and `JsonLd`.

**Why it matters.** A dated archive page has one job: show what was predicted on that day and what
happened. Filters and pagination on a single day's records suggest volume that may not exist, and a
"TransparencyDashboard" alongside a table risks explaining the table rather than being it. This is the
product's most strategically important page type — the permanent citation surface — and it should be
the simplest.

**Rank: Medium — pending visual review.** **Direction.** Verify each component earns its place on a
typical day's data volume.

---

## 7. Evidence

### 7.1 The concept is strong; its presentation is fragmented — High

**Finding.** "Evidence" appears 216 times. It has four card implementations (§4.1), a dedicated
`evidence-ui` token and adapter layer, an `EvidenceHistorySection`, and an `EvidenceSnapshotCard` —
across three directories (`components/evidence`, `components/evidence-ui`, `components/operators`).

**Why it matters.** The single most differentiating idea in the product does not have one canonical
visual form. A user should be able to recognise a RankWagers evidence object instantly, anywhere. Right
now the concept is strong in the data model and diffuse in the interface.

**Rank: High.**

---

## 8. Empty states and loading

### 8.1 The skeleton system exists and is used on three routes of thirty-four — High

**Finding.** `components/ui/PageSkeleton.tsx` exists and is consumed by exactly three files:
`app/[locale]/loading.tsx`, `seasons/loading.tsx`, `teams/loading.tsx`.

**Why it matters.** This is a better finding than "no loading states" *(prior review §2.1)*: the
solution is already built, designed, and proven on three routes. Thirty-one routes — including fixtures,
operator detail, search and archive days, all of which await third-party data — simply do not use it.
The cost of closing this is near zero and the perceived-performance return is the largest available.

**Rank: High.**

---

### 8.2 Empty states explain the system instead of guiding the user — Medium

**Finding.** *"Market trends will appear when qualifying data is available."* *"Live scores and
prediction states appear only when provider data supports them. Nothing is fabricated."*

**Why it matters.** Both are honest and both answer an internal question. The user's question is "is
this broken, and when should I come back?" Neither says when. The second also imports the fabrication
anxiety of §1.1 into a moment where the user is already mildly disappointed.

**Rank: Medium.** **Direction.** Empty states state the condition and the next action.

---

## 9. Unnecessary components

### 9.1 Eighteen render-nothing tracker components — High

**Finding.** Twenty analytics-named components exist; eighteen are trackers or beacons that render no
UI — `HomepageViewedTracker`, `HomepageEngagementTracker`, `ArchiveViewTracker`, `MatchDetailTracker`,
`MarketPageTracker`, `OperatorPageTracker`, `OperatorOddsPanelBeacon`, `OperatorEvidenceCardAnalytics`,
`EntityViewTracker`, `EvidenceHistoryTracker`, `LiveSectionViewTracker`, `SearchFilterTracker`,
`RecommendationImpressionTracker`, `AccaIndexAnalytics`, `AccaDetailAnalytics`, `AttributionTracker`,
`Tracker`, plus per-surface variants.

**Why it matters.** Each is a separate client component that hydrates solely to fire an event. They are
a meaningful share of the 109-of-201 client-component ratio flagged previously, they add main-thread
work on exactly the low-end devices most locales use, and they represent one measurement concern
implemented eighteen times. Three near-identical homepage trackers (`HomepageViewedTracker`,
`HomepageEngagementTracker`, and the generic `Tracker`) is the clearest symptom.

**Rank: High.** **Direction.** Instrumentation is a cross-cutting concern, not a component family.

---

## 10. Consolidated: duplicated concepts

| Concept | Duplicate surfaces | Rank |
|---|---|---|
| Accumulator | `/acca`, `/accas`, `/acca/builder`, `/combo` + "Combo" ×112 vs "Acca" ×291 | **Critical** *(carried + §3.2)* |
| Bookmaker | Operator ×140 / Brand ×57 / Bookmaker ×5, across 7 page types | **High** (§3.1, §6.3) |
| Evidence card | 4 implementations, 3 directories | **High** (§4.1) |
| Methodology | `/methodology` + `/how-we-rank` (one orphaned) | **High** *(carried)* |
| "Best sites" | `/best-betting-sites` + `/best-crypto-betting-sites` sharing one shell | **Medium** *(carried)* |
| Homepage view tracking | 3 overlapping trackers | **Medium** (§9.1) |
| Anchor `#fixtures` | homepage, market detail, operator detail | **Low** *(carried)* |

## 11. Consolidated: unnecessary clicks

| Journey | Unnecessary step | Rank |
|---|---|---|
| Reach saved items from a deep page | Full navigation to homepage + scroll-jump instead of a route | **High** |
| Reach "Qualified Fixtures" from a deep page | Same pattern | **High** |
| Reach "Verified performance" | Same pattern, footer-only | **Medium** |
| Reach methodology | Two competing pages, one unreachable | **High** |
| Compare two operators | No global entry point; must route via a listing | **Medium** |
| Reach `/combo` | Extra hop to a redirect that lands on the Builder | **Medium** |

## 12. Consolidated: unnecessary words

| Location | Rank |
|---|---|
| "Nothing is fabricated" and ~28 sibling assurances | **Critical** (§1.1) |
| Six compliance blocks per commercial page | **High** (§1.2) |
| "Combo (→ Builder)" menu label | **High** *(carried)* |
| Disclaimers inside meta titles/descriptions | **Medium** (§1.4) |
| Empty states describing provider architecture | **Medium** (§8.2) |

---

## 13. Accessibility and interaction quality

| # | Finding | Rank |
|---|---|---|
| 13.1 | Homepage: 12 sections, 1 heading — landmark navigation works, heading navigation does not (§5.1) | **High** |
| 13.2 | Focus-visible styling appears in 3 places across 109 client components *(carried)* | **High** |
| 13.3 | RTL layout will not mirror despite correct `dir` (§2.2) | **High** |
| 13.4 | Interactive surfaces — builder, filters, live views — unverified for keyboard traversal, focus trapping, async announcement *(carried)* | **High — needs interactive pass** |
| 13.5 | 42 `role="alert"`/`"status"` and 11 `aria-live` regions: strong foundation, but no evidence of a single announcement policy — competing regions can talk over each other | **Medium — needs screen-reader pass** |
| 13.6 | Contrast of hardcoded pairs (`text-[#53615C]` on `bg-[#FBF9F4]`) unverified *(carried)* | **Medium** |

---

## 14. Ranked findings

### Critical — must not ship

1. **23 of 30 locales are English under foreign URLs** with `hreflang` claiming otherwise (§2.1).
2. **Defensive "nothing is fabricated" copy** on the homepage and across ~29 sites (§1.1).
3. **Navigation and footer chrome in English** for every locale *(carried)*.
4. **Four navigation entries for the accumulator concept**, including `/acca` vs `/accas`
   *(carried)*, now known to extend into 112 live uses of "Combo" (§3.2).
5. **A primary menu item leading to a guaranteed-empty page** *(carried)*.

### High

6. Six compliance blocks per commercial page (§1.2).
7. Four evidence card implementations for the product's central concept (§4.1, §7.1).
8. Homepage: twelve sections, one heading (§5.1).
9. RTL direction without RTL layout (§2.2).
10. Three nouns for bookmaker; the most visible label is the least used word (§3.1).
11. Skeleton system built, applied to 3 of 34 routes (§8.1).
12. Eighteen render-nothing tracker components (§9.1).
13. Five overlapping operator surfaces, each with an off-site CTA (§6.3).
14. Saved workspace cannot keep its promise *(carried)*.
15. Anchor-based navigation destinations *(carried)*.
16. Focus visibility and interactive-surface accessibility *(carried)*.
17. Two methodology pages, one orphaned *(carried)*.

### Medium

18. Archive day page over-assembled (§6.4).
19. Empty states explain the system rather than the next action (§8.2).
20. Unannounced exit to operators (§1.3).
21. Disclaimers inside titles and descriptions (§1.4).
22. Card weight unbounded, heaviest cards render in lists (§4.2).
23. Competing live regions without an announcement policy (§13.5).
24. Colour token drift; single site-wide share image; `/today` dead route; comparison
    discoverability *(all carried)*.

### Low

25. `#fixtures` anchor reused across three page types *(carried)*.
26. Sitewide heading distribution is flat (1 `<h4>` against 157 `<h2>`) — acceptable, monitor.
27. Prediction flow places evidence beside the claim on one screen — **correct; protect it** (§6.2).

---

## 15. What is excellent, and should not be touched

A review that only subtracts is not a review.

- **Evidence beside the claim.** `/fixtures/[matchId]` renders the match view and the evidence history
  on one screen. No progressive disclosure, no tab, no extra click. This is the product's best moment.
- **Claim integrity enforced in code.** `lib/trust/claims.ts` makes hype a test failure rather than an
  editorial preference. Almost nobody in this category does this.
- **Refusal to fabricate structured signals.** No invented ratings or review counts, documented as
  deliberate.
- **Honest empty states by design.** The Acca flag documentation explicitly chooses "the index honestly
  says nothing is published" over a hidden surface. The instinct is right; only the navigation entry
  around it is wrong.
- **Twelve labelled landmarks on the homepage**, a skip link, 42 status roles, correct decorative-image
  handling, and lint-annotated deviations. This is a team that has thought about assistive technology.
- **`dir` correctly derived per locale.** The foundation for RTL is right; only the layout utilities
  need to catch up.

The pattern across this review is consistent and worth stating plainly: **the product's substance is
ahead of its surface.** The data model, the integrity rules and the accessibility foundations are
stronger than the vocabulary, the copy, the card system and the localisation that present them. That is
a far better problem than the reverse — surfaces are cheaper to fix than foundations — but it is the
surface that a global launch audience will judge, and on the evidence above, twenty-four of the thirty
audiences cannot judge it in their own language at all.
