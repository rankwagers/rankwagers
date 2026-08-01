import {
  KICKOFF_WINDOW_MS,
  MAX_SAME_COMPETITION,
  MAX_SAME_COUNTRY,
  MAX_SAME_KICKOFF_WINDOW,
} from "./config";
import type { ComboCandidate, ComboRequest, ComboSelection } from "./types";

type Leg = Pick<
  ComboCandidate,
  | "id"
  | "fixtureId"
  | "matchId"
  | "competitionId"
  | "homeTeamId"
  | "awayTeamId"
  | "countryCode"
  | "kickoffAt"
  | "marketId"
  | "marketKind"
>;

/** Hard conflicts: same fixture over lines that nest, or same match twice. */
export function marketsConflict(a: Leg, b: Leg): boolean {
  if (a.matchId === b.matchId || a.fixtureId === b.fixtureId) {
    // Same fixture — never allow two selections
    return true;
  }
  return false;
}

function sharesTeam(a: Leg, b: Leg): boolean {
  const teamsA = new Set([a.homeTeamId, a.awayTeamId]);
  return teamsA.has(b.homeTeamId) || teamsA.has(b.awayTeamId);
}

function sameKickoffWindow(a: Leg, b: Leg): boolean {
  const ta = Date.parse(a.kickoffAt);
  const tb = Date.parse(b.kickoffAt);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) <= KICKOFF_WINDOW_MS;
}

export type CorrelationCheck = {
  ok: boolean;
  hardViolations: string[];
  softPenalty: number;
};

export function checkCorrelation(
  existing: readonly Leg[],
  next: Leg,
  request: ComboRequest
): CorrelationCheck {
  const hardViolations: string[] = [];
  let softPenalty = 0;

  for (const leg of existing) {
    if (marketsConflict(leg, next)) {
      hardViolations.push(`same_fixture:${leg.matchId}`);
    }
    if (sharesTeam(leg, next)) {
      hardViolations.push(`duplicate_team:${next.homeTeamId}`);
    }
  }

  const competitionCount =
    1 + existing.filter((leg) => leg.competitionId === next.competitionId).length;
  const maxComp = request.excludeSameCompetition ? 1 : MAX_SAME_COMPETITION;
  if (competitionCount > maxComp) {
    if (request.excludeSameCompetition) {
      hardViolations.push(`competition_cap:${next.competitionId}`);
    } else {
      softPenalty += 4 * (competitionCount - maxComp);
    }
  }

  if (next.countryCode) {
    const countryCount =
      1 + existing.filter((leg) => leg.countryCode === next.countryCode).length;
    const maxCountry = request.excludeSameCountry ? 1 : MAX_SAME_COUNTRY;
    if (countryCount > maxCountry) {
      if (request.excludeSameCountry) {
        hardViolations.push(`country_cap:${next.countryCode}`);
      } else {
        softPenalty += 3 * (countryCount - maxCountry);
      }
    }
  }

  if (request.limitSameKickoffWindow !== false) {
    const windowCount =
      1 + existing.filter((leg) => sameKickoffWindow(leg, next)).length;
    if (windowCount > MAX_SAME_KICKOFF_WINDOW) {
      softPenalty += 5 * (windowCount - MAX_SAME_KICKOFF_WINDOW);
    }
  }

  return {
    ok: hardViolations.length === 0,
    hardViolations,
    softPenalty,
  };
}

export function canAddSelection(
  existing: readonly Leg[],
  next: Leg,
  request: ComboRequest
): boolean {
  return checkCorrelation(existing, next, request).ok;
}

export function correlationPenaltyForCombo(
  selections: readonly Leg[],
  request: ComboRequest
): number {
  let penalty = 0;
  for (let i = 0; i < selections.length; i++) {
    const check = checkCorrelation(selections.slice(0, i), selections[i], request);
    if (!check.ok) return 100;
    penalty += check.softPenalty;
  }
  return penalty;
}

export function selectionToLeg(selection: ComboSelection | ComboCandidate): Leg {
  return {
    id: "id" in selection ? selection.id : `${selection.matchId}:${selection.marketId}`,
    fixtureId: selection.fixtureId,
    matchId: selection.matchId,
    competitionId: selection.competitionId,
    homeTeamId: selection.homeTeamId,
    awayTeamId: selection.awayTeamId,
    countryCode: selection.countryCode,
    kickoffAt: selection.kickoffAt,
    marketId: selection.marketId,
    marketKind: selection.marketKind,
  };
}
