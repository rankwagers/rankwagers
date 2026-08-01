import "server-only";
import { Pool } from "pg";
import type {
  BuilderCandidateActor,
  BuilderCandidateStatus,
  BuilderPublicationCandidate,
  CandidateCreateOutcome,
  CandidateTransitionInput,
  CandidateTransitionOutcome,
  JsonObject,
} from "../contracts";
import { assertCandidateTransition, transitionMetadataRules } from "../lifecycle";
import { deepFreeze } from "../validation";
import type { CandidateInsert, CandidateListPage, CandidateStore } from "../store";
import type { CandidateListFilters } from "../filters";

/**
 * PostgreSQL candidate store (Sprint 20B-A) — the durable adapter.
 *
 * Concurrency: creation relies on the UNIQUE constraint on `idempotency_key` plus
 * `ON CONFLICT DO NOTHING`, which is atomic at the storage engine level. Two concurrent
 * requests with the same key can therefore never produce two candidates: exactly one
 * INSERT wins, and the loser reads the winner's row and compares the request fingerprint.
 * No advisory lock or read-modify-write window is involved.
 *
 * There is no UPDATE and no DELETE statement in this file. Candidates are write-once.
 */

type Row = {
  candidate_id: string;
  schema_version: string;
  status: BuilderCandidateStatus;
  actor: BuilderCandidateActor;
  source_request_id: string | null;
  source_snapshot_id: string | null;
  source_date: string | null;
  builder_config: JsonObject | null;
  payload: JsonObject;
  payload_checksum: string;
  checksum_version: string;
  idempotency_key: string;
  request_fingerprint: string;
  created_at: Date | string;
  version: number;
  status_changed_at: Date | string | null;
  status_actor: BuilderCandidateActor | null;
  rejection_reason: string | null;
  converted_acca_id: string | null;
};

const SELECT_COLUMNS = `
  candidate_id, schema_version, status, actor, source_request_id, source_snapshot_id,
  source_date, builder_config, payload, payload_checksum, checksum_version,
  idempotency_key, request_fingerprint, created_at,
  version, status_changed_at, status_actor, rejection_reason, converted_acca_id
`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: Row): BuilderPublicationCandidate {
  return deepFreeze({
    schemaVersion: row.schema_version,
    candidateId: row.candidate_id,
    status: row.status,
    actor: row.actor,
    createdAt: iso(row.created_at),
    sourceRequestId: row.source_request_id ?? null,
    sourceSnapshotId: row.source_snapshot_id ?? null,
    sourceDate: row.source_date ?? null,
    sourceBuilderConfig: row.builder_config ?? {},
    payload: row.payload,
    payloadChecksum: row.payload_checksum,
    checksumVersion: row.checksum_version,
    storageMode: "postgres" as const,
    version: Number(row.version),
    statusChangedAt: row.status_changed_at ? iso(row.status_changed_at) : null,
    statusActor: row.status_actor ?? null,
    rejectionReason: row.rejection_reason ?? null,
    convertedAccaId: row.converted_acca_id ?? null,
  });
}

