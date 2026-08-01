# RankWagers Homepage — Launch Wireframe

**Lead Product Designer · worldwide launch · homepage only**
**Date:** 2026-08-01 · **Surface:** `/en`

**Mandate.** A visitor arrives from Google. Within 15 seconds they understand *what RankWagers is*,
*why it is different*, *why they should trust it*, and *why they should return*.

**Permitted operations only:** reorder · merge · remove · resize · visual hierarchy · type hierarchy ·
spacing · emphasis. **No new feature, no new page, no new component, no business-logic change.** Every
element below already ships in `RankWagersHome.tsx` and its children.

---

## 1. The organising idea

The headline already promises a loop:

> **Evidence before the bet. Settlement after the whistle.**

The page owns all three pieces of that loop — the pick, the whistle, the verdict — and currently
files them in sections 2, 5 and 6, four scrolls apart. **This wireframe puts the loop in narrative
order and gives its second half the largest type on the page.**

The resulting story a visitor reads in one scroll:

| Frame | Question answered | Section |
|---|---|---|
| 1 | What is this? | Hero |
| 2 | Why is it different? Why trust it? | The Proof Band |
| 3 | Why return? | Today's Picks |

Three frames. Four answers. Fifteen seconds.

---

## 2. Structural ledger — 14 sections become 7

Auditable against the permitted operations.

| # | Current section | Operation | New home |
|---|---|---|---|
| 1 | Hero | **Resize** (grow h1, strip rail) | S1 |
| 4 | Verified performance | **Reorder up + grow** | S2 |
| 5 | Recent results | **Merge into S2** | S2 |
| 2 | Today's top picks | **Reorder down + re-weight** | S3 |
| 3 | Trending markets | **Merge into S3** (as market row) | S3 |
| 6 | Featured leagues | **Merge into S5** + remove dead cells | S5 |
| 7 | Live matches / Live Signals | **Reorder down** | S4 |
| 10 | Recently qualified | **Reorder + demote** | S5 |
| 11 | Saved | **Merge into S5** (anchor preserved) | S5 |
| 8 | Acca entry (thin) | **Remove** — Acca is pitched 4× on this page | — |
| 9 | Operator strip | **Reorder down** | S6 |
| 12 | Why RankWagers (01–05) | **Merge into S7** | S7 |
| 13 | Prediction archive | **Merge into S7** | S7 |
| 14 | How qualification works | **Merge into S7** | S7 |

**Anchor contract — all preserved.** Site navigation links to `/en#fixtures`, `/en#live-signals`,
`/en#saved`; the hero CTAs target `#top-picks` and `#verified-performance`. Every one of those ids
survives this reorder. `#saved` survives by merging the panel into S5 rather than deleting it.

---

## 3. Global systems

### 3.1 Type scale

One scale, seven steps, applied consistently. **10px is eliminated from the page.**

| Role | Token | px (mob → desk) | Instances |
|---|---|---|---|
| Hero headline | `font-display text-4xl md:text-5xl` | 36 → 48 | 1 |
| Proof numerals | `font-mono text-4xl tabular-nums` | 36 | 4 |
| Section heading | `font-display text-xl md:text-2xl` | 20 → 24 | 7 |
| Card / row title | `text-lg font-semibold` | 18 | picks, results |
| Body & descriptions | `text-base` | 16 | ≤1 per section |
| Meta | `text-sm` | 14 | market · kickoff · competition |
| Provenance floor | `text-xs` | 12 | `Observed`, `Last updated` |
| Eyebrow | `text-[11px]` uppercase | 11 | **3 only** (S2, S3, S7) |

**Two changes carry most of the outcome:**

1. **The pick `%` drops from `text-2xl` (24px, brand) to `text-sm` (14px, muted), moved beside the
   market label.** It stops being the loudest thing on the page.
2. **Provenance rises from 10px to 12px.** `Observed 3 min ago` and `Last updated …` become legible.
   These are the honesty signals; they may be quiet, they may not be invisible.

### 3.2 Colour discipline

Brand green currently marks four unrelated things. It is reduced to **one**:

| Use | Before | After |
|---|---|---|
| Primary CTA fill | ✓ | ✓ **only use** |
| The `%` numerals | ✓ | ✗ → muted foreground |
| Section eyebrows | ✓ | ✗ → muted |
| Inline links | ✓ | ✗ → foreground + underline |

**Consequence, and the point:** the only chromatic signals left inside content are `StatusBadge`
tones — **won · lost · void · pending**. On a betting homepage, the only colour is outcome. That is
the memory hook, and it costs nothing to build.

