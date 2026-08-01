/**
 * Evidence settlement orchestration (Sprint 23B, Milestone M8) — dormant, injectable.
 *
 * Turns a terminal fixture + its immutable EvidenceSnapshot subject into append-only,
 * revision-aware `ValidationRecord`s, using ONLY the frozen validation builders and the
 * frozen archive store contract. It adds no field to any frozen record, mints no identity of
 * its own, and is wired to no runtime (no cron/route/worker/UI/timer). Callers pass the store
 * and every deterministic input; the module reads no clock/env/network.
 *
 * Conditions resolved (see `docs/plans/m8-settlement-architecture-review.md`, §5):
 *   R1  recordedAt = settledAt = the caller-supplied `completionInstant`; `resolveMatchLifecycle`
 *       is always called with an explicit `nowSec`. No `Date.now()`/`new Date()` anywhere.
 *   R2  lifecycle authority is `resolveMatchLifecycle`; `listSettleState` is NOT used.
 *   R3  missing HT/FT data ⇒ pending (no write), never `lost` — enforced in `outcomes.ts`.
 *   R4  pending ⇒ no append; a deterministic `no-write` per-market status explains why.
 *   R5  correction reason is a pure function of an explicit typed `CorrectionCause`
 *       (the frozen `ValidationRecord` carries no lineage, so the smallest explicit cause input
 *       is required and validated fail-closed).
 *   R6  settlement subject is ONE snapshot (`settleSnapshot`); the fixture-level convenience
 *       (`settleLatestSnapshotForFixture`) settles ONLY the latest snapshot, selected by the
 *       frozen `sequence` ordering via the store — never archive read order.
 *   R7  the frozen validation store is read-decide-append with no in-process mutex; M8 stays
 *       dormant and single-writer. Immutable-violation is surfaced loudly, never downgraded.
 *
 * Node-only: the frozen builders pull in `node:crypto` via the hash primitive.
 */

import type { EvidenceSnapshot, ValidationReasonCode, ValidationRecord, ValidationState } from "@/types/evidence";
import type { FootyMatchRow } from "@/lib/footystats/types";
import type { EvidenceArchiveStore } from "@/lib/archive/evidence/store";
import { resolveMatchLifecycle } from "@/lib/fixtures/status";
import {
  createValidationRecord,
  currentValidationRevisions,
  reviseValidationRecord,
} from "@/lib/validation/records";
import { validationId } from "@/lib/evidence/identifiers";
import { isIsoInstant } from "@/lib/evidence/snapshot";
import { resolveValidationOutcome } from "./outcomes";

/** Engine tag written into `ValidationRecord.recordedBy` when the caller supplies none. */
export const SETTLEMENT_ENGINE = "evidence_settlement";

/**
 * Dormant activation flag — DEFAULT OFF. M8 ships no caller that reads it; wiring it into the
 * shared `FeatureFlags` framework and gating a scheduler on it is a deferred M9 activation gate.
 * Kept as a pure constant (no env read) so importing settlement activates nothing.
 */
export const EVIDENCE_SETTLEMENT_ENABLED = false;

/** Pure predicate over an injected flag value; defaults to the dormant constant. */
export function isEvidenceSettlementEnabled(
  flag: boolean = EVIDENCE_SETTLEMENT_ENABLED
): boolean {
  return flag === true;
}

/**
 * Why a correction (state change on an already-settled selection) is being appended.
 * Deterministic → reason code; never inferred from wall-clock/retry/worker/operator choice.
 *   result_reinterpreted  → the authoritative result/lifecycle interpretation changed while the
 *                           retained source lineage is unchanged (e.g. corrected official score).
 *   source_lineage_changed→ the retained source/input basis was replaced (a provider correction
 *                           superseded the record the validation was derived from).
 */
export type CorrectionCause = "result_reinterpreted" | "source_lineage_changed";

/** Pure, total mapping. Returns null for an unknown cause (fail closed). */
export function determineCorrectionReason(
  cause: CorrectionCause
): Extract<ValidationReasonCode, "settlement_correction" | "data_correction"> | null {
  if (cause === "result_reinterpreted") return "settlement_correction";
  if (cause === "source_lineage_changed") return "data_correction";
  return null;
}

export type MarketSettlementStatus =
  | "appended"
  | "no_change"
  | "pending"
  | "unsupported"
  | "invalid_input"
  | "immutable_violation"
  | "append_failed";

export type MarketSettlement = {
  marketKey: string;
  selectionKey: string;
  validationId: string;
  status: MarketSettlementStatus;
  state?: ValidationState;
  reasonCode?: ValidationReasonCode;
  revisionId?: string;
  revision?: number;
  message?: string;
};

export type SettlementSummary = {
  appended: number;
  noChange: number;
  pending: number;
  unsupported: number;
  invalidInput: number;
  immutableViolation: number;
  appendFailed: number;
};

