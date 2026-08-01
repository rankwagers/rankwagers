# RankWagers Homepage — The 15-Second Review

**Head of Product Experience · launch review · homepage only**
**Date:** 2026-08-01 · **Surface:** `/en` as served today.
**Scope:** critique of the existing experience. No redesign, no features, no architecture, no roadmap.
Type sizes, colours and element order below are the ones the page actually ships.

---

## 1. What actually happens in fifteen seconds

**0–3 s — the headline lands.**
An 11px brand-green eyebrow: `Football decision support · Sat 01 Aug`. Then the h1 at 36px, tight
leading, semibold:

> **Evidence before the bet. Settlement after the whistle.**

This is a genuinely good sentence. It is short, rhythmic, specific, and it promises something no
competitor promises. Three seconds in, the page is winning.

**3–8 s — the eye drops, and the page argues with itself.**
Below the headline sits a 16px subtitle that ends: *"…with Acca workflows coming next."* The first
paragraph of the product tells the visitor something isn't finished.

Then two buttons of identical size and weight — `Review today's top picks` and
`See verified performance` — then a search field, then a live-count line, then, in the right rail, a
line of **11px monospace**:

> `Sat 01 Aug · 132 qualified fixtures · Model v2.4.1 · Updated 07:39 UTC · NG`

A version number and a raw country code, in the hero, in code type.

**8–15 s — the fold delivers its verdict.**
Six cards. In each one, the single largest, most saturated element is a **24px monospace brand-green
number**. All six read:

> **100%**

Beneath each, in 16px: `Clarence Zebras II vs New Town Eagles`. Above it, in 11px muted grey:
`#1 · Tasmania Southern Championship`.

Fifteen seconds are gone. The visitor has read one excellent sentence and then seen six certainties
about Tasmanian district football.

---

## 2. The verdict

**The homepage has a first-class voice and a third-class first impression, and the gap between them
is created by type size alone.**

Measured, in the pick card:

| Element | Size | Colour | Weight |
|---|---|---|---|
| `100%` | **24px** | **brand green** | semibold, mono, tabular |
| Team names | 16px | foreground | semibold |
| League + rank | 11px | muted grey | medium, uppercase |
| Evidence line | 12px | muted grey | regular |
| `Observed 3 min ago` | **10px** | muted grey | mono |

The page's least defensible claim is set at 24px in the brand colour. The page's proof of honesty —
the observation timestamp, the thing that says *we recorded this before kickoff and didn't touch it* —
is set at **10px**, the smallest type on the screen.

Multiply by six and the arithmetic is decisive: **one 36px headline versus six 24px brand-coloured
numbers.** The numbers win the fold. Whatever the copy says, the page's loudest statement is
*"100%, 100%, 100%, 100%, 100%, 100%."*

Nothing else in this review matters as much as that.

---

## 3. Findings by impact

### P0 — costs the visitor

**P0-1 · Six 100% badges are the visual centre of the fold.**
24px, brand green, monospace, tabular — the treatment reserved for the most important number on a
screen, applied to a claim no informed reader will accept. The mitigation sits at 12px
(*"Confidence is a model signal, not a promise"*), four type steps below the thing it is mitigating.
Mitigations never win at four steps down.

**P0-2 · The number is printed twice per card.**
The 24px badge says `100%`. Twelve pixels below, the evidence line says *"Model probability 100% on
Over 1.5 Goals."* The same figure, restated, in the position where a second, different fact should be.
The card looks full and says one thing.

**P0-3 · The primary CTA has no privilege.**
`Review today's top picks` is a 14px brand-filled button. So is `Open match` — six times, immediately
below it. Brand green also carries the hero eyebrow, the `100%` numbers, and every inline link. One
colour is doing four jobs: *this is the action*, *this is the number*, *this is a link*, *this is the
brand*. When everything is the accent colour, nothing is.

**P0-4 · Seventeen interactive targets before the second scroll.**
Two hero buttons, a search field with its own submit, a date control, an "Open Acca Builder" text
link, and twelve card buttons (`Open match` + `Add to Acca` × 6). The page opens by asking the
visitor to make a decision seventeen ways, having given them one sentence of context.

