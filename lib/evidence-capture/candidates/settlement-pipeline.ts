/**
 * M10 Stage 2C — settlement pipeline wiring (FIRST-SETTLEMENT ONLY).
 *
 * Connects the four settlement-path stages into one reusable producer — the settlement
 * mirror of `capture-pipeline.ts`:
 *
 *   Strict Settlement Archive State (Stage 2A single bounded read: snapshots + validations)
 *        → Stage 1 Settlement Provider (`buildSettlementCandidates`)
 *        → SettlementCandidate[]
 *        → M8 Settlement Batch Runner (`runPredictionSettlementJob` → `runSettlementBatch`)
 *
 * This module owns ONLY the settlement producer + the concrete file-backed strict read port.
 * It performs NO correction discovery, NO deadline (INV-D) enforcement, NO producer-stage
 * diagnostics aggregation, and NO concurrency machinery. The durable job lock already exists
 * in the M9 runner; the producer is invoked INSIDE it via the runner's `provideCandidates`
 * seam (INV-L), which the caller composes.
 *
 * FIRST-SETTLEMENT-ONLY FIREWALL (binding):
 *   - `currentValidationHeads` is NEVER consumed (correction detection is a later stage).
 *   - `correctionCause` is NEVER produced — every `SettlementCandidate` leaves it undefined.
 *   - already-settled fixtures are excluded by the Stage-1 provider (`already_settled`), so no
 *     correction candidate is ever emitted; if one ever slipped through, frozen M8 fails closed
 *     to `invalid_input` on a causeless state change. M8 remains the authoritative writer and
 *     idempotency backstop.
 *
 * THE COMPLETED-ROWS SOURCE (`loadCompletedRows`) is an injected, DORMANT seam — there is no
 * live default. Identifying/validating the concrete finished-fixture loader is a later
 * live-activation task; this module wires everything else.
 *
 * Server-only: the file read port touches the filesystem.
 */

import "server-only";
import {
  readAllSnapshotsStrict,
  readAllValidationsStrict,
} from "@/lib/archive/evidence/file";
import type { FootyMatchRow } from "@/lib/footystats/types";
import { buildSettlementCandidates } from "./settlement-provider";
import { buildSettlementArchiveState } from "./archive-state";
import type { SettlementArchiveReadPort } from "./archive-state";
import type {
  SettlementProviderConfig,
  SettlementProviderResult,
} from "./types";

/**
 * Concrete strict settlement read port over the durable NDJSON evidence archive. Both
 * readers resolve from the SAME `evidenceArchivePaths(env)` (snapshots + validations under
 * one evidence dir), read fail-closed (a corrupt/unreadable archive THROWS, never empty),
 * and are called at most once per discovery run (single bounded read, PB-1). Unlike the
 * capture port there is no separate odds directory, so no eager/lazy path asymmetry arises.
 */
export function createFileSettlementReadPort(
  env: NodeJS.ProcessEnv = process.env
): SettlementArchiveReadPort {
  return {
    readAllSnapshots: () => readAllSnapshotsStrict(env),
    readAllValidations: () => readAllValidationsStrict(env),
  };
}

export type SettlementPipelineDeps = {
  /**
   * The injected completed-fixture-rows loader (required). Returns terminal/finished
   * `FootyMatchRow[]` for the date. Left a DORMANT seam — no live default is wired.
   */
  loadCompletedRows: (date: string) => Promise<readonly FootyMatchRow[]>;
  /** Strict archive read port; defaults to `createFileSettlementReadPort()`. */
  readPort?: SettlementArchiveReadPort;
};

export type SettlementPipelineConfig = {
  /** Target date (source key). */
  date: string;
  /** The run's injected evaluation instant (ISO). The pipeline reads no clock. */
  evaluationInstant: string;
  /** Stage-1 provider config (ceiling / recordedBy). */
  provider?: SettlementProviderConfig;
  /**
   * Optional deterministic override for the source-derived completion instant. Defaults to
   * the fixture's canonical kickoff instant (provisional; activation-gated — BQ-2). MUST be
   * deterministic (no clock).
   */
  deriveCompletionInstant?: (row: FootyMatchRow) => string;
};

/**
 * Produce the bounded, first-settlement `SettlementCandidate[]` for one settlement pass.
 *
 * Loads the completed rows and the settlement archive state (both strict; the archive read
 * is a single bounded read per store), then runs the pure Stage-1 settlement provider to
 * classify → dedup → order → cap → assemble candidates. Returns the provider result verbatim
 * (candidates + the provider's own diagnostics). It sets no `correctionCause`, consumes no
 * `currentValidationHeads`, and excludes already-settled fixtures (via the provider).
 *
 * Fail-closed: a strict-read throw (malformed/IO/conflict) or a source-loader rejection
 * propagates and REJECTS this promise, so the runner reports the pass `failed` rather than an
 * empty success. Never converts a source/archive failure into `[]`.
 */
export async function produceSettlementRequests(
  deps: SettlementPipelineDeps,
  config: SettlementPipelineConfig
): Promise<SettlementProviderResult> {
  const readPort = deps.readPort ?? createFileSettlementReadPort();

  const [completedRows, archiveState] = await Promise.all([
    deps.loadCompletedRows(config.date),
    buildSettlementArchiveState(readPort),
  ]);

  return buildSettlementCandidates({
    completedRows,
    evaluationInstant: config.evaluationInstant,
    archiveState,
    config: config.provider,
    deps: config.deriveCompletionInstant
      ? { deriveCompletionInstant: config.deriveCompletionInstant }
      : undefined,
  });
}
