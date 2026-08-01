import type { DataQualityReport, FindingCategory, FindingSeverity } from "@/lib/data-quality";
import { filterFindings } from "@/lib/data-quality";

const CATEGORIES: FindingCategory[] = [
  "registry",
  "relationships",
  "resolvers",
  "provider",
  "coverage",
  "graph",
  "seo",
  "sitemap",
  "analytics",
  "routes",
];

export function DataQualityDashboard({
  report,
  filters,
}: {
  report: DataQualityReport;
  filters: { category?: string; severity?: string; q?: string };
}) {
  const findings = filterFindings(report.findings, filters);
  const errors = report.findings.filter((row) => row.severity === "error").length;
  const warnings = report.findings.filter((row) => row.severity === "warning").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
      <header className="border-b border-border pb-6">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Developer · Data quality
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Entity integrity</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Read-only diagnostics for registries, relationships, graph, SEO, sitemap and analytics.
          Generated {report.generatedAt}. Status: <strong>{report.status}</strong>
        </p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <ScoreCard label="Integrity" value={`${report.integrity.overall}%`} />
        <ScoreCard label="Errors" value={String(errors)} />
        <ScoreCard label="Warnings" value={String(warnings)} />
        <ScoreCard label="Findings" value={String(report.findings.length)} />
      </section>

      <section className="mt-8" aria-labelledby="scores">
        <h2 id="scores" className="font-display text-xl font-semibold">
          Integrity scorecard
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.integrity.categories.map((row) => (
            <li key={row.category} className="rounded-md border border-border px-3 py-3">
              <p className="text-metadata uppercase tracking-label text-muted-foreground">
                {row.category}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold">{row.score}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.pass} pass · {row.warning} warn · {row.error} error
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="coverage">
        <h2 id="coverage" className="font-display text-xl font-semibold">
          Coverage
        </h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {Object.entries(report.coverage).map(([key, value]) => (
            <div key={key} className="rounded-md border border-border px-3 py-2">
              <dt className="text-metadata uppercase tracking-label text-muted-foreground">{key}</dt>
              <dd className="mt-1 font-mono font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="filters">
        <h2 id="filters" className="font-display text-xl font-semibold">
          Findings
        </h2>
        <form className="mt-4 grid gap-3 md:grid-cols-4" method="get">
          <label className="text-sm">
            <span className="text-metadata uppercase tracking-label text-muted-foreground">Category</span>
            <select
              name="category"
              defaultValue={filters.category ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2"
            >
              <option value="">All</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-metadata uppercase tracking-label text-muted-foreground">Severity</span>
            <select
              name="severity"
              defaultValue={filters.severity ?? ""}
              className="mt-1 w-full rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2"
            >
              <option value="">All</option>
              {(["pass", "warning", "error"] as FindingSeverity[]).map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-metadata uppercase tracking-label text-muted-foreground">Search</span>
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="message, entity, id"
              className="mt-1 w-full rounded-md border border-border bg-[var(--canvas-secondary)] px-3 py-2"
            />
          </label>
          <div className="md:col-span-4">
            <button type="submit" className="btn-primary">
              Filter findings
            </button>
          </div>
        </form>

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {findings.length === 0 ? (
            <li className="py-6 text-sm text-muted-foreground">No findings match these filters.</li>
          ) : (
            findings.slice(0, 250).map((finding) => (
              <li key={finding.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    <SeverityBadge severity={finding.severity} /> {finding.message}
                  </p>
                  <p className="font-mono text-metadata text-muted-foreground">{finding.category}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {finding.entityType ?? "platform"}
                  {finding.entityId ? ` · ${finding.entityId}` : ""} · {finding.id}
                </p>
              </li>
            ))
          )}
        </ul>
        {findings.length > 250 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing first 250 of {findings.length} filtered findings.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <p className="text-metadata uppercase tracking-label text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const className =
    severity === "error"
      ? "text-[var(--red-primary)]"
      : severity === "warning"
        ? "text-[var(--amber-primary)]"
        : "text-[var(--green-deep)]";
  return <span className={`font-mono text-metadata uppercase ${className}`}>{severity}</span>;
}
