"use client";

import { useMemo, useState } from "react";
import type {
  CountryIntelligenceRow,
  CtrDashboardData,
  CtrMetricRow,
  ExitAnalyticsRow,
  FunnelStepRow,
  ScrollDepthRow,
  SectionAnalyticsRow,
  TimeOnFixtureRow,
} from "@/lib/analytics/ctrDashboard";

type TabId =
  | "operators"
  | "fixtures"
  | "leagues"
  | "markets"
  | "countries"
  | "sections"
  | "funnel"
  | "scroll"
  | "time"
  | "exits";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "operators", label: "Operators" },
  { id: "fixtures", label: "Fixtures" },
  { id: "leagues", label: "Leagues" },
  { id: "markets", label: "Markets" },
  { id: "countries", label: "Countries" },
  { id: "sections", label: "Sections" },
  { id: "funnel", label: "Funnel" },
  { id: "scroll", label: "Scroll depth" },
  { id: "time", label: "Time on fixture" },
  { id: "exits", label: "Exits" },
];

export function CtrAnalyticsDashboard({ data }: { data: CtrDashboardData }) {
  const [tab, setTab] = useState<TabId>("operators");
  const [query, setQuery] = useState("");

  const metricRows = useMemo(() => {
    const source =
      tab === "operators" ? data.operators
        : tab === "fixtures" ? data.fixtures
          : tab === "leagues" ? data.leagues
            : tab === "markets" ? data.markets
              : null;
    if (!source) return null;
    const normalized = query.trim().toLowerCase();
    return source.filter((row) =>
      !normalized ||
      row.label.toLowerCase().includes(normalized) ||
      row.key.toLowerCase().includes(normalized)
    );
  }, [data, query, tab]);

  const countryRows = useMemo(() => {
    if (tab !== "countries") return null;
    const normalized = query.trim().toLowerCase();
    return data.countries.filter((row) =>
      !normalized ||
      row.country.toLowerCase().includes(normalized) ||
      row.topOperator.toLowerCase().includes(normalized) ||
      row.topLeague.toLowerCase().includes(normalized) ||
      row.topMarket.toLowerCase().includes(normalized)
    );
  }, [data.countries, query, tab]);

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">CTR analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            First-party impressions, affiliate clicks, funnel and engagement.
          </p>
        </div>
        {(tab === "operators" || tab === "fixtures" || tab === "leagues" || tab === "markets" || tab === "countries") && (
          <label className="text-sm text-muted-foreground">
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="ml-2 rounded border border-border bg-white px-2 py-1 text-foreground outline-none focus:border-brand"
              placeholder="Filter rows…"
            />
          </label>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => { setTab(item.id); setQuery(""); }}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              tab === item.id ? "bg-foreground text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {metricRows && <MetricTable rows={metricRows} empty="No CTR rows yet." />}
      {countryRows && <CountryTable rows={countryRows} />}
      {tab === "sections" && <SectionTable rows={data.sections} />}
      {tab === "funnel" && <FunnelTable rows={data.funnel} />}
      {tab === "scroll" && <ScrollTable rows={data.scrollDepth} />}
      {tab === "time" && <TimeTable rows={data.timeOnFixture} />}
      {tab === "exits" && <ExitTable rows={data.exits} />}
    </div>
  );
}

function MetricTable({ rows, empty }: { rows: CtrMetricRow[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Label</th>
            <th scope="col" className="px-3 py-2 font-medium">Impressions</th>
            <th scope="col" className="px-3 py-2 font-medium">Clicks</th>
            <th scope="col" className="px-3 py-2 font-medium">CTR</th>
            <th scope="col" className="px-3 py-2 font-medium">Redirects</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.impressions}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.clicks}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.ctr.toFixed(1)}%</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.redirects}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CountryTable({ rows }: { rows: CountryIntelligenceRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Country</th>
            <th scope="col" className="px-3 py-2 font-medium">Sessions</th>
            <th scope="col" className="px-3 py-2 font-medium">Impressions</th>
            <th scope="col" className="px-3 py-2 font-medium">Clicks</th>
            <th scope="col" className="px-3 py-2 font-medium">CTR</th>
            <th scope="col" className="px-3 py-2 font-medium">Redirects</th>
            <th scope="col" className="px-3 py-2 font-medium">Top operator</th>
            <th scope="col" className="px-3 py-2 font-medium">Top league</th>
            <th scope="col" className="px-3 py-2 font-medium">Top market</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.country} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-foreground">{row.country}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.sessions}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.impressions}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.clicks}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.ctr.toFixed(1)}%</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.redirects}</td>
              <td className="px-3 py-2">{row.topOperator}</td>
              <td className="px-3 py-2">{row.topLeague}</td>
              <td className="px-3 py-2">{row.topMarket}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                No country rows yet. Use ?country=BR to generate override traffic.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SectionTable({ rows }: { rows: SectionAnalyticsRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Section</th>
            <th scope="col" className="px-3 py-2 font-medium">Impressions</th>
            <th scope="col" className="px-3 py-2 font-medium">Clicks</th>
            <th scope="col" className="px-3 py-2 font-medium">CTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.section} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.section}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.impressions}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.clicks}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.ctr.toFixed(1)}%</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No section events yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function FunnelTable({ rows }: { rows: FunnelStepRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Step</th>
            <th scope="col" className="px-3 py-2 font-medium">Count</th>
            <th scope="col" className="px-3 py-2 font-medium">From previous</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.step} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.step}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.count}</td>
              <td className="px-3 py-2 tabular-nums text-right">
                {row.conversionFromPrevious === null ? "—" : `${row.conversionFromPrevious.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScrollTable({ rows }: { rows: ScrollDepthRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Depth</th>
            <th scope="col" className="px-3 py-2 font-medium">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.depth} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.depth}%</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.sessions}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">No scroll depth events yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TimeTable({ rows }: { rows: TimeOnFixtureRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Fixture</th>
            <th scope="col" className="px-3 py-2 font-medium">Samples</th>
            <th scope="col" className="px-3 py-2 font-medium">Avg seconds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.fixtureId} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.fixtureLabel}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.samples}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.averageSeconds.toFixed(1)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">No time-on-fixture events yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ExitTable({ rows }: { rows: ExitAnalyticsRow[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-label text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Path</th>
            <th scope="col" className="px-3 py-2 font-medium">Exits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.path}</td>
              <td className="px-3 py-2 tabular-nums text-right">{row.exits}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">No exit events yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
