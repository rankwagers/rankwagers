import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionDetailView } from "@/components/competitions/CompetitionDetailView";
import { getCompetitionOddsSummary } from "@/lib/competitions/odds";
import { operatorsForCompetition } from "@/lib/competitions/operators";
import {
  competitionSlugs,
  getCompetition,
} from "@/lib/competitions/registry";
import {
  buildCompetitionResearchStats,
  fixturesForCompetition,
  recentAnalyzedFixtures,
  relatedTeamsFromFixtures,
  upcomingFixtures,
} from "@/lib/competitions/stats";
import { emptyLists, getDailyMatchListsSafe, todayMatchDateStr } from "@/lib/footystats/client";
import { locales, type Locale } from "@/lib/i18n";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { mapDailyListsToQualifiedFixtures } from "@/lib/research/qualifiedFixture";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    competitionSlugs().map((slug) => ({ locale, slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Metadata {
  const competition = getCompetition(params.slug);
  if (!competition) return {};
  return pageMetadata({
    locale: params.locale,
    path: `/competitions/${competition.slug}`,
    title: `${competition.name} — competition intelligence & research`,
    description: competition.description,
  });
}

export default async function CompetitionDetailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; slug: string };
  searchParams?: { country?: string; date?: string };
}) {
  const competition = getCompetition(params.slug);
  if (!competition) notFound();

  const countryContext = getRequestCountryContext(searchParams?.country);
  const today = todayMatchDateStr();
  const rawDate = searchParams?.date?.trim();
  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const result = await getDailyMatchListsSafe(selectedDate);
  const lists = "error" in result ? emptyLists() : result;
  const fixtures = mapDailyListsToQualifiedFixtures(lists);
  const matched = fixturesForCompetition(competition, fixtures);
  const stats = buildCompetitionResearchStats(competition, fixtures);
  const upcoming = upcomingFixtures(competition, fixtures, 8);
  const recent = recentAnalyzedFixtures(competition, fixtures, 6);
  const teams = relatedTeamsFromFixtures(competition, fixtures, 8);
  const odds = await getCompetitionOddsSummary(matched);
  const operators = operatorsForCompetition(competition, countryContext.country);

  return (
    <CompetitionDetailView
      competition={competition}
      locale={params.locale}
      stats={stats}
      upcoming={upcoming}
      recent={recent}
      teams={teams}
      odds={odds}
      operators={operators}
      visitorCountry={countryContext.country}
    />
  );
}
