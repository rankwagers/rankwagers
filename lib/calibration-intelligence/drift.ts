import type { DriftStatus } from "./contracts";

export type DriftCompare = {
  recentValue: number | null;
  priorValue: number | null;
  recentN: number;
  priorN: number;
  absoluteThreshold: number;
  minSample: number;
};

export function classifyDrift(input: DriftCompare): DriftStatus {
  if (input.recentN < input.minSample || input.priorN < input.minSample) {
    return "INSUFFICIENT_DATA";
  }
  if (input.recentValue == null || input.priorValue == null) {
    return "INSUFFICIENT_DATA";
  }
  const delta = Math.abs(input.recentValue - input.priorValue);
  if (delta >= input.absoluteThreshold * 2) return "MATERIAL_CHANGE";
  if (delta >= input.absoluteThreshold) return "WATCH";
  return "STABLE";
}

export function worstDriftStatus(statuses: DriftStatus[]): DriftStatus {
  const rank: Record<DriftStatus, number> = {
    MATERIAL_CHANGE: 4,
    WATCH: 3,
    STABLE: 2,
    INSUFFICIENT_DATA: 1,
  };
  let best: DriftStatus = "INSUFFICIENT_DATA";
  for (const s of statuses) {
    if (rank[s] > rank[best]) best = s;
  }
  return best;
}
