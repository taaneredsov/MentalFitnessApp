#!/usr/bin/env bash

set -euo pipefail

echo "[stop-local-stack] Stopping local app/worker processes..."

# Sync workers
pkill -f "dist-server/api/workers/sync-worker.js" 2>/dev/null || true
pkill -f "npm run worker:start" 2>/dev/null || true

# Local Node app server
pkill -f "dist-server/server.js" 2>/dev/null || true

# Optional Vite dev server
pkill -f "vite" 2>/dev/null || true

sleep 1

echo "[stop-local-stack] Remaining matching processes:"
ps aux | rg -n "sync-worker|dist-server/server.js|vite" -S || true

echo "[stop-local-stack] Done."
