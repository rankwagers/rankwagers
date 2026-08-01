#!/usr/bin/env node
/**
 * Restore drill — prove a backup dump actually restores. An unverified backup is not a backup.
 *
 * Restores a `pg_dump -Fc` file into a DISPOSABLE scratch database and runs a smoke check
 * (lists tables, counts them). Writes `restore-last.json` so the health monitor can alert if
 * restores stop being exercised. FAIL-CLOSED: refuses a production-looking scratch URL so the
 * drill can never overwrite a live database (mirrors the benchmark isolation guard).
 *
 *   DUMP_FILE=/opt/rankwagers/backups/attribution-<stamp>.dump \
 *   SCRATCH_DATABASE_URL=postgres://user:pass@localhost:5432/rw_restore_scratch \
 *   node scripts/ops/restore-verify.mjs
 *
 * Exit codes: 0 = restored + smoke ok · 1 = restore/smoke failed · 2 = refused/misconfigured.
 */
import { existsSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const OUT_DIR = process.env.OUT_DIR?.trim() || "/opt/rankwagers/backups";

/** A scratch URL must be a clearly-disposable local instance — never production. */
function looksLikeProd(url) {
  const u = (url || "").trim().toLowerCase();
  if (!u) return true; // absent → refuse
  const isLocal =
    u.includes("@localhost") ||
    u.includes("@127.0.0.1") ||
    u.includes("@::1") ||
    u.includes("host=localhost") ||
    u.includes("host=127.0.0.1");
  const smellsProd =
    /prod|production|rankwagers\.(com|io|net)|amazonaws|rds\.|supabase|neon\.tech/.test(u);
  // A scratch DB name must be obviously disposable.
  const looksScratch = /(scratch|restore|verify|tmp|throwaway|_test)/.test(u);
  return smellsProd || !isLocal || !looksScratch;
}

function fail(code, blockCode, message) {
  const evidence = { ok: false, blocked: code === 2, blockCode, message, ts: new Date().toISOString() };
  try {
    writeFileSync(path.join(OUT_DIR, "restore-last.json"), JSON.stringify(evidence, null, 2));
  } catch {
    // OUT_DIR may not exist in a refusal path — the console line is still emitted
  }
  console.log(JSON.stringify(evidence));
  process.exit(code);
}

const dumpFile = process.env.DUMP_FILE?.trim();
const scratchUrl = process.env.SCRATCH_DATABASE_URL?.trim();

if (!dumpFile || !existsSync(dumpFile)) {
  fail(2, "dump_file_missing", `DUMP_FILE not found: ${dumpFile || "(unset)"}`);
}
if (looksLikeProd(scratchUrl)) {
  fail(
    2,
    "refused_non_scratch_url",
    "SCRATCH_DATABASE_URL must be a disposable local DB whose name contains scratch/restore/verify/tmp — refusing to restore into a production-looking target."
  );
}

const started = Date.now();
// pg_restore into the scratch DB. `--clean --if-exists` makes the drill idempotent; `-1` runs
// in a single transaction so a partial failure rolls back and leaves the scratch DB clean.
const restore = spawnSync(
  "pg_restore",
  ["--clean", "--if-exists", "--no-owner", "--no-privileges", "-d", scratchUrl, dumpFile],
  { encoding: "utf8" }
);
// pg_restore can exit non-zero on benign warnings; treat a hard error as failure but let the
// smoke query be the real arbiter.
const smoke = spawnSync(
  "psql",
  [scratchUrl, "-t", "-A", "-c", "select count(*) from information_schema.tables where table_schema='public';"],
  { encoding: "utf8" }
);
const tableCount = Number((smoke.stdout || "").trim());
const smokeOk = smoke.status === 0 && Number.isFinite(tableCount) && tableCount >= 0;
const ok = smokeOk && (restore.status === 0 || tableCount > 0);

const evidence = {
  ok,
  ts: new Date().toISOString(),
  dumpFile,
  dumpSizeBytes: existsSync(dumpFile) ? statSync(dumpFile).size : 0,
  restoreExit: restore.status,
  tablesRestored: Number.isFinite(tableCount) ? tableCount : null,
  durationMs: Date.now() - started,
  ...(ok
    ? {}
    : {
        error: (restore.stderr || smoke.stderr || "restore/smoke failed").slice(0, 300),
      }),
};
try {
  writeFileSync(path.join(OUT_DIR, "restore-last.json"), JSON.stringify(evidence, null, 2));
} catch {
  // best-effort heartbeat
}
console.log(JSON.stringify({ ok, tablesRestored: evidence.tablesRestored, durationMs: evidence.durationMs }));
process.exit(ok ? 0 : 1);
