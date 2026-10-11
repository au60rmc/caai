from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from typing import List, Optional, Tuple, Dict, Any
from app.models.user_company_map import UserCompanyMap
from app.models.company import Company
from app.schemas.user_company_map import UserCompanyMapResponse, UserCompanyMapCreate
from app.schemas.response import Status


class UserCompanyMapService:
    @staticmethod
    def get_user_companies(db: Session, user_id: UUID) -> List[UserCompanyMapResponse]:
        mappings = (
            db.query(UserCompanyMap, Company.company_name)
            .outerjoin(Company, Company.id == UserCompanyMap.company_id)
            .filter(
                and_(
                    UserCompanyMap.user_id == user_id,
                    UserCompanyMap.active == "Y",
                )
            )
            .all()
        )
        res = []
        for ucm, comp_name in mappings:
            res.append(
                UserCompanyMapResponse(
                    id=ucm.id,
                    user_id=ucm.user_id,
                    company_id=ucm.company_id,
                    company_name=comp_name,
                    is_default=ucm.is_default or "N",
                    active=ucm.active or "Y",
                    created_date=ucm.created_date,
                )
            )
        return res

    @staticmethod
    def get_user_allowed_company_ids(db: Session, user_id: UUID) -> List[UUID]:
        rows = (
            db.query(UserCompanyMap.company_id)
            .filter(
                and_(
                    UserCompanyMap.user_id == user_id,
                    UserCompanyMap.active == "Y",
                )
            )
            .all()
        )
        return [r[0] for r in rows if r[0] is not None]

    @staticmethod
    def auto_link_creator(db: Session, user_id: UUID, company_id: UUID) -> None:
        """Automatically links creator user to newly created company as default if first."""
        existing = (
            db.query(UserCompanyMap)
            .filter(
                UserCompanyMap.user_id == user_id,
                UserCompanyMap.company_id == company_id,
            )
            .first()
        )
        if existing:
            existing.active = "Y"
        else:
            has_other_default = (
                db.query(UserCompanyMap)
                .filter(
                    UserCompanyMap.user_id == user_id,
                    UserCompanyMap.is_default == "Y",
                    UserCompanyMap.active == "Y",
                )
                .first() is not None
            )
            db.add(
                UserCompanyMap(
                    user_id=user_id,
                    company_id=company_id,
                    is_default="N" if has_other_default else "Y",
                    active="Y",
                )
            )
        db.commit()

    @staticmethod
    def assign_user_companies(
        db: Session, payload: UserCompanyMapCreate
    ) -> Tuple[List[UserCompanyMapResponse], str, str]:
        user_id = payload.user_id
        company_ids = payload.company_ids
        default_cid = payload.default_company_id or (company_ids[0] if company_ids else None)

        # Deactivate previous mappings not in payload
        db.query(UserCompanyMap).filter(UserCompanyMap.user_id == user_id).update(
            {"active": "N", "is_default": "N"}
        )

        for cid in company_ids:
            is_def = "Y" if (default_cid and str(cid) == str(default_cid)) else "N"
            existing = (
                db.query(UserCompanyMap)
                .filter(
                    UserCompanyMap.user_id == user_id,
                    UserCompanyMap.company_id == cid,
                )
                .first()
            )
            if existing:
                existing.active = "Y"
                existing.is_default = is_def
            else:
                db.add(
                    UserCompanyMap(
                        user_id=user_id,
                        company_id=cid,
                        is_default=is_def,
                        active="Y",
                    )
                )

        db.commit()
        result = UserCompanyMapService.get_user_companies(db, user_id)
        return (result, Status.SUCCESS, "User company mappings updated")