export function createPostgresCandidateStore(connectionString: string): CandidateStore {
  const pool = new Pool({ connectionString, max: 5 });

  return {
    storageMode: "postgres",
    durable: true,

    async createCandidate(insert: CandidateInsert): Promise<CandidateCreateOutcome> {
      try {
        const inserted = await pool.query<Row>(
          `INSERT INTO builder_publication_candidates (
             candidate_id, schema_version, status, actor, source_request_id,
             source_snapshot_id, source_date, builder_config, payload,
             payload_checksum, checksum_version, idempotency_key,
             request_fingerprint, created_at
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14
           )
           ON CONFLICT (idempotency_key) DO NOTHING
           RETURNING ${SELECT_COLUMNS}`,
          [
            insert.candidateId,
            insert.schemaVersion,
            insert.status,
            insert.actor,
            insert.sourceRequestId,
            insert.sourceSnapshotId,
            insert.sourceDate,
            JSON.stringify(insert.sourceBuilderConfig),
            JSON.stringify(insert.payload),
            insert.payloadChecksum,
            insert.checksumVersion,
            insert.idempotencyKey,
            insert.requestFingerprint,
            insert.createdAt,
          ],
        );

        if (inserted.rows.length === 1) {
          return { ok: true, candidate: mapRow(inserted.rows[0]), deduplicated: false };
        }

        // The key already existed. Read the winning row and decide dedupe vs conflict.
        const existing = await pool.query<Row>(
          `SELECT ${SELECT_COLUMNS} FROM builder_publication_candidates
           WHERE idempotency_key = $1 LIMIT 1`,
          [insert.idempotencyKey],
        );
        if (existing.rows.length !== 1) {
          return {
            ok: false,
            code: "storage_failed",
            message: "idempotency conflict without a retrievable candidate",
          };
        }
        const row = existing.rows[0];
        if (row.request_fingerprint !== insert.requestFingerprint) {
          return {
            ok: false,
            code: "idempotency_conflict",
            existingCandidateId: row.candidate_id,
          };
        }
        return { ok: true, candidate: mapRow(row), deduplicated: true };
      } catch (err) {
        return {
          ok: false,
          code: "storage_failed",
          message: err instanceof Error ? err.message.slice(0, 200) : "insert_failed",
        };
      }
    },

    async getCandidate(candidateId: string): Promise<BuilderPublicationCandidate | null> {
      const result = await pool.query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM builder_publication_candidates
         WHERE candidate_id = $1 LIMIT 1`,
        [candidateId],
      );
      return result.rows.length ? mapRow(result.rows[0]) : null;
    },

    /**
     * Guarded lifecycle transition as a single atomic conditional UPDATE.
     *
     * The WHERE clause carries the full precondition (id + status + version), so the storage
     * engine — not application code — decides the winner under concurrency. There is no
     * read-modify-write window. On a zero-row result the row is re-read ONCE to classify the
     * failure precisely; that read is diagnostic only and never repairs state.
     *
     * NOT EXECUTED against a real PostgreSQL server. See the B1 report.
     */
    async transitionCandidateStatus(
      input: CandidateTransitionInput,
    ): Promise<CandidateTransitionOutcome> {
      // Legality is decided before touching SQL so an illegal request never reaches the DB.
      const legality = assertCandidateTransition(input.expectedStatus, input.nextStatus);
      if (!legality.ok) {
        return legality.code === "unknown_status"
          ? { ok: false, code: "unknown_status" }
          : { ok: false, code: "invalid_transition", from: legality.from, to: legality.to };
      }

      const rules = transitionMetadataRules(input.nextStatus);
      const reason = rules.acceptsReason ? (input.reason ?? null) : null;
      const convertedAccaId = rules.acceptsConvertedAccaId
        ? (input.convertedAccaId ?? null)
        : null;

      try {
        const updated = await pool.query<Row>(
          `UPDATE builder_publication_candidates
              SET status = $1,
                  version = version + 1,
                  status_changed_at = $2,
                  status_actor = $3,
                  rejection_reason = $4,
                  converted_acca_id = $5
            WHERE candidate_id = $6
              AND status = $7
              AND version = $8
            RETURNING ${SELECT_COLUMNS}`,
          [
            input.nextStatus,
            input.transitionedAt,
            input.actor,
            reason,
            convertedAccaId,
            input.candidateId,
            input.expectedStatus,
            input.expectedVersion,
          ],
        );

        if (updated.rows.length === 1) {
          return { ok: true, candidate: mapRow(updated.rows[0]) };
        }

        // Zero rows: classify without repairing anything.
        const existing = await pool.query<Row>(
          `SELECT ${SELECT_COLUMNS} FROM builder_publication_candidates
            WHERE candidate_id = $1 LIMIT 1`,
          [input.candidateId],
        );
        if (existing.rows.length !== 1) return { ok: false, code: "candidate_not_found" };

        const row = existing.rows[0];
        const currentStatus = row.status;
        const currentVersion = Number(row.version);
        if (currentStatus !== input.expectedStatus) {
          return { ok: false, code: "status_conflict", currentStatus, currentVersion };
        }
        return { ok: false, code: "version_conflict", currentStatus, currentVersion };
      } catch (err) {
        // Never surface SQL text or connection data.
        return {
          ok: false,
          code: "storage_failed",
          message: err instanceof Error ? err.message.slice(0, 200) : "transition_failed",
        };
      }
    },

    async listCandidates(filters: CandidateListFilters): Promise<CandidateListPage> {
      // Fixed predicate set and hard-coded ORDER BY. No request value ever becomes a
      // column name, sort key or direction.
      const where: string[] = [];
      const values: unknown[] = [];
      const bind = (value: unknown): string => {
        values.push(value);
        return `$${values.length}`;
      };
      if (filters.candidateId) where.push(`candidate_id = ${bind(filters.candidateId)}`);
      if (filters.sourceRequestId) where.push(`source_request_id = ${bind(filters.sourceRequestId)}`);
      if (filters.sourceSnapshotId) where.push(`source_snapshot_id = ${bind(filters.sourceSnapshotId)}`);
      if (filters.sourceDate) where.push(`source_date = ${bind(filters.sourceDate)}`);
      if (filters.status) where.push(`status = ${bind(filters.status)}`);
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const totalResult = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM builder_publication_candidates ${clause}`,
        values,
      );
      const total = Number(totalResult.rows[0]?.total ?? "0");

      const rows = await pool.query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM builder_publication_candidates
         ${clause}
         ORDER BY created_at DESC, candidate_id DESC
         LIMIT ${bind(filters.limit)} OFFSET ${bind(filters.offset)}`,
        values,
      );

      return {
        rows: rows.rows.map(mapRow),
        total: Number.isFinite(total) ? total : rows.rows.length,
        limit: filters.limit,
        offset: filters.offset,
      };
    },
  };
}
