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
        <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {baseline.displayValue}
        </p>
        <p className="text-body-sm text-[var(--ink-secondary)]" role="status">
          {relation}
          {baseline.deltaDisplay ? (
            <span className="ml-2 font-mono tabular-nums text-muted-foreground">
              {baseline.deltaDisplay}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
