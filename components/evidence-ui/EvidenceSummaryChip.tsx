import {
  evidenceStrengthLabel,
  type EvidenceStrength,
} from "@/lib/evidence-ui";
import { strengthBadgeClass } from "@/lib/evidence-ui/tokens";

export function EvidenceSummaryChip({
  strength,
  sampleSize,
}: {
  strength: EvidenceStrength;
  sampleSize?: number;
}) {
  const label = evidenceStrengthLabel(strength);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-metadata font-medium ${strengthBadgeClass(strength)}`}
      title={
        sampleSize != null
          ? `Evidence strength ${label} · sample ${sampleSize}`
          : `Evidence strength ${label}`
      }
    >
      <span>{label}</span>
      {sampleSize != null ? (
        <span className="font-mono opacity-80">n={sampleSize}</span>
      ) : null}
    </span>
  );
}
