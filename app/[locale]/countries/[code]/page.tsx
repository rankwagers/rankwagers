import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { SemanticSection } from "@/components/seo/SemanticEntitySections";
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
import { pageMetadata } from "@/lib/seo";

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

  // Thin / doorway hubs stay reachable for personalization but are noindex;
  // still render useful content when partially available.
  return (
    <div className="container-wide py-10 pb-16">
      <JsonLd data={countryLandingBreadcrumbLd({ locale: params.locale, model })} />
      {model.indexability.indexable ? (
        <JsonLd data={countryLandingWebPageLd({ locale: params.locale, model })} />
      ) : null}

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={countriesIndexPath(params.locale)} className="hover:text-brand">
              Countries
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            {countryName(model.code)}
          </li>
        </ol>
      </nav>

      <header id="overview">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Country hub · {model.code}
        </p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold text-foreground">
          <CountryFlagIcon code={model.code} />
          {model.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--ink-secondary)]">
          {model.summary}
        </p>
        {!model.indexability.indexable ? (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            This hub is currently noindex ({model.indexability.reason.replaceAll("_", " ")}).
          </p>
        ) : null}
      </header>

      <div className="mt-10 space-y-10">
        <SemanticSection id="key-facts" title="Key facts">
          <ul className="grid gap-2 text-sm text-[var(--ink-secondary)] sm:grid-cols-3">
            <li className="rounded-lg border border-border px-3 py-2">
              Competitions linked:{" "}
              <strong className="text-foreground">{model.competitions.length}</strong>
            </li>
            <li className="rounded-lg border border-border px-3 py-2">
              Operators available:{" "}
              <strong className="text-foreground">{model.operators.length}</strong>
            </li>
            <li className="rounded-lg border border-border px-3 py-2">
              Fixture samples:{" "}
              <strong className="text-foreground">{model.fixtureSamples.length}</strong>
            </li>
          </ul>
        </SemanticSection>

        <SemanticSection id="competitions" title="Relevant competitions">
          {model.competitions.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {model.competitions.map((row) => (
                <li key={row.slug}>
                  <Link
                    href={row.href}
                    className="flex min-h-11 items-center rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 text-sm font-medium hover:border-brand/35"
                  >
                    {row.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No registry competitions resolved for this profile yet.
            </p>
          )}
        </SemanticSection>

        <SemanticSection id="operators" title="Bookmaker discovery">
          {model.operators.length ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {model.operators.map((row) => (
                <li key={row.slug}>
                  <Link
                    href={row.href}
                    className="flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:border-brand/35"
                    rel="noopener"
                  >
                    {row.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No verified operators are available for this country context.
            </p>
          )}
        </SemanticSection>

        <SemanticSection id="related" title="Related fixtures">
          <p className="mb-3 text-xs text-muted-foreground">
            Open a match to add settlement-supported markets to{" "}
            <Link href={`/${params.locale}/acca`} className="text-brand hover:underline">
              Acca Studio
            </Link>
            .
          </p>
          {model.fixtureSamples.length ? (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-lg border border-border">
              {model.fixtureSamples.map((row) => (
                <li key={row.slug}>
                  <Link
                    href={row.href}
                    className="block px-4 py-3 text-sm font-medium hover:bg-[var(--canvas-secondary)]"
                  >
                    {row.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recent archived fixtures matched this country. Browse markets instead.
            </p>
          )}
        </SemanticSection>

        <SemanticSection id="continue" title="Continue exploring">
          <ul className="flex flex-wrap gap-3 text-sm">
            <li>
              <Link href={model.marketsHref} className="text-brand hover:underline">
                Prediction markets
              </Link>
            </li>
            <li>
              <Link href={`/${params.locale}/competitions`} className="text-brand hover:underline">
                All competitions
              </Link>
            </li>
            <li>
              <Link href={`/${params.locale}/operators`} className="text-brand hover:underline">
                All bookmakers
              </Link>
            </li>
            <li>
              <Link href={`/${params.locale}#verified-performance`} className="text-brand hover:underline">
                Verified performance
              </Link>
            </li>
          </ul>
        </SemanticSection>
      </div>
    </div>
  );
}
