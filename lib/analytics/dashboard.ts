import { readTrackedAnalyticsEvents } from "./fileProvider";
import type { AnalyticsEvent } from "./types";

export type OperatorAnalyticsRow = {
  operator: string;
  impressions: number;
  clicks: number;
  ctr: number;
  country: string;
  league: string;
  market: string;
  fixture: string;
};

function property(event: { properties?: Record<string, string | number | boolean | null> }, key: string): string {
  const value = event.properties?.[key];
  return typeof value === "string" ? value : "";
}

export function aggregateOperatorAnalytics(events: readonly AnalyticsEvent[]): OperatorAnalyticsRow[] {
  const rows = new Map<string, Omit<OperatorAnalyticsRow, "ctr">>();

  for (const event of events) {
    if (
      (event.event_name !== "operator_impression" && event.event_name !== "operator_click") ||
      !event.operator_slug
    ) continue;

    const fixture = property(event, "fixture_label") || (event.fixture_id ? String(event.fixture_id) : "—");
    const row: Omit<OperatorAnalyticsRow, "ctr"> = {
      operator: event.operator_slug,
      impressions: 0,
      clicks: 0,
      country: event.country || "—",
      league: property(event, "league") || "—",
      market: event.market || "—",
      fixture,
    };
    const key = [row.operator, row.country, row.league, row.market, row.fixture].join("\u0000");
    const aggregate = rows.get(key) ?? row;
    if (event.event_name === "operator_impression") aggregate.impressions += 1;
    else aggregate.clicks += 1;
    rows.set(key, aggregate);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      ctr: row.impressions ? (row.clicks / row.impressions) * 100 : 0,
    }))
    .sort((left, right) => right.clicks - left.clicks || right.impressions - left.impressions);
}

export async function getOperatorAnalyticsRows(): Promise<OperatorAnalyticsRow[]> {
  return aggregateOperatorAnalytics(await readTrackedAnalyticsEvents());
}
