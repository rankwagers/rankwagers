/**
 * ⛔ RETIRED — DO NOT USE. Tombstone kept for historical context only (RF-3).
 *
 * This file previously defined a SECOND production PM2 app, `rankwagers-prod`, that also listened
 * on port 3000 (default `RANKWAGERS_PORT || PORT || 3000`, cwd `/opt/rankwagers/current`).
 *
 * The single authoritative production app is **`aff-site`**, defined in
 * `deploy/ecosystem.config.cjs` (root PM2 daemon, cwd `/var/www/rankwagers`, runs `next` directly,
 * `-p 3000`). Running BOTH configs bound two Next servers to `:3000` → `EADDRINUSE` — the exact
 * failure that produced the ~167k-restart crash-loop on the obsolete rankdev daemon.
 *
 * This tombstone intentionally exports NO PM2 app and THROWS on load, so it can never again be
 * used to start a second process on port 3000. Requiring it (e.g. `pm2 start ...`) fails loudly.
 *
 * To run production:
 *   sudo PM2_HOME=/root/.pm2 pm2 start deploy/ecosystem.config.cjs --only aff-site
 *
 * Historical definition (unexported, for the record):
 *   apps: [{
 *     name: process.env.RANKWAGERS_PM2_NAME || "rankwagers-prod",
 *     cwd: process.env.AFF_SITE_ROOT || "/opt/rankwagers/current",
 *     script: "<root>/node_modules/next/dist/bin/next",
 *     args: `start -p ${process.env.RANKWAGERS_PORT || process.env.PORT || "3000"}`,
 *     instances: 1, exec_mode: "fork", autorestart: true, max_restarts: 10, min_uptime: "10s",
 *     kill_timeout: 10000, listen_timeout: 10000, exp_backoff_restart_delay: 200,
 *     max_memory_restart: "700M",
 *   }]
 */

throw new Error(
  "deploy/ecosystem.rankwagers.cjs is RETIRED (RF-3). Use deploy/ecosystem.config.cjs (app: aff-site) instead. " +
    "This tombstone defines no PM2 app and must never start a process on port 3000."
);
