import type { MetricValue } from "@/lib/admin-dashboard";
import { formatMetric } from "@/lib/admin-dashboard";

export function MetricCard({
  label,
  metric,
}: {
  label: string;
  metric: MetricValue;
}) {
  const unavailable = !metric.available;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-label text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          unavailable ? "text-muted-foreground" : "text-foreground"
        }`}
        title={unavailable ? metric.reason : undefined}
      >
        {formatMetric(metric)}
      </p>
      {unavailable ? (
        <p className="mt-1 text-xs text-muted-foreground">{metric.reason}</p>
      ) : null}
    </div>
  );
}
