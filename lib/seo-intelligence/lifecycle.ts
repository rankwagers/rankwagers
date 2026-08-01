import type { IndexabilityDecision, MatchLifecycleState } from "./contracts";

export type LifecyclePolicy = {
  state: MatchLifecycleState;
  preferredDecision: IndexabilityDecision;
  guidance: string;
};

/** Match/prediction URL lifecycle — prefer archive value over blind deletion. */
export const MATCH_LIFECYCLE_POLICIES: readonly LifecyclePolicy[] = [
  {
    state: "pre_match",
    preferredDecision: "INDEX",
    guidance: "Index when published prediction + complete entity identity exist.",
  },
  {
    state: "live",
    preferredDecision: "INDEX",
    guidance: "Keep indexable while published prediction/context remains valid.",
  },
  {
    state: "recently_completed",
    preferredDecision: "INDEX",
    guidance: "Retain while settlement/archive value is forming.",
  },
  {
    state: "settled",
    preferredDecision: "INDEX",
    guidance: "Keep if factual settled outcome + evidence remain; do not delete for ending alone.",
  },
  {
    state: "archived",
    preferredDecision: "INDEX",
    guidance: "Enduring archive value — prefer INDEX with VALID_SETTLED_ARCHIVE.",
  },
  {
    state: "stale",
    preferredDecision: "NOINDEX",
    guidance: "Stale without archive value → NOINDEX or canonicalize to archive day/hub.",
  },
  {
    state: "invalid",
    preferredDecision: "NOINDEX",
    guidance: "Invalid fixture shells must not stay indexed; 404/410 when defensible.",
  },
  {
    state: "cancelled",
    preferredDecision: "NOINDEX",
    guidance: "Cancelled without enduring value → NOINDEX; do not invent outcomes.",
  },
  {
    state: "postponed",
    preferredDecision: "REVIEW_REQUIRED",
    guidance: "Postponed without value → NOINDEX; with reschedule + prediction may INDEX.",
  },
  {
    state: "abandoned",
    preferredDecision: "NOINDEX",
    guidance: "Abandoned matches without settlement → NOINDEX.",
  },
];

export function policyForLifecycle(
  state: MatchLifecycleState
): LifecyclePolicy | undefined {
  return MATCH_LIFECYCLE_POLICIES.find((p) => p.state === state);
}
