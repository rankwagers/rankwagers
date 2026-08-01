import type { AccaBuilderCandidate, AccaBuilderConfig } from "./contracts";
import { RISK_MODE_RULES } from "./config";

export function applyEligibility(
  candidate: AccaBuilderCandidate,
  config: AccaBuilderConfig,
  now = Date.now()
): AccaBuilderCandidate {
  const reasons: string[] = [];
  const rules = RISK_MODE_RULES[config.riskMode];
  const minConfidence = Math.max(config.minConfidence, rules.minConfidence);

  if (!config.markets.includes(candidate.marketKey)) {
    reasons.push("market_not_allowed");
  }
  if (candidate.confidence < minConfidence) {
    reasons.push("confidence_below_threshold");
  }
  if (candidate.evidenceCompleteness < rules.minEvidenceCompleteness) {
    reasons.push("evidence_incomplete");
  }

  const kickoff = Date.parse(candidate.kickoffAt);
  if (!Number.isFinite(kickoff)) {
    reasons.push("invalid_kickoff");
  } else if (config.preMatchOnly && kickoff <= now) {
    reasons.push("kickoff_passed");
  }

  if (config.competitions.length) {
    const ok = config.competitions.some((c) =>
      candidate.competition.toLowerCase().includes(c.toLowerCase())
    );
    if (!ok) reasons.push("competition_filtered");
  }
  if (config.countries.length && candidate.countryCode) {
    if (!config.countries.includes(candidate.countryCode.toUpperCase())) {
      reasons.push("country_filtered");
    }
  } else if (config.countries.length && !candidate.countryCode) {
    reasons.push("country_unknown");
  }

  const teamHay = `${candidate.homeTeam} ${candidate.awayTeam}`.toLowerCase();
  if (
    config.excludedTeams.some((t) => teamHay.includes(t.toLowerCase()))
  ) {
    reasons.push("team_excluded");
  }
  if (
    config.excludedCompetitions.some((c) =>
      candidate.competition.toLowerCase().includes(c.toLowerCase())
    )
  ) {
    reasons.push("competition_excluded");
  }

  if (
    config.targetOddsMin != null ||
    config.targetOddsMax != null
  ) {
    // Target mode requires real odds on every leg later; mark missing here.
    if (candidate.odds == null) {
      reasons.push("odds_required_for_target");
    }
  }

  if (candidate.oddsFreshness === "stale") {
    reasons.push("odds_stale");
  }

  return {
    ...candidate,
    exclusionReasons: reasons,
    eligible: reasons.length === 0,
  };
}
