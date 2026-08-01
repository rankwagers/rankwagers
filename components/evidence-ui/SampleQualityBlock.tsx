import { formatSampleSummary, type SampleQualityView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";

export function SampleQualityBlock({ sample }: { sample: SampleQualityView }) {
  return (
    <div className="mt-2" aria-label="Sample quality">
      <p className={evidenceUiTokens.label}>{sample.label}</p>
      <p className="mt-1 text-sm text-foreground">{formatSampleSummary(sample)}</p>
      {sample.note ? <p className={`mt-1 ${evidenceUiTokens.note}`}>{sample.note}</p> : null}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Eligible</dt>
          <dd className="font-mono font-semibold">{sample.eligible}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Excluded</dt>
          <dd className="font-mono font-semibold">{sample.skipped}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unknown</dt>
          <dd className="font-mono font-semibold">{sample.unknown}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Coverage</dt>
          <dd className="font-mono font-semibold">
            {sample.coveragePercent == null ? "—" : `${sample.coveragePercent}%`}
          </dd>
        </div>
      </dl>
    </div>
  );
}
