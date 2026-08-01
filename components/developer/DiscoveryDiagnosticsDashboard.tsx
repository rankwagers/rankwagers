import type { DiscoveryDiagnostics } from "@/lib/discovery";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <p className="text-metadata uppercase tracking-label text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function CountList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex justify-between gap-3 py-2">
              <span className="truncate">{row.label}</span>
              <span className="font-mono text-muted-foreground">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Not yet recorded.</p>
      )}
    </section>
  );
}

export function DiscoveryDiagnosticsDashboard({
  diagnostics,
}: {
  diagnostics: DiscoveryDiagnostics;
}) {
  const cacheLabel = diagnostics.cache.warm
    ? `warm · age ${diagnostics.cache.ageMs ?? 0} ms`
    : "cold";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
      <header className="border-b border-border pb-6">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Developer · Discovery
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Discovery diagnostics
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Read-only recommendation metrics. Cache: <strong>{cacheLabel}</strong>{" "}
          (TTL {diagnostics.cache.ttlMs} ms).
        </p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <StatCard
          label="Avg traversal"
          value={`${diagnostics.averageTraversalMs} ms`}
        />
        <StatCard
          label="Traversal samples"
          value={String(diagnostics.traversalSamples)}
        />
        <StatCard
          label="CTR"
          value={String(diagnostics.ctr.rate)}
        />
        <StatCard
          label="Impressions / clicks"
          value={`${diagnostics.ctr.impressions} / ${diagnostics.ctr.clicks}`}
        />
      </section>

      <CountList
        title="Recommendation counts"
        rows={Object.entries(diagnostics.recommendationCounts).map(([label, count]) => ({
          label,
          count,
        }))}
      />
      <CountList
        title="Relationship sources"
        rows={diagnostics.relationshipSources.map((row) => ({
          label: row.relationship,
          count: row.count,
        }))}
      />
      <CountList
        title="Popular entities"
        rows={diagnostics.popularEntities.map((row) => ({
          label: row.key,
          count: row.count,
        }))}
      />

      <section className="mt-8" aria-labelledby="recent-metrics">
        <h2 id="recent-metrics" className="font-display text-xl font-semibold">
          Recently viewed metrics
        </h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded-md border border-border px-3 py-2">
            <dt className="text-metadata uppercase tracking-label text-muted-foreground">Writes</dt>
            <dd className="mt-1 font-mono font-semibold">
              {diagnostics.recentlyViewedMetrics.writes}
            </dd>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <dt className="text-metadata uppercase tracking-label text-muted-foreground">Reads</dt>
            <dd className="mt-1 font-mono font-semibold">
              {diagnostics.recentlyViewedMetrics.reads}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
