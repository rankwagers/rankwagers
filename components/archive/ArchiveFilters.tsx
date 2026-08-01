"use client";

import { ARCHIVE_MARKETS, archiveMarketLabel } from "@/lib/archive/markets";
import type { ArchiveFilters as Filters } from "@/lib/archive/types";
import { archiveIndexPath } from "@/lib/archive/links";
import { trackArchiveEvent } from "@/lib/archive/analytics";

export function ArchiveFilters({
  locale,
  filters,
  competitions,
  actionPath,
}: {
  locale: string;
  filters: Filters;
  competitions: string[];
  actionPath?: string;
}) {
  const action = actionPath ?? archiveIndexPath(locale);

  return (
    <form
      method="get"
      action={action}
      className="rounded-lg border border-border bg-[var(--canvas-secondary)] p-4"
      aria-label="Archive filters"
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
        <label className="block text-xs">
          <span className="font-medium uppercase tracking-label text-muted-foreground">
            Market
          </span>
          <select
            name="market"
            defaultValue={filters.market ?? "all"}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-white px-2 text-sm"
          >
            <option value="all">All markets</option>
            {ARCHIVE_MARKETS.map((key) => (
              <option key={key} value={key}>
                {archiveMarketLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-medium uppercase tracking-label text-muted-foreground">
            Status
          </span>
          <select
            name="status"
            defaultValue={filters.status ?? "all"}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-white px-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="void">Void</option>
            <option value="pending">Pending</option>
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-medium uppercase tracking-label text-muted-foreground">
            Competition
          </span>
          <select
            name="competition"
            defaultValue={filters.competition ?? ""}
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-white px-2 text-sm"
          >
            <option value="">All competitions</option>
            {competitions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="font-medium uppercase tracking-label text-muted-foreground">
            Team
          </span>
          <input
            name="team"
            type="search"
            defaultValue={filters.team ?? ""}
            placeholder="Team name"
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-white px-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="font-medium uppercase tracking-label text-muted-foreground">
            Search
          </span>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Match or league"
            className="mt-1 min-h-10 w-full rounded-md border border-border bg-white px-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          className="btn-primary min-h-10"
        >
          Apply filters
        </button>
        <a
          href={action}
          className="inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-medium"
        >
          Reset
        </a>
      </div>
    </form>
  );
}
