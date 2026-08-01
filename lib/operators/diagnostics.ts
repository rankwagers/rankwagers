import { getAttributionStore } from "@/lib/combo/attribution";
import { getFixtureMappingStats } from "./fixture-mapping";
import { bookmakerMappingStats, listBookmakerMappings } from "./bookmaker-mapping";
import { marketMappingStats } from "./market-mapping";
import { deeplinkCapabilityStats } from "./deeplink-registry";
import { postbackAdapterStats } from "@/lib/affiliate/postbacks";
import { validateOperatorIntegrationConfig } from "./config-validation";
import { listOperators } from "./registry";

export type OperatorsDiagnosticsPayload = {
  generatedAt: string;
  totalOperators: number;
  mappedShells: number;
  bookmakerMappings: ReturnType<typeof bookmakerMappingStats>;
  marketMappings: ReturnType<typeof marketMappingStats>;
  fixtureMapping: ReturnType<typeof getFixtureMappingStats>;
  deeplinkCapabilities: ReturnType<typeof deeplinkCapabilityStats>;
  availabilityNote: string;
  config: ReturnType<typeof validateOperatorIntegrationConfig>;
};

export function buildOperatorsDiagnostics(): OperatorsDiagnosticsPayload {
  const mappings = listBookmakerMappings();
  return {
    generatedAt: new Date().toISOString(),
    totalOperators: listOperators().length,
    mappedShells: mappings.length,
    bookmakerMappings: bookmakerMappingStats(mappings),
    marketMappings: marketMappingStats(),
    fixtureMapping: getFixtureMappingStats(),
    deeplinkCapabilities: deeplinkCapabilityStats(),
    availabilityNote:
      "Unverified shells with empty providerBookmakerIds resolve selection availability to unknown.",
    config: validateOperatorIntegrationConfig(),
  };
}

export type AffiliateDiagnosticsPayload = {
  generatedAt: string;
  postbackAdapters: ReturnType<typeof postbackAdapterStats>;
  attribution: Awaited<ReturnType<ReturnType<typeof getAttributionStore>["stats"]>>;
  conversionsNote: string;
};

export async function buildAffiliateDiagnostics(): Promise<AffiliateDiagnosticsPayload> {
  const attribution = await getAttributionStore().stats();
  return {
    generatedAt: new Date().toISOString(),
    postbackAdapters: postbackAdapterStats(),
    attribution,
    conversionsNote:
      attribution.conversionCount === 0
        ? "No real conversion data — FTD/revenue metrics are not estimated."
        : "Conversion totals reflect accepted postbacks only.",
  };
}
