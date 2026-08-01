import { Suspense } from "react";
import type {
 AdminDashboardSection,
 BuilderDashboard,
 LeagueAnalysisDashboard,
 MarketAnalysisDashboard,
 OperatorDashboard,
 OverviewDashboard,
 PredictionQualityDashboard,
 SearchDashboard,
 SystemHealthDashboard,
} from "@/lib/admin-dashboard";
import { parseAdminFilters } from "@/lib/admin-dashboard";
import { getAdminDashboardSection } from "@/lib/admin-dashboard/service";
import { trackAdminAnalytics } from "@/lib/admin-dashboard/adminAnalytics";
import { AdminFilters } from "./AdminFilters";
import { AdminShell } from "./AdminShell";
import { MetricCard } from "./MetricCard";
import { SimpleBars } from "./SimpleBars";

const TITLES: Record<AdminDashboardSection, string> = {
 overview: "Overview",
 predictions: "Prediction quality",
 markets: "Market analysis",
 leagues: "League analysis",
 builder: "Builder intelligence",
 operators: "Operators",
 search: "Search",
 system: "System health",
};

export async function AdminSectionView({
 section,
 searchParams,
 path,
}: {
 section: AdminDashboardSection;
 searchParams?: Record<string, string | string[] | undefined>;
 path: string;
}) {
 const filters = parseAdminFilters(searchParams ?? null);
 trackAdminAnalytics("admin_dashboard_viewed", { section });
 const data = await getAdminDashboardSection(section, filters);

 return (
 <AdminShell title={TITLES[section]} activePath={path}>
 <Suspense
 fallback={
 <p className="mb-6 text-sm text-muted-foreground" role="status">
 Loading filters…
 </p>
 }
 >
 <AdminFilters section={section} />
 </Suspense>
 {section === "overview" ? (
 <OverviewBody data={data as unknown as OverviewDashboard} />
 ) : null}
 {section === "predictions" ? (
 <PredictionsBody data={data as unknown as PredictionQualityDashboard} />
 ) : null}
 {section === "markets" ? (
 <MarketsBody data={data as unknown as MarketAnalysisDashboard} />
 ) : null}
 {section === "leagues" ? (
 <LeaguesBody data={data as unknown as LeagueAnalysisDashboard} />
 ) : null}
 {section === "builder" ? (
 <BuilderBody data={data as unknown as BuilderDashboard} />
 ) : null}
 {section === "operators" ? (
 <OperatorsBody data={data as unknown as OperatorDashboard} />
 ) : null}
 {section === "search" ? (
 <SearchBody data={data as unknown as SearchDashboard} />
 ) : null}
 {section === "system" ? (
 <SystemBody data={data as unknown as SystemHealthDashboard} />
 ) : null}
 </AdminShell>
 );
}

