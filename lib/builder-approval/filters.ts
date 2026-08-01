import {
  BUILDER_CANDIDATE_STATUSES,
  CANDIDATE_LIST_DEFAULT_LIMIT,
  CANDIDATE_LIST_MAX_LIMIT,
  type BuilderCandidateStatus,
} from "./contracts";
import { isCandidateId } from "./identifiers";
import { isIsoDate } from "./validation";

/**
 * List filters (Sprint 20B-A).
 *
 * Every field is a fixed, named column. No request parameter ever reaches SQL as a field
 * name, sort key or direction — ordering is hard-coded in the adapters.
 */
export type CandidateListFilters = {
  candidateId: string | null;
  sourceRequestId: string | null;
  sourceSnapshotId: string | null;
  sourceDate: string | null;
  status: BuilderCandidateStatus | null;
  limit: number;
  offset: number;
};

const MAX_OPAQUE_FILTER_LENGTH = 200;
/** Conservative charset for opaque source identifiers used as equality filters. */
const OPAQUE_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;

function opaque(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_OPAQUE_FILTER_LENGTH) return null;
  return OPAQUE_ID_RE.test(trimmed) ? trimmed : null;
}

function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

export function defaultCandidateListFilters(): CandidateListFilters {
  return {
    candidateId: null,
    sourceRequestId: null,
    sourceSnapshotId: null,
    sourceDate: null,
    status: null,
    limit: CANDIDATE_LIST_DEFAULT_LIMIT,
    offset: 0,
  };
}

export function parseCandidateListFilters(
  params: URLSearchParams,
): CandidateListFilters {
  const rawCandidateId = params.get("candidateId");
  const rawStatus = params.get("status");
  const rawDate = params.get("sourceDate");

  return {
    candidateId: isCandidateId(rawCandidateId) ? rawCandidateId : null,
    sourceRequestId: opaque(params.get("sourceRequestId")),
    sourceSnapshotId: opaque(params.get("sourceSnapshotId")),
    sourceDate: rawDate && isIsoDate(rawDate) ? rawDate : null,
    status:
      rawStatus && (BUILDER_CANDIDATE_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as BuilderCandidateStatus)
        : null,
    limit: boundedInt(params.get("limit"), CANDIDATE_LIST_DEFAULT_LIMIT, 1, CANDIDATE_LIST_MAX_LIMIT),
    offset: boundedInt(params.get("offset"), 0, 0, 100_000),
  };
}
