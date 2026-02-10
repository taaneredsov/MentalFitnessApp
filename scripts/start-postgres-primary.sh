#!/usr/bin/env bash

set -euo pipefail

# If this script is started from a Rosetta-translated shell on Apple Silicon,
# restart under native arm64 to avoid optional native dependency mismatches.
if [[ "${START_POSTGRES_PRIMARY_FORCE_ARCH:-0}" != "1" ]]; then
  if [[ "$(sysctl -in sysctl.proc_translated 2>/dev/null || echo 0)" == "1" ]]; then
    echo "[start-postgres-primary] Rosetta shell detected; restarting under native arm64..."
    exec env START_POSTGRES_PRIMARY_FORCE_ARCH=1 /usr/bin/arch -arm64 /bin/bash "$0" "$@"
  fi
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5438/mfa}"
export DATA_BACKEND_PROGRAMS="${DATA_BACKEND_PROGRAMS:-postgres_primary}"
export DATA_BACKEND_HABIT_USAGE="${DATA_BACKEND_HABIT_USAGE:-postgres_primary}"
export DATA_BACKEND_METHOD_USAGE="${DATA_BACKEND_METHOD_USAGE:-postgres_primary}"
export DATA_BACKEND_PERSONAL_GOAL_USAGE="${DATA_BACKEND_PERSONAL_GOAL_USAGE:-postgres_primary}"
export USER_FAST_LANE_ENABLED="${USER_FAST_LANE_ENABLED:-true}"
export USER_READTHROUGH_FALLBACK_ENABLED="${USER_READTHROUGH_FALLBACK_ENABLED:-true}"
export SYNC_USER_FALLBACK_POLL_SECONDS="${SYNC_USER_FALLBACK_POLL_SECONDS:-60}"
export FULL_AIRTABLE_POLL_SYNC_ENABLED="${FULL_AIRTABLE_POLL_SYNC_ENABLED:-true}"
export SYNC_FULL_POLL_SECONDS="${SYNC_FULL_POLL_SECONDS:-120}"
export PUSH_NOTIFICATIONS_ENABLED="${PUSH_NOTIFICATIONS_ENABLED:-true}"
export PUSH_NOTIFICATIONS_TEST_MODE="${PUSH_NOTIFICATIONS_TEST_MODE:-true}"
export NOTIFICATION_RECONCILE_SECONDS="${NOTIFICATION_RECONCILE_SECONDS:-120}"
export NOTIFICATION_BATCH_SIZE="${NOTIFICATION_BATCH_SIZE:-20}"
export NOTIFICATION_MAX_RETRIES="${NOTIFICATION_MAX_RETRIES:-6}"
export NOTIFICATION_RETRY_BASE_SECONDS="${NOTIFICATION_RETRY_BASE_SECONDS:-5}"

RUN_BACKFILL="${RUN_BACKFILL:-0}"

echo "[start-postgres-primary] Starting local Postgres on port 5438..."
docker compose -f docker-compose.local.yml up -d postgres

echo "[start-postgres-primary] Running DB migrations..."
npm run db:migrate

if [[ "$RUN_BACKFILL" == "1" ]]; then
  echo "[start-postgres-primary] Running Airtable -> Postgres backfill..."
  npm run backfill:airtable-to-postgres
fi

APP_PID=""
WORKER_PID=""
CLEANED_UP=0

cleanup() {
  if [[ "$CLEANED_UP" == "1" ]]; then
    return
  fi
  CLEANED_UP=1

  set +e
  echo
  echo "[start-postgres-primary] Shutting down..."
  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID"
  fi
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID"
  fi
  wait 2>/dev/null
}

trap cleanup EXIT INT TERM

echo "[start-postgres-primary] Building frontend + server..."
npm run build && npm run build:server

echo "[start-postgres-primary] Starting app on http://localhost:3333 ..."
PORT=3333 node dist-server/server.js &
APP_PID=$!

echo "[start-postgres-primary] Starting sync worker..."
npm run worker:start &
WORKER_PID=$!

echo "[start-postgres-primary] Running."
echo "  APP_PID=$APP_PID"
echo "  WORKER_PID=$WORKER_PID"
echo "  DATABASE_URL=$DATABASE_URL"
echo
echo "Press Ctrl+C to stop both processes."

EXIT_CODE=0

while true; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    wait "$APP_PID" || EXIT_CODE=$?
    echo "[start-postgres-primary] App process exited with code $EXIT_CODE"
    break
  fi

  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    wait "$WORKER_PID" || EXIT_CODE=$?
    echo "[start-postgres-primary] Worker process exited with code $EXIT_CODE"
    break
  fi

  sleep 1
done

exit "$EXIT_CODE"
