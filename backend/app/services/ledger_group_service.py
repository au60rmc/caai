from sqlalchemy.orm import Session
from app.models.ledger_group import LedgerGroup
from app.schemas.ledger_group import LedgerGroupCreate, LedgerGroupUpdate
from app.schemas.response import Status
from typing import List, Optional, Tuple, Any, Dict
from uuid import UUID


class LedgerGroupService:
    @staticmethod
    def _to_dict(lg: LedgerGroup) -> Dict[str, Any]:
        return {
            "id": str(lg.id),
            "name": lg.name,
            "code": lg.code,
            "parent_id": str(lg.parent_id) if lg.parent_id else None,
            "key_group": lg.key_group,
            "balance_type": lg.balance_type,
            "hierarchy_path": lg.hierarchy_path,
            "active": lg.active,
            "created_by": lg.created_by,
            "modified_by": lg.modified_by,
            "created_date": lg.created_date.isoformat() if lg.created_date else None,
            "modified_date": lg.modified_date.isoformat() if lg.modified_date else None,
            "is_system": lg.is_system,
        }

    @staticmethod
    def _build_path(db: Session, lg: LedgerGroup) -> str:
        parts = [lg.name or ""]
        cur = lg
        seen = set()
        while cur.parent_id and cur.parent_id not in seen:
            seen.add(cur.parent_id)
            cur = db.query(LedgerGroup).filter(LedgerGroup.id == cur.parent_id).first()
            if not cur:
                break
            parts.insert(0, cur.name or "")
        return " > ".join(parts)

    @staticmethod
    def get_all(
        db: Session, skip: int = 0, limit: int = 500
    ) -> Tuple[List[Dict[str, Any]], str, str]:
        ledger_groups = (
            db.query(LedgerGroup)
            .filter(LedgerGroup.active == "Y")
            .offset(skip)
            .limit(limit)
            .all()
        )
        data = [LedgerGroupService._to_dict(lg) for lg in ledger_groups]
        return (data, Status.SUCCESS, "Ledger Groups fetched successfully")

    @staticmethod
    def get_by_id(
        db: Session, ledger_group_id: UUID
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        ledger_group = db.query(LedgerGroup).filter(LedgerGroup.id == ledger_group_id).first()
        if not ledger_group:
            return (None, Status.ERROR, "Ledger Group not found")
        return (
            LedgerGroupService._to_dict(ledger_group),
            Status.SUCCESS,
            "Ledger Group details fetched successfully",
        )

    @staticmethod
    def create(
        db: Session, ledger_group: LedgerGroupCreate
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        db_lg = LedgerGroup(**ledger_group.model_dump(exclude_unset=True))
        db.add(db_lg)
        db.flush()
        db_lg.hierarchy_path = LedgerGroupService._build_path(db, db_lg)
        db.commit()
        db.refresh(db_lg)
        return (
            LedgerGroupService._to_dict(db_lg),
            Status.SUCCESS,
            "Ledger Group created successfully",
        )

    @staticmethod
    def update(
        db: Session, ledger_group_id: UUID, ledger_group: LedgerGroupUpdate
    ) -> Tuple[Optional[Dict[str, Any]], str, str]:
        db_lg = db.query(LedgerGroup).filter(LedgerGroup.id == ledger_group_id).first()
        if not db_lg:
            return (None, Status.ERROR, "Ledger Group not found")

        for key, value in ledger_group.model_dump(exclude_unset=True).items():
            setattr(db_lg, key, value)
        db_lg.hierarchy_path = LedgerGroupService._build_path(db, db_lg)

        db.commit()
        db.refresh(db_lg)
        return (
            LedgerGroupService._to_dict(db_lg),
            Status.SUCCESS,
            "Ledger Group updated successfully",
        )

    @staticmethod
    def delete(db: Session, ledger_group_id: UUID) -> Tuple[bool, str, str]:
        db_lg = db.query(LedgerGroup).filter(LedgerGroup.id == ledger_group_id).first()
        if not db_lg:
            return (False, Status.ERROR, "Ledger Group not found")
        if db_lg.is_system == "Y":
            return (False, Status.ERROR, "System groups cannot be deleted")

        db_lg.active = "N"
        db.commit()
        return (True, Status.SUCCESS, "Ledger Group removed successfully")
