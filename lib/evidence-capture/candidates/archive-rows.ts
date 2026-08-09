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

/** Deterministic union of the archive's market lists, one row per fixture. */
export function projectArchiveRows(archive: DailyArchive): FootyMatchRow[] {
  const byId = new Map<number, FootyMatchRow>();
  for (const key of LIST_ORDER) {
    const list = archive[key];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      if (!row || !Number.isInteger(row.matchId)) continue;
      if (!byId.has(row.matchId)) byId.set(row.matchId, row);
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
