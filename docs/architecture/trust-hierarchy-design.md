# Trust Hierarchy Design — Surfacing What Already Exists

**Task:** design trust. Not security, not compliance.
**Constraint:** add nothing. Every asset named below already exists and already renders somewhere.
**Success test:** *the visitor believes RankWagers before reading any marketing copy.*
**Deliverable:** a ranking of every existing trust asset, then a redesigned hierarchy. Order only.

---

## I. The design principle

Two rules decide every placement in this document.

### Rule 1 — A signal is believable in proportion to what it cost to send

This is the whole of trust design, and it explains every ranking below.

| Signal | Cost to RankWagers | Believability |
|---|---|---|
| Four icons labelled Review / Payouts / Licensed / Bonuses | **Zero** | Zero |
| "Independent comparison" | Zero | Zero |
| "Hand-picked, independently reviewed" | Zero | Zero |
| **"Won 143 / Lost 91"** | **High** — publishing losses | **High** |
| **"Average odds: Unavailable"** | **High** — an empty cell where a number could sit | **High** |
| **"Listed in our editorial order, not ranked by score"** | **High** — costs clicks | **High** |
| **"We do not audit an operator's solvency, licensing status or payout behaviour"** | **High** — surrenders authority | **High** |
| **"We earn commission from some operators"** | **High** — surrenders the pretence of neutrality | **High** |

Anything free to say is worthless as evidence, because anyone could say it. Anything expensive to say
is evidence, because a dishonest operator wouldn't.

**Therefore: order every surface by descending cost-to-us, not descending appeal-to-us.**

Applied consistently, this rule produces the correct hierarchy on every page without a single new
feature — because RankWagers has already written all the expensive sentences. They are simply placed
below the cheap ones.

### Rule 2 — Belief must be pre-verbal

"Before reading any marketing copy" is a literal constraint, not a figure of speech. A visitor reads a
number in roughly a third of a second and a sentence in three. If trust depends on a sentence, the
visitor has already read copy.

So the first trust encounter must be **numbers, structure, and position** — not prose:

- A won/lost split is pre-verbal.
- A sample size is pre-verbal.
- An empty cell marked *Unavailable* is pre-verbal.
- Anything with a verb in it is copy.

### Two corollaries

**Never collapse a cost.** Putting an expensive admission inside a `<details>` element refunds the
cost. The visitor never pays attention to it, so it buys no belief. The commission disclosure is
currently the fourth item inside a collapsed block — an expensive sentence bought back at full price.

**Disclosure precedes the thing it qualifies.** `OrderingDisclosure` already does this — placed above
the list, with the reasoning written down: *"A reader who scans the first two operators and clicks has
already left."* That instinct is correct and generalises to every surface in this document.

---

## II. Asset register

Every existing trust asset, ranked.

- **Invisible** — exists in the product; a normal visitor will never encounter it
- **Weak** — reachable, but subordinated, collapsed, or below higher-priority noise
- **Good** — visible and clear where it appears
- **Excellent** — encountered before it is sought, and unmissable

### Invisible

| Asset | Where it lives | Why invisible |
|---|---|---|
| **Evidence archive** (immutable snapshots, settlement, revisions) | Fragment at the bottom of the fixture page | **No URL.** Cannot be linked, cited, bookmarked, or returned to. The single most valuable asset on the site is the least reachable. |
| **Commission disclosure** — *"We earn commission from some operators"* | 4th item, inside a collapsed `<details>`, inside `OrderingDisclosure` | Three levels down. Two interactions from view. |
| **`/how-we-rank`** | Footer, plus a link inside the same collapsed block | Reachable in practice only by someone already suspicious enough to dig |
| **Correction / revision history** | Validation records | Never surfaced to a reader |
| **`integrityVerified`** | API responses | Machine-only |
| **Evidence `Dataset` JSON-LD** | Fixture page markup | Machine-only |
| **Position ≠ rank** (`listPosition`) | Internal discipline | Correct internally, never expressed to the reader |
| **Self-degrading ordering basis** (`deriveOrderingBasis`) | Internal | The *result* is shown; the fact that it polices itself is not |

### Weak

| Asset | Where | Why weak |
|---|---|---|
| **Homepage verified performance** — total, settled, won/lost, **hit rate**, pending, void | Homepage, **section 4** | Fully computed, correctly rendered, and placed below the hero, the picks, the markets, and the live feed. The single largest misplacement on the site. |
| **`/archive` transparency dashboard** | `/archive`, footer-linked only | Best page on the domain, absent from primary navigation |
| **`/methodology`** | Footer only | Not linked from most claims it substantiates |
| **`RANKING_CRITERIA`** (5 dimensions) | Inside collapsed `<details>` | Cost refunded by collapse |
| **`RANKING_LIMITATIONS`** ("What we don't") | Inside collapsed `<details>` | The most expensive sentences on the site, hidden |
| **Confidence number on prediction cards** | Top picks | A number with no accuracy context is a claim, not evidence |
| **`/responsible-gambling`** | Footer | Far from the point of risk |

