/**
 * M10 Stage 2E — Slice 2 (route-entry timing + measurement layer) test suite.
 *
 * Covers the 15 required points: route-entry captured before discovery; the same immutable
 * anchor reaches the deadline; source + discovery are charged inside the deadline; the deadline
 * is NOT reset after discovery; phases are non-overlapping / non-negative; skipped phases are
 * explicit; percentiles come from RAW samples; importing a benchmark module executes nothing;
 * the CLI/runner is required to execute; isolation guards run BEFORE any cell; artifacts land only
 * under the output dir; prod paths/URLs are refused; fixtures are synthetic temp-only; the runtime
 * is unchanged when the deadline-anchor path is not supplied. Injected fake clocks — NO wall clock,
 * NO sleeps, NO network, NO production archive mutation.
 */

process.env.JOB_LOCK_ADAPTER = "memory";

import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";

import {
  runPredictionSettlementJob,
  resetJobLog,
} from "../lib/jobs/runner";
import { resetMemoryJobLocks } from "../lib/jobs/locks";
import type { SettlementCandidate } from "../lib/evidence-capture/jobs/settlement-run";

import {
  makeSnapshots,
  makeCompletedRows,
  memoryEvidenceStore,
  makeIsolatedTempDir,
  removeTempDir,
} from "../scripts/bench/m10/fixtures";
import {
  routeEntryPhaseSplitCell,
  deadlineGapCell,
} from "../scripts/bench/m10/cells";
import { runCells, parseArgs, registeredCells } from "../scripts/bench/m10/cli";
import { BenchIsolationError, assertIsolatedDir } from "../scripts/bench/m10/guards";
import { percentile, computeStats } from "../scripts/bench/m10/statistics";
import { summedRanMs } from "../scripts/bench/m10/phases";
import { BenchLogger } from "../scripts/bench/m10/logger";
import { resolveBenchConfig } from "../scripts/bench/m10/config";
import type { MeasureContext } from "../scripts/bench/m10/measure";

const EVAL = "2026-08-02T09:00:00.000Z";
const EFFECTIVE = 45_000; // resolveEffectiveJobDeadlineMs(300000, {headroom 15000})
const ANCHOR = 1_000;

function candidatesFrom(n: number): SettlementCandidate[] {
  const nowSec = Math.floor(Date.parse(EVAL) / 1000);
  return makeCompletedRows(n).map((row) => ({
    fixtureId: row.matchId,
    row,
    completionInstant: EVAL,
    nowSec,
  }));
}

function enabledEnv(): NodeJS.ProcessEnv {
  return { ...process.env, EVIDENCE_SETTLEMENT_ENABLED: "true", JOB_LOCK_ADAPTER: "memory" };
}

/** The array-only producer path reports `deferredByDeadline`; the batch path `deferred_by_deadline`. */
function deferred(counts: Record<string, number> | undefined): number {
  return counts?.deferredByDeadline ?? counts?.deferred_by_deadline ?? 0;
}

/** A fake clock that jumps past the effective deadline DURING discovery (provideCandidates). */
async function settle(opts: { withAnchor: boolean }): Promise<Record<string, number> | undefined> {
  const snaps = makeSnapshots(5);
  const store = await memoryEvidenceStore(snaps);
  const candidates = candidatesFrom(5);
  let t = ANCHOR;
  const now = () => t;
  resetMemoryJobLocks();
  resetJobLog();
  const rec = await runPredictionSettlementJob({
    env: enabledEnv(),
    deps: { evidenceStore: store },
    provideCandidates: async () => {
      t = ANCHOR + EFFECTIVE + 5_000; // discovery consumed past the budget
      return candidates;
    },
    now,
    ...(opts.withAnchor ? { deadlineAnchorMs: ANCHOR } : {}),
  });
  return rec.resultCounts;
}

function measureCtx(): MeasureContext {
  return { config: resolveBenchConfig({}), logger: new BenchLogger({}), seed: 0 };
}

// ---------------------------------------------------------------------------------------------
// (2)(3) The same immutable anchor reaches the deadline; source+discovery are charged inside it.
// ---------------------------------------------------------------------------------------------
test("route-entry anchor charges source+discovery to the deadline → batch defers", async () => {
  const counts = await settle({ withAnchor: true });
  assert.ok(counts, "resultCounts present");
  assert.ok(deferred(counts) > 0, "all candidates deferred by the anchored deadline");
  assert.equal(counts!.settled ?? 0, 0, "nothing settled once the budget is already exhausted");
});

// ---------------------------------------------------------------------------------------------
// (4)(14) Deadline NOT reset after discovery; runtime UNCHANGED when no anchor is supplied.
// ---------------------------------------------------------------------------------------------
test("without a route-entry anchor the deadline anchors post-discovery (pre-Slice-2 behaviour)", async () => {
  const counts = await settle({ withAnchor: false });
  assert.ok(counts, "resultCounts present");
  assert.equal(deferred(counts), 0, "no deferral — discovery time escaped the budget");
  assert.ok((counts!.settled ?? 0) > 0, "candidates processed exactly as before the additive param");
});

