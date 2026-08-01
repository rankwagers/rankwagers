/**
 * M10 Benchmark Framework — isolation guards (Stage 2E, Slice 1).
 *
 * Reconciliation finding M-E: benchmark execution must never touch production data, the
 * production evidence archive, or a production database. These guards are the framework's
 * fail-closed safety helpers that a LATER execution slice MUST call before any write cell.
 * Slice 1 defines them only; it executes nothing.
 *
 * Mirrors the `scripts/rehearse-migrations.mjs` "refuse prod-looking URLs" precedent.
 */

import path from "node:path";

/** Production evidence archive default (must never be a benchmark target). */
const PROD_EVIDENCE_DIR = "/opt/rankwagers/shared/evidence-archive";
/** Production shared root prefix. */
const PROD_SHARED_PREFIX = "/opt/rankwagers/shared";

export class BenchIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenchIsolationError";
  }
}

/** True if a database URL looks like a production DB (not a disposable local instance). */
export function looksLikeProdDatabaseUrl(url: string | undefined | null): boolean {
  const u = (url ?? "").trim().toLowerCase();
  if (!u) return false;
  const isLocal =
    u.includes("@localhost") ||
    u.includes("@127.0.0.1") ||
    u.includes("@::1") ||
    u.includes("host=localhost") ||
    u.includes("host=127.0.0.1");
  const smellsProd = /prod|production|rankwagers\.(com|io|net)|amazonaws|rds\.|supabase|neon\.tech/.test(u);
  return smellsProd || !isLocal;
}

/**
 * Fail closed unless the DB URL is clearly a disposable local instance. A benchmark lock cell
 * uses a throwaway local Postgres — never the production DB.
 */
export function assertDisposableDatabaseUrl(url: string | undefined | null): void {
  if (looksLikeProdDatabaseUrl(url)) {
    throw new BenchIsolationError(
      "refusing a production-looking database URL; benchmarks require a disposable local instance"
    );
  }
}

/** True if a directory is (or is under) the production evidence archive / shared root. */
export function isProductionArchiveDir(dir: string): boolean {
  const resolved = path.resolve(dir);
  return (
    resolved === PROD_EVIDENCE_DIR ||
    resolved === PROD_SHARED_PREFIX ||
    resolved.startsWith(PROD_SHARED_PREFIX + path.sep)
  );
}

/**
 * Fail closed unless `dir` is an isolated (temp / bench-owned) directory — never the production
 * evidence archive, never the repo's live `data/` source dir. Later slices point the archive/
 * source env at a temp dir returned from `mkdtemp` and pass it here first.
 */
export function assertIsolatedDir(dir: string): void {
  const resolved = path.resolve(dir);
  if (isProductionArchiveDir(resolved)) {
    throw new BenchIsolationError(
      `refusing production archive dir "${resolved}"; benchmarks must target an isolated temp dir`
    );
  }
  const liveData = path.join(process.cwd(), "data");
  if (resolved === liveData || resolved.startsWith(liveData + path.sep)) {
    throw new BenchIsolationError(
      `refusing the live source dir "${resolved}"; benchmarks must target an isolated temp dir`
    );
  }
}

/** Assert the whole env profile is benchmark-safe (production flags/URLs off/absent). */
export function assertBenchmarkSafeEnv(env: NodeJS.ProcessEnv): void {
  // Live pipeline flags must never be on during a benchmark process.
  for (const flag of ["EVIDENCE_CAPTURE_ENABLED", "EVIDENCE_SETTLEMENT_ENABLED", "EVIDENCE_M10_LIVE_ENABLED"]) {
    const v = env[flag]?.trim().toLowerCase();
    if (v === "true" || v === "1") {
      throw new BenchIsolationError(`live flag ${flag} is enabled; refusing to benchmark with a live pipeline flag on`);
    }
  }
}
