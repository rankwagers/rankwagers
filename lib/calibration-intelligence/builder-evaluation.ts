import type { AnalyticsEvent } from "@/lib/analytics/types";
import { RISK_MODE_RULES } from "@/lib/acca-builder/config";
import type { SampleStatus } from "./contracts";
import { sampleStatus } from "./sample-gates";

function countEvents(events: AnalyticsEvent[], names: string[]): number {
  const set = new Set(names);
  return events.filter((e) => set.has(String(e.event_name))).length;
}

function prop(e: AnalyticsEvent, key: string): string | null {
  const p = e.properties;
  if (!p || p[key] == null) return null;
  return String(p[key]);
}

export type BuilderGenerationMetrics = {
  requests: number;
  successful: number;
  failed: number;
  noValidCombination: number | null;
  transferToStudio: number;
  merge: number;
  replace: number;
  handoff: number;
  byMode: Array<{
    mode: string;
    generations: number;
    transfers: number;
  }>;
  /** Combination/leg settlement requires durable generation snapshots — unavailable today. */
  settledCombinations: number | null;
  settledLegs: number | null;
  combinationWinRate: number | null;
  sampleStatus: SampleStatus;
  notes: string[];
};

export function evaluateBuilderGenerations(
  events: AnalyticsEvent[],
): BuilderGenerationMetrics {
  const requests = countEvents(events, [
    "acca_builder_generation_started",
    "combo_generate_start",
  ]);
  const successful = countEvents(events, [
    "acca_builder_generation_succeeded",
    "combo_generate_success",
  ]);
  const failed = countEvents(events, [
    "acca_builder_generation_failed",
    "combo_generate_failure",
  ]);
  const transferToStudio = countEvents(events, [
    "acca_builder_added_to_studio",
  ]);
  const merge = countEvents(events, ["acca_builder_merge_selected"]);
  const replace = countEvents(events, ["acca_builder_replace_selected"]);
  const handoff = countEvents(events, ["acca_builder_operator_handoff"]);

  const modes = ["conservative", "balanced", "aggressive"] as const;
  const byMode = modes.map((mode) => {
    const generations = events.filter(
      (e) =>
        (e.event_name === "acca_builder_generation_succeeded" ||
          e.event_name === "combo_generate_success") &&
        (prop(e, "riskMode") === mode || prop(e, "mode") === mode),
    ).length;
    const transfers = events.filter(
      (e) =>
        e.event_name === "acca_builder_added_to_studio" &&
        (prop(e, "riskMode") === mode || prop(e, "mode") === mode),
    ).length;
    return { mode, generations, transfers };
  });

  return {
    requests,
    successful,
    failed,
    noValidCombination: null,
    transferToStudio,
    merge,
    replace,
    handoff,
    byMode,
    settledCombinations: null,
    settledLegs: null,
    combinationWinRate: null,
    sampleStatus: sampleStatus(successful),
    notes: [
      "Builder generations are counted from analytics events only.",
      "Durable generation/combination snapshots are not persisted (persist: false).",
      "Selected-leg and combination settlement linkage is Unavailable.",
      "Transfer rate is not a settlement-quality proxy.",
    ],
  };
}

export type ModeOrderingValidation = {
  status: "MATCHES_CONFIG" | "CONFIG_DRIFT" | "INSUFFICIENT_DATA";
  expected: {
    conservativeMinConfidence: number;
    balancedMinConfidence: number;
    aggressiveMinConfidence: number;
  };
  findings: string[];
};

/** Validates documented mode config ordering — not settlement outcomes. */
export function validateModeOrdering(): ModeOrderingValidation {
  const c = RISK_MODE_RULES.conservative.minConfidence;
  const b = RISK_MODE_RULES.balanced.minConfidence;
  const a = RISK_MODE_RULES.aggressive.minConfidence;
  const findings: string[] = [];
  if (!(c > b && b > a)) {
    findings.push(
      `Expected conservative.minConfidence > balanced > aggressive; got ${c}, ${b}, ${a}`,
    );
  }
  return {
    status: findings.length ? "CONFIG_DRIFT" : "MATCHES_CONFIG",
    expected: {
      conservativeMinConfidence: c,
      balancedMinConfidence: b,
      aggressiveMinConfidence: a,
    },
    findings:
      findings.length === 0
        ? [
            `Configuration ordering holds: conservative ${c} > balanced ${b} > aggressive ${a}`,
          ]
        : findings,
  };
}
