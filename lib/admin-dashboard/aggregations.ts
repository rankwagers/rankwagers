import type { ArchivePredictionRecord } from "@/lib/archive/types";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import type {
  AdminDashboardFilters,
  BuilderDashboard,
  ChartPoint,
  LeagueAnalysisDashboard,
  MarketAnalysisDashboard,
  OperatorDashboard,
  OverviewDashboard,
  PredictionQualityDashboard,
  SearchDashboard,
  SystemHealthDashboard,
} from "./contracts";
import { avg, hitRatePct, metricNumber, metricString, pct } from "./formatters";
import type { AdminDataSnapshot } from "./queries";

const ARCHIVE_MARKETS = ["over15", "over25", "fh", "sh"] as const;
const UNSUPPORTED_MARKETS = [
  { key: "btts", label: "BTTS" },
  { key: "home_win", label: "Home Win" },
  { key: "away_win", label: "Away Win" },
  { key: "draw", label: "Draw" },
] as const;

function dayKey(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

function countEvents(
  events: readonly AnalyticsEvent[],
  names: readonly string[]
): number {
  const set = new Set(names);
  return events.filter((e) => set.has(e.event_name)).length;
}

function dailySeries(
  keys: string[],
  countFn: (day: string) => number | null
): ChartPoint[] {
  return keys.map((label) => ({ label, value: countFn(label) }));
}

function confidenceBuckets(records: ArchivePredictionRecord[]): ChartPoint[] {
  const buckets = [
    { label: "50-59", min: 50, max: 59 },
    { label: "60-69", min: 60, max: 69 },
    { label: "70-79", min: 70, max: 79 },
    { label: "80-89", min: 80, max: 89 },
    { label: "90-100", min: 90, max: 100 },
  ];
  return buckets.map((b) => ({
    label: b.label,
    value: records.filter(
      (r) =>
        r.confidence != null &&
        r.confidence >= b.min &&
        r.confidence <= b.max
    ).length,
  }));
}

function settleCounts(records: ArchivePredictionRecord[]) {
  let won = 0;
  let lost = 0;
  let voided = 0;
  let pending = 0;
  for (const r of records) {
    if (r.status === "won") won += 1;
    else if (r.status === "lost") lost += 1;
    else if (r.status === "void") voided += 1;
    else pending += 1;
  }
  return { won, lost, voided, pending };
}

export function buildOverview(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): OverviewDashboard {
  const { records, events, dates, window } = snap;
  const { won, lost, voided, pending } = settleCounts(records);
  const today = new Date().toISOString().slice(0, 10);
  const last7 = dates.filter((d) => d >= daysBefore(today, 7));
  const last30 = dates.filter((d) => d >= daysBefore(today, 30));
  const todayCount = records.filter((r) => r.date === today).length;
  const last7Count = records.filter((r) => last7.includes(r.date)).length;
  const last30Count = records.filter((r) => last30.includes(r.date)).length;
  const confidences = records
    .map((r) => r.confidence)
    .filter((n): n is number => n != null && Number.isFinite(n));

  const sortedDates = [...dates].sort();
  const notes = [
    "Hit rate uses settled wins and losses only.",
    "Average odds and ROI are Unavailable until publication odds are archived.",
    "Builder/search metrics come from durable analytics log events when present.",
    ...(filters.season
      ? [
          `Season filter "${filters.season}" is not applied — daily archives do not store season.`,
        ]
      : []),
  ];

  return {
    generatedAt: snap.loadedAt,
    filters,
    publishedPredictions: metricNumber(records.length),
    settledPredictions: metricNumber(won + lost),
    won: metricNumber(won),
    lost: metricNumber(lost),
    voided: metricNumber(voided),
    hitRate: metricNumber(hitRatePct(won, lost), "No settled sample"),
    pending: metricNumber(pending),
    todayPredictions: metricNumber(todayCount),
    last7Days: metricNumber(last7Count),
    last30Days: metricNumber(last30Count),
    averageConfidence: metricNumber(avg(confidences), "No confidence values"),
    averageOdds: metricNumber(null, "Publication odds not archived"),
    dataFreshness: metricString(
      records.length
        ? `Archives ${window.from} → ${window.to} (${dates.length} days)`
        : null,
      "No archive files in window"
    ),
    builderUsage: metricNumber(
      countEvents(events, [
        "acca_builder_generation_started",
        "acca_builder_generation_succeeded",
        "combo_generate_start",
      ])
    ),
    operatorClicks: metricNumber(
      countEvents(events, ["operator_click", "go_redirect", "affiliate_redirect_completed"])
    ),
    archiveGrowthDays: metricNumber(dates.length),
    searchUsage: metricNumber(
      countEvents(events, ["search", "search_query", "search_open"])
    ),
    errors: metricNumber(
      countEvents(events, [
        "acca_builder_generation_failed",
        "affiliate_redirect_failed",
        "combo_generate_failure",
      ])
    ),
    charts: {
      dailyPredictions: dailySeries(sortedDates, (d) =>
        records.filter((r) => r.date === d).length
      ),
      dailyHitRate: dailySeries(sortedDates, (d) => {
        const day = records.filter((r) => r.date === d);
        const c = settleCounts(day);
        return hitRatePct(c.won, c.lost);
      }),
      builderGenerations: dailySeries(sortedDates, (d) =>
        events.filter(
          (e) =>
            dayKey(e.timestamp) === d &&
            (e.event_name === "acca_builder_generation_succeeded" ||
              e.event_name === "combo_generate_success")
        ).length
      ),
      operatorClicks: dailySeries(sortedDates, (d) =>
        events.filter(
          (e) =>
            dayKey(e.timestamp) === d &&
            (e.event_name === "operator_click" || e.event_name === "go_redirect")
        ).length
      ),
    },
    notes,
  };
}

export function buildPredictionQuality(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): PredictionQualityDashboard {
  const records = snap.records;
  const { won, lost, voided } = settleCounts(records);
  const confidences = records
    .map((r) => r.confidence)
    .filter((n): n is number => n != null);

  const byMarketMap = new Map<string, ArchivePredictionRecord[]>();
  for (const r of records) {
    const list = byMarketMap.get(r.marketKey) ?? [];
    list.push(r);
    byMarketMap.set(r.marketKey, list);
  }

  const sortedDates = [...snap.dates].sort();
  return {
    generatedAt: snap.loadedAt,
    filters,
    won: metricNumber(won),
    lost: metricNumber(lost),
    voided: metricNumber(voided),
    hitRate: metricNumber(hitRatePct(won, lost), "No settled sample"),
    averageConfidence: metricNumber(avg(confidences), "No confidence values"),
    averageOdds: metricNumber(null, "Publication odds not archived"),
    averagePublicationDelay: metricNumber(
      null,
      "Publication delay requires kickoff vs publish timestamps not fully available"
    ),
    averageSettlementDelay: metricNumber(
      null,
      "Settlement delay not tracked in daily archives"
    ),
    trend: dailySeries(sortedDates, (d) => {
      const c = settleCounts(records.filter((r) => r.date === d));
      return hitRatePct(c.won, c.lost);
    }),
    byMarket: [...byMarketMap.entries()].map(([market, rows]) => {
      const c = settleCounts(rows);
      const conf = rows
        .map((r) => r.confidence)
        .filter((n): n is number => n != null);
      return {
        market,
        sampleSize: rows.length,
        won: c.won,
        lost: c.lost,
        voided: c.voided,
        hitRate: hitRatePct(c.won, c.lost),
        averageConfidence: avg(conf),
      };
    }),
    notes: [
      "ROI is never calculated without complete historical odds.",
      "Filters: date window, competition, country, market applied server-side.",
      filters.predictionSource
        ? `Prediction source filter "${filters.predictionSource}" is not distinct in archives (single list source).`
        : "Prediction source: qualified daily lists only.",
    ],
  };
}

export function buildMarketAnalysis(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): MarketAnalysisDashboard {
  const markets = [
    ...ARCHIVE_MARKETS.map((key) => {
      const rows = snap.records.filter((r) => r.marketKey === key);
      const c = settleCounts(rows);
      const conf = rows
        .map((r) => r.confidence)
        .filter((n): n is number => n != null);
      const sortedDates = [...snap.dates].sort();
      return {
        market: key,
        sampleSize: rows.length,
        won: c.won,
        lost: c.lost,
        voided: c.voided,
        hitRate: hitRatePct(c.won, c.lost),
        averageConfidence: avg(conf),
        confidenceDistribution: confidenceBuckets(rows),
        trend: dailySeries(sortedDates, (d) => {
          const day = settleCounts(rows.filter((r) => r.date === d));
          return hitRatePct(day.won, day.lost);
        }),
        supported: true,
      };
    }),
    ...UNSUPPORTED_MARKETS.map((m) => ({
      market: m.key,
      sampleSize: 0,
      won: 0,
      lost: 0,
      voided: 0,
      hitRate: null as number | null,
      averageConfidence: null as number | null,
      confidenceDistribution: [] as ChartPoint[],
      trend: [] as ChartPoint[],
      supported: false,
      note: "Unavailable — market not present in daily list archives",
    })),
  ];

  return {
    generatedAt: snap.loadedAt,
    filters,
    markets,
    notes: [
      "First Half / Second Half map to fh / sh archive markets.",
      "BTTS and 1X2 rows are Unavailable until archived from match-detail publications.",
    ],
  };
}

export function buildLeagueAnalysis(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): LeagueAnalysisDashboard {
  const byLeague = new Map<string, ArchivePredictionRecord[]>();
  for (const r of snap.records) {
    const list = byLeague.get(r.competition) ?? [];
    list.push(r);
    byLeague.set(r.competition, list);
  }

  const leagues = [...byLeague.entries()].map(([league, rows]) => {
    const c = settleCounts(rows);
    const conf = rows
      .map((r) => r.confidence)
      .filter((n): n is number => n != null);
    return {
      league,
      published: rows.length,
      won: c.won,
      lost: c.lost,
      voided: c.voided,
      hitRate: hitRatePct(c.won, c.lost),
      averageConfidence: avg(conf),
      builderUsage: metricNumber(
        null,
        "Builder usage not attributed per league in event properties"
      ),
      operatorClicks: metricNumber(
        null,
        "Operator clicks not attributed per league in event properties"
      ),
    };
  });

  const withHit = leagues.filter((l) => l.hitRate != null && l.won + l.lost >= 5);
  const topLeagues = [...withHit]
    .sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0))
    .slice(0, 5)
    .map((l) => l.league);
  const worstLeagues = [...withHit]
    .sort((a, b) => (a.hitRate ?? 0) - (b.hitRate ?? 0))
    .slice(0, 5)
    .map((l) => l.league);
  const mostActive = [...leagues]
    .sort((a, b) => b.published - a.published)
    .slice(0, 5)
    .map((l) => l.league);

  return {
    generatedAt: snap.loadedAt,
    filters,
    leagues: leagues.sort((a, b) => b.published - a.published),
    topLeagues,
    worstLeagues,
    mostActive,
    notes: [
      "Top/worst leagues require at least 5 settled predictions.",
      "Per-league builder/operator attribution is Unavailable without tagged events.",
    ],
  };
}

