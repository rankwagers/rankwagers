import type { DailyMatchLists, FootyMatchRow, MatchListKind } from "./types";

/* ============================================================================
   COUNTRY BACKFILL — same league, same day, same board
   ----------------------------------------------------------------------------
   THE DEFECT, TRACED. The provider omits `countryCode` on SOME rows of a
   competition while carrying it on others — observed on the live board:
   two Pro League A fixtures arrived with no code while their league-mates
   carried `uz`. The field is per-row in the feed and the provider simply
   does not always populate it; there is nothing downstream dropping it.

   THE FIX IS AN INFERENCE FROM THE SAME OBSERVATION, NOT A TABLE. A row's
   competition is stated by the provider; the code its league-mates carry ON
   THE SAME DAY'S LISTS is the provider's own answer to "which country is
   this competition in". Copying it sideways invents nothing — both facts
   come from the same payload. What this deliberately is NOT is a hardcoded
   league→country map: a maintained table drifts (leagues rename, ambiguous
   names collide) and it would assert countries for boards nobody observed.

   A competition whose rows ALL lack the code that day stays without one, and
   every league cell downstream prints the league alone. If the provider
   carries conflicting codes for one competition on one day, the field is too
   uncertain to copy and the gap is left as observed.
   ========================================================================== */

const TABS: MatchListKind[] = ["fh", "over15", "over25", "sh"];

/** Rows that can be backfilled: anything carrying `competition` and maybe `countryCode`. */
type CountryRow = Pick<FootyMatchRow, "competition" | "countryCode">;

/**
 * The day's own competition→country evidence: one code per competition, or nothing when the
 * day's rows disagree — a conflicted code is not evidence, it is a coin toss.
 */
export function competitionCountryMap(rows: readonly CountryRow[]): Map<string, string> {
  const seen = new Map<string, string | null>();
  for (const row of rows) {
    const code = row.countryCode?.trim();
    if (!code) continue;
    const existing = seen.get(row.competition);
    if (existing === undefined) seen.set(row.competition, code);
    else if (existing !== null && existing !== code) seen.set(row.competition, null); // conflict
  }
  const map = new Map<string, string>();
  for (const [competition, code] of seen) if (code !== null) map.set(competition, code);
  return map;
}

/** A row with its gap filled from the map, or the row untouched — never mutated in place. */
function filled<T extends CountryRow>(row: T, map: Map<string, string>): T {
  if (row.countryCode?.trim()) return row;
  const code = map.get(row.competition);
  return code ? { ...row, countryCode: code } : row;
}

/**
 * The whole board, with per-row gaps filled from the board's own evidence.
 *
 * Applied once where the lists enter the page, so every consumer — hero, ranked section,
 * research desk — reads the same filled rows rather than each repeating the inference.
 */
export function backfillCountryCodes(lists: DailyMatchLists): DailyMatchLists {
  const map = competitionCountryMap(TABS.flatMap((tab) => lists[tab]));
  if (map.size === 0) return lists;
  return {
    ...lists,
    fh: lists.fh.map((row) => filled(row, map)),
    over15: lists.over15.map((row) => filled(row, map)),
    over25: lists.over25.map((row) => filled(row, map)),
    sh: lists.sh.map((row) => filled(row, map)),
  };
}
