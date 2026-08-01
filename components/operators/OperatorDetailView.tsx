import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import type { Locale } from "@/lib/i18n";
import { countryName } from "@/lib/geoNames";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import {
  marketLabel,
  operatorAffiliateHref,
  operatorEvidenceHref,
  operatorFixtureHref,
  operatorLeagueHref,
  operatorMarketHref,
  operatorOddsIntelligenceHref,
  operatorPath,
  operatorsIndexPath,
  relatedLeagueSuggestions,
} from "@/lib/operators/links";
import {
  operatorBreadcrumbLd,
  operatorWebPageLd,
} from "@/lib/operators/schema";
import type {
  Operator,
  OperatorCountryAvailability,
  OperatorOddsPerformance,
} from "@/lib/operators/types";
import { OPERATOR_MARKET_META } from "@/lib/operators/types";
import { siteUrl } from "@/lib/seo";
import {
  OperatorAffiliateCta,
  OperatorRelatedLink,
} from "./OperatorInteractiveLinks";
import { OperatorOddsPanelBeacon } from "./OperatorOddsPanelBeacon";
import { OperatorPageTracker } from "./OperatorPageTracker";

export function OperatorDetailView({
  operator,
  locale,
  availability,
  performance,
  relatedOperators,
}: {
  operator: Operator;
  locale: Locale;
  availability: OperatorCountryAvailability;
  performance: OperatorOddsPerformance;
  relatedOperators: Operator[];
}) {
  const description = `${operator.name} operator intelligence: supported markets, country availability, and observed odds performance on RankWagers.`;
  const affiliateHref = operatorAffiliateHref(
    operator,
    locale,
    availability.visitorCountry
  );
  const leagues = relatedLeagueSuggestions(operator);
  const relatedItemList = graphRelatedItemListLd({
    type: "operator",
    slug: operator.slug,
    locale,
    siteUrl: siteUrl(),
  });

  return (
    <>
      <OperatorPageTracker operatorSlug={operator.slug} locale={locale} />
      <EntityViewTracker
        entityType="operator"
        entitySlug={operator.slug}
        locale={locale}
        title={operator.name}
        href={`/${locale}/operators/${operator.slug}`}
      />
      <JsonLd data={operatorWebPageLd({ operator, locale, description })} />
      <JsonLd data={operatorBreadcrumbLd({ operator, locale })} />
      {relatedItemList && <JsonLd data={relatedItemList} />}

      <div className="container-wide pb-16 pt-5">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href={`/${locale}`} className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <Link href={operatorsIndexPath(locale)} className="hover:text-foreground">
            Operators
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{operator.name}</span>
        </nav>

        <section className="border-b border-[var(--border-subtle)] pb-8 pt-6">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Operator intelligence
          </p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {operator.logo ? (
                <Image
                  src={operator.logo}
                  alt={`${operator.name} logo`}
                  width={64}
                  height={64}
                  sizes="64px"
                  className="h-16 w-16 rounded-md object-contain"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-md bg-foreground/10 text-lg font-semibold">
                  {operator.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
                  {operator.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)]">
                  {operator.description}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Status: {operator.verificationStatus}
                  {operator.foundedYear ? ` · Founded ${operator.foundedYear}` : ""}
                  {operator.headquarters ? ` · ${operator.headquarters}` : ""}
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <p
                className={`text-sm font-medium ${
                  availability.available ? "text-[var(--green-deep)]" : "text-[var(--amber-primary)]"
                }`}
              >
                {availability.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Visitor country: {availability.visitorCountry}
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="overview">
          <h2 id="overview" className="font-display text-xl font-semibold text-foreground">
            Overview
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)]">
            This page summarises factual operator coverage used across RankWagers research
            views: markets, regional availability, and observed odds history. Affiliate
            actions are optional next steps after evidence review.
          </p>
          {operator.highlights.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {operator.highlights.slice(0, 6).map((item) => (
                <li
                  key={item}
                  className="rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2 text-sm text-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="markets">
          <h2 id="markets" className="font-display text-xl font-semibold text-foreground">
            Supported markets
          </h2>
          <ul className="mt-4 flex flex-wrap gap-3">
            {operator.supportedMarkets.map((market) => (
              <li key={market}>
                <OperatorRelatedLink
                  href={operatorMarketHref(locale, market)}
                  operatorSlug={operator.slug}
                  locale={locale}
                  kind="market"
                  target={market}
                >
                  {marketLabel(market)}
                </OperatorRelatedLink>
                <span className="ml-1 text-xs text-muted-foreground">
                  ({OPERATOR_MARKET_META[market].line})
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="countries">
          <h2 id="countries" className="font-display text-xl font-semibold text-foreground">
            Available countries
          </h2>
          {operator.supportedCountries.length ? (
            <ul className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--ink-secondary)]">
              {operator.supportedCountries.map((code) => (
                <li
                  key={code}
                  className={`rounded border px-2.5 py-1 ${
                    code === availability.visitorCountry
                      ? "border-brand/40 bg-[var(--green-surface)] text-foreground"
                      : "border-border"
                  }`}
                >
                  {countryName(code)} ({code})
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No country restriction is configured for this operator in RankWagers.
            </p>
          )}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="best-odds">
          <OperatorOddsPanelBeacon
            operatorSlug={operator.slug}
            locale={locale}
            panel="best_odds"
          />
          <h2 id="best-odds" className="font-display text-xl font-semibold text-foreground">
            Current best odds
          </h2>
          {performance.sampleSize ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Highest observed" value={fmt(performance.highestOdds)} />
              <Stat label="Lowest observed" value={fmt(performance.lowestOdds)} />
              <Stat label="Average observed" value={fmt(performance.averageOdds)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No observed odds history for this operator yet.
            </p>
          )}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="fixtures">
          <h2 id="fixtures" className="font-display text-xl font-semibold text-foreground">
            Recent fixtures
          </h2>
          {performance.recentFixtureIds.length ? (
            <ul className="mt-4 space-y-2">
              {performance.recentFixtureIds.map((fixtureId) => (
                <li key={fixtureId}>
                  <OperatorRelatedLink
                    href={operatorFixtureHref(locale, fixtureId)}
                    operatorSlug={operator.slug}
                    locale={locale}
                    kind="fixture"
                    target={String(fixtureId)}
                  >
                    Fixture #{fixtureId}
                  </OperatorRelatedLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Recent fixture links appear after odds history observations are stored.{" "}
              <Link href={`/${locale}#fixtures`} className="text-brand hover:underline">
                Browse qualified fixtures
              </Link>
            </p>
          )}
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="performance">
          <OperatorOddsPanelBeacon
            operatorSlug={operator.slug}
            locale={locale}
            panel="performance"
          />
          <h2 id="performance" className="font-display text-xl font-semibold text-foreground">
            Odds performance
          </h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Samples" value={String(performance.sampleSize)} />
            <Stat label="Market coverage" value={String(performance.marketCoverage)} />
            <Stat label="Movements" value={String(performance.movementCount)} />
            <Stat label="Steam moves" value={String(performance.steamCount)} />
            <Stat
              label="CLV average"
              value={
                performance.clvAveragePercent === null
                  ? "—"
                  : `${performance.clvAveragePercent > 0 ? "+" : ""}${performance.clvAveragePercent.toFixed(1)}%`
              }
            />
            <Stat
              label="Markets observed"
              value={performance.marketsObserved.length ? performance.marketsObserved.join(", ") : "—"}
            />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Metrics use stored odds history only. Empty values mean no observations yet.
          </p>
        </section>

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="affiliate-cta">
          <h2 id="affiliate-cta" className="font-display text-xl font-semibold text-foreground">
            Continue research with this operator
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--ink-secondary)]">
            If the evidence above is useful, you can open the sportsbook. RankWagers does not
            operate gambling services.
          </p>
          <div className="mt-4">
            <OperatorAffiliateCta
              href={affiliateHref}
              operatorSlug={operator.slug}
              locale={locale}
              enabled={operator.affiliateEnabled}
            />
          </div>
        </section>

        <GraphEntityPanel entityType="operator" entitySlug={operator.slug} locale={locale} />

        <EntityDiscoverySection
          entityType="operator"
          entitySlug={operator.slug}
          locale={locale}
          country={
            availability.visitorCountry && availability.visitorCountry !== "—"
              ? availability.visitorCountry
              : null
          }
        />

        <section className="border-b border-[var(--border-subtle)] py-8" aria-labelledby="related">
          <h2 id="related" className="font-display text-xl font-semibold text-foreground">
            Related research
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Related operators
              </h3>
              <ul className="mt-2 space-y-1.5">
                {relatedOperators.map((related) => (
                  <li key={related.slug}>
                    <OperatorRelatedLink
                      href={operatorPath(locale, related.slug)}
                      operatorSlug={operator.slug}
                      locale={locale}
                      kind="operator"
                      target={related.slug}
                    >
                      {related.name}
                    </OperatorRelatedLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Related markets
              </h3>
              <ul className="mt-2 space-y-1.5">
                {operator.supportedMarkets.map((market) => (
                  <li key={market}>
                    <OperatorRelatedLink
                      href={operatorMarketHref(locale, market)}
                      operatorSlug={operator.slug}
                      locale={locale}
                      kind="market"
                      target={market}
                    >
                      {marketLabel(market)}
                    </OperatorRelatedLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-metadata font-semibold uppercase tracking-label text-muted-foreground">
                Related leagues
              </h3>
              <ul className="mt-2 space-y-1.5">
                {leagues.map((league) => (
                  <li key={league}>
                    <OperatorRelatedLink
                      href={operatorLeagueHref(locale, league)}
                      operatorSlug={operator.slug}
                      locale={locale}
                      kind="league"
                      target={league}
                    >
                      {league}
                    </OperatorRelatedLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link href={operatorEvidenceHref(locale)} className="text-brand hover:underline">
              Methodology & evidence
            </Link>
            <Link href={operatorOddsIntelligenceHref(locale)} className="text-brand hover:underline">
              Odds intelligence on fixtures
            </Link>
            <Link href={`/${locale}/reviews/${operator.slug}`} className="text-muted-foreground hover:underline">
              Legacy review page
            </Link>
          </div>
        </section>
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

function fmt(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}
