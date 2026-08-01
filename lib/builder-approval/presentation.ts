import type { BuilderPublicationCandidate, JsonValue } from "./contracts";

/**
 * Presentation helpers for the Builder Approval admin UI (Sprint 20B-A Phase E).
 *
 * Pure formatting only. This module performs no I/O, imports nothing server-only, and never
 * touches Builder generation, providers or the candidate store. It exists so the admin views
 * never invent a value: every absent field is rendered with an explicit, honest label rather
 * than a fabricated default.
 */

/** Explicit absence labels. Never substitute a plausible-looking default for these. */
export const ABSENT = {
  /** The contract allows the value, and it was not supplied. */
  notProvided: "Not provided",
  /** The value cannot be derived in the current environment. */
  unavailable: "Unavailable",
  /** Present but not interpretable, or shape not recognised. */
  unknown: "Unknown",
} as const;

/**
 * IMPORTANT HONESTY NOTE, surfaced in the UI as well as here.
 *
 * Phase D preserves the omitted / explicit-null distinction in the *idempotency fingerprint*
 * only. Storage cannot preserve it: `sourceRequestId`, `sourceSnapshotId` and `sourceDate`
 * all persist as SQL NULL whether the caller omitted the property or sent an explicit null.
 * The admin UI therefore renders both as "Not provided" and says so, rather than implying a
 * distinction the stored record does not carry.
 */
export const OPTIONAL_FIELD_NOTE =
  "Stored records cannot distinguish an omitted property from an explicit null; both appear as \"Not provided\". The distinction is preserved only in the idempotency fingerprint at creation time.";

export function textOrAbsent(
  value: unknown,
  absent: string = ABSENT.notProvided,
): string {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (value === null || value === undefined) return absent;
  return ABSENT.unknown;
}

export function numberOrAbsent(
  value: unknown,
  absent: string = ABSENT.notProvided,
): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value === null || value === undefined) return absent;
  return ABSENT.unknown;
}

/** Short, non-secret checksum prefix for dense table cells. Full value shown on detail. */
export function shortChecksum(checksum: unknown): string {
  return typeof checksum === "string" && /^[0-9a-f]{64}$/.test(checksum)
    ? `${checksum.slice(0, 12)}…`
    : ABSENT.unknown;
}

/**
 * ISO-8601 UTC rendering.
 *
 * Deliberately not locale-formatted on the client: a client-only formatter would risk a
 * server/client hydration mismatch and layout shift, and this is an operational surface
 * where an unambiguous absolute timestamp is more useful than a localised one.
 */
export function isoUtc(value: unknown): { display: string; machine: string | null } {
  if (typeof value !== "string" || !value) {
    return { display: ABSENT.notProvided, machine: null };
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return { display: ABSENT.unknown, machine: null };
  const iso = new Date(ms).toISOString();
  return { display: `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`, machine: iso };
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;
}

export type CandidateLeg = {
  index: number;
  matchId: string;
  fixture: string;
  competition: string;
  marketKey: string;
  kickoffAt: { display: string; machine: string | null };
  confidence: string;
  odds: string;
};

export type CandidateCombinationView = {
  combinationId: string;
  label: string;
  legCount: string;
  declaredLegCount: number | null;
  markets: string[];
  marketSummary: string;
  combinedOdds: string;
  averageConfidence: string;
  legs: CandidateLeg[];
};

/**
 * Derive a display view of the stored combination.
 * Every field falls back to an explicit absence label; nothing is inferred or computed
 * from other fields, because the stored payload is an immutable copy of what the Builder
 * produced and the admin surface must not re-derive Builder values.
 */
export function combinationView(
  candidate: BuilderPublicationCandidate,
): CandidateCombinationView | null {
  const payload = asRecord(candidate.payload as JsonValue);
  const combination = payload ? asRecord(payload.combination) : null;
  if (!combination) return null;

  const rawLegs = Array.isArray(combination.legs) ? combination.legs : [];
  const legs: CandidateLeg[] = rawLegs.map((raw, index) => {
    const leg = asRecord(raw);
    const home = leg ? textOrAbsent(leg.homeTeam, ABSENT.unknown) : ABSENT.unknown;
    const away = leg ? textOrAbsent(leg.awayTeam, ABSENT.unknown) : ABSENT.unknown;
    return {
      index: index + 1,
      matchId: leg ? numberOrAbsent(leg.matchId, ABSENT.unknown) : ABSENT.unknown,
      fixture:
        home === ABSENT.unknown && away === ABSENT.unknown
          ? ABSENT.unknown
          : `${home} v ${away}`,
      competition: leg ? textOrAbsent(leg.competition) : ABSENT.notProvided,
      marketKey: leg ? textOrAbsent(leg.marketKey, ABSENT.unknown) : ABSENT.unknown,
      kickoffAt: isoUtc(leg?.kickoffAt),
      confidence: leg ? numberOrAbsent(leg.confidence, ABSENT.notProvided) : ABSENT.notProvided,
      odds: leg ? numberOrAbsent(leg.odds, ABSENT.notProvided) : ABSENT.notProvided,
    };
  });

  const markets = Array.from(
    new Set(legs.map((l) => l.marketKey).filter((m) => m !== ABSENT.unknown)),
  );

  return {
    combinationId: textOrAbsent(combination.id, ABSENT.unknown),
    label: textOrAbsent(combination.label),
    legCount: String(legs.length),
    declaredLegCount:
      typeof combination.legCount === "number" ? combination.legCount : null,
    markets,
    marketSummary: markets.length ? markets.join(", ") : ABSENT.unavailable,
    combinedOdds: numberOrAbsent(combination.combinedOdds),
    averageConfidence: numberOrAbsent(combination.averageConfidence),
    legs,
  };
}

export type StorageBadge = {
  mode: string;
  durable: boolean;
  /** Text label. Status is never communicated by colour alone. */
  label: string;
  detail: string;
};

export function storageBadge(candidate: BuilderPublicationCandidate): StorageBadge {
  const mode = textOrAbsent(candidate.storageMode, ABSENT.unknown);
  const durable = candidate.storageMode === "postgres";
  return {
    mode,
    durable,
    label: durable ? "Durable" : "Not durable",
    detail: durable
      ? "Stored in PostgreSQL. Survives process restart."
      : "Held in process memory. Lost on restart, and process-local.",
  };
}

/** Bounded pagination model derived from the API's own limit/offset contract. */
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
