/**
 * M10 Stage 1 — pure eligibility classification (spec §6).
 *
 * Total, deterministic functions of (candidate, injected evaluation instant, leadMinutes,
 * archive-derived state, config). No clock, no random, no env, no I/O. A missing/invalid
 * kickoff is rejected BEFORE any window/identity coordinate is computed, so no identity is
 * ever minted for such a row (spec §5.1 / §6.3, gate A10).
 */

import type { FootyMatchRow } from "@/lib/footystats/types";
import {
  captureWindowKey,
  isValidFixtureId,
  isValidInstant,
} from "@/lib/evidence-capture/identity";
import { kindForMarketKey } from "@/lib/evidence-capture/markets";
import { resolveMatchLifecycle } from "@/lib/fixtures/status";
import type {
  CaptureRejectionReason,
  SettlementRejectionReason,
} from "./types";

/* ----------------------------- capture ----------------------------- */

export type CaptureClassifyGroup = {
  fixtureId: number;
  kickoffAt: string;
  leagueCode: string;
};

export type CaptureClassifyContext = {
  evalMs: number;
  leadMinutes: number;
  supportedCompetitions: ReadonlySet<string> | null;
  capturedWindowKeys: ReadonlySet<string>;
  partialWindowKeys: ReadonlySet<string>;
  stale: boolean;
};

export type CaptureClassification =
  | {
      status: "eligible";
      healing: boolean;
      capturedAt: string;
      windowKey: string;
    }
  | { status: "reject"; reason: CaptureRejectionReason };

/**
 * Classify one grouped fixture for capture. Order is deliberate: structural validity →
 * window computation → archive-derived skip/heal → staleness → timing. A partial pair
 * (snapshot present, mandatory odds missing) is re-emitted for healing regardless of
 * timing, matching frozen M6/C5 healing semantics (heals on `already_exists`).
 */
export function classifyCaptureFixture(
  group: CaptureClassifyGroup,
  ctx: CaptureClassifyContext
): CaptureClassification {
  if (!isValidFixtureId(group.fixtureId)) {
    return { status: "reject", reason: "missing_fixture_identity" };
  }
  if (typeof group.kickoffAt !== "string" || group.kickoffAt.trim() === "") {
    return { status: "reject", reason: "missing_kickoff" };
  }
  if (!isValidInstant(group.kickoffAt)) {
    return { status: "reject", reason: "invalid_kickoff" };
  }
  if (
    ctx.supportedCompetitions !== null &&
    !ctx.supportedCompetitions.has(group.leagueCode)
  ) {
    return { status: "reject", reason: "unsupported_competition" };
  }

  // Safe now: kickoff is a valid instant and leadMinutes is validated by the caller.
  const window = captureWindowKey({
    fixtureId: group.fixtureId,
    kickoffAt: group.kickoffAt,
    leadMinutes: ctx.leadMinutes,
  });
  const capturedAt = window.quantizedCapturedAt;
  const windowKey = window.key;

  if (ctx.capturedWindowKeys.has(windowKey)) {
    return { status: "reject", reason: "already_captured" };
  }
  if (ctx.partialWindowKeys.has(windowKey)) {
    // Snapshot exists but odds are missing — re-emit so the runner heals the pair.
    return { status: "eligible", healing: true, capturedAt, windowKey };
  }
  if (ctx.stale) {
    return { status: "reject", reason: "stale_fixture" };
  }

  const kickoffMs = Date.parse(group.kickoffAt);
  const capturedAtMs = Date.parse(capturedAt);
  if (ctx.evalMs < capturedAtMs) {
    return { status: "reject", reason: "not_yet" };
  }
  if (ctx.evalMs >= kickoffMs) {
    return { status: "reject", reason: "non_prematch" };
  }
  return { status: "eligible", healing: false, capturedAt, windowKey };
}

/* --------------------------- settlement ---------------------------- */

export type SettlementClassifyContext = {
  /**
   * Deterministic evaluation seconds (never a clock). Threaded through to the frozen
   * lifecycle resolver EXACTLY as M8 does (`settlement.ts:222-227`), so terminal
   * lifecycle detection is status-driven and byte-stable across re-fires.
   */
  nowSec: number;
  capturedFixtureIds: ReadonlySet<number>;
  settledFixtureIds: ReadonlySet<number>;
};

export type SettlementClassification =
  | { status: "eligible"; fixtureId: number }
  | { status: "reject"; reason: SettlementRejectionReason };

