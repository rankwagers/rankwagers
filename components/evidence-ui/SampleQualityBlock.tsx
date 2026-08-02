import type { SampleQualityView } from "@/lib/evidence-ui";
import { evidenceUiTokens } from "@/lib/evidence-ui/tokens";

/**
 * Sample quality.
 *
 * Every figure appears exactly once. The prose summary previously restated coverage, excluded and
 * unknown immediately above a grid listing the same three values — the reader met each number twice
 * and had to check they agreed. The grid is now the single presentation: aligned, tabular, scannable
 * in one pass, and carrying the qualified count the summary used to own.
 */
export function SampleQualityBlock({ sample }: { sample: SampleQualityView }) {
  const cells: Array<{ term: string; value: string }> = [
    { term: "Qualified", value: String(sample.sampleSize) },
    { term: "Eligible", value: String(sample.eligible) },
    { term: "Excluded", value: String(sample.skipped) },
    { term: "Unknown", value: String(sample.unknown) },
    {
      term: "Coverage",
      value: sample.coveragePercent == null ? "—" : `${sample.coveragePercent}%`,
    },
  ];

  return (
    <div aria-label="Sample quality">
      <p className={evidenceUiTokens.label}>{sample.label}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((cell) => (
          <div key={cell.term}>
            <dt className="text-metadata font-medium uppercase tracking-label text-muted-foreground">
              {cell.term}
            </dt>
            <dd className="mt-1 font-mono text-body font-semibold tabular-nums text-foreground">
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
      {sample.note ? <p className={`mt-3 ${evidenceUiTokens.note}`}>{sample.note}</p> : null}
    </div>
  );
}
