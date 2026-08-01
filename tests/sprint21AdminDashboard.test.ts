import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildBuilderDashboard,
  buildMarketAnalysis,
  buildOverview,
  buildPredictionQuality,
  dashboardToCsv,
  dashboardToJson,
  hitRatePct,
  metricNumber,
  parseAdminFilters,
} from "../lib/admin-dashboard";
import type { AdminDataSnapshot } from "../lib/admin-dashboard/queries";
import type { ArchivePredictionRecord } from "../lib/archive/types";
import type { AnalyticsEvent } from "../lib/analytics/types";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function record(
  partial: Partial<ArchivePredictionRecord> & {
    id: string;
    date: string;
    marketKey: ArchivePredictionRecord["marketKey"];
    status: ArchivePredictionRecord["status"];
  }
): ArchivePredictionRecord {
  return {
    matchId: 1,
    homeTeam: "Home",
    awayTeam: "Away",
    competition: "Test League",
    country: "England",
    countryCode: "GB",
    marketLabel: "Over 1.5",
    selectionLabel: "Over 1.5",
    confidence: 80,
    kickoffAt: null,
    publishedAt: `${partial.date}T12:00:00.000Z`,
    scoreLabel: "",
    settlementReason: "",
    evidenceSummary: [],
    matchHref: "/en/fixtures/1",
    originalOdds: null,
    unitProfit: null,
    ...partial,
  };
}

function snap(records: ArchivePredictionRecord[], events: AnalyticsEvent[] = []): AdminDataSnapshot {
  const dates = [...new Set(records.map((r) => r.date))].sort();
  return {
    loadedAt: "2026-07-26T00:00:00.000Z",
    dates,
    records,
    events,
    window: { from: dates[0] ?? "2026-07-01", to: dates[dates.length - 1] ?? "2026-07-26" },
  };
}

const filters = parseAdminFilters({ locale: "en", dateLimit: "30" });

test("sprint 21 admin dashboard files exist", () => {
  for (const rel of [
    "lib/admin-dashboard/contracts.ts",
    "lib/admin-dashboard/aggregations.ts",
    "lib/admin-dashboard/service.ts",
    "app/api/admin/dashboard/route.ts",
    "app/api/admin/dashboard/export/route.ts",
    "app/admin/dashboard/page.tsx",
    "app/admin/predictions/page.tsx",
    "app/admin/builder/page.tsx",
    "app/admin/operators/page.tsx",
    "app/admin/markets/page.tsx",
    "app/admin/leagues/page.tsx",
    "app/admin/system/page.tsx",
    "docs/admin-dashboard.md",
    "docs/admin-metrics.md",
    "docs/sprint-21-completion-report.md",
  ]) {
    assert.ok(existsSync(path.join(root, rel)), rel);
  }
});

test("hit rate and unavailable metrics are honest", () => {
  assert.equal(hitRatePct(3, 1), 75);
  assert.equal(hitRatePct(0, 0), null);
  const m = metricNumber(null, "Publication odds not archived");
  assert.equal(m.available, false);
  if (!m.available) assert.match(m.reason, /odds/i);
});

test("overview aggregates archive records without inventing odds", () => {
  const data = buildOverview(
    snap([
      record({ id: "1", date: "2026-07-20", marketKey: "over15", status: "won" }),
      record({ id: "2", date: "2026-07-20", marketKey: "over25", status: "lost" }),
      record({ id: "3", date: "2026-07-21", marketKey: "fh", status: "pending" }),
    ]),
    filters
  );
  assert.equal(data.publishedPredictions.available && data.publishedPredictions.value, 3);
  assert.equal(data.won.available && data.won.value, 1);
  assert.equal(data.lost.available && data.lost.value, 1);
  assert.equal(data.hitRate.available && data.hitRate.value, 50);
  assert.equal(data.averageOdds.available, false);
});

test("prediction quality filters by market via snapshot records", () => {
  const data = buildPredictionQuality(
    snap([
      record({ id: "1", date: "2026-07-20", marketKey: "over15", status: "won", confidence: 90 }),
      record({ id: "2", date: "2026-07-20", marketKey: "over25", status: "lost", confidence: 70 }),
    ]),
    filters
  );
  assert.ok(data.byMarket.length >= 2);
  assert.equal(data.averageOdds.available, false);
});

test("market analysis marks unsupported markets unavailable", () => {
  const data = buildMarketAnalysis(snap([]), filters);
  const btts = data.markets.find((m) => m.market === "btts");
  assert.ok(btts);
  assert.equal(btts?.supported, false);
});

test("builder dashboard counts real analytics events only", () => {
  const events: AnalyticsEvent[] = [
    {
      event_name: "acca_builder_generation_started",
      fixture_id: null,
      market: null,
      operator_slug: null,
      country: null,
      country_source: null,
      locale: "en",
      device: "desktop",
      referrer: null,
      timestamp: "2026-07-20T10:00:00.000Z",
      session_id: "s1",
      user_id: null,
    },
    {
      event_name: "acca_builder_generation_succeeded",
      fixture_id: null,
      market: null,
      operator_slug: null,
      country: null,
      country_source: null,
      locale: "en",
      device: "desktop",
      referrer: null,
      timestamp: "2026-07-20T10:00:01.000Z",
      session_id: "s1",
      user_id: null,
      properties: { legs: 3 },
    },
  ];
  const data = buildBuilderDashboard(snap([], events), filters);
  assert.equal(data.successful.available && data.successful.value, 1);
  assert.equal(data.averageGenerationTime.available, false);
  assert.equal(data.averageLegs.available && data.averageLegs.value, 3);
});

test("export csv/json omit internal signed hrefs and work", () => {
  const payload = {
    redirects: { available: true, value: 2 },
    nested: { signedHref: "/go/secret", ok: true },
  };
  const csv = dashboardToCsv("operators", payload);
  assert.match(csv, /redirects/);
  assert.doesNotMatch(csv, /signedHref/);
  const json = dashboardToJson("operators", payload);
  assert.doesNotMatch(json, /signedHref/);
});

test("admin API routes require auth helper", () => {
  const api = readFileSync(
    path.join(root, "app/api/admin/dashboard/route.ts"),
    "utf8"
  );
  assert.match(api, /requireAdminAccess/);
  assert.match(api, /noarchive/);
  const exportRoute = readFileSync(
    path.join(root, "app/api/admin/dashboard/export/route.ts"),
    "utf8"
  );
  assert.match(exportRoute, /dashboardToCsv/);
});

test("middleware marks admin with noarchive", () => {
  const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
  assert.match(mw, /noindex, nofollow, noarchive/);
});

test("parseAdminFilters accepts league alias and season field", () => {
  const f = parseAdminFilters({
    league: "Premier",
    season: "2025/26",
    market: "over15",
  });
  assert.equal(f.competition, "Premier");
  assert.equal(f.season, "2025/26");
  assert.equal(f.market, "over15");
});

test("requireAdminAccess denies unauthenticated dashboard API shape", () => {
  const guard = readFileSync(
    path.join(root, "lib/security/requireAdminAccess.ts"),
    "utf8"
  );
  assert.match(guard, /evaluateAdminAccess/);
  assert.match(guard, /noarchive/);
  const gate = readFileSync(
    path.join(root, "components/admin-dashboard/AdminGate.tsx"),
    "utf8"
  );
  assert.match(gate, /AdminLoginForm/);
  assert.match(gate, /route_disabled/);
});
