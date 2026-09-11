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
    <div className="pb-16">
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label" style={{ margin: 0 }}>
          {p.ctIndexEyebrow}
        </p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          {p.ctIndexTitle}
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {p.ctIndexLede}
        </p>
      </header>

      {codes.length ? (
        <ul style={{ margin: 0, padding: 0 }}>
          {codes.map((code) => (
            <li key={code} style={{ listStyle: "none" }}>
              <Link
                href={countryPath(params.locale, code)}
                className="rw3-hoverable flex items-baseline justify-between gap-x-4"
                style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)" }}
              >
                <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                  <CountryFlagIcon code={code} />
                  {countryName(code)}
                </span>
                <span className="rw3-meta">{code}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="max-w-[52ch] pl-4 text-[13px] leading-relaxed"
          style={{
            margin: "16px 20px 0",
            borderLeft: "2px solid var(--line)",
            color: "var(--muted)",
          }}
          role="status"
        >
          {p.ctIndexEmpty}
        </p>
      )}
      <p className="rw3-meta" style={{ padding: "10px 20px", margin: 0 }}>
        {countriesIndexPath(params.locale)}
      </p>
    </div>
  );
}
