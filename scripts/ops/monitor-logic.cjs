/**
 * Pure, I/O-free decision logic for the production health monitor.
 *
 * RF-1 (readiness-aware paging) + RF-2 (aff-site restart-delta). Kept separate from
 * `health-monitor.mjs` so it is deterministic and unit-testable: NO fs / network / process /
 * clock in here. `health-monitor.mjs` does the I/O and calls these classifiers.
 *
 * Paging vs non-paging (RF-1):
 *   PAGE  — application unavailable (liveness), app unreachable, persistence corruption/
 *           unreachable DB (readiness persistence checks), aff-site missing/offline, restart churn.
 *   WARN  — serving-but-degraded: optional/known readiness degradation (incl. raw-provider-archive
 *           OFF), malformed/unreachable readiness, backup/restore/cron freshness. Logged, never paged.
 *
 * Alert payloads carry ONLY bounded reason codes + a whitelist of numeric/enum detail — never a
 * raw health body, a URL, a secret, or an unbounded-cardinality label.
 *
 * CommonJS on purpose: importable by `health-monitor.mjs` (ESM default import) and by the tsx
 * test runner alike, with no ESM/CJS interop surprises.
 */

/** Bounded reason codes. Fixed set → safe as alert labels (no unbounded cardinality). */
const REASON = Object.freeze({
  OK: "ok",
  APP_UNREACHABLE: "app_unreachable",
  LIVENESS_DOWN: "liveness_down",
  PERSISTENCE_DEGRADED: "persistence_degraded",
  READINESS_OPTIONAL_DEGRADED: "readiness_optional_degraded",
  READINESS_MALFORMED: "readiness_malformed",
  READINESS_UNREACHABLE: "readiness_unreachable",
  PM2_APP_MISSING: "pm2_app_missing",
  PM2_APP_OFFLINE: "pm2_app_offline",
  PM2_RESTART_CHURN: "pm2_restart_churn",
  BACKUP_ABSENT: "backup_absent",
  BACKUP_STALE: "backup_stale",
  RESTORE_STALE: "restore_stale",
  CRON_STALE: "cron_stale",
});

const SEVERITY = Object.freeze({ OK: "ok", WARN: "warn", PAGE: "page" });

/**
 * Readiness checks whose non-ok state is a true PAGING persistence condition: the DB ping plus the
 * durable stores whose PostgreSQL cutover is CONFIRMED (odds_history, provider_snapshots).
 *
 * `attribution_store` is deliberately EXCLUDED: its live state is `degraded` (memory) and that is an
 * accepted, known degradation (its cutover is not among the confirmed authoritative facts). Paging on
 * it would false-page on a known-degraded dependency — the exact anti-pattern RF-1 forbids. It is
 * still surfaced as a non-paging WARN via the optional-degradation path. Add it here only once its
 * Postgres cutover is confirmed.
 */
const PERSISTENCE_PAGING_CHECKS = Object.freeze([
  "db",
  "odds_history",
  "provider_snapshots",
]);

/** Detail keys allowed into an alert payload — bounded numbers / small enums only. */
const ALERT_DETAIL_KEYS = Object.freeze([
  "status",
  "ageH",
  "maxH",
  "delta",
  "unstable",
  "maxDelta",
  "app",
  "failing",
]);

function mkCheck(name, severity, reason, detail) {
  return { name, severity, reason, detail: detail || {} };
}

function round1(n) {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n * 10) / 10 : n;
}

/** Liveness: unreachable (non-number status) or non-200 → PAGE. */
function classifyLiveness(status) {
  if (typeof status !== "number") {
    return mkCheck("liveness", SEVERITY.PAGE, REASON.APP_UNREACHABLE, { status: String(status) });
  }
  if (status !== 200) {
    return mkCheck("liveness", SEVERITY.PAGE, REASON.LIVENESS_DOWN, { status });
  }
  return mkCheck("liveness", SEVERITY.OK, REASON.OK, { status });
}

/**
 * Readiness (RF-1). Liveness already decides "serving"; readiness only decides whether a
 * degradation is paging. A failing PERSISTENCE check pages; any other failing check is a known /
 * optional degradation → WARN (logged, non-paging). Unreachable or malformed → WARN (serving).
 *
 * @param {number|string} status  HTTP status number, or a non-number on fetch error.
 * @param {{checks?:Array<{name?:string,status?:string}>}|null} body  parsed readiness JSON.
 * @param {readonly string[]} [persistencePaging]
 */
function classifyReadiness(status, body, persistencePaging) {
  const pageNames = new Set(persistencePaging || PERSISTENCE_PAGING_CHECKS);
  if (typeof status !== "number") {
    return mkCheck("readiness", SEVERITY.WARN, REASON.READINESS_UNREACHABLE, { status: String(status) });
  }
  const checks = body && Array.isArray(body.checks) ? body.checks : null;
  if (!checks) {
    return mkCheck("readiness", SEVERITY.WARN, REASON.READINESS_MALFORMED, { status });
  }
  const failing = checks.filter(
    (c) => c && typeof c.name === "string" && typeof c.status === "string" && c.status !== "ok"
  );
  const persistenceFailing = failing.filter((c) => pageNames.has(c.name)).map((c) => c.name);
  if (persistenceFailing.length) {
    return mkCheck("readiness", SEVERITY.PAGE, REASON.PERSISTENCE_DEGRADED, {
      status,
      failing: persistenceFailing,
    });
  }
  if (failing.length) {
    return mkCheck("readiness", SEVERITY.WARN, REASON.READINESS_OPTIONAL_DEGRADED, {
      status,
      failing: failing.map((c) => c.name),
    });
  }
  return mkCheck("readiness", SEVERITY.OK, REASON.OK, { status });
}

