import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { analyticsEventNames } from "../lib/analytics/types";
import { liveSourceFromMatchContext } from "../lib/live/adapter";
import { buildLiveAnnouncements } from "../lib/live/announce";
import { applyLiveUpdate, LIVE_SLICE_KEYS, stableStringify } from "../lib/live/diff";
import {
  LIVE_EVENT_TYPES,
  buildLiveEvents,
  dedupeLiveEvents,
  derivePhaseEvents,
  formatEventClock,
  normalizeLiveEvent,
  normalizeLiveEventType,
  sortLiveEvents,
} from "../lib/live/events";
import {
  LIVE_MOMENTUM_DEADBAND_PCT,
  buildLiveMomentum,
  buildMomentumPoints,
  statisticsPressureShare,
} from "../lib/live/momentum";
import { buildLiveMatchSnapshot, isRenderableLiveSnapshot } from "../lib/live/snapshot";
import {
  LIVE_STALE_AFTER_SEC,
  buildLiveMatchStatus,
  formatLiveClock,
  isLivePhase,
  resolveLiveFreshness,
  resolveLivePhase,
  shouldRenderLiveSection,
} from "../lib/live/status";
import {
  LIVE_STATISTIC_KEYS,
  buildLiveStatistics,
  formatLiveStatValue,
  homeShareOf,
} from "../lib/live/statistics";
import { createLiveStore, LIVE_ANNOUNCEMENT_BUFFER } from "../lib/live/store";
import { buildLiveTimeline, defaultExpandedSegments } from "../lib/live/timeline";
import type {
  LiveEventInput,
  LiveMatchSnapshot,
  LiveMatchSource,
  LiveUpdateResult,
} from "../types/live";

/**
 * Sprint 22 — Live Match Intelligence, domain tests.
 *
 * Every module under `lib/live/` except `server.ts` is pure, so these tests run with no
 * network, no mocks and an injected clock. `tests/liveMatchUi.test.ts` covers rendering,
 * hydration and accessibility.
 */

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
    events: [],
    statistics: {},
    fetchedAt: new Date(NOW * 1000).toISOString(),
    nowSec: NOW,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Vocabulary coverage — the sprint's supported-events list
 * ------------------------------------------------------------------ */

test("every event type named in the sprint brief is supported", () => {
  for (const required of [
    "kickoff",
    "halftime",
    "fulltime",
    "goal",
    "penalty",
    "var",
    "yellow_card",
    "red_card",
    "substitution",
    "corner",
    "dangerous_attack",
  ]) {
    assert.ok(
      (LIVE_EVENT_TYPES as readonly string[]).includes(required),
      `missing event type ${required}`
    );
  }
});

test("every statistic named in the sprint brief is supported", () => {
  for (const required of [
    "possession",
    "shots",
    "shots_on_target",
    "expected_goals",
    "corners",
    "dangerous_attacks",
  ]) {
    assert.ok(
      (LIVE_STATISTIC_KEYS as readonly string[]).includes(required),
      `missing statistic ${required}`
    );
  }
});

/* ------------------------------------------------------------------ *
 * LiveEvents
 * ------------------------------------------------------------------ */

test("event type normalisation resolves provider aliases and rejects noise", () => {
  assert.equal(normalizeLiveEventType("Goal"), "goal");
  assert.equal(normalizeLiveEventType("yellow card"), "yellow_card");
  assert.equal(normalizeLiveEventType("Second Yellow"), "red_card");
  assert.equal(normalizeLiveEventType("sending off"), "red_card");
  assert.equal(normalizeLiveEventType("VAR review"), "var");
  assert.equal(normalizeLiveEventType("Penalty awarded"), "penalty");
  assert.equal(normalizeLiveEventType("substitution"), "substitution");
  assert.equal(normalizeLiveEventType("Corner"), "corner");
  assert.equal(normalizeLiveEventType("dangerous attack"), "dangerous_attack");
  // Unclassifiable input must not become a placeholder marker on a live timeline.
  assert.equal(normalizeLiveEventType("weather delay note"), null);
  assert.equal(normalizeLiveEventType(""), null);
  assert.equal(normalizeLiveEventType(undefined), null);
});