### 3.3 Spacing rhythm

Fourteen identical `py-9` sections separated by fourteen identical hairlines is not a rhythm. Three
separation treatments, deliberately uneven:

| Treatment | Where | Effect |
|---|---|---|
| Tonal panel (`bg-[var(--canvas-secondary)]`, full-bleed) | **S2 only** | The one section that looks different is the one that matters most |
| Hairline `border-t` | S4 → S5 → S6 | Quiet continuation |
| Whitespace only, no rule | S1 → S2, S2 → S3, S6 → S7 | Breathing at the narrative beats |

Vertical padding varies with importance: `pb-14 · py-14 · py-12 · py-10 · py-10 · py-10 · py-12`.

### 3.4 Empty states

`EmptySection` remains the single primitive. Change: **a section whose content is empty collapses to
its heading plus one `EmptySection` line and drops its padding to `py-6`.** It never occupies a full
section of vertical space to say nothing. Order never changes — no conditional reordering.

---

## 4. The wireframe

### S1 · HERO — *what this is*

```
┌──────────────────────────────────────────────────────────────────────┐
│  [site header — unchanged, not part of this spec]                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   FOOTBALL DECISION SUPPORT · SAT 01 AUG          ← 11px uppercase   │
│                                                                      │
│   Evidence before the bet.                        ← 48px display     │
│   Settlement after the whistle.                     tight leading    │
│                                                                      │
│   Qualified goal-market predictions, published before             │
│   kickoff and settled transparently after it.     ← 16px, 2 lines max│
│                                                                      │
│   ┌────────────────────────┐  ┌──────────────────────┐              │
│   │ See verified performance│  │ Review today's picks │  ← 14px      │
│   │      [BRAND FILL]      │  │      [outline]       │              │
│   └────────────────────────┘  └──────────────────────┘              │
│                                                                      │
│   ┌──────────────────────────────────────────────┐                  │
│   │ 🔍 Search fixtures, teams, competitions…     │  ← existing      │
│   └──────────────────────────────────────────────┘     search entry │
│                                                                      │
│   132 qualified fixtures today · 8 live           ← 14px            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Purpose:** state the proposition in one sentence and hand the visitor exactly two doors.
- **Why it exists:** it is the only element on the page that already works. It is the strongest asset
  RankWagers owns and it is currently under-sized at 36px.
- **Visual priority:** **1 of 7.** Largest type on the page.
- **Screen height:** desktop ~420px (0.47 screens) · mobile ~440px (0.52 screens).
- **Relationship to previous:** first frame — sets the promise the next section immediately pays off.

**Operations applied:**
- h1 **grows** `text-3xl md:text-4xl` → `text-4xl md:text-5xl`.
- **CTA order swaps.** `See verified performance` takes the brand fill; `Review today's picks` becomes
  the outline. The differentiator gets the primary slot, and the primary CTA now points at the section
  directly beneath it — a 1:1 scroll, not a jump across the page.
- Hero **rail removed**: `HomepageDateControl` and the `Model v2.4.1 · Updated 07:39 UTC · NG`
  monospace line **move to S3**, where a date control belongs (next to the fixtures it filters).
  `132 qualified fixtures` is **kept and promoted** from 11px mono to a 14px line — it is a real
  number and belongs in the hero; the version string and country code do not.
- Subtitle **capped at two lines**; the trailing `…with Acca workflows coming next.` clause is
  **removed** (existing string, deleted — no new copy written).
- Live count merges into the same 14px line.

---

### S2 · THE PROOF BAND — *why it's different · why to trust it*

**The single most important change in this wireframe.** Sections 4 and 5 merge, move above the picks,
and receive the largest numerals on the page.

