# RankWagers — Final Information Architecture

> **Type:** Information architecture. **Reorganization only — no feature additions, no new pages, no
> new components, no visual or engineering direction.** Every destination below already exists.
> **Date:** 2026-08-01. **Method:** full audit of 34 public page types, 3 navigation groups (19
> items), 17 footer links, and every CTA surface.

---

## Diagnosis

The site has **34 public destinations serving roughly 12 distinct intents.** The duplication is not
random — it follows two forces:

- **SEO-driven splitting:** one intent broken into several URLs to own more keywords
  (`/best-betting-sites` + `/best-crypto-betting-sites` + `/bonuses` + `/operators` + `/reviews/…`).
- **Feature-driven accretion:** one concept given a destination per development stage
  (`/acca` + `/acca/builder` + `/accas` + `/accas/[slug]` + `/combo`).

Two symptoms make this visible without any analysis:

1. **A navigation item whose label is an apology.** The Research menu contains
   `{ href: "/combo", label: "Combo (→ Builder)" }` — a redirect stub, kept in the menu, with the
   redirect explained in the label. `/combo` is `redirect()` to `/acca/builder`. `/today` is
   `redirect()` to `/`. **Two of nineteen nav destinations are pure redirects.**
2. **The navigation points at the homepage three times.** "Today" (`/`), "Qualified Fixtures"
   (`/#fixtures`) and "Saved" (`/#saved`) are three menu entries for one page. Anchors are not
   destinations.

And the homepage is a table of contents rendered as content: **14 distinct sections** — hero, top
picks, qualified fixtures, recently qualified, live matches, live signals, trending markets, featured
leagues, saved, recent results, prediction archive, verified performance, methodology, why-trust,
research notes — plus an operator strip, an acca entry, a published-acca block and a search entry.
Four of them are `EmptySection` components, meaning the page is authored to render empty regions as a
normal state.

**The product does not feel inevitable because nothing has one home.** A user looking for an operator
can arrive at four different pages; a user looking for an accumulator, five. When everything is
reachable from everywhere, nothing is authoritative.

---

## The organizing principle

The current grouping — **Research / Bookmakers / Browse** — is organized around *the business*: what
we make, what we monetize, what we index. That is why it feels SEO-driven, because it is.

The inevitable structure is organized around **the research act**, which has exactly four stages:

| | Stage | Question it answers |
|---|---|---|
| **1** | **Today** | What is happening, and what qualified? |
| **2** | **Research** | What do I need to understand about it? |
| **3** | **Record** | What did you say before, and were you right? |
| **4** | **Bookmakers** | Where do I act, and why do you recommend them? |

Four sections. Every existing destination lands in exactly one, merges into one, or leaves. Nothing
appears twice. "Browse" disappears as a label because browsing is not an intent — it is what you do
inside Research.

---

## THE FINAL INFORMATION ARCHITECTURE

```
TODAY  ─────────────────────────────  /
  the homepage IS today; it is not a directory
  · today's qualified fixtures  (was /#fixtures)
  · live matches                (was live-signals)
  · today's record line         (one honest summary, links to Record)
  · saved panel                 (a panel, never a nav item)
  → every fixture links to /fixtures/[matchId]

RESEARCH  ──────────────────────────  the entity layer
  /fixtures/[matchId] ............... the match page — the atomic unit
  /competitions ..................... hub
    /competitions/[slug]
      /competitions/[slug]/seasons/[season]   ← seasons live HERE, not as a peer hub
  /teams ............................ hub
    /teams/[slug]
  /markets .......................... hub
    /markets/[slug]
  /search ........................... utility, always reachable, never a menu item

RECORD  ────────────────────────────  the evidence layer
  /archive .......................... every prediction, won and lost
    /archive/[date]
  /methodology ...................... how predictions are made and settled
  /accas ............................ published accumulators = dated research output
    /accas/[slug]
  /acca ............................. the studio
    /acca/builder ................... the tool
  verified performance .............. a section of /archive, not a homepage anchor

BOOKMAKERS  ────────────────────────  the commercial layer, quarantined
  /operators ........................ the single ranked list
    /operators/[slug] ............... one page per operator (absorbs the review)
  /how-we-rank ...................... linked from every ranked list and every operator page
  /compare/[slug] ................... reachable from operator pages only

FOOTER  ────────────────────────────  obligations, not navigation
  /methodology · /archive · /how-we-rank
  /responsible-gambling · /availability · /terms · /privacy
```

