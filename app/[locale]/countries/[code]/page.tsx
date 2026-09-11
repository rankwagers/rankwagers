import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import {
  buildCountryLanding,
  isConfiguredCountryCode,
} from "@/lib/countries/landing";
import {
  countryLandingBreadcrumbLd,
  countryLandingWebPageLd,
} from "@/lib/countries/schema";
import { countriesIndexPath } from "@/lib/countries/links";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { formatDict } from "@/lib/dictionaryExtras";
import { pageMetadata } from "@/lib/seo";

/* ============================================================================
   THE COUNTRY HUB — form-guide conversion, fixture-style hierarchy
   ----------------------------------------------------------------------------
   LEAD      what this hub connects — one sentence with its counts inline,
             omitted whole when the hub holds nothing.
   SUPPORTS  the three counts as ruled rows, zero rows omitted.
   CONTENT   competitions, then archived fixtures — honest empties.
   DETAIL    continue-exploring links, quiet.
   LAST      one commercial block: bookmaker discovery.
   ========================================================================== */

export function generateStaticParams() {
  // Demand-render by code; sitemap lists only indexable hubs.
  return [] as Array<{ locale: string; code: string }>;
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale; code: string };
}): Metadata {
  if (!locales.includes(params.locale)) return {};
  const model = buildCountryLanding(params.locale, params.code);
  if (!model) {
    return pageMetadata({
      locale: params.locale,
      path: `/countries/${params.code}`,
      title: "Country not in the current dataset",
      description: "This country research hub is not available.",
      index: false,
    });
  }
  return pageMetadata({
    locale: params.locale,
    path: `/countries/${model.code.toLowerCase()}`,
    title: model.title,
    description: model.summary.slice(0, 160),
    index: model.indexability.indexable,
  });
}

