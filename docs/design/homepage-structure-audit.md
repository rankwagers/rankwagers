# RankWagers Homepage — Structure Audit & Ideal Form

**Type:** structure and experience audit. **No implementation.**
**Date:** 2026-08-02 · **Basis:** the live homepage as served today (`jAlzZYEq5A6FlHufU6VEA`),
audited section by section from the rendered output, not from source intent.

**Measured now:** 12 sections · 13 headings · **141 interactive targets** · 338 KB · ~4.5 screens.

---

## 1. The finding that governs everything else

The page contains two products written in two different registers, alternating.

**The institutional one** says: *Football markets, assessed before kick-off* · *Settled 409 · Won 311
· Lost 98* · *ROI and average odds are omitted when publication odds are not durably archived* ·
*wins and losses both shown, without selective filtering.*

**The tipster one** says: **`100%`** — set larger and greener than anything near it, six times, each
one repeated a second time in the card body as *"Model probability 100% on Over 1.5 Goals"*, each
prefixed with a leaderboard `#1`, `#2`, `#3`.

A reader meets the first register in section 2 and the second in section 3. The second one wins,
because it is bigger. **Every premium reference the brief names — Bloomberg, The Athletic, Stripe,
Linear, Apple — shares one discipline: a single register, held without exception.** None of them
would print `100%` at 24px in the accent colour above a claim they cannot defend.

Nothing else in this audit costs as much.

---

## 2. Section-by-section audit

| # | Section | Verdict | Reasoning |
|---|---|---|---|
| 1 | **Hero** | **Keep · Compress** | Headline and subtitle are excellent. The 39-word commission disclosure below them is correct in placement and too heavy in weight — it is the third thing read on a premium page. Compress to one sentence, keep the link to the criteria. The dateline is **wrong today**: it reads *"Assessed 1 August 2026"* while the results beneath it are dated 2026-08-02. A dateline that contradicts the content under it is worse than none. |
| 2 | **Settled record** | **Keep · Split · Expand** | The strongest asset on the site and correctly placed. Split it: the four figures are a *statistic*, the row list is a *ledger*, and they currently run together. Give the figures room and let `Lost 98` carry the same weight as `Won 311` — that equality is the entire brand argument. |
| 3 | **Recent results** (inside 2) | **Keep · Fix selection** | Currently shows *Huntsville City vs Crown Legacy* three times and *Chicago Fire II vs FC Cincinnati II* twice — six rows, ~2 distinct matches. It reads as a bug, not a record. Deduplicate by fixture so six rows mean six matches. |
| 4 | **Highest model probabilities today** | **Keep · Re-weight card** | Right content, right position, wrong emphasis. Demote `100%`; promote the fixture. Delete the `#1 · #2 · #3` ranking ornament and the evidence line that restates the badge verbatim. See §3. |
| 5 | **Trending markets** (inside 4) | **Keep · Compress** | Four counts as a context strip is correct. It currently renders as `1st half goal / 20 / top / 95 / %` — the figure and its qualifier fragment across lines. Set as one line per market. |
| 6 | **Controls** (date · search · live count) | **Keep · Merge** | Correctly relocated out of the hero. But the live count says *"3 live matches in today's lists"* four lines below *"Live provider data is temporarily unavailable"* — two contradictory claims in one screen. The count must inherit the staleness of its source. |
| 7 | **Live matches** | **Merge · Conditional** | Renders an `h2` with **no content at all** in the current state. A heading with nothing under it is the clearest possible signal of an unfinished page. It should not occupy a top-level section; fold it into Today and render only when it has something to say. |
| 8 | **Recently qualified** | **Keep · Compress** | The real depth of the product. Correctly late. Compress the filter row — ~50 competition names as flat text is a wall, not a control. |
| 9 | **Featured leagues** (inside 8) | **Keep · Compress · Fix** | One line is right. `CAF` still renders as a dead cell with no link — a visible placeholder on a launch page. |
| 10 | **Saved** | **Remove from homepage** | Shows an empty panel to 100% of first-time visitors, and it is browser-local so it cannot persist. It is a returning-reader tool that costs a section to say "nothing here". |
| 11 | **Compare licensed bookmakers** | **Keep · Reorder later · Fix** | Correctly placed after research. `NG` still leaks into user-facing copy — *"Editorial options for NG."* |
| 12 | **Build an accumulator** | **Merge into 11** | Three names for one surface in one block: *accumulators*, *Auto Acca Builder*, *Evidence-Based Acca Builder* — plus *"Legacy /combo redirects to the same builder"*, which is routing trivia shown to readers. This is a commercial funnel and belongs with commerce, named once. |
| 13 | **How the record is produced** | **Keep · Reorder earlier** | Five numbered claims, all good — except 05, which still ends *"a fuller prediction archive is planned"*. A launch page does not advertise what is unbuilt, least of all inside its trust section. |
| 14 | **How qualification works** | **Merge into 13** | Same argument, adjacent, separately headed. |
| 15 | **Prediction archive** | **Merge into 13** | Third instance of the same argument. Method, qualification and archive are one idea told three times. |

**Net: 12 sections → 6.** Two removed, five merged, one made conditional.

---

## 3. The pick card

