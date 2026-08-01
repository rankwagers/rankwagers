import { buildSearchDiagnosticsBase } from "./analytics";
import { peekSearchCacheMeta, searchIndexCacheTtlMs } from "./cache";
import { getSearchIndex } from "./indexer";
import type { SearchDiagnostics } from "./types";

export function getSearchDiagnostics(options?: { force?: boolean }): SearchDiagnostics {
  const index = getSearchIndex({ force: options?.force });
  const ttlMs = searchIndexCacheTtlMs();
  const cache = peekSearchCacheMeta(ttlMs);
  const base = buildSearchDiagnosticsBase();

  return {
    indexSize: index.size,
    entityCounts: index.counts,
    averageLookupMs: base.averageLookupMs,
    lookupSamples: base.lookupSamples,
    topQueries: base.topQueries,
    zeroResultQueries: base.zeroResultQueries,
    mostClickedEntities: base.mostClickedEntities,
    cacheStatus: {
      warm: cache.warm,
      builtAt: cache.builtAt,
      ttlMs: cache.ttlMs,
      ageMs: cache.ageMs,
    },
    discovery: base.discovery,
  };
}
