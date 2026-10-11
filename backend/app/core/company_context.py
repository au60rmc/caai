from typing import Optional, Any
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.company import Company
from app.models.user_company_map import UserCompanyMap


def resolve_company_id(
    db: Session,
    x_company_id: Optional[str] = None,
    user_id: Optional[UUID] = None,
    user_type: Optional[str] = None,
) -> Optional[UUID]:
    if x_company_id:
        try:
            cid = UUID(str(x_company_id))
        except (ValueError, TypeError):
            cid = None

        if cid:
            co = db.query(Company).filter(Company.id == cid).first()
            if co:
                # If company was soft-deactivated but user is actively working in it, auto-reactivate
                if co.active != "Y":
                    co.active = "Y"
                    try:
                        db.commit()
                        db.refresh(co)
                    except Exception:
                        db.rollback()

                # Enforce user company access check if user_id is passed and not Superuser/Demo
                if user_id and user_type not in ("S", "D"):
                    user_allowed = (
                        db.query(UserCompanyMap)
                        .filter(
                            UserCompanyMap.user_id == user_id,
                            UserCompanyMap.company_id == cid,
                            UserCompanyMap.active == "Y",
                        )
                        .first() is not None
                    )
                    if not user_allowed:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="You do not have access to this company",
                        )

                return cid

    # Fallback to user's default assigned company
    if user_id:
        user_def = (
            db.query(UserCompanyMap.company_id)
            .filter(
                UserCompanyMap.user_id == user_id,
                UserCompanyMap.is_default == "Y",
                UserCompanyMap.active == "Y",
            )
            .first()
        )
        if user_def and user_def[0]:
            c_check = db.query(Company).filter(Company.id == user_def[0], Company.active == "Y").first()
            if c_check:
                return c_check.id

        any_user_c = (
            db.query(UserCompanyMap.company_id)
            .filter(
                UserCompanyMap.user_id == user_id,
                UserCompanyMap.active == "Y",
            )
            .first()
        )
        if any_user_c and any_user_c[0]:
            c_check = db.query(Company).filter(Company.id == any_user_c[0], Company.active == "Y").first()
            if c_check:
                return c_check.id

        if user_type in ("S", "D"):
            first_c = db.query(Company.id).filter(Company.active == "Y").first()
            if first_c:
                return first_c[0]

    # For Superusers/Demo without specific mappings, fall back to default/first company
    if user_type in ("S", "D") or user_id is None:
        default = (
            db.query(Company)
            .filter(Company.is_default == "Y", Company.active == "Y")
            .first()
        )
        if default:
            return default.id
        any_c = db.query(Company).filter(Company.active == "Y").first()
        if any_c:
            return any_c.id

    # As a final safe fallback: pick any existing company
    any_co = db.query(Company).filter(Company.active == "Y").first()
    if any_co:
        return any_co.id

    any_co_any = db.query(Company).first()
    if any_co_any:
        any_co_any.active = "Y"
        try:
            db.commit()
            db.refresh(any_co_any)
        except Exception:
            db.rollback()
        return any_co_any.id

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No companies found. Please create a company first.",
    )


def get_company_id(
    db: Session = Depends(get_db),
    x_company_id: Optional[str] = Header(None, alias="X-Company-Id"),
    current_user: Any = Depends(get_current_user),
) -> Optional[UUID]:
    user_id = getattr(current_user, "id", None)
    user_type = getattr(current_user, "user_type", None)
    return resolve_company_id(db, x_company_id, user_id=user_id, user_type=user_type)
