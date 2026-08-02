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
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-metadata font-medium uppercase tracking-label ${strengthBadgeClass(strength)}`}
      role="status"
      aria-label={`Evidence strength: ${label}`}
    >
      {label}
    </span>
  );
}
