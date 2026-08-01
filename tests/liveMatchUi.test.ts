import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildLiveMatchSnapshot } from "../lib/live/snapshot";
import { createLiveStore } from "../lib/live/store";
import type { LiveMatchSnapshot, LiveMatchSource } from "../types/live";

/**
 * Sprint 22 — Live Match Intelligence: rendering, hydration, accessibility and regression.
 *
 * The project compiles JSX with the classic runtime (`tsconfig.json` sets `jsx: "preserve"`,
 * and Next supplies the transform in the real build). Under the test transpiler this emits
 * `React.createElement`, so `React` must exist as a global before any JSX module evaluates.
 * `import` statements are hoisted, so the JSX modules are pulled in with statement-level
 * `require()` below, which runs in source order AFTER the global is set. This mirrors
 * `tests/builderApprovalUi.test.ts`; no production file is affected.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
(globalThis as { React?: unknown }).React = require("react");
const React = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const { LiveStoreContext } =
  require("../lib/live/context") as typeof import("../lib/live/context");
const { LiveMatchSection } =
  require("../components/live/LiveMatchSection") as typeof import("../components/live/LiveMatchSection");
const { LiveMatchHeader } =
  require("../components/live/LiveMatchHeader") as typeof import("../components/live/LiveMatchHeader");
const { LiveEventBadge } =
  require("../components/live/LiveEventBadge") as typeof import("../components/live/LiveEventBadge");
const { LiveTimelineCard } =
  require("../components/live/LiveTimelineCard") as typeof import("../components/live/LiveTimelineCard");
const { LiveStatisticsTable } =
  require("../components/live/LiveStatisticsTable") as typeof import("../components/live/LiveStatisticsTable");
const { LiveMomentumGraph } =
  require("../components/live/LiveMomentumGraph") as typeof import("../components/live/LiveMomentumGraph");
/* eslint-enable @typescript-eslint/no-var-requires */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOW = 1_700_000_000;

function source(overrides: Partial<LiveMatchSource> = {}): LiveMatchSource {
  return {
    matchId: 555,
    homeTeam: "Home FC",
    awayTeam: "Away United",
    competition: "Premier League",
    country: "England",
    status: "live",
    kickoffUnix: NOW - 3600,
    minute: 63,
    homeScore: 2,
    awayScore: 1,
    htHome: 1,
    htAway: 0,
    events: [
      { id: "g1", type: "goal", minute: 12, side: "home", label: "Smith" },
      { id: "y1", type: "yellow card", minute: 41, side: "away", label: "Jones" },
      { id: "g2", type: "goal", minute: 58, side: "away", label: "Miller" },
      { id: "c1", type: "corner", minute: 61, side: "home" },
    ],
    statistics: {
      possession: { home: 58, away: 42 },
      shots: { home: 11, away: 6 },
      shots_on_target: { home: 5, away: 2 },
      expected_goals: { home: 1.62, away: 0.71 },
      corners: { home: 7, away: 3 },
      dangerous_attacks: { home: 41, away: 22 },
    },
    fetchedAt: new Date(NOW * 1000).toISOString(),
    nowSec: NOW,
    ...overrides,
  };
}

const liveSnapshot = buildLiveMatchSnapshot(source());

/** Ids come from `useId()` and depend on tree position; normalise before comparing markup. */
function normalizeIds(markup: string): string {
  return markup
    .replace(/id="[^"]*"/g, 'id="_"')
    .replace(/aria-controls="[^"]*"/g, 'aria-controls="_"')
    .replace(/aria-describedby="[^"]*"/g, 'aria-describedby="_"')
    .replace(/aria-labelledby="[^"]*"/g, 'aria-labelledby="_"');
}

function withStore(
  snapshot: LiveMatchSnapshot,
  element: React.ReactElement,
  applied?: LiveMatchSnapshot
): string {
  const store = createLiveStore(snapshot);
  if (applied) store.apply(applied);
  return renderToStaticMarkup(
    React.createElement(
      LiveStoreContext.Provider,
      { value: { store, matchId: snapshot.matchId, locale: "en" } },
      element
    )
  );
}

