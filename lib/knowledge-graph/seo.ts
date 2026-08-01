import type { Locale } from "@/lib/i18n";
import type { GraphEntityType } from "./entity";
import { buildEntityNavigation, localizeEntityHref } from "./navigation";
import { recommendRelated } from "./recommendations";
import { getKnowledgeGraph } from "./graph";
import { entityId } from "./entity";

/** Breadcrumb trail from the knowledge graph (canonical-consistent). */
export function graphBreadcrumbItems(
  type: GraphEntityType,
  slug: string,
  locale: Locale
): Array<{ name: string; path: string }> {
  const nav = buildEntityNavigation(type, slug, locale);
  if (!nav) return [];
  return nav.breadcrumbs.map((item) => ({
    name: item.title,
    path: item.href,
  }));
}

/** Related entity URLs for internal linking / crawl surfaces. */
export function graphRelatedLinkList(
  type: GraphEntityType,
  slug: string,
  locale: Locale
): Array<{ name: string; url: string; type: GraphEntityType }> {
  const related = recommendRelated(type, slug, locale, 8);
  const buckets = [
    ...related.relatedCompetitions,
    ...related.relatedMarkets,
    ...related.relatedOperators,
    ...related.relatedTeams,
    ...related.relatedFixtures,
    ...related.relatedEvidence,
    ...related.relatedOdds,
  ];
  const seen = new Set<string>();
  return buckets
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .map((item) => ({
      name: item.title,
      url: item.href,
      type: item.type,
    }));
}

export function graphCanonicalPath(
  type: GraphEntityType,
  slug: string,
  locale: Locale
): string | null {
  const entity = getKnowledgeGraph().getEntity(entityId(type, slug));
  if (!entity) return null;
  return localizeEntityHref(locale, entity);
}
