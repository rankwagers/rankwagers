import type { AnalyticsEventName } from "@/lib/analytics/types";
import { recordEntityView, recordRelationshipClick, recordSearchResultClick } from "@/lib/search/analytics";
export {
  discoveryEventProperties,
  type DiscoveryAnalyticsPayload,
} from "./eventProperties";

export const DISCOVERY_ANALYTICS_EVENTS = [
  "recommendation_impression",
  "recommendation_click",
  "continue_exploring_click",
  "recent_click",
  "popular_click",
] as const satisfies readonly AnalyticsEventName[];

// recommendation_click already exists in analytics types; others are added in Sprint 13.

type CounterMap = Map<string, number>;

const relationshipSources: CounterMap = new Map();
const recommendationCounts: CounterMap = new Map();
let impressions = 0;
let clicks = 0;
let recentWrites = 0;
let recentReads = 0;
const traversalDurations: number[] = [];
const MAX_SAMPLES = 200;

function bump(map: CounterMap, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topN(map: CounterMap, n: number): Array<{ key: string; count: number }> {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, n);
}

export function recordTraversalDuration(ms: number): void {
  traversalDurations.push(ms);
  if (traversalDurations.length > MAX_SAMPLES) traversalDurations.shift();
}

export function averageTraversalMs(): number {
  if (!traversalDurations.length) return 0;
  const sum = traversalDurations.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / traversalDurations.length) * 100) / 100;
}

export function recordRecommendationServe(panelId: string, count: number): void {
  bump(recommendationCounts, panelId, count);
}

export function recordRecommendationImpression(count = 1): void {
  impressions += count;
}

export function recordDiscoveryClick(kind: string, relationship?: string): void {
  clicks += 1;
  bump(recommendationCounts, `click:${kind}`);
  if (relationship) bump(relationshipSources, relationship);
}

export function recordRecentWrite(): void {
  recentWrites += 1;
}

export function recordRecentRead(): void {
  recentReads += 1;
}

/** Ingest discovery + graph events into counters (server-side analytics API). */
export function ingestDiscoveryAnalyticsEvent(input: {
  event_name: string;
  properties?: Record<string, string | number | boolean | null> | undefined;
}): void {
  const props = input.properties ?? {};
  const name = input.event_name;

  const fromType =
    typeof props.from_type === "string"
      ? props.from_type
      : typeof props.entity_type === "string"
        ? props.entity_type
        : undefined;
  const fromSlug =
    typeof props.from_slug === "string"
      ? props.from_slug
      : typeof props.entity_slug === "string"
        ? props.entity_slug
        : undefined;
  const toType =
    typeof props.to_type === "string"
      ? props.to_type
      : typeof props.to_entity_type === "string"
        ? props.to_entity_type
        : typeof props.target_type === "string"
          ? props.target_type
          : undefined;
  const toSlug =
    typeof props.to_slug === "string"
      ? props.to_slug
      : typeof props.to_entity_slug === "string"
        ? props.to_entity_slug
        : typeof props.target_slug === "string"
          ? props.target_slug
          : undefined;

  if (name === "entity_view" && fromType && fromSlug) {
    recordEntityView(fromType, fromSlug);
  }

  if (
    (name === "related_click" ||
      name === "recommendation_click" ||
      name === "graph_navigation" ||
      name === "entity_navigation") &&
    fromType &&
    fromSlug &&
    toType &&
    toSlug
  ) {
    recordRelationshipClick(fromType, fromSlug, toType, toSlug);
    recordSearchResultClick(toType, toSlug);
    recordDiscoveryClick(name, typeof props.relationship === "string" ? props.relationship : undefined);
  }

  if (name === "recommendation_impression") {
    const count = typeof props.position === "number" ? 1 : 1;
    recordRecommendationImpression(count);
  }

  if (
    name === "continue_exploring_click" ||
    name === "recent_click" ||
    name === "popular_click"
  ) {
    recordDiscoveryClick(name, typeof props.relationship === "string" ? props.relationship : name);
    if (toType && toSlug) recordSearchResultClick(toType, toSlug);
    // Also accept target_entity as "type:slug"
    const target =
      typeof props.target_entity === "string" ? props.target_entity : null;
    if (target?.includes(":")) {
      const [t, ...rest] = target.split(":");
      if (t && rest.length) recordSearchResultClick(t, rest.join(":"));
    }
  }
}

export function buildDiscoveryAnalyticsSnapshot(): {
  recommendationCounts: Record<string, number>;
  relationshipSources: Array<{ relationship: string; count: number }>;
  popularEntities: Array<{ key: string; count: number }>;
  recentlyViewedMetrics: { writes: number; reads: number };
  ctr: { impressions: number; clicks: number; rate: number };
  averageTraversalMs: number;
  traversalSamples: number;
} {
  const counts: Record<string, number> = {};
  for (const [key, value] of recommendationCounts) counts[key] = value;

  return {
    recommendationCounts: counts,
    relationshipSources: topN(relationshipSources, 20).map((row) => ({
      relationship: row.key,
      count: row.count,
    })),
    popularEntities: topN(
      // derive from relationship + click counts already recorded via search analytics
      new Map(
        Object.entries(counts).filter(([key]) => key.startsWith("click:"))
      ),
      20
    ),
    recentlyViewedMetrics: { writes: recentWrites, reads: recentReads },
    ctr: {
      impressions,
      clicks,
      rate: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 1000 : 0,
    },
    averageTraversalMs: averageTraversalMs(),
    traversalSamples: traversalDurations.length,
  };
}

export function resetDiscoveryAnalytics(): void {
  relationshipSources.clear();
  recommendationCounts.clear();
  impressions = 0;
  clicks = 0;
  recentWrites = 0;
  recentReads = 0;
  traversalDurations.length = 0;
}

/** Type guard helper for event registration checks in tests. */
export function isDiscoveryAnalyticsEvent(name: string): name is AnalyticsEventName {
  return (DISCOVERY_ANALYTICS_EVENTS as readonly string[]).includes(name) ||
    name === "recommendation_click";
}
