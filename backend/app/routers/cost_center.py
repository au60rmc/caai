from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_COST_CENTER
from app.schemas.cost_center import CostCenterCreate, CostCenterUpdate
from app.schemas.response import AppResponse, Status
from app.services.cost_center_service import CostCenterService

router = APIRouter(prefix="/api/cost-centers", tags=["Cost Center"])


def _resp(data, status_val, message, ok_code=200, err_code=400):
    return JSONResponse(
        content=AppResponse(status=status_val, message=message, result=data).model_dump(),
        status_code=err_code if status_val == Status.ERROR else ok_code,
    )


@router.get("")
def get_cost_centers(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COST_CENTER, "view")),
):
    data, status_val, message = CostCenterService.get_all(db)
    return _resp(data, status_val, message)


@router.post("", status_code=201)
def create_cost_center(
    body: CostCenterCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COST_CENTER, "write")),
):
    data, status_val, message = CostCenterService.create(db, body)
    return _resp(data, status_val, message, ok_code=201)


@router.put("/{cost_center_id}")
def update_cost_center(
    cost_center_id: UUID,
    body: CostCenterUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COST_CENTER, "write")),
):
    data, status_val, message = CostCenterService.update(db, cost_center_id, body)
    return _resp(data, status_val, message)


@router.delete("/{cost_center_id}")
def delete_cost_center(
    cost_center_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_COST_CENTER, "delete")),
):
    _, status_val, message = CostCenterService.delete(db, cost_center_id)
    return _resp(None, status_val, message)
