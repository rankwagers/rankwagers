import type { EvidenceMetricView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";
import { EvidenceStrengthBadge } from "./EvidenceStrengthBadge";
import { SampleQualityBlock } from "./SampleQualityBlock";
import { BaselineComparison } from "./BaselineComparison";

export function EvidenceCard({ metric }: { metric: EvidenceMetricView }) {
  return (
    <article className={evidenceUiTokens.card} aria-labelledby={`metric-${metric.id}`}>
      {/*
        One focal point. The metric name is a label, not a heading competing with its own value —
        the figure is what the card exists to show, so it takes the largest step and the name sits
        above it at label size.
      */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`metric-${metric.id}`} className={evidenceUiTokens.label}>
            {metric.metric}
          </h3>
          <p className={`mt-2 ${evidenceUiTokens.value}`} aria-label={`Value ${metric.displayValue}`}>
            {metric.displayValue}
          </p>
        </div>
        <EvidenceStrengthBadge strength={metric.strength} />
      </div>

      <div className="mt-5">
        <SampleQualityBlock sample={metric.sample} />
      </div>

      {metric.baseline ? (
        <div className="mt-4">
          <BaselineComparison baseline={metric.baseline} />
        </div>
      ) : null}

      {metric.qualificationSummary ? (
        <div className="mt-4">
          <p className={evidenceUiTokens.label}>Qualification</p>
          <p className="mt-1.5 text-body-sm leading-relaxed text-foreground">
            {metric.qualificationSummary}
          </p>
        </div>
      ) : null}

      {metric.notes ? <p className={`mt-4 ${evidenceUiTokens.note}`}>{metric.notes}</p> : null}

      {metric.updatedLabel ? (
        <p className="mt-4 text-metadata text-muted-foreground">Updated: {metric.updatedLabel}</p>
      ) : null}
    </article>
  );
}
