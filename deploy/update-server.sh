#!/usr/bin/env bash
# Kod güncellemesi sonrası (WinSCP upload → sunucuda):
#   ./deploy/update-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export AFF_SITE_ROOT="$ROOT"

echo "[update] npm ci + build..."
npm ci
npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe aff-site >/dev/null 2>&1; then
    pm2 reload deploy/ecosystem.config.cjs --update-env
    echo "[update] PM2 reload tamam."
  else
    echo "[update] PM2'de aff-site yok — pm2 start deploy/ecosystem.config.cjs"
  fi
else
  echo "[update] PM2 yok; elle: npm run start"
fi
