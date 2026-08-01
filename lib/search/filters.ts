import { getOperator } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { locales, type Locale } from "@/lib/i18n";
import type { SearchDocument, SearchEntityType, SearchOptions } from "./types";
import { INDEXED_ENTITY_TYPES } from "./types";

const LOCALE_SET = new Set<string>(locales);

export function isSupportedLocale(locale: string | null | undefined): locale is Locale {
  return Boolean(locale && LOCALE_SET.has(locale));
}

export function resolveSearchLocale(locale: string | null | undefined): Locale {
  return isSupportedLocale(locale) ? locale : "en";
}

/** Filter index docs before ranking (type filter + active/searchable). */
export function filterIndexDocuments(
  documents: readonly SearchDocument[],
  options: SearchOptions = {}
): SearchDocument[] {
  const allowedTypes = options.entityTypes?.length
    ? new Set(options.entityTypes)
    : new Set<SearchEntityType>(INDEXED_ENTITY_TYPES);

  return documents.filter((doc) => {
    if (!doc.searchable || !doc.active) return false;
    if (!allowedTypes.has(doc.entityType)) return false;
    return true;
  });
}

/**
 * Country-aware operator filter applied after ranking.
 * Unavailable / non-affiliate operators are dropped when country context applies.
 */
export function isOperatorResultVisible(
  slug: string,
  visitorCountry: string | null | undefined
): boolean {
  const operator = getOperator(slug);
  if (!operator || !operator.affiliateEnabled) return false;
  return resolveOperatorAvailability(operator, visitorCountry).available;
}

export function applyCountryFilter(
  documents: readonly SearchDocument[],
  visitorCountry: string | null | undefined
): SearchDocument[] {
  return documents.filter((doc) => {
    if (doc.entityType !== "operator") return true;
    return isOperatorResultVisible(doc.slug, visitorCountry);
  });
}
