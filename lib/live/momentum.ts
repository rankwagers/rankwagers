/**
 * Sprint 22 — LiveMomentum.
 *
 * Momentum is *derived*, never provider-reported. This module therefore does three things
 * the rest of the live layer does not have to:
 *
 *  1. It computes from observations only — timestamped events for the graph, cumulative
 *     statistics for the overall reading. Nothing is interpolated across empty buckets.
 *  2. It publishes a `method` string naming the exact inputs used, so the UI can state how a
 *     reading was produced instead of presenting it as a fact.
 *  3. It refuses to produce a graph at all when there is no timestamped evidence, rather than
 *     drawing a flat line that looks like "both teams equal".
 *
 * Pure module.
 */

import type {
  LiveEvent,
  LiveEventType,
  LiveMatchStatus,
  LiveMomentum,
  LiveMomentumCoverage,
  LiveMomentumPoint,
  LiveStatistics,
  LiveTeamSide,
} from "@/types/live";

/**
 * Attacking-pressure weights. A goal dominates its bucket; corners and dangerous attacks are
 * territory signals worth far less. Types with weight 0 carry no pressure meaning and are
 * excluded from the calculation entirely (they still appear on the timeline).
 */
export const LIVE_MOMENTUM_EVENT_WEIGHT: Record<LiveEventType, number> = {
  goal: 30,
  penalty: 18,
  red_card: 0,
  yellow_card: 0,
  var: 0,
  corner: 5,
  dangerous_attack: 3,
  substitution: 0,
  kickoff: 0,
  halftime: 0,
  fulltime: 0,
};

/** Bucket width in minutes. 15 keeps a 90-minute match to six readable columns. */
export const LIVE_MOMENTUM_BUCKET_MINUTES = 15;

/** Below this absolute deviation from 50% the reading is reported as neutral, not a leader. */
export const LIVE_MOMENTUM_DEADBAND_PCT = 5;

function bucketLabel(from: number, to: number): string {
  return `${from}–${to}'`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Upper minute bound for bucketing. Uses the observed clock and the latest observed event so
 * a finished match still renders its full timeline, and a 12th-minute match renders one
 * bucket rather than six empty ones.
 */
function resolveHorizon(status: LiveMatchStatus, events: LiveEvent[]): number {
  const lastEventMinute = events.reduce(
    (max, event) => (event.minute != null && event.minute > max ? event.minute : max),
    0
  );
  const clock = status.minute ?? 0;
  const observed = Math.max(lastEventMinute, clock);
  if (status.phase === "full_time") return Math.max(90, observed);
  if (status.phase === "half_time") return Math.max(45, observed);
  return Math.max(LIVE_MOMENTUM_BUCKET_MINUTES, observed);
}

export function buildMomentumPoints(
  events: LiveEvent[],
  status: LiveMatchStatus
): LiveMomentumPoint[] {
  const weighted = events.filter(
    (event) =>
      event.minute != null &&
      event.side !== "neutral" &&
      LIVE_MOMENTUM_EVENT_WEIGHT[event.type] > 0
  );
  if (!weighted.length) return [];

  const horizon = resolveHorizon(status, events);
  const bucketCount = Math.max(
    1,
    Math.ceil(horizon / LIVE_MOMENTUM_BUCKET_MINUTES)
  );

  const points: LiveMomentumPoint[] = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const fromMinute = index * LIVE_MOMENTUM_BUCKET_MINUTES + (index === 0 ? 0 : 1);
    const toMinute = (index + 1) * LIVE_MOMENTUM_BUCKET_MINUTES;
    const inBucket = weighted.filter((event) => {
      const minute = event.minute as number;
      return minute >= fromMinute && minute <= toMinute;
    });

    let homeWeight = 0;
    let awayWeight = 0;
    for (const event of inBucket) {
      const weight = LIVE_MOMENTUM_EVENT_WEIGHT[event.type];
      if (event.side === "home") homeWeight += weight;
      else awayWeight += weight;
    }

    const total = homeWeight + awayWeight;
    const home = total > 0 ? round((homeWeight / total) * 100) : 0;
    const away = total > 0 ? round(100 - home) : 0;
    const coverage: LiveMomentumCoverage =
      total === 0 ? "none" : inBucket.length === 1 ? "sparse" : "observed";

    points.push({
      fromMinute,
      toMinute,
      label: bucketLabel(fromMinute, toMinute),
      home,
      away,
      swing: total > 0 ? round(home - away) : 0,
      eventCount: inBucket.length,
      coverage,
    });
  }
  return points;
}

