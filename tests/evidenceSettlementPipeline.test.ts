/**
 * M10 Stage 2C — Settlement pipeline wiring tests (test-first).
 *
 * Proves the wired path Strict Settlement Archive State → Stage 1 Settlement Provider →
 * SettlementCandidate[] → M8 Settlement Batch Runner, plus the concrete strict read port,
 * the runner seam + lock boundary, and the FIRST-SETTLEMENT-ONLY firewall (no correction
 * discovery, no correctionCause, no currentValidationHeads consumption).
 *
 * Deterministic: memory lock backend, injected evaluation instant, no wall clock.
 */

// Memory lock backend (mirrors tests/m9Activation.test.ts) so the durable settlement lock
// is deterministic in test and lock-contention is reproducible.
process.env.JOB_LOCK_ADAPTER = "memory";

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createMemoryEvidenceArchive } from "../lib/archive/evidence/memory";
import { createEvidenceSnapshot } from "../lib/evidence/snapshot";
import { runPredictionSettlementJob, resetJobLog } from "../lib/jobs/runner";
import { resetMemoryJobLocks, tryAcquireJobLock } from "../lib/jobs/locks";
import { settleLatestSnapshotForFixture } from "../lib/evidence-capture/settlement";
import {
  buildSettlementArchiveState,
  ArchiveStateConflictError,
} from "../lib/evidence-capture/candidates";
import type { SettlementArchiveReadPort } from "../lib/evidence-capture/candidates";
import {
  produceSettlementRequests,
  createFileSettlementReadPort,
} from "../lib/evidence-capture/candidates/settlement-pipeline";
import type { SettlementCandidate } from "../lib/evidence-capture/jobs/settlement-run";
import type {
  EvidenceSnapshot,
  SupportedMarket,
  ValidationRecord,
} from "../types/evidence";
import type { FootyMatchRow } from "../lib/footystats/types";

/* ------------------------------ fixtures ------------------------------ */

const FIX = 90231;
const INSTANT = "2026-08-01T20:00:00.000Z"; // completion instant (seed settlements)
const EVAL = "2026-08-02T09:00:00.000Z"; // injected run evaluation instant

const sm = (marketKey: string, selectionKey = "over"): SupportedMarket => ({
  marketKey,
  marketLabel: marketKey,
  selectionKey,
  selectionLabel: selectionKey,
  modelProbability: null,
  qualification: "qualified",
});

const mkSnapshot = (
  over: Partial<{ fixtureId: number; capturedAt: string; sequence: number }> = {},
  markets: SupportedMarket[] = [sm("over25")]
): EvidenceSnapshot => {
  const r = createEvidenceSnapshot({
    fixtureId: over.fixtureId ?? FIX,
    capturedAt: over.capturedAt ?? "2026-08-01T10:00:00.000Z",
    evidenceScore: 50,
    qualification: "qualified",
    supportedMarkets: markets,
    signals: [],
    capturedBy: "evidence_capture",
    sequence: over.sequence ?? 1,
    previousSnapshotId: null,
  });
  if (!r.ok) throw new Error("fixture snapshot build failed: " + JSON.stringify(r.errors));
  return r.snapshot;
};

const mkRow = (over: Partial<FootyMatchRow> = {}): FootyMatchRow => ({
  matchId: FIX,
  homeTeam: "H",
  awayTeam: "A",
  competition: "L",
  country: "C",
  flag: "",
  kickoffTime: 1_754_000_000,
  kickoff: "2026-08-01T18:00:00.000Z",
  over15Pct: 0,
  fhOver05Pct: 0,
  over25Pct: 0,
  shOver05Pct: 0,
  status: "finished",
  isLive: false,
  isFinished: true,
  homeScore: 2,
  awayScore: 1,
  htHome: 1,
  htAway: 0,
  minute: 90,
  highlightPct: 0,
  ...over,
});

