# Trust Hierarchy — Reconstruction

**Role:** Trust Experience Director.
**Constraint:** nothing new may be invented. Every element below already exists and already renders.
**Deliverable:** rank every trust element by criticality, then reconstruct the order. Order only.
**Success test:** the visitor trusts the product *before* reading marketing copy.

---

## I. The trust sequence

Trust is not a quantity. It is a **sequence**. A skeptical visitor asks questions in a fixed order,
and each answer is worthless until the previous one has been given.

| # | The question | Answered by | Without the previous answer |
|---|---|---|---|
| 1 | *What do you get out of this?* | Commission disclosure | Every later answer is suspect |
| 2 | *How many of these have you made?* | Sample size, window | A rate has no denominator |
| 3 | *How many were wrong?* | Won / Lost split | The rate is a marketing number |
| 4 | *So how good are you?* | Hit rate | Meaningless without 2 and 3 |
| 5 | *How do you decide?* | Methodology, criteria, limitations | An unexplained rate is a coincidence |
| 6 | *Show me one.* | Per-prediction evidence record | The method is unproven |
| 7 | *What should I do?* | Recommendation, operator, CTA | Unearned |

**RankWagers currently answers question 7 first and question 1 last.**

The homepage opens with a recommendation. Commission is disclosed three levels down inside a
collapsed block. The reading order is the exact reverse of the belief order.

That single inversion is the entire problem, and correcting it is the entire redesign. No element is
missing. Every answer exists. They are delivered in reverse.

---

## II. The ranking axis

**Criticality is measured by collapse:** if this element were removed, how much of the remaining
trust structure stops functioning?

| Rank | Meaning |
|---|---|
| **Critical** | Load-bearing. Remove it and everything above it in the sequence becomes unusable. |
| **High** | Converts a claim into a finding. The structure survives without it, but weakened to assertion. |
| **Medium** | Substantiates. Supports a claim already made credible by the tiers above. |
| **Low** | Real but marginal yield. Contributes at the edges. |
| **Invisible** | **Not a criticality level — a state.** The element exists and cannot be encountered. |

The distinction matters, because the central finding of this reconstruction is that **several
Critical-tier elements are currently Invisible.** Criticality and position are independent, and the
gap between them is the work.

---

## III. The register

### Critical

| Element | Where it lives now | Position |
|---|---|---|
| **Won / Lost split** | Homepage §4; `/archive` dashboard | **Low** — fourth section, below three screens of copy |
| **Sample size + window** — `totalPredictions`, `settledPredictions`, `windowLabel`, `sampleNote` | Homepage §4; `/archive` | **Low** |
| **Settled vs Pending vs Void separation** | Homepage §4; `/archive` | **Low** — and this is where cherry-picking would hide, so its visibility is load-bearing |
| **Commission disclosure** — *"We earn commission from some operators"* | 4th item inside a collapsed `<details>` inside `OrderingDisclosure` | **Invisible** — two interactions from view |
| **Provenance on the evidence card** — content hash, short hash, `modelVersion` | Fixture page, bottom fragment | **Invisible** — no URL |
| **Immutability statement** — *"Entries are never edited; corrections are appended as new revisions and both versions stay visible"* | Evidence section intro | **Invisible** |
| **Integrity-failure warning** — *"One or more archived snapshots failed their content-hash check… should be treated as unverified"* | Evidence section, conditional | **Invisible** |

Four of seven Critical elements are Invisible. The three that are visible sit in the fourth section of
the homepage.

### High

| Element | Where now | Position |
|---|---|---|
| **Hit rate** (`hitRatePct`) | Homepage §4; `/archive` | Low |
| **"Average odds: Unavailable"** | `/archive` dashboard | Medium — good where reached |
| **Editorial-ordering sentence** — *"Listed in our editorial order, not ranked by score… decide for yourself"* | Comparison surfaces, when basis is editorial | Medium |
| **"What we don't assess"** (`RANKING_LIMITATIONS`) | Inside collapsed `<details>` | **Invisible** |
| **`evidenceLine` on prediction cards** | Homepage top picks | Medium |
| **Per-snapshot evidence detail** — sequence, band, change-from-previous, signals, best price captured, operator coverage | Fixture page fragment | **Invisible** |
| **Revision / correction history** | Evidence records | **Invisible** |