export type SettlementResult = {
  /** true iff the snapshot resolved and no market hit a hard fault (violation/failure/invalid). */
  ok: boolean;
  status: "settled" | "not_found" | "invalid_input";
  snapshotId: string | null;
  fixtureId: number | null;
  markets: MarketSettlement[];
  summary: SettlementSummary;
  message?: string;
};

export type SettleSnapshotInput = {
  /** The immutable snapshot subject — must already be archived in `store`. */
  snapshot: EvidenceSnapshot;
  /** Authoritative terminal provider row (FT/HT scores + status). */
  row: FootyMatchRow;
  /** Deterministic source-derived terminal instant → recordedAt = settledAt. Never a clock. */
  completionInstant: string;
  /** Deterministic seconds for `resolveMatchLifecycle`. REQUIRED — never rely on its Date.now default. */
  nowSec: number;
  /** Defaults to `SETTLEMENT_ENGINE`. */
  recordedBy?: string;
  /** Required only when a state change (correction) will be appended. Validated fail-closed. */
  correctionCause?: CorrectionCause;
  /** Authoritative market-level void — never set by daily-list settlement (R6). */
  authoritativeMarketVoid?: boolean;
};

function emptySummary(): SettlementSummary {
  return {
    appended: 0,
    noChange: 0,
    pending: 0,
    unsupported: 0,
    invalidInput: 0,
    immutableViolation: 0,
    appendFailed: 0,
  };
}

function tally(summary: SettlementSummary, status: MarketSettlementStatus): void {
  switch (status) {
    case "appended":
      summary.appended++;
      break;
    case "no_change":
      summary.noChange++;
      break;
    case "pending":
      summary.pending++;
      break;
    case "unsupported":
      summary.unsupported++;
      break;
    case "invalid_input":
      summary.invalidInput++;
      break;
    case "immutable_violation":
      summary.immutableViolation++;
      break;
    case "append_failed":
      summary.appendFailed++;
      break;
  }
}

/** Deterministic correction note — a pure function of the transition and reason code. */
function correctionNote(
  from: ValidationState,
  to: ValidationState,
  reason: ValidationReasonCode
): string {
  return `${from}->${to}:${reason}`;
}

/**
 * Settle ONE immutable EvidenceSnapshot against a terminal fixture row.
 *
 * Idempotent: an unchanged current outcome writes nothing (`no_change`); a changed outcome
 * appends exactly one correction revision; a byte-identical rebuild is absorbed by the store's
 * `(revisionId, contentHash)` idempotency as `no_change`. Immutable violations are surfaced,
 * never swallowed.
 */