/** A counting fake port over in-memory record arrays. */
function fakePort(
  snapshots: readonly EvidenceSnapshot[],
  validations: readonly ValidationRecord[],
  throwOn?: "snapshots" | "validations"
): SettlementArchiveReadPort & { calls: { snap: number; val: number } } {
  const calls = { snap: 0, val: 0 };
  return {
    calls,
    readAllSnapshots: async () => {
      calls.snap += 1;
      if (throwOn === "snapshots") throw new Error("evidence archive: I/O failure (EIO)");
      return snapshots;
    },
    readAllValidations: async () => {
      calls.val += 1;
      if (throwOn === "validations")
        throw new Error("evidence archive: malformed NDJSON at line 3");
      return validations;
    },
  };
}

const enabledSettle = {
  EVIDENCE_SETTLEMENT_ENABLED: "true",
  JOB_LOCK_ADAPTER: "memory",
} as NodeJS.ProcessEnv;

/* ===================== A. Concrete read port (item 1) ===================== */

function tmpArchive(): { env: NodeJS.ProcessEnv; dir: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m10-2c-"));
  return { env: { ...process.env, EVIDENCE_ARCHIVE_DIR: dir } as NodeJS.ProcessEnv, dir };
}

test("port: missing snapshot + validation files → [] each (ENOENT-only empty)", async () => {
  const { env, dir } = tmpArchive();
  try {
    const port = createFileSettlementReadPort(env);
    assert.deepEqual(await port.readAllSnapshots(), []);
    assert.deepEqual(await port.readAllValidations(), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("port: malformed snapshot archive → throw", async () => {
  const { env, dir } = tmpArchive();
  try {
    writeFileSync(path.join(dir, "snapshots.ndjson"), "not json{\n");
    await assert.rejects(createFileSettlementReadPort(env).readAllSnapshots(), /malformed NDJSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("port: malformed validation archive → throw", async () => {
  const { env, dir } = tmpArchive();
  try {
    writeFileSync(path.join(dir, "validations.ndjson"), "{oops\n");
    await assert.rejects(createFileSettlementReadPort(env).readAllValidations(), /malformed NDJSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("port: snapshot immutable conflict (same id, diff hash) → buildSettlementArchiveState throws", async () => {
  const { env, dir } = tmpArchive();
  try {
    const a = JSON.stringify({ id: "snap_x", fixtureId: 1, capturedAt: INSTANT, contentHash: "h1" });
    const b = JSON.stringify({ id: "snap_x", fixtureId: 1, capturedAt: INSTANT, contentHash: "h2" });
    writeFileSync(path.join(dir, "snapshots.ndjson"), `${a}\n${b}\n`);
    await assert.rejects(
      buildSettlementArchiveState(createFileSettlementReadPort(env)),
      ArchiveStateConflictError
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("port: validation immutable conflict (same revisionId, diff hash) → buildSettlementArchiveState throws", async () => {
  const { env, dir } = tmpArchive();
  try {
    const base = { id: "val_1", revision: 1, fixtureId: 1, snapshotId: "s", marketKey: "over25", selectionKey: "over", state: "won" };
    const a = JSON.stringify({ ...base, revisionId: "r1", contentHash: "h1" });
    const b = JSON.stringify({ ...base, revisionId: "r1", contentHash: "h2" });
    writeFileSync(path.join(dir, "validations.ndjson"), `${a}\n${b}\n`);
    await assert.rejects(
      buildSettlementArchiveState(createFileSettlementReadPort(env)),
      ArchiveStateConflictError
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("port: non-ENOENT read failure (snapshots path is a directory → EISDIR) → throw", async () => {
  const { env, dir } = tmpArchive();
  try {
    mkdirSync(path.join(dir, "snapshots.ndjson")); // a directory where a file is expected
    await assert.rejects(createFileSettlementReadPort(env).readAllSnapshots(), /read failed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ===================== B. Producer (items 2 & 3) ===================== */

const baseConfig = { date: "2026-08-01", evaluationInstant: EVAL };

test("producer: captured terminal fixture → 1 SettlementCandidate, correctionCause absent", async () => {
  const res = await produceSettlementRequests(
    { loadCompletedRows: async () => [mkRow()], readPort: fakePort([mkSnapshot()], []) },
    baseConfig
  );
  assert.equal(res.candidates.length, 1);
  const c = res.candidates[0];
  assert.equal(c.fixtureId, FIX);
  assert.equal(c.completionInstant, "2026-08-01T18:00:00.000Z"); // deterministic kickoff instant
  assert.equal(c.nowSec, Math.floor(Date.parse(EVAL) / 1000));
  assert.equal("correctionCause" in c, false);
  assert.equal(c.correctionCause, undefined);
});

test("producer: read bounds — snapshots read once, validations read once, source loaded once", async () => {
  const port = fakePort([mkSnapshot()], []);
  let sourceCalls = 0;
  await produceSettlementRequests(
    {
      loadCompletedRows: async () => {
        sourceCalls += 1;
        return [mkRow()];
      },
      readPort: port,
    },
    baseConfig
  );
  assert.equal(port.calls.snap, 1);
  assert.equal(port.calls.val, 1);
  assert.equal(sourceCalls, 1);
});

test("producer: already-settled fixture → 0 candidates (first-settle firewall)", async () => {
  // Seed a terminal validation head for FIX so settledFixtureIds={FIX}.
  const store = createMemoryEvidenceArchive();
  const snap = mkSnapshot();
  await store.appendSnapshot(snap);
  await settleLatestSnapshotForFixture(store, {
    fixtureId: FIX,
    row: mkRow(),
    completionInstant: INSTANT,
    nowSec: 1_800_000_000,
  });
  const validations = await store.listValidations(FIX);
  const res = await produceSettlementRequests(
    { loadCompletedRows: async () => [mkRow()], readPort: fakePort([snap], validations) },
    baseConfig
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.already_settled, 1);
});

test("producer: captured but non-terminal (live) → 0 candidates (fixture_not_complete)", async () => {
  const live = mkRow({ status: "live", isLive: true, isFinished: false, minute: 55 });
  const res = await produceSettlementRequests(
    { loadCompletedRows: async () => [live], readPort: fakePort([mkSnapshot()], []) },
    baseConfig
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.fixture_not_complete, 1);
});

test("producer: uncaptured fixture → 0 candidates (missing_prediction_identity)", async () => {
  const res = await produceSettlementRequests(
    { loadCompletedRows: async () => [mkRow()], readPort: fakePort([], []) },
    baseConfig
  );
  assert.equal(res.candidates.length, 0);
  assert.equal(res.diagnostics.candidatesRejectedByReason.missing_prediction_identity, 1);
});

test("producer: BF-S1 lifecycle terminals (postponed/cancelled/abandoned, null scores) → eligible", async () => {
  for (const status of ["postponed", "cancelled", "abandoned"] as const) {
    const row = mkRow({ status, isFinished: false, homeScore: null as never, awayScore: null as never, htHome: null, htAway: null });
    const res = await produceSettlementRequests(
      { loadCompletedRows: async () => [row], readPort: fakePort([mkSnapshot()], []) },
      baseConfig
    );
    assert.equal(res.candidates.length, 1, `${status} must be terminal-eligible`);
    assert.equal(res.candidates[0].correctionCause, undefined);
  }
});

test("producer: strict validations read throw propagates (fail-closed, never empty)", async () => {
  await assert.rejects(
    produceSettlementRequests(
      { loadCompletedRows: async () => [mkRow()], readPort: fakePort([mkSnapshot()], [], "validations") },
      baseConfig
    ),
    /malformed NDJSON/
  );
});

test("producer: source-loader rejection propagates (fail-closed, never empty)", async () => {
  await assert.rejects(
    produceSettlementRequests(
      {
        loadCompletedRows: async () => {
          throw new Error("source load failed");
        },
        readPort: fakePort([mkSnapshot()], []),
      },
      baseConfig
    ),
    /source load failed/
  );
});

test("producer: ArchiveStateConflictError from a conflicting validation read propagates", async () => {
  const port: SettlementArchiveReadPort = {
    readAllSnapshots: async () => [mkSnapshot()],
    readAllValidations: async () =>
      [
        { id: "val_1", revisionId: "r1", revision: 1, fixtureId: FIX, snapshotId: "s", marketKey: "over25", selectionKey: "over", state: "won", contentHash: "h1" },
        { id: "val_1", revisionId: "r1", revision: 1, fixtureId: FIX, snapshotId: "s", marketKey: "over25", selectionKey: "over", state: "won", contentHash: "h2" },
      ] as unknown as ValidationRecord[],
  };
  await assert.rejects(
    produceSettlementRequests({ loadCompletedRows: async () => [mkRow()], readPort: port }, baseConfig),
    ArchiveStateConflictError
  );
});

test("producer: deterministic — shuffled completed rows → deep-equal candidate output", async () => {
  const snaps = [mkSnapshot({ fixtureId: 100 }), mkSnapshot({ fixtureId: 200 }), mkSnapshot({ fixtureId: 300 })];
  const rows = [
    mkRow({ matchId: 100, kickoff: "2026-08-01T12:00:00.000Z" }),
    mkRow({ matchId: 200, kickoff: "2026-08-01T15:00:00.000Z" }),
    mkRow({ matchId: 300, kickoff: "2026-08-01T18:00:00.000Z" }),
  ];
  const a = await produceSettlementRequests({ loadCompletedRows: async () => rows, readPort: fakePort(snaps, []) }, baseConfig);
  const b = await produceSettlementRequests({ loadCompletedRows: async () => [...rows].reverse(), readPort: fakePort([...snaps].reverse(), []) }, baseConfig);
  assert.deepEqual(a.candidates, b.candidates);
  assert.equal(a.candidates.length, 3);
  assert.deepEqual(a.candidates.map((c) => c.fixtureId), [100, 200, 300]);
});

/* ===================== C. Runner seam (item 4) ===================== */

const stubCandidate: SettlementCandidate = {
  fixtureId: FIX,
  row: mkRow(),
  completionInstant: INSTANT,
  nowSec: 1_800_000_000,
};

test("runner: provideCandidates invoked once inside the lock, threaded to the batch", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  let calls = 0;
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: createMemoryEvidenceArchive() },
    provideCandidates: async () => {
      calls += 1;
      return [stubCandidate];
    },
  });
  assert.equal(calls, 1);
  assert.equal(res.status, "succeeded");
  assert.equal(res.resultCounts?.considered, 1);
  assert.equal(res.resultCounts?.notFound, 1); // empty store → nothing to settle
});

test("runner: static candidates path still works (M9 backward-compat)", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: createMemoryEvidenceArchive() },
    candidates: [stubCandidate],
  });
  assert.equal(res.status, "succeeded");
  assert.equal(res.resultCounts?.considered, 1);
});

test("runner: rejecting provideCandidates → failed (never an empty success)", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: createMemoryEvidenceArchive() },
    provideCandidates: async () => {
      throw new Error("evidence archive: malformed NDJSON at line 3");
    },
  });
  assert.equal(res.status, "failed");
  assert.equal(res.errorCode, "unhandled");
});

test("runner: disabled settlement flag → skipped, producer never called", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  let calls = 0;
  const res = await runPredictionSettlementJob({
    env: {} as NodeJS.ProcessEnv,
    provideCandidates: async () => {
      calls += 1;
      return [stubCandidate];
    },
  });
  assert.equal(calls, 0);
  assert.equal(res.status, "skipped");
  assert.equal(res.errorCode, "settlement_disabled");
});

test("runner: lock unavailable → skipped, producer never called (no discovery)", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const held = await tryAcquireJobLock("job:prediction_settlement");
  assert.ok(held, "precondition: acquire the settlement lock");
  let calls = 0;
  try {
    const res = await runPredictionSettlementJob({
      env: enabledSettle,
      deps: { evidenceStore: createMemoryEvidenceArchive() },
      provideCandidates: async () => {
        calls += 1;
        return [stubCandidate];
      },
    });
    assert.equal(res.status, "skipped");
    assert.equal(res.errorCode, "lock_unavailable");
    assert.equal(calls, 0);
  } finally {
    await held!.release();
  }
});

test("runner: both static candidates AND provideCandidates → provideCandidates wins (pinned)", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  let calls = 0;
  const res = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: createMemoryEvidenceArchive() },
    // static path would C3-mismatch (matchId 999 != fixtureId 111)
    candidates: [{ fixtureId: 111, row: mkRow({ matchId: 999 }), completionInstant: INSTANT, nowSec: 1 }],
    provideCandidates: async () => {
      calls += 1;
      return [stubCandidate]; // → notFound on empty store
    },
  });
  assert.equal(calls, 1);
  assert.equal(res.resultCounts?.notFound, 1); // provider path ran
  assert.equal(res.resultCounts?.fixtureMismatch, 0); // static path ignored
});

/* ===================== D. Real integration (item 5) ===================== */

test("integration: real producer→provider→2A builder→M8 — first settle appends 1 record; retry no duplicate/no correction", async () => {
  resetMemoryJobLocks();
  resetJobLog();
  const store = createMemoryEvidenceArchive();
  const snap = mkSnapshot();
  await store.appendSnapshot(snap);

  // Real port reads reflect the live store state each pass (single read per store).
  const makeProducer = () => async () => {
    const port: SettlementArchiveReadPort = {
      readAllSnapshots: async () => [snap],
      readAllValidations: async () => store.listValidations(FIX),
    };
    const r = await produceSettlementRequests(
      { loadCompletedRows: async () => [mkRow()], readPort: port },
      baseConfig
    );
    return r.candidates;
  };

  // First settlement.
  const run1 = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: store },
    provideCandidates: makeProducer(),
  });
  assert.equal(run1.status, "succeeded");
  assert.equal(run1.resultCounts?.settled, 1);
  const after1 = await store.listValidations(FIX);
  assert.equal(after1.length, 1);
  assert.equal(after1[0].revision, 1);

  // Retry: fixture is now already-settled → provider emits nothing → no new append.
  const run2 = await runPredictionSettlementJob({
    env: enabledSettle,
    deps: { evidenceStore: store },
    provideCandidates: makeProducer(),
  });
  assert.equal(run2.status, "succeeded");
  assert.equal(run2.resultCounts?.considered, 0);
  const after2 = await store.listValidations(FIX);
  assert.equal(after2.length, 1, "no duplicate revision");
  assert.ok(after2.every((v) => v.revision === 1), "no correction revision produced");
});

test("integration: false-correction impossibility — causeless changed outcome → M8 invalid_input, no append", async () => {
  const store = createMemoryEvidenceArchive();
  const snap = mkSnapshot();
  await store.appendSnapshot(snap);
  // First settle → won (2-1, over25 over).
  const first = await settleLatestSnapshotForFixture(store, {
    fixtureId: FIX,
    row: mkRow(),
    completionInstant: INSTANT,
    nowSec: 1_800_000_000,
  });
  assert.equal(first.status, "settled");
  const before = await store.listValidations(FIX);
  assert.equal(before.length, 1);

  // Re-settle with a CHANGED outcome (0-0 → lost) and NO correctionCause → M8 fails closed.
  const changed = await settleLatestSnapshotForFixture(store, {
    fixtureId: FIX,
    row: mkRow({ homeScore: 0, awayScore: 0, htHome: 0, htAway: 0 }),
    completionInstant: INSTANT,
    nowSec: 1_800_000_000,
  });
  const marketInvalid =
    changed.status === "settled" &&
    changed.summary.invalidInput > 0;
  assert.ok(marketInvalid, "changed outcome without a cause must be invalid_input");
  const after = await store.listValidations(FIX);
  assert.equal(after.length, 1, "no correction was written");
});

/* ===================== E. Scope guards (item 6) ===================== */

test("scope: settlement-pipeline.ts CODE contains no correctionCause and no currentValidationHeads", () => {
  const src = readFileSync(
    path.join(process.cwd(), "lib/evidence-capture/candidates/settlement-pipeline.ts"),
    "utf8"
  );
  // Strip block + line comments so the firewall DOCUMENTATION (which names both identifiers
  // to explain the exclusion) does not trip the guard; assert neither appears in real code.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.equal(code.includes("correctionCause"), false, "no correctionCause produced in code");
  assert.equal(code.includes("currentValidationHeads"), false, "no currentValidationHeads consumed in code");
});

test("scope: prediction-settlement cron route remains the dormant one-line M9 delegate", () => {
  const route = readFileSync(
    path.join(process.cwd(), "app/api/internal/cron/prediction-settlement/route.ts"),
    "utf8"
  );
  assert.ok(route.includes("runPredictionSettlementJob()"), "route calls the bare job (no producer)");
  assert.equal(route.includes("provideCandidates"), false, "route wires no producer");
});
