#!/usr/bin/env bash
# Start ImmBiz Books locally: Local PostgreSQL + FastAPI backend + React frontend.
# Usage: ./run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend-react"
PY="$BACKEND/.venv/bin/python"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# 1. Ensure local PostgreSQL is running
PG_BIN="/opt/homebrew/opt/postgresql@17/bin"
PG_DATA="/opt/homebrew/var/postgresql@17"
if [ -d "$PG_DATA" ] && command -v "$PG_BIN/pg_isready" >/dev/null 2>&1; then
  if ! "$PG_BIN/pg_isready" -h localhost -p 5432 -q; then
    echo "[run] starting local PostgreSQL 17..."
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l /opt/homebrew/var/log/postgresql@17.log start
    sleep 2
  fi
  echo "[run] local PostgreSQL is ready (localhost:5432/masters_db)"
fi

echo "[run] starting backend on :$BACKEND_PORT ..."
(
  cd "$BACKEND"
  PYTHONPATH="$BACKEND" "$PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "[run] starting frontend on :4300 ..."
(
  cd "$FRONTEND"
  npm run dev
) &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "[run] shutting down ..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[run] backend:  http://127.0.0.1:$BACKEND_PORT  (docs at /docs)"
echo "[run] frontend: http://localhost:4300"
echo "[run] login:    admin / Admin@123  or  kumaraids2006@gmail.com / Admin@123"
echo "[run] press Ctrl+C to stop both."

wait
