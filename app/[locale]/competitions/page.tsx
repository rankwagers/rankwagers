import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { competitionPath } from "@/lib/competitions/links";
import { listCompetitions } from "@/lib/competitions/registry";
import { competitionsIndexLd } from "@/lib/competitions/schema";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Metadata {
  return pageMetadata({
    locale: params.locale,
    path: "/competitions",
    title: "Competitions — coverage and settled records",
    description:
      "Browse RankWagers competition intelligence hubs connecting fixtures, markets, operators, and observed odds.",
  });
}

export default function CompetitionsIndexPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const competitions = listCompetitions();
  const p = getDictionary(params.locale).predictions;
  return (
    <>
      <JsonLd data={competitionsIndexLd({ locale: params.locale, competitions })} />
      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <header className="border-b border-[var(--hero-line)] pb-10 pt-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.cmpIndexEyebrow}</p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            {p.cmpIndexTitle}
          </h1>
          <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {p.cmpIndexLede}
          </p>
        </header>

        <ul className="mt-10 border-t-[1.5px] border-[var(--hero-ink)]">
          {competitions.map((competition) => (
            <li key={competition.slug}>
              <Link
                href={competitionPath(params.locale, competition.slug)}
                className="rw-row block border-b border-[var(--hero-line)] py-4 pl-3.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                    {competition.name}
                  </p>
                  <span className="rw-m flex items-center gap-1.5 text-[var(--hero-ink-2)]">
                    {competition.confederation}
                    {competition.country ? (
                      <>
                        {" · "}
                        <CountryFlagIcon code={competition.country} />
                        {countryName(competition.country)}
                      </>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-[var(--hero-ink-2)]">
                  {competition.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
