from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.company_context import get_company_id
from app.core.feature_codes import FEATURE_VOUCHER
from app.models.user_master import UserMaster
from app.schemas.voucher_header import VoucherHeaderCreate, VoucherHeaderUpdate
from app.schemas.response import AppResponse, Status
from app.services.voucher_header_service import VoucherHeaderService

router = APIRouter(prefix="/api/vouchers", tags=["Vouchers"])


def _resp(data, status_val, message, ok_code=200, err_code=400):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get("", dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))])
def get_vouchers(
    voucher_type: Optional[str] = Query(
        None,
        description="Voucher type: JOURNAL, SALES, PURCHASE, RECEIPT, PAYMENT, CONTRA",
    ),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherHeaderService.get_all(
        db, voucher_type, skip, limit, company_id=company_id
    )
    return _resp(data, status_val, message)


@router.get(
    "/ledger-options",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))],
)
def get_account_ledger_options(
    voucher_type_id: UUID = Query(...),
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherHeaderService.get_account_ledger_options(
        db, voucher_type_id, company_id
    )
    return _resp(data, status_val, message)


@router.get(
    "/purchase-bills",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))],
)
def get_purchase_bills(
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    if company_id is None:
        return _resp(None, Status.ERROR, "Select a company to load purchase bills")
    data, status_val, message = VoucherHeaderService.get_purchase_bills(db, company_id)
    return _resp(data, status_val, message)


@router.get(
    "/sales-invoices",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))],
)
def get_sales_invoices(
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    if company_id is None:
        return _resp(None, Status.ERROR, "Select a company to load sales invoices")
    data, status_val, message = VoucherHeaderService.get_sales_invoices(db, company_id)
    return _resp(data, status_val, message)


@router.get(
    "/ledger/{ledger_id}",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))],
)
def get_ledger_transactions(
    ledger_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherHeaderService.get_ledger_transactions(
        db, ledger_id, company_id=company_id
    )
    return _resp(data, status_val, message)


@router.get(
    "/{voucher_id}",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "view"))],
)
def get_voucher(
    voucher_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
):
    data, status_val, message = VoucherHeaderService.get_by_id(
        db, voucher_id, company_id=company_id
    )
    return _resp(data, status_val, message, err_code=404)


@router.post(
    "",
    status_code=201,
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "write"))],
)
def create_voucher(
    body: VoucherHeaderCreate,
    voucher_type: Optional[str] = Query(
        None,
        description="Voucher type: JOURNAL, SALES, PURCHASE, RECEIPT, PAYMENT, CONTRA",
    ),
    voucher_type_id: Optional[UUID] = Query(
        None, description="Configured Voucher Type ID selected by the user"
    ),
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    result_data, status_val, message = VoucherHeaderService.create(
        db,
        body,
        voucher_type,
        actor=str(current_user.id),
        company_id=company_id,
        voucher_type_id=voucher_type_id,
    )
    return _resp(result_data, status_val, message, ok_code=201)


@router.put(
    "/{voucher_id}",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "write"))],
)
def update_voucher(
    voucher_id: UUID,
    body: VoucherHeaderUpdate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    result_data, status_val, message = VoucherHeaderService.update(
        db,
        voucher_id,
        body,
        actor=str(current_user.id),
        company_id=company_id,
    )
    return _resp(result_data, status_val, message)


@router.patch(
    "/{voucher_id}/post",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "write"))],
)
def post_voucher(
    voucher_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherHeaderService.post_voucher(
        db, voucher_id, actor=str(current_user.id), company_id=company_id
    )
    return _resp(data, status_val, message)


@router.patch(
    "/{voucher_id}/cancel",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "delete"))],
)
def cancel_voucher(
    voucher_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherHeaderService.cancel_voucher(
        db, voucher_id, actor=str(current_user.id), company_id=company_id
    )
    return _resp(data, status_val, message)


@router.delete(
    "/{voucher_id}",
    dependencies=[Depends(require_permission(FEATURE_VOUCHER, "delete"))],
)
def delete_voucher(
    voucher_id: UUID,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user: UserMaster = Depends(get_current_user),
):
    data, status_val, message = VoucherHeaderService.delete_voucher(
        db, voucher_id, actor=str(current_user.id), company_id=company_id
    )
    return _resp(data, status_val, message, err_code=404)
