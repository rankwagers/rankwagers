import type { AnalyticsEventName } from "@/lib/analytics/types";
import type { IndexedEntityType, SearchDiagnostics } from "./types";

export const SEARCH_ANALYTICS_EVENTS = [
  "search_open",
  "search_query",
  "search_result_click",
  "search_empty",
  "search_filter",
  "search_keyboard_navigation",
  "search_group_expand",
] as const satisfies readonly AnalyticsEventName[];

export type SearchAnalyticsEventName = (typeof SEARCH_ANALYTICS_EVENTS)[number];

export type SearchAnalyticsPayload = {
  query?: string;
  entity_type?: string;
  entity_slug?: string;
  country?: string | null;
  country_source?: string | null;
  locale?: string | null;
  result_position?: number;
  results_count?: number;
  timestamp?: string;
  filter?: string;
  key?: string;
  group?: string;
};

type CounterMap = Map<string, number>;

const queryCounts: CounterMap = new Map();
const zeroResultCounts: CounterMap = new Map();
const clickCounts: CounterMap = new Map();
const entityViewCounts: CounterMap = new Map();
const relationshipClickCounts: CounterMap = new Map();

const lookupDurations: number[] = [];
const MAX_LOOKUP_SAMPLES = 200;

function bump(map: CounterMap, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function topN(map: CounterMap, n: number): Array<{ key: string; count: number }> {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, n);
}

export function recordSearchLookupDuration(ms: number): void {
  lookupDurations.push(ms);
  if (lookupDurations.length > MAX_LOOKUP_SAMPLES) lookupDurations.shift();
}

export function recordSearchQuery(query: string, resultsCount: number): void {
  const key = query.trim().toLowerCase();
  if (!key) return;
  bump(queryCounts, key);
  if (resultsCount === 0) bump(zeroResultCounts, key);
}

export function recordSearchResultClick(entityType: string, entitySlug: string): void {
  bump(clickCounts, `${entityType}:${entitySlug}`);
}

/** Discovery metrics — feed from entity_view / related_click style tracking. */
export function recordEntityView(entityType: string, entitySlug: string): void {
  bump(entityViewCounts, `${entityType}:${entitySlug}`);
}

export function recordRelationshipClick(fromType: string, fromSlug: string, toType: string, toSlug: string): void {
  bump(relationshipClickCounts, `${fromType}:${fromSlug}->${toType}:${toSlug}`);
}

export function getPopularityWeight(entityType: string, entitySlug: string): number {
  const views = entityViewCounts.get(`${entityType}:${entitySlug}`) ?? 0;
  const clicks = clickCounts.get(`${entityType}:${entitySlug}`) ?? 0;
  return views + clicks * 2;
}

export function averageLookupMs(): number {
  if (!lookupDurations.length) return 0;
  const sum = lookupDurations.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / lookupDurations.length) * 100) / 100;
}

function viewsForType(type: IndexedEntityType, n: number): Array<{ slug: string; count: number }> {
  return topN(entityViewCounts, 200)
    .filter((row) => row.key.startsWith(`${type}:`))
    .slice(0, n)
    .map((row) => ({
      slug: row.key.slice(type.length + 1),
      count: row.count,
    }));
}

export function buildSearchDiagnosticsBase(): Pick<
  SearchDiagnostics,
  | "averageLookupMs"
  | "lookupSamples"
  | "topQueries"
  | "zeroResultQueries"
  | "mostClickedEntities"
  | "discovery"
> {
  return {
    averageLookupMs: averageLookupMs(),
    lookupSamples: lookupDurations.length,
    topQueries: topN(queryCounts, 20).map((row) => ({ query: row.key, count: row.count })),
    zeroResultQueries: topN(zeroResultCounts, 20).map((row) => ({
      query: row.key,
      count: row.count,
    })),
    mostClickedEntities: topN(clickCounts, 20).map((row) => {
      const [entityType, ...rest] = row.key.split(":");
      return {
        entityType: entityType ?? "unknown",
        entitySlug: rest.join(":") || "unknown",
        count: row.count,
      };
    }),
    discovery: {
      mostViewedTeams: viewsForType("team", 10),
      mostViewedCompetitions: viewsForType("competition", 10),
      mostViewedMarkets: viewsForType("market", 10),
      mostViewedOperators: viewsForType("operator", 10),
      mostViewedSeasons: viewsForType("season", 10),
      mostClickedRelationships: topN(relationshipClickCounts, 10).map((row) => ({
        key: row.key,
        count: row.count,
      })),
    },
  };
}

/** Test helper — clears in-memory search analytics. */
export function resetSearchAnalytics(): void {
  queryCounts.clear();
  zeroResultCounts.clear();
  clickCounts.clear();
  entityViewCounts.clear();
  relationshipClickCounts.clear();
  lookupDurations.length = 0;
}

/** Ingest search-related analytics events into discovery counters (server-side). */
export function ingestSearchAnalyticsEvent(input: {
  event_name: string;
  properties?: Record<string, string | number | boolean | null> | undefined;
}): void {
  const props = input.properties ?? {};
  const entityType =
    typeof props.entity_type === "string" ? props.entity_type : undefined;
  const entitySlug =
    typeof props.entity_slug === "string" ? props.entity_slug : undefined;

  // Query / empty counts are recorded by the search engine on SSR and /api/search.
  if (
    (input.event_name === "search_result_click" ||
      input.event_name === "search_result_clicked") &&
    entityType &&
    entitySlug
  ) {
    recordSearchResultClick(entityType, entitySlug);
  }
  const fromType =
    entityType ??
    (typeof props.from_type === "string" ? props.from_type : undefined);
  const fromSlug =
    entitySlug ??
    (typeof props.from_slug === "string" ? props.from_slug : undefined);

  if (input.event_name === "entity_view" && fromType && fromSlug) {
    recordEntityView(fromType, fromSlug);
  }
  if (
    (input.event_name === "related_click" ||
      input.event_name === "recommendation_click" ||
      input.event_name === "graph_navigation" ||
      input.event_name === "entity_navigation") &&
    fromType &&
    fromSlug
  ) {
    const toType =
      typeof props.to_type === "string"
        ? props.to_type
        : typeof props.to_entity_type === "string"
          ? props.to_entity_type
          : typeof props.target_type === "string"
            ? props.target_type
            : "unknown";
    const toSlug =
      typeof props.to_slug === "string"
        ? props.to_slug
        : typeof props.to_entity_slug === "string"
          ? props.to_entity_slug
          : typeof props.target_slug === "string"
            ? props.target_slug
            : "unknown";
    recordRelationshipClick(fromType, fromSlug, toType, toSlug);
    if (toType !== "unknown" && toSlug !== "unknown") {
      recordSearchResultClick(toType, toSlug);
    }
  }
}

export function searchEventProperties(
  payload: SearchAnalyticsPayload
): Record<string, string | number | boolean | null> {
  return {
    query: payload.query ?? null,
    entity_type: payload.entity_type ?? null,
    entity_slug: payload.entity_slug ?? null,
    country: payload.country ?? null,
    country_source: payload.country_source ?? null,
    locale: payload.locale ?? null,
    result_position: payload.result_position ?? null,
    results_count: payload.results_count ?? null,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    filter: payload.filter ?? null,
    key: payload.key ?? null,
    group: payload.group ?? null,
  };
}
