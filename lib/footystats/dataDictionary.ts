export type FootyStatsFieldDefinition = {
  key: string;
  endpoint: "todays-matches" | "match" | "team" | "league-matches";
  semanticName: string;
  category: "identity" | "prediction" | "over-under" | "first-half" | "second-half" | "btts" | "goals" | "clean-sheet" | "failed-to-score" | "xg" | "form" | "standings" | "shots" | "corners" | "cards" | "timing" | "sample";
  unit: "percentage" | "count" | "goals" | "xg" | "rate" | "position" | "text" | "timestamp";
  sourceScale?: "zero-to-one-hundred";
  scope: "fixture" | "team-season" | "league-season";
  split: "home" | "away" | "unknown";
  preMatchSafe: boolean;
  publicLabel: string;
  destination: "fixture-row" | "expanded-summary" | "team-comparison" | "deep-record" | "internal-only";
};

/**
 * Verified against sanitized `match` and `team` responses on 2026-07-24.
 * This is internal data-lineage metadata and must never be rendered directly.
 */
export const footyStatsDataDictionary = [
  { key: "o15_potential", endpoint: "match", semanticName: "over 1.5 market probability", category: "prediction", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "fixture", split: "unknown", preMatchSafe: true, publicLabel: "Market probability", destination: "fixture-row" },
  { key: "o25_potential", endpoint: "match", semanticName: "over 2.5 market probability", category: "prediction", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "fixture", split: "unknown", preMatchSafe: true, publicLabel: "Market probability", destination: "fixture-row" },
  { key: "o05HT_potential", endpoint: "match", semanticName: "first-half over 0.5 market probability", category: "prediction", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "fixture", split: "unknown", preMatchSafe: true, publicLabel: "Market probability", destination: "fixture-row" },
  { key: "o05_2H_potential", endpoint: "match", semanticName: "second-half over 0.5 market probability", category: "prediction", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "fixture", split: "unknown", preMatchSafe: true, publicLabel: "Market probability", destination: "fixture-row" },
  { key: "seasonMatchesPlayed_{split}", endpoint: "team", semanticName: "season split sample", category: "sample", unit: "count", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "League matches", destination: "expanded-summary" },
  { key: "seasonOver15Percentage_{split}", endpoint: "team", semanticName: "over 1.5 rate", category: "over-under", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Over 1.5 rate", destination: "team-comparison" },
  { key: "seasonOver25Percentage_{split}", endpoint: "team", semanticName: "over 2.5 rate", category: "over-under", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Over 2.5 rate", destination: "team-comparison" },
  { key: "seasonOver05PercentageHT_{split}", endpoint: "team", semanticName: "first-half over 0.5 rate", category: "first-half", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "First-half goal occurrence", destination: "team-comparison" },
  { key: "over05_2hg_percentage_{split}", endpoint: "team", semanticName: "second-half over 0.5 rate", category: "second-half", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Second-half goal occurrence", destination: "team-comparison" },
  { key: "seasonBTTSPercentage_{split}", endpoint: "team", semanticName: "both teams scored rate", category: "btts", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Both teams scored", destination: "team-comparison" },
  { key: "seasonCSPercentage_{split}", endpoint: "team", semanticName: "clean-sheet rate", category: "clean-sheet", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Clean-sheet rate", destination: "deep-record" },
  { key: "seasonFTSPercentage_{split}", endpoint: "team", semanticName: "failed-to-score rate", category: "failed-to-score", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Failed-to-score rate", destination: "deep-record" },
  { key: "seasonScoredAVG_{split}", endpoint: "team", semanticName: "goals scored average", category: "goals", unit: "goals", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Goals scored per match", destination: "team-comparison" },
  { key: "seasonConcededAVG_{split}", endpoint: "team", semanticName: "goals conceded average", category: "goals", unit: "goals", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Goals conceded per match", destination: "team-comparison" },
  { key: "xg_for_avg_{split}", endpoint: "team", semanticName: "expected goals average", category: "xg", unit: "xg", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Expected goals", destination: "deep-record" },
  { key: "xg_against_avg_{split}", endpoint: "team", semanticName: "expected goals against average", category: "xg", unit: "xg", scope: "team-season", split: "unknown", preMatchSafe: true, publicLabel: "Expected goals against", destination: "deep-record" },
  { key: "league-matches.completed-before-kickoff", endpoint: "league-matches", semanticName: "league season historical outcomes", category: "sample", unit: "count", scope: "league-season", split: "unknown", preMatchSafe: true, publicLabel: "League season sample", destination: "expanded-summary" },
  { key: "totalGoalCount", endpoint: "league-matches", semanticName: "league season average match goals", category: "goals", unit: "goals", scope: "league-season", split: "unknown", preMatchSafe: true, publicLabel: "League average goals", destination: "expanded-summary" },
  { key: "over15|over25|btts|HTGoalCount|GoalCount_2hg", endpoint: "league-matches", semanticName: "league season market outcome rate", category: "over-under", unit: "percentage", sourceScale: "zero-to-one-hundred", scope: "league-season", split: "unknown", preMatchSafe: true, publicLabel: "League market rate", destination: "expanded-summary" },
] as const satisfies readonly FootyStatsFieldDefinition[];