```
╔══════════════════════════════════════════════════════════════════════╗
║  ░░░ TONAL PANEL — full-bleed canvas-secondary ░░░                  ║
║                                                                      ║
║   VERIFICATION                                    ← 11px uppercase   ║
║   What we said, and what happened                 ← 24px heading     ║
║   Losses are included. ROI is omitted until publication odds         ║
║   are durably archived.                           ← 16px  ★PROMOTED  ║
║                                                                      ║
║   Qualified list markets · 2026-07-30 → today     ← 14px window      ║
║                                                                      ║
║   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              ║
║   │ SETTLED  │ │   WON    │ │   LOST   │ │ HIT RATE │ ← 11px label  ║
║   │          │ │          │ │          │ │          │              ║
║   │   181    │ │   138    │ │    43    │ │  76.2%   │ ← 36px mono   ║
║   │          │ │          │ │  ▲ same  │ │          │   tabular     ║
║   │ 456 pend │ │          │ │   size   │ │ void: 6  │ ← 12px detail ║
║   └──────────┘ └──────────┘ └──────────┘ └──────────┘              ║
║                                                                      ║
║   ── settled outcomes, most recent first ────────────────────────    ║
║   ┌──────────────────────────────────────────────────────────────┐  ║
║   │ Los Angeles II vs Colorado Rapids II          3–0   [ WON  ] │  ║ ← 18px title
║   │ MLS Next Pro · 1st Half Over 0.5 · 01 Aug            ▲colour │  ║   14px meta
║   ├──────────────────────────────────────────────────────────────┤  ║
║   │ Sporting KC II vs Houston Dynamo FC II        3–2   [ WON  ] │  ║
║   │ MLS Next Pro · 2nd Half Over 0.5 · 01 Aug                    │  ║
║   ├──────────────────────────────────────────────────────────────┤  ║
║   │ …6 rows total                                                │  ║
║   └──────────────────────────────────────────────────────────────┘  ║
║                                                                      ║
║   Full prediction archive →      Settlement methodology →           ║
║                                                   ← 14px, underlined ║
║   Last updated 31 Jul 2026, 23:31 UTC             ← 12px  ★PROMOTED  ║
╚══════════════════════════════════════════════════════════════════════╝
```

- **Purpose:** answer *why different* and *why trust* in a single frame, with evidence rather than
  assertion.
- **Why it exists:** it is the only content on this homepage that no competitor can copy. A published
  loss counter set at the same size as the win counter is the entire brand argument, rendered as a
  fact instead of a claim.
- **Visual priority:** **2 of 7 by position, 1 of 7 by weight.** It is the only section on a tonal
  panel and the only section with 36px numerals.
- **Screen height:** desktop ~520px (0.58 screens) · mobile ~900px (1.07 screens).
- **Relationship to previous:** direct payoff. The hero says *"settlement after the whistle"*; this
  section is the whistle. No hairline between them — whitespace only, so they read as one thought.

**Operations applied:**
- **Merge:** `#verified-performance` + `#recent-results` become one section. Both anchor ids are
  retained on the merged container so existing links resolve.
- **Resize:** `MetricCard` numerals `text-2xl` → `text-4xl`. **`LOST` is not diminished** — same
  size, same weight, same treatment as `WON`. This is the memorability decision.
- **Re-slot:** the four metrics change from Total/Settled/Pending/Hit-rate to **Settled/Won/Lost/Hit
  rate**, with `pending` and `void` demoted to the 12px detail lines the `MetricCard` component
  already supports. Same data, same component, different emphasis.
- **Promote:** the sample note — *"ROI is omitted until publication odds are durably archived"* —
  rises from 12px muted to the **16px section description slot**. It is the most credible sentence on
  the site and it currently hides in a footnote.
- **Promote:** `Last updated` from 10px → 12px, and the raw ISO timestamp renders through the
  existing date formatter rather than as `2026-07-31T23:31:25.115Z`.
- **Resize:** result rows — team names `text-sm` → `text-lg`; score stays mono tabular;
  `StatusBadge` unchanged and now the only colour in the frame.
- **Row count reduced 12 → 6.** Six is enough to read the pattern; twelve is a table.

> **Acceptance condition (data, not design).** This section's power depends on settled rows being
> present. If the list renders only `PENDING`, the frame proves nothing and the wireframe's central
> claim collapses. This is a known defect logged in the launch reviews, not a change made here.

---

### S3 · TODAY'S PICKS — *why to return*

