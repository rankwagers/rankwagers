import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCompetition } from "@/lib/competitions/registry";
import { CountryFlagIcon } from "@/components/CountryFlagIcon";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { listSeasons } from "@/lib/seasons/registry";
import { seasonsIndexLd } from "@/lib/seasons/schema";
import { seasonPath, seasonsIndexPath } from "@/lib/seasons/links";
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
    path: "/seasons",
    title: "Seasons — coverage and settled records",
    description:
      "Browse RankWagers season intelligence pages: fixtures, markets, participating teams, and country-aware operators.",
  });
}

const FIELD_STYLE = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 13,
  padding: "6px 8px",
  width: "100%",
} as const;

export default function SeasonsIndexPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; competition?: string; country?: string };
}) {
  const all = listSeasons().sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const competitionFilter = searchParams?.competition?.trim() ?? "";
  const countryFilter = searchParams?.country?.trim().toUpperCase() ?? "";

  const seasons = all.filter((season) => {
    if (q) {
      const competition = getCompetition(season.competitionSlug);
      const haystack = `${season.displayName} ${competition?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (competitionFilter && season.competitionSlug !== competitionFilter) return false;
    if (countryFilter && season.countryCode !== countryFilter) return false;
    return true;
  });

  const competitions = [
    ...new Set(all.map((season) => season.competitionSlug)),
  ].sort();
  const countries = [
    ...new Set(all.map((season) => season.countryCode).filter(Boolean) as string[]),
  ].sort();

  return (
    <>
      <JsonLd data={seasonsIndexLd({ locale: params.locale, seasons: all })} />
      <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
        <p className="rw3-label">Season intelligence</p>
        <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
          Seasons
        </h1>
        <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
          Canonical season research hubs connecting competitions, teams, fixtures, markets, and
          operators. Factual relationships only — no standings or tipster content.
        </p>
      </header>

      <form
        className="grid gap-3 md:grid-cols-3"
        style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)" }}
        action={seasonsIndexPath(params.locale)}
        method="get"
        role="search"
        aria-label="Filter seasons"
      >
        <label className="block">
          <span className="rw3-label">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Competition or season"
            style={{ ...FIELD_STYLE, marginTop: 4 }}
          />
        </label>
        <label className="block">
          <span className="rw3-label">Competition</span>
          <select
            name="competition"
            defaultValue={competitionFilter}
            style={{ ...FIELD_STYLE, marginTop: 4 }}
          >
            <option value="">All competitions</option>
            {competitions.map((slug) => (
              <option key={slug} value={slug}>
                {getCompetition(slug)?.name ?? slug}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rw3-label">Country</span>
          <select
            name="country"
            defaultValue={countryFilter}
            style={{ ...FIELD_STYLE, marginTop: 4 }}
          >
            <option value="">All countries</option>
            {countries.map((code) => (
              <option key={code} value={code}>
                {countryName(code)}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-3">
          <button type="submit" className="rw3-ghost" style={{ fontSize: 12, padding: "4px 11px" }}>
            Apply filters
          </button>
        </div>
      </form>

      {seasons.length === 0 ? (
        <div style={{ padding: "12px 20px" }}>
          <EmptyState
            title="No seasons match these filters"
            description="Clear search or filters to browse the full canonical season registry."
            action={
              <Link
                href={seasonsIndexPath(params.locale)}
                className="rw3-ghost"
                style={{ fontSize: 12, padding: "4px 11px" }}
              >
                Reset filters
              </Link>
            }
          />
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0 }}>
          {seasons.map((season) => (
            <li key={season.id} style={{ listStyle: "none" }}>
              <Link
                href={seasonPath(params.locale, season.competitionSlug, season.slug)}
                className="rw3-hoverable"
                style={{
                  display: "block",
                  padding: "10px 20px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{season.displayName}</p>
                  <span
                    className="rw3-label"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    {season.active ? "Current" : "Archived"}
                    {season.countryCode ? (
                      <>
                        {" · "}
                        <CountryFlagIcon code={season.countryCode} />
                        {countryName(season.countryCode)}
                      </>
                    ) : null}
                  </span>
                </div>
                <p className="rw3-meta" style={{ margin: "2px 0 0" }}>
                  {getCompetition(season.competitionSlug)?.name ?? season.competitionSlug}
                  {" · "}
                  {season.startDate} → {season.endDate}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
