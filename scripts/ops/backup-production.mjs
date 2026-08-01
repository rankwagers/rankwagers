#!/usr/bin/env node
/**
 * Production backup — logical Postgres dumps + file-archive tarball, with retention and a
 * machine-readable heartbeat. Designed to run unattended from a systemd timer / cron.
 *
 * Backs up every configured production database (by env var) AND the file-based data at risk
 * (daily archives, evidence NDJSON archive, shared dir). Writes `backup-last.json` so the
 * health monitor can alert on a stale/failed backup. NEVER logs a connection string or secret.
 *
 *   OUT_DIR=/opt/rankwagers/backups \
 *   ATTRIBUTION_DATABASE_URL=... ODDS_HISTORY_DATABASE_URL=... [others] \
 *   RETAIN_DAYS=14 \
 *   node scripts/ops/backup-production.mjs
 *
 * Exit codes: 0 = all targets ok · 1 = one or more targets failed · 2 = nothing to back up.
 */
import { mkdirSync, writeFileSync, statSync, readdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const OUT_DIR = process.env.OUT_DIR?.trim() || "/opt/rankwagers/backups";
const RETAIN_DAYS = (() => {
  const n = Number(process.env.RETAIN_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 14;
})();
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

/** Production databases to dump, in priority order. Deduped by URL value (many share one DB). */
const DB_ENV_VARS = [
  "ATTRIBUTION_DATABASE_URL",
  "ODDS_HISTORY_DATABASE_URL",
  "SNAPSHOT_DATABASE_URL",
  "BUILDER_APPROVAL_DATABASE_URL",
  "ACCA_PUBLICATION_DATABASE_URL",
  "EVIDENCE_DATABASE_URL",
  "DATABASE_URL",
];

/** File paths at risk (append-only history + source archives). Missing paths are skipped. */
const FILE_TARGETS = [
  process.env.EVIDENCE_ARCHIVE_DIR?.trim() ||
    "/opt/rankwagers/shared/evidence-archive",
  path.resolve(process.cwd(), "data", "daily-archives"),
].filter(Boolean);

function redactName(envVar) {
  return envVar.replace(/_DATABASE_URL$/, "").toLowerCase();
}

function ensureOutDir() {
  try {
    mkdirSync(OUT_DIR, { recursive: true });
    return OUT_DIR;
  } catch {
    const fallback = path.resolve(process.cwd(), "backups");
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

function dumpDatabase(name, url, outDir) {
  const file = path.join(outDir, `${name}-${STAMP}.dump`);
  const started = Date.now();
  // `-Fc` = custom format (compressed, restorable via pg_restore). URL passed as an arg to
  // pg_dump, never echoed to logs.
  const res = spawnSync("pg_dump", [url, "-Fc", "-f", file], { encoding: "utf8" });
  const ok = res.status === 0;
  return {
    kind: "database",
    name,
    ok,
    file: ok ? file : null,
    sizeBytes: ok && existsSync(file) ? statSync(file).size : 0,
    durationMs: Date.now() - started,
    // stderr may contain the DB name/host but never the password (pg_dump does not echo it);
    // still truncated defensively.
    error: ok ? undefined : (res.stderr || res.error?.message || "pg_dump failed").slice(0, 300),
  };
}

function tarArchives(outDir) {
  const present = FILE_TARGETS.filter((p) => existsSync(p));
  if (present.length === 0) return null;
  const file = path.join(outDir, `archives-${STAMP}.tar.gz`);
  const started = Date.now();
  // Absolute paths tarred with -C / to preserve structure; harmless leading-slash strip warning.
  const args = ["-czf", file, ...present.map((p) => path.resolve(p))];
  const res = spawnSync("tar", args, { encoding: "utf8" });
  const ok = res.status === 0;
  return {
    kind: "archives",
    name: "file_archives",
    ok,
    file: ok ? file : null,
    sizeBytes: ok && existsSync(file) ? statSync(file).size : 0,
    durationMs: Date.now() - started,
    paths: present,
    error: ok ? undefined : (res.stderr || "tar failed").slice(0, 300),
  };
}

function pruneOld(outDir) {
  const cutoff = Date.now() - RETAIN_DAYS * 24 * 3600 * 1000;
  let removed = 0;
  for (const entry of readdirSync(outDir)) {
    if (!/\.(dump|tar\.gz)$/.test(entry)) continue;
    const full = path.join(outDir, entry);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        rmSync(full, { force: true });
        removed += 1;
      }
    } catch {
      // ignore a file that vanished under us
    }
  }
  return removed;
}

function main() {
  const outDir = ensureOutDir();

  // Dedupe DB targets by URL value so a shared DB is dumped once.
  const seen = new Set();
  const dbTargets = [];
  for (const envVar of DB_ENV_VARS) {
    const url = process.env[envVar]?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    dbTargets.push({ name: redactName(envVar), url });
  }

  const results = [];
  for (const t of dbTargets) results.push(dumpDatabase(t.name, t.url, outDir));
  const archive = tarArchives(outDir);
  if (archive) results.push(archive);

  if (results.length === 0) {
    const evidence = {
      ok: false,
      blocked: true,
      blockCode: "no_backup_targets",
      message: "No *_DATABASE_URL set and no file archives found — nothing to back up.",
      ts: new Date().toISOString(),
      outDir,
    };
    writeFileSync(path.join(outDir, "backup-last.json"), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
    process.exit(2);
  }

  const removed = pruneOld(outDir);
  const ok = results.every((r) => r.ok);
  const evidence = {
    ok,
    ts: new Date().toISOString(),
    outDir,
    retainDays: RETAIN_DAYS,
    prunedOld: removed,
    totalBytes: results.reduce((a, r) => a + (r.sizeBytes || 0), 0),
    // Targets carry names/sizes/durations only — never a URL.
    targets: results.map(({ kind, name, ok, sizeBytes, durationMs, error, paths }) => ({
      kind,
      name,
      ok,
      sizeBytes,
      durationMs,
      ...(paths ? { paths } : {}),
      ...(error ? { error } : {}),
    })),
  };
  writeFileSync(path.join(outDir, "backup-last.json"), JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      ok,
      targets: evidence.targets.map((t) => `${t.name}:${t.ok ? "ok" : "FAIL"}`),
      totalBytes: evidence.totalBytes,
    })
  );
  process.exit(ok ? 0 : 1);
}

main();
