import "server-only";

import { getMatchDetails, type HistoricalMatch } from "@/lib/footystats/matchDetail";
import { fixturesForTeam, sideMatchesTeam } from "@/lib/teams/intelligence";
import type { TeamEntity } from "@/lib/teams/types";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import type { Locale } from "@/lib/i18n";

/* ============================================================================
   TEAM FORM STRIP + H2H (Bible V3, block H — the team page).

   One honest source: the team's OWN fixture on the current board — its
   detail carries the venue history (the team's last matches at the venue it
   plays next) and the head-to-head against the actual next opponent. A team
   with no fixture on the board has neither section (omission): a form strip
   from another day's clock would break the one-clock law.

   The strip shows each match's real scoreline, colored by outcome from the
   team's side — score chips, not letters, so nothing needs translating and
   nothing is invented.
   ========================================================================== */

export type TeamFormChip = {
  outcome: "won" | "drawn" | "lost";
  score: string;
  /** The other side, for the tooltip/aria sentence. */
  opponent: string;
};

export type TeamH2HRow = {
  kickoffAt: string;
  label: string;
  score: string;
};

export type TeamResearch = {
  /** Which side the team plays next — the venue the form strip describes. */
  venue: "home" | "away";
  nextOpponent: string;
  form: TeamFormChip[];
  h2h: TeamH2HRow[];
};

function chipFor(team: TeamEntity, match: HistoricalMatch): TeamFormChip | null {
  const teamIsHome = sideMatchesTeam(team, match.home.name);
  const teamIsAway = sideMatchesTeam(team, match.away.name);
  if (!teamIsHome && !teamIsAway) return null;
  const forScore = teamIsHome ? match.home.score : match.away.score;
  const againstScore = teamIsHome ? match.away.score : match.home.score;
  return {
    outcome: forScore > againstScore ? "won" : forScore < againstScore ? "lost" : "drawn",
    score: `${match.home.score}–${match.away.score}`,
    opponent: teamIsHome ? match.away.name : match.home.name,
  };
}

export async function buildTeamResearch(
  team: TeamEntity,
  fixtures: readonly QualifiedFixture[],
  locale: Locale
): Promise<TeamResearch | null> {
  const fixture = fixturesForTeam(team, fixtures)[0];
  if (!fixture) return null;
  const detail = (await getMatchDetails([fixture.matchId], locale)).get(fixture.matchId);
  if (!detail) return null;

  const teamIsHome = sideMatchesTeam(team, fixture.home);
  const venueHistory = teamIsHome ? detail.history.homeAtHome : detail.history.awayAtAway;

  /* Provider history arrives newest-first; the strip reads oldest → newest
     like the form dots, so the last five are taken then reversed. */
  const form = venueHistory
    .slice(0, 5)
    .flatMap((match) => {
      const chip = chipFor(team, match);
      return chip ? [chip] : [];
    })
    .reverse();

  const h2h = detail.history.headToHead.slice(0, 4).map((match) => ({
    kickoffAt: match.kickoffAt,
    label: `${match.home.name} – ${match.away.name}`,
    score: `${match.home.score}–${match.away.score}`,
  }));

  if (!form.length && !h2h.length) return null;
  return {
    venue: teamIsHome ? "home" : "away",
    nextOpponent: teamIsHome ? fixture.away : fixture.home,
    form,
    h2h,
  };
}
