import { getEvidenceArchiveStore } from "@/lib/archive/evidence";
import { runPredictionSettlementJob } from "@/lib/jobs/runner";
import type { RefreshJobRecord } from "@/lib/jobs/types";
import { todayMatchDateStr } from "@/lib/footystats/client";
import {
  createDryRunEvidenceStore,
  parseCanaryCompetitions,
  resolveSettlementActivationMode,
} from "@/lib/evidence-capture/candidates/activation";
import { produceLiveSettlementRequests } from "@/lib/evidence-capture/candidates/live-settlement-candidates";
import type { SettlementCandidate } from "@/lib/evidence-capture/candidates/types";

/* ============================================================================
   THE COMPOSED SETTLEMENT RUN — mode-aware, and inert by default.
   ----------------------------------------------------------------------------
   OFF      exactly today's behavior: the flag-gated job with no producer.
            Wiring this composition changes nothing until two env values are
            deliberately set.
   DRY-RUN  one locked run: the live producer feeds the full pipeline, and
            every validation lands in the split dry-run store. The real
            append-only record is not writable from this path at all.
   CANARY   two sequential locked runs: first the REAL store over ONLY the
            candidates whose competition is in the canary set, then the
            dry-run store over the remainder. The canary run's job record is
            returned, with the dry-run leg's counters merged under `dryrun_*`
            so one record tells the whole night's story.

   Scope note (stated, not hidden): a run settles the CURRENT archive date.
   A fixture finishing after the UTC date rolls over sits in the previous
   partition and is picked up by the go/no-go plan's D-1 sweep follow-up,
   not silently.
   ========================================================================== */

export function canaryFilter(
  candidates: readonly SettlementCandidate[],
  canary: Set<string>,
  keep: "canary" | "rest"
): SettlementCandidate[] {
  return candidates.filter((candidate) => {
    const competition = candidate.row?.competition?.trim().toLowerCase() ?? "";
    const inCanary = canary.has(competition);
    return keep === "canary" ? inCanary : !inCanary;
  });
}

export async function runComposedSettlementJob(
  env: NodeJS.ProcessEnv = process.env
): Promise<RefreshJobRecord> {
  const mode = resolveSettlementActivationMode(env);
  if (mode === "off") {
    // Byte-for-byte today's path: flag-gated, no producer, no store construction.
    return runPredictionSettlementJob({ env });
  }

  const date = todayMatchDateStr();
  const evaluationInstant = new Date().toISOString();
  const realStore = getEvidenceArchiveStore();
  const dryRunStore = createDryRunEvidenceStore(realStore, env);

  if (mode === "dry_run") {
    const record = await runPredictionSettlementJob({
      env,
      deps: { evidenceStore: dryRunStore },
      provideCandidateBatch: async () => {
        const result = await produceLiveSettlementRequests({
          config: { date, evaluationInstant },
        });
        return { candidates: result.candidates, diagnostics: result.diagnostics };
      },
    });
    return {
      ...record,
      resultCounts: { ...(record.resultCounts ?? {}), mode_dry_run: 1 },
    };
  }

  // CANARY — the bounded real run first, then the dry-run remainder.
  const canary = parseCanaryCompetitions(env);
  const realRecord = await runPredictionSettlementJob({
    env,
    deps: { evidenceStore: realStore },
    provideCandidateBatch: async () => {
      const result = await produceLiveSettlementRequests({
        config: { date, evaluationInstant },
      });
      return {
        candidates: canaryFilter(result.candidates, canary, "canary"),
        diagnostics: result.diagnostics,
      };
    },
  });
  const dryRecord = await runPredictionSettlementJob({
    env,
    deps: { evidenceStore: dryRunStore },
    provideCandidateBatch: async () => {
      const result = await produceLiveSettlementRequests({
        config: { date, evaluationInstant },
      });
      return {
        candidates: canaryFilter(result.candidates, canary, "rest"),
        diagnostics: result.diagnostics,
      };
    },
  });

  const merged: Record<string, number> = {
    ...(realRecord.resultCounts ?? {}),
    mode_canary: 1,
    canary_competitions: canary.size,
  };
  for (const [key, value] of Object.entries(dryRecord.resultCounts ?? {})) {
    if (typeof value === "number") merged[`dryrun_${key}`] = value;
  }
  return {
    ...realRecord,
    status:
      realRecord.status === "failed" || dryRecord.status === "failed"
        ? "failed"
        : realRecord.status,
    resultCounts: merged,
  };
}
