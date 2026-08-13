import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { GraphNavLink } from "@/components/knowledge-graph/GraphNavLink";
import { fromCompetitionStats } from "@/lib/evidence-ui";
import type { CompetitionOperatorRow } from "@/lib/competitions/operators";
import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import {
  competitionEvidenceHref,
  competitionFixtureHref,
  competitionMarketHref,
  competitionPath,
  competitionsIndexPath,
} from "@/lib/competitions/links";
import { getRelatedCompetitions } from "@/lib/competitions/registry";
import {
  competitionBreadcrumbLd,
  competitionCollectionPageLd,
} from "@/lib/competitions/schema";
import type {
  CompetitionDefinition,
  CompetitionOddsSummary,
  CompetitionResearchStats,
} from "@/lib/competitions/types";
import type { Locale } from "@/lib/i18n";
import { countryHubHref } from "@/lib/countries/landing";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import { getMarket } from "@/lib/markets/registry";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";
import { AddToAccaButton } from "@/components/acca/AddToAccaButton";
import { fixturePath } from "@/lib/fixtures/paths";
import { siteUrl } from "@/lib/seo";
import { getActiveSeason, seasonsForCompetition } from "@/lib/seasons/registry";
import { seasonPath } from "@/lib/seasons/links";
import { resolveRegisteredTeam } from "@/lib/teams/registry";
import { teamPath } from "@/lib/teams/links";
import {
  CompetitionFixtureLink,
  CompetitionMarketLink,
  CompetitionOddsSection,
  CompetitionPageTracker,
} from "./CompetitionInteractive";

/* ============================================================================
   THE COMPETITION PAGE — form-guide conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   Top-down:

     LEAD      where today's qualified coverage concentrates by market — one
               sentence, its counts inline, pct computed from the printed
               fraction. Omitted whole when the research set is empty.
     SUPPORTS  qualified rows / unique fixtures / the market breakdown as
               paired `count of total (pct%)` rows; the provider average
               demoted to the label register.
     FIXTURES  upcoming qualified rows, then the highest-signal rows — both
               honest-empty, both provider-labelled.
     DETAIL    description, seasons, evidence bundle, market activity,
               observed odds, related entities. Dense on purpose.
     LAST      one commercial block. The duplicated all-operators list is
               dead — same law as the market and fixture pages.
   ========================================================================== */

