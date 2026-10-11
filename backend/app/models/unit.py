import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class UnitMaster(Base):
    __tablename__ = "unit_master"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_name = Column(String(50), nullable=False)
    unit_symbol = Column(String(10), nullable=False)
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
