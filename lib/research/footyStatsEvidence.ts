import type { MatchDetailPublic, MarketHitStat } from "@/lib/footystats/matchDetail";
import type { MatchListKind } from "@/lib/footystats/types";
import { FH_OVER_05_THRESHOLD, OVER_15_THRESHOLD, OVER_25_THRESHOLD, SH_OVER_05_THRESHOLD } from "@/lib/footystats/config";

export type DataCoverageLevel = "full" | "partial" | "minimal" | "unsupported";
export type EvidenceStatus = "supporting" | "counter" | "neutral" | "unavailable";

export type ResearchMetric = {
  id: string;
  group: "market-profile" | "goal-environment" | "sample-quality";
  label: string;
  value: number;
  displayValue: string;
  sampleLabel: string;
  interpretation: string;
  sampleQuality: "very-limited" | "limited" | "adequate";
  split: "home" | "away";
  provenance: { provider: "footystats"; endpoint: "team"; field: string; retrievedAt: string };
  status: EvidenceStatus;
};

export type FootyStatsFixtureResearch = {
  coverage: DataCoverageLevel;
  marketMetrics: ResearchMetric[];
  limitations: string[];
  counterEvidence: ResearchMetric[];
  summary: string[];
  qualification?: {
    threshold: number;
    difference: number;
    strongestFactor?: string;
    weakestFactor?: string;
    confidenceLabel: string;
  };
};

export function normalizePercentage(
  value: unknown,
  sourceScale: "zero-to-one" | "zero-to-one-hundred"
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return null;
  const normalized = sourceScale === "zero-to-one" ? numeric * 100 : numeric;
  if (normalized < 0 || normalized > 100) return null;
  return normalized;
}

const MARKET_FIELD: Record<MatchListKind, { key: "over15" | "over25" | "fh05" | "sh05"; label: string; field: string; threshold: number }> = {
  fh: { key: "fh05", label: "First-half Over 0.5 rate", field: "seasonOver05PercentageHT_{venue}", threshold: FH_OVER_05_THRESHOLD },
  over15: { key: "over15", label: "Over 1.5 rate", field: "seasonOver15Percentage_{venue}", threshold: OVER_15_THRESHOLD },
  over25: { key: "over25", label: "Over 2.5 rate", field: "seasonOver25Percentage_{venue}", threshold: OVER_25_THRESHOLD },
  sh: { key: "sh05", label: "Second-half Over 0.5 rate", field: "over05_2hg_percentage_{venue}", threshold: SH_OVER_05_THRESHOLD },
};

function toMetric(
  id: string,
  group: ResearchMetric["group"],
  label: string,
  stat: MarketHitStat,
  split: "home" | "away",
  sourceField: string,
  retrievedAt: string,
  teamName: string,
  status: EvidenceStatus = "neutral"
): ResearchMetric | null {
  if (!Number.isFinite(stat.pct) || stat.played <= 0) return null;
  return {
    id,
    group,
    label,
    value: stat.pct,
    displayValue: `${stat.pct}%`,
    sampleLabel: `${stat.hits} of ${stat.played} ${split} matches`,
    interpretation: `${teamName} recorded this outcome in ${stat.hits} of ${stat.played} ${split} league matches.`,
    sampleQuality: stat.played < 3 ? "very-limited" : stat.played < 6 ? "limited" : "adequate",
    split,
    provenance: { provider: "footystats", endpoint: "team", field: sourceField, retrievedAt },
    status,
  };
}

function toAverageMetric(
  id: string,
  label: string,
  value: number | undefined,
  split: "home" | "away",
  sample: number,
  field: string,
  group: ResearchMetric["group"],
  retrievedAt: string,
  unit = "",
  teamName: string,
  status: EvidenceStatus = "neutral"
): ResearchMetric | null {
  if (value === undefined || !Number.isFinite(value) || sample <= 0) return null;
  return {
    id,
    group,
    label,
    value,
    displayValue: `${value.toFixed(2)}${unit}`,
    sampleLabel: `${sample} ${split} matches`,
    interpretation: `${teamName} averaged ${value.toFixed(2)}${unit} across ${sample} ${split} league matches.`,
    sampleQuality: sample < 3 ? "very-limited" : sample < 6 ? "limited" : "adequate",
    split,
    provenance: { provider: "footystats", endpoint: "team", field, retrievedAt },
    status,
  };
}

