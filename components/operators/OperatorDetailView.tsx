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
  operatorMarketHref,
  operatorPath,
  operatorsIndexPath,
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
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { formatDict } from "@/lib/dictionaryExtras";
import {
  OperatorAffiliateCta,
  OperatorRelatedLink,
} from "./OperatorInteractiveLinks";
import { OperatorOddsPanelBeacon } from "./OperatorOddsPanelBeacon";
import { OperatorPageTracker } from "./OperatorPageTracker";

/* ============================================================================
   THE OPERATOR PAGE — commercial conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   LEAD      availability + verification — the two preconditions, stated as
             one sentence each before anything else.
   EVIDENCE  observed odds history (stored observations only, empty means not
             observed), markets with their observation counts, recent
             observed fixtures.
   TERMS     the operator's own claims — highlights, licenses, founded, HQ —
             demoted and explicitly claimed-not-verified.
   DETAIL    related research (graph, discovery, related operators).
   CONTINUE  ONE commercial action, last, visibly commercial (the separation
             note + server-signed redirect). Never a surprise, never hero.
   ========================================================================== */

export function OperatorDetailView({
  operator,
  locale,
  availability,
  performance,
  relatedOperators,
  p,
}: {
  operator: Operator;
  locale: Locale;
  availability: OperatorCountryAvailability;
  performance: OperatorOddsPerformance;
  relatedOperators: Operator[];
  p: PredictionStrings;
}) {
  const description = `${operator.name} operator intelligence: supported markets, country availability, and observed odds performance on RankWagers.`;
  const affiliateHref = operatorAffiliateHref(
    operator,
    locale,
    availability.visitorCountry
  );
  const relatedItemList = graphRelatedItemListLd({
    type: "operator",
    slug: operator.slug,
    locale,
    siteUrl: siteUrl(),
  });
  const verificationWord =
    operator.verificationStatus === "verified" ? p.opVerified : p.opUnverified;

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

      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
          <Link href={`/${locale}`} className="hover:text-[var(--hero-ink)]">
            {p.nvHome}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={operatorsIndexPath(locale)} className="hover:text-[var(--hero-ink)]">
            {p.opIndexTitle}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span className="text-[var(--hero-ink)]">{operator.name}</span>
        </nav>

        <header className="mt-6 border-b border-[var(--hero-line)] pb-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.opIndexEyebrow}</p>
          <div className="mt-1.5 flex items-start gap-4">
            {operator.logo ? (
              <Image
                src={operator.logo}
                alt={`${operator.name} logo`}
                width={56}
                height={56}
                sizes="56px"
                className="mt-1.5 h-14 w-14 border border-[var(--hero-line)] object-contain"
              />
            ) : null}
            <div>
              <h1 className="rw-h text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
                {operator.name}
              </h1>
              <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
                {operator.description}
              </p>
            </div>
          </div>
        </header>

        {/* LEAD — the two preconditions: availability, then verification. */}
        <section aria-labelledby="op-lead-heading" className="mt-14">
          <p className="rw-m text-[var(--hero-ink-2)]">{p.mktLeadEyebrow}</p>
          <h2
            id="op-lead-heading"
            className="rw-h mt-2.5 max-w-[30ch] text-[clamp(1.5rem,3.2vw,2.1rem)] text-[var(--hero-ink)]"
          >
            {formatDict(
              availability.available ? p.opLeadAvailable : p.opLeadUnavailable,
              { operator: operator.name, country: availability.visitorCountry }
            )}
          </h2>
          <ul className="mt-6 border-t-[1.5px] border-[var(--hero-ink)]">
            <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
              {formatDict(p.opVerificationRow, { status: verificationWord })}
            </li>
            <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
              {formatDict(p.opSupportsMarketsLine, {
                n: String(operator.supportedMarkets.length),
              })}
            </li>
            {operator.supportedCountries.length > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.opSupportsCountriesLine, {
                  n: String(operator.supportedCountries.length),
                })}
              </li>
            ) : null}
          </ul>
        </section>

        {/* EVIDENCE — stored observations only; empty means not observed. */}
        <section
          aria-labelledby="op-evidence-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <OperatorOddsPanelBeacon
            operatorSlug={operator.slug}
            locale={locale}
            panel="best_odds"
          />
          <h2 id="op-evidence-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.mktOddsTitle}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {p.opEvidenceNote}
          </p>
          {performance.sampleSize > 0 ? (
            <>
              <dl className="mt-5 border-t border-[var(--hero-line)]">
                {performance.highestOdds !== null ? (
                  <Row label={p.mktOddsBest} value={performance.highestOdds.toFixed(2)} />
                ) : null}
                {performance.lowestOdds !== null ? (
                  <Row label={p.mktOddsLowest} value={performance.lowestOdds.toFixed(2)} />
                ) : null}
                {performance.averageOdds !== null ? (
                  <Row label={p.mktOddsAverage} value={performance.averageOdds.toFixed(2)} />
                ) : null}
                {performance.movementCount > 0 ? (
                  <Row label={p.mktOddsMovements} value={String(performance.movementCount)} />
                ) : null}
                {performance.clvAveragePercent !== null ? (
                  <Row
                    label={p.mktOddsClv}
                    value={`${performance.clvAveragePercent > 0 ? "+" : ""}${performance.clvAveragePercent.toFixed(1)}%`}
                  />
                ) : null}
              </dl>
              <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
                {formatDict(p.opSamplesLine, { n: String(performance.sampleSize) })}
                {" · "}
                {p.mktOddsWindowNote}
              </p>
            </>
          ) : (
            <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
              {p.mktOddsEmpty}
            </p>
          )}

          <div className="mt-8">
            <h3 className="rw-label text-[var(--hero-ink-2)]">{p.opMarketsTitle}</h3>
            <ul className="mt-2.5 border-t border-[var(--hero-line)]">
              {operator.supportedMarkets.map((market) => (
                <li
                  key={market}
                  className="rw-row flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5"
                >
                  <OperatorRelatedLink
                    href={operatorMarketHref(locale, market)}
                    operatorSlug={operator.slug}
                    locale={locale}
                    kind="market"
                    target={market}
                  >
                    {marketLabel(market)}
                  </OperatorRelatedLink>
                  <span className="rw-m text-[var(--hero-ink-2)]">
                    {OPERATOR_MARKET_META[market].line}
                    {performance.marketsObserved.includes(market)
                      ? ` · ${p.opVerified}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {performance.recentFixtureIds.length > 0 ? (
            <div className="mt-8">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.opRecentFixtures}</h3>
              <ul className="mt-2.5 space-y-1.5">
                {performance.recentFixtureIds.map((fixtureId) => (
                  <li key={fixtureId}>
                    <OperatorRelatedLink
                      href={operatorFixtureHref(locale, fixtureId)}
                      operatorSlug={operator.slug}
                      locale={locale}
                      kind="fixture"
                      target={String(fixtureId)}
                    >
                      {formatDict(p.opFixtureN, { id: String(fixtureId) })}
                    </OperatorRelatedLink>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* TERMS — the operator's own claims, demoted, claimed-not-verified. */}
        <section
          aria-labelledby="op-terms-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="op-terms-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.opTermsTitle}
          </h2>
          <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {p.opTermsNote}
          </p>
          {operator.highlights.length > 0 ? (
            <ul className="mt-5 border-t border-[var(--hero-line)]">
              {operator.highlights.slice(0, 6).map((item) => (
                <li
                  key={item}
                  className="rw-row border-b border-[var(--hero-line)] py-2.5 pl-3.5 text-[15px] text-[var(--hero-ink-2)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="rw-m mt-4 space-y-1 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {operator.foundedYear ? (
              <p>{formatDict(p.opFoundedRow, { year: String(operator.foundedYear) })}</p>
            ) : null}
            {operator.headquarters ? (
              <p>{formatDict(p.opHqRow, { hq: operator.headquarters })}</p>
            ) : null}
            {operator.licenses.length > 0 ? (
              <p>{formatDict(p.opLicensesRow, { list: operator.licenses.join(", ") })}</p>
            ) : null}
          </div>
          {operator.supportedCountries.length > 0 ? (
            <div className="mt-6">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.opCountriesTitle}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {operator.supportedCountries.map((code) => (
                  <li
                    key={code}
                    className={`rw-m inline-flex border px-2.5 py-1 ${
                      code === availability.visitorCountry
                        ? "border-[var(--hero-ink)] text-[var(--hero-ink)]"
                        : "border-[var(--hero-line)] text-[var(--hero-ink-2)]"
                    }`}
                  >
                    {countryName(code)} ({code})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-6 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
              {p.opCountriesNone}
            </p>
          )}
        </section>

        {/* DETAIL — related research, above the commercial block. */}
        <section
          aria-labelledby="op-detail-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="op-detail-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.cmpDetailTitle}
          </h2>
          {relatedOperators.length > 0 ? (
            <div className="mt-6">
              <h3 className="rw-label text-[var(--hero-ink-2)]">{p.opRelatedOperators}</h3>
              <ul className="mt-2.5 flex flex-wrap gap-2">
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
          ) : null}
          <p className="mt-6">
            <Link
              href={operatorEvidenceHref(locale)}
              className="rw-m text-[var(--hero-ink-2)] underline decoration-[var(--hero-line)] underline-offset-4 hover:text-[var(--hero-ink)]"
            >
              {p.cmpMethodologyLink}
            </Link>
          </p>
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
        </section>

        {/* CONTINUE — one commercial action, last, visibly commercial. */}
        <section
          aria-labelledby="op-continue-heading"
          className="mt-16 border-t border-[var(--hero-line)] pt-12"
        >
          <h2 id="op-continue-heading" className="rw-m text-[var(--hero-ink-2)]">
            {p.opContinueTitle}
          </h2>
          <p className="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--hero-ink-2)]">
            {p.opContinueBody}
          </p>
          <div className="mt-5">
            <OperatorAffiliateCta
              href={affiliateHref}
              operatorSlug={operator.slug}
              locale={locale}
              enabled={operator.affiliateEnabled && availability.available}
              label={
                operator.affiliateEnabled && availability.available
                  ? formatDict(p.opContinueCta, { operator: operator.name })
                  : p.opContinueUnavailable
              }
            />
          </div>
          <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
            {p.fxOperatorsNote}
          </p>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rw-row flex items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-2.5 pl-3.5">
      <dt className="rw-m text-[var(--hero-ink-2)]">{label}</dt>
      <dd className="rw-tnum text-[15px] font-bold text-[var(--hero-ink)]">{value}</dd>
    </div>
  );
}

