/**
 * M10 Benchmark Framework — Slice 2 cells (route-entry timing evidence).
 *
 * Three cells, settlement path only (the near-term activatable path; capture full-write is a
 * later stage). All measurement is synthetic + in-process:
 *   - route_entry_phase_split : per-phase split anchored at route entry.
 *   - runner_entry_comparison : route-entry total vs runner-entry total (the F-C gap magnitude).
 *   - deadline_gap            : exercises the runner's deadline-anchor param end-to-end, proving
 *                               source+discovery are charged when a route-entry anchor is supplied
 *                               and escape it when it is not.
 *
 * No strict-reader, write-to-disk, canary, lock-contention, full-write, or production-depth cell
 * is added here. Importing this module runs nothing.
 */

import { buildSettlementArchiveState, buildSettlementCandidates } from "../../../lib/evidence-capture/candidates";
import { runPredictionSettlementJob, resetJobLog } from "../../../lib/jobs/runner";
import { resetMemoryJobLocks } from "../../../lib/jobs/locks";
import { resolveEffectiveJobDeadlineMs } from "../../../lib/evidence-capture/candidates/operational";
import {
  makeSnapshots,
  makeValidations,
  makeCompletedRows,
  memorySettlementPort,
  memoryEvidenceStore,
} from "./fixtures";
import { PhaseRecorder, summedRanMs } from "./phases";
import { routeEntryAnchorMs, toSample, eraseCell, type MeasurableCell, type ErasedCell } from "./measure";
import { nowMs } from "./timing";
import type { EvidenceSnapshot, ValidationRecord } from "../../../types/evidence";
import type { FootyMatchRow } from "../../../lib/footystats/types";
import type { SettlementArchiveReadPort } from "../../../lib/evidence-capture/candidates";
import type { Sample } from "./types";

const EVAL = "2026-08-02T09:00:00.000Z";
const DEFAULT_VOLUME = 20; // small smoke volume — no p99 claims (Slice 2 validates instrumentation)

function volume(env: NodeJS.ProcessEnv): number {
  const v = Number(env.M10_BENCH_VOLUME?.trim());
  return Number.isInteger(v) && v > 0 ? v : DEFAULT_VOLUME;
}

type SettlementState = {
  snapshots: EvidenceSnapshot[];
  validations: ValidationRecord[];
  rows: FootyMatchRow[];
  port: SettlementArchiveReadPort;
};

function buildState(n: number): SettlementState {
  const snapshots = makeSnapshots(n);
  const validations = makeValidations(snapshots, 0); // none settled → all eligible
  const rows = makeCompletedRows(n);
  return { snapshots, validations, rows, port: memorySettlementPort(snapshots, validations) };
}

/** Cell 1 — route-entry-anchored per-phase split of settlement discovery. */
export const routeEntryPhaseSplitCell: MeasurableCell<SettlementState> = {
  id: "settlement.route_entry_phase_split",
  describe: "Settlement discovery per-phase split, anchored at route entry (F-C observable).",
  coords: { mode: "measure", concurrency: "isolated", source: "synthetic" },
  setup: () => buildState(volume(process.env)),
  measureOnce: async (_ctx, state, kind, index) => {
    const routeEntryMs = routeEntryAnchorMs();
    const recorder = new PhaseRecorder();
    const runnerStartMs = nowMs();
    recorder.ranSync("route_entry_to_runner", runnerStartMs - routeEntryMs);
    const rows = await recorder.ran("source_load", async () => state.rows);
    const archiveState = await recorder.ran("archive_load", () => buildSettlementArchiveState(state.port));
    const result = await recorder.ran("discovery", () =>
      buildSettlementCandidates({ completedRows: rows, evaluationInstant: EVAL, archiveState })
    );
    recorder.skip("candidate_prepare", "settlement folds preparation into discovery");
    recorder.skip("settlement", "phase-split cell performs no write");
    recorder.skip("capture", "settlement cell");
    recorder.skip("writer", "phase-split cell performs no write");
    recorder.skip("cleanup", "state reused across samples; teardown at cell end");
    return toSample(
      { routeEntryMs, recorder, success: result.candidates.length > 0, deadlineOutcome: "n/a" },
      kind,
      index,
      0
    );
  },
};

/** Cell 2 — route-entry total vs runner-entry total: the F-C escaped-budget magnitude. */
export const runnerEntryComparisonCell: MeasurableCell<SettlementState> = {
  id: "settlement.runner_entry_comparison",
  describe:
    "Route-entry total vs runner-entry total for settlement; the delta is the source+discovery budget that escapes runner-entry anchoring (F-C).",
  coords: { mode: "measure", concurrency: "isolated", source: "synthetic" },
  setup: () => buildState(volume(process.env)),
  measureOnce: async (_ctx, state, kind, index) => {
    const routeEntryMs = routeEntryAnchorMs();
    const recorder = new PhaseRecorder();
    // Phases up to (but excluding) the batch are what runner-entry anchoring fails to charge.
    const rows = await recorder.ran("source_load", async () => state.rows);
    const archiveState = await recorder.ran("archive_load", () => buildSettlementArchiveState(state.port));
    await recorder.ran("discovery", () =>
      buildSettlementCandidates({ completedRows: rows, evaluationInstant: EVAL, archiveState })
    );
    const gapMs = summedRanMs(recorder.finish()); // source+archive+discovery = escaped-budget magnitude
    // runner-entry total anchors AFTER discovery → excludes the gap; route-entry total includes it.
    const runnerEntryTotalMs = nowMs() - (routeEntryMs + gapMs);
    recorder.ranSync("deadline_gap", gapMs);
    recorder.ranSync("total_from_runner_entry", Math.max(0, runnerEntryTotalMs));
    recorder.skip("cleanup", "state reused across samples");
    return toSample(
      { routeEntryMs, recorder, success: true, deadlineOutcome: "n/a" },
      kind,
      index,
      0
    );
  },
  notes: (samples) => {
    const gaps = samples.map((s) => (s.phasesMs?.deadline_gap ?? 0));
    const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    return [
      `mean escaped budget (source+archive+discovery) under runner-entry anchoring ≈ ${round(mean)} ms`,
      "route-entry anchoring (F-C fix) charges this to the effective deadline; runner-entry anchoring does not",
    ];
  },
};

