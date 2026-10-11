from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from app.core.database import Base
import uuid


class SystemSetting(Base):
    __tablename__ = "system_setting"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key_name = Column(String(100))
    key_value = Column(String(100))
    key_type = Column(String(1))
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    created_date = Column(DateTime(timezone=True))
    modified_by = Column(String(100))
    modified_date = Column(DateTime(timezone=True))
    sys_module = Column(String(50))