export async function settleSnapshot(
  store: EvidenceArchiveStore,
  input: SettleSnapshotInput
): Promise<SettlementResult> {
  const summary = emptySummary();
  const snapshot = input.snapshot;

  // ---- fail-closed input validation (snapshot-level) ----
  if (
    snapshot === null ||
    typeof snapshot !== "object" ||
    typeof snapshot.id !== "string" ||
    !snapshot.id ||
    !Number.isInteger(snapshot.fixtureId)
  ) {
    return { ok: false, status: "invalid_input", snapshotId: null, fixtureId: null, markets: [], summary, message: "snapshot is malformed" };
  }
  if (input.row === null || typeof input.row !== "object") {
    return { ok: false, status: "invalid_input", snapshotId: snapshot.id, fixtureId: snapshot.fixtureId, markets: [], summary, message: "row is malformed" };
  }
  if (!isIsoInstant(input.completionInstant)) {
    return { ok: false, status: "invalid_input", snapshotId: snapshot.id, fixtureId: snapshot.fixtureId, markets: [], summary, message: "completionInstant must be an ISO-8601 instant" };
  }
  if (!Number.isInteger(input.nowSec)) {
    return { ok: false, status: "invalid_input", snapshotId: snapshot.id, fixtureId: snapshot.fixtureId, markets: [], summary, message: "nowSec must be an integer (no Date.now default)" };
  }

  const recordedBy = input.recordedBy ?? SETTLEMENT_ENGINE;
  const row = input.row;

  // R2 + R1 — terminal classification with an EXPLICIT deterministic nowSec.
  const lifecycle = resolveMatchLifecycle({
    status: row.status,
    kickoffUnix: row.kickoffTime ?? null,
    minute: row.minute ?? null,
    nowSec: input.nowSec,
  });

  // Current head per logical validation, derived (never stored) from the full stream.
  const existing = await store.listValidations(snapshot.fixtureId);
  const current = currentValidationRevisions(existing);

  const markets: MarketSettlement[] = [];

  for (const sm of snapshot.supportedMarkets) {
    const vid = validationId({
      snapshotId: snapshot.id,
      marketKey: sm.marketKey,
      selectionKey: sm.selectionKey,
    });
    const base = { marketKey: sm.marketKey, selectionKey: sm.selectionKey, validationId: vid };

    const outcome = resolveValidationOutcome({
      lifecycle,
      row,
      marketKey: sm.marketKey,
      selectionKey: sm.selectionKey,
      completionInstant: input.completionInstant,
      authoritativeMarketVoid: input.authoritativeMarketVoid,
    });

    if (outcome.kind === "unsupported") {
      markets.push({ ...base, status: "unsupported", message: outcome.message });
      continue;
    }
    if (outcome.kind === "invalid") {
      markets.push({ ...base, status: "invalid_input", message: `${outcome.code}: ${outcome.message}` });
      continue;
    }
    if (outcome.kind === "pending") {
      // R4 — pending is never persisted.
      markets.push({ ...base, status: "pending", state: "pending", reasonCode: "awaiting_result" });
      continue;
    }

    // outcome is terminal (settled | terminal_non_scored) → build a record via frozen builders.
    const head = current.get(vid) ?? null;
    let record: ValidationRecord;

    if (!head) {
      const built = createValidationRecord({
        snapshotId: snapshot.id,
        fixtureId: snapshot.fixtureId,
        marketKey: sm.marketKey,
        selectionKey: sm.selectionKey,
        state: outcome.state,
        reasonCode: outcome.reasonCode,
        note: null,
        recordedAt: outcome.settledAt, // R1: recordedAt = settledAt = completionInstant
        settledAt: outcome.settledAt,
        recordedBy,
      });
      if (!built.ok) {
        markets.push({ ...base, status: "invalid_input", message: built.errors.join("; ") });
        continue;
      }
      record = built.record;
    } else if (head.state === outcome.state) {
      // Unchanged current outcome → no append.
      markets.push({
        ...base,
        status: "no_change",
        state: head.state,
        reasonCode: head.reasonCode,
        revisionId: head.revisionId,
        revision: head.revision,
      });
      continue;
    } else {
      // Changed outcome → exactly one correction. R5 requires an explicit typed cause.
      if (input.correctionCause === undefined) {
        markets.push({ ...base, status: "invalid_input", message: "state change requires an explicit correctionCause" });
        continue;
      }
      const reason = determineCorrectionReason(input.correctionCause);
      if (reason === null) {
        markets.push({ ...base, status: "invalid_input", message: `invalid correctionCause: ${String(input.correctionCause)}` });
        continue;
      }
      const revised = reviseValidationRecord(head, {
        state: outcome.state,
        reasonCode: reason,
        note: correctionNote(head.state, outcome.state, reason),
        recordedAt: outcome.settledAt,
        settledAt: outcome.settledAt,
        recordedBy,
      });
      if (!revised.ok) {
        markets.push({ ...base, status: "invalid_input", message: revised.errors.join("; ") });
        continue;
      }
      record = revised.record;
    }

    // ---- append (idempotent on revisionId+contentHash; immutable_violation stays loud) ----
    const res = await store.appendValidation(record);
    if (res.ok) {
      markets.push({
        ...base,
        status: res.appended ? "appended" : "no_change",
        state: record.state,
        reasonCode: record.reasonCode,
        revisionId: record.revisionId,
        revision: record.revision,
      });
    } else if (res.code === "immutable_violation") {
      markets.push({ ...base, status: "immutable_violation", message: res.message });
    } else {
      markets.push({ ...base, status: "append_failed", message: `${res.code}: ${res.message}` });
    }
  }

  for (const m of markets) tally(summary, m.status);
  const ok =
    summary.invalidInput === 0 &&
    summary.immutableViolation === 0 &&
    summary.appendFailed === 0;

  return {
    ok,
    status: "settled",
    snapshotId: snapshot.id,
    fixtureId: snapshot.fixtureId,
    markets,
    summary,
  };
}

/**
 * Fixture-level convenience: settle ONLY the latest snapshot for a fixture. The latest is
 * chosen by the store's frozen `sequence` ordering (`latestSnapshot`), never by archive read
 * order, and multiple historical snapshots are never settled by one call (R6).
 */
export async function settleLatestSnapshotForFixture(
  store: EvidenceArchiveStore,
  input: Omit<SettleSnapshotInput, "snapshot"> & { fixtureId: number }
): Promise<SettlementResult> {
  if (!Number.isInteger(input.fixtureId)) {
    return { ok: false, status: "invalid_input", snapshotId: null, fixtureId: null, markets: [], summary: emptySummary(), message: "fixtureId must be an integer" };
  }
  const snapshot = await store.latestSnapshot(input.fixtureId);
  if (!snapshot) {
    return { ok: false, status: "not_found", snapshotId: null, fixtureId: input.fixtureId, markets: [], summary: emptySummary(), message: `no snapshot for fixture ${input.fixtureId}` };
  }
  const { fixtureId: _fixtureId, ...rest } = input;
  return settleSnapshot(store, { ...rest, snapshot });
}
