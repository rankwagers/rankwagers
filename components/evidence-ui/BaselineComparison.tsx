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
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-base font-semibold text-foreground">{baseline.displayValue}</p>
        <p className="text-sm text-foreground" role="status">
          {relation}
          {baseline.deltaDisplay ? (
            <span className="ml-2 font-mono text-muted-foreground">({baseline.deltaDisplay})</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