### Medium

| Element | Where now | Position |
|---|---|---|
| `/methodology` | Footer only | Low |
| `/how-we-rank` | Footer + inside collapsed block | **Invisible** in practice |
| `RANKING_CRITERIA` (5 dimensions) | Inside collapsed `<details>` | Invisible |
| `ODDS_ARE_POINT_IN_TIME` | Odds surfaces | **Good** |
| `LIVE_SIGNALS_FRAMING` — *"Not tips, not predictions, and not advice"* | Live signals | **Good** |
| Honest empty states — *"No qualified fixtures for this market…"* | Market / team pages | **Good** |
| `/archive/[date]` | Footer path | Low |
| `integrityVerified` flag | API + evidence view | Partially surfaced |

### Low

| Element | Where now | Position |
|---|---|---|
| `/responsible-gambling` | Footer | Low — and far from the point of risk |
| Position ≠ rank (`listPosition`) | Internal discipline | Invisible, correctly |
| Evidence `Dataset` JSON-LD | Fixture markup | Machine-only |
| `deriveOrderingBasis` self-policing | Internal | Invisible — the result shows, the mechanism does not |
| `/availability` | Footer | Low |

### Negative — subtracts trust

| Element | Where now | Effect |
|---|---|---|
| **`TrustBar`** — ◆ ⚡ ◇ ★ / Review · Payouts · Licensed · Bonuses | Top of `/best-*` landing pages | Occupies the highest-value position and pays nothing in. "Bonuses" as a *trust* signal is a category error; "Payouts" implies verification that `RANKING_LIMITATIONS` explicitly disclaims. |

### The register's shape

```
CRITICAL   7 elements  →  4 Invisible, 3 buried at homepage §4
HIGH       7 elements  →  3 Invisible, 4 mid-page
MEDIUM     8 elements  →  3 Good, 5 low or invisible
LOW        5 elements  →  appropriately placed
NEGATIVE   1 element   →  highest position on the page
```

**Criticality and position are almost perfectly inversely correlated.** The most important elements
are the least reachable, and the only element that subtracts trust holds the best seat.

---

## IV. The reconstructed hierarchy

One ordered stack, applied wherever these elements appear. The order follows §I — the sequence in
which a skeptical visitor's questions actually arrive.

```
━━━ TIER 1 — THE FRAME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Read before anything else, because it determines how everything else is read.

 1. Commission disclosure
       "We earn commission from some operators."
       Promoted out of <details> to always-visible.

━━━ TIER 2 — THE DENOMINATOR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Pre-verbal. Numbers, no verbs. This is what "before marketing copy" means.

 2. Sample size + window          totalPredictions · windowLabel
 3. Won / Lost                    equal visual weight — asymmetry refunds the cost
 4. Settled / Pending / Void      the anti-cherry-picking split
 5. Hit rate                      meaningful only now, after 2–4
 6. "Average odds: Unavailable"   the refusal to fabricate

━━━ TIER 3 — THE LIMITS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    What we do not claim. Arrives before the claims, never after.

 7. "What we don't assess"        RANKING_LIMITATIONS, uncollapsed
 8. Editorial-ordering sentence   given real prominence where the basis is editorial
 9. Odds are point-in-time
10. "Not tips, not predictions, and not advice"

━━━ TIER 4 — THE METHOD ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Reachable in one step from any number it produced.

11. Methodology                   linked from every published figure
12. How we rank                   linked from every ordering claim
13. Ranking criteria

━━━ TIER 5 — THE PROOF ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    A single worked example, inspectable.

14. Per-prediction evidence record
15. Provenance — content hash, model version
16. Immutability statement + revision history
17. Integrity status, including failure

━━━ TIER 6 — THE CLAIM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Everything above has now earned the right to say something.

18. Predictions, evidenceLine first, confidence second
19. Positioning / hero copy
20. Operator recommendations
21. Commercial action
```

**Marketing copy enters at position 19 of 21.** That is the requirement, expressed structurally
rather than as an instruction.

### Applied to the homepage

