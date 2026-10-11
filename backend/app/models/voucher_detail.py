import uuid

from sqlalchemy import Column, String, DateTime, Numeric, Integer, ForeignKey, Index
from sqlalchemy import Uuid as UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class VoucherDetail(Base):
    __tablename__ = "voucher_detail"
    __table_args__ = (
        Index("ix_voucher_detail_voucher_active", "voucher_id", "active"),
        Index("ix_voucher_detail_ledger_active", "ledger_id", "active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    voucher_id = Column(
        UUID(as_uuid=True), ForeignKey("master.voucher_header.id"), nullable=False
    )
    line_no = Column(Integer, nullable=False)
    ledger_id = Column(
        UUID(as_uuid=True), ForeignKey("master.ledger.id"), nullable=False
    )
    cost_center_id = Column(UUID(as_uuid=True), nullable=True)
    debit_amount = Column(Numeric(18, 2))
    credit_amount = Column(Numeric(18, 2))
    remarks = Column(String(30))
    active = Column(String(1), default="Y")
    created_by = Column(String(100))
    modified_by = Column(String(100))
    created_date = Column(DateTime(timezone=True), default=func.now())
    modified_date = Column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )

    voucher = relationship("VoucherHeader", back_populates="details")
    ledger = relationship("Ledger", lazy="joined")