test("red card alias is not swallowed by the generic card rule", () => {
  assert.equal(normalizeLiveEventType("red_card"), "red_card");
  assert.notEqual(normalizeLiveEventType("red card"), "yellow_card");
});

test("event normalisation keeps missing fields null rather than inventing them", () => {
  const event = normalizeLiveEvent(
    { type: "goal", minute: null, side: null, label: null },
    0
  );
  assert.ok(event);
  assert.equal(event.minute, null);
  assert.equal(event.side, "neutral");
  assert.equal(event.label, "Goal");
  assert.equal(event.scoreAfter, null);
  assert.equal(event.origin, "provider");
});

test("event minutes outside a plausible football clock are discarded", () => {
  const event = normalizeLiveEvent({ type: "goal", minute: 900 }, 0);
  assert.equal(event?.minute, null);
  const negative = normalizeLiveEvent({ type: "goal", minute: -4 }, 0);
  assert.equal(negative?.minute, null);
});

test("events sort chronologically with undated events last and stoppage time after", () => {
  const events = sortLiveEvents([
    normalizeLiveEvent({ id: "c", type: "goal", minute: null }, 0)!,
    normalizeLiveEvent({ id: "b", type: "goal", minute: 45, addedTime: 3 }, 1)!,
    normalizeLiveEvent({ id: "a", type: "goal", minute: 45 }, 2)!,
  ]);
  assert.deepEqual(
    events.map((event) => event.id),
    ["a", "b", "c"]
  );
});

test("absent event feed and empty event feed are distinguishable", () => {
  const status = buildLiveMatchStatus(source({ status: "NS", minute: null }));
  const absent = buildLiveEvents(undefined, { status, includeDerivedPhases: false });
  assert.equal(absent.availability, "unavailable");
  assert.match(absent.message ?? "", /does not expose/);

  const empty = buildLiveEvents([], { status, includeDerivedPhases: false });
  assert.equal(empty.availability, "empty");
  assert.match(empty.message ?? "", /reported yet/);
});

test("phase markers are derived from observed status and flagged as derived", () => {
  const status = buildLiveMatchStatus(source({ status: "complete", minute: null }));
  const derived = derivePhaseEvents(status);
  assert.deepEqual(
    derived.map((event) => event.type),
    ["kickoff", "halftime", "fulltime"]
  );
  assert.ok(derived.every((event) => event.origin === "derived"));
  // Full-time derived marker carries the observed final score, not a guess.
  assert.match(derived[2].detail ?? "", /Final score 2–1/);
});

test("a pre-match fixture derives no phase markers", () => {
  const status = buildLiveMatchStatus(
    source({ status: "NS", minute: null, kickoffUnix: NOW + 3600 })
  );
  assert.deepEqual(derivePhaseEvents(status), []);
});

test("a timeline of derived markers only is labelled as such", () => {
  const status = buildLiveMatchStatus(source());
  const events = buildLiveEvents([], { status });
  assert.equal(events.availability, "available");
  assert.match(events.message ?? "", /Only match-phase markers/);
});

test("duplicate ids are removed keeping the first occurrence", () => {
  const a = normalizeLiveEvent({ id: "x", type: "goal", minute: 10 }, 0)!;
  const b = normalizeLiveEvent({ id: "x", type: "corner", minute: 20 }, 1)!;
  assert.deepEqual(
    dedupeLiveEvents([a, b]).map((event) => event.type),
    ["goal"]
  );
});

test("event clock formats stoppage time", () => {
  assert.equal(formatEventClock({ minute: 63, addedTime: null }), "63'");
  assert.equal(formatEventClock({ minute: 45, addedTime: 2 }), "45+2'");
  assert.equal(formatEventClock({ minute: null, addedTime: null }), "—");
});

/* ------------------------------------------------------------------ *
 * LiveMatchStatus
 * ------------------------------------------------------------------ */

