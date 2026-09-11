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

      <div style={{ paddingBottom: 80 }}>
        <nav
          aria-label="Breadcrumb"
          className="rw3-meta"
          style={{ padding: "12px 20px 0" }}
        >
          <Link href={`/${locale}`} style={{ color: "var(--muted)" }}>
            {p.nvHome}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <Link href={operatorsIndexPath(locale)} style={{ color: "var(--muted)" }}>
            {p.opIndexTitle}
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span style={{ color: "var(--text)" }}>{operator.name}</span>
        </nav>

        <header
          style={{
            marginTop: 6,
            padding: "14px 20px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <p className="rw3-label" style={{ margin: 0 }}>
            {p.opIndexEyebrow}
          </p>
          <div className="flex items-start gap-3" style={{ marginTop: 6 }}>
            {operator.logo ? (
              <Image
                src={operator.logo}
                alt={`${operator.name} logo`}
                width={32}
                height={32}
                sizes="32px"
                className="h-8 w-8 object-contain"
                style={{ border: "1px solid var(--line)", borderRadius: 6 }}
              />
            ) : null}
            <div>
              <h1 className="rw3-title" style={{ margin: 0 }}>
                {operator.name}
              </h1>
              <p
                style={{
                  margin: "4px 0 0",
                  maxWidth: "62ch",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--muted)",
                }}
              >
                {operator.description}
              </p>
            </div>
          </div>
        </header>

        {/* LEAD — the two preconditions: availability, then verification. */}
        <section aria-labelledby="op-lead-heading" style={{ padding: "16px 20px 0" }}>
          <p className="rw3-label" style={{ margin: 0 }}>
            {p.mktLeadEyebrow}
          </p>
          <h2
            id="op-lead-heading"
            style={{
              margin: "6px 0 0",
              maxWidth: "40ch",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {formatDict(
              availability.available ? p.opLeadAvailable : p.opLeadUnavailable,
              { operator: operator.name, country: availability.visitorCountry }
            )}
          </h2>
          <ul
            style={{
              margin: "14px 0 0",
              padding: 0,
              listStyle: "none",
              borderTop: "1px solid var(--line)",
            }}
          >
            <li
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              {formatDict(p.opVerificationRow, { status: verificationWord })}
            </li>
            <li
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              {formatDict(p.opSupportsMarketsLine, {
                n: String(operator.supportedMarkets.length),
              })}
            </li>
            {operator.supportedCountries.length > 0 ? (
              <li
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 13,
                }}
              >
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
          style={{
            margin: "20px 20px 0",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <OperatorOddsPanelBeacon
            operatorSlug={operator.slug}
            locale={locale}
            panel="best_odds"
          />
          <h2 id="op-evidence-heading" className="rw3-label" style={{ margin: 0 }}>
            {p.mktOddsTitle}
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              maxWidth: "52ch",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--muted)",
            }}
          >
            {p.opEvidenceNote}
          </p>
          {performance.sampleSize > 0 ? (
            <>
              <dl style={{ margin: "14px 0 0", borderTop: "1px solid var(--line)" }}>
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
              <p className="rw3-meta" style={{ margin: "10px 0 0" }}>
                {formatDict(p.opSamplesLine, { n: String(performance.sampleSize) })}
                {" · "}
                {p.mktOddsWindowNote}
              </p>
            </>
          ) : (
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: "52ch",
                padding: "4px 0 4px 14px",
                borderLeft: "2px solid var(--line)",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              {p.mktOddsEmpty}
            </p>
          )}

          <div style={{ marginTop: 20 }}>
            <h3 className="rw3-label" style={{ margin: 0 }}>
              {p.opMarketsTitle}
            </h3>
            <ul
              style={{
                margin: "8px 0 0",
                padding: 0,
                listStyle: "none",
                borderTop: "1px solid var(--line)",
              }}
            >
              {operator.supportedMarkets.map((market) => (
                <li
                  key={market}
                  className="flex flex-wrap items-baseline justify-between gap-x-4"
                  style={{
                    padding: "9px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
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
                  <span className="rw3-meta">
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
            <div style={{ marginTop: 20 }}>
              <h3 className="rw3-label" style={{ margin: 0 }}>
                {p.opRecentFixtures}
              </h3>
              <ul
                className="space-y-1.5"
                style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}
              >
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
          style={{
            margin: "20px 20px 0",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <h2 id="op-terms-heading" className="rw3-label" style={{ margin: 0 }}>
            {p.opTermsTitle}
          </h2>
          <p
            style={{
              margin: "6px 0 0",
              maxWidth: "52ch",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--muted)",
            }}
          >
            {p.opTermsNote}
          </p>
          {operator.highlights.length > 0 ? (
            <ul
              style={{
                margin: "14px 0 0",
                padding: 0,
                listStyle: "none",
                borderTop: "1px solid var(--line)",
              }}
            >
              {operator.highlights.slice(0, 6).map((item) => (
                <li
                  key={item}
                  style={{
                    padding: "9px 0",
                    borderBottom: "1px solid var(--line)",
                    fontSize: 13,
                    color: "var(--muted)",
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="rw3-meta space-y-1" style={{ marginTop: 12 }}>
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
            <div style={{ marginTop: 16 }}>
              <h3 className="rw3-label" style={{ margin: 0 }}>
                {p.opCountriesTitle}
              </h3>
              <ul
                className="flex flex-wrap gap-2"
                style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}
              >
                {operator.supportedCountries.map((code) => (
                  <li
                    key={code}
                    className="rw3-pill"
                    style={
                      code === availability.visitorCountry
                        ? { borderColor: "var(--text)", color: "var(--text)" }
                        : { color: "var(--muted)" }
                    }
                  >
                    {countryName(code)} ({code})
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p
              style={{
                margin: "16px 0 0",
                maxWidth: "52ch",
                padding: "4px 0 4px 14px",
                borderLeft: "2px solid var(--line)",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              {p.opCountriesNone}
            </p>
          )}
        </section>

        {/* DETAIL — related research, above the commercial block. */}
        <section
          aria-labelledby="op-detail-heading"
          style={{
            margin: "20px 20px 0",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <h2 id="op-detail-heading" className="rw3-label" style={{ margin: 0 }}>
            {p.cmpDetailTitle}
          </h2>
          {relatedOperators.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <h3 className="rw3-label" style={{ margin: 0 }}>
                {p.opRelatedOperators}
              </h3>
              <ul
                className="flex flex-wrap gap-2"
                style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}
              >
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
          <p style={{ margin: "14px 0 0", fontSize: 13 }}>
            <Link
              href={operatorEvidenceHref(locale)}
              style={{
                color: "var(--muted)",
                textDecoration: "underline",
                textDecorationColor: "var(--line)",
                textUnderlineOffset: 3,
              }}
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
          style={{
            margin: "20px 20px 0",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
          }}
        >
          <h2 id="op-continue-heading" className="rw3-label" style={{ margin: 0 }}>
            {p.opContinueTitle}
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              maxWidth: "52ch",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--muted)",
            }}
          >
            {p.opContinueBody}
          </p>
          <div style={{ marginTop: 14 }}>
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
          <p className="rw3-meta" style={{ margin: "10px 0 0" }}>
            {p.fxOperatorsNote}
          </p>
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-x-4"
      style={{ padding: "9px 0", borderBottom: "1px solid var(--line)" }}
    >
      <dt className="rw3-meta">{label}</dt>
      <dd className="rw3-pct" style={{ margin: 0 }}>
        {value}
      </dd>
    </div>
  );
}
