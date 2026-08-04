/**
 * M10 Stage 2B — capture pipeline wiring.
 *
 * Connects the four capture-path stages into one reusable producer:
 *
 *   Archive State (Stage 2A, strict single read)
 *        → Stage 1 Provider (`buildCaptureCandidates`)
 *        → CaptureRequest[]
 *        → M6 Capture Runner (`runEvidenceCaptureJob` → `runCaptureBatch`)
 *
 * This module owns ONLY the capture producer + the concrete file-backed strict read port.
 * It performs NO settlement, NO deadline (INV-D) enforcement, NO producer-stage diagnostics
 * aggregation, NO replay logic, and NO concurrency/overlap machinery. The durable job lock
 * already exists in the M9 runner; the producer is invoked INSIDE it via the runner's
 * `provideCandidates` seam (INV-L: discovery under the held lock), which the caller composes.
 *
 * THE DERIVATION SEAM (`deriveCaptureInput`) is INJECTED. It is the M4-fetch + M5-derive
 * bridge that turns a selected fixture into a scored `FixtureModelInput`. The frozen M4
 * fetchers are still dormant (no real network I/O) and the Stage-1 derivation dependency is
 * synchronous, so wiring a live async M4→M5 implementation is a SEPARATE later stage. This
 * module leaves that dependency as a required injected seam and wires everything else.
 *
 * Server-only: the default source loader and file read port touch the filesystem.
 */

import "server-only";
import path from "path";
import {
  evidenceArchivePaths,
  readAllSnapshotsStrict,
  resolveEvidenceArchiveDir,
} from "@/lib/archive/evidence/file";
import {
  oddsArchivePaths,
  readAllOddsRecordsStrict,
} from "@/lib/evidence-capture/odds-archive/file";
import {
  loadLiveDailyPredictions,
  type LoadDailyPredictionsOptions,
  type PublishedDailyPrediction,
} from "../source";
import { DEFAULT_CAPTURE_LEAD_MINUTES } from "../config";
import { buildCaptureCandidates } from "./capture-provider";
import { buildCaptureArchiveState } from "./archive-state";
import type { CaptureArchiveReadPort } from "./archive-state";
import type {
  CaptureProviderConfig,
  CaptureProviderDeps,
  CaptureProviderResult,
} from "./types";

/**
 * Concrete strict capture read port over the durable NDJSON adapters. Each store is read
 * exactly once per call (single bounded read, PB-1) via the fail-closed whole-archive
 * readers — a corrupt/unreadable archive THROWS, never reads as empty. The evidence dir is
 * resolved from `env`; the odds records file lives under `<evidenceDir>/odds-archive`.
 */
export function createFileCaptureReadPort(
  env: NodeJS.ProcessEnv = process.env
): CaptureArchiveReadPort {
  const oddsRecordsFile = oddsArchivePaths(
    path.join(resolveEvidenceArchiveDir(env), "odds-archive")
  ).records;
  // `evidenceArchivePaths(env)` is resolved here to fail fast on a bad env; the reader
  // re-resolves internally, so this is only a defensive touch.
  void evidenceArchivePaths(env);
  return {
    readAllSnapshots: () => readAllSnapshotsStrict(env),
    readAllOddsRecords: () => readAllOddsRecordsStrict(oddsRecordsFile),
  };
}

export type CapturePipelineDeps = {
  /**
   * The injected M4-fetch + M5-derive bridge (required). Turns a selected fixture into a
   * scored `FixtureModelInput` (+ provenance) or a rejection. Left as a seam here — the
   * live async M4→M5 wiring is a later stage.
   */
  deriveCaptureInput: CaptureProviderDeps["deriveCaptureInput"];
  /**
   * Source loader; defaults to `loadLiveDailyPredictions`. Injectable for tests.
   *
   * NOT the archive loader. The archive for a date is written only once one of its fixtures has
   * FINISHED, so it does not exist during the pre-kickoff window capture runs in — see
   * `loadLiveDailyPredictions`.
   */
  loadSource?: (
    date: string,
    options?: LoadDailyPredictionsOptions
  ) => Promise<readonly PublishedDailyPrediction[]>;
  /** Strict archive read port; defaults to `createFileCaptureReadPort()`. */
  readPort?: CaptureArchiveReadPort;
};

export type CapturePipelineConfig = {
  /** Target daily-list date (source key). */
  date: string;
  /** The run's injected evaluation instant (ISO). The pipeline reads no clock. */
  evaluationInstant: string;
  /** Pre-kickoff lead in minutes; defaults to `DEFAULT_CAPTURE_LEAD_MINUTES`. */
  leadMinutes?: number;
  /** Stage-1 provider config (ceiling/competitions/staleness/modelVersion). */
  provider?: CaptureProviderConfig;
  /** Options forwarded to the source loader. */
  sourceOptions?: LoadDailyPredictionsOptions;
};

/**
 * Produce the bounded `CaptureRequest[]` for one capture pass.
 *
 * Reads the source and the archive state (both strict; the archive read is a single bounded
 * read per store), then runs the pure Stage-1 provider to classify, order, cap, and assemble
 * candidates through the injected derivation. Returns the provider result verbatim
 * (candidates + the provider's own diagnostics) — it neither aggregates producer-stage
 * metrics nor enforces a deadline.
 *
 * Fail-closed: a strict-read throw (malformed/IO/conflict) propagates and REJECTS this
 * promise, so the runner reports the pass `failed` rather than an empty success.
 */
export async function produceCaptureRequests(
  deps: CapturePipelineDeps,
  config: CapturePipelineConfig
): Promise<CaptureProviderResult> {
  const loadSource = deps.loadSource ?? loadLiveDailyPredictions;
  const readPort = deps.readPort ?? createFileCaptureReadPort();
  const leadMinutes = config.leadMinutes ?? DEFAULT_CAPTURE_LEAD_MINUTES;

  const [sourceRows, archiveState] = await Promise.all([
    loadSource(config.date, config.sourceOptions),
    buildCaptureArchiveState(readPort),
  ]);

  return buildCaptureCandidates(
    {
      sourceRows,
      evaluationInstant: config.evaluationInstant,
      leadMinutes,
      archiveState,
      config: config.provider,
    },
    { deriveCaptureInput: deps.deriveCaptureInput }
  );
}
