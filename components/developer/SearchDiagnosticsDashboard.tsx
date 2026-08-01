import type { SearchDiagnostics } from "@/lib/search";

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

export function SearchDiagnosticsDashboard({
  diagnostics,
}: {
  diagnostics: SearchDiagnostics;
}) {
  const cacheLabel = diagnostics.cacheStatus.warm
    ? `warm · age ${diagnostics.cacheStatus.ageMs ?? 0} ms`
    : "cold";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
      <header className="border-b border-border pb-6">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Developer · Search
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Search diagnostics
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Read-only index and discovery metrics for the unified entity search layer.
          Cache: <strong>{cacheLabel}</strong> (TTL {diagnostics.cacheStatus.ttlMs} ms).
        </p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <StatCard label="Index size" value={String(diagnostics.indexSize)} />
        <StatCard
          label="Avg lookup"
          value={`${diagnostics.averageLookupMs} ms`}
        />
        <StatCard label="Lookup samples" value={String(diagnostics.lookupSamples)} />
        <StatCard
          label="Cache built"
          value={
            diagnostics.cacheStatus.builtAt
              ? new Date(diagnostics.cacheStatus.builtAt).toISOString()
              : "—"
          }
        />
      </section>

      <section className="mt-8" aria-labelledby="entity-counts">
        <h2 id="entity-counts" className="font-display text-xl font-semibold">
          Entity counts
        </h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          {Object.entries(diagnostics.entityCounts).map(([key, value]) => (
            <div key={key} className="rounded-md border border-border px-3 py-2">
              <dt className="text-metadata uppercase tracking-label text-muted-foreground">
                {key}
              </dt>
              <dd className="mt-1 font-mono font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <CountList
        title="Top queries"
        rows={diagnostics.topQueries.map((row) => ({
          label: row.query,
          count: row.count,
        }))}
      />
      <CountList
        title="Zero-result queries"
        rows={diagnostics.zeroResultQueries.map((row) => ({
          label: row.query,
          count: row.count,
        }))}
      />
      <CountList
        title="Most clicked entities"
        rows={diagnostics.mostClickedEntities.map((row) => ({
          label: `${row.entityType}:${row.entitySlug}`,
          count: row.count,
        }))}
      />

      <section className="mt-8" aria-labelledby="discovery-metrics">
        <h2 id="discovery-metrics" className="font-display text-xl font-semibold">
          Discovery metrics
        </h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          {(
            [
              ["Teams", diagnostics.discovery.mostViewedTeams],
              ["Competitions", diagnostics.discovery.mostViewedCompetitions],
              ["Markets", diagnostics.discovery.mostViewedMarkets],
              ["Operators", diagnostics.discovery.mostViewedOperators],
              ["Seasons", diagnostics.discovery.mostViewedSeasons],
            ] as const
          ).map(([label, rows]) => (
            <CountList
              key={label}
              title={`Most viewed ${label.toLowerCase()}`}
              rows={rows.map((row) => ({ label: row.slug, count: row.count }))}
            />
          ))}
          <CountList
            title="Most clicked relationships"
            rows={diagnostics.discovery.mostClickedRelationships.map((row) => ({
              label: row.key,
              count: row.count,
            }))}
          />
        </div>
      </section>
    </main>
  );
}