/* ------------------------------------------------------------------ *
 * Server-rendered shell (SEO contract)
 * ------------------------------------------------------------------ */

test("the live section server-renders its full content, not a client placeholder", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveMatchSection, { snapshot: liveSnapshot, locale: "en" })
  );

  assert.match(markup, /data-live-match-section/);
  assert.match(markup, /Live match<\/h2>/);
  // Timeline, statistics and momentum content is all present in the initial HTML.
  assert.match(markup, /Smith/);
  assert.match(markup, /Miller/);
  assert.match(markup, /Possession/);
  assert.match(markup, /Expected goals \(xG\)/);
  assert.match(markup, /Momentum share by period/);
  assert.match(markup, /2–1/);
  assert.match(markup, /63&#x27;/);
});

test("the live section is absent — not merely hidden — for a non-live fixture", () => {
  for (const status of ["complete", "NS", "Postponed"]) {
    const snapshot = buildLiveMatchSnapshot(source({ status }));
    const markup = renderToStaticMarkup(
      React.createElement(LiveMatchSection, { snapshot, locale: "en" })
    );
    assert.equal(markup, "", `expected no markup for status ${status}`);
  }
  assert.equal(
    renderToStaticMarkup(
      React.createElement(LiveMatchSection, { snapshot: null, locale: "en" })
    ),
    ""
  );
});

test("the section shell is a server component and ships no client directive of its own", () => {
  const shell = readFileSync(path.join(root, "components/live/LiveMatchSection.tsx"), "utf8");
  assert.doesNotMatch(shell, /^"use client"/m);
  // Networking is confined to the island, never the shell.
  assert.doesNotMatch(shell, /fetch\(/);
});

/* ------------------------------------------------------------------ *
 * Hydration stability
 * ------------------------------------------------------------------ */

test("a component renders identically with and without a store — hydration is stable", () => {
  const standalone = renderToStaticMarkup(
    React.createElement(LiveMatchHeader, {
      homeTeam: liveSnapshot.homeTeam,
      awayTeam: liveSnapshot.awayTeam,
      initialStatus: liveSnapshot.status,
    })
  );
  const hydrated = withStore(
    liveSnapshot,
    React.createElement(LiveMatchHeader, {
      homeTeam: liveSnapshot.homeTeam,
      awayTeam: liveSnapshot.awayTeam,
      initialStatus: liveSnapshot.status,
    })
  );
  assert.equal(normalizeIds(standalone), normalizeIds(hydrated));
});

test("the timeline renders identically with and without a store", () => {
  const props = {
    initialTimeline: liveSnapshot.timeline,
    initialPhase: liveSnapshot.status.phase,
    homeTeam: liveSnapshot.homeTeam,
    awayTeam: liveSnapshot.awayTeam,
    matchId: liveSnapshot.matchId,
    locale: "en",
    headingId: "timeline-heading",
  };
  const standalone = renderToStaticMarkup(React.createElement(LiveTimelineCard, props));
  const hydrated = withStore(liveSnapshot, React.createElement(LiveTimelineCard, props));
  assert.equal(normalizeIds(standalone), normalizeIds(hydrated));
});

test("server rendering always uses the server snapshot, even if the store has moved on", () => {
  // `useSyncExternalStore` calls `getServerSnapshot` during SSR, which every live hook wires
  // to the prop-provided fallback. That is precisely what makes hydration safe: the HTML can
  // never depend on client-only store state that the browser has not observed yet.
  const updated = buildLiveMatchSnapshot(
    source({ homeScore: 4, minute: 77, fetchedAt: new Date((NOW + 60) * 1000).toISOString() })
  );
  const markup = withStore(
    liveSnapshot,
    React.createElement(LiveMatchHeader, {
      homeTeam: liveSnapshot.homeTeam,
      awayTeam: liveSnapshot.awayTeam,
      initialStatus: liveSnapshot.status,
    }),
    updated
  );
  assert.match(markup, /2–1/);
  assert.doesNotMatch(markup, /4–1/);
});

test("each live component subscribes to exactly one slice", () => {
  const expectations: Array<[string, string]> = [
    ["components/live/LiveMatchHeader.tsx", "status"],
    ["components/live/LiveTimelineCard.tsx", "timeline"],
    ["components/live/LiveStatisticsTable.tsx", "statistics"],
    ["components/live/LiveMomentumGraph.tsx", "momentum"],
  ];
  for (const [rel, slice] of expectations) {
    const contents = readFileSync(path.join(root, rel), "utf8");
    const subscriptions = contents.match(/useLiveSlice\(\s*"([a-z]+)"/g) ?? [];
    assert.equal(subscriptions.length, 1, `${rel} should subscribe once`);
    assert.match(subscriptions[0], new RegExp(`"${slice}"`), rel);
    // Subscribing to the whole snapshot would re-render the component on every poll.
    assert.doesNotMatch(contents, /useLiveSnapshot\(/, rel);
  }
});

/* ------------------------------------------------------------------ *
 * Accessibility
 * ------------------------------------------------------------------ */

test("live regions exist in the initial HTML, before any update can fire", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveMatchSection, { snapshot: liveSnapshot, locale: "en" })
  );
  assert.match(markup, /aria-live="assertive"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /role="log"/);
  assert.match(markup, /aria-atomic="false"/);
  // The section itself is a labelled landmark.
  assert.match(markup, /<section aria-labelledby="live-match-heading-555"/);
});