/**
 * PM2 process health (RF-2). Targets a single named app (aff-site) — the intentionally stopped
 * rankdev `rankwagers` app is simply never selected. Pages on: app missing, app not online, or a
 * restart DELTA within the observation window above the threshold. The lifetime historic count
 * (e.g. 167k) never pages — only `restart_time - prevRestartTime`. First run (prev null) → delta 0.
 *
 * @param {Array<{name?:string,pm2_env?:{status?:string,restart_time?:number,unstable_restarts?:number}}>} apps
 * @param {number|null} prevRestartTime  restart_time recorded on the previous run (null = first run).
 * @param {number} maxDelta  max restarts allowed within the window.
 * @param {string} appName   authoritative app name (aff-site).
 */
function classifyPm2(apps, prevRestartTime, maxDelta, appName) {
  const list = Array.isArray(apps) ? apps : [];
  const app = list.find((a) => a && a.name === appName);
  if (!app) {
    return mkCheck("process_churn", SEVERITY.PAGE, REASON.PM2_APP_MISSING, { app: appName });
  }
  const env = app.pm2_env || {};
  if (env.status !== "online") {
    return mkCheck("process_churn", SEVERITY.PAGE, REASON.PM2_APP_OFFLINE, {
      app: appName,
      status: String(env.status),
    });
  }
  const restarts = Number(env.restart_time) || 0;
  const unstable = Number(env.unstable_restarts) || 0;
  const delta =
    prevRestartTime == null || !Number.isFinite(prevRestartTime)
      ? 0
      : Math.max(0, restarts - prevRestartTime);
  if (delta > maxDelta || unstable > maxDelta) {
    return mkCheck("process_churn", SEVERITY.PAGE, REASON.PM2_RESTART_CHURN, {
      delta,
      unstable,
      maxDelta,
    });
  }
  return mkCheck("process_churn", SEVERITY.OK, REASON.OK, { delta, unstable });
}

/** Backup freshness → non-paging. Absent (automation incomplete) or stale/failed → WARN, logged. */
function classifyBackup(present, ok, ageH, maxH) {
  if (!present) {
    return mkCheck("backup_fresh", SEVERITY.WARN, REASON.BACKUP_ABSENT, { maxH });
  }
  if (ok !== true || !(ageH <= maxH)) {
    return mkCheck("backup_fresh", SEVERITY.WARN, REASON.BACKUP_STALE, {
      ok: ok === true,
      ageH: round1(ageH),
      maxH,
    });
  }
  return mkCheck("backup_fresh", SEVERITY.OK, REASON.OK, { ageH: round1(ageH), maxH });
}

/** Restore-drill freshness → non-paging. Absent = OK (drill optional); present & stale/failed → WARN. */
function classifyRestore(present, ok, ageH, maxH) {
  if (!present) {
    return mkCheck("restore_drill_fresh", SEVERITY.OK, REASON.OK, {});
  }
  if (ok !== true || !(ageH <= maxH)) {
    return mkCheck("restore_drill_fresh", SEVERITY.WARN, REASON.RESTORE_STALE, {
      ok: ok === true,
      ageH: round1(ageH),
      maxH,
    });
  }
  return mkCheck("restore_drill_fresh", SEVERITY.OK, REASON.OK, { ageH: round1(ageH), maxH });
}

/** Cron/data freshness → non-paging. Absent = OK; stale → WARN, logged. */
function classifyCron(ageH, maxH) {
  if (ageH == null) {
    return mkCheck("cron_fresh", SEVERITY.OK, REASON.OK, {});
  }
  if (!(ageH <= maxH)) {
    return mkCheck("cron_fresh", SEVERITY.WARN, REASON.CRON_STALE, { ageH: round1(ageH), maxH });
  }
  return mkCheck("cron_fresh", SEVERITY.OK, REASON.OK, { ageH: round1(ageH), maxH });
}

/** Fold classified checks into a decision. Pages iff any check is PAGE. */
function decide(checks) {
  const list = (checks || []).filter(Boolean);
  const paging = list.some((c) => c.severity === SEVERITY.PAGE);
  const warning = list.some((c) => c.severity === SEVERITY.WARN);
  return {
    ok: !paging && !warning,
    paging,
    severity: paging ? SEVERITY.PAGE : warning ? SEVERITY.WARN : SEVERITY.OK,
    checks: list,
  };
}

/** Strip a detail object down to the bounded whitelist — no secrets, no raw payloads. */
function boundedDetail(detail) {
  const out = {};
  if (!detail || typeof detail !== "object") return out;
  for (const key of ALERT_DETAIL_KEYS) {
    if (detail[key] === undefined) continue;
    const v = detail[key];
    if (Array.isArray(v)) {
      out[key] = v.filter((x) => typeof x === "string").slice(0, 16);
    } else if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Build the webhook alert from a decision — ONLY the paging checks, and ONLY bounded reason codes +
 * whitelisted numeric/enum detail. Never includes the readiness body, a URL, or a secret.
 */
function buildAlert(decision, ts) {
  const failing = decision.checks
    .filter((c) => c.severity === SEVERITY.PAGE)
    .map((c) => ({ name: c.name, reason: c.reason, detail: boundedDetail(c.detail) }));
  return {
    text: `RankWagers PAGING: ${failing.map((f) => f.reason).join(", ") || "unknown"}`,
    failing,
    ts,
  };
}

module.exports = {
  REASON,
  SEVERITY,
  PERSISTENCE_PAGING_CHECKS,
  classifyLiveness,
  classifyReadiness,
  classifyPm2,
  classifyBackup,
  classifyRestore,
  classifyCron,
  decide,
  boundedDetail,
  buildAlert,
};