```
┌──────────────────────────────────────────────────────────────────────┐
│   TODAY                                          ← 11px uppercase    │
│   Today's qualified markets                      ← 24px heading      │
│   Highest model probabilities among today's qualified markets.       │
│   Confidence is a model signal, not a promise.   ← 16px              │
│                                                                      │
│   [ Sat 01 Aug ▾ ]   1H 0.5 · 49    O1.5 · 74    O2.5 · 85    2H · 55│
│    ↑ date control     ↑ trending markets, merged as a 14px filter row│
│                                                                      │
│   ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐│
│   │ TASMANIA STHN CHMP │ │ SA STATE LEAGUE 1  │ │ TASMANIA NPL     ││ 11px
│   │                    │ │                    │ │                  ││
│   │ Clarence Zebras II │ │ Fulham United      │ │ Glenorchy Knights││ 18px
│   │ vs New Town Eagles │ │ vs Eastern United  │ │ vs Devonport City││
│   │                    │ │                    │ │                  ││
│   │ Over 1.5 · 04:30   │ │ Over 1.5 · 05:30   │ │ Over 1.5 · 06:45 ││ 14px
│   │ Model 100%         │ │ Model 100%         │ │ Model 100%       ││ 14px
│   │                    │ │                    │ │                  ││ muted
│   │ Observed 3 min ago │ │ Observed 3 min ago │ │ Observed 3 min   ││ 12px
│   │                    │ │                    │ │                  ││
│   │ [Open match] [+Acca]│ │[Open match] [+Acca]│ │[Open match][+Acca]││
│   └────────────────────┘ └────────────────────┘ └──────────────────┘│
│   ┌────────────────────┐ ┌────────────────────┐ ┌──────────────────┐│
│   │  …3 more           │ │                    │ │                  ││
│   └────────────────────┘ └────────────────────┘ └──────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

- **Purpose:** the daily reason to come back. This is the recurring product.
- **Why it exists:** it is what the visitor searched for. It stays — it simply stops being the first
  and loudest thing, because on its own it is indistinguishable from every tipster site.
- **Visual priority:** **3 of 7.**
- **Screen height:** desktop ~620px (0.69 screens) · mobile ~1,540px (6 stacked cards).
- **Relationship to previous:** inversion. S2 is the past and is proven; S3 is the present and is
  provisional. Placing it *after* the proof means every percentage the visitor reads is now read
  through the loss counter they just saw. The same number means something different in this order.

**Operations applied — the card is re-cast:**

| Element | Before | After |
|---|---|---|
| `%` badge | `text-2xl` mono **brand green**, top-right | `text-sm` muted, inline under the market |
| Team names | `text-base` | **`text-lg`** — now the largest element in the card |
| League | 11px uppercase muted (fused with `#rank`) | 11px uppercase, `#rank` **removed** |
| Evidence line | 12px *"Model probability 100% on Over 1.5 Goals"* | **Removed** — it restates the badge verbatim |
| `Observed` | **10px** mono | **12px** |
| CTAs | brand fill + secondary | unchanged |

- **Merge:** `Trending markets` becomes the 14px counts row directly under the heading — same links,
  same data, one-tenth the vertical space, and it now functions as context for the grid beneath it
  instead of a separate destination.
- **Move in:** `HomepageDateControl` arrives from the hero. A date control belongs beside the
  fixtures it filters.
- **Remove:** the 12px *"Prefer an automatic multi-leg Acca? Open Acca Builder"* line. Acca is pitched
  four times on this page; this is the weakest of the four and it sits between a heading and its
  content.

---

### S4 · LIVE SIGNALS — *the live layer, correctly positioned*

```
┌──────────────────────────────────────────────────────────────────────┐
│  ─────────────────────────────────────────────── hairline            │
│                                                                      │
│   Live matches                                   ← 24px, NO eyebrow  │
│   Live scores and prediction states appear only when provider        │
│   data supports them. Nothing is fabricated.     ← 16px  ★PROMOTED   │
│                                                                      │
│   ┌────────────────────────────────────────┐                        │
│   │  [ LiveFeedPanel — unchanged ]         │  max-w-2xl             │
│   └────────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

- **Purpose:** show the product is live, and state the platform's refusal to fabricate.
- **Why it exists:** *"Nothing is fabricated"* is a top-five trust sentence and currently renders as a
  14px section description nobody reaches. It is promoted to 16px and becomes the section's lead line.
- **Visual priority:** **5 of 7.**
- **Screen height:** desktop ~360px (0.40 screens) · mobile ~520px.
- **Relationship to previous:** temporal step. S2 past → S3 today → S4 right now. The page's spine is
  a timeline, and this is its end point.

**Operations applied:**
- **Reorder:** moved out from between the picks and the proof. The section containing locked rows and
  an unlock modal must not sit inside the trust sequence — that adjacency is what makes a lock read as
  a paywall on evidence.
- **Remove:** the duplicated explainer paragraph. It currently renders **twice, verbatim**.
- **Resize:** eyebrow dropped; heading carries the section alone.

---

### S5 · RESEARCH — *depth, for the visitor who is still here*

```
┌──────────────────────────────────────────────────────────────────────┐
│  ─────────────────────────────────────────────── hairline            │
│                                                                      │
│   Browse all research                            ← 20px, demoted     │
│                                                                      │
│   Premier League · La Liga · Serie A · Bundesliga · Ligue 1 ·        │
│   Champions League · NPFL          All competitions →   ← 14px row   │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  [ BibleFixtureExplorer — unchanged internals ]              │  │
│   │  filters · fixture rows · pagination                          │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   Saved                                          ← 16px sub-heading  │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  [ SavedFixturesPanel ]  — collapses to one line when empty  │  │
│   └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

