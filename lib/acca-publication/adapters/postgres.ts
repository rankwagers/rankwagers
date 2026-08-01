import "server-only";
import { Pool } from "pg";
import type { BuilderCandidateStatus } from "@/lib/builder-approval/contracts";
import { deepFreeze } from "@/lib/builder-approval/validation";
import type {
  AccaActor,
  AccaEvidenceSnapshot,
  AccaLeg,
  AccaQualificationSnapshot,
  AccaRecord,
  AccaSourceReferences,
  AccaStatus,
} from "../contracts";
import type { AccaListFilters } from "../filters";
import { assertAccaTransition } from "../lifecycle";
import type {
  AccaCreateOutcome,
  AccaDraftInsert,
  AccaListPage,
  AccaStore,
  AccaTransitionInput,
  AccaTransitionOutcome,
  CandidateConversionPrecondition,
} from "../store";

/**
 * PostgreSQL Acca store (Sprint 20B-B, stage B2) — the durable adapter.
 *
 * ATOMIC CONVERSION
 *   `createDraftFromCandidate` runs BEGIN / INSERT / conditional-UPDATE / COMMIT on a single
 *   pooled client, following the established transaction convention in
 *   `lib/snapshots/postgres.ts`. The candidate transition carries the same
 *   expected-status + expected-version predicate used by the Builder Approval adapter, so a
 *   stale caller loses inside the transaction and the whole unit rolls back. Neither the
 *   Acca insert nor the candidate conversion can commit alone.
 *
 * NOT EXECUTED against a real PostgreSQL server. All evidence for this file is
 * source-structural. See the B2 report.
 */

type Row = {
  acca_id: string;
  source_candidate_id: string;
  status: AccaStatus;
  title: string;
  summary: string | null;
  locale: string;
  slug: string;
  legs: AccaLeg[];
  combined_odds: string | number;
  evidence_snapshot: AccaEvidenceSnapshot | null;
  qualification_snapshot: AccaQualificationSnapshot | null;
  source_references: AccaSourceReferences;
  schema_version: string;
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
  published_at: Date | string | null;
  archived_at: Date | string | null;
  created_by: AccaActor;
  published_by: AccaActor | null;
  archived_by: AccaActor | null;
};

const SELECT_COLUMNS = `
  acca_id, source_candidate_id, status, title, summary, locale, slug, legs, combined_odds,
  evidence_snapshot, qualification_snapshot, source_references, schema_version, version,
  created_at, updated_at, published_at, archived_at, created_by, published_by, archived_by
`;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Single row mapper. `combined_odds` arrives from node-postgres as a STRING for NUMERIC
 * columns (the driver refuses to silently narrow to a float), which is exactly the behaviour
 * we want: parse it once, here, rather than letting a string leak into the domain.
 */
