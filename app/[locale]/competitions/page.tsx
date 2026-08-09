import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { competitionPath } from "@/lib/competitions/links";
import { listCompetitions } from "@/lib/competitions/registry";
import { competitionsIndexLd } from "@/lib/competitions/schema";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
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
  return (
    <>
      <JsonLd data={competitionsIndexLd({ locale: params.locale, competitions })} />
      <div className="container-wide pb-16 pt-5">
        <section className="border-b border-[var(--border-subtle)] pb-8">
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Competition intelligence
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-display text-foreground md:text-4xl">
            Competitions
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-secondary)] md:text-base">
            Major football competitions as research hubs — fixtures, markets, operators, and odds
            without tips or fabricated rankings.
          </p>
        </section>

        <ul className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
          {competitions.map((competition) => (
            <li key={competition.slug}>
              <Link
                href={competitionPath(params.locale, competition.slug)}
                className="block py-4 transition-colors hover:bg-[var(--canvas-secondary)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-foreground">{competition.name}</p>
                  <span className="flex items-center gap-1.5 text-metadata uppercase tracking-label text-muted-foreground">
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
                <p className="mt-1 max-w-3xl text-sm text-[var(--ink-secondary)]">
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
