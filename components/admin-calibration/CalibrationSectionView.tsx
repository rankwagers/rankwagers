import { Suspense } from "react";
import type {
 BandMetrics,
 CalibrationIssue,
 CalibrationOverview,
 CalibrationSection,
 CapabilityRow,
 CohortMetrics,
} from "@/lib/calibration-intelligence";
import { parseCalibrationFilters } from "@/lib/calibration-intelligence/filters";
import { getCalibrationSection } from "@/lib/calibration-intelligence/service";
import { trackAdminCalibrationAnalytics } from "@/lib/calibration-intelligence/analytics";
import { CalibrationShell } from "./CalibrationShell";
import { CalibrationFiltersBar } from "./CalibrationFilters";

const TITLES: Record<CalibrationSection, string> = {
 overview: "Calibration overview",
 confidence: "Confidence bands",
 markets: "Market calibration",
 leagues: "League calibration",
 predictions: "Prediction cohorts",
 builder: "Builder quality",
 combinations: "Combination settlement",
 exclusions: "Exclusion analysis",
 cohorts: "Cohort definitions",
 issues: "Calibration issues",
 methodology: "Methodology",
};

export async function CalibrationSectionView({
 section,
 searchParams,
 path,
}: {
 section: CalibrationSection;
 searchParams?: Record<string, string | string[] | undefined>;
 path: string;
}) {
 const filters = parseCalibrationFilters(searchParams ?? null);
 trackAdminCalibrationAnalytics("admin_calibration_viewed", { section });
 trackAdminCalibrationAnalytics("admin_calibration_evaluation_started", {
 section,
 });
 let data: Record<string, unknown>;
 try {
 data = await getCalibrationSection(section, filters);
 trackAdminCalibrationAnalytics("admin_calibration_evaluation_completed", {
 section,
 });
 } catch {
 trackAdminCalibrationAnalytics("admin_calibration_evaluation_failed", {
 section,
 });
 data = { error: true, notes: ["Evaluation failed"] };
 }

 return (
 <CalibrationShell title={TITLES[section]} activePath={path}>
 <Suspense
 fallback={
 <p className="mb-6 text-sm text-muted-foreground" role="status">
 Loading filters…
 </p>
 }
 >
 <CalibrationFiltersBar section={section} />
 </Suspense>
 {data.cohortDefinition ? (
 <p className="mb-4 rounded border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-sm text-[var(--amber-primary)]">
 Active cohort: {String(data.cohortDefinition)}
 </p>
 ) : null}
 {section === "overview" ? <OverviewBody data={data} /> : null}
 {section === "confidence" ? <ConfidenceBody data={data} /> : null}
 {section === "markets" ? <MarketsBody data={data} /> : null}
 {section === "leagues" ? <LeaguesBody data={data} /> : null}
 {section === "predictions" ? <PredictionsBody data={data} /> : null}
 {section === "builder" ? <BuilderBody data={data} /> : null}
 {section === "combinations" ? <CombinationsBody data={data} /> : null}
 {section === "exclusions" ? <ExclusionsBody data={data} /> : null}
 {section === "cohorts" ? <CohortsBody data={data} /> : null}
 {section === "issues" ? <IssuesBody data={data} /> : null}
 {section === "methodology" ? <MethodologyBody data={data} /> : null}
 </CalibrationShell>
 );
}

function Metric({
 label,
 value,
 tone = "default",
}: {
 label: string;
 value: string | number | null | undefined;
 tone?: "default" | "danger" | "warn";
}) {
 const color =
 tone === "danger"
 ? "text-[var(--red-primary)]"
 : tone === "warn"
 ? "text-[var(--amber-primary)]"
 : "text-foreground";
 const display =
 value === null || value === undefined || value === ""
 ? "Unavailable"
 : typeof value === "number"
 ? Number.isInteger(value)
 ? String(value)
 : value.toFixed(4)
 : value;
 return (
 <div className="rounded-lg border border-border bg-card p-4">
 <p className="text-xs uppercase tracking-label text-muted-foreground">{label}</p>
 <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
 {display}
 </p>
 </div>
 );
}

function pct(n: number | null | undefined): string {
 if (n == null) return "Unavailable";
 return `${(n * 100).toFixed(1)}%`;
}

