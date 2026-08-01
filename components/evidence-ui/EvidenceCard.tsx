import type { EvidenceMetricView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";
import { EvidenceStrengthBadge } from "./EvidenceStrengthBadge";
import { SampleQualityBlock } from "./SampleQualityBlock";
import { BaselineComparison } from "./BaselineComparison";

export function EvidenceCard({ metric }: { metric: EvidenceMetricView }) {
  return (
    <article className={evidenceUiTokens.card} aria-labelledby={`metric-${metric.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`metric-${metric.id}`} className="text-sm font-semibold text-foreground">
            {metric.metric}
          </h3>
          <p className={`mt-1 ${evidenceUiTokens.value}`} aria-label={`Value ${metric.displayValue}`}>
            {metric.displayValue}
          </p>
        </div>
        <EvidenceStrengthBadge strength={metric.strength} />
      </div>

      <SampleQualityBlock sample={metric.sample} />

      {metric.baseline ? (
        <div className="mt-3">
          <BaselineComparison baseline={metric.baseline} />
        </div>
      ) : null}

      {metric.qualificationSummary ? (
        <p className="mt-2 text-xs text-foreground">
          <span className={evidenceUiTokens.label}>Qualification</span>
          <span className="mt-1 block">{metric.qualificationSummary}</span>
        </p>
      ) : null}

      {metric.notes ? <p className={`mt-2 ${evidenceUiTokens.note}`}>{metric.notes}</p> : null}

      {metric.updatedLabel ? (
        <p className="mt-2 text-metadata text-muted-foreground">Updated: {metric.updatedLabel}</p>
      ) : null}
    </article>
  );
}
