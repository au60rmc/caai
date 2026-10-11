from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_LOV
from app.schemas.response import AppResponse
from app.services.lov_service import LovService

router = APIRouter(prefix="/api/lov", tags=["LOV"])


@router.get("/fetchLovGroup")
def fetch_lov_group(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LOV, "view")),
):
    data, status_val, message = LovService.get_distinct_groups(db)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.get("/fetchLovGroupByCode/{groupCode}")
def fetch_lov_group_by_code(
    groupCode: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LOV, "view")),
):
    data, status_val, message = LovService.get_by_group(db, groupCode)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.get("/fetchLovByID/{id}")
def fetch_lov_by_id(
    id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LOV, "view")),
):
    data, status_val, message = LovService.get_by_id(db, id)
    if data is None:
        return JSONResponse(
            content=AppResponse(status=status_val, message=message, result=None).model_dump(),
            status_code=404,
        )
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.post("/saveLov")
def save_lov(
    lov_list: List[dict],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LOV, "write")),
):
    success, status_val, message = LovService.save_lov_master(db, lov_list)
    status_code = 201 if success else 400
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=None).model_dump(),
        status_code=status_code,
    )
