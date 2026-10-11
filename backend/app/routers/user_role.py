from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from uuid import UUID
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.core.feature_codes import FEATURE_USER_ROLE
from app.schemas.user_role import UserRoleCreate, UserRoleUpdate, UserRoleResponse
from app.services.user_role_service import (
    UserRoleService,
    AppFeatureService,
    AppModuleService,
)

router = APIRouter(prefix="/api/roles", tags=["UserRole"])


@router.get("", response_model=List[UserRoleResponse])
def get_roles(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "view")),
):
    return UserRoleService.get_all(db)


@router.get("/{role_id}", response_model=UserRoleResponse)
def get_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "view")),
):
    return UserRoleService.get_by_id(db, role_id)


@router.post("", response_model=UserRoleResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_role(
    role_data: UserRoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "write")),
):
    if role_data.id:
        return UserRoleService.update(
            db,
            role_data.id,
            UserRoleUpdate(
                id=role_data.id,
                role_code=role_data.role_code,
                role_name=role_data.role_name,
                active=role_data.active,
                permissions=role_data.permissions,
            ),
        )
    return UserRoleService.create(db, role_data)


@router.put("/{role_id}", response_model=UserRoleResponse)
def update_role(
    role_id: UUID,
    role_data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "write")),
):
    return UserRoleService.update(db, role_id, role_data)


@router.delete("/{role_id}")
def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "delete")),
) -> Dict[str, Any]:
    return UserRoleService.soft_delete(db, role_id)


features_router = APIRouter(prefix="/api/features", tags=["AppFeatures"])


@features_router.get("")
def get_features(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "view")),
):
    return AppFeatureService.get_all_features(db)


modules_router = APIRouter(prefix="/api/modules", tags=["AppModules"])


@modules_router.get("")
def get_modules(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    _=Depends(require_permission(FEATURE_USER_ROLE, "view")),
):
    return AppModuleService.get_all_modules(db)
