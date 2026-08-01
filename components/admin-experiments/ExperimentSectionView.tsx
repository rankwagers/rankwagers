import { Suspense } from "react";
import type { ExperimentSection } from "@/lib/experimentation";
import { parseExperimentFilters } from "@/lib/experimentation/filters";
import { getExperimentSection } from "@/lib/experimentation/service";
import { trackAdminExperimentAnalytics } from "@/lib/experimentation/analytics";
import { ExperimentShell } from "./ExperimentShell";
import { ExperimentFiltersBar } from "./ExperimentFilters";

const TITLES: Record<ExperimentSection, string> = {
 overview: "Experiments overview",
 definitions: "Experiment definitions",
 assignments: "Assignment diagnostics",
 exposures: "Exposures",
 metrics: "Metric registry",
 results: "Results",
 guardrails: "Guardrails",
 issues: "Issues",
 methodology: "Methodology",
 audit: "Audit history",
};

export async function ExperimentSectionView({
 section,
 searchParams,
 path,
}: {
 section: ExperimentSection;
 searchParams?: Record<string, string | string[] | undefined>;
 path: string;
}) {
 const filters = parseExperimentFilters(searchParams ?? null);
 trackAdminExperimentAnalytics("admin_experiment_viewed", { section });
 const data = await getExperimentSection(section, filters);

 return (
 <ExperimentShell title={TITLES[section]} activePath={path}>
 <div
 className="mb-4 rounded border border-[var(--amber-border)] bg-[var(--amber-surface)] px-3 py-2 text-sm text-[var(--amber-primary)]"
 role="status"
 >
 {String(data.localDataBanner ?? "LOCAL/TEST DATA — NOT REAL USER EVIDENCE")}
 </div>
 <Suspense
 fallback={
 <p className="mb-6 text-sm text-muted-foreground" role="status">
 Loading filters…
 </p>
 }
 >
 <ExperimentFiltersBar section={section} />
 </Suspense>
 {section === "overview" ? <OverviewBody data={data} /> : null}
 {section === "definitions" ? <DefinitionsBody data={data} /> : null}
 {section === "assignments" ? <AssignmentsBody data={data} /> : null}
 {section === "exposures" ? <ExposuresBody data={data} /> : null}
 {section === "metrics" ? <MetricsBody data={data} /> : null}
 {section === "results" ? <ResultsBody data={data} /> : null}
 {section === "guardrails" ? <GuardrailsBody data={data} /> : null}
 {section === "issues" ? <IssuesBody data={data} /> : null}
 {section === "methodology" ? <MethodologyBody data={data} /> : null}
 {section === "audit" ? <AuditBody data={data} /> : null}
 </ExperimentShell>
 );
}

function Metric({
 label,
 value,
}: {
 label: string;
 value: string | number | null | undefined;
}) {
 return (
 <div className="rounded-lg border border-border bg-card p-4">
 <p className="text-xs uppercase tracking-label text-muted-foreground">{label}</p>
 <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
 {value == null || value === "" ? "Unavailable" : value}
 </p>
 </div>
 );
}

