import type { AccaRecord, AccaStatus } from "./contracts";
import { allowedAccaTransitions, isPubliclyVisible } from "./lifecycle";

/**
 * Presentation helpers for the Admin Acca Studio (Sprint 20B-B, stage B4).
 *
 * PURE FORMATTING ONLY. No I/O, nothing server-only, no store access, and no recomputation of
 * anything the domain already decided. It mirrors `lib/builder-approval/presentation.ts`
 * deliberately, so the two admin surfaces read the same way.
 *
 * The governing rule, inherited from Phase E: **never invent a value.** Every absent field gets
 * an explicit absence label. An Acca that carries no evidence must LOOK like it carries no
 * evidence — the operator has to be able to see that before deciding to publish.
 */

/** Explicit absence labels. Never substitute a plausible-looking default. */
export const ABSENT = {
  notProvided: "Not provided",
  unavailable: "Unavailable",
  unknown: "Unknown",
  none: "None recorded",
} as const;

export function textOrAbsent(value: unknown, absent: string = ABSENT.notProvided): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (value === null || value === undefined) return absent;
  return ABSENT.unknown;
}

export function numberOrAbsent(value: unknown, absent: string = ABSENT.notProvided): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value === null || value === undefined) return absent;
  return ABSENT.unknown;
}

/**
 * ISO-8601 UTC rendering.
 *
 * Deliberately not locale-formatted on the client: a client-only formatter risks a
 * server/client hydration mismatch, and this is an operational surface where an unambiguous
 * absolute timestamp beats a localised one.
 */
export function isoUtc(value: unknown): { display: string; machine: string | null } {
  if (typeof value !== "string" || !value) return { display: ABSENT.notProvided, machine: null };
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return { display: ABSENT.unknown, machine: null };
  const iso = new Date(ms).toISOString();
  return { display: `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`, machine: iso };
}

/**
 * Decimal odds for display.
 *
 * Two decimals is the conventional presentation. The STORED value keeps four, and the stored
 * value is what the domain computed — this is a display string and must never be fed back into
 * a calculation.
 */
export function displayOdds(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : ABSENT.unknown;
}

/* ------------------------------------------------------------------ *
 * Lifecycle
 * ------------------------------------------------------------------ */

export type AccaStatusBadge = {
  status: string;
  label: string;
  detail: string;
  /** Status is never communicated by colour alone — the label carries the meaning. */
  tone: "draft" | "published" | "archived" | "unknown";
  publiclyVisible: boolean;
};

export function statusBadge(acca: AccaRecord): AccaStatusBadge {
  switch (acca.status) {
    case "DRAFT":
      return {
        status: "DRAFT",
        label: "Draft — not publicly visible",
        detail: "Only administrators can see this. It has no public page.",
        tone: "draft",
        publiclyVisible: isPubliclyVisible("DRAFT"),
      };
    case "PUBLISHED":
      return {
        status: "PUBLISHED",
        label: "Published",
        detail: "Marked publicly visible. Public pages arrive in a later stage.",
        tone: "published",
        publiclyVisible: isPubliclyVisible("PUBLISHED"),
      };
    case "ARCHIVED":
      return {
        status: "ARCHIVED",
        label: "Archived — no longer publicly visible",
        detail:
          "Withdrawn from public visibility. Its publication history is retained and it cannot be re-published.",
        tone: "archived",
        publiclyVisible: isPubliclyVisible("ARCHIVED"),
      };
    default:
      return {
        status: textOrAbsent(acca.status, ABSENT.unknown),
        label: ABSENT.unknown,
        detail: "The stored status is not one this interface recognises.",
        tone: "unknown",
        publiclyVisible: false,
      };
  }
}

export type AccaAction = "publish" | "archive";

/**
 * Which action the operator may take, derived from the SAME transition table the store
 * enforces. The UI therefore cannot offer a button the domain would refuse — and when no
 * action is available it says why rather than rendering a disabled control with no explanation.
 */
export function availableAction(status: AccaStatus): {
  action: AccaAction | null;
  reason: string;
} {
  const allowed = allowedAccaTransitions(status);
  if (allowed.includes("PUBLISHED")) {
    return { action: "publish", reason: "" };
  }
  if (allowed.includes("ARCHIVED")) {
    return { action: "archive", reason: "" };
  }
  return {
    action: null,
    reason:
      status === "ARCHIVED"
        ? "Archived is final. Re-publishing would change what a reader already saw, so it requires a new Acca."
        : "No lifecycle action is available from this state.",
  };
}

