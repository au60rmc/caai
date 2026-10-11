import uuid

from sqlalchemy import Column, DateTime, Index, String
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func

from app.core.database import Base


class VoucherType(Base):
    __tablename__ = "voucher_type"
    __table_args__ = (
        Index("ix_voucher_type_company_active", "company_id", "active"),
        Index("ix_voucher_type_company_base", "company_id", "base_voucher_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    base_voucher_type = Column(String(20), nullable=False)
    abbreviation = Column(String(20))
    active = Column(String(1), nullable=False, default="Y")
    is_system = Column(String(1), nullable=False, default="N")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )


Index(
    "uq_voucher_type_company_name_ci",
    VoucherType.company_id,
    func.lower(VoucherType.name),
    unique=True,
)