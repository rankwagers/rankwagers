/**
 * Acca publication contracts (Sprint 20B-B, stages B1 and B2).
 *
 * B1 defined the pure domain. B2 adds the SERVICE BOUNDARY TYPES at the end of this file:
 * the typed request and result shapes for creation, retrieval, listing and lifecycle
 * transitions. Those are still declarations only — no adapter, no HTTP, no UI (B3–B5). The
 * one non-local dependency is a type-only import of the candidate status vocabulary, so a
 * conflict outcome can report the candidate's real state instead of a stringly-typed copy.
 *
 * IMMUTABILITY BOUNDARY
 *   The Acca draft business snapshot is immutable after creation.
 *   Only lifecycle status, version and lifecycle audit metadata may change.
 *
 * Concretely, once an Acca record exists these never change: sourceCandidateId, title,
 * summary, locale, legs, combinedOdds, evidenceSnapshot, qualificationSnapshot,
 * sourceReferences, slug, createdAt, createdBy, schemaVersion. Only `status`, `version`,
 * `updatedAt`, `publishedAt`, `archivedAt`, `publishedBy` and `archivedBy` move.
 *
 * The snapshot is a COPY. It deliberately does not reference the candidate payload, so a
 * published Acca cannot change because upstream data changed later.
 */

import type { BuilderCandidateStatus } from "@/lib/builder-approval/contracts";

export const ACCA_SCHEMA_VERSION = "20b-b.1.0.0";

/** One consistent uppercase vocabulary, matching the candidate lifecycle style. */
export type AccaStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const ACCA_STATUSES: readonly AccaStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];

/** Every Acca is created here. Only `lifecycle.ts` may move it onwards. */
export const ACCA_INITIAL_STATUS: AccaStatus = "DRAFT";

/**
 * Coarse operator attribution, consistent with the Builder Approval domain: admin access is
 * a single shared secret, so this means "an administrator", never a named individual.
 */
export type AccaActor = "admin";
export const ACCA_ACTOR: AccaActor = "admin";

export const ACCA_LIMITS = {
  minLegs: 2,
  maxLegs: 8,
  maxTitleLength: 160,
  maxSummaryLength: 400,
  maxSlugLength: 80,
} as const;

/**
 * One selection inside a published Acca.
 *
 * Required fields are those the Builder candidate contract always carries. Everything the
 * candidate domain may legitimately omit is optional — nothing here is fabricated to fill a
 * gap, and a consumer must treat `undefined` as "not supplied by the source candidate".
 */
export type AccaLeg = {
  /** Fixture identifier from the source candidate. */
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  /** ISO-8601 kickoff captured at creation. */
  kickoffAt: string;
  /** Market identifier, e.g. "over25". */
  marketKey: string;
  /** Human label for the market, when the source supplied one. */
  marketLabel?: string;
  /** Selection identifier within the market, when the source supplied one. */
  selectionKey?: string;
  selectionLabel?: string;
  /**
   * Decimal odds captured at Acca creation time. Never re-fetched, never recalculated.
   * The public surface must state that these are point-in-time.
   */
  capturedOdds: number;
  /** Model confidence carried from the candidate, when present. */
  confidence?: number;
  /** Short evidence lines carried from the candidate, when present. */
  evidenceSummary?: string[];
  /** Candidate qualification/completeness signal, when present. */
  evidenceCompleteness?: number;
  /** Opaque per-leg source reference from the candidate, when present. */
  sourceLegId?: string;
};

/** Evidence copied from the candidate. Copied verbatim; never synthesised. */
export type AccaEvidenceSnapshot = {
  /** Aggregate evidence lines, when the candidate carried any. */
  summary?: string[];
  /** Correlation or limitation warnings carried from the candidate. */
  warnings?: string[];
  /** Completeness signal for the combination as a whole. */
  completeness?: number;
};

/** Qualification metadata copied from the candidate. */
export type AccaQualificationSnapshot = {
  averageConfidence?: number;
  riskMode?: string;
  legCount: number;
  /** True only when every leg carried captured odds. Always true here by construction. */
  oddsComplete: boolean;
};