- **Purpose:** the working surface for a visitor who has decided to stay.
- **Why it exists:** it is the site's actual depth — 132 fixtures across four markets. It belongs
  after the argument has been made, not inside it.
- **Visual priority:** **6 of 7.**
- **Screen height:** desktop ~760px (0.84 screens) · mobile ~1,400px.
- **Relationship to previous:** hand-off from *narrative* to *tool*. Everything above is a story;
  everything here is an instrument, and it is signalled by a smaller heading and no eyebrow.

**Operations applied:**
- **Merge ×3:** `Featured leagues` (as a single 14px text row), `Recently qualified`
  (`BibleFixtureExplorer`, internals untouched), and `Saved` (`SavedFixturesPanel` as a sub-block).
  `#fixtures` and `#saved` anchors both retained.
- **Remove:** the `CAF` cell in featured leagues — it renders as a **dashed-border `span` with no
  `href`**, a visible dead placeholder. Entries without a link are dropped from the row.
- **Resize:** featured leagues from an 8-cell grid at `min-h-12` to one inline text row — roughly 200px
  of vertical space recovered.
- **Resize:** `Saved` from a full section with its own eyebrow, heading and 16px explanatory paragraph
  to a 16px sub-heading. On first visit — 100% of launch traffic — it is one collapsed line, not a
  screen of emptiness.

---

### S6 · BOOKMAKERS — *the business model, disclosed and separated*

```
┌──────────────────────────────────────────────────────────────────────┐
│  ─────────────────────────────────────────────── hairline            │
│                                                                      │
│   Compare licensed bookmakers                    ← 20px, demoted     │
│   Research above is separate from commercial offers. We may earn     │
│   a commission when you sign up through links on this site.  ← 14px  │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │  [ BibleOperatorStrip — unchanged ]                           │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   Full operator rankings →                                          │
└──────────────────────────────────────────────────────────────────────┘
```

- **Purpose:** monetise honestly, after value has been delivered.
- **Why it exists:** it is the business model, and disclosing it prominently is the correct choice.
  Its position is the only thing that changes.
- **Visual priority:** **7 of 7.**
- **Screen height:** desktop ~300px (0.33 screens) · mobile ~640px.
- **Relationship to previous:** deliberate separation. It sits *after* every research surface, so the
  claim *"research above is separate from commercial offers"* becomes literally true of the layout and
  not merely of the copy. Today three `Continue` buttons sit inside the evidence sequence, and the
  layout contradicts the sentence.

**Operations applied:**
- **Reorder:** moved from position 9 (between Featured leagues and the fixture explorer) to position 6.
- **Resize:** heading demoted to 20px, eyebrow dropped, so it does not compete with S2 and S3.
- **Emphasis:** the affiliate disclosure moves up to sit *with* the section rather than only in the
  footer.

---

### S7 · HOW THIS WORKS — *the close*

```
┌──────────────────────────────────────────────────────────────────────┐
│                                            (whitespace, no rule)     │
│   METHODOLOGY                                    ← 11px uppercase    │
│   How this works                                 ← 24px heading      │
│                                                                      │
│   01 Predictions are observed before or as lists are published —     │
│      not rewritten after kickoff.                                    │
│   02 Evidence and model signals sit next to every qualified market.  │
│   03 Live scores appear only when the provider supplies them.        │
│   04 Settlement is server-authoritative: void, pending, won, lost.   │
│   05 Historical archives support verification.    ← 5 rows, 16px     │
│                                                                      │
│   [ BibleHomeNotes — qualification explainer ]                       │
│                                                                      │
│   ┌──────────────────────┐  ┌───────────────────────┐               │
│   │ Read methodology     │  │ Prediction archive    │               │
│   │    [BRAND FILL]      │  │      [outline]        │               │
│   └──────────────────────┘  └───────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

- **Purpose:** convert the visitor who wants to verify before they trust.
- **Why it exists:** three separate sections currently make this identical argument in three places
  (`Why RankWagers`, `Prediction archive`, `How qualification works`). Merged, it becomes one strong
  close instead of three weak echoes.
- **Visual priority:** **4 of 7** — deliberately above S5 and S6 in weight despite being last. It is
  the last thing read and should feel substantial.
- **Screen height:** desktop ~400px (0.44 screens) · mobile ~700px.
- **Relationship to previous:** return to the argument. The page opens with a promise, proves it,
  demonstrates it, and closes by explaining the method — a complete rhetorical arc.

**Operations applied:**
- **Merge ×3:** `#why-trust` + `#prediction-archive` + `#methodology`. All three anchors retained.
- **Resize:** the five `Why RankWagers` cards become five text rows — the bordered card chrome and the
  decorative `01`–`05` mono numerals in brand green add ~180px and no meaning.
