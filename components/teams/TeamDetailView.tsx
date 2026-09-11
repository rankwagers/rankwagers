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
  research,
}: {
  team: TeamEntity;
  locale: Locale;
  intelligence: TeamIntelligence;
  upcoming: QualifiedFixture[];
  recent: QualifiedFixture[];
  operators: TeamOperatorRow[];
  visitorCountry: string;
  p: PredictionStrings;
  /** Block H: venue form + H2H from the team's OWN board fixture — null omits both. */
  research?: import("@/lib/v3/teamResearch.server").TeamResearch | null;
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

      <div className="px-5 pb-16">
        <nav
          aria-label="Breadcrumb"
          className="pt-3.5 text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          <Link href={`/${locale}`}>{p.nvHome}</Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={teamsIndexPath(locale)}>{p.tmIndexTitle}</Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span style={{ color: "var(--text)" }}>{team.name}</span>
        </nav>

        <header className="mt-4 pb-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
          <p className="rw3-label" style={{ margin: 0 }}>
            {p.tmIndexEyebrow}
            {team.countryCode ? (
              <>
                {" · "}
                {countryHubHref(locale, team.countryCode) ? (
                  <Link href={countryHubHref(locale, team.countryCode)!}>
                    {countryName(team.countryCode)}
                  </Link>
                ) : (
                  countryName(team.countryCode)
                )}
              </>
            ) : null}
          </p>
          <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
            {team.name}
          </h1>
        </header>

        {/* LEAD — omitted whole on an empty research set (the empty-state law). */}
        {total > 0 ? (
          <section aria-labelledby="tm-lead-heading" className="mt-8">
            <p className="rw3-label">{p.mktLeadEyebrow}</p>
            <h2 id="tm-lead-heading" className="mt-1.5 max-w-[52ch] text-[14px] font-semibold">
              {formatDict(p.tmLeadLine, {
                count: String(total),
                fixtures: String(intelligence.uniqueMatchCount),
              })}
            </h2>
          </section>
        ) : null}

        {/* SUPPORTS — the sample's shape, counts only, provider figure demoted. */}
        {total > 0 ? (
          <section aria-labelledby="tm-supports-heading" className="mt-8">
            <h2 id="tm-supports-heading" className="rw3-label">
              {p.mktSupportsTitle}
            </h2>
            <p
              className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {p.mktSupportsNote}
            </p>
            <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
              <li className="py-3 text-[13px]" style={{ borderBottom: "1px solid var(--line)" }}>
                {formatDict(p.cmpQualifiedRowsLine, { n: String(total) })}
              </li>
              {intelligence.uniqueMatchCount > 0 ? (
                <li
                  className="py-3 text-[13px]"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {formatDict(p.cmpUniqueFixturesLine, {
                    n: String(intelligence.uniqueMatchCount),
                  })}
                </li>
              ) : null}
              {intelligence.homeAppearances + intelligence.awayAppearances > 0 ? (
                <li
                  className="py-3 text-[13px]"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {formatDict(p.ssnHomeAwayLine, {
                    home: String(intelligence.homeAppearances),
                    away: String(intelligence.awayAppearances),
                  })}
                </li>
              ) : null}
            </ul>
            <p
              className="mt-3 max-w-[52ch] text-[13px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {formatDict(p.tmHomeAwayNote, { team: team.name })}
            </p>
            {intelligence.averageModelProbability !== null ? (
              <p className="rw3-meta mt-3">
                {formatDict(p.mktProviderAvgLine, {
                  pct: String(Math.round(intelligence.averageModelProbability)),
                })}
              </p>
            ) : null}
          </section>
        ) : null}

        {/*
          FORM + H2H (Bible V3, block H). One honest source: the team's own
          fixture on the current board — venue-scoped last five as score
          chips colored by outcome, and the head-to-head against the actual
          next opponent. No fixture today → no sections (one clock; a form
          strip from another day's board would be a second one).
        */}
        {research ? (
          <section
            aria-labelledby="tm-form-heading"
            className="mt-10 pt-8"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <h2 id="tm-form-heading" className="rw3-label">
              {p.v3FormLast5}
            </h2>
            {research.form.length ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {research.form.map((chip, index) => (
                  <span
                    key={`${chip.score}-${index}`}
                    className="rw3-pill"
                    title={chip.opponent}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 7px",
                      color:
                        chip.outcome === "won"
                          ? "var(--win)"
                          : chip.outcome === "lost"
                            ? "var(--loss)"
                            : "var(--muted)",
                    }}
                  >
                    {chip.score}
                  </span>
                ))}
                <span className="rw3-meta" style={{ marginLeft: 4 }}>
                  {formatDict(
                    research.venue === "home" ? p.fxScopeRecentHome : p.fxScopeRecentAway,
                    { team: team.name, n: String(research.form.length) }
                  )}
                </span>
              </div>
            ) : null}
            {research.h2h.length ? (
              <>
                <h3 className="rw3-label mt-5">
                  {formatDict(p.v3H2hLast, { n: String(research.h2h.length) })}
                </h3>
                <ul className="mt-1" style={{ margin: 0, padding: 0 }}>
                  {research.h2h.map((row) => (
                    <li
                      key={`${row.kickoffAt}-${row.label}`}
                      className="flex items-baseline gap-3 py-1.5 text-[12px]"
                      style={{ listStyle: "none", borderBottom: "1px solid var(--line)" }}
                    >
                      <span style={{ color: "var(--muted)", width: 84, flex: "none" }}>
                        {row.kickoffAt.slice(0, 10)}
                      </span>
                      <span className="min-w-0 flex-1">{row.label}</span>
                      <span style={{ fontWeight: 600 }}>{row.score}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

        {/* FIXTURES — upcoming, then recent. Honest empties. */}
        <section
          aria-labelledby="tm-upcoming-heading"
          className="mt-10 pt-8"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <h2 id="tm-upcoming-heading" className="rw3-label">
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

        <section aria-labelledby="tm-recent-heading" className="mt-8">
          <h2 id="tm-recent-heading" className="rw3-label">
            {p.cmpRecentTitle}
          </h2>
          <p
            className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
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
          className="mt-10 pt-8"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <h2 id="tm-detail-heading" className="rw3-label">
            {p.tmDetailTitle}
          </h2>

          {team.competitionSlugs.length ? (
            <div className="mt-6">
              <h3 className="rw3-label">{p.tmCompetitionsTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {team.competitionSlugs.map((slug) => (
                  <li key={slug}>
                    <TeamCompetitionLink
                      href={teamCompetitionHref(locale, slug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      competitionSlug={slug}
                      locale={locale}
                      className="rw3-ghost"
                    >
                      {getCompetition(slug)?.name ?? slug.replace(/-/g, " ")}
                    </TeamCompetitionLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <h3 className="rw3-label">{p.tmMarketProfileTitle}</h3>
            {intelligence.marketProfile.length === 0 ? (
              <p
                className="mt-2.5 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
                style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
              >
                {p.tmMarketProfileEmpty}
              </p>
            ) : (
              <ul className="mt-2.5" style={{ borderTop: "1px solid var(--line)" }}>
                {intelligence.marketProfile.map((row) => (
                  <li
                    key={row.marketSlug}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <TeamMarketLink
                      href={teamMarketHref(locale, row.marketSlug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      marketSlug={row.marketSlug}
                      locale={locale}
                      className="text-[13px] font-semibold underline underline-offset-4"
                    >
                      {row.marketLabel}
                    </TeamMarketLink>
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

          {team.relatedMarketSlugs.length ? (
            <div className="mt-8">
              <h3 className="rw3-label">{p.mktRelatedTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {team.relatedMarketSlugs.map((slug) => (
                  <li key={slug}>
                    <TeamMarketLink
                      href={teamMarketHref(locale, slug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      marketSlug={slug}
                      locale={locale}
                      className="rw3-ghost"
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
            <p
              className="mt-8 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
              style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
            >
              {p.tmEnrichmentAbsent}{" "}
              <TeamEvidenceLink
                href={teamEvidenceHref(locale)}
                teamSlug={team.slug}
                teamId={team.id}
                locale={locale}
                className="underline underline-offset-4"
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
              <h3 className="rw3-label">{p.tmRelatedTeams}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {relatedTeams.map((related) => (
                  <li key={related.slug}>
                    <TeamRelatedLink
                      href={teamPath(locale, related.slug)}
                      teamSlug={team.slug}
                      teamId={team.id}
                      relatedSlug={related.slug}
                      locale={locale}
                      className="rw3-ghost"
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
          className="mt-10 pt-8"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <h2 id="tm-operators-heading" className="rw3-label">
            {p.ssnOperatorsTitle}
          </h2>
          {operators.length === 0 ? (
            <p
              className="mt-4 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
              style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
            >
              {p.ssnOperatorsEmpty}
            </p>
          ) : (
            <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
              {operators.slice(0, 8).map(({ operator, availability }) => (
                <li
                  key={operator.slug}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 py-2.5"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <TeamOperatorLink
                    href={teamOperatorHref(locale, operator.slug)}
                    teamSlug={team.slug}
                    teamId={team.id}
                    operatorSlug={operator.slug}
                    locale={locale}
                    className="text-[13px] font-semibold underline underline-offset-4"
                  >
                    {operator.name}
                  </TeamOperatorLink>
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
      <p
        className="mt-4 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
        style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
      >
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
      {fixtures.map((fixture) => (
        <li key={fixture.id}>
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-3"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div className="min-w-0">
              <TeamFixtureLink
                href={teamFixtureHref(locale)}
                teamSlug={team.slug}
                teamId={team.id}
                fixtureId={fixture.matchId}
                locale={locale}
                className="underline underline-offset-4"
              >
                <span className="text-[14px] font-semibold">
                  {fixture.home} v {fixture.away}
                </span>
              </TeamFixtureLink>
              <p className="rw3-meta mt-1">
                {fixture.league} · {fixture.market} · {fixture.kickoff}
              </p>
            </div>
            <div className="flex shrink-0 items-baseline gap-3">
              <p className="text-right">
                <span className="rw3-pct">{fixture.modelProbability}%</span>
                <span className="block" style={{ fontSize: 11, color: "var(--muted)" }}>
                  {potentialLabel}
                </span>
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