/** Where this Acca came from. Identifiers only — never a live pointer to mutable data. */
export type AccaSourceReferences = {
  candidateId: string;
  sourceRequestId: string | null;
  sourceSnapshotId: string | null;
  sourceDate: string | null;
  /** Checksum of the candidate payload this snapshot was copied from. */
  candidatePayloadChecksum: string;
  candidateChecksumVersion: string;
};

/**
 * The durable Acca record.
 *
 * Stage B1 defines the shape only. Persistence, creation-from-candidate and the lifecycle
 * store operations belong to B2.
 */
export type AccaRecord = {
  schemaVersion: string;
  accaId: string;
  sourceCandidateId: string;
  status: AccaStatus;

  /* ---- immutable business snapshot ---- */
  title: string;
  summary: string | null;
  /** Target market/locale for the public page. */
  locale: string;
  legs: AccaLeg[];
  /** Server-calculated canonical combined odds. Never a client-submitted total. */
  combinedOdds: number;
  evidenceSnapshot: AccaEvidenceSnapshot;
  qualificationSnapshot: AccaQualificationSnapshot;
  sourceReferences: AccaSourceReferences;
  /** Public publication slug. Uniqueness is enforced by persistence in B2. */
  slug: string;

  /* ---- lifecycle + audit: the ONLY mutable fields ---- */
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  createdBy: AccaActor;
  publishedBy: AccaActor | null;
  archivedBy: AccaActor | null;
};

/**
 * Field names that may change after creation. Anything not listed is part of the immutable
 * snapshot. Exported so tests and later stages can assert the boundary mechanically rather
 * than relying on prose.
 */
export const ACCA_MUTABLE_FIELDS: readonly (keyof AccaRecord)[] = [
  "status",
  "version",
  "updatedAt",
  "publishedAt",
  "archivedAt",
  "publishedBy",
  "archivedBy",
];

export const ACCA_IMMUTABLE_FIELDS: readonly (keyof AccaRecord)[] = [
  "schemaVersion",
  "accaId",
  "sourceCandidateId",
  "title",
  "summary",
  "locale",
  "legs",
  "combinedOdds",
  "evidenceSnapshot",
  "qualificationSnapshot",
  "sourceReferences",
  "slug",
  "createdAt",
  "createdBy",
];

/* ================================================================== *
 * Stage B2 — service boundary
 *
 * Typed inputs and outputs for the five persistence-facing operations. Declarations only;
 * `service.ts` implements them and `store.ts` defines what persistence must provide.
 * ================================================================== */

/**
 * Everything a caller may supply when creating an Acca draft from an approved candidate.
 *
 * Deliberately minimal. Every field describing the *bet* — legs, odds, evidence,
 * qualification, source references — is derived server-side from the stored candidate and
 * therefore has no place here. A caller can choose the editorial framing (title, summary,
 * locale) and nothing else.
 */
export type AccaCreateRequest = {
  candidateId: string;
  /** Optimistic precondition on the source candidate. Mandatory, exactly as in B1. */
  expectedCandidateVersion: number;
  createdBy: AccaActor;
  title: string;
  summary?: string | null;
  locale: string;
  /**
   * Optional stable slug collision token. When omitted the service derives one from the
   * minted Acca id, so a retry never produces a different public slug.
   */
  slugDiscriminator?: string | null;
  /** Repository-clock timestamp. Supplied by the caller so the service stays testable. */
  createdAt: string;
};

/** The only keys a create request may carry. */
export const ACCA_CREATE_ALLOWED_KEYS: readonly string[] = [
  "candidateId",
  "expectedCandidateVersion",
  "createdBy",
  "title",
  "summary",
  "locale",
  "slugDiscriminator",
  "createdAt",
];

/**
 * Server-derived fields. Supplying any of these is a REJECTED request, never a silently
 * ignored one — silently dropping a client-supplied `combinedOdds` would let a caller believe
 * they had set the published price.
 */
export const ACCA_CREATE_REJECTED_KEYS: readonly string[] = [
  "accaId",
  "sourceCandidateId",
  "schemaVersion",
  "status",
  "version",
  "slug",
  "legs",
  "combinedOdds",
  "evidenceSnapshot",
  "qualificationSnapshot",
  "sourceReferences",
  "updatedAt",
  "publishedAt",
  "archivedAt",
  "publishedBy",
  "archivedBy",
];

