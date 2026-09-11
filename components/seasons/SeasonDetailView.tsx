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
   THE SEASON PAGE — rw3 conversion, fixture-style hierarchy
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

      <div className="pb-16">
        <nav aria-label="Breadcrumb" className="rw3-meta px-5 pt-3">
          <Link href={`/${locale}`} className="hover:text-[var(--text)]">
            {p.nvHome}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link
            href={seasonCompetitionHref(locale, season.competitionSlug)}
            className="hover:text-[var(--text)]"
          >
            {competition?.name ?? season.competitionSlug}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={seasonsIndexPath(locale)} className="hover:text-[var(--text)]">
            {p.cmpSeasonsTitle}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span style={{ color: "var(--text)" }}>{season.yearLabel}</span>
        </nav>

        <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <p className="rw3-label" style={{ margin: 0 }}>
            {p.ssnEyebrow} · {season.active ? p.ssnCurrent : p.ssnArchived}
            {season.countryCode ? ` · ${countryName(season.countryCode)}` : ""}
          </p>
          <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
            {season.displayName}
          </h1>
          <p className="rw3-meta" style={{ margin: "2px 0 0" }}>
            {formatDict(p.ssnWindowLine, { start: season.startDate, end: season.endDate })}
          </p>
        </header>

        {/* LEAD — omitted whole on an empty research set (the empty-state law). */}
        {total > 0 ? (
          <section aria-labelledby="ssn-lead-heading" className="mt-8 px-5">
            <p className="rw3-label">{p.mktLeadEyebrow}</p>
            <h2 id="ssn-lead-heading" className="mt-2 max-w-[44ch] text-[14px] font-semibold">
              {formatDict(p.ssnLeadLine, {
                count: String(total),
                fixtures: String(intelligence.uniqueMatchCount),
              })}
            </h2>
          </section>
        ) : null}

        {/* SUPPORTS — the sample's shape, counts only, provider figure demoted. */}
        {total > 0 ? (
          <section aria-labelledby="ssn-supports-heading" className="mt-8 px-5">
            <h2 id="ssn-supports-heading" className="rw3-label">
              {p.mktSupportsTitle}
            </h2>
            <p className="rw3-meta mt-1.5 max-w-[52ch]">{p.mktSupportsNote}</p>
            <ul className="mt-4 border-t border-[var(--line)]">
              {intelligence.participatingTeamCount > 0 ? (
                <li className="border-b border-[var(--line)] py-2.5 text-[13px]">
                  {formatDict(p.ssnTeamsCountLine, {
                    n: String(intelligence.participatingTeamCount),
                  })}
                </li>
              ) : null}
              {intelligence.upcomingCount > 0 ? (
                <li className="border-b border-[var(--line)] py-2.5 text-[13px]">
                  {formatDict(p.ssnUpcomingRowsLine, { n: String(intelligence.upcomingCount) })}
                </li>
              ) : null}
              {intelligence.completedCount > 0 ? (
                <li className="border-b border-[var(--line)] py-2.5 text-[13px]">
                  {formatDict(p.ssnCompletedRowsLine, { n: String(intelligence.completedCount) })}
                </li>
              ) : null}
              {intelligence.homeRows + intelligence.awayRows > 0 ? (
                <li className="border-b border-[var(--line)] py-2.5 text-[13px]">
                  {formatDict(p.ssnHomeAwayLine, {
                    home: String(intelligence.homeRows),
                    away: String(intelligence.awayRows),
                  })}
                </li>
              ) : null}
            </ul>
            {intelligence.averageModelProbability !== null ? (
              <p className="rw3-meta mt-3">
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
          className="mt-10 border-t border-[var(--line)] px-5 pt-6"
        >
          <h2 id="ssn-upcoming-heading" className="rw3-label">
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

        <section aria-labelledby="ssn-recent-heading" className="mt-8 px-5">
          <h2 id="ssn-recent-heading" className="rw3-label">
            {p.cmpRecentTitle}
          </h2>
          <p className="rw3-meta mt-1.5 max-w-[52ch]">{p.cmpRecentNote}</p>
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
          className="mt-10 border-t border-[var(--line)] px-5 pt-6"
        >
          <h2 id="ssn-detail-heading" className="rw3-label">
            {p.ssnDetailTitle}
          </h2>

          <div className="mt-5">
            <h3 className="rw3-label">{p.ssnTeamsTitle}</h3>
            {teams.length === 0 ? (
              <p
                className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
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
                      className="rw3-pill hover:border-[var(--text)]"
                    >
                      {team.name}
                    </SeasonTeamLink>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6">
            <h3 className="rw3-label">{p.cmpMarketActivityTitle}</h3>
            {intelligence.marketProfile.length === 0 ? (
              <p
                className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {p.cmpMarketActivityEmpty}
              </p>
            ) : (
              <ul className="mt-2.5 border-t border-[var(--line)]">
                {intelligence.marketProfile.map((row) => (
                  <li
                    key={row.marketSlug}
                    className="rw3-hoverable flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--line)] py-2.5"
                  >
                    <SeasonMarketLink
                      href={seasonMarketHref(locale, row.marketSlug)}
                      seasonSlug={season.slug}
                      competitionSlug={season.competitionSlug}
                      marketSlug={row.marketSlug}
                      locale={locale}
                      className="text-[13px] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
                    >
                      {row.marketLabel}
                    </SeasonMarketLink>
                    <span className="rw3-meta">
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

          <div className="mt-6">
            <EvidenceSection bundle={evidenceBundle} locale={locale} country={visitorCountry} />
          </div>

          {!intelligence.hasGoalEnrichment ? (
            <p
              className="mt-6 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {p.ssnEnrichmentAbsent}{" "}
              <Link
                href={seasonEvidenceHref(locale)}
                className="underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
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
          className="mt-10 border-t border-[var(--line)] px-5 pt-6"
        >
          <h2 id="ssn-operators-heading" className="rw3-label">
            {p.ssnOperatorsTitle}
          </h2>
          {operators.length === 0 ? (
            <p
              className="mt-3 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {p.ssnOperatorsEmpty}
            </p>
          ) : (
            <ul className="mt-3 border-t border-[var(--line)]">
              {operators.slice(0, 8).map(({ operator, availability }) => (
                <li
                  key={operator.slug}
                  className="rw3-hoverable flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--line)] py-2.5"
                >
                  <SeasonOperatorLink
                    href={seasonOperatorHref(locale, operator.slug)}
                    seasonSlug={season.slug}
                    competitionSlug={season.competitionSlug}
                    operatorSlug={operator.slug}
                    locale={locale}
                    className="text-[13px] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
                  >
                    {operator.name}
                  </SeasonOperatorLink>
                  <span className="rw3-meta">{availability.label}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="rw3-meta mt-3">{p.fxOperatorsNote}</p>
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
      <p
        className="mt-3 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-3 border-t border-[var(--line)]">
      {fixtures.map((fixture) => (
        <li key={fixture.id}>
          <div className="rw3-hoverable grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-[var(--line)] py-3">
            <div className="min-w-0">
              <SeasonFixtureLink
                href={seasonFixtureHref(locale)}
                seasonSlug={season.slug}
                competitionSlug={season.competitionSlug}
                fixtureId={fixture.matchId}
                locale={locale}
                className="underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--text)]"
              >
                <span className="text-[14px] font-semibold">
                  {fixture.home} v {fixture.away}
                </span>
              </SeasonFixtureLink>
              <p className="rw3-meta mt-1">
                {fixture.league} · {fixture.market} · {fixture.kickoff}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className="rw3-pct">{fixture.modelProbability}%</span>
              <span className="block" style={{ fontSize: 11, color: "var(--muted)" }}>
                {potentialLabel}
              </span>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