test("live phase resolution covers provider status vocabulary", () => {
  assert.equal(resolveLivePhase({ status: "live", minute: 20, nowSec: NOW }), "first_half");
  assert.equal(resolveLivePhase({ status: "live", minute: 70, nowSec: NOW }), "second_half");
  assert.equal(resolveLivePhase({ status: "1H", minute: 12, nowSec: NOW }), "first_half");
  assert.equal(resolveLivePhase({ status: "2H", minute: 60, nowSec: NOW }), "second_half");
  assert.equal(resolveLivePhase({ status: "HT", nowSec: NOW }), "half_time");
  assert.equal(resolveLivePhase({ status: "complete", nowSec: NOW }), "full_time");
  assert.equal(resolveLivePhase({ status: "FT", nowSec: NOW }), "full_time");
  assert.equal(resolveLivePhase({ status: "AET", nowSec: NOW }), "full_time");
  assert.equal(resolveLivePhase({ status: "ET", minute: 100, nowSec: NOW }), "extra_time");
  assert.equal(resolveLivePhase({ status: "Penalty Shootout", nowSec: NOW }), "penalty_shootout");
  assert.equal(resolveLivePhase({ status: "Suspended", nowSec: NOW }), "interrupted");
  assert.equal(resolveLivePhase({ status: "Postponed", nowSec: NOW }), "interrupted");
  assert.equal(resolveLivePhase({ status: "NS", nowSec: NOW }), "pre_match");
});

test("a passed kickoff with no status never fakes a live phase", () => {
  assert.equal(
    resolveLivePhase({ status: "", kickoffUnix: NOW - 600, nowSec: NOW }),
    "unknown"
  );
  assert.equal(
    resolveLivePhase({ status: null, kickoffUnix: NOW + 600, nowSec: NOW }),
    "pre_match"
  );
});

test("minute 91 is second-half stoppage time, not extra time", () => {
  assert.equal(resolveLivePhase({ status: "live", minute: 93, nowSec: NOW }), "second_half");
});

test("in-play phases drive section visibility and nothing else does", () => {
  for (const phase of ["first_half", "half_time", "second_half", "extra_time", "penalty_shootout"] as const) {
    assert.equal(isLivePhase(phase), true, phase);
  }
  for (const phase of ["pre_match", "full_time", "interrupted", "unknown"] as const) {
    assert.equal(isLivePhase(phase), false, phase);
  }
  assert.equal(shouldRenderLiveSection(buildLiveMatchStatus(source())), true);
  assert.equal(
    shouldRenderLiveSection(buildLiveMatchStatus(source({ status: "complete" }))),
    false
  );
});

test("status suppresses the minute outside play and the score before it exists", () => {
  const halfTime = buildLiveMatchStatus(source({ status: "HT", minute: 45 }));
  assert.equal(halfTime.minute, null);
  assert.equal(halfTime.clockLabel, "HT");
  assert.equal(halfTime.score.home, 2);

  const scheduled = buildLiveMatchStatus(
    source({ status: "NS", minute: 0, kickoffUnix: NOW + 3600 })
  );
  assert.equal(scheduled.score.home, null);
  assert.equal(scheduled.clockLabel, null);
});

test("clock formatting covers stoppage time and non-clock phases", () => {
  assert.equal(formatLiveClock({ phase: "second_half", minute: 90, addedTime: 4 }), "90+4'");
  assert.equal(formatLiveClock({ phase: "full_time", minute: 90, addedTime: null }), "FT");
  assert.equal(formatLiveClock({ phase: "penalty_shootout", minute: null, addedTime: null }), "PENS");
  assert.equal(formatLiveClock({ phase: "pre_match", minute: null, addedTime: null }), null);
});

test("freshness degrades with observation age while in play", () => {
  const at = (ageSec: number) => new Date((NOW - ageSec) * 1000).toISOString();
  assert.equal(resolveLiveFreshness({ isLive: true, updatedAt: at(10), nowSec: NOW }), "live");
  assert.equal(resolveLiveFreshness({ isLive: true, updatedAt: at(100), nowSec: NOW }), "recent");
  assert.equal(
    resolveLiveFreshness({
      isLive: true,
      updatedAt: at(LIVE_STALE_AFTER_SEC + 30),
      nowSec: NOW,
    }),
    "stale"
  );
  assert.equal(resolveLiveFreshness({ isLive: true, updatedAt: null, nowSec: NOW }), "unknown");
});

