import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EntityDiscoverySection } from "@/components/discovery/EntityDiscoverySection";
import { EvidenceSection } from "@/components/evidence-ui/EvidenceSection";
import { EntityViewTracker } from "@/components/knowledge-graph/EntityViewTracker";
import { GraphEntityPanel } from "@/components/knowledge-graph/GraphEntityPanel";
import { fromMarketStats } from "@/lib/evidence-ui";
import type { Locale } from "@/lib/i18n";
import { graphRelatedItemListLd } from "@/lib/knowledge-graph/schema";
import { buildEvidenceIndicators } from "@/lib/markets/evidence";
import {
  marketFixtureHref,
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
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { siteUrl } from "@/lib/seo";
import { formatDict } from "@/lib/dictionaryExtras";
import { MarketFixtureLink } from "./MarketInteractive";
import { PricePanel } from "@/components/odds/PricePanel";
import type { PricePanelRow } from "@/lib/operators/pricePanel.server";
import { MarketEvidenceSection } from "./MarketEvidenceSection";
import { MarketOddsSection } from "./MarketOddsSection";
import { MarketPageTracker } from "./MarketPageTracker";

/* ============================================================================
   THE MARKET PAGE — rw3 conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   A reader opening a market page wants to know WHERE this market lives before
   what it is defined as. Top-down:

     LEAD      where the qualified coverage concentrates — one sentence with
               its counts inline, count-based and honest (the data carries
               qualified counts per league, not hit rates — so the page claims
               coverage, never occurrence). Omitted whole when the research
               set is empty.
     SUPPORTS  the coverage signals in ruled rows: qualified count, league
               spread, the top competitions each as `count of total (pct%)`
               where pct is computed from the printed fraction — pairing by
               construction. The provider-potential average renders text-size
               under the provider label, never in the display register.
     FIXTURES  today's qualified fixtures as ruled rows, potential provider-
               labeled.
     DETAIL    definition, indicators, evidence bundle, observed odds — dense,
               for the reader who chose to go deep.
     LAST      one commercial block. The duplicated all-operators list is
               gone — same law as the fixture page.
   ========================================================================== */

export function MarketDetailView({
  market,
  locale,
  stats,
  fixtures,
  odds,
  operators,
  visitorCountry,
  p,
  pricesByFixture,
}: {
  market: MarketDefinition;
  locale: Locale;
  stats: MarketHistoricalStats;
  fixtures: QualifiedFixture[];
  odds: MarketOddsSummary;
  operators: MarketOperatorRow[];
  visitorCountry: string;
  p: PredictionStrings;
  /** Observed publication prices for THIS market, per listed fixture (Phase C). */
  pricesByFixture?: Record<number, PricePanelRow[]>;
}) {
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

  const total = stats.qualifiedFixtureCount;
  const topLeague = total > 0 && stats.topLeagues.length > 0 ? stats.topLeagues[0] : null;
  /* Pairing by construction: the printed pct is computed from the printed fraction. */
  const leadPct = topLeague ? Math.round((topLeague.count / total) * 100) : 0;

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

      <div className="pb-16">
        <nav aria-label="Breadcrumb" className="rw3-meta px-5 pt-3">
          <Link href={`/${locale}`} className="hover:text-[var(--text)]">
            {p.nvHome}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={marketsIndexPath(locale)} className="hover:text-[var(--text)]">
            {p.mktIndexEyebrow}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span style={{ color: "var(--text)" }}>{market.name}</span>
        </nav>

        <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <p className="rw3-label" style={{ margin: 0 }}>
            {market.category}
          </p>
          <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
            {market.name}
          </h1>
          <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
            {market.shortDescription}
          </p>
        </header>

        {/* LEAD — omitted whole on an empty research set (the empty-state law). */}
        {topLeague ? (
          <section aria-labelledby="mkt-lead-heading" className="mt-8 px-5">
            <p className="rw3-label">{p.mktLeadEyebrow}</p>
            <h2 id="mkt-lead-heading" className="mt-2 max-w-[44ch] text-[14px] font-semibold">
              {/* <25% is a largest share, not a concentration — the neutral phrasing renders. */}
              {formatDict(leadPct >= 25 ? p.mktLeadLine : p.mktLeadLineNeutral, {
                league: topLeague.league,
                count: String(topLeague.count),
                total: String(total),
                pct: String(leadPct),
              })}
            </h2>
          </section>
        ) : null}

        {/* SUPPORTS — the coverage signals, windows named, provider figure demoted. */}
        {total > 0 ? (
          <section aria-labelledby="mkt-supports-heading" className="mt-8 px-5">
            <h2 id="mkt-supports-heading" className="rw3-label">
              {p.mktSupportsTitle}
            </h2>
            <p className="rw3-meta mt-1.5 max-w-[52ch]">{p.mktSupportsNote}</p>
            <ul className="mt-4 border-t border-[var(--line)]">
              <li className="border-b border-[var(--line)] py-2.5 text-[13px]">
                {formatDict(p.mktQualifiedLine, { n: String(total) })}
              </li>
              {stats.leagueCoverage > 0 ? (
                <li className="border-b border-[var(--line)] py-2.5 text-[13px]">
                  {formatDict(p.mktLeagueCoverageLine, { n: String(stats.leagueCoverage) })}
                </li>
              ) : null}
              {stats.topLeagues.slice(0, 5).map((row) => (
                <li key={row.league} className="border-b border-[var(--line)] py-2.5 text-[13px]">
                  {formatDict(p.mktTopLeagueRow, {
                    league: row.league,
                    count: String(row.count),
                    total: String(total),
                    pct: String(Math.round((row.count / total) * 100)),
                  })}
                </li>
              ))}
            </ul>
            {stats.averageModelProbability !== null ? (
              <p className="rw3-meta mt-3">
                {formatDict(p.mktProviderAvgLine, {
                  pct: String(Math.round(stats.averageModelProbability)),
                })}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* FIXTURES — today's qualified set as ruled rows; potential provider-labeled. */}
        <section
          aria-labelledby="mkt-fixtures-heading"
          className="mt-10 border-t border-[var(--line)] px-5 pt-6"
        >
          <h2 id="mkt-fixtures-heading" className="rw3-label">
            {p.mktFixturesTitle}
          </h2>
          {fixtures.length ? (
            <ul className="mt-3 border-t border-[var(--line)]">
              {fixtures.map((fixture) => (
                <li key={fixture.id}>
                  <div className="rw3-hoverable grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-[var(--line)] py-3">
                    <div className="min-w-0">
                      <MarketFixtureLink
                        href={marketFixtureHref(locale)}
                        marketSlug={market.slug}
                        fixtureId={fixture.matchId}
                        locale={locale}
                      >
                        <span className="text-[14px] font-semibold">
                          {fixture.home} v {fixture.away}
                        </span>
                      </MarketFixtureLink>
                      <p className="rw3-meta mt-1">
                        {fixture.league} · {fixture.kickoff}
                      </p>
                      {pricesByFixture?.[fixture.matchId]?.length ? (
                        <PricePanel
                          rows={pricesByFixture[fixture.matchId]}
                          locale={locale}
                          p={p}
                        />
                      ) : null}
                    </div>
                    <p className="shrink-0 text-right">
                      <span className="rw3-pct">{fixture.modelProbability}%</span>
                      <span className="block" style={{ fontSize: 11, color: "var(--muted)" }}>
                        {p.rankedPotentialLabel}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p
              className="mt-3 max-w-[52ch] border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {p.mktFixturesEmpty}
            </p>
          )}
        </section>

        {/* DETAIL — definition, indicators, evidence bundle, observed odds. Dense on purpose. */}
        <section
          aria-labelledby="mkt-detail-heading"
          className="mt-10 border-t border-[var(--line)] px-5 pt-6"
        >
          <h2 id="mkt-detail-heading" className="rw3-label">
            {p.mktDetailTitle}
          </h2>
          <div
            className="mt-4 max-w-[62ch] space-y-4 text-[13px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            <p>{market.longDescription}</p>
          </div>
          {market.howItWorks.length ? (
            <ol className="mt-5 max-w-[62ch] border-t border-[var(--line)]">
              {market.howItWorks.map((step, index) => (
                <li
                  key={step}
                  className="flex gap-4 border-b border-[var(--line)] py-2.5 text-[13px] leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="rw3-label shrink-0 pt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          ) : null}
          {market.seo.faqs.length ? (
            <div className="mt-6 max-w-[62ch]">
              <h3 className="rw3-label">{p.mktFaqTitle}</h3>
              <dl className="mt-2.5 border-t border-[var(--line)]">
                {market.seo.faqs.map((faq) => (
                  <div key={faq.question} className="border-b border-[var(--line)] py-3">
                    <dt className="text-[14px] font-semibold">{faq.question}</dt>
                    <dd
                      className="mt-1.5 text-[13px] leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="mt-8">
            <MarketEvidenceSection
              marketSlug={market.slug}
              locale={locale}
              indicators={indicators}
              p={p}
            />
          </div>

          {/* Shared research panels, demoted to detail depth. Their interiors belong to the
              shared-primitive conversion pass and are deliberately untouched here. */}
          <div className="mt-8">
            <EvidenceSection bundle={evidenceBundle} locale={locale} country={visitorCountry} />
          </div>

          <div className="mt-8">
            <MarketOddsSection marketSlug={market.slug} locale={locale} odds={odds} p={p} />
          </div>

          {relatedMarkets.length ? (
            <div className="mt-8">
              <h3 className="rw3-label">{p.mktRelatedTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {relatedMarkets.map((related) => (
                  <li key={related.slug}>
                    <Link href={marketPath(locale, related.slug)} className="rw3-ghost">
                      {related.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-8">
            <GraphEntityPanel entityType="market" entitySlug={market.slug} locale={locale} />
          </div>
          <div className="mt-8">
            <EntityDiscoverySection entityType="market" entitySlug={market.slug} locale={locale} />
          </div>
        </section>

        {/* LAST — one commercial block, after every content level. */}
        <section
          aria-labelledby="operator-recommendations"
          className="mt-10 border-t border-[var(--line)] px-5 pt-6"
        >
          <p className="rw3-meta">{p.fxOperatorsNote}</p>
          <div className="mt-4">
            <OperatorEvidenceCardList
              cards={recommendableCards(
                buildOperatorEvidenceCards(
                  operators.map(({ operator, availability }) => ({
                    operator,
                    availability,
                    marketKey: market.operatorMarketKey ?? null,
                  })),
                  { nowIso, limit: 3 }
                )
              )}
              locale={locale}
              country={visitorCountry}
              surface="market"
              headingId="operator-recommendations"
              heading="Recommended operators"
              market={market.slug}
            />
          </div>
        </section>
      </div>
    </>
  );
}