/** Non-negative integer predicate — mirrors the frozen settlement score guard (C4). */
export function isNonNegativeInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Valid completed scores: FT (and HT when present) are non-negative integers. */
export function hasValidCompletedScores(row: FootyMatchRow): boolean {
  if (!isNonNegativeInt(row.homeScore) || !isNonNegativeInt(row.awayScore)) {
    return false;
  }
  if (row.htHome !== undefined && row.htHome !== null && !isNonNegativeInt(row.htHome)) {
    return false;
  }
  if (row.htAway !== undefined && row.htAway !== null && !isNonNegativeInt(row.htAway)) {
    return false;
  }
  return true;
}

/**
 * Classify one completed row for settlement, reproducing the FROZEN M8 eligibility
 * boundary (BF-S1). Eligibility is decided by the repository's authoritative,
 * status-driven `resolveMatchLifecycle` — the exact call M8 makes (`settlement.ts:222`)
 * — NOT by the `isFinished` flag alone. A candidate is emitted whenever M8 would write a
 * `ValidationRecord`:
 *
 *   - `finished`                          → eligible SCORED settlement (won/lost). Still
 *                                           requires `isFinished` + present, valid FT/HT
 *                                           scores (unchanged C4/R3) — never weakened.
 *   - `postponed | cancelled | abandoned` → eligible TERMINAL NON-SCORED settlement
 *                                           (`terminal_non_scored`, `outcomes.ts:186-205`).
 *                                           No score requirement; the deterministic
 *                                           kickoff `completionInstant` satisfies M8's
 *                                           instant check.
 *   - `live | half_time | scheduled |
 *      pre_match | suspended`             → defer (`fixture_not_complete`); M8 returns
 *                                           PENDING (no write), re-classified next fire.
 *   - `unavailable` (unknown/unresolvable
 *      lifecycle)                          → deterministic rejection (`unsupported_outcome_state`);
 *                                           fail-closed, never emits.
 *
 * The provider never computes WON/LOST/VOID/PUSH — that stays with the frozen M8 runner.
 * Fail-closed throughout: a malformed row, an unknown lifecycle, or missing/invalid
 * scores on the scored path can never emit a candidate.
 */
export function classifySettlementRow(
  row: FootyMatchRow,
  ctx: SettlementClassifyContext
): SettlementClassification {
  if (row === null || typeof row !== "object" || !isValidFixtureId(row.matchId)) {
    return { status: "reject", reason: "malformed_archive_record" };
  }
  const fixtureId = row.matchId;
  if (!ctx.capturedFixtureIds.has(fixtureId)) {
    return { status: "reject", reason: "missing_prediction_identity" };
  }
  if (ctx.settledFixtureIds.has(fixtureId)) {
    return { status: "reject", reason: "already_settled" };
  }

  // Authoritative, status-driven lifecycle — the EXACT resolver + arguments M8 uses
  // (`settlement.ts:222-227`). Reused, never re-implemented. Deterministic `nowSec`.
  const lifecycle = resolveMatchLifecycle({
    status: row.status,
    kickoffUnix: row.kickoffTime ?? null,
    minute: row.minute ?? null,
    nowSec: ctx.nowSec,
  });

  switch (lifecycle) {
    case "postponed":
    case "cancelled":
    case "abandoned":
      // Terminal non-scored settlement — M8 writes a real validation record for these
      // without any score input (`outcomes.ts:186-205`). Do NOT require isFinished/scores.
      return { status: "eligible", fixtureId };

    case "finished":
      // Scored won/lost path — unchanged. M8's `requiredScoreInputsPresent` gates the
      // won/lost evaluation on `isFinished` + present scores (`outcomes.ts:118-137`); a
      // finished-lifecycle row lacking that is PENDING (no write), so defer it.
      if (row.isLive === true || row.isFinished !== true) {
        return { status: "reject", reason: "fixture_not_complete" };
      }
      if (
        row.homeScore === null ||
        row.homeScore === undefined ||
        row.awayScore === null ||
        row.awayScore === undefined
      ) {
        return { status: "reject", reason: "missing_final_score" };
      }
      if (!hasValidCompletedScores(row)) {
        return { status: "reject", reason: "invalid_final_score" };
      }
      return { status: "eligible", fixtureId };

    case "live":
    case "half_time":
    case "scheduled":
    case "pre_match":
    case "suspended":
      // Not terminal yet — M8 returns PENDING (no write). Deferrable; re-classified on a
      // later fire once the fixture reaches a terminal lifecycle.
      return { status: "reject", reason: "fixture_not_complete" };

    case "unavailable":
    default:
      // Unknown / unresolvable lifecycle — fail closed. Never emit a candidate against a
      // status we cannot interpret (M8 would PENDING it); surfaced deterministically.
      return { status: "reject", reason: "unsupported_outcome_state" };
  }
}