/** Cell 3 — end-to-end proof that the runner's deadlineAnchorMs charges source+discovery. */
export const deadlineGapCell: MeasurableCell<SettlementState> = {
  id: "settlement.deadline_gap",
  describe:
    "Runner deadline-anchor evidence: with a route-entry anchor a discovery that consumes the budget defers the batch (F-C charged); without it the batch proceeds (F-C gap).",
  coords: { mode: "measure", concurrency: "isolated", source: "synthetic" },
  setup: () => buildState(volume(process.env)),
  measureOnce: async (_ctx, state, kind, index) => {
    const routeEntryMs = routeEntryAnchorMs();
    const recorder = new PhaseRecorder();

    // Deterministic fake clock: discovery "consumes" a large slice of the effective deadline.
    const effective = resolveEffectiveJobDeadlineMs(300_000, { headroomMs: 15_000 }); // = 45_000
    const anchor = 1_000;
    let t = anchor;
    const now = () => t;
    const store = await memoryEvidenceStore(state.snapshots);
    // Flag lives ONLY on this injected job env, never on process.env (the isolation guard checks
    // process.env). JOB_LOCK_ADAPTER=memory keeps the durable lock in-process (no real Pool).
    const enabled: NodeJS.ProcessEnv = {
      ...process.env,
      EVIDENCE_SETTLEMENT_ENABLED: "true",
      JOB_LOCK_ADAPTER: "memory",
    };
    const batch = {
      candidates: state.rows.map((row) => ({
        fixtureId: row.matchId,
        row,
        completionInstant: EVAL,
        nowSec: Math.floor(Date.parse(EVAL) / 1000),
      })),
      diagnostics: await buildDiag(state),
    };
    const provideCandidateBatch = async () => {
      t = anchor + effective + 5_000; // discovery consumed past the effective deadline
      return batch;
    };

    resetMemoryJobLocks();
    resetJobLog();
    const withAnchor = await recorder.ran("settlement", () =>
      runPredictionSettlementJob({ env: enabled, deps: { evidenceStore: store }, provideCandidateBatch, now, deadlineAnchorMs: anchor })
    );

    // Without the anchor: same elapsed, but the deadline anchors post-discovery → budget restored.
    t = anchor;
    resetMemoryJobLocks();
    resetJobLog();
    const store2 = await memoryEvidenceStore(state.snapshots);
    const withoutAnchor = await recorder.ran("writer", () =>
      runPredictionSettlementJob({ env: enabled, deps: { evidenceStore: store2 }, provideCandidateBatch: async () => { t = anchor + effective + 5_000; return batch; }, now })
    );

    const deferredWith = deferredCount(withAnchor.resultCounts);
    const deferredWithout = deferredCount(withoutAnchor.resultCounts);
    recorder.skip("cleanup", "memory stores discarded");
    return toSample(
      {
        routeEntryMs,
        recorder,
        success: deferredWith > 0 && deferredWithout === 0,
        deadlineOutcome: deferredWith > 0 ? "deferred" : "ok",
      },
      kind,
      index,
      0
    );
  },
  notes: (samples) => {
    const ok = samples.filter((s) => s.success).length;
    return [
      `route-entry anchor DEFERRED the batch when discovery overran the budget in ${ok}/${samples.length} warm samples (F-C charged)`,
      "without the anchor the same discovery escaped the budget and the batch proceeded (F-C gap reproduced)",
    ];
  },
};

async function buildDiag(state: SettlementState) {
  // Real archive-derived diagnostics for the batch seam (all eligible).
  const archiveState = await buildSettlementArchiveState(state.port);
  const r = buildSettlementCandidates({ completedRows: state.rows, evaluationInstant: EVAL, archiveState });
  return r.diagnostics;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** The batch producer path reports `deferred_by_deadline`; the array path `deferredByDeadline`. */
function deferredCount(counts: Record<string, number> | undefined): number {
  return counts?.deferred_by_deadline ?? counts?.deferredByDeadline ?? 0;
}

/** All Slice-2 cells registered by the CLI (state-type erased for a heterogeneous registry). */
export const SLICE2_CELLS: ErasedCell[] = [
  eraseCell(routeEntryPhaseSplitCell),
  eraseCell(runnerEntryComparisonCell),
  eraseCell(deadlineGapCell),
];

export type { Sample };
