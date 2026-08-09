import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { fromSeasonIntelligence } from "@/lib/evidence-ui";
import { getCompetition } from "@/lib/competitions/registry";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import type { Locale } from "@/lib/i18n";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";
import { siteUrl } from "@/lib/seo";
import { seasonBreadcrumbLd, seasonCollectionPageLd } from "@/lib/seasons/schema";
import {
  seasonCompetitionHref,
  seasonEvidenceHref,
  seasonFixtureHref,
  seasonMarketHref,
  seasonOperatorHref,
  seasonsIndexPath,
  seasonTeamHref,
} from "@/lib/seasons/links";
import type { SeasonOperatorRow } from "@/lib/seasons/operators";
import type { SeasonEntity, SeasonIntelligence } from "@/lib/seasons/types";
import type { TeamEntity } from "@/lib/teams/types";
import {
  SeasonFixtureLink,
  SeasonMarketLink,
  SeasonOperatorLink,
  SeasonPageTracker,
  SeasonTeamLink,
} from "./SeasonInteractive";

/* ============================================================================
   THE SEASON PAGE — form-guide conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   Top-down:

     LEAD      what this season's research set holds — one sentence with its
               counts inline. Omitted whole when the set is empty.
     SUPPORTS  the sample's shape in ruled rows: teams, upcoming/completed
               split, home/away split; the provider average demoted.
     FIXTURES  upcoming then recent qualified rows — honest empties.
     DETAIL    teams, market activity, evidence bundle, the honest absence of
               goal/xG enrichment, related graph entities.
     LAST      one commercial block: available operators as ruled rows.
   ========================================================================== */