test("an interrupted fixture states the provider reason", () => {
  const status = buildLiveMatchStatus(source({ status: "Abandoned" }));
  assert.equal(status.phase, "interrupted");
  assert.equal(status.isLive, false);
  assert.match(status.interruptionReason ?? "", /abandoned/);
});

/* ------------------------------------------------------------------ *
 * LiveStatistics
 * ------------------------------------------------------------------ */

test("statistics omit unreported pairs and name them in the message", () => {
  const stats = buildLiveStatistics({
    statistics: { possession: { home: 62, away: 38 }, shots: { home: 9, away: 4 } },
  });
  assert.equal(stats.availability, "available");
  assert.deepEqual(
    stats.items.map((item) => item.key),
    ["possession", "shots"]
  );
  assert.match(stats.message ?? "", /Expected goals/);
  assert.match(stats.message ?? "", /Corners/);
});

test("statistics distinguish an absent feed from an empty one", () => {
  assert.equal(buildLiveStatistics({ statistics: undefined }).availability, "unavailable");
  assert.equal(buildLiveStatistics({ statistics: {} }).availability, "empty");
});

test("a zero-zero pair yields no share, so no 50/50 bar is drawn", () => {
  assert.equal(homeShareOf(0, 0), null);
  assert.equal(homeShareOf(3, null), null);
  assert.equal(homeShareOf(3, 1), 0.75);
  const stats = buildLiveStatistics({ statistics: { corners: { home: 0, away: 0 } } });
  assert.equal(stats.items[0].homeShare, null);
});

test("statistic values format per unit", () => {
  assert.equal(formatLiveStatValue(62.4, "percent"), "62%");
  assert.equal(formatLiveStatValue(1.234, "xg"), "1.23");
  assert.equal(formatLiveStatValue(7, "count"), "7");
  assert.equal(formatLiveStatValue(null, "count"), "—");
});

/* ------------------------------------------------------------------ *
 * LiveTimeline
 * ------------------------------------------------------------------ */

test("timeline groups events into segments and isolates undated events", () => {
  const status = buildLiveMatchStatus(source());
  const events = buildLiveEvents(
    [
      { id: "g1", type: "goal", minute: 12, side: "home", label: "Smith" },
      { id: "y1", type: "yellow card", minute: 58, side: "away", label: "Jones" },
      { id: "u1", type: "corner", minute: null, side: "home" },
    ],
    { status }
  );
  const timeline = buildLiveTimeline(events, status);
  assert.equal(timeline.availability, "available");
  // `first_half` also carries the derived kick-off marker, and the derived half-time marker
  // gets its own segment — see the dedicated test below.
  assert.deepEqual(
    timeline.segments.map((segment) => segment.key),
    ["first_half", "half_time", "second_half"]
  );
  assert.equal(timeline.undatedEvents.length, 1);
  assert.match(timeline.message ?? "", /without a match minute/);
});

test("the derived half-time marker sits in its own segment, not at the end of the first half", () => {
  const status = buildLiveMatchStatus(source({ status: "2H", minute: 60 }));
  const events = buildLiveEvents([{ id: "g1", type: "goal", minute: 30, side: "home" }], {
    status,
  });
  const timeline = buildLiveTimeline(events, status);
  const halfTime = timeline.segments.find((segment) => segment.key === "half_time");
  assert.ok(halfTime, "expected a half-time segment");
  assert.deepEqual(
    halfTime.events.map((event) => event.type),
    ["halftime"]
  );
});

test("the current segment is the one expanded by default", () => {
  const status = buildLiveMatchStatus(source({ status: "2H", minute: 70 }));
  const events = buildLiveEvents(
    [
      { id: "g1", type: "goal", minute: 30, side: "home" },
      { id: "g2", type: "goal", minute: 66, side: "away" },
    ],
    { status }
  );
  const timeline = buildLiveTimeline(events, status);
  assert.deepEqual(defaultExpandedSegments(timeline, "second_half"), ["second_half"]);
  assert.deepEqual(defaultExpandedSegments(timeline, "first_half"), ["first_half"]);
});