The single highest-leverage change on the page, stated as a hierarchy inversion.

**Now** — the largest, most saturated element is the least defensible claim:

```
#1 · QUEENSLAND NPL                              100%   ← 24px, brand, mono
Magic United vs Olympic                                 ← 16px
Over 1.5 Goals · Sun 02 Aug · 04:30                     ← 12px
Model probability 100% on Over 1.5 Goals                ← 12px  (the number, again)
Observed · Updated 44 min ago                           ← 10px  (the honesty signal)
[Open match] [Add to accumulator]
```

**Ideal** — the fixture leads, the estimate qualifies it, the provenance is legible:

```
QUEENSLAND NPL                                          ← 11px, muted
Magic United vs Olympic                                 ← 18px, the largest thing in the card
Over 1.5 Goals · 04:30                                  ← 14px
Model estimate 100%                                     ← 14px, neutral — not accent, not 24px
Observed 44 min ago                                     ← 12px  (floor raised from 10px)
[Open match] [Add to accumulator]
```

Four deletions, no additions: the `#rank` ornament, the duplicate evidence line, the accent colour on
the figure, and the 24px step. What remains is a research card rather than a tip card — the same
information, reordered so the reader interprets the number instead of being sold it.

---

## 4. Ideal structure

Six sections. The narrative is **promise → proof → today → depth → method → commerce**, and commerce
is last so the separation is a property of the layout rather than a claim about it.

| # | Section | Contains | Priority | Height |
|---|---|---|---|---|
| **1** | **Masthead** | Headline · one sentence · dateline · one-line disclosure | 1 | ~0.4 screen |
| **2** | **The Record** | Settled / Won / Lost / Hit rate · sample note · deduplicated ledger · method + archive links | **2 by position, 1 by weight** | ~0.7 |
| **3** | **Today** | Controls · market strip · ranked cards · live status (conditional) | 3 | ~0.7 |
| **4** | **Research** | Fixture explorer · featured leagues | 6 | ~0.8 |
| **5** | **Method** | How the record is produced · qualification · archive | 4 | ~0.4 |
| **6** | **Bookmakers** | Operators · accumulator entry · disclosure | 5 | ~0.4 |

**Two orderings changed from today.** Method moves **above** commerce: a publication explains itself
before it sells anything. Live matches stops being a section and becomes a line inside Today.

---

## 5. Typography, rhythm, density

**Scale — seven steps, one page.** 48 display (×1) · 36 figure (×4, reserved for the record) · 24
section · 18 card title · 16 body · 14 meta · **12 floor**. The 10px provenance line is below
comfortable reading and carries the honesty signal; raise it. Nothing between 24 and 36 — that gap is
what makes the record read as the page's centre.

**One reservation rule.** 36px belongs to the settled record and nothing else. The moment a pick
percentage borrows it, the page has two centres and therefore none.

**Colour.** One accent, used for one job. Today the brand green marks the primary CTA, the `100%`
figures, and inline links simultaneously. Reserve it for action, and let the **only** colour inside
content be outcome status — won, lost, void, pending. On a betting homepage where colour means
*outcome* and nothing else, the palette itself becomes an argument no competitor can copy.

**Rhythm.** Vertical space should encode importance, not uniformity. Today every section is separated
identically, so the page scrolls like a changelog. Three treatments: a tonal full-bleed band for The
Record alone; hairlines between Research, Method and Bookmakers; whitespace at the narrative beats
(1→2, 2→3, 5→6).

**Density.** 141 interactive targets is the fatigue number. Roughly 40 come from the ~50-item
competition filter, 12 from duplicated result rows, and a dozen more from redundant accumulator
entry points. Removing Saved, merging the accumulator block, deduplicating the ledger and compressing
the filter takes the page under 90 without deleting a single capability.

**Measure.** No text at shell width. Editorial 46rem for the masthead and Method; reading 38rem for
every section lead; data 72rem for the record, ledger and card grids.

---

## 6. What is already premium and must be protected

Not everything needs changing, and the strongest things here are easy to lose in a redesign.

1. **The headline.** *"Football markets, assessed before kick-off."* States a practice, not a
   quality. Nothing to improve.
2. **`Lost 98` printed at all.** Almost nothing in this category does.
3. **The withheld-ROI sentence.** *"ROI and average odds are omitted when publication odds are not
   durably archived."* A platform declining to publish a flattering number it cannot substantiate is
   the most credible thing on the page.
4. **The stale notice.** *"Showing the last successful update from 2 August 2026 at 11:11 UTC."*
   Naming a degraded state precisely, with a timestamp, is exactly the Bloomberg reflex.
5. **The serif on warm paper.** The design system is already editorial — a serif display face,
   `#f6f3ec` canvas, hairlines, no gradients or shadows. This is the visual grammar of a record.
   The page's problem has never been its materials.
6. **Void and pending shown as first-class states.** Most sites would hide both.

---

## 7. The one-line summary

**The homepage is one emphasis inversion away from premium.** Its materials, its voice and its
evidence are already there; what it lacks is the discipline to let the record be the loudest thing on
the page and the model estimate the quietest. Six sections instead of twelve, one reserved type step
for the record, one accent colour meaning outcome — and the page stops arguing with itself.
