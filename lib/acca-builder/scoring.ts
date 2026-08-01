import type { AccaBuilderCandidate, AccaBuilderConfig } from "./contracts";

/** Deterministic weighted score — same inputs + now → same score. */
export function scoreCandidate(
  candidate: AccaBuilderCandidate,
  config: AccaBuilderConfig,
  now = Date.now()
): AccaBuilderCandidate {
  const parts: Record<string, number> = {
    confidence: candidate.confidence * 0.55,
    evidence: candidate.evidenceCompleteness * 0.25,
    oddsPresence: candidate.odds != null ? 12 : 0,
    oddsFresh:
      candidate.oddsFreshness === "current"
        ? 8
        : candidate.oddsFreshness === "stale"
          ? -6
          : 0,
    kickoffSoon: kickoffBonus(candidate.kickoffAt, now),
  };

  // Mild diversity nudge by market preference order in config
  const marketIndex = config.markets.indexOf(candidate.marketKey);
  parts.marketPreference =
    marketIndex >= 0 ? Math.max(0, 6 - marketIndex) : 0;

  const roundedParts: Record<string, number> = {};
  for (const [k, v] of Object.entries(parts)) {
    roundedParts[k] = Math.round(v * 10) / 10;
  }
  const score =
    Math.round(
      Object.values(roundedParts).reduce((a, b) => a + b, 0) * 10
    ) / 10;

  return { ...candidate, score, scoreParts: roundedParts };
}

function kickoffBonus(kickoffAt: string, now: number): number {
  const t = Date.parse(kickoffAt);
  if (!Number.isFinite(t)) return 0;
  const hours = (t - now) / 3_600_000;
  if (hours < 0) return -20;
  if (hours < 6) return 4;
  if (hours < 36) return 8;
  if (hours < 72) return 5;
  return 2;
}

export function sortByScore(
  rows: readonly AccaBuilderCandidate[]
): AccaBuilderCandidate[] {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.confidence - a.confidence ||
      a.matchId - b.matchId ||
      a.marketKey.localeCompare(b.marketKey)
  );
}
