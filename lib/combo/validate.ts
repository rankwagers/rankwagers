import { locales, type Locale } from "@/lib/i18n";
import { normalizeCountryCode } from "@/lib/personalization/geo";
import {
  ABSOLUTE_MAX_SELECTIONS,
  ABSOLUTE_MIN_SELECTIONS,
  isMarketEnabled,
  PLATFORM_TARGET_ODDS_MAX,
  PLATFORM_TARGET_ODDS_MIN,
  resolveMarketPreferences,
} from "./config";
import { defaultComboRequest } from "./profiles";
import type { ComboApiFieldError } from "./apiTypes";
import type {
  ComboFailureReason,
  ComboGenerateFailure,
  ComboMarketPreference,
  ComboRequest,
  ComboRiskProfile,
  EvidenceCombo,
  ReplacementMode,
} from "./types";

const RISK_PROFILES = new Set<ComboRiskProfile>(["conservative", "balanced", "value"]);

const MARKET_PREFS = new Set<ComboMarketPreference>([
  "over_1_5",
  "over_2_5",
  "first_half_goals",
  "second_half_goals",
  "btts",
  "home_win",
  "away_win",
  "double_chance",
  "draw_no_bet",
  "mixed",
]);

const REPLACEMENT_MODES = new Set<ReplacementMode>([
  "same_market",
  "similar_odds",
  "stronger_evidence",
  "different_competition",
]);

const LOCALE_SET = new Set<string>(locales);

export type ValidatedComboRequest = {
  ok: true;
  request: ComboRequest;
};

export type InvalidComboRequest = {
  ok: false;
  failure: ComboGenerateFailure;
  errors: ComboApiFieldError[];
};

function fail(
  reason: ComboFailureReason,
  message: string,
  errors: ComboApiFieldError[]
): InvalidComboRequest {
  return {
    ok: false,
    failure: {
      status: "error",
      reason,
      message,
    },
    errors,
  };
}

function resolveLocale(raw: string | undefined): string {
  if (!raw) return "en";
  const normalized = raw.trim().toLowerCase();
  if (LOCALE_SET.has(normalized)) return normalized;
  const base = normalized.split("-")[0];
  if (LOCALE_SET.has(base)) return base;
  return "en";
}

/**
 * Validate and normalize user combo input.
 * Unsupported markets fail safely when they are the only preferences.
 */