- **Remove:** *"…while the full searchable archive ships in a later sprint"* and *"a fuller prediction
  archive is planned"* — existing strings deleted. A launch page does not discuss what is unbuilt,
  least of all directly beneath its verification promise.

---

## 5. The 15-second timeline

| Seconds | On screen | What the visitor concludes |
|---|---|---|
| 0–2 | Hero headline at 48px | *"Football predictions — but the second sentence is about settlement, not winning."* |
| 2–4 | Hero subtitle + two CTAs | *"Published before kickoff, settled after. There are two doors and one of them is proof."* |
| 4–5 | Tonal panel enters view | *"This section looks different from everything else. It matters."* |
| 5–9 | **`WON 138` · `LOST 43` at equal size** | *"They print their losses at the same size as their wins. I have never seen that."* |
| 9–11 | *"ROI is omitted until publication odds are durably archived"* at 16px | *"They are refusing to publish a number that would flatter them."* |
| 11–13 | Settled rows with coloured verdicts and real scores | *"These are real matches with real outcomes. This is checkable."* |
| 13–15 | Scroll reaches today's picks | *"And here's today. I'll come back tomorrow to see if they were right."* |

**Bookmark.**

The four mandated questions are answered at seconds 2, 9, 5–13 and 15 respectively — and the *why
different* answer lands at second 9, well inside the budget.

---

## 6. Page metrics, before and after

| Metric | Before | After |
|---|---|---|
| Sections | 14 | **7** |
| Interactive targets before 2nd scroll | 17 | **4** (2 CTAs, search, search submit) |
| Total desktop page height | ~6,200px (≈6.9 screens) | **~3,380px (≈3.8 screens)** |
| Largest element on page | `100%` × 6, 24px brand | **`WON 138` / `LOST 43`, 36px** |
| Trust asset max type size | 14px | **36px** |
| Smallest type on page | 10px | **12px** |
| Uses of brand colour | CTA fills, numerals, eyebrows, links | **CTA fills only** |
| Colour inside content | brand green throughout | **outcome status only** |
| Section eyebrows | 12 | **3** |
| "Coming soon" admissions | 3 | **0** |
| Duplicated paragraphs | 1 | **0** |
| Dead/placeholder cells | 1 (`CAF`) | **0** |
| Acca pitches | 4 | **2** (card button, Studio entry via S3) |

---

## 7. Constraint compliance

| Constraint | Status |
|---|---|
| No new feature | ✅ Every element ships today |
| No new page | ✅ No route added; all links target existing routes |
| No new component | ✅ Only `SectionHeading`, `MetricCard`, `StatusBadge`, `EmptySection`, `LiveFeedPanel`, `BibleFixtureExplorer`, `BibleOperatorStrip`, `BibleHomeNotes`, `SavedFixturesPanel`, `HomepageSearchEntry`, `HomepageDateControl`, `AddToAccaButton`, `SectionTrackLink` |
| No business-logic change | ✅ Same data, same queries, same sort, same settlement. Only presentation |
| Anchors preserved | ✅ `#today · #top-picks · #live-signals · #verified-performance · #recent-results · #featured-leagues · #fixtures · #saved · #why-trust · #prediction-archive · #methodology` |
| Analytics preserved | ✅ Every `data-analytics-section` and `SectionTrackLink` retained on its merged container |
| Operations used | reorder · merge · remove · resize · visual hierarchy · type hierarchy · spacing · emphasis — nothing else |

---

## 8. The one sentence this wireframe exists to produce

> **"They showed me what they got wrong before they showed me what to bet."**

Nothing new was built to earn that sentence. The loss counter already exists. It was a caption; now it
is the largest number on the page.
