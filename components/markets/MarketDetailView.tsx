import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EvidenceSummaryChip } from "@/components/evidence-ui/EvidenceSummaryChip";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { GraphNavLink } from "@/components/knowledge-graph/GraphNavLink";
import { fromMarketStats } from "@/lib/evidence-ui";
import type { Locale } from "@/lib/i18n";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import { buildEvidenceIndicators } from "@/lib/markets/evidence";
import {
  marketEvidenceHref,
  marketFixtureHref,
  marketLeagueHref,
  marketOddsHref,
  marketOperatorHref,
  marketPath,
  marketsIndexPath,
} from "@/lib/markets/links";
import type { MarketOperatorRow } from "@/lib/markets/operators";
import { OperatorEvidenceCardList } from "@/components/operators/OperatorEvidenceCard";
import { buildOperatorEvidenceCards, recommendableCards } from "@/lib/operators/evidenceCard";
import { getRelatedMarkets } from "@/lib/markets/registry";
import {
  marketBreadcrumbLd,
  marketFaqLd,
  marketWebPageLd,
} from "@/lib/markets/schema";
import type {
  MarketDefinition,
  MarketHistoricalStats,
  MarketOddsSummary,
} from "@/lib/markets/types";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { siteUrl } from "@/lib/seo";
import {
  MarketCtaLink,
  MarketFixtureLink,
  MarketOperatorLink,
} from "./MarketInteractive";
import { MarketEvidenceSection } from "./MarketEvidenceSection";
import { MarketOddsSection } from "./MarketOddsSection";
import { MarketPageTracker } from "./MarketPageTracker";

