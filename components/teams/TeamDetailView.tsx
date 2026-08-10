import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { fromTeamIntelligence } from "@/lib/evidence-ui";
import { countryHubHref } from "@/lib/countries/landing";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import type { Locale } from "@/lib/i18n";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";
import { AddToAccaButton } from "@/components/acca/AddToAccaButton";
import { fixturePath } from "@/lib/fixtures/paths";
import { siteUrl } from "@/lib/seo";
import { teamBreadcrumbLd, teamWebPageLd } from "@/lib/teams/schema";
import {
  teamCompetitionHref,
  teamEvidenceHref,
  teamFixtureHref,
  teamMarketHref,
  teamOperatorHref,
  teamPath,
  teamsIndexPath,
} from "@/lib/teams/links";
import type { TeamOperatorRow } from "@/lib/teams/operators";
import { getRelatedTeams } from "@/lib/teams/registry";
import { getCompetition } from "@/lib/competitions/registry";
import type { TeamEntity, TeamIntelligence } from "@/lib/teams/types";
import {
  TeamCompetitionLink,
  TeamEvidenceLink,
  TeamFixtureLink,
  TeamMarketLink,
  TeamOperatorLink,
  TeamPageTracker,
  TeamRelatedLink,
} from "./TeamInteractive";

/* ============================================================================
   THE TEAM PAGE — form-guide conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   Top-down:

     LEAD      what this team's research set holds — one sentence with its
               counts inline. Omitted whole when the set is empty.
     SUPPORTS  the sample's shape: qualified rows, unique fixtures, home/away
               split; the provider average demoted to the label register.
     FIXTURES  upcoming then recent qualified rows — honest empties.
     DETAIL    competitions, goal-market profile, evidence bundle, the honest
               absence of goal/xG enrichment, related graph entities and
               related teams.
     LAST      one commercial block: available operators as ruled rows.
   ========================================================================== */

