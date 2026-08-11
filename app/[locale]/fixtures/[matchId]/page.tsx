import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceHistorySection } from "@/components/evidence/EvidenceHistorySection";
import { FixtureOperatorsSection } from "@/components/fixtures/FixtureOperatorsSection";
import { MatchDetailView } from "@/components/fixtures/MatchDetailView";
import { getEvidenceHistoryView } from "@/lib/archive/evidence";
import { getDictionary } from "@/lib/dictionaries";
import { loadMatchPageBundle } from "@/lib/fixtures/loadMatchPage.server";
import { buildPricePanelData } from "@/lib/operators/pricePanel.server";
import { parseFixtureMatchId } from "@/lib/fixtures/paths";
import { locales, type Locale } from "@/lib/i18n";
import { getRequestCountryContext } from "@/lib/personalization/server";
import { listOperators } from "@/lib/operators/registry";
import { resolveOperatorAvailability } from "@/lib/operators/availability";
import { pageMetadata } from "@/lib/seo";

/*
 * WHY THIS PAGE IS DYNAMIC, AND WHY THERE IS NO `revalidate` BESIDE IT.
 *
 * `export const revalidate = 60` used to sit on the next line. It never did anything:
 * `force-dynamic` overrides it, and so does the layout's. Worse, it read as though this route
 * were cached for a minute, which is the opposite of what happens — so it is removed rather than
 * left as a comment on behaviour that does not exist.
 *
 * This route cannot be ISR'd as written, and the reason is NOT the live minute and score:
 *
 *   · `getRequestCountryContext` calls `headers()` and `cookies()` — in the App Router that opts
 *     a route into dynamic rendering unconditionally. So does reading `searchParams`, which this
 *     page does for `market` and `source`. Deleting `force-dynamic` would change the label and
 *     not the behaviour.
 *
 *   · The visitor's country selects the operator rows and their availability below. Operator
 *     availability is a regulatory statement about where a brand may be offered. Serving one
 *     visitor's jurisdiction from another's cache entry would not be staleness; it would be a
 *     false claim about what is available to the person reading it.
 *
 *   · The live header (status, score, minute) is genuinely per-request for an in-play fixture.
 *
 * So the directive stays and the cost is absorbed one layer down instead: `getMatchDetail` now
 * caches the provider payload on `matchId` alone (`lib/footystats/matchDetail.ts`), so a crawler
 * walking this surface across thirty-two locales pays for the football once rather than once per
 * locale. Rendering per request is cheap; FETCHING per request was not.
 *
 * If this page is ever to be cached, the fix is to split the per-visitor surface out — operators
 * and the live header into client components or a route handler, leaving a cacheable shell. That
 * is a larger change than a directive and is not made here.
 */
export const dynamic = "force-dynamic";

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

  /*
   * One archive read serves two levels: L3's provenance line takes the latest snapshot, the
   * history section (L4's tail) takes the whole view. Reading twice would be two chances for
   * the two to disagree about the same archive.
   */
  const dict = getDictionary(params.locale);
  const evidenceHistory = await getEvidenceHistoryView(matchId, { locale: params.locale });

  /* Phase C — observed publication prices, frozen at this fixture's kickoff.
     An empty map renders nothing anywhere: no affordance, no panel. */
  const prices = await buildPricePanelData({
    fixtureId: matchId,
    kickoffIso: bundle.model.header.kickoffAt,
    locale: params.locale,
    country: countryContext.country,
  });

  return (
    <>
      <MatchDetailView
        locale={params.locale}
        bundle={bundle}
        source={searchParams?.source ?? null}
        latestSnapshot={evidenceHistory.latest}
        p={dict.predictions}
        prices={prices}
      />
      {/*
        Sprint 23 — Evidence History. Rendered as a sibling of the match view rather than
        inside it: the archive is its own concern with its own data source, and keeping
        it out of MatchDetailView means neither has to know about the other. Container
        class matches the view's own wrapper so the section lines up with the page grid.
      */}
      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-16">
        <EvidenceHistorySection
          fixtureId={matchId}
          locale={params.locale}
          fixtureName={`${bundle.model.header.homeTeam} vs ${bundle.model.header.awayTeam}`}
          view={evidenceHistory}
        />
        {/*
          L5 — OPERATORS, LAST. Below every content level including the evidence archive:
          the separation between research and commerce is a property of the layout.
        */}
        <FixtureOperatorsSection
          locale={params.locale}
          operators={operators}
          visitorCountry={countryContext.country}
          matchId={matchId}
          focusMarket={bundle.focusMarket ?? null}
          p={dict.predictions}
        />
      </div>
    </>
  );
}
