from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.response import AppResponse, Status
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get("")
def get_audit(
    entity: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = AuditService.list(db, entity, id, limit)
    return JSONResponse(
        content=AppResponse(
            status=Status.SUCCESS, message="Activity fetched", result=data
        ).model_dump()
    )
