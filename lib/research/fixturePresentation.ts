import type { FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import { formatKickoff, formatRelativeUpdate, type DateInput } from "@/lib/dates";

/**
 * Presentation-only transformations for research fixtures.
 * Keeping these pure makes the API-to-interface boundary testable and prevents
 * raw provider values (notably Unix timestamps) from leaking into components.
 */
export type ConfidenceTier = "high" | "moderate" | "watch";

export function marketForListKind(kind: MatchListKind) {
  if (kind === "fh") return { label: "1st Half Over 0.5", code: "1H 0.5" };
  if (kind === "over15") return { label: "Over 1.5 Goals", code: "O1.5" };
  if (kind === "over25") return { label: "Over 2.5 Goals", code: "O2.5" };
  return { label: "2nd Half Over 0.5", code: "2H 0.5" };
}

export function confidenceForListKind(row: FootyMatchRow, kind: MatchListKind): number {
  if (kind === "fh") return row.fhOver05Pct;
  if (kind === "over15") return row.over15Pct;
  if (kind === "over25") return row.over25Pct;
  return row.shOver05Pct;
}

/** Design Bible §12.2 confidence thresholds. */
export function confidenceTier(confidence: number): ConfidenceTier {
  if (confidence >= 72) return "high";
  if (confidence >= 45) return "moderate";
  return "watch";
}

export function formatFixtureKickoff(input: DateInput, locale = "en-GB", timeZone?: string): string {
  if (typeof input === "number" && input <= 0) return "Kickoff time pending";
  try {
    return formatKickoff(input, { locale, timeZone });
  } catch {
    return "Kickoff time pending";
  }
}

export function formatFixtureUpdate(input: DateInput, now?: DateInput): string {
  try {
    return formatRelativeUpdate(input, { ...(now !== undefined ? { now } : {}) });
  } catch {
    return "Update time pending";
  }
}

export function decimalOddsToImpliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds <= 1) {
    throw new Error("Decimal odds must be greater than 1");
  }
  return 1 / odds;
}

export function calculateStatisticalEdge(
  modelProbability: number,
  impliedProbability: number
): number {
  if (!Number.isFinite(modelProbability) || !Number.isFinite(impliedProbability)) {
    throw new Error("Probabilities must be finite");
  }
  return modelProbability - impliedProbability;
}
