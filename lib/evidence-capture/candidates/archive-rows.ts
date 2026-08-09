import type { DailyArchive } from "@/lib/footystats/dailyArchive";
import { readDailyArchiveStrict } from "@/lib/footystats/dailyArchive";
import type { FootyMatchRow } from "@/lib/footystats/types";

/* ============================================================================
   THE ROWS PROJECTION — M10 Slice 4's missing bridge
   ----------------------------------------------------------------------------
   `createCompletedRowLoader` (Stage 2D) demands an injected whole-source
   reader; `readDailyArchiveStrict` (Slice 3) reads the partition with the
   fail-closed contract but had zero production callers. This module is the
   bridge between them: one daily archive in, one deduplicated row list out.

   The archive stores the SAME fixture in up to four market lists (fh /
   over15 / over25 / sh). Settlement wants fixtures, not list entries, so the
   projection walks the lists in a FIXED order and keeps the first row per
   matchId — deterministic regardless of storage order, and the four lists
   carry identical row cores for a fixture by construction (they are written
   from one provider payload).

   Contract inherited from the strict reader, unchanged:
     absent partition → null   (the loader above raises source_load_failed)
     fault            → throw  (never converted to an empty success)
     valid            → rows
   ========================================================================== */

const LIST_ORDER = ["fh", "over15", "over25", "sh"] as const;

/**
 * THE KICKOFF SHAPE MISMATCH — found by the first correctness replay, not by tests. Archived
 * rows carry `kickoff` as the DISPLAY string the lists page renders ("16:15", Istanbul wall
 * clock) while the completed-row filter demands a parseable instant and silently dropped every
 * row of every real archive as `invalid_kickoff`. The same fact exists on the row in machine
 * form — `kickoffTime` epoch seconds — so the projection restates it as the ISO instant the
 * pipeline speaks. This is projection of an existing fact, never invention: a row with no
 * usable `kickoffTime` keeps its unparseable display string and is dropped, honestly, by the
 * filter downstream.
 */
function withInstantKickoff(row: FootyMatchRow): FootyMatchRow {
  if (typeof row.kickoff === "string" && !Number.isNaN(Date.parse(row.kickoff))) return row;
  if (typeof row.kickoffTime === "number" && Number.isFinite(row.kickoffTime) && row.kickoffTime > 0) {
    return { ...row, kickoff: new Date(row.kickoffTime * 1000).toISOString() };
  }
  return row;
}

/** Deterministic union of the archive's market lists, one row per fixture. */
export function projectArchiveRows(archive: DailyArchive): FootyMatchRow[] {
  const byId = new Map<number, FootyMatchRow>();
  for (const key of LIST_ORDER) {
    const list = archive[key];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || !Number.isInteger(row.matchId)) continue;
      if (!byId.has(row.matchId)) byId.set(row.matchId, withInstantKickoff(row));
    }
  }
  return [...byId.values()].sort((a, b) => a.matchId - b.matchId);
}

/**
 * The injected `readRows` seam for `createCompletedRowLoader`, over the strict reader.
 * `archiveDir` is overridable for tests only; production callers take the default partition.
 */
export function createDailyArchiveRowsReader(options?: {
  archiveDir?: string;
}): (date: string) => Promise<FootyMatchRow[] | null> {
  return async (date: string) => {
    const archive = options?.archiveDir
      ? await readDailyArchiveStrict(date, options.archiveDir)
      : await readDailyArchiveStrict(date);
    if (archive === null) return null;
    return projectArchiveRows(archive);
  };
}
