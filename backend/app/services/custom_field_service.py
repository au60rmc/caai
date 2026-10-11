import json
from sqlalchemy.orm import Session
from app.models.custom_field import CustomFieldDefinition, CustomFieldValue
from app.schemas.response import Status
from typing import List, Optional, Tuple, Any, Dict


class CustomFieldService:
    @staticmethod
    def _to_dict(f: CustomFieldDefinition) -> Dict[str, Any]:
        opts = None
        if f.options:
            try:
                opts = json.loads(f.options)
            except ValueError:
                opts = [o.strip() for o in f.options.split(",") if o.strip()]
        return {
            "id": str(f.id),
            "module": f.module,
            "field_name": f.field_name,
            "field_label": f.field_label or f.field_name,
            "field_type": f.field_type,
            "options": opts,
            "is_required": f.is_required,
            "default_value": f.default_value,
            "display_order": f.display_order,
            "active": f.active,
        }

    @staticmethod
    def get_definitions(db: Session, module: Optional[str] = None) -> Tuple[List[Dict[str, Any]], str, str]:
        q = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.active == "Y")
        if module:
            q = q.filter(CustomFieldDefinition.module == module.upper())
        rows = q.order_by(CustomFieldDefinition.module,
                          CustomFieldDefinition.display_order).all()
        return ([CustomFieldService._to_dict(f) for f in rows], Status.SUCCESS,
                "Custom fields fetched successfully")

    @staticmethod
    def bulk_save(db: Session, items: list) -> Tuple[bool, str, str]:
        for item in items:
            fid = item.id
            options = item.options
            if fid:
                existing = db.query(CustomFieldDefinition).filter(
                    CustomFieldDefinition.id == fid
                ).first()
                if existing:
                    existing.module = item.module.upper()
                    existing.field_name = item.field_name
                    existing.field_label = item.field_label
                    existing.field_type = item.field_type
                    existing.options = options
                    existing.is_required = item.is_required
                    existing.default_value = item.default_value
                    existing.display_order = item.display_order
                    existing.active = item.active
            else:
                db.add(CustomFieldDefinition(
                    module=item.module.upper(),
                    field_name=item.field_name,
                    field_label=item.field_label,
                    field_type=item.field_type,
                    options=options,
                    is_required=item.is_required,
                    default_value=item.default_value,
                    display_order=item.display_order,
                    active=item.active,
                ))
        db.commit()
        return (True, Status.SUCCESS, "Custom fields saved successfully")

    @staticmethod
    def get_values(db: Session, record_id: str) -> List[Dict[str, Any]]:
        rows = db.query(CustomFieldValue).filter(
            CustomFieldValue.record_id == record_id
        ).all()
        return [{"field_id": str(v.field_id), "record_id": v.record_id,
                 "value": v.value} for v in rows]

    @staticmethod
    def save_values(db: Session, items: list) -> Tuple[bool, str, str]:
        for item in items:
            existing = db.query(CustomFieldValue).filter(
                CustomFieldValue.field_id == item.field_id,
                CustomFieldValue.record_id == item.record_id,
            ).first()
            if existing:
                existing.value = item.value
            else:
                db.add(CustomFieldValue(field_id=item.field_id,
                                        record_id=item.record_id,
                                        value=item.value))
        db.commit()
        return (True, Status.SUCCESS, "Values saved successfully")