function mapRow(row: Row): AccaRecord {
  const combined = typeof row.combined_odds === "number"
    ? row.combined_odds
    : Number(row.combined_odds);
  return deepFreeze({
    schemaVersion: row.schema_version,
    accaId: row.acca_id,
    sourceCandidateId: row.source_candidate_id,
    status: row.status,
    title: row.title,
    summary: row.summary ?? null,
    locale: row.locale,
    legs: Array.isArray(row.legs) ? row.legs : [],
    combinedOdds: combined,
    evidenceSnapshot: row.evidence_snapshot ?? {},
    qualificationSnapshot:
      row.qualification_snapshot ?? { legCount: 0, oddsComplete: false },
    sourceReferences: row.source_references,
    slug: row.slug,
    version: Number(row.version),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    publishedAt: row.published_at ? iso(row.published_at) : null,
    archivedAt: row.archived_at ? iso(row.archived_at) : null,
    createdBy: row.created_by,
    publishedBy: row.published_by ?? null,
    archivedBy: row.archived_by ?? null,
  });
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

export function createPostgresAccaStore(connectionString: string): AccaStore {
  const pool = new Pool({ connectionString, max: 5 });

  return {
    storageMode: "postgres",
    durable: true,

    async createDraftFromCandidate(
      insert: AccaDraftInsert,
      candidate: CandidateConversionPrecondition,
    ): Promise<AccaCreateOutcome> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // 1. Insert the draft. UNIQUE (source_candidate_id) and UNIQUE (slug) make the
        //    "one candidate, one Acca" and "one public slug" invariants storage-enforced.
        const inserted = await client.query<Row>(
          `INSERT INTO published_accas (
             acca_id, source_candidate_id, status, title, summary, locale, slug, legs,
             combined_odds, evidence_snapshot, qualification_snapshot, source_references,
             schema_version, version, created_at, updated_at, created_by
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17
           )
           RETURNING ${SELECT_COLUMNS}`,
          [
            insert.accaId,
            insert.sourceCandidateId,
            insert.status,
            insert.title,
            insert.summary,
            insert.locale,
            insert.slug,
            JSON.stringify(insert.legs),
            insert.combinedOdds,
            JSON.stringify(insert.evidenceSnapshot),
            JSON.stringify(insert.qualificationSnapshot),
            JSON.stringify(insert.sourceReferences),
            insert.schemaVersion,
            insert.version,
            insert.createdAt,
            insert.updatedAt,
            insert.createdBy,
          ],
        );

        // 2. Convert the candidate under the SAME optimistic predicate the Builder Approval
        //    adapter uses. Zero rows means the candidate moved under us.
        const converted = await client.query<{
          status: BuilderCandidateStatus;
          version: number;
        }>(
          `UPDATE builder_publication_candidates
              SET status = 'CONVERTED',
                  version = version + 1,
                  status_changed_at = $1,
                  status_actor = $2,
                  converted_acca_id = $3
            WHERE candidate_id = $4
              AND status = $5
              AND version = $6
            RETURNING status, version`,
          [
            candidate.transitionedAt,
            candidate.actor,
            insert.accaId,
            candidate.candidateId,
            candidate.expectedStatus,
            candidate.expectedVersion,
          ],
        );

        if (converted.rows.length !== 1) {
          // The Acca insert above is discarded with the candidate untouched.
          await client.query("ROLLBACK");
          const existing = await pool.query<{
            status: BuilderCandidateStatus;
            version: number;
            converted_acca_id: string | null;
          }>(
            `SELECT status, version, converted_acca_id
               FROM builder_publication_candidates WHERE candidate_id = $1 LIMIT 1`,
            [candidate.candidateId],
          );
          if (existing.rows.length !== 1) return { ok: false, code: "candidate_not_found" };
          const row = existing.rows[0];
          const currentStatus = row.status;
          const currentVersion = Number(row.version);
          if (currentStatus === "CONVERTED") {
            return {
              ok: false,
              code: "candidate_already_converted",
              existingAccaId: row.converted_acca_id,
            };
          }
          if (currentStatus !== candidate.expectedStatus) {
            return { ok: false, code: "candidate_status_conflict", currentStatus, currentVersion };
          }
          return { ok: false, code: "candidate_version_conflict", currentStatus, currentVersion };
        }

        await client.query("COMMIT");
        return { ok: true, acca: mapRow(inserted.rows[0]) };
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        const code = (err as { code?: string }).code;
        const constraint = (err as { constraint?: string }).constraint;
        if (code === UNIQUE_VIOLATION) {
          if (constraint === "published_accas_slug_uidx") {
            return { ok: false, code: "slug_conflict", slug: insert.slug };
          }
          if (constraint === "published_accas_source_candidate_uidx") {
            return {
              ok: false,
              code: "acca_already_exists_for_candidate",
              existingAccaId: insert.sourceCandidateId,
            };
          }
        }
        // Never surface SQL text or connection data.
        return {
          ok: false,
          code: "storage_failed",
          message: err instanceof Error ? err.message.slice(0, 200) : "create_failed",
        };
      } finally {
        client.release();
      }
    },

    async getAccaById(accaId) {
      const result = await pool.query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM published_accas WHERE acca_id = $1 LIMIT 1`,
        [accaId],
      );
      return result.rows.length ? mapRow(result.rows[0]) : null;
    },

    async getAccaBySlug(slug) {
      const result = await pool.query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM published_accas WHERE slug = $1 LIMIT 1`,
        [slug],
      );
      return result.rows.length ? mapRow(result.rows[0]) : null;
    },

    async listAccas(filters: AccaListFilters): Promise<AccaListPage> {
      // Fixed predicate set, hard-coded ORDER BY. No request value becomes a column name,
      // sort key or direction.
      const where: string[] = [];
      const values: unknown[] = [];
      const bind = (v: unknown): string => {
        values.push(v);
        return `$${values.length}`;
      };
      if (filters.status) where.push(`status = ${bind(filters.status)}`);
      if (filters.locale) where.push(`locale = ${bind(filters.locale)}`);
      if (filters.sourceCandidateId) {
        where.push(`source_candidate_id = ${bind(filters.sourceCandidateId)}`);
      }
      if (filters.createdAfter) where.push(`created_at >= ${bind(filters.createdAfter)}`);
      if (filters.createdBefore) where.push(`created_at <= ${bind(filters.createdBefore)}`);
      if (filters.publishedAfter) where.push(`published_at >= ${bind(filters.publishedAfter)}`);
      if (filters.publishedBefore) where.push(`published_at <= ${bind(filters.publishedBefore)}`);
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const totalResult = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM published_accas ${clause}`,
        values,
      );
      const total = Number(totalResult.rows[0]?.total ?? "0");

      const rows = await pool.query<Row>(
        `SELECT ${SELECT_COLUMNS} FROM published_accas
         ${clause}
         ORDER BY created_at DESC, acca_id DESC
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

    async transitionAccaStatus(input: AccaTransitionInput): Promise<AccaTransitionOutcome> {
      const legality = assertAccaTransition(input.expectedStatus, input.nextStatus);
      if (!legality.ok) {
        return legality.code === "unknown_status"
          ? { ok: false, code: "unknown_status" }
          : { ok: false, code: "invalid_transition", from: legality.from, to: legality.to };
      }

      try {
        const updated = await pool.query<Row>(
          `UPDATE published_accas
              SET status = $1,
                  version = version + 1,
                  updated_at = $2,
                  published_at = CASE WHEN $1 = 'PUBLISHED' THEN $2::timestamptz ELSE published_at END,
                  archived_at  = CASE WHEN $1 = 'ARCHIVED'  THEN $2::timestamptz ELSE archived_at  END,
                  published_by = CASE WHEN $1 = 'PUBLISHED' THEN $3 ELSE published_by END,
                  archived_by  = CASE WHEN $1 = 'ARCHIVED'  THEN $3 ELSE archived_by  END
            WHERE acca_id = $4
              AND status = $5
              AND version = $6
            RETURNING ${SELECT_COLUMNS}`,
          [
            input.nextStatus,
            input.transitionedAt,
            input.actor,
            input.accaId,
            input.expectedStatus,
            input.expectedVersion,
          ],
        );

        if (updated.rows.length === 1) return { ok: true, acca: mapRow(updated.rows[0]) };

        // One diagnostic read to classify. Never repairs state.
        const existing = await pool.query<{ status: AccaStatus; version: number }>(
          `SELECT status, version FROM published_accas WHERE acca_id = $1 LIMIT 1`,
          [input.accaId],
        );
        if (existing.rows.length !== 1) return { ok: false, code: "acca_not_found" };
        const currentStatus = existing.rows[0].status;
        const currentVersion = Number(existing.rows[0].version);
        if (currentStatus !== input.expectedStatus) {
          return { ok: false, code: "status_conflict", currentStatus, currentVersion };
        }
        return { ok: false, code: "version_conflict", currentStatus, currentVersion };
      } catch (err) {
        return {
          ok: false,
          code: "storage_failed",
          message: err instanceof Error ? err.message.slice(0, 200) : "transition_failed",
        };
      }
    },
  };
}