**Navigation becomes four items plus search.** Today · Research · Record · Bookmakers. Today it is
nineteen items across three groups, ten of which are marked `desktopPrimary` — a "compact" desktop row
of ten. Four is inevitable; ten is a list.

---

## Answers to the six questions

### What belongs on the homepage?

**Only today.** Four sections, in this order:

1. **Today's qualified fixtures** — the product's reason to exist, above everything.
2. **Live matches** — genuinely time-sensitive, genuinely only useful now.
3. **One record line** — the honest summary sentence (settled / won / lost) linking into Record.
   This is the trust signal in its smallest possible form.
4. **Saved** — a panel for returning users, below the fold.

**Removed from the homepage** (each already has a permanent home, so this is deletion of duplication,
not of content): top picks, recently qualified, trending markets, featured leagues, recent results,
prediction archive block, methodology block, why-trust block, research notes, the published-accas
block, and the operator strip.

The reasoning is a rule, not taste: **if a homepage section's purpose is to link to a hub, it is
navigation wearing the costume of content.** Nine of the fourteen sections are exactly that. And a
homepage that ships four `EmptySection` components is a homepage that does not know what it is for.

The operator strip leaves for a different reason: the homepage is where the product states what it is.
If the first commercial surface appears before the user has seen a single piece of evidence, the
product is affiliate-driven regardless of what the methodology page says.

### What belongs only in navigation?

**Only destinations you return to.** Four section entries and search.

Three current nav items are homepage anchors (`/`, `/#fixtures`, `/#saved`) and must leave — an anchor
is a position, not a place. Two are redirect stubs (`/today`, `/combo`) and must leave. "Saved" leaves
because it is a panel. "Methodology" and "Archive" leave the top level because they are *inside*
Record. "Seasons" leaves because a season is a property of a competition, not a sibling of one.
"Countries" is already absent from nav and should stay absent.

The Bookmakers group collapses from four entries to one. Four commercial menu items against four
research items tells the user, structurally, that half of this product is a shop.

### What belongs only in the footer?

**Obligations and conditions — the things a serious company must publish and nobody browses to.**

`/terms` · `/privacy` · `/responsible-gambling` · `/availability`, plus `/methodology`, `/archive` and
`/how-we-rank` as permanent-reference duplicates of their in-product homes.

The footer is currently doing navigation's job: 17 links including Acca Studio, Acca Builder, Teams,
Markets, Competitions, Countries, Search and Bonuses — at the same typographic weight as Privacy. A
footer that repeats the menu is a symptom of a menu that isn't trusted.

`/countries` retires from the footer as a browse destination; country availability is what
`/availability` is for, and the operator-per-country question belongs on the operator page.

### What belongs inside Research?

**The entity layer, and nothing else.** Fixtures, competitions (with seasons nested beneath them),
teams, markets, and search.

`/seasons` folds into `/competitions/[slug]/seasons/[season]`, which already exists — this is a
promotion of the correct route and a retirement of the redundant hub, not a new page.

`/compare/[slug]` is currently unreachable from anywhere. It is a *commercial* comparison (operator vs
operator), so it belongs to Bookmakers, reachable from operator pages — not to Research, and not to
the top level.

### What belongs inside the Record?

**Everything we said, and everything that says how we say it.** Archive index, dated archives,
verified performance (as a section of `/archive`, where the numbers already are — not a homepage
anchor), methodology, published accas and their detail pages, the studio, and the builder.

Published accumulators belong here rather than in Research because a published acca is a *dated
output with an outcome* — the same class of object as an archived prediction. The nav comment
currently defends putting them in Research "because a published Acca is research output, not a
promotion." That instinct is right about what they are *not*; the Record is where things with
outcomes live.

### What should disappear completely?

**Eight destinations, from 34 to 26.**

