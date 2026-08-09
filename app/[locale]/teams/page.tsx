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

  return (
    <>
      <JsonLd data={teamsIndexLd({ locale: params.locale, teams: all })} />
      <div className="rw-hero container-wide bg-[var(--hero-canvas)] pb-24">
        <header className="border-b border-[var(--hero-line)] pb-10 pt-10">
          <span aria-hidden className="block h-[2px] w-10 bg-[var(--hero-ink)]" />
          <p className="rw-m mt-3.5 text-[var(--hero-ink-2)]">{p.tmIndexEyebrow}</p>
          <h1 className="rw-h mt-1.5 text-[clamp(2.125rem,4.4vw,2.875rem)] text-[var(--hero-ink)]">
            {p.tmIndexTitle}
          </h1>
          <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.55] text-[var(--hero-ink-2)]">
            {p.tmIndexLede}
          </p>
        </header>

        <form
          className="mt-10 grid gap-4 border-b border-[var(--hero-line)] pb-10 md:grid-cols-3"
          action={teamsIndexPath(params.locale)}
          method="get"
          role="search"
          aria-label={p.tmSearchLabel}
        >
          <label className="block">
            <span className="rw-label text-[var(--hero-ink-2)]">{p.tmSearchLabel}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder={p.tmSearchPlaceholder}
              className="mt-1.5 w-full border border-[var(--hero-line)] bg-transparent px-3 py-2 text-sm text-[var(--hero-ink)] focus:border-[var(--hero-ink)] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="rw-label text-[var(--hero-ink-2)]">{p.tmFilterCompetition}</span>
            <select
              name="competition"
              defaultValue={competitionFilter}
              className="mt-1.5 w-full border border-[var(--hero-line)] bg-transparent px-3 py-2 text-sm text-[var(--hero-ink)] focus:border-[var(--hero-ink)] focus:outline-none"
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
            <span className="rw-label text-[var(--hero-ink-2)]">{p.tmFilterCountry}</span>
            <select
              name="country"
              defaultValue={countryFilter}
              className="mt-1.5 w-full border border-[var(--hero-line)] bg-transparent px-3 py-2 text-sm text-[var(--hero-ink)] focus:border-[var(--hero-ink)] focus:outline-none"
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
            <button
              type="submit"
              className="rw-m border border-[var(--hero-ink)] px-5 py-2.5 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]"
            >
              {p.tmApplyFilters}
            </button>
          </div>
        </form>

        {teams.length === 0 ? (
          <div className="mt-10">
            <p className="max-w-[52ch] border-l-2 border-[var(--hero-line)] py-1 pl-5 text-[15px] text-[var(--hero-ink-2)]">
              {p.tmFiltersEmpty}
            </p>
            <p className="mt-3">
              <Link
                href={teamsIndexPath(params.locale)}
                className="rw-m text-[var(--hero-ink)] underline decoration-[var(--hero-line)] underline-offset-4 hover:decoration-[var(--hero-ink)]"
              >
                {p.tmResetFilters}
              </Link>
            </p>
          </div>
        ) : (
          <ul className="mt-10 border-t-[1.5px] border-[var(--hero-ink)]">
            {teams.map((team) => (
              <li key={team.slug}>
                <Link
                  href={teamPath(params.locale, team.slug)}
                  className="rw-row block border-b border-[var(--hero-line)] py-4 pl-3.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--hero-ink)]">
                      {team.name}
                    </p>
                    <span className="rw-m text-[var(--hero-ink-2)]">
                      {team.countryCode ? countryName(team.countryCode) : p.tmInternational}
                    </span>
                  </div>
                  <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-[var(--hero-ink-2)]">
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