/* ------------------------------------------------------------------ *
 * LiveMomentum
 * ------------------------------------------------------------------ */

test("momentum without timestamped events or statistics is unavailable, not flat", () => {
  const status = buildLiveMatchStatus(source());
  const events = buildLiveEvents([], { status });
  const momentum = buildLiveMomentum({
    events: events.items,
    statistics: buildLiveStatistics({ statistics: undefined }),
    status,
  });
  assert.equal(momentum.availability, "unavailable");
  assert.deepEqual(momentum.points, []);
  assert.equal(momentum.homeSharePct, null);
  assert.equal(momentum.leader, "neutral");
  assert.match(momentum.method, /unavailable/);
});

test("momentum buckets weight attacking events and expose observation counts", () => {
  const status = buildLiveMatchStatus(source({ status: "live", minute: 30 }));
  const events = buildLiveEvents(
    [
      { id: "c1", type: "corner", minute: 5, side: "home" },
      { id: "c2", type: "corner", minute: 9, side: "home" },
      { id: "g1", type: "goal", minute: 20, side: "away" },
    ],
    { status }
  );
  const points = buildMomentumPoints(events.items, status);
  assert.equal(points.length, 2);
  assert.equal(points[0].home, 100);
  assert.equal(points[0].eventCount, 2);
  assert.equal(points[0].coverage, "observed");
  assert.equal(points[1].away, 100);
  assert.equal(points[1].coverage, "sparse");
  assert.equal(points[1].swing, -100);
});

test("buckets with no observations are marked, never interpolated", () => {
  const status = buildLiveMatchStatus(source({ status: "live", minute: 44 }));
  const events = buildLiveEvents([{ id: "c1", type: "corner", minute: 3, side: "home" }], {
    status,
  });
  const points = buildMomentumPoints(events.items, status);
  assert.equal(points.length, 3);
  assert.equal(points[1].eventCount, 0);
  assert.equal(points[1].coverage, "none");
  assert.equal(points[1].home, 0);
  assert.equal(points[1].away, 0);
});

test("cards, substitutions and VAR carry no attacking pressure weight", () => {
  const status = buildLiveMatchStatus(source({ status: "live", minute: 30 }));
  const events = buildLiveEvents(
    [
      { id: "y1", type: "yellow card", minute: 5, side: "home" },
      { id: "s1", type: "substitution", minute: 6, side: "home" },
      { id: "v1", type: "VAR", minute: 7, side: "away" },
    ],
    { status }
  );
  assert.deepEqual(buildMomentumPoints(events.items, status), []);
});

test("overall momentum share is weighted from statistics and names its inputs", () => {
  const statistics = buildLiveStatistics({
    statistics: {
      expected_goals: { home: 1.8, away: 0.2 },
      shots_on_target: { home: 6, away: 1 },
      possession: { home: 60, away: 40 },
    },
  });
  const share = statisticsPressureShare(statistics);
  assert.ok(share.homePct !== null && share.homePct > 70, `unexpected share ${share.homePct}`);
  assert.ok(share.inputs.includes("expected goals (xg)"));

  const status = buildLiveMatchStatus(source());
  const momentum = buildLiveMomentum({ events: [], statistics, status });
  assert.equal(momentum.availability, "empty");
  assert.equal(momentum.leader, "home");
  assert.match(momentum.method, /overall share weighted from/);
});

test("a balanced reading inside the deadband reports no leader", () => {
  const statistics = buildLiveStatistics({
    statistics: { possession: { home: 51, away: 49 } },
  });
  const status = buildLiveMatchStatus(source());
  const momentum = buildLiveMomentum({ events: [], statistics, status });
  assert.equal(momentum.leader, "neutral");
  assert.ok(Math.abs((momentum.homeSharePct ?? 0) - 50) < LIVE_MOMENTUM_DEADBAND_PCT);
});

/* ------------------------------------------------------------------ *
 * Snapshot + adapter
 * ------------------------------------------------------------------ */

