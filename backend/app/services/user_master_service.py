from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.models.user_master import UserMaster, UserRoleMap
from app.models.user_role import UserRole
from app.schemas.user_master import (
    UserMasterCreate,
    UserMasterUpdate,
    UserMasterResponse,
    UserRoleMapResponse,
)
from fastapi import HTTPException, status
from typing import List, Optional, Any
from uuid import UUID, uuid4
from datetime import datetime

from app.models.auth import UserAttr
from app.core.security import get_password_hash
from app.services.auth_service import AuthService


class UserMasterService:
    @staticmethod
    def set_password(db: Session, user_id: UUID, password: str, force_change: bool = True) -> None:
        AuthService._validate_password_complexity(password)
        db.query(UserAttr).filter(
            UserAttr.user_id == user_id,
            UserAttr.attr_name == "PWD",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        db.add(
            UserAttr(
                id=uuid4(),
                user_id=user_id,
                attr_name="PWD",
                attr_value=get_password_hash(password),
                active="Y",
                created_date=datetime.utcnow(),
            )
        )
        db.query(UserAttr).filter(
            UserAttr.user_id == user_id,
            UserAttr.attr_name == "FORCE_PWD_CHANGE",
            UserAttr.active == "Y",
        ).update({"active": "N"})
        if force_change:
            db.add(
                UserAttr(
                    id=uuid4(),
                    user_id=user_id,
                    attr_name="FORCE_PWD_CHANGE",
                    attr_value="Y",
                    active="Y",
                )
            )
        db.commit()

    @staticmethod
    def _to_response(db: Session, user: UserMaster) -> UserMasterResponse:
        roles = UserMasterService._get_user_roles(db, user.id)
        return UserMasterResponse(
            id=user.id,
            user_name=user.user_name,
            user_email=user.user_email,
            oauthid=user.oauthid,
            gender=user.gender,
            first_name=user.first_name,
            last_name=user.last_name,
            profession=user.profession,
            nationality=user.nationality,
            aca_qualification=user.aca_qualification,
            marital_status=user.marital_status,
            org_id=user.org_id,
            created_by=user.created_by,
            created_date=user.created_date,
            modified_by=user.modified_by,
            modified_date=user.modified_date,
            active=user.active,
            dob=user.dob.isoformat() if user.dob else None,
            alt_email_id=user.alt_email_id,
            user_state=user.user_state,
            user_type=user.user_type or "S",
            roles=roles,
        )

    @staticmethod
    def get_all(db: Session) -> List[UserMasterResponse]:
        users = db.query(UserMaster).filter(UserMaster.active == "Y").all()
        return [UserMasterService._to_response(db, u) for u in users]

    @staticmethod
    def get_by_id(db: Session, user_id: UUID) -> UserMasterResponse:
        user = (
            db.query(UserMaster)
            .filter(and_(UserMaster.id == user_id, UserMaster.active == "Y"))
            .first()
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return UserMasterService._to_response(db, user)

    @staticmethod
    def _get_user_roles(db: Session, user_id: UUID) -> List[UserRoleMapResponse]:
        rolemaps = (
            db.query(UserRoleMap)
            .filter(and_(UserRoleMap.user_id == user_id, UserRoleMap.active == "Y"))
            .all()
        )

        roles = []
        for rolemap in rolemaps:
            role = (
                db.query(UserRole)
                .filter(
                    and_(UserRole.id == rolemap.user_role_id, UserRole.active == "Y")
                )
                .first()
            )
            roles.append(
                UserRoleMapResponse(
                    user_role_id=rolemap.user_role_id,
                    role_name=role.role_name if role else None,
                )
            )
        return roles

    @staticmethod
    def create(db: Session, user_data: UserMasterCreate, current_user: Optional[Any] = None) -> UserMasterResponse:
        from app.services.entitlement_service import EntitlementService
        EntitlementService.assert_user_creation_allowed(db, user=current_user)

        user_info = user_data.user

        existing = (
            db.query(UserMaster)
            .filter(
                and_(
                    func.lower(UserMaster.user_email) == func.lower(user_info.user_email),
                    UserMaster.active == "Y",
                )
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User email already exists",
            )

        db_user = UserMaster(
            user_name=user_info.user_name,
            user_email=user_info.user_email,
            oauthid=user_info.oauthid,
            gender=user_info.gender,
            first_name=user_info.first_name,
            last_name=user_info.last_name,
            profession=user_info.profession,
            nationality=user_info.nationality,
            aca_qualification=user_info.aca_qualification,
            marital_status=user_info.marital_status,
            org_id=user_info.org_id,
            dob=user_info.dob,
            alt_email_id=user_info.alt_email_id,
            user_state=user_info.user_state,
            user_type=user_info.user_type or "S",
            active="Y",
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        UserMasterService._save_rolemap(db, db_user.id, user_data.roles)

        if getattr(user_data, "password", None):
            UserMasterService.set_password(
                db, db_user.id, user_data.password, force_change=True
            )

        return UserMasterService.get_by_id(db, db_user.id)

    @staticmethod
    def update(
        db: Session, user_id: UUID, user_data: UserMasterUpdate
    ) -> UserMasterResponse:
        db_user = db.query(UserMaster).filter(UserMaster.id == user_id).first()

        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        if db_user.active != "Y":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is inactive",
            )

        user_info = user_data.user

        if db_user.user_email.lower() != user_info.user_email.lower():
            existing = (
                db.query(UserMaster)
                .filter(
                    and_(
                        func.lower(UserMaster.user_email) == func.lower(user_info.user_email),
                        UserMaster.id != user_id,
                        UserMaster.active == "Y",
                    )
                )
                .first()
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User email already exists",
                )

        db_user.user_name = user_info.user_name
        db_user.user_email = user_info.user_email
        db_user.oauthid = user_info.oauthid
        db_user.gender = user_info.gender
        db_user.first_name = user_info.first_name
        db_user.last_name = user_info.last_name
        db_user.profession = user_info.profession
        db_user.nationality = user_info.nationality
        db_user.aca_qualification = user_info.aca_qualification
        db_user.marital_status = user_info.marital_status
        db_user.org_id = user_info.org_id
        db_user.dob = user_info.dob
        db_user.alt_email_id = user_info.alt_email_id
        db_user.user_state = user_info.user_state
        db_user.user_type = user_info.user_type or "S"
        db_user.modified_date = datetime.now()
        db.commit()
        db.refresh(db_user)

        if user_data.roles:
            db.query(UserRoleMap).filter(UserRoleMap.user_id == user_id).delete()
            db.commit()
            UserMasterService._save_rolemap(db, user_id, user_data.roles)

        if getattr(user_data, "password", None):
            UserMasterService.set_password(
                db, user_id, user_data.password, force_change=True
            )

        return UserMasterService.get_by_id(db, user_id)

    @staticmethod
    def soft_delete(db: Session, user_id: UUID) -> dict:
        db_user = db.query(UserMaster).filter(UserMaster.id == user_id).first()

        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        if db_user.active != "Y":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already inactive",
            )

        db_user.active = "N"
        db_user.modified_date = datetime.now()
        db.commit()
        db.refresh(db_user)

        db.query(UserRoleMap).filter(UserRoleMap.user_id == user_id).update(
            {"active": "N", "modified_date": datetime.now()}
        )
        db.commit()

        return {
            "id": db_user.id,
            "user_name": db_user.user_name,
            "user_email": db_user.user_email,
            "active": db_user.active,
            "message": "User deleted successfully",
        }

    @staticmethod
    def _save_rolemap(db: Session, user_id: UUID, roles: List):
        for role in roles:
            db_rolemap = UserRoleMap(
                user_role_id=role.user_role_id,
                user_id=user_id,
                active="Y",
            )
            db.add(db_rolemap)
        db.commit()
