import {
  evidenceStrengthLabel,
  strengthBadgeClass,
  type EvidenceStrength,
} from "@/lib/evidence-ui";

export function EvidenceStrengthBadge({
  strength,
}: {
  strength: EvidenceStrength;
}) {
  const label = evidenceStrengthLabel(strength);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-metadata font-medium uppercase tracking-label ${strengthBadgeClass(strength)}`}
      role="status"
      aria-label={`Evidence strength: ${label}`}
    >
      {label}
    </span>
  );
}
