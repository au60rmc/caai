from __future__ import annotations

import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from app.services.update_service import UpdateService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/system", tags=["System Update"])
compat_router = APIRouter(prefix="/system", tags=["System Update (Compat)"])


@router.get("/version")
@compat_router.get("/version")
def get_version() -> Dict[str, Any]:
    """Get current running version and commit metadata."""
    return UpdateService.get_current_version_info()


@router.get("/check-update")
@compat_router.get("/check-update")
def check_update() -> Dict[str, Any]:
    """Check GitHub repository for newly published updates."""
    try:
        return UpdateService.check_for_updates()
    except Exception as e:
        logger.warning("Error checking for updates: %s", e)
        return {
            "update_available": False,
            "offline": True,
            "message": str(e),
        }


@router.post("/apply-update")
@compat_router.post("/apply-update")
def apply_update() -> Dict[str, Any]:
    """Download and apply latest update from GitHub while preserving database."""
    try:
        return UpdateService.apply_update()
    except Exception as e:
        logger.exception("Error applying update: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not apply update: {str(e)}",
        )

