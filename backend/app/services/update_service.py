"""Software update service.

Implements zero-cost, serverless updates powered by GitHub repository:
- Checks GitHub API for new commits or release tags on main branch
- Safe offline fallback (returns offline status if no Wi-Fi, never hangs)
- Preserves local SQLite database (immbiz.db) and local environment (.env)
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

REPO_OWNER_NAME = "kumarimmbizsoft-dev/local_audit"
GITHUB_COMMITS_API = f"https://api.github.com/repos/{REPO_OWNER_NAME}/commits/main"
GITHUB_ZIP_URL = f"https://github.com/{REPO_OWNER_NAME}/archive/refs/heads/main.zip"


class UpdateService:
    @staticmethod
    def _project_root() -> Path:
        # app/services/update_service.py -> app -> backend -> root
        return Path(__file__).resolve().parents[3]

    @classmethod
    def get_current_version_info(cls) -> Dict[str, Any]:
        root = cls._project_root()
        ver_file = root / "version.json"
        data = {
            "version": "2.0.1",
            "commit_hash": "unknown",
            "build_date": "2026-10-11",
            "channel": "stable",
        }
        if ver_file.exists():
            try:
                with open(ver_file, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    data.update(loaded)
            except Exception as e:
                logger.warning("Could not parse version.json: %s", e)

        # Check git if available
        git_dir = root / ".git"
        if git_dir.exists():
            try:
                out = subprocess.check_output(
                    ["git", "rev-parse", "--short", "HEAD"],
                    cwd=str(root),
                    timeout=2,
                    stderr=subprocess.DEVNULL,
                ).decode().strip()
                if out:
                    data["commit_hash"] = out
            except Exception:
                pass

        return data

    @classmethod
    def check_for_updates(cls) -> Dict[str, Any]:
        current = cls.get_current_version_info()
        cur_hash = current.get("commit_hash", "")[:7]

        req = urllib.request.Request(
            GITHUB_COMMITS_API,
            headers={
                "User-Agent": "ImmBiz-Books-Desktop-App",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status != 200:
                    return {
                        "update_available": False,
                        "offline": False,
                        "current_version": current.get("version"),
                        "message": "Update service temporarily unavailable",
                    }
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            # When offline or Wi-Fi not available, safely return offline status
            return {
                "update_available": False,
                "offline": True,
                "current_version": current.get("version"),
                "current_hash": cur_hash,
                "message": "Offline (no internet connection to update server)",
            }

        remote_sha = data.get("sha", "")[:7]
        commit_info = data.get("commit", {})
        commit_msg = commit_info.get("message", "New features and fixes").split("\n")[0]
        commit_date = commit_info.get("author", {}).get("date", "")

        is_new = bool(remote_sha and cur_hash and cur_hash != "unknown" and remote_sha != cur_hash)

        return {
            "update_available": is_new,
            "offline": False,
            "current_version": current.get("version"),
            "current_hash": cur_hash,
            "latest_hash": remote_sha,
            "commit_message": commit_msg,
            "commit_date": commit_date,
            "channel": current.get("channel", "stable"),
        }

    @classmethod
    def apply_update(cls) -> Dict[str, Any]:
        root = cls._project_root()
        git_dir = root / ".git"

        # Method 1: If Git is present, use git pull
        if git_dir.exists():
            try:
                subprocess.check_call(
                    ["git", "pull", "origin", "main"],
                    cwd=str(root),
                    timeout=30,
                )
                new_info = cls.get_current_version_info()
                return {
                    "status": "success",
                    "method": "git",
                    "message": "Update downloaded and installed successfully!",
                    "new_version": new_info.get("version"),
                    "new_hash": new_info.get("commit_hash"),
                }
            except Exception as e:
                logger.error("Git pull update failed, trying direct archive sync: %s", e)

        # Method 2: Direct ZIP sync from GitHub (preserves database immbiz.db and .env)
        tmp_zip = root / "backend" / "update_download.zip"
        extract_dir = root / "backend" / "update_extracted"

        req = urllib.request.Request(
            GITHUB_ZIP_URL,
            headers={"User-Agent": "ImmBiz-Books-Desktop-App"},
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                with open(tmp_zip, "wb") as f:
                    f.write(resp.read())

            if extract_dir.exists():
                shutil.rmtree(extract_dir)

            with zipfile.ZipFile(tmp_zip, "r") as zf:
                zf.extractall(extract_dir)

            # Find the top-level directory in the extracted zip (e.g., local_audit-main)
            subdirs = [d for d in extract_dir.iterdir() if d.is_dir()]
            source_root = subdirs[0] if subdirs else extract_dir

            # Protected paths that must NEVER be overwritten
            protected = {
                "immbiz.db",
                "immbiz.db-wal",
                "immbiz.db-shm",
                ".env",
                ".venv",
                "__pycache__",
                "scratch",
            }

            # Copy files across
            for item in source_root.rglob("*"):
                if item.is_dir():
                    continue
                rel_path = item.relative_to(source_root)
                parts = set(rel_path.parts)
                if parts & protected:
                    continue

                target_file = root / rel_path
                target_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, target_file)

            # Cleanup temporary files
            if tmp_zip.exists():
                tmp_zip.unlink()
            if extract_dir.exists():
                shutil.rmtree(extract_dir)

            new_info = cls.get_current_version_info()
            return {
                "status": "success",
                "method": "archive",
                "message": "Update downloaded and installed successfully!",
                "new_version": new_info.get("version"),
                "new_hash": new_info.get("commit_hash"),
            }

        except Exception as e:
            logger.exception("Failed to apply update: %s", e)
            if tmp_zip.exists():
                tmp_zip.unlink()
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
            raise RuntimeError(f"Update failed: {str(e)}")
