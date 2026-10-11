from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_USER_MASTER
from app.schemas.user_company_map import UserCompanyMapCreate, UserCompanyMapResponse
from app.schemas.response import AppResponse, Status
from app.services.user_company_map_service import UserCompanyMapService

router = APIRouter(prefix="/api/user-companies", tags=["User Company Mapping"])


@router.get(
    "/{user_id}",
    dependencies=[Depends(require_permission(FEATURE_USER_MASTER, "view"))],
)
def get_user_companies(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    data = UserCompanyMapService.get_user_companies(db, user_id)
    return JSONResponse(
        content=AppResponse(
            status=Status.SUCCESS,
            message="User companies fetched",
            result=[d.model_dump(mode="json") for d in data],
        ).model_dump()
    )


@router.post(
    "/{user_id}",
    dependencies=[Depends(require_permission(FEATURE_USER_MASTER, "write"))],
)
def assign_user_companies(
    user_id: UUID,
    payload: UserCompanyMapCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if str(user_id) != str(payload.user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID mismatch in path and payload",
        )
    data, status_val, message = UserCompanyMapService.assign_user_companies(db, payload)
    return JSONResponse(
        content=AppResponse(
            status=status_val,
            message=message,
            result=[d.model_dump(mode="json") for d in data],
        ).model_dump()
    )
