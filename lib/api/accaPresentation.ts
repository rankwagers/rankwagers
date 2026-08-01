import {
  ACCA_LIST_MAX_LIMIT,
  isSupportedLocale,
  type AccaListFilters,
} from "@/lib/acca-publication/filters";
import { ACCA_STATUSES, type AccaRecord, type AccaStatus } from "@/lib/acca-publication/contracts";

/**
 * Safe admin representations and strict query parsing (Sprint 20B-B, stage B3).
 *
 * Two jobs, both about not leaking and not guessing:
 *
 *  1. Build the response view of an Acca by EXPLICIT field selection, never by spreading the
 *     stored record. A future internal field therefore cannot appear in an API response by
 *     accident — the same discipline the B2 mapper applies to the candidate.
 *
 *  2. Parse admin list queries STRICTLY. `parseAccaListFilters` (B2) is tolerant by design: it
 *     turns an unrecognised value into `null`, which is right for a URL that must never 500,
 *     but wrong for an admin API where `?status=bogus` silently returning everything is a
 *     misleading answer to a question the caller thought they asked.
 */

/** Compact view: lists, and the response to a create/publish/archive mutation. */
export type AccaSummaryView = {
  accaId: string;
  sourceCandidateId: string;
  status: AccaStatus;
  version: number;
  title: string;
  summary: string | null;
  locale: string;
  slug: string;
  combinedOdds: number;
  legCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  publishedAt: string | null;
  publishedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
};

export function summarizeAcca(acca: AccaRecord): AccaSummaryView {
  return {
    accaId: acca.accaId,
    sourceCandidateId: acca.sourceCandidateId,
    status: acca.status,
    version: acca.version,
    title: acca.title,
    summary: acca.summary,
    locale: acca.locale,
    slug: acca.slug,
    combinedOdds: acca.combinedOdds,
    legCount: acca.legs.length,
    createdAt: acca.createdAt,
    updatedAt: acca.updatedAt,
    createdBy: acca.createdBy,
    publishedAt: acca.publishedAt,
    publishedBy: acca.publishedBy,
    archivedAt: acca.archivedAt,
    archivedBy: acca.archivedBy,
  };
}

/**
 * Full admin detail view.
 *
 * Includes the legs and the evidence/qualification snapshots, which an operator needs in order
 * to decide whether to publish. It deliberately does NOT include the candidate payload or the
 * payload checksum: the Acca is a self-contained copy, and echoing candidate storage internals
 * back through the API would serve no operator purpose.
 */
export type AccaDetailView = AccaSummaryView & {
  schemaVersion: string;
  legs: Array<{
    matchId: number;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    kickoffAt: string;
    marketKey: string;
    marketLabel: string | null;
    selectionKey: string | null;
    selectionLabel: string | null;
    capturedOdds: number;
    confidence: number | null;
  }>;
  evidenceSnapshot: {
    summary: string[] | null;
    warnings: string[] | null;
    completeness: number | null;
  };
  qualificationSnapshot: {
    legCount: number;
    oddsComplete: boolean;
    averageConfidence: number | null;
    riskMode: string | null;
  };
  sourceReferences: {
    candidateId: string;
    sourceRequestId: string | null;
    sourceSnapshotId: string | null;
    sourceDate: string | null;
  };
};

export function detailAcca(acca: AccaRecord): AccaDetailView {
  return {
    ...summarizeAcca(acca),
    schemaVersion: acca.schemaVersion,
    legs: acca.legs.map((leg) => ({
      matchId: leg.matchId,
      homeTeam: leg.homeTeam,
      awayTeam: leg.awayTeam,
      competition: leg.competition,
      kickoffAt: leg.kickoffAt,
      marketKey: leg.marketKey,
      marketLabel: leg.marketLabel ?? null,
      selectionKey: leg.selectionKey ?? null,
      selectionLabel: leg.selectionLabel ?? null,
      capturedOdds: leg.capturedOdds,
      confidence: leg.confidence ?? null,
    })),
    evidenceSnapshot: {
      summary: acca.evidenceSnapshot.summary ?? null,
      warnings: acca.evidenceSnapshot.warnings ?? null,
      completeness: acca.evidenceSnapshot.completeness ?? null,
    },
    qualificationSnapshot: {
      legCount: acca.qualificationSnapshot.legCount,
      oddsComplete: acca.qualificationSnapshot.oddsComplete,
      averageConfidence: acca.qualificationSnapshot.averageConfidence ?? null,
      riskMode: acca.qualificationSnapshot.riskMode ?? null,
    },
    sourceReferences: {
      candidateId: acca.sourceReferences.candidateId,
      sourceRequestId: acca.sourceReferences.sourceRequestId,
      sourceSnapshotId: acca.sourceReferences.sourceSnapshotId,
      sourceDate: acca.sourceReferences.sourceDate,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Strict admin list query parsing
 * ------------------------------------------------------------------ */

export const ACCA_LIST_QUERY_KEYS = [
  "status",
  "locale",
  "sourceCandidateId",
  "createdAfter",
  "createdBefore",
  "publishedAfter",
  "publishedBefore",
  "limit",
  "offset",
] as const;

export type ListQueryResult =
  | { ok: true; filters: AccaListFilters }
  | { ok: false; param: string; reason: string };

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const OPAQUE_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;

/**
 * Parse an admin list query, rejecting anything it does not understand.
 *
 * Out-of-range `limit` is a rejection rather than a clamp: a caller who asks for 5000 and
 * silently receives 100 has been given a wrong answer to their question.
 */
export function parseStrictAccaListQuery(params: URLSearchParams): ListQueryResult {
  for (const key of params.keys()) {
    if (!(ACCA_LIST_QUERY_KEYS as readonly string[]).includes(key)) {
      return { ok: false, param: key, reason: "unknown_query_parameter" };
    }
  }

  const filters: AccaListFilters = {
    status: null,
    locale: null,
    sourceCandidateId: null,
    createdBefore: null,
    createdAfter: null,
    publishedBefore: null,
    publishedAfter: null,
    limit: 25,
    offset: 0,
  };

  const status = params.get("status");
  if (status !== null) {
    if (!(ACCA_STATUSES as readonly string[]).includes(status)) {
      return { ok: false, param: "status", reason: "unsupported_status" };
    }
    filters.status = status as AccaStatus;
  }

  const locale = params.get("locale");
  if (locale !== null) {
    if (!isSupportedLocale(locale)) {
      return { ok: false, param: "locale", reason: "unsupported_locale" };
    }
    filters.locale = locale;
  }

  const candidateId = params.get("sourceCandidateId");
  if (candidateId !== null) {
    if (!OPAQUE_ID_RE.test(candidateId)) {
      return { ok: false, param: "sourceCandidateId", reason: "malformed" };
    }
    filters.sourceCandidateId = candidateId;
  }

  for (const key of ["createdAfter", "createdBefore", "publishedAfter", "publishedBefore"] as const) {
    const raw = params.get(key);
    if (raw === null) continue;
    if (!ISO_RE.test(raw) || !Number.isFinite(Date.parse(raw))) {
      return { ok: false, param: key, reason: "not_iso_8601" };
    }
    filters[key] = raw;
  }

  const limit = params.get("limit");
  if (limit !== null) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > ACCA_LIST_MAX_LIMIT) {
      return { ok: false, param: "limit", reason: "out_of_range" };
    }
    filters.limit = parsed;
  }

  const offset = params.get("offset");
  if (offset !== null) {
    const parsed = Number(offset);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100_000) {
      return { ok: false, param: "offset", reason: "out_of_range" };
    }
    filters.offset = parsed;
  }

  return { ok: true, filters };
}