export function MarketDetailView({
  market,
  locale,
  stats,
  fixtures,
  odds,
  operators,
  visitorCountry,
}: {
  market: MarketDefinition;
  locale: Locale;
  stats: MarketHistoricalStats;
  fixtures: QualifiedFixture[];
  odds: MarketOddsSummary;
  operators: MarketOperatorRow[];
  visitorCountry: string;
}) {
  // Server component supplies the clock so `buildOperatorEvidenceCards` stays pure and testable.
  const nowIso = new Date().toISOString();
  const relatedMarkets = getRelatedMarkets(market.slug);
  const indicators = buildEvidenceIndicators(market);
  const faqLd = marketFaqLd(market);
  const relatedItemList = graphRelatedItemListLd({
    type: "market",
    slug: market.slug,
    locale,
    siteUrl: siteUrl(),
  });
  const evidenceBundle = fromMarketStats(stats, `market:${market.slug}`);

  return (
    <>
      <MarketPageTracker marketSlug={market.slug} locale={locale} />
      <EntityViewTracker
        entityType="market"
        entitySlug={market.slug}
        locale={locale}
        title={market.name}
        href={`/${locale}/markets/${market.slug}`}
      />
      <JsonLd data={marketWebPageLd({ market, locale })} />
      <JsonLd data={marketBreadcrumbLd({ market, locale })} />
      {faqLd && <JsonLd data={faqLd} />}
      {relatedItemList && <JsonLd data={relatedItemList} />}

      <div className="container-wide pb-16 pt-5">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={marketsIndexPath(locale)} className="hover:text-foreground">
            Markets
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{market.name}</span>
        </nav>

        <section className="border-b border-[var(--border-subtle)] pb-8 pt-6">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Market intelligence · {market.category}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            {market.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            {market.shortDescription}
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="overview">
          <h2 id="overview" className="font-display text-xl font-semibold text-foreground">
            Market overview
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)]">
            {market.longDescription}
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="how">
          <h2 id="how" className="font-display text-xl font-semibold text-foreground">
            How it works
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--ink-secondary)]">
            {market.howItWorks.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="stats">
          <h2 id="stats" className="font-display text-xl font-semibold text-foreground">
            Historical statistics
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Qualified fixtures" value={String(stats.qualifiedFixtureCount)} />
            <Stat
              label="Avg model probability"
              value={
                stats.averageModelProbability === null
                  ? "—"
                  : `${Math.round(stats.averageModelProbability)}%`
              }
            />
            <Stat
              label="Highest model probability"
              value={
                stats.highestModelProbability === null
                  ? "—"
                  : `${stats.highestModelProbability}%`
              }
            />
            <Stat label="Leagues covered" value={String(stats.leagueCoverage)} />
          </dl>
          {stats.topLeagues.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--ink-secondary)]">
              {stats.topLeagues.map((row) => (
                <li key={row.league} className="rounded border border-border px-2.5 py-1">
                  {row.league} ({row.count})
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <EvidenceSummaryChip
              strength={evidenceBundle.summaryStrength}
              sampleSize={stats.qualifiedFixtureCount}
            />
            <p className="text-xs text-muted-foreground">{stats.sampleNote}</p>
          </div>
        </section>

        <EvidenceSection
          bundle={evidenceBundle}
          locale={locale}
          country={visitorCountry}
        />

        <MarketEvidenceSection
          marketSlug={market.slug}
          locale={locale}
          indicators={indicators}
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="fixtures">
          <h2 id="fixtures" className="font-display text-xl font-semibold text-foreground">
            Upcoming qualified fixtures
          </h2>
          {fixtures.length ? (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
              {fixtures.map((fixture) => (
                <li key={fixture.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <MarketFixtureLink
                      href={marketFixtureHref(locale)}
                      marketSlug={market.slug}
                      fixtureId={fixture.matchId}
                      locale={locale}
                    >
                      {fixture.home} vs {fixture.away}
                    </MarketFixtureLink>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {fixture.league} · {fixture.kickoff}
                    </p>
                  </div>
                  <p className="font-mono text-sm tabular-nums text-brand">
                    {fixture.modelProbability}%
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No qualified fixtures for this market in the current research set.
            </p>
          )}
        </section>

        <MarketOddsSection marketSlug={market.slug} locale={locale} odds={odds} />

        <OperatorEvidenceCardList
          cards={recommendableCards(
            buildOperatorEvidenceCards(
              operators.map(({ operator, availability }) => ({
                operator,
                availability,
                marketKey: market.operatorMarketKey ?? null,
              })),
              { nowIso: nowIso, limit: 3 },
            ),
          )}
          locale={locale}
          country={visitorCountry}
          surface="market"
          headingId="operator-recommendations"
          heading="Recommended operators"
          market={market.slug}
        />
        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="operators">
          <h2 id="operators" className="font-display text-xl font-semibold text-foreground">
            All supported operators
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Country personalization for visitor {visitorCountry}. Availability uses Sprint 2 rules.
          </p>
          <ul className="mt-4 space-y-2">
            {operators.slice(0, 8).map(({ operator, availability }) => (
              <li
                key={operator.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
              >
                <MarketOperatorLink
                  href={marketOperatorHref(locale, operator.slug)}
                  marketSlug={market.slug}
                  operatorSlug={operator.slug}
                  locale={locale}
                >
                  {operator.name}
                </MarketOperatorLink>
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

        <GraphEntityPanel entityType="market" entitySlug={market.slug} locale={locale} />

        <EntityDiscoverySection
          entityType="market"
          entitySlug={market.slug}
          locale={locale}
          country={visitorCountry}
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="related">
          <h2 id="related" className="font-display text-xl font-semibold text-foreground">
            Related research
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Related markets
              </h3>
              <ul className="mt-2 space-y-1.5">
                {relatedMarkets.map((related) => (
                  <li key={related.slug}>
                    <GraphNavLink
                      href={marketPath(locale, related.slug)}
                      fromType="market"
                      fromSlug={market.slug}
                      toType="market"
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
                Related leagues
              </h3>
              <ul className="mt-2 space-y-1.5">
                {market.relatedLeagues.map((league) => (
                  <li key={league}>
                    <Link
                      href={marketLeagueHref(locale, league)}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      {league}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Knowledge links
              </h3>
              <ul className="mt-2 space-y-1.5">
                <li>
                  <MarketCtaLink
                    href={marketEvidenceHref(locale)}
                    marketSlug={market.slug}
                    locale={locale}
                    target="evidence"
                  >
                    Methodology & evidence
                  </MarketCtaLink>
                </li>
                {market.listKind ? (
                  <li>
                    <Link
                      href={`/${locale}/combo`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Evidence Combo Studio
                    </Link>
                  </li>
                ) : null}
                <li>
                  <MarketCtaLink
                    href={marketOddsHref(locale)}
                    marketSlug={market.slug}
                    locale={locale}
                    target="odds_intelligence"
                  >
                    Odds intelligence on fixtures
                  </MarketCtaLink>
                </li>
                <li>
                  <MarketCtaLink
                    href={`/${locale}/operators`}
                    marketSlug={market.slug}
                    locale={locale}
                    target="operators_index"
                  >
                    Operator intelligence
                  </MarketCtaLink>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {market.seo.faqs.length > 0 && (
          <section className="py-8" aria-labelledby="faq">
            <h2 id="faq" className="font-display text-xl font-semibold text-foreground">
              FAQ
            </h2>
            <dl className="mt-4 space-y-4">
              {market.seo.faqs.map((faq) => (
                <div key={faq.question}>
                  <dt className="text-sm font-semibold text-foreground">{faq.question}</dt>
                  <dd className="mt-1 text-sm text-[var(--ink-secondary)]">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </>
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
