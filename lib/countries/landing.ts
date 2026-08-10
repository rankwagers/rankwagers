/**
 * Country landing assembly — unique value only; reject thin doorways.
 */

import { findCompetitionForLeague, listCompetitions } from "@/lib/competitions/registry";
import { competitionPath } from "@/lib/competitions/links";
import { countryName } from "@/lib/geoNames";
import type { Locale } from "@/lib/i18n";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { operatorPath } from "@/lib/operators/links";
import {
  COUNTRY_PROFILES,
  getCountryProfile,
  listConfiguredCountries,
} from "@/lib/personalization/countries";
import { countryLandingIndexability } from "@/lib/seo/indexability";
import { buildFixtureSearchDocuments } from "@/lib/search/fixtureDocuments";
import type { IndexabilityVerdict } from "@/lib/knowledge-graph/contracts";
import { countryPath } from "./links";

export type CountryLandingModel = {
  code: string;
  title: string;
  summary: string;
  localeHint: string;
  competitions: Array<{ name: string; href: string; slug: string }>;
  operators: Array<{ name: string; href: string; slug: string }>;
  fixtureSamples: Array<{ title: string; href: string; slug: string }>;
  marketsHref: string;
  indexability: IndexabilityVerdict;
  path: string;
};

function buildSummary(code: string, competitionNames: string[], operatorNames: string[]): string {
  const name = countryName(code);
  const leagues =
    competitionNames.length > 0
      ? competitionNames.slice(0, 3).join(", ")
      : "major football competitions";
  const books =
    operatorNames.length > 0
      ? operatorNames.slice(0, 3).join(", ")
      : "licensed bookmaker partners";
  return `${name} football betting research on RankWagers: evidence-qualified predictions for ${leagues}, with transparent settlement context and editorial discovery of ${books}. This hub surfaces only competitions and operators relevant to ${name} — not a generic geo doorway.`;
}

export function isConfiguredCountryCode(code: string): boolean {
  return Boolean(COUNTRY_PROFILES[code.toUpperCase()]);
}

/*
 * THE COUNTRY-LINK 404 — competition and team pages linked every country field
 * to /countries/{code} unconditionally, but the [code] route only serves
 * CONFIGURED profiles; Ligue 1's "FR" produced a live 404. A country renders
 * as a link only when its hub actually exists — otherwise it is a plain label.
 */
export function countryHubHref(locale: Locale | string, code: string): string | null {
  return isConfiguredCountryCode(code) ? countryPath(locale, code) : null;
}

let indexableCountryCache: string[] | null = null;

/** Memoized list of country codes that pass the quality gate (EN assembly). */
export function listIndexableCountryCodes(): string[] {
  if (indexableCountryCache) return indexableCountryCache;
  indexableCountryCache = listConfiguredCountries().filter((code) => {
    const model = buildCountryLanding("en", code);
    return model?.indexability.indexable;
  });
  return indexableCountryCache;
}

/** Test helper */
export function resetIndexableCountryCache(): void {
  indexableCountryCache = null;
}

export function buildCountryLanding(
  locale: Locale,
  rawCode: string
): CountryLandingModel | null {
  const code = rawCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (!isConfiguredCountryCode(code)) return null;

  const profile = getCountryProfile(code);
  const competitions = profile.topLeagues
    .map((league) => findCompetitionForLeague(league))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .filter((row, index, all) => all.findIndex((x) => x.slug === row.slug) === index)
    .slice(0, 8)
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      href: competitionPath(locale, row.slug),
    }));

  // Fallback: competitions whose country field matches (e.g. GB → Premier League)
  if (competitions.length < 2) {
    for (const competition of listCompetitions()) {
      if ((competition.country ?? "").toUpperCase() !== code) continue;
      if (competitions.some((row) => row.slug === competition.slug)) continue;
      competitions.push({
        name: competition.name,
        slug: competition.slug,
        href: competitionPath(locale, competition.slug),
      });
      if (competitions.length >= 6) break;
    }
  }

  const operators = listOperators()
    .filter((operator) => operator.affiliateEnabled)
    .filter((operator) => resolveOperatorAvailability(operator, code).available)
    .slice(0, 6)
    .map((operator) => ({
      name: operator.name,
      slug: operator.slug,
      href: operatorPath(locale, operator.slug),
    }));

  const fixtureSamples = buildFixtureSearchDocuments(2)
    .filter((doc) => {
      const kw = doc.normalizedKeywords.join(" ");
      const aliases = doc.normalizedAliases.join(" ");
      const codeNorm = code.toLowerCase();
      return (
        kw.includes(codeNorm) ||
        aliases.includes(countryName(code).toLowerCase()) ||
        doc.keywords.some((k) => k.toUpperCase() === code)
      );
    })
    .slice(0, 6)
    .map((doc) => ({
      title: doc.title,
      slug: doc.slug,
      href: `/${locale}/fixtures/${doc.slug}`,
    }));

  const summary = buildSummary(
    code,
    competitions.map((row) => row.name),
    operators.map((row) => row.name)
  );

  const indexability = countryLandingIndexability({
    hasProfile: true,
    competitionCount: competitions.length,
    operatorCount: operators.length,
    uniqueSummaryLength: summary.length,
    fixtureSampleCount: fixtureSamples.length,
  });

  return {
    code,
    title: `${countryName(code)} football predictions & bookmakers`,
    summary,
    localeHint: profile.language,
    competitions,
    operators,
    fixtureSamples,
    marketsHref: `/${locale}/markets`,
    indexability,
    path: countryPath(locale, code),
  };
}