/* ------------------------------------------------------------------ *
 * Evidence completeness
 * ------------------------------------------------------------------ */

/**
 * Honest evidence assessment for the operator.
 *
 * The B2 contract makes every evidence field optional, so an Acca CAN carry an empty evidence
 * snapshot. This surfaces that plainly instead of rendering an empty section that reads as
 * "nothing to report". It is an operator warning only: B4 changes no contract and blocks no
 * publication. The decision stays with the operator, which is the point — the platform presents
 * evidence and a human decides.
 */
export type EvidenceAssessment = {
  hasSummary: boolean;
  hasWarnings: boolean;
  hasCompleteness: boolean;
  hasAnyEvidence: boolean;
  legsWithConfidence: number;
  legCount: number;
  /** True when nothing explanatory is attached to this Acca at all. */
  empty: boolean;
  notice: string | null;
};

export function assessEvidence(acca: AccaRecord): EvidenceAssessment {
  const summary = acca.evidenceSnapshot.summary ?? [];
  const warnings = acca.evidenceSnapshot.warnings ?? [];
  const hasSummary = summary.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasCompleteness = typeof acca.evidenceSnapshot.completeness === "number";
  const legsWithConfidence = acca.legs.filter(
    (leg) => typeof leg.confidence === "number",
  ).length;
  const hasAnyEvidence = hasSummary || hasWarnings || hasCompleteness || legsWithConfidence > 0;

  return {
    hasSummary,
    hasWarnings,
    hasCompleteness,
    hasAnyEvidence,
    legsWithConfidence,
    legCount: acca.legs.length,
    empty: !hasAnyEvidence,
    notice: hasAnyEvidence
      ? null
      : "This Acca carries no evidence lines, no warnings, no completeness signal and no per-selection confidence. Publishing it would show readers a combination with nothing to explain it.",
  };
}

/* ------------------------------------------------------------------ *
 * Durability
 * ------------------------------------------------------------------ */

export type DurabilityBadge = {
  mode: string;
  durable: boolean;
  label: string;
  detail: string;
};

export function durabilityBadge(storage: {
  mode: string;
  durable: boolean;
}): DurabilityBadge {
  return {
    mode: storage.mode,
    durable: storage.durable,
    label: storage.durable ? "Durable" : "Not durable",
    detail: storage.durable
      ? "Stored in PostgreSQL. Survives process restart."
      : "Held in process memory. Lost on restart, and process-local. Publishing from memory storage is not production behaviour.",
  };
}

/* ------------------------------------------------------------------ *
 * Selections
 * ------------------------------------------------------------------ */

export type AccaLegView = {
  index: number;
  fixture: string;
  competition: string;
  market: string;
  selection: string;
  kickoffAt: { display: string; machine: string | null };
  capturedOdds: string;
  confidence: string;
};

/**
 * Display view of the stored selections.
 *
 * Values are shown exactly as stored. Nothing is re-fetched and nothing is recomputed: the Acca
 * is an immutable snapshot, and an admin surface that silently refreshed a price would make the
 * stored combined odds inconsistent with the selections shown beside them.
 */
export function legViews(acca: AccaRecord): AccaLegView[] {
  return acca.legs.map((leg, index) => ({
    index: index + 1,
    fixture: `${textOrAbsent(leg.homeTeam, ABSENT.unknown)} v ${textOrAbsent(leg.awayTeam, ABSENT.unknown)}`,
    competition: textOrAbsent(leg.competition),
    market: textOrAbsent(leg.marketLabel) === ABSENT.notProvided
      ? textOrAbsent(leg.marketKey, ABSENT.unknown)
      : `${textOrAbsent(leg.marketLabel)} (${textOrAbsent(leg.marketKey, ABSENT.unknown)})`,
    selection: textOrAbsent(leg.selectionLabel ?? leg.selectionKey),
    kickoffAt: isoUtc(leg.kickoffAt),
    capturedOdds: displayOdds(leg.capturedOdds),
    confidence: numberOrAbsent(leg.confidence),
  }));
}

/**
 * Standing disclosure shown wherever captured odds appear.
 *
 * The B1 contract requires the public surface to state that prices are point-in-time. The admin
 * surface says it too, so an operator publishing an Acca knows exactly what a reader will and
 * will not be told.
 */
