import type {
  AccaBuilderConfig,
  AccaBuilderMarketKey,
  AccaBuilderRiskMode,
} from "./contracts";
import {
  ACCA_BUILDER_MAX_LEGS,
  ACCA_BUILDER_MIN_LEGS,
} from "./contracts";

export const BUILDER_LIST_MARKETS: AccaBuilderMarketKey[] = [
  "over15",
  "over25",
  "fh",
  "sh",
];

export type RiskModeRules = {
  id: AccaBuilderRiskMode;
  minConfidence: number;
  maxLegs: number;
  minEvidenceCompleteness: number;
  markets: AccaBuilderMarketKey[];
  description: string;
};

export const RISK_MODE_RULES: Record<AccaBuilderRiskMode, RiskModeRules> = {
  conservative: {
    id: "conservative",
    minConfidence: 78,
    maxLegs: 3,
    minEvidenceCompleteness: 70,
    markets: ["over15", "over25", "fh"],
    description:
      "Highest confidence threshold, fewer legs, narrower market set. Not a guarantee.",
  },
  balanced: {
    id: "balanced",
    minConfidence: 70,
    maxLegs: 5,
    minEvidenceCompleteness: 55,
    markets: ["over15", "over25", "fh", "sh"],
    description:
      "Moderate confidence and leg count with controlled market diversity.",
  },
  aggressive: {
    id: "aggressive",
    minConfidence: 62,
    maxLegs: 8,
    minEvidenceCompleteness: 40,
    markets: ["over15", "over25", "fh", "sh"],
    description:
      "Lower confidence floor and more legs; hard eligibility gates still apply.",
  },
};

export function defaultBuilderConfig(
  overrides: Partial<AccaBuilderConfig> = {}
): AccaBuilderConfig {
  const riskMode = overrides.riskMode ?? "balanced";
  const rules = RISK_MODE_RULES[riskMode];
  const legCount = Math.min(
    Math.max(overrides.legCount ?? 3, ACCA_BUILDER_MIN_LEGS),
    Math.min(rules.maxLegs, ACCA_BUILDER_MAX_LEGS)
  );
  return {
    locale: overrides.locale ?? "en",
    riskMode,
    legCount,
    minConfidence: overrides.minConfidence ?? rules.minConfidence,
    markets: overrides.markets?.length ? overrides.markets : [...rules.markets],
    competitions: overrides.competitions ?? [],
    countries: overrides.countries ?? [],
    excludedTeams: overrides.excludedTeams ?? [],
    excludedCompetitions: overrides.excludedCompetitions ?? [],
    targetOddsMin: overrides.targetOddsMin ?? null,
    targetOddsMax: overrides.targetOddsMax ?? null,
    preMatchOnly: overrides.preMatchOnly ?? true,
    includeLive: overrides.includeLive ?? false,
    oneSelectionPerFixture: overrides.oneSelectionPerFixture ?? true,
  };
}

export function parseBuilderConfig(
  raw: Record<string, unknown> | null | undefined
): { ok: true; config: AccaBuilderConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const body = raw ?? {};
  const riskModeRaw = String(body.riskMode ?? "balanced");
  if (
    riskModeRaw !== "conservative" &&
    riskModeRaw !== "balanced" &&
    riskModeRaw !== "aggressive"
  ) {
    errors.push("riskMode must be conservative|balanced|aggressive");
  }
  const riskMode = (
    errors.length ? "balanced" : riskModeRaw
  ) as AccaBuilderRiskMode;

  let legCount = Number(body.legCount ?? 3);
  if (!Number.isFinite(legCount)) {
    errors.push("legCount must be a number");
    legCount = 3;
  }
  legCount = Math.round(legCount);

  const marketsRaw = Array.isArray(body.markets) ? body.markets : null;
  const markets = (marketsRaw ?? RISK_MODE_RULES[riskMode].markets)
    .map((m) => String(m))
    .filter((m): m is AccaBuilderMarketKey =>
      (BUILDER_LIST_MARKETS as string[]).includes(m)
    );

  if (!markets.length) errors.push("markets must include at least one list market");

  const minConfidence = Number(
    body.minConfidence ?? RISK_MODE_RULES[riskMode].minConfidence
  );
  if (!Number.isFinite(minConfidence) || minConfidence < 50 || minConfidence > 99) {
    errors.push("minConfidence must be between 50 and 99");
  }

  const targetOddsMin =
    body.targetOddsMin == null || body.targetOddsMin === ""
      ? null
      : Number(body.targetOddsMin);
  const targetOddsMax =
    body.targetOddsMax == null || body.targetOddsMax === ""
      ? null
      : Number(body.targetOddsMax);
  if (targetOddsMin != null && (!Number.isFinite(targetOddsMin) || targetOddsMin < 1.01)) {
    errors.push("targetOddsMin invalid");
  }
  if (targetOddsMax != null && (!Number.isFinite(targetOddsMax) || targetOddsMax < 1.01)) {
    errors.push("targetOddsMax invalid");
  }
  if (
    targetOddsMin != null &&
    targetOddsMax != null &&
    targetOddsMin > targetOddsMax
  ) {
    errors.push("targetOddsMin must be <= targetOddsMax");
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    config: defaultBuilderConfig({
      locale: typeof body.locale === "string" ? body.locale : "en",
      riskMode,
      legCount,
      minConfidence,
      markets,
      competitions: asStringArray(body.competitions),
      countries: asStringArray(body.countries).map((c) => c.toUpperCase()),
      excludedTeams: asStringArray(body.excludedTeams),
      excludedCompetitions: asStringArray(body.excludedCompetitions),
      targetOddsMin,
      targetOddsMax,
      preMatchOnly: body.preMatchOnly !== false,
      includeLive: body.includeLive === true,
      oneSelectionPerFixture: body.oneSelectionPerFixture !== false,
    }),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim())
    .filter(Boolean)
    .slice(0, 40);
}
