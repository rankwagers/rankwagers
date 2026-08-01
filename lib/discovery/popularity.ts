import {
  buildSearchDiagnosticsBase,
  getPopularityWeight,
} from "@/lib/search/analytics";
import { getSearchIndex } from "@/lib/search/indexer";
import { resolveSearchLocale } from "@/lib/search/filters";
import { localizeEntityHref } from "@/lib/knowledge-graph/navigation";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { entityId } from "@/lib/knowledge-graph/entity";
import { getCachedPopular, setCachedPopular } from "./cache";
import type { DiscoveryEntityType, RecommendationItem } from "./types";
import { DISCOVERY_ENTITY_TYPES } from "./types";

const PUBLIC_TYPES = new Set<string>(DISCOVERY_ENTITY_TYPES);

export function popularityFor(entityType: string, slug: string): number {
  return getPopularityWeight(entityType, slug);
}

/**
 * Analytics-only popular research. Cold start falls back to graph connectivity
 * via the search index — never editorial lists.
 */
export function buildPopularResearchItems(
  localeInput: string,
  limit = 8
): RecommendationItem[] {
  const locale = resolveSearchLocale(localeInput);
  const cached = getCachedPopular(locale);
  if (cached && cached.length) {
    return cached.slice(0, limit).map((item, index) => ({ ...item, position: index }));
  }
  const index = getSearchIndex();
  const diagnostics = buildSearchDiagnosticsBase();

  const scored = [...index.documents]
    .filter((doc) => doc.searchable && doc.active && PUBLIC_TYPES.has(doc.entityType))
    .map((doc) => ({
      doc,
      weight: Math.max(doc.popularityWeight, getPopularityWeight(doc.entityType, doc.slug)),
    }))
    .sort((a, b) => b.weight - a.weight || b.doc.graphScore - a.doc.graphScore);

  const withAnalytics = scored.filter((row) => row.weight > 0).slice(0, limit);
  const source = withAnalytics.length
    ? withAnalytics
    : scored.slice(0, limit);

  // Prefer click leaders when present.
  const byKey = new Map(index.documents.map((doc) => [`${doc.entityType}:${doc.slug}`, doc]));
  const clickLeaders: typeof source = [];
  for (const row of diagnostics.mostClickedEntities) {
    const doc = byKey.get(`${row.entityType}:${row.entitySlug}`);
    if (!doc || !PUBLIC_TYPES.has(doc.entityType)) continue;
    clickLeaders.push({
      doc,
      weight: Math.max(doc.popularityWeight, getPopularityWeight(doc.entityType, doc.slug)),
    });
    if (clickLeaders.length >= limit) break;
  }

  const chosen = clickLeaders.length ? clickLeaders : source;
  const graph = getKnowledgeGraph();

  const items: RecommendationItem[] = chosen.map((row, index) => {
    const entity = graph.getEntity(entityId(row.doc.entityType, row.doc.slug));
    const href = entity
      ? localizeEntityHref(locale, entity)
      : `/${locale}${row.doc.pathTemplate}`;
    return {
      entityType: row.doc.entityType as DiscoveryEntityType,
      slug: row.doc.slug,
      title: row.doc.title,
      href,
      reason: row.weight > 0 ? "analytics_popularity" : "graph_connectivity",
      relationship: "related",
      position: index,
    };
  });

  setCachedPopular(locale, items);
  return items;
}

export function mostExploredEntities(limit = 10): Array<{ key: string; count: number }> {
  const diagnostics = buildSearchDiagnosticsBase();
  return diagnostics.mostClickedEntities
    .slice(0, limit)
    .map((row) => ({
      key: `${row.entityType}:${row.entitySlug}`,
      count: row.count,
    }));
}
