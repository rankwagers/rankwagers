#!/usr/bin/env bash
# Versioned release deploy with atomic symlink switch.
# Layout:
#   $RW_ROOT/releases/<id>/
#   $RW_ROOT/current -> releases/<id>
#   $RW_ROOT/previous -> releases/<prev>
#   $RW_ROOT/shared/.env
#
# Usage (on server, after uploading source to a staging build dir):
#   RW_ROOT=/opt/rankwagers SOURCE_DIR=/path/to/built/app ./deploy/release-deploy.sh
#
# Does NOT deploy to production automatically. Set APP_ENV via shared/.env.
set -euo pipefail

RW_ROOT="${RW_ROOT:-/opt/rankwagers}"
SOURCE_DIR="${SOURCE_DIR:-}"
RETENTION="${RELEASE_RETENTION:-5}"
APP_NAME="${PM2_APP_NAME:-aff-site}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "${SOURCE_DIR:-.}" rev-parse --short HEAD 2>/dev/null || echo local)}"

if [[ -z "$SOURCE_DIR" ]]; then
  echo "[release] SOURCE_DIR is required (path containing .next + package.json)" >&2
  exit 2
fi

if [[ ! -d "$SOURCE_DIR/.next" ]]; then
  echo "[release] SOURCE_DIR must contain a built .next directory" >&2
  exit 2
fi

RELEASES="$RW_ROOT/releases"
SHARED="$RW_ROOT/shared"
TARGET="$RELEASES/$RELEASE_ID"
CURRENT="$RW_ROOT/current"
PREVIOUS="$RW_ROOT/previous"

mkdir -p "$RELEASES" "$SHARED/logs"
if [[ ! -f "$SHARED/.env" ]]; then
  echo "[release] missing $SHARED/.env — refuse to deploy without shared env" >&2
  exit 2
fi

echo "[release] preparing $TARGET"
mkdir -p "$TARGET"
# Copy immutable artifact (no .env)
rsync -a --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'shared' \
  "$SOURCE_DIR/" "$TARGET/"

# Install production deps inside release
(
  cd "$TARGET"
  npm ci --omit=dev
)

# Metadata (no secrets)
cat > "$TARGET/release.json" <<EOF
{
  "releaseId": "$RELEASE_ID",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "node": "$(node -v)",
  "retention": $RETENTION
}
EOF

# Link shared env (not copied into artifact tree as a writable .env file copy)
ln -sfn "$SHARED/.env" "$TARGET/.env"

# Atomic switch
PREV_TARGET=""
if [[ -L "$CURRENT" || -e "$CURRENT" ]]; then
  PREV_TARGET="$(readlink -f "$CURRENT" || true)"
fi

ln -sfn "$TARGET" "${CURRENT}.next"
mv -Tf "${CURRENT}.next" "$CURRENT"

if [[ -n "$PREV_TARGET" && "$PREV_TARGET" != "$TARGET" ]]; then
  ln -sfn "$PREV_TARGET" "$PREVIOUS"
fi

# Record migrations present (file inventory — not applied schema)
if [[ -d "$TARGET/db/migrations" ]]; then
  ls "$TARGET/db/migrations" > "$TARGET/migrations-present.txt" || true
fi

# PM2 reload using current symlink
if command -v pm2 >/dev/null 2>&1; then
  export AFF_SITE_ROOT="$CURRENT"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$CURRENT/deploy/ecosystem.config.cjs" --update-env || {
      echo "[release] PM2 reload failed — leaving current at $TARGET; investigate" >&2
      exit 1
    }
  else
    pm2 start "$CURRENT/deploy/ecosystem.config.cjs"
  fi
fi

# Retention cleanup (never delete current/previous)
mapfile -t ALL < <(ls -1 "$RELEASES" | sort)
KEEP=("$RELEASE_ID")
if [[ -L "$PREVIOUS" ]]; then
  KEEP+=("$(basename "$(readlink -f "$PREVIOUS")")")
fi
COUNT=0
for id in "${ALL[@]:+${ALL[@]}}"; do
  skip=0
  for k in "${KEEP[@]}"; do
    [[ "$id" == "$k" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue
  COUNT=$((COUNT + 1))
done
# Delete oldest beyond retention among non-kept
mapfile -t CANDIDATES < <(ls -1 "$RELEASES" | sort)
LIVE=0
for id in "${CANDIDATES[@]}"; do
  keep=0
  for k in "${KEEP[@]}"; do [[ "$id" == "$k" ]] && keep=1 && break; done
  if [[ $keep -eq 1 ]]; then
    LIVE=$((LIVE + 1))
    continue
  fi
done
# Simpler: keep last RETENTION dirs that are not previous/current orphans
while [[ $(ls -1 "$RELEASES" | wc -l) -gt $((RETENTION + 2)) ]]; do
  oldest="$(ls -1 "$RELEASES" | sort | head -n1)"
  keep=0
  for k in "${KEEP[@]}"; do [[ "$oldest" == "$k" ]] && keep=1 && break; done
  if [[ $keep -eq 1 ]]; then
    break
  fi
  echo "[release] pruning $oldest"
  rm -rf "$RELEASES/$oldest"
done

echo "[release] ok releaseId=$RELEASE_ID current=$CURRENT"