**P0-5 · "Add to Acca" appears before "Acca" has been explained.**
The word is in the nav twice, in the hero subtitle, in the 12px line above the grid, and on six
buttons in the fold — and it is British betting slang, on a site offering 32 languages including
Hindi, Bengali, Tamil, Telugu, Swahili and Vietnamese. In the fold, a large share of the visible verbs
are a word the visitor may not know.

**P0-6 · The hero admits incompleteness in its second sentence.**
*"…with Acca workflows coming next."* A launch hero is the one place a product does not discuss what
isn't built. Two more admissions follow further down the page — *"a fuller prediction archive is
planned"* and *"while the full searchable archive ships in a later sprint"* — the second sitting
directly beneath **Prediction archive**, which is the page's proof of trustworthiness.

---

### P1 — costs confidence

**P1-1 · The hero rail leaks engineering.**
`Model v2.4.1` and `NG`, in 11px monospace, in the highest-value real estate on the site. Monospace
signals *machine output*. A version string signals *the software*, not the answer. A raw ISO country
code signals *nobody read this string out loud*. The same code reappears later as
*"Editorial options for NG."*

**P1-2 · The rank is fused to the league, in the least legible style on the card.**
`#1 · Tasmania Southern Championship` is one 11px uppercase muted-grey line with 0.12em tracking.
Uppercase + small + wide-tracked + low contrast is the hardest combination to read at a glance — and
it is carrying both the ordering signal and the credibility signal.

**P1-3 · Two competing hero CTAs, equal weight, opposite audiences.**
`Review today's top picks` serves the impulse visitor; `See verified performance` serves the skeptic.
They are the same size, same weight, same height, differing only in fill. The page declines to say
which visitor it is for, and both buttons scroll to a section on the same page rather than going
anywhere.

**P1-4 · Live Signals is a lock in the middle of a trust page.**
The section header promises *"Automated observations… Not tips, not predictions, and not advice"* —
excellent framing. The panel beneath it ships locked rows, an unlock modal, and a Telegram CTA:
*"One featured observation each hour — more via partner bookmakers or Telegram."* The one module that
withholds value until you take a commercial action sits between the picks and the performance data.
Whatever its commercial merit, on this page it reads as the research being sold.

**P1-5 · The Live Signals explainer renders twice, verbatim.**
The same two sentences appear in immediate succession. Duplication of the *identical* string is the
single most reliable amateur tell on a web page, because it can only mean nobody proofread the render.

**P1-6 · Empty states all look alike, and none of them are honest about *why*.**
Every empty region is the same grey rounded box with 14px muted prose: no picks, no market trends, no
performance data, no saved fixtures. A visitor cannot tell "nothing qualified today" from "this isn't
working" from "you haven't used this yet." Three very different messages wearing one costume — and
`Saved` occupies a full homepage section and a nav slot while showing *"No saved fixtures yet"* to
every first-time visitor, which is 100% of launch traffic.

**P1-7 · Provenance is set at 10px.**
`Observed 3 min ago` and `Last updated 2026-07-31T23:31:25.115Z` are both 10px monospace. The second
also ships a raw ISO timestamp with milliseconds. The page's most differentiating quality — that it
records things and doesn't touch them afterwards — is rendered at the size used for legal small print.

---

### P2 — costs polish

- **Type ramp is compressed at the bottom.** 16 / 14 / 12 / 11 / 10 with grey applied at four of five
  steps. Below 14px the page stops having hierarchy and starts having texture.
- **Monospace is overloaded.** It marks the hero meta, the `100%`, the trending counts, and every
  timestamp — four unrelated meanings in one typeface.
- **Section rhythm is flat.** Eleven `h2` sections at 24px, each preceded by an 11px uppercase eyebrow,
  each separated by the same hairline rule and the same vertical padding. Nothing is bigger than
  anything else, so nothing is more important than anything else. The page scrolls like a changelog.
