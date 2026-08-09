import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { aggregateRecords } from "../lib/archive/aggregate";
import { predictionsEn } from "../lib/translations/predictionsEn";
import { ARCHIVE_ANALYTICS_EVENTS } from "../lib/archive/analytics";
import {
  archiveDayPath,
  archiveIndexPath,
  methodologyPath,
} from "../lib/archive/links";
import { projectDailyArchive } from "../lib/archive/project";
import {
  filterArchiveRecords,
  paginateArchiveRecords,
  parseArchiveFilters,
} from "../lib/archive/query";
import {
  archiveDayWebPageLd,
  archiveHubBreadcrumbLd,
  archiveHubWebPageLd,
  methodologyWebPageLd,
} from "../lib/archive/schema";
import type { ArchivePredictionRecord } from "../lib/archive/types";
import type { DailyArchive } from "../lib/footystats/dailyArchive";
import { analyticsEventNames } from "../lib/analytics/types";
import { expectedSitemapUrls } from "../lib/crawl-quality/sitemap";
import { buildPublicRouteInventory } from "../lib/crawl-quality/inventory";

const root = process.cwd();

function sampleArchive(): DailyArchive {
  return {
    date: "2026-07-20",
    savedAt: "2026-07-20T12:00:00.000Z",
    summary: {
      fh: { total: 2, won: 1, lost: 1, pending: 0, postponed: 0 },
      over15: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
      over25: { total: 1, won: 0, lost: 0, pending: 1, postponed: 0 },
      sh: { total: 0, won: 0, lost: 0, pending: 0, postponed: 0 },
    },
    fh: [
      {
        matchId: 101,
        homeTeam: "Alpha FC",
        awayTeam: "Beta United",
        competition: "Test League",
        country: "England",
        countryCode: "GB",
        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        kickoffTime: 1721476800,
        kickoff: "15:00",
        over15Pct: 80,
        fhOver05Pct: 72,
        over25Pct: 55,
        shOver05Pct: 60,
        status: "complete",
        isLive: false,
        isFinished: true,
        homeScore: 1,
        awayScore: 0,
        minute: 90,
        highlightPct: 72,
        listResult: "won",
      },
      {
        matchId: 102,
        homeTeam: "Gamma City",
        awayTeam: "Delta Town",
        competition: "Test League",
        country: "England",
        countryCode: "GB",
        flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        kickoffTime: 1721484000,
        kickoff: "17:00",
        over15Pct: 70,
        fhOver05Pct: 61,
        over25Pct: 40,
        shOver05Pct: 50,
        status: "complete",
        isLive: false,
        isFinished: true,
        homeScore: 0,
        awayScore: 0,
        minute: 90,
        highlightPct: 61,
        listResult: "lost",
      },
    ],
    over15: [],
    over25: [
      {
        matchId: 103,
        homeTeam: "Echo SC",
        awayTeam: "Foxtrot",
        competition: "Other League",
        country: "Spain",
        countryCode: "ES",
        flag: "🇪🇸",
        kickoffTime: 1721491200,
        kickoff: "19:00",
        over15Pct: 75,
        fhOver05Pct: 50,
        over25Pct: 66,
        shOver05Pct: 40,
        status: "incomplete",
        isLive: false,
        isFinished: false,
        homeScore: 0,
        awayScore: 0,
        minute: 0,
        highlightPct: 66,
        listResult: "pending",
      },
    ],
    sh: [],
  };
}

test("projectDailyArchive exposes settlement history without inventing odds", () => {
  const rows = projectDailyArchive(sampleArchive(), "en");
  assert.equal(rows.length, 3);
  assert.ok(rows.some((r) => r.status === "won"));
  assert.ok(rows.some((r) => r.status === "lost"));
  assert.ok(rows.some((r) => r.status === "pending"));
  for (const row of rows) {
    assert.equal(row.originalOdds, null);
    assert.equal(row.unitProfit, null);
    assert.ok(row.matchHref.includes("/fixtures/"));
    assert.ok(row.evidenceSummary.length >= 2);
    assert.ok(row.settlementReason.length > 0);
    assert.ok(row.publishedAt);
  }
});

test("aggregateRecords includes losses and never fabricates ROI or average odds", () => {
  const rows = projectDailyArchive(sampleArchive(), "en");
  const metrics = aggregateRecords(rows, "sample");
  assert.equal(metrics.won, 1);
  assert.equal(metrics.lost, 1);
  assert.equal(metrics.pendingPredictions, 1);
  assert.equal(metrics.hitRatePct, 50);
  assert.equal(metrics.averageOdds, null);
  assert.match(metrics.sampleNote, /Losses are included/i);
  assert.doesNotMatch(metrics.sampleNote, /\bROI\b.*\d/);
});

test("archive filters and pagination", () => {
  const rows = projectDailyArchive(sampleArchive(), "en");
  const lost = filterArchiveRecords(rows, { status: "lost" });
  assert.equal(lost.length, 1);
  assert.equal(lost[0]?.homeTeam, "Gamma City");

  const team = filterArchiveRecords(rows, { team: "alpha" });
  assert.equal(team.length, 1);

  const market = filterArchiveRecords(rows, { market: "over25" });
  assert.equal(market.length, 1);

  const page = paginateArchiveRecords(rows, 1, 2);
  assert.equal(page.records.length, 2);
  assert.equal(page.pageCount, 2);
  assert.equal(page.total, 3);

  const parsed = parseArchiveFilters({
    market: "fh",
    status: "won",
    q: "Alpha",
  });
  assert.equal(parsed.market, "fh");
  assert.equal(parsed.status, "won");
  assert.equal(parsed.q, "Alpha");
});