export default function CountryLandingPage({
  params,
}: {
  params: { locale: Locale; code: string };
}) {
  if (!locales.includes(params.locale)) notFound();
  if (!isConfiguredCountryCode(params.code)) notFound();

  const model = buildCountryLanding(params.locale, params.code);
  if (!model) notFound();

  const p = getDictionary(params.locale).predictions;
  const total =
    model.competitions.length + model.operators.length + model.fixtureSamples.length;

  // Thin / doorway hubs stay reachable for personalization but are noindex;
  // still render useful content when partially available.
  return (
    <div className="px-5 pb-16">
      <JsonLd data={countryLandingBreadcrumbLd({ locale: params.locale, model })} />
      {model.indexability.indexable ? (
        <JsonLd data={countryLandingWebPageLd({ locale: params.locale, model })} />
      ) : null}

      <nav
        aria-label="Breadcrumb"
        className="pt-3.5 text-[12px]"
        style={{ color: "var(--muted)" }}
      >
        <Link href={`/${params.locale}`}>{p.nvHome}</Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link href={countriesIndexPath(params.locale)}>{p.ctIndexTitle}</Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span style={{ color: "var(--text)" }}>{countryName(model.code)}</span>
      </nav>

      <header id="overview" className="mt-4 pb-3.5" style={{ borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label" style={{ margin: 0 }}>
          {p.ctEyebrow} · {model.code}
        </p>
        <h1 className="rw3-title flex items-center gap-3" style={{ margin: "2px 0 0" }}>
          <CountryFlagIcon code={model.code} />
          {model.title}
        </h1>
        <p className="rw3-meta" style={{ margin: "4px 0 0", maxWidth: "62ch" }}>
          {model.summary}
        </p>
        {!model.indexability.indexable ? (
          <p className="rw3-meta mt-3" role="status">
            {formatDict(p.ctNoindexNote, {
              reason: model.indexability.reason.replaceAll("_", " "),
            })}
          </p>
        ) : null}
      </header>

      {/* LEAD — omitted whole when the hub holds nothing (the empty-state law). */}
      {total > 0 ? (
        <section aria-labelledby="ct-lead-heading" className="mt-8">
          <p className="rw3-label">{p.mktLeadEyebrow}</p>
          <h2 id="ct-lead-heading" className="mt-1.5 max-w-[52ch] text-[14px] font-semibold">
            {formatDict(p.ctLeadLine, {
              competitions: String(model.competitions.length),
              operators: String(model.operators.length),
              fixtures: String(model.fixtureSamples.length),
            })}
          </h2>
          <ul className="mt-5" style={{ borderTop: "1px solid var(--line)" }}>
            {model.competitions.length > 0 ? (
              <li className="py-3 text-[13px]" style={{ borderBottom: "1px solid var(--line)" }}>
                {formatDict(p.ctCompetitionsCount, { n: String(model.competitions.length) })}
              </li>
            ) : null}
            {model.operators.length > 0 ? (
              <li className="py-3 text-[13px]" style={{ borderBottom: "1px solid var(--line)" }}>
                {formatDict(p.ctOperatorsCount, { n: String(model.operators.length) })}
              </li>
            ) : null}
            {model.fixtureSamples.length > 0 ? (
              <li className="py-3 text-[13px]" style={{ borderBottom: "1px solid var(--line)" }}>
                {formatDict(p.ctFixturesCount, { n: String(model.fixtureSamples.length) })}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section
        id="competitions"
        aria-labelledby="ct-competitions-heading"
        className="mt-10 pt-8"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <h2 id="ct-competitions-heading" className="rw3-label">
          {p.ctCompetitionsTitle}
        </h2>
        {model.competitions.length ? (
          <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
            {model.competitions.map((row) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  className="rw3-hoverable block py-3 text-[13px] font-semibold"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="mt-4 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
            style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
          >
            {p.ctCompetitionsEmpty}
          </p>
        )}
      </section>

      <section
        id="related"
        aria-labelledby="ct-fixtures-heading"
        className="mt-8"
      >
        <h2 id="ct-fixtures-heading" className="rw3-label">
          {p.ctFixturesTitle}
        </h2>
        {model.fixtureSamples.length ? (
          <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
            {model.fixtureSamples.map((row) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  className="rw3-hoverable block py-3 text-[13px]"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {row.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="mt-4 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
            style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
          >
            {p.ctFixturesEmpty}
          </p>
        )}
      </section>

      <section
        id="continue"
        aria-labelledby="ct-continue-heading"
        className="mt-10 pt-8"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <h2 id="ct-continue-heading" className="rw3-label">
          {p.ctContinueTitle}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-x-3 gap-y-2">
          {[
            { href: model.marketsHref, label: p.ctLinkMarkets },
            { href: `/${params.locale}/competitions`, label: p.ctLinkCompetitions },
            { href: `/${params.locale}/operators`, label: p.ctLinkOperators },
            { href: `/${params.locale}/acca`, label: p.ctLinkAcca },
            { href: `/${params.locale}#verified-performance`, label: p.ctLinkPerformance },
          ].map((link) => (
            <li key={link.label}>
              <Link href={link.href} className="rw3-ghost">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* LAST — the single commercial block. */}
      <section
        id="operators"
        aria-labelledby="ct-operators-heading"
        className="mt-10 pt-8"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <h2 id="ct-operators-heading" className="rw3-label">
          {p.ctOperatorsTitle}
        </h2>
        {model.operators.length ? (
          <ul className="mt-4" style={{ borderTop: "1px solid var(--line)" }}>
            {model.operators.map((row) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  rel="noopener"
                  className="rw3-hoverable block py-3 text-[13px]"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className="mt-4 max-w-[52ch] pl-4 text-[13px] leading-relaxed"
            style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
          >
            {p.ctOperatorsEmpty}
          </p>
        )}
        <p className="rw3-meta mt-3">{p.fxOperatorsNote}</p>
      </section>
    </div>
  );
}
