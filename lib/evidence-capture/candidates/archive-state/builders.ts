/**
 * M10 Stage 2A — reusable archive-state builders.
 *
 * Thin async orchestrators that combine a strict, injected whole-archive read port with the
 * pure normalizers to produce the normalized progress state the Stage-1 candidate provider
 * consumes. They own exactly two responsibilities and nothing else:
 *
 *   1. SINGLE BOUNDED READ (PB-1, spec §7.2): read each store the path needs at most once
 *      per run (the reads run concurrently) — never a per-fixture loop over the per-fixture
 *      store API, which would be O(D·A) ≈ O(F²).
 *   2. FAIL-CLOSED PROPAGATION (SC-4 / AR-0 / DR-6, spec §8): the port's strict reads throw
 *      on malformed/permission/I-O/conflict; these builders NEVER catch. A rejected read
 *      rejects the whole build, so a corrupt/unreadable archive surfaces as a failure — it
 *      can never be misreported as empty/zero-candidate progress. `Promise.all` short-circuits
 *      to the first rejection; no partial state is ever returned after a throw.
 *
 * These builders are REUSABLE and DORMANT: Stage 2A neither invokes them nor wires a concrete
 * port to the file store, cron, lock, or runner. The orchestration stage supplies a concrete
 * strict reader (backed by the frozen adapters) and calls these inside the durable job lock.
 * No clock, no random, no env, no identity minting.
 */

import type { CaptureArchiveState, SettlementArchiveState } from "../types";
import {
  normalizeCaptureArchiveState,
  normalizeSettlementArchiveState,
} from "./normalize";
import type {
  CaptureArchiveReadPort,
  SettlementArchiveReadPort,
} from "./types";

/**
 * Build normalized capture progress (`capturedWindowKeys` / `partialWindowKeys` /
 * `orphanOddsWindowKeys`) from one strict whole-archive read of snapshots + odds.
 * Rejects (never returns empty) if either strict read fails.
 */
export async function buildCaptureArchiveState(
  port: CaptureArchiveReadPort
): Promise<CaptureArchiveState> {
  const [snapshots, oddsRecords] = await Promise.all([
    port.readAllSnapshots(),
    port.readAllOddsRecords(),
  ]);
  return normalizeCaptureArchiveState(snapshots, oddsRecords);
}

/**
 * Build normalized settlement progress (`capturedFixtureIds` / `settledFixtureIds` /
 * `currentValidationHeads`) from one strict whole-archive read of snapshots + validations.
 * Rejects (never returns empty) if either strict read fails.
 */
export async function buildSettlementArchiveState(
  port: SettlementArchiveReadPort
): Promise<SettlementArchiveState> {
  const [snapshots, validations] = await Promise.all([
    port.readAllSnapshots(),
    port.readAllValidations(),
  ]);
  return normalizeSettlementArchiveState(snapshots, validations);
}