### Good

| Asset | Where | Why it works |
|---|---|---|
| **`ODDS_ARE_POINT_IN_TIME`** — *"Odds were recorded when this page was generated…"* | Odds surfaces | Arrives with the thing it qualifies |
| **`LIVE_SIGNALS_FRAMING`** — *"Not tips, not predictions, and not advice"* | Live signals | Expensive, and placed where it bites |
| **`OrderingDisclosure` placement** | Above operator lists | Correct by design and for the right stated reason |
| **`"Average odds: Unavailable"`** | Archive dashboard | Refusing to fill a cell is a costly, pre-verbal signal |
| **Honest empty states** — *"No qualified fixtures for this market in the current research set"* | Market / team pages | Declines to fabricate |
| **`evidenceLine` on top picks** | Homepage picks | Ties a pick to its basis at the point of the claim |
| **`sampleNote` / `windowLabel`** | Trust model | States the sample rather than implying it |

### Excellent

| Asset | Where | Why |
|---|---|---|
| **The editorial-ordering sentence** — *"Listed in our editorial order, not ranked by score. Placement does not indicate that one operator is better than another — compare the details and decide for yourself."* | Comparison surfaces, when the basis is editorial | The best trust artifact on the site. Costly, pre-emptive, unprompted, and it actively discourages the click that pays. Nothing else here comes close. |

### Anti-asset — negative trust

| Asset | Where | Why it subtracts |
|---|---|---|
| **`TrustBar`** — ◆ ⚡ ◇ ★ / Review · Payouts · Licensed · Bonuses | `AffiliateHomeContent` (the `/best-*` landing pages) | Four glyphs with no data, no link, no basis. **"Bonuses" as a trust signal is a category error** — an inducement is not evidence of trustworthiness. **"Payouts" implies verification that `RANKING_LIMITATIONS` explicitly disclaims.** It occupies the highest-value position on the page and pays nothing into belief. |

**The register's shape is the finding.** Exactly one asset is Excellent. Every other high-cost signal
is Weak or Invisible. Meanwhile the only zero-cost asset sits at the top of a landing page.

The site is not short of trust. It is spending it in the wrong order.

---

## III. Surface-by-surface

### 1. Homepage — **the decisive surface**

**Current order:** Hero (marketing copy) → Top picks → Trending markets → Live matches → **Verified
performance** → Published Accas.

The verified-performance section is literally commented `{/* 4. Verified performance */}`.

`buildHomepageTrustModel` already assembles everything needed: `totalPredictions`, `settledPredictions`,
`won`, `lost`, `hitRatePct`, `pendingPredictions`, `voidPredictions`, `sampleNote`, `windowLabel`, and —
critically — **`methodologyHref` and `archiveEntryHref`**. The module's own docstring reads: *"Never
invents ROI, average odds, or tipster bankroll metrics."*

The complete trust package, with its own links to its own basis, is built and placed fourth.

**A visitor currently reads three screens of marketing before meeting a single verified number.** That
fails the brief exactly.

**Redesigned order:**

```
1. VERIFIED PERFORMANCE      won / lost / hit rate / sample / window
                             + methodologyHref + archiveEntryHref
                             ── numbers, pre-verbal, includes losses ──
2. TOP PICKS                 each carrying evidenceLine, then confidence
3. HERO / positioning copy   ← the marketing arrives here, having been earned
4. TRENDING MARKETS
5. LIVE MATCHES
6. PUBLISHED ACCAS
```

One section moves. Nothing is built. The first thing on the page becomes a number that includes the
losses, and the marketing copy is read by someone who already has a reason to believe it.

Within the performance block, **Lost must carry the same visual weight as Won.** Any asymmetry
converts a costly signal back into a cheap one.

### 2. Prediction cards

Currently a card leads with the pick and a confidence number; `evidenceLine` is present but
subordinate, and the operator CTA is the dominant action.

A confidence number shown before any accuracy context is a claim. The same number shown after
"predictions at this confidence have settled N% over M samples" is evidence. The site holds the second
form on `/archive` and does not connect it.

**Redesigned order within the card:**

```
1. Market / selection        what is claimed
2. evidenceLine              why — already on the card, currently below
3. Confidence                the number, now qualified by what precedes it
4. Settled outcome / archive link   what happened, or where it will appear
5. Operator action           last
```

The rule applied: the basis precedes the claim, and the monetised action never outranks the evidence.

### 3. Archive — **the best page, hidden**

The transparency dashboard already publishes total, settled, won/lost, hit rate, pending, void, and
`Average odds: Unavailable`, links methodology from within the content, and gates its own indexation
on having enough data to say something.

Its only weakness is reach: footer-linked, absent from navigation, and disconnected from the fixture
pages where predictions are read.

**Redesign:** promote into primary navigation (§8). Dashboard first on the page, before filters and
table. Loss count equal in weight to win count. Nothing else changes — the page is already right.