/** Maps only verified fields from `match` + `team` responses; no inferred data. */
export function mapFootyStatsEvidence(
  detail: MatchDetailPublic | undefined,
  market: MatchListKind
): FootyStatsFixtureResearch {
  if (!detail) {
    return {
      coverage: "minimal",
      marketMetrics: [],
      counterEvidence: [],
      limitations: ["Match research data could not be loaded for this fixture."],
      summary: [],
    };
  }
  const field = MARKET_FIELD[market];
  const retrievedAt = new Date().toISOString();
  const home = toMetric("home-market-rate", "market-profile", `${field.label} at home`, detail.homeAtHome[field.key], "home", field.field.replace("{venue}", "home"), retrievedAt, detail.homeTeam);
  const away = toMetric("away-market-rate", "market-profile", `${field.label} away`, detail.awayAtAway[field.key], "away", field.field.replace("{venue}", "away"), retrievedAt, detail.awayTeam);
  const metrics = [home, away];
  if (market === "over15" || market === "over25") {
    metrics.push(
      toMetric("home-btts", "goal-environment", "Both teams scored at home", detail.homeAtHome.btts, "home", "seasonBTTSPercentage_home", retrievedAt, detail.homeTeam),
      toMetric("away-btts", "goal-environment", "Both teams scored away", detail.awayAtAway.btts, "away", "seasonBTTSPercentage_away", retrievedAt, detail.awayTeam),
      toAverageMetric("home-goals", "Goals scored at home", detail.homeAtHome.scoredAvg, "home", detail.homeAtHome.played, "seasonScoredAVG_home", "goal-environment", retrievedAt, "", detail.homeTeam),
      toAverageMetric("away-goals", "Goals scored away", detail.awayAtAway.scoredAvg, "away", detail.awayAtAway.played, "seasonScoredAVG_away", "goal-environment", retrievedAt, "", detail.awayTeam),
      toAverageMetric("home-xg", "Expected goals at home", detail.homeAtHome.xgFor, "home", detail.homeAtHome.played, "xg_for_avg_home", "goal-environment", retrievedAt, " xG", detail.homeTeam),
      toAverageMetric("away-xg", "Expected goals away", detail.awayAtAway.xgFor, "away", detail.awayAtAway.played, "xg_for_avg_away", "goal-environment", retrievedAt, " xG", detail.awayTeam)
    );
  }
  const availableMetrics = metrics.filter((value): value is ResearchMetric => value !== null);
  const counterMetrics: ResearchMetric[] = [];
  if (market === "over15" || market === "over25") {
    const homeCleanSheets = toMetric("home-clean-sheets", "goal-environment", "Home clean-sheet rate", detail.homeAtHome.cleanSheets, "home", "seasonCSPercentage_home", retrievedAt, detail.homeTeam, "counter");
    const awayCleanSheets = toMetric("away-clean-sheets", "goal-environment", "Away clean-sheet rate", detail.awayAtAway.cleanSheets, "away", "seasonCSPercentage_away", retrievedAt, detail.awayTeam, "counter");
    const homeFailedToScore = toMetric("home-failed-to-score", "goal-environment", "Home failed-to-score rate", detail.homeAtHome.failedToScore, "home", "seasonFTSPercentage_home", retrievedAt, detail.homeTeam, "counter");
    const awayFailedToScore = toMetric("away-failed-to-score", "goal-environment", "Away failed-to-score rate", detail.awayAtAway.failedToScore, "away", "seasonFTSPercentage_away", retrievedAt, detail.awayTeam, "counter");
    for (const candidate of [homeCleanSheets, awayCleanSheets, homeFailedToScore, awayFailedToScore]) {
      if (candidate && candidate.value >= 50) counterMetrics.push(candidate);
    }
  }
  const limitations: string[] = [];
  if (!home) limitations.push(`Home ${field.label.toLowerCase()} data is unavailable.`);
  if (!away) limitations.push(`Away ${field.label.toLowerCase()} data is unavailable.`);
  if (home && home.sampleLabel.startsWith("0 of")) limitations.push("The home split has no recorded matches.");
  if (away && away.sampleLabel.startsWith("0 of")) limitations.push("The away split has no recorded matches.");
  const smallestSample = Math.min(...availableMetrics.map((metric) => Number(metric.sampleLabel.match(/of (\d+)/)?.[1] ?? metric.sampleLabel.match(/^(\d+)/)?.[1] ?? 0)));
  if (smallestSample > 0 && smallestSample < 3) limitations.push("At least one venue-specific sample contains fewer than three matches.");
  if ((market === "over15" || market === "over25") && (!detail.homeAtHome.xgFor || !detail.awayAtAway.xgFor)) {
    limitations.push("Expected-goals data is unavailable for one or both team venue profiles.");
  }
  const providerProbability = detail.matchPotential[field.key];
  const summary: string[] = [];
  if (Number.isFinite(providerProbability)) {
    const difference = providerProbability - field.threshold;
    summary.push(
      difference >= 0
        ? `Market probability clears the qualification threshold by ${Math.round(difference)} percentage points.`
        : `Market probability is ${Math.round(Math.abs(difference))} percentage points below the qualification threshold.`
    );
  }
  if (home && away) {
    const difference = Math.abs(home.value - away.value);
    summary.push(
      difference < 3
        ? "The home and away venue profiles are statistically aligned."
        : `${home.value > away.value ? "Home" : "Away"} venue profile is higher by ${Math.round(difference)} percentage points.`
    );
  }
  if (smallestSample > 0) {
    summary.push(
      smallestSample < 3
        ? `Sample reliability is very limited: the smallest venue sample contains ${smallestSample} matches.`
        : `Venue-specific sample coverage is based on at least ${smallestSample} matches.`
    );
  }
  return {
    coverage: availableMetrics.length >= 4 ? "full" : availableMetrics.length === 2 ? "partial" : availableMetrics.length ? "minimal" : "unsupported",
    marketMetrics: availableMetrics,
    counterEvidence: counterMetrics,
    limitations,
    summary,
    qualification: Number.isFinite(providerProbability)
      ? {
          threshold: field.threshold,
          difference: providerProbability - field.threshold,
          strongestFactor: [...availableMetrics]
            .filter((metric) => metric.group === "market-profile")
            .sort((a, b) => b.value - a.value)[0]?.label,
          weakestFactor: [...availableMetrics]
            .sort((a, b) => Number(a.sampleLabel.match(/of (\d+)/)?.[1] ?? a.sampleLabel.match(/^(\d+)/)?.[1] ?? 0) - Number(b.sampleLabel.match(/of (\d+)/)?.[1] ?? b.sampleLabel.match(/^(\d+)/)?.[1] ?? 0))[0]?.sampleLabel,
          confidenceLabel:
            smallestSample < 3
              ? "Very limited venue evidence"
              : smallestSample < 6
                ? "Limited venue evidence"
                : "Strong venue evidence",
        }
      : undefined,
  };
}
