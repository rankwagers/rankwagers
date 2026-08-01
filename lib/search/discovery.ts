/**
 * Compatibility facade — Sprint 13 discovery lives in lib/discovery.
 * Search pages keep importing these helpers without duplication.
 */
import type { GraphEntityType } from "@/lib/knowledge-graph/entity";
import {
  buildContinueExploring,
  buildPopularResearchItems,
  buildRelatedDiscoveryPanels as buildRelatedFromEngine,
  type DiscoveryPanelSection as EngineSection,
  type RecommendationItem,
} from "@/lib/discovery";
import type { SearchGroupKey, SearchResult } from "./types";

export type DiscoveryPanelSection = {
  id: string;
  title: string;
  items: SearchResult[];
};

function toSearchResult(item: RecommendationItem): SearchResult {
  const group = item.entityType as SearchGroupKey;
  return {
    entityType: item.entityType,
    slug: item.slug,
    title: item.title,
    href: item.href,
    group,
  };
}

function toSearchSections(sections: EngineSection[]): DiscoveryPanelSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map(toSearchResult),
  }));
}

export function buildRelatedDiscoveryPanels(
  type: GraphEntityType,
  slug: string,
  localeInput: string,
  limit = 6
): DiscoveryPanelSection[] {
  return toSearchSections(buildRelatedFromEngine(type, slug, localeInput, limit));
}

export function buildPopularResearch(localeInput: string, limit = 8): SearchResult[] {
  return buildPopularResearchItems(localeInput, limit).map(toSearchResult);
}

/** Analytics-backed trending (same popularity pipeline; click leaders preferred). */
export function buildTrendingResearch(localeInput: string, limit = 8): SearchResult[] {
  return buildPopularResearchItems(localeInput, limit).map(toSearchResult);
}

export function buildContinueExploringForSearch(
  type: GraphEntityType,
  slug: string,
  localeInput: string,
  country?: string | null
): SearchResult[] {
  return buildContinueExploring(type, slug, localeInput, country).map(toSearchResult);
}
