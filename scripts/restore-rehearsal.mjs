/**
 * Restore rehearsal into a temporary database.
 * Requires:
 *   STAGING_DATABASE_URL  — source
 *   RESTORE_VERIFY_DATABASE_URL — empty/temp target (NOT staging primary, NOT prod)
 * Optional:
 *   BACKUP_FILE — existing pg_dump -Fc file
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "evidence");
mkdirSync(outDir, { recursive: true });

const source = process.env.STAGING_DATABASE_URL?.trim() || "";
const target = process.env.RESTORE_VERIFY_DATABASE_URL?.trim() || "";
const started = Date.now();

const evidence = {
  ok: false,
  blocked: false,
  startedAt: new Date().toISOString(),
  backupDurationMs: null,
  restoreDurationMs: null,
  backupSizeBytes: null,
  checks: {},
  notes: [],
};

function looksProd(url) {
  const u = url.toLowerCase();
  return u.includes("prod") && !u.includes("staging") && !u.includes("restore") && !u.includes("verify");
}

try {
  if (!source || !target) {
    evidence.blocked = true;
    evidence.blockCode = "restore_urls_missing";
    evidence.notes.push(
      "Set STAGING_DATABASE_URL and RESTORE_VERIFY_DATABASE_URL to run a real restore."
    );
    evidence.ok = true; // script succeeded in reporting blocked state
  } else if (looksProd(source) || looksProd(target)) {
    throw new Error("refusing production-looking database URL");
  } else if (source === target) {
    throw new Error("source and target must differ");
  } else {
    const backupFile =
      process.env.BACKUP_FILE ||
      path.join(root, "backups", `restore-rehearsal-${Date.now()}.dump`);
    mkdirSync(path.dirname(backupFile), { recursive: true });

    const t0 = Date.now();
    const dump = spawnSync("pg_dump", [source, "-Fc", "-f", backupFile], {
      encoding: "utf8",
    });
    evidence.backupDurationMs = Date.now() - t0;
    if (dump.status !== 0) throw new Error("pg_dump_failed");

    evidence.backupSizeBytes = statSync(backupFile).size;

    const t1 = Date.now();
    const restore = spawnSync(
      "pg_restore",
      ["-d", target, "--clean", "--if-exists", backupFile],
      { encoding: "utf8" }
    );
    evidence.restoreDurationMs = Date.now() - t1;
    if (restore.status !== 0) {
      evidence.notes.push((restore.stderr || "").slice(0, 400));
      throw new Error("pg_restore_failed");
    }

    // Row count probes (best-effort)
    const tables = [
      "affiliate_clicks",
      "affiliate_conversions",
      "provider_snapshots",
      "active_snapshots",
    ];
    for (const table of tables) {
      const q = spawnSync(
        "psql",
        [target, "-tAc", `SELECT COUNT(*) FROM ${table}`],
        { encoding: "utf8" }
      );
      evidence.checks[table] =
        q.status === 0 ? Number(q.stdout.trim()) : "missing_or_error";
    }
    evidence.ok = true;
    evidence.notes.push("Destroy RESTORE_VERIFY_DATABASE_URL after review.");
  }
} catch (err) {
  evidence.ok = false;
  evidence.error = err instanceof Error ? err.message : String(err);
}

evidence.durationMs = Date.now() - started;
evidence.finishedAt = new Date().toISOString();
const out = path.join(outDir, "restore-rehearsal.json");
writeFileSync(out, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ ok: evidence.ok, blocked: evidence.blocked, out }));
process.exit(evidence.ok ? 0 : 1);
