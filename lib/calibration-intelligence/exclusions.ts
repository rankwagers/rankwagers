/**
 * Builder exclusion aggregation.
 * Without durable candidate snapshots, exclusion reason tallies are Unavailable.
 */

export type ExclusionSummaryRow = {
  code: string;
  count: number | null;
  percentage: number | null;
  note: string;
  retrospectiveLabel: "RETROSPECTIVE_DIAGNOSTIC_ONLY" | null;
};

export function emptyExclusionSummary(): {
  available: false;
  rows: ExclusionSummaryRow[];
  notes: string[];
} {
  return {
    available: false,
    rows: [
      {
        code: "SNAPSHOT_MISSING",
        count: null,
        percentage: null,
        note: "Generation-time candidate exclusion snapshots are not persisted",
        retrospectiveLabel: null,
      },
    ],
    notes: [
      "Exclusion analysis requires immutable generation snapshots with eligible and excluded candidate populations.",
      "Analytics events do not carry exclusion reason codes or match identities.",
      "Any future retrospective settlement of excluded candidates must be labeled RETROSPECTIVE_DIAGNOSTIC_ONLY.",
    ],
  };
}

/** Aggregate exclusion codes when snapshot rows exist (unit-tested path). */
export function aggregateExclusionCodes(
  codes: string[],
): ExclusionSummaryRow[] {
  const map = new Map<string, number>();
  for (const c of codes) {
    map.set(c, (map.get(c) ?? 0) + 1);
  }
  const total = codes.length || 1;
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({
      code,
      count,
      percentage: count / total,
      note: "From provided snapshot population",
      retrospectiveLabel: null,
    }));
}
