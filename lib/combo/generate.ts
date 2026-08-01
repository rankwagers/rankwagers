import type { DailyMatchLists } from "@/lib/footystats/types";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { buildAlternatives } from "./alternatives";
import {
  buildCandidatesFromDailyLists,
  buildCandidatesFromFixtures,
  type OddsLookup,
} from "./candidates";
import {
  getCachedCandidates,
  requestCacheKey,
  setCachedCandidates,
} from "./cache";
import { buildComboDiagnostics, toPublicDiagnostics } from "./diagnostics";
import { matchOperatorsForCombo } from "./operators";
import { optimizeCombo } from "./optimizer";
import { applyEvidenceGates } from "./qualification";
import { validateComboRequest } from "./validate";
import type {
  ComboCandidate,
  ComboGenerateResult,
  ComboRequest,
} from "./types";

export type GenerateComboInput = {
  request: Partial<ComboRequest> & Record<string, unknown>;
  lists?: DailyMatchLists;
  fixtures?: QualifiedFixture[];
  candidates?: ComboCandidate[];
  oddsLookup?: OddsLookup;
  now?: number;
  includeDiagnostics?: boolean;
};

/**
 * Domain entrypoint: validate → candidates → gates → optimize → operators → alternatives.
 * Does not call providers itself — callers supply lists/fixtures/odds.
 */
export function generateEvidenceCombo(input: GenerateComboInput): ComboGenerateResult {
  const validated = validateComboRequest(input.request);
  if (!validated.ok) return validated.failure;

  const request = validated.request;
  const now = input.now ?? Date.now();

  let candidates = input.candidates;
  if (!candidates) {
    const cacheKey = requestCacheKey(request, input.lists?.date);
    const cached = getCachedCandidates(cacheKey);
    if (cached) {
      candidates = cached;
    } else if (input.fixtures) {
      candidates = buildCandidatesFromFixtures(
        input.fixtures,
        request,
        input.oddsLookup,
        now
      );
      setCachedCandidates(cacheKey, candidates);
    } else if (input.lists) {
      candidates = buildCandidatesFromDailyLists(
        input.lists,
        request,
        input.oddsLookup,
        now
      );
      setCachedCandidates(cacheKey, candidates);
    } else {
      return {
        status: "no_qualified_combo",
        reason: "no_fixtures",
        message: "No fixtures were supplied for combination generation",
      };
    }
  }

  if (!candidates.length) {
    return {
      status: "no_qualified_combo",
      reason: "no_fixtures",
      message: "No qualified fixtures are currently available",
    };
  }

  const { qualified, rejected } = applyEvidenceGates(candidates, request, now);
  if (!qualified.length) {
    return {
      status: "no_qualified_combo",
      reason: "no_qualified_candidates",
      message: "No candidates passed evidence gates for this risk profile",
    };
  }

  const optimized = optimizeCombo(qualified, request);
  if (optimized.status !== "success") {
    const operators = optimized.closest
      ? matchOperatorsForCombo(optimized.closest, request)
      : [];
    return {
      ...optimized.failure,
      operators,
    };
  }

  const alternatives = buildAlternatives(optimized.combo, qualified, request);
  const operators = matchOperatorsForCombo(optimized.combo, request);
  const diagnostics = input.includeDiagnostics
    ? toPublicDiagnostics(
        buildComboDiagnostics({
          candidates,
          qualified,
          rejected,
          request,
        })
      )
    : undefined;

  return {
    status: "success",
    combo: optimized.combo,
    alternatives,
    operators,
    diagnostics,
  };
}