- **Twelve section eyebrows use internal vocabulary.** "Now monitoring", "Market activity", "Research
  queue", "Workspace", "Verification", "History". These are the system's names for its own processes.
- **Icon usage is decorative.** Activity, BarChart3, Radio, ShieldCheck, Clock3 — one per section
  heading, all 16px, all the same weight. They add visual noise per section without encoding anything.
- **The date is stated three times** in the fold — hero eyebrow, hero rail, and the date control —
  in three different formats.

---

## 4. The six questions

### Why would someone stay?

**The sentence.** *"Evidence before the bet. Settlement after the whistle."* It is the best asset on
the page and it does its job in under two seconds.

**The refusal to fake numbers.** Further down: *"ROI is omitted until publication odds are durably
archived"* and *"Live scores and prediction states appear only when provider data supports them.
Nothing is fabricated."* A visitor who reads either of those knows immediately that this is not the
usual site. Both are currently set at 12–14px muted grey, below the fold.

**Losses printed as data.** `138 won · 43 lost`, with pending and void broken out. Almost nobody in
this category shows the second number at all.

**The market grid** — 132 qualified fixtures across four markets with counts, in one glance — is the
only place the page feels like an instrument rather than a feed.

### Why would someone leave?

Six 100% badges. Then, if they survive that: Tasmania, Queensland, U20 youth leagues, and Estonian
second division as the flagship content, with `Premier League · La Liga · Serie A · Bundesliga`
displayed further down as "Featured leagues" that lead to nothing for today. The fold sets an
expectation of certainty; the content sets an expectation of obscurity; the featured row sets an
expectation of the big five. Three contradictory promises in one scroll.

### What creates friction?

Seventeen targets before the second scroll. Two hero CTAs that both scroll rather than navigate. An
unexplained word (`Acca`) attached to six buttons. A search field competing with a date control
competing with two buttons in the same 200 vertical pixels. And, further down, a ~50-item competition
filter rendered as flat text ahead of `Page 1 of 22`.

### What creates trust?

Precisely four things, all currently small and all currently low on the page: published losses, the
withheld-ROI statement, the "nothing is fabricated" line, and the observation timestamps. Every one of
them is rendered at 10–14px in muted grey. **The page's trust assets and its type hierarchy are
inversely correlated.**

### What creates excitement?

Honestly — very little, and this is the quietest failure on the page. `132 qualified fixtures`,
`8 live matches`, `643 predictions tracked` are genuinely interesting quantities delivered as
inventory counts. There is no moment of "oh, that's clever." The one candidate — six picks scored,
ranked and timestamped in real time — is spent proving a number nobody believes. A page can survive
being modest. It cannot survive being modest *and* implausible.

### What feels amateur?

1. `100%`, six times.
2. The identical Live Signals paragraph printed twice.
3. `Model v2.4.1` and `NG` in the hero.
4. `2026-07-31T23:31:25.115Z` shown to a human.
5. Three separate "coming soon" admissions on a launch page.
6. An empty `Saved` panel given a homepage section on day one.
7. Locked rows and an unlock modal on the page that says it isn't selling tips.

### What feels premium?

1. The h1 — 36px, `leading-[1.08]`, tight tracking, display face. Confident and correctly set.
2. The restraint of the palette: one accent, hairline rules, no gradients, no shadows, no stock
   photography. The chassis is quiet and adult, and that is rare in this category.
3. Tabular numerals on every metric. Someone cared.
4. Consistent 44px minimum touch targets and visible focus rings throughout.
5. `Void / postponed: 6` — surfacing the unglamorous state instead of hiding it.
6. The trending-markets row: four cells, one number each, no ornament. The most premium module on the
   page, and the only one that trusts the visitor to read a number without being told how to feel
   about it.

---

## 5. The one-line summary

**The chassis is premium, the voice is premium, and the fold is not — because the largest, greenest,
most repeated element on the homepage is the one number the product cannot defend, while the four
things that make it genuinely trustworthy are set between 10px and 14px in grey.**

The homepage does not have a design problem. It has an emphasis problem — and at fifteen seconds,
emphasis is the entire product.