### 4. Methodology

Substantive and honest; footer-linked only.

The wiring to fix this already exists: `HomepageVerifiedPerformance` carries `methodologyHref`,
`TransparencyDashboard` links `methodologyPath`, `OrderingDisclosure` links `/how-we-rank`.

**Redesign:** every published number links to the methodology that produced it, using links the
components already hold. A number without a path to its basis is an assertion; a number with one is a
finding. This changes no page — only which existing links are rendered.

### 5. Operator pages

`OrderingDisclosure` is placed correctly, above the list. Everything expensive inside it is collapsed.

**Redesign — promote one line out of the accordion:**

```
ALWAYS VISIBLE   Ordering basis sentence          (already visible)
                 + "We earn commission from
                    some operators."              ← promoted from inside <details>
STILL COLLAPSED  Full criteria, full limitations, methodology link
```

One sentence changes level. It is the site's most expensive admission and currently its most hidden.
Visible, it reframes everything below it as honest; collapsed, it reads as concealment when found.

Where the basis is `editorial`, the editorial sentence — the site's one Excellent asset — should be
given genuine visual prominence rather than the same muted treatment as the scored variant. It is the
most persuasive thing RankWagers says.

### 6. Comparison pages

Same structure as operator pages, plus the `TrustBar` problem.

**Redesign:** `TrustBar` yields its position. It is the only asset here that costs nothing, and it
occupies the position that should carry the most expensive signal available.

That position should hold what the site already publishes elsewhere: the ordering basis, the
commission line, and the limitations. Replacing four decorative glyphs with four honest sentences is
the single highest-yield swap in this document, and every one of those sentences is already written.

### 7. Research pages — `/methodology`, `/how-we-rank`

These are the research pages, and both are **Weak**: footer-linked, and `/how-we-rank` reachable
mainly from inside a collapsed block.

They are the destination for every "why should I believe this?" impulse the rest of the redesign
creates. If the homepage leads with a hit rate, some readers will ask how it was computed. That path
must be one click from the number, not one click from the footer.

**Redesign:** linked from every claim they substantiate. The links exist; they are simply not
rendered at the point of claim.

### 8. Navigation — **the structural inversion**

Primary nav is built from three labels: `bestBetting`, `bestCrypto`, `bonuses`. All commercial. Zero
informational destinations.

A visitor who reads a prediction and wants to know whether this site is any good at predictions has no
navigational path to the answer — while the answer exists in full on `/archive`.

**Redesigned order:**

```
1. Results / Archive     ← /archive, already exists, currently footer-only
2. Methodology           ← already exists, currently footer-only
3. Best Betting
4. Best Crypto
5. Bonuses
```

Two existing pages change level. Navigation is the most-repeated statement of what a site is *for*;
currently it says RankWagers is for finding bonuses.

### 9. Footer

Sixteen links in a flat list, with `/methodology` and `/archive` sitting among `/terms`, `/privacy`,
`/availability`, and `/search` (which is `noindex` — a link that receives equity and returns none).

**Redesign — group and order, no new links:**

```
EVIDENCE       Archive · Methodology · How we rank
SAFETY         Responsible gambling
BROWSE         Competitions · Markets · Teams · Countries · Operators
COMMERCIAL     Best betting · Bonuses · Acca
LEGAL          Terms · Privacy
```

An ungrouped list of sixteen links says everything is equally important. Grouping is a statement of
priority, and it costs nothing.

---

## IV. What moves down

Trust is a zero-sum competition for position. Nothing rises unless something falls.

| Element | From | To | Why |
|---|---|---|---|
| **`TrustBar`** | Top of `/best-*` landing pages | Removed from the position | Zero-cost signal in the highest-value slot |
| **Hero marketing copy** | Homepage section 1 | Homepage section 3 | Copy read after evidence is persuasion; copy read before evidence is noise |
| **Operator CTA** | Dominant action on prediction cards | Last element | The monetised action must not outrank the evidence |
| **Confidence number** | Leading the card | After `evidenceLine` | Unqualified confidence is a claim |
| **`/search`** | Footer link | Not link-equity-bearing | `noindex` destination |

---

## V. The test

A single question decides whether the hierarchy is right:

> **Cover every sentence on the page. Is there still a reason to believe?**

- **Today:** no. Remove the sentences and the homepage leaves four icons and a fixture list.
- **After:** yes. A won/lost split, a sample size, and a date window survive with no prose at all.

That is what "believe before reading marketing copy" means operationally, and it is achievable here
purely by reordering — because the numbers are already computed, the expensive sentences are already
written, and the links to their basis are already carried in the same objects that render them.

**The summary of this entire design:** RankWagers has one Excellent trust asset, seven Good ones,
seven Weak ones, eight Invisible ones, and one that actively subtracts — and it currently leads with
the one that subtracts.

Nothing needs to be built. The order needs to be inverted: **most expensive first.**
