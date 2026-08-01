/**
 * M10 Stage 2D — Completed-fixture-row loader (J/K) — DORMANT, injected.
 *
 * Fills the Stage-2C BQ-1 seam: the settlement producer's `loadCompletedRows(date)` had no
 * concrete implementation. This module provides (a) a PURE, deterministic terminal-row filter
 * with per-row fault isolation, and (b) a loader FACTORY over an injected whole-source reader.
 *
 * It is NOT wired into any cron route and enables no flag — route composition is a Stage-2E
 * activation task. The concrete production reader (`readRows` over the daily archive) is an
 * ACTIVATION DEPENDENCY documented here and deliberately NOT fabricated: the factory accepts
 * the reader by injection so tests (and a future activation caller) supply it.
 *
 * RC-2 (cancellation): the loader is READ-ONLY and its whole-source read runs at the
 * orchestration boundary BEFORE the batch, so it is bounded by the pre-batch remaining-time
 * check; there is no evidence/validation append here to interrupt. A hung reader is a
 * documented Stage-2E residual (bounded only by the 60 s platform kill), safe because
 * read-only. No `AbortSignal` framework is introduced.
 *
 * Determinism: pure over `(rows, nowSec)` — no `Date.now`, no random. `nowSec` is the run's
 * injected deterministic evaluation seconds (same value M8 uses via `resolveMatchLifecycle`).
 */

import type { FootyMatchRow } from "@/lib/footystats/types";
import { resolveMatchLifecycle } from "@/lib/fixtures/status";
import { isValidFixtureId } from "@/lib/evidence-capture/identity";
import { hasValidCompletedScores } from "./eligibility";
import { ProducerError } from "./operational";

/** Bounded, low-cardinality per-row drop reasons (never a fixture id). */
export const COMPLETED_ROW_DROP_REASONS = [
  "malformed_row",
  "invalid_fixture_id",
  "invalid_kickoff",
  "invalid_final_score",
  "unresolved_lifecycle",
  "duplicate_row",
] as const;
export type CompletedRowDropReason = (typeof COMPLETED_ROW_DROP_REASONS)[number];

export type CompletedRowFilterResult = {
  /** Terminal, valid, de-duplicated rows in a stable (matchId asc) order. */
  rows: FootyMatchRow[];
  /** Per-row faults dropped (bounded reasons, seeded to 0). */
  dropped: Record<CompletedRowDropReason, number>;
  /** Rows excluded as not-yet-terminal (NOT a fault; re-checked next fire). */
  excludedNonTerminal: number;
};

function seededDrops(): Record<CompletedRowDropReason, number> {
  const out = {} as Record<CompletedRowDropReason, number>;
  for (const r of COMPLETED_ROW_DROP_REASONS) out[r] = 0;
  return out;
}

/**
 * PURE terminal-row filter with per-row isolation. A single bad row is dropped + counted and
 * NEVER throws — only a whole-source failure (in the loader) fails the run. Terminal set
 * mirrors the settlement classifier: `finished` (valid FT/HT scores required) plus the
 * lifecycle terminals `postponed | cancelled | abandoned` (no score requirement). Deterministic
 * order (matchId asc); a duplicate matchId keeps the first occurrence and counts the rest.
 */
export function filterCompletedRows(
  rows: readonly FootyMatchRow[],
  ctx: { nowSec: number }
): CompletedRowFilterResult {
  const dropped = seededDrops();
  let excludedNonTerminal = 0;
  const seen = new Set<number>();
  const kept: FootyMatchRow[] = [];

  for (const row of rows) {
    if (row === null || typeof row !== "object") {
      dropped.malformed_row++;
      continue;
    }
    if (!isValidFixtureId(row.matchId)) {
      dropped.invalid_fixture_id++;
      continue;
    }
    if (typeof row.kickoff !== "string" || Number.isNaN(Date.parse(row.kickoff))) {
      dropped.invalid_kickoff++; // completionInstant defaults to kickoff → must be valid
      continue;
    }
    const lifecycle = resolveMatchLifecycle({
      status: row.status,
      kickoffUnix: row.kickoffTime ?? null,
      minute: row.minute ?? null,
      nowSec: ctx.nowSec,
    });
    switch (lifecycle) {
      case "finished":
        if (row.isLive === true || row.isFinished !== true || !hasValidCompletedScores(row)) {
          dropped.invalid_final_score++;
          continue;
        }
        break;
      case "postponed":
      case "cancelled":
      case "abandoned":
        break; // terminal non-scored — no score requirement
      case "live":
      case "half_time":
      case "scheduled":
      case "pre_match":
      case "suspended":
        excludedNonTerminal++;
        continue;
      case "unavailable":
      default:
        dropped.unresolved_lifecycle++;
        continue;
    }
    if (seen.has(row.matchId)) {
      dropped.duplicate_row++;
      continue;
    }
    seen.add(row.matchId);
    kept.push(row);
  }

  kept.sort((a, b) => a.matchId - b.matchId);
  return { rows: kept, dropped, excludedNonTerminal };
}

export type CompletedRowLoaderDeps = {
  /**
   * Injected whole-source reader (ACTIVATION DEPENDENCY — not fabricated here). Returns the
   * candidate rows for the date, or `null`/throws when the source is unavailable/unreadable.
   * A production adapter would read the daily archive; it is supplied by a Stage-2E activation
   * caller, never wired into a route by this stage.
   */
  readRows: (date: string) => Promise<readonly FootyMatchRow[] | null>;
  /** Deterministic evaluation seconds for lifecycle resolution (injected; never a clock). */
  nowSec: number;
  /** Optional bounded per-run drop diagnostics sink (never fixture ids). */
  onFilter?: (result: CompletedRowFilterResult) => void;
};

/**
 * Build a `loadCompletedRows(date)` seam over the injected reader. WHOLE-SOURCE failure is
 * FAIL-CLOSED: a reader throw or a `null` result raises `ProducerError("source_load_failed")`
 * — NEVER a silent empty-success `[]`. Per-row faults are isolated (dropped + counted) by
 * `filterCompletedRows`. Read-only; deterministic; no clock.
 */
export function createCompletedRowLoader(
  deps: CompletedRowLoaderDeps
): (date: string) => Promise<FootyMatchRow[]> {
  return async (date: string) => {
    let raw: readonly FootyMatchRow[] | null;
    try {
      raw = await deps.readRows(date);
    } catch (error) {
      throw new ProducerError(
        "source_load_failed",
        `completed-rows source unreadable for ${date}`,
        { cause: error }
      );
    }
    if (raw === null || raw === undefined) {
      throw new ProducerError(
        "source_load_failed",
        `completed-rows source unavailable for ${date}`
      );
    }
    const result = filterCompletedRows(raw, { nowSec: deps.nowSec });
    deps.onFilter?.(result);
    return result.rows;
  };
}
