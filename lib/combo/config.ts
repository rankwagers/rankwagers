import type { EvidenceStrength } from "@/lib/evidence-ui";
import type {
  ComboMarketPreference,
  EnabledMarketConfig,
  UnsupportedMarketConfig,
} from "./types";

export const COMBO_CONFIG_VERSION = 1;

/** Platform odds bounds — user range must sit inside. */
export const PLATFORM_TARGET_ODDS_MIN = 1.2;
export const PLATFORM_TARGET_ODDS_MAX = 25;

export const DEFAULT_TARGET_ODDS_MIN = 2.0;
export const DEFAULT_TARGET_ODDS_MAX = 3.0;
export const DEFAULT_MAX_SELECTIONS = 3;
export const ABSOLUTE_MAX_SELECTIONS = 6;
export const ABSOLUTE_MIN_SELECTIONS = 2;

export const DEFAULT_MIN_COVERAGE = 75;
export const DEFAULT_MIN_QUALIFIED_SAMPLE = 10;

/**
 * Daily-list rows do not expose season sample sizes.
 * List admission already passed provider thresholds backed by season rates.
 * When fixture research is unavailable, use this adequate proxy with coverage = model %.
 * Conservative profiles (sample ≥ 20) still require fixture_research enrichment.
 */
export const LIST_EVIDENCE_SAMPLE_PROXY = 12;

export const OPTIMIZER_MAX_CANDIDATES = 48;
export const OPTIMIZER_MAX_CANDIDATES_PER_MARKET = 16;
export const MAX_ALTERNATIVES = 3;

export const KICKOFF_WINDOW_MS = 3 * 60 * 60 * 1000;
export const MAX_SAME_COMPETITION = 2;
export const MAX_SAME_COUNTRY = 2;
export const MAX_SAME_KICKOFF_WINDOW = 2;

export const ODDS_CURRENT_MS = 5 * 60 * 1000;
export const ODDS_RECENT_MS = 30 * 60 * 1000;
export const ODDS_STALE_MS = 2 * 60 * 60 * 1000;

export const CANDIDATE_CACHE_TTL_MS = 60_000;
export const FEATURED_CACHE_TTL_MS = 120_000;

export const STRENGTH_RANK: Record<EvidenceStrength, number> = {
  insufficient: 0,
  limited: 1,
  moderate: 2,
  strong: 3,
  very_strong: 4,
};

export const SCORING_WEIGHTS = {
  evidenceStrength: 30,
  coverage: 18,
  sample: 14,
  baseline: 10,
  marketSuitability: 10,
  oddsSuitability: 12,
  providerCompleteness: 6,
  volatilityPenalty: 8,
  freshnessPenalty: 6,
} as const;

export const ENABLED_MARKETS: EnabledMarketConfig[] = [
  {
    preference: "over_1_5",
    listKind: "over15",
    oddsKey: "over15",
    label: "Over 1.5 Goals",
    enabled: true,
  },
  {
    preference: "over_2_5",
    listKind: "over25",
    oddsKey: "over25",
    label: "Over 2.5 Goals",
    enabled: true,
  },
  {
    preference: "first_half_goals",
    listKind: "fh",
    oddsKey: "fh",
    label: "1st Half Over 0.5",
    enabled: true,
  },
  {
    preference: "second_half_goals",
    listKind: "sh",
    oddsKey: "sh",
    label: "2nd Half Over 0.5",
    enabled: true,
  },
];

export const UNSUPPORTED_MARKETS: UnsupportedMarketConfig[] = [
  {
    preference: "btts",
    enabled: false,
    reason: "No qualification list or odds mapping for BTTS yet",
  },
  {
    preference: "home_win",
    enabled: false,
    reason: "No qualification list or odds mapping for home win yet",
  },
  {
    preference: "away_win",
    enabled: false,
    reason: "No qualification list or odds mapping for away win yet",
  },
  {
    preference: "double_chance",
    enabled: false,
    reason: "No qualification list or odds mapping for double chance yet",
  },
  {
    preference: "draw_no_bet",
    enabled: false,
    reason: "No qualification list or odds mapping for draw no bet yet",
  },
];

export const TARGET_PRESETS = [
  { id: "1.5-2.0", min: 1.5, max: 2.0, label: "1.50–2.00" },
  { id: "2.0-3.0", min: 2.0, max: 3.0, label: "2.00–3.00" },
  { id: "3.0-5.0", min: 3.0, max: 5.0, label: "3.00–5.00" },
  { id: "5.0+", min: 5.0, max: 12.0, label: "5.00+" },
] as const;

const ENABLED_BY_PREF = new Map(ENABLED_MARKETS.map((m) => [m.preference, m]));

export function getEnabledMarket(preference: ComboMarketPreference) {
  if (preference === "mixed") return null;
  return ENABLED_BY_PREF.get(preference as EnabledMarketConfig["preference"]);
}

export function isMarketEnabled(preference: ComboMarketPreference): boolean {
  if (preference === "mixed") return true;
  return ENABLED_BY_PREF.has(preference as EnabledMarketConfig["preference"]);
}

export function resolveMarketPreferences(
  preferences: readonly ComboMarketPreference[]
): EnabledMarketConfig[] {
  if (preferences.includes("mixed") || preferences.length === 0) {
    return [...ENABLED_MARKETS];
  }
  const out: EnabledMarketConfig[] = [];
  for (const pref of preferences) {
    const market = getEnabledMarket(pref);
    if (market) out.push(market);
  }
  return out;
}

export function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
