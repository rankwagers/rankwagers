/**
 * Logical Postgres backup helper.
 * Usage: STAGING_DATABASE_URL=... OUT_DIR=./backups node scripts/backup-postgres.mjs
 */
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dbUrl = process.env.STAGING_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
const outDir = process.env.OUT_DIR || path.resolve("backups");
mkdirSync(outDir, { recursive: true });

if (!dbUrl) {
  const evidence = {
    ok: false,
    blocked: true,
    blockCode: "database_url_missing",
    message: "Set STAGING_DATABASE_URL",
  };
  writeFileSync(path.join(outDir, "backup-last.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = path.join(outDir, `staging-${stamp}.dump`);
const started = Date.now();
const res = spawnSync("pg_dump", [dbUrl, "-Fc", "-f", file], { encoding: "utf8" });
const evidence = {
  ok: res.status === 0,
  file,
  durationMs: Date.now() - started,
  sizeBytes: res.status === 0 ? statSync(file).size : 0,
  ts: new Date().toISOString(),
  stderr: res.status === 0 ? undefined : (res.stderr || "").slice(0, 500),
};
writeFileSync(path.join(outDir, "backup-last.json"), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ ok: evidence.ok, file: evidence.file, sizeBytes: evidence.sizeBytes }));
process.exit(evidence.ok ? 0 : 1);
