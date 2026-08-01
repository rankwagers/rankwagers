import type { TransparencyMetrics } from "@/lib/archive/types";
import { StatusBadge } from "@/components/homepage/sectionChrome";
import Link from "next/link";
import { methodologyPath } from "@/lib/archive/links";

export function TransparencyDashboard({
  metrics,
  locale,
  headingId = "transparency-heading",
}: {
  metrics: TransparencyMetrics;
  locale: string;
  headingId?: string;
}) {
  return (
    <section
      aria-labelledby={headingId}
      data-analytics-section="transparency"
      className="rounded-xl border border-border bg-[var(--canvas-secondary)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-metadata font-medium uppercase tracking-label text-brand">
            Transparency
          </p>
          <h2 id={headingId} className="mt-1 font-display text-xl font-semibold">
            Verified archive performance
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">{metrics.windowLabel}</p>
        </div>
        <Link
          href={methodologyPath(locale)}
          className="text-sm font-semibold text-brand hover:underline"
        >
          Read methodology
        </Link>
      </div>

      {metrics.availability === "unavailable" ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          {metrics.sampleNote}
        </p>
      ) : (
        <>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Total predictions" value={String(metrics.totalPredictions)} />
            <Metric label="Settled" value={String(metrics.settledPredictions)} />
            <Metric
              label="Won / Lost"
              value={`${metrics.won} / ${metrics.lost}`}
            />
            <Metric
              label="Hit rate (settled)"
              value={
                metrics.hitRatePct != null ? `${metrics.hitRatePct}%` : "—"
              }
            />
            <Metric label="Pending" value={String(metrics.pendingPredictions)} />
            <Metric label="Void" value={String(metrics.voidPredictions)} />
            <Metric label="Average odds" value="Unavailable" />
            <Metric
              label="Last archive update"
              value={
                metrics.lastUpdatedAt
                  ? new Date(metrics.lastUpdatedAt).toLocaleString()
                  : "—"
              }
            />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">{metrics.sampleNote}</p>

          {metrics.byMarket.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">By market</h3>
              <ul className="mt-2 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
                {metrics.byMarket.map((row) => (
                  <li
                    key={row.marketKey}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>{row.marketLabel}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.won}W · {row.lost}L · {row.pending}P · {row.voided}V
                      {row.hitRatePct != null ? ` · ${row.hitRatePct}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {metrics.byCompetition.length ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold">Top competitions in sample</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {metrics.byCompetition.slice(0, 8).map((row) => (
                  <li
                    key={row.competition}
                    className="flex justify-between gap-3 text-[var(--ink-secondary)]"
                  >
                    <span>{row.competition}</span>
                    <span className="font-mono text-xs">
                      n={row.total}
                      {row.hitRatePct != null ? ` · ${row.hitRatePct}%` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge status="won" label="Wins included" />
            <StatusBadge status="lost" label="Losses included" />
            <StatusBadge status="void" label="Voids shown" />
            <StatusBadge status="pending" label="Pending shown" />
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-[var(--canvas-primary)] px-3 py-3">
      <dt className="text-metadata uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