function OverviewBody({ data }: { data: Record<string, unknown> }) {
 const overview = data.overview as CalibrationOverview;
 const capability = (data.capability as CapabilityRow[]) ?? [];
 if (!overview) {
 return <p className="text-[var(--ink-secondary)]">Unavailable</p>;
 }
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Published" value={overview.totalPublished} />
 <Metric label="Settled" value={overview.settled} />
 <Metric label="Calibration-eligible" value={overview.calibrationEligible} />
 <Metric label="Confidence semantics" value={overview.confidenceSemantics} />
 <Metric label="Hit rate" value={pct(overview.overallHitRate)} />
 <Metric
 label="Avg confidence"
 value={
 overview.overallAverageConfidence == null
 ? null
 : overview.overallAverageConfidence.toFixed(1)
 }
 />
 <Metric
 label="Calibration gap"
 value={overview.overallCalibrationGap}
 tone={
 overview.overallCalibrationGap != null &&
 Math.abs(overview.overallCalibrationGap) > 0.1
 ? "warn"
 : "default"
 }
 />
 <Metric label="Brier" value={overview.brierScore} />
 <Metric label="Unresolved rate" value={pct(overview.unresolvedRate)} />
 <Metric label="Builder generations" value={overview.builderGenerations} />
 <Metric label="Settled Builder legs" value={overview.settledBuilderLegs} />
 <Metric label="Settled combinations" value={overview.settledCombinations} />
 <Metric label="Mode ordering" value={overview.modeOrderingStatus} />
 <Metric label="Drift" value={overview.driftStatus} />
 <Metric
 label="Critical issues"
 value={overview.criticalIssues}
 tone="danger"
 />
 <Metric label="High issues" value={overview.highIssues} tone="warn" />
 </div>
 <p className="mt-4 text-sm text-[var(--ink-secondary)]">
 Methodology {overview.methodologyVersion} · Normalization{""}
 {overview.normalizationVersion} · Evaluated {overview.lastEvaluationAt}
 </p>
 <Notes notes={overview.notes} />
 <section className="mt-8">
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">Capability matrix</h2>
 <CapabilityTable rows={capability} />
 </section>
 </>
 );
}

