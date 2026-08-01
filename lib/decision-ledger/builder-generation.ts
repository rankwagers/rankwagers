import "server-only";
import type {
  AccaBuilderCandidate,
  AccaBuilderResult,
} from "@/lib/acca-builder/contracts";
import { appendLedgerEvent } from "./append";
import { buildIdempotencyKey } from "./idempotency";
import {
  combinationAggregateId,
  generationAggregateId,
} from "./identifiers";
import {
  BUILDER_SNAPSHOT_VERSION,
  COMBINATION_SETTLEMENT_RULE_VERSION,
} from "./versions";
import { LEDGER_MAX_CANDIDATES_PER_GENERATION } from "./contracts";

function slimCandidate(c: AccaBuilderCandidate, rank: number | null) {
  return {
    candidateId: c.id,
    matchId: c.matchId,
    homeTeam: c.homeTeam,
    awayTeam: c.awayTeam,
    competition: c.competition,
    countryCode: c.countryCode,
    kickoffAt: c.kickoffAt,
    marketKey: c.marketKey,
    selectionKey: c.selectionKey,
    confidence: c.confidence,
    confidenceSemantics: "CALIBRATABLE_PROBABILITY",
    evidenceCompleteness: c.evidenceCompleteness,
    evidenceSummary: c.evidenceSummary.slice(0, 6),
    score: c.score,
    scoreParts: c.scoreParts,
    eligible: c.eligible,
    exclusionReasons: c.exclusionReasons,
    rankingPosition: rank,
    odds: c.odds,
    oddsFreshness: c.oddsFreshness,
    oddsFetchedAt: c.oddsFetchedAt,
  };
}

export async function recordBuilderGenerationToLedger(input: {
  result: AccaBuilderResult;
  candidates: AccaBuilderCandidate[];
  requestId?: string | null;
}): Promise<{ ok: boolean; events: number }> {
  const { result, candidates } = input;
  const genAgg = generationAggregateId(result.snapshotId);
  let events = 0;

  const req = await appendLedgerEvent({
    eventType: "BUILDER_GENERATION_REQUESTED",
    aggregateType: "builder_generation",
    aggregateId: genAgg,
    occurredAt: result.generatedAt,
    source: "acca_builder_api",
    requestId: input.requestId ?? result.requestId,
    idempotencyKey: buildIdempotencyKey([
      "BUILDER_GENERATION_REQUESTED",
      result.snapshotId,
      result.requestId,
    ]),
    payload: {
      generationId: result.snapshotId,
      builderSnapshotVersion: BUILDER_SNAPSHOT_VERSION,
      locale: result.configuration.locale,
      riskMode: result.configuration.riskMode,
      legCount: result.configuration.legCount,
      targetOddsMin: result.configuration.targetOddsMin,
      targetOddsMax: result.configuration.targetOddsMax,
      configuration: {
        minConfidence: result.configuration.minConfidence,
        markets: result.configuration.markets,
        oneSelectionPerFixture: result.configuration.oneSelectionPerFixture,
      },
    },
  });
  if (req.ok && req.appended) events += 1;

  const bounded = candidates.slice(0, LEDGER_MAX_CANDIDATES_PER_GENERATION);
  const eligibleSorted = [...bounded]
    .filter((c) => c.eligible)
    .sort((a, b) => b.score - a.score);

  for (const c of bounded) {
    const rank = c.eligible
      ? eligibleSorted.findIndex((x) => x.id === c.id) + 1
      : null;
    const slim = slimCandidate(c, rank && rank > 0 ? rank : null);
    const snap = await appendLedgerEvent({
      eventType: "BUILDER_CANDIDATE_SNAPSHOT_RECORDED",
      aggregateType: "builder_generation",
      aggregateId: genAgg,
      occurredAt: result.generatedAt,
      source: "acca_builder_api",
      requestId: input.requestId ?? result.requestId,
      idempotencyKey: buildIdempotencyKey([
        "BUILDER_CANDIDATE_SNAPSHOT_RECORDED",
        result.snapshotId,
        c.id,
      ]),
      payload: { generationId: result.snapshotId, ...slim },
      correlationId: result.snapshotId,
    });
    if (snap.ok && snap.appended) events += 1;

    if (!c.eligible && c.exclusionReasons.length) {
      const excl = await appendLedgerEvent({
        eventType: "BUILDER_CANDIDATE_EXCLUDED",
        aggregateType: "builder_generation",
        aggregateId: genAgg,
        occurredAt: result.generatedAt,
        source: "acca_builder_api",
        requestId: input.requestId ?? result.requestId,
        idempotencyKey: buildIdempotencyKey([
          "BUILDER_CANDIDATE_EXCLUDED",
          result.snapshotId,
          c.id,
          c.exclusionReasons.join(","),
        ]),
        payload: {
          generationId: result.snapshotId,
          candidateId: c.id,
          exclusionReasons: c.exclusionReasons,
          matchId: c.matchId,
          marketKey: c.marketKey,
        },
        correlationId: result.snapshotId,
      });
      if (excl.ok && excl.appended) events += 1;
    }
  }

  for (const combo of result.combinations) {
    const comboAgg = combinationAggregateId(combo.id);
    const created = await appendLedgerEvent({
      eventType: "BUILDER_COMBINATION_CREATED",
      aggregateType: "builder_combination",
      aggregateId: comboAgg,
      occurredAt: result.generatedAt,
      source: "acca_builder_api",
      requestId: input.requestId ?? result.requestId,
      idempotencyKey: buildIdempotencyKey([
        "BUILDER_COMBINATION_CREATED",
        result.snapshotId,
        combo.id,
      ]),
      payload: {
        combinationId: combo.id,
        generationId: result.snapshotId,
        label: combo.label,
        riskMode: combo.riskMode,
        legCount: combo.legCount,
        legCandidateIds: combo.legs.map((l) => l.id),
        legs: combo.legs.map((l) => slimCandidate(l, null)),
        score: combo.score,
        averageConfidence: combo.averageConfidence,
        evidenceCompleteness: combo.evidenceCompleteness,
        correlationWarnings: combo.correlationWarnings,
        oddsComplete: combo.oddsComplete,
        combinedOdds: combo.combinedOdds,
        combinationSettlementRuleVersion: COMBINATION_SETTLEMENT_RULE_VERSION,
        builderSnapshotVersion: BUILDER_SNAPSHOT_VERSION,
      },
      correlationId: result.snapshotId,
    });
    if (created.ok && created.appended) events += 1;
  }

  const completedType =
    result.status === "success"
      ? "BUILDER_GENERATION_COMPLETED"
      : result.status === "error"
        ? "BUILDER_GENERATION_FAILED"
        : "BUILDER_GENERATION_COMPLETED";

  const done = await appendLedgerEvent({
    eventType: completedType,
    aggregateType: "builder_generation",
    aggregateId: genAgg,
    occurredAt: result.generatedAt,
    source: "acca_builder_api",
    requestId: input.requestId ?? result.requestId,
    idempotencyKey: buildIdempotencyKey([
      completedType,
      result.snapshotId,
      result.status,
    ]),
    payload: {
      generationId: result.snapshotId,
      status: result.status,
      candidateCount: result.candidateCount,
      eligibleCount: result.eligibleCount,
      excludedCount: result.excludedCount,
      exclusionSummary: result.exclusionSummary,
      combinationIds: result.combinations.map((c) => c.id),
      candidatesPersisted: bounded.length,
      candidatesTruncated: Math.max(
        0,
        candidates.length - LEDGER_MAX_CANDIDATES_PER_GENERATION,
      ),
    },
    correlationId: result.snapshotId,
  });
  if (done.ok && done.appended) events += 1;

  return { ok: true, events };
}

