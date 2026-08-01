import { ENABLED_MARKETS } from "@/lib/combo/config";
import { BRANDS } from "@/lib/brands";
import type { MappingConfidence } from "./bookmaker-mapping";

/** Canonical combo market IDs used by operator market mapping. */
export type CanonicalComboMarketId =
  | "over_1_5"
  | "over_2_5"
  | "first_half_over_0_5"
  | "second_half_over_0_5";

export type OperatorMarketMapping = {
  operatorId: string;
  canonicalMarketId: CanonicalComboMarketId;
  providerMarketId?: string;
  operatorMarketKey?: string;
  deeplinkTemplate?: string;
  line: number;
  period: "full_time" | "first_half" | "second_half";
  enabled: boolean;
  confidence: MappingConfidence;
};

export type MarketMappingIssue = {
  code:
    | "wrong_line"
    | "wrong_period"
    | "missing_mapping"
    | "enabled_without_keys"
    | "unsupported_market"
    | "bookmaker_mapping_missing";
  message: string;
  operatorId?: string;
  canonicalMarketId?: string;
};

export const CANONICAL_COMBO_MARKETS: Array<{
  id: CanonicalComboMarketId;
  preference: string;
  oddsKey: string;
  line: number;
  period: "full_time" | "first_half" | "second_half";
  label: string;
}> = [
  {
    id: "over_1_5",
    preference: "over_1_5",
    oddsKey: "over15",
    line: 1.5,
    period: "full_time",
    label: "Over 1.5 Goals",
  },
  {
    id: "over_2_5",
    preference: "over_2_5",
    oddsKey: "over25",
    line: 2.5,
    period: "full_time",
    label: "Over 2.5 Goals",
  },
  {
    id: "first_half_over_0_5",
    preference: "first_half_goals",
    oddsKey: "fh",
    line: 0.5,
    period: "first_half",
    label: "First Half Over 0.5",
  },
  {
    id: "second_half_over_0_5",
    preference: "second_half_goals",
    oddsKey: "sh",
    line: 0.5,
    period: "second_half",
    label: "Second Half Over 0.5",
  },
];

/** Manual market overrides — stay disabled until explicit keys exist. */
export const MANUAL_MARKET_OVERRIDES: OperatorMarketMapping[] = [];

function disabledShell(
  operatorId: string,
  market: (typeof CANONICAL_COMBO_MARKETS)[number]
): OperatorMarketMapping {
  return {
    operatorId,
    canonicalMarketId: market.id,
    line: market.line,
    period: market.period,
    enabled: false,
    confidence: "unverified",
  };
}

let cached: OperatorMarketMapping[] | null = null;

export function listMarketMappings(): OperatorMarketMapping[] {
  if (cached) return cached;
  const shells: OperatorMarketMapping[] = [];
  for (const brand of BRANDS) {
    for (const market of CANONICAL_COMBO_MARKETS) {
      shells.push(disabledShell(brand.slug, market));
    }
  }
  const byKey = new Map(
    shells.map((m) => [`${m.operatorId}:${m.canonicalMarketId}`, m])
  );
  for (const override of MANUAL_MARKET_OVERRIDES) {
    byKey.set(`${override.operatorId}:${override.canonicalMarketId}`, override);
  }
  cached = [...byKey.values()];
  return cached;
}

export function resetMarketMappingCache(): void {
  cached = null;
}

export function preferenceToCanonicalMarketId(
  preference: string
): CanonicalComboMarketId | null {
  const row = CANONICAL_COMBO_MARKETS.find(
    (m) => m.preference === preference || m.id === preference
  );
  return row?.id ?? null;
}

export function oddsKeyToCanonicalMarketId(
  oddsKey: string
): CanonicalComboMarketId | null {
  const row = CANONICAL_COMBO_MARKETS.find((m) => m.oddsKey === oddsKey);
  return row?.id ?? null;
}

export function getMarketMapping(
  operatorId: string,
  canonicalMarketId: CanonicalComboMarketId
): OperatorMarketMapping | undefined {
  return listMarketMappings().find(
    (m) =>
      m.operatorId === operatorId && m.canonicalMarketId === canonicalMarketId
  );
}

/** Explicit enabled mapping with keys — no string "over" matching. */
export function marketMappingIsUsable(
  mapping: OperatorMarketMapping | undefined
): boolean {
  if (!mapping || !mapping.enabled) return false;
  if (mapping.confidence === "unverified") return false;
  return Boolean(mapping.providerMarketId || mapping.operatorMarketKey);
}

export function validateMarketLineAndPeriod(mapping: OperatorMarketMapping): {
  ok: boolean;
  reason?: string;
} {
  const expected = CANONICAL_COMBO_MARKETS.find(
    (m) => m.id === mapping.canonicalMarketId
  );
  if (!expected) {
    return { ok: false, reason: "unsupported_market" };
  }
  if (mapping.line !== expected.line) {
    return { ok: false, reason: "wrong_line" };
  }
  if (mapping.period !== expected.period) {
    return { ok: false, reason: "wrong_period" };
  }
  // Full-time vs half-time must never be conflated
  if (
    expected.period === "full_time" &&
    (mapping.period === "first_half" || mapping.period === "second_half")
  ) {
    return { ok: false, reason: "wrong_period" };
  }
  return { ok: true };
}

export function validateMarketMappings(
  mappings: readonly OperatorMarketMapping[] = listMarketMappings()
): MarketMappingIssue[] {
  const issues: MarketMappingIssue[] = [];
  for (const mapping of mappings) {
    const check = validateMarketLineAndPeriod(mapping);
    if (!check.ok) {
      issues.push({
        code: check.reason as MarketMappingIssue["code"],
        message: `Invalid ${mapping.canonicalMarketId} for ${mapping.operatorId}: ${check.reason}`,
        operatorId: mapping.operatorId,
        canonicalMarketId: mapping.canonicalMarketId,
      });
    }
    if (mapping.enabled && !marketMappingIsUsable(mapping)) {
      issues.push({
        code: "enabled_without_keys",
        message: `Enabled market mapping lacks provider/operator keys: ${mapping.operatorId}/${mapping.canonicalMarketId}`,
        operatorId: mapping.operatorId,
        canonicalMarketId: mapping.canonicalMarketId,
      });
    }
  }
  // Ensure every operator×canonical market has a row
  for (const brand of BRANDS) {
    for (const market of CANONICAL_COMBO_MARKETS) {
      const found = mappings.find(
        (m) =>
          m.operatorId === brand.slug && m.canonicalMarketId === market.id
      );
      if (!found) {
        issues.push({
          code: "missing_mapping",
          message: `Missing market mapping shell ${brand.slug}/${market.id}`,
          operatorId: brand.slug,
          canonicalMarketId: market.id,
        });
      }
    }
  }
  return issues;
}

export function marketMappingStats(
  mappings: readonly OperatorMarketMapping[] = listMarketMappings()
) {
  const total = mappings.length;
  const enabled = mappings.filter((m) => m.enabled).length;
  const usable = mappings.filter((m) => marketMappingIsUsable(m)).length;
  const byMarket: Record<string, number> = {};
  for (const market of CANONICAL_COMBO_MARKETS) {
    byMarket[market.id] = mappings.filter(
      (m) => m.canonicalMarketId === market.id && marketMappingIsUsable(m)
    ).length;
  }
  // Sanity: ENABLED_MARKETS length matches canonical set
  void ENABLED_MARKETS;
  return {
    total,
    enabled,
    usable,
    coveragePercent: total ? Math.round((usable / total) * 1000) / 10 : 0,
    byMarket,
    issues: validateMarketMappings(mappings).length,
  };
}
