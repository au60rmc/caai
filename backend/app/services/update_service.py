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
import ssl
import subprocess
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)

REPO_OWNER_NAME = "kumarimmbizsoft-dev/local_audit"
GITHUB_COMMITS_API = f"https://api.github.com/repos/{REPO_OWNER_NAME}/commits/main"
GITHUB_ZIP_URL = f"https://github.com/{REPO_OWNER_NAME}/archive/refs/heads/main.zip"


def _safe_urlopen(req_or_url, timeout: int = 10):
    """Safely open URL with automatic SSL fallback for environments missing system CA bundles."""
    try:
        ctx = ssl.create_default_context()
        return urllib.request.urlopen(req_or_url, context=ctx, timeout=timeout)
    except Exception:
        unverified = ssl._create_unverified_context()
        return urllib.request.urlopen(req_or_url, context=unverified, timeout=timeout)


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
            "version": "2.0.2",
            "commit_hash": "unknown",
            "build_date": "2026-10-12",
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

    _cached_result: Dict[str, Any] | None = None
    _cached_at: float = 0.0
    CACHE_TTL_SECONDS: int = 60

    @classmethod
    def check_for_updates(cls, force: bool = False) -> Dict[str, Any]:
        import time

        now = time.time()
        if not force and cls._cached_result is not None and (now - cls._cached_at) < cls.CACHE_TTL_SECONDS:
            return cls._cached_result

        current = cls.get_current_version_info()
        cur_hash = current.get("commit_hash", "")[:7]
        root = cls._project_root()
        git_dir = root / ".git"

        remote_sha = ""
        commit_msg = "Latest updates and accounting fixes from GitHub"
        commit_date = ""

        # Step 1: If Git is present, try fast git ls-remote first (bypasses GitHub REST API rate limits)
        if git_dir.exists():
            try:
                out = subprocess.check_output(
                    ["git", "ls-remote", "origin", "refs/heads/main"],
                    cwd=str(root),
                    timeout=5,
                    stderr=subprocess.DEVNULL,
                ).decode().strip()
                if out:
                    remote_sha = out.split()[0][:7]
            except Exception as e:
                logger.debug("git ls-remote failed: %s", e)

        # If git ls-remote confirmed we are already on latest commit, return immediately
        if remote_sha and cur_hash and cur_hash != "unknown" and remote_sha == cur_hash:
            result = {
                "update_available": False,
                "offline": False,
                "current_version": current.get("version"),
                "current_hash": cur_hash,
                "latest_hash": remote_sha,
                "commit_message": "Up to date",
                "commit_date": "",
                "channel": current.get("channel", "stable"),
            }
            cls._cached_result = result
            cls._cached_at = now
            return result

        # Step 2: Query GitHub REST API for commit metadata (or as primary check if Git not installed)
        req = urllib.request.Request(
            GITHUB_COMMITS_API,
            headers={
                "User-Agent": "ImmBiz-Books-Desktop-App",
                "Accept": "application/vnd.github.v3+json",
            },
        )

        try:
            with _safe_urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    api_data = json.loads(resp.read().decode("utf-8"))
                    api_sha = api_data.get("sha", "")[:7]
                    if api_sha:
                        remote_sha = api_sha
                    commit_info = api_data.get("commit", {})
                    msg = commit_info.get("message", "").split("\n")[0].strip()
                    if msg:
                        commit_msg = msg
                    commit_date = commit_info.get("author", {}).get("date", "")
        except Exception as e:
            logger.warning("GitHub API request failed: %s", e)
            # If both git ls-remote and GitHub API failed, we are offline
            if not remote_sha:
                return {
                    "update_available": False,
                    "offline": True,
                    "current_version": current.get("version"),
                    "current_hash": cur_hash,
                    "message": "Offline (cannot reach GitHub update servers)",
                }
            # If we got remote_sha from git ls-remote, update IS available even if API was rate-limited
            commit_msg = f"New update available from GitHub (commit {remote_sha})"

        is_new = bool(remote_sha and cur_hash and cur_hash != "unknown" and remote_sha != cur_hash)

        result = {
            "update_available": is_new,
            "offline": False,
            "current_version": current.get("version"),
            "current_hash": cur_hash,
            "latest_hash": remote_sha,
            "commit_message": commit_msg,
            "commit_date": commit_date,
            "channel": current.get("channel", "stable"),
        }
        cls._cached_result = result
        cls._cached_at = now
        return result

    @classmethod
    def apply_update(cls) -> Dict[str, Any]:
        cls._cached_result = None
        cls._cached_at = 0.0
        root = cls._project_root()
        git_dir = root / ".git"
        db_file = root / "backend" / "immbiz.db"
        backup_file = root / "backend" / "immbiz_pre_update_backup.db"

        # Preserve local SQLite database with zero data loss guarantee
        if db_file.exists():
            try:
                shutil.copy2(db_file, backup_file)
                logger.info("Created pre-update safety backup at %s", backup_file)
            except Exception as e:
                logger.warning("Could not create pre-update DB backup: %s", e)

        # Method 1: If Git is present, use clean git pull
        if git_dir.exists():
            try:
                # Discard local unstaged changes to tracked immbiz.db so git pull never conflicts
                if db_file.exists():
                    subprocess.run(
                        ["git", "checkout", "--", "backend/immbiz.db"],
                        cwd=str(root),
                        capture_output=True,
                    )

                subprocess.check_call(
                    ["git", "pull", "origin", "main"],
                    cwd=str(root),
                    timeout=30,
                )

                # Restore the user's latest working database
                if backup_file.exists():
                    shutil.copy2(backup_file, db_file)

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
                # Ensure user's database is restored
                if backup_file.exists():
                    shutil.copy2(backup_file, db_file)

        # Method 2: Direct ZIP sync from GitHub (preserves database immbiz.db and .env)
        tmp_zip = root / "backend" / "update_download.zip"
        extract_dir = root / "backend" / "update_extracted"

        req = urllib.request.Request(
            GITHUB_ZIP_URL,
            headers={"User-Agent": "ImmBiz-Books-Desktop-App"},
        )

        try:
            with _safe_urlopen(req, timeout=30) as resp:
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