function CapabilityTable({ rows }: { rows: CapabilityRow[] }) {
 return (
 <div className="mt-3 overflow-x-auto">
 <table className="w-full min-w-[640px] text-left text-sm">
 <caption className="sr-only">Calibration capability matrix</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2 pr-3 font-medium">
 Analysis
 </th>
 <th scope="col" className="py-2 pr-3 font-medium">
 Status
 </th>
 <th scope="col" className="py-2 pr-3 font-medium">
 Blocking reason
 </th>
 <th scope="col" className="py-2 font-medium">
 Source
 </th>
 </tr>
 </thead>
 <tbody>
 {rows.map((r) => (
 <tr key={r.analysis} className="border-b border-border">
 <td className="py-2 pr-3">{r.analysis}</td>
 <td className="py-2 pr-3 tabular-nums text-right">{r.status}</td>
 <td className="py-2 pr-3 text-[var(--ink-secondary)]">
 {r.blockingReason ?? "—"}
 </td>
 <td className="py-2 text-[var(--ink-secondary)]">{r.source}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function BandTable({ bands }: { bands: BandMetrics[] }) {
 return (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[720px] text-left text-sm">
 <caption className="sr-only">Confidence band metrics</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2 pr-2">
 Band
 </th>
 <th scope="col" className="py-2 pr-2">
 Published
 </th>
 <th scope="col" className="py-2 pr-2">
 Settled
 </th>
 <th scope="col" className="py-2 pr-2">
 W/L/V
 </th>
 <th scope="col" className="py-2 pr-2">
 Observed
 </th>
 <th scope="col" className="py-2 pr-2">
 Avg conf
 </th>
 <th scope="col" className="py-2 pr-2">
 Gap
 </th>
 <th scope="col" className="py-2">
 Sample
 </th>
 </tr>
 </thead>
 <tbody>
 {bands.map((b) => (
 <tr key={b.band} className="border-b border-border">
 <td className="py-2 pr-2 font-medium">{b.band}</td>
 <td className="py-2 pr-2 tabular-nums text-right">{b.published}</td>
 <td className="py-2 pr-2 tabular-nums text-right">{b.settled}</td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {b.won}/{b.lost}/{b.voided}
 </td>
 <td className="py-2 pr-2 tabular-nums text-right">{pct(b.observedRate)}</td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {b.averageConfidence?.toFixed(1) ?? "Unavailable"}
 </td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {b.calibrationGap?.toFixed(3) ?? "Unavailable"}
 </td>
 <td className="py-2">
 <span aria-label={`Sample status ${b.sampleStatus}`}>
 {b.sampleStatus}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

/** Accessible bar chart alternative — width encodes observed rate; label encodes band. */
function BandChart({ bands }: { bands: BandMetrics[] }) {
 return (
 <div
 className="mt-4 space-y-2"
 role="img"
 aria-label="Predicted confidence bands versus observed success rate"
 >
 {bands
 .filter((b) => b.published > 0)
 .map((b) => {
 const obs = b.observedRate ?? 0;
 const avg = (b.averageConfidence ?? 0) / 100;
 return (
 <div key={b.band} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2 text-xs">
 <span>{b.band}</span>
 <div className="relative h-4 rounded bg-card">
 <div
 className="absolute inset-y-0 left-0 rounded bg-[var(--amber-surface)] motion-reduce:transition-none"
 style={{ width: `${Math.min(100, obs * 100)}%` }}
 />
 <div
 className="absolute top-0 h-full w-0.5 bg-card"
 style={{ left: `${Math.min(100, avg * 100)}%` }}
 title="Average published confidence"
 />
 </div>
 <span className="tabular-nums text-[var(--ink-secondary)]">
 obs {pct(b.observedRate)} · n={b.won + b.lost} · {b.sampleStatus}
 </span>
 </div>
 );
 })}
 <p className="text-xs text-muted-foreground">
 Bars = observed success; tick = average published confidence. Table above is
 authoritative.
 </p>
 </div>
 );
}

function ConfidenceBody({ data }: { data: Record<string, unknown> }) {
 const bands = (data.bands as BandMetrics[]) ?? [];
 return (
 <>
 <p className="mb-2 text-sm text-[var(--ink-secondary)]">
 Semantics: {String(data.confidenceSemantics ?? "Unavailable")} · Brier{""}
 {data.brierScore == null ? "Unavailable" : Number(data.brierScore).toFixed(4)}{""}
 · ECE{""}
 {data.ece == null ? "Unavailable" : Number(data.ece).toFixed(4)}
 </p>
 <BandTable bands={bands} />
 <BandChart bands={bands} />
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function CohortTable({ rows }: { rows: CohortMetrics[] }) {
 if (!rows.length) {
 return <p className="text-muted-foreground">Empty</p>;
 }
 return (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[720px] text-left text-sm">
 <caption className="sr-only">Cohort metrics</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2 pr-2">
 Cohort
 </th>
 <th scope="col" className="py-2 pr-2">
 N
 </th>
 <th scope="col" className="py-2 pr-2">
 W/L/V
 </th>
 <th scope="col" className="py-2 pr-2">
 Hit
 </th>
 <th scope="col" className="py-2 pr-2">
 Avg conf
 </th>
 <th scope="col" className="py-2 pr-2">
 Gap
 </th>
 <th scope="col" className="py-2">
 Sample
 </th>
 </tr>
 </thead>
 <tbody>
 {rows.map((c) => (
 <tr key={c.cohortId} className="border-b border-border">
 <td className="py-2 pr-2">{c.definition}</td>
 <td className="py-2 pr-2 tabular-nums text-right">{c.published}</td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {c.won}/{c.lost}/{c.voided}
 </td>
 <td className="py-2 pr-2 tabular-nums text-right">{pct(c.hitRate)}</td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {c.averageConfidence?.toFixed(1) ?? "Unavailable"}
 </td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {c.calibrationGap?.toFixed(3) ?? "Unavailable"}
 </td>
 <td className="py-2">{c.sampleStatus}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function MarketsBody({ data }: { data: Record<string, unknown> }) {
 const markets = (data.markets as CohortMetrics[]) ?? [];
 return (
 <>
 <CohortTable rows={markets} />
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function LeaguesBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as Array<CohortMetrics & { dominatedBySingleMarket?: boolean }>) ?? [];
 return (
 <>
 <p className="mb-2 text-sm text-[var(--ink-secondary)]">
 Showing {items.length} of {String(data.total ?? 0)} competitions
 </p>
 <CohortTable rows={items} />
 <ul className="mt-3 list-disc pl-5 text-sm text-[var(--ink-secondary)]">
 {items
 .filter((i) => i.dominatedBySingleMarket)
 .map((i) => (
 <li key={i.cohortId}>
 {i.definition}: dominated by a single market — league conclusions
 unsafe without per-market support
 </li>
 ))}
 </ul>
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function PredictionsBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 id: string;
 date: string;
 marketKey: string;
 competition: string;
 confidence: number | null;
 status: string;
 homeTeam: string;
 awayTeam: string;
 }>) ?? [];
 const lead = data.leadTime as {
 bands: Array<{
 label: string;
 published: number;
 hitRate: number | null;
 sampleStatus: string;
 won: number;
 lost: number;
 }>;
 missingTimestamps: number;
 notes: string[];
 };
 const evidence = data.evidence as {
 bands: Array<{
 band: string;
 settled: number;
 hitRate: number | null;
 sampleStatus: string;
 }>;
 notes: string[];
 };
 return (
 <>
 <div className="mb-4 grid gap-3 sm:grid-cols-4">
 <Metric label="Won" value={data.won as number} />
 <Metric label="Lost" value={data.lost as number} />
 <Metric label="Void" value={data.voided as number} />
 <Metric label="Pending" value={data.pending as number} />
 </div>
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">Prediction page</h2>
 <div className="mt-2 overflow-x-auto">
 <table className="w-full min-w-[640px] text-left text-sm">
 <caption className="sr-only">Archived predictions</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2 pr-2">
 Date
 </th>
 <th scope="col" className="py-2 pr-2">
 Fixture
 </th>
 <th scope="col" className="py-2 pr-2">
 Market
 </th>
 <th scope="col" className="py-2 pr-2">
 Conf
 </th>
 <th scope="col" className="py-2">
 Status
 </th>
 </tr>
 </thead>
 <tbody>
 {items.length ? (
 items.map((r) => (
 <tr key={r.id} className="border-b border-border">
 <td className="py-2 pr-2 tabular-nums text-right">{r.date}</td>
 <td className="py-2 pr-2">
 {r.homeTeam} vs {r.awayTeam}
 </td>
 <td className="py-2 pr-2">{r.marketKey}</td>
 <td className="py-2 pr-2 tabular-nums text-right">
 {r.confidence ?? "Unavailable"}
 </td>
 <td className="py-2">{r.status}</td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan={5} className="py-4 text-muted-foreground">
 Empty
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 <h2 className="mt-8 text-sm font-semibold text-[var(--ink-secondary)]">
 Publication lead time
 </h2>
 <p className="text-xs text-muted-foreground">
 Missing timestamps: {lead?.missingTimestamps ?? "Unavailable"}
 </p>
 <div className="mt-2 overflow-x-auto">
 <table className="w-full text-left text-sm">
 <caption className="sr-only">Lead-time bands</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2">
 Band
 </th>
 <th scope="col" className="py-2">
 N
 </th>
 <th scope="col" className="py-2">
 Hit
 </th>
 <th scope="col" className="py-2">
 Sample
 </th>
 </tr>
 </thead>
 <tbody>
 {(lead?.bands ?? []).map((b) => (
 <tr key={b.label} className="border-b border-border">
 <td className="py-2">{b.label}</td>
 <td className="py-2 tabular-nums text-right">{b.published}</td>
 <td className="py-2 tabular-nums text-right">{pct(b.hitRate)}</td>
 <td className="py-2">{b.sampleStatus}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={lead?.notes ?? []} />
 <h2 className="mt-8 text-sm font-semibold text-[var(--ink-secondary)]">
 Evidence completeness (heuristic)
 </h2>
 <div className="mt-2 overflow-x-auto">
 <table className="w-full text-left text-sm">
 <caption className="sr-only">Evidence bands</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2">
 Band
 </th>
 <th scope="col" className="py-2">
 Settled
 </th>
 <th scope="col" className="py-2">
 Hit
 </th>
 <th scope="col" className="py-2">
 Sample
 </th>
 </tr>
 </thead>
 <tbody>
 {(evidence?.bands ?? []).map((b) => (
 <tr key={b.band} className="border-b border-border">
 <td className="py-2">{b.band}</td>
 <td className="py-2 tabular-nums text-right">{b.settled}</td>
 <td className="py-2 tabular-nums text-right">{pct(b.hitRate)}</td>
 <td className="py-2">{b.sampleStatus}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={evidence?.notes ?? []} />
 </>
 );
}

function BuilderBody({ data }: { data: Record<string, unknown> }) {
 const builder = data.builder as {
 requests: number;
 successful: number;
 failed: number;
 transferToStudio: number;
 merge: number;
 replace: number;
 handoff: number;
 settledCombinations: number | null;
 settledLegs: number | null;
 byMode: Array<{ mode: string; generations: number; transfers: number }>;
 notes: string[];
 };
 const modeOrdering = data.modeOrdering as {
 status: string;
 expected: Record<string, number>;
 findings: string[];
 };
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Requests" value={builder?.requests} />
 <Metric label="Successful" value={builder?.successful} />
 <Metric label="Failed" value={builder?.failed} />
 <Metric label="Transfer to Studio" value={builder?.transferToStudio} />
 <Metric label="Merge" value={builder?.merge} />
 <Metric label="Replace" value={builder?.replace} />
 <Metric label="Handoff" value={builder?.handoff} />
 <Metric label="Settled combinations" value={builder?.settledCombinations} />
 <Metric label="Settled legs" value={builder?.settledLegs} />
 <Metric label="Mode ordering" value={modeOrdering?.status} />
 </div>
 <h2 className="mt-6 text-sm font-semibold text-[var(--ink-secondary)]">By mode</h2>
 <table className="mt-2 w-full text-left text-sm">
 <caption className="sr-only">Builder metrics by risk mode</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2">
 Mode
 </th>
 <th scope="col" className="py-2">
 Generations
 </th>
 <th scope="col" className="py-2">
 Transfers
 </th>
 </tr>
 </thead>
 <tbody>
 {(builder?.byMode ?? []).map((m) => (
 <tr key={m.mode} className="border-b border-border">
 <td className="py-2">{m.mode}</td>
 <td className="py-2 tabular-nums text-right">{m.generations}</td>
 <td className="py-2 tabular-nums text-right">{m.transfers}</td>
 </tr>
 ))}
 </tbody>
 </table>
 <Notes notes={[...(builder?.notes ?? []), ...(modeOrdering?.findings ?? [])]} />
 </>
 );
}

function CombinationsBody({ data }: { data: Record<string, unknown> }) {
 return (
 <>
 <Metric label="Availability" value="Unavailable" tone="warn" />
 <Metric label="Financial metrics" value={String(data.financialMetrics)} />
 <h2 className="mt-6 text-sm font-semibold text-[var(--ink-secondary)]">
 Settlement rules ({String(data.settlementRulesVersion)})
 </h2>
 <ul className="mt-2 list-disc pl-5 text-sm text-[var(--ink-secondary)]">
 {((data.settlementRules as string[]) ?? []).map((r) => (
 <li key={r}>{r}</li>
 ))}
 </ul>
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function ExclusionsBody({ data }: { data: Record<string, unknown> }) {
 return (
 <>
 <p className="rounded border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-sm text-[var(--amber-primary)]">
 Retrospective policy: {String(data.retrospectivePolicy)} — never presented
 as a live recommendation.
 </p>
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function CohortsBody({ data }: { data: Record<string, unknown> }) {
 const overall = data.overall as CohortMetrics;
 const byMarket = (data.byMarket as CohortMetrics[]) ?? [];
 return (
 <>
 {overall ? (
 <>
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">Overall cohort</h2>
 <CohortTable rows={[overall]} />
 </>
 ) : null}
 <h2 className="mt-6 text-sm font-semibold text-[var(--ink-secondary)]">By market</h2>
 <CohortTable rows={byMarket} />
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function IssuesBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as CalibrationIssue[]) ?? [];
 return (
 <>
 <p className="mb-2 text-sm text-[var(--ink-secondary)]">
 {items.length} of {String(data.total ?? 0)} issues
 </p>
 <ul className="space-y-3">
 {items.length ? (
 items.map((i) => (
 <li
 key={`${i.code}-${i.cohort}`}
 className="rounded-lg border border-border bg-card p-4"
 >
 <p className="text-xs uppercase tracking-label text-muted-foreground">
 <span className="sr-only">Severity </span>
 {i.severity} · {i.code}
 </p>
 <p className="mt-1 font-medium text-foreground">{i.explanation}</p>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 Cohort: {i.cohort} · Sample: {i.sampleSize}
 </p>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 Remediation: {i.remediation}
 </p>
 </li>
 ))
 ) : (
 <li className="text-muted-foreground">No open issues in this cohort</li>
 )}
 </ul>
 </>
 );
}

function MethodologyBody({ data }: { data: Record<string, unknown> }) {
 const methodology = data.methodology as Record<string, unknown>;
 const capability = (data.capability as CapabilityRow[]) ?? [];
 return (
 <>
 <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs text-[var(--ink-secondary)]">
 {JSON.stringify(methodology, null, 2)}
 </pre>
 <CapabilityTable rows={capability} />
 <Notes notes={(data.notes as string[]) ?? []} />
 </>
 );
}

function Notes({ notes }: { notes: string[] }) {
 if (!notes?.length) return null;
 return (
 <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 {notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 );
}
