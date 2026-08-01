import {
  buildDiscoveryAnalyticsSnapshot,
} from "./analytics";
import {
  discoveryCacheTtlMs,
  peekDiscoveryCacheMeta,
} from "./cache";
import { mostExploredEntities } from "./popularity";
import type { DiscoveryDiagnostics } from "./types";

export function getDiscoveryDiagnostics(): DiscoveryDiagnostics {
  const ttlMs = discoveryCacheTtlMs();
  const cache = peekDiscoveryCacheMeta(ttlMs);
  const snap = buildDiscoveryAnalyticsSnapshot();
  const popular = mostExploredEntities(20);

  return {
    recommendationCounts: snap.recommendationCounts,
    relationshipSources: snap.relationshipSources,
    popularEntities: popular.length ? popular : snap.popularEntities,
    recentlyViewedMetrics: snap.recentlyViewedMetrics,
    ctr: snap.ctr,
    cache: {
      warm: cache.warm,
      builtAt: cache.builtAt,
      ttlMs: cache.ttlMs,
      ageMs: cache.ageMs,
    },
    averageTraversalMs: snap.averageTraversalMs,
    traversalSamples: snap.traversalSamples,
  };
}
