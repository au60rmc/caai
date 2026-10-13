#!/usr/bin/env bash
# Double-click this file in Finder to launch ImmBiz Books with 1 click on Mac.
cd "$(dirname "$0")"

echo "=================================================="
echo " Starting ImmBiz Books (Local Full Stack)"
echo "=================================================="

# Check and start local PostgreSQL if needed
PG_BIN="/opt/homebrew/opt/postgresql@17/bin"
PG_DATA="/opt/homebrew/var/postgresql@17"
if [ -d "$PG_DATA" ] && [ -x "$PG_BIN/pg_isready" ]; then
  if ! "$PG_BIN/pg_isready" -h localhost -p 5432 -q; then
    echo "[1/3] Starting local PostgreSQL 17..."
    "$PG_BIN/pg_ctl" -D "$PG_DATA" -l /opt/homebrew/var/log/postgresql@17.log start
    sleep 2
  else
    echo "[1/3] PostgreSQL is already running."
  fi
fi

# Start Backend
echo "[2/3] Starting FastAPI Backend on port 8000..."
(
  cd backend
  PYTHONPATH=. .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

# Start Frontend
echo "[3/3] Starting React Frontend on port 4300..."
(
  cd frontend-react
  npm run dev
) &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "Shutting down ImmBiz Books..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM EXIT

# Wait a moment for servers to spin up, then open in standalone desktop window
(
  sleep 2
  echo "Opening ImmBiz Books in standalone desktop window..."
  if [ -d "/Applications/Google Chrome.app" ]; then
    open -na "Google Chrome" --args --app="http://localhost:4300" --start-maximized
  elif [ -d "/Applications/Microsoft Edge.app" ]; then
    open -na "Microsoft Edge" --args --app="http://localhost:4300" --start-maximized
  elif [ -d "/Applications/Brave Browser.app" ]; then
    open -na "Brave Browser" --args --app="http://localhost:4300" --start-maximized
  else
    open "http://localhost:4300"
  fi
) &

echo "=================================================="
echo " ImmBiz Books is running!"
echo " App URL:     http://localhost:4300"
echo " API Docs:    http://127.0.0.1:8000/docs"
echo " Login:       admin / Admin@123"
echo " Press Ctrl+C in this window to stop everything."
echo "=================================================="

wait
