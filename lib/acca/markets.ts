import type { AccaMarketKey } from "./types";

export type AccaMarketDefinition = {
  key: AccaMarketKey;
  label: string;
  defaultSelectionKey: string;
  defaultSelectionLabel: string;
  /** Settlement-backed — Acca may expose. */
  settlementSupported: true;
};

/**
 * Only markets with deterministic settlement are Acca-eligible.
 * Match winner requires an explicit selection key from the match page.
 */
export const ACCA_MARKETS: readonly AccaMarketDefinition[] = [
  {
    key: "over15",
    label: "Over 1.5 Goals",
    defaultSelectionKey: "over",
    defaultSelectionLabel: "Over 1.5",
    settlementSupported: true,
  },
  {
    key: "over25",
    label: "Over 2.5 Goals",
    defaultSelectionKey: "over",
    defaultSelectionLabel: "Over 2.5",
    settlementSupported: true,
  },
  {
    key: "btts",
    label: "Both Teams To Score",
    defaultSelectionKey: "yes",
    defaultSelectionLabel: "Yes",
    settlementSupported: true,
  },
  {
    key: "fh",
    label: "First Half Over 0.5",
    defaultSelectionKey: "over",
    defaultSelectionLabel: "FH Over 0.5",
    settlementSupported: true,
  },
  {
    key: "sh",
    label: "Second Half Over 0.5",
    defaultSelectionKey: "over",
    defaultSelectionLabel: "SH Over 0.5",
    settlementSupported: true,
  },
  {
    key: "match_winner",
    label: "Match Winner",
    defaultSelectionKey: "home",
    defaultSelectionLabel: "Home",
    settlementSupported: true,
  },
] as const;

const BY_KEY = new Map(ACCA_MARKETS.map((m) => [m.key, m]));

export function isAccaMarketKey(value: string): value is AccaMarketKey {
  return BY_KEY.has(value as AccaMarketKey);
}

export function getAccaMarket(key: AccaMarketKey): AccaMarketDefinition {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown Acca market: ${key}`);
  return def;
}

/** Map list / settlement keys to Acca markets; unsupported → null. */
export function resolveAccaMarketKey(raw: string | null | undefined): AccaMarketKey | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (isAccaMarketKey(key)) return key;
  const aliases: Record<string, AccaMarketKey> = {
    over_1_5: "over15",
    over1_5: "over15",
    "over-1.5": "over15",
    over_2_5: "over25",
    over2_5: "over25",
    "over-2.5": "over25",
    both_teams_to_score: "btts",
    first_half_goals: "fh",
    second_half_goals: "sh",
    "1x2": "match_winner",
    matchwinner: "match_winner",
  };
  return aliases[key] ?? null;
}
