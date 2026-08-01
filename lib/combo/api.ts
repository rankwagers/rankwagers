import { randomBytes } from "node:crypto";
import { getBrand } from "@/lib/brands";
import { metrics } from "@/lib/observability/metrics";
import { applyEvidenceGates } from "./qualification";
import {
  buildCandidatesFromDailyLists,
  buildCandidatesFromFixtures,
  type OddsLookup,
} from "./candidates";
import { generateEvidenceCombo } from "./generate";
import { matchOperatorsForCombo } from "./operators";
import { removeSelection, replaceSelection } from "./replacement";
import {
  clearPreparedComboData,
  computeDataSnapshotId,
  getPreparedComboData,
  parseInjectedFixtures,
  parseInjectedOdds,
  setPreparedComboData,
} from "./prepared";
import { getComboSession, storeComboSession } from "./sessionStore";
import {
  isSafeGoPath,
  parseEvidenceCombo,
  validateComboRequest,
  validateReplacementMode,
  validateSelectionRef,
} from "./validate";
import { buildComboDiagnostics } from "./diagnostics";
import { defaultComboRequest } from "./profiles";
import { buildEvidenceCombo } from "./serialization";
import { optimizeCombo } from "./optimizer";
import type {
  ComboApiInvalid,
  ComboApiMeta,
  ComboApiNoResult,
  ComboApiRateLimited,
  ComboApiReplaceUnavailable,
  ComboApiResponse,
  ComboApiSuccess,
  PublicDiagnostics,
  PublicEvidenceCombo,
  PublicOperatorMatch,
} from "./apiTypes";
import type {
  ComboCandidate,
  ComboOperatorMatch,
  ComboRequest,
  EvidenceCombo,
  ReplacementMode,
} from "./types";

export function createComboRequestId(): string {
  return `req_${randomBytes(8).toString("hex")}`;
}

export function toPublicCombo(combo: EvidenceCombo): PublicEvidenceCombo {
  return {
    id: combo.id,
    request: { ...combo.request },
    selections: combo.selections.map((s) => ({
      fixtureId: s.fixtureId,
      fixtureSlug: s.fixtureSlug,
      matchId: s.matchId,
      competitionId: s.competitionId,
      competitionName: s.competitionName,
      homeTeamId: s.homeTeamId,
      awayTeamId: s.awayTeamId,
      homeTeam: s.homeTeam,
      awayTeam: s.awayTeam,
      countryCode: s.countryCode,
      kickoffAt: s.kickoffAt,
      marketId: s.marketId,
      marketKind: s.marketKind,
      marketLabel: s.marketLabel,
      odds: s.odds,
      oddsFetchedAt: s.oddsFetchedAt,
      oddsFreshness: s.oddsFreshness,
      modelProbability: s.modelProbability,
      evidenceStrength: s.evidenceStrength,
      coverage: s.coverage,
      qualifiedSample: s.qualifiedSample,
      baselineDifference: s.baselineDifference,
      qualificationStatus: "passed",
      reasoning: s.reasoning.map((r) => ({ ...r })),
      evidenceSource: s.evidenceSource,
    })),
    combinedOdds: combo.combinedOdds,
    targetDistance: combo.targetDistance,
    inTargetRange: combo.inTargetRange,
    averageCoverage: combo.averageCoverage,
    aggregateEvidenceStrength: combo.aggregateEvidenceStrength,
    totalQualifiedSample: combo.totalQualifiedSample,
    score: combo.score,
    generatedAt: combo.generatedAt,
    expiresAt: combo.expiresAt,
    oddsFreshness: combo.oddsFreshness,
  };
}

