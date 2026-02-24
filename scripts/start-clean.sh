#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[start-clean] Stopping any stale local app/worker processes..."
bash scripts/stop-local-stack.sh

echo "[start-clean] Starting fresh postgres-primary stack..."
exec bash scripts/start-postgres-primary.sh "$@"
