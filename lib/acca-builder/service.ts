import type { DailyMatchLists, MatchListKind } from "@/lib/footystats/types";
import type {
  AccaBuilderCandidate,
  AccaBuilderConfig,
  AccaBuilderResult,
} from "./contracts";
import { ACCA_BUILDER_MAX_CANDIDATES } from "./contracts";
import { RISK_MODE_RULES } from "./config";
import { generateCombinations } from "./combinations";
import { applyEligibility } from "./eligibility";
import { normalizeListRow } from "./normalize";
import { scoreCandidate, sortByScore } from "./scoring";

/** Deterministic short snapshot id — browser + Node safe (no node:crypto). */
function snapshotHash(payload: string): string {
  let h = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function mintRequestId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `req_${rand}`;
}

export type OddsLookup = {
  get: (
    matchId: number,
    marketKey: string
  ) => { decimal: number; fetchedAt?: string } | null;
};

export type BuildAccaInput = {
  config: AccaBuilderConfig;
  lists: DailyMatchLists;
  oddsLookup?: OddsLookup;
  requestId?: string;
  now?: number;
};

const MARKET_TABS: MatchListKind[] = ["over15", "over25", "fh", "sh"];

export function buildAccaCombinations(input: BuildAccaInput): AccaBuilderResult {
  const now = input.now ?? Date.now();
  const requestId = input.requestId ?? mintRequestId();
  const snapshotId = `snap_${snapshotHash(
    JSON.stringify({
      date: input.lists.date,
      fetchedAt: input.lists.fetchedAt,
      config: input.config,
    })
  )}`;

  const raw: AccaBuilderCandidate[] = [];
  for (const tab of MARKET_TABS) {
    if (!input.config.markets.includes(tab)) continue;
    for (const row of input.lists[tab]) {
      if (row.isFinished) continue;
      if (!input.config.includeLive && row.isLive) continue;
      const oddsKey =
        tab === "over15"
          ? "over15"
          : tab === "over25"
            ? "over25"
            : tab === "fh"
              ? "fh"
              : "sh";
      const odds = input.oddsLookup?.get(row.matchId, oddsKey) ?? null;
      const normalized = normalizeListRow(
        row,
        tab,
        input.config.locale,
        odds,
        now
      );
      if (normalized) raw.push(normalized);
    }
  }

  const gated = raw.map((c) =>
    scoreCandidate(applyEligibility(c, input.config, now), input.config, now)
  );
  const exclusionSummary: Record<string, number> = {};
  for (const c of gated) {
    for (const reason of c.exclusionReasons) {
      exclusionSummary[reason] = (exclusionSummary[reason] ?? 0) + 1;
    }
  }

  const eligible = sortByScore(gated.filter((c) => c.eligible)).slice(
    0,
    ACCA_BUILDER_MAX_CANDIDATES
  );

  const warnings: string[] = [];
  if (!input.oddsLookup) {
    warnings.push("Odds enrichment unavailable — combinations may omit combined odds.");
  }
  const rules = RISK_MODE_RULES[input.config.riskMode];
  warnings.push(rules.description);

  if (!gated.length) {
    return {
      status: "no_candidates",
      snapshotId,
      generatedAt: new Date(now).toISOString(),
      requestId,
      configuration: input.config,
      providerAvailability: {
        footystatsLists: "empty",
        oddsEnrichment: input.oddsLookup ? "partial" : "unavailable",
        archiveHistory: "skipped",
      },
      dataFreshness: {
        listsFetchedAt: input.lists.fetchedAt ?? null,
        listsDate: input.lists.date,
      },
      candidateCount: 0,
      eligibleCount: 0,
      excludedCount: 0,
      exclusionSummary,
      combinations: [],
      warnings,
      diagnostics: {
        message: "No published list-market rows were available for this window.",
      },
    };
  }

  if (!eligible.length) {
    return {
      status: "no_candidates",
      snapshotId,
      generatedAt: new Date(now).toISOString(),
      requestId,
      configuration: input.config,
      providerAvailability: {
        footystatsLists: "ok",
        oddsEnrichment: input.oddsLookup ? "partial" : "unavailable",
        archiveHistory: "skipped",
      },
      dataFreshness: {
        listsFetchedAt: input.lists.fetchedAt ?? null,
        listsDate: input.lists.date,
      },
      candidateCount: gated.length,
      eligibleCount: 0,
      excludedCount: gated.length,
      exclusionSummary,
      combinations: [],
      warnings,
      diagnostics: {
        message: "Candidates existed but none passed eligibility gates.",
        details: Object.entries(exclusionSummary)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k, v]) => `${k}: ${v}`),
      },
    };
  }

  const combinations = generateCombinations(eligible, input.config);
  if (!combinations.length) {
    return {
      status: "no_combination",
      snapshotId,
      generatedAt: new Date(now).toISOString(),
      requestId,
      configuration: input.config,
      providerAvailability: {
        footystatsLists: "ok",
        oddsEnrichment: input.oddsLookup ? "partial" : "unavailable",
        archiveHistory: "skipped",
      },
      dataFreshness: {
        listsFetchedAt: input.lists.fetchedAt ?? null,
        listsDate: input.lists.date,
      },
      candidateCount: gated.length,
      eligibleCount: eligible.length,
      excludedCount: gated.length - eligible.length,
      exclusionSummary,
      combinations: [],
      warnings,
      diagnostics: {
        message: `Not enough non-conflicting legs to build a ${input.config.legCount}-fold Acca.`,
        details: [`Eligible candidates: ${eligible.length}`],
      },
    };
  }

  return {
    status: "success",
    snapshotId,
    generatedAt: new Date(now).toISOString(),
    requestId,
    configuration: input.config,
    providerAvailability: {
      footystatsLists: "ok",
      oddsEnrichment: input.oddsLookup ? "ok" : "unavailable",
      archiveHistory: "skipped",
    },
    dataFreshness: {
      listsFetchedAt: input.lists.fetchedAt ?? null,
      listsDate: input.lists.date,
    },
    candidateCount: gated.length,
    eligibleCount: eligible.length,
    excludedCount: gated.length - eligible.length,
    exclusionSummary,
    combinations,
    warnings,
    diagnostics: {
      message: `Generated ${combinations.length} combination(s) from ${eligible.length} eligible candidates.`,
    },
  };
}
