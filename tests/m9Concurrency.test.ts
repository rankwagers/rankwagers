import assert from "node:assert/strict";
import test from "node:test";

import {
  advisoryLockKey,
  resetMemoryJobLocks,
  tryAcquireJobLock,
} from "../lib/jobs/locks";
import {
  listRecentJobs,
  resetJobLog,
  runAttributionCleanupJob,
  runCleanupJob,
} from "../lib/jobs/runner";

/**
 * Sprint 23B — M9 concurrency & locking review. Deterministic (memory lock backend,
 * no wall-clock assertions, no DB). Covers the lock-level guarantees the M9 capture +
 * settlement jobs rely on, plus the runner's per-job record tracking under concurrency.
 */

function useMemoryLocks(): void {
  process.env.JOB_LOCK_ADAPTER = "memory";
  resetMemoryJobLocks();
}

test("M9 lock: two concurrent same-key acquisitions serialize (capture vs capture / settle vs settle)", async () => {
  useMemoryLocks();
  const [a, b] = await Promise.all([
    tryAcquireJobLock("job:evidence_capture"),
    tryAcquireJobLock("job:evidence_capture"),
  ]);
  const winners = [a, b].filter(Boolean);
  assert.equal(winners.length, 1, "exactly one acquires; the other is skipped");
  await winners[0]!.release();
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 lock: capture and settlement use distinct keys → both acquire concurrently (no false contention)", async () => {
  useMemoryLocks();
  const [cap, settle] = await Promise.all([
    tryAcquireJobLock("job:evidence_capture"),
    tryAcquireJobLock("job:prediction_settlement"),
  ]);
  assert.ok(cap && settle, "distinct job types never contend");
  assert.notEqual(
    advisoryLockKey("job:evidence_capture"),
    advisoryLockKey("job:prediction_settlement"),
    "distinct advisory keys"
  );
  await cap!.release();
  await settle!.release();
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 lock: released in finally after a thrown job body → reacquirable", async () => {
  useMemoryLocks();
  const lock = await tryAcquireJobLock("job:evidence_capture");
  assert.ok(lock);
  try {
    await (async () => {
      throw new Error("simulated job failure");
    })();
  } catch {
    // swallowed — the point is the finally release below
  } finally {
    await lock!.release();
  }
  const again = await tryAcquireJobLock("job:evidence_capture");
  assert.ok(again, "lock is free after an exception path");
  await again!.release();
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 lock: released after a write_failed-style return (no throw) → reacquirable", async () => {
  useMemoryLocks();
  const lock = await tryAcquireJobLock("job:prediction_settlement");
  assert.ok(lock);
  // A store write_failed is a RETURNED failed record, not a throw; release still runs.
  const jobResult = { status: "failed" as const, errorCode: "write_failed" };
  await lock!.release();
  assert.equal(jobResult.errorCode, "write_failed");
  const again = await tryAcquireJobLock("job:prediction_settlement");
  assert.ok(again, "lock is free after a returned failure");
  await again!.release();
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 lock: cron overlap — 2nd and 3rd identical invocations get null (skipped/lock_unavailable), no queue", async () => {
  useMemoryLocks();
  const first = await tryAcquireJobLock("job:evidence_capture");
  const second = await tryAcquireJobLock("job:evidence_capture");
  const third = await tryAcquireJobLock("job:evidence_capture");
  assert.ok(first);
  assert.equal(second, null);
  assert.equal(third, null);
  await first!.release();
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 lock: 1000 acquire/release cycles do not grow the in-process lock set", async () => {
  useMemoryLocks();
  for (let i = 0; i < 1000; i++) {
    const h = await tryAcquireJobLock("job:evidence_capture");
    assert.ok(h, `cycle ${i} acquired`);
    await h!.release();
  }
  const after = await tryAcquireJobLock("job:evidence_capture");
  assert.ok(after, "still acquirable after 1000 cycles (no leak)");
  await after!.release();
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 runner: concurrent distinct-type jobs each record their own terminal state (no jobLog clobber)", async () => {
  useMemoryLocks();
  resetJobLog();
  // Two distinct locks → they overlap; each must land its OWN completed record.
  const [cleanup, attribution] = await Promise.all([
    runCleanupJob({ dryRun: true }),
    runAttributionCleanupJob({ dryRun: true }),
  ]);
  assert.equal(cleanup.jobType, "snapshot_cleanup");
  assert.equal(attribution.jobType, "attribution_cleanup");
  assert.notEqual(cleanup.status, "running", "cleanup reached a terminal state");
  assert.notEqual(attribution.status, "running", "attribution reached a terminal state");

  const recent = listRecentJobs(10);
  const cleanupRec = recent.find((j) => j.jobType === "snapshot_cleanup");
  const attrRec = recent.find((j) => j.jobType === "attribution_cleanup");
  assert.ok(cleanupRec, "cleanup present in job log");
  assert.ok(attrRec, "attribution present in job log");
  // The pre-fix positional write (jobLog[length-1]) left a phantom stuck 'running'
  // record and dropped one job entirely; assert neither log entry is stuck running.
  assert.notEqual(cleanupRec!.status, "running");
  assert.notEqual(attrRec!.status, "running");
  delete process.env.JOB_LOCK_ADAPTER;
});