| Destination | Why | Disposition |
|---|---|---|
| `/today` | pure `redirect()` to `/` | delete route; nav already points at `/` |
| `/combo` | pure `redirect()` to `/acca/builder`; nav label admits it | delete route and nav item |
| `/best-crypto-betting-sites` | a payment-method facet of one list, split for keywords | fold into `/operators` as a filter |
| `/bonuses` | an attribute of an operator, promoted to a destination | fold into `/operators/[slug]` |
| `/best-betting-sites` | a second name for `/operators` | fold into `/operators`, the honest name |
| `/reviews/[brand]` | **a second page about the same entity as `/operators/[slug]`** | merge into `/operators/[slug]` |
| `/seasons` | a property of a competition, not a peer hub | fold into `/competitions/[slug]/seasons/[season]` |
| `/countries` + `/countries/[code]` | exists to host operator-by-country; already carries a `doorway_risk` guard in its own code | retire; availability answers the user question |

Also disappearing, though not destinations:

- **`StickyCta`** — used on exactly one page type: `/reviews/[brand]`, which is itself being merged.
  A persistent affiliate rail is the clearest possible statement that the page exists to convert.
- **`AgeVerificationGate`** — built, mounted **nowhere** (0 usages). Either it is a legal obligation,
  in which case its absence is the finding, or it is dead weight. It cannot be both.
- **`TelegramCta` on `/compare/[slug]` and `/bonuses`** — a channel CTA on a comparison surface is an
  interruption of the comparison. It survives on the homepage-adjacent affiliate content and nowhere
  a user is mid-decision.
- **The nine duplicate homepage sections** listed above.

---

## CTA architecture

Today, commercial CTAs appear on: `/reviews/[brand]` (sticky + claim steps + Telegram), `/bonuses`,
`/compare/[slug]`, the homepage operator strip, and every brand-list section. Five surfaces, no rule.

The rule that makes the product feel inevitable rather than monetized:

> **One commercial action per page, and only after the evidence that justifies it.**

| Layer | Permitted commercial CTA |
|---|---|
| Today | **none** |
| Research (fixture, team, competition, market) | **none** above the evidence; at most one operator handoff *below* it |
| Record (archive, methodology, accas) | **none** — this is the trust layer; a CTA here spends the trust it is built on |
| Bookmakers (`/operators`, `/operators/[slug]`, `/compare`) | one primary action per operator |

`/go/[brand]` remains the single exit point. That part is already right.

**The corollary that costs the most and matters most:** the Record carries no commercial CTA at all.
An archive page that sells is an archive nobody believes.

---

## The three structural corrections

Everything above reduces to three moves.

1. **The homepage stops being a directory and becomes today.** 14 sections → 4. Nine of the removed
   sections are links to hubs; the hubs are what the menu is for.
2. **One entity, one page.** `/operators/[slug]` and `/reviews/[brand]` are two pages about one
   company. `/best-betting-sites`, `/best-crypto-betting-sites` and `/bonuses` are three pages about
   one list. Merging them is the difference between a publisher and a keyword farm.
3. **Navigation shrinks to the four stages of the research act.** 19 items → 4 + search. Redirect
   stubs and page anchors leave the menu entirely.

**Result: 34 destinations → 26. 19 nav items → 4. 17 footer links → 7. 14 homepage sections → 4.**

Nothing was invented. Every surviving page, hub, and route already exists — this is entirely
subtraction and re-parenting.

---

## Why this feels inevitable

A user arriving with any football question lands in one place, and there is only one place it could
have been:

- *"What's on today?"* → Today. It is the homepage; there is no second candidate.
- *"Is this team any good?"* → Research → Teams. One hub, one page per team.
- *"Have you ever been right?"* → Record. Every claim, won and lost, in one place, with the method
  beside it.
- *"Where do I bet?"* → Bookmakers. One ranked list, one page per operator, with the ranking
  methodology attached to the ranking rather than orphaned.

The commercial layer is not hidden — hiding it would be its own dishonesty, and the site earns its
revenue there. It is **quarantined**: it occupies one of four sections instead of half the menu, it
appears after the evidence rather than before it, and it never appears inside the Record.

That is the whole difference between a research platform with a business model and a business with a
research section.

---

_Information architecture only. No features added, no pages created, no visual or engineering
direction. Related: `[[search-quality-review]]`, `[[design-review]]`,
`[[football-research-platform-architecture]]`._
