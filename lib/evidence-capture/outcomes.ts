/**
 * Settlement outcome mapper (Sprint 23B, Milestone M8) — PURE, deterministic, dormant.
 *
 * Given a terminal fixture lifecycle classification, an authoritative provider row and a
 * single supported snapshot market/selection, this returns the settlement outcome for that
 * one selection. It writes nothing, reads no clock/env/network, and mutates no caller input.
 *
 * DESIGN RULES ENFORCED HERE (from `docs/plans/m8-settlement-architecture-review.md`)
 * -----------------------------------------------------------------------------------
 * R1 — Deterministic timestamps: `settledAt` is ONLY ever the caller-supplied
 *      `completionInstant` (a source-derived terminal instant). No `Date.now()`/`new Date()`.
 *      A missing/malformed instant fails closed (`invalid_timestamp`); it is never substituted.
 * R2 — Lifecycle authority: terminal classification comes from `resolveMatchLifecycle`
 *      (passed in as `lifecycle`), never from daily-list won/lost strings. cancelled/abandoned/
 *      postponed are first-class terminals here.
 * R3 — Missing half-time data: FH/SH are only evaluated once the required period score is
 *      proven present (`resolveHalfScores`); otherwise the outcome is `pending`, never `lost`.
 * R4 — Pending is not persisted: `pending` carries no timestamp and the orchestrator writes
 *      no record for it.
 * R6 — Void is never synthesized from daily-list data: `market_void` is produced ONLY when the
 *      caller passes an explicit `authoritativeMarketVoid` flag (no daily-list caller sets it).
 *
 * Node-safe / browser-safe: no side effects, no I/O.
 */

import type { FootyMatchRow, MatchListKind } from "@/lib/footystats/types";
import type { MatchLifecycleStatus } from "@/lib/fixtures/types";
import type { ValidationReasonCode, ValidationState } from "@/types/evidence";
import { isPredictionWin } from "@/lib/footystats/predictionWin";
import { resolveHalfScores } from "@/lib/footystats/halfScores";
import { isIsoInstant } from "@/lib/evidence/snapshot";
import { kindForMarketKey } from "./markets";

/** The one canonical daily-list selection per market. Frozen (see `markets.ts`). */
const CANONICAL_SELECTION_KEY = "over";

const LIFECYCLE_STATES: readonly MatchLifecycleStatus[] = [
  "scheduled",
  "pre_match",
  "live",
  "half_time",
  "finished",
  "postponed",
  "cancelled",
  "abandoned",
  "suspended",
  "unavailable",
];

export type OutcomeInvalidCode =
  | "malformed_row"
  | "invalid_lifecycle"
  | "invalid_timestamp";

/**
 * The settlement outcome for ONE snapshot selection. A discriminated union so the caller
 * cannot confuse "no record" (pending/unsupported/invalid) with "write a terminal record".
 */
export type ValidationOutcome =
  | {
      kind: "settled";
      state: Extract<ValidationState, "won" | "lost">;
      reasonCode: Extract<ValidationReasonCode, "settled_result">;
      /** Deterministic, source-derived. Equal to the supplied `completionInstant`. */
      settledAt: string;
    }
  | {
      kind: "terminal_non_scored";
      state: Extract<ValidationState, "postponed" | "cancelled" | "abandoned" | "void">;
      reasonCode: Extract<
        ValidationReasonCode,
        "fixture_postponed" | "fixture_cancelled" | "fixture_abandoned" | "market_void"
      >;
      settledAt: string;
    }
  | {
      kind: "pending";
      state: Extract<ValidationState, "pending">;
      reasonCode: Extract<ValidationReasonCode, "awaiting_result">;
    }
  | {
      kind: "unsupported";
      marketKey: string;
      selectionKey: string;
      message: string;
    }
  | { kind: "invalid"; code: OutcomeInvalidCode; message: string };

export type ValidationOutcomeInput = {
  /** Terminal classification from `resolveMatchLifecycle` (caller supplies explicit `nowSec`). */
  lifecycle: MatchLifecycleStatus;
  /** Authoritative provider row carrying FT (and, where present, HT) scores + status. */
  row: FootyMatchRow;
  marketKey: string;
  selectionKey: string;
  /** Deterministic source-derived terminal instant → becomes `settledAt`. Never a clock read. */
  completionInstant: string;
  /**
   * Authoritative market-level void. Daily-list settlement NEVER sets this (R6). Present only
   * so a future authoritative void source can flow through the same mapper.
   */
  authoritativeMarketVoid?: boolean;
};

