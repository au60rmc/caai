from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_COMPANY
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.schemas.response import AppResponse, Status
from app.services.company_service import CompanyService

router = APIRouter(prefix="/api/companies", tags=["Company"])


def _resp(data, status_val, message, ok_code=200, err_code=400):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get("")
def get_companies(
    include_all: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COMPANY, "view")),
):
    # Pass user_id and user_type to scope company list
    user_id = getattr(current_user, "id", None)
    user_type = getattr(current_user, "user_type", None)
    data, status_val, message = CompanyService.get_all(
        db, user_id=user_id, user_type=user_type, include_all=include_all
    )
    return _resp(data, status_val, message)


@router.get("/{company_id}")
def get_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COMPANY, "view")),
):
    data, status_val, message = CompanyService.get_by_id(db, company_id)
    return _resp(data, status_val, message, err_code=404)


@router.post("", status_code=201)
def create_company(
    body: CompanyCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COMPANY, "write")),
):
    data, status_val, message = CompanyService.create(db, body, current_user=current_user)
    return _resp(data, status_val, message, ok_code=201)


@router.put("/{company_id}")
def update_company(
    company_id: UUID,
    body: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COMPANY, "write")),
):
    data, status_val, message = CompanyService.update(db, company_id, body)
    return _resp(data, status_val, message)


@router.delete("/{company_id}")
def delete_company(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COMPANY, "delete")),
):
    _, status_val, message = CompanyService.delete(db, company_id)
    return _resp(None, status_val, message)