export function toPublicOperators(
  operators: readonly ComboOperatorMatch[]
): PublicOperatorMatch[] {
  return operators.map((op) => {
    const path =
      op.outboundPath && isSafeGoPath(op.outboundPath) && getBrand(op.slug)
        ? op.outboundPath
        : "";
    return {
      operatorId: op.operatorId,
      slug: op.slug,
      displayName: op.displayName,
      logo: op.logo,
      availability: op.availability,
      availableSelectionCount: op.availableSelectionCount,
      totalSelections: op.totalSelections,
      missingMarketIds: [...op.missingMarketIds],
      combinedOdds: op.combinedOdds,
      countryEligible: op.countryEligible,
      deeplinkType: path ? op.deeplinkType : "unavailable",
      outboundPath: path,
      offerSummary: op.offerSummary,
      mobileSupported: op.mobileSupported,
      reasons: [...op.reasons],
      badge: op.badge,
      rank: op.rank,
    };
  });
}

function metaFor(
  dataSnapshot: string,
  combo?: EvidenceCombo
): ComboApiMeta {
  return {
    generatedAt: combo?.generatedAt ?? new Date().toISOString(),
    oddsFreshness: combo?.oddsFreshness,
    dataSnapshot,
    inTargetRange: combo?.inTargetRange,
  };
}

function resolveData(input: {
  fixtures?: unknown;
  odds?: unknown;
  dataSnapshot?: string;
}): {
  fixtures?: ReturnType<typeof parseInjectedFixtures>;
  lists?: NonNullable<ReturnType<typeof getPreparedComboData>>["lists"];
  oddsLookup?: OddsLookup;
  dataSnapshot: string;
  candidates?: ComboCandidate[];
} {
  const prepared = getPreparedComboData();
  const injectedFixtures = parseInjectedFixtures(input.fixtures);
  const injectedOdds = parseInjectedOdds(input.odds);

  const fixtures = injectedFixtures ?? prepared?.fixtures;
  const lists = injectedFixtures ? undefined : prepared?.lists;
  const oddsLookup = injectedOdds ?? prepared?.oddsLookup;

  const dataSnapshot =
    (typeof input.dataSnapshot === "string" && input.dataSnapshot) ||
    prepared?.snapshotId ||
    computeDataSnapshotId({
      fixtures: fixtures ?? undefined,
      lists: lists ?? undefined,
    });

  return { fixtures: fixtures ?? null, lists, oddsLookup, dataSnapshot };
}

function resolveComboAndCandidates(input: {
  combo?: unknown;
  comboId?: string;
  fixtures?: unknown;
  odds?: unknown;
  dataSnapshot?: string;
  requestOverlay?: Partial<ComboRequest>;
}):
  | {
      ok: true;
      combo: EvidenceCombo;
      candidates: ComboCandidate[];
      dataSnapshot: string;
    }
  | { ok: false; errors: ComboApiInvalid["errors"] } {
  const session =
    typeof input.comboId === "string" ? getComboSession(input.comboId) : null;

  let combo = parseEvidenceCombo(input.combo) ?? session?.combo ?? null;
  if (!combo) {
    return {
      ok: false,
      errors: [
        {
          field: "combo",
          code: "missing_combo",
          message: "Validated combo state or resolvable comboId is required",
        },
      ],
    };
  }

  if (input.requestOverlay?.country) {
    combo = {
      ...combo,
      request: {
        ...combo.request,
        country: input.requestOverlay.country,
        rankingCountry:
          input.requestOverlay.rankingCountry ?? input.requestOverlay.country,
      },
    };
  }

  const data = resolveData(input);
  let candidates = session?.candidates;
  if (!candidates) {
    if (data.fixtures?.length) {
      candidates = buildCandidatesFromFixtures(
        data.fixtures,
        combo.request,
        data.oddsLookup
      );
    } else if (data.lists) {
      candidates = buildCandidatesFromDailyLists(
        data.lists,
        combo.request,
        data.oddsLookup
      );
    } else {
      return {
        ok: false,
        errors: [
          {
            field: "fixtures",
            code: "missing_prepared_data",
            message: "Prepared fixture/odds snapshot is required",
          },
        ],
      };
    }
  }

  const { qualified } = applyEvidenceGates(candidates, combo.request);
  return {
    ok: true,
    combo,
    candidates: qualified.length ? qualified : candidates,
    dataSnapshot: session?.dataSnapshot ?? data.dataSnapshot,
  };
}

