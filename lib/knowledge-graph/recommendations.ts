import type { Locale } from "@/lib/i18n";
import { entityId, type GraphEntityType } from "./entity";
import { getKnowledgeGraph } from "./graph";
import { localizeEntityHref, type GraphNavItem } from "./navigation";

export type GraphRecommendations = {
  relatedFixtures: GraphNavItem[];
  relatedOperators: GraphNavItem[];
  relatedMarkets: GraphNavItem[];
  relatedCompetitions: GraphNavItem[];
  relatedEvidence: GraphNavItem[];
  relatedOdds: GraphNavItem[];
  relatedCountries: GraphNavItem[];
  /** Future-ready buckets (may be empty until those registries exist). */
  relatedTeams: GraphNavItem[];
  relatedPlayers: GraphNavItem[];
};

function mapItems(
  locale: Locale,
  type: GraphEntityType,
  slug: string,
  targetType: GraphEntityType,
  limit: number
): GraphNavItem[] {
  const graph = getKnowledgeGraph();
  return graph.relatedEntities(entityId(type, slug), [targetType], limit).map((entity) => ({
    id: entity.id,
    type: entity.type,
    title: entity.title,
    href: localizeEntityHref(locale, entity),
    kind: "related",
  }));
}

export function recommendRelated(
  type: GraphEntityType,
  slug: string,
  locale: Locale,
  limit = 6
): GraphRecommendations {
  return {
    relatedFixtures: mapItems(locale, type, slug, "fixture", limit),
    relatedOperators: mapItems(locale, type, slug, "operator", limit),
    relatedMarkets: mapItems(locale, type, slug, "market", limit),
    relatedCompetitions: mapItems(locale, type, slug, "competition", limit),
    relatedEvidence: mapItems(locale, type, slug, "evidence", limit),
    relatedOdds: mapItems(locale, type, slug, "odds", limit),
    relatedCountries: mapItems(locale, type, slug, "country", limit),
    relatedTeams: mapItems(locale, type, slug, "team", limit),
    relatedPlayers: mapItems(locale, type, slug, "player", limit),
  };
}