test("snapshot composition is deterministic for a fixed clock", () => {
  const input = source({
    events: [{ id: "g1", type: "goal", minute: 12, side: "home", label: "Smith" }],
    statistics: { possession: { home: 55, away: 45 } },
  });
  assert.equal(
    stableStringify(buildLiveMatchSnapshot(input)),
    stableStringify(buildLiveMatchSnapshot(input))
  );
});

test("only an in-play snapshot is renderable", () => {
  assert.equal(isRenderableLiveSnapshot(buildLiveMatchSnapshot(source())), true);
  assert.equal(
    isRenderableLiveSnapshot(buildLiveMatchSnapshot(source({ status: "complete" }))),
    false
  );
  assert.equal(isRenderableLiveSnapshot(null), false);
  assert.equal(isRenderableLiveSnapshot(undefined), false);
});

test("the provider adapter maps statistics without overstating bookings", () => {
  const mapped = liveSourceFromMatchContext(
    {
      matchId: 42,
      status: "live",
      homeTeam: "Home FC",
      awayTeam: "Away United",
      competition: "Premier League",
      country: "England",
      venue: null,
      kickoffUnix: NOW - 1800,
      homeScore: 1,
      awayScore: 0,
      htHome: null,
      htAway: null,
      minute: 30,
      possessionHome: 60,
      possessionAway: 40,
      shotsHome: 8,
      shotsAway: 3,
      shotsOnTargetHome: 4,
      shotsOnTargetAway: 1,
      xgHome: 1.2,
      xgAway: 0.3,
      cornersHome: 5,
      cornersAway: 2,
      cardsHome: 2,
      cardsAway: 1,
      dangerousAttacksHome: 30,
      dangerousAttacksAway: 12,
      events: [
        { id: "e1", type: "goal", minute: 12, team: "home", label: "Smith" },
        { id: "e2", type: "red_card", minute: 28, team: "away", label: "Jones" },
      ],
      potentials: { over15: 70, over25: 50, fh05: 60, sh05: 60, btts: 40 },
      fetchedAt: new Date(NOW * 1000).toISOString(),
    },
    { nowSec: NOW }
  );

  assert.equal(mapped.statistics?.possession?.home, 60);
  assert.equal(mapped.statistics?.expected_goals?.away, 0.3);
  // Combined card counts must not be presented as yellow cards.
  assert.equal(mapped.statistics?.yellow_cards, undefined);
  assert.equal(mapped.statistics?.red_cards, undefined);
  assert.equal(mapped.events?.length, 2);

  const snapshot = buildLiveMatchSnapshot(mapped);
  assert.equal(snapshot.status.isLive, true);
  assert.equal(snapshot.timeline.totalEvents > 0, true);
});

/* ------------------------------------------------------------------ *
 * Incremental updates — the performance contract
 * ------------------------------------------------------------------ */

function snapshotWith(overrides: Partial<LiveMatchSource> = {}): LiveMatchSnapshot {
  return buildLiveMatchSnapshot(source(overrides));
}

test("an update that changes nothing returns the previous snapshot object itself", () => {
  const previous = snapshotWith();
  const result = applyLiveUpdate(previous, snapshotWith());
  assert.equal(result.snapshot, previous);
  assert.deepEqual(result.changed, []);
  assert.equal(result.snapshot.revision, previous.revision);
});

test("a poll that only moves the observation time is not a change", () => {
  const previous = snapshotWith();
  const later = snapshotWith({
    fetchedAt: new Date((NOW + 30) * 1000).toISOString(),
    nowSec: NOW + 30,
  });
  const result = applyLiveUpdate(previous, later);
  assert.deepEqual(result.changed, []);
  assert.equal(result.snapshot, previous);
});

test("changed slices are replaced and unchanged slices keep their identity", () => {
  const previous = snapshotWith({
    statistics: { possession: { home: 50, away: 50 } },
  });
  const next = snapshotWith({
    statistics: { possession: { home: 70, away: 30 } },
  });
  const result = applyLiveUpdate(previous, next);

  assert.ok(result.changed.includes("statistics"));
  assert.ok(result.changed.includes("momentum"));
  assert.equal(result.snapshot.statistics, next.statistics);
  // Nothing about the clock, the score or the event feed moved, so those subtrees must not
  // re-render: identity is the mechanism React uses to bail out.
  assert.equal(result.snapshot.status, previous.status);
  assert.equal(result.snapshot.events, previous.events);
  assert.equal(result.snapshot.timeline, previous.timeline);
  assert.equal(result.snapshot.revision, previous.revision + 1);
});