export function TeamDetailView({
  team,
  locale,
  intelligence,
  upcoming,
  recent,
  operators,
  visitorCountry,
  p,
}: {
  team: TeamEntity;
  locale: Locale;
  intelligence: TeamIntelligence;
  upcoming: QualifiedFixture[];
  recent: QualifiedFixture[];
  operators: TeamOperatorRow[];
  visitorCountry: string;
  p: PredictionStrings;
}) {
  const relatedTeams = getRelatedTeams(team.slug, 6);
  const relatedItemList = graphRelatedItemListLd({
    type: "team",
    slug: team.slug,
    locale,
    siteUrl: siteUrl(),
  });
  const evidenceBundle = fromTeamIntelligence(intelligence, `team:${team.slug}`);
  const total = intelligence.matchesInSample;

  return (
    <>
      <TeamPageTracker teamSlug={team.slug} teamId={team.id} locale={locale} />
      <EntityViewTracker
        entityType="team"
        entitySlug={team.slug}
        locale={locale}
        title={team.name}
        href={`/${locale}/teams/${team.slug}`}
      />
      <JsonLd data={teamWebPageLd({ team, locale })} />
      <JsonLd data={teamBreadcrumbLd({ team, locale })} />
      {relatedItemList && <JsonLd data={relatedItemList} />}

      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
          <Link href={`/${locale}`} className="hover:text-[var(--hero-ink)]">
            Home
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={teamsIndexPath(locale)} className="hover:text-[var(--hero-ink)]">
            {p.tmIndexTitle}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span className="text-[var(--hero-ink)]">{team.name}</span>
        </nav>

        <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">
            {p.tmIndexEyebrow}
            {team.countryCode ? (
              <>
                {" · "}
                {countryHubHref(locale, team.countryCode) ? (
                  <Link
                    href={countryHubHref(locale, team.countryCode)!}
                    className="hover:text-[var(--hero-ink)]"
                  >
                    {countryName(team.countryCode)}
                  </Link>
                ) : (
                  countryName(team.countryCode)
                )}
              </>
            ) : null}
          </p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            {team.name}
          </h1>
        </header>

        {/* LEAD — omitted whole on an empty research set (the empty-state law). */}
        {total > 0 ? (
          <section aria-labelledby="tm-lead-heading" className="mt-14">
            <p className="rw-m text-[var(--hero-ink-2)]">{p.mktLeadEyebrow}</p>
            <h2
              id="tm-lead-heading"
              className="rw-h mt-2.5 max-w-[30ch] text-[clamp(1.6rem,3.6vw,2.4rem)] text-[var(--hero-ink)]"
            >
              {formatDict(p.tmLeadLine, {
                count: String(total),
                fixtures: String(intelligence.uniqueMatchCount),
              })}
            </h2>
          </section>
        ) : null}

        {/* SUPPORTS — the sample's shape, counts only, provider figure demoted. */}
        {total > 0 ? (
          <section aria-labelledby="tm-supports-heading" className="mt-12">
            <h2 id="tm-supports-heading" className="rw-m text-[var(--hero-ink-2)]">
              {p.mktSupportsTitle}
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
              {p.mktSupportsNote}
            </p>
            <ul className="mt-5 border-t-[1.5px] border-[var(--hero-ink)]">
              <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.cmpQualifiedRowsLine, { n: String(total) })}
              </li>
              {intelligence.uniqueMatchCount > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.cmpUniqueFixturesLine, {
                    n: String(intelligence.uniqueMatchCount),
                  })}
                </li>
              ) : null}
              {intelligence.homeAppearances + intelligence.awayAppearances > 0 ? (
                <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                  {formatDict(p.ssnHomeAwayLine, {
                    home: String(intelligence.homeAppearances),
                    away: String(intelligence.awayAppearances),
                  })}
                </li>
              ) : null}
            </ul>
            <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
              {formatDict(p.tmHomeAwayNote, { team: team.name })}
            </p>
            {intelligence.averageModelProbability !== null ? (
              <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
                {formatDict(p.mktProviderAvgLine, {
                  pct: String(Math.round(intelligence.averageModelProbability)),
                })}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* FIXTURES — upcoming, then recent. Honest empties. */}
        <section
          aria-labelledby="tm-upcoming-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="tm-upcoming-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpUpcomingTitle}
          </h2>
          <FixtureRows
            fixtures={upcoming}
            team={team}
            locale={locale}
            empty={p.tmUpcomingEmpty}
            potentialLabel={p.rankedPotentialLabel}
          />
        </section>

        <section aria-labelledby="tm-recent-heading" className="mt-12">
          <h2 id="tm-recent-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpRecentTitle}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {p.cmpRecentNote}
          </p>
          <FixtureRows
            fixtures={recent}
            team={team}
            locale={locale}
            empty={p.tmRecentEmpty}
            potentialLabel={p.rankedPotentialLabel}
          />
        </section>

        {/* DETAIL — competitions, market profile, evidence, honest absences. */}
        <section
          aria-labelledby="tm-detail-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="tm-detail-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.tmDetailTitle}
          </h2>

          {team.competitionSlugs.length ? (
            <div className="mt-6">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.tmCompetitionsTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {team.competitionSlugs.map((slug) => (
                  <li key={slug}>
                    <TeamCompetitionLink
                      href={teamCompetitionHref(locale, slug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      competitionSlug={slug}
                      locale={locale}
                      className="rw-m inline-flex border border-[var(--hero-line)] px-2.5 py-1 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
                    >
                      {getCompetition(slug)?.name ?? slug.replace(/-/g, " ")}
                    </TeamCompetitionLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <h3 className="rw-label text-[var(--hero-ink-2)]">{p.tmMarketProfileTitle}</h3>
            {intelligence.marketProfile.length === 0 ? (
              <p className="mt-2.5 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
                {p.tmMarketProfileEmpty}
              </p>
            ) : (
              <ul className="mt-2.5 border-t border-[var(--hero-line)]">
                {intelligence.marketProfile.map((row) => (
                  <li
                    key={row.marketSlug}
                    className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5"
                  >
                    <TeamMarketLink
                      href={teamMarketHref(locale, row.marketSlug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      marketSlug={row.marketSlug}
                      locale={locale}
                      className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
                    >
                      {row.marketLabel}
                    </TeamMarketLink>
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

          {team.relatedMarketSlugs.length ? (
            <div className="mt-8">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.mktRelatedTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {team.relatedMarketSlugs.map((slug) => (
                  <li key={slug}>
                    <TeamMarketLink
                      href={teamMarketHref(locale, slug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      marketSlug={slug}
                      locale={locale}
                      className="rw-m inline-flex border border-[var(--hero-line)] px-2.5 py-1 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
                    >
                      {slug.replace(/-/g, " ")}
                    </TeamMarketLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <EvidenceSection bundle={evidenceBundle} locale={locale} country={visitorCountry} />
          </div>

          {!intelligence.hasGoalEnrichment ? (
            <p className="mt-8 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
              {p.tmEnrichmentAbsent}{" "}
              <TeamEvidenceLink
                href={teamEvidenceHref(locale)}
                teamSlug={team.slug}
                teamId={team.id}
                locale={locale}
                className="underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
                {p.cmpMethodologyLink}
              </TeamEvidenceLink>
            </p>
          ) : null}

          <GraphEntityPanel entityType="team" entitySlug={team.slug} locale={locale} />

          <EntityDiscoverySection
            entityType="team"
            entitySlug={team.slug}
            locale={locale}
            country={visitorCountry}
          />

          {relatedTeams.length ? (
            <div className="mt-8">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.tmRelatedTeams}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {relatedTeams.map((related) => (
                  <li key={related.slug}>
                    <TeamRelatedLink
                      href={teamPath(locale, related.slug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      relatedSlug={related.slug}
                      locale={locale}
                      className="rw-m inline-flex border border-[var(--hero-line)] px-2.5 py-1 text-[var(--hero-ink)] transition-colors hover:border-[var(--hero-ink)]"
                    >
                      {related.name}
                    </TeamRelatedLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* LAST — the single commercial block. */}
        <section
          aria-labelledby="tm-operators-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="tm-operators-heading" className="rw-m text-[var(--hero-ink-2)]">
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
                  <TeamOperatorLink
                    href={teamOperatorHref(locale, operator.slug)}
                    teamSlug={team.slug}
                    teamId={team.id}
                    operatorSlug={operator.slug}
                    locale={locale}
                    className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
                  >
                    {operator.name}
                  </TeamOperatorLink>
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
  team,
  locale,
  empty,
  potentialLabel,
}: {
  fixtures: QualifiedFixture[];
  team: TeamEntity;
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
              <TeamFixtureLink
                href={teamFixtureHref(locale)}
                teamSlug={team.slug}
                teamId={team.id}
                fixtureId={fixture.matchId}
                locale={locale}
                className="text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
                <span className="text-[14px] font-semibold tracking-[-0.01em]">
                  {fixture.home} v {fixture.away}
                </span>
              </TeamFixtureLink>
              <p className="rw-m mt-1 text-[var(--hero-ink-2)]">
                {fixture.league} · {fixture.market} · {fixture.kickoff}
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
                  matchHref: fixturePath(locale, fixture.matchId, fixture.marketKind, "team"),
                  source: "team",
                }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
