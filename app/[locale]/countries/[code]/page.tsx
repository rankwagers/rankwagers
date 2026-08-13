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
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <JsonLd data={countryLandingBreadcrumbLd({ locale: params.locale, model })} />
      {model.indexability.indexable ? (
        <JsonLd data={countryLandingWebPageLd({ locale: params.locale, model })} />
      ) : null}

      <nav aria-label="Breadcrumb" className="rw-m pt-5 text-[var(--hero-ink-2)]">
        <Link href={`/${params.locale}`} className="hover:text-[var(--hero-ink)]">
          {p.nvHome}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <Link
          href={countriesIndexPath(params.locale)}
          className="hover:text-[var(--hero-ink)]"
        >
          {p.ctIndexTitle}
        </Link>
        <span className="mx-1.5" aria-hidden>
          /
        </span>
        <span className="text-[var(--hero-ink)]">{countryName(model.code)}</span>
      </nav>

      <header id="overview" className="mt-6 border-b border-[var(--hero-line)] pb-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">
          {p.ctEyebrow} · {model.code}
        </p>
        <h1 className="rw-h mt-1.5 flex items-center gap-3 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          <CountryFlagIcon code={model.code} />
          {model.title}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {model.summary}
        </p>
        {!model.indexability.indexable ? (
          <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]" role="status">
            {formatDict(p.ctNoindexNote, {
              reason: model.indexability.reason.replaceAll("_", " "),
            })}
          </p>
        ) : null}
      </header>

      {/* LEAD — omitted whole when the hub holds nothing (the empty-state law). */}
      {total > 0 ? (
        <section aria-labelledby="ct-lead-heading" className="mt-14">
          <p className="rw-m text-[var(--hero-ink-2)]">{p.mktLeadEyebrow}</p>
          <h2
            id="ct-lead-heading"
            className="rw-h mt-2.5 max-w-[30ch] text-[clamp(1.6rem,3.6vw,2.4rem)] text-[var(--hero-ink)]"
          >
            {formatDict(p.ctLeadLine, {
              competitions: String(model.competitions.length),
              operators: String(model.operators.length),
              fixtures: String(model.fixtureSamples.length),
            })}
          </h2>
          <ul className="mt-8 border-t-[1.5px] border-[var(--hero-ink)]">
            {model.competitions.length > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.ctCompetitionsCount, { n: String(model.competitions.length) })}
              </li>
            ) : null}
            {model.operators.length > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.ctOperatorsCount, { n: String(model.operators.length) })}
              </li>
            ) : null}
            {model.fixtureSamples.length > 0 ? (
              <li className="rw-row border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]">
                {formatDict(p.ctFixturesCount, { n: String(model.fixtureSamples.length) })}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section
        id="competitions"
        aria-labelledby="ct-competitions-heading"
        className="mt-16 border-t border-[var(--hero-line)] pt-12"
      >
        <h2 id="ct-competitions-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.ctCompetitionsTitle}
        </h2>
        {model.competitions.length ? (
          <ul className="mt-5 border-t border-[var(--hero-line)]">
            {model.competitions.map((row) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  className="rw-row block border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]"
                >
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
            {p.ctCompetitionsEmpty}
          </p>
        )}
      </section>

      <section
        id="related"
        aria-labelledby="ct-fixtures-heading"
        className="mt-12"
      >
        <h2 id="ct-fixtures-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.ctFixturesTitle}
        </h2>
        {model.fixtureSamples.length ? (
          <ul className="mt-5 border-t border-[var(--hero-line)]">
            {model.fixtureSamples.map((row) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  className="rw-row block border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]"
                >
                  {row.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
            {p.ctFixturesEmpty}
          </p>
        )}
      </section>

      <section
        id="continue"
        aria-labelledby="ct-continue-heading"
        className="mt-16 border-t border-[var(--hero-line)] pt-12"
      >
        <h2 id="ct-continue-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.ctContinueTitle}
        </h2>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {[
            { href: model.marketsHref, label: p.ctLinkMarkets },
            { href: `/${params.locale}/competitions`, label: p.ctLinkCompetitions },
            { href: `/${params.locale}/operators`, label: p.ctLinkOperators },
            { href: `/${params.locale}/acca`, label: p.ctLinkAcca },
            { href: `/${params.locale}#verified-performance`, label: p.ctLinkPerformance },
          ].map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="text-[15px] text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
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
        className="mt-16 border-t border-[var(--hero-line)] pt-12"
      >
        <h2 id="ct-operators-heading" className="rw-m text-[var(--hero-ink-2)]">
          {p.ctOperatorsTitle}
        </h2>
        {model.operators.length ? (
          <ul className="mt-5 border-t border-[var(--hero-line)]">
            {model.operators.map((row) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  rel="noopener"
                  className="rw-row block border-b border-[var(--hero-line)] py-3 pl-3.5 text-[15px] text-[var(--hero-ink)]"
                >
                  {row.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
            {p.ctOperatorsEmpty}
          </p>
        )}
        <p className="rw-m mt-3 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
          {p.fxOperatorsNote}
        </p>
      </section>
    </div>
  );
}
