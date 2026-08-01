import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { GraphNavLink } from "@/components/knowledge-graph/GraphNavLink";
import { fromCompetitionStats } from "@/lib/evidence-ui";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CompetitionOperatorRow } from "@/lib/competitions/operators";
import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import {
  competitionEvidenceHref,
  competitionFixtureHref,
  competitionMarketHref,
  competitionOperatorHref,
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
import { countryPath } from "@/lib/countries/links";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import { getMarket } from "@/lib/markets/registry";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
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
  CompetitionOperatorLink,
  CompetitionPageTracker,
} from "./CompetitionInteractive";

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

      <div className="container-wide pb-16 pt-5">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">Home</Link>
          <span className="mx-1.5">/</span>
          <Link href={competitionsIndexPath(locale)} className="hover:text-foreground">Competitions</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{competition.name}</span>
        </nav>

        <section className="border-b border-[var(--border-subtle)] pb-8 pt-6">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Competition intelligence · {competition.confederation}
            {competition.country ? (
              <>
                {" · "}
                <Link
                  href={countryPath(locale, competition.country)}
                  className="hover:underline"
                >
                  {countryName(competition.country)}
                </Link>
              </>
            ) : null}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            {competition.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            {competition.description}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Visitor country {visitorCountry}
            {activeSeason ? ` · Current season ${activeSeason.yearLabel}` : ""}
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="overview">
          <h2 id="overview" className="font-display text-xl font-semibold text-foreground">
            Competition overview
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)]">
            This page aggregates RankWagers research entities for {competition.name}: qualified
            fixtures, related markets, operators, and observed odds. It does not generate tips
            or editorial rankings.
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="season">
          <h2 id="season" className="font-display text-xl font-semibold text-foreground">
            Current season research snapshot
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Qualified market rows" value={String(stats.qualifiedFixtureCount)} />
            <Stat label="Unique fixtures" value={String(stats.uniqueMatchCount)} />
            <Stat
              label="Avg model probability"
              value={
                stats.averageModelProbability === null
                  ? "—"
                  : `${Math.round(stats.averageModelProbability)}%`
              }
            />
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-metadata uppercase tracking-label text-muted-foreground">Evidence strength</p>
              <div className="mt-2">
                <EvidenceSummaryChip
                  strength={evidenceBundle.summaryStrength}
                  sampleSize={stats.uniqueMatchCount}
                />
              </div>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">{stats.sampleNote}</p>
          {activeSeason ? (
            <p className="mt-4 text-sm">
              <Link
                href={seasonPath(locale, competition.slug, activeSeason.slug)}
                className="font-medium text-brand hover:underline"
              >
                Open {activeSeason.displayName} season intelligence →
              </Link>
            </p>
          ) : null}
          {availableSeasons.length > 1 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {availableSeasons.map((season) => (
                <li key={season.id}>
                  <Link
                    href={seasonPath(locale, competition.slug, season.slug)}
                    className="inline-flex rounded-md border border-border px-2.5 py-1 text-xs font-medium text-brand hover:bg-[var(--canvas-secondary)]"
                  >
                    {season.yearLabel}
                    {season.active ? " · current" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="upcoming">
          <h2 id="upcoming" className="font-display text-xl font-semibold text-foreground">
            Upcoming qualified fixtures
          </h2>
          <FixtureList
            fixtures={upcoming}
            competitionSlug={competition.slug}
            locale={locale}
            empty="No upcoming qualified fixtures matched this competition today."
          />
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="recent">
          <h2 id="recent" className="font-display text-xl font-semibold text-foreground">
            Recently analyzed fixtures
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Highest-signal qualified rows from the current research set (not invented results).
          </p>
          <FixtureList
            fixtures={recent}
            competitionSlug={competition.slug}
            locale={locale}
            empty="No analyzed fixtures matched this competition in the current set."
          />
        </section>

        <EvidenceSection
          bundle={evidenceBundle}
          locale={locale}
          country={visitorCountry}
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="evidence">
          <h2 id="evidence" className="font-display text-xl font-semibold text-foreground">
            Market activity in sample
          </h2>
          {stats.marketBreakdown.length ? (
            <ul className="mt-4 space-y-2">
              {stats.marketBreakdown.map((row) => (
                <li
                  key={row.market}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{row.market}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {row.count} rows · avg {Math.round(row.averageProbability)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Evidence breakdown appears when qualified fixtures match this competition.
            </p>
          )}
          <p className="mt-3 text-sm">
            <Link href={competitionEvidenceHref(locale)} className="text-brand hover:underline">
              Methodology & evidence
            </Link>
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="markets">
          <h2 id="markets" className="font-display text-xl font-semibold text-foreground">
            Popular markets
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
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
        </section>

        <OperatorEvidenceCardList
          cards={recommendableCards(
            buildOperatorEvidenceCards(
              operators.map(({ operator, availability }) => ({
                operator,
                availability,
                marketKey: null,
              })),
              { nowIso: new Date().toISOString(), limit: 3 },
            ),
          )}
          locale={locale}
          country={visitorCountry}
          surface="competition"
          headingId="operator-recommendations"
          heading="Recommended operators"
        />
        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="operators">
          <h2 id="operators" className="font-display text-xl font-semibold text-foreground">
            All supported operators
          </h2>
          <ul className="mt-4 space-y-2">
            {operators.slice(0, 8).map(({ operator, availability }) => (
              <li
                key={operator.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <CompetitionOperatorLink
                  href={competitionOperatorHref(locale, operator.slug)}
                  competitionSlug={competition.slug}
                  operatorSlug={operator.slug}
                  locale={locale}
                >
                  {operator.name}
                </CompetitionOperatorLink>
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
        </section>

        <CompetitionOddsSection
          competitionSlug={competition.slug}
          locale={locale}
          sampleSize={odds.sampleSize}
          bestOdds={odds.bestOdds}
          averageOdds={odds.averageOdds}
          movementCount={odds.movementCount}
        />

        <GraphEntityPanel
          entityType="competition"
          entitySlug={competition.slug}
          locale={locale}
        />

        <EntityDiscoverySection
          entityType="competition"
          entitySlug={competition.slug}
          locale={locale}
          country={visitorCountry}
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="related">
          <h2 id="related" className="font-display text-xl font-semibold text-foreground">
            Related competitions & teams
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Related competitions
              </h3>
              <ul className="mt-2 space-y-1.5">
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
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {related.name}
                    </GraphNavLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Related teams
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--ink-secondary)]">
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
                          className="rounded border border-border px-2.5 py-1 text-brand hover:bg-[var(--canvas-secondary)]"
                        >
                          {resolved.team.name}
                        </GraphNavLink>
                      </li>
                    );
                  }
                  return (
                    <li key={teamName} className="rounded border border-border px-2.5 py-1">
                      {teamName}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-metadata text-muted-foreground">
                Linked when a canonical team entity exists; otherwise shown as research labels.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function FixtureList({
  fixtures,
  competitionSlug,
  locale,
  empty,
}: {
  fixtures: QualifiedFixture[];
  competitionSlug: string;
  locale: Locale;
  empty: string;
}) {
  if (!fixtures.length) {
    return (
      <div className="mt-3">
        <EmptyState
          title="No fixtures in this sample"
          description={empty}
        />
      </div>
    );
  }
  return (
    <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
      {fixtures.map((fixture) => (
        <li key={fixture.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div>
            <CompetitionFixtureLink
              href={competitionFixtureHref(locale)}
              competitionSlug={competitionSlug}
              fixtureId={fixture.matchId}
              locale={locale}
            >
              {fixture.home} vs {fixture.away}
            </CompetitionFixtureLink>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fixture.market} · {fixture.kickoff}
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
                  "competition"
                ),
                source: "competition",
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
