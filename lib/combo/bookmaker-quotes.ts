/**
 * Server-side bounded per-bookmaker quote store.
 * Never ship the full quote pool to the client.
 */

export type BookmakerQuoteRow = {
  matchId: number;
  providerFixtureId?: number;
  oddsKey: string;
  canonicalMarketId: string;
  providerBookmakerId: string;
  providerBookmakerName?: string;
  decimal: number;
  observedAt: string;
};

const MAX_QUOTES_DEFAULT = 400;

let quotes: BookmakerQuoteRow[] = [];

export function setPreparedBookmakerQuotes(
  rows: readonly BookmakerQuoteRow[],
  max = MAX_QUOTES_DEFAULT
): void {
  quotes = rows.slice(0, max);
}

export function getPreparedBookmakerQuotes(): readonly BookmakerQuoteRow[] {
  return quotes;
}

export function clearPreparedBookmakerQuotes(): void {
  quotes = [];
}

export function findQuotesForSelection(input: {
  matchId: number;
  oddsKey: string;
  providerBookmakerIds: readonly string[];
}): BookmakerQuoteRow[] {
  if (!input.providerBookmakerIds.length) return [];
  const idSet = new Set(input.providerBookmakerIds.map(String));
  return quotes.filter(
    (q) =>
      q.matchId === input.matchId &&
      q.oddsKey === input.oddsKey &&
      idSet.has(q.providerBookmakerId)
  );
}
