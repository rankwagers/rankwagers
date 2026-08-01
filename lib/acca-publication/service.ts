import type { BuilderPublicationCandidate } from "@/lib/builder-approval/contracts";
import type { CandidateStore } from "@/lib/builder-approval/store";
import {
  ACCA_ACTOR,
  ACCA_CREATE_REJECTED_KEYS,
  ACCA_INITIAL_STATUS,
  ACCA_LIMITS,
  type AccaCreateRequest,
  type AccaCreateResult,
  type AccaGetResult,
  type AccaListResult,
  type AccaTransitionRequest,
  type AccaTransitionResult,
} from "./contracts";
import { isSupportedLocale, type AccaListFilters } from "./filters";
import { isAccaId, mintAccaId, slugDiscriminatorFor } from "./identifiers";
import { assertAccaTransition } from "./lifecycle";
import { mapCandidateToAccaSnapshot, type MapperFailureCode } from "./mapper";
import { buildAccaSlug, isValidAccaSlug } from "./slug";
import type { AccaDraftInsert, AccaStore, CandidateConversionPrecondition } from "./store";

/**
 * Acca publication service (Sprint 20B-B, stage B2).
 *
 * SCOPE: persistence orchestration only. There are deliberately NO route handlers, no admin
 * authorization, no CSRF check, no rate limiting and no HTTP idempotency replay here — stage
 * B3 owns request-level security and the idempotency boundary, and putting any of it here
 * would give a later stage two places to enforce the same rule.
 *
 * The service is the only thing that may assemble an `AccaDraftInsert`. A caller supplies
 * editorial framing (title, summary, locale) and a precondition (candidate id + expected
 * version); everything describing the bet is read back out of the persisted candidate,
 * re-derived, and never accepted from the request. That is why `ACCA_CREATE_REJECTED_KEYS`
 * is a hard rejection rather than a silent drop.
 *
 * Storage errors are mapped to typed outcomes. Raw SQL text, driver messages, connection
 * strings and stack traces never leave this layer.
 */

export type AccaServiceDeps = {
  accaStore: AccaStore;
  candidateStore: CandidateStore;
};

export type AccaService = {
  createAccaDraftFromCandidate(request: AccaCreateRequest): Promise<AccaCreateResult>;
  getAcca(accaId: string): Promise<AccaGetResult>;
  getAccaBySlug(slug: string): Promise<AccaGetResult>;
  listAccas(filters: AccaListFilters): Promise<AccaListResult>;
  transitionAccaLifecycle(request: AccaTransitionRequest): Promise<AccaTransitionResult>;
};

/* ------------------------------------------------------------------ *
 * Input validation
 * ------------------------------------------------------------------ */

const CANDIDATE_ID_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_SLUG_DISCRIMINATOR_LENGTH = 40;

/**
 * True when the string carries a C0, DEL or C1 control character. A code-point scan rather
 * than a regex literal, so this source file never has to contain raw control characters —
 * they are invisible in editors and corrupt across encodings.
 */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) return true;
  }
  return false;
}

type TextResult = { ok: true; value: string } | { ok: false; detail: string };

/**
 * Bounded operator-supplied text.
 *
 * Trimmed, never truncated: a title one character over the limit is a rejection the operator
 * finds out about, not a headline silently cut in half on a public page.
 */
function sanitizeBoundedText(raw: unknown, max: number): TextResult {
  if (typeof raw !== "string") return { ok: false, detail: "not_a_string" };
  if (hasControlCharacters(raw)) return { ok: false, detail: "control_characters" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, detail: "empty" };
  if (trimmed.length > max) return { ok: false, detail: "too_long" };
  return { ok: true, value: trimmed };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_RE.test(value) && Number.isFinite(Date.parse(value));
}

/** Mapper codes that describe a bad PRICE rather than a bad structure. */
const ODDS_FAILURE_CODES: ReadonlySet<string> = new Set<MapperFailureCode>([
  "odds_missing",
  "odds_not_a_number",
  "odds_not_finite",
  "odds_below_minimum",
  "odds_precision_exceeded",
  "combined_odds_overflow",
]);

