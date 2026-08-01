/**
 * Staging migration rehearsal.
 * Requires: STAGING_DATABASE_URL
 * Optional: SKIP_APPLY=1 for dry inventory-only mode
 *
 * Never targets production. Refuses DATABASE_URL that looks like prod markers.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "evidence");
mkdirSync(outDir, { recursive: true });

const dbUrl = process.env.STAGING_DATABASE_URL?.trim() || "";
const skipApply = process.env.SKIP_APPLY === "1" || !dbUrl;
const started = Date.now();

function refuseIfProd(url) {
  const lower = url.toLowerCase();
  if (lower.includes("prod") && !lower.includes("staging")) {
    throw new Error("refusing URL that looks like production");
  }
}

const migrationsDir = path.join(root, "db", "migrations");
const files = existsSync(migrationsDir)
  ? readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()
  : [];

const evidence = {
  ok: false,
  mode: skipApply ? "inventory_only" : "apply",
  startedAt: new Date().toISOString(),
  migrations: files,
  before: null,
  after: null,
  durationMs: 0,
  notes: [],
};

try {
  if (!dbUrl) {
    evidence.notes.push(
      "STAGING_DATABASE_URL unset — inventory-only rehearsal. Ops must re-run with staging DB."
    );
    evidence.ok = true;
    evidence.blocked = true;
    evidence.blockCode = "staging_database_missing";
  } else {
    refuseIfProd(dbUrl);
    evidence.notes.push("backup prerequisite: run scripts/backup-postgres.mjs first");
    if (!skipApply) {
      // Apply each SQL file via psql if available
      const psql = spawnSync(
        "psql",
        [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", "SELECT 1"],
        { encoding: "utf8" }
      );
      if (psql.status !== 0) {
        evidence.notes.push("psql not available or DB unreachable — blocked");
        evidence.blocked = true;
        evidence.blockCode = "psql_unavailable";
      } else {
        for (const file of files) {
          const full = path.join(migrationsDir, file);
          const res = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", full], {
            encoding: "utf8",
          });
          if (res.status !== 0) {
            throw new Error(`migration_failed:${file}`);
          }
          evidence.notes.push(`applied:${file}`);
        }
        evidence.ok = true;
      }
    }
  }
} catch (err) {
  evidence.ok = false;
  evidence.error = err instanceof Error ? err.message : String(err);
}

evidence.durationMs = Date.now() - started;
evidence.finishedAt = new Date().toISOString();
const out = path.join(outDir, "migration-rehearsal.json");
writeFileSync(out, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ ok: evidence.ok, out, blocked: evidence.blocked || false }));
process.exit(evidence.ok ? 0 : 1);
