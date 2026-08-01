import { ACCA_STATUSES, type AccaStatus } from "./contracts";

/**
 * Acca lifecycle rules (Sprint 20B-B, stage B1).
 *
 * Pure and side-effect free. No persistence, no publish/archive operations — B2 owns those
 * and must call this module rather than re-deriving the rules.
 *
 *     DRAFT ──► PUBLISHED ──► ARCHIVED
 *
 * Everything else is invalid for this sprint, INCLUDING same-state transitions, for the same
 * reason as the candidate lifecycle: idempotency is an operation-level concern (stage B3),
 * not a state-machine no-op. Treating PUBLISHED to PUBLISHED as success would let a stale
 * caller believe it performed the publication.
 *
 * Archived is terminal: an archived Acca never silently returns to published. Re-publishing
 * requires a deliberate new record, which keeps the public snapshot honest.
 */

const ALLOWED_ACCA_TRANSITIONS: Record<AccaStatus, readonly AccaStatus[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const TERMINAL_ACCA_STATUSES: readonly AccaStatus[] = ["ARCHIVED"];

export function isAccaStatus(value: unknown): value is AccaStatus {
  return typeof value === "string" && (ACCA_STATUSES as readonly string[]).includes(value);
}

export function isTerminalAccaStatus(status: AccaStatus): boolean {
  return TERMINAL_ACCA_STATUSES.includes(status);
}

export function allowedAccaTransitions(from: AccaStatus): readonly AccaStatus[] {
  return ALLOWED_ACCA_TRANSITIONS[from] ?? [];
}

export function canTransitionAcca(from: AccaStatus, to: AccaStatus): boolean {
  return allowedAccaTransitions(from).includes(to);
}

export type AccaTransitionCheck =
  | { ok: true }
  | { ok: false; code: "unknown_status" }
  | { ok: false; code: "invalid_transition"; from: AccaStatus; to: AccaStatus };

export function assertAccaTransition(from: unknown, to: unknown): AccaTransitionCheck {
  if (!isAccaStatus(from) || !isAccaStatus(to)) {
    return { ok: false, code: "unknown_status" };
  }
  if (!canTransitionAcca(from, to)) {
    return { ok: false, code: "invalid_transition", from, to };
  }
  return { ok: true };
}

/**
 * Only a PUBLISHED Acca is publicly visible.
 *
 * Centralised so every public surface in B5 asks the same question, and a DRAFT or ARCHIVED
 * record cannot leak because one page forgot a filter.
 */
export function isPubliclyVisible(status: AccaStatus): boolean {
  return status === "PUBLISHED";
}

/** Which lifecycle audit fields a given target status populates. */
export function accaTransitionAudit(to: AccaStatus): {
  setsPublishedAt: boolean;
  setsArchivedAt: boolean;
} {
  return {
    setsPublishedAt: to === "PUBLISHED",
    setsArchivedAt: to === "ARCHIVED",
  };
}
