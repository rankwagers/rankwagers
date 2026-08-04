import type { HomepageRecentResult } from "./types";

/* ============================================================================
   RECENT RESULTS — SETTLED FIRST
   ----------------------------------------------------------------------------
   The S2 rule, restored. The list arrives newest-first regardless of state, so
   an unsettled fixture could lead a table whose entire purpose is the settled
   record. A pending row at the top reads as the most recent RESULT, which it
   is not: it is a fixture with no result yet.

   PENDING ROWS ARE NOT DROPPED. Hiding them would be a filter on the record,
   which is the thing this section exists to refuse. They follow.

   WITHIN EACH GROUP THE EXISTING ORDER SURVIVES. `Array.prototype.sort` is
   required to be stable, so the newest-first ordering the builder already
   applied is preserved inside both groups rather than re-derived here.
   ========================================================================== */

/** Settled outcomes first, then pending; original order preserved within each group. */
export function settledFirst(rows: readonly HomepageRecentResult[]): HomepageRecentResult[] {
  const rank = (status: string) => (status === "pending" ? 1 : 0);
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status));
}
