# RankWagers — Homepage Narrative

**Task:** Storytelling, not marketing. Re-sequence and re-frame existing content so the page answers
four questions in order.
**Constraints:** No new features. No roadmap changes. No new data. Every block below already exists.
**Date:** 2026-08-01.

---

## The diagnosis

The homepage is a **catalogue**, not a story.

Its current order:

> Hero → Today's top picks → Trending markets → Live matches → Verified performance →
> Recent results → Featured leagues → Bookmaker discovery → Recently qualified → Saved →
> Published Accas

Ten sections, each announcing itself, none leading to the next. A reader can enter at any point and
leave with the same impression they arrived with. That is what an index does.

The structural error is one decision: **the page opens with output and buries the proof.** "Today's
top picks" is section two. The settlement record is section five. The reader is asked to accept a
probability three screens before they are given any reason to believe one.

Every affiliate site in this category opens with its output. It is the house style of the genre, and
it is why the genre reads the way it does.

**The correction requires no new content.** The four answers already exist as sections. They are
simply in the wrong sequence, under the wrong names, at the wrong sizes.

---

## The four acts

| Act | Question | Existing block that answers it | Currently |
|---|---|---|---|
| **I** | What is RankWagers? | Hero | §1 — correct position, wrong contents |
| **II** | Why is it different? | Recent results | §5 — buried |
| **III** | Why should I trust it? | Verified performance | §4 — buried |
| **IV** | Why should I return? | Qualified fixtures · Trending markets · Featured leagues · Live · Saved | §2, 2b, 3, 6, 8, 9 — scattered |
| **Coda** | *(not a question the reader asked)* | Bookmaker discovery | §7 — mid-narrative |

---

## Act I — What is RankWagers?

**Answered in one screen. Nothing else on it.**

The line already written is the right one, and it is the best sentence in the product:

> ## Evidence before the bet. Settlement after the whistle.

That is the whole proposition: we show our reasoning before the event and our result after it. It
promises nothing, claims nothing, and describes the product exactly. It needs no support.

**What the hero currently carries, and where each piece goes:**

| Element | Verdict |
|---|---|
| Eyebrow "Football decision support" | **Cut.** The h1 says it better. An eyebrow that paraphrases the headline is a headline said twice. |
| H1 | **Keep. Enlarge.** This is the masthead. |
| Subtitle | **Rewrite from its own parts.** Remove "with Acca workflows coming next" — an unshipped feature has no place in a value proposition. Keep the four verbs already in it: qualifies, shows, settles, compares. |
| CTA "Review today's top picks" | **Cut.** Act IV is where fixtures live. Do not send the reader to the output before the proof. |
| CTA "See verified performance" | **Cut as a button.** The reader is about to scroll into it. |
| Search field | **Move to Act IV.** Search is a returning-reader tool, not an introduction. |
| Live-match count | **Move to Act IV.** |
| Date control | **Move to Act IV.** It belongs beside the fixtures it filters. |
| `modelMeta` string | **Break apart.** The as-of timestamp belongs in Act III beside the record. The fixture count belongs in Act IV. The version claim goes entirely until it is real. |

**Act I is therefore:** a headline, one sentence, and white space.

The single most confident thing a homepage can do is say one thing and stop. Eight competing
elements is a page that does not know what it is. One is a page that does.

> **Editorial note.** The one permitted addition to Act I is a single line of orientation beneath
> the subtitle, written from strings that already exist — the window label and the totals from the
> trust model: *"Recording qualified goal-market predictions and their settled outcomes since
> {windowLabel}."* It is not a claim. It is a dateline, and a dateline is what tells a reader they
> have arrived at a publication.

---

## Act II — Why is it different?

**The answer is the losses.**

This is the pivot of the entire narrative, and the content for it already exists and is already
computed.

`HomepageTrustModel` carries `won` **and `lost`**. `HomepageResult` carries a per-fixture `status`
and `scoreLabel`. The "Recent results" section already renders settled outcomes with WON / LOST
badges. All of it exists. None of it is doing narrative work, because it sits in position five,
after the reader has already decided what kind of site this is.

**Move Recent results to position two, and let it show what it already contains.**

The reader arrives from the headline expecting the usual: a list of selections. Instead they meet
**settled outcomes, wins and losses side by side, in the second screen of the page.**

That is the whole differentiation argument, delivered without a single word of persuasion. Nobody in
this category shows a loss before they show a pick. The reader does not need to be told the site is
different; they can see that it is doing something no comparable site does.

