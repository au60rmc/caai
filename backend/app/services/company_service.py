from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.schemas.response import Status
from app.services.gst_service import GstService
from typing import List, Optional, Tuple, Any, Dict
from uuid import UUID


class CompanyService:
    @staticmethod
    def _to_dict(c: Company) -> Dict[str, Any]:
        return {
            "id": str(c.id),
            "company_name": c.company_name,
            "gstin": c.gstin,
            "pan": c.pan,
            "state_code": c.state_code,
            "address": c.address,
            "city": c.city,
            "state": c.state,
            "pincode": c.pincode,
            "email": c.email,
            "mobile": c.mobile,
            "financial_year_start": c.financial_year_start.isoformat()
            if c.financial_year_start else None,
            "financial_year_end": c.financial_year_end.isoformat()
            if c.financial_year_end else None,
            "currency": c.currency,
            "maintain_mode": c.maintain_mode or "ACCOUNT_ONLY",
            "is_default": c.is_default,
            "active": c.active,
            "created_date": c.created_date.isoformat() if c.created_date else None,
            "modified_date": c.modified_date.isoformat() if c.modified_date else None,
        }

    @staticmethod
    def _apply_gstin_state(payload) -> None:
        if payload.gstin and not payload.state_code:
            v = GstService.validate_gstin(payload.gstin)
            if v.get("state_code"):
                payload.state_code = v["state_code"]

    @staticmethod
    def get_all(
        db: Session,
        user_id: Optional[UUID] = None,
        user_type: Optional[str] = None,
        include_all: bool = False,
    ) -> Tuple[List[Dict[str, Any]], str, str]:
        # Unrestricted: all active companies are accessible
        q = db.query(Company).filter(Company.active == "Y")
        rows = q.all()
        return ([CompanyService._to_dict(c) for c in rows], Status.SUCCESS,
                "Companies fetched successfully")

    @staticmethod
    def get_by_id(db: Session, cid: UUID) -> Tuple[Optional[Dict[str, Any]], str, str]:
        c = db.query(Company).filter(Company.id == cid).first()
        if not c:
            return (None, Status.ERROR, "Company not found")
        return (CompanyService._to_dict(c), Status.SUCCESS, "Company fetched")

    @staticmethod
    def create(db: Session, payload: CompanyCreate, current_user: Any = None) -> Tuple[Optional[Dict[str, Any]], str, str]:
        from app.services.entitlement_service import EntitlementService
        try:
            EntitlementService.assert_company_creation_allowed(db, user=current_user)
        except HTTPException as e:
            return (None, Status.ERROR, e.detail)

        from app.core.init_db import (
            seed_default_ledgers_for_company,
            seed_default_voucher_types_for_company,
            seed_default_voucher_sequences_for_company,
        )
        from app.services.user_company_map_service import UserCompanyMapService

        CompanyService._apply_gstin_state(payload)
        c = Company(**payload.model_dump(exclude_unset=True))
        if db.query(Company).filter(Company.active == "Y").count() == 0:
            c.is_default = "Y"
        if c.is_default == "Y":
            db.query(Company).filter(Company.active == "Y").update({"is_default": "N"})
        db.add(c)
        db.flush()
        seed_default_ledgers_for_company(db, c.id)
        seed_default_voucher_types_for_company(db, c.id)
        seed_default_voucher_sequences_for_company(db, c.id)
        db.commit()
        db.refresh(c)

        # Auto-link creator user to newly created company
        if current_user and getattr(current_user, "id", None):
            UserCompanyMapService.auto_link_creator(db, current_user.id, c.id)

        return (CompanyService._to_dict(c), Status.SUCCESS, "Company created successfully")

    @staticmethod
    def update(db: Session, cid: UUID, payload: CompanyUpdate) -> Tuple[Optional[Dict[str, Any]], str, str]:
        c = db.query(Company).filter(Company.id == cid).first()
        if not c:
            return (None, Status.ERROR, "Company not found")
        CompanyService._apply_gstin_state(payload)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(c, k, v)
        if c.is_default == "Y":
            db.query(Company).filter(Company.id != cid).update({"is_default": "N"})
        db.commit()
        db.refresh(c)
        return (CompanyService._to_dict(c), Status.SUCCESS, "Company updated successfully")

    @staticmethod
    def delete(db: Session, cid: UUID) -> Tuple[bool, str, str]:
        c = db.query(Company).filter(Company.id == cid).first()
        if not c:
            return (False, Status.ERROR, "Company not found")
        if c.is_default == "Y":
            return (False, Status.ERROR, "The default company cannot be removed")
        c.active = "N"
        db.commit()
        return (True, Status.SUCCESS, "Company removed successfully")
