import {
  applyCountryFilter,
  filterIndexDocuments,
  isSupportedLocale,
  resolveSearchLocale,
} from "./filters";
import { getSearchIndex } from "./indexer";
import { normalizeSearchQuery } from "./normalizer";
import { rankDocuments } from "./ranking";
import { toPublicSearchResult } from "./resolver";
import {
  recordSearchLookupDuration,
  recordSearchQuery,
} from "./analytics";
import type {
  SearchDocument,
  SearchGroupKey,
  SearchGroups,
  SearchOptions,
  SearchResponse,
  SearchResult,
} from "./types";
import { SEARCH_GROUP_ORDER } from "./types";

const DEFAULT_LIMIT = 40;
const DEFAULT_LIMIT_PER_GROUP = 12;

function groupResults(results: SearchResult[]): SearchGroups {
  const groups: SearchGroups = {};
  for (const key of SEARCH_GROUP_ORDER) {
    const rows = results.filter((row) => row.group === key);
    if (rows.length) groups[key] = rows;
  }
  return groups;
}

function dedupeDocuments(docs: readonly SearchDocument[]): SearchDocument[] {
  const seen = new Set<string>();
  const out: SearchDocument[] = [];
  for (const doc of docs) {
    const key = `${doc.entityType}:${doc.slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
  }
  return out;
}

/**
 * Unified entity discovery search.
 * Indexes only canonical registry entities; no provider I/O.
 */
export function searchEntities(
  rawQuery: string,
  options: SearchOptions = {}
): SearchResponse {
  const started = performance.now();
  const locale = resolveSearchLocale(options.locale);
  const normalized = normalizeSearchQuery(rawQuery);
  const limit = options.limit ?? DEFAULT_LIMIT;
  const limitPerGroup = options.limitPerGroup ?? DEFAULT_LIMIT_PER_GROUP;

  if (options.locale && !isSupportedLocale(options.locale)) {
    const tookMs = Math.round((performance.now() - started) * 100) / 100;
    recordSearchLookupDuration(tookMs);
    recordSearchQuery(normalized || rawQuery, 0);
    return {
      query: normalized,
      results: [],
      groups: {},
      meta: { count: 0, tookMs, emptyReason: "unsupported_locale" },
    };
  }

  if (!normalized) {
    const tookMs = Math.round((performance.now() - started) * 100) / 100;
    recordSearchLookupDuration(tookMs);
    return {
      query: "",
      results: [],
      groups: {},
      meta: { count: 0, tookMs, emptyReason: "no_query" },
    };
  }

  const index = getSearchIndex();
  const prefiltered = filterIndexDocuments(index.documents, options);
  const countryFiltered = applyCountryFilter(prefiltered, options.country);
  const ranked = rankDocuments(countryFiltered, normalized);
  const deduped = dedupeDocuments(ranked.map((hit) => hit.document));

  const perGroupCounts = new Map<SearchGroupKey, number>();
  const results: SearchResult[] = [];

  for (const doc of deduped) {
    const group = doc.entityType as SearchGroupKey;
    const used = perGroupCounts.get(group) ?? 0;
    if (used >= limitPerGroup) continue;
    if (results.length >= limit) break;
    perGroupCounts.set(group, used + 1);
    results.push(toPublicSearchResult(doc, locale));
  }

  const tookMs = Math.round((performance.now() - started) * 100) / 100;
  recordSearchLookupDuration(tookMs);
  recordSearchQuery(normalized, results.length);

  let emptyReason: SearchResponse["meta"]["emptyReason"];
  if (!results.length) {
    const hitsBeforeCountry = rankDocuments(prefiltered, normalized);
    const hitsAfterCountry = rankDocuments(countryFiltered, normalized);
    emptyReason =
      hitsBeforeCountry.length > 0 && hitsAfterCountry.length === 0
        ? "filtered_away"
        : "no_results";
  }

  return {
    query: normalized,
    results,
    groups: groupResults(results),
    meta: { count: results.length, tookMs, emptyReason },
  };
}
