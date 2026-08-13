import type { SearchGroupKey } from "./types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";

/*
 * Localized search group labels — pure, takes the dictionary as an argument
 * so client components can receive the result WITHOUT the 30-locale
 * dictionary graph entering the client bundle (the formatDict lesson).
 * lib/search/types.ts keeps SEARCH_GROUP_LABELS as the documented EN set the
 * indexer uses internally; readers see these.
 */
export function searchGroupLabels(p: PredictionStrings): Record<SearchGroupKey, string> {
  return {
    competition: p.cmpIndexTitle,
    season: p.cmpSeasonsTitle,
    team: p.tmIndexTitle,
    fixture: p.nvFixtures,
    market: p.nvMarkets,
    operator: p.opIndexTitle,
    country: p.nvCountries,
  };
}