The homepage already computes the whole of Tiers 1–2. `buildHomepageTrustModel` returns
`totalPredictions`, `settledPredictions`, `pendingPredictions`, `voidPredictions`, `won`, `lost`,
`hitRatePct`, `sampleNote`, `windowLabel` — and carries `methodologyHref` and `archiveEntryHref`, so
Tier 4 is one existing link away.

It renders as the fourth section, below hero, picks, markets and live feed. The code comment reads
`{/* 4. Verified performance */}`.

```
NOW                              RECONSTRUCTED
1. Hero (copy)                   1. Verified performance   ← Tiers 1–2
2. Top picks                     2. Top picks              ← evidenceLine before confidence
3. Trending markets              3. Hero (copy)            ← now earned
4. Verified performance          4. Trending markets
5. Published accas               5. Live matches
                                 6. Published accas
```

One section moves. Nothing is built.

### Applied to comparison and operator surfaces

`OrderingDisclosure` is already correctly placed above the list — the reasoning is written into the
component: *"A reader who scans the first two operators and clicks has already left."*

The reconstruction applies that same reasoning one level deeper: **the commission line and the
limitations move out of the collapsed block into the always-visible paragraph.** They are Tier 1 and
Tier 3 content currently sitting behind a disclosure toggle, which refunds their entire cost.

`TrustBar` yields its position to them.

### Applied to the evidence surface

Tier 5 is the richest and least reachable material on the site: content hash, short hash, model
version, sequence, change-from-previous, signals, best price captured, operator coverage, the
immutability statement, and a conditional warning that says the rows *"should be treated as
unverified."*

That last one is the most expensive sentence RankWagers has ever written — a product volunteering
that its own records failed a check. It is Critical-tier trust content, and it lives on a fragment
with no address.

**Within the existing fixture page**, this section moves above the operator block. Proof outranks
recommendation.

### Applied to navigation and footer

Navigation currently offers three commercial destinations and no informational ones.

```
NOW                              RECONSTRUCTED
1. Best Betting                  1. Results / Archive      ← exists, footer-only today
2. Best Crypto                   2. Methodology            ← exists, footer-only today
3. Bonuses                       3. Best Betting
                                 4. Best Crypto
                                 5. Bonuses
```

Footer: group rather than list. Evidence · Safety · Browse · Commercial · Legal. Sixteen ungrouped
links assert that everything matters equally.

---

## V. The inversion

Nothing rises unless something falls.

| Element | From | To | Reason |
|---|---|---|---|
| `TrustBar` | Position 1 on `/best-*` | Out of the position | The only negative element holds the best seat |
| Hero copy | Homepage §1 | Position 19 | Copy read before evidence is noise; after, it is persuasion |
| Confidence number | Leads the card | After `evidenceLine` | Unqualified confidence is a claim |
| Operator CTA | Dominant on cards | Last | Proof outranks recommendation |
| Verified performance | §4 | §1 | The inversion that matters most |
| Commission line | Inside `<details>` | Always visible | A collapsed cost buys nothing |
| Limitations | Inside `<details>` | Always visible | Same |
| Evidence section | Below operators | Above operators | Same |
| Archive, Methodology | Footer | Navigation | Two existing pages change level |

---

## VI. The test

> **Delete every sentence. Is there still a reason to trust the product?**

**Now:** no. Remove the prose and the homepage leaves four icons, a hero image and a fixture list.
Every trust signal on the first screen is a sentence, which means the visitor must read marketing copy
before encountering evidence — the precise failure this brief names.

**Reconstructed:** yes. A won/lost split, a settled/pending/void breakdown, a sample size and a date
window survive with no prose at all. A visitor who reads nothing still knows how many predictions were
made, how many were wrong, and over what period.

---

## VII. Summary

Seven Critical elements. Four are Invisible; three sit in the fourth section of the homepage. Seven
High elements. Three are Invisible. One element subtracts trust, and it holds the highest position on
the page.

The register and the reading order are inversely correlated almost element for element — which is why
the fix requires nothing new. **The numbers are computed. The expensive sentences are written. The
links to their basis are carried in the same objects that render them.**

RankWagers answers the skeptic's seventh question first and their first question last. Reverse the
order and the product becomes trustworthy before it says anything at all.