test("a goal changes exactly the slices that depend on it", () => {
  const previous = snapshotWith({ statistics: { possession: { home: 50, away: 50 } } });
  const next = snapshotWith({
    statistics: { possession: { home: 50, away: 50 } },
    homeScore: 3,
    events: [{ id: "g9", type: "goal", minute: 70, side: "home", label: "Smith" }],
  });
  const result = applyLiveUpdate(previous, next);
  assert.ok(result.changed.includes("status"));
  assert.ok(result.changed.includes("events"));
  assert.ok(result.changed.includes("timeline"));
  assert.equal(result.snapshot.statistics, previous.statistics);
});

test("a different fixture is adopted wholesale and announces nothing", () => {
  const previous = snapshotWith();
  const other = snapshotWith({ matchId: 999 });
  const result = applyLiveUpdate(previous, other);
  assert.deepEqual(result.changed, [...LIVE_SLICE_KEYS]);
  assert.deepEqual(result.announcements, []);
  assert.equal(result.snapshot.revision, 1);
});

test("stable stringify ignores key order and honours omitted fields", () => {
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  assert.equal(
    stableStringify({ a: 1, updatedAt: "x" }, ["updatedAt"]),
    stableStringify({ a: 1, updatedAt: "y" }, ["updatedAt"])
  );
});

/* ------------------------------------------------------------------ *
 * Announcements
 * ------------------------------------------------------------------ */

test("a goal is announced assertively with the resulting score", () => {
  const previous = snapshotWith({ homeScore: 1, awayScore: 1, events: [] });
  const next = snapshotWith({
    homeScore: 2,
    awayScore: 1,
    events: [{ id: "g9", type: "goal", minute: 70, side: "home", label: "Smith" }],
  });
  const announcements = buildLiveAnnouncements(previous, next);
  assert.equal(announcements[0].priority, "assertive");
  assert.match(announcements[0].message, /Goal for Home FC/);
  assert.match(announcements[0].message, /Home FC 2, Away United 1/);
});

test("bookings and substitutions are polite, corners are not announced at all", () => {
  const previous = snapshotWith({ events: [] });
  const next = snapshotWith({
    events: [
      { id: "y1", type: "yellow card", minute: 65, side: "away", label: "Jones" },
      { id: "s1", type: "substitution", minute: 66, side: "home", label: "Brown on" },
      { id: "c1", type: "corner", minute: 67, side: "home" },
    ],
  });
  const announcements = buildLiveAnnouncements(previous, next);
  assert.equal(announcements.length, 2);
  assert.ok(announcements.every((entry) => entry.priority === "polite"));
  assert.ok(!announcements.some((entry) => entry.message.includes("Corner")));
});

test("a score change with no matching event still reaches the live region", () => {
  const previous = snapshotWith({ homeScore: 0, awayScore: 0, events: [] });
  const next = snapshotWith({ homeScore: 1, awayScore: 0, events: [] });
  const announcements = buildLiveAnnouncements(previous, next);
  assert.equal(announcements.length, 1);
  assert.equal(announcements[0].priority, "assertive");
  assert.match(announcements[0].message, /Score update/);
});

test("announcements are capped so a catch-up burst cannot spam a screen reader", () => {
  const previous = snapshotWith({ events: [] });
  const events: LiveEventInput[] = Array.from({ length: 9 }, (_, index) => ({
    id: `g${index}`,
    type: "goal",
    minute: 10 + index,
    side: index % 2 === 0 ? "home" : "away",
  }));
  const next = snapshotWith({ events });
  assert.equal(buildLiveAnnouncements(previous, next).length, 4);
});

test("no announcements are produced for a first snapshot", () => {
  assert.deepEqual(buildLiveAnnouncements(null, snapshotWith()), []);
});

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

