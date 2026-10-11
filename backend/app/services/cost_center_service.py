from sqlalchemy.orm import Session
from app.models.cost_center import CostCenter
from app.schemas.cost_center import CostCenterCreate, CostCenterUpdate
from app.schemas.response import Status
from typing import List, Optional, Tuple, Any, Dict
from uuid import UUID


class CostCenterService:
    @staticmethod
    def _to_dict(c: CostCenter) -> Dict[str, Any]:
        return {
            "id": str(c.id),
            "name": c.name,
            "code": c.code,
            "kind": c.kind,
            "parent_id": str(c.parent_id) if c.parent_id else None,
            "active": c.active,
            "created_date": c.created_date.isoformat() if c.created_date else None,
            "modified_date": c.modified_date.isoformat() if c.modified_date else None,
        }

    @staticmethod
    def get_all(db: Session) -> Tuple[List[Dict[str, Any]], str, str]:
        rows = db.query(CostCenter).filter(CostCenter.active == "Y").order_by(CostCenter.name).all()
        return ([CostCenterService._to_dict(c) for c in rows], Status.SUCCESS,
                "Cost centers fetched successfully")

    @staticmethod
    def create(db: Session, payload: CostCenterCreate) -> Tuple[Optional[Dict[str, Any]], str, str]:
        dup = db.query(CostCenter).filter(
            CostCenter.name == payload.name, CostCenter.active == "Y"
        ).first()
        if dup:
            return (None, Status.ERROR, "Cost center name already exists")
        c = CostCenter(**payload.model_dump(exclude_unset=True))
        db.add(c)
        db.commit()
        db.refresh(c)
        return (CostCenterService._to_dict(c), Status.SUCCESS, "Cost center created successfully")

    @staticmethod
    def update(db: Session, cid: UUID, payload: CostCenterUpdate) -> Tuple[Optional[Dict[str, Any]], str, str]:
        c = db.query(CostCenter).filter(CostCenter.id == cid).first()
        if not c:
            return (None, Status.ERROR, "Cost center not found")
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(c, k, v)
        db.commit()
        db.refresh(c)
        return (CostCenterService._to_dict(c), Status.SUCCESS, "Cost center updated successfully")

    @staticmethod
    def delete(db: Session, cid: UUID) -> Tuple[bool, str, str]:
        c = db.query(CostCenter).filter(CostCenter.id == cid).first()
        if not c:
            return (False, Status.ERROR, "Cost center not found")
        c.active = "N"
        db.commit()
        return (True, Status.SUCCESS, "Cost center removed successfully")
