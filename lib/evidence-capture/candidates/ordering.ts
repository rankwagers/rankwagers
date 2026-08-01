/**
 * M10 Stage 1 — deterministic anti-starvation ordering (spec §7.4 INV-S).
 *
 * Capture: primary `capturedAt` ascending (earliest-opening window first — the fixture
 * closest to losing its capture opportunity is served first), tie-break `fixtureId`
 * ascending. `capturedAt` is a canonical UTC millisecond ISO string, so lexical `<`/`>`
 * equals chronological order.
 *
 * Settlement: primary `completionInstant` ascending (the authoritative pending-time field
 * for this path), tie-break `fixtureId` ascending. A `SettlementCandidate` is per-fixture,
 * so at most one candidate exists per fixture and the tie-break fully determines order;
 * were multiple predictions per fixture ever emitted, the next frozen identity (predictionId)
 * would be the further tie-break — not applicable at the per-fixture candidate grain.
 *
 * All comparators are total over their post-dedup inputs (fixtureId is unique), so the
 * output order is independent of input array order. No line number / file offset / batch
 * position participates in ordering or identity.
 */

export type CaptureOrderKey = { capturedAt: string; fixtureId: number };
export type SettlementOrderKey = { completionInstant: string; fixtureId: number };

export function compareCaptureCandidates(
  a: CaptureOrderKey,
  b: CaptureOrderKey
): number {
  if (a.capturedAt < b.capturedAt) return -1;
  if (a.capturedAt > b.capturedAt) return 1;
  return a.fixtureId - b.fixtureId;
}

export function compareSettlementCandidates(
  a: SettlementOrderKey,
  b: SettlementOrderKey
): number {
  if (a.completionInstant < b.completionInstant) return -1;
  if (a.completionInstant > b.completionInstant) return 1;
  return a.fixtureId - b.fixtureId;
}

/** Non-mutating stable sort with an explicit comparator. */
export function sortDeterministic<T>(
  items: readonly T[],
  compare: (a: T, b: T) => number
): T[] {
  return [...items].sort(compare);
}
