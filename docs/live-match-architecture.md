# Live Match Intelligence — architecture

Sprint 22. Introduces a reusable **live layer** that turns a fixture page from a static
research surface into a live one, without touching affiliate, operator, ranking or CTA code.

## Layering

```
provider (FootyStats)  →  lib/live/adapter.ts        provider-specific, pure mapping
                       →  lib/live/snapshot.ts       composition
                            ├─ status.ts             LiveMatchStatus
                            ├─ events.ts             LiveEvents
                            ├─ timeline.ts           LiveTimeline
                            ├─ momentum.ts           LiveMomentum
                            └─ statistics.ts         LiveStatistics
                       →  types/live/index.ts        the wire contract
                       →  components/live/*          server shell + hydration island
```

Only **one** module in `lib/live/` touches a provider or the network: `lib/live/server.ts`
(`import "server-only"`). Everything else is pure and clock-injectable, which is why the
domain has 54 unit tests and zero mocks.

Adding a second feed means writing a second adapter to `LiveMatchSource`. No domain module
and no component changes.

## Data flow

| Path | What happens |
| --- | --- |
| Page render | `loadMatchPageBundle` already fetches `getMatchLiveContext`; the snapshot is a *pure transform* of that value, so the live section costs **no extra provider call**. |
| Polling | `LiveMatchProvider` → `GET /api/live-match?matchId=…` → `loadLiveMatchSnapshot` → the same `unstable_cache`-backed provider call (60s revalidate). |
| Update | Client-side `applyLiveUpdate(previous, next)` diffs slice-by-slice. |

The server keeps **no diff state**. It always returns the full current snapshot; the client
decides what changed. That survives restarts, scales horizontally, and cannot desynchronise a
client after a reconnect. The `since` query parameter is a cache-buster and observability
hint, deliberately *not* used to trim the response.

## The incremental-update contract

The sprint requires "updates should be incremental; avoid rerendering the entire page". That
is enforced in `lib/live/diff.ts`, not in the components:

1. `applyLiveUpdate` compares each slice structurally (`stableStringify`, key-order
   insensitive).
2. Slices that did not change **keep their previous object identity**.
3. If nothing changed at all, the *previous snapshot object itself* is returned.
4. Components subscribe per slice through `useLiveSlice` / `useSyncExternalStore`, so React
   bails out of any subtree whose slice reference is unchanged.

Two design details make this actually work:

- **`status.updatedAt` is excluded from the change comparison.** It moves on every poll;
  including it would mark the status slice dirty every tick and defeat the whole mechanism.
  The field therefore means "when the data last actually changed" — which is also the more
  honest label. The client's own "last checked" time lives in `LiveConnectionContext`.
- **Two contexts, not one.** `LiveStoreContext` holds a value created once and never
  replaced. Poll state — which *does* change every tick — lives in `LiveConnectionContext`,
  consumed only by `LiveConnectionNotice`. A single combined context would invalidate every
  consumer on every tick.

## SEO contract

`LiveMatchSection` is a **server component**. Headings, section landmarks, and the first
paint of the timeline, statistics and momentum graph are all HTML. A crawler and a
JavaScript-disabled browser receive the complete live state.

Hydration safety comes from every hook taking a `fallback` prop wired to
`getServerSnapshot`, so the first client render is byte-identical to the server render.
`tests/liveMatchUi.test.ts` asserts this by rendering each component with and without a
store and comparing normalised markup.

Non-live fixtures render `null` — the section is **absent**, not CSS-hidden, so no live
markup and no live JavaScript reach a scheduled or finished match page.

## Evidence discipline

Carried over from the product manifesto; these are the rules that shaped the contracts:

- **Nothing is invented.** Every section carries a `LiveAvailability` (`available` / `empty` /
  `unavailable`) plus a human message. An absent provider feed and an empty one are
  distinguishable at the type level.
- **A passed kickoff never fakes a live phase.** `resolveLivePhase` returns `unknown` for a
  fixture whose status string is empty, regardless of the clock.
- **`0 – 0` is not a measurement.** `homeShareOf` returns `null` when a pair sums to zero, so
  the UI shows "—" rather than a 50/50 bar.
- **Momentum is labelled as derived.** It is computed by us, so `LiveMomentum.method` states
  the exact inputs used and is always printed under the graph. With no timestamped attacking
  events and no comparable statistics, momentum reports `unavailable` rather than drawing a
  flat line that reads as "both teams equal".
- **Unclassifiable events are dropped, not rendered as "other".** A placeholder marker on a
  live timeline is worse than an absent one.
- **Derived phase markers are flagged.** Kick-off / half-time / full-time markers carry
  `origin: "derived"` and render a "Derived from match phase" note, because the feed reported
  the *phase*, not the event.

## Known provider gaps

The current FootyStats feed reports only **goals and red cards** as discrete events, and
reports cards as a combined cumulative count. Consequences, all represented as explicit
absence rather than synthesised data:

| Supported by the layer | Available from the current feed |
| --- | --- |
| Kick-off, half-time, full-time | Derived from status |
| Goal, red card | Yes, timestamped |
| Penalty, VAR, yellow card, substitution, corner, dangerous attack | Not as events — the vocabulary is implemented and normalises these when a feed supplies them |
| Possession, shots, shots on target, xG, corners, dangerous attacks | Yes, as cumulative statistics |
| Yellow/red card counts | **Not mapped** — `cardsHome/Away` is a combined total, and mapping it to `yellow_cards` would overstate bookings whenever a red card is in the total |

Because corners and dangerous attacks arrive only as cumulative statistics, the momentum
*graph* is usually driven by goals alone on this feed; the overall pressure share is derived
from statistics. Both facts are visible to the reader through the `method` line.

## Failure behaviour

- `loadLiveMatchSnapshot` swallows provider errors and returns `null` — a live section is an
  enhancement and must never fail the match page.
- The polling island stops when the fixture leaves an in-play phase, pauses while the
  document is hidden, backs off exponentially to a 120s ceiling, and gives up after five
  consecutive failures with a keyboard-reachable retry.
- `/api/live-match` is rate limited to 30 requests/minute per address
  (`lib/live/rateLimit.ts`), comfortably above the 20s client cadence.

## Route-export constraint

`app/api/live-match/route.ts` exports **only** `GET`, `dynamic` and `revalidate`. Next
validates the generated route type against a closed set of allowed exports, and an arbitrary
named export fails the production build with `Type 'number' is not assignable to type
'never'`. The rate-limit constants therefore live in `lib/live/rateLimit.ts`, following the
existing `lib/combo/rateLimit.ts` convention. `tests/liveMatchUi.test.ts` guards this at
source level, because a source-only typecheck does not catch it.
