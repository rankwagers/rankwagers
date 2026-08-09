import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { countriesIndexPath, countryPath } from "@/lib/countries/links";
import { listIndexableCountryCodes } from "@/lib/countries/landing";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
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
  const p = getDictionary(params.locale).predictions;

  return (
    <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
      <header className="border-b border-[var(--hero-line)] pb-10 pt-10">
        <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
        <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.ctIndexEyebrow}</p>
        <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
          {p.ctIndexTitle}
        </h1>
        <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
          {p.ctIndexLede}
        </p>
      </header>

      {codes.length ? (
        <ul className="mt-10 border-t-[1.5px] border-[var(--hero-ink)]">
          {codes.map((code) => (
            <li key={code}>
              <Link
                href={countryPath(params.locale, code)}
                className="rw-row flex items-baseline justify-between gap-x-4 border-b border-[var(--hero-line)] py-4 pl-3.5"
              >
                <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                  <CountryFlagIcon code={code} />
                  {countryName(code)}
                </span>
                <span className="rw-m text-[var(--hero-ink-2)]">{code}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="mt-10 max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]"
          role="status"
        >
          {p.ctIndexEmpty}
        </p>
      )}
      <p className="rw-m mt-8 normal-case tracking-[0.04em] text-[var(--hero-ink-2)]">
        {countriesIndexPath(params.locale)}
      </p>
    </div>
  );
}
