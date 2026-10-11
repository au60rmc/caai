from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.company_context import get_company_id
from app.core.feature_codes import FEATURE_SYSTEM_SETTING
from app.schemas.response import AppResponse
from app.services.voucher_sequence_service import VoucherSequenceService

router = APIRouter(prefix="/api/voucher-sequences", tags=["VoucherSequence"])


@router.get("")
def get_voucher_sequences(
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_SYSTEM_SETTING, "view")),
):
    data, status_val, message = VoucherSequenceService.get_all(db, company_id=company_id)
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump()
    )


@router.post("/bulk-save")
def bulk_save_voucher_sequences(
    sequences_list: List[dict],
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_SYSTEM_SETTING, "write")),
):
    success, status_val, message = VoucherSequenceService.bulk_save(
        db, sequences_list, company_id=company_id
    )
    status_code = 201 if success else 400
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=None).model_dump(),
        status_code=status_code,
    )
