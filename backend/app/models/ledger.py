import uuid

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Date,
    Numeric,
    Text,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Ledger(Base):
    """Chart of accounts. Extended per FA Master Module spec with GST & Tax,
    Contact, Credit & Billing and Advanced (tags / cost center / custom
    fields / default narration) sections plus bank/cash flags."""

    __tablename__ = "ledger"
    __table_args__ = (
        Index("ix_ledger_company_active", "company_id", "active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    name = Column(String(50), index=True)
    ledger_group_id = Column(UUID, ForeignKey("master.ledger_group.id"), nullable=True)
    category = Column(String(30))  # bank/cash/customer/vendor/income/expense/... (legacy)
    balance_type = Column(String(2))
    opening_balance = Column(Numeric)
    opening_balance_date = Column(Date)
    description = Column(Text)

    # GST & Tax (contextual)
    gstin = Column(String(15), index=True)
    gst_type = Column(String(20))  # REGISTERED/UNREGISTERED/COMPOSITION/EXEMPT
    default_gst_rate = Column(Numeric(5, 2))
    hsn_sac = Column(String(10))

    # Contact details
    address = Column(Text)
    contact_person = Column(String(100))
    email = Column(String(100))
    mobile = Column(String(20))

    # Credit & billing
    credit_limit = Column(Numeric(18, 2))
    payment_terms = Column(String(30))
    default_narration = Column(String(100))

    # Advanced
    tags = Column(String(255))
    cost_center_id = Column(UUID(as_uuid=True), nullable=True)
    custom_fields = Column(JSON)

    is_bank = Column(String(1), default="N")
    is_cash = Column(String(1), default="N")
    is_frozen = Column(String(1), default="N")  # audit-locked ledgers

    active = Column(String(1), default="Y")
    is_system = Column(String(1), default="N")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )
