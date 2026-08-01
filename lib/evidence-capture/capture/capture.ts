/**
 * EvidenceSnapshot capture through the immutable archive boundary (Sprint 23B, M6).
 *
 * Dormant, injectable capture service — no scheduler, no cron, no route, no runtime
 * activation. The store is passed in (never resolved from env), keeping this unwired to
 * production. Fail-closed throughout; separates PURE construction (`build.ts`) from
 * persistence here.
 *
 * Flow (Contract §4.2/§4.3, addendum A1/A4/A8):
 *   1. gate on admission + validate fixture/window identity + provider integrity;
 *   2. FULL-STREAM idempotency pre-check (a same-window `evidence_capture` snapshot
 *      anywhere in the stream → already_exists, before any sequence is minted);
 *   3. derive sequence + previousSnapshotId from the archive head;
 *   4. build the snapshot (pure);
 *   5. append through the immutable store, mapping outcomes to the result vocabulary —
 *      duplicate (id+hash) → already_exists; different hash → immutable_violation;
 *      other codes surfaced as archive_error (never silently swallowed).
 */

import type { EvidenceSnapshot } from "@/types/evidence";
import { isIsoInstant } from "@/lib/evidence/snapshot";
import { EVIDENCE_HISTORY_MAX_LIMIT } from "@/lib/evidence/constants";
import type { EvidenceArchiveStore } from "@/lib/archive/evidence/store";
import { isValidFixtureId } from "../identity";
import { verifyProviderArchiveRecord } from "../provider-archive";
import type { ProviderArchiveRecord } from "../provider-archive";
import type { BestOddsSnapshot, OperatorAvailabilitySnapshot } from "@/types/evidence";
import type { FixtureModelInput } from "../model";
import {
  buildCaptureSnapshot,
  type CaptureDiagnostics,
  CAPTURE_ENGINE,
} from "./build";
import { normalizeInstant } from "./canonical";

export type CaptureRequest = {
  /** M4 admission succeeded for the upstream inputs. */
  admitted: boolean;
  fixtureId: number;
  /** Capture-window anchor (validated + normalized here); the snapshot's capturedAt. */
  capturedAt: string;
  modelInput: FixtureModelInput;
  /** Retained provider record — integrity-checked when supplied. */
  providerRecord?: ProviderArchiveRecord | null;
  competitionId?: string | null;
  seasonId?: string | null;
  operatorAvailability?: OperatorAvailabilitySnapshot | null;
  bestOddsSnapshot?: BestOddsSnapshot | null;
  modelVersion?: string;
};

export type CaptureStatus =
  | "created"
  | "already_exists"
  | "immutable_violation"
  | "invalid_input"
  | "not_admitted"
  | "derivation_failed"
  | "archive_error";

export type CaptureResult = {
  status: CaptureStatus;
  reason?: string;
  snapshot?: EvidenceSnapshot;
  diagnostics?: CaptureDiagnostics;
  /** Archive result metadata (ephemeral): "appended" | "duplicate" | append code. */
  appendCode?: string;
};

export async function captureEvidenceSnapshot(
  store: EvidenceArchiveStore,
  request: CaptureRequest
): Promise<CaptureResult> {
  if (!request.admitted) {
    return { status: "not_admitted", reason: "upstream_not_admitted" };
  }
  if (!isValidFixtureId(request.fixtureId)) {
    return { status: "invalid_input", reason: "invalid_fixture_id" };
  }
  if (!isIsoInstant(request.capturedAt)) {
    return { status: "invalid_input", reason: "invalid_captured_at" };
  }
  if (request.providerRecord && !verifyProviderArchiveRecord(request.providerRecord)) {
    return { status: "invalid_input", reason: "provider_integrity_failure" };
  }

  const anchor = normalizeInstant(request.capturedAt);

  // Full-stream idempotency pre-check (before any sequence is minted).
  let stream: EvidenceSnapshot[];
  try {
    stream = await store.listSnapshots(request.fixtureId, {
      limit: EVIDENCE_HISTORY_MAX_LIMIT,
    });
  } catch (error) {
    return {
      status: "archive_error",
      reason: error instanceof Error ? error.message : "stream_read_failed",
    };
  }
  const existing = stream.find(
    (s) => s.capturedAt === anchor && s.capturedBy === CAPTURE_ENGINE
  );
  if (existing) {
    return { status: "already_exists", snapshot: existing, appendCode: "pre_check" };
  }

  let latest: EvidenceSnapshot | null;
  try {
    latest = await store.latestSnapshot(request.fixtureId);
  } catch (error) {
    return {
      status: "archive_error",
      reason: error instanceof Error ? error.message : "latest_read_failed",
    };
  }
  const sequence = (latest?.sequence ?? 0) + 1;
  const previousSnapshotId = latest?.id ?? null;

  const built = buildCaptureSnapshot({
    fixtureId: request.fixtureId,
    capturedAt: anchor,
    sequence,
    previousSnapshotId,
    modelInput: request.modelInput,
    competitionId: request.competitionId,
    seasonId: request.seasonId,
    operatorAvailability: request.operatorAvailability,
    bestOddsSnapshot: request.bestOddsSnapshot,
    modelVersion: request.modelVersion,
  });
  if (!built.ok) {
    return {
      status: built.kind === "derivation_failed" ? "derivation_failed" : "invalid_input",
      reason: built.reason,
    };
  }

  let append;
  try {
    append = await store.appendSnapshot(built.snapshot);
  } catch (error) {
    return {
      status: "archive_error",
      reason: error instanceof Error ? error.message : "append_threw",
    };
  }
  if (!append.ok) {
    if (append.code === "immutable_violation") {
      return { status: "immutable_violation", reason: append.message, appendCode: append.code };
    }
    // sequence_conflict / write_failed / invalid_record — surfaced, never swallowed.
    return { status: "archive_error", reason: append.message, appendCode: append.code };
  }
  return {
    status: append.duplicate ? "already_exists" : "created",
    snapshot: append.record,
    diagnostics: built.diagnostics,
    appendCode: append.duplicate ? "duplicate" : "appended",
  };
}
