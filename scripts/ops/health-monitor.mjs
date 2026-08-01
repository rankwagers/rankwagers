#!/usr/bin/env node
/**
 * Production dead-man's-switch monitor. Run from a systemd timer / cron every few minutes.
 *
 * Readiness-aware (RF-1): a non-200 readiness does NOT page by itself. It pages only on a true
 * paging condition — app unavailable/unreachable or a persistence (DB) check failing. Optional /
 * known degradation (e.g. raw-provider-archive OFF, analytics unset) is logged, not paged.
 *
 * PM2 (RF-2): watches the authoritative `aff-site` app under the root daemon (PM2_HOME). It ignores
 * the intentionally-stopped rankdev `rankwagers` app, never pages on the historic lifetime restart
 * count, and pages only on a restart DELTA within the observation window (persisted between runs).
 *
 * Decision logic lives in `monitor-logic.cjs` (pure, unit-tested); this file is I/O only.
 * Emits one structured JSON line (always) and POSTs a BOUNDED, secret-free alert to
 * ALERT_WEBHOOK_URL only when a PAGING check fails. Exit 0 = no page, 1 = paging.
 *
 *   BASE_URL=http://127.0.0.1:3000 OUT_DIR=/opt/rankwagers/backups PM2_APP_NAME=aff-site \
 *   [PM2_HOME=/root/.pm2] [ALERT_WEBHOOK_URL=https://...] node scripts/ops/health-monitor.mjs
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import logic from "./monitor-logic.cjs";

const BASE_URL = (process.env.BASE_URL?.trim() || "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT_DIR = process.env.OUT_DIR?.trim() || "/opt/rankwagers/backups";
const DAILY_ARCHIVES = path.resolve(process.cwd(), "data", "daily-archives");
const num = (name, dflt) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};
const MAX_BACKUP_AGE_H = num("MAX_BACKUP_AGE_H", 26);
const MAX_RESTORE_AGE_H = num("MAX_RESTORE_AGE_H", 24 * 8);
const MAX_CRON_AGE_H = num("MAX_CRON_AGE_H", 30);
const MAX_RESTARTS = num("MAX_RESTARTS_PER_WINDOW", 5);
// Authoritative production app is `aff-site` under the ROOT PM2 daemon. The obsolete rankdev
// `rankwagers` app is intentionally stopped and must NOT be monitored (RF-2).
const PM2_APP = process.env.PM2_APP_NAME?.trim() || "aff-site";
const TIMEOUT_MS = num("MONITOR_TIMEOUT_MS", 5000);
const PM2_STATE_FILE = path.join(OUT_DIR, "monitor-pm2-last.json");

async function httpProbe(pathname, wantBody) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${pathname}`, {
      signal: ctrl.signal,
      headers: { "user-agent": "rw-health-monitor" },
    });
    let body = null;
    if (wantBody) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    }
    return { status: res.status, body };
  } catch (e) {
    return { status: `error:${e?.name || "fetch"}`, body: null };
  } finally {
    clearTimeout(t);
  }
}

function ageHours(mtimeMs) {
  return (Date.now() - mtimeMs) / 3600000;
}

function jsonHeartbeat(file) {
  if (!existsSync(file)) return null;
  try {
    return { data: JSON.parse(readFileSync(file, "utf8")), ageH: ageHours(statSync(file).mtimeMs) };
  } catch {
    return { data: null, ageH: ageHours(statSync(file).mtimeMs) };
  }
}

function newestDailyArchiveAgeH() {
  if (!existsSync(DAILY_ARCHIVES)) return null;
  let newest = 0;
  for (const f of readdirSync(DAILY_ARCHIVES)) {
    if (!f.endsWith(".json")) continue;
    try {
      newest = Math.max(newest, statSync(path.join(DAILY_ARCHIVES, f)).mtimeMs);
    } catch {
      /* ignore */
    }
  }
  return newest ? ageHours(newest) : null;
}

/** `pm2 jlist` against the daemon selected by PM2_HOME (root daemon when run as root). */
function pm2Apps() {
  const env = { ...process.env };
  const res = spawnSync("pm2", ["jlist"], { encoding: "utf8", env });
  if (res.status !== 0 || !res.stdout) return null;
  try {
    return JSON.parse(res.stdout);
  } catch {
    return null;
  }
}

function readPrevRestart() {
  const hb = jsonHeartbeat(PM2_STATE_FILE);
  const v = hb?.data?.restart_time;
  return Number.isFinite(v) ? v : null;
}

function writePrevRestart(restartTime) {
  try {
    writeFileSync(PM2_STATE_FILE, JSON.stringify({ restart_time: restartTime, ts: new Date().toISOString() }));
  } catch {
    /* best-effort; a missing OUT_DIR just resets the delta window next run */
  }
}

async function main() {
  const checks = [];

  // Liveness + readiness.
  const live = await httpProbe("/api/health", false);
  checks.push(logic.classifyLiveness(live.status));
  const ready = await httpProbe("/api/health/ready", true);
  checks.push(logic.classifyReadiness(ready.status, ready.body));

  // Backup / restore / cron freshness (non-paging warns).
  const backup = jsonHeartbeat(path.join(OUT_DIR, "backup-last.json"));
  checks.push(
    logic.classifyBackup(!!backup, backup?.data?.ok, backup ? backup.ageH : Infinity, MAX_BACKUP_AGE_H)
  );
  const restore = jsonHeartbeat(path.join(OUT_DIR, "restore-last.json"));
  checks.push(
    logic.classifyRestore(!!restore, restore?.data?.ok, restore ? restore.ageH : Infinity, MAX_RESTORE_AGE_H)
  );
  checks.push(logic.classifyCron(newestDailyArchiveAgeH(), MAX_CRON_AGE_H));

  // PM2 process health (best-effort: only when the daemon is readable). Restart-delta over window.
  const apps = pm2Apps();
  if (apps) {
    const prev = readPrevRestart();
    checks.push(logic.classifyPm2(apps, prev, MAX_RESTARTS, PM2_APP));
    const app = apps.find((a) => a && a.name === PM2_APP);
    const current = Number(app?.pm2_env?.restart_time);
    if (Number.isFinite(current)) writePrevRestart(current);
  }

  const decision = logic.decide(checks);
  // Local structured log line — full (non-secret) detail for the operator.
  console.log(
    JSON.stringify({ ok: decision.ok, paging: decision.paging, severity: decision.severity, ts: new Date().toISOString(), base: BASE_URL, checks: decision.checks })
  );

  // Alert only on a PAGING condition, with a bounded, secret-free payload.
  if (decision.paging && process.env.ALERT_WEBHOOK_URL?.trim()) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL.trim(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(logic.buildAlert(decision, new Date().toISOString())),
      });
    } catch {
      // alerting is best-effort; the non-zero exit is the fallback signal for the timer
    }
  }
  process.exit(decision.paging ? 1 : 0);
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, paging: true, ts: new Date().toISOString(), fatal: e?.message || String(e) }));
  process.exit(1);
});
