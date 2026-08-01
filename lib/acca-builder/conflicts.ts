import type { AccaBuilderCandidate } from "./contracts";

/** Contradictory pairs on the same fixture (deterministic). */
const CONTRADICTIONS: Array<[string, string]> = [
  // Builder list markets are all "over" styles — same-fixture multi-overs are correlated, not contradictory.
];

export function areContradictory(
  a: AccaBuilderCandidate,
  b: AccaBuilderCandidate
): boolean {
  if (a.matchId !== b.matchId) return false;
  if (a.id === b.id) return true;
  if (a.marketKey === b.marketKey) return true;
  const pair = `${a.marketKey}|${b.marketKey}`;
  const rev = `${b.marketKey}|${a.marketKey}`;
  return CONTRADICTIONS.some(
    ([x, y]) => `${x}|${y}` === pair || `${x}|${y}` === rev
  );
}

/** Same-match dependent markets — warn, optionally penalize. */
export function correlationWarning(
  legs: readonly AccaBuilderCandidate[]
): string[] {
  const warnings: string[] = [];
  const byMatch = new Map<number, AccaBuilderCandidate[]>();
  for (const leg of legs) {
    const list = byMatch.get(leg.matchId) ?? [];
    list.push(leg);
    byMatch.set(leg.matchId, list);
  }
  for (const [matchId, group] of byMatch) {
    if (group.length > 1) {
      warnings.push(
        `Same fixture ${matchId}: ${group.map((g) => g.marketLabel).join(" + ")} — correlated markets; not independent probabilities.`
      );
    }
    const keys = new Set(group.map((g) => g.marketKey));
    if (keys.has("over25") && keys.has("over15")) {
      warnings.push(
        `Fixture ${matchId}: Over 2.5 and Over 1.5 are dependent goal-line markets.`
      );
    }
    if (keys.has("fh") && (keys.has("over15") || keys.has("over25"))) {
      warnings.push(
        `Fixture ${matchId}: First-half and full-time goal markets are dependent.`
      );
    }
  }
  return warnings;
}

export function canAddToCombo(
  current: readonly AccaBuilderCandidate[],
  next: AccaBuilderCandidate,
  onePerFixture: boolean
): { ok: true } | { ok: false; reason: string } {
  for (const leg of current) {
    if (leg.id === next.id) return { ok: false, reason: "duplicate_selection" };
    if (areContradictory(leg, next)) {
      return { ok: false, reason: "contradictory_or_duplicate_market" };
    }
    if (onePerFixture && leg.matchId === next.matchId) {
      return { ok: false, reason: "one_selection_per_fixture" };
    }
  }
  return { ok: true };
}
