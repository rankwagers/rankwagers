/**
 * Canonicalization for snapshot minting (Sprint 23B, M6).
 *
 * `canonicalizeEvidence` (the frozen hash serializer) sorts OBJECT keys but PRESERVES
 * ARRAY order — so semantically-identical inputs supplied in different array orders
 * would otherwise hash differently. These pure helpers impose a stable, order-
 * independent ordering on the hash-sensitive collections BEFORE `createEvidenceSnapshot`
 * runs, and normalize nested instants (§4.9 replay-safety / addendum A7) so equivalent
 * timestamps yield an identical `contentHash`.
 *
 * Comparators use codepoint `< / >` (NOT `localeCompare`, which is not frozen).
 */

import type {
  BestOddsSnapshot,
  EvidenceSignal,
  OperatorAvailabilitySnapshot,
  SupportedMarket,
} from "@/types/evidence";
import { isIsoInstant } from "@/lib/evidence/snapshot";

/** Stable codepoint string comparator. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Canonical ISO instant (matches the archive's internal normalization). */
export function normalizeInstant(value: string): string {
  return new Date(Date.parse(value)).toISOString();
}

/** Supported markets ordered by (marketKey, selectionKey); order-independent. */
export function sortSupportedMarkets(
  markets: readonly SupportedMarket[]
): SupportedMarket[] {
  return [...markets].sort(
    (a, b) => cmp(a.marketKey, b.marketKey) || cmp(a.selectionKey, b.selectionKey)
  );
}

/** Signals ordered by their unique `key`; order-independent. */
export function sortSignals(signals: readonly EvidenceSignal[]): EvidenceSignal[] {
  return [...signals].sort((a, b) => cmp(a.key, b.key));
}

/**
 * True only when operator availability can be canonicalized — a non-null object whose
 * `restrictedCountries` and `operatorKeys` are arrays. Guards `canonicalizeOperator-
 * Availability` (which spreads those lists) from throwing on malformed runtime input.
 */
export function isCanonicalizableOperatorAvailability(
  value: unknown
): value is OperatorAvailabilitySnapshot {
  if (value === null || typeof value !== "object") return false;
  const oa = value as Record<string, unknown>;
  return Array.isArray(oa.restrictedCountries) && Array.isArray(oa.operatorKeys);
}

/** Operator availability with sorted set-like lists and a normalized instant. */
export function canonicalizeOperatorAvailability(
  oa: OperatorAvailabilitySnapshot
): OperatorAvailabilitySnapshot {
  return {
    ...oa,
    restrictedCountries: [...oa.restrictedCountries].sort(cmp),
    operatorKeys: [...oa.operatorKeys].sort(cmp),
    resolvedAt:
      oa.resolvedAt && isIsoInstant(oa.resolvedAt)
        ? normalizeInstant(oa.resolvedAt)
        : oa.resolvedAt,
  };
}

/** Best-odds snapshot with a normalized capture instant. */
export function canonicalizeBestOdds(bo: BestOddsSnapshot): BestOddsSnapshot {
  return {
    ...bo,
    capturedAt:
      bo.capturedAt && isIsoInstant(bo.capturedAt)
        ? normalizeInstant(bo.capturedAt)
        : bo.capturedAt,
  };
}
