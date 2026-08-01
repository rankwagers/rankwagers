export type FixtureIdentity = {
  /** FootyStats / RankWagers canonical match id */
  matchId: number;
  /** API-Football fixture id when resolved */
  providerFixtureId?: number;
  /** Operator-specific fixture id when known */
  operatorFixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  competition?: string;
  status?: "scheduled" | "live" | "finished" | "unknown";
  snapshotAt?: string;
};

export type FixtureMappingResult =
  | {
      status: "valid";
      matchId: number;
      providerFixtureId?: number;
      operatorFixtureId?: string;
      canDeeplinkFixture: boolean;
    }
  | {
      status: "invalid";
      reason:
        | "team_mismatch"
        | "kickoff_tolerance"
        | "competition_mismatch"
        | "fixture_started"
        | "stale_snapshot"
        | "missing_ids"
        | "incomplete_identity";
      detail: string;
    };

export const FIXTURE_KICKOFF_TOLERANCE_MS = 3 * 60 * 60 * 1000;
export const FIXTURE_SNAPSHOT_STALE_MS = 6 * 60 * 60 * 1000;

function normalizeTeam(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|fk|afc|cf|sc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function teamsMatch(a: string, b: string): boolean {
  const left = normalizeTeam(a);
  const right = normalizeTeam(b);
  if (!left || !right) return false;
  return left === right;
}

/**
 * Validate a candidate fixture identity against an expected selection.
 * Does not map by team names alone — requires matchId and/or providerFixtureId.
 */
export function validateFixtureMapping(input: {
  expected: {
    matchId: number;
    homeTeam: string;
    awayTeam: string;
    kickoffAt: string;
    competition?: string;
  };
  candidate: FixtureIdentity;
  now?: number;
}): FixtureMappingResult {
  const now = input.now ?? Date.now();
  const { expected, candidate } = input;

  if (!candidate.matchId && !candidate.providerFixtureId) {
    return {
      status: "invalid",
      reason: "missing_ids",
      detail: "Fixture mapping requires matchId or providerFixtureId",
    };
  }

  if (candidate.matchId !== expected.matchId) {
    // Provider-only linkage allowed when teams + kickoff validate
    if (!candidate.providerFixtureId) {
      return {
        status: "invalid",
        reason: "missing_ids",
        detail: "matchId mismatch and no providerFixtureId",
      };
    }
  }

  if (
    !teamsMatch(candidate.homeTeam, expected.homeTeam) ||
    !teamsMatch(candidate.awayTeam, expected.awayTeam)
  ) {
    return {
      status: "invalid",
      reason: "team_mismatch",
      detail: "Home/away teams do not match expected selection",
    };
  }

  const expectedKick = Date.parse(expected.kickoffAt);
  const candidateKick = Date.parse(candidate.kickoffAt);
  if (!Number.isFinite(expectedKick) || !Number.isFinite(candidateKick)) {
    return {
      status: "invalid",
      reason: "incomplete_identity",
      detail: "Kickoff timestamps invalid",
    };
  }
  if (Math.abs(expectedKick - candidateKick) > FIXTURE_KICKOFF_TOLERANCE_MS) {
    return {
      status: "invalid",
      reason: "kickoff_tolerance",
      detail: "Kickoff outside configured tolerance",
    };
  }

  if (candidateKick <= now) {
    return {
      status: "invalid",
      reason: "fixture_started",
      detail: "Fixture has already started or kickoff is in the past",
    };
  }

  if (
    expected.competition &&
    candidate.competition &&
    normalizeTeam(expected.competition) !== normalizeTeam(candidate.competition)
  ) {
    return {
      status: "invalid",
      reason: "competition_mismatch",
      detail: "Competition labels are incompatible",
    };
  }

  if (candidate.status === "live" || candidate.status === "finished") {
    return {
      status: "invalid",
      reason: "fixture_started",
      detail: `Fixture status is ${candidate.status}`,
    };
  }

  if (candidate.snapshotAt) {
    const snap = Date.parse(candidate.snapshotAt);
    if (Number.isFinite(snap) && now - snap > FIXTURE_SNAPSHOT_STALE_MS) {
      return {
        status: "invalid",
        reason: "stale_snapshot",
        detail: "Fixture snapshot exceeds freshness window",
      };
    }
  }

  return {
    status: "valid",
    matchId: expected.matchId,
    providerFixtureId: candidate.providerFixtureId,
    operatorFixtureId: candidate.operatorFixtureId,
    // Fixture deeplink only when operator-specific fixture ID exists
    canDeeplinkFixture: Boolean(candidate.operatorFixtureId),
  };
}

export type FixtureMappingStats = {
  attempted: number;
  valid: number;
  failed: number;
  deeplinkEligible: number;
  successRate: number;
};

let stats: FixtureMappingStats = {
  attempted: 0,
  valid: 0,
  failed: 0,
  deeplinkEligible: 0,
  successRate: 0,
};

export function recordFixtureMappingAttempt(result: FixtureMappingResult): void {
  stats.attempted += 1;
  if (result.status === "valid") {
    stats.valid += 1;
    if (result.canDeeplinkFixture) stats.deeplinkEligible += 1;
  } else {
    stats.failed += 1;
  }
  stats.successRate = stats.attempted
    ? Math.round((stats.valid / stats.attempted) * 1000) / 10
    : 0;
}

export function getFixtureMappingStats(): FixtureMappingStats {
  return { ...stats };
}

export function resetFixtureMappingStats(): void {
  stats = {
    attempted: 0,
    valid: 0,
    failed: 0,
    deeplinkEligible: 0,
    successRate: 0,
  };
}