export async function recordBuilderTransferToLedger(input: {
  generationId: string;
  combinationId: string;
  mode: "merge" | "replace";
  acceptedLegIds: string[];
  correlationId?: string | null;
  requestId?: string | null;
}): Promise<{ ok: boolean }> {
  const eventType =
    input.mode === "merge"
      ? "BUILDER_TRANSFER_MERGED"
      : "BUILDER_TRANSFER_REPLACED";
  const transferred = await appendLedgerEvent({
    eventType: "BUILDER_COMBINATION_TRANSFERRED",
    aggregateType: "builder_combination",
    aggregateId: combinationAggregateId(input.combinationId),
    source: "acca_studio_transfer",
    requestId: input.requestId ?? null,
    idempotencyKey: buildIdempotencyKey([
      "BUILDER_COMBINATION_TRANSFERRED",
      input.generationId,
      input.combinationId,
      input.mode,
      input.correlationId ?? "",
    ]),
    payload: {
      generationId: input.generationId,
      combinationId: input.combinationId,
      transferMode: input.mode,
      acceptedLegIds: input.acceptedLegIds,
      studioCorrelationId: input.correlationId
        ? input.correlationId.slice(0, 32)
        : null,
    },
    correlationId: input.correlationId ?? input.generationId,
  });
  const modeEvt = await appendLedgerEvent({
    eventType,
    aggregateType: "builder_combination",
    aggregateId: combinationAggregateId(input.combinationId),
    source: "acca_studio_transfer",
    requestId: input.requestId ?? null,
    idempotencyKey: buildIdempotencyKey([
      eventType,
      input.generationId,
      input.combinationId,
      input.correlationId ?? "",
    ]),
    payload: {
      generationId: input.generationId,
      combinationId: input.combinationId,
      acceptedLegIds: input.acceptedLegIds,
    },
    correlationId: input.correlationId ?? input.generationId,
  });
  return { ok: transferred.ok && modeEvt.ok };
}

export async function recordStudioHandoffToLedger(input: {
  operatorSlug: string;
  placement: string;
  redirectResult: "created" | "failed";
  requestId?: string | null;
  generationId?: string | null;
  combinationId?: string | null;
  correlationId?: string | null;
}): Promise<{ ok: boolean }> {
  const type =
    input.redirectResult === "created"
      ? "STUDIO_HANDOFF_CREATED"
      : "STUDIO_HANDOFF_FAILED";
  const res = await appendLedgerEvent({
    eventType: type,
    aggregateType: "studio_handoff",
    aggregateId: `handoff:${input.requestId ?? "unknown"}:${input.operatorSlug}`,
    source: "acca_studio_operators",
    requestId: input.requestId ?? null,
    idempotencyKey: buildIdempotencyKey([
      type,
      input.requestId ?? "",
      input.operatorSlug,
      input.placement,
    ]),
    payload: {
      operatorSlug: input.operatorSlug,
      placement: input.placement,
      redirectResult: input.redirectResult,
      generationId: input.generationId ?? null,
      combinationId: input.combinationId ?? null,
      // Never store signed token / ctx
      tokenStored: false,
    },
    correlationId: input.correlationId ?? null,
    provenanceConfidence: "VERIFIED",
  });
  return { ok: res.ok };
}