export function buildBuilderDashboard(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): BuilderDashboard {
  let events = snap.events.filter((e) =>
    String(e.event_name).startsWith("acca_builder_") ||
    String(e.event_name).startsWith("combo_")
  );
  if (filters.riskMode) {
    events = events.filter(
      (e) =>
        String(e.properties?.riskMode ?? e.properties?.risk_mode ?? "") ===
        filters.riskMode
    );
  }

  const started = countEvents(events, [
    "acca_builder_generation_started",
    "combo_generate_start",
  ]);
  const success = countEvents(events, [
    "acca_builder_generation_succeeded",
    "combo_generate_success",
  ]);
  const failed = countEvents(events, [
    "acca_builder_generation_failed",
    "combo_generate_failure",
  ]);

  const riskModes = ["conservative", "balanced", "aggressive"] as const;
  const riskModeDistribution: ChartPoint[] = riskModes.map((mode) => ({
    label: mode,
    value: events.filter(
      (e) =>
        e.event_name === "acca_builder_risk_mode_selected" &&
        String(e.properties?.riskMode ?? "") === mode
    ).length,
  }));

  const sortedDates = [...snap.dates].sort();
  const notes: string[] = [];
  if (!started && !success) {
    notes.push("No builder generation events in the analytics log for this window.");
  }
  notes.push(
    "Average generation time / candidate pools Unavailable unless recorded in event properties."
  );

  return {
    generatedAt: snap.loadedAt,
    filters,
    generations: metricNumber(started || success),
    successful: metricNumber(success),
    failed: metricNumber(failed),
    averageGenerationTime: metricNumber(
      null,
      "Generation duration not recorded in analytics events"
    ),
    averageLegs: metricNumber(
      avg(
        events
          .map((e) => Number(e.properties?.legs ?? e.properties?.legCount))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
      "Leg counts not present on events"
    ),
    riskModeDistribution,
    averageEvidenceCompleteness: metricNumber(
      null,
      "Evidence completeness not stored on analytics events"
    ),
    averageCandidatePool: metricNumber(null, "Not stored on analytics events"),
    averageEligible: metricNumber(null, "Not stored on analytics events"),
    averageExcluded: metricNumber(null, "Not stored on analytics events"),
    transferToStudio: metricNumber(
      countEvents(events, ["acca_builder_added_to_studio"])
    ),
    merge: metricNumber(countEvents(events, ["acca_builder_merge_selected"])),
    replace: metricNumber(
      countEvents(events, ["acca_builder_replace_selected"])
    ),
    operatorClickThrough: metricNumber(
      countEvents(events, ["acca_builder_operator_handoff"])
    ),
    popularMarkets: topPropertyCounts(events, ["market", "marketKey"]),
    popularCompetitions: topPropertyCounts(events, [
      "competition",
      "league",
      "competitionName",
    ]),
    charts: {
      generations: dailySeries(sortedDates, (d) =>
        events.filter(
          (e) =>
            dayKey(e.timestamp) === d &&
            (e.event_name === "acca_builder_generation_succeeded" ||
              e.event_name === "combo_generate_success")
        ).length
      ),
    },
    notes: [
      ...notes,
      "Popular markets/competitions require tagged event properties; otherwise lists stay empty.",
    ],
  };
}

function topPropertyCounts(
  events: readonly AnalyticsEvent[],
  keys: readonly string[]
): ChartPoint[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const props = e.properties ?? {};
    let matched = false;
    for (const key of keys) {
      const raw = props[key];
      if (raw == null || raw === "") continue;
      const label = String(raw);
      map.set(label, (map.get(label) ?? 0) + 1);
      matched = true;
      break;
    }
    if (!matched && e.market && keys.includes("market")) {
      map.set(e.market, (map.get(e.market) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));
}

export function buildOperatorDashboard(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): OperatorDashboard {
  const impressions = snap.events.filter(
    (e) => e.event_name === "operator_impression"
  );
  const clicks = snap.events.filter(
    (e) =>
      e.event_name === "operator_click" ||
      e.event_name === "go_redirect" ||
      e.event_name === "affiliate_redirect_completed"
  );
  const failures = snap.events.filter(
    (e) => e.event_name === "affiliate_redirect_failed"
  );

  const bySlug = new Map<string, { impressions: number; clicks: number }>();
  for (const e of impressions) {
    const slug = e.operator_slug || "unknown";
    const row = bySlug.get(slug) ?? { impressions: 0, clicks: 0 };
    row.impressions += 1;
    bySlug.set(slug, row);
  }
  for (const e of clicks) {
    const slug = e.operator_slug || "unknown";
    const row = bySlug.get(slug) ?? { impressions: 0, clicks: 0 };
    row.clicks += 1;
    bySlug.set(slug, row);
  }

  const byOperator = [...bySlug.entries()]
    .map(([slug, row]) => ({
      slug,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: pct(row.clicks, row.impressions),
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const sortedDates = [...snap.dates].sort();
  return {
    generatedAt: snap.loadedAt,
    filters,
    redirects: metricNumber(clicks.length),
    signedRedirectFailures: metricNumber(failures.length),
    clickCounts: metricNumber(clicks.length),
    ctr: metricNumber(
      pct(clicks.length, impressions.length),
      "No impressions in window"
    ),
    brokenOperators: [],
    unavailableOperators: byOperator
      .filter((o) => o.impressions === 0 && o.clicks === 0)
      .map((o) => o.slug),
    byOperator,
    charts: {
      clicks: dailySeries(sortedDates, (d) =>
        clicks.filter((e) => dayKey(e.timestamp) === d).length
      ),
    },
    notes: [
      "Broken/unavailable operator lists require live registry diagnostics; empty means not inferred from clicks alone.",
      "CTR = clicks / impressions from analytics log.",
    ],
  };
}

export function buildSearchDashboard(
  snap: AdminDataSnapshot,
  filters: AdminDashboardFilters
): SearchDashboard {
  const searchEvents = snap.events.filter((e) =>
    String(e.event_name).startsWith("search")
  );
  const queries = searchEvents.filter(
    (e) => e.event_name === "search_query" || e.event_name === "search"
  );
  const empty = searchEvents.filter((e) => e.event_name === "search_empty");
  const clicks = searchEvents.filter(
    (e) => e.event_name === "search_result_click"
  );

  const teamCounts = new Map<string, number>();
  const leagueCounts = new Map<string, number>();
  const fixtureCounts = new Map<string, number>();
  for (const e of searchEvents) {
    const entity = String(e.properties?.entity_type ?? "");
    const label = String(
      e.properties?.entity_slug ?? e.properties?.query ?? ""
    ).trim();
    if (!label) continue;
    if (entity === "team") teamCounts.set(label, (teamCounts.get(label) ?? 0) + 1);
    if (entity === "competition" || entity === "league") {
      leagueCounts.set(label, (leagueCounts.get(label) ?? 0) + 1);
    }
    if (entity === "fixture") {
      fixtureCounts.set(label, (fixtureCounts.get(label) ?? 0) + 1);
    }
  }

  const toPoints = (map: Map<string, number>): ChartPoint[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([label, value]) => ({ label, value }));

  const notes: string[] = [];
  if (!searchEvents.length) {
    notes.push(
      "No durable search_* events in analytics log for this window. In-memory search counters are not used (non-durable)."
    );
  }

  return {
    generatedAt: snap.loadedAt,
    filters,
    mostSearchedTeams: toPoints(teamCounts),
    mostSearchedLeagues: toPoints(leagueCounts),
    mostSearchedFixtures: toPoints(fixtureCounts),
    noResultSearches: metricNumber(empty.length),
    searchCtr: metricNumber(
      pct(clicks.length, queries.length || searchEvents.length),
      "Insufficient search events"
    ),
    notes,
  };
}

export function buildSystemHealth(
  filters: AdminDashboardFilters,
  readiness: {
    checks: Array<{ name: string; ok: boolean; detail?: string }>;
  },
  metrics: {
    counters?: Record<string, number>;
    timings?: Record<string, { count: number; avgMs?: number }>;
  } | null
): SystemHealthDashboard {
  const counters = metrics?.counters ?? {};
  const rateLimited =
    counters.rate_limit_rejected_total ??
    counters["rate_limit_rejected_total"] ??
    null;
  const avgTiming =
    metrics?.timings && Object.keys(metrics.timings).length
      ? avg(
          Object.values(metrics.timings)
            .map((t) => t.avgMs)
            .filter((n): n is number => n != null)
        )
      : null;

  return {
    generatedAt: new Date().toISOString(),
    filters,
    providerLatency: metricNumber(
      null,
      "Provider latency histograms not exported as durable series"
    ),
    providerFailures: metricNumber(
      counters.provider_failures_total ?? null,
      "Counter unavailable in this process"
    ),
    cacheHitRatio: metricNumber(
      null,
      "Cache hit ratio not exposed as a durable metric"
    ),
    apiFailures: metricNumber(
      counters.api_failures_total ?? null,
      "Counter unavailable in this process"
    ),
    rateLimitEvents: metricNumber(
      rateLimited,
      "No rate-limit counters in this process snapshot"
    ),
    responses429: metricNumber(
      rateLimited,
      "429 totals reuse rate_limit_rejected_total when present"
    ),
    requestIdsSample: [],
    averageResponseTime: metricNumber(
      avgTiming,
      "No timing samples in process metrics"
    ),
    averageBuilderLatency: metricNumber(
      null,
      "Builder latency not recorded as a separate timing"
    ),
    readinessChecks: readiness.checks,
    notes: [
      "Process-local metrics reset on restart and are incomplete across multiple instances.",
      "Readiness checks reflect current process health.",
    ],
  };
}

function daysBefore(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
