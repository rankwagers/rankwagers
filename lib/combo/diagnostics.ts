import { comboCacheStats } from "./cache";
import { ENABLED_MARKETS, TARGET_PRESETS } from "./config";
import type {
  ComboCandidate,
  ComboEngineDiagnosticsSummary,
  ComboRequest,
} from "./types";
import { optimizeCombo } from "./optimizer";
import { matchOperatorsForCombo } from "./operators";
import { buildEvidenceCombo } from "./serialization";

export type ComboDiagnostics = ComboEngineDiagnosticsSummary & {
  generatedAt: string;
  rejectionReasons: Record<string, number>;
  marketCoverageByPreference: Record<string, number>;
  targetRangeCoverage: Record<string, number>;
  correlationExclusions: number;
  optimizerExploredSample: number;
};

export function buildComboDiagnostics(input: {
  candidates: readonly ComboCandidate[];
  qualified: readonly ComboCandidate[];
  rejected: readonly ComboCandidate[];
  request: ComboRequest;
}): ComboDiagnostics {
  const rejectionReasons: Record<string, number> = {};
  for (const candidate of input.rejected) {
    for (const reason of candidate.rejectionReasons) {
      rejectionReasons[reason] = (rejectionReasons[reason] ?? 0) + 1;
    }
  }

  const marketCoverageByPreference: Record<string, number> = {};
  for (const market of ENABLED_MARKETS) {
    const count = input.qualified.filter((c) => c.marketId === market.preference).length;
    marketCoverageByPreference[market.preference] = count;
  }

  const targetRangeCoverage: Record<string, number> = {};
  let optimizerExploredSample = 0;
  for (const preset of TARGET_PRESETS) {
    const req: ComboRequest = {
      ...input.request,
      targetOddsMin: preset.min,
      targetOddsMax: preset.max,
    };
    const result = optimizeCombo(input.qualified, req);
    optimizerExploredSample += result.explored;
    targetRangeCoverage[preset.id] =
      result.status === "success" ? 100 : result.closest ? 50 : 0;
  }

  const sampleCombo =
    input.qualified.length >= 2
      ? (() => {
          const opt = optimizeCombo(input.qualified, input.request);
          return opt.status === "success"
            ? opt.combo
            : opt.closest ??
                (input.qualified.length >= 2
                  ? buildEvidenceCombo(input.qualified.slice(0, 2), input.request)
                  : null);
        })()
      : null;

  const operators = sampleCombo ? matchOperatorsForCombo(sampleCombo, input.request) : [];
  const fullOnly = operators.filter((op) => op.availability === "full").length;
  const operatorFullMatchCoverage = operators.length
    ? Math.round((fullOnly / operators.length) * 100)
    : 0;

  const staleOdds = input.candidates.filter(
    (c) =>
      c.oddsFreshness === "refresh_recommended" || c.oddsFreshness === "unavailable"
  ).length;

  const cache = comboCacheStats();
  const status: ComboEngineDiagnosticsSummary["status"] =
    input.qualified.length === 0
      ? "unhealthy"
      : input.qualified.length < 4
        ? "degraded"
        : "healthy";

  const uniqueFixtures = new Set(input.candidates.map((c) => c.matchId)).size;
  const marketCoverage = Math.round(
    (Object.values(marketCoverageByPreference).filter((n) => n > 0).length /
      ENABLED_MARKETS.length) *
      100
  );

  return {
    status,
    candidateFixtures: uniqueFixtures,
    qualifiedSelections: input.qualified.length,
    rejectedSelections: input.rejected.length,
    marketCoverage,
    operatorFullMatchCoverage,
    staleOdds,
    cache: cache.candidateEntries > 0 ? "healthy" : "cold",
    generatedAt: new Date().toISOString(),
    rejectionReasons,
    marketCoverageByPreference,
    targetRangeCoverage,
    correlationExclusions: rejectionReasons["same_fixture"] ?? 0,
    optimizerExploredSample,
  };
}

export function toPublicDiagnostics(
  diagnostics: ComboDiagnostics
): ComboEngineDiagnosticsSummary & {
  targetRangeCoverage: Record<string, number>;
} {
  return {
    status: diagnostics.status,
    candidateFixtures: diagnostics.candidateFixtures,
    qualifiedSelections: diagnostics.qualifiedSelections,
    rejectedSelections: diagnostics.rejectedSelections,
    marketCoverage: diagnostics.marketCoverage,
    operatorFullMatchCoverage: diagnostics.operatorFullMatchCoverage,
    staleOdds: diagnostics.staleOdds,
    cache: diagnostics.cache,
    targetRangeCoverage: diagnostics.targetRangeCoverage,
  };
}
