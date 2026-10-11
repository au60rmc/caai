import uuid
from sqlalchemy import Column, String, DateTime, Date, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from app.core.database import Base


class Company(Base):
    """Root company context: business profile, GST, PAN and financial year."""

    __tablename__ = "company"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(100), nullable=False)
    gstin = Column(String(15))
    pan = Column(String(10))
    state_code = Column(String(2))
    address = Column(Text)
    city = Column(String(50))
    state = Column(String(50))
    pincode = Column(String(10))
    email = Column(String(100))
    mobile = Column(String(20))
    financial_year_start = Column(Date)
    financial_year_end = Column(Date)
    currency = Column(String(5), default="INR")
    maintain_mode = Column(
        String(30), nullable=False, default="ACCOUNT_ONLY", server_default="ACCOUNT_ONLY"
    )
    is_default = Column(String(1), default="N")
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
