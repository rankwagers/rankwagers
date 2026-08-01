import type { ExperimentDefinition } from "./contracts";

export type ConflictResolution = {
  allowedExperimentId: string | null;
  blockedExperimentIds: string[];
  reason: string;
};

/**
 * Deterministic conflict resolution: lexicographically smallest RUNNING id in group wins.
 */
export function resolveConflictGroup(
  candidates: ExperimentDefinition[],
  conflictGroup: string,
): ConflictResolution {
  const inGroup = candidates
    .filter(
      (d) =>
        d.conflictGroup === conflictGroup &&
        (d.status === "RUNNING" || d.status === "SCHEDULED"),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  if (inGroup.length === 0) {
    return {
      allowedExperimentId: null,
      blockedExperimentIds: [],
      reason: "no_active_conflict",
    };
  }
  const winner = inGroup[0];
  return {
    allowedExperimentId: winner.id,
    blockedExperimentIds: inGroup.slice(1).map((d) => d.id),
    reason: "lexicographic_primary_in_group",
  };
}

export function hasConflict(
  definition: ExperimentDefinition,
  activeOthers: ExperimentDefinition[],
): boolean {
  if (!definition.conflictGroup) return false;
  const resolution = resolveConflictGroup(
    [definition, ...activeOthers],
    definition.conflictGroup,
  );
  return (
    resolution.allowedExperimentId != null &&
    resolution.allowedExperimentId !== definition.id
  );
}
