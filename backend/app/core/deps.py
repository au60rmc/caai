from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user_master import UserMaster
from app.services.auth_service import AuthService

security = HTTPBearer()


def get_current_user(
    credentials=Depends(security),
    db: Session = Depends(get_db),
) -> UserMaster:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    try:
        user_id = UUID(str(payload.get("user_id")))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = (
        db.query(UserMaster)
        .filter(
            UserMaster.id == user_id,
            UserMaster.active == "Y",
        )
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_permission(feature_code: str, action: str = "view"):
    async def permission_checker(
        current_user: UserMaster = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        permissions = AuthService.get_user_permissions(db, current_user.id)
        for perm in permissions:
            if perm.feature_code == feature_code:
                if action == "view" and perm.view:
                    return True
                if action == "write" and perm.write:
                    return True
                if action == "delete" and perm.delete:
                    return True
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {action} on {feature_code}",
                )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature not found: {feature_code}",
        )

    return permission_checker
