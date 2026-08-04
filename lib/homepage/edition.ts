import { listArchiveDates } from "@/lib/archive/dates";

/* ============================================================================
   THE EDITION NUMBER
   ----------------------------------------------------------------------------
   The masthead prints "Edition N". N has to be a real observation, like every
   other figure on this page — a number that only looks like a fact is worse
   here than no number, because a masthead is where a reader goes to find out
   whether the thing in front of them is current.

   THE BASIS IS THE COUNT OF ARCHIVED DAYS, not the span since the first one.

   Both were available. The count is chosen because it is what "edition" means
   for a publication: the Nth issue is the Nth one PUBLISHED. A span would
   count days on which nothing was published — an outage, a quiet weekend, a
   date range the provider had nothing for — and inflate the number against the
   record that backs it. The count cannot drift from the archive, because it IS
   the archive: one file, one edition.

   The trade is real and worth naming: if a day's archive file is ever deleted,
   the edition number goes DOWN. That is the honest behaviour — the number
   describes what can be produced now, not what was once claimed.

   AN EMPTY ARCHIVE PRINTS NOTHING. Not "Edition 0", not "Edition —". A
   publication with no issues has no edition number, and inventing one would be
   the fabricated observation §3.2 forbids.
   ========================================================================== */

export type Edition = {
  /** The Nth published day. Always ≥ 1 — an empty archive resolves to `null` instead. */
  number: number;
  /**
   * How `number` was derived, carried so a reader of the code (or a future audit) never has to
   * infer it from the arithmetic.
   */
  basis: "archived_day_count";
};

/**
 * Resolve the current edition from the daily archive.
 *
 * Returns `null` when the archive holds nothing — the caller omits the segment entirely rather
 * than printing a placeholder.
 *
 * `listArchiveDates` already fails soft to `[]` on a missing or unreadable directory, so a
 * filesystem problem produces "no edition" rather than a crash in the site header. That is the
 * right failure for chrome: the masthead still renders, one segment lighter.
 */
export async function resolveEdition(): Promise<Edition | null> {
  const dates = await listArchiveDates();
  if (dates.length === 0) return null;
  return { number: dates.length, basis: "archived_day_count" };
}
