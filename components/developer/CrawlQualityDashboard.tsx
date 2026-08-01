import type { CrawlFindingCategory, CrawlQualityReport } from "@/lib/crawl-quality";
import { filterCrawlFindings } from "@/lib/crawl-quality";

const CATEGORIES: CrawlFindingCategory[] = [
  "inventory",
  "links",
  "orphans",
  "canonical",
  "hreflang",
  "breadcrumbs",
  "thin",
  "schema",
  "sitemap",
  "a11y",
  "metrics",
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <p className="text-metadata uppercase tracking-label text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

export function CrawlQualityDashboard({
  report,
  filters,
}: {
  report: CrawlQualityReport;
  filters: { category?: string; severity?: string; q?: string };
}) {
  const findings = filterCrawlFindings(report.findings, filters);
  const errors = report.findings.filter((row) => row.severity === "error").length;
  const warnings = report.findings.filter((row) => row.severity === "warning").length;
  const m = report.metrics;

  const sectionFindings = (category: CrawlFindingCategory) =>
    findings.filter((f) => f.category === category).slice(0, 40);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
      <header className="border-b border-border pb-6">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Developer · Crawl quality
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">SEO & crawl integrity</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Read-only inventory, internal links, canonicals, hreflang, breadcrumbs, schema and
          sitemap audits. Generated {report.generatedAt}. Status: <strong>{report.status}</strong>
        </p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <StatCard label="Crawl quality" value={`${m.crawlQuality}%`} />
        <StatCard label="Internal link score" value={`${m.internalLinkScore}%`} />
        <StatCard label="Orphans" value={String(m.orphanCount)} />
        <StatCard label="Thin pages" value={String(m.thinPageCount)} />
        <StatCard label="Broken canonicals" value={String(m.brokenCanonicalCount)} />
        <StatCard label="Schema coverage" value={`${m.structuredDataCoverage}%`} />
        <StatCard label="Errors" value={String(errors)} />
        <StatCard label="Warnings" value={String(warnings)} />
      </section>

      <section className="mt-8" aria-labelledby="entity-coverage">
        <h2 id="entity-coverage" className="font-display text-xl font-semibold">
          Entity coverage
        </h2>
        <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
          {report.entityCoverage.map((row) => (
            <li key={row.entityType} className="flex justify-between gap-3 py-2">
              <span className="capitalize">{row.entityType}</span>
              <span className="font-mono text-muted-foreground">
                {row.count} · {row.orphans} orphans · {row.thin} thin
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="internal-links">
        <h2 id="internal-links" className="font-display text-xl font-semibold">
          Internal links
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Avg inbound {m.averageInboundLinks} · Avg outbound {m.averageOutboundLinks} ·{" "}
          {report.routes.length} public routes · {m.indexedEntityCount} indexed entities
        </p>
        <ul className="mt-3 max-h-64 overflow-auto divide-y divide-border border-y border-border text-sm">
          {report.linkStats
            .filter((row) => row.key.includes(":"))
            .slice(0, 30)
            .map((row) => (
              <li key={row.key} className="flex justify-between gap-3 py-1.5">
                <span className="truncate font-mono text-xs">{row.key}</span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  in {row.inbound} · out {row.outbound}
                </span>
              </li>
            ))}
        </ul>
      </section>

      {(
        [
          ["orphans", "Orphans"],
          ["thin", "Thin pages"],
          ["canonical", "Canonicals"],
          ["breadcrumbs", "Breadcrumbs"],
          ["schema", "Structured data"],
          ["hreflang", "Hreflang"],
          ["sitemap", "Sitemaps"],
        ] as const
      ).map(([category, title]) => {
        const rows = sectionFindings(category);
        return (
          <section key={category} className="mt-8" aria-labelledby={`sec-${category}`}>
            <h2 id={`sec-${category}`} className="font-display text-xl font-semibold">
              {title}
            </h2>
            {rows.length ? (
              <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
                {rows.map((finding) => (
                  <li key={finding.id} className="py-2">
                    <p className="font-medium text-foreground">
                      [{finding.severity}] {finding.category}
                    </p>
                    <p className="text-muted-foreground">{finding.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No findings in this filter.</p>
            )}
          </section>
        );
      })}

      <section className="mt-8" aria-labelledby="all-findings">
        <h2 id="all-findings" className="font-display text-xl font-semibold">
          All findings
        </h2>
        <form className="mt-3 flex flex-wrap gap-2 text-sm" method="get">
          <select
            name="category"
            defaultValue={filters.category ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1"
            aria-label="Filter category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            name="severity"
            defaultValue={filters.severity ?? ""}
            className="rounded-md border border-border bg-background px-2 py-1"
            aria-label="Filter severity"
          >
            <option value="">All severities</option>
            <option value="pass">pass</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
          </select>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search findings"
            className="min-w-[12rem] flex-1 rounded-md border border-border bg-background px-2 py-1"
            aria-label="Search findings"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1 font-medium hover:bg-muted"
          >
            Filter
          </button>
        </form>
        <ul className="mt-3 max-h-96 overflow-auto divide-y divide-border border-y border-border text-sm">
          {findings.slice(0, 100).map((finding) => (
            <li key={finding.id} className="py-2">
              <p className="font-medium">
                [{finding.severity}] {finding.category} · {finding.id}
              </p>
              <p className="text-muted-foreground">{finding.message}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
