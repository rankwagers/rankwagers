"use client";

import { ARCHIVE_MARKETS, archiveMarketLabel } from "@/lib/archive/markets";
import type { ArchiveFilters as Filters } from "@/lib/archive/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { archiveIndexPath } from "@/lib/archive/links";
import { trackArchiveEvent } from "@/lib/archive/analytics";

const FIELD =
  "mt-1.5 min-h-10 w-full border border-[var(--hero-line)] bg-transparent px-2.5 text-sm text-[var(--hero-ink)] focus:border-[var(--hero-ink)] focus:outline-none";

export function ArchiveFilters({
  locale,
  filters,
  competitions,
  p,
  actionPath,
}: {
  locale: string;
  filters: Filters;
  competitions: string[];
  p: PredictionStrings;
  actionPath?: string;
}) {
  const action = actionPath ?? archiveIndexPath(locale);

  return (
    <form
      method="get"
      action={action}
      className="border-y border-[var(--hero-line)] py-5"
      aria-label={p.arcFilterSearch}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        trackArchiveEvent("archive_filter_used", {
          locale,
          properties: {
            market: String(data.get("market") ?? "all"),
            status: String(data.get("status") ?? "all"),
            competition: String(data.get("competition") ?? "") || null,
            team: String(data.get("team") ?? "") || null,
            q: String(data.get("q") ?? "") || null,
          },
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="rw-label text-[var(--hero-ink-2)]">{p.arcFilterMarket}</span>
          <select name="market" defaultValue={filters.market ?? "all"} className={FIELD}>
            <option value="all">{p.arcAllMarkets}</option>
            {ARCHIVE_MARKETS.map((key) => (
              <option key={key} value={key}>
                {archiveMarketLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rw-label text-[var(--hero-ink-2)]">{p.arcFilterStatus}</span>
          <select name="status" defaultValue={filters.status ?? "all"} className={FIELD}>
            <option value="all">{p.arcAllStatuses}</option>
            <option value="won">{p.resultsWon}</option>
            <option value="lost">{p.resultsLost}</option>
            <option value="void">{p.resultsVoid}</option>
            <option value="pending">{p.resultsPending}</option>
          </select>
        </label>
        <label className="block">
          <span className="rw-label text-[var(--hero-ink-2)]">{p.arcFilterCompetition}</span>
          <select name="competition" defaultValue={filters.competition ?? ""} className={FIELD}>
            <option value="">{p.tmAllCompetitions}</option>
            {competitions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rw-label text-[var(--hero-ink-2)]">{p.arcFilterTeam}</span>
          <input
            name="team"
            type="search"
            defaultValue={filters.team ?? ""}
            placeholder={p.tmSearchPlaceholder}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="rw-label text-[var(--hero-ink-2)]">{p.arcFilterSearch}</span>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={p.arcSearchPlaceholder}
            className={FIELD}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rw-m min-h-10 border border-[var(--hero-ink)] px-5 text-[var(--hero-ink)] transition-colors hover:bg-[var(--hero-ink)] hover:text-[var(--hero-canvas)]"
        >
          {p.tmApplyFilters}
        </button>
        <a
          href={action}
          className="rw-m inline-flex min-h-10 items-center border border-[var(--hero-line)] px-4 text-[var(--hero-ink-2)] transition-colors hover:border-[var(--hero-ink)] hover:text-[var(--hero-ink)]"
        >
          {p.tmResetFilters}
        </a>
      </div>
    </form>
  );
}
