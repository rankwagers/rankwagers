import { Pool } from "pg";
import type {
  ProviderSnapshotRecord,
  SnapshotStore,
  SnapshotType,
  SnapshotStatus,
  FreshnessState,
  ComboSnapshotPayload,
} from "./types";

type Row = {
  snapshot_id: string;
  snapshot_type: SnapshotType;
  status: SnapshotStatus;
  created_at: Date | string;
  completed_at: Date | string | null;
  source_started_at: Date | string | null;
  source_completed_at: Date | string | null;
  provider_timestamps: Record<string, string> | null;
  data_snapshot_id: string | null;
  payload: ComboSnapshotPayload | Record<string, unknown> | null;
  checksum: string;
  fixture_count: number;
  odds_count: number;
  freshness_state: FreshnessState;
  error_code: string | null;
  previous_valid_snapshot_id: string | null;
  expires_at: Date | string | null;
};

function iso(value: Date | string | null | undefined): string | undefined {
  if (value == null) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: Row): ProviderSnapshotRecord {
  return {
    snapshotId: row.snapshot_id,
    snapshotType: row.snapshot_type,
    status: row.status,
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at),
    sourceStartedAt: iso(row.source_started_at),
    sourceCompletedAt: iso(row.source_completed_at),
    providerTimestamps: row.provider_timestamps ?? undefined,
    dataSnapshotId: row.data_snapshot_id ?? undefined,
    payload: row.payload ?? undefined,
    checksum: row.checksum,
    fixtureCount: row.fixture_count,
    oddsCount: row.odds_count,
    freshnessState: row.freshness_state,
    errorCode: row.error_code ?? undefined,
    previousValidSnapshotId: row.previous_valid_snapshot_id ?? undefined,
    expiresAt: iso(row.expires_at),
  };
}

export function createPostgresSnapshotStore(connectionString: string): SnapshotStore {
  const pool = new Pool({ connectionString, max: 5 });

  return {
    async saveCandidate(record) {
      await pool.query(
        `INSERT INTO provider_snapshots (
          snapshot_id, snapshot_type, status, created_at, completed_at,
          source_started_at, source_completed_at, provider_timestamps,
          data_snapshot_id, payload, checksum, fixture_count, odds_count,
          freshness_state, error_code, previous_valid_snapshot_id, expires_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17
        )
        ON CONFLICT (snapshot_id) DO UPDATE SET
          status = EXCLUDED.status,
          completed_at = EXCLUDED.completed_at,
          payload = EXCLUDED.payload,
          freshness_state = EXCLUDED.freshness_state,
          error_code = EXCLUDED.error_code`,
        [
          record.snapshotId,
          record.snapshotType,
          record.status,
          record.createdAt,
          record.completedAt ?? null,
          record.sourceStartedAt ?? null,
          record.sourceCompletedAt ?? null,
          record.providerTimestamps
            ? JSON.stringify(record.providerTimestamps)
            : null,
          record.dataSnapshotId ?? null,
          record.payload ? JSON.stringify(record.payload) : null,
          record.checksum,
          record.fixtureCount,
          record.oddsCount,
          record.freshnessState,
          record.errorCode ?? null,
          record.previousValidSnapshotId ?? null,
          record.expiresAt ?? null,
        ]
      );
    },

    async markFailed(snapshotId, errorCode) {
      await pool.query(
        `UPDATE provider_snapshots
         SET status = 'failed', error_code = $2, completed_at = NOW()
         WHERE snapshot_id = $1`,
        [snapshotId, errorCode]
      );
    },

    async activate(snapshotType, snapshotId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const candidate = await client.query<Row>(
          `SELECT * FROM provider_snapshots WHERE snapshot_id = $1 FOR UPDATE`,
          [snapshotId]
        );
        if (!candidate.rows[0] || candidate.rows[0].status !== "valid") {
          throw new Error("Cannot activate non-valid snapshot");
        }
        const prev = await client.query<{ snapshot_id: string }>(
          `SELECT snapshot_id FROM active_snapshots WHERE snapshot_type = $1 FOR UPDATE`,
          [snapshotType]
        );
        const previousId = prev.rows[0]?.snapshot_id;
        if (previousId && previousId !== snapshotId) {
          await client.query(
            `UPDATE provider_snapshots SET status = 'superseded' WHERE snapshot_id = $1`,
            [previousId]
          );
        }
        await client.query(
          `INSERT INTO active_snapshots (snapshot_type, snapshot_id, activated_at, previous_snapshot_id)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (snapshot_type) DO UPDATE SET
             snapshot_id = EXCLUDED.snapshot_id,
             activated_at = EXCLUDED.activated_at,
             previous_snapshot_id = EXCLUDED.previous_snapshot_id`,
          [snapshotType, snapshotId, previousId ?? null]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },

    async getActive(snapshotType) {
      const result = await pool.query<Row>(
        `SELECT s.*
         FROM active_snapshots a
         JOIN provider_snapshots s ON s.snapshot_id = a.snapshot_id
         WHERE a.snapshot_type = $1
         LIMIT 1`,
        [snapshotType]
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async getById(snapshotId) {
      const result = await pool.query<Row>(
        `SELECT * FROM provider_snapshots WHERE snapshot_id = $1 LIMIT 1`,
        [snapshotId]
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async listByType(snapshotType, limit = 50) {
      const result = await pool.query<Row>(
        `SELECT * FROM provider_snapshots
         WHERE snapshot_type = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [snapshotType, limit]
      );
      return result.rows.map(mapRow);
    },

    async deleteExpired(now = Date.now(), options) {
      const active = await pool.query<{
        snapshot_id: string;
        previous_snapshot_id: string | null;
      }>(`SELECT snapshot_id, previous_snapshot_id FROM active_snapshots`);
      const protect = new Set<string>();
      for (const row of active.rows) {
        protect.add(row.snapshot_id);
        if (row.previous_snapshot_id) protect.add(row.previous_snapshot_id);
      }

      const candidates = await pool.query<{ snapshot_id: string }>(
        `SELECT snapshot_id FROM provider_snapshots
         WHERE (expires_at IS NOT NULL AND expires_at < $1)
            OR (status = 'failed' AND created_at < NOW() - INTERVAL '7 days')
            OR (status = 'superseded' AND created_at < NOW() - INTERVAL '3 days')`,
        [new Date(now).toISOString()]
      );
      const toDelete = candidates.rows
        .map((r) => r.snapshot_id)
        .filter((id) => !protect.has(id));

      if (!options?.dryRun && toDelete.length) {
        await pool.query(
          `DELETE FROM provider_snapshots WHERE snapshot_id = ANY($1::text[])`,
          [toDelete]
        );
      }
      return { deleted: toDelete.length, retainedActive: protect.size };
    },
  };
}