export function validateComboRequest(
  input: Partial<ComboRequest> & Record<string, unknown>
): ValidatedComboRequest | InvalidComboRequest {
  const base = defaultComboRequest();
  const errors: ComboApiFieldError[] = [];

  const riskRaw = input.riskProfile ?? base.riskProfile;
  if (typeof riskRaw !== "string" || !RISK_PROFILES.has(riskRaw as ComboRiskProfile)) {
    errors.push({
      field: "riskProfile",
      code: "invalid_risk_profile",
      message: "Invalid risk profile",
    });
  }
  const riskProfile = (
    RISK_PROFILES.has(riskRaw as ComboRiskProfile) ? riskRaw : base.riskProfile
  ) as ComboRiskProfile;

  const prefsRaw = Array.isArray(input.marketPreferences)
    ? input.marketPreferences
    : base.marketPreferences;
  const marketPreferences = prefsRaw.filter(
    (p): p is ComboMarketPreference =>
      typeof p === "string" && MARKET_PREFS.has(p as ComboMarketPreference)
  );
  if (!marketPreferences.length) {
    errors.push({
      field: "marketPreferences",
      code: "required",
      message: "At least one market preference is required",
    });
  }

  const unsupportedOnly =
    marketPreferences.length > 0 &&
    marketPreferences.every((p) => p !== "mixed" && !isMarketEnabled(p));
  if (unsupportedOnly) {
    return fail("unsupported_market", "Selected markets are not enabled", [
      {
        field: "marketPreferences",
        code: "unsupported_market",
        message:
          "Selected markets are not enabled — no reliable evidence and odds mapping yet",
      },
    ]);
  }

  const enabled = resolveMarketPreferences(marketPreferences);
  if (marketPreferences.length && !enabled.length) {
    return fail("unsupported_market", "No enabled markets remain after filtering", [
      {
        field: "marketPreferences",
        code: "unsupported_market",
        message: "No enabled markets remain after filtering",
      },
    ]);
  }

  const targetOddsMin = Number(input.targetOddsMin ?? base.targetOddsMin);
  const targetOddsMax = Number(input.targetOddsMax ?? base.targetOddsMax);
  if (!Number.isFinite(targetOddsMin) || targetOddsMin <= 1) {
    errors.push({
      field: "targetOddsMin",
      code: "invalid_odds",
      message: "Target odds minimum must be greater than 1.00",
    });
  }
  if (!Number.isFinite(targetOddsMax) || targetOddsMax <= targetOddsMin) {
    errors.push({
      field: "targetOddsMax",
      code: "invalid_odds",
      message: "Target odds maximum must be greater than minimum",
    });
  }
  if (
    Number.isFinite(targetOddsMin) &&
    Number.isFinite(targetOddsMax) &&
    (targetOddsMin < PLATFORM_TARGET_ODDS_MIN || targetOddsMax > PLATFORM_TARGET_ODDS_MAX)
  ) {
    errors.push({
      field: "targetOddsMin",
      code: "out_of_platform_range",
      message: `Target odds must stay within ${PLATFORM_TARGET_ODDS_MIN}–${PLATFORM_TARGET_ODDS_MAX}`,
    });
  }

  const maxSelections = Math.floor(
    Number(input.maxSelections ?? base.maxSelections)
  );
  if (
    !Number.isFinite(maxSelections) ||
    maxSelections < ABSOLUTE_MIN_SELECTIONS ||
    maxSelections > ABSOLUTE_MAX_SELECTIONS
  ) {
    errors.push({
      field: "maxSelections",
      code: "invalid_selection_count",
      message: `Maximum selections must be between ${ABSOLUTE_MIN_SELECTIONS} and ${ABSOLUTE_MAX_SELECTIONS}`,
    });
  }

  if (errors.length) {
    return fail("invalid_request", "Request validation failed", errors);
  }

  const locale = resolveLocale(
    typeof input.locale === "string" ? input.locale : base.locale
  ) as Locale;

  const country =
    typeof input.country === "string"
      ? normalizeCountryCode(input.country) ?? undefined
      : undefined;
  const rankingCountry =
    typeof input.rankingCountry === "string"
      ? normalizeCountryCode(input.rankingCountry) ?? country
      : country;

  const request: ComboRequest = {
    locale,
    country,
    rankingCountry,
    targetOddsMin,
    targetOddsMax,
    riskProfile,
    marketPreferences,
    maxSelections,
    minEvidenceStrength:
      typeof input.minEvidenceStrength === "string"
        ? (input.minEvidenceStrength as ComboRequest["minEvidenceStrength"])
        : undefined,
    minCoverage:
      typeof input.minCoverage === "number" && Number.isFinite(input.minCoverage)
        ? input.minCoverage
        : undefined,
    minQualifiedSample:
      typeof input.minQualifiedSample === "number" &&
      Number.isFinite(input.minQualifiedSample)
        ? Math.floor(input.minQualifiedSample)
        : undefined,
    excludeSameCompetition: Boolean(
      input.excludeSameCompetition ?? base.excludeSameCompetition
    ),
    excludeSameCountry: Boolean(input.excludeSameCountry ?? base.excludeSameCountry),
    limitSameKickoffWindow: Boolean(
      input.limitSameKickoffWindow ?? base.limitSameKickoffWindow
    ),
  };

  return { ok: true, request };
}

export function validateReplacementMode(raw: unknown): ReplacementMode | null {
  return typeof raw === "string" && REPLACEMENT_MODES.has(raw as ReplacementMode)
    ? (raw as ReplacementMode)
    : null;
}

export function parseEvidenceCombo(raw: unknown): EvidenceCombo | null {
  if (!raw || typeof raw !== "object") return null;
  const combo = raw as EvidenceCombo;
  if (typeof combo.id !== "string" || !combo.id.startsWith("combo_")) return null;
  if (!combo.request || !Array.isArray(combo.selections) || combo.selections.length < 2) {
    return null;
  }
  if (!Number.isFinite(combo.combinedOdds) || combo.combinedOdds <= 1) return null;
  for (const selection of combo.selections) {
    if (!selection || typeof selection !== "object") return null;
    if (!Number.isFinite(selection.matchId) || !(selection.odds > 1)) return null;
    if (selection.qualificationStatus !== "passed") return null;
    if (typeof selection.marketId !== "string") return null;
  }
  return combo;
}

export function validateSelectionRef(raw: unknown): {
  matchId: number;
  marketId: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const matchId = Number(row.matchId);
  const marketId = typeof row.marketId === "string" ? row.marketId : "";
  if (!Number.isFinite(matchId) || !marketId) return null;
  return { matchId, marketId };
}

/** Ensure outbound affiliate paths stay on allowlisted /go/{brand} form. */
export function isSafeGoPath(path: string): boolean {
  if (!path.startsWith("/go/")) return false;
  if (path.includes("://") || path.includes("//") || path.includes("\\")) return false;
  const withoutQuery = path.split("?")[0] ?? "";
  const slug = withoutQuery.slice("/go/".length);
  if (!slug || slug.includes("/") || slug.includes("..")) return false;
  return /^[a-z0-9-]+$/.test(slug);
}
