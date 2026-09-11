import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { getCompetition } from "@/lib/competitions/registry";
import { countryName } from "@/lib/geoNames";
import { locales, type Locale } from "@/lib/i18n";
import { listTeams } from "@/lib/teams/registry";
import { teamsIndexLd } from "@/lib/teams/schema";
import { teamPath, teamsIndexPath } from "@/lib/teams/links";
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
    path: "/teams",
    title: "Teams — coverage and settled records",
    description:
      "Browse RankWagers team intelligence pages: fixtures, market evidence, competitions, and country-aware operators.",
  });
}

export default function TeamsIndexPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; competition?: string; country?: string };
}) {
  const all = listTeams().sort((left, right) => left.name.localeCompare(right.name));
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const competitionFilter = searchParams?.competition?.trim() ?? "";
  const countryFilter = searchParams?.country?.trim().toUpperCase() ?? "";

  const teams = all.filter((team) => {
    if (q) {
      const haystack = [team.name, team.shortName, ...(team.aliases ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (competitionFilter && !team.competitionSlugs.includes(competitionFilter)) return false;
    if (countryFilter && team.countryCode !== countryFilter) return false;
    return true;
  });

  const p = getDictionary(params.locale).predictions;

  const competitions = [
    ...new Set(all.flatMap((team) => team.competitionSlugs)),
  ].sort();
  const countries = [
    ...new Set(all.map((team) => team.countryCode).filter(Boolean) as string[]),
  ].sort();

  const fieldStyle = {
    border: "1px solid var(--line)",
    borderRadius: 6,
    background: "transparent",
    color: "var(--text)",
    fontSize: 13,
    padding: "6px 10px",
  } as const;

  return (
    <>
      <JsonLd data={teamsIndexLd({ locale: params.locale, teams: all })} />
      <div className="pb-16">
        <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <p className="rw3-label" style={{ margin: 0 }}>
            {p.tmIndexEyebrow}
          </p>
          <h1 className="rw3-title" style={{ margin: "2px 0 0" }}>
            {p.tmIndexTitle}
          </h1>
          <p className="rw3-meta" style={{ margin: "2px 0 0", maxWidth: "62ch" }}>
            {p.tmIndexLede}
          </p>
        </header>

        <form
          className="grid gap-4 md:grid-cols-3"
          style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}
          action={teamsIndexPath(params.locale)}
          method="get"
          role="search"
          aria-label={p.tmSearchLabel}
        >
          <label className="block">
            <span className="rw3-label">{p.tmSearchLabel}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder={p.tmSearchPlaceholder}
              className="mt-1.5 w-full"
              style={fieldStyle}
            />
          </label>
          <label className="block">
            <span className="rw3-label">{p.tmFilterCompetition}</span>
            <select
              name="competition"
              defaultValue={competitionFilter}
              className="mt-1.5 w-full"
              style={fieldStyle}
            >
              <option value="">{p.tmAllCompetitions}</option>
              {competitions.map((slug) => (
                <option key={slug} value={slug}>
                  {getCompetition(slug)?.name ?? slug}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="rw3-label">{p.tmFilterCountry}</span>
            <select
              name="country"
              defaultValue={countryFilter}
              className="mt-1.5 w-full"
              style={fieldStyle}
            >
              <option value="">{p.tmAllCountries}</option>
              {countries.map((code) => (
                <option key={code} value={code}>
                  {countryName(code)}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="rw3-ghost">
              {p.tmApplyFilters}
            </button>
          </div>
        </form>

        {teams.length === 0 ? (
          <div style={{ padding: "16px 20px" }}>
            <p
              className="max-w-[52ch] pl-4 text-[13px] leading-relaxed"
              style={{ borderLeft: "2px solid var(--line)", color: "var(--muted)" }}
            >
              {p.tmFiltersEmpty}
            </p>
            <p className="mt-3">
              <Link href={teamsIndexPath(params.locale)} className="rw3-ghost">
                {p.tmResetFilters}
              </Link>
            </p>
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0 }}>
            {teams.map((team) => (
              <li key={team.slug} style={{ listStyle: "none" }}>
                <Link
                  href={teamPath(params.locale, team.slug)}
                  className="rw3-hoverable block"
                  style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)" }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[13px] font-semibold" style={{ margin: 0 }}>
                      {team.name}
                    </p>
                    <span className="rw3-meta">
                      {team.countryCode ? countryName(team.countryCode) : p.tmInternational}
                    </span>
                  </div>
                  <p className="rw3-meta max-w-[70ch]" style={{ margin: "2px 0 0" }}>
                    {team.competitionSlugs
                      .map((slug) => getCompetition(slug)?.name ?? slug)
                      .join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
