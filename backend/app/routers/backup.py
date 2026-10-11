"""Backup / restore for the local SQLite database."""
import datetime
import os
import sqlite3

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from app.core.database import IS_SQLITE, engine
from app.core.deps import require_permission
from app.core.feature_codes import FEATURE_SYSTEM_SETTING

router = APIRouter(prefix="/api/system", tags=["Backup"])

_SQLITE_MAGIC = b"SQLite format 3\x00"


def _db_path() -> str:
    path = engine.url.database
    if not path:
        raise HTTPException(status_code=400, detail="No local database file")
    return path


@router.get(
    "/backup",
    dependencies=[Depends(require_permission(FEATURE_SYSTEM_SETTING, "view"))],
)
def backup_database():
    if not IS_SQLITE:
        raise HTTPException(
            status_code=400,
            detail="Backup is only supported for local (SQLite) installs",
        )
    src = _db_path()
    data_dir = os.path.dirname(os.path.abspath(src))
    backups_dir = os.path.join(data_dir, "backups")
    os.makedirs(backups_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(backups_dir, f"immbiz-{ts}.db")

    src_conn = sqlite3.connect(src)
    dst_conn = sqlite3.connect(dest)
    try:
        with dst_conn:
            src_conn.backup(dst_conn)
    finally:
        src_conn.close()
        dst_conn.close()

    return FileResponse(
        dest,
        media_type="application/octet-stream",
        filename=f"immbiz-{ts}.db",
    )


@router.post(
    "/restore",
    dependencies=[Depends(require_permission(FEATURE_SYSTEM_SETTING, "write"))],
)
async def restore_database(file: UploadFile = File(...)):
    if not IS_SQLITE:
        raise HTTPException(
            status_code=400,
            detail="Restore is only supported for local (SQLite) installs",
        )
    contents = await file.read()
    if not contents.startswith(_SQLITE_MAGIC):
        raise HTTPException(
            status_code=400, detail="The selected file is not a valid database"
        )

    src = _db_path()
    data_dir = os.path.dirname(os.path.abspath(src))
    pending = os.path.join(data_dir, "restore_pending.db")
    with open(pending, "wb") as f:
        f.write(contents)

    return JSONResponse(
        content={
            "status": "SUCCESS",
            "message": "Restore staged. Close and reopen the app to apply it.",
        }
    )