test("the status block is a polite atomic region with an explicit score label", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveMatchHeader, {
      homeTeam: "Home FC",
      awayTeam: "Away United",
      initialStatus: liveSnapshot.status,
    })
  );
  assert.match(markup, /role="status"/);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /aria-atomic="true"/);
  assert.match(markup, /aria-label="Live score, Home FC 2, Away United 1"/);
});

test("timeline disclosures are real buttons with expanded state and panel association", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveTimelineCard, {
      initialTimeline: liveSnapshot.timeline,
      initialPhase: liveSnapshot.status.phase,
      homeTeam: "Home FC",
      awayTeam: "Away United",
      matchId: 555,
      locale: "en",
      headingId: "timeline-heading",
    })
  );
  assert.match(markup, /<button type="button" aria-expanded="(true|false)" aria-controls="/);
  // Keyboard operability comes from the platform, not from a div with a click handler.
  assert.doesNotMatch(markup, /role="button"/);
  assert.match(markup, /focus-visible:outline/);
  assert.match(markup, /<ol /);
});

test("event badges expose the event name to assistive technology, not just a glyph", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveEventBadge, {
      event: { type: "yellow_card", minute: 41, addedTime: null },
      showClock: true,
    })
  );
  assert.match(markup, /aria-hidden="true">YC</);
  assert.match(markup, /class="sr-only">Yellow card</);
  assert.match(markup, /41&#x27;/);
});

test("the statistics table uses row headers and a caption", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveStatisticsTable, {
      initialStatistics: liveSnapshot.statistics,
      initialPhase: liveSnapshot.status.phase,
      homeTeam: "Home FC",
      awayTeam: "Away United",
      matchId: 555,
      locale: "en",
    })
  );
  assert.match(markup, /<caption class="sr-only">/);
  assert.match(markup, /<th scope="col"/);
  assert.match(markup, /<th scope="row"/);
  assert.match(markup, /aria-expanded="false"/);
});

test("the momentum graph is a labelled image with an accessible data table equivalent", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveMomentumGraph, {
      initialMomentum: liveSnapshot.momentum,
      initialPhase: liveSnapshot.status.phase,
      homeTeam: "Home FC",
      awayTeam: "Away United",
      matchId: 555,
      locale: "en",
    })
  );
  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-label="Momentum by 15-minute period\./);
  assert.match(markup, /<table id="[^"]*" class="sr-only">/);
  assert.match(markup, /<caption>Momentum share by period<\/caption>/);
  // The derivation statement is always printed — momentum is ours, not the provider's.
  assert.match(markup, /Derived: /);
});

test("a fixture with no measurable momentum says so instead of drawing a flat graph", () => {
  const snapshot = buildLiveMatchSnapshot(
    source({ events: [], statistics: undefined })
  );
  const markup = renderToStaticMarkup(
    React.createElement(LiveMomentumGraph, {
      initialMomentum: snapshot.momentum,
      initialPhase: snapshot.status.phase,
      homeTeam: "Home FC",
      awayTeam: "Away United",
      matchId: 555,
      locale: "en",
    })
  );
  assert.doesNotMatch(markup, /<svg/);
  assert.match(markup, /Momentum needs timestamped attacking events/);
});