function Notes({ notes }: { notes: string[] }) {
 if (!notes.length) return null;
 return (
 <aside className="mt-6 rounded-lg border border-[var(--amber-border)] bg-[var(--amber-surface)] px-4 py-3 text-sm text-[var(--amber-primary)]">
 <ul className="list-disc space-y-1 pl-4">
 {notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 </aside>
 );
}

function OverviewBody({ data }: { data: OverviewDashboard }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <MetricCard label="Published" metric={data.publishedPredictions} />
 <MetricCard label="Settled" metric={data.settledPredictions} />
 <MetricCard label="Won" metric={data.won} />
 <MetricCard label="Lost" metric={data.lost} />
 <MetricCard label="Void" metric={data.voided} />
 <MetricCard label="Hit rate" metric={data.hitRate} />
 <MetricCard label="Pending" metric={data.pending} />
 <MetricCard label="Today" metric={data.todayPredictions} />
 <MetricCard label="Last 7 days" metric={data.last7Days} />
 <MetricCard label="Last 30 days" metric={data.last30Days} />
 <MetricCard label="Avg confidence" metric={data.averageConfidence} />
 <MetricCard label="Avg odds" metric={data.averageOdds} />
 <MetricCard label="Data freshness" metric={data.dataFreshness} />
 <MetricCard label="Builder usage" metric={data.builderUsage} />
 <MetricCard label="Operator clicks" metric={data.operatorClicks} />
 <MetricCard label="Archive days" metric={data.archiveGrowthDays} />
 <MetricCard label="Search usage" metric={data.searchUsage} />
 <MetricCard label="Errors" metric={data.errors} />
 </div>
 <div className="mt-6 grid gap-4 lg:grid-cols-2">
 <SimpleBars title="Daily predictions" points={data.charts.dailyPredictions} />
 <SimpleBars title="Daily hit rate %" points={data.charts.dailyHitRate} />
 <SimpleBars title="Builder generations" points={data.charts.builderGenerations} />
 <SimpleBars title="Operator clicks" points={data.charts.operatorClicks} />
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function PredictionsBody({ data }: { data: PredictionQualityDashboard }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <MetricCard label="Won" metric={data.won} />
 <MetricCard label="Lost" metric={data.lost} />
 <MetricCard label="Void" metric={data.voided} />
 <MetricCard label="Hit rate" metric={data.hitRate} />
 <MetricCard label="Avg confidence" metric={data.averageConfidence} />
 <MetricCard label="Avg odds" metric={data.averageOdds} />
 <MetricCard label="Publication delay" metric={data.averagePublicationDelay} />
 <MetricCard label="Settlement delay" metric={data.averageSettlementDelay} />
 </div>
 <div className="mt-6">
 <SimpleBars title="Hit rate trend" points={data.trend} />
 </div>
 <div className="mt-6 overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Market</th>
 <th scope="col" className="px-3 py-2 text-right">n</th>
 <th scope="col" className="px-3 py-2 text-right">W</th>
 <th scope="col" className="px-3 py-2 text-right">L</th>
 <th scope="col" className="px-3 py-2 text-right">V</th>
 <th scope="col" className="px-3 py-2 text-right">Hit %</th>
 <th scope="col" className="px-3 py-2 text-right">Avg conf</th>
 </tr>
 </thead>
 <tbody>
 {data.byMarket.map((row) => (
 <tr key={row.market} className="border-t border-border">
 <td className="px-3 py-2">{row.market}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.sampleSize}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.won}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.lost}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.voided}</td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.hitRate ?? "Unavailable"}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.averageConfidence ?? "Unavailable"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function MarketsBody({ data }: { data: MarketAnalysisDashboard }) {
 return (
 <>
 <div className="space-y-6">
 {data.markets.map((m) => (
 <section
 key={m.market}
 className="rounded-lg border border-border bg-card p-4"
 >
 <h2 className="font-semibold text-foreground">{m.market}</h2>
 {!m.supported ? (
 <p className="mt-2 text-sm text-muted-foreground">
 {m.note ?? "Unavailable"}
 </p>
 ) : (
 <>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 n={m.sampleSize} · W {m.won} / L {m.lost} / V {m.voided} · hit{""}
 {m.hitRate ?? "Unavailable"}% · avg conf{""}
 {m.averageConfidence ?? "Unavailable"}
 </p>
 <div className="mt-4 grid gap-4 lg:grid-cols-2">
 <SimpleBars
 title="Confidence distribution"
 points={m.confidenceDistribution}
 />
 <SimpleBars title="Hit rate trend" points={m.trend} />
 </div>
 </>
 )}
 </section>
 ))}
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function LeaguesBody({ data }: { data: LeagueAnalysisDashboard }) {
 return (
 <>
 <div className="mb-4 grid gap-3 sm:grid-cols-3">
 <div className="rounded-lg border border-border p-3 text-sm">
 <p className="text-muted-foreground">Top leagues</p>
 <p className="mt-1 text-foreground">
 {data.topLeagues.join(", ") || "Unavailable"}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3 text-sm">
 <p className="text-muted-foreground">Worst leagues</p>
 <p className="mt-1 text-foreground">
 {data.worstLeagues.join(", ") || "Unavailable"}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3 text-sm">
 <p className="text-muted-foreground">Most active</p>
 <p className="mt-1 text-foreground">
 {data.mostActive.join(", ") || "Unavailable"}
 </p>
 </div>
 </div>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">League</th>
 <th scope="col" className="px-3 py-2 text-right">Published</th>
 <th scope="col" className="px-3 py-2 text-right">W</th>
 <th scope="col" className="px-3 py-2 text-right">L</th>
 <th scope="col" className="px-3 py-2 text-right">V</th>
 <th scope="col" className="px-3 py-2 text-right">Hit %</th>
 <th scope="col" className="px-3 py-2 text-right">Avg conf</th>
 </tr>
 </thead>
 <tbody>
 {data.leagues.slice(0, 40).map((row) => (
 <tr key={row.league} className="border-t border-border">
 <td className="px-3 py-2">{row.league}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.published}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.won}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.lost}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.voided}</td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.hitRate ?? "Unavailable"}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.averageConfidence ?? "Unavailable"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function BuilderBody({ data }: { data: BuilderDashboard }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <MetricCard label="Generations" metric={data.generations} />
 <MetricCard label="Successful" metric={data.successful} />
 <MetricCard label="Failed" metric={data.failed} />
 <MetricCard label="Avg gen time" metric={data.averageGenerationTime} />
 <MetricCard label="Avg legs" metric={data.averageLegs} />
 <MetricCard label="Evidence completeness" metric={data.averageEvidenceCompleteness} />
 <MetricCard label="Candidate pool" metric={data.averageCandidatePool} />
 <MetricCard label="Eligible" metric={data.averageEligible} />
 <MetricCard label="Excluded" metric={data.averageExcluded} />
 <MetricCard label="Transfer to Studio" metric={data.transferToStudio} />
 <MetricCard label="Merge" metric={data.merge} />
 <MetricCard label="Replace" metric={data.replace} />
 <MetricCard label="Operator CTR handoff" metric={data.operatorClickThrough} />
 </div>
 <div className="mt-6 grid gap-4 lg:grid-cols-2">
 <SimpleBars title="Risk mode selections" points={data.riskModeDistribution} />
 <SimpleBars title="Generations over time" points={data.charts.generations} />
 <SimpleBars
 title="Popular markets"
 points={data.popularMarkets}
 emptyLabel="Unavailable"
 />
 <SimpleBars
 title="Popular competitions"
 points={data.popularCompetitions}
 emptyLabel="Unavailable"
 />
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function OperatorsBody({ data }: { data: OperatorDashboard }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <MetricCard label="Redirects / clicks" metric={data.redirects} />
 <MetricCard label="Signed failures" metric={data.signedRedirectFailures} />
 <MetricCard label="Click counts" metric={data.clickCounts} />
 <MetricCard label="CTR" metric={data.ctr} />
 </div>
 <div className="mt-6">
 <SimpleBars title="Clicks over time" points={data.charts.clicks} />
 </div>
 <div className="mt-6 overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Operator</th>
 <th scope="col" className="px-3 py-2 text-right">Impressions</th>
 <th scope="col" className="px-3 py-2 text-right">Clicks</th>
 <th scope="col" className="px-3 py-2 text-right">CTR</th>
 </tr>
 </thead>
 <tbody>
 {data.byOperator.slice(0, 30).map((row) => (
 <tr key={row.slug} className="border-t border-border">
 <td className="px-3 py-2">{row.slug}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.impressions}</td>
 <td className="px-3 py-2 text-right tabular-nums">{row.clicks}</td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.ctr ?? "Unavailable"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function SearchBody({ data }: { data: SearchDashboard }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2">
 <MetricCard label="No-result searches" metric={data.noResultSearches} />
 <MetricCard label="Search CTR" metric={data.searchCtr} />
 </div>
 <div className="mt-6 grid gap-4 lg:grid-cols-3">
 <SimpleBars title="Teams" points={data.mostSearchedTeams} emptyLabel="Unavailable" />
 <SimpleBars title="Leagues" points={data.mostSearchedLeagues} emptyLabel="Unavailable" />
 <SimpleBars title="Fixtures" points={data.mostSearchedFixtures} emptyLabel="Unavailable" />
 </div>
 <Notes notes={data.notes} />
 </>
 );
}

function SystemBody({ data }: { data: SystemHealthDashboard }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <MetricCard label="Provider latency" metric={data.providerLatency} />
 <MetricCard label="Provider failures" metric={data.providerFailures} />
 <MetricCard label="Cache hit ratio" metric={data.cacheHitRatio} />
 <MetricCard label="API failures" metric={data.apiFailures} />
 <MetricCard label="Rate limit events" metric={data.rateLimitEvents} />
 <MetricCard label="429 responses" metric={data.responses429} />
 <MetricCard label="Avg response time" metric={data.averageResponseTime} />
 <MetricCard label="Builder latency" metric={data.averageBuilderLatency} />
 </div>
 <div className="mt-6 overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Check</th>
 <th scope="col" className="px-3 py-2 text-left">Status</th>
 <th scope="col" className="px-3 py-2 text-left">Detail</th>
 </tr>
 </thead>
 <tbody>
 {data.readinessChecks.map((c) => (
 <tr key={c.name} className="border-t border-border">
 <td className="px-3 py-2">{c.name}</td>
 <td className="px-3 py-2">{c.ok ? "ok" : "issue"}</td>
 <td className="px-3 py-2 text-[var(--ink-secondary)]">{c.detail ?? "—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes} />
 </>
 );
}