**Framing, using existing strings:**

- Section title: **"What we published, and what happened."**
- The block is presented as a record, not a highlight reel: results in chronological order, losses
  rendered with exactly the same weight and prominence as wins. Same size, same treatment, no muting,
  no de-emphasis, no sorting that favours one.
- The existing `sampleNote` — *"Counts cover qualified goal-market lists… Hit rate uses settled
  won+lost. ROI and average odds are omitted when publication odds are not durably archived."* —
  moves here as the caption.

That caption is the most valuable sentence on the homepage and it currently appears nowhere the
reader will find it. **A platform declining to publish a flattering number it cannot substantiate is
the strongest differentiation claim available, and it is already written.**

**Cut from this act:** any celebratory language attached to a result. "Nice pick", "locking in the
win", "GOAL!" are the voice of the genre this act exists to separate from. A settled result is
recorded, not cheered. The badge and the score say everything.

---

## Act III — Why should I trust it?

**Act II showed one thing. Act III shows all of it.**

"Verified performance" moves from position four to position three, immediately after the results it
summarises. The sequence is deliberate: the reader has just seen individual outcomes, including
losses; now they are given the totals, and the totals are consistent with what they just saw. That
consistency *is* the trust argument.

Every field needed is already in `HomepageTrustModel`: `totalPredictions`, `settledPredictions`,
`pendingPredictions`, `voidPredictions`, `won`, `lost`, `hitRatePct`, `windowLabel`,
`lastUpdatedAt`, `sampleNote`, `methodologyHref`, `archiveEntryHref`.

**Three changes, all editorial:**

**1. Publish the loss count wherever the hit rate appears.** The current string reads
`"Settled picks: {won} WON · {pct}% hit rate"`. It shows the numerator and the ratio and omits the
other half of the denominator — which is computed, in memory, one field away. It becomes:

> **{won} won · {lost} lost · {pending} pending · {void} void — {hitRatePct}% of settled**

A reader looking for the loss count finds it immediately. Its absence is louder than its presence
would ever be.

**2. Rename "Verified performance" to "Settlement record."** Nothing external verifies this.
"Verified" is a word that invites a question the page cannot answer, and a reader who discovers the
verification is first-party discounts everything around it. "Settlement record" is accurate, and the
accurate word is still stronger than anything a competitor publishes.

**3. Promote the two links that already exist.** `methodologyHref` and `archiveEntryHref` are fields
on the model and currently read as footnotes. They are the act's closing line:

> **How these are qualified and settled** → methodology
> **Every prediction we have published** → archive

That is a publication offering its working. It is the reason a reader stops evaluating and starts
reading.

**Also belongs here:** the as-of timestamp extracted from `modelMeta`. A record with a stated
last-updated is a record. One without is a claim.

---

## Act IV — Why should I return?

Only now does the page show today's work. The reader has the proposition, the differentiation, and
the evidence. They are equipped to read a probability correctly — which is the entire reason the
first three acts exist.

**Everything already on the page, re-ordered into one act:**

| Block | Role in the act |
|---|---|
| **Recently qualified fixtures** + date control + search | Today's work. The recurring reason to come back. |
| **Trending markets** | What is moving now |
| **Featured leagues** | Where to go deeper |
| **Live matches** | What is happening as you read |
| **Saved** | Why *you specifically* return |

**Framing changes, all naming:**

- **"Today's top picks" → "Today's highest model probabilities."** "Picks" names a selection the
  product supplies; a probability is a measurement the reader interprets. The existing line
  *"Confidence is a model signal, not a promise"* is retained as the caption — it is already
  perfect.
- **"Live signals" → "Live matches."** The existing framing string is already written and correct:
  *"Automated observations of market and match activity. Not tips, not predictions, and not advice —
  decide for yourself."* Use it as the section caption. Remove the hourly-scarcity structure from
  the narrative — an editorial page does not ration.
- **Each fixture card keeps its `evidenceLine` and its "Observed" timestamp**, both promoted to
  readable size. The provenance line is what makes this a research card rather than a tip card, and
  it is currently the smallest thing on it.
- **Saved closes the act**, because a returning reader's own list is the most honest answer to "why
  return" the page can give.

**The act's opening line, from existing data:** *"{count} fixtures qualified for {date}."* A count
and a date. No adjective.

---

## Coda — the commercial block