export function apiGenerateCombo(
  body: Record<string, unknown>,
  requestId = createComboRequestId()
): ComboApiResponse {
  const started = Date.now();
  metrics.increment("combo_generate_total");
  const validated = validateComboRequest(body);
  if (!validated.ok) {
    const invalid: ComboApiInvalid = {
      status: "invalid_request",
      requestId,
      errors: validated.errors,
    };
    metrics.timing("combo_optimizer_duration_ms", Date.now() - started, {
      status: "invalid",
    });
    return invalid;
  }

  const data = resolveData({
    fixtures: body.fixtures,
    odds: body.odds,
    dataSnapshot: typeof body.dataSnapshot === "string" ? body.dataSnapshot : undefined,
  });

  if (!data.fixtures?.length && !data.lists) {
    const noData: ComboApiNoResult = {
      status: "no_qualified_combo",
      requestId,
      reason: "no_fixtures",
      message: "No prepared fixtures were available for generation",
      meta: metaFor(data.dataSnapshot),
    };
    return noData;
  }

  const result = generateEvidenceCombo({
    request: validated.request,
    fixtures: data.fixtures ?? undefined,
    lists: data.lists,
    oddsLookup: data.oddsLookup,
  });

  if (result.status === "success") {
    const allCandidates = data.fixtures?.length
      ? buildCandidatesFromFixtures(
          data.fixtures,
          validated.request,
          data.oddsLookup
        )
      : data.lists
        ? buildCandidatesFromDailyLists(
            data.lists,
            validated.request,
            data.oddsLookup
          )
        : [];
    const { qualified } = applyEvidenceGates(allCandidates, validated.request);
    storeComboSession({
      combo: result.combo,
      candidates: qualified,
      dataSnapshot: data.dataSnapshot,
    });

    const success: ComboApiSuccess = {
      status: "success",
      requestId,
      combo: toPublicCombo(result.combo),
      operators: toPublicOperators(result.operators),
      alternatives: result.alternatives.map(toPublicCombo),
      meta: metaFor(data.dataSnapshot, result.combo),
    };
    metrics.increment("combo_generate_success_total");
    metrics.gauge("combo_candidate_count", qualified.length);
    metrics.timing("combo_optimizer_duration_ms", Date.now() - started, {
      status: "success",
    });
    return success;
  }

  if (result.status === "error" && result.reason === "invalid_request") {
    metrics.timing("combo_optimizer_duration_ms", Date.now() - started, {
      status: "invalid",
    });
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "request",
          code: result.reason,
          message: result.message,
        },
      ],
    };
  }

  if (result.status === "error" && result.reason === "unsupported_market") {
    metrics.timing("combo_optimizer_duration_ms", Date.now() - started, {
      status: "invalid",
    });
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "marketPreferences",
          code: "unsupported_market",
          message: result.message,
        },
      ],
    };
  }

  metrics.increment("combo_generate_no_qualified_total");
  metrics.timing("combo_optimizer_duration_ms", Date.now() - started, {
    status: "no_qualified",
  });

  const noResult: ComboApiNoResult = {
    status: "no_qualified_combo",
    requestId,
    reason: result.reason,
    message: result.message,
    closestQualifiedOption: result.closestQualifiedOption
      ? {
          combinedOdds: result.closestQualifiedOption.combinedOdds,
          combo: result.closestQualifiedOption.combo
            ? toPublicCombo(result.closestQualifiedOption.combo)
            : undefined,
        }
      : undefined,
    suggestedRange: result.suggestedRange,
    operators: result.operators ? toPublicOperators(result.operators) : undefined,
    meta: metaFor(
      data.dataSnapshot,
      result.closestQualifiedOption?.combo
    ),
  };
  return noResult;
}

