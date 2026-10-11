from sqlalchemy.orm import Session
from app.models.party import Party
from app.models.ledger import Ledger
from app.models.ledger_group import LedgerGroup
from app.models.voucher_detail import VoucherDetail
from app.models.voucher_header import VoucherHeader
from app.schemas.party import (
    PartyCreate,
    PartyUpdate,
    PartyQuickCreate,
    NameContactInfo,
)
from app.schemas.response import Status
from app.services.gst_service import GstService
from typing import List, Optional, Tuple, Any, Dict
from uuid import UUID


class PartyService:
    @staticmethod
    def _to_dict(party: Party) -> Dict[str, Any]:
        return {
            "id": str(party.id),
            "name_contact_info": party.name_contact_info,
            "address_info": party.address_info,
            "payment_info": party.payment_info,
            "additional_info": party.additional_info,
            "gstin": party.gstin,
            "pan": party.pan,
            "gst_type": party.gst_type,
            "custom_fields": party.custom_fields,
            "active": party.active,
            "key_group": party.key_group,
            "ledger_id": str(party.ledger_id) if party.ledger_id else None,
            "created_by": party.created_by,
            "modified_by": party.modified_by,
            "created_date": party.created_date.isoformat()
            if party.created_date
            else None,
            "modified_date": party.modified_date.isoformat()
            if party.modified_date
            else None,
        }

    @staticmethod
    def _get_ledger_group_for_party(
        db: Session, key_group: str
    ) -> Optional[LedgerGroup]:
        # Customers (and Both) -> Sundry Debtors; vendors -> Sundry Creditors.
        code = "SUNDRY_CREDITORS" if key_group == "V" else "SUNDRY_DEBTORS"
        return (
            db.query(LedgerGroup)
            .filter(LedgerGroup.code == code, LedgerGroup.active == "Y")
            .first()
        )

    @staticmethod
    def _derive_ledger_name(name_contact_info: Any) -> str:
        company = (name_contact_info.get("company_name") or "").strip()
        full = f"{name_contact_info.get('first_name', '')} {name_contact_info.get('last_name', '')}".strip()
        display = (name_contact_info.get("display_name") or "").strip()
        return company or full or display or "Party Account"

    @staticmethod
    def get_all(
        db: Session,
        skip: int = 0,
        limit: int = 500,
        key_group: Optional[str] = None,
        include_inactive: bool = False,
        company_id: Optional[UUID] = None,
    ) -> Tuple[List[Dict[str, Any]], str, str]:
        if company_id is None:
            return ([], Status.SUCCESS, "No company selected")
        query = db.query(Party).filter(Party.company_id == company_id)
        if not include_inactive:
            query = query.filter(Party.active == "Y")
        if key_group is not None:
            # "Both" parties appear in customer and vendor lists.
            query = query.filter(Party.key_group.in_([key_group, "B"]))
        parties = query.offset(skip).limit(limit).all()
        data = [PartyService._to_dict(p) for p in parties]
        return (data, Status.SUCCESS, "Customers fetched successfully")

    @staticmethod
    def get_by_id(
        db: Session, party_id: UUID
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        party = db.query(Party).filter(Party.id == party_id).first()
        if not party:
            return (None, Status.ERROR, "Customer not found")
        return (
            PartyService._to_dict(party),
            Status.SUCCESS,
            "Customer details fetched successfully",
        )

    @staticmethod
    def get_by_email(db: Session, email: str, key_group: str) -> Optional[Party]:
        return (
            db.query(Party)
            .filter(
                Party.name_contact_info["email"].as_string() == email,
                Party.key_group == key_group,
            )
            .first()
        )

    @staticmethod
    def get_by_mobile(
        db: Session, mobile_number: str, key_group: str
    ) -> Optional[Party]:
        return (
            db.query(Party)
            .filter(
                Party.name_contact_info["mobile_number"].as_string() == mobile_number,
                Party.key_group == key_group,
            )
            .first()
        )

    @staticmethod
    def find_duplicate_name(
        db: Session, name: str, key_group: Optional[str], exclude_id: Optional[UUID]
    ) -> Optional[Party]:
        name_l = (name or "").strip().lower()
        if not name_l:
            return None
        q = db.query(Party).filter(Party.active == "Y")
        if key_group:
            q = q.filter(Party.key_group.in_([key_group, "B"]))
        for p in q.all():
            if exclude_id and p.id == exclude_id:
                continue
            n = p.name_contact_info or {}
            company = (n.get("company_name") or "").strip().lower()
            display = (n.get("display_name") or "").strip().lower()
            full = f"{n.get('first_name', '')} {n.get('last_name', '')}".strip().lower()
            if (company and company == name_l) or (display and display == name_l) or (full and full == name_l):
                return p
        return None

    @staticmethod
    def validate(
        db: Session,
        name: Optional[str],
        gstin: Optional[str],
        key_group: Optional[str],
        exclude_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        out: Dict[str, Any] = {"name": None, "gstin": None}
        if name is not None:
            dup = PartyService.find_duplicate_name(db, name, key_group, exclude_id)
            if not (name or "").strip():
                out["name"] = {"level": "error", "message": "Party name is required"}
            elif dup:
                out["name"] = {
                    "level": "warning",
                    "message": "A party with this display name already exists",
                    "duplicate_id": str(dup.id),
                }
            else:
                out["name"] = {"level": "ok", "message": "Name is available"}
        if gstin:
            out["gstin"] = GstService.validate_gstin(gstin)
            dup_g = (
                db.query(Party)
                .filter(Party.gstin == gstin.strip().upper(), Party.active == "Y")
                .first()
            )
            if dup_g and (not exclude_id or dup_g.id != exclude_id):
                out["gstin"]["duplicate"] = True
                out["gstin"]["level"] = "warning"
                out["gstin"]["message"] = (
                    out["gstin"].get("message", "")
                    + " • Another party already uses this GSTIN"
                ).strip(" •")
        return out

    @staticmethod
    def _outstanding(db: Session, ledger_id: Optional[UUID]) -> Dict[str, float]:
        if not ledger_id:
            return {"debit": 0.0, "credit": 0.0, "balance": 0.0}
        rows = (
            db.query(VoucherDetail)
            .join(VoucherHeader, VoucherHeader.id == VoucherDetail.voucher_id)
            .filter(
                VoucherDetail.ledger_id == ledger_id,
                VoucherDetail.active == "Y",
                VoucherHeader.active == "Y",
                VoucherHeader.voucher_status == "POSTED",
            )
            .all()
        )
        debit = sum(float(r.debit_amount or 0) for r in rows)
        credit = sum(float(r.credit_amount or 0) for r in rows)
        return {"debit": debit, "credit": credit, "balance": debit - credit}

    @staticmethod
    def outstanding_preview(db: Session, party_id: UUID) -> Tuple[Optional[Dict[str, Any]], str, str]:
        party = db.query(Party).filter(Party.id == party_id).first()
        if not party:
            return (None, Status.ERROR, "Party not found")
        opening = float((party.additional_info or {}).get("opening_bal") or 0)
        agg = PartyService._outstanding(db, party.ledger_id)
        agg["opening_balance"] = opening
        agg["net_outstanding"] = opening + agg["balance"]
        return (agg, Status.SUCCESS, "Outstanding fetched")

    @staticmethod
    def _sync_gst_fields(db_party: Party, payload) -> None:
        db_party.gstin = (payload.gstin or "").strip().upper() or None
        db_party.pan = (payload.pan or "").strip().upper() or None
        db_party.gst_type = payload.gst_type

    @staticmethod
    def create(
        db: Session, party: PartyCreate, company_id: Optional[UUID] = None
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        email = party.name_contact_info.email
        mobile = party.name_contact_info.mobile_number
        key_group = party.key_group
        if email:
            existing = PartyService.get_by_email(db, email, key_group)
            if existing:
                return (None, Status.ERROR, "Email already exists")

        if mobile:
            existing = PartyService.get_by_mobile(db, mobile, key_group)
            if existing:
                return (None, Status.ERROR, "Mobile number already exists")

        data = party.model_dump(mode="json")
        data.pop("gstin", None)
        data.pop("pan", None)
        data.pop("gst_type", None)
        db_party = Party(**data)
        if company_id is not None:
            db_party.company_id = company_id
        PartyService._sync_gst_fields(db_party, party)
        db.add(db_party)
        db.flush()

        group = PartyService._get_ledger_group_for_party(db, party.key_group)
        if group:
            name = PartyService._derive_ledger_name(
                party.name_contact_info.model_dump()
            )
            db_ledger = Ledger(
                company_id=company_id,
                name=name,
                ledger_group_id=group.id,
                category="customer" if party.key_group != "V" else "vendor",
                balance_type=group.balance_type,
                gstin=db_party.gstin,
                gst_type=db_party.gst_type,
                payment_terms=party.payment_info.terms if party.payment_info else None,
                credit_limit=party.payment_info.credit_limit if party.payment_info else None,
                opening_balance=party.additional_info.opening_bal
                if party.additional_info
                else None,
                opening_balance_date=party.additional_info.date
                if party.additional_info
                else None,
                active=party.active,
                created_by=party.created_by,
                is_system="N",
            )
            db.add(db_ledger)
            db.flush()
            db_party.ledger_id = db_ledger.id

        db.commit()
        db.refresh(db_party)
        return (
            PartyService._to_dict(db_party),
            Status.SUCCESS,
            "Customer data added",
        )

    @staticmethod
    def quick_create(
        db: Session, data: PartyQuickCreate, company_id: Optional[UUID] = None
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        """Minimal creation from the voucher screen: name (+ optional GSTIN)."""
        payload = PartyCreate(
            key_group=data.key_group or "C",
            active="Y",
            gstin=data.gstin,
            name_contact_info=NameContactInfo(
                first_name=data.name,
                display_name=data.name,
                mobile_number=data.mobile,
            ),
        )
        return PartyService.create(db, payload, company_id=company_id)

    @staticmethod
    def update(
        db: Session, party_id: UUID, party: PartyUpdate
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        db_party = db.query(Party).filter(Party.id == party_id).first()
        if not db_party:
            return (None, Status.ERROR, "Customer not found")

        email = party.name_contact_info.email
        mobile = party.name_contact_info.mobile_number
        key_group = party.key_group
        if email:
            existing = PartyService.get_by_email(db, email, key_group)
            if existing and existing.id != party_id:
                return (None, Status.ERROR, "Email already exists")

        if mobile:
            existing = PartyService.get_by_mobile(db, mobile, key_group)
            if existing and existing.id != party_id:
                return (None, Status.ERROR, "Mobile number already exists")

        data = party.model_dump(mode="json")
        data.pop("gstin", None)
        data.pop("pan", None)
        data.pop("gst_type", None)
        for key, value in data.items():
            setattr(db_party, key, value)
        PartyService._sync_gst_fields(db_party, party)

        if db_party.ledger_id:
            db_ledger = db.query(Ledger).filter(Ledger.id == db_party.ledger_id).first()
            if db_ledger:
                db_ledger.name = PartyService._derive_ledger_name(
                    party.name_contact_info.model_dump()
                )
                db_ledger.gstin = db_party.gstin
                db_ledger.gst_type = db_party.gst_type
                if party.payment_info:
                    db_ledger.payment_terms = party.payment_info.terms
                    db_ledger.credit_limit = party.payment_info.credit_limit
                db_ledger.opening_balance = (
                    party.additional_info.opening_bal if party.additional_info else None
                )
                db_ledger.opening_balance_date = (
                    party.additional_info.date if party.additional_info else None
                )
                db_ledger.active = party.active
                db_ledger.modified_by = party.modified_by

        db.commit()
        db.refresh(db_party)
        return (
            PartyService._to_dict(db_party),
            Status.SUCCESS,
            "Customer data updated",
        )

    @staticmethod
    def update_active(
        db: Session, party_id: UUID, active: str
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        if active not in ["Y", "N"]:
            return (None, Status.ERROR, "Invalid active value. Use 'Y' or 'N'")

        db_party = db.query(Party).filter(Party.id == party_id).first()
        if not db_party:
            return (None, Status.ERROR, "Customer not found")

        db_party.active = active

        if db_party.ledger_id:
            db_ledger = db.query(Ledger).filter(Ledger.id == db_party.ledger_id).first()
            if db_ledger:
                db_ledger.active = active

        db.commit()
        db.refresh(db_party)
        return (
            PartyService._to_dict(db_party),
            Status.SUCCESS,
            "Status updated successfully",
        )

    @staticmethod
    def delete(db: Session, party_id: UUID) -> Tuple[bool, str, str]:
        db_party = db.query(Party).filter(Party.id == party_id).first()
        if not db_party:
            return (False, Status.ERROR, "Customer not found")

        db_party.active = "N"

        if db_party.ledger_id:
            db_ledger = db.query(Ledger).filter(Ledger.id == db_party.ledger_id).first()
            if db_ledger:
                db_ledger.active = "N"

        db.commit()
        return (True, Status.SUCCESS, "Customer data removed successfully")
