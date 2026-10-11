from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_CUSTOM_FIELD
from app.schemas.custom_field import CustomFieldDefSave, CustomFieldValueSave
from app.schemas.response import AppResponse, Status
from app.services.custom_field_service import CustomFieldService

router = APIRouter(prefix="/api/custom-fields", tags=["Custom Fields"])


@router.get("")
def get_definitions(
    module: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data, status_val, message = CustomFieldService.get_definitions(db, module)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.post("/bulk-save", status_code=201)
def save_definitions(
    items: List[CustomFieldDefSave],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOM_FIELD, "write")),
):
    _, status_val, message = CustomFieldService.bulk_save(db, items)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=None).model_dump(),
        status_code=201,
    )


@router.get("/values/{record_id}")
def get_values(
    record_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = CustomFieldService.get_values(db, record_id)
    return JSONResponse(
        content=AppResponse(status=Status.SUCCESS, message="Values fetched", result=data).model_dump()
    )


@router.post("/values")
def save_values(
    items: List[CustomFieldValueSave],
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    _, status_val, message = CustomFieldService.save_values(db, items)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=None).model_dump()
    )
