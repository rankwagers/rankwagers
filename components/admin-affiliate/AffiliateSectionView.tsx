import { Suspense } from "react";
import type {
 AffiliateIssue,
 AffiliateOverview,
 AffiliateSection,
 CampaignRecord,
 FunnelDefinition,
 OperatorRegistryRow,
 PlacementRecord,
} from "@/lib/affiliate-intelligence";
import { parseAffiliateFilters } from "@/lib/affiliate-intelligence/filters";
import { getAffiliateSection } from "@/lib/affiliate-intelligence/service";
import { trackAdminAffiliateAnalytics } from "@/lib/affiliate-intelligence/analytics";
import { AffiliateShell } from "./AffiliateShell";
import { AffiliateFiltersBar } from "./AffiliateFilters";

const TITLES: Record<AffiliateSection, string> = {
 overview: "Affiliate overview",
 operators: "Operator registry",
 placements: "Placement inventory",
 funnels: "Conversion funnels",
 campaigns: "Campaign governance",
 redirects: "Signed redirect health",
 availability: "Availability matrix",
 issues: "Affiliate issues",
 quality: "Operational quality",
};

export async function AffiliateSectionView({
 section,
 searchParams,
 path,
}: {
 section: AffiliateSection;
 searchParams?: Record<string, string | string[] | undefined>;
 path: string;
}) {
 const filters = parseAffiliateFilters(searchParams ?? null);
 trackAdminAffiliateAnalytics("admin_affiliate_viewed", { section });
 const data = await getAffiliateSection(section, filters);

 return (
 <AffiliateShell title={TITLES[section]} activePath={path}>
 <Suspense
 fallback={
 <p className="mb-6 text-sm text-muted-foreground" role="status">
 Loading filters…
 </p>
 }
 >
 <AffiliateFiltersBar section={section} />
 </Suspense>
 {section === "overview" ? (
 <OverviewBody data={data as unknown as AffiliateOverview} />
 ) : null}
 {section === "operators" ? <OperatorsBody data={data} /> : null}
 {section === "placements" ? <PlacementsBody data={data} /> : null}
 {section === "funnels" ? <FunnelsBody data={data} /> : null}
 {section === "campaigns" ? <CampaignsBody data={data} /> : null}
 {section === "redirects" ? <RedirectsBody data={data} /> : null}
 {section === "availability" ? <AvailabilityBody data={data} /> : null}
 {section === "issues" ? <IssuesBody data={data} /> : null}
 {section === "quality" ? <QualityBody data={data} /> : null}
 </AffiliateShell>
 );
}

function Metric({
 label,
 value,
 tone = "default",
}: {
 label: string;
 value: string | number;
 tone?: "default" | "danger" | "warn";
}) {
 const color =
 tone === "danger"
 ? "text-[var(--red-primary)]"
 : tone === "warn"
 ? "text-[var(--amber-primary)]"
 : "text-foreground";
 return (
 <div className="rounded-lg border border-border bg-card p-4">
 <p className="text-xs uppercase tracking-label text-muted-foreground">{label}</p>
 <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
 {value === null || value === undefined || value === ""
 ? "Unavailable"
 : value}
 </p>
 </div>
 );
}

function fmt(n: number | null | undefined): string {
 return n == null ? "Unavailable" : String(n);
}

function OverviewBody({ data }: { data: AffiliateOverview }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Active operators" value={data.activeOperators} />
 <Metric label="Disabled operators" value={data.disabledOperators} />
 <Metric label="Unknown availability" value={data.unknownAvailability} tone="warn" />
 <Metric label="Placements" value={data.totalPlacements} />
 <Metric label="CTA views" value={fmt(data.ctaViews)} />
 <Metric label="CTA clicks" value={fmt(data.ctaClicks)} />
 <Metric label="Redirects created" value={fmt(data.signedRedirectsCreated)} />
 <Metric label="Redirects resolved" value={fmt(data.redirectsResolved)} />
 <Metric label="Redirect failures" value={fmt(data.redirectFailures)} />
 <Metric label="Click→redirect %" value={fmt(data.clickToRedirectSuccessRate)} />
 <Metric label="Critical issues" value={data.criticalIssues} tone="danger" />
 <Metric label="High issues" value={data.highIssues} tone="warn" />
 </div>
 <p className="mt-4 text-sm text-[var(--ink-secondary)]">
 Rule {data.ruleVersion} · Last audit {data.lastAuditAt}
 </p>
 <div className="mt-6 grid gap-4 lg:grid-cols-2">
 <section className="rounded-lg border border-border p-4">
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">Top operators</h2>
 <ul className="mt-2 space-y-1 text-sm">
 {data.topOperators.length
 ? data.topOperators.map((o) => (
 <li key={o.operatorId} className="flex justify-between">
 <span>{o.operatorId}</span>
 <span className="tabular-nums text-[var(--ink-secondary)]">{o.redirects}</span>
 </li>
 ))
 : <li className="text-muted-foreground">Unavailable</li>}
 </ul>
 </section>
 <section className="rounded-lg border border-border p-4">
 <h2 className="text-sm font-semibold text-[var(--ink-secondary)]">Top placements</h2>
 <ul className="mt-2 space-y-1 text-sm">
 {data.topPlacements.length
 ? data.topPlacements.map((p) => (
 <li key={p.placementId} className="flex justify-between">
 <span>{p.placementId}</span>
 <span className="tabular-nums text-[var(--ink-secondary)]">{p.clicks}</span>
 </li>
 ))
 : <li className="text-muted-foreground">Unavailable</li>}
 </ul>
 </section>
 </div>
 <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 {data.notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 </>
 );
}

function OperatorsBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as OperatorRegistryRow[]) || [];
 return (
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Operator registry</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Operator</th>
 <th scope="col" className="px-3 py-2 text-left">Availability</th>
 <th scope="col" className="px-3 py-2 text-left">Reasons</th>
 <th scope="col" className="px-3 py-2 text-left">Destination</th>
 <th scope="col" className="px-3 py-2 text-left">Verified</th>
 </tr>
 </thead>
 <tbody>
 {items.map((o) => (
 <tr key={o.operatorId} className="border-t border-border">
 <td className="px-3 py-2">{o.displayName}</td>
 <td className="px-3 py-2">
 <span aria-label={`Availability ${o.availabilityDecision}`}>
 {o.availabilityDecision}
 </span>
 </td>
 <td className="px-3 py-2 text-xs text-[var(--ink-secondary)]">
 {o.reasonCodes.join(", ")}
 </td>
 <td className="px-3 py-2">
 {o.destinationConfigured ? "configured" : "missing"}
 </td>
 <td className="px-3 py-2">{o.verificationStatus}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function PlacementsBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as PlacementRecord[]) || [];
 return (
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Affiliate placements</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Placement</th>
 <th scope="col" className="px-3 py-2 text-left">Page</th>
 <th scope="col" className="px-3 py-2 text-left">Signing</th>
 <th scope="col" className="px-3 py-2 text-left">Dup risk</th>
 <th scope="col" className="px-3 py-2 text-left">Status</th>
 </tr>
 </thead>
 <tbody>
 {items.map((p) => (
 <tr key={p.placementId} className="border-t border-border">
 <td className="px-3 py-2 font-mono text-xs">{p.placementId}</td>
 <td className="px-3 py-2">{p.pageType}</td>
 <td className="px-3 py-2 text-xs text-[var(--ink-secondary)]">{p.signingMethod}</td>
 <td className="px-3 py-2">{p.duplicateCtaRisk}</td>
 <td className="px-3 py-2">{p.qualityStatus}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function FunnelsBody({ data }: { data: Record<string, unknown> }) {
 const funnels = (data.funnels as FunnelDefinition[]) || [];
 return (
 <>
 <p className="mb-4 text-sm text-[var(--ink-secondary)]">{String(data.disclaimer ?? "")}</p>
 <div className="space-y-6">
 {funnels.map((f) => (
 <section
 key={f.id}
 className="rounded-lg border border-border bg-card p-4"
 aria-labelledby={`funnel-${f.id}`}
 >
 <h2 id={`funnel-${f.id}`} className="font-semibold text-foreground">
 {f.label}
 </h2>
 <ol className="mt-3 space-y-2 text-sm">
 {f.steps.map((s, i) => (
 <li key={s.step} className="flex flex-wrap items-baseline gap-2">
 <span className="text-muted-foreground">{i + 1}.</span>
 <span>{s.step}</span>
 <span className="tabular-nums text-brand">
 {s.count == null ? "Unavailable" : s.count}
 </span>
 {s.reason ? (
 <span className="text-xs text-muted-foreground">{s.reason}</span>
 ) : null}
 </li>
 ))}
 </ol>
 <ul className="mt-3 list-disc pl-5 text-xs text-muted-foreground">
 {f.notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 </section>
 ))}
 </div>
 </>
 );
}

function CampaignsBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as CampaignRecord[]) || [];
 const notes = (data.notes as string[]) || [];
 return (
 <>
 <ul className="mb-4 list-disc pl-5 text-sm text-[var(--ink-secondary)]">
 {notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Campaigns</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Campaign</th>
 <th scope="col" className="px-3 py-2 text-left">Operator</th>
 <th scope="col" className="px-3 py-2 text-left">Status</th>
 <th scope="col" className="px-3 py-2 text-left">Destination</th>
 <th scope="col" className="px-3 py-2 text-left">Issue</th>
 </tr>
 </thead>
 <tbody>
 {items.map((c) => (
 <tr key={c.campaignId} className="border-t border-border">
 <td className="px-3 py-2 font-mono text-xs">{c.campaignId}</td>
 <td className="px-3 py-2">{c.operatorId}</td>
 <td className="px-3 py-2">{c.status}</td>
 <td className="px-3 py-2">
 {c.destinationMapped ? "mapped" : "missing"}
 </td>
 <td className="px-3 py-2 text-xs text-[var(--ink-secondary)]">{c.issueStatus}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}

function RedirectsBody({ data }: { data: Record<string, unknown> }) {
 const health = (data.health as Record<string, unknown>) || {};
 const diagnostics = (data.diagnostics as Record<string, unknown>) || {};
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Created" value={fmt(health.creationAttempts as number | null)} />
 <Metric label="Resolved" value={fmt(health.resolvedRedirects as number | null)} />
 <Metric label="Failures" value={fmt(health.validationFailures as number | null)} />
 <Metric label="Click→redirect %" value={fmt(health.clickToRedirectRate as number | null)} />
 <Metric label="Expired links" value="Unavailable" />
 <Metric label="Malformed links" value="Unavailable" />
 </div>
 <ul className="mt-4 space-y-1 text-sm text-[var(--ink-secondary)]">
 <li>
 go-path server-only:{""}
 {diagnostics.goPathServerOnly ? "yes" : "NO"}
 </li>
 <li>
 token server-only:{""}
 {diagnostics.redirectTokenServerOnly ? "yes" : "NO"}
 </li>
 <li>
 rejects client destination:{""}
 {diagnostics.goRejectsClientDestination ? "yes" : "NO"}
 </li>
 </ul>
 </>
 );
}

function AvailabilityBody({ data }: { data: Record<string, unknown> }) {
 const items =
 (data.items as Array<{
 operatorId: string;
 decision: string;
 reasonCodes: string[];
 supportedCountries: string[];
 destinationConfigured: boolean;
 }>) || [];
 const legend = (data.legend as string[]) || [];
 return (
 <>
 <ul className="mb-4 list-disc pl-5 text-xs text-muted-foreground">
 {legend.map((l) => (
 <li key={l}>{l}</li>
 ))}
 </ul>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Availability decisions</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Operator</th>
 <th scope="col" className="px-3 py-2 text-left">Decision</th>
 <th scope="col" className="px-3 py-2 text-left">Reasons</th>
 <th scope="col" className="px-3 py-2 text-left">Countries</th>
 </tr>
 </thead>
 <tbody>
 {items.map((o) => (
 <tr key={o.operatorId} className="border-t border-border">
 <td className="px-3 py-2">{o.operatorId}</td>
 <td className="px-3 py-2">{o.decision}</td>
 <td className="px-3 py-2 text-xs text-[var(--ink-secondary)]">
 {o.reasonCodes.join(", ")}
 </td>
 <td className="px-3 py-2 text-xs">
 {o.supportedCountries.length
 ? o.supportedCountries.join(", ")
 : "unrestricted / unknown"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}

function IssuesBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as AffiliateIssue[]) || [];
 return (
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Affiliate issues</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Severity</th>
 <th scope="col" className="px-3 py-2 text-left">Code</th>
 <th scope="col" className="px-3 py-2 text-left">Operator</th>
 <th scope="col" className="px-3 py-2 text-left">Explanation</th>
 </tr>
 </thead>
 <tbody>
 {items.map((i, idx) => (
 <tr key={`${i.code}-${idx}`} className="border-t border-border">
 <td className="px-3 py-2">
 <span
 className={
 i.severity === "CRITICAL"
 ? "text-[var(--red-primary)]"
 : i.severity === "HIGH"
 ? "text-[var(--amber-primary)]"
 : "text-[var(--ink-secondary)]"
 }
 >
 <span className="sr-only">Severity </span>
 {i.severity}
 </span>
 </td>
 <td className="px-3 py-2 font-mono text-xs">{i.code}</td>
 <td className="px-3 py-2">{i.operatorId ?? "—"}</td>
 <td className="px-3 py-2 text-[var(--ink-secondary)]">{i.explanation}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function QualityBody({ data }: { data: Record<string, unknown> }) {
 const operators =
 (data.operators as Array<{
 operatorId: string;
 displayName: string;
 quality: { total: number | null; purpose: string };
 }>) || [];
 return (
 <>
 <p className="mb-4 text-sm text-[var(--amber-primary)]" role="note">
 Internal operational scores only — not public “best operator” rankings.
 </p>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Operator quality scores</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">Operator</th>
 <th scope="col" className="px-3 py-2 text-right">Score</th>
 <th scope="col" className="px-3 py-2 text-left">Purpose</th>
 </tr>
 </thead>
 <tbody>
 {operators.map((o) => (
 <tr key={o.operatorId} className="border-t border-border">
 <td className="px-3 py-2">{o.displayName}</td>
 <td className="px-3 py-2 text-right tabular-nums">
 {o.quality.total ?? "Unavailable"}
 </td>
 <td className="px-3 py-2 text-xs text-muted-foreground">
 {o.quality.purpose}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}
