from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.user_role import UserRole
from app.models.app_features import AppFeature
from app.models.app_feature_rolemap import AppFeatureRolemap
from app.models.app_module import AppModule
from app.schemas.user_role import (
    UserRoleCreate,
    UserRoleUpdate,
    UserRoleResponse,
    PermissionResponse,
)
from fastapi import HTTPException, status
from typing import List
from uuid import UUID


class UserRoleService:
    @staticmethod
    def get_all(db: Session) -> List[UserRoleResponse]:
        roles = db.query(UserRole).filter(UserRole.active == "Y").all()
        result = []
        for role in roles:
            permissions = UserRoleService._get_role_permissions(db, role.id)
            result.append(
                UserRoleResponse(
                    id=role.id,
                    role_code=role.role_code,
                    role_name=role.role_name,
                    active=role.active,
                    created_time=role.created_time,
                    updated_time=role.updated_time,
                    permissions=permissions,
                )
            )
        return result

    @staticmethod
    def get_by_id(db: Session, role_id: UUID) -> UserRoleResponse:
        role = (
            db.query(UserRole)
            .filter(and_(UserRole.id == role_id, UserRole.active == "Y"))
            .first()
        )
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )
        permissions = UserRoleService._get_role_permissions(db, role.id)
        return UserRoleResponse(
            id=role.id,
            role_code=role.role_code,
            role_name=role.role_name,
            active=role.active,
            created_time=role.created_time,
            updated_time=role.updated_time,
            permissions=permissions,
        )

    @staticmethod
    def _get_role_permissions(db: Session, role_id: UUID) -> List[PermissionResponse]:
        rolemaps = (
            db.query(AppFeatureRolemap)
            .filter(AppFeatureRolemap.user_role_id == role_id)
            .all()
        )
        permissions = []
        for rolemap in rolemaps:
            feature = (
                db.query(AppFeature)
                .filter(AppFeature.id == rolemap.app_feature_id)
                .first()
            )
            permissions.append(
                PermissionResponse(
                    feature_id=rolemap.app_feature_id,
                    feature_name=feature.feature_name if feature else None,
                    allow_view=rolemap.active or "N",
                    allow_write=rolemap.allow_write or "N",
                    allow_delete=rolemap.allow_delete or "N",
                )
            )
        return permissions

    @staticmethod
    def create(db: Session, role_data: UserRoleCreate) -> UserRoleResponse:
        existing = (
            db.query(UserRole)
            .filter(
                and_(UserRole.role_code == role_data.role_code, UserRole.active == "Y")
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role code already exists",
            )

        db_role = UserRole(
            role_code=role_data.role_code,
            role_name=role_data.role_name,
            active=role_data.active,
        )
        db.add(db_role)
        db.commit()
        db.refresh(db_role)

        UserRoleService._save_permissions(db, db_role.id, role_data.permissions)

        return UserRoleService.get_by_id(db, db_role.id)

    @staticmethod
    def update(
        db: Session, role_id: UUID, role_data: UserRoleUpdate
    ) -> UserRoleResponse:
        db_role = db.query(UserRole).filter(UserRole.id == role_id).first()

        if not db_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )

        if db_role.role_code != role_data.role_code:
            existing = (
                db.query(UserRole)
                .filter(
                    and_(
                        UserRole.role_code == role_data.role_code,
                        UserRole.id != role_id,
                    )
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Role code already exists",
                )

        db_role.role_code = role_data.role_code
        db_role.role_name = role_data.role_name
        db_role.active = role_data.active
        db.commit()
        db.refresh(db_role)

        db.query(AppFeatureRolemap).filter(
            AppFeatureRolemap.user_role_id == role_id
        ).delete()
        db.commit()

        UserRoleService._save_permissions(db, role_id, role_data.permissions)

        return UserRoleService.get_by_id(db, role_id)

    @staticmethod
    def soft_delete(db: Session, role_id: UUID) -> dict:
        db_role = db.query(UserRole).filter(UserRole.id == role_id).first()

        if not db_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )

        if db_role.active != "Y":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role is already inactive",
            )

        db_role.active = "N"
        db.commit()
        db.refresh(db_role)

        return {
            "id": db_role.id,
            "role_code": db_role.role_code,
            "role_name": db_role.role_name,
            "active": db_role.active,
            "message": "Role deleted successfully",
        }

    @staticmethod
    def _save_permissions(db: Session, role_id: UUID, permissions: List):
        for perm in permissions:
            db_rolemap = AppFeatureRolemap(
                app_feature_id=perm.feature_id,
                user_role_id=role_id,
                active=perm.allow_view or "N",
                allow_write=perm.allow_write or "N",
                allow_delete=perm.allow_delete or "N",
            )
            db.add(db_rolemap)
        db.commit()


class AppFeatureService:
    @staticmethod
    def get_all_features(db: Session) -> List[dict]:
        features = db.query(AppFeature).filter(AppFeature.active == "Y").all()
        result = []
        for feature in features:
            module = (
                db.query(AppModule)
                .filter(AppModule.id == feature.app_module_id)
                .first()
            )
            result.append(
                {
                    "id": feature.id,
                    "feature_name": feature.feature_name,
                    "feature_url": feature.feature_url,
                    "feature_code": feature.feature_code,
                    "active": feature.active,
                    "app_module_id": feature.app_module_id,
                    "module_name": module.module_name if module else None,
                    "created_time": feature.created_time,
                    "updated_time": feature.updated_time,
                }
            )
        return result


class AppModuleService:
    @staticmethod
    def get_all_modules(db: Session) -> List[dict]:
        modules = db.query(AppModule).filter(AppModule.active == "Y").all()
        result = []
        for module in modules:
            result.append(
                {
                    "id": module.id,
                    "module_name": module.module_name,
                    "module_code": module.module_code,
                    "active": module.active,
                    "module_dis_order": module.module_dis_order,
                    "created_time": module.created_time,
                    "updated_time": module.updated_time,
                }
            )
        return result
