import type { OddsHistoryQuery, OddsHistoryRecord, OddsHistoryReader, OddsHistoryStore } from "./types";

/** In-memory store for tests and local fallback when Postgres is unset. */
export class MemoryOddsHistoryStore implements OddsHistoryStore, OddsHistoryReader {
  private readonly records: OddsHistoryRecord[] = [];

  async append(records: readonly OddsHistoryRecord[]): Promise<void> {
    this.records.push(...records);
  }

  async query(input: OddsHistoryQuery): Promise<OddsHistoryRecord[]> {
    const fromMs = input.from ? Date.parse(input.from) : null;
    const toMs = input.to ? Date.parse(input.to) : null;
    const filtered = this.records.filter((record) => {
      if (input.fixtureId !== undefined && record.fixtureId !== input.fixtureId) return false;
      if (input.operatorId !== undefined && record.operatorId !== input.operatorId) return false;
      if (input.market && record.market !== input.market) return false;
      const ts = Date.parse(record.timestamp);
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;
      return true;
    });
    filtered.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
    return input.limit ? filtered.slice(-input.limit) : filtered;
  }

  clear(): void {
    this.records.length = 0;
  }
}
