import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { fromTeamIntelligence } from "@/lib/evidence-ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { countryPath } from "@/lib/countries/links";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import type { Locale } from "@/lib/i18n";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { AddToAccaButton } from "@/components/acca/AddToAccaButton";
import { fixturePath } from "@/lib/fixtures/paths";
import { siteUrl } from "@/lib/seo";
import {
  teamBreadcrumbLd,
  teamWebPageLd,
} from "@/lib/teams/schema";
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

export function TeamDetailView({
  team,
  locale,
  intelligence,
  upcoming,
  recent,
  operators,
  visitorCountry,
}: {
  team: TeamEntity;
  locale: Locale;
  intelligence: TeamIntelligence;
  upcoming: QualifiedFixture[];
  recent: QualifiedFixture[];
  operators: TeamOperatorRow[];
  visitorCountry: string;
}) {
  const relatedTeams = getRelatedTeams(team.slug, 6);
  const relatedItemList = graphRelatedItemListLd({
    type: "team",
    slug: team.slug,
    locale,
    siteUrl: siteUrl(),
  });
  const evidenceBundle = fromTeamIntelligence(intelligence, `team:${team.slug}`);

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

      <div className="container-wide pb-16 pt-5">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href={teamsIndexPath(locale)} className="hover:text-foreground">Teams</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{team.name}</span>
        </nav>

        <section className="border-b border-[var(--border-subtle)] pb-8 pt-6">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Team intelligence
            {team.countryCode ? (
              <>
                {" · "}
                <Link
                  href={countryPath(locale, team.countryCode)}
                  className="hover:underline"
                >
                  {countryName(team.countryCode)}
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            {team.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Research surface for {team.name}: qualified fixtures, market evidence from the
            RankWagers queue, and country-aware operators. No tips, ratings, or invented
            statistics.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Visitor country {visitorCountry}
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="overview">
          <h2 id="overview" className="font-display text-xl font-semibold text-foreground">
            Team overview
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Qualified market rows" value={String(intelligence.matchesInSample)} />
            <Stat label="Unique fixtures" value={String(intelligence.uniqueMatchCount)} />
            <Stat
              label="Avg model probability"
              value={
                intelligence.averageModelProbability === null
                  ? "—"
                  : `${intelligence.averageModelProbability}%`
              }
            />
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-metadata uppercase tracking-label text-muted-foreground">Evidence strength</p>
              <div className="mt-2">
                <EvidenceSummaryChip
                  strength={evidenceBundle.summaryStrength}
                  sampleSize={intelligence.uniqueMatchCount}
                />
              </div>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{intelligence.sampleNote}</p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="competitions">
          <h2 id="competitions" className="font-display text-xl font-semibold text-foreground">
            Current competitions
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {team.competitionSlugs.map((slug) => (
              <li key={slug}>
                <TeamCompetitionLink
                  href={teamCompetitionHref(locale, slug)}
                  teamSlug={team.slug}
                  teamId={team.id}
                  competitionSlug={slug}
                  locale={locale}
                  className="inline-flex rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand hover:bg-[var(--canvas-secondary)]"
                >
                  {slug.replace(/-/g, " ")}
                </TeamCompetitionLink>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="upcoming">
          <h2 id="upcoming" className="font-display text-xl font-semibold text-foreground">
            Upcoming qualified fixtures
          </h2>
          <FixtureList
            fixtures={upcoming}
            teamSlug={team.slug}
            teamId={team.id}
            locale={locale}
            empty="No upcoming qualified fixtures for this team in the current research queue."
          />
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="recent">
          <h2 id="recent" className="font-display text-xl font-semibold text-foreground">
            Recently analyzed fixtures
          </h2>
          <FixtureList
            fixtures={recent}
            teamSlug={team.slug}
            teamId={team.id}
            locale={locale}
            empty="No recently analyzed fixtures for this team in the current sample."
          />
        </section>

        <EvidenceSection
          bundle={evidenceBundle}
          locale={locale}
          country={visitorCountry}
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="evidence">
          <h2 id="evidence" className="font-display text-xl font-semibold text-foreground">
            Evidence snapshot
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Home appearances in sample" value={String(intelligence.homeAppearances)} />
            <Stat label="Away appearances in sample" value={String(intelligence.awayAppearances)} />
          </div>
          {!intelligence.hasGoalEnrichment ? (
            <div className="mt-4">
              <EmptyState
                title="Goal and xG enrichment unavailable"
                description="Team-level goals, xG, and clean-sheet rates are only shown when match-detail enrichment exists. This page does not invent those statistics."
                action={
                  <TeamEvidenceLink
                    href={teamEvidenceHref(locale)}
                    teamSlug={team.slug}
                    teamId={team.id}
                    locale={locale}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Review methodology
                  </TeamEvidenceLink>
                }
              />
            </div>
          ) : null}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="home-away">
          <h2 id="home-away" className="font-display text-xl font-semibold text-foreground">
            Home and away profile
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-[var(--ink-secondary)]">
            Counts reflect qualified research rows where {team.name} appears as home or away.
            This is not a form table or tipster rating.
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Home rows" value={String(intelligence.homeAppearances)} />
            <Stat label="Away rows" value={String(intelligence.awayAppearances)} />
          </dl>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="markets">
          <h2 id="markets" className="font-display text-xl font-semibold text-foreground">
            Goal-market profile
          </h2>
          {intelligence.marketProfile.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No market profile yet"
                description="Qualified market rows for this team are not present in the current research sample."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {intelligence.marketProfile.map((row) => (
                <li key={row.marketSlug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <TeamMarketLink
                    href={teamMarketHref(locale, row.marketSlug)}
                    teamSlug={team.slug}
                    teamId={team.id}
                    marketSlug={row.marketSlug}
                    locale={locale}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {row.marketLabel}
                  </TeamMarketLink>
                  <p className="text-xs text-muted-foreground">
                    {row.qualifiedCount} rows
                    {row.averageModelProbability !== null
                      ? ` · avg model ${row.averageModelProbability}%`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
              Related markets
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {team.relatedMarketSlugs.map((slug) => (
                <li key={slug}>
                  <TeamMarketLink
                    href={teamMarketHref(locale, slug)}
                    teamSlug={team.slug}
                    teamId={team.id}
                    marketSlug={slug}
                    locale={locale}
                    className="inline-flex rounded-md border border-border px-2.5 py-1 text-sm text-brand hover:bg-[var(--canvas-secondary)]"
                  >
                    {slug.replace(/-/g, " ")}
                  </TeamMarketLink>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="operators">
          <h2 id="operators" className="font-display text-xl font-semibold text-foreground">
            Available operators
          </h2>
          {operators.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No operators listed"
                description="Affiliate-enabled operator coverage is unavailable for this context."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {operators.slice(0, 8).map(({ operator, availability }) => (
                <li
                  key={operator.slug}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <TeamOperatorLink
                    href={teamOperatorHref(locale, operator.slug)}
                    teamSlug={team.slug}
                    teamId={team.id}
                    operatorSlug={operator.slug}
                    locale={locale}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {operator.name}
                  </TeamOperatorLink>
                  <span
                    className={`text-xs ${
                      availability.available ? "text-[var(--green-deep)]" : "text-[var(--amber-primary)]"
                    }`}
                  >
                    {availability.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <GraphEntityPanel entityType="team" entitySlug={team.slug} locale={locale} />

        <EntityDiscoverySection
          entityType="team"
          entitySlug={team.slug}
          locale={locale}
          country={visitorCountry}
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="related-teams">
          <h2 id="related-teams" className="font-display text-xl font-semibold text-foreground">
            Related teams
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {relatedTeams.map((related) => (
              <li key={related.slug}>
                <TeamRelatedLink
                  href={teamPath(locale, related.slug)}
                  teamSlug={team.slug}
                  teamId={team.id}
                  relatedSlug={related.slug}
                  locale={locale}
                  className="inline-flex rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand hover:bg-[var(--canvas-secondary)]"
                >
                  {related.name}
                </TeamRelatedLink>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function FixtureList({
  fixtures,
  teamSlug,
  teamId,
  locale,
  empty,
}: {
  fixtures: QualifiedFixture[];
  teamSlug: string;
  teamId: string;
  locale: Locale;
  empty: string;
}) {
  if (!fixtures.length) {
    return (
      <div className="mt-3">
        <EmptyState title="No fixtures in this sample" description={empty} />
      </div>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
      {fixtures.map((fixture) => (
        <li key={fixture.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <TeamFixtureLink
              href={teamFixtureHref(locale)}
              teamSlug={teamSlug}
              teamId={teamId}
              fixtureId={fixture.matchId}
              locale={locale}
              className="text-sm font-medium text-brand hover:underline"
            >
              {fixture.home} vs {fixture.away}
            </TeamFixtureLink>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fixture.league} · {fixture.market} · {fixture.kickoff}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-sm tabular-nums text-brand">{fixture.modelProbability}%</p>
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
                evidenceSummary: [
                  `Model ${fixture.modelProbability}% · ${fixture.market}`,
                ],
                publishedAt: fixture.updatedDateTime,
                matchHref: fixturePath(
                  locale,
                  fixture.matchId,
                  fixture.marketKind,
                  "team"
                ),
                source: "team",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-3">
      <dt className="text-metadata uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
