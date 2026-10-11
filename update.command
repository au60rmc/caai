#!/usr/bin/env bash
# Double-click this file in Finder on Mac to update ImmBiz Books to the latest version.
cd "$(dirname "$0")"

echo "=================================================="
echo " ImmBiz Books - One-Click Updater (macOS)"
echo "=================================================="
echo

echo "[*] Checking internet connection..."
if ! ping -c 1 8.8.8.8 >/dev/null 2>&1; then
  echo "[ERROR] No internet connection. Please connect to Wi-Fi and try again."
  read -p "Press Enter to exit..."
  exit 1
fi
echo "[OK] Connected to internet."
echo

if [ -d ".git" ] && command -v git >/dev/null 2>&1; then
  echo "[*] Pulling latest updates from GitHub..."
  git pull origin main
else
  echo "[*] Downloading latest update archive from GitHub..."
  curl -sSL "https://github.com/kumarimmbizsoft-dev/local_audit/archive/refs/heads/main.zip" -o /tmp/immbiz_update.zip
  unzip -q -o /tmp/immbiz_update.zip -d /tmp/immbiz_extracted
  
  SOURCE_DIR=$(find /tmp/immbiz_extracted -mindepth 1 -maxdepth 1 -type d | head -n 1)
  if [ -n "$SOURCE_DIR" ]; then
    rsync -av --exclude="immbiz.db*" --exclude=".env" --exclude=".venv" "$SOURCE_DIR/" "./"
  fi
  rm -rf /tmp/immbiz_update.zip /tmp/immbiz_extracted
fi

echo
echo "=================================================="
echo " [OK] ImmBiz Books is now up to date!"
echo " Your offline database (immbiz.db) is 100% safe."
echo "=================================================="
echo
read -p "Press Enter to start ImmBiz Books now..."
exec ./start.command
