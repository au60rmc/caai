from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Lov(Base):
    __tablename__ = "lov"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key_grp = Column(String(50), nullable=False)
    key_txt = Column(String(100), nullable=False)
    key_value = Column(String(50), nullable=False)
    active = Column(String(1), default="Y")
    display_order = Column(Integer, default=0)
    key_type = Column(String(1), default="G")
    created_by = Column(String(50), default="system")
    updated_by = Column(String(50), default="system")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
