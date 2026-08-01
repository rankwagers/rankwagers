import type { GraphEntityType } from "@/lib/knowledge-graph/entity";
import { entityId } from "@/lib/knowledge-graph/entity";
import { getKnowledgeGraph } from "@/lib/knowledge-graph/graph";
import { localizeEntityHref } from "@/lib/knowledge-graph/navigation";
import { resolveSearchLocale } from "@/lib/search/filters";
import { isOperatorResultVisible } from "@/lib/search/filters";
import {
  discoveryCacheKey,
  getCachedRecommendation,
  setCachedRecommendation,
} from "./cache";
import { traverseFromEntity } from "./graph";
import { buildRelatedPanels, filterHitsForCountry } from "./recommendations";
import { buildPopularResearchItems } from "./popularity";
import { isDiscoverableEntity } from "./integrity";
import {
  recordRecommendationServe,
  recordTraversalDuration,
} from "./analytics";
import type {
  ContinueExploringStep,
  DiscoveryBundle,
  DiscoveryEntityRef,
  DiscoveryEntityType,
  RecommendOptions,
  RecommendationItem,
} from "./types";
import { CONTINUE_TYPE_ORDER } from "./types";

const DEFAULT_DEPTH = 2;
const DEFAULT_LIMIT = 6;

function asDiscoveryType(type: string): type is DiscoveryEntityType {
  return (
    type === "competition" ||
    type === "season" ||
    type === "team" ||
    type === "fixture" ||
    type === "market" ||
    type === "operator"
  );
}

/**
 * Deterministic Continue Exploring path: prefer unused types in
 * Competition → Season → Team → Market → Operator order.
 */
export function buildContinueExploring(
  type: GraphEntityType,
  slug: string,
  localeInput: string,
  country?: string | null,
  maxHops = 5
): ContinueExploringStep[] {
  const locale = resolveSearchLocale(localeInput);
  const graph = getKnowledgeGraph();
  const steps: ContinueExploringStep[] = [];
  const usedTypes = new Set<string>([type]);
  let currentType: GraphEntityType = type;
  let currentSlug = slug;

  for (let hop = 1; hop <= maxHops; hop += 1) {
    const hits = filterHitsForCountry(
      traverseFromEntity(currentType, currentSlug, 2),
      country
    ).filter(
      (hit) =>
        asDiscoveryType(hit.entityType) &&
        isDiscoverableEntity(hit.entityType, hit.slug) &&
        !(hit.entityType === currentType && hit.slug === currentSlug)
    );

    let next = hits.find(
      (hit) =>
        CONTINUE_TYPE_ORDER.includes(hit.entityType as (typeof CONTINUE_TYPE_ORDER)[number]) &&
        !usedTypes.has(hit.entityType)
    );

    if (!next) {
      next = hits.find((hit) => !usedTypes.has(hit.entityType)) ?? hits[0];
    }
    if (!next) break;

    const entity = graph.getEntity(entityId(next.entityType, next.slug));
    if (!entity) break;

    if (next.entityType === "operator" && !isOperatorResultVisible(next.slug, country)) {
      usedTypes.add(next.entityType);
      continue;
    }

    const item: ContinueExploringStep = {
      entityType: next.entityType as DiscoveryEntityType,
      slug: next.slug,
      title: next.title,
      href: localizeEntityHref(locale, entity),
      reason: next.relationship,
      relationship: next.relationship,
      position: hop - 1,
      hop,
    };
    steps.push(item);
    usedTypes.add(next.entityType);
    currentType = next.entityType;
    currentSlug = next.slug;
  }

  return steps;
}

/** Central recommendation engine — no entity-specific branches. */
export function recommendForEntity(
  seed: DiscoveryEntityRef,
  options: RecommendOptions = {}
): DiscoveryBundle {
  const started = performance.now();
  const locale = resolveSearchLocale(options.locale);
  const depth = options.depth ?? DEFAULT_DEPTH;
  const limitPerPanel = options.limitPerPanel ?? DEFAULT_LIMIT;
  const country = options.country ?? null;

  const cacheKey = discoveryCacheKey({
    type: seed.entityType,
    slug: seed.slug,
    locale,
    country,
    depth,
    limitPerPanel,
  });
  const cached = getCachedRecommendation(cacheKey);
  if (cached) {
    const tookMs = Math.round((performance.now() - started) * 100) / 100;
    recordTraversalDuration(tookMs);
    return {
      ...cached,
      meta: { ...cached.meta, tookMs },
    };
  }

  const hits = traverseFromEntity(seed.entityType, seed.slug, depth).filter((hit) => {
    if (options.excludeSeed === false) return true;
    return !(hit.entityType === seed.entityType && hit.slug === seed.slug);
  });

  const related = buildRelatedPanels(hits, locale, country, limitPerPanel);
  const continueExploring = buildContinueExploring(
    seed.entityType,
    seed.slug,
    locale,
    country,
    5
  );
  const popular = buildPopularResearchItems(locale, limitPerPanel).filter(
    (item) => !(item.entityType === seed.entityType && item.slug === seed.slug)
  );

  for (const section of related) {
    recordRecommendationServe(section.id, section.items.length);
  }
  recordRecommendationServe("continue_exploring", continueExploring.length);
  recordRecommendationServe("popular", popular.length);

  const tookMs = Math.round((performance.now() - started) * 100) / 100;
  recordTraversalDuration(tookMs);

  const bundle: DiscoveryBundle = {
    seed,
    related,
    continueExploring,
    popular,
    meta: {
      tookMs,
      depth,
      candidateCount: hits.length,
    },
  };

  setCachedRecommendation(cacheKey, bundle);
  return bundle;
}

/** Compatibility helper for search page related panels. */
export function buildRelatedDiscoveryPanels(
  type: GraphEntityType,
  slug: string,
  localeInput: string,
  limit = 6
): Array<{ id: string; title: string; items: RecommendationItem[] }> {
  if (!asDiscoveryType(type)) return [];
  const bundle = recommendForEntity(
    { entityType: type, slug },
    { locale: localeInput, limitPerPanel: limit, depth: 2 }
  );
  return bundle.related;
}