function isLifecycle(value: unknown): value is MatchLifecycleStatus {
  return (
    typeof value === "string" &&
    (LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

const PENDING: ValidationOutcome = {
  kind: "pending",
  state: "pending",
  reasonCode: "awaiting_result",
};

/** Whether the score inputs a given tab needs are actually present on a finished row. */
function requiredScoreInputsPresent(
  row: FootyMatchRow,
  tab: MatchListKind
): boolean {
  // Every daily-list settlement is a completed fixture; a "finished" lifecycle that is not
  // reflected as `isFinished` on the row is treated as incomplete rather than fabricated.
  if (!row.isFinished) return false;
  switch (tab) {
    case "over15":
    case "over25":
      return Number.isFinite(row.homeScore) && Number.isFinite(row.awayScore);
    case "fh":
      return resolveHalfScores(row).htKnown;
    case "sh":
      return resolveHalfScores(row).shKnown;
    default:
      return false;
  }
}

/**
 * Map one supported selection of a terminal fixture to its validation outcome.
 * Pure and total: every path returns a `ValidationOutcome`; nothing throws.
 */
export function resolveValidationOutcome(
  input: ValidationOutcomeInput
): ValidationOutcome {
  const { row, marketKey, selectionKey, completionInstant } = input;

  if (row === null || typeof row !== "object") {
    return { kind: "invalid", code: "malformed_row", message: "row must be an object" };
  }
  if (!isLifecycle(input.lifecycle)) {
    return {
      kind: "invalid",
      code: "invalid_lifecycle",
      message: `unknown lifecycle: ${String(input.lifecycle)}`,
    };
  }

  // Market support: only the four canonical daily-list tabs, selection "over".
  const tab = kindForMarketKey(marketKey);
  if (tab === null || selectionKey !== CANONICAL_SELECTION_KEY) {
    return {
      kind: "unsupported",
      marketKey,
      selectionKey,
      message: `unsupported market/selection: ${marketKey}/${selectionKey}`,
    };
  }

  // Any terminal outcome needs a deterministic, valid instant — fail closed, never substitute.
  const instantOk = isIsoInstant(completionInstant);

  // R6 — authoritative market void takes precedence over lifecycle, but is never inferred here.
  if (input.authoritativeMarketVoid === true) {
    if (!instantOk) {
      return { kind: "invalid", code: "invalid_timestamp", message: "completionInstant must be an ISO-8601 instant" };
    }
    return {
      kind: "terminal_non_scored",
      state: "void",
      reasonCode: "market_void",
      settledAt: completionInstant,
    };
  }

  switch (input.lifecycle) {
    case "abandoned":
    case "cancelled":
    case "postponed": {
      if (!instantOk) {
        return { kind: "invalid", code: "invalid_timestamp", message: "completionInstant must be an ISO-8601 instant" };
      }
      const map = {
        abandoned: { state: "abandoned", reasonCode: "fixture_abandoned" },
        cancelled: { state: "cancelled", reasonCode: "fixture_cancelled" },
        postponed: { state: "postponed", reasonCode: "fixture_postponed" },
      } as const;
      const m = map[input.lifecycle];
      return {
        kind: "terminal_non_scored",
        state: m.state,
        reasonCode: m.reasonCode,
        settledAt: completionInstant,
      };
    }

    case "finished": {
      // R3 — only evaluate won/lost once the required score inputs are proven present.
      if (!requiredScoreInputsPresent(row, tab)) return PENDING;
      if (!instantOk) {
        return { kind: "invalid", code: "invalid_timestamp", message: "completionInstant must be an ISO-8601 instant" };
      }
      const won = isPredictionWin(row, tab);
      return {
        kind: "settled",
        state: won ? "won" : "lost",
        reasonCode: "settled_result",
        settledAt: completionInstant,
      };
    }

    // suspended / live / half_time / pre_match / scheduled / unavailable → not terminal.
    default:
      return PENDING;
  }
}
