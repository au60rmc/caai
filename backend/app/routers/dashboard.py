from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.company_context import get_company_id
from app.schemas.response import AppResponse, Status
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def dashboard_summary(
    period: Optional[str] = None,
    compare: Optional[str] = None,
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
):
    data = DashboardService.summary(db, company_id, period=period, compare=compare)
    return JSONResponse(
        content=AppResponse(
            status=Status.SUCCESS, message="Dashboard summary", result=data
        ).model_dump()
    )


@router.get("/ageing")
def dashboard_ageing(
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
):
    """Load the expensive AR/AP calculation after the core dashboard renders."""
    data = DashboardService.ageing(db, company_id)
    return JSONResponse(
        content=AppResponse(
            status=Status.SUCCESS, message="Dashboard ageing", result=data
        ).model_dump()
    )


@router.get("/trend")
def dashboard_trend(
    db: Session = Depends(get_db),
    company_id: Optional[UUID] = Depends(get_company_id),
    current_user=Depends(get_current_user),
):
    """Load the trend chart independently of the core dashboard summary."""
    data = DashboardService.trend(db, company_id)
    return JSONResponse(
        content=AppResponse(
            status=Status.SUCCESS, message="Dashboard trend", result=data
        ).model_dump()
    )
