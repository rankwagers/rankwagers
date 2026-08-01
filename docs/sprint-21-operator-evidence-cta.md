# Sprint 21 — Evidence-Aware Operator CTA Layer

## Why

Before this sprint the only outbound affiliate surface was `OperatorDetailView`. Every other
template had to send a visitor on a detour to convert. The obvious fix — a "Bet now" button on
fixture pages — is the one the manifesto forbids: it recommends an operator without saying why.

This layer makes a recommendation a **derivation**. Every card carries the reasons that produced
it, and the ranking is reproducible from its inputs.

## Architecture

| Module | Role | Purity |
| --- | --- | --- |
| `lib/operators/evidenceCard.ts` | Ranking + evidence model | Pure. No I/O, no clock — `nowIso` injected |
| `lib/analytics/operatorCard.ts` | Four tracked events | Client, mirrors `lib/analytics/engagement.ts` |
| `components/operators/OperatorEvidenceCard.tsx` | Server-rendered card + list | Server component |
| `components/operators/OperatorEvidenceCardAnalytics.tsx` | Impression / click / expand observer | Client, observation only |

### Component registry

- `OperatorEvidenceCard` — a single card. Requires `card`, `locale`, `country`, `surface`, `position`.
- `OperatorEvidenceCardList` — ranked list, ranking basis and limitations. **Owns the feature-flag
  gate.** Renders `null` when `affiliateOperatorsVisible` is false or when `cards` is empty.

The gate lives in the list, not at each call site, so a fourth surface cannot forget it.

## Ranking

Availability is a **gate, not a weight**.

The first implementation scored availability at 40 points and let it compete. It lost: verified
(25) + market (15) + fresh (10) + highest price (8) = 58, so an operator a visitor legally cannot
use outranked one they could, purely on price. No weight fixes this safely — any number large
enough to dominate today stops dominating the moment a factor is added. Partitioning first is the
only form that stays correct as the scoring evolves. Pinned by a regression test.

Within the available group: evidence score descending, then **slug ascending**. `localeCompare` is
deliberately not used — it depends on the runtime's ICU data, so two servers could disagree about
the order of two equally-scored operators.

Weights are integers (`EVIDENCE_WEIGHTS`), so the score is exact and never drifts.

## Placement

Fixture, competition and market pages. **Not** the homepage.

Competition and market pages keep their pre-existing exhaustive operator section. The two are
distinct and are now labelled to say so:

- **Recommended operators** — ranked, evidenced, actionable. Limited to 3.
- **All supported operators** — complete reference list, no outbound CTA.

## Analytics

Registered in the canonical closed union in `lib/analytics/types.ts`:

| Event | Fires |
| --- | --- |
| `operator_card_impression` | Once per operator+surface, at 60% intersection |
| `operator_card_primary_click` | "View odds" |
| `operator_card_secondary_click` | "Operator details" |
| `operator_card_evidence_expand` | `<details>` opening only |

`properties` carries `surface`, `position`, `evidence_score`, `qualification`, so CTR is comparable
across templates and by rank. Impressions are deduped per `surface:slug` for the page lifetime —
without it a card scrolled past three times understates CTR by a factor nobody can reconstruct.

## Accessibility

Native `<details>/<summary>` — keyboard-operable and announced with no JavaScript. Evidence state is
in text (`Met:` / `Not met:`) because the tick glyph is `aria-hidden`. Score is exposed via
`aria-label`. Every interactive element declares `focus-visible:ring`. New-tab CTAs announce it.

## Known limitations

1. **Rendered HTML is not byte-stable.** `operatorAffiliateHref` embeds `issuedAt`/`expiresAt` in
   the signed ctx. Correct — a token with no expiry is replayable — but these cards must not be
   cached as static HTML beyond the token TTL.
2. **No per-operator prices are wired yet.** `observedPrice` is passed as `null` on all three
   surfaces, so `HIGHEST_OBSERVED_PRICE` and `PRICE_RECENTLY_OBSERVED` never fire in production
   today. The model degrades honestly (no price reasons) rather than fabricating one. Wiring
   per-operator odds is the follow-up that unlocks those two factors.
3. Fixture pages pass `marketKey: null` — a fixture spans several markets, so `SUPPORTS_MARKET` is
   not asserted there.

## Changelog

- Added the evidence card model, analytics module, server card and list.
- Mounted on fixture, competition and market templates.
- Registered 4 new analytics events.
- Corrected `fixture_id` typing to the canonical `number | null`.
- **Unrelated repair:** registered 8 event names emitted by `lib/evidence/analytics.ts` and
  `lib/live/analytics.ts` that had never been added to the union. Those modules are orphaned; the
  names were registered rather than the files excluded, because the union is the contract and an
  unregistered event is invisible to every downstream aggregation.