/**
 * Overall pressure share from cumulative statistics. Returns `null` when no weighted
 * statistic pair is available — the caller must not fall back to 50/50.
 */
export function statisticsPressureShare(statistics: LiveStatistics): {
  homePct: number | null;
  inputs: string[];
} {
  const weights: Record<string, number> = {
    expected_goals: 6,
    shots_on_target: 4,
    shots: 2,
    corners: 2,
    dangerous_attacks: 1,
    possession: 1,
  };
  let homeWeighted = 0;
  let totalWeight = 0;
  const inputs: string[] = [];

  for (const item of statistics.items) {
    const weight = weights[item.key];
    if (!weight || item.homeShare == null) continue;
    homeWeighted += item.homeShare * weight;
    totalWeight += weight;
    inputs.push(item.label.toLowerCase());
  }

  if (totalWeight === 0) return { homePct: null, inputs: [] };
  return { homePct: round((homeWeighted / totalWeight) * 100), inputs };
}

function leaderFor(homePct: number | null): LiveTeamSide {
  if (homePct == null) return "neutral";
  if (Math.abs(homePct - 50) < LIVE_MOMENTUM_DEADBAND_PCT) return "neutral";
  return homePct > 50 ? "home" : "away";
}

export function buildLiveMomentum(input: {
  events: LiveEvent[];
  statistics: LiveStatistics;
  status: LiveMatchStatus;
}): LiveMomentum {
  const points = buildMomentumPoints(input.events, input.status);
  const fromStats = statisticsPressureShare(input.statistics);

  const pointsWithWeight = points.filter((point) => point.eventCount > 0);
  const eventHomePct = pointsWithWeight.length
    ? round(
        pointsWithWeight.reduce((sum, point) => sum + point.home, 0) /
          pointsWithWeight.length
      )
    : null;

  // Prefer statistics for the overall reading (they are cumulative and less spiky); fall back
  // to the event-derived average when the feed carries events but no statistics.
  const homeSharePct = fromStats.homePct ?? eventHomePct;

  const methodParts: string[] = [];
  if (points.length) {
    methodParts.push(
      `graph from ${pointsWithWeight.reduce((sum, point) => sum + point.eventCount, 0)} timestamped attacking events in ${LIVE_MOMENTUM_BUCKET_MINUTES}-minute buckets`
    );
  }
  if (fromStats.inputs.length) {
    methodParts.push(`overall share weighted from ${fromStats.inputs.join(", ")}`);
  }
  const method = methodParts.length
    ? `Derived: ${methodParts.join("; ")}.`
    : "Derived momentum is unavailable: no timestamped attacking events or comparable statistics were reported.";

  if (!points.length && homeSharePct == null) {
    return {
      availability: "unavailable",
      points: [],
      leader: "neutral",
      homeSharePct: null,
      method,
      message:
        "Momentum needs timestamped attacking events or comparable in-play statistics; neither is available for this fixture.",
    };
  }

  if (!points.length) {
    return {
      availability: "empty",
      points: [],
      leader: leaderFor(homeSharePct),
      homeSharePct,
      method,
      message:
        "No timestamped attacking events yet — the overall reading below is derived from cumulative statistics only.",
    };
  }

  return {
    availability: "available",
    points,
    leader: leaderFor(homeSharePct),
    homeSharePct,
    method,
    message: null,
  };
}
