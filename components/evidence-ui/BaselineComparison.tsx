import {
  baselineRelationLabel,
  type BaselineView,
} from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";

export function BaselineComparison({ baseline }: { baseline: BaselineView }) {
  const relation = baselineRelationLabel(baseline.relation);
  return (
    <div className={evidenceUiTokens.cardMuted} aria-label={`Baseline comparison: ${relation}`}>
      <p className={evidenceUiTokens.label}>{baseline.label}</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="rw3-pct">
          {baseline.displayValue}
        </p>
        <p className="text-[13px]" style={{ color: "var(--muted)" }} role="status">
          {relation}
          {baseline.deltaDisplay ? (
            <span className="ml-2 tabular-nums" style={{ fontSize: 11, color: "var(--muted)" }}>
              {baseline.deltaDisplay}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
