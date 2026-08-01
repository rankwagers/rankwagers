import type { Locale } from "@/lib/i18n";
import { localizeEntityHref } from "@/lib/knowledge-graph/navigation";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { entityId } from "@/lib/knowledge-graph/entity";
import { isOperatorResultVisible } from "@/lib/search/filters";
import { isDiscoverableEntity } from "./integrity";
import { rankCandidates } from "./ranking";
import { popularityFor } from "./popularity";
import { freshnessFor, integrityScoreFor } from "./integrity";
import type {
  DiscoveryEntityType,
  DiscoveryPanelSection,
  RankedCandidate,
  RecommendationItem,
  TraversalHit,
} from "./types";
import { RELATED_PANEL_LABELS, RELATED_PANEL_ORDER } from "./types";

function toItem(
  candidate: RankedCandidate,
  locale: Locale,
  position: number
): RecommendationItem | null {
  if (!isDiscoverableEntity(candidate.entityType, candidate.slug)) return null;

  const graph = getKnowledgeGraph();
  const entity = graph.getEntity(entityId(candidate.entityType, candidate.slug));
  if (!entity) return null;

  return {
    entityType: candidate.entityType as DiscoveryEntityType,
    slug: candidate.slug,
    title: candidate.title,
    href: localizeEntityHref(locale, entity),
    reason: `${candidate.relationship} · distance ${candidate.distance}`,
    relationship: candidate.relationship,
    position,
  };
}

export function filterHitsForCountry(
  hits: readonly TraversalHit[],
  country: string | null | undefined
): TraversalHit[] {
  return hits.filter((hit) => {
    if (hit.entityType !== "operator") return true;
    return isOperatorResultVisible(hit.slug, country);
  });
}

/** Bucket ranked candidates into Related-* panels. No entity-specific logic. */
export function buildRelatedPanels(
  hits: readonly TraversalHit[],
  locale: Locale,
  country: string | null | undefined,
  limitPerPanel: number
): DiscoveryPanelSection[] {
  const filtered = filterHitsForCountry(hits, country);
  const ranked = rankCandidates(filtered, {
    popularity: popularityFor,
    integrity: integrityScoreFor,
    freshness: freshnessFor,
  }).filter((row) => isDiscoverableEntity(row.entityType, row.slug));

  const sections: DiscoveryPanelSection[] = [];

  for (const type of RELATED_PANEL_ORDER) {
    const rows = ranked.filter((row) => row.entityType === type).slice(0, limitPerPanel);
    const items: RecommendationItem[] = [];
    for (const row of rows) {
      if (type === "operator" && !isOperatorResultVisible(row.slug, country)) continue;
      const item = toItem(row, locale, items.length);
      if (item) items.push(item);
    }
    if (!items.length) continue;
    sections.push({
      id: `related-${type}`,
      title: RELATED_PANEL_LABELS[type],
      items,
    });
  }

  return sections;
}
