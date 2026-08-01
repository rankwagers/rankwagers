#!/usr/bin/env bash
# Rollback to previous release artifact without rebuild.
# Usage: RW_ROOT=/opt/rankwagers BASE_URL=https://staging.example ./scripts/rollback-release.sh
set -euo pipefail

RW_ROOT="${RW_ROOT:-/opt/rankwagers}"
APP_NAME="${PM2_APP_NAME:-aff-site}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
CURRENT="$RW_ROOT/current"
PREVIOUS="$RW_ROOT/previous"
RESULT_FILE="${ROLLBACK_RESULT_FILE:-$RW_ROOT/shared/logs/rollback-last.json}"

mkdir -p "$(dirname "$RESULT_FILE")"

fail() {
  local code="$1" msg="$2"
  cat > "$RESULT_FILE" <<EOF
{"ok":false,"code":"$code","message":"$msg","ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
  echo "[rollback] FAIL $code: $msg" >&2
  exit 1
}

[[ -L "$PREVIOUS" || -d "$PREVIOUS" ]] || fail "previous_missing" "previous release symlink/dir missing"
PREV_TARGET="$(readlink -f "$PREVIOUS")"
[[ -d "$PREV_TARGET/.next" ]] || fail "previous_invalid" "previous release missing .next"
CUR_TARGET="$(readlink -f "$CURRENT" 2>/dev/null || true)"

# Optional schema hint file — do not auto-run destructive SQL
if [[ -f "$PREV_TARGET/migrations-present.txt" && -f "$CURRENT/migrations-present.txt" ]]; then
  if ! diff -q "$PREV_TARGET/migrations-present.txt" "$CURRENT/migrations-present.txt" >/dev/null 2>&1; then
    echo "[rollback] WARN migration file inventory differs — verify DB compatibility before continuing"
    if [[ "${ALLOW_MIGRATION_MISMATCH:-}" != "1" ]]; then
      fail "migration_mismatch" "set ALLOW_MIGRATION_MISMATCH=1 after operator review"
    fi
  fi
fi

# Swap: current <-> previous
ln -sfn "$PREV_TARGET" "${CURRENT}.next"
mv -Tf "${CURRENT}.next" "$CURRENT"
if [[ -n "$CUR_TARGET" ]]; then
  ln -sfn "$CUR_TARGET" "$PREVIOUS"
fi

export AFF_SITE_ROOT="$CURRENT"
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload "$CURRENT/deploy/ecosystem.config.cjs" --update-env || fail "pm2_reload" "pm2 reload failed"
fi

sleep 2
LIVE="$(curl -fsS -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" || true)"
[[ "$LIVE" == "200" ]] || {
  # attempt restore original current
  if [[ -n "$CUR_TARGET" ]]; then
    ln -sfn "$CUR_TARGET" "${CURRENT}.next"
    mv -Tf "${CURRENT}.next" "$CURRENT"
    [[ -n "$PREV_TARGET" ]] && ln -sfn "$PREV_TARGET" "$PREVIOUS"
    pm2 reload "$CURRENT/deploy/ecosystem.config.cjs" --update-env || true
  fi
  fail "liveness_failed" "health returned $LIVE after rollback"
}

READY="$(curl -fsS -o /tmp/rw-ready.json -w '%{http_code}' "$BASE_URL/api/health/ready" || true)"
# Accept 200 (ready) or 503 (degraded/unhealthy documented) — operator must interpret
if [[ "$READY" != "200" && "$READY" != "503" ]]; then
  fail "readiness_unreachable" "ready returned $READY"
fi

cat > "$RESULT_FILE" <<EOF
{
  "ok": true,
  "code": "rolled_back",
  "previous": "$(basename "$PREV_TARGET")",
  "restoredAsCurrent": "$(basename "$PREV_TARGET")",
  "liveness": $LIVE,
  "readinessStatus": $READY,
  "ts": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
echo "[rollback] ok -> $(basename "$PREV_TARGET")"
