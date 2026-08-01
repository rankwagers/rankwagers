import type { EvidenceQualification } from "@/types/evidence";
import {
  evidenceArchiveTokens,
  qualificationBadgeClass,
} from "@/lib/evidence/presentation";
import {
  qualificationDescription,
  qualificationLabel,
} from "@/lib/evidence/qualification";

/**
 * Evidence qualification badge (Sprint 23).
 *
 * Boundary-neutral: no `"use client"`, no hooks, no Node imports.
 *
 * The qualification shown is the one stored on the snapshot at capture time. It is
 * never recomputed from today's thresholds — an archive that silently re-judges its own
 * history is not an archive.
 */
export function EvidenceQualificationBadge({
  qualification,
  className,
}: {
  qualification: EvidenceQualification;
  className?: string;
}) {
  const label = qualificationLabel(qualification);
  return (
    <span
      className={`${evidenceArchiveTokens.badge} ${qualificationBadgeClass(
        qualification
      )}${className ? ` ${className}` : ""}`}
      data-qualification={qualification}
      title={qualificationDescription(qualification)}
    >
      <span className="sr-only">{`Evidence qualification: ${label}`}</span>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
