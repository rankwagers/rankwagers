import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeasonDetailView } from "@/components/seasons/SeasonDetailView";
import { getCompetition } from "@/lib/competitions/registry";
import { emptyLists, getDailyMatchListsSafe, todayMatchDateStr } from "@/lib/footystats/client";
import { locales, type Locale } from "@/lib/i18n";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { mapDailyListsToQualifiedFixtures } from "@/lib/research/qualifiedFixture";
import {
  buildSeasonIntelligence,
  participatingTeams,
  recentSeasonFixtures,
  upcomingSeasonFixtures,
} from "@/lib/seasons/intelligence";
import { operatorsForSeason } from "@/lib/seasons/operators";
import { assertPublicEntity } from "@/lib/data-quality/pipeline";
import { getSeason, seasonSlugs } from "@/lib/seasons/registry";
import { seasonMetadata } from "@/lib/seasons/seo";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    seasonSlugs().map(({ competition, season }) => ({
      locale,
      slug: competition,
      season,
    }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string; season: string };
}): Metadata {
  const season = getSeason(params.slug, params.season);
  if (!season) return {};
  return seasonMetadata(params.locale, season);
}

export default async function SeasonDetailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; slug: string; season: string };
  searchParams?: { country?: string; date?: string };
}) {
  if (!getCompetition(params.slug)) notFound();
  const gate = assertPublicEntity("season", params.season, params.slug);
  if (!gate.allowed) notFound();
  const season = getSeason(params.slug, params.season);
  if (!season) notFound();

  const countryContext = getRequestCountryContext(searchParams?.country);
  const today = todayMatchDateStr();
  const rawDate = searchParams?.date?.trim();
  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const result = await getDailyMatchListsSafe(selectedDate);
  const lists = "error" in result ? emptyLists() : result;
  const fixtures = mapDailyListsToQualifiedFixtures(lists);
  const intelligence = buildSeasonIntelligence(season, fixtures);
  const upcoming = upcomingSeasonFixtures(season, fixtures, 8);
  const recent = recentSeasonFixtures(season, fixtures, 6);
  const teams = participatingTeams(season, fixtures);
  const operators = operatorsForSeason(season, countryContext.country);

  return (
    <SeasonDetailView
      season={season}
      locale={params.locale}
      intelligence={intelligence}
      upcoming={upcoming}
      recent={recent}
      teams={teams}
      operators={operators}
      visitorCountry={countryContext.country}
    />
  );
}
