from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_SYSTEM_SETTING
from app.schemas.response import AppResponse
from app.services.system_setting_service import SystemSettingService

router = APIRouter(prefix="/api/systemSettings", tags=["SystemSetting"])


@router.get("/fetchSystemSettings")
def fetch_system_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_SYSTEM_SETTING, "view")),
):
    data, status_val, message = SystemSettingService.get_all(db)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.post("/saveSystemSettings")
def save_system_settings(
    settings_list: List[dict],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_SYSTEM_SETTING, "write")),
):
    success, status_val, message = SystemSettingService.save_settings(db, settings_list)
    status_code = 201 if success else 400
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=None).model_dump(),
        status_code=status_code,
    )
