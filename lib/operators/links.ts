import type { Locale } from "@/lib/i18n";
import { marketSlugForListKind } from "@/lib/markets/registry";
import { buildGoPath } from "@/lib/operators/go-path";
import { OPERATOR_MARKET_META, type Operator, type OperatorMarketKey } from "./types";

export function operatorPath(locale: Locale, slug: string): string {
  return `/${locale}/operators/${slug}`;
}

export function operatorsIndexPath(locale: Locale): string {
  return `/${locale}/operators`;
}

export function operatorMarketHref(locale: Locale, market: OperatorMarketKey): string {
  const slug = marketSlugForListKind(market);
  return slug ? `/${locale}/markets/${slug}` : `/${locale}#fixtures`;
}

export function operatorLeagueHref(locale: Locale, league: string): string {
  const slug = league
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const known = new Set([
    "premier-league",
    "la-liga",
    "serie-a",
    "bundesliga",
    "ligue-1",
    "champions-league",
    "europa-league",
    "libertadores",
    "brasileirao",
    "eredivisie",
    "mls",
    "liga-mx",
    "npfl",
    "j-league",
  ]);
  if (known.has(slug)) return `/${locale}/competitions/${slug}`;
  return `/${locale}/competitions`;
}

export function operatorFixtureHref(locale: Locale, fixtureId: number): string {
  // Exported signature is kept: callers pass a fixture id and the anchor is expected to become
  // fixture-specific. The current target is the fixtures section for every id.
  void fixtureId;
  return `/${locale}#fixtures`;
}

export function operatorEvidenceHref(locale: Locale): string {
  return `/${locale}/methodology`;
}

export function operatorOddsIntelligenceHref(locale: Locale): string {
  return `/${locale}#fixtures`;
}

export function operatorAffiliateHref(operator: Operator, locale: Locale, country: string): string {
  if (!operator.affiliateEnabled) return operatorPath(locale, operator.slug);
  const subid = `operator_${operator.slug}_${locale}_${country || "xx"}`.toLowerCase();
  return buildGoPath({
    slug: operator.slug,
    placement: "operator_page",
    subid,
    locale,
    country: country || undefined,
    availability: "unknown",
    deeplinkType: "homepage",
  });
}

export function marketLabel(market: OperatorMarketKey): string {
  return OPERATOR_MARKET_META[market].label;
}

export function relatedLeagueSuggestions(operator: Operator): string[] {
  // Prefer country-profile leagues when a single primary country is configured.
  if (operator.supportedCountries.includes("NG")) {
    return ["NPFL", "Premier League", "CAF"];
  }
  if (operator.supportedCountries.includes("BR")) {
    return ["Brasileirão", "Premier League", "Libertadores"];
  }
  if (operator.supportedCountries.includes("JP")) {
    return ["J League", "Champions League", "Premier League"];
  }
  if (operator.supportedCountries.includes("DE")) {
    return ["Bundesliga", "Champions League", "Premier League"];
  }
  return ["Premier League", "Champions League", "La Liga"];
}
