/**
 * PM2 — aff-site (Next.js) + telegram-eng + telegram-invite-bots
 *
 * Kurulum:
 *   export AFF_SITE_ROOT=/var/www/aff-site   # sunucudaki gerçek yol
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
const path = require("path");

const root = process.env.AFF_SITE_ROOT || path.resolve(__dirname, "..");
const telegramDir = path.join(root, "telegram-eng");
const inviteDir = path.join(root, "telegram-invite-bots");
const venvPython = path.join(telegramDir, ".venv", "bin", "python");
const inviteVenvPython = path.join(inviteDir, ".venv", "bin", "python");
const fs = require("fs");
const telegramInterpreter = fs.existsSync(venvPython) ? venvPython : "python3";
const inviteInterpreter = fs.existsSync(inviteVenvPython)
  ? inviteVenvPython
  : telegramInterpreter;

module.exports = {
  apps: [
    {
      name: "aff-site",
      cwd: root,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      // Reliability hardening — this is the SINGLE authoritative production config (RF-3).
      // (`deploy/ecosystem.rankwagers.cjs` is a retired tombstone; do not start it.)
      // graceful-shutdown window < SIGKILL escalation; bounded listen wait; crash-loop backoff;
      // auto-recycle a leaking Next server. Runs `next` directly so PM2 signals reach the server
      // (never `npm start`, which does not forward SIGTERM reliably).
      // NOTE: kill_timeout (60000) must stay >= lib/monitoring/shutdown.ts MAX_SIGNAL_GRACE_MS + margin.
      // 60s clears the 45s capture deadline so a restart never SIGKILLs a mid-append writer,
      // which would leave a torn line in the permanent append-only evidence archive.
      kill_timeout: 60000,
      listen_timeout: 10000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: "700M",
    },
    {
      name: "telegram-eng",
      cwd: telegramDir,
      script: "main.py",
      interpreter: telegramInterpreter,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
    },
    {
      name: "telegram-invite",
      cwd: inviteDir,
      script: "main.py",
      interpreter: inviteInterpreter,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "30s",
    },
  ],
};