export const CAPTURED_ODDS_NOTE =
  "Odds were captured when this Acca was created and are never re-fetched. They may no longer be available at any bookmaker.";

export const NOT_ADVICE_NOTE =
  "An Acca is a record of evidence, not a recommendation or a tip. Nothing here predicts an outcome or advises a stake.";

/* ------------------------------------------------------------------ *
 * Action failures
 * ------------------------------------------------------------------ */

/**
 * Plain-language rendering of an admin API failure code.
 *
 * Shared by every action control so the same failure always reads the same way. Two rules:
 *
 *  1. The mapping is from the CODE only. No server-supplied message is ever rendered, so a
 *     driver string or SQL fragment cannot reach the screen through this path even if a future
 *     endpoint started returning one.
 *  2. An unrecognised code produces a generic sentence plus the raw code for a bug report —
 *     never a blank error, and never a guess at what went wrong.
 */
export function describeActionError(
  code: unknown,
  extras: { currentStatus?: unknown; retryAfterSec?: number | null } = {},
): string {
  const current =
    typeof extras.currentStatus === "string" ? ` It is now ${extras.currentStatus}.` : "";
  switch (code) {
    case "authentication_required":
    case "insecure_admin_secret":
      return "Your admin session is no longer valid. Reload the page and sign in again.";
    case "forbidden":
      return "This account is not permitted to perform that action.";
    case "csrf_cross_site":
    case "csrf_origin_mismatch":
    case "csrf_origin_missing":
    case "csrf_origin_malformed":
    case "csrf_origin_unconfigured":
      return "The request was blocked as a possible cross-site request. Reload the page and try again.";
    case "rate_limited":
      return extras.retryAfterSec
        ? `Too many admin actions. Try again in ${extras.retryAfterSec} seconds.`
        : "Too many admin actions in a short period. Wait a moment and try again.";
    case "status_conflict":
    case "acca_status_conflict":
      return `This changed after the page was loaded, so nothing was modified.${current} Reload to see the current state.`;
    case "version_conflict":
    case "acca_version_conflict":
    case "candidate_version_conflict":
      return "Someone else changed this while the page was open, so nothing was modified. Reload and try again.";
    case "candidate_status_conflict":
      return `The candidate is not in the required state, so nothing was modified.${current}`;
    case "candidate_already_converted":
    case "acca_already_exists_for_candidate":
      return "An Acca has already been created from this candidate. A candidate can only ever produce one.";
    case "candidate_not_found":
      return "That candidate no longer exists.";
    case "acca_not_found":
      return "That Acca no longer exists.";
    case "slug_conflict":
      return "Another Acca already uses the public link this title would produce. Change the title.";
    case "invalid_candidate_snapshot":
      return "The stored candidate cannot produce a publishable Acca — a selection is missing required data. Nothing was created.";
    case "invalid_odds":
      return "One of the captured prices is unusable, so combined odds could not be calculated. Nothing was created.";
    case "invalid_slug":
      return "This title does not produce a usable public link. Use a title containing letters or numbers.";
    case "invalid_transition":
      return "That lifecycle change is not allowed from the current state.";
    case "idempotency_conflict":
      return "This action was already submitted with different details. Reload the page and try again.";
    case "idempotency_key_required":
      return "The request was missing its retry-protection key. Reload the page and try again.";
    case "invalid_request":
    case "invalid_metadata":
      return "The details supplied were not accepted. Check the fields and try again.";
    case "payload_too_large":
      return "The submitted content is too large.";
    case "route_disabled":
      return "This feature is currently disabled.";
    case "storage_failed":
      return "Storage did not accept the change. Nothing was modified. Try again shortly.";
    default:
      return typeof code === "string" && code
        ? `The action did not complete (${code}). Nothing was modified.`
        : "The action did not complete. Nothing was modified.";
  }
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */

export type PageModel = {
  total: number;
  limit: number;
  offset: number;
  shown: number;
  firstIndex: number;
  lastIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevOffset: number;
  nextOffset: number;
};

export function pageModel(input: {
  total: number;
  limit: number;
  offset: number;
  shown: number;
}): PageModel {
  const { total, limit, offset, shown } = input;
  return {
    total,
    limit,
    offset,
    shown,
    firstIndex: shown === 0 ? 0 : offset + 1,
    lastIndex: offset + shown,
    hasPrev: offset > 0,
    hasNext: offset + shown < total,
    prevOffset: Math.max(0, offset - limit),
    nextOffset: offset + limit,
  };
}