test("archive and methodology routes + schemas exist", () => {
  const required = [
    "app/[locale]/archive/page.tsx",
    "app/[locale]/archive/[date]/page.tsx",
    "app/[locale]/methodology/page.tsx",
    "components/archive/ArchiveTable.tsx",
    "components/archive/ArchiveFilters.tsx",
    "components/archive/TransparencyDashboard.tsx",
    "lib/archive/types.ts",
    "lib/archive/load.ts",
    "docs/transparency.md",
    "docs/methodology.md",
    "docs/sprint-18g-completion-report.md",
  ];
  for (const rel of required) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }

  assert.equal(archiveIndexPath("en"), "/en/archive");
  assert.equal(archiveDayPath("en", "2026-07-20"), "/en/archive/2026-07-20");
  assert.equal(methodologyPath("en"), "/en/methodology");

  const hub = archiveHubWebPageLd({
    locale: "en",
    title: "Archive",
    description: "desc",
  });
  assert.equal(hub["@type"], "CollectionPage");
  const crumbs = archiveHubBreadcrumbLd("en");
  assert.equal(crumbs["@type"], "BreadcrumbList");
  const method = methodologyWebPageLd({
    locale: "en",
    title: "Methodology",
    description: "desc",
  });
  assert.equal(method["@type"], "WebPage");
  const day = archiveDayWebPageLd({
    locale: "en",
    date: "2026-07-20",
    title: "Day",
    description: "desc",
    events: [
      {
        name: "Alpha FC vs Beta United",
        startDate: "2026-07-20T15:00:00.000Z",
        url: "/en/fixtures/101",
      },
    ],
  });
  assert.equal(day["@type"], "CollectionPage");
  assert.ok(day.mainEntity);
});

test("transparency dashboard copy forbids fabricated profitability claims", () => {
  const dash = readFileSync(
    path.join(root, "components/archive/TransparencyDashboard.tsx"),
    "utf8"
  );
  /*
   * Re-pinned after the Family E form-guide conversion: the honesty copy moved
   * into the dictionary (`arcOddsUnavailable`), so the pin follows it — the
   * component must still render the stated absence, and the English string
   * must still say the figures are unavailable rather than fabricating them.
   */
  assert.match(dash, /arcOddsUnavailable/);
  assert.match(
    predictionsEn.arcOddsUnavailable,
    /unavailable until publication odds are durably stored/
  );
  assert.doesNotMatch(dash, /guaranteed/i);
});

test("archive analytics events are registered", () => {
  for (const name of ARCHIVE_ANALYTICS_EVENTS) {
    assert.ok(
      (analyticsEventNames as readonly string[]).includes(name),
      `missing analytics event ${name}`
    );
  }
});

test("sitemap and crawl inventory include archive + methodology hubs", () => {
  const urls = expectedSitemapUrls();
  assert.ok(urls.some((u) => u.endsWith("/en/archive")));
  assert.ok(urls.some((u) => u.endsWith("/en/methodology")));
  const inventory = buildPublicRouteInventory();
  assert.ok(inventory.some((r) => r.path === "/archive"));
  assert.ok(inventory.some((r) => r.path === "/methodology"));
});

test("internal trust links point to archive and methodology pages", () => {
  const footer = readFileSync(path.join(root, "components/Footer.tsx"), "utf8");
  assert.match(footer, /\/\$\{locale\}\/methodology/);
  assert.match(footer, /\/\$\{locale\}\/archive/);
  const trust = readFileSync(
    path.join(root, "lib/homepage/trustPerformance.ts"),
    "utf8"
  );
  assert.match(trust, /\/methodology/);
  assert.match(trust, /\/archive/);
  assert.doesNotMatch(trust, /#prediction-archive/);
});

test("archive table remains accessible and loss-visible", () => {
  const table = readFileSync(
    path.join(root, "components/archive/ArchiveTable.tsx"),
    "utf8"
  );
  assert.match(table, /<caption/);
  assert.match(table, /scope=["']col["']/);
  assert.match(table, /Settlement/);
  const filters = readFileSync(
    path.join(root, "components/archive/ArchiveFilters.tsx"),
    "utf8"
  );
  // Re-pinned: the label is a dictionary string now — the mechanism must stay.
  assert.match(filters, /aria-label=\{/);
  assert.match(filters, /archive_filter_used/);
});

test("aggregate never drops losing rows from totals", () => {
  const records: ArchivePredictionRecord[] = [
    {
      id: "a",
      date: "2026-07-20",
      matchId: 1,
      homeTeam: "A",
      awayTeam: "B",
      competition: "L",
      country: null,
      countryCode: null,
      marketKey: "over25",
      marketLabel: "Over 2.5",
      selectionLabel: "Over 2.5",
      confidence: 60,
      kickoffAt: null,
      publishedAt: null,
      status: "lost",
      scoreLabel: "0–0",
      settlementReason: "lost",
      evidenceSummary: ["x"],
      matchHref: "/en/fixtures/1",
      originalOdds: null,
      unitProfit: null,
    },
    {
      id: "b",
      date: "2026-07-20",
      matchId: 2,
      homeTeam: "C",
      awayTeam: "D",
      competition: "L",
      country: null,
      countryCode: null,
      marketKey: "over25",
      marketLabel: "Over 2.5",
      selectionLabel: "Over 2.5",
      confidence: 70,
      kickoffAt: null,
      publishedAt: null,
      status: "won",
      scoreLabel: "3–1",
      settlementReason: "won",
      evidenceSummary: ["x"],
      matchHref: "/en/fixtures/2",
      originalOdds: null,
      unitProfit: null,
    },
  ];
  const metrics = aggregateRecords(records, "t");
  assert.equal(metrics.totalPredictions, 2);
  assert.equal(metrics.lost, 1);
  assert.equal(metrics.won, 1);
});