test("the deadline-anchor param is dormant: a disabled settlement job still skips", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const rec = await runPredictionSettlementJob({
    env: { ...process.env, EVIDENCE_SETTLEMENT_ENABLED: "false" },
    deadlineAnchorMs: ANCHOR,
  });
  assert.equal(rec.status, "skipped");
});

// ---------------------------------------------------------------------------------------------
// (1)(5)(6) Route entry before discovery; phases non-overlapping/non-negative; skips explicit.
// ---------------------------------------------------------------------------------------------
test("phase split records route-entry before discovery, non-overlapping, with explicit skips", async () => {
  const ctx = measureCtx();
  const state = await routeEntryPhaseSplitCell.setup!(ctx);
  const sample = await routeEntryPhaseSplitCell.measureOnce(ctx, state, "warm", 0);
  const records = sample.phaseRecords ?? [];
  const order = records.map((r) => r.name);

  // (1) route entry is recorded first and strictly before discovery.
  assert.equal(order[0], "route_entry_to_runner");
  assert.ok(order.indexOf("source_load") < order.indexOf("discovery"), "source loads before discovery");
  assert.ok(order.indexOf("route_entry_to_runner") < order.indexOf("discovery"), "route entry before discovery");

  // (5) every phase duration is finite + non-negative; ran phases never overlap the total.
  for (const r of records) {
    assert.ok(Number.isFinite(r.durationMs) && r.durationMs >= 0, `phase ${r.name} finite/non-negative`);
  }
  assert.ok(summedRanMs(records) <= sample.durationMs + 1e-6, "ran phases sum within the route-entry total (no overlap)");

  // (6) skipped phases are explicit with a reason — never fabricated as zero-duration success.
  const skips = records.filter((r) => r.status === "skipped");
  assert.ok(skips.length > 0, "at least one phase is explicitly skipped");
  for (const s of skips) {
    assert.equal(s.durationMs, 0);
    assert.ok(s.skipReason && s.skipReason.length > 0, "skip carries a reason");
  }
});

// ---------------------------------------------------------------------------------------------
// (7) Percentiles come from RAW samples, not a runtime metrics aggregate.
// ---------------------------------------------------------------------------------------------
test("cell percentiles are computed from the raw sample durations", async () => {
  const outputDir = path.join(await makeIsolatedTempDir(), "artifacts");
  try {
    const [res] = await runCells({ cellIds: ["deadline_gap"], outputDir, warmup: 1, warmSamples: 6 });
    const artifact = JSON.parse(await fs.readFile(res.artifacts.json, "utf8"));
    const rawDurations: number[] = artifact.result.samples.map((s: { durationMs: number }) => s.durationMs);
    assert.equal(rawDurations.length, artifact.result.stats.total.n, "stats.n equals raw sample count");
    const sorted = [...rawDurations].sort((a, b) => a - b);
    const expectedP95 = percentile(sorted, 0.95);
    // The artifact's p95 must equal the p95 recomputed from the raw samples (finding M-G).
    assert.ok(Math.abs(artifact.result.stats.total.p95 - expectedP95) < 1e-9, "p95 derived from raw samples");
    const expected = computeStats(rawDurations);
    assert.ok(Math.abs(artifact.result.stats.total.median - expected.median) < 1e-9, "median from raw samples");
  } finally {
    await removeTempDir(path.dirname(outputDir));
  }
});

