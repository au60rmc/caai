import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy import Uuid as UUID, JSON as JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class Party(Base):
    """Customers / Vendors / Both. key_group: C=customer, V=vendor, B=both."""

    __tablename__ = "party"
    __table_args__ = (
        Index("ix_party_company_group_active", "company_id", "key_group", "active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    name_contact_info = Column(JSONB)
    address_info = Column(JSONB)
    payment_info = Column(JSONB)
    additional_info = Column(JSONB)
    gstin = Column(String(15), index=True)
    pan = Column(String(10))
    gst_type = Column(String(20))
    custom_fields = Column(JSONB)
    active = Column(String(1), default="Y")
    ledger_id = Column(
        UUID(as_uuid=True), ForeignKey("master.ledger.id"), nullable=True
    )
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )
    key_group = Column(String(1))
