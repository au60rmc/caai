import uuid
from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class CustomFieldDefinition(Base):
    """Metadata for customer-specific fields on LEDGER / PARTY / ITEM."""

    __tablename__ = "custom_field_definition"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module = Column(String(20), nullable=False)  # LEDGER / PARTY / ITEM
    field_name = Column(String(50), nullable=False)
    field_label = Column(String(100))
    field_type = Column(String(15), default="TEXT")  # TEXT/NUMBER/DATE/SELECT
    options = Column(Text)  # JSON array for SELECT
    is_required = Column(String(1), default="N")
    default_value = Column(String(100))
    display_order = Column(Integer, default=0)
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())


class CustomFieldValue(Base):
    __tablename__ = "custom_field_value"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    record_id = Column(String(50), nullable=False, index=True)
    value = Column(Text)
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
