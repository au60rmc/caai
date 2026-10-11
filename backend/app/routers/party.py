from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.company_context import get_company_id
from app.core.feature_codes import FEATURE_CUSTOMER
from app.schemas.party import (
    PartyCreate,
    PartyUpdate,
    PartyQuickCreate,
    PartyValidateRequest,
)
from app.schemas.response import AppResponse, Status
from app.services.party_service import PartyService

router = APIRouter(prefix="/api/parties", tags=["Party"])


def _resp(data, status_val, message, ok_code=200, err_code=404):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get("")
def get_parties(
    skip: int = 0,
    limit: int = 500,
    key_group: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "view")),
):
    data, status_val, message = PartyService.get_all(
        db, skip, limit, key_group, include_inactive, company_id=company_id
    )
    return _resp(data, status_val, message)


@router.post("/validate")
def validate_party(
    body: PartyValidateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "view")),
):
    data = PartyService.validate(db, body.name, body.gstin, body.key_group, body.id)
    return _resp(data, Status.SUCCESS, "Validation complete")


@router.post("/quick-create", status_code=201)
def quick_create_party(
    body: PartyQuickCreate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "write")),
):
    data, status_val, message = PartyService.quick_create(db, body, company_id=company_id)
    return _resp(data, status_val, message, ok_code=201, err_code=400)


@router.get("/{party_id}/outstanding")
def party_outstanding(
    party_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "view")),
):
    data, status_val, message = PartyService.outstanding_preview(db, party_id)
    return _resp(data, status_val, message)


@router.get("/{party_id}")
def get_party(
    party_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "view")),
):
    data, status_val, message = PartyService.get_by_id(db, party_id)
    return _resp(data, status_val, message)


@router.post("", status_code=201)
def create_party(
    party: PartyCreate,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "write")),
):
    data, status_val, message = PartyService.create(db, party, company_id=company_id)
    return _resp(data, status_val, message, ok_code=201, err_code=400)


@router.put("/{party_id}")
def update_party(
    party_id: UUID,
    party: PartyUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "write")),
):
    data, status_val, message = PartyService.update(db, party_id, party)
    return _resp(data, status_val, message)


@router.patch("/{party_id}/active")
def update_party_active(
    party_id: UUID,
    active: str = Query(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "write")),
):
    data, status_val, message = PartyService.update_active(db, party_id, active)
    return _resp(data, status_val, message, err_code=400)


@router.delete("/{party_id}")
def delete_party(
    party_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_CUSTOMER, "delete")),
):
    _, status_val, message = PartyService.delete(db, party_id)
    return _resp(None, status_val, message)
