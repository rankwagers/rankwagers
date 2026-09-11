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
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label" style={{ margin: 0 }}>
          {p.cmpIndexEyebrow}
        </p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          {p.cmpIndexTitle}
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          {p.cmpIndexLede}
        </p>
      </header>

      <ul style={{ margin: 0, padding: 0 }}>
        {competitions.map((competition) => (
          <li key={competition.slug} style={{ listStyle: "none" }}>
            <Link
              href={competitionPath(params.locale, competition.slug)}
              className="rw3-hoverable"
              style={{
                display: "block",
                padding: "10px 20px",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[14px] font-semibold" style={{ margin: 0 }}>
                  {competition.name}
                </p>
                <span className="rw3-meta flex items-center gap-1.5">
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
              <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "70ch" }}>
                {competition.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
