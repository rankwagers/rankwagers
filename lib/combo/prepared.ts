import type { DailyMatchLists } from "@/lib/footystats/types";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { createHash } from "node:crypto";
import { clearPreparedBookmakerQuotes } from "./bookmaker-quotes";
import { createMapOddsLookup, type OddsLookup } from "./candidates";

export type PreparedComboData = {
  snapshotId: string;
  fixtures?: QualifiedFixture[];
  lists?: DailyMatchLists;
  oddsLookup?: OddsLookup;
  preparedAt: string;
};

let prepared: PreparedComboData | null = null;

export function computeDataSnapshotId(input: {
  fixtures?: readonly QualifiedFixture[];
  lists?: DailyMatchLists;
  oddsKeys?: readonly string[];
}): string {
  const payload = JSON.stringify({
    date: input.lists?.date ?? null,
    fetchedAt: input.lists?.fetchedAt ?? null,
    fixtures: (input.fixtures ?? []).map((f) => `${f.matchId}:${f.marketKind}:${f.modelProbability}`),
    odds: input.oddsKeys ?? [],
  });
  return `snap_${createHash("sha256").update(payload).digest("hex").slice(0, 12)}`;
}

/** Server-side prepared snapshot — filled by callers, never by fetching providers in routes. */
export function setPreparedComboData(data: {
  fixtures?: QualifiedFixture[];
  lists?: DailyMatchLists;
  odds?: ReadonlyArray<{
    matchId: number;
    oddsKey: string;
    decimal: number;
    fetchedAt?: string;
  }>;
  snapshotId?: string;
}): PreparedComboData {
  const oddsLookup = data.odds ? createMapOddsLookup(data.odds) : undefined;
  const snapshotId =
    data.snapshotId ??
    computeDataSnapshotId({
      fixtures: data.fixtures,
      lists: data.lists,
      oddsKeys: data.odds?.map((o) => `${o.matchId}:${o.oddsKey}:${o.decimal}`),
    });
  prepared = {
    snapshotId,
    fixtures: data.fixtures,
    lists: data.lists,
    oddsLookup,
    preparedAt: new Date().toISOString(),
  };
  return prepared;
}

export function getPreparedComboData(): PreparedComboData | null {
  return prepared;
}

export function clearPreparedComboData(): void {
  prepared = null;
  clearPreparedBookmakerQuotes();
}

export function parseInjectedOdds(raw: unknown): ReturnType<typeof createMapOddsLookup> | null {
  if (!Array.isArray(raw)) return null;
  const entries: Array<{
    matchId: number;
    oddsKey: string;
    decimal: number;
    fetchedAt?: string;
  }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const matchId = Number(r.matchId);
    const decimal = Number(r.decimal);
    const oddsKey = typeof r.oddsKey === "string" ? r.oddsKey : "";
    if (!Number.isFinite(matchId) || !oddsKey || !(decimal > 1)) continue;
    entries.push({
      matchId,
      oddsKey,
      decimal,
      fetchedAt: typeof r.fetchedAt === "string" ? r.fetchedAt : undefined,
    });
  }
  if (!entries.length) return null;
  return createMapOddsLookup(entries);
}

export function parseInjectedFixtures(raw: unknown): QualifiedFixture[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: QualifiedFixture[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const f = row as Record<string, unknown>;
    const matchId = Number(f.matchId);
    const marketKind = f.marketKind;
    if (
      !Number.isFinite(matchId) ||
      (marketKind !== "fh" &&
        marketKind !== "over15" &&
        marketKind !== "over25" &&
        marketKind !== "sh")
    ) {
      continue;
    }
    const kickoffDateTime =
      typeof f.kickoffDateTime === "string" ? f.kickoffDateTime : "";
    if (!kickoffDateTime) continue;
    out.push({
      id: typeof f.id === "string" ? f.id : `${matchId}-${marketKind}`,
      matchId,
      marketKind,
      league: typeof f.league === "string" ? f.league : "Competition",
      country: typeof f.country === "string" ? f.country : undefined,
      leagueCode: typeof f.leagueCode === "string" ? f.leagueCode : "INT",
      home: typeof f.home === "string" ? f.home : "Home",
      away: typeof f.away === "string" ? f.away : "Away",
      homeImage: typeof f.homeImage === "string" ? f.homeImage : undefined,
      awayImage: typeof f.awayImage === "string" ? f.awayImage : undefined,
      kickoff: typeof f.kickoff === "string" ? f.kickoff : kickoffDateTime,
      kickoffDateTime,
      market: typeof f.market === "string" ? f.market : String(marketKind),
      marketCode: typeof f.marketCode === "string" ? f.marketCode : String(marketKind),
      modelProbability: Number(f.modelProbability) || 0,
      updatedAt: typeof f.updatedAt === "string" ? f.updatedAt : "pending",
      updatedDateTime:
        typeof f.updatedDateTime === "string" ? f.updatedDateTime : new Date().toISOString(),
      venue: "Venue data pending",
      operatorStatus: "unavailable",
    });
  }
  return out.length ? out : null;
}
