"use client";

import type { CSSProperties } from "react";
import { ARCHIVE_MARKETS, archiveMarketLabel } from "@/lib/archive/markets";
import type { ArchiveFilters as Filters } from "@/lib/archive/types";
import type { PredictionStrings } from "@/lib/translations/predictionsEn";
import { archiveIndexPath } from "@/lib/archive/links";
import { trackArchiveEvent } from "@/lib/archive/analytics";

const FIELD = "mt-1.5 min-h-9 w-full px-2.5 text-[13px]";

const FIELD_STYLE: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  color: "var(--text)",
};

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
      className="py-4"
      style={{
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
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
            from: String(data.get("from") ?? "") || null,
            to: String(data.get("to") ?? "") || null,
          },
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="rw3-label">{p.arcFilterMarket}</span>
          <select
            name="market"
            defaultValue={filters.market ?? "all"}
            className={FIELD}
            style={FIELD_STYLE}
          >
            <option value="all">{p.arcAllMarkets}</option>
            {ARCHIVE_MARKETS.map((key) => (
              <option key={key} value={key}>
                {archiveMarketLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rw3-label">{p.arcFilterStatus}</span>
          <select
            name="status"
            defaultValue={filters.status ?? "all"}
            className={FIELD}
            style={FIELD_STYLE}
          >
            <option value="all">{p.arcAllStatuses}</option>
            <option value="won">{p.resultsWon}</option>
            <option value="lost">{p.resultsLost}</option>
            <option value="void">{p.resultsVoid}</option>
            <option value="pending">{p.resultsPending}</option>
          </select>
        </label>
        <label className="block">
          <span className="rw3-label">{p.arcFilterCompetition}</span>
          <select
            name="competition"
            defaultValue={filters.competition ?? ""}
            className={FIELD}
            style={FIELD_STYLE}
          >
            <option value="">{p.tmAllCompetitions}</option>
            {competitions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="rw3-label">{p.arcFilterTeam}</span>
          <input
            name="team"
            type="search"
            defaultValue={filters.team ?? ""}
            placeholder={p.tmSearchPlaceholder}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block">
          <span className="rw3-label">{p.arcFilterSearch}</span>
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={p.arcSearchPlaceholder}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
        {/* The period picker (Bible V3 block H) — bounds the queried window. */}
        <label className="block">
          <span className="rw3-label">{p.v3From}</span>
          <input
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
        <label className="block">
          <span className="rw3-label">{p.v3To}</span>
          <input
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="rw3-ghost" style={{ minHeight: 36, padding: "6px 14px" }}>
          {p.tmApplyFilters}
        </button>
        <a href={action} className="rw3-ghost" style={{ minHeight: 36, padding: "6px 14px" }}>
          {p.tmResetFilters}
        </a>
      </div>
    </form>
  );
}