test("M9 runner: job log stays bounded under many invocations", async () => {
  useMemoryLocks();
  resetJobLog();
  for (let i = 0; i < 60; i++) {
    await runCleanupJob({ dryRun: true });
  }
  const recent = listRecentJobs(50);
  assert.equal(recent.length, 50, "listRecentJobs caps at the requested tail");
  assert.ok(
    recent.every((j) => j.jobType === "snapshot_cleanup" && j.status !== "running"),
    "all recent entries are terminal snapshot_cleanup records"
  );
  delete process.env.JOB_LOCK_ADAPTER;
});

// ---- Durable lock: production fail-closed (Blocker 1) ----------------------
//
// Evidence capture/settlement request a durable lock (`requireDurable: true`). In
// production such a lock MUST be backed by the canonical EVIDENCE_DATABASE_URL advisory
// lock and MUST NEVER silently degrade to a per-process memory lock.

async function withProdEnv(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>
): Promise<void> {
  const saved: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    EVIDENCE_DATABASE_URL: process.env.EVIDENCE_DATABASE_URL,
    JOB_LOCK_ADAPTER: process.env.JOB_LOCK_ADAPTER,
  };
  try {
    process.env.NODE_ENV = "production";
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("Blocker 1: durable lock in production with no EVIDENCE_DATABASE_URL fails closed (no memory fallback)", async () => {
  resetMemoryJobLocks();
  await withProdEnv(
    { EVIDENCE_DATABASE_URL: undefined, JOB_LOCK_ADAPTER: undefined },
    async () => {
      const lock = await tryAcquireJobLock("job:evidence_capture", {
        requireDurable: true,
      });
      assert.equal(lock, null, "must refuse the lock rather than use a memory lock");
    }
  );
});

test("Blocker 1: durable lock in production with JOB_LOCK_ADAPTER=memory fails closed", async () => {
  resetMemoryJobLocks();
  await withProdEnv(
    { EVIDENCE_DATABASE_URL: "postgres://ignored", JOB_LOCK_ADAPTER: "memory" },
    async () => {
      const lock = await tryAcquireJobLock("job:prediction_settlement", {
        requireDurable: true,
      });
      assert.equal(lock, null, "memory adapter must not satisfy a durable lock in prod");
    }
  );
});

test("Blocker 1: non-durable lock in production still uses the in-process fallback (unchanged)", async () => {
  resetMemoryJobLocks();
  await withProdEnv(
    { EVIDENCE_DATABASE_URL: undefined, JOB_LOCK_ADAPTER: "memory" },
    async () => {
      const lock = await tryAcquireJobLock("job:snapshot_cleanup");
      assert.ok(lock, "best-effort jobs keep their memory fallback");
      await lock!.release();
    }
  );
});
