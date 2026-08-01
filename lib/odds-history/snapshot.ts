import type { BestOddsSnapshot, OddsHistoryRecord } from "./types";

/** Latest observed price per operator for a market. */
export function latestPricesByOperator(
  records: readonly OddsHistoryRecord[]
): Array<{ operatorId: number; operatorName: string; odd: number }> {
  const latest = new Map<number, OddsHistoryRecord>();
  for (const record of [...records].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)
  )) {
    latest.set(record.operatorId, record);
  }
  return [...latest.values()]
    .map((record) => ({
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      odd: record.odd,
    }))
    .sort((left, right) => right.odd - left.odd);
}

export function buildBestOddsSnapshot(
  market: string,
  records: readonly OddsHistoryRecord[]
): BestOddsSnapshot {
  const operators = latestPricesByOperator(records);
  if (!operators.length) {
    return {
      market,
      highest: null,
      lowest: null,
      average: null,
      spread: null,
      operators: [],
    };
  }
  const highest = operators[0];
  const lowest = operators[operators.length - 1];
  const average =
    operators.reduce((sum, row) => sum + row.odd, 0) / operators.length;
  return {
    market,
    highest,
    lowest,
    average,
    spread: highest.odd - lowest.odd,
    operators,
  };
}

/** Snapshot from a single current quote set (no history fabrication). */
export function snapshotFromCurrentQuotes(
  market: string,
  bookmakers: readonly { id: number; name: string; decimal: number }[]
): BestOddsSnapshot {
  const operators = [...bookmakers]
    .map((bookmaker) => ({
      operatorId: bookmaker.id,
      operatorName: bookmaker.name,
      odd: bookmaker.decimal,
    }))
    .sort((left, right) => right.odd - left.odd);
  if (!operators.length) {
    return { market, highest: null, lowest: null, average: null, spread: null, operators: [] };
  }
  const highest = operators[0];
  const lowest = operators[operators.length - 1];
  const average =
    operators.reduce((sum, row) => sum + row.odd, 0) / operators.length;
  return {
    market,
    highest,
    lowest,
    average,
    spread: highest.odd - lowest.odd,
    operators,
  };
}
