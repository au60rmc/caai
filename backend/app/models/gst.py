import uuid
from sqlalchemy import Column, String, DateTime, Numeric
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class GstRate(Base):
    __tablename__ = "gst_rate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rate = Column(Numeric(5, 2), nullable=False)
    tax_type = Column(String(20), default="BOTH")  # GOODS / SERVICE / BOTH
    description = Column(String(100))
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())


class HsnCode(Base):
    __tablename__ = "hsn_code"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(10), nullable=False, index=True)
    description = Column(String(255))
    gst_rate = Column(Numeric(5, 2))
    kind = Column(String(1), default="G")  # G=HSN (goods) S=SAC (service)
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
