import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { fromSeasonIntelligence } from "@/lib/evidence-ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCompetition } from "@/lib/competitions/registry";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import type { Locale } from "@/lib/i18n";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { siteUrl } from "@/lib/seo";
import {
  seasonBreadcrumbLd,
  seasonCollectionPageLd,
} from "@/lib/seasons/schema";
import {
  seasonCompetitionHref,
  seasonEvidenceHref,
  seasonFixtureHref,
  seasonMarketHref,
  seasonOperatorHref,
  seasonPath,
  seasonTeamHref,
  seasonsIndexPath,
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

export function SeasonDetailView({
  season,
  locale,
  intelligence,
  upcoming,
  recent,
  teams,
  operators,
  visitorCountry,
}: {
  season: SeasonEntity;
  locale: Locale;
  intelligence: SeasonIntelligence;
  upcoming: QualifiedFixture[];
  recent: QualifiedFixture[];
  teams: TeamEntity[];
  operators: SeasonOperatorRow[];
  visitorCountry: string;
}) {
  const competition = getCompetition(season.competitionSlug);
  const relatedItemList = graphRelatedItemListLd({
    type: "season",
    slug: season.id,
    locale,
    siteUrl: siteUrl(),
  });
  const evidenceBundle = fromSeasonIntelligence(intelligence, `season:${season.id}`);

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

      <div className="container-wide pb-16 pt-5">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/${locale}/competitions`} className="hover:text-foreground">
            Competitions
          </Link>
          <span className="mx-1.5">/</span>
          <Link
            href={seasonCompetitionHref(locale, season.competitionSlug)}
            className="hover:text-foreground"
          >
            {competition?.name ?? season.competitionSlug}
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={seasonsIndexPath(locale)} className="hover:text-foreground">
            Seasons
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{season.yearLabel}</span>
        </nav>

        <section className="border-b border-[var(--border-subtle)] pb-8 pt-6">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Season intelligence
            {season.active ? " · Current" : " · Archived"}
            {season.countryCode ? ` · ${countryName(season.countryCode)}` : ""}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            {season.displayName}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Research terminal for {season.displayName}: qualified fixtures, participating teams,
            market coverage, and country-aware operators. No standings, predictions, or invented
            statistics.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Window {season.startDate} → {season.endDate} · Visitor country {visitorCountry}
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="overview">
          <h2 id="overview" className="font-display text-xl font-semibold text-foreground">
            Season overview
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Qualified market rows" value={String(intelligence.qualifiedFixtureCount)} />
            <Stat label="Unique fixtures" value={String(intelligence.uniqueMatchCount)} />
            <Stat label="Participating teams" value={String(intelligence.participatingTeamCount)} />
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
          <p className="mt-4 text-sm">
            <Link
              href={seasonCompetitionHref(locale, season.competitionSlug)}
              className="font-medium text-brand hover:underline"
            >
              Open competition intelligence →
            </Link>
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="teams">
          <h2 id="teams" className="font-display text-xl font-semibold text-foreground">
            Participating teams
          </h2>
          {teams.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No verified teams in this sample"
                description="Teams appear here only when they are present in qualified fixtures for this season."
              />
            </div>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {teams.map((team) => (
                <li key={team.slug}>
                  <SeasonTeamLink
                    href={seasonTeamHref(locale, team.slug)}
                    seasonSlug={season.slug}
                    competitionSlug={season.competitionSlug}
                    teamSlug={team.slug}
                    locale={locale}
                    className="inline-flex rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand hover:bg-[var(--canvas-secondary)]"
                  >
                    {team.name}
                  </SeasonTeamLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="upcoming">
          <h2 id="upcoming" className="font-display text-xl font-semibold text-foreground">
            Upcoming qualified fixtures
          </h2>
          <FixtureList
            fixtures={upcoming}
            season={season}
            locale={locale}
            empty="No upcoming qualified fixtures in the current research queue for this season."
          />
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="recent">
          <h2 id="recent" className="font-display text-xl font-semibold text-foreground">
            Recently analyzed fixtures
          </h2>
          <FixtureList
            fixtures={recent}
            season={season}
            locale={locale}
            empty="No recently analyzed fixtures in the current sample for this season."
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
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Upcoming rows" value={String(intelligence.upcomingCount)} />
            <Stat label="Completed rows" value={String(intelligence.completedCount)} />
            <Stat
              label="Avg model probability"
              value={
                intelligence.averageModelProbability === null
                  ? "—"
                  : `${intelligence.averageModelProbability}%`
              }
            />
            <Stat label="Home / away rows" value={`${intelligence.homeRows} / ${intelligence.awayRows}`} />
          </dl>
          {!intelligence.hasGoalEnrichment ? (
            <div className="mt-4">
              <EmptyState
                title="Goal and xG enrichment unavailable"
                description="Season-level goals, BTTS rates, and clean-sheet frequencies are only shown when match-detail enrichment exists. This page does not invent those statistics."
                action={
                  <Link href={seasonEvidenceHref(locale)} className="text-sm font-medium text-brand hover:underline">
                    Review methodology
                  </Link>
                }
              />
            </div>
          ) : null}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="markets">
          <h2 id="markets" className="font-display text-xl font-semibold text-foreground">
            Market activity
          </h2>
          {intelligence.marketProfile.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No market activity yet"
                description="Qualified market rows for this season are not present in the current research sample."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {intelligence.marketProfile.map((row) => (
                <li key={row.marketSlug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <SeasonMarketLink
                    href={seasonMarketHref(locale, row.marketSlug)}
                    seasonSlug={season.slug}
                    competitionSlug={season.competitionSlug}
                    marketSlug={row.marketSlug}
                    locale={locale}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {row.marketLabel}
                  </SeasonMarketLink>
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
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="operators">
          <h2 id="operators" className="font-display text-xl font-semibold text-foreground">
            Available operators
          </h2>
          {operators.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No operators available"
                description="No affiliate-enabled operators are currently available for the resolved visitor country."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {operators.slice(0, 8).map(({ operator, availability }) => (
                <li
                  key={operator.slug}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                >
                  <SeasonOperatorLink
                    href={seasonOperatorHref(locale, operator.slug)}
                    seasonSlug={season.slug}
                    competitionSlug={season.competitionSlug}
                    operatorSlug={operator.slug}
                    locale={locale}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    {operator.name}
                  </SeasonOperatorLink>
                  <span className="text-xs text-[var(--green-deep)]">{availability.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <GraphEntityPanel entityType="season" entitySlug={season.id} locale={locale} />

        <EntityDiscoverySection
          entityType="season"
          entitySlug={season.id}
          locale={locale}
          country={visitorCountry}
        />

        <p className="py-6 text-sm text-muted-foreground">
          Canonical season URL:{" "}
          <Link
            href={seasonPath(locale, season.competitionSlug, season.slug)}
            className="text-brand hover:underline"
          >
            {seasonPath(locale, season.competitionSlug, season.slug)}
          </Link>
        </p>
      </div>
    </>
  );
}

function FixtureList({
  fixtures,
  season,
  locale,
  empty,
}: {
  fixtures: QualifiedFixture[];
  season: SeasonEntity;
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
            <SeasonFixtureLink
              href={seasonFixtureHref(locale)}
              seasonSlug={season.slug}
              competitionSlug={season.competitionSlug}
              fixtureId={fixture.matchId}
              locale={locale}
              className="text-sm font-medium text-brand hover:underline"
            >
              {fixture.home} vs {fixture.away}
            </SeasonFixtureLink>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fixture.league} · {fixture.market} · {fixture.kickoff}
            </p>
          </div>
          <p className="font-mono text-sm tabular-nums text-brand">{fixture.modelProbability}%</p>
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
