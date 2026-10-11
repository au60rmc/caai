from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.response import AppResponse, Status
from app.services.master_search_service import MasterSearchService

router = APIRouter(prefix="/api/master", tags=["Master Search"])


@router.get("/search")
def master_search(
    q: str = Query(...),
    type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = MasterSearchService.search(db, q, type)
    return JSONResponse(
        content=AppResponse(
            status=Status.SUCCESS, message="Search results", result=data
        ).model_dump()
    )