test("store notifies subscribers only when a slice actually changed", () => {
  const store = createLiveStore(snapshotWith());
  const seen: LiveUpdateResult[] = [];
  const unsubscribe = store.subscribe((result) => seen.push(result));

  store.apply(snapshotWith());
  assert.equal(seen.length, 0, "no-op update must not notify");

  store.apply(snapshotWith({ homeScore: 5 }));
  assert.equal(seen.length, 1);
  assert.ok(seen[0].changed.includes("status"));

  unsubscribe();
  store.apply(snapshotWith({ homeScore: 6 }));
  assert.equal(seen.length, 1, "unsubscribed listener must not be called");
});

test("store exposes slices and keeps a bounded announcement buffer", () => {
  const store = createLiveStore(snapshotWith({ events: [] }));
  assert.equal(store.getSlice("statistics"), store.getSnapshot().statistics);

  for (let index = 0; index < LIVE_ANNOUNCEMENT_BUFFER + 4; index += 1) {
    store.apply(
      snapshotWith({
        homeScore: index + 1,
        events: [{ id: `g${index}`, type: "goal", minute: 10 + index, side: "home" }],
      })
    );
  }
  assert.ok(store.getAnnouncements().length <= LIVE_ANNOUNCEMENT_BUFFER);
});

test("a throwing subscriber does not stop the others", () => {
  const store = createLiveStore(snapshotWith());
  let reached = false;
  store.subscribe(() => {
    throw new Error("boom");
  });
  store.subscribe(() => {
    reached = true;
  });
  store.apply(snapshotWith({ homeScore: 4 }));
  assert.equal(reached, true);
});

/* ------------------------------------------------------------------ *
 * Analytics + sprint isolation regression
 * ------------------------------------------------------------------ */

test("live analytics events are registered", () => {
  for (const name of [
    "live_section_viewed",
    "live_timeline_expanded",
    "live_statistics_expanded",
    "live_momentum_viewed",
  ]) {
    assert.ok(analyticsEventNames.includes(name as never), `missing event ${name}`);
  }
});

test("the live domain does not reach into affiliate, operator or ranking code", () => {
  const files = [
    "lib/live/adapter.ts",
    "lib/live/analytics.ts",
    "lib/live/announce.ts",
    "lib/live/context.ts",
    "lib/live/diff.ts",
    "lib/live/events.ts",
    "lib/live/momentum.ts",
    "lib/live/paths.ts",
    "lib/live/rateLimit.ts",
    "lib/live/server.ts",
    "lib/live/snapshot.ts",
    "lib/live/statistics.ts",
    "lib/live/status.ts",
    "lib/live/store.ts",
    "lib/live/timeline.ts",
  ];
  for (const rel of files) {
    const contents = readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(contents, /lib\/affiliate/, rel);
    assert.doesNotMatch(contents, /lib\/operators/, rel);
    assert.doesNotMatch(contents, /lib\/ranking|lib\/go\b/, rel);
    assert.doesNotMatch(
      contents,
      /buildGoPath|signAffiliateOffers|resolveAffiliateOffers|operator_card_|operator_click|operator_impression/,
      rel
    );
  }
  // The live analytics module must still explicitly null the operator dimension, so live
  // engagement can never be misread as operator engagement downstream.
  const analytics = readFileSync(path.join(root, "lib/live/analytics.ts"), "utf8");
  assert.equal((analytics.match(/operator_slug: null/g) ?? []).length, 4);
});

test("only lib/live/server.ts is server-bound; the rest stays browser-safe", () => {
  const serverModule = readFileSync(path.join(root, "lib/live/server.ts"), "utf8");
  assert.match(serverModule, /import ["']server-only["']/);

  for (const rel of [
    "lib/live/snapshot.ts",
    "lib/live/diff.ts",
    "lib/live/events.ts",
    "lib/live/momentum.ts",
    "lib/live/statistics.ts",
    "lib/live/status.ts",
    "lib/live/timeline.ts",
    "lib/live/store.ts",
    "lib/live/rateLimit.ts",
  ]) {
    const contents = readFileSync(path.join(root, rel), "utf8");
    assert.doesNotMatch(contents, /server-only/, rel);
    assert.doesNotMatch(contents, /node:crypto|node:fs/, rel);
  }
});
