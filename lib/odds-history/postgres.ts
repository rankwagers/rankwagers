import { Pool, type PoolConfig } from "pg";
import type { OddsHistoryQuery, OddsHistoryRecord, OddsHistoryReader, OddsHistoryStore } from "./types";

const INSERT_BATCH_SIZE = 500;

export class PostgresOddsHistoryStore implements OddsHistoryStore, OddsHistoryReader {
  private readonly pool: Pool;

  constructor(connectionString: string, config: Omit<PoolConfig, "connectionString"> = {}) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      ...config,
    });
  }

  async append(records: readonly OddsHistoryRecord[]): Promise<void> {
    for (let start = 0; start < records.length; start += INSERT_BATCH_SIZE) {
      const batch = records.slice(start, start + INSERT_BATCH_SIZE);
      const values: unknown[] = [];
      const placeholders = batch.map((record, index) => {
        const offset = index * 7;
        values.push(
          record.fixtureId,
          record.operatorId,
          record.operatorName,
          record.market,
          record.line,
          record.odd,
          record.timestamp
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
      });

      await this.pool.query(
        `INSERT INTO odds_history (
          fixture_id,
          operator_id,
          operator_name,
          market,
          line,
          odd,
          observed_at
        ) VALUES ${placeholders.join(", ")}`,
        values
      );
    }
  }

  async query(input: OddsHistoryQuery): Promise<OddsHistoryRecord[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (input.fixtureId !== undefined) {
      values.push(input.fixtureId);
      clauses.push(`fixture_id = $${values.length}`);
    }
    if (input.operatorId !== undefined) {
      values.push(input.operatorId);
      clauses.push(`operator_id = $${values.length}`);
    }
    if (input.market) {
      values.push(input.market);
      clauses.push(`market = $${values.length}`);
    }
    if (input.from) {
      values.push(input.from);
      clauses.push(`observed_at >= $${values.length}`);
    }
    if (input.to) {
      values.push(input.to);
      clauses.push(`observed_at <= $${values.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(Math.max(input.limit ?? 5000, 1), 20_000);
    values.push(limit);

    const result = await this.pool.query<{
      fixture_id: string | number;
      operator_id: number;
      operator_name: string;
      market: string;
      line: string | number;
      odd: string | number;
      observed_at: Date | string;
    }>(
      `SELECT fixture_id, operator_id, operator_name, market, line, odd, observed_at
       FROM odds_history
       ${where}
       ORDER BY observed_at ASC
       LIMIT $${values.length}`,
      values
    );

    return result.rows.map((row) => ({
      fixtureId: Number(row.fixture_id),
      operatorId: Number(row.operator_id),
      operatorName: row.operator_name,
      market: row.market,
      line: String(row.line),
      odd: Number(row.odd),
      timestamp:
        row.observed_at instanceof Date
          ? row.observed_at.toISOString()
          : new Date(row.observed_at).toISOString(),
    }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