/**
 * Every typed failure the B2 service layer can report.
 *
 * The `candidate_*` and `acca_*` prefixes keep the two entities' conflicts unambiguous: a
 * caller must be able to tell "the candidate moved under you" from "the Acca moved under
 * you" without inspecting anything but the code.
 */
export type AccaServiceFailureCode =
  | "candidate_not_found"
  | "candidate_status_conflict"
  | "candidate_version_conflict"
  | "candidate_already_converted"
  | "acca_already_exists_for_candidate"
  | "acca_not_found"
  | "acca_status_conflict"
  | "acca_version_conflict"
  | "slug_conflict"
  | "invalid_candidate_snapshot"
  | "invalid_odds"
  | "invalid_slug"
  | "invalid_metadata"
  | "invalid_transition"
  | "unknown_status"
  | "storage_failed";

export const ACCA_SERVICE_FAILURE_CODES: readonly AccaServiceFailureCode[] = [
  "candidate_not_found",
  "candidate_status_conflict",
  "candidate_version_conflict",
  "candidate_already_converted",
  "acca_already_exists_for_candidate",
  "acca_not_found",
  "acca_status_conflict",
  "acca_version_conflict",
  "slug_conflict",
  "invalid_candidate_snapshot",
  "invalid_odds",
  "invalid_slug",
  "invalid_metadata",
  "invalid_transition",
  "unknown_status",
  "storage_failed",
];

/**
 * Outcome of `createAccaDraftFromCandidate`.
 *
 * Every variant carries a distinct `code`, and no two variants share a shape, so a consumer
 * narrows on `code` alone and can never confuse two different failures.
 */
export type AccaCreateResult =
  | { ok: true; acca: AccaRecord }
  | { ok: false; code: "candidate_not_found" }
  | {
      ok: false;
      code: "candidate_status_conflict";
      currentStatus: BuilderCandidateStatus;
      currentVersion: number;
    }
  | {
      ok: false;
      code: "candidate_version_conflict";
      currentStatus: BuilderCandidateStatus;
      currentVersion: number;
    }
  | { ok: false; code: "candidate_already_converted"; existingAccaId: string | null }
  | { ok: false; code: "acca_already_exists_for_candidate"; existingAccaId: string }
  | { ok: false; code: "slug_conflict"; slug: string }
  | { ok: false; code: "invalid_candidate_snapshot"; detail: string; legIndex: number | null }
  | { ok: false; code: "invalid_odds"; detail: string; legIndex: number | null }
  | { ok: false; code: "invalid_slug"; detail: string }
  | { ok: false; code: "invalid_metadata"; field: string; detail: string }
  | { ok: false; code: "storage_failed"; message: string };

export type AccaTransitionRequest = {
  accaId: string;
  expectedStatus: AccaStatus;
  expectedVersion: number;
  nextStatus: AccaStatus;
  actor: AccaActor;
  transitionedAt: string;
};

export type AccaTransitionResult =
  | { ok: true; acca: AccaRecord }
  | { ok: false; code: "acca_not_found" }
  | { ok: false; code: "acca_status_conflict"; currentStatus: AccaStatus; currentVersion: number }
  | { ok: false; code: "acca_version_conflict"; currentStatus: AccaStatus; currentVersion: number }
  | { ok: false; code: "invalid_transition"; from: AccaStatus; to: AccaStatus }
  | { ok: false; code: "unknown_status" }
  | { ok: false; code: "invalid_metadata"; field: string; detail: string }
  | { ok: false; code: "storage_failed"; message: string };

export type AccaGetResult =
  | { ok: true; acca: AccaRecord }
  | { ok: false; code: "acca_not_found" }
  | { ok: false; code: "invalid_metadata"; field: string; detail: string }
  | { ok: false; code: "storage_failed"; message: string };

/**
 * One page of Acca records.
 *
 * Declared here rather than in `store.ts` so the service result type can reference it without
 * a module cycle. It carries no visibility semantics: a page may contain DRAFT and ARCHIVED
 * rows, and B5 must filter through `lifecycle.isPubliclyVisible`.
 */
export type AccaListPage = {
  rows: AccaRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type AccaListResult =
  | { ok: true; page: AccaListPage }
  | { ok: false; code: "invalid_metadata"; field: string; detail: string }
  | { ok: false; code: "storage_failed"; message: string };
