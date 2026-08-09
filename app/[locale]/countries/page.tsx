import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countriesIndexPath, countryPath } from "@/lib/countries/links";
import { listIndexableCountryCodes } from "@/lib/countries/landing";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  if (!locales.includes(params.locale)) return {};
  return pageMetadata({
    locale: params.locale,
    path: "/countries",
    title: "Countries — research and operator availability",
    description:
      "Regional football prediction hubs with relevant competitions and bookmakers. Only quality-gated country pages are listed.",
  });
}

export default function CountriesIndexPage({
  params,
}: {
  params: { locale: Locale };
}) {
  if (!locales.includes(params.locale)) notFound();
  const codes = listIndexableCountryCodes();

  return (
    <div className="container-wide py-10 pb-16">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href={`/${params.locale}`} className="hover:text-brand">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            Countries
          </li>
        </ol>
      </nav>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Country research hubs
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-[var(--ink-secondary)]">
        These pages exist only when RankWagers can assemble unique competitions, operators, and
        research context for the region — not as thin geo doorways.
      </p>
      {codes.length ? (
        <ul className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {codes.map((code) => (
            <li key={code}>
              <Link
                href={countryPath(params.locale, code)}
                className="flex min-h-12 items-center justify-between rounded-lg border border-border bg-[var(--canvas-secondary)] px-4 text-sm font-medium hover:border-brand/35"
              >
                <span className="flex items-center gap-2">
                  <CountryFlagIcon code={code} />
                  {countryName(code)}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{code}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          No country hubs currently pass the quality gate.
        </p>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        Index: <span className="font-mono">{countriesIndexPath(params.locale)}</span>
      </p>
    </div>
  );
}
