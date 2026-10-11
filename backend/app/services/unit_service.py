from sqlalchemy.orm import Session
from app.models.unit import UnitMaster
from app.schemas.response import Status
from typing import List, Tuple, Any, Dict


class UnitService:
    @staticmethod
    def _to_dict(u: UnitMaster) -> Dict[str, Any]:
        return {
            "id": str(u.id),
            "unit_name": u.unit_name,
            "unit_symbol": u.unit_symbol,
            "active": u.active,
        }

    @staticmethod
    def get_all(db: Session) -> Tuple[List[Dict[str, Any]], str, str]:
        rows = db.query(UnitMaster).filter(UnitMaster.active == "Y").order_by(UnitMaster.unit_name).all()
        return ([UnitService._to_dict(u) for u in rows], Status.SUCCESS,
                "Units fetched successfully")

    @staticmethod
    def bulk_save(db: Session, items: list) -> Tuple[bool, str, str]:
        for item in items:
            uid = item.id
            if uid:
                existing = db.query(UnitMaster).filter(UnitMaster.id == uid).first()
                if existing:
                    existing.unit_name = item.unit_name
                    existing.unit_symbol = item.unit_symbol
                    existing.active = item.active
            else:
                db.add(UnitMaster(unit_name=item.unit_name,
                                  unit_symbol=item.unit_symbol,
                                  active=item.active))
        db.commit()
        return (True, Status.SUCCESS, "Units saved successfully")
