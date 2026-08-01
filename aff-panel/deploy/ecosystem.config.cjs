/**
 * PM2 — aff-panel (port 9000)
 *   cd /var/www/aff-panel && pm2 start deploy/ecosystem.config.cjs
 */
const path = require("path");

const root = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "aff-panel",
      cwd: root,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 9000",
      env: {
        NODE_ENV: "production",
        PORT: "9000",
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
