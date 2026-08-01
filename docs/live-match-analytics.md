# Live Match Intelligence — analytics

Sprint 22. Four events, emitted only from `lib/live/analytics.ts`, only on fixture pages, and
only for fixtures that are actually in play.

Names are registered in the closed union in `lib/analytics/types.ts`. An unregistered event is
invisible to every downstream aggregation, so registration is part of the contract, not a
formality.

## Events

| Event | Trigger | Properties |
| --- | --- | --- |
| `live_section_viewed` | Section enters the viewport (25% threshold), once per mount | `phase`, `has_timeline`, `has_momentum`, `has_statistics` |
| `live_timeline_expanded` | A timeline segment disclosure is opened | `phase`, `segment`, `event_count` |
| `live_statistics_expanded` | The "show more statistics" disclosure is opened | `phase`, `statistic_count` |
| `live_momentum_viewed` | Momentum graph enters the viewport (40% threshold), once per mount | `phase`, `availability`, `leader` |

All four carry `fixture_id`, so live engagement joins to the existing match-detail funnel
(`match_detail_viewed`, `match_prediction_expanded`, …) on the same key.

## Deliberate choices

**Viewport, not mount.** Both "viewed" events fire on intersection, not on render. The Live
Match section sits below the fold on most fixture pages; a mount-time event would count
renders rather than views and make the funnel unusable. Where `IntersectionObserver` is
unavailable the event fires immediately, which over-counts rather than silently dropping.

**Collapse is not tracked.** Only opening a disclosure emits an event. An open/close pair
would double-count intent.

**`phase` on every event.** Engagement in the first half, at half-time and in the second half
are different behaviours. Carrying the phase means they can be read separately without a
second event vocabulary.

**`operator_slug` is explicitly `null` on all four.** The live layer emits no operator,
affiliate or CTA identifier. `tests/liveMatchIntelligence.test.ts` asserts the four explicit
nulls, so live engagement can never be misread as operator engagement downstream.

**No per-update events.** A poll that changes something emits nothing. Instrumenting the tick
would produce a firehose proportional to match length rather than to user interest.

## Reading the funnel

```
match_detail_viewed          (fixture page opened)
  └─ live_section_viewed     (live section actually seen)          ← live reach
       ├─ live_timeline_expanded
       ├─ live_statistics_expanded
       └─ live_momentum_viewed
```

`live_section_viewed / match_detail_viewed` on in-play fixtures is the reach metric for this
sprint. The three interaction events divided by `live_section_viewed` give per-panel
engagement, and `properties.availability` on `live_momentum_viewed` separates "users did not
engage" from "there was nothing to engage with".

## Not integrated

`docs/analytics-tracking-plan.md` has **not** been amended in this sprint — it is being edited
by a parallel sprint and amending it would have created a merge conflict. This file is the
canonical description of the four live events until they are folded in.
