/**
 * Mandatory `evidence_capture` odds record wiring (Sprint 23B, M9 — condition C5).
 *
 * Contract §4.7 / DoD 5: every capture event writes the reserved mandatory fallback
 * odds observation keyed by its `captureId`; a capture event with zero odds records is a
 * FAILED capture. The frozen M6 capture service (`captureEvidenceSnapshot`) mints only
 * the EvidenceSnapshot — it does not touch the odds archive. M9 closes that gap at the
 * orchestration boundary WITHOUT changing capture, odds generation, or any identity:
 * it reuses the frozen `buildOddsRecord` (whose `source === EVIDENCE_CAPTURE_SOURCE`
 * branch already enforces no odds / no operator / no availability) and appends through
 * the frozen odds store contract.
 *
 * IDENTITY (derived, never invented): a snapshot's `capturedAt` IS the capture-window
 * start (`captureWindowKey.quantizedCapturedAt`), so the authoritative window key is
 * `"<fixtureId>|<capturedAt>"` and the `captureId` follows from the frozen `captureId`
 * primitive. `normalizeInstant` is idempotent on a canonical ISO instant, so this
 * reconstructs the exact `captureId` the M1/M6 pipeline computed — no new formula.
 *
 * One fallback record is written PER supported (market, selection) slot: odds identity is
 * unique per `(captureId, marketKey, selectionKey, source)` and the §2.B direct join
 * (DoD 7) is per-market, so the fallback must exist for each market the snapshot carries.
 * A snapshot with no supported markets therefore has no odds record — a failed capture
 * per DoD 5 (fail-closed).
 *
 * Server-only: pulls in `node:crypto` via the hash primitive.
 */

import "server-only";
import type { EvidenceSnapshot } from "@/types/evidence";
import { captureId as deriveCaptureId } from "../identity";
import {
  buildOddsRecord,
  EVIDENCE_CAPTURE_SOURCE,
  type OddsArchiveRecord,
} from "../odds-archive";
import type { OddsArchiveStore } from "../odds-archive/store";

export type CaptureIdentity = {
  captureId: string;
  captureWindowKey: string;
};

/**
 * Reconstruct the capture-event identity from an immutable snapshot. Pure and
 * deterministic — the window key is the frozen `"<fixtureId>|<windowStart>"` shape and
 * `windowStart === snapshot.capturedAt`.
 */
export function captureIdentityFromSnapshot(
  snapshot: EvidenceSnapshot
): CaptureIdentity {
  const captureWindowKey = `${snapshot.fixtureId}|${snapshot.capturedAt}`;
  return {
    captureId: deriveCaptureId({
      fixtureId: snapshot.fixtureId,
      captureWindowKey,
    }),
    captureWindowKey,
  };
}

export type MandatoryOddsBuild =
  | { ok: true; records: OddsArchiveRecord[] }
  | { ok: false; errors: string[] };

/**
 * Build the per-market mandatory fallback records for a snapshot (pure; no I/O). Fails
 * closed: an empty `supportedMarkets` (zero records) or any builder rejection is an
 * error, never a silent empty success.
 */
export function buildMandatoryCaptureOdds(
  snapshot: EvidenceSnapshot
): MandatoryOddsBuild {
  if (!Array.isArray(snapshot.supportedMarkets) || snapshot.supportedMarkets.length === 0) {
    return { ok: false, errors: ["snapshot has no supported markets — zero odds records is a failed capture (DoD 5)"] };
  }

  const { captureId, captureWindowKey } = captureIdentityFromSnapshot(snapshot);
  const records: OddsArchiveRecord[] = [];
  const errors: string[] = [];

  for (const market of snapshot.supportedMarkets) {
    const built = buildOddsRecord({
      captureId,
      fixtureId: snapshot.fixtureId,
      captureWindowKey,
      capturedAt: snapshot.capturedAt,
      marketKey: market.marketKey,
      selectionKey: market.selectionKey,
      decimalOdds: null,
      operatorKey: null,
      impliedProbability: null,
      sampleOperators: 0,
      source: EVIDENCE_CAPTURE_SOURCE,
    });
    if (!built.ok) {
      errors.push(`${market.marketKey}/${market.selectionKey}: ${built.errors.join("; ")}`);
      continue;
    }
    records.push(built.record);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, records };
}

export type MandatoryOddsResult =
  | { ok: true; captureId: string; appended: number; duplicate: number }
  | {
      ok: false;
      captureId: string | null;
      code: "invalid_record" | "immutable_violation" | "write_failed";
      message: string;
    };

/**
 * Ensure every mandatory fallback odds record for a snapshot exists in the store.
 * Idempotent (the odds store collapses byte-identical re-appends to `duplicate`).
 * Fail-closed: a build rejection, an immutable violation, or a write failure returns
 * `ok:false` so the caller treats the capture as failed and retries/alerts.
 */
export async function ensureMandatoryCaptureOdds(
  store: OddsArchiveStore,
  snapshot: EvidenceSnapshot
): Promise<MandatoryOddsResult> {
  const built = buildMandatoryCaptureOdds(snapshot);
  if (!built.ok) {
    return { ok: false, captureId: null, code: "invalid_record", message: built.errors.join("; ") };
  }

  const { captureId } = captureIdentityFromSnapshot(snapshot);
  let appended = 0;
  let duplicate = 0;

  for (const record of built.records) {
    let res;
    try {
      res = await store.append(record);
    } catch (error) {
      return {
        ok: false,
        captureId,
        code: "write_failed",
        message: error instanceof Error ? error.message : "odds append threw",
      };
    }
    if (!res.ok) {
      return { ok: false, captureId, code: res.code, message: res.message };
    }
    if (res.duplicate) duplicate++;
    else appended++;
  }

  return { ok: true, captureId, appended, duplicate };
}
