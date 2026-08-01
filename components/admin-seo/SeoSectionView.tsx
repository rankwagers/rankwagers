import { Suspense } from "react";
import type {
 SeoOverview,
 SeoSection,
 SeoIssue,
 SeoUrlRecord,
} from "@/lib/seo-intelligence";
import { parseSeoFilters } from "@/lib/seo-intelligence/filters";
import { getSeoSection } from "@/lib/seo-intelligence/service";
import { trackAdminSeoAnalytics } from "@/lib/seo-intelligence/analytics";
import { PAGE_TYPE_CONTRACTS } from "@/lib/seo-intelligence/page-types";
import { SeoShell } from "./SeoShell";
import { SeoFiltersBar } from "./SeoFilters";

const TITLES: Record<SeoSection, string> = {
 overview: "SEO overview",
 urls: "URL inventory", "page-types": "Page-type contracts",
 issues: "SEO issues",
 sitemaps: "Sitemap intelligence", "structured-data": "Structured data", "internal-links": "Internal links", "content-quality": "Content quality",
};

export async function SeoSectionView({
 section,
 searchParams,
 path,
}: {
 section: SeoSection;
 searchParams?: Record<string, string | string[] | undefined>;
 path: string;
}) {
 const filters = parseSeoFilters(searchParams ?? null);
 trackAdminSeoAnalytics("admin_seo_viewed", { section });
 const data = await getSeoSection(section, filters);

 return (
 <SeoShell title={TITLES[section]} activePath={path}>
 <Suspense
 fallback={
 <p className="mb-6 text-sm text-muted-foreground" role="status">
 Loading filters…
 </p>
 }
 >
 <SeoFiltersBar section={section} />
 </Suspense>
 {section === "overview" ? (
 <OverviewBody data={data as unknown as SeoOverview} />
 ) : null}
 {section === "urls" ? <UrlsBody data={data} /> : null}
 {section === "page-types" ? <PageTypesBody data={data} /> : null}
 {section === "issues" ? <IssuesBody data={data} /> : null}
 {section === "sitemaps" ? <SitemapsBody data={data} /> : null}
 {section === "structured-data" ? <SchemaBody data={data} /> : null}
 {section === "internal-links" ? <LinksBody data={data} /> : null}
 {section === "content-quality" ? <QualityBody data={data} /> : null}
 </SeoShell>
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
 <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
 </div>
 );
}

function OverviewBody({ data }: { data: SeoOverview }) {
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Discovered URLs" value={data.totalUrls} />
 <Metric label="INDEX" value={data.indexable} />
 <Metric label="NOINDEX" value={data.noindex} />
 <Metric label="EXCLUDED" value={data.excluded} />
 <Metric label="REDIRECT" value={data.redirects} />
 <Metric label="REVIEW" value={data.reviewRequired} tone="warn" />
 <Metric label="Critical issues" value={data.criticalIssues} tone="danger" />
 <Metric label="High issues" value={data.highIssues} tone="warn" />
 <Metric label="Sitemap health" value={data.sitemapHealth} />
 <Metric label="Schema health" value={data.schemaHealth} />
 <Metric label="Orphans" value={data.orphanCount} />
 <Metric label="Thin candidates" value={data.thinPageCount} />
 <Metric label="Duplicate titles" value={data.duplicateMetadataCount} />
 <Metric label="Stale" value={data.stalePageCount} />
 </div>
 <p className="mt-4 text-sm text-[var(--ink-secondary)]">
 Rule version {data.ruleVersion} · Last audit {data.lastAuditAt}
 </p>
 <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--ink-secondary)]">
 {data.notes.map((n) => (
 <li key={n}>{n}</li>
 ))}
 </ul>
 </>
 );
}

function UrlsBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as SeoUrlRecord[]) || [];
 const total = Number(data.total ?? 0);
 return (
 <>
 <p className="mb-3 text-sm text-[var(--ink-secondary)]" role="status">
 Showing {items.length} of {total} URLs (server-paginated)
 </p>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">SEO URL inventory</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">
 Path
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Type
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Indexability
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Reasons
 </th>
 <th scope="col" className="px-3 py-2 text-right">
 Sitemap
 </th>
 <th scope="col" className="px-3 py-2 text-right">
 Inbound
 </th>
 <th scope="col" className="px-3 py-2 text-right">
 Quality
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((row) => (
 <tr key={row.path} className="border-t border-border">
 <td className="px-3 py-2 font-mono text-xs">{row.path}</td>
 <td className="px-3 py-2">{row.pageType}</td>
 <td className="px-3 py-2">
 <span aria-label={`Indexability ${row.indexability}`}>
 {row.indexability}
 </span>
 </td>
 <td className="px-3 py-2 text-xs text-[var(--ink-secondary)]">
 {row.reasonCodes.join(", ")}
 </td>
 <td className="px-3 py-2 text-right">
 {row.sitemapIncluded ? "yes" : "no"}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.inboundLinks}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {row.quality.total ?? "—"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}

function PageTypesBody({ data }: { data: Record<string, unknown> }) {
 const counts = (data.counts as Record<string, number>) || {};
 return (
 <div className="space-y-4">
 {PAGE_TYPE_CONTRACTS.map((c) => (
 <section
 key={c.pageType}
 className="rounded-lg border border-border bg-card p-4"
 aria-labelledby={`pt-${c.pageType}`}
 >
 <h2 id={`pt-${c.pageType}`} className="font-semibold text-foreground">
 {c.label}{""}
 <span className="text-sm font-normal text-muted-foreground">
 ({c.pageType}) · n={counts[c.pageType] ?? 0}
 </span>
 </h2>
 <p className="mt-1 text-sm text-[var(--ink-secondary)]">
 Default: {c.defaultIndexability} · Sitemap:{""}
 {c.sitemapEligible ? "eligible" : "excluded"} · Schema:{""}
 {c.schemaTypes.join(", ") || "none"}
 </p>
 <p className="mt-2 text-sm text-[var(--ink-secondary)]">
 Min content: {c.minimumContent.join(";")}
 </p>
 <p className="mt-1 text-xs text-muted-foreground">Stale: {c.staleBehavior}</p>
 </section>
 ))}
 </div>
 );
}

function IssuesBody({ data }: { data: Record<string, unknown> }) {
 const items = (data.items as SeoIssue[]) || [];
 const total = Number(data.total ?? 0);
 return (
 <>
 <p className="mb-3 text-sm text-[var(--ink-secondary)]" role="status">
 {total} issues (severity-sorted)
 </p>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">SEO issues</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">
 Severity
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Code
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 URL
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Explanation
 </th>
 </tr>
 </thead>
 <tbody>
 {items.map((row, i) => (
 <tr key={`${row.code}-${row.url}-${i}`} className="border-t border-border">
 <td className="px-3 py-2">
 <span
 className={
 row.severity === "CRITICAL"
 ? "text-[var(--red-primary)]"
 : row.severity === "HIGH"
 ? "text-[var(--amber-primary)]"
 : "text-[var(--ink-secondary)]"
 }
 >
 <span className="sr-only">Severity </span>
 {row.severity}
 </span>
 </td>
 <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
 <td className="max-w-[14rem] truncate px-3 py-2 text-xs">
 {row.url}
 </td>
 <td className="px-3 py-2 text-[var(--ink-secondary)]">{row.explanation}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}

function SitemapsBody({ data }: { data: Record<string, unknown> }) {
 const shards = (data.shards as Array<{ id: string; description: string }>) || [];
 const bad = (data.incorrectlyIncluded as string[]) || [];
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-3">
 <Metric label="Sitemap URLs" value={Number(data.urlCount ?? 0)} />
 <Metric label="Health" value={String(data.health ?? "—")} />
 <Metric label="Incorrect inclusions" value={bad.length} tone="danger" />
 </div>
 <p className="mt-4 text-sm text-[var(--ink-secondary)]">{String(data.lastGeneratedNote ?? "")}</p>
 <ul className="mt-4 space-y-2 text-sm">
 {shards.map((s) => (
 <li key={s.id} className="rounded border border-border px-3 py-2">
 <strong className="text-foreground">{s.id}</strong>
 <span className="text-[var(--ink-secondary)]"> — {s.description}</span>
 </li>
 ))}
 </ul>
 {bad.length ? (
 <div className="mt-6">
 <h2 className="text-sm font-semibold text-[var(--red-primary)]">Incorrectly included</h2>
 <ul className="mt-2 max-h-64 overflow-auto font-mono text-xs text-[var(--ink-secondary)]">
 {bad.slice(0, 40).map((u) => (
 <li key={u}>{u}</li>
 ))}
 </ul>
 </div>
 ) : null}
 </>
 );
}

function SchemaBody({ data }: { data: Record<string, unknown> }) {
 const issues = (data.issues as SeoIssue[]) || [];
 const types = (data.schemaTypesCovered as string[]) || [];
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-3">
 <Metric label="Health" value={String(data.health ?? "—")} />
 <Metric label="Generator issues" value={Number(data.generatorIssueCount ?? 0)} />
 <Metric label="Crawl errors" value={Number(data.crawlFindingErrors ?? 0)} />
 </div>
 <p className="mt-4 text-sm text-[var(--ink-secondary)]">
 Covered types: {types.join(", ")}
 </p>
 <ul className="mt-4 space-y-2 text-sm text-[var(--ink-secondary)]">
 {issues.slice(0, 30).map((i, idx) => (
 <li key={`${i.code}-${idx}`} className="rounded border border-border px-3 py-2">
 <span className="text-[var(--amber-primary)]">{i.severity}</span> {i.explanation}
 </li>
 ))}
 </ul>
 </>
 );
}

function LinksBody({ data }: { data: Record<string, unknown> }) {
 const orphans =
 (data.topOrphans as Array<{ key: string; path: string; inbound: number }>) ||
 [];
 return (
 <>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Metric label="Routes" value={Number(data.routeCount ?? 0)} />
 <Metric label="Edges" value={Number(data.edgeCount ?? 0)} />
 <Metric label="Orphans" value={Number(data.orphanCount ?? 0)} tone="warn" />
 <Metric label="Avg inbound" value={Number(data.averageInbound ?? 0)} />
 </div>
 <div className="mt-6 overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Orphan and near-orphan paths</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">
 Path
 </th>
 <th scope="col" className="px-3 py-2 text-right">
 Inbound
 </th>
 </tr>
 </thead>
 <tbody>
 {orphans.map((o) => (
 <tr key={o.key} className="border-t border-border">
 <td className="px-3 py-2 font-mono text-xs">{o.path}</td>
 <td className="px-3 py-2 text-right tabular-nums">{o.inbound}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}

function QualityBody({ data }: { data: Record<string, unknown> }) {
 const thin = (data.thinCandidates as SeoUrlRecord[]) || [];
 return (
 <>
 <p className="mb-4 text-sm text-[var(--ink-secondary)]">{String(data.scoringNote ?? "")}</p>
 <div className="overflow-x-auto rounded-lg border border-border">
 <table className="w-full text-sm">
 <caption className="sr-only">Thin content candidates</caption>
 <thead className="bg-card text-xs uppercase text-muted-foreground">
 <tr>
 <th scope="col" className="px-3 py-2 text-left">
 Path
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Type
 </th>
 <th scope="col" className="px-3 py-2 text-left">
 Signals
 </th>
 <th scope="col" className="px-3 py-2 text-right">
 Score
 </th>
 </tr>
 </thead>
 <tbody>
 {thin.map((u) => (
 <tr key={u.path} className="border-t border-border">
 <td className="px-3 py-2 font-mono text-xs">{u.path}</td>
 <td className="px-3 py-2">{u.pageType}</td>
 <td className="px-3 py-2 text-xs text-[var(--ink-secondary)]">
 {u.contentSignals.join(";") || "—"}
 </td>
 <td className="px-3 py-2 text-right tabular-nums">
 {u.quality.total ?? "—"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </>
 );
}