export function apiReplaceSelection(
  body: Record<string, unknown>,
  requestId = createComboRequestId()
): ComboApiResponse {
  const mode = validateReplacementMode(body.mode);
  if (!mode) {
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "mode",
          code: "invalid_replacement_mode",
          message:
            "Replacement mode must be same_market, similar_odds, stronger_evidence, or different_competition",
        },
      ],
    };
  }

  const selection = validateSelectionRef(body.selection);
  if (!selection) {
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "selection",
          code: "invalid_selection",
          message: "selection.matchId and selection.marketId are required",
        },
      ],
    };
  }

  const country =
    typeof body.country === "string"
      ? validateComboRequest({
          ...defaultComboRequest(),
          country: body.country,
        })
      : null;
  const countryCode =
    country && country.ok ? country.request.country : undefined;

  const resolved = resolveComboAndCandidates({
    combo: body.combo,
    comboId: typeof body.comboId === "string" ? body.comboId : undefined,
    fixtures: body.fixtures,
    odds: body.odds,
    dataSnapshot:
      typeof body.dataSnapshot === "string" ? body.dataSnapshot : undefined,
    requestOverlay: countryCode ? { country: countryCode } : undefined,
  });
  if (!resolved.ok) {
    return { status: "invalid_request", requestId, errors: resolved.errors };
  }

  const replaced = replaceSelection(
    resolved.combo,
    selection,
    mode as ReplacementMode,
    resolved.candidates,
    resolved.combo.request
  );

  if (replaced.status === "failure") {
    const operators = toPublicOperators(
      matchOperatorsForCombo(resolved.combo, resolved.combo.request)
    );
    const unavailable: ComboApiReplaceUnavailable = {
      status: "no_replacement",
      requestId,
      reason: "no_replacement",
      message: replaced.message,
      combo: toPublicCombo(resolved.combo),
      operators,
      meta: metaFor(resolved.dataSnapshot, resolved.combo),
    };
    return unavailable;
  }

  const operators = matchOperatorsForCombo(
    replaced.combo,
    replaced.combo.request
  );
  storeComboSession({
    combo: replaced.combo,
    candidates: resolved.candidates,
    dataSnapshot: resolved.dataSnapshot,
  });

  return {
    status: "success",
    requestId,
    combo: toPublicCombo(replaced.combo),
    operators: toPublicOperators(operators),
    alternatives: [],
    explanation: replaced.explanation,
    meta: metaFor(resolved.dataSnapshot, replaced.combo),
  };
}

export function apiRemoveSelection(
  body: Record<string, unknown>,
  requestId = createComboRequestId()
): ComboApiResponse {
  const selection = validateSelectionRef(body.selection);
  if (!selection) {
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "selection",
          code: "invalid_selection",
          message: "selection.matchId and selection.marketId are required",
        },
      ],
    };
  }

  const resolved = resolveComboAndCandidates({
    combo: body.combo,
    comboId: typeof body.comboId === "string" ? body.comboId : undefined,
    fixtures: body.fixtures,
    odds: body.odds,
    dataSnapshot:
      typeof body.dataSnapshot === "string" ? body.dataSnapshot : undefined,
  });
  if (!resolved.ok) {
    return { status: "invalid_request", requestId, errors: resolved.errors };
  }

  const removed = removeSelection(resolved.combo, selection, resolved.candidates);
  if (removed.status === "failure") {
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "selection",
          code: "remove_failed",
          message: removed.message,
        },
      ],
    };
  }

  const operators = matchOperatorsForCombo(
    removed.combo,
    removed.combo.request
  );
  storeComboSession({
    combo: removed.combo,
    candidates: resolved.candidates,
    dataSnapshot: resolved.dataSnapshot,
  });

  return {
    status: "success",
    requestId,
    combo: toPublicCombo(removed.combo),
    operators: toPublicOperators(operators),
    alternatives: [],
    meta: metaFor(resolved.dataSnapshot, removed.combo),
  };
}

