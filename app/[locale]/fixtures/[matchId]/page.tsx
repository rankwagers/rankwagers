import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceHistorySection } from "@/components/evidence/EvidenceHistorySection";
import { MatchDetailView } from "@/components/fixtures/MatchDetailView";
import { loadMatchPageBundle } from "@/lib/fixtures/loadMatchPage.server";
import { parseFixtureMatchId } from "@/lib/fixtures/paths";
import { locales, type Locale } from "@/lib/i18n";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export function generateStaticParams() {
  // Match pages are demand-loaded by stable matchId — avoid thin static shells.
  return [] as Array<{ locale: string; matchId: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale; matchId: string };
}): Promise<Metadata> {
  const matchId = parseFixtureMatchId(params.matchId);
  if (!matchId || !locales.includes(params.locale)) return {};
  const countryContext = getRequestCountryContext();
  const bundle = await loadMatchPageBundle({
    matchId,
    locale: params.locale,
    country: countryContext.country,
  });
  if (!bundle) {
    return pageMetadata({
      locale: params.locale,
      path: `/fixtures/${params.matchId}`,
      title: "Fixture not in the current dataset",
      description: "This fixture could not be loaded.",
      index: false,
    });
  }
  const { header } = bundle.model;
  const title = `${header.homeTeam} vs ${header.awayTeam} — match evidence & settlement`;
  const description = `${header.homeTeam} vs ${header.awayTeam} (${header.competition}). Kickoff, live context, prediction publication snapshot, and transparent settlement.`;
  return pageMetadata({
    locale: params.locale,
    path: `/fixtures/${matchId}`,
    title,
    description,
    index: bundle.model.indexable,
  });
}

export default async function FixtureMatchPage({
  params,
  searchParams,
}: {
  params: { locale: Locale; matchId: string };
  searchParams?: { market?: string; country?: string; source?: string };
}) {
  if (!locales.includes(params.locale)) notFound();
  const matchId = parseFixtureMatchId(params.matchId);
  if (!matchId) notFound();

  const countryContext = getRequestCountryContext(searchParams?.country);
  const bundle = await loadMatchPageBundle({
    matchId,
    locale: params.locale,
    market: searchParams?.market,
    country: countryContext.country,
  });
  if (!bundle) notFound();

  // Operator rows are assembled here rather than in the view, matching how the competition and
  // market pages supply theirs. The view stays presentational and does not reach for the registry.
  const operators = listOperators()
    .filter((operator) => operator.affiliateEnabled)
    .map((operator) => ({
      operator,
      availability: resolveOperatorAvailability(operator, countryContext.country),
    }));

  return (
    <>
      <MatchDetailView
        locale={params.locale}
        bundle={bundle}
        source={searchParams?.source ?? null}
        operators={operators}
        visitorCountry={countryContext.country}
      />
      {/*
        Sprint 23 — Evidence History. Rendered as a sibling of the match view rather than
        inside it: the archive is its own concern with its own data source, and keeping
        it out of MatchDetailView means neither has to know about the other. Container
        class matches the view's own wrapper so the section lines up with the page grid.
      */}
      <div className="container-wide pb-16">
        <EvidenceHistorySection
          fixtureId={matchId}
          locale={params.locale}
          fixtureName={`${bundle.model.header.homeTeam} vs ${bundle.model.header.awayTeam}`}
        />
      </div>
    </>
  );
}