// ---------------------------------------------------------------------------------------------
// (8)(9) Importing a benchmark module executes NOTHING; the CLI is required to execute.
// ---------------------------------------------------------------------------------------------
test("importing the benchmark CLI executes nothing (no run, no artifacts)", () => {
  const cliPath = path.resolve(process.cwd(), "scripts/bench/m10/cli.ts");
  const out = execFileSync(
    "node",
    [
      "--require",
      "./scripts/mock-server-only.cjs",
      "--import",
      "tsx",
      "-e",
      `import(${JSON.stringify(cliPath)}).then(() => console.log("IMPORTED_OK")).catch((e) => { console.error(e); process.exit(2); })`,
    ],
    { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" }, encoding: "utf8" }
  );
  assert.match(out, /IMPORTED_OK/, "module imported cleanly");
  assert.doesNotMatch(out, /measurement complete/, "importing did NOT run the CLI");
  assert.doesNotMatch(out, /warm samples/, "importing ran no cell");
});

test("the registry is populated by import but nothing runs until runCells is called", async () => {
  assert.equal(registeredCells().length, 3, "3 cells registered");
  const parsed = parseArgs(["run", "deadline_gap", "--smoke", "--seed", "7"]);
  assert.equal(parsed.command, "run");
  assert.deepEqual(parsed.cellIds, ["deadline_gap"]);
  assert.equal(parsed.smoke, true);
  assert.equal(parsed.seed, 7);

  const outputDir = path.join(await makeIsolatedTempDir(), "artifacts");
  try {
    // Before running: the output dir holds no artifact families.
    await assert.rejects(fs.readdir(path.join(outputDir, "json")));
    const results = await runCells({ cellIds: ["deadline_gap"], outputDir, warmup: 1, warmSamples: 5 });
    // After running: artifacts exist — execution required the explicit call.
    const jsons = await fs.readdir(path.join(outputDir, "json"));
    assert.ok(jsons.length >= 1, "runCells produced artifacts");
    assert.equal(results.length, 1);
  } finally {
    await removeTempDir(path.dirname(outputDir));
  }
});

// ---------------------------------------------------------------------------------------------
// (10)(12) Isolation guards run BEFORE any cell; prod paths/URLs are refused.
// ---------------------------------------------------------------------------------------------
test("a live pipeline flag is refused before any cell runs (no artifacts written)", async () => {
  const outputDir = path.join(await makeIsolatedTempDir(), "artifacts");
  try {
    await assert.rejects(
      runCells({
        cellIds: ["deadline_gap"],
        outputDir,
        env: { ...process.env, EVIDENCE_SETTLEMENT_ENABLED: "true" },
      }),
      (e: unknown) => e instanceof BenchIsolationError
    );
    // The guard runs first: the output dir was never created/populated.
    await assert.rejects(fs.readdir(path.join(outputDir, "json")));
  } finally {
    await removeTempDir(path.dirname(outputDir));
  }
});

test("a production-looking evidence DB URL is refused before any cell runs", async () => {
  const outputDir = path.join(await makeIsolatedTempDir(), "artifacts");
  try {
    await assert.rejects(
      runCells({
        cellIds: ["deadline_gap"],
        outputDir,
        env: { ...process.env, EVIDENCE_DATABASE_URL: "postgres://u:p@db.prod.example.com:5432/evidence" },
      }),
      (e: unknown) => e instanceof BenchIsolationError
    );
  } finally {
    await removeTempDir(path.dirname(outputDir));
  }
});

test("assertIsolatedDir refuses the production evidence archive dir", () => {
  assert.throws(() => assertIsolatedDir("/opt/rankwagers/shared/evidence-archive"), BenchIsolationError);
  assert.throws(() => assertIsolatedDir(path.join(process.cwd(), "data")), BenchIsolationError);
});

// ---------------------------------------------------------------------------------------------
// (11) Artifacts land ONLY under the output dir.
// ---------------------------------------------------------------------------------------------
test("every written artifact path is under the benchmark output dir", async () => {
  const outputDir = path.join(await makeIsolatedTempDir(), "artifacts");
  try {
    const results = await runCells({ outputDir, warmup: 1, warmSamples: 5 });
    assert.equal(results.length, 3, "all three cells ran");
    for (const r of results) {
      for (const p of Object.values(r.artifacts)) {
        assert.ok(path.resolve(p).startsWith(path.resolve(outputDir) + path.sep), `${p} under output dir`);
      }
    }
  } finally {
    await removeTempDir(path.dirname(outputDir));
  }
});

// ---------------------------------------------------------------------------------------------
// (13) Fixtures are synthetic + temp-only, built via the real frozen builders.
// ---------------------------------------------------------------------------------------------
test("fixtures are synthetic, contract-valid, and temp-isolated", async () => {
  const snaps = makeSnapshots(4);
  assert.equal(snaps.length, 4);
  for (const s of snaps) {
    assert.ok(s.id && typeof s.id === "string", "snapshot has a contract id");
    assert.ok(s.fixtureId >= 700000, "synthetic fixture id range");
    assert.ok(s.contentHash && s.contentHash.length > 0, "hashed by the real builder");
  }
  const rows = makeCompletedRows(4);
  assert.ok(rows.every((r) => r.isFinished && r.homeScore === 2 && r.awayScore === 1), "finished synthetic rows");

  const dir = await makeIsolatedTempDir();
  try {
    assert.ok(dir.startsWith(os.tmpdir()), "temp dir under the OS temp root");
    assertIsolatedDir(dir); // must not throw
  } finally {
    await removeTempDir(dir);
  }
});

// ---------------------------------------------------------------------------------------------
// End-to-end: the deadline-gap cell proves F-C both charged (anchor) and reproduced (no anchor).
// ---------------------------------------------------------------------------------------------
test("deadline-gap cell yields a deferred outcome under the route-entry anchor", async () => {
  const ctx = measureCtx();
  const state = await deadlineGapCell.setup!(ctx);
  const sample = await deadlineGapCell.measureOnce(ctx, state, "warm", 0);
  assert.equal(sample.deadlineOutcome, "deferred", "anchor charged the overrun → deferred");
  assert.equal(sample.success, true, "with-anchor deferred AND without-anchor proceeded");
});
