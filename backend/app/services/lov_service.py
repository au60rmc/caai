from sqlalchemy.orm import Session
from app.models.lov import Lov
from app.schemas.response import Status, Message
from typing import List, Tuple, Optional
import uuid


class LovService:
    @staticmethod
    def get_by_id(db: Session, lov_id: str) -> Tuple[Optional[dict], str, str]:
        try:
            lov_uuid = uuid.UUID(lov_id)
        except ValueError:
            return (None, Status.ERROR, "Invalid ID format")

        lov = db.query(Lov).filter(Lov.id == lov_uuid).first()
        if not lov:
            return (None, Status.ERROR, Message.NOT_FOUND)
        response = LovService._map_to_response(lov)
        return (response, Status.SUCCESS, Message.FETCHED)

    @staticmethod
    def get_by_group(db: Session, key_grp: str) -> Tuple[List[dict], str, str]:
        lov_group = (
            db.query(Lov)
            .filter(Lov.key_grp == key_grp, Lov.active == "Y")
            .order_by(Lov.display_order)
            .all()
        )
        data = [LovService._map_to_response(lov) for lov in lov_group]
        return (data, Status.SUCCESS, Message.FETCHED)

    @staticmethod
    def get_distinct_groups(db: Session) -> Tuple[List[str], str, str]:
        groups = db.query(Lov.key_grp).filter(Lov.active == "Y").distinct().all()
        data = [g[0] for g in groups]
        return (data, Status.SUCCESS, Message.FETCHED)

    @staticmethod
    def save_lov_master(db: Session, lov_list: List[dict]) -> Tuple[bool, str, str]:
        if not lov_list:
            return (False, "FAILED", "No data to save")

        first_record = lov_list[0]
        group_code = first_record.get("group")
        is_active = first_record.get("active", "Y") == "Y"

        all_new_items = all(not item.get("id") for item in lov_list)

        if is_active and all_new_items:
            existing_group = (
                db.query(Lov)
                .filter(Lov.key_grp == group_code, Lov.active == "Y")
                .first()
            )
            if existing_group:
                return (False, "FAILED", "Group code already exists")

        try:
            if not is_active:
                db.query(Lov).filter(
                    Lov.key_grp == group_code, Lov.active == "Y"
                ).update({"active": "N"})
            else:
                for item in lov_list:
                    item_id = item.get("id")
                    if item_id:
                        try:
                            db.query(Lov).filter(Lov.id == uuid.UUID(item_id)).update(
                                {
                                    "key_txt": item.get("text", ""),
                                    "key_value": item.get("value", ""),
                                    "display_order": item.get("dispOrder", 0),
                                    "key_type": item.get("keyType", "U"),
                                    "active": item.get("active", "Y"),
                                }
                            )
                        except ValueError:
                            pass
                    else:
                        db_lov = Lov(
                            key_grp=group_code,
                            key_txt=item.get("text", ""),
                            key_value=item.get("value", ""),
                            display_order=item.get("dispOrder", 0),
                            key_type=item.get("keyType", "U"),
                            active=item.get("active", "Y"),
                        )
                        db.add(db_lov)

            db.commit()
            return (True, Status.SUCCESS, "Data Saved Successfully")
        except Exception as e:
            db.rollback()
            return (False, "FAILED", str(e))

    @staticmethod
    def _map_to_response(lov: Lov) -> dict:
        return {
            "id": str(lov.id),
            "group": lov.key_grp,
            "text": lov.key_txt,
            "value": lov.key_value,
            "dispOrder": lov.display_order,
            "keyType": lov.key_type,
            "active": lov.active,
            "createdBy": lov.created_by,
            "updatedBy": lov.updated_by,
            "createdDate": lov.created_at.isoformat()
            if lov.created_at is not None
            else None,
            "modifiedDate": lov.updated_at.isoformat()
            if lov.updated_at is not None
            else None,
        }
