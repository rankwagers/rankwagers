import { resolveEvidenceStrength, type EvidenceStrength } from "@/lib/evidence-ui";
import type { QualifiedFixture } from "@/lib/research/qualifiedFixture";
import { LIST_EVIDENCE_SAMPLE_PROXY } from "./config";
import { meetsStrengthFloor, resolveEffectiveGates } from "./profiles";
import type {
  ComboCandidate,
  ComboReason,
  ComboRequest,
  OddsFreshness,
} from "./types";

export function classifyOddsFreshness(
  fetchedAt: string | undefined,
  now = Date.now()
): OddsFreshness {
  if (!fetchedAt) return "unavailable";
  const ts = Date.parse(fetchedAt);
  if (!Number.isFinite(ts)) return "unavailable";
  const age = now - ts;
  if (age <= 5 * 60 * 1000) return "current";
  if (age <= 30 * 60 * 1000) return "recently_updated";
  if (age <= 2 * 60 * 60 * 1000) return "refresh_recommended";
  return "unavailable";
}

/** List-level evidence from already-qualified daily lists. */
export function evidenceFromQualifiedFixture(fixture: QualifiedFixture): {
  evidenceStrength: EvidenceStrength;
  coverage: number;
  qualifiedSample: number;
  reasoning: ComboReason[];
} {
  const coverage = Math.round(fixture.modelProbability);
  const qualifiedSample = LIST_EVIDENCE_SAMPLE_PROXY;
  const evidenceStrength = resolveEvidenceStrength({
    sampleSize: qualifiedSample,
    coveragePercent: coverage,
    qualified: true,
    providerComplete: true,
  });
  const reasoning: ComboReason[] = [
    {
      code: "list_qualified",
      label: "Passed daily list qualification",
      detail: `${fixture.market} · model ${coverage}%`,
    },
    {
      code: "evidence_strength",
      label: `Evidence strength: ${evidenceStrength}`,
    },
    {
      code: "coverage",
      label: `Coverage ${coverage}%`,
      detail: "Provider model potential for this market",
    },
    {
      code: "sample",
      label: `Qualified sample proxy ${qualifiedSample}`,
      detail: "Daily-list admission proxy until fixture research is attached",
    },
  ];
  return { evidenceStrength, coverage, qualifiedSample, reasoning };
}

export function passesEvidenceGates(
  candidate: Pick<
    ComboCandidate,
    | "qualificationStatus"
    | "coverage"
    | "qualifiedSample"
    | "evidenceStrength"
    | "odds"
    | "kickoffAt"
    | "oddsFreshness"
  >,
  request: ComboRequest,
  now = Date.now()
): { passed: boolean; reasons: string[] } {
  const gates = resolveEffectiveGates(request);
  const reasons: string[] = [];

  if (candidate.qualificationStatus !== "passed") {
    reasons.push("qualification_failed");
  }
  if (candidate.coverage < gates.minCoverage) {
    reasons.push(`coverage_below_${gates.minCoverage}`);
  }
  if (candidate.qualifiedSample < gates.minSample) {
    reasons.push(`sample_below_${gates.minSample}`);
  }
  if (!meetsStrengthFloor(candidate.evidenceStrength, gates.minStrength)) {
    reasons.push(`strength_below_${gates.minStrength}`);
  }
  if (candidate.odds == null || !(candidate.odds > 1)) {
    reasons.push("odds_missing");
  }
  const kickoff = Date.parse(candidate.kickoffAt);
  if (!Number.isFinite(kickoff) || kickoff <= now) {
    reasons.push("fixture_not_upcoming");
  }
  if (candidate.oddsFreshness === "unavailable") {
    reasons.push("odds_stale_or_unavailable");
  }

  return { passed: reasons.length === 0, reasons };
}

export function applyEvidenceGates(
  candidates: readonly ComboCandidate[],
  request: ComboRequest,
  now = Date.now()
): { qualified: ComboCandidate[]; rejected: ComboCandidate[] } {
  const qualified: ComboCandidate[] = [];
  const rejected: ComboCandidate[] = [];

  for (const candidate of candidates) {
    const gate = passesEvidenceGates(candidate, request, now);
    if (gate.passed) {
      qualified.push({
        ...candidate,
        reasoning: [
          ...candidate.reasoning,
          { code: "risk_profile", label: `Passed ${request.riskProfile} evidence gates` },
        ],
      });
    } else {
      rejected.push({
        ...candidate,
        qualificationStatus: candidate.qualificationStatus === "passed" ? "passed" : "failed",
        rejectionReasons: [...candidate.rejectionReasons, ...gate.reasons],
      });
    }
  }

  return { qualified, rejected };
}
