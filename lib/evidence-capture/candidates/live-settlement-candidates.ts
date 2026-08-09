import {
  createDailyArchiveRowsReader,
} from "./archive-rows";
import { createCompletedRowLoader } from "./completed-rows";
import {
  createFileSettlementReadPort,
  produceSettlementRequests,
  type SettlementPipelineDeps,
} from "./settlement-pipeline";
import type { SettlementProviderResult } from "./types";
import { logWarn } from "@/lib/monitoring/logger";

/* ============================================================================
   THE LIVE SETTLEMENT PRODUCER — the settlement mirror of
   `produceLiveCaptureRequests`, and the seam the settlement cron was missing.
   ----------------------------------------------------------------------------
   Composition only: strict archive read → rows projection → fail-closed
   completed-row loader → Stage-2C pipeline (archive-state normalization +
   the settlement provider with every existing exclusion: already-settled
   fixtures, non-terminal lifecycles including the garbage-status-with-
   in-play-evidence deferral, corrupt archive state → reject-all).

   Runs INSIDE the job's held lock (INV-L) because the runner calls the
   producer, never the other way round. Fail-closed end to end: a source or
   archive fault rejects the promise and the run reports `failed` — an empty
   day and a broken read can never look alike.
   ========================================================================== */

export async function produceLiveSettlementRequests(input: {
  config: { date: string; evaluationInstant: string };
  /** Test seams only; production callers take the defaults. */
  deps?: Partial<SettlementPipelineDeps> & { archiveDir?: string };
}): Promise<SettlementProviderResult> {
  const evaluationMs = Date.parse(input.config.evaluationInstant);
  if (!Number.isFinite(evaluationMs)) {
    throw new TypeError(
      `settlement producer: evaluationInstant must be a valid instant, got "${input.config.evaluationInstant}"`
    );
  }

  const readRows =
    input.deps?.loadCompletedRows == null
      ? createCompletedRowLoader({
          readRows: createDailyArchiveRowsReader(
            input.deps?.archiveDir ? { archiveDir: input.deps.archiveDir } : undefined
          ),
          nowSec: Math.floor(evaluationMs / 1000),
          /* Drops were silent — the replay proved a whole archive can vanish without a trace.
             Bounded counts only, never fixture ids. */
          onFilter: (result) => {
            const droppedTotal = Object.values(result.dropped).reduce((a, b) => a + b, 0);
            if (droppedTotal > 0 || result.excludedNonTerminal > 0) {
              logWarn(
                "settlement_source_row_filter",
                {
                  kept: result.rows.length,
                  excludedNonTerminal: result.excludedNonTerminal,
                  ...result.dropped,
                },
                "jobs"
              );
            }
          },
        })
      : input.deps.loadCompletedRows;

  const deps: SettlementPipelineDeps = {
    readPort: input.deps?.readPort ?? createFileSettlementReadPort(),
    loadCompletedRows: readRows,
  };

  return produceSettlementRequests(deps, {
    date: input.config.date,
    evaluationInstant: input.config.evaluationInstant,
  });
}
