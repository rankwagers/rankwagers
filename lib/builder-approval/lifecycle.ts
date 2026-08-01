import {
  BUILDER_CANDIDATE_STATUSES,
  CANDIDATE_NOTE_MAX_LENGTH,
  type BuilderCandidateStatus,
} from "./contracts";

/**
 * Candidate lifecycle rules (Sprint 20B-B, Decision 2).
 *
 * Pure and side-effect free: no I/O, no storage, no clock. The store and both adapters
 * enforce these same rules, so this module is the single definition of what is legal and the
 * memory and PostgreSQL paths cannot drift apart.
 *
 *     DRAFT ──► APPROVED ──► CONVERTED
 *       └────► REJECTED
 *
 * Everything else is invalid for this sprint, INCLUDING same-state transitions. There is no
 * silent coercion and no state repair: an illegal request is a typed conflict, never a no-op.
 */

const ALLOWED_CANDIDATE_TRANSITIONS: Record<
  BuilderCandidateStatus,
  readonly BuilderCandidateStatus[]
> = {
  DRAFT: ["APPROVED", "REJECTED"],
  APPROVED: ["CONVERTED"],
  REJECTED: [],
  CONVERTED: [],
};

/** Statuses from which no further transition is legal in this sprint. */
export const TERMINAL_CANDIDATE_STATUSES: readonly BuilderCandidateStatus[] = [
  "REJECTED",
  "CONVERTED",
];

export function isBuilderCandidateStatus(value: unknown): value is BuilderCandidateStatus {
  return (
    typeof value === "string" &&
    (BUILDER_CANDIDATE_STATUSES as readonly string[]).includes(value)
  );
}

export function isTerminalCandidateStatus(status: BuilderCandidateStatus): boolean {
  return TERMINAL_CANDIDATE_STATUSES.includes(status);
}

export function allowedCandidateTransitions(
  from: BuilderCandidateStatus,
): readonly BuilderCandidateStatus[] {
  return ALLOWED_CANDIDATE_TRANSITIONS[from] ?? [];
}

/**
 * Same-state transitions are INVALID rather than idempotent.
 *
 * The idempotent unit in this system is the *operation* (guarded by an idempotency key at
 * the API boundary in stage B3), not the state machine. Treating APPROVED to APPROVED as a
 * success here would let a stale client that lost a race believe it performed the approval,
 * which is exactly the ambiguity the expected-status precondition exists to remove.
 */
export function canTransitionCandidate(
  from: BuilderCandidateStatus,
  to: BuilderCandidateStatus,
): boolean {
  return allowedCandidateTransitions(from).includes(to);
}

export type CandidateTransitionCheck =
  | { ok: true }
  | { ok: false; code: "unknown_status" }
  | {
      ok: false;
      code: "invalid_transition";
      from: BuilderCandidateStatus;
      to: BuilderCandidateStatus;
    };

export function assertCandidateTransition(
  from: unknown,
  to: unknown,
): CandidateTransitionCheck {
  if (!isBuilderCandidateStatus(from) || !isBuilderCandidateStatus(to)) {
    return { ok: false, code: "unknown_status" };
  }
  if (!canTransitionCandidate(from, to)) {
    return { ok: false, code: "invalid_transition", from, to };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Operator note contract
 * ------------------------------------------------------------------ */

export type OperatorNoteResult =
  | { ok: true; value: string | null }
  | {
      ok: false;
      code: "note_not_string" | "note_empty" | "note_too_long" | "note_control_chars";
    };

/**
 * True when the string carries a C0 (0x00-0x1F), DEL (0x7F) or C1 (0x80-0x9F) control
 * character. Implemented as a code-point scan rather than a regex literal so the source file
 * never has to contain raw control characters.
 */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) return true;
  }
  return false;
}

/**
 * Bounded, sanitized operator note.
 *
 * Free text written by an operator, so it is length-bounded and rejected outright if it
 * carries control characters (which could corrupt logs or terminal output). It is NOT
 * silently truncated or stripped: a bad note is a validation failure, so the operator finds
 * out rather than having their reason quietly mangled.
 *
 * Absent and explicit null both mean "no note". Unlike the optional source identifiers in
 * Phase D, a note carries no idempotency significance, so collapsing them is safe here.
 */
export function sanitizeOperatorNote(raw: unknown): OperatorNoteResult {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, code: "note_not_string" };
  if (hasControlCharacters(raw)) return { ok: false, code: "note_control_chars" };
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, code: "note_empty" };
  if (trimmed.length > CANDIDATE_NOTE_MAX_LENGTH) return { ok: false, code: "note_too_long" };
  return { ok: true, value: trimmed };
}

/**
 * Which lifecycle metadata a given target status may carry.
 * Enforced so a caller cannot smuggle a rejection note onto an approval, or an Acca id onto
 * anything other than a conversion.
 */
export function transitionMetadataRules(to: BuilderCandidateStatus): {
  acceptsReason: boolean;
  acceptsConvertedAccaId: boolean;
} {
  return {
    acceptsReason: to === "REJECTED",
    acceptsConvertedAccaId: to === "CONVERTED",
  };
}
