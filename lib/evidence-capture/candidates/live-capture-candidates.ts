import "server-only";

import { produceCaptureRequests } from "./capture-pipeline";
import {
  createDeriveCaptureInput,
  prefetchCaptureSources,
} from "./derive-capture-input";
import type { CaptureProviderResult } from "./types";
import type { CapturePipelineConfig } from "./capture-pipeline";

/* ============================================================================
   THE LIVE CANDIDATE PRODUCER
   ----------------------------------------------------------------------------
   Closes the last gap between the built capture pipeline and a cron that writes
   real rows. Before this, `runEvidenceCaptureJob()` was called with no candidate
   producer, so `candidates = options?.candidates ?? []` — the job took its lock,
   iterated nothing, and reported success. A scheduled timer would have written
   zero snapshots nightly while looking healthy.

   TWO PASSES, ON PURPOSE
   ----------------------
   The provider's derivation seam is synchronous by contract, and the fetch it
   needs is not. Rather than make the seam async — which would let network timing
   influence which candidates are selected, breaking the determinism the whole
   capture contract rests on — the pipeline runs twice:

     pass 1  a probe seam that derives nothing and records which fixtures the
             planner actually selected. No fetch, no writes, pure planning.
     pass 2  the real seam, closed over sources fetched for exactly that set.

   The cost of pass 1 is one local archive read and one daily-list read, both
   already cached. It buys a fetch bounded by the capture ceiling rather than by
   the size of the board.
   ========================================================================== */

export type LiveCaptureCandidatesOptions = {
  config: CapturePipelineConfig;
  locale?: string;
};

/**
 * Produce today's capture candidates against live sources.
 *
 * Returns the pipeline's own result, diagnostics included, so the caller's counters stay the
 * frozen ones. Nothing here scores, admits or writes: it selects, fetches and derives.
 */
export async function produceLiveCaptureRequests(
  options: LiveCaptureCandidatesOptions
): Promise<CaptureProviderResult> {
  const { config, locale = "en" } = options;

  // Pass 1 — planning only. The probe reports `error` because it genuinely cannot derive; it
  // must never be mistaken for a coverage fact, and its results are discarded regardless.
  const planned: number[] = [];
  await produceCaptureRequests(
    {
      deriveCaptureInput: (request) => {
        planned.push(request.fixtureId);
        return { ok: false, reason: "derivation_error", outcome: "error" };
      },
    },
    config
  );

  // Pass 2 — derive for real over sources fetched for exactly the planned set.
  const sources = await prefetchCaptureSources(planned, locale);
  return produceCaptureRequests(
    { deriveCaptureInput: createDeriveCaptureInput(sources) },
    config
  );
}
