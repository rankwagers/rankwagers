# Live Match Intelligence — component registry

Sprint 22. Everything under `components/live/`. See `docs/live-match-architecture.md` for the
data layer.

## Reusable components

| Component | Boundary | Slice | Reusable standalone? |
| --- | --- | --- | --- |
| `LiveEventBadge` | neither (pure) | — | Yes — no hooks, no store, no directive |
| `LiveMatchHeader` | client | `status` | Yes — `initialStatus` prop is the fallback |
| `LiveTimelineCard` | client | `timeline` | Yes — `initialTimeline` prop |
| `LiveMomentumGraph` | client | `momentum` | Yes — `initialMomentum` prop |
| `LiveStatisticsTable` | client | `statistics` | Yes — `initialStatistics` prop |

Every hydrated component takes an `initial*` prop. With no `LiveMatchProvider` mounted, that
prop *is* the rendered value, so each component works on any surface — the fixture page, a
future live index, a widget — without the store. With a provider mounted, the same prop is
the `getServerSnapshot` value, which is what makes hydration stable.

Each subscribes to **exactly one** slice; `tests/liveMatchUi.test.ts` asserts this and
forbids `useLiveSnapshot` in these components, because a whole-snapshot subscription would
re-render on every poll.

## Composition and infrastructure

| Component | Boundary | Role |
| --- | --- | --- |
| `LiveMatchSection` | **server** | The shell. Headings, landmarks, layout, first paint. Decides visibility via `isRenderableLiveSnapshot`; returns `null` for non-live fixtures. |
| `LiveMatchProvider` | client | The only networked component. Owns the store, the poll loop, and both contexts. |
| `LiveAnnouncer` | client | The two ARIA live regions. |
| `LiveConnectionNotice` | client | Sole consumer of `LiveConnectionContext`. Renders nothing while healthy. |
| `LiveSectionViewTracker` | client | Fires `live_section_viewed` on viewport entry. Renders nothing. |

## Props

### `LiveEventBadge`
```ts
{ event: Pick<LiveEvent, "type" | "minute" | "addedTime">; showClock?: boolean; className?: string }
```
Glyph is `aria-hidden`; the full event name is `sr-only` text, so a screen reader hears
"Yellow card" rather than "Y C". Emits `data-live-event-type` and `data-live-event-tone`.

### `LiveMatchHeader`
```ts
{ homeTeam: string; awayTeam: string; initialStatus: LiveMatchStatus; headingId?: string }
```
`role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Team crests are deliberately not
rendered — the match page header above already shows them, and keeping images out of the
hydrated island keeps the live payload to text.

### `LiveTimelineCard`
```ts
{ initialTimeline: LiveTimeline; initialPhase: LiveMatchPhase; homeTeam: string;
  awayTeam: string; matchId: number; locale: string; headingId: string }
```
One disclosure per segment. `defaultExpandedSegments` opens the current segment only, so a
90th-minute view does not open with forty rows of first-half detail.

### `LiveMomentumGraph`
```ts
{ initialMomentum: LiveMomentum; initialPhase: LiveMatchPhase; homeTeam: string;
  awayTeam: string; matchId: number; locale: string }
```
Inline SVG — no chart library, nothing downloaded at runtime, server-renders identically.
Buckets with no observations render as a dashed "no data" band, never as 50/50.

### `LiveStatisticsTable`
```ts
{ initialStatistics: LiveStatistics; initialPhase: LiveMatchPhase; homeTeam: string;
  awayTeam: string; matchId: number; locale: string; captionId?: string }
```
Four rows always visible; the rest behind a disclosure. Both states are server-rendered, so
the preview is visible without JavaScript.

### `LiveMatchSection`
```ts
{ snapshot: LiveMatchSnapshot | null | undefined; locale: string; className?: string }
```

## Accessibility contract

| Requirement | How it is met |
| --- | --- |
| Live regions | Two `role="log"` regions present in the **initial** HTML — a region inserted at the same time as its content is frequently missed. |
| Announcement priority | Assertive for goal, penalty, red card, full-time. Polite for bookings, substitutions, VAR, phase changes. Corners and dangerous attacks are **not** announced — a region firing every fifteen seconds is worse than silence. Capped at 4 per update so a catch-up burst cannot spam. |
| Keyboard | Every control is a native `<button type="button">`. No `role="button"` on a `div`; no custom key handling to get wrong. Visible `focus-visible:outline` on each. |
| Touch targets | `min-h-[var(--touch-min)]` on every interactive control. |
| Disclosure semantics | `aria-expanded` + `aria-controls` pointing at the panel it toggles. |
| Data tables | Real `<table>` with `scope="col"` / `scope="row"` and an `sr-only` `<caption>`. |
| Charts | SVG is `role="img"` with a summarising `aria-label`, plus an `sr-only` `<table>` carrying the same numbers — a screen-reader user gets the data, not a description of a picture. |
| Colour independence | Every state is also words: "Live", "Update delayed", "No events observed", freshness copy. The momentum legend labels its three bands textually. |
| Motion | The live pulse dot uses `motion-safe:animate-pulse`, so it is inert under `prefers-reduced-motion`. |

## Design tokens

No hard-coded colours. Uses `--status-live-bg/fg`, `--amber-surface/border/primary`,
`--green-primary`, `--canvas-secondary`, `--border-subtle`, `--ink-secondary`, `--touch-min`.
