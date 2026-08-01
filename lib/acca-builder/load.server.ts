import "server-only";
import { createMapOddsLookup } from "@/lib/combo/candidates";
import { prepareComboData } from "@/lib/combo/prepare";
import { emptyLists } from "@/lib/footystats/client";
import type { AccaBuilderConfig, AccaBuilderResult } from "./contracts";
import { buildAccaCombinations } from "./service";

/**
 * Server entry: one snapshot load (FootyStats lists + bounded odds enrichment),
 * then pure domain generation. Expected provider volume ≈ 1 list fetch + ≤16 odds lookups.
 */
export async function runAccaBuilder(input: {
  config: AccaBuilderConfig;
  requestId: string;
}): Promise<AccaBuilderResult> {
  const { prepared, client } = await prepareComboData({
    locale: input.config.locale,
    enrichOdds: true,
    maxOddsLookups: 16,
    persist: false,
  });

  const lists = prepared.lists ?? emptyLists();
  const oddsLookup =
    prepared.oddsLookup ??
    createMapOddsLookup(
      client.odds.map((o) => ({
        matchId: o.matchId,
        oddsKey: o.oddsKey,
        decimal: o.decimal,
        fetchedAt: o.fetchedAt,
      }))
    );

  const result = buildAccaCombinations({
    config: input.config,
    lists,
    oddsLookup: client.oddsCount > 0 ? oddsLookup : undefined,
    requestId: input.requestId,
  });

  return {
    ...result,
    providerAvailability: {
      ...result.providerAvailability,
      footystatsLists: client.empty
        ? "empty"
        : result.providerAvailability.footystatsLists,
      oddsEnrichment:
        client.oddsCount === 0
          ? "unavailable"
          : client.oddsCount < Math.min(16, client.fixtureCount)
            ? "partial"
            : "ok",
    },
  };
}
