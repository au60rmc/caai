from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_BANK_CASH
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate
from app.schemas.response import AppResponse, Status
from app.services.bank_account_service import BankAccountService

from typing import Optional
from app.core.company_context import get_company_id

router = APIRouter(prefix="/api/bank-accounts", tags=["Bank & Cash"])


def _resp(data, status_val, message, ok_code=200, err_code=400):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get("")
def get_accounts(
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_BANK_CASH, "view")),
):
    data, status_val, message = BankAccountService.get_all(db, company_id=company_id)
    return _resp(data, status_val, message)


@router.get("/validate-ifsc")
def validate_ifsc(
    ifsc: str = Query(...),
    current_user=Depends(get_current_user),
):
    return {"status": "SUCCESS", "result": BankAccountService.validate_ifsc(ifsc)}


@router.post("", status_code=201)
def create_account(
    body: BankAccountCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_BANK_CASH, "write")),
):
    data, status_val, message = BankAccountService.create(db, body)
    return _resp(data, status_val, message, ok_code=201)


@router.put("/{account_id}")
def update_account(
    account_id: UUID,
    body: BankAccountUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_BANK_CASH, "write")),
):
    data, status_val, message = BankAccountService.update(db, account_id, body)
    return _resp(data, status_val, message)


@router.delete("/{account_id}")
def delete_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_BANK_CASH, "delete")),
):
    _, status_val, message = BankAccountService.delete(db, account_id)
    return _resp(None, status_val, message)
