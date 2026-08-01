"use client";

import { useMemo, useState } from "react";
import type { OperatorAnalyticsRow } from "@/lib/analytics/dashboard";

type SortKey = keyof Pick<
  OperatorAnalyticsRow,
  "operator" | "impressions" | "clicks" | "ctr" | "country" | "league" | "market" | "fixture"
>;

const columns: Array<{ key: SortKey; label: string }> = [
  { key: "operator", label: "Operator" },
  { key: "impressions", label: "Impressions" },
  { key: "clicks", label: "Clicks" },
  { key: "ctr", label: "CTR" },
  { key: "country", label: "Country" },
  { key: "league", label: "League" },
  { key: "market", label: "Market" },
  { key: "fixture", label: "Fixture" },
];

export function OperatorAnalyticsDashboard({
  rows,
}: {
  rows: OperatorAnalyticsRow[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [descending, setDescending] = useState(true);

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows
      .filter((row) => !normalizedQuery || Object.values(row).some((value) => String(value).toLowerCase().includes(normalizedQuery)))
      .sort((left, right) => {
        const leftValue = left[sortKey];
        const rightValue = right[sortKey];
        const result = typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));
        return descending ? -result : result;
      });
  }, [descending, query, rows, sortKey]);

  function selectSort(key: SortKey) {
    if (key === sortKey) setDescending((current) => !current);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Operator analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">First-party partner-card impressions and affiliate redirects.</p>
        </div>
        <label className="text-sm text-muted-foreground">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="ml-2 rounded border border-border bg-white px-2 py-1 text-foreground outline-none focus:border-brand"
            placeholder="Operator, league, market…"
          />
        </label>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{visibleRows.length} rows</p>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th scope="col" key={column.key} className="px-3 py-2 font-medium">
                  <button type="button" onClick={() => selectSort(column.key)} className="hover:text-foreground">
                    {column.label}{sortKey === column.key ? (descending ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={[row.operator, row.country, row.league, row.market, row.fixture].join("-")} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">{row.operator}</td>
                <td className="px-3 py-2 tabular-nums text-right">{row.impressions}</td>
                <td className="px-3 py-2 tabular-nums text-right">{row.clicks}</td>
                <td className="px-3 py-2 tabular-nums text-right">{row.ctr.toFixed(1)}%</td>
                <td className="px-3 py-2">{row.country}</td>
                <td className="px-3 py-2">{row.league}</td>
                <td className="px-3 py-2">{row.market}</td>
                <td className="px-3 py-2">{row.fixture}</td>
              </tr>
            ))}
            {!visibleRows.length && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">No operator events recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
