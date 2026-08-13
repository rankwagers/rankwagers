import type { Locale } from "@/lib/i18n";
import { competitionPath } from "@/lib/competitions/links";
import { countryPath } from "@/lib/countries/links";
import { fixturePath } from "@/lib/fixtures/paths";
import { marketPath } from "@/lib/markets/links";
import { operatorPath } from "@/lib/operators/links";
import { seasonPath } from "@/lib/seasons/links";
import { teamPath } from "@/lib/teams/links";
import type { SearchDocument, SearchGroupKey, SearchResult } from "./types";

/** Map an index document to a public search result (no provider IDs / internal scores). */
export function toPublicSearchResult(
  document: SearchDocument,
  locale: Locale
): SearchResult {
  const href = resolveDocumentHref(document, locale);
  return {
    entityType: document.entityType,
    slug: document.slug,
    title: document.title,
    href,
    group: document.entityType as SearchGroupKey,
    ...(document.entityType === "season" && document.competitionSlug
      ? { competitionSlug: document.competitionSlug }
      : {}),
  };
}

export function resolveDocumentHref(document: SearchDocument, locale: Locale): string {
  switch (document.entityType) {
    case "competition":
      return competitionPath(locale, document.slug);
    case "market":
      return marketPath(locale, document.slug);
    case "operator":
      return operatorPath(locale, document.slug);
    case "team":
      /* Research team entries (research-team:* ids) have no canonical team
         page — their document carries the honest destination (the latest
         fixture the name appeared in). Registry teams keep their page. */
      if (document.id.startsWith("research-team:") && document.pathTemplate) {
        return `/${locale}${document.pathTemplate}`;
      }
      return teamPath(locale, document.slug);
    case "season": {
      const competitionSlug = document.competitionSlug ?? "";
      const seasonSlug = document.urlSlug ?? document.slug;
      return seasonPath(locale, competitionSlug, seasonSlug);
    }
    case "fixture": {
      const matchId = Number(document.slug);
      if (!Number.isSafeInteger(matchId) || matchId <= 0) return `/${locale}`;
      return fixturePath(locale, matchId);
    }
    case "country":
      return countryPath(locale, document.slug);
    default:
      return `/${locale}`;
  }
}