/* ------------------------------------------------------------------ *
 * Service
 * ------------------------------------------------------------------ */

export function createAccaService(deps: AccaServiceDeps): AccaService {
  const invalid = (field: string, detail: string) =>
    ({ ok: false, code: "invalid_metadata", field, detail }) as const;

  return {
    async createAccaDraftFromCandidate(
      request: AccaCreateRequest,
    ): Promise<AccaCreateResult> {
      /* 1. No server-derived field may be supplied, even as `undefined`. Presence of the key
            is the signal: a caller that sends `combinedOdds: undefined` still believes it
            controls the price, and must be told it does not. */
      const raw = request as unknown as Record<string, unknown>;
      if (raw && typeof raw === "object") {
        for (const key of ACCA_CREATE_REJECTED_KEYS) {
          if (Object.prototype.hasOwnProperty.call(raw, key)) {
            return invalid(key, "server_derived_field_supplied");
          }
        }
      } else {
        return invalid("request", "not_an_object");
      }

      /* 2. Identity and preconditions. */
      if (typeof request.candidateId !== "string" || !CANDIDATE_ID_RE.test(request.candidateId)) {
        return invalid("candidateId", "malformed");
      }
      if (!isPositiveInteger(request.expectedCandidateVersion)) {
        return invalid("expectedCandidateVersion", "not_a_positive_integer");
      }
      if (request.createdBy !== ACCA_ACTOR) return invalid("createdBy", "unsupported_actor");
      if (!isIsoTimestamp(request.createdAt)) return invalid("createdAt", "not_iso_8601");

      /* 3. Editorial framing. */
      const title = sanitizeBoundedText(request.title, ACCA_LIMITS.maxTitleLength);
      if (!title.ok) return invalid("title", title.detail);

      let summary: string | null = null;
      if (request.summary !== undefined && request.summary !== null) {
        const parsed = sanitizeBoundedText(request.summary, ACCA_LIMITS.maxSummaryLength);
        if (!parsed.ok) return invalid("summary", parsed.detail);
        summary = parsed.value;
      }

      if (!isSupportedLocale(request.locale)) return invalid("locale", "unsupported_locale");

      let discriminatorOverride: string | null = null;
      if (request.slugDiscriminator !== undefined && request.slugDiscriminator !== null) {
        if (
          typeof request.slugDiscriminator !== "string" ||
          request.slugDiscriminator.trim() === "" ||
          request.slugDiscriminator.length > MAX_SLUG_DISCRIMINATOR_LENGTH
        ) {
          return invalid("slugDiscriminator", "malformed");
        }
        discriminatorOverride = request.slugDiscriminator;
      }

      /* 4. Load the persisted candidate. Nothing about the bet comes from the request. */
      let candidate: BuilderPublicationCandidate | null;
      try {
        candidate = await deps.candidateStore.getCandidate(request.candidateId);
      } catch {
        return { ok: false, code: "storage_failed", message: "candidate_read_failed" };
      }
      if (!candidate) return { ok: false, code: "candidate_not_found" };

      // Already linked to an Acca — checked before the status comparison so the more specific
      // signal wins even if a future status vocabulary changes.
      if (candidate.convertedAccaId !== null || candidate.status === "CONVERTED") {
        return {
          ok: false,
          code: "candidate_already_converted",
          existingAccaId: candidate.convertedAccaId,
        };
      }
      if (candidate.status !== "APPROVED") {
        return {
          ok: false,
          code: "candidate_status_conflict",
          currentStatus: candidate.status,
          currentVersion: candidate.version,
        };
      }
      if (candidate.version !== request.expectedCandidateVersion) {
        return {
          ok: false,
          code: "candidate_version_conflict",
          currentStatus: candidate.status,
          currentVersion: candidate.version,
        };
      }

      /* 5. Explicit snapshot mapping. Combined odds are recomputed inside the mapper by the
            strict B1 calculator; the candidate's own total is never consulted. */
      const mapped = mapCandidateToAccaSnapshot(candidate);
      if (!mapped.ok) {
        const legIndex = mapped.legIndex ?? null;
        return ODDS_FAILURE_CODES.has(mapped.code)
          ? { ok: false, code: "invalid_odds", detail: mapped.code, legIndex }
          : { ok: false, code: "invalid_candidate_snapshot", detail: mapped.code, legIndex };
      }

      /* 6. Identity, then slug. The discriminator is derived from the minted id, so a retry
            that reuses the id produces the same public slug rather than a fresh random one. */
      const accaId = mintAccaId();
      const slugResult = buildAccaSlug({
        title: title.value,
        discriminator: discriminatorOverride ?? slugDiscriminatorFor(accaId),
      });
      if (!slugResult.ok) return { ok: false, code: "invalid_slug", detail: slugResult.code };
      if (!isValidAccaSlug(slugResult.slug)) {
        return { ok: false, code: "invalid_slug", detail: "slug_shape_invalid" };
      }

      const insert: AccaDraftInsert = {
        schemaVersion: mapped.snapshot.schemaVersion,
        accaId,
        sourceCandidateId: candidate.candidateId,
        status: ACCA_INITIAL_STATUS as "DRAFT",
        title: title.value,
        summary,
        locale: request.locale,
        legs: mapped.snapshot.legs,
        combinedOdds: mapped.snapshot.combinedOdds,
        evidenceSnapshot: mapped.snapshot.evidenceSnapshot,
        qualificationSnapshot: mapped.snapshot.qualificationSnapshot,
        sourceReferences: mapped.snapshot.sourceReferences,
        slug: slugResult.slug,
        version: 1,
        createdAt: request.createdAt,
        updatedAt: request.createdAt,
        createdBy: ACCA_ACTOR,
      };

      const precondition: CandidateConversionPrecondition = {
        candidateId: candidate.candidateId,
        expectedStatus: "APPROVED",
        expectedVersion: request.expectedCandidateVersion,
        actor: ACCA_ACTOR,
        transitionedAt: request.createdAt,
      };

      /* 7. One atomic unit: the draft and the candidate conversion commit together or not
            at all. The pre-checks above are convenience, not the guarantee — the guarantee is
            the adapter's transaction plus the storage-level unique constraints. */
      try {
        const outcome = await deps.accaStore.createDraftFromCandidate(insert, precondition);
        if (outcome.ok) return { ok: true, acca: outcome.acca };
        switch (outcome.code) {
          case "candidate_not_found":
            return { ok: false, code: "candidate_not_found" };
          case "candidate_status_conflict":
            return {
              ok: false,
              code: "candidate_status_conflict",
              currentStatus: outcome.currentStatus,
              currentVersion: outcome.currentVersion,
            };
          case "candidate_version_conflict":
            return {
              ok: false,
              code: "candidate_version_conflict",
              currentStatus: outcome.currentStatus,
              currentVersion: outcome.currentVersion,
            };
          case "candidate_already_converted":
            return {
              ok: false,
              code: "candidate_already_converted",
              existingAccaId: outcome.existingAccaId,
            };
          case "acca_already_exists_for_candidate":
            return {
              ok: false,
              code: "acca_already_exists_for_candidate",
              existingAccaId: outcome.existingAccaId,
            };
          case "slug_conflict":
            return { ok: false, code: "slug_conflict", slug: outcome.slug };
          default:
            // `storage_failed`. The adapter already bounded its message; it is not widened
            // here and never carries SQL text.
            return { ok: false, code: "storage_failed", message: "create_failed" };
        }
      } catch {
        return { ok: false, code: "storage_failed", message: "create_failed" };
      }
    },

    async getAcca(accaId: string): Promise<AccaGetResult> {
      if (!isAccaId(accaId)) return invalid("accaId", "malformed");
      try {
        const acca = await deps.accaStore.getAccaById(accaId);
        return acca ? { ok: true, acca } : { ok: false, code: "acca_not_found" };
      } catch {
        return { ok: false, code: "storage_failed", message: "read_failed" };
      }
    },

    async getAccaBySlug(slug: string): Promise<AccaGetResult> {
      if (!isValidAccaSlug(slug)) return invalid("slug", "malformed");
      try {
        const acca = await deps.accaStore.getAccaBySlug(slug);
        return acca ? { ok: true, acca } : { ok: false, code: "acca_not_found" };
      } catch {
        return { ok: false, code: "storage_failed", message: "read_failed" };
      }
    },

    /**
     * Listing returns whatever status the store holds, including DRAFT and ARCHIVED. Public
     * visibility is NOT applied here — stage B5 must filter through
     * `lifecycle.isPubliclyVisible`, and centralising that decision in one place is exactly
     * why this layer does not quietly pre-filter.
     */
    async listAccas(filters: AccaListFilters): Promise<AccaListResult> {
      if (!filters || typeof filters !== "object") return invalid("filters", "not_an_object");
      if (!Number.isInteger(filters.limit) || filters.limit < 1) {
        return invalid("limit", "out_of_range");
      }
      if (!Number.isInteger(filters.offset) || filters.offset < 0) {
        return invalid("offset", "out_of_range");
      }
      try {
        return { ok: true, page: await deps.accaStore.listAccas(filters) };
      } catch {
        return { ok: false, code: "storage_failed", message: "list_failed" };
      }
    },

    async transitionAccaLifecycle(
      request: AccaTransitionRequest,
    ): Promise<AccaTransitionResult> {
      if (!isAccaId(request.accaId)) return invalid("accaId", "malformed");
      if (!isPositiveInteger(request.expectedVersion)) {
        return invalid("expectedVersion", "not_a_positive_integer");
      }
      if (request.actor !== ACCA_ACTOR) return invalid("actor", "unsupported_actor");
      if (!isIsoTimestamp(request.transitionedAt)) {
        return invalid("transitionedAt", "not_iso_8601");
      }

      // Legality is checked against the caller's EXPECTED status before touching storage, so
      // an illegal request is rejected as illegal rather than surfacing as a status conflict.
      const legality = assertAccaTransition(request.expectedStatus, request.nextStatus);
      if (!legality.ok) {
        return legality.code === "unknown_status"
          ? { ok: false, code: "unknown_status" }
          : { ok: false, code: "invalid_transition", from: legality.from, to: legality.to };
      }

      try {
        const outcome = await deps.accaStore.transitionAccaStatus({
          accaId: request.accaId,
          expectedStatus: request.expectedStatus,
          expectedVersion: request.expectedVersion,
          nextStatus: request.nextStatus,
          actor: ACCA_ACTOR,
          transitionedAt: request.transitionedAt,
        });
        if (outcome.ok) return { ok: true, acca: outcome.acca };
        switch (outcome.code) {
          case "acca_not_found":
            return { ok: false, code: "acca_not_found" };
          case "status_conflict":
            return {
              ok: false,
              code: "acca_status_conflict",
              currentStatus: outcome.currentStatus,
              currentVersion: outcome.currentVersion,
            };
          case "version_conflict":
            return {
              ok: false,
              code: "acca_version_conflict",
              currentStatus: outcome.currentStatus,
              currentVersion: outcome.currentVersion,
            };
          case "invalid_transition":
            return { ok: false, code: "invalid_transition", from: outcome.from, to: outcome.to };
          case "unknown_status":
            return { ok: false, code: "unknown_status" };
          default:
            return { ok: false, code: "storage_failed", message: "transition_failed" };
        }
      } catch {
        return { ok: false, code: "storage_failed", message: "transition_failed" };
      }
    },
  };
}
