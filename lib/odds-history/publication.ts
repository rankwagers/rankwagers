import { queryOddsHistory } from "./service";
import type { OddsHistoryRecord } from "./types";

/* ============================================================================
   PUBLICATION ODDS — the kickoff-freeze projection over `odds_history`.
   ----------------------------------------------------------------------------
   RECONCILIATION (commercial pass, Phase C): the durable odds-at-publication
   log is NOT a new store. The existing `odds_history` table (migration
   20260724) already carries exactly the required observation shape — operator
   (id + name), market, decimal, observed-at — written append-only by the
   odds-refresh cron via `appendFixtureOddsHistory` and served by
   /api/odds-history. What was missing is the FREEZE SEMANTICS, and that is a
   projection, not storage: a "publication odds" observation is one whose
   observed_at is strictly BEFORE the fixture's kickoff. The truth-pass freeze
   law extends here — a post-kickoff observation is a legitimate history row,
   but it is never a publication price, and no caller of this module can see
   one.
   ========================================================================== */

export type PublicationPrice = {
  operatorId: number;
  operatorName: string;
  market: string;
  line: string;
  decimal: number;
  observedAt: string;
};

/**
 * Pure freeze: latest pre-kickoff observation per (operator, market).
 * An invalid kickoff freezes EVERYTHING out — fail closed, never fail open.
 */
export function freezeAtKickoff(
  records: readonly OddsHistoryRecord[],
  kickoffIso: string | null | undefined
): PublicationPrice[] {
  const kickoffMs = kickoffIso ? Date.parse(kickoffIso) : NaN;
  if (!Number.isFinite(kickoffMs)) return [];
  const latest = new Map<string, OddsHistoryRecord>();
  for (const record of records) {
    const observedMs = Date.parse(record.timestamp);
    if (!Number.isFinite(observedMs) || observedMs >= kickoffMs) continue;
    if (!Number.isFinite(record.odd) || record.odd <= 1) continue;
    const key = `${record.operatorId}:${record.market}:${record.line}`;
    const existing = latest.get(key);
    if (!existing || record.timestamp > existing.timestamp) latest.set(key, record);
  }
  return [...latest.values()]
    .map((record) => ({
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      market: record.market,
      line: record.line,
      decimal: record.odd,
      observedAt: record.timestamp,
    }))
    .sort(
      (a, b) =>
        a.market.localeCompare(b.market) ||
        b.decimal - a.decimal ||
        a.operatorId - b.operatorId
    );
}

/** The stored observations for one fixture, frozen at its kickoff. */
export async function publicationOddsForFixture(
  fixtureId: number,
  kickoffIso: string | null | undefined
): Promise<PublicationPrice[]> {
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) return [];
  const kickoffMs = kickoffIso ? Date.parse(kickoffIso) : NaN;
  if (!Number.isFinite(kickoffMs)) return [];
  const records = await queryOddsHistory({ fixtureId, limit: 500 });
  return freezeAtKickoff(records, kickoffIso);
}
