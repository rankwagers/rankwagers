import type { Locale } from "@/lib/i18n";
import { filterCodeToMarketKey } from "@/lib/fixtures/marketCodes";
import { fixturePath } from "@/lib/fixtures/paths";
import type { HomepageSearchResult } from "./homeFixtureSearch";

export type HomepageFixtureDeepLink = {
  fixtureId?: number;
  market?: string;
};

/**
 * Deep link into the homepage explorer filters (market-only or filter context).
 * Prefer `fixturePath` when opening a specific match as the canonical page.
 */
export function homepageFixtureExplorerHref(
  locale: Locale,
  link: HomepageFixtureDeepLink = {}
): string {
  if (typeof link.fixtureId === "number" && Number.isFinite(link.fixtureId)) {
    const raw = link.market && link.market !== "All" ? link.market : null;
    const market = raw ? filterCodeToMarketKey(raw) ?? raw : null;
    return fixturePath(locale, link.fixtureId, market);
  }
  const params = new URLSearchParams();
  if (link.market && link.market !== "All") {
    params.set("market", link.market);
  }
  const query = params.toString();
  return query ? `/${locale}?${query}#fixtures` : `/${locale}#fixtures`;
}

/** Search results open the canonical match-detail page. */
export function homepageSearchResultHref(
  locale: Locale,
  result: HomepageSearchResult
): string {
  return fixturePath(locale, result.fixtureId);
}

export function liveSignalsHref(locale: Locale): string {
  return `/${locale}#live-signals`;
}

/** Market filter codes used by BibleFixtureExplorer FILTER_GROUPS.market */
export const HOMEPAGE_MARKET_FILTERS = [
  "All",
  "1H 0.5",
  "O1.5",
  "O2.5",
  "2H 0.5",
] as const;

export type HomepageMarketFilter = (typeof HOMEPAGE_MARKET_FILTERS)[number];

export function isHomepageMarketFilter(value: string): value is HomepageMarketFilter {
  return (HOMEPAGE_MARKET_FILTERS as readonly string[]).includes(value);
}

/** Map list-kind keys used on the homepage trending tiles to filter codes. */
export function marketKindToFilterCode(
  kind: "fh" | "over15" | "over25" | "sh"
): HomepageMarketFilter {
  if (kind === "fh") return "1H 0.5";
  if (kind === "over15") return "O1.5";
  if (kind === "over25") return "O2.5";
  return "2H 0.5";
}
