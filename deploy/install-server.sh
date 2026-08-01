#!/usr/bin/env bash
# İlk kurulum veya tam yeniden build (sunucuda aff-site kökünden):
#   chmod +x deploy/install-server.sh
#   ./deploy/install-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[install] Root: $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js bulunamadı. Önce Node 18+ kurun."
  exit 1
fi

if [[ ! -f .env ]] && [[ ! -f .env.local ]]; then
  echo "[install] UYARI: .env veya .env.local yok. .env.example'dan kopyalayın."
fi

echo "[install] npm ci..."
npm ci

echo "[install] next build..."
npm run build

TELEGRAM_DIR="$ROOT/telegram-eng"
if [[ -d "$TELEGRAM_DIR" ]]; then
  echo "[install] telegram-eng venv..."
  if [[ ! -d "$TELEGRAM_DIR/.venv" ]]; then
    python3 -m venv "$TELEGRAM_DIR/.venv"
  fi
  # shellcheck source=/dev/null
  source "$TELEGRAM_DIR/.venv/bin/activate"
  pip install -q -r "$TELEGRAM_DIR/requirements.txt"
  deactivate || true
  if [[ ! -f "$TELEGRAM_DIR/.env" ]]; then
    echo "[install] UYARI: telegram-eng/.env yok — bot çalışmaz; .env.example'dan kopyalayın."
  fi
fi

INVITE_DIR="$ROOT/telegram-invite-bots"
if [[ -d "$INVITE_DIR" ]]; then
  echo "[install] telegram-invite-bots venv..."
  if [[ ! -d "$INVITE_DIR/.venv" ]]; then
    python3 -m venv "$INVITE_DIR/.venv"
  fi
  # shellcheck source=/dev/null
  source "$INVITE_DIR/.venv/bin/activate"
  pip install -q -r "$INVITE_DIR/requirements.txt"
  deactivate || true
  if [[ ! -f "$INVITE_DIR/.env" ]]; then
    echo "[install] UYARI: telegram-invite-bots/.env yok — VIP bot çalışmaz."
  fi
  mkdir -p "$INVITE_DIR/data"
fi

mkdir -p "$ROOT/data" "$ROOT/telegram-eng/data"

echo "[install] Bitti. PM2:"
echo "  export AFF_SITE_ROOT=$ROOT"
echo "  pm2 start deploy/ecosystem.config.cjs"
echo "  pm2 save"
