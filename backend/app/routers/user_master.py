from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_USER_MASTER
from app.models.user_master import UserMaster
from app.schemas.user_master import (
    UserMasterCreate,
    UserMasterUpdate,
    UserMasterResponse,
    SetPasswordRequest,
)
from app.services.user_master_service import UserMasterService

router = APIRouter(prefix="/api/users", tags=["UserMaster"])


@router.get("", response_model=List[UserMasterResponse])
def get_users(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_MASTER, "view")),
):
    return UserMasterService.get_all(db)


@router.get("/{user_id}", response_model=UserMasterResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_MASTER, "view")),
):
    return UserMasterService.get_by_id(db, user_id)


@router.post("", response_model=UserMasterResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_user(
    user_data: UserMasterCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_MASTER, "write")),
):
    if user_data.user.id:
        existing_user = (
            db.query(UserMaster)
            .filter(and_(UserMaster.id == user_data.user.id, UserMaster.active == "Y"))
            .first()
        )
        if not existing_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found with this ID",
            )
        return UserMasterService.update(
            db,
            user_data.user.id,
            UserMasterUpdate(
                id=user_data.user.id,
                user=user_data.user,
                roles=user_data.roles,
            ),
        )
    return UserMasterService.create(db, user_data, current_user=current_user)


@router.put("/{user_id}", response_model=UserMasterResponse)
def update_user(
    user_id: UUID,
    user_data: UserMasterUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_MASTER, "write")),
):
    existing_user = (
        db.query(UserMaster)
        .filter(and_(UserMaster.id == user_id, UserMaster.active == "Y"))
        .first()
    )
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found with this ID"
        )
    return UserMasterService.update(db, user_id, user_data)


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: UUID,
    body: SetPasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_MASTER, "write")),
) -> Dict[str, Any]:
    existing_user = (
        db.query(UserMaster)
        .filter(and_(UserMaster.id == user_id, UserMaster.active == "Y"))
        .first()
    )
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found with this ID"
        )
    UserMasterService.set_password(db, user_id, body.password, force_change=True)
    return {"status": "SUCCESS", "message": "Password reset successfully"}


@router.delete("/{user_id}")
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_MASTER, "delete")),
) -> Dict[str, Any]:
    return UserMasterService.soft_delete(db, user_id)
