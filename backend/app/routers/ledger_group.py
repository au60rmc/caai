from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_LEDGER_GROUP
from app.schemas.ledger_group import LedgerGroupCreate, LedgerGroupUpdate
from app.schemas.response import AppResponse, Status
from app.services.ledger_group_service import LedgerGroupService

router = APIRouter(prefix="/api/ledger-groups", tags=["Ledger Group"])


def _resp(data, status_val, message, ok_code=200, err_code=404):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get("")
def get_ledger_groups(
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LEDGER_GROUP, "view")),
):
    data, status_val, message = LedgerGroupService.get_all(db, skip, limit)
    return _resp(data, status_val, message)


@router.get("/{ledger_group_id}")
def get_ledger_group(
    ledger_group_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LEDGER_GROUP, "view")),
):
    data, status_val, message = LedgerGroupService.get_by_id(db, ledger_group_id)
    return _resp(data, status_val, message)


@router.post("", status_code=201)
def create_ledger_group(
    ledger_group: LedgerGroupCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LEDGER_GROUP, "write")),
):
    data, status_val, message = LedgerGroupService.create(db, ledger_group)
    return _resp(data, status_val, message, ok_code=201, err_code=400)


@router.put("/{ledger_group_id}")
def update_ledger_group(
    ledger_group_id: UUID,
    ledger_group: LedgerGroupUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LEDGER_GROUP, "write")),
):
    data, status_val, message = LedgerGroupService.update(db, ledger_group_id, ledger_group)
    return _resp(data, status_val, message)


@router.delete("/{ledger_group_id}")
def delete_ledger_group(
    ledger_group_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_LEDGER_GROUP, "delete")),
):
    _, status_val, message = LedgerGroupService.delete(db, ledger_group_id)
    return _resp(None, status_val, message)
