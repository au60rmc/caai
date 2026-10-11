from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_UNITS
from app.schemas.unit import UnitSave
from app.schemas.response import AppResponse, Status
from app.services.unit_service import UnitService

router = APIRouter(prefix="/api/units", tags=["Units"])


@router.get("")
def get_units(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_UNITS, "view")),
):
    data, status_val, message = UnitService.get_all(db)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.post("/bulk-save", status_code=201)
def save_units(
    items: List[UnitSave],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_UNITS, "write")),
):
    _, status_val, message = UnitService.bulk_save(db, items)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=None).model_dump(),
        status_code=201,
    )