/* ------------------------------------------------------------------ *
 * Integration + Sprint 21 isolation regression
 * ------------------------------------------------------------------ */

test("the fixture page wires the live section through the loader bundle", () => {
  const view = readFileSync(
    path.join(root, "components/fixtures/MatchDetailView.tsx"),
    "utf8"
  );
  assert.match(view, /LiveMatchSection/);
  assert.match(view, /snapshot=\{bundle\.liveMatch\}/);

  const loader = readFileSync(
    path.join(root, "lib/fixtures/loadMatchPage.server.ts"),
    "utf8"
  );
  assert.match(loader, /buildLiveMatchSnapshot/);
  assert.match(loader, /liveMatch/);
});

test("the live update endpoint is unauthenticated-read, rate limited and uncached", () => {
  const route = readFileSync(path.join(root, "app/api/live-match/route.ts"), "utf8");
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /rateLimitLiveMatch\(/);
  assert.match(route, /no-store/);
  assert.match(route, /status: 400/);
  assert.match(route, /status: 404/);
  assert.match(route, /status: 429/);
  // The live layer must not sign or resolve affiliate offers.
  assert.doesNotMatch(route, /affiliate|operator/i);
});

test("the route module exports only handlers and supported route configuration", () => {
  // Next validates the generated route type against a closed set of allowed exports. An
  // arbitrary named export fails the production build with "not assignable to type 'never'",
  // which a typecheck of the source alone does not catch — hence this source-level guard.
  const route = readFileSync(path.join(root, "app/api/live-match/route.ts"), "utf8");
  const allowed = new Set([
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "dynamic",
    "dynamicParams",
    "revalidate",
    "fetchCache",
    "runtime",
    "preferredRegion",
    "maxDuration",
    "generateStaticParams",
  ]);
  const exported = [
    ...route.matchAll(/^export\s+(?:async\s+)?(?:const|function|let|var)\s+([A-Za-z0-9_]+)/gm),
  ].map((match) => match[1]);
  assert.ok(exported.length > 0, "expected at least the GET handler");
  for (const name of exported) {
    assert.ok(allowed.has(name), `route.ts exports unsupported member ${name}`);
  }

  // The constants moved to the domain module, following the lib/*/rateLimit.ts convention.
  const limits = readFileSync(path.join(root, "lib/live/rateLimit.ts"), "utf8");
  assert.match(limits, /export const LIVE_MATCH_RATE_LIMIT/);
  assert.match(limits, /export const LIVE_MATCH_RATE_WINDOW_MS/);
});

test("live components do not touch operator, CTA or affiliate surfaces", () => {
  for (const rel of [
    "components/live/LiveAnnouncer.tsx",
    "components/live/LiveConnectionNotice.tsx",
    "components/live/LiveEventBadge.tsx",
    "components/live/LiveMatchHeader.tsx",
    "components/live/LiveMatchProvider.tsx",
    "components/live/LiveMatchSection.tsx",
    "components/live/LiveMomentumGraph.tsx",
    "components/live/LiveSectionViewTracker.tsx",
    "components/live/LiveStatisticsTable.tsx",
    "components/live/LiveTimelineCard.tsx",
  ]) {
    const contents = readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(contents, /components\/operators|lib\/operators|lib\/affiliate/, rel);
    assert.doesNotMatch(contents, /outboundPath|buildGoPath|sponsored/, rel);
  }
});

test("the polling island stops for finished fixtures and backs off on failure", () => {
  const provider = readFileSync(
    path.join(root, "components/live/LiveMatchProvider.tsx"),
    "utf8"
  );
  assert.match(provider, /status\.isLive/);
  assert.match(provider, /LIVE_POLL_MAX_FAILURES/);
  assert.match(provider, /visibilitychange/);
  assert.match(provider, /AbortController/);
  assert.match(provider, /clearTimeout/);
});
