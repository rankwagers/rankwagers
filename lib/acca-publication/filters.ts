import { ACCA_STATUSES, type AccaStatus } from "./contracts";

/**
 * Acca list filters (Sprint 20B-B, stage B2).
 *
 * Every field is a fixed, named column. No request value ever becomes a column name, a sort
 * key or a sort direction — ordering is hard-coded in the adapters, matching the Builder
 * Approval convention.
 *
 * Ordering is `createdAt DESC, accaId DESC`. The secondary key makes paging deterministic
 * even when several Accas share a creation millisecond.
 */

export type AccaListFilters = {
  status: AccaStatus | null;
  locale: string | null;
  sourceCandidateId: string | null;
  createdBefore: string | null;
  createdAfter: string | null;
  publishedBefore: string | null;
  publishedAfter: string | null;
  limit: number;
  offset: number;
};

export const ACCA_LIST_DEFAULT_LIMIT = 25;
export const ACCA_LIST_MAX_LIMIT = 100;

const LOCALE_RE = /^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/;
const OPAQUE_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isSupportedLocale(value: unknown): value is string {
  return typeof value === "string" && LOCALE_RE.test(value);
}

function opaque(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed && OPAQUE_ID_RE.test(trimmed) ? trimmed : null;
}

function isoOrNull(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return ISO_RE.test(trimmed) && Number.isFinite(Date.parse(trimmed)) ? trimmed : null;
}

function boundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function defaultAccaListFilters(): AccaListFilters {
  return {
    status: null,
    locale: null,
    sourceCandidateId: null,
    createdBefore: null,
    createdAfter: null,
    publishedBefore: null,
    publishedAfter: null,
    limit: ACCA_LIST_DEFAULT_LIMIT,
    offset: 0,
  };
}

export function parseAccaListFilters(params: URLSearchParams): AccaListFilters {
  const rawStatus = params.get("status");
  const rawLocale = params.get("locale");
  return {
    status:
      rawStatus && (ACCA_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as AccaStatus)
        : null,
    locale: isSupportedLocale(rawLocale) ? rawLocale : null,
    sourceCandidateId: opaque(params.get("sourceCandidateId")),
    createdBefore: isoOrNull(params.get("createdBefore")),
    createdAfter: isoOrNull(params.get("createdAfter")),
    publishedBefore: isoOrNull(params.get("publishedBefore")),
    publishedAfter: isoOrNull(params.get("publishedAfter")),
    limit: boundedInt(params.get("limit"), ACCA_LIST_DEFAULT_LIMIT, 1, ACCA_LIST_MAX_LIMIT),
    offset: boundedInt(params.get("offset"), 0, 0, 100_000),
  };
}
