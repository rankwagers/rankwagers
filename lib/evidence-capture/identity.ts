/**
 * Stable capture identity (Sprint 23B — Phase 2 + Milestone M1).
 *
 * Deterministic, side-effect-free primitives:
 *   - `numericFixtureId` — the single choke-point that maps a daily-list
 *     prediction to the archive's numeric fixture id. Blocker-resolution #1
 *     (authoritative): that id IS the FootyStats `matchId`. Keeping this in one
 *     place means a wrong assumption is corrected once, not everywhere.
 *   - `captureWindowKey` — derives the pre-kickoff capture window and a quantized
 *     capture instant from (kickoff, leadMinutes) ALONE (never `now`), so repeated
 *     capture runs inside the same window mint the same `capturedAt` — and thus,
 *     downstream, the same `evidenceSnapshotId` — and dedupe instead of accreting
 *     sequences. Changing `leadMinutes` moves the window and yields a new id,
 *     which is the intended "config change never rewrites the first" behavior.
 *   - `captureId` — the deterministic capture-event identity (Contract §2.C/§3):
 *     `cap_` + content hash of a fixed-order seed `(fixtureId ‖ captureWindowKey)`.
 *     Separate from the frozen `EvidenceSnapshot.id`; never written into it.
 *   - `isValidFixtureId` / `isValidInstant` — non-throwing fail-closed predicates.
 *
 * Identity inputs are ONLY `(fixtureId, kickoffAt, leadMinutes)` → `captureWindowKey`
 * → `captureId`. No `Date.now()`, no random, no hostname/pid, no environment, no
 * `modelVersion`. `captureId` uses a content hash (pure computation, not I/O), so
 * the same logical input always yields the same id offline.
 */

import { evidenceContentHash } from "@/lib/evidence/hash";

/** Non-throwing predicate: a valid numeric fixture id (positive integer). */
export function isValidFixtureId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Non-throwing predicate: a parseable instant string. */
export function isValidInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Date.parse(value))
  );
}

/** Map a daily-list prediction to its numeric archive fixture id (= matchId). */
export function numericFixtureId(source: { matchId: number }): number {
  const id = source.matchId;
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      `numericFixtureId: expected a positive integer matchId, got ${String(id)}`
    );
  }
  return id;
}

export type CaptureWindow = {
  /** Stable dedupe handle for the (fixture, window) pair. */
  key: string;
  /** Quantized capture instant (ISO) — the window start; anchors the snapshot id. */
  quantizedCapturedAt: string;
  /** Inclusive lower bound of the capture window (ISO); equals quantizedCapturedAt. */
  windowStart: string;
  /** Exclusive upper bound (ISO); equals the kickoff instant. */
  windowEnd: string;
};

/**
 * Derive the capture window `[kickoff − leadMinutes, kickoff)` and its quantized
 * anchor. Deterministic in (fixtureId, kickoffAt, leadMinutes).
 */
export function captureWindowKey(input: {
  fixtureId: number;
  kickoffAt: string;
  leadMinutes: number;
}): CaptureWindow {
  const { fixtureId, kickoffAt, leadMinutes } = input;

  const kickoffMs = Date.parse(kickoffAt);
  if (!Number.isFinite(kickoffMs)) {
    throw new Error(`captureWindowKey: invalid kickoffAt "${kickoffAt}"`);
  }
  if (!Number.isInteger(leadMinutes) || leadMinutes <= 0) {
    throw new Error(
      `captureWindowKey: leadMinutes must be a positive integer, got ${String(
        leadMinutes
      )}`
    );
  }

  const windowStart = new Date(kickoffMs - leadMinutes * 60_000).toISOString();
  const windowEnd = new Date(kickoffMs).toISOString();

  return {
    key: `${fixtureId}|${windowStart}`,
    quantizedCapturedAt: windowStart,
    windowStart,
    windowEnd,
  };
}

/**
 * Deterministic capture-event identity (Contract §2.C/§3):
 * `cap_` + `evidenceContentHash(fixtureId ‖ captureWindowKey)[0:24]`.
 *
 * The seed uses a fixed field order (`fixtureId` then `captureWindowKey`), so the
 * id is a pure function of exactly those two authorized inputs. Fail-closed on an
 * invalid fixtureId or a blank window key. No `Date.now()`, random, hostname, pid,
 * or environment participates.
 */
export function captureId(input: {
  fixtureId: number;
  captureWindowKey: string;
}): string {
  if (!isValidFixtureId(input.fixtureId)) {
    throw new Error(
      `captureId: expected a positive integer fixtureId, got ${String(
        input.fixtureId
      )}`
    );
  }
  if (typeof input.captureWindowKey !== "string" || !input.captureWindowKey) {
    throw new Error("captureId: captureWindowKey must be a non-empty string");
  }
  const seed = `${input.fixtureId}|${input.captureWindowKey}`;
  return `cap_${evidenceContentHash({ seed }).slice(0, 24)}`;
}
