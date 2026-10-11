import uuid

from sqlalchemy import Column, String, DateTime, Date, Numeric, ForeignKey, Index
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class VoucherHeader(Base):
    __tablename__ = "voucher_header"
    __table_args__ = (
        Index(
            "ix_voucher_header_dashboard_scope",
            "company_id",
            "voucher_status",
            "active",
            "voucher_date",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    voucher_no = Column(String(50))
    voucher_type = Column(String(20))
    voucher_type_id = Column(
        UUID(as_uuid=True),
        ForeignKey("master.voucher_type.id"),
        index=True,
        nullable=True,
    )
    voucher_type_name = Column(String(100))
    voucher_date = Column(Date)
    due_date = Column(Date, index=True, nullable=True)
    reference_no = Column(String(50))
    reference_date = Column(Date, nullable=True)
    narration = Column(String(50))
    voucher_status = Column(String(15), default="DRAFT")
    total_debit = Column(Numeric(18, 2))
    total_credit = Column(Numeric(18, 2))
    source_document_type = Column(String(50), nullable=True)
    source_document_id = Column(UUID(as_uuid=True), nullable=True)
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )

    details = relationship(
        "VoucherDetail", back_populates="voucher", cascade="all, delete-orphan"
    )