function Notes({ notes }: { notes?: string[] }) {
 if (!notes?.length) return null;
 return (
 <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 {notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 );
}

function OverviewBody({ data }: { data: Record<string, unknown> }) {
 const o = data.overview as Record<string, number>;
 const capability = (data.capability as Array<Record<string, string | null>>) ?? [];
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Total" value={o?.totalExperiments} />
 <Metric label="Drafts" value={o?.drafts} />
 <Metric label="Ready for review" value={o?.readyForReview} />
 <Metric label="Approved" value={o?.approved} />
 <Metric label="Running" value={o?.running} />
 <Metric label="Paused" value={o?.paused} />
 <Metric label="Completed" value={o?.completed} />
 <Metric label="Invalidated" value={o?.invalidated} />
 <Metric label="Active exposures" value={o?.activeExposures} />
 <Metric label="SRM experiments" value={o?.experimentsWithSrm} />
 <Metric label="Guardrail breaches" value={o?.guardrailBreaches} />
 <Metric label="Critical issues" value={o?.criticalIssues} />
 </div>
 <p className="mt-4 text-sm text-[var(--ink-secondary)]">
 Production activation available:{""}
 {String(data.productionActivationAvailable)} · Auto-rollout:{""}
 {String(data.autoRollout)}
 </p>
 <h2 className="mt-8 text-sm font-semibold text-[var(--ink-secondary)]">
 Capability matrix
 </h2>
 <div className="mt-2 overflow-x-auto">
 <table className="w-full min-w-[640px] text-left text-sm">
 <caption className="sr-only">Experimentation capability matrix</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2 pr-2">
 Analysis
 </th>
 <th scope="col" className="py-2 pr-2">
 Status
 </th>
 <th scope="col" className="py-2">
 Blocking reason
 </th>
 </tr>
 </thead>
 <tbody>
 {capability.map((r) => (
 <tr key={String(r.analysis)} className="border-b border-border">
 <td className="py-2 pr-2">{r.analysis}</td>
 <td className="py-2 pr-2">{r.status}</td>
 <td className="py-2 text-[var(--ink-secondary)]">
 {r.blockingReason ?? "—"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function DefinitionsBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 id: string;
 name: string;
 status: string;
 hypothesis: string;
 primaryMetricId: string;
 conflictGroup: string | null;
 trafficPercent: number;
 validationErrors: string[];
 }>) ?? [];
 return (
 <>
 <div className="overflow-x-auto">
 <table className="w-full min-w-[720px] text-left text-sm">
 <caption className="sr-only">Experiment definitions</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2 pr-2">
 ID
 </th>
 <th scope="col" className="py-2 pr-2">
 Status
 </th>
 <th scope="col" className="py-2 pr-2">
 Primary metric
 </th>
 <th scope="col" className="py-2 pr-2">
 Conflict
 </th>
 <th scope="col" className="py-2">
 Traffic %
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((d) => (
 <tr key={d.id} className="border-b border-border align-top">
 <td className="py-2 pr-2">
 <div className="font-medium">{d.name}</div>
 <div className="text-xs text-muted-foreground">{d.id}</div>
 <p className="mt-1 max-w-md text-xs text-[var(--ink-secondary)]">
 {d.hypothesis}
 </p>
 </td>
 <td className="py-2 pr-2">
 <span aria-label={`Status ${d.status}`}>{d.status}</span>
 </td>
 <td className="py-2 pr-2">{d.primaryMetricId}</td>
 <td className="py-2 pr-2">{d.conflictGroup ?? "—"}</td>
 <td className="py-2 tabular-nums text-right">{d.trafficPercent}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function AssignmentsBody({ data }: { data: Record<string, unknown> }) {
 const diagnostics = (data.diagnostics as Array<Record<string, unknown>>) ?? [];
 return (
 <>
 <p className="mb-2 text-sm text-[var(--ink-secondary)]">
 Experiment: {String(data.experimentId)}
 </p>
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <caption className="sr-only">Assignment diagnostics</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2">
 Variant
 </th>
 <th scope="col" className="py-2">
 Eligible
 </th>
 <th scope="col" className="py-2">
 Would log exposure
 </th>
 <th scope="col" className="py-2">
 Preview
 </th>
 </tr>
 </thead>
 <tbody>
 {diagnostics.map((d, i) => (
 <tr key={i} className="border-b border-border">
 <td className="py-2">
 {String(d.assignedVariantId ?? "Unavailable")}
 </td>
 <td className="py-2">
 {String((d.eligibility as { eligible?: boolean })?.eligible)}
 </td>
 <td className="py-2">{String(d.wouldLogExposure)}</td>
 <td className="py-2">{String(d.preview)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function ExposuresBody({ data }: { data: Record<string, unknown> }) {
 return (
 <>
 <Metric label="Exposures" value={data.total as number} />
 <p className="mt-2 text-sm text-[var(--ink-secondary)]">
 Dedupe mode: {String(data.dedupeMode)}
 </p>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function MetricsBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 id: string;
 displayName: string;
 type: string;
 dataAvailability: string;
 direction: string;
 guardrailSuitable: boolean;
 }>) ?? [];
 return (
 <>
 <div className="overflow-x-auto">
 <table className="w-full min-w-[640px] text-left text-sm">
 <caption className="sr-only">Metric registry</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2">
 Metric
 </th>
 <th scope="col" className="py-2">
 Type
 </th>
 <th scope="col" className="py-2">
 Availability
 </th>
 <th scope="col" className="py-2">
 Direction
 </th>
 <th scope="col" className="py-2">
 Guardrail
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((m) => (
 <tr key={m.id} className="border-b border-border">
 <td className="py-2">
 {m.displayName}
 <div className="text-xs text-muted-foreground">{m.id}</div>
 </td>
 <td className="py-2">{m.type}</td>
 <td className="py-2">{m.dataAvailability}</td>
 <td className="py-2">{m.direction}</td>
 <td className="py-2">{m.guardrailSuitable ? "yes" : "no"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function ResultsBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 experimentId: string;
 status: string;
 primaryResult: string;
 srm: { status: string };
 stopping: { recommendation: string };
 }>) ?? [];
 return (
 <>
 <div className="overflow-x-auto">
 <table className="w-full text-left text-sm">
 <caption className="sr-only">Experiment results</caption>
 <thead>
 <tr className="border-b border-border text-[var(--ink-secondary)]">
 <th scope="col" className="py-2">
 Experiment
 </th>
 <th scope="col" className="py-2">
 Status
 </th>
 <th scope="col" className="py-2">
 Primary
 </th>
 <th scope="col" className="py-2">
 SRM
 </th>
 <th scope="col" className="py-2">
 Stopping
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((r) => (
 <tr key={r.experimentId} className="border-b border-border">
 <td className="py-2">{r.experimentId}</td>
 <td className="py-2">{r.status}</td>
 <td className="py-2 text-[var(--ink-secondary)]">{r.primaryResult}</td>
 <td className="py-2">{r.srm?.status}</td>
 <td className="py-2">{r.stopping?.recommendation}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function GuardrailsBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 experimentId: string;
 guardrails: Array<{ metricId: string; status: string; explanation: string }>;
 }>) ?? [];
 return (
 <>
 {items.map((row) => (
 <section key={row.experimentId} className="mb-6">
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">
 {row.experimentId}
 </h2>
 <ul className="mt-2 space-y-1 text-sm">
 {row.guardrails.map((g) => (
 <li key={g.metricId}>
 <span aria-label={`Guardrail status ${g.status}`}>
 {g.metricId}: {g.status}
 </span>{""}
 — {g.explanation}
 </li>
 ))}
 </ul>
 </section>
 ))}
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function IssuesBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 code: string;
 severity: string;
 experimentId: string;
 explanation: string;
 remediation: string;
 }>) ?? [];
 return (
 <ul className="space-y-3">
 {items.map((i) => (
 <li
 key={`${i.code}-${i.experimentId}`}
 className="rounded-lg border border-border bg-card p-4"
 >
 <p className="text-xs uppercase tracking-label text-muted-foreground">
 <span className="sr-only">Severity </span>
 {i.severity} · {i.code}
 </p>
 <p className="mt-1 font-medium">{i.explanation}</p>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">{i.experimentId}</p>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 Remediation: {i.remediation}
 </p>
 </li>
 ))}
 </ul>
 );
}

function MethodologyBody({ data }: { data: Record<string, unknown> }) {
 return (
 <>
 <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-xs text-[var(--ink-secondary)]">
 {JSON.stringify(data.methodology, null, 2)}
 </pre>
 <Notes notes={data.notes as string[]} />
 </>
 );
}

function AuditBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 experimentId: string;
 events: Array<{ action: string; actor: string; timestamp: string }>;
 }>) ?? [];
 return (
 <>
 {items.map((row) => (
 <section key={row.experimentId} className="mb-4">
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">
 {row.experimentId}
 </h2>
 <ul className="mt-1 text-sm text-[var(--ink-secondary)]">
 {row.events.map((e, idx) => (
 <li key={idx}>
 {e.timestamp}: {e.action} by {e.actor}
 </li>
 ))}
 </ul>
 </section>
 ))}
 <Notes notes={data.notes as string[]} />
 </>
 );
}
