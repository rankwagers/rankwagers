import { readTrackedAnalyticsEvents } from "./fileProvider";
import type { AnalyticsEvent } from "./types";

export type CtrMetricRow = {
  key: string;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number;
  redirects: number;
};

export type CountryIntelligenceRow = {
  country: string;
  sessions: number;
  impressions: number;
  clicks: number;
  ctr: number;
  redirects: number;
  topOperator: string;
  topLeague: string;
  topMarket: string;
};

export type FunnelStepRow = {
  step: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type SectionAnalyticsRow = {
  section: string;
  impressions: number;
  clicks: number;
  ctr: number;
};

export type ScrollDepthRow = {
  depth: number;
  sessions: number;
};

export type TimeOnFixtureRow = {
  fixtureId: number;
  fixtureLabel: string;
  samples: number;
  averageSeconds: number;
};

export type ExitAnalyticsRow = {
  path: string;
  exits: number;
};

export type CtrDashboardData = {
  operators: CtrMetricRow[];
  fixtures: CtrMetricRow[];
  leagues: CtrMetricRow[];
  markets: CtrMetricRow[];
  countries: CountryIntelligenceRow[];
  sections: SectionAnalyticsRow[];
  funnel: FunnelStepRow[];
  scrollDepth: ScrollDepthRow[];
  timeOnFixture: TimeOnFixtureRow[];
  exits: ExitAnalyticsRow[];
};

function property(
  event: { properties?: Record<string, string | number | boolean | null> },
  key: string
): string {
  const value = event.properties?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function propertyNumber(
  event: { properties?: Record<string, string | number | boolean | null> },
  key: string
): number | null {
  const value = event.properties?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toCtr(impressions: number, clicks: number): number {
  return impressions ? (clicks / impressions) * 100 : 0;
}

type MutableMetric = { key: string; label: string; impressions: number; clicks: number; redirects: number };

type CountryBucket = {
  country: string;
  sessions: Set<string>;
  impressions: number;
  clicks: number;
  redirects: number;
  operators: Map<string, number>;
  leagues: Map<string, number>;
  markets: Map<string, number>;
};

function bump(
  map: Map<string, MutableMetric>,
  key: string,
  label: string,
  field: "impressions" | "clicks" | "redirects"
): void {
  const row = map.get(key) ?? { key, label, impressions: 0, clicks: 0, redirects: 0 };
  row[field] += 1;
  map.set(key, row);
}

function finalizeMetrics(map: Map<string, MutableMetric>): CtrMetricRow[] {
  return [...map.values()]
    .map((row) => ({ ...row, ctr: toCtr(row.impressions, row.clicks) }))
    .sort((left, right) => right.clicks - left.clicks || right.impressions - left.impressions);
}

function topKey(map: Map<string, number>): string {
  let bestKey = "—";
  let bestCount = -1;
  for (const [key, count] of map) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  return bestKey;
}

function countryBucket(map: Map<string, CountryBucket>, country: string): CountryBucket {
  const existing = map.get(country);
  if (existing) return existing;
  const created: CountryBucket = {
    country,
    sessions: new Set(),
    impressions: 0,
    clicks: 0,
    redirects: 0,
    operators: new Map(),
    leagues: new Map(),
    markets: new Map(),
  };
  map.set(country, created);
  return created;
}

function bumpCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function buildCtrDashboard(events: readonly AnalyticsEvent[]): CtrDashboardData {
  const operators = new Map<string, MutableMetric>();
  const fixtures = new Map<string, MutableMetric>();
  const leagues = new Map<string, MutableMetric>();
  const markets = new Map<string, MutableMetric>();
  const countries = new Map<string, CountryBucket>();
  const sections = new Map<string, { section: string; impressions: number; clicks: number }>();
  const scrollByDepth = new Map<number, Set<string>>();
  const timeByFixture = new Map<number, { fixtureLabel: string; totalSeconds: number; samples: number }>();
  const exits = new Map<string, number>();

  let funnelSection = 0;
  let funnelFixtureView = 0;
  let funnelOperatorImpression = 0;
  let funnelOperatorClick = 0;
  let funnelRedirect = 0;

  for (const event of events) {
    const league = property(event, "league") || "—";
    const fixtureLabel = property(event, "fixture_label") || (event.fixture_id ? String(event.fixture_id) : "—");
    const market = event.market || "—";
    const country = event.country || property(event, "resolved_country") || "—";
    const bucket = countryBucket(countries, country);
    bucket.sessions.add(event.session_id);

    if (event.event_name === "operator_impression" && event.operator_slug) {
      bump(operators, event.operator_slug, event.operator_slug, "impressions");
      bump(leagues, league, league, "impressions");
      bump(markets, market, market, "impressions");
      bucket.impressions += 1;
      bumpCount(bucket.operators, event.operator_slug);
      bumpCount(bucket.leagues, league);
      bumpCount(bucket.markets, market);
      funnelOperatorImpression += 1;
    }

    if (event.event_name === "fixture_impression" && event.fixture_id) {
      bump(fixtures, String(event.fixture_id), fixtureLabel, "impressions");
    }

    if (event.event_name === "operator_click" && event.operator_slug) {
      bump(operators, event.operator_slug, event.operator_slug, "clicks");
      if (event.fixture_id) bump(fixtures, String(event.fixture_id), fixtureLabel, "clicks");
      bump(leagues, league, league, "clicks");
      bump(markets, market, market, "clicks");
      bucket.clicks += 1;
      bumpCount(bucket.operators, event.operator_slug);
      bumpCount(bucket.leagues, league);
      bumpCount(bucket.markets, market);
      funnelOperatorClick += 1;
    }

    if (event.event_name === "go_redirect" && event.operator_slug) {
      bump(operators, event.operator_slug, event.operator_slug, "redirects");
      if (event.fixture_id) bump(fixtures, String(event.fixture_id), fixtureLabel, "redirects");
      bump(leagues, league, league, "redirects");
      bump(markets, market, market, "redirects");
      bucket.redirects += 1;
      funnelRedirect += 1;
    }

    if (event.event_name === "fixture_view") {
      funnelFixtureView += 1;
    }

    if (event.event_name === "homepage_section_impression") {
      const section = property(event, "section") || "unknown";
      const row = sections.get(section) ?? { section, impressions: 0, clicks: 0 };
      row.impressions += 1;
      sections.set(section, row);
      funnelSection += 1;
    }

    if (event.event_name === "homepage_section_click") {
      const section = property(event, "section") || "unknown";
      const row = sections.get(section) ?? { section, impressions: 0, clicks: 0 };
      row.clicks += 1;
      sections.set(section, row);
    }

    if (event.event_name === "scroll_depth") {
      const depth = propertyNumber(event, "depth");
      if (depth !== null) {
        const sessions = scrollByDepth.get(depth) ?? new Set<string>();
        sessions.add(event.session_id);
        scrollByDepth.set(depth, sessions);
      }
    }

    if (event.event_name === "fixture_time_spent" && event.fixture_id) {
      const seconds = propertyNumber(event, "seconds");
      if (seconds !== null && seconds >= 0) {
        const current = timeByFixture.get(event.fixture_id) ?? {
          fixtureLabel,
          totalSeconds: 0,
          samples: 0,
        };
        current.totalSeconds += seconds;
        current.samples += 1;
        if (fixtureLabel !== "—") current.fixtureLabel = fixtureLabel;
        timeByFixture.set(event.fixture_id, current);
      }
    }

    if (event.event_name === "page_exit") {
      const path = property(event, "pathname") || "—";
      exits.set(path, (exits.get(path) ?? 0) + 1);
    }
  }

  const funnelCounts = [
    { step: "homepage_section", count: funnelSection },
    { step: "fixture_view", count: funnelFixtureView },
    { step: "operator_impression", count: funnelOperatorImpression },
    { step: "operator_click", count: funnelOperatorClick },
    { step: "go_redirect", count: funnelRedirect },
  ];

  return {
    operators: finalizeMetrics(operators),
    fixtures: finalizeMetrics(fixtures),
    leagues: finalizeMetrics(leagues),
    markets: finalizeMetrics(markets),
    countries: [...countries.values()]
      .map((row) => ({
        country: row.country,
        sessions: row.sessions.size,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: toCtr(row.impressions, row.clicks),
        redirects: row.redirects,
        topOperator: topKey(row.operators),
        topLeague: topKey(row.leagues),
        topMarket: topKey(row.markets),
      }))
      .sort((left, right) => right.clicks - left.clicks || right.impressions - left.impressions),
    sections: [...sections.values()]
      .map((row) => ({ ...row, ctr: toCtr(row.impressions, row.clicks) }))
      .sort((left, right) => right.clicks - left.clicks || right.impressions - left.impressions),
    funnel: funnelCounts.map((row, index) => ({
      step: row.step,
      count: row.count,
      conversionFromPrevious:
        index === 0 || funnelCounts[index - 1].count === 0
          ? null
          : (row.count / funnelCounts[index - 1].count) * 100,
    })),
    scrollDepth: [...scrollByDepth.entries()]
      .map(([depth, sessions]) => ({ depth, sessions: sessions.size }))
      .sort((left, right) => left.depth - right.depth),
    timeOnFixture: [...timeByFixture.entries()]
      .map(([fixtureId, value]) => ({
        fixtureId,
        fixtureLabel: value.fixtureLabel,
        samples: value.samples,
        averageSeconds: value.samples ? value.totalSeconds / value.samples : 0,
      }))
      .sort((left, right) => right.averageSeconds - left.averageSeconds),
    exits: [...exits.entries()]
      .map(([path, count]) => ({ path, exits: count }))
      .sort((left, right) => right.exits - left.exits),
  };
}

export async function getCtrDashboardData(): Promise<CtrDashboardData> {
  return buildCtrDashboard(await readTrackedAnalyticsEvents());
}