**Bookmaker discovery moves to the end, after the narrative has closed.**

It currently sits at position seven, mid-story, between "featured leagues" and "recently qualified" —
interrupting the research sequence with a commercial one. That placement is what makes a reader
re-interpret everything above it as lead-in.

Placed last, after the story is told, it reads as what it is: a service the publication offers, not
the reason the publication exists.

Two framing requirements, both using strings that already exist:

- The existing `OPERATOR_COMPARISON_BASIS` — *"Independent comparison. Ordering reflects our
  published criteria, not commercial arrangements."* — appears **with** the block, at readable size,
  not in the footer.
- A visible boundary above it. Not a headline claiming separation — a **section break the eye reads
  as a change of register.** The reader should be able to see where the publication ends and the
  service begins, without being told.

Published Accas, currently appended after everything, stays where it is — behind the boundary, with
the commercial material.

---

## The finished sequence

```
I.    Evidence before the bet. Settlement after the whistle.
      One sentence. A dateline. Nothing else.

II.   What we published, and what happened.
      Settled results — wins and losses, equal weight.
      Caption: what these counts cover, and what we deliberately do not publish.

III.  Settlement record.
      {won} won · {lost} lost · {pending} pending · {void} void — {pct}% of settled
      Updated {timestamp}.
      → How these are qualified and settled.  → Every prediction we have published.

────────────────────────────────────────────

IV.   Today.
      {count} fixtures qualified for {date}.
      Highest model probabilities · Trending markets · Featured leagues · Live matches · Saved
      "Confidence is a model signal, not a promise."

════════════════════════════════════════════

      Bookmakers.
      "Independent comparison. Ordering reflects our published criteria,
       not commercial arrangements."
```

---

## What the re-sequencing costs

Nothing is built. Nothing is removed from the product. Every section still exists, every link still
resolves, every feature still ships.

**Moved:** Recent results 5→2. Verified performance 4→3. Bookmaker discovery 7→last. Search, date
control, and live count out of the hero and into Act IV.

**Renamed:** "Verified performance" → "Settlement record". "Today's top picks" → "Today's highest
model probabilities". "Live signals" → "Live matches".

**Cut from the homepage:** the hero eyebrow, both hero CTAs, the roadmap clause in the subtitle, the
version claim, and the celebration lines on settled results.

**Promoted from footnote to content:** the loss count, `sampleNote`, `methodologyHref`,
`archiveEntryHref`, the as-of timestamp, `evidenceLine`, the observed-at stamps, and
`OPERATOR_COMPARISON_BASIS`.

Ten of those twelve promotions are strings the product already writes and then hides.

---

## The editorial rules this page now follows

1. **A homepage is a lede, not an index.** It makes one argument. The argument here is: *we publish
   our reasoning, then we publish what happened, and you can check both.*
2. **Proof precedes product.** No probability is shown before the record that makes a probability
   meaningful.
3. **One idea per screen.** If a reader must choose between eight things, the page has not decided
   what it is.
4. **The strongest sentence goes first and is not explained.** "Evidence before the bet. Settlement
   after the whistle." needs no support, and support would weaken it.
5. **Losses carry the same weight as wins.** Not as a disclosure — as a design decision, visible in
   size, colour, and order. This is the differentiation, and hedging it forfeits the differentiation.
6. **Never state a quality you can demonstrate.** The page does not say "independent", "verified", or
   "transparent". It shows a loss, a method, and an archive, and lets the reader reach those words
   themselves. A reader trusts a conclusion they drew far more than one they were handed.
7. **Commerce comes after the story, behind a visible boundary.** Not hidden — *placed*.
8. **Numbers are shown with their limits.** Every count carries its scope; the sample note is
   content, not fine print.

---

## Why this ordering answers the four questions

**What is RankWagers?** A single sentence that describes the product completely, with nothing
competing against it.

**Why is it different?** Because the second thing the reader sees is a loss — published as
prominently as a win. No comparable site does this, and no explanation is required.

**Why should I trust it?** Because the totals reconcile with the individual results just shown, the
limits of the sample are stated by the platform itself, and the method and the full archive are
offered before being asked for.

**Why should I return?** Because by the time today's work appears, the reader knows how to read it —
and because the record they were just shown will be longer tomorrow.

---

**The one-line summary:** *lead with the sentence, follow with a loss, prove it with the record,
and only then show today's work — the story was always in the content, in the wrong order.*
