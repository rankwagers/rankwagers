import type { AccaBuilderResult } from "./contracts";

/** Compact log-safe summary — never includes secrets or raw provider payloads. */
export function summarizeBuilderResult(result: AccaBuilderResult): {
  requestId: string;
  snapshotId: string;
  status: AccaBuilderResult["status"];
  candidateCount: number;
  eligibleCount: number;
  combinationCount: number;
  topExclusions: string[];
} {
  return {
    requestId: result.requestId,
    snapshotId: result.snapshotId,
    status: result.status,
    candidateCount: result.candidateCount,
    eligibleCount: result.eligibleCount,
    combinationCount: result.combinations.length,
    topExclusions: Object.entries(result.exclusionSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, v]) => `${k}:${v}`),
  };
}
