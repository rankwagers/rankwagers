import { Pool, type PoolClient } from "pg";
import { createHash } from "node:crypto";

export type LockHandle = {
  key: string;
  release: () => Promise<void>;
};

/** Deterministic signed int4 key for pg_advisory_lock. */
export function advisoryLockKey(lockName: string): number {
  const hex = createHash("sha256").update(lockName).digest("hex").slice(0, 8);
  const n = Number.parseInt(hex, 16) & 0x7fffffff;
  return n || 1;
}

const memoryLocks = new Set<string>();

export async function tryAcquireJobLock(
  lockName: string,
  options?: { timeoutMs?: number; requireDurable?: boolean }
): Promise<LockHandle | null> {
  const requireDurable = options?.requireDurable === true;

  // Durable (evidence capture/settlement) locks bind to the CANONICAL evidence
  // database (`EVIDENCE_DATABASE_URL`) so the advisory lock guards the very store the
  // evidence writes land in. Other jobs keep their existing best-effort resolution.
  const url = requireDurable
    ? process.env.EVIDENCE_DATABASE_URL?.trim() || ""
    : process.env.SNAPSHOT_DATABASE_URL?.trim() ||
      process.env.ATTRIBUTION_DATABASE_URL?.trim() ||
      process.env.ODDS_HISTORY_DATABASE_URL?.trim() ||
      "";

  if (!url || process.env.JOB_LOCK_ADAPTER === "memory") {
    // Fail closed: a durable lock must NEVER silently degrade to a per-process memory
    // lock in production. Without a shared `EVIDENCE_DATABASE_URL` advisory lock,
    // cross-process single-writer cannot be guaranteed, so refuse the lock (the caller
    // surfaces this as a skipped run) rather than admit a second writer.
    if (requireDurable && process.env.NODE_ENV === "production") {
      return null;
    }
    if (memoryLocks.has(lockName)) return null;
    memoryLocks.add(lockName);
    return {
      key: lockName,
      release: async () => {
        memoryLocks.delete(lockName);
      },
    };
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    // The lock database is unreachable, so a cross-process advisory lock cannot be
    // guaranteed. Fail closed: refuse the lock (caller surfaces a skipped run) rather
    // than proceed without the guarantee. NEVER degrade to an in-process memory lock.
    await pool.end().catch(() => undefined);
    return null;
  }
  const key = advisoryLockKey(lockName);
  const timeoutMs = options?.timeoutMs ?? 1_000;
  const started = Date.now();

  try {
    while (Date.now() - started < timeoutMs) {
      const result = await client.query<{ locked: boolean }>(
        `SELECT pg_try_advisory_lock($1) AS locked`,
        [key]
      );
      if (result.rows[0]?.locked) {
        return {
          key: lockName,
          release: async () => {
            try {
              await client.query(`SELECT pg_advisory_unlock($1)`, [key]);
            } finally {
              client.release();
              await pool.end().catch(() => undefined);
            }
          },
        };
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    client.release();
    await pool.end().catch(() => undefined);
    return null;
  } catch {
    client.release();
    await pool.end().catch(() => undefined);
    return null;
  }
}

/** Test helper */
export function resetMemoryJobLocks(): void {
  memoryLocks.clear();
}
