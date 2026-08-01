import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamDetailView } from "@/components/teams/TeamDetailView";
import { emptyLists, getDailyMatchListsSafe, todayMatchDateStr } from "@/lib/footystats/client";
import { locales, type Locale } from "@/lib/i18n";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { mapDailyListsToQualifiedFixtures } from "@/lib/research/qualifiedFixture";
import {
  buildTeamIntelligence,
  recentTeamFixtures,
  upcomingTeamFixtures,
} from "@/lib/teams/intelligence";
import { operatorsForTeam } from "@/lib/teams/operators";
import { assertPublicEntity } from "@/lib/data-quality/pipeline";
import { getTeam, teamSlugs } from "@/lib/teams/registry";
import { teamMetadata } from "@/lib/teams/seo";

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    teamSlugs().map((slug) => ({ locale, slug }))
  );
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; slug: string };
}): Metadata {
  const team = getTeam(params.slug);
  if (!team) return {};
  return teamMetadata(params.locale, team);
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; slug: string };
  searchParams?: { country?: string; date?: string };
}) {
  const gate = assertPublicEntity("team", params.slug);
  if (!gate.allowed) notFound();
  const team = getTeam(params.slug);
  if (!team) notFound();

  const countryContext = getRequestCountryContext(searchParams?.country);
  const today = todayMatchDateStr();
  const rawDate = searchParams?.date?.trim();
  const selectedDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
  const result = await getDailyMatchListsSafe(selectedDate);
  const lists = "error" in result ? emptyLists() : result;
  const fixtures = mapDailyListsToQualifiedFixtures(lists);
  const intelligence = buildTeamIntelligence(team, fixtures);
  const upcoming = upcomingTeamFixtures(team, fixtures, 8);
  const recent = recentTeamFixtures(team, fixtures, 6);
  const operators = operatorsForTeam(team, countryContext.country);

  return (
    <TeamDetailView
      team={team}
      locale={params.locale}
      intelligence={intelligence}
      upcoming={upcoming}
      recent={recent}
      operators={operators}
      visitorCountry={countryContext.country}
    />
  );
}