export function SeasonDetailView({
  season,
  locale,
  intelligence,
  upcoming,
  recent,
  teams,
  operators,
  visitorCountry,
  p,
}: {
  season: SeasonEntity;
  locale: Locale;
  intelligence: SeasonIntelligence;
  upcoming: QualifiedFixture[];
  recent: QualifiedFixture[];
  teams: TeamEntity[];
  operators: SeasonOperatorRow[];
  visitorCountry: string;
  p: PredictionStrings;
}) {
  const competition = getCompetition(season.competitionSlug);
  const relatedItemList = graphRelatedItemListLd({
    type: "season",
    slug: season.id,
    locale,
    siteUrl: siteUrl(),
  });
  const evidenceBundle = fromSeasonIntelligence(intelligence, `season:${season.id}`);
  const total = intelligence.qualifiedFixtureCount;

  return (
    <>
      <SeasonPageTracker
        seasonSlug={season.slug}
        competitionSlug={season.competitionSlug}
        locale={locale}
      />
      <EntityViewTracker
        entityType="season"
        entitySlug={season.id}
        locale={locale}
        title={season.displayName}
        href={`/${locale}/competitions/${season.competitionSlug}/seasons/${season.slug}`}
      />
      <JsonLd data={seasonCollectionPageLd({ season, locale })} />
      <JsonLd data={seasonBreadcrumbLd({ season, locale })} />
      {relatedItemList && <JsonLd data={relatedItemList} />}

      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
          <Link href={`/${locale}`} className="hover:text-[var(--hero-ink)]">
            Home
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link
            href={seasonCompetitionHref(locale, season.competitionSlug)}
            className="hover:text-[var(--hero-ink)]"
          >
            {competition?.name ?? season.competitionSlug}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={seasonsIndexPath(locale)} className="hover:text-[var(--hero-ink)]">
            {p.cmpSeasonsTitle}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span className="text-[var(--hero-ink)]">{season.yearLabel}</span>
        </nav>

        <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">
            {p.ssnEyebrow} · {season.active ? p.ssnCurrent : p.ssnArchived}
            {season.countryCode ? ` · ${countryName(season.countryCode)}` : ""}
          </p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            {season.displayName}
          </h1>
          <p className="rw-m mt-3 text-[var(--hero-ink-2)]">
            {formatDict(p.ssnWindowLine, { start: season.startDate, end: season.endDate })}
          </p>
        </header>

        {/* LEAD — omitted whole on an empty research set (the empty-state law). */}
        {total > 0 ? (
          <section aria-labelledby="ssn-lead-heading" className="mt-14">
            <p className="rw-m text-[var(--hero-ink-2)]">{p.mktLeadEyebrow}</p>
            <h2
              id="ssn-lead-heading"
              className="rw-h mt-2.5 max-w-[30ch] text-[clamp(1.6rem,3.6vw,2.4rem)] text-[var(--hero-ink)]"
            >
              {formatDict(p.ssnLeadLine, {
                count: String(total),
                fixtures: String(intelligence.uniqueMatchCount),
              })}
            </h2>
          </section>
        ) : null}

        {/* SUPPORTS — the sample's shape, counts only, provider figure demoted. */}
        {total > 0 ? (
          <section aria-labelledby="ssn-supports-heading" className="mt-12">
            <h2 id="ssn-supports-heading" className="rw-m text-[var(--hero-ink-2)]">
              {p.mktSupportsTitle}
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
              {p.mktSupportsNote}
            </p>
            <ul className="mt-5 border-t-[1.5px] border-[var(--hero-ink)]">
              {intelligence.participatingTeamCount > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.ssnTeamsCountLine, {
                    n: String(intelligence.participatingTeamCount),
                  })}
                </li>
              ) : null}
              {intelligence.upcomingCount > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.ssnUpcomingRowsLine, { n: String(intelligence.upcomingCount) })}
                </li>
              ) : null}
              {intelligence.completedCount > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.ssnCompletedRowsLine, { n: String(intelligence.completedCount) })}
                </li>
              ) : null}
              {intelligence.homeRows + intelligence.awayRows > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.ssnHomeAwayLine, {
                    home: String(intelligence.homeRows),
                    away: String(intelligence.awayRows),
                  })}
                </li>
              ) : null}
            </ul>
            {intelligence.averageModelProbability !== null ? (
              <p className="rw-m mt-4 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
                {formatDict(p.mktProviderAvgLine, {
                  pct: String(Math.round(intelligence.averageModelProbability)),
                })}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* FIXTURES — upcoming, then recent. Honest empties. */}
        <section
          aria-labelledby="ssn-upcoming-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="ssn-upcoming-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpUpcomingTitle}
          </h2>
          <FixtureRows
            fixtures={upcoming}
            season={season}
            locale={locale}
            empty={p.cmpUpcomingEmpty}
            potentialLabel={p.rankedPotentialLabel}
          />
        </section>

        <section aria-labelledby="ssn-recent-heading" className="mt-12">
          <h2 id="ssn-recent-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpRecentTitle}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {p.cmpRecentNote}
          </p>
          <FixtureRows
            fixtures={recent}
            season={season}
            locale={locale}
            empty={p.cmpRecentEmpty}
            potentialLabel={p.rankedPotentialLabel}
          />
        </section>

        {/* DETAIL — teams, market activity, evidence, honest enrichment absence. */}
        <section
          aria-labelledby="ssn-detail-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="ssn-detail-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.ssnDetailTitle}
          </h2>

          <div className="mt-6">
            <h3 className="rw-label text-[var(--hero-ink-2)]">{p.ssnTeamsTitle}</h3>
            {teams.length === 0 ? (
              <p className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
                {p.ssnTeamsEmpty}
              </p>
            ) : (
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {teams.map((team) => (
                  <li key={team.slug}>
                    <SeasonTeamLink
                      href={seasonTeamHref(locale, team.slug)}
                      seasonSlug={season.slug}
                      competitionSlug={season.competitionSlug}
                      teamSlug={team.slug}
                      locale={locale}
                      className="rw-m inline-flex border border-[var(--hero-line)] px-2.5 py-1 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
                    >
                      {team.name}
                    </SeasonTeamLink>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8">
            <h3 className="rw-label text-[var(--hero-ink-2)]">{p.cmpMarketActivityTitle}</h3>
            {intelligence.marketProfile.length === 0 ? (
              <p className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
                {p.cmpMarketActivityEmpty}
              </p>
            ) : (
              <ul className="mt-2.5 border-t border-[var(--hero-line)]">
                {intelligence.marketProfile.map((row) => (
                  <li
                    key={row.marketSlug}
                    className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5"
                  >
                    <SeasonMarketLink
                      href={seasonMarketHref(locale, row.marketSlug)}
                      seasonSlug={season.slug}
                      competitionSlug={season.competitionSlug}
                      marketSlug={row.marketSlug}
                      locale={locale}
                      className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
                    >
                      {row.marketLabel}
                    </SeasonMarketLink>
                    <span className="rw-m text-[var(--hero-ink-2)]">
                      {row.averageModelProbability !== null
                        ? formatDict(p.cmpRowsProviderMeta, {
                            n: String(row.qualifiedCount),
                            pct: String(Math.round(row.averageModelProbability)),
                          })
                        : formatDict(p.cmpQualifiedRowsLine, { n: String(row.qualifiedCount) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8">
            <EvidenceSection bundle={evidenceBundle} locale={locale} country={visitorCountry} />
          </div>

          {!intelligence.hasGoalEnrichment ? (
            <p className="mt-8 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
              {p.ssnEnrichmentAbsent}{" "}
              <Link
                href={seasonEvidenceHref(locale)}
                className="underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
                {p.cmpMethodologyLink}
              </Link>
            </p>
          ) : null}

          <GraphEntityPanel entityType="season" entitySlug={season.id} locale={locale} />

          <EntityDiscoverySection
            entityType="season"
            entitySlug={season.id}
            locale={locale}
            country={visitorCountry}
          />
        </section>

        {/* LAST — the single commercial block. */}
        <section
          aria-labelledby="ssn-operators-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="ssn-operators-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.ssnOperatorsTitle}
          </h2>
          {operators.length === 0 ? (
            <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
              {p.ssnOperatorsEmpty}
            </p>
          ) : (
            <ul className="mt-5 border-t border-[var(--hero-line)]">
              {operators.slice(0, 8).map(({ operator, availability }) => (
                <li
                  key={operator.slug}
                  className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5"
                >
                  <SeasonOperatorLink
                    href={seasonOperatorHref(locale, operator.slug)}
                    seasonSlug={season.slug}
                    competitionSlug={season.competitionSlug}
                    operatorSlug={operator.slug}
                    locale={locale}
                    className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
                  >
                    {operator.name}
                  </SeasonOperatorLink>
                  <span className="rw-m text-[var(--hero-ink-2)]">{availability.label}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {p.fxOperatorsNote}
          </p>
        </section>
      </div>
    </>
  );
}

function FixtureRows({
  fixtures,
  season,
  locale,
  empty,
  potentialLabel,
}: {
  fixtures: QualifiedFixture[];
  season: SeasonEntity;
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
              <SeasonFixtureLink
                href={seasonFixtureHref(locale)}
                seasonSlug={season.slug}
                competitionSlug={season.competitionSlug}
                fixtureId={fixture.matchId}
                locale={locale}
                className="text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
                <span className="text-[14px] font-semibold tracking-[-0.01em]">
                  {fixture.home} v {fixture.away}
                </span>
              </SeasonFixtureLink>
              <p className="rw-m mt-1 text-[var(--hero-ink-2)]">
                {fixture.league} · {fixture.market} · {fixture.kickoff}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className="rw-tnum text-[15px] font-bold text-[var(--hero-ink)]">
                {fixture.modelProbability}%
              </span>
              <span className="rw-m block text-[var(--hero-ink-2)]">{potentialLabel}</span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
