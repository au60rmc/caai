from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.company_context import get_company_id
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_VOUCHER, FEATURE_VOUCHER_TYPE
from app.models.user_master import UserMaster
from app.schemas.response import AppResponse, Status
from app.schemas.voucher_type import VoucherTypeCreate, VoucherTypeUpdate
from app.services.voucher_type_service import VoucherTypeService

router = APIRouter(prefix="/api/voucher-types", tags=["Voucher Types"])


def _resp(data, status_val, message, ok_code=200, err_code=400):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get(
    "/base-options",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "view"))],
)
def get_base_voucher_types(db: Session = Depends(get_db)):
    data, status_val, message = VoucherTypeService.get_base_options(db)
    return _resp(data, status_val, message)


@router.get(
    "/active",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))],
)
def get_active_voucher_types(
    base_voucher_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherTypeService.get_active(
        db, company_id, base_voucher_type=base_voucher_type
    )
    return _resp(data, status_val, message)


@router.get(
    "",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "view"))],
)
def get_voucher_types(
    include_inactive: bool = Query(True),
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherTypeService.get_all(
        db, company_id, include_inactive=include_inactive
    )
    return _resp(data, status_val, message)


@router.get(
    "/{voucher_type_id}",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "view"))],
)
def get_voucher_type(
    voucher_type_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherTypeService.get_by_id(
        db, voucher_type_id, company_id
    )
    return _resp(data, status_val, message, err_code=404)


@router.post(
    "",
    status_code=201,
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "write"))],
)
def create_voucher_type(
    body: VoucherTypeCreate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherTypeService.create(
        db, body, company_id, actor=str(current_user.id)
    )
    return _resp(data, status_val, message, ok_code=201)


@router.put(
    "/{voucher_type_id}",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "write"))],
)
def update_voucher_type(
    voucher_type_id: UUID,
    body: VoucherTypeUpdate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherTypeService.update(
        db, voucher_type_id, body, company_id, actor=str(current_user.id)
    )
    return _resp(data, status_val, message)


@router.patch(
    "/{voucher_type_id}/deactivate",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "delete"))],
)
def deactivate_voucher_type(
    voucher_type_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherTypeService.set_active(
        db, voucher_type_id, "N", company_id, actor=str(current_user.id)
    )
    return _resp(data, status_val, message, err_code=404)


@router.patch(
    "/{voucher_type_id}/activate",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER_TYPE, "write"))],
)
def activate_voucher_type(
    voucher_type_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherTypeService.set_active(
        db, voucher_type_id, "Y", company_id, actor=str(current_user.id)
    )
    return _resp(data, status_val, message, err_code=404)