export function CompetitionDetailView({
  competition,
  locale,
  stats,
  upcoming,
  recent,
  teams,
  odds,
  operators,
  visitorCountry,
  p,
}: {
  competition: CompetitionDefinition;
  locale: Locale;
  stats: CompetitionResearchStats;
  upcoming: QualifiedFixture[];
  recent: QualifiedFixture[];
  teams: string[];
  odds: CompetitionOddsSummary;
  operators: CompetitionOperatorRow[];
  visitorCountry: string;
  p: PredictionStrings;
}) {
  const relatedCompetitions = getRelatedCompetitions(competition.slug);
  const relatedMarkets = competition.relatedMarketSlugs
    .map((slug) => getMarket(slug))
    .filter((market): market is NonNullable<typeof market> => Boolean(market));
  const activeSeason = getActiveSeason(competition.slug);
  const availableSeasons = seasonsForCompetition(competition.slug);
  const relatedItemList = graphRelatedItemListLd({
    type: "competition",
    slug: competition.slug,
    locale,
    siteUrl: siteUrl(),
  });
  const evidenceBundle = fromCompetitionStats(stats, `competition:${competition.slug}`);

  const total = stats.qualifiedFixtureCount;
  const topMarket = total > 0 && stats.marketBreakdown.length > 0 ? stats.marketBreakdown[0] : null;
  /* Pairing by construction: the printed pct is computed from the printed fraction. */
  const leadPct = topMarket ? Math.round((topMarket.count / total) * 100) : 0;

  return (
    <>
      <CompetitionPageTracker competitionSlug={competition.slug} locale={locale} />
      <EntityViewTracker
        entityType="competition"
        entitySlug={competition.slug}
        locale={locale}
        title={competition.name}
        href={`/${locale}/competitions/${competition.slug}`}
      />
      <JsonLd data={competitionCollectionPageLd({ competition, locale })} />
      <JsonLd data={competitionBreadcrumbLd({ competition, locale })} />
      {relatedItemList && <JsonLd data={relatedItemList} />}

      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
          <Link href={`/${locale}`} className="hover:text-[var(--hero-ink)]">
            {p.nvHome}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={competitionsIndexPath(locale)} className="hover:text-[var(--hero-ink)]">
            {p.cmpIndexEyebrow}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span className="text-[var(--hero-ink)]">{competition.name}</span>
        </nav>

        <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">
            {competition.confederation}
            {competition.country ? (
              <>
                {" · "}
                {countryHubHref(locale, competition.country) ? (
                  <Link
                    href={countryHubHref(locale, competition.country)!}
                    className="hover:text-[var(--hero-ink)]"
                  >
                    {countryName(competition.country)}
                  </Link>
                ) : (
                  countryName(competition.country)
                )}
              </>
            ) : null}
          </p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            {competition.name}
          </h1>
          <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {competition.description}
          </p>
        </header>

        {/* LEAD — omitted whole on an empty research set (the empty-state law). */}
        {topMarket ? (
          <section aria-labelledby="cmp-lead-heading" className="mt-14">
            <p className="rw-m text-[var(--hero-ink-2)]">{p.mktLeadEyebrow}</p>
            <h2
              id="cmp-lead-heading"
              className="rw-h mt-2.5 max-w-[30ch] text-[clamp(1.6rem,3.6vw,2.4rem)] text-[var(--hero-ink)]"
            >
              {/* <25% is a largest share, not a concentration — the neutral phrasing renders. */}
              {formatDict(leadPct >= 25 ? p.cmpLeadLine : p.cmpLeadLineNeutral, {
                market: topMarket.market,
                count: String(topMarket.count),
                total: String(total),
                pct: String(leadPct),
              })}
            </h2>
          </section>
        ) : null}

        {/* SUPPORTS — the coverage signals, counts paired, provider figure demoted. */}
        {total > 0 ? (
          <section aria-labelledby="cmp-supports-heading" className="mt-12">
            <h2 id="cmp-supports-heading" className="rw-m text-[var(--hero-ink-2)]">
              {p.mktSupportsTitle}
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
              {p.mktSupportsNote}
            </p>
            <ul className="mt-5 border-t-[1.5px] border-[var(--hero-ink)]">
              <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.cmpQualifiedRowsLine, { n: String(total) })}
              </li>
              {stats.uniqueMatchCount > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.cmpUniqueFixturesLine, { n: String(stats.uniqueMatchCount) })}
                </li>
              ) : null}
              {stats.marketBreakdown.slice(0, 5).map((row) => (
                <li
                  key={row.market}
                  className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]"
                >
                  {formatDict(p.cmpMarketRow, {
                    market: row.market,
                    count: String(row.count),
                    total: String(total),
                    pct: String(Math.round((row.count / total) * 100)),
                  })}
                </li>
              ))}
            </ul>
            {stats.averageModelProbability !== null ? (
              <p className="rw-m mt-4 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
                {formatDict(p.mktProviderAvgLine, {
                  pct: String(Math.round(stats.averageModelProbability)),
                })}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* FIXTURES — upcoming, then the highest-signal rows. Honest empties. */}
        <section
          aria-labelledby="cmp-upcoming-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="cmp-upcoming-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpUpcomingTitle}
          </h2>
          <FixtureRows
            fixtures={upcoming}
            competitionSlug={competition.slug}
            locale={locale}
            empty={p.cmpUpcomingEmpty}
            potentialLabel={p.rankedPotentialLabel}
          />
        </section>

        <section aria-labelledby="cmp-recent-heading" className="mt-12">
          <h2 id="cmp-recent-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpRecentTitle}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {p.cmpRecentNote}
          </p>
          <FixtureRows
            fixtures={recent}
            competitionSlug={competition.slug}
            locale={locale}
            empty={p.cmpRecentEmpty}
            potentialLabel={p.rankedPotentialLabel}
          />
        </section>

        {/* DETAIL — seasons, evidence, market activity, observed odds, relations. */}
        <section
          aria-labelledby="cmp-detail-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="cmp-detail-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpDetailTitle}
          </h2>

          {availableSeasons.length > 0 ? (
            <div className="mt-6">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.cmpSeasonsTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {availableSeasons.map((season) => (
                  <li key={season.id}>
                    <Link
                      href={seasonPath(locale, competition.slug, season.slug)}
                      className={`rw-m inline-flex border px-3 py-1.5 transition-colors hover:border-[var(--hero-ink)] ${
                        season.active
                          ? "border-[var(--hero-ink)] text-[var(--hero-ink)]"
                          : "border-[var(--hero-line)] text-[var(--hero-ink-2)]"
                      }`}
                    >
                      {season.yearLabel}
                      {season.active ? ` · ${p.cmpSeasonCurrent}` : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {activeSeason ? (
            <p className="mt-4">
              <Link
                href={seasonPath(locale, competition.slug, activeSeason.slug)}
                className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
                {activeSeason.displayName}
              </Link>
            </p>
          ) : null}

          <div className="mt-8">
            <EvidenceSection bundle={evidenceBundle} locale={locale} country={visitorCountry} />
          </div>

          <div className="mt-8">
            <h3 className="rw-label text-[var(--hero-ink-2)]">{p.cmpMarketActivityTitle}</h3>
            {stats.marketBreakdown.length ? (
              <ul className="mt-2.5 border-t border-[var(--hero-line)]">
                {stats.marketBreakdown.map((row) => (
                  <li
                    key={row.market}
                    className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5"
                  >
                    <span className="text-[15px] text-[var(--hero-ink)]">{row.market}</span>
                    <span className="rw-m text-[var(--hero-ink-2)]">
                      {formatDict(p.cmpRowsProviderMeta, {
                        n: String(row.count),
                        pct: String(Math.round(row.averageProbability)),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
                {p.cmpMarketActivityEmpty}
              </p>
            )}
            <p className="mt-3">
              <Link
                href={competitionEvidenceHref(locale)}
                className="rw-m text-[var(--hero-ink-2)] underline decoration-[var(--hero-line)] underline-offset-4 hover:text-[var(--hero-ink)]"
              >
                {p.cmpMethodologyLink}
              </Link>
            </p>
          </div>

          <CompetitionOddsSection
            competitionSlug={competition.slug}
            locale={locale}
            sampleSize={odds.sampleSize}
            bestOdds={odds.bestOdds}
            averageOdds={odds.averageOdds}
            movementCount={odds.movementCount}
            p={p}
          />

          {relatedMarkets.length ? (
            <div className="mt-8">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.mktRelatedTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {relatedMarkets.map((market) => (
                  <li key={market.slug}>
                    <CompetitionMarketLink
                      href={competitionMarketHref(locale, market.slug)}
                      competitionSlug={competition.slug}
                      marketSlug={market.slug}
                      locale={locale}
                    >
                      {market.name}
                    </CompetitionMarketLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.cmpRelatedCompetitions}</h3>
              <ul className="mt-2.5 space-y-1.5">
                {relatedCompetitions.map((related) => (
                  <li key={related.slug}>
                    <GraphNavLink
                      href={competitionPath(locale, related.slug)}
                      fromType="competition"
                      fromSlug={competition.slug}
                      toType="competition"
                      toSlug={related.slug}
                      locale={locale}
                      intent="related"
                      className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
                    >
                      {related.name}
                    </GraphNavLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.cmpRelatedTeams}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2 text-sm">
                {teams.map((teamName) => {
                  const resolved = resolveRegisteredTeam({
                    name: teamName,
                    competitionSlug: competition.slug,
                  });
                  if (resolved.status === "matched") {
                    return (
                      <li key={teamName}>
                        <GraphNavLink
                          href={teamPath(locale, resolved.team.slug)}
                          fromType="competition"
                          fromSlug={competition.slug}
                          toType="team"
                          toSlug={resolved.team.slug}
                          locale={locale}
                          intent="related"
                          className="rw-m inline-flex border border-[var(--hero-line)] px-2.5 py-1 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
                        >
                          {resolved.team.name}
                        </GraphNavLink>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={teamName}
                      className="rw-m inline-flex border border-[var(--hero-line)] px-2.5 py-1 text-[var(--hero-ink-2)]"
                    >
                      {teamName}
                    </li>
                  );
                })}
              </ul>
              <p className="rw-m mt-2.5 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
                {p.cmpRelatedTeamsNote}
              </p>
            </div>
          </div>

          <GraphEntityPanel entityType="competition" entitySlug={competition.slug} locale={locale} />

          <EntityDiscoverySection
            entityType="competition"
            entitySlug={competition.slug}
            locale={locale}
            country={visitorCountry}
          />
        </section>

        {/* LAST — the single commercial block. */}
        <div className="mt-16 border-t border-[var(--hero-line)] pt-12">
          <OperatorEvidenceCardList
            cards={recommendableCards(
              buildOperatorEvidenceCards(
                operators.map(({ operator, availability }) => ({
                  operator,
                  availability,
                  marketKey: null,
                })),
                { nowIso: new Date().toISOString(), limit: 3 }
              )
            )}
            locale={locale}
            country={visitorCountry}
            surface="competition"
            headingId="operator-recommendations"
            heading={p.fxOperatorsTitle}
          />
          <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {p.fxOperatorsNote}
          </p>
        </div>
      </div>
    </>
  );
}

function FixtureRows({
  fixtures,
  competitionSlug,
  locale,
  empty,
  potentialLabel,
}: {
  fixtures: QualifiedFixture[];
  competitionSlug: string;
  locale: Locale;
  empty: string;
  potentialLabel: string;
}) {
  if (!fixtures.length) {
    return (
      <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-5 border-t-[1.5px] border-[var(--hero-ink)]">
      {fixtures.map((fixture) => (
        <li key={fixture.id}>
          <div className="rw-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-[var(--hero-line)] py-3 pl-3.5">
            <div className="min-w-0">
              <CompetitionFixtureLink
                href={competitionFixtureHref(locale)}
                competitionSlug={competitionSlug}
                fixtureId={fixture.matchId}
                locale={locale}
              >
                <span className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                  {fixture.home} v {fixture.away}
                </span>
              </CompetitionFixtureLink>
              <p className="rw-m mt-1 text-[var(--hero-ink-2)]">
                {fixture.market} · {fixture.kickoff}
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-3">
              <p className="text-right">
                <span className="rw-tnum text-[15px] font-bold text-[var(--hero-ink)]">
                  {fixture.modelProbability}%
                </span>
                <span className="rw-m block text-[var(--hero-ink-2)]">{potentialLabel}</span>
              </p>
              <AddToAccaButton
                compact
                draft={{
                  matchId: fixture.matchId,
                  homeTeam: fixture.home,
                  awayTeam: fixture.away,
                  competition: fixture.league,
                  kickoffAt: fixture.kickoffDateTime,
                  marketKey: fixture.marketKind,
                  confidence: fixture.modelProbability,
                  odds: null,
                  evidenceSummary: [`Model ${fixture.modelProbability}% · ${fixture.market}`],
                  publishedAt: fixture.updatedDateTime,
                  matchHref: fixturePath(locale, fixture.matchId, fixture.marketKind, "competition"),
                  source: "competition",
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