export function apiMatchOperators(
  body: Record<string, unknown>,
  requestId = createComboRequestId()
): ComboApiResponse {
  const countryValidated =
    typeof body.country === "string"
      ? validateComboRequest({ ...defaultComboRequest(), country: body.country })
      : null;
  const country =
    countryValidated && countryValidated.ok
      ? countryValidated.request.country
      : undefined;

  const resolved = resolveComboAndCandidates({
    combo: body.combo,
    comboId: typeof body.comboId === "string" ? body.comboId : undefined,
    requestOverlay: country ? { country } : undefined,
  });

  // Operators refresh may work from combo state alone (session or body).
  let combo = resolved.ok ? resolved.combo : parseEvidenceCombo(body.combo);
  if (!combo) {
    const session =
      typeof body.comboId === "string" ? getComboSession(body.comboId) : null;
    combo = session?.combo ?? null;
  }
  if (!combo) {
    return {
      status: "invalid_request",
      requestId,
      errors: [
        {
          field: "combo",
          code: "missing_combo",
          message: "Validated combo state or resolvable comboId is required",
        },
      ],
    };
  }

  if (country) {
    combo = {
      ...combo,
      request: { ...combo.request, country, rankingCountry: country },
    };
  }

  const operators = matchOperatorsForCombo(combo, combo.request);
  const dataSnapshot =
    (resolved.ok && resolved.dataSnapshot) ||
    (typeof body.dataSnapshot === "string" ? body.dataSnapshot : "session");

  return {
    status: "success",
    requestId,
    combo: toPublicCombo(combo),
    operators: toPublicOperators(operators),
    alternatives: [],
    meta: metaFor(dataSnapshot, combo),
  };
}

export function apiComboDiagnostics(
  requestId = createComboRequestId()
): PublicDiagnostics {
  const started = Date.now();
  const prepared = getPreparedComboData();
  const request = defaultComboRequest();

  let candidates: ComboCandidate[] = [];
  if (prepared?.fixtures?.length) {
    candidates = buildCandidatesFromFixtures(
      prepared.fixtures,
      request,
      prepared.oddsLookup
    );
  } else if (prepared?.lists) {
    candidates = buildCandidatesFromDailyLists(
      prepared.lists,
      request,
      prepared.oddsLookup
    );
  }

  const { qualified, rejected } = applyEvidenceGates(candidates, request);
  const diagnostics = buildComboDiagnostics({
    candidates,
    qualified,
    rejected,
    request,
  });
  const durationMs = Date.now() - started;

  let unknownAvailabilityCount = 0;
  if (qualified.length >= 2) {
    const optimized = optimizeCombo(qualified, request);
    const sampleCombo =
      optimized.status === "success"
        ? optimized.combo
        : optimized.closest ?? buildEvidenceCombo(qualified.slice(0, 2), request);
    const operators = matchOperatorsForCombo(sampleCombo, request);
    unknownAvailabilityCount = operators.filter(
      (op) => op.availability === "unknown"
    ).length;
  }

  return {
    status: diagnostics.status,
    requestId,
    candidateFixtures: diagnostics.candidateFixtures,
    qualifiedSelections: diagnostics.qualifiedSelections,
    rejectedSelections: diagnostics.rejectedSelections,
    rejectionReasons: diagnostics.rejectionReasons,
    marketCoverage: diagnostics.marketCoverage,
    targetRangeCoverage: diagnostics.targetRangeCoverage,
    operatorFullMatchCoverage: diagnostics.operatorFullMatchCoverage,
    unknownAvailabilityCount,
    staleOdds: diagnostics.staleOdds,
    cache: diagnostics.cache,
    optimizer: {
      exploredSample: diagnostics.optimizerExploredSample,
      durationMs,
    },
    generatedAt: diagnostics.generatedAt,
  };
}

export function comboApiRateLimited(
  requestId: string,
  retryAfterSec: number
): ComboApiRateLimited {
  return {
    status: "rate_limited",
    requestId,
    message: "Too many combo requests — try again shortly",
    retryAfterSec,
  };
}

// Re-export prepared helpers for tests / SSR prep (not for route provider calls).
export {
  setPreparedComboData,
  getPreparedComboData,
  clearPreparedComboData,
};
