/**
 * M10 Stage 1 — pure settlement candidate provider (spec §4.0 Option C, §3).
 *
 * Turns completed source rows + archive-derived settlement state into deterministic
 * `SettlementCandidate[]`, plus aggregate diagnostics. It emits candidates for captured,
 * not-yet-settled fixtures the frozen M8 engine would WRITE a validation record for —
 * `finished` (scored won/lost, with valid final scores) and the lifecycle-terminal
 * `postponed | cancelled | abandoned` (terminal non-scored) — using the authoritative
 * status-driven `resolveMatchLifecycle` boundary (BF-S1). It NEVER computes
 * WIN/LOSS/VOID/PUSH (that stays with the frozen M8 runner) and never writes/reads a store,
 * lock, clock (beyond the injected evaluation instant), or env.
 *
 * `nowSec` is derived deterministically from the injected evaluation instant. `completionInstant`
 * is a deterministic, source-derived instant.
 *
 * KNOWN LIMITATION (Stage 1): `FootyMatchRow` carries no explicit terminal timestamp, so the
 * default `completionInstant` uses the fixture's canonical kickoff instant (a stable source
 * field) — deterministic and idempotent across re-runs, which is the property M8 requires
 * (recordedAt = settledAt must be source-stable, not a wall clock). The orchestration stage may
 * inject a more precise terminal instant via `deps.deriveCompletionInstant`.
 */

import type { FootyMatchRow } from "@/lib/footystats/types";
import { isValidInstant } from "@/lib/evidence-capture/identity";
import { normalizeBatchLimit } from "./limits";
import { compareSettlementCandidates, sortDeterministic } from "./ordering";
import { emptySettlementDiagnostics, bumpReason } from "./diagnostics";
import { classifySettlementRow } from "./eligibility";
import type {
  SettlementArchiveState,
  SettlementCandidate,
  SettlementProviderInput,
  SettlementProviderResult,
} from "./types";

type EligibleSettlement = {
  fixtureId: number;
  row: FootyMatchRow;
  completionInstant: string;
};

function isReadonlySet(value: unknown): value is ReadonlySet<number> {
  return value instanceof Set;
}

function archiveStateOk(state: SettlementArchiveState): boolean {
  return (
    state !== null &&
    typeof state === "object" &&
    isReadonlySet(state.capturedFixtureIds) &&
    isReadonlySet(state.settledFixtureIds)
  );
}

function defaultCompletionInstant(
  row: FootyMatchRow,
  evaluationInstant: string
): string {
  if (isValidInstant(row.kickoff)) {
    return new Date(Date.parse(row.kickoff)).toISOString();
  }
  return evaluationInstant;
}

/** Total content order for deterministic dedup — independent of input array order. */
function compareForDedup(a: EligibleSettlement, b: EligibleSettlement): number {
  if (a.completionInstant < b.completionInstant) return -1;
  if (a.completionInstant > b.completionInstant) return 1;
  if (a.fixtureId !== b.fixtureId) return a.fixtureId - b.fixtureId;
  if (a.row.homeScore !== b.row.homeScore) return a.row.homeScore - b.row.homeScore;
  if (a.row.awayScore !== b.row.awayScore) return a.row.awayScore - b.row.awayScore;
  return a.row.status < b.row.status ? -1 : a.row.status > b.row.status ? 1 : 0;
}

export function buildSettlementCandidates(
  input: SettlementProviderInput
): SettlementProviderResult {
  const diag = emptySettlementDiagnostics();
  const rejected = diag.candidatesRejectedByReason;

  const evalMs = Date.parse(input.evaluationInstant);
  if (!Number.isFinite(evalMs)) {
    throw new TypeError(
      `settlement provider: evaluationInstant must be a valid instant, got "${input.evaluationInstant}"`
    );
  }
  const nowSec = Math.floor(evalMs / 1000);

  diag.sourceRowsDiscovered = input.completedRows.length;

  // Fail-closed on a corrupt normalized archive state: reject every row rather than risk a
  // false candidate against unknown progress.
  if (!archiveStateOk(input.archiveState)) {
    for (let i = 0; i < input.completedRows.length; i++) {
      bumpReason(rejected, "corrupt_archive_state");
    }
    return { candidates: [], diagnostics: diag };
  }

  const ctx = {
    nowSec,
    capturedFixtureIds: input.archiveState.capturedFixtureIds,
    settledFixtureIds: input.archiveState.settledFixtureIds,
  };
  const completionInstantOf =
    input.deps?.deriveCompletionInstant ??
    ((row: FootyMatchRow) =>
      defaultCompletionInstant(row, input.evaluationInstant));

  // 1. Classify each completed row.
  const eligibleRaw: EligibleSettlement[] = [];
  for (const row of input.completedRows) {
    const decision = classifySettlementRow(row, ctx);
    if (decision.status === "reject") {
      if (decision.reason === "malformed_archive_record") {
        diag.sourceRowsMalformed++;
      }
      bumpReason(rejected, decision.reason);
      continue;
    }
    eligibleRaw.push({
      fixtureId: decision.fixtureId,
      row,
      completionInstant: completionInstantOf(row),
    });
  }

  // 2. Deterministic dedup by fixtureId (settlement candidates are per-fixture).
  const sortedForDedup = sortDeterministic(eligibleRaw, compareForDedup);
  const seen = new Set<number>();
  const deduped: EligibleSettlement[] = [];
  for (const e of sortedForDedup) {
    if (seen.has(e.fixtureId)) {
      bumpReason(rejected, "duplicate_candidate");
      continue;
    }
    seen.add(e.fixtureId);
    deduped.push(e);
  }
  diag.candidatesEligible = deduped.length;

  // 3. Deterministic ordering + bounded selection.
  const ordered = sortDeterministic(deduped, compareSettlementCandidates);
  const ceiling = normalizeBatchLimit(input.config?.maxCandidates);
  diag.effectiveCeiling = ceiling; // INV-C: `[1,150]`, default 100, never the 500 legacy default
  const selected = ordered.slice(0, ceiling);
  const deferred = ordered.slice(ceiling);

  diag.candidatesSelected = selected.length;
  diag.candidatesDeferredByCap = deferred.length;
  diag.backlogSize = deferred.length;
  diag.oldestPendingAgeMs = oldestAge(
    deferred.map((c) => c.completionInstant),
    evalMs
  );

  const recordedBy = input.config?.recordedBy;
  const candidates: SettlementCandidate[] = selected.map((e) => {
    const candidate: SettlementCandidate = {
      fixtureId: e.fixtureId,
      row: e.row,
      completionInstant: e.completionInstant,
      nowSec,
    };
    if (recordedBy !== undefined) candidate.recordedBy = recordedBy;
    return candidate;
  });

  diag.emittedCandidates = candidates.length;
  return { candidates, diagnostics: diag };
}

function oldestAge(anchors: readonly string[], evalMs: number): number | null {
  let oldest: number | null = null;
  for (const iso of anchors) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) continue;
    const age = evalMs - ms;
    if (oldest === null || age > oldest) oldest = age;
  }
  return oldest;
}
