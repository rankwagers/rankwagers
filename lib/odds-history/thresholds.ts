import type { OddsMovementSeverity } from "./types";

/**
 * Absolute percentage move thresholds (price change magnitude).
 * Configurable via env for production tuning without code changes.
 */
export type MovementThresholds = {
  minor: number;
  medium: number;
  major: number;
  steam: number;
};

const DEFAULT_THRESHOLDS: MovementThresholds = {
  minor: 1,
  medium: 3,
  major: 6,
  steam: 8,
};

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getMovementThresholds(): MovementThresholds {
  return {
    minor: readNumber("ODDS_MOVE_MINOR_PCT", DEFAULT_THRESHOLDS.minor),
    medium: readNumber("ODDS_MOVE_MEDIUM_PCT", DEFAULT_THRESHOLDS.medium),
    major: readNumber("ODDS_MOVE_MAJOR_PCT", DEFAULT_THRESHOLDS.major),
    steam: readNumber("ODDS_MOVE_STEAM_PCT", DEFAULT_THRESHOLDS.steam),
  };
}

export function classifySeverity(
  absPercent: number,
  thresholds: MovementThresholds = getMovementThresholds()
): OddsMovementSeverity | null {
  if (absPercent >= thresholds.steam) return "steam";
  if (absPercent >= thresholds.major) return "major";
  if (absPercent >= thresholds.medium) return "medium";
  if (absPercent >= thresholds.minor) return "minor";
  return null;
}
