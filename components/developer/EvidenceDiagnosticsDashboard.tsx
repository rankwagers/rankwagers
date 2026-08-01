import type { EvidenceDiagnostics } from "@/lib/evidence-ui";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <p className="text-metadata uppercase tracking-label text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

export function EvidenceDiagnosticsDashboard({
  diagnostics,
}: {
  diagnostics: EvidenceDiagnostics;
}) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-foreground">
      <header className="border-b border-border pb-6">
        <p className="text-metadata font-medium uppercase tracking-label text-brand">
          Developer · Evidence
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Evidence diagnostics</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Read-only coverage, sample quality, qualification and freshness signals. Generated{" "}
          {diagnostics.generatedAt}. No provider secrets.
        </p>
      </header>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Overview">
        <StatCard label="With evidence links" value={String(diagnostics.coverage.withEvidence)} />
        <StatCard label="Missing links" value={String(diagnostics.coverage.missing)} />
        <StatCard
          label="Qualification complete"
          value={String(diagnostics.qualification.complete)}
        />
        <StatCard
          label="Avg adapter ms"
          value={String(diagnostics.performance.averageAdapterMs)}
        />
      </section>

      <section className="mt-8" aria-labelledby="entity-breakdown">
        <h2 id="entity-breakdown" className="font-display text-xl font-semibold">
          Entity breakdown
        </h2>
        <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
          {diagnostics.entityBreakdown.map((row) => (
            <li key={row.entityType} className="flex justify-between gap-3 py-2">
              <span className="capitalize">{row.entityType}</span>
              <span className="font-mono text-muted-foreground">
                {row.metrics} entities · {row.lowSample} low sample
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="baselines">
        <h2 id="baselines" className="font-display text-xl font-semibold">
          Baselines
        </h2>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded-md border border-border px-3 py-2">
            <dt className="text-metadata uppercase tracking-label text-muted-foreground">Present</dt>
            <dd className="mt-1 font-mono font-semibold">{diagnostics.baselines.present}</dd>
          </div>
          <div className="rounded-md border border-border px-3 py-2">
            <dt className="text-metadata uppercase tracking-label text-muted-foreground">Missing</dt>
            <dd className="mt-1 font-mono font-semibold">{diagnostics.baselines.missing}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="findings">
        <h2 id="findings" className="font-display text-xl font-semibold">
          Findings
        </h2>
        {diagnostics.findings.length ? (
          <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
            {diagnostics.findings.map((finding) => (
              <li key={finding.id} className="py-2">
                <p className="font-medium text-foreground">
                  [{finding.severity}] {finding.category}
                </p>
                <p className="text-muted-foreground">{finding.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No findings.</p>
        )}
      </section>

      <section className="mt-8" aria-labelledby="cache">
        <h2 id="cache" className="font-display text-xl font-semibold">
          Performance
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cache entries: {diagnostics.performance.cacheEntries}
        </p>
      </section>
    </main>
  );
}
