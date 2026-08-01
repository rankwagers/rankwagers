/**
 * Sprint 22 — LiveStatistics.
 *
 * Normalises the in-play statistic pairs the feed reports. Missing pairs are kept out of the
 * rendered table entirely (rather than shown as `0 – 0`, which reads as a measurement) and
 * are summarised in the section message so the omission is visible.
 *
 * Pure module.
 */

import type {
  LiveAvailability,
  LiveMatchSource,
  LiveStatistic,
  LiveStatisticInput,
  LiveStatisticKey,
  LiveStatisticUnit,
  LiveStatistics,
} from "@/types/live";

type StatDefinition = {
  key: LiveStatisticKey;
  label: string;
  unit: LiveStatisticUnit;
  /** Higher is better for the side holding it — used for the momentum weighting. */
  pressureWeight: number;
};

/**
 * Display order is deliberate: possession and shots first because they are the statistics
 * bettors read against in-play goal markets, discipline last.
 */
export const LIVE_STATISTIC_DEFINITIONS: readonly StatDefinition[] = [
  { key: "possession", label: "Possession", unit: "percent", pressureWeight: 1 },
  { key: "shots", label: "Shots", unit: "count", pressureWeight: 2 },
  { key: "shots_on_target", label: "Shots on target", unit: "count", pressureWeight: 4 },
  { key: "expected_goals", label: "Expected goals (xG)", unit: "xg", pressureWeight: 6 },
  { key: "corners", label: "Corners", unit: "count", pressureWeight: 2 },
  { key: "dangerous_attacks", label: "Dangerous attacks", unit: "count", pressureWeight: 1 },
  { key: "yellow_cards", label: "Yellow cards", unit: "count", pressureWeight: 0 },
  { key: "red_cards", label: "Red cards", unit: "count", pressureWeight: 0 },
] as const;

export const LIVE_STATISTIC_KEYS: readonly LiveStatisticKey[] =
  LIVE_STATISTIC_DEFINITIONS.map((definition) => definition.key);

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Home share of the pair, 0..1. Returns `null` when either side is missing or the pair sums
 * to zero — a 50/50 bar drawn from `0 – 0` would imply a measurement that does not exist.
 */
export function homeShareOf(home: number | null, away: number | null): number | null {
  if (home == null || away == null) return null;
  const total = home + away;
  if (total <= 0) return null;
  return home / total;
}

export function formatLiveStatValue(
  value: number | null,
  unit: LiveStatisticUnit
): string {
  if (value == null) return "—";
  switch (unit) {
    case "percent":
      return `${Math.round(value)}%`;
    case "xg":
      return value.toFixed(2);
    default:
      return String(Math.round(value));
  }
}

export function buildLiveStatistics(
  source: Pick<LiveMatchSource, "statistics">
): LiveStatistics {
  const provided = source.statistics;
  const hasFeed = provided != null && typeof provided === "object";

  const items: LiveStatistic[] = [];
  const missing: string[] = [];

  for (const definition of LIVE_STATISTIC_DEFINITIONS) {
    const raw: LiveStatisticInput | undefined = hasFeed ? provided[definition.key] : undefined;
    const home = num(raw?.home);
    const away = num(raw?.away);
    const availability: LiveAvailability =
      home == null && away == null ? "unavailable" : "available";
    if (availability === "unavailable") {
      missing.push(definition.label);
      continue;
    }
    items.push({
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      home,
      away,
      availability,
      homeShare: homeShareOf(home, away),
    });
  }

  if (!items.length) {
    return {
      availability: hasFeed ? "empty" : "unavailable",
      items: [],
      message: hasFeed
        ? "The provider has not reported in-play statistics for this fixture yet."
        : "The provider does not expose in-play statistics for this fixture.",
    };
  }

  return {
    availability: "available",
    items,
    message: missing.length
      ? `Not reported by the provider: ${missing.join(", ")}.`
      : null,
  };
}

/** Pressure weights keyed for reuse by the momentum module. */
export const LIVE_STATISTIC_PRESSURE_WEIGHT: Record<LiveStatisticKey, number> =
  LIVE_STATISTIC_DEFINITIONS.reduce(
    (acc, definition) => {
      acc[definition.key] = definition.pressureWeight;
      return acc;
    },
    {} as Record<LiveStatisticKey, number>
  );
