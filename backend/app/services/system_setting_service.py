from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting
from app.schemas.response import Status, Message
from typing import List, Tuple
import uuid


class SystemSettingService:
    @staticmethod
    def get_all(db: Session) -> Tuple[List[dict], str, str]:
        settings = (
            db.query(SystemSetting)
            .filter(SystemSetting.active == "Y")
            .order_by(SystemSetting.key_name)
            .all()
        )
        data = [SystemSettingService._map_to_response(s) for s in settings]
        return (data, Status.SUCCESS, Message.FETCHED)

    @staticmethod
    def save_settings(db: Session, settings_list: List[dict]) -> Tuple[bool, str, str]:
        if not settings_list:
            return (False, "FAILED", "No data to save")

        try:
            for item in settings_list:
                item_id = item.get("id")
                if item_id:
                    try:
                        db.query(SystemSetting).filter(
                            SystemSetting.id == uuid.UUID(item_id)
                        ).update(
                            {
                                "key_name": item.get("keyName", ""),
                                "key_value": item.get("keyValue", ""),
                                "key_type": item.get("keyType", "S"),
                                "active": item.get("active", "Y"),
                                "modified_by": item.get("modifiedBy"),
                            }
                        )
                    except ValueError:
                        pass
                else:
                    db_setting = SystemSetting(
                        key_name=item.get("keyName", ""),
                        key_value=item.get("keyValue", ""),
                        key_type=item.get("keyType", "S"),
                        active=item.get("active", "Y"),
                        created_by=item.get("createdBy"),
                        sys_module=item.get("sysModule"),
                    )
                    db.add(db_setting)

            db.commit()
            return (True, Status.SUCCESS, "Data Saved Successfully")
        except Exception as e:
            db.rollback()
            return (False, "FAILED", str(e))

    @staticmethod
    def _map_to_response(setting: SystemSetting) -> dict:
        return {
            "id": str(setting.id),
            "keyName": setting.key_name,
            "keyValue": setting.key_value,
            "keyType": setting.key_type,
            "active": setting.active,
            "createdBy": setting.created_by,
            "createdDate": setting.created_date.isoformat()
            if setting.created_date
            else None,
            "modifiedBy": setting.modified_by,
            "modifiedDate": setting.modified_date.isoformat()
            if setting.modified_date
            else None,
            "sysModule": setting.sys_module,
        }